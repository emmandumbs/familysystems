-- ============================================================================
-- FAMILYOS — RECONCILIATION, DOUBLE-ENTRY LEDGER & TENANT ISOLATION (v3.4.1 UP)
-- Migration ID: 0002_familyos_v341_reconciliation_up
-- Reversible via: 0002_familyos_v341_reconciliation_down.sql
--
-- Architecture & Security Gap Closure:
-- 1. user_accounts & auth_sessions persistent relational identity tables
-- 2. Chart of Accounts expansion (ASSET, LIABILITY, EQUITY, INCOME, EXPENSE)
-- 3. financial_entries double-entry general ledger with database-enforced:
--    - Transaction posting status ('DRAFT', 'POSTED', 'VOID')
--    - Deferred constraint trigger on financial_transactions (SUM(DEBIT) = SUM(CREDIT), >=2 entries)
--    - Deferred constraint trigger on financial_entries
--    - Immutability trigger blocking UPDATE or DELETE on posted entries
--    - Composite tenant isolation foreign keys (family_id, account_id) & (family_id, transaction_id)
-- 4. Controlled PL/pgSQL posting procedure post_financial_transaction
-- 5. Family-aware composite foreign keys across all relational tables
-- 6. Dedicated relational household tables matching Android Room entities
-- ============================================================================

BEGIN;

-- 1. User Accounts & Persistent Auth Sessions
CREATE TABLE IF NOT EXISTS user_accounts (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    password_hash TEXT,
    revoked_before_sec BIGINT NOT NULL DEFAULT 0,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_user_accounts_email ON user_accounts (email);

CREATE TABLE IF NOT EXISTS auth_sessions (
    session_id TEXT PRIMARY KEY,
    user_account_id TEXT NOT NULL REFERENCES user_accounts(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL,
    created_at BIGINT NOT NULL,
    expires_at BIGINT NOT NULL,
    is_revoked BOOLEAN NOT NULL DEFAULT FALSE,
    revoked_at BIGINT,
    revoked_reason TEXT,
    device_info TEXT
);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_user ON auth_sessions (user_account_id);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_token_hash ON auth_sessions (token_hash);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_active ON auth_sessions (user_account_id, is_revoked, expires_at);

-- 2. Expand financial_accounts account_type CHECK to support full Chart of Accounts
ALTER TABLE financial_accounts DROP CONSTRAINT IF EXISTS financial_accounts_account_type_check;
ALTER TABLE financial_accounts ADD CONSTRAINT financial_accounts_account_type_check
    CHECK (account_type IN ('CHECKING', 'SAVINGS', 'CREDIT_CARD', 'INVESTMENT', 'CASH', 'LOAN', 'ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE'));

-- Add status, idempotency_key, and payload_hash to financial_transactions for controlled posting lifecycle
ALTER TABLE financial_transactions ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'POSTED' CHECK (status IN ('DRAFT', 'POSTED', 'VOID'));
ALTER TABLE financial_transactions ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
ALTER TABLE financial_transactions ADD COLUMN IF NOT EXISTS payload_hash TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_financial_transactions_family_idempotency
    ON financial_transactions (family_id, idempotency_key)
    WHERE idempotency_key IS NOT NULL;

-- 3. Composite Unique Keys on Parent Tables to Enable Tenant-Isolated Composite Foreign Keys
CREATE UNIQUE INDEX IF NOT EXISTS uq_family_members_family_id ON family_members (family_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_financial_accounts_family_id ON financial_accounts (family_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_financial_transactions_family_id ON financial_transactions (family_id, id);

-- Enforce composite tenant-isolation FKs on existing 0001 tables
ALTER TABLE financial_transactions
    DROP CONSTRAINT IF EXISTS fk_fin_tx_family_account,
    ADD CONSTRAINT fk_fin_tx_family_account
        FOREIGN KEY (family_id, account_id) REFERENCES financial_accounts (family_id, id) ON DELETE RESTRICT;

ALTER TABLE recurring_rules
    DROP CONSTRAINT IF EXISTS fk_recurring_family_account,
    ADD CONSTRAINT fk_recurring_family_account
        FOREIGN KEY (family_id, account_id) REFERENCES financial_accounts (family_id, id) ON DELETE CASCADE;

ALTER TABLE investment_holdings
    DROP CONSTRAINT IF EXISTS fk_holdings_family_account,
    ADD CONSTRAINT fk_holdings_family_account
        FOREIGN KEY (family_id, account_id) REFERENCES financial_accounts (family_id, id) ON DELETE CASCADE;

-- 4. Double-Entry General Ledger Financial Entries with Tenant-Isolated Composite FKs
CREATE TABLE IF NOT EXISTS financial_entries (
    id TEXT PRIMARY KEY,
    family_id TEXT NOT NULL REFERENCES family_workspaces(id) ON DELETE CASCADE,
    transaction_id TEXT NOT NULL,
    account_id TEXT NOT NULL,
    entry_type TEXT NOT NULL CHECK (entry_type IN ('DEBIT', 'CREDIT')),
    amount_cents BIGINT NOT NULL CHECK (amount_cents > 0),
    entry_date BIGINT NOT NULL DEFAULT 0,
    created_at BIGINT NOT NULL,
    CONSTRAINT fk_entries_family_transaction
        FOREIGN KEY (family_id, transaction_id) REFERENCES financial_transactions (family_id, id) ON DELETE CASCADE,
    CONSTRAINT fk_entries_family_account
        FOREIGN KEY (family_id, account_id) REFERENCES financial_accounts (family_id, id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_financial_entries_family ON financial_entries (family_id);
CREATE INDEX IF NOT EXISTS idx_financial_entries_tx ON financial_entries (transaction_id);
CREATE INDEX IF NOT EXISTS idx_financial_entries_account ON financial_entries (account_id);

-- 5. Database-Enforced Double-Entry Integrity Trigger on financial_transactions
CREATE OR REPLACE FUNCTION check_posted_transaction_integrity()
RETURNS TRIGGER AS $$
DECLARE
    v_entry_count INT;
    v_debit_sum BIGINT;
    v_credit_sum BIGINT;
    v_net_balance BIGINT;
    v_mismatched_family_count INT;
    v_mismatched_account_count INT;
BEGIN
    IF NEW.status = 'POSTED' THEN
        SELECT
            COUNT(*),
            COALESCE(SUM(CASE WHEN entry_type = 'DEBIT' THEN amount_cents ELSE 0 END), 0),
            COALESCE(SUM(CASE WHEN entry_type = 'CREDIT' THEN amount_cents ELSE 0 END), 0),
            COALESCE(SUM(CASE WHEN entry_type = 'DEBIT' THEN amount_cents ELSE -amount_cents END), 0)
        INTO v_entry_count, v_debit_sum, v_credit_sum, v_net_balance
        FROM financial_entries
        WHERE transaction_id = NEW.id;

        IF v_entry_count < 2 THEN
            RAISE EXCEPTION 'DOUBLE_ENTRY_VIOLATION: Posted transaction % must have at least 2 ledger entries (found %)', NEW.id, v_entry_count;
        END IF;

        IF v_net_balance <> 0 OR v_debit_sum <> v_credit_sum THEN
            RAISE EXCEPTION 'DOUBLE_ENTRY_UNBALANCED: Posted transaction % has unequal debits (%) and credits (%)', NEW.id, v_debit_sum, v_credit_sum;
        END IF;

        SELECT COUNT(*) INTO v_mismatched_family_count
        FROM financial_entries
        WHERE transaction_id = NEW.id AND family_id <> NEW.family_id;

        IF v_mismatched_family_count > 0 THEN
            RAISE EXCEPTION 'TENANT_ISOLATION_VIOLATION: Transaction % has % entries belonging to a different family', NEW.id, v_mismatched_family_count;
        END IF;

        SELECT COUNT(*) INTO v_mismatched_account_count
        FROM financial_entries fe
        JOIN financial_accounts fa ON fa.id = fe.account_id
        WHERE fe.transaction_id = NEW.id AND fa.family_id <> NEW.family_id;

        IF v_mismatched_account_count > 0 THEN
            RAISE EXCEPTION 'TENANT_ACCOUNT_VIOLATION: Transaction % has % entries referencing accounts outside family %', NEW.id, v_mismatched_account_count, NEW.family_id;
        END IF;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_posted_transaction ON financial_transactions;
CREATE CONSTRAINT TRIGGER trg_check_posted_transaction
AFTER INSERT OR UPDATE ON financial_transactions
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION check_posted_transaction_integrity();

-- 6. Database-Enforced Double-Entry Integrity Trigger on financial_entries
CREATE OR REPLACE FUNCTION check_balanced_transaction_entries()
RETURNS TRIGGER AS $$
DECLARE
    v_tx_id TEXT;
    v_tx_status TEXT;
    v_entry_count INT;
    v_net_balance BIGINT;
    v_debit_sum BIGINT;
    v_credit_sum BIGINT;
BEGIN
    v_tx_id := COALESCE(NEW.transaction_id, OLD.transaction_id);

    SELECT status INTO v_tx_status FROM financial_transactions WHERE id = v_tx_id;
    IF v_tx_status = 'POSTED' THEN
        SELECT
            COUNT(*),
            COALESCE(SUM(CASE WHEN entry_type = 'DEBIT' THEN amount_cents ELSE 0 END), 0),
            COALESCE(SUM(CASE WHEN entry_type = 'CREDIT' THEN amount_cents ELSE 0 END), 0),
            COALESCE(SUM(CASE WHEN entry_type = 'DEBIT' THEN amount_cents ELSE -amount_cents END), 0)
        INTO v_entry_count, v_debit_sum, v_credit_sum, v_net_balance
        FROM financial_entries
        WHERE transaction_id = v_tx_id;

        IF v_entry_count < 2 THEN
            RAISE EXCEPTION 'DOUBLE_ENTRY_VIOLATION: Transaction % must have at least 2 ledger entries (found %)', v_tx_id, v_entry_count;
        END IF;

        IF v_net_balance <> 0 OR v_debit_sum <> v_credit_sum THEN
            RAISE EXCEPTION 'DOUBLE_ENTRY_UNBALANCED: Transaction % has unequal debits (%) and credits (%)', v_tx_id, v_debit_sum, v_credit_sum;
        END IF;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enforce_double_entry_balance ON financial_entries;
CREATE CONSTRAINT TRIGGER trg_enforce_double_entry_balance
AFTER INSERT OR UPDATE OR DELETE ON financial_entries
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION check_balanced_transaction_entries();

-- 7. Database-Enforced Immutability Trigger on Posted Financial Entries
CREATE OR REPLACE FUNCTION prevent_financial_entries_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'IMMUTABLE_LEDGER_ENTRY: Posted financial_entries cannot be updated or deleted (entry id: %). Post a reversal transaction instead.', OLD.id;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_immutable_financial_entries ON financial_entries;
CREATE TRIGGER trg_immutable_financial_entries
BEFORE UPDATE OR DELETE ON financial_entries
FOR EACH ROW
EXECUTE FUNCTION prevent_financial_entries_mutation();

-- 8. Controlled Database Posting Stored Procedure
CREATE OR REPLACE FUNCTION post_financial_transaction(
    p_id TEXT,
    p_family_id TEXT,
    p_account_id TEXT,
    p_dest_account_id TEXT,
    p_title TEXT,
    p_amount_cents BIGINT,
    p_tx_type TEXT,
    p_category TEXT,
    p_tx_date BIGINT,
    p_paid_by TEXT,
    p_idempotency_key TEXT,
    p_is_reversal BOOLEAN DEFAULT FALSE,
    p_reversal_of_id TEXT DEFAULT NULL,
    p_payload_hash TEXT DEFAULT NULL
) RETURNS TEXT AS $$
DECLARE
    v_existing_id TEXT;
    v_coa_account_id TEXT;
    v_cat TEXT;
    v_entry1_type TEXT;
    v_entry2_type TEXT;
    v_entry2_account_id TEXT;
BEGIN
    -- Idempotency check
    IF p_idempotency_key IS NOT NULL THEN
        SELECT id INTO v_existing_id FROM financial_transactions WHERE family_id = p_family_id AND idempotency_key = p_idempotency_key;
        IF v_existing_id IS NOT NULL THEN
            RETURN v_existing_id;
        END IF;
    END IF;

    -- Validate account belongs to same family
    IF NOT EXISTS (SELECT 1 FROM financial_accounts WHERE id = p_account_id AND family_id = p_family_id) THEN
        RAISE EXCEPTION 'ACCOUNT_NOT_FOUND: Account % does not exist in family %', p_account_id, p_family_id;
    END IF;

    v_cat := UPPER(COALESCE(p_category, CASE WHEN p_tx_type = 'INCOME' THEN 'INCOME' ELSE 'EXPENSE' END));
    v_coa_account_id := 'coa-' || p_family_id || '-' || v_cat;

    -- Ensure COA account exists
    INSERT INTO financial_accounts (id, family_id, name, account_type, current_balance_cents, is_liability, institution, created_at, updated_at)
    VALUES (v_coa_account_id, p_family_id, 'General Ledger: ' || v_cat, CASE WHEN p_tx_type = 'INCOME' THEN 'INCOME' ELSE 'EXPENSE' END, 0, FALSE, 'Family Chart of Accounts', p_tx_date, p_tx_date)
    ON CONFLICT (id) DO NOTHING;

    -- Create POSTED transaction
    INSERT INTO financial_transactions (
        id, family_id, account_id, destination_account_id, title, amount_cents, transaction_type, category, transaction_date, is_reversal, reversal_of_id, paid_by, idempotency_key, payload_hash, status, created_at
    ) VALUES (
        p_id, p_family_id, p_account_id, p_dest_account_id, p_title, p_amount_cents, p_tx_type, v_cat, p_tx_date, p_is_reversal, p_reversal_of_id, p_paid_by, p_idempotency_key, p_payload_hash, 'POSTED', p_tx_date
    );

    -- Invert entry direction if reversal
    IF p_tx_type = 'EXPENSE' THEN
        v_entry1_type := CASE WHEN p_is_reversal THEN 'DEBIT' ELSE 'CREDIT' END;
        v_entry2_type := CASE WHEN p_is_reversal THEN 'CREDIT' ELSE 'DEBIT' END;
        v_entry2_account_id := v_coa_account_id;
    ELSIF p_tx_type = 'INCOME' THEN
        v_entry1_type := CASE WHEN p_is_reversal THEN 'CREDIT' ELSE 'DEBIT' END;
        v_entry2_type := CASE WHEN p_is_reversal THEN 'DEBIT' ELSE 'CREDIT' END;
        v_entry2_account_id := v_coa_account_id;
    ELSE -- TRANSFER
        v_entry1_type := CASE WHEN p_is_reversal THEN 'DEBIT' ELSE 'CREDIT' END;
        v_entry2_type := CASE WHEN p_is_reversal THEN 'CREDIT' ELSE 'DEBIT' END;
        v_entry2_account_id := p_dest_account_id;
    END IF;

    INSERT INTO financial_entries (id, transaction_id, family_id, account_id, entry_type, amount_cents, created_at)
    VALUES (p_id || '-e1', p_id, p_family_id, p_account_id, v_entry1_type, p_amount_cents, p_tx_date);

    INSERT INTO financial_entries (id, transaction_id, family_id, account_id, entry_type, amount_cents, created_at)
    VALUES (p_id || '-e2', p_id, p_family_id, v_entry2_account_id, v_entry2_type, p_amount_cents, p_tx_date);

    -- Update balances
    IF p_tx_type = 'EXPENSE' THEN
        UPDATE financial_accounts SET current_balance_cents = current_balance_cents + CASE WHEN p_is_reversal THEN p_amount_cents ELSE -p_amount_cents END WHERE id = p_account_id;
    ELSIF p_tx_type = 'INCOME' THEN
        UPDATE financial_accounts SET current_balance_cents = current_balance_cents + CASE WHEN p_is_reversal THEN -p_amount_cents ELSE p_amount_cents END WHERE id = p_account_id;
    ELSE -- TRANSFER
        UPDATE financial_accounts SET current_balance_cents = current_balance_cents + CASE WHEN p_is_reversal THEN p_amount_cents ELSE -p_amount_cents END WHERE id = p_account_id;
        IF p_dest_account_id IS NOT NULL THEN
            UPDATE financial_accounts SET current_balance_cents = current_balance_cents + CASE WHEN p_is_reversal THEN -p_amount_cents ELSE p_amount_cents END WHERE id = p_dest_account_id;
        END IF;
    END IF;

    RETURN p_id;
END;
$$ LANGUAGE plpgsql;

-- 9. Household Recipes & Meal Planning
CREATE TABLE IF NOT EXISTS household_recipes (
    id TEXT PRIMARY KEY,
    family_id TEXT NOT NULL REFERENCES family_workspaces(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    prep_time_minutes INT NOT NULL DEFAULT 0,
    cook_time_minutes INT NOT NULL DEFAULT 0,
    servings INT NOT NULL DEFAULT 4,
    ingredients_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    instructions_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_household_recipes_family ON household_recipes (family_id);

-- 10. Pantry & Food Inventory Items
CREATE TABLE IF NOT EXISTS pantry_items (
    id TEXT PRIMARY KEY,
    family_id TEXT NOT NULL REFERENCES family_workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    quantity NUMERIC(10, 2) NOT NULL DEFAULT 1.0,
    unit TEXT NOT NULL DEFAULT 'units',
    location TEXT NOT NULL DEFAULT 'Pantry',
    expiry_date BIGINT,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pantry_items_family ON pantry_items (family_id);

-- 11. Household Chores, Completions & Reward Points Ledger with Tenant-Isolated Composite FKs
CREATE TABLE IF NOT EXISTS household_chores (
    id TEXT PRIMARY KEY,
    family_id TEXT NOT NULL REFERENCES family_workspaces(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    assigned_member_id TEXT,
    frequency TEXT NOT NULL DEFAULT 'DAILY',
    reward_points INT NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'PENDING',
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL,
    UNIQUE (family_id, id),
    CONSTRAINT fk_chores_family_member
        FOREIGN KEY (family_id, assigned_member_id) REFERENCES family_members (family_id, id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_household_chores_family ON household_chores (family_id);

CREATE TABLE IF NOT EXISTS chore_completions (
    id TEXT PRIMARY KEY,
    family_id TEXT NOT NULL REFERENCES family_workspaces(id) ON DELETE CASCADE,
    chore_id TEXT NOT NULL,
    completed_by_member_id TEXT NOT NULL,
    verified_by_member_id TEXT,
    points_awarded INT NOT NULL DEFAULT 0,
    completed_at BIGINT NOT NULL,
    CONSTRAINT fk_chore_comp_family_chore
        FOREIGN KEY (family_id, chore_id) REFERENCES household_chores (family_id, id) ON DELETE CASCADE,
    CONSTRAINT fk_chore_comp_family_member
        FOREIGN KEY (family_id, completed_by_member_id) REFERENCES family_members (family_id, id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_chore_completions_family ON chore_completions (family_id);

CREATE TABLE IF NOT EXISTS reward_points_ledger (
    id TEXT PRIMARY KEY,
    family_id TEXT NOT NULL REFERENCES family_workspaces(id) ON DELETE CASCADE,
    member_id TEXT NOT NULL,
    delta_points INT NOT NULL,
    reason TEXT NOT NULL,
    balance_after INT NOT NULL,
    created_at BIGINT NOT NULL,
    CONSTRAINT fk_reward_ledger_family_member
        FOREIGN KEY (family_id, member_id) REFERENCES family_members (family_id, id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_reward_points_member ON reward_points_ledger (family_id, member_id);

-- 12. Household Assets & Service Maintenance Records with Tenant-Isolated Composite FKs
CREATE TABLE IF NOT EXISTS household_assets (
    id TEXT PRIMARY KEY,
    family_id TEXT NOT NULL REFERENCES family_workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    purchase_date BIGINT,
    purchase_price_cents BIGINT,
    warranty_expiry_date BIGINT,
    serial_number TEXT,
    location TEXT,
    notes TEXT,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL,
    UNIQUE (family_id, id)
);

CREATE INDEX IF NOT EXISTS idx_household_assets_family ON household_assets (family_id);

CREATE TABLE IF NOT EXISTS asset_service_records (
    id TEXT PRIMARY KEY,
    family_id TEXT NOT NULL REFERENCES family_workspaces(id) ON DELETE CASCADE,
    asset_id TEXT NOT NULL,
    service_date BIGINT NOT NULL,
    service_type TEXT NOT NULL,
    cost_cents BIGINT NOT NULL DEFAULT 0,
    provider TEXT,
    notes TEXT,
    created_at BIGINT NOT NULL,
    CONSTRAINT fk_service_records_family_asset
        FOREIGN KEY (family_id, asset_id) REFERENCES household_assets (family_id, id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_asset_service_records_asset ON asset_service_records (asset_id);

-- 13. Calendar Events & Attendees with Tenant-Isolated Composite FKs
CREATE TABLE IF NOT EXISTS calendar_events (
    id TEXT PRIMARY KEY,
    family_id TEXT NOT NULL REFERENCES family_workspaces(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    start_time BIGINT NOT NULL,
    end_time BIGINT NOT NULL,
    location TEXT,
    is_all_day BOOLEAN NOT NULL DEFAULT FALSE,
    created_by_member_id TEXT,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL,
    UNIQUE (family_id, id),
    CONSTRAINT fk_calendar_events_family_creator
        FOREIGN KEY (family_id, created_by_member_id) REFERENCES family_members (family_id, id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_calendar_events_family ON calendar_events (family_id);

CREATE TABLE IF NOT EXISTS event_attendees (
    id TEXT PRIMARY KEY,
    family_id TEXT NOT NULL REFERENCES family_workspaces(id) ON DELETE CASCADE,
    event_id TEXT NOT NULL,
    member_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'ACCEPTED',
    created_at BIGINT NOT NULL,
    CONSTRAINT fk_attendees_family_event
        FOREIGN KEY (family_id, event_id) REFERENCES calendar_events (family_id, id) ON DELETE CASCADE,
    CONSTRAINT fk_attendees_family_member
        FOREIGN KEY (family_id, member_id) REFERENCES family_members (family_id, id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_event_attendees_event ON event_attendees (event_id);

-- Record migration 0002
INSERT INTO schema_migrations (version, description, checksum_sha256, applied_at)
VALUES (
    '0002_familyos_v341_reconciliation_up',
    'Add user_accounts, auth_sessions, PL/pgSQL double-entry triggers & controlled procedure post_financial_transaction, composite tenant FKs, and household tables',
    'sha256_v341_reconciliation_up',
    NOW()
) ON CONFLICT (version) DO NOTHING;

COMMIT;
