-- ============================================================================
-- FAMILYOS — RECONCILIATION & HOUSEHOLD SCHEMA MIGRATION (v3.4.1 DOWN)
-- Migration ID: 0002_familyos_v341_reconciliation_down
-- Reversible partner to: 0002_familyos_v341_reconciliation_up.sql
-- ============================================================================

BEGIN;

DROP FUNCTION IF EXISTS post_financial_transaction CASCADE;

DROP TRIGGER IF EXISTS trg_immutable_financial_entries ON financial_entries;
DROP TRIGGER IF EXISTS trg_enforce_double_entry_balance ON financial_entries;
DROP TRIGGER IF EXISTS trg_check_posted_transaction ON financial_transactions;

DROP FUNCTION IF EXISTS prevent_financial_entries_mutation() CASCADE;
DROP FUNCTION IF EXISTS check_balanced_transaction_entries() CASCADE;
DROP FUNCTION IF EXISTS check_posted_transaction_integrity() CASCADE;

ALTER TABLE investment_holdings DROP CONSTRAINT IF EXISTS fk_holdings_family_account;
ALTER TABLE recurring_rules DROP CONSTRAINT IF EXISTS fk_recurring_family_account;
ALTER TABLE financial_transactions DROP CONSTRAINT IF EXISTS fk_fin_tx_family_account;

DROP INDEX IF EXISTS uq_financial_transactions_family_id;
DROP INDEX IF EXISTS uq_financial_accounts_family_id;
DROP INDEX IF EXISTS uq_family_members_family_id;

DROP TABLE IF EXISTS event_attendees CASCADE;
DROP TABLE IF EXISTS calendar_events CASCADE;
DROP TABLE IF EXISTS asset_service_records CASCADE;
DROP TABLE IF EXISTS household_assets CASCADE;
DROP TABLE IF EXISTS reward_points_ledger CASCADE;
DROP TABLE IF EXISTS chore_completions CASCADE;
DROP TABLE IF EXISTS household_chores CASCADE;
DROP TABLE IF EXISTS pantry_items CASCADE;
DROP TABLE IF EXISTS household_recipes CASCADE;
DROP TABLE IF EXISTS financial_entries CASCADE;
DROP TABLE IF EXISTS auth_sessions CASCADE;
DROP TABLE IF EXISTS user_accounts CASCADE;

DELETE FROM schema_migrations WHERE version = '0002_familyos_v341_reconciliation_up';

COMMIT;
