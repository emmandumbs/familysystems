-- ============================================================================
-- FAMILYOS — AUTHORITATIVE POSTGRESQL SCHEMA ROLLBACK (v3.4.0 DOWN)
-- Migration ID: 0001_familyos_v340_down
-- Reverses: 0001_familyos_v340_up.sql in reverse dependency order
-- ============================================================================

BEGIN;

DROP TABLE IF EXISTS audit_events;
DROP TABLE IF EXISTS synchronized_entities;
DROP TABLE IF EXISTS media_assets;
DROP TABLE IF EXISTS household_records;
DROP TABLE IF EXISTS investment_holdings;
DROP TABLE IF EXISTS recurring_rules;
DROP TABLE IF EXISTS savings_goals;
DROP TABLE IF EXISTS financial_budgets;
DROP TABLE IF EXISTS financial_transactions;
DROP TABLE IF EXISTS financial_accounts;
DROP TABLE IF EXISTS family_invitations;
DROP TABLE IF EXISTS family_relationships;
DROP INDEX IF EXISTS idx_family_memberships_one_active_per_user;
DROP TABLE IF EXISTS family_memberships;
DROP TABLE IF EXISTS family_members;
DROP TABLE IF EXISTS family_workspaces;
DELETE FROM schema_migrations WHERE version = '0001_familyos_v340';

COMMIT;
