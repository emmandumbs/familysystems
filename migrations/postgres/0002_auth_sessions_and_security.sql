-- ============================================================================
-- FAMILYOS — AUTH SESSIONS & SECURITY AUDIT LOGS
-- Migration ID: 0002_auth_sessions_and_security
--
-- Adds:
-- 1. auth_sessions with device tracking (device_name, platform, user_agent_hash)
-- 2. auth_security_events for audit logging (event_type, provider, ip_hash, metadata_json)
-- ============================================================================

BEGIN;

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
    id TEXT PRIMARY KEY,
    user_account_id TEXT NOT NULL REFERENCES user_accounts(id) ON DELETE CASCADE,
    firebase_uid TEXT,
    family_id TEXT,
    device_name TEXT,
    platform TEXT,
    user_agent_hash TEXT,
    token_issued_at BIGINT,
    expires_at BIGINT NOT NULL,
    last_active_at BIGINT,
    is_revoked BOOLEAN NOT NULL DEFAULT FALSE,
    revoked_at BIGINT,
    created_at BIGINT NOT NULL
);

-- Backward compatibility columns if auth_sessions existed with alternate primary key
ALTER TABLE auth_sessions ADD COLUMN IF NOT EXISTS id TEXT;
ALTER TABLE auth_sessions ADD COLUMN IF NOT EXISTS firebase_uid TEXT;
ALTER TABLE auth_sessions ADD COLUMN IF NOT EXISTS family_id TEXT;
ALTER TABLE auth_sessions ADD COLUMN IF NOT EXISTS device_name TEXT;
ALTER TABLE auth_sessions ADD COLUMN IF NOT EXISTS platform TEXT;
ALTER TABLE auth_sessions ADD COLUMN IF NOT EXISTS user_agent_hash TEXT;
ALTER TABLE auth_sessions ADD COLUMN IF NOT EXISTS token_issued_at BIGINT;
ALTER TABLE auth_sessions ADD COLUMN IF NOT EXISTS last_active_at BIGINT;

CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_revoked ON auth_sessions (user_account_id, is_revoked);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_firebase_uid ON auth_sessions (firebase_uid);

-- Security and Authentication Events Audit Trail
CREATE TABLE IF NOT EXISTS auth_security_events (
    id TEXT PRIMARY KEY,
    user_account_id TEXT,
    firebase_uid TEXT,
    event_type TEXT NOT NULL,
    provider TEXT,
    ip_hash TEXT,
    metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_auth_security_events_user ON auth_security_events (user_account_id);
CREATE INDEX IF NOT EXISTS idx_auth_security_events_event_type ON auth_security_events (event_type);

COMMIT;
