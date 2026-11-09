-- ============================================================================
-- FAMILYOS — AUTHORITATIVE POSTGRESQL SCHEMA MIGRATION (v3.4.0 UP)
-- Migration ID: 0001_familyos_v340_up
-- Reversible via: 0001_familyos_v340_down.sql
--
-- Key Architectural Invariants Enforced at Database Layer:
-- 1. All monetary values use signed 64-bit integer cents (BIGINT).
-- 2. Investment share quantities use fixed-precision microshares (BIGINT, 10^6).
-- 3. Partial unique index `idx_family_memberships_one_active_per_user` enforces
--    at most ONE active family membership per authenticated userAccountId while
--    preserving unlimited historical REVOKED and LEFT memberships.
-- 4. Every family-scoped table enforces `family_id` foreign key references to
--    `family_workspaces(id)` and composite `(family_id, ...)` indexes.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS schema_migrations (
    version TEXT PRIMARY KEY,
    description TEXT NOT NULL,
    checksum_sha256 TEXT NOT NULL,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 1. Core Family Governance & Identity
CREATE TABLE IF NOT EXISTS family_workspaces (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    motto TEXT,
    description TEXT,
    mission TEXT,
    vision TEXT,
    currency_code TEXT NOT NULL DEFAULT 'USD',
    timezone TEXT NOT NULL DEFAULT 'UTC',
    owner_user_id TEXT NOT NULL,
    logo_url TEXT,
    photo_url TEXT,
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    version BIGINT NOT NULL DEFAULT 1,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_family_workspaces_owner ON family_workspaces (owner_user_id);

CREATE TABLE IF NOT EXISTS family_members (
    id TEXT PRIMARY KEY,
    family_id TEXT NOT NULL REFERENCES family_workspaces(id) ON DELETE CASCADE,
    user_account_id TEXT,
    display_name TEXT NOT NULL,
    relationship TEXT NOT NULL,
    role TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    birth_date TEXT,
    is_minor BOOLEAN NOT NULL DEFAULT FALSE,
    avatar_url TEXT,
    photo_url TEXT,
    allergies_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    medical_notes TEXT,
    dietary_notes TEXT,
    private_journal_notes TEXT,
    version BIGINT NOT NULL DEFAULT 1,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_family_members_family_id ON family_members (family_id);
CREATE INDEX IF NOT EXISTS idx_family_members_user_account_id ON family_members (user_account_id);

CREATE TABLE IF NOT EXISTS family_memberships (
    id TEXT PRIMARY KEY,
    family_id TEXT NOT NULL REFERENCES family_workspaces(id) ON DELETE CASCADE,
    user_account_id TEXT NOT NULL,
    member_profile_id TEXT NOT NULL,
    display_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('OWNER', 'ADMIN', 'MEMBER', 'CHILD', 'GUEST')),
    status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'INVITED', 'REVOKED', 'LEFT')),
    joined_at BIGINT NOT NULL,
    revoked_at BIGINT,
    revoked_reason TEXT,
    updated_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_family_memberships_family_id ON family_memberships (family_id);
CREATE INDEX IF NOT EXISTS idx_family_memberships_user_status ON family_memberships (user_account_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_family_memberships_family_user ON family_memberships (family_id, user_account_id);

-- Partial unique index enforcing One-Active-Family-Per-Account while permitting historical REVOKED/LEFT rows
CREATE UNIQUE INDEX IF NOT EXISTS idx_family_memberships_one_active_per_user
    ON family_memberships (user_account_id)
    WHERE status = 'ACTIVE';

CREATE TABLE IF NOT EXISTS family_relationships (
    id TEXT PRIMARY KEY,
    family_id TEXT NOT NULL REFERENCES family_workspaces(id) ON DELETE CASCADE,
    from_member_id TEXT NOT NULL,
    to_member_id TEXT NOT NULL,
    relationship_type TEXT NOT NULL,
    is_bidirectional BOOLEAN NOT NULL DEFAULT FALSE,
    version BIGINT NOT NULL DEFAULT 1,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_family_relationships_family_id ON family_relationships (family_id);

CREATE TABLE IF NOT EXISTS family_invitations (
    id TEXT PRIMARY KEY,
    family_id TEXT NOT NULL REFERENCES family_workspaces(id) ON DELETE CASCADE,
    invitation_token_hash TEXT NOT NULL UNIQUE,
    invitee_name TEXT NOT NULL,
    invitee_email TEXT,
    proposed_role TEXT NOT NULL CHECK (proposed_role IN ('ADMIN', 'MEMBER', 'CHILD', 'GUEST')),
    relationship_to_primary TEXT,
    invite_method TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED')),
    created_by_user_id TEXT NOT NULL,
    accepted_by_user_id TEXT,
    expires_at BIGINT NOT NULL,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_family_invitations_family_id ON family_invitations (family_id);

-- 2. Financial Stewardship Engine (Exact 64-Bit Integer Cents & Microshares)
CREATE TABLE IF NOT EXISTS financial_accounts (
    id TEXT PRIMARY KEY,
    family_id TEXT NOT NULL REFERENCES family_workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    account_type TEXT NOT NULL CHECK (account_type IN ('CHECKING', 'SAVINGS', 'CREDIT_CARD', 'INVESTMENT', 'CASH', 'LOAN')),
    current_balance_cents BIGINT NOT NULL DEFAULT 0,
    is_liability BOOLEAN NOT NULL DEFAULT FALSE,
    institution TEXT,
    currency TEXT NOT NULL DEFAULT 'USD',
    is_archived BOOLEAN NOT NULL DEFAULT FALSE,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_financial_accounts_family_id ON financial_accounts (family_id);

CREATE TABLE IF NOT EXISTS financial_transactions (
    id TEXT PRIMARY KEY,
    family_id TEXT NOT NULL REFERENCES family_workspaces(id) ON DELETE CASCADE,
    account_id TEXT NOT NULL,
    destination_account_id TEXT,
    title TEXT NOT NULL,
    amount_cents BIGINT NOT NULL CHECK (amount_cents > 0),
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('INCOME', 'EXPENSE', 'TRANSFER')),
    category TEXT NOT NULL,
    transaction_date BIGINT NOT NULL,
    is_reversal BOOLEAN NOT NULL DEFAULT FALSE,
    reversal_of_id TEXT,
    paid_by TEXT,
    notes TEXT,
    created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_financial_transactions_family_date ON financial_transactions (family_id, transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_financial_transactions_account_id ON financial_transactions (account_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_financial_transactions_single_reversal
    ON financial_transactions (reversal_of_id)
    WHERE is_reversal = TRUE AND reversal_of_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS financial_budgets (
    id TEXT PRIMARY KEY,
    family_id TEXT NOT NULL REFERENCES family_workspaces(id) ON DELETE CASCADE,
    category TEXT NOT NULL,
    allocated_cents BIGINT NOT NULL CHECK (allocated_cents >= 0),
    spent_cents BIGINT NOT NULL DEFAULT 0,
    alert_threshold_percentage INTEGER NOT NULL DEFAULT 85 CHECK (alert_threshold_percentage BETWEEN 1 AND 100),
    period_month TEXT NOT NULL DEFAULT 'CURRENT',
    updated_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_financial_budgets_family_id ON financial_budgets (family_id);

CREATE TABLE IF NOT EXISTS savings_goals (
    id TEXT PRIMARY KEY,
    family_id TEXT NOT NULL REFERENCES family_workspaces(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'EMERGENCY',
    target_cents BIGINT NOT NULL CHECK (target_cents > 0),
    current_cents BIGINT NOT NULL DEFAULT 0 CHECK (current_cents >= 0),
    planned_monthly_contribution_cents BIGINT NOT NULL DEFAULT 0 CHECK (planned_monthly_contribution_cents >= 0),
    suggested_monthly_contribution_cents BIGINT NOT NULL DEFAULT 0 CHECK (suggested_monthly_contribution_cents >= 0),
    target_date BIGINT,
    linked_account_id TEXT,
    is_completed BOOLEAN NOT NULL DEFAULT FALSE,
    contributions_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_savings_goals_family_id ON savings_goals (family_id);

CREATE TABLE IF NOT EXISTS recurring_rules (
    id TEXT PRIMARY KEY,
    family_id TEXT NOT NULL REFERENCES family_workspaces(id) ON DELETE CASCADE,
    account_id TEXT NOT NULL,
    title TEXT NOT NULL,
    amount_cents BIGINT NOT NULL CHECK (amount_cents > 0),
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('INCOME', 'EXPENSE')),
    category TEXT NOT NULL,
    recurrence_interval TEXT NOT NULL CHECK (recurrence_interval IN ('DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY', 'QUARTERLY', 'ANNUAL')),
    next_due_date BIGINT NOT NULL,
    last_generated_date BIGINT,
    is_auto_pay BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_recurring_rules_family_id ON recurring_rules (family_id);

CREATE TABLE IF NOT EXISTS investment_holdings (
    id TEXT PRIMARY KEY,
    family_id TEXT NOT NULL REFERENCES family_workspaces(id) ON DELETE CASCADE,
    account_id TEXT NOT NULL,
    symbol TEXT NOT NULL,
    asset_name TEXT NOT NULL,
    asset_type TEXT NOT NULL,
    quantity_microshares BIGINT NOT NULL CHECK (quantity_microshares > 0),
    cost_basis_cents BIGINT NOT NULL CHECK (cost_basis_cents >= 0),
    current_price_cents BIGINT NOT NULL CHECK (current_price_cents >= 0),
    current_valuation_cents BIGINT NOT NULL DEFAULT 0,
    unrealized_gain_loss_cents BIGINT NOT NULL DEFAULT 0,
    gain_loss_basis_points BIGINT NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'USD',
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    last_price_updated_at BIGINT NOT NULL,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_investment_holdings_family_id ON investment_holdings (family_id);

-- 3. Household Operations Engine
CREATE TABLE IF NOT EXISTS household_records (
    id TEXT PRIMARY KEY,
    family_id TEXT NOT NULL REFERENCES family_workspaces(id) ON DELETE CASCADE,
    record_domain TEXT NOT NULL CHECK (record_domain IN ('MEAL', 'RECIPE', 'CHORE', 'CHORE_HISTORY', 'PANTRY', 'GROCERY', 'ASSET', 'ASSET_MAINTENANCE', 'WARDROBE', 'OUTFIT')),
    payload_json JSONB NOT NULL,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_household_records_family_domain ON household_records (family_id, record_domain);

-- 4. Family Section, Media Assets & Domain Synchronized Entities
CREATE TABLE IF NOT EXISTS media_assets (
    id TEXT PRIMARY KEY,
    family_id TEXT NOT NULL REFERENCES family_workspaces(id) ON DELETE CASCADE,
    owner_member_id TEXT NOT NULL,
    uploaded_by_user_id TEXT NOT NULL,
    visibility TEXT NOT NULL CHECK (visibility IN ('PERSONAL', 'SHARED')),
    category TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    file_name TEXT NOT NULL,
    size_bytes INTEGER NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 5242880),
    data_url TEXT NOT NULL,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_media_assets_family_id ON media_assets (family_id);

CREATE TABLE IF NOT EXISTS synchronized_entities (
    entity_key TEXT PRIMARY KEY,
    id TEXT NOT NULL,
    family_id TEXT NOT NULL REFERENCES family_workspaces(id) ON DELETE CASCADE,
    entity_type TEXT NOT NULL,
    version BIGINT NOT NULL DEFAULT 1,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    updated_by_user_id TEXT,
    data_json JSONB NOT NULL,
    updated_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_synchronized_entities_family_type ON synchronized_entities (family_id, entity_type);

CREATE TABLE IF NOT EXISTS audit_events (
    id TEXT PRIMARY KEY,
    family_id TEXT NOT NULL,
    actor_user_id TEXT NOT NULL,
    actor_role TEXT,
    action_type TEXT NOT NULL,
    summary TEXT NOT NULL,
    created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_events_family_created ON audit_events (family_id, created_at DESC);

COMMIT;
