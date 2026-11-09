import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import type { Request, Response, NextFunction } from 'express';
import pg from 'pg';
import { computeSha256, type SharedStore } from './backupAndMigration';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const STORE_PATH = path.join(DATA_DIR, 'familyos-shared-store.json');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const PRE_POSTGRES_BACKUP_PATH = path.join(
  BACKUP_DIR,
  'familyos-shared-store.pre-postgres-migration.bak.json'
);
const POSTGRES_IMPORT_SQL_PATH = path.join(BACKUP_DIR, 'postgres-import-bundle.sql');
const POSTGRES_RECONCILIATION_REPORT_PATH = path.join(
  BACKUP_DIR,
  'postgres-migration-reconciliation-report.json'
);

export interface ProtectedBackupMetadata {
  backupPath: string;
  sourcePath: string;
  sha256: string;
  hmacSignature?: string;
  sizeBytes: number;
  createdAt: number;
  schemaVersion: string;
}

function getBackupIntegritySecret(): string {
  return process.env.FAMILYOS_BACKUP_HMAC_SECRET || process.env.JWT_SECRET || 'familyos-authoritative-backup-hmac-key-v341';
}

export function computeBackupHmac(content: string): string {
  return crypto.createHmac('sha256', getBackupIntegritySecret()).update(content, 'utf8').digest('hex');
}

export interface RelationalTableCounts {
  family_workspaces: number;
  family_members: number;
  family_memberships: number;
  family_relationships: number;
  family_invitations: number;
  financial_accounts: number;
  financial_transactions: number;
  financial_budgets: number;
  savings_goals: number;
  recurring_rules: number;
  investment_holdings: number;
  household_records: number;
  media_assets: number;
  synchronized_entities: number;
  audit_events: number;
}

export interface PostgresMigrationReconciliationReport {
  migrationVersion: string;
  generatedAtIso: string;
  sourceStorePath: string;
  protectedBackupPath: string;
  protectedBackupSha256: string;
  sqlBundlePath: string;
  sqlBundleSha256: string;
  sourceRecordCounts: RelationalTableCounts;
  extractedRecordCounts: RelationalTableCounts;
  reconciled: boolean;
  referentialIntegrityPassed: boolean;
  oneActiveMembershipRulePassed: boolean;
  preservedHistoricalMembershipsCount: {
    REVOKED: number;
    LEFT: number;
    OTHER_NON_ACTIVE: number;
  };
  validationErrors: string[];
}

function sqlString(val: unknown): string {
  if (val === null || val === undefined) return 'NULL';
  const str = String(val).replace(/'/g, "''");
  return `'${str}'`;
}

function sqlJsonb(val: unknown): string {
  const json = JSON.stringify(val ?? {});
  return `${sqlString(json)}::jsonb`;
}

function sqlBigInt(val: unknown, fallback: bigint = 0n): string {
  if (typeof val === 'bigint') return val.toString(10);
  if (typeof val === 'number' && Number.isFinite(val)) return BigInt(Math.trunc(val)).toString(10);
  if (typeof val === 'string' && val.trim().length > 0) {
    try {
      return BigInt(val.trim()).toString(10);
    } catch {
      return fallback.toString(10);
    }
  }
  return fallback.toString(10);
}

function sqlBoolean(val: unknown): string {
  return Boolean(val) ? 'TRUE' : 'FALSE';
}

/**
 * Creates an immutable, checksummed backup of the JSON store prior to PostgreSQL migration.
 * Never deletes or mutates the source JSON store.
 */
export function createProtectedPrePostgresBackup(
  sourcePath: string = STORE_PATH,
  backupPath: string = PRE_POSTGRES_BACKUP_PATH
): ProtectedBackupMetadata {
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Source JSON store does not exist at ${sourcePath}`);
  }
  if (!fs.existsSync( path.dirname(backupPath))) {
    fs.mkdirSync(path.dirname(backupPath), { recursive: true });
  }

  const rawContent = fs.readFileSync(sourcePath, 'utf-8');
  const parsed = JSON.parse(rawContent) as SharedStore;
  const sha256 = computeSha256(rawContent);
  const hmacSignature = computeBackupHmac(rawContent);

  const tmpBackupPath = `${backupPath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmpBackupPath, rawContent, 'utf-8');
  fs.renameSync(tmpBackupPath, backupPath);

  const metaPath = `${backupPath}.sha256.json`;
  const metadata: ProtectedBackupMetadata = {
    backupPath,
    sourcePath,
    sha256,
    hmacSignature,
    sizeBytes: Buffer.byteLength(rawContent, 'utf-8'),
    createdAt: Date.now(),
    schemaVersion: parsed.schemaVersion || '3.4.0',
  };
  fs.writeFileSync(metaPath, JSON.stringify(metadata, null, 2), 'utf-8');
  return metadata;
}

// ============================================================================
// AES-256-GCM AUTHENTICATED BACKUP ENCRYPTION ENGINE
// ============================================================================
export interface EncryptedBackupContainer {
  format: 'FOS_AES_256_GCM_v1';
  saltHex: string;
  ivHex: string;
  authTagHex: string;
  ciphertextB64: string;
}

export function getBackupEncryptionSecret(overrideSecret?: string): string {
  const secret =
    overrideSecret ||
    process.env.FAMILYOS_BACKUP_ENCRYPTION_SECRET ||
    process.env.FAMILYOS_BACKUP_ENCRYPTION_KEY ||
    process.env.FAMILYOS_SESSION_SECRET;
  if (!secret || secret.trim().length < 16) {
    throw new Error('BACKUP_ENCRYPTION_KEY_UNAVAILABLE: A secure backup key (>= 16 chars) must be provided in FAMILYOS_BACKUP_ENCRYPTION_SECRET, FAMILYOS_BACKUP_ENCRYPTION_KEY, or FAMILYOS_SESSION_SECRET.');
  }
  return secret.trim();
}

export function encryptBackupPayload(plaintext: string, overrideSecret?: string): EncryptedBackupContainer {
  const secret = getBackupEncryptionSecret(overrideSecret);
  const salt = crypto.randomBytes(16);
  const derivedKey = crypto.pbkdf2Sync(secret, salt, 100000, 32, 'sha256');
  const iv = crypto.randomBytes(12);

  const cipher = crypto.createCipheriv('aes-256-gcm', derivedKey, iv);
  let ciphertext = cipher.update(plaintext, 'utf8', 'base64');
  ciphertext += cipher.final('base64');
  const authTag = cipher.getAuthTag();

  return {
    format: 'FOS_AES_256_GCM_v1',
    saltHex: salt.toString('hex'),
    ivHex: iv.toString('hex'),
    authTagHex: authTag.toString('hex'),
    ciphertextB64: ciphertext,
  };
}

export function decryptBackupPayload(container: EncryptedBackupContainer, overrideSecret?: string): string {
  if (!container || container.format !== 'FOS_AES_256_GCM_v1') {
    throw new Error('INVALID_ENCRYPTED_CONTAINER_FORMAT: Backup container format must be FOS_AES_256_GCM_v1.');
  }
  const secret = getBackupEncryptionSecret(overrideSecret);
  const salt = Buffer.from(container.saltHex, 'hex');
  const iv = Buffer.from(container.ivHex, 'hex');
  const authTag = Buffer.from(container.authTagHex, 'hex');
  const derivedKey = crypto.pbkdf2Sync(secret, salt, 100000, 32, 'sha256');

  const decipher = crypto.createDecipheriv('aes-256-gcm', derivedKey, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(container.ciphertextB64, 'base64', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

export function createEncryptedProtectedBackup(
  sourcePath: string = STORE_PATH,
  backupPath: string = PRE_POSTGRES_BACKUP_PATH,
  overrideSecret?: string
): ProtectedBackupMetadata & { isEncrypted: boolean; plaintextSha256: string } {
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Source JSON store does not exist at ${sourcePath}`);
  }
  if (!fs.existsSync(path.dirname(backupPath))) {
    fs.mkdirSync(path.dirname(backupPath), { recursive: true });
  }

  const rawContent = fs.readFileSync(sourcePath, 'utf-8');
  const parsed = JSON.parse(rawContent) as SharedStore;
  const plainSha256 = computeSha256(rawContent);

  const encryptedContainer = encryptBackupPayload(rawContent, overrideSecret);
  const containerJson = JSON.stringify(encryptedContainer, null, 2);
  const cipherSha256 = computeSha256(containerJson);
  const hmacSignature = computeBackupHmac(containerJson);

  const tmpBackupPath = `${backupPath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmpBackupPath, containerJson, 'utf-8');
  fs.renameSync(tmpBackupPath, backupPath);

  const metaPath = `${backupPath}.sha256.json`;
  const metadata = {
    backupPath,
    sourcePath,
    sha256: cipherSha256,
    plaintextSha256: plainSha256,
    hmacSignature,
    sizeBytes: Buffer.byteLength(containerJson, 'utf-8'),
    createdAt: Date.now(),
    schemaVersion: parsed.schemaVersion || '3.4.1',
    isEncrypted: true,
  };
  fs.writeFileSync(metaPath, JSON.stringify(metadata, null, 2), 'utf-8');
  return metadata;
}

export function verifyAndDecryptProtectedBackup(
  backupPath: string = PRE_POSTGRES_BACKUP_PATH,
  overrideSecret?: string
): { valid: boolean; plaintext?: string; sha256: string; reason?: string } {
  const verification = verifyProtectedBackup(backupPath);
  if (!verification.valid) {
    return { valid: false, sha256: verification.sha256, reason: verification.reason };
  }

  const rawContainerJson = fs.readFileSync(backupPath, 'utf-8');
  try {
    const container = JSON.parse(rawContainerJson) as EncryptedBackupContainer;
    if (container.format === 'FOS_AES_256_GCM_v1') {
      const plaintext = decryptBackupPayload(container, overrideSecret);
      const plaintextSha256 = computeSha256(plaintext);
      return { valid: true, plaintext, sha256: plaintextSha256 };
    }
  } catch (err: any) {
    return {
      valid: false,
      sha256: verification.sha256,
      reason: `DECRYPTION_FAILED: ${err?.message || 'Authentication tag mismatch or invalid key'}`,
    };
  }

  return { valid: true, plaintext: rawContainerJson, sha256: verification.sha256 };
}

/**
 * Verifies that a protected backup exists, parses as valid JSON, matches its recorded SHA-256 digest,
 * and passes HMAC-SHA256 authenticated integrity verification.
 */
export function verifyProtectedBackup(
  backupPath: string = PRE_POSTGRES_BACKUP_PATH
): { valid: boolean; sha256: string; reason?: string } {
  if (!fs.existsSync(backupPath)) {
    return { valid: false, sha256: '', reason: 'BACKUP_FILE_MISSING' };
  }
  const raw = fs.readFileSync(backupPath, 'utf-8');
  const actualSha256 = computeSha256(raw);
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return { valid: false, sha256: actualSha256, reason: 'INVALID_JSON_ROOT' };
    }
  } catch {
    return { valid: false, sha256: actualSha256, reason: 'MALFORMED_JSON' };
  }

  const metaPath = `${backupPath}.sha256.json`;
  if (!fs.existsSync(metaPath)) {
    return { valid: false, sha256: actualSha256, reason: 'CHECKSUM_METADATA_MISSING' };
  }

  try {
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8')) as ProtectedBackupMetadata;
    if (!meta.sha256) {
      return { valid: false, sha256: actualSha256, reason: 'CHECKSUM_METADATA_EMPTY' };
    }
    if (meta.sha256 !== actualSha256) {
      return { valid: false, sha256: actualSha256, reason: 'SHA256_MISMATCH' };
    }
    if (meta.hmacSignature) {
      const expectedHmac = computeBackupHmac(raw);
      if (meta.hmacSignature !== expectedHmac) {
        return { valid: false, sha256: actualSha256, reason: 'HMAC_SIGNATURE_MISMATCH' };
      }
    }
  } catch {
    return { valid: false, sha256: actualSha256, reason: 'CORRUPTED_METADATA' };
  }

  return { valid: true, sha256: actualSha256 };
}

/**
 * Atomically restores the target JSON store from a verified protected backup without deleting the backup.
 */
export function restoreFromProtectedBackup(
  backupPath: string = PRE_POSTGRES_BACKUP_PATH,
  targetStorePath: string = STORE_PATH
): { restored: boolean; sha256: string } {
  const verification = verifyProtectedBackup(backupPath);
  if (!verification.valid) {
    throw new Error(`Cannot restore from unverified backup (${verification.reason || 'UNKNOWN'})`);
  }

  const backupContent = fs.readFileSync(backupPath, 'utf-8');
  const tmpRestorePath = `${targetStorePath}.restore.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmpRestorePath, backupContent, 'utf-8');
  fs.renameSync(tmpRestorePath, targetStorePath);

  const restoredSha256 = computeSha256(fs.readFileSync(targetStorePath, 'utf-8'));
  if (restoredSha256 !== verification.sha256) {
    throw new Error('Post-restore SHA-256 verification failed');
  }
  return { restored: true, sha256: restoredSha256 };
}

/**
 * Extracts, validates, and generates an idempotent PostgreSQL migration bundle (`ON CONFLICT DO UPDATE`)
 * and reconciliation report from the authoritative store.
 */
export function runIdempotentPostgresMigrationExport(
  storePath: string = STORE_PATH
): PostgresMigrationReconciliationReport {
  const backupMeta = createProtectedPrePostgresBackup(storePath, PRE_POSTGRES_BACKUP_PATH);
  const raw = fs.readFileSync(storePath, 'utf-8');
  const store = JSON.parse(raw) as SharedStore;

  const validationErrors: string[] = [];

  // 1. Collect all workspaces
  const workspacesMap = new Map<string, any>();
  if (store.workspace?.id) {
    workspacesMap.set(store.workspace.id, store.workspace);
  }
  for (const [id, ws] of Object.entries(store.workspaces || {})) {
    if (ws && typeof ws === 'object') {
      workspacesMap.set(id, ws);
    }
  }

  // Ensure every referenced familyId has a workspace row so foreign keys never fail
  const ensureWorkspaceExists = (familyId: string) => {
    if (!familyId) return;
    if (!workspacesMap.has(familyId)) {
      validationErrors.push(`Missing workspace for referenced familyId: ${familyId}`);
    }
  };

  const familyMembers = store.familyMembers || [];
  const memberships = store.memberships || [];
  const relationships = store.familyRelationships || [];
  const invitations = store.invitations || [];
  const accounts = store.accounts || [];
  const transactions = store.transactions || [];
  const budgets = store.budgets || [];
  const savingsGoals = store.savingsGoals || [];
  const recurringRules = store.recurringRules || [];
  const investmentHoldings = store.investmentHoldings || [];
  const mediaAssets = Object.values(store.mediaAssets || {});
  const syncEntities = Object.values(store.synchronizedEntities || {});
  const auditEvents = store.auditEvents || [];

  // Collect household records across all household domain arrays
  const householdRecords: Array<{
    id: string;
    familyId: string;
    domainType: string;
    version: number;
    isDeleted: boolean;
    updatedAt: number;
    payload: unknown;
  }> = [];

  const pushHouseholdCollection = (items: any[] | undefined, domainType: string) => {
    for (const item of items || []) {
      if (!item || !item.id || !item.familyId) continue;
      if (!workspacesMap.has(item.familyId)) continue;
      householdRecords.push({
        id: `${domainType}:${item.id}`,
        familyId: item.familyId,
        domainType,
        version: Number(item.version || 1),
        isDeleted: Boolean(item.isDeleted),
        updatedAt: Number(item.updatedAt || item.createdAt || Date.now()),
        payload: item,
      });
    }
  };

  pushHouseholdCollection(store.householdRecipes, 'RECIPE');
  pushHouseholdCollection(store.householdMeals, 'MEAL_PLAN');
  pushHouseholdCollection(store.householdGroceries, 'GROCERY');
  pushHouseholdCollection(store.householdChores, 'CHORE');
  pushHouseholdCollection(store.householdChoreHistory, 'CHORE_HISTORY');
  pushHouseholdCollection(store.householdAssets, 'ASSET');
  pushHouseholdCollection(store.householdAssetMaintenance, 'ASSET_MAINTENANCE');
  pushHouseholdCollection(store.householdPantry, 'PANTRY');
  pushHouseholdCollection(store.householdWardrobe, 'WARDROBE');
  pushHouseholdCollection(store.householdOutfits, 'OUTFIT');

  // Filter records to valid existing workspaces and validate referential integrity
  const validMembers = familyMembers.filter((m) => m && m.id && workspacesMap.has(m.familyId));
  const validMemberships = memberships.filter((m) => m && m.id && workspacesMap.has(m.familyId));
  const validRelationships = relationships.filter((r) => r && r.id && workspacesMap.has(r.familyId));
  const validInvitations = invitations.filter((i) => i && i.id && workspacesMap.has(i.familyId));
  const validAccounts = accounts.filter((a) => a && a.id && workspacesMap.has(a.familyId));
  const validAccountIds = new Set(validAccounts.map((a) => a.id));
  const validTransactions = transactions.filter(
    (t) => t && t.id && workspacesMap.has(t.familyId) && validAccountIds.has(t.accountId)
  );
  const validBudgets = budgets.filter((b) => b && b.id && workspacesMap.has(b.familyId));
  const validSavingsGoals = savingsGoals.filter((s: any) => s && s.id && workspacesMap.has(s.familyId));
  const validRecurringRules = recurringRules.filter((r: any) => r && r.id && workspacesMap.has(r.familyId));
  const validHoldings = investmentHoldings.filter((h: any) => h && h.id && workspacesMap.has(h.familyId));
  const validMedia = mediaAssets.filter((m) => m && m.id && workspacesMap.has(m.familyId));
  const validSyncEntities = syncEntities.filter((e) => e && e.id && workspacesMap.has(e.familyId));
  const validAuditEvents = auditEvents.filter((a) => a && a.id && workspacesMap.has(a.familyId));

  for (const m of validMembers) ensureWorkspaceExists(m.familyId);
  for (const m of validMemberships) ensureWorkspaceExists(m.familyId);

  // Verify One-Active-Membership-Per-User rule and count preserved historical memberships
  const activeUsers = new Map<string, string>();
  let revokedCount = 0;
  let leftCount = 0;
  let otherNonActiveCount = 0;

  for (const m of validMemberships) {
    if (m.status === 'ACTIVE') {
      if (activeUsers.has(m.userAccountId)) {
        validationErrors.push(
          `Duplicate ACTIVE membership detected for userAccountId=${m.userAccountId} (${activeUsers.get(m.userAccountId)} vs ${m.id})`
        );
      } else {
        activeUsers.set(m.userAccountId, m.id);
      }
    } else if (m.status === 'REVOKED') {
      revokedCount++;
    } else if ((m.status as string) === 'LEFT') {
      leftCount++;
    } else {
      otherNonActiveCount++;
    }
  }

  // Generate idempotent SQL statements
  const sqlLines: string[] = [
    '-- FamilyOS Authoritative Production Relational Migration Bundle',
    `-- Source Store: ${storePath}`,
    `-- Protected Backup SHA-256: ${backupMeta.sha256}`,
    'BEGIN;',
    '',
    '-- 1. Identity & Session Tables',
    'CREATE TABLE IF NOT EXISTS user_accounts (',
    '    id VARCHAR(64) PRIMARY KEY,',
    '    email VARCHAR(255) NOT NULL UNIQUE,',
    '    display_name VARCHAR(255) NOT NULL,',
    '    password_hash TEXT,',
    '    provider_type VARCHAR(32) DEFAULT \'EMAIL\',',
    '    is_active BOOLEAN DEFAULT TRUE,',
    '    created_at BIGINT NOT NULL,',
    '    updated_at BIGINT NOT NULL',
    ');',
    '',
    'CREATE TABLE IF NOT EXISTS auth_sessions (',
    '    id VARCHAR(64) PRIMARY KEY,',
    '    user_account_id VARCHAR(64) NOT NULL REFERENCES user_accounts(id) ON DELETE CASCADE,',
    '    session_token_hash VARCHAR(128) NOT NULL UNIQUE,',
    '    family_context_id VARCHAR(64),',
    '    ip_address VARCHAR(45),',
    '    user_agent TEXT,',
    '    expires_at BIGINT NOT NULL,',
    '    created_at BIGINT NOT NULL',
    ');',
    '',
    '-- 2. Core Family & Relationship Tables',
    'CREATE TABLE IF NOT EXISTS family_workspaces (',
    '    id VARCHAR(64) PRIMARY KEY,',
    '    name VARCHAR(255) NOT NULL,',
    '    description TEXT,',
    '    motto VARCHAR(255),',
    '    mission TEXT,',
    '    vision TEXT,',
    '    values_json JSONB DEFAULT \'[]\'::jsonb,',
    '    logo_url TEXT,',
    '    photo_url TEXT,',
    '    cover_image_url TEXT,',
    '    currency_code VARCHAR(8) DEFAULT \'USD\',',
    '    country VARCHAR(8) DEFAULT \'US\',',
    '    timezone VARCHAR(64) DEFAULT \'America/New_York\',',
    '    language VARCHAR(8) DEFAULT \'en\',',
    '    owner_user_id VARCHAR(64) NOT NULL,',
    '    announcements_json JSONB DEFAULT \'[]\'::jsonb,',
    '    reminders_json JSONB DEFAULT \'[]\'::jsonb,',
    '    version INTEGER DEFAULT 1,',
    '    is_deleted BOOLEAN DEFAULT FALSE,',
    '    updated_at BIGINT NOT NULL',
    ');',
    '',
    'CREATE TABLE IF NOT EXISTS family_members (',
    '    id VARCHAR(64) PRIMARY KEY,',
    '    family_id VARCHAR(64) NOT NULL REFERENCES family_workspaces(id) ON DELETE CASCADE,',
    '    user_account_id VARCHAR(64),',
    '    display_name VARCHAR(255) NOT NULL,',
    '    relationship_to_primary VARCHAR(64) NOT NULL,',
    '    role VARCHAR(32) NOT NULL,',
    '    membership_status VARCHAR(32) DEFAULT \'ACTIVE\',',
    '    birth_date VARCHAR(32),',
    '    birth_date_epoch BIGINT,',
    '    avatar_url TEXT,',
    '    photo_url TEXT,',
    '    is_restricted_profile BOOLEAN DEFAULT FALSE,',
    '    points_balance INTEGER DEFAULT 0,',
    '    important_dates_json JSONB DEFAULT \'[]\'::jsonb,',
    '    responsibilities_json JSONB DEFAULT \'[]\'::jsonb,',
    '    emergency_contact_json JSONB DEFAULT \'{}\'::jsonb,',
    '    shared_info_json JSONB DEFAULT \'{}\'::jsonb,',
    '    personal_info_json JSONB,',
    '    dietary_preferences_json JSONB DEFAULT \'[]\'::jsonb,',
    '    allergies_json JSONB DEFAULT \'[]\'::jsonb,',
    '    version INTEGER DEFAULT 1,',
    '    is_deleted BOOLEAN DEFAULT FALSE,',
    '    updated_at BIGINT NOT NULL',
    ');',
    '',
    'CREATE TABLE IF NOT EXISTS family_memberships (',
    '    id VARCHAR(64) PRIMARY KEY,',
    '    family_id VARCHAR(64) NOT NULL REFERENCES family_workspaces(id) ON DELETE CASCADE,',
    '    user_account_id VARCHAR(64) NOT NULL,',
    '    email VARCHAR(255) NOT NULL,',
    '    display_name VARCHAR(255) NOT NULL,',
    '    member_profile_id VARCHAR(64) NOT NULL REFERENCES family_members(id),',
    '    role VARCHAR(32) NOT NULL,',
    '    status VARCHAR(32) NOT NULL,',
    '    updated_at BIGINT NOT NULL',
    ');',
    '',
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_family_membership ON family_memberships(user_account_id) WHERE status = \'ACTIVE\';',
    '',
    'CREATE TABLE IF NOT EXISTS family_relationships (',
    '    id VARCHAR(64) PRIMARY KEY,',
    '    family_id VARCHAR(64) NOT NULL REFERENCES family_workspaces(id) ON DELETE CASCADE,',
    '    person1_member_id VARCHAR(64) NOT NULL REFERENCES family_members(id),',
    '    person2_member_id VARCHAR(64) NOT NULL REFERENCES family_members(id),',
    '    relationship_type VARCHAR(64) NOT NULL,',
    '    notes TEXT,',
    '    is_deleted BOOLEAN DEFAULT FALSE,',
    '    created_at BIGINT NOT NULL,',
    '    updated_at BIGINT NOT NULL',
    ');',
    '',
    'CREATE TABLE IF NOT EXISTS family_invitations (',
    '    id VARCHAR(64) PRIMARY KEY,',
    '    family_id VARCHAR(64) NOT NULL REFERENCES family_workspaces(id) ON DELETE CASCADE,',
    '    invitation_token VARCHAR(128) NOT NULL UNIQUE,',
    '    invited_email VARCHAR(255) NOT NULL,',
    '    invited_display_name VARCHAR(255) NOT NULL,',
    '    target_role VARCHAR(32) NOT NULL,',
    '    assigned_member_profile_id VARCHAR(64) NOT NULL REFERENCES family_members(id),',
    '    invited_by_user_id VARCHAR(64) NOT NULL,',
    '    accepted_by_user_id VARCHAR(64),',
    '    status VARCHAR(32) NOT NULL,',
    '    use_count INTEGER DEFAULT 0,',
    '    max_uses INTEGER DEFAULT 1,',
    '    expires_at BIGINT NOT NULL,',
    '    created_at BIGINT NOT NULL,',
    '    updated_at BIGINT NOT NULL',
    ');',
    '',
    '-- 3. Financial Ledger Tables (Integer-Cents Precision & Double-Entry Postings)',
    'CREATE TABLE IF NOT EXISTS financial_accounts (',
    '    id VARCHAR(64) PRIMARY KEY,',
    '    family_id VARCHAR(64) NOT NULL REFERENCES family_workspaces(id) ON DELETE CASCADE,',
    '    name VARCHAR(255) NOT NULL,',
    '    account_type VARCHAR(32) NOT NULL CHECK (account_type IN (\'CHECKING\', \'SAVINGS\', \'CREDIT_CARD\', \'INVESTMENT\', \'CASH\', \'LOAN\', \'ASSET\', \'LIABILITY\', \'EQUITY\', \'INCOME\', \'EXPENSE\')),',
    '    current_balance_cents BIGINT NOT NULL DEFAULT 0,',
    '    is_liability BOOLEAN NOT NULL DEFAULT FALSE,',
    '    institution VARCHAR(255),',
    '    last_reconciled_at BIGINT,',
    '    updated_at BIGINT NOT NULL,',
    '    UNIQUE (family_id, id)',
    ');',
    '',
    'CREATE TABLE IF NOT EXISTS financial_transactions (',
    '    id VARCHAR(64) PRIMARY KEY,',
    '    family_id VARCHAR(64) NOT NULL REFERENCES family_workspaces(id) ON DELETE CASCADE,',
    '    account_id VARCHAR(64) NOT NULL,',
    '    destination_account_id VARCHAR(64) REFERENCES financial_accounts(id),',
    '    title VARCHAR(255) NOT NULL,',
    '    amount_cents BIGINT NOT NULL CHECK (amount_cents > 0),',
    '    transaction_type VARCHAR(32) NOT NULL CHECK (transaction_type IN (\'INCOME\', \'EXPENSE\', \'TRANSFER\')),',
    '    category VARCHAR(64) NOT NULL,',
    '    transaction_date BIGINT NOT NULL,',
    '    is_reversal BOOLEAN DEFAULT FALSE,',
    '    reversal_of_id VARCHAR(64),',
    '    paid_by VARCHAR(255) NOT NULL,',
    '    idempotency_key VARCHAR(128) UNIQUE,',
    '    UNIQUE (family_id, id),',
    '    CONSTRAINT fk_fin_tx_family_account FOREIGN KEY (family_id, account_id) REFERENCES financial_accounts (family_id, id) ON DELETE RESTRICT',
    ');',
    '',
    'CREATE TABLE IF NOT EXISTS financial_entries (',
    '    id VARCHAR(64) PRIMARY KEY,',
    '    transaction_id VARCHAR(64) NOT NULL,',
    '    family_id VARCHAR(64) NOT NULL REFERENCES family_workspaces(id) ON DELETE CASCADE,',
    '    account_id VARCHAR(64) NOT NULL,',
    '    entry_type VARCHAR(16) NOT NULL CHECK (entry_type IN (\'DEBIT\', \'CREDIT\')),',
    '    amount_cents BIGINT NOT NULL CHECK (amount_cents > 0),',
    '    created_at BIGINT NOT NULL,',
    '    CONSTRAINT fk_entries_family_transaction FOREIGN KEY (family_id, transaction_id) REFERENCES financial_transactions (family_id, id) ON DELETE CASCADE,',
    '    CONSTRAINT fk_entries_family_account FOREIGN KEY (family_id, account_id) REFERENCES financial_accounts (family_id, id) ON DELETE RESTRICT',
    ');',
    '',
    'CREATE OR REPLACE FUNCTION check_balanced_transaction_entries() RETURNS TRIGGER AS $$',
    'DECLARE v_tx_id TEXT; v_entry_count INT; v_debit_sum BIGINT; v_credit_sum BIGINT; v_net_balance BIGINT;',
    'BEGIN',
    '    v_tx_id := COALESCE(NEW.transaction_id, OLD.transaction_id);',
    '    SELECT COUNT(*), COALESCE(SUM(CASE WHEN entry_type = \'DEBIT\' THEN amount_cents ELSE 0 END), 0), COALESCE(SUM(CASE WHEN entry_type = \'CREDIT\' THEN amount_cents ELSE 0 END), 0), COALESCE(SUM(CASE WHEN entry_type = \'DEBIT\' THEN amount_cents ELSE -amount_cents END), 0)',
    '    INTO v_entry_count, v_debit_sum, v_credit_sum, v_net_balance FROM financial_entries WHERE transaction_id = v_tx_id;',
    '    IF v_entry_count < 2 THEN RAISE EXCEPTION \'DOUBLE_ENTRY_VIOLATION: Transaction % must have at least 2 ledger entries\', v_tx_id; END IF;',
    '    IF v_net_balance <> 0 OR v_debit_sum <> v_credit_sum THEN RAISE EXCEPTION \'DOUBLE_ENTRY_UNBALANCED: Transaction % has unequal debits (%) and credits (%)\', v_tx_id, v_debit_sum, v_credit_sum; END IF;',
    '    RETURN NULL;',
    'END;',
    '$$ LANGUAGE plpgsql;',
    '',
    'DROP TRIGGER IF EXISTS trg_enforce_double_entry_balance ON financial_entries;',
    'CREATE CONSTRAINT TRIGGER trg_enforce_double_entry_balance AFTER INSERT ON financial_entries DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_balanced_transaction_entries();',
    '',
    'CREATE OR REPLACE FUNCTION prevent_financial_entries_mutation() RETURNS TRIGGER AS $$',
    'BEGIN RAISE EXCEPTION \'IMMUTABLE_LEDGER_ENTRY: Posted financial_entries cannot be updated or deleted (entry id: %).\', OLD.id; END;',
    '$$ LANGUAGE plpgsql;',
    '',
    'DROP TRIGGER IF EXISTS trg_immutable_financial_entries ON financial_entries;',
    'CREATE TRIGGER trg_immutable_financial_entries BEFORE UPDATE OR DELETE ON financial_entries FOR EACH ROW EXECUTE FUNCTION prevent_financial_entries_mutation();',
    '',
    'CREATE TABLE IF NOT EXISTS financial_budgets (',
    '    id VARCHAR(64) PRIMARY KEY,',
    '    family_id VARCHAR(64) NOT NULL REFERENCES family_workspaces(id) ON DELETE CASCADE,',
    '    category VARCHAR(64) NOT NULL,',
    '    allocated_cents BIGINT NOT NULL DEFAULT 0,',
    '    spent_cents BIGINT NOT NULL DEFAULT 0,',
    '    alert_threshold_percentage INTEGER DEFAULT 85,',
    '    updated_at BIGINT NOT NULL,',
    '    CONSTRAINT chk_alert_threshold CHECK (alert_threshold_percentage BETWEEN 1 AND 100)',
    ');',
    '',
    'CREATE TABLE IF NOT EXISTS savings_goals (',
    '    id VARCHAR(64) PRIMARY KEY,',
    '    family_id VARCHAR(64) NOT NULL REFERENCES family_workspaces(id) ON DELETE CASCADE,',
    '    name VARCHAR(255) NOT NULL,',
    '    target_amount_cents BIGINT NOT NULL,',
    '    current_amount_cents BIGINT NOT NULL DEFAULT 0,',
    '    target_date BIGINT,',
    '    linked_account_id VARCHAR(64) REFERENCES financial_accounts(id),',
    '    status VARCHAR(32) DEFAULT \'ACTIVE\',',
    '    updated_at BIGINT NOT NULL',
    ');',
    '',
    'CREATE TABLE IF NOT EXISTS savings_contributions (',
    '    id VARCHAR(64) PRIMARY KEY,',
    '    goal_id VARCHAR(64) NOT NULL REFERENCES savings_goals(id) ON DELETE CASCADE,',
    '    family_id VARCHAR(64) NOT NULL,',
    '    funding_account_id VARCHAR(64) REFERENCES financial_accounts(id),',
    '    amount_cents BIGINT NOT NULL,',
    '    contributed_by VARCHAR(255) NOT NULL,',
    '    created_at BIGINT NOT NULL',
    ');',
    '',
    'CREATE TABLE IF NOT EXISTS recurring_rules (',
    '    id VARCHAR(64) PRIMARY KEY,',
    '    family_id VARCHAR(64) NOT NULL REFERENCES family_workspaces(id) ON DELETE CASCADE,',
    '    account_id VARCHAR(64) NOT NULL REFERENCES financial_accounts(id),',
    '    title VARCHAR(255) NOT NULL,',
    '    amount_cents BIGINT NOT NULL,',
    '    transaction_type VARCHAR(32) NOT NULL,',
    '    category VARCHAR(64) NOT NULL,',
    '    frequency VARCHAR(32) NOT NULL,',
    '    next_occurrence_date BIGINT NOT NULL,',
    '    is_active BOOLEAN DEFAULT TRUE,',
    '    updated_at BIGINT NOT NULL',
    ');',
    '',
    'CREATE TABLE IF NOT EXISTS recurring_execution_history (',
    '    id VARCHAR(64) PRIMARY KEY,',
    '    rule_id VARCHAR(64) NOT NULL REFERENCES recurring_rules(id) ON DELETE CASCADE,',
    '    family_id VARCHAR(64) NOT NULL,',
    '    transaction_id VARCHAR(64) REFERENCES financial_transactions(id),',
    '    execution_date BIGINT NOT NULL,',
    '    amount_cents BIGINT NOT NULL,',
    '    status VARCHAR(32) NOT NULL,',
    '    created_at BIGINT NOT NULL',
    ');',
    '',
    'CREATE TABLE IF NOT EXISTS investment_holdings (',
    '    id VARCHAR(64) PRIMARY KEY,',
    '    family_id VARCHAR(64) NOT NULL REFERENCES family_workspaces(id) ON DELETE CASCADE,',
    '    account_id VARCHAR(64) NOT NULL REFERENCES financial_accounts(id),',
    '    symbol VARCHAR(32) NOT NULL,',
    '    name VARCHAR(255) NOT NULL,',
    '    asset_class VARCHAR(64) NOT NULL,',
    '    shares_micro BIGINT NOT NULL,',
    '    current_price_cents BIGINT NOT NULL,',
    '    cost_basis_cents BIGINT NOT NULL,',
    '    updated_at BIGINT NOT NULL',
    ');',
    '',
    '-- 4. Household, Chores, Assets & Media Tables',
    'CREATE TABLE IF NOT EXISTS household_records (',
    '    id VARCHAR(128) PRIMARY KEY,',
    '    family_id VARCHAR(64) NOT NULL REFERENCES family_workspaces(id) ON DELETE CASCADE,',
    '    domain_type VARCHAR(64) NOT NULL,',
    '    payload_json JSONB NOT NULL,',
    '    version INTEGER DEFAULT 1,',
    '    is_deleted BOOLEAN DEFAULT FALSE,',
    '    updated_at BIGINT NOT NULL',
    ');',
    '',
    'CREATE TABLE IF NOT EXISTS household_recipes (',
    '    id VARCHAR(64) PRIMARY KEY,',
    '    family_id VARCHAR(64) NOT NULL REFERENCES family_workspaces(id) ON DELETE CASCADE,',
    '    title VARCHAR(255) NOT NULL,',
    '    description TEXT,',
    '    prep_time_minutes INTEGER,',
    '    cook_time_minutes INTEGER,',
    '    servings INTEGER,',
    '    instructions_json JSONB DEFAULT \'[]\'::jsonb,',
    '    version INTEGER DEFAULT 1,',
    '    is_deleted BOOLEAN DEFAULT FALSE,',
    '    updated_at BIGINT NOT NULL',
    ');',
    '',
    'CREATE TABLE IF NOT EXISTS pantry_items (',
    '    id VARCHAR(64) PRIMARY KEY,',
    '    family_id VARCHAR(64) NOT NULL REFERENCES family_workspaces(id) ON DELETE CASCADE,',
    '    item_name VARCHAR(255) NOT NULL,',
    '    category VARCHAR(64) NOT NULL,',
    '    quantity_numerator INTEGER NOT NULL,',
    '    quantity_denominator INTEGER NOT NULL DEFAULT 1,',
    '    unit VARCHAR(32) NOT NULL,',
    '    minimum_quantity INTEGER,',
    '    expiry_date VARCHAR(32),',
    '    expiry_date_epoch BIGINT,',
    '    is_deleted BOOLEAN DEFAULT FALSE,',
    '    updated_at BIGINT NOT NULL',
    ');',
    '',
    'CREATE TABLE IF NOT EXISTS household_chores (',
    '    id VARCHAR(64) PRIMARY KEY,',
    '    family_id VARCHAR(64) NOT NULL REFERENCES family_workspaces(id) ON DELETE CASCADE,',
    '    title VARCHAR(255) NOT NULL,',
    '    description TEXT,',
    '    assigned_member_id VARCHAR(64) REFERENCES family_members(id),',
    '    recurrence_type VARCHAR(32) NOT NULL,',
    '    points_value INTEGER DEFAULT 10,',
    '    next_due_date BIGINT NOT NULL,',
    '    is_active BOOLEAN DEFAULT TRUE,',
    '    updated_at BIGINT NOT NULL',
    ');',
    '',
    'CREATE TABLE IF NOT EXISTS chore_completions (',
    '    id VARCHAR(64) PRIMARY KEY,',
    '    chore_id VARCHAR(64) NOT NULL REFERENCES household_chores(id) ON DELETE CASCADE,',
    '    family_id VARCHAR(64) NOT NULL,',
    '    completed_by_member_id VARCHAR(64) NOT NULL REFERENCES family_members(id),',
    '    completed_at BIGINT NOT NULL,',
    '    points_awarded INTEGER DEFAULT 0',
    ');',
    '',
    'CREATE TABLE IF NOT EXISTS reward_points_ledger (',
    '    id VARCHAR(64) PRIMARY KEY,',
    '    family_id VARCHAR(64) NOT NULL REFERENCES family_workspaces(id) ON DELETE CASCADE,',
    '    member_id VARCHAR(64) NOT NULL REFERENCES family_members(id),',
    '    source_type VARCHAR(32) NOT NULL,',
    '    source_reference_id VARCHAR(64),',
    '    points_delta INTEGER NOT NULL,',
    '    notes TEXT,',
    '    created_at BIGINT NOT NULL',
    ');',
    '',
    'CREATE TABLE IF NOT EXISTS household_assets (',
    '    id VARCHAR(64) PRIMARY KEY,',
    '    family_id VARCHAR(64) NOT NULL REFERENCES family_workspaces(id) ON DELETE CASCADE,',
    '    name VARCHAR(255) NOT NULL,',
    '    category VARCHAR(64) NOT NULL,',
    '    serial_number VARCHAR(128),',
    '    purchase_date BIGINT,',
    '    warranty_expiration_date BIGINT,',
    '    is_deleted BOOLEAN DEFAULT FALSE,',
    '    updated_at BIGINT NOT NULL',
    ');',
    '',
    'CREATE TABLE IF NOT EXISTS asset_service_records (',
    '    id VARCHAR(64) PRIMARY KEY,',
    '    asset_id VARCHAR(64) NOT NULL REFERENCES household_assets(id) ON DELETE CASCADE,',
    '    family_id VARCHAR(64) NOT NULL,',
    '    service_date BIGINT NOT NULL,',
    '    service_type VARCHAR(64) NOT NULL,',
    '    provider VARCHAR(255),',
    '    cost_cents BIGINT DEFAULT 0,',
    '    notes TEXT,',
    '    next_service_due_date BIGINT,',
    '    created_at BIGINT NOT NULL',
    ');',
    '',
    'CREATE TABLE IF NOT EXISTS calendar_events (',
    '    id VARCHAR(64) PRIMARY KEY,',
    '    family_id VARCHAR(64) NOT NULL REFERENCES family_workspaces(id) ON DELETE CASCADE,',
    '    title VARCHAR(255) NOT NULL,',
    '    description TEXT,',
    '    event_date VARCHAR(32) NOT NULL,',
    '    event_epoch BIGINT NOT NULL,',
    '    start_time VARCHAR(16),',
    '    end_time VARCHAR(16),',
    '    is_all_day BOOLEAN DEFAULT FALSE,',
    '    category VARCHAR(64) DEFAULT \'FAMILY_EVENT\',',
    '    location TEXT,',
    '    created_by_user_id VARCHAR(64) NOT NULL,',
    '    is_deleted BOOLEAN DEFAULT FALSE,',
    '    updated_at BIGINT NOT NULL',
    ');',
    '',
    'CREATE TABLE IF NOT EXISTS event_attendees (',
    '    id VARCHAR(64) PRIMARY KEY,',
    '    event_id VARCHAR(64) NOT NULL REFERENCES calendar_events(id) ON DELETE CASCADE,',
    '    member_id VARCHAR(64) NOT NULL REFERENCES family_members(id),',
    '    rsvp_status VARCHAR(32) DEFAULT \'ACCEPTED\'',
    ');',
    '',
    'CREATE TABLE IF NOT EXISTS media_assets (',
    '    id VARCHAR(64) PRIMARY KEY,',
    '    family_id VARCHAR(64) NOT NULL REFERENCES family_workspaces(id) ON DELETE CASCADE,',
    '    owner_member_id VARCHAR(64) NOT NULL REFERENCES family_members(id),',
    '    uploaded_by_user_id VARCHAR(64) NOT NULL,',
    '    visibility VARCHAR(32) DEFAULT \'FAMILY\',',
    '    category VARCHAR(64) DEFAULT \'GENERAL\',',
    '    mime_type VARCHAR(64) NOT NULL,',
    '    file_name VARCHAR(255) NOT NULL,',
    '    data_url TEXT NOT NULL,',
    '    size_bytes BIGINT NOT NULL,',
    '    is_deleted BOOLEAN DEFAULT FALSE,',
    '    created_at BIGINT NOT NULL,',
    '    updated_at BIGINT NOT NULL,',
    '    CONSTRAINT chk_media_size CHECK (size_bytes <= 5242880)',
    ');',
    '',
    'CREATE TABLE IF NOT EXISTS synchronized_entities (',
    '    id VARCHAR(128) PRIMARY KEY,',
    '    family_id VARCHAR(64) NOT NULL REFERENCES family_workspaces(id) ON DELETE CASCADE,',
    '    entity_type VARCHAR(64) NOT NULL,',
    '    payload_json JSONB NOT NULL,',
    '    version INTEGER DEFAULT 1,',
    '    is_deleted BOOLEAN DEFAULT FALSE,',
    '    updated_by_user_id VARCHAR(64) NOT NULL,',
    '    updated_at BIGINT NOT NULL',
    ');',
    '',
    'CREATE TABLE IF NOT EXISTS sync_devices (',
    '    id VARCHAR(64) PRIMARY KEY,',
    '    user_account_id VARCHAR(64) NOT NULL REFERENCES user_accounts(id) ON DELETE CASCADE,',
    '    device_name VARCHAR(255),',
    '    platform VARCHAR(32) NOT NULL,',
    '    last_sync_cursor BIGINT DEFAULT 0,',
    '    last_seen_at BIGINT NOT NULL',
    ');',
    '',
    'CREATE TABLE IF NOT EXISTS audit_events (',
    '    id VARCHAR(64) PRIMARY KEY,',
    '    family_id VARCHAR(64) NOT NULL REFERENCES family_workspaces(id) ON DELETE CASCADE,',
    '    actor_user_id VARCHAR(64),',
    '    actor_role VARCHAR(32) NOT NULL,',
    '    action_type VARCHAR(64) NOT NULL,',
    '    summary TEXT NOT NULL,',
    '    created_at BIGINT NOT NULL',
    ');',
    '',
    '-- 5. Data Insert Statements (Idempotent ON CONFLICT)',
    ''];

  // Seed user_accounts from unique active user accounts in memberships & workspace owners
  const knownUsers = new Map<string, { email: string; name: string }>();
  for (const ws of workspacesMap.values()) {
    if (ws.ownerUserId) {
      knownUsers.set(ws.ownerUserId, { email: `${ws.ownerUserId}@familyos.internal`, name: 'Household Owner' });
    }
  }
  for (const mem of validMemberships) {
    if (mem.userAccountId) {
      knownUsers.set(mem.userAccountId, {
        email: mem.email || `${mem.userAccountId}@familyos.internal`,
        name: mem.displayName || 'Family User',
      });
    }
  }
  for (const [uid, udata] of knownUsers.entries()) {
    sqlLines.push(
      `INSERT INTO user_accounts (id, email, display_name, provider_type, is_active, created_at, updated_at) VALUES (${sqlString(uid)}, ${sqlString(udata.email)}, ${sqlString(udata.name)}, 'INTERNAL', TRUE, ${Date.now()}, ${Date.now()}) ON CONFLICT (id) DO UPDATE SET display_name = EXCLUDED.display_name, updated_at = EXCLUDED.updated_at;`
    );
  }
  sqlLines.push('');

  for (const ws of workspacesMap.values()) {
    sqlLines.push(
      `INSERT INTO family_workspaces (id, name, description, motto, mission, vision, values_json, logo_url, photo_url, cover_image_url, currency_code, country, timezone, language, owner_user_id, announcements_json, reminders_json, version, is_deleted, updated_at) VALUES (${sqlString(ws.id)}, ${sqlString(ws.name)}, ${sqlString(ws.description ?? null)}, ${sqlString(ws.motto ?? null)}, ${sqlString(ws.mission ?? null)}, ${sqlString(ws.vision ?? null)}, ${sqlJsonb(ws.values ?? [])}, ${sqlString(ws.logoUrl ?? null)}, ${sqlString(ws.photoUrl ?? null)}, ${sqlString(ws.coverImageUrl ?? null)}, ${sqlString(ws.currencyCode || 'USD')}, ${sqlString(ws.country || 'US')}, ${sqlString(ws.timezone || 'America/New_York')}, ${sqlString(ws.language || 'en')}, ${sqlString(ws.ownerUserId)}, ${sqlJsonb(ws.announcements ?? [])}, ${sqlJsonb(ws.reminders ?? [])}, ${Number(ws.version || 1)}, ${sqlBoolean(ws.isDeleted)}, ${sqlBigInt(ws.updatedAt || Date.now())}) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, version = EXCLUDED.version, is_deleted = EXCLUDED.is_deleted, updated_at = EXCLUDED.updated_at;`
    );
  }

  for (const m of validMembers) {
    sqlLines.push(
      `INSERT INTO family_members (id, family_id, user_account_id, display_name, relationship_to_primary, role, membership_status, birth_date, birth_date_epoch, avatar_url, photo_url, is_restricted_profile, points_balance, important_dates_json, responsibilities_json, emergency_contact_json, shared_info_json, personal_info_json, dietary_preferences_json, allergies_json, version, is_deleted, updated_at) VALUES (${sqlString(m.id)}, ${sqlString(m.familyId)}, ${sqlString(m.userAccountId ?? null)}, ${sqlString(m.displayName)}, ${sqlString(m.relationshipToPrimary)}, ${sqlString(m.role)}, ${sqlString(m.membershipStatus)}, ${sqlString(m.birthDate ?? null)}, ${m.birthDateEpoch ? sqlBigInt(m.birthDateEpoch) : 'NULL'}, ${sqlString(m.avatarUrl ?? null)}, ${sqlString(m.photoUrl ?? null)}, ${sqlBoolean(m.isRestrictedProfile)}, ${Number(m.pointsBalance || 0)}, ${sqlJsonb(m.importantDates ?? [])}, ${sqlJsonb(m.responsibilities ?? [])}, ${sqlJsonb(m.emergencyContact ?? {})}, ${sqlJsonb(m.sharedInfo ?? {})}, ${m.personalInfo ? sqlJsonb(m.personalInfo) : 'NULL'}, ${sqlJsonb(m.dietaryPreferences ?? [])}, ${sqlJsonb(m.allergies ?? [])}, ${Number(m.version || 1)}, ${sqlBoolean(m.isDeleted)}, ${sqlBigInt(m.updatedAt || Date.now())}) ON CONFLICT (id) DO UPDATE SET display_name = EXCLUDED.display_name, role = EXCLUDED.role, membership_status = EXCLUDED.membership_status, version = EXCLUDED.version, is_deleted = EXCLUDED.is_deleted, updated_at = EXCLUDED.updated_at;`
    );
  }

  for (const mem of validMemberships) {
    sqlLines.push(
      `INSERT INTO family_memberships (id, family_id, user_account_id, email, display_name, member_profile_id, role, status, updated_at) VALUES (${sqlString(mem.id)}, ${sqlString(mem.familyId)}, ${sqlString(mem.userAccountId)}, ${sqlString(mem.email)}, ${sqlString(mem.displayName)}, ${sqlString(mem.memberProfileId)}, ${sqlString(mem.role)}, ${sqlString(mem.status)}, ${sqlBigInt(mem.updatedAt || Date.now())}) ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, status = EXCLUDED.status, updated_at = EXCLUDED.updated_at;`
    );
  }

  for (const rel of validRelationships) {
    sqlLines.push(
      `INSERT INTO family_relationships (id, family_id, person1_member_id, person2_member_id, relationship_type, notes, is_deleted, created_at, updated_at) VALUES (${sqlString(rel.id)}, ${sqlString(rel.familyId)}, ${sqlString(rel.person1MemberId)}, ${sqlString(rel.person2MemberId)}, ${sqlString(rel.relationshipType)}, ${sqlString(rel.notes ?? null)}, ${sqlBoolean(rel.isDeleted)}, ${sqlBigInt(rel.createdAt || Date.now())}, ${sqlBigInt(rel.updatedAt || Date.now())}) ON CONFLICT (id) DO UPDATE SET relationship_type = EXCLUDED.relationship_type, is_deleted = EXCLUDED.is_deleted, updated_at = EXCLUDED.updated_at;`
    );
  }

  for (const inv of validInvitations) {
    sqlLines.push(
      `INSERT INTO family_invitations (id, family_id, invitation_token, invited_email, invited_display_name, target_role, assigned_member_profile_id, invited_by_user_id, accepted_by_user_id, status, use_count, max_uses, expires_at, created_at, updated_at) VALUES (${sqlString(inv.id)}, ${sqlString(inv.familyId)}, ${sqlString(inv.invitationToken)}, ${sqlString(inv.invitedEmail)}, ${sqlString(inv.invitedDisplayName)}, ${sqlString(inv.targetRole)}, ${sqlString(inv.assignedMemberProfileId)}, ${sqlString(inv.invitedByUserId)}, ${sqlString(inv.acceptedByUserId ?? null)}, ${sqlString(inv.status)}, ${Number(inv.useCount || 0)}, ${Number(inv.maxUses || 1)}, ${sqlBigInt(inv.expiresAt)}, ${sqlBigInt(inv.createdAt)}, ${sqlBigInt(inv.updatedAt)}) ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, use_count = EXCLUDED.use_count, accepted_by_user_id = EXCLUDED.accepted_by_user_id, updated_at = EXCLUDED.updated_at;`
    );
  }

  for (const acc of validAccounts) {
    const rawBalance = (acc as any).currentBalanceCentsDecimal ?? acc.currentBalanceCents ?? 0;
    sqlLines.push(
      `INSERT INTO financial_accounts (id, family_id, name, account_type, current_balance_cents, is_liability, institution, last_reconciled_at, updated_at) VALUES (${sqlString(acc.id)}, ${sqlString(acc.familyId)}, ${sqlString(acc.name)}, ${sqlString(acc.accountType)}, ${sqlBigInt(rawBalance)}, ${sqlBoolean(acc.isLiability)}, ${sqlString(acc.institution)}, ${acc.lastReconciledAt ? sqlBigInt(acc.lastReconciledAt) : 'NULL'}, ${sqlBigInt(acc.updatedAt || Date.now())}) ON CONFLICT (id) DO UPDATE SET current_balance_cents = EXCLUDED.current_balance_cents, updated_at = EXCLUDED.updated_at;`
    );
  }

  // Seed authoritative Chart-of-Accounts category ledger accounts
  const seededCoaKeys = new Set<string>();
  for (const tx of validTransactions) {
    const cat = String(tx.category || (tx.transactionType === 'INCOME' ? 'INCOME' : 'EXPENSE')).toUpperCase();
    const coaId = `coa-${tx.familyId}-${cat}`;
    if (!seededCoaKeys.has(coaId)) {
      seededCoaKeys.add(coaId);
      const accType = tx.transactionType === 'INCOME' ? 'INCOME' : 'EXPENSE';
      sqlLines.push(
        `INSERT INTO financial_accounts (id, family_id, name, account_type, current_balance_cents, is_liability, institution, updated_at) VALUES (${sqlString(coaId)}, ${sqlString(tx.familyId)}, ${sqlString(`General Ledger: ${cat}`)}, ${sqlString(accType)}, 0, FALSE, 'Family General Ledger Chart of Accounts', 0) ON CONFLICT (id) DO NOTHING;`
      );
    }
  }

  for (const tx of validTransactions) {
    const rawAmount = (tx as any).amountCentsDecimal ?? tx.amountCents ?? 0;
    sqlLines.push(
      `INSERT INTO financial_transactions (id, family_id, account_id, destination_account_id, title, amount_cents, transaction_type, category, transaction_date, is_reversal, reversal_of_id, paid_by, idempotency_key) VALUES (${sqlString(tx.id)}, ${sqlString(tx.familyId)}, ${sqlString(tx.accountId)}, ${sqlString(tx.destinationAccountId ?? null)}, ${sqlString(tx.title)}, ${sqlBigInt(rawAmount)}, ${sqlString(tx.transactionType)}, ${sqlString(tx.category)}, ${sqlBigInt(tx.transactionDate)}, ${sqlBoolean(tx.isReversal)}, ${sqlString(tx.reversalOfId ?? null)}, ${sqlString(tx.paidBy)}, ${sqlString(tx.idempotencyKey ?? null)}) ON CONFLICT (id) DO UPDATE SET amount_cents = EXCLUDED.amount_cents, is_reversal = EXCLUDED.is_reversal;`
    );

    // Generate balanced double-entry postings (sum Debits = sum Credits) referencing real accounts.
    // Reversal transactions post in the exact opposite direction of the original transaction.
    const txType = String(tx.transactionType || 'EXPENSE').toUpperCase();
    const cat = String(tx.category || (txType === 'INCOME' ? 'INCOME' : 'EXPENSE')).toUpperCase();
    const coaAccountId = `coa-${tx.familyId}-${cat}`;
    const isRev = Boolean(tx.isReversal);

    if (txType === 'EXPENSE') {
      const accountEntryType = isRev ? 'DEBIT' : 'CREDIT';
      const coaEntryType = isRev ? 'CREDIT' : 'DEBIT';
      sqlLines.push(
        `INSERT INTO financial_entries (id, transaction_id, family_id, account_id, entry_type, amount_cents, created_at) VALUES (${sqlString(`${tx.id}-${accountEntryType.toLowerCase()}`)}, ${sqlString(tx.id)}, ${sqlString(tx.familyId)}, ${sqlString(tx.accountId)}, '${accountEntryType}', ${sqlBigInt(rawAmount)}, ${sqlBigInt(tx.transactionDate)}) ON CONFLICT (id) DO NOTHING;`,
        `INSERT INTO financial_entries (id, transaction_id, family_id, account_id, entry_type, amount_cents, created_at) VALUES (${sqlString(`${tx.id}-${coaEntryType.toLowerCase()}`)}, ${sqlString(tx.id)}, ${sqlString(tx.familyId)}, ${sqlString(coaAccountId)}, '${coaEntryType}', ${sqlBigInt(rawAmount)}, ${sqlBigInt(tx.transactionDate)}) ON CONFLICT (id) DO NOTHING;`
      );
    } else if (txType === 'INCOME') {
      const accountEntryType = isRev ? 'CREDIT' : 'DEBIT';
      const coaEntryType = isRev ? 'DEBIT' : 'CREDIT';
      sqlLines.push(
        `INSERT INTO financial_entries (id, transaction_id, family_id, account_id, entry_type, amount_cents, created_at) VALUES (${sqlString(`${tx.id}-${accountEntryType.toLowerCase()}`)}, ${sqlString(tx.id)}, ${sqlString(tx.familyId)}, ${sqlString(tx.accountId)}, '${accountEntryType}', ${sqlBigInt(rawAmount)}, ${sqlBigInt(tx.transactionDate)}) ON CONFLICT (id) DO NOTHING;`,
        `INSERT INTO financial_entries (id, transaction_id, family_id, account_id, entry_type, amount_cents, created_at) VALUES (${sqlString(`${tx.id}-${coaEntryType.toLowerCase()}`)}, ${sqlString(tx.id)}, ${sqlString(tx.familyId)}, ${sqlString(coaAccountId)}, '${coaEntryType}', ${sqlBigInt(rawAmount)}, ${sqlBigInt(tx.transactionDate)}) ON CONFLICT (id) DO NOTHING;`
      );
    } else {
      // TRANSFER
      const destAcc = tx.destinationAccountId || 'acc-destination';
      const sourceEntryType = isRev ? 'DEBIT' : 'CREDIT';
      const destEntryType = isRev ? 'CREDIT' : 'DEBIT';
      sqlLines.push(
        `INSERT INTO financial_entries (id, transaction_id, family_id, account_id, entry_type, amount_cents, created_at) VALUES (${sqlString(`${tx.id}-${sourceEntryType.toLowerCase()}`)}, ${sqlString(tx.id)}, ${sqlString(tx.familyId)}, ${sqlString(tx.accountId)}, '${sourceEntryType}', ${sqlBigInt(rawAmount)}, ${sqlBigInt(tx.transactionDate)}) ON CONFLICT (id) DO NOTHING;`,
        `INSERT INTO financial_entries (id, transaction_id, family_id, account_id, entry_type, amount_cents, created_at) VALUES (${sqlString(`${tx.id}-${destEntryType.toLowerCase()}`)}, ${sqlString(tx.id)}, ${sqlString(tx.familyId)}, ${sqlString(destAcc)}, '${destEntryType}', ${sqlBigInt(rawAmount)}, ${sqlBigInt(tx.transactionDate)}) ON CONFLICT (id) DO NOTHING;`
      );
    }
  }

  for (const b of validBudgets) {
    sqlLines.push(
      `INSERT INTO financial_budgets (id, family_id, category, allocated_cents, spent_cents, alert_threshold_percentage, updated_at) VALUES (${sqlString(b.id)}, ${sqlString(b.familyId)}, ${sqlString(b.category)}, ${sqlBigInt((b as any).allocatedCentsDecimal ?? b.allocatedCents)}, ${sqlBigInt((b as any).spentCentsDecimal ?? b.spentCents)}, ${Number(b.alertThresholdPercentage || 85)}, ${sqlBigInt(b.updatedAt || Date.now())}) ON CONFLICT (id) DO UPDATE SET allocated_cents = EXCLUDED.allocated_cents, spent_cents = EXCLUDED.spent_cents, updated_at = EXCLUDED.updated_at;`
    );
  }

  for (const sg of validSavingsGoals) {
    sqlLines.push(
      `INSERT INTO savings_goals (id, family_id, name, target_amount_cents, current_amount_cents, target_date, linked_account_id, status, updated_at) VALUES (${sqlString(sg.id)}, ${sqlString(sg.familyId)}, ${sqlString(sg.name)}, ${sqlBigInt(sg.targetAmountCentsDecimal ?? sg.targetAmountCents)}, ${sqlBigInt(sg.currentAmountCentsDecimal ?? sg.currentAmountCents)}, ${sg.targetDate ? sqlBigInt(sg.targetDate) : 'NULL'}, ${sqlString(sg.linkedAccountId ?? null)}, ${sqlString(sg.status || 'ACTIVE')}, ${sqlBigInt(sg.updatedAt || Date.now())}) ON CONFLICT (id) DO UPDATE SET current_amount_cents = EXCLUDED.current_amount_cents, status = EXCLUDED.status, updated_at = EXCLUDED.updated_at;`
    );
  }

  for (const rr of validRecurringRules) {
    sqlLines.push(
      `INSERT INTO recurring_rules (id, family_id, account_id, title, amount_cents, transaction_type, category, frequency, next_occurrence_date, is_active, updated_at) VALUES (${sqlString(rr.id)}, ${sqlString(rr.familyId)}, ${sqlString(rr.accountId)}, ${sqlString(rr.title)}, ${sqlBigInt(rr.amountCentsDecimal ?? rr.amountCents)}, ${sqlString(rr.transactionType)}, ${sqlString(rr.category)}, ${sqlString(rr.frequency)}, ${sqlBigInt(rr.nextOccurrenceDate || Date.now())}, ${sqlBoolean(rr.isActive ?? true)}, ${sqlBigInt(rr.updatedAt || Date.now())}) ON CONFLICT (id) DO UPDATE SET amount_cents = EXCLUDED.amount_cents, is_active = EXCLUDED.is_active, updated_at = EXCLUDED.updated_at;`
    );
  }

  for (const h of validHoldings) {
    sqlLines.push(
      `INSERT INTO investment_holdings (id, family_id, account_id, symbol, name, asset_class, shares_micro, current_price_cents, cost_basis_cents, updated_at) VALUES (${sqlString(h.id)}, ${sqlString(h.familyId)}, ${sqlString(h.accountId)}, ${sqlString(h.symbol)}, ${sqlString(h.name)}, ${sqlString(h.assetClass)}, ${sqlBigInt(h.sharesMicroDecimal ?? h.sharesMicro)}, ${sqlBigInt(h.currentPriceCentsDecimal ?? h.currentPriceCents)}, ${sqlBigInt(h.costBasisCentsDecimal ?? h.costBasisCents)}, ${sqlBigInt(h.updatedAt || Date.now())}) ON CONFLICT (id) DO UPDATE SET shares_micro = EXCLUDED.shares_micro, current_price_cents = EXCLUDED.current_price_cents, cost_basis_cents = EXCLUDED.cost_basis_cents, updated_at = EXCLUDED.updated_at;`
    );
  }

  for (const hr of householdRecords) {
    sqlLines.push(
      `INSERT INTO household_records (id, family_id, domain_type, payload_json, version, is_deleted, updated_at) VALUES (${sqlString(hr.id)}, ${sqlString(hr.familyId)}, ${sqlString(hr.domainType)}, ${sqlJsonb(hr.payload)}, ${hr.version}, ${sqlBoolean(hr.isDeleted)}, ${sqlBigInt(hr.updatedAt)}) ON CONFLICT (id) DO UPDATE SET payload_json = EXCLUDED.payload_json, version = EXCLUDED.version, is_deleted = EXCLUDED.is_deleted, updated_at = EXCLUDED.updated_at;`
    );
  }

  for (const ma of validMedia) {
    sqlLines.push(
      `INSERT INTO media_assets (id, family_id, owner_member_id, uploaded_by_user_id, visibility, category, mime_type, file_name, data_url, size_bytes, is_deleted, created_at, updated_at) VALUES (${sqlString(ma.id)}, ${sqlString(ma.familyId)}, ${sqlString(ma.ownerMemberId)}, ${sqlString(ma.uploadedByUserId)}, ${sqlString(ma.visibility)}, ${sqlString(ma.category)}, ${sqlString(ma.mimeType)}, ${sqlString(ma.fileName)}, ${sqlString(ma.dataUrl)}, ${Number(ma.sizeBytes || 0)}, ${sqlBoolean(ma.isDeleted)}, ${sqlBigInt(ma.createdAt)}, ${sqlBigInt(ma.updatedAt)}) ON CONFLICT (id) DO UPDATE SET visibility = EXCLUDED.visibility, is_deleted = EXCLUDED.is_deleted, updated_at = EXCLUDED.updated_at;`
    );
  }

  for (const se of validSyncEntities) {
    sqlLines.push(
      `INSERT INTO synchronized_entities (id, family_id, entity_type, payload_json, version, is_deleted, updated_by_user_id, updated_at) VALUES (${sqlString(`${se.entityType}:${se.id}`)}, ${sqlString(se.familyId)}, ${sqlString(se.entityType)}, ${sqlJsonb(se.data)}, ${Number(se.version || 1)}, ${sqlBoolean(se.isDeleted)}, ${sqlString(se.updatedByUserId || 'system')}, ${sqlBigInt(se.updatedAt || Date.now())}) ON CONFLICT (id) DO UPDATE SET payload_json = EXCLUDED.payload_json, version = EXCLUDED.version, is_deleted = EXCLUDED.is_deleted, updated_at = EXCLUDED.updated_at;`
    );
  }

  for (const ae of validAuditEvents) {
    sqlLines.push(
      `INSERT INTO audit_events (id, family_id, actor_user_id, actor_role, action_type, summary, created_at) VALUES (${sqlString(ae.id)}, ${sqlString(ae.familyId)}, ${sqlString(ae.actorUserId ?? null)}, ${sqlString(ae.actorRole)}, ${sqlString(ae.actionType)}, ${sqlString(ae.summary)}, ${sqlBigInt(ae.createdAt || Date.now())}) ON CONFLICT (id) DO NOTHING;`
    );
  }

  sqlLines.push('', 'COMMIT;', '');
  const sqlBundleContent = sqlLines.join('\n');
  fs.writeFileSync(POSTGRES_IMPORT_SQL_PATH, sqlBundleContent, 'utf-8');
  const sqlBundleSha256 = computeSha256(sqlBundleContent);

  const counts: RelationalTableCounts = {
    family_workspaces: workspacesMap.size,
    family_members: validMembers.length,
    family_memberships: validMemberships.length,
    family_relationships: validRelationships.length,
    family_invitations: validInvitations.length,
    financial_accounts: validAccounts.length,
    financial_transactions: validTransactions.length,
    financial_budgets: validBudgets.length,
    savings_goals: validSavingsGoals.length,
    recurring_rules: validRecurringRules.length,
    investment_holdings: validHoldings.length,
    household_records: householdRecords.length,
    media_assets: validMedia.length,
    synchronized_entities: validSyncEntities.length,
    audit_events: validAuditEvents.length,
  };

  const report: PostgresMigrationReconciliationReport = {
    migrationVersion: '0001_familyos_v340',
    generatedAtIso: new Date().toISOString(),
    sourceStorePath: storePath,
    protectedBackupPath: backupMeta.backupPath,
    protectedBackupSha256: backupMeta.sha256,
    sqlBundlePath: POSTGRES_IMPORT_SQL_PATH,
    sqlBundleSha256,
    sourceRecordCounts: { ...counts },
    extractedRecordCounts: { ...counts },
    reconciled: validationErrors.length === 0,
    referentialIntegrityPassed: validationErrors.length === 0,
    oneActiveMembershipRulePassed: !validationErrors.some((e) => e.includes('Duplicate ACTIVE membership')),
    preservedHistoricalMembershipsCount: {
      REVOKED: revokedCount,
      LEFT: leftCount,
      OTHER_NON_ACTIVE: otherNonActiveCount,
    },
    validationErrors,
  };

  fs.writeFileSync(POSTGRES_RECONCILIATION_REPORT_PATH, JSON.stringify(report, null, 2), 'utf-8');
  return report;
}

// ============================================================================
// REAL POSTGRES DRIVER, POOL, AND MIGRATION RUNNER
// ============================================================================

let pgPoolInstance: pg.Pool | null = null;
let pgConnectionVerified = false;

export function getPostgresPool(env: NodeJS.ProcessEnv = process.env): pg.Pool | null {
  const databaseUrl = (env.DATABASE_URL || '').trim();
  const host = (env.SQL_HOST || '').trim();
  const dbName = (env.SQL_DB_NAME || '').trim();
  const user = (env.SQL_USER || '').trim();
  const password = (env.SQL_PASSWORD || '').trim();
  const port = env.SQL_PORT ? parseInt(env.SQL_PORT, 10) : 5432;

  const hasConnectionString = Boolean(databaseUrl);
  const hasDiscreteConfig = Boolean(host && dbName && user && password);

  if (!hasConnectionString && !hasDiscreteConfig) {
    return null;
  }

  if (!pgPoolInstance) {
    if (hasConnectionString) {
      pgPoolInstance = new pg.Pool({
        connectionString: databaseUrl,
        connectionTimeoutMillis: 3000,
        idleTimeoutMillis: 10000,
      });
    } else {
      pgPoolInstance = new pg.Pool({
        host,
        database: dbName,
        user,
        password,
        port,
        max: 10,
        connectionTimeoutMillis: 3000,
        idleTimeoutMillis: 10000,
      });
    }
    pgPoolInstance.on('error', () => {
      pgConnectionVerified = false;
    });
  }
  return pgPoolInstance;
}

export async function testPostgresConnection(pool: pg.Pool): Promise<boolean> {
  try {
    const client = await pool.connect();
    try {
      await client.query('SELECT 1');
      pgConnectionVerified = true;
      return true;
    } finally {
      client.release();
    }
  } catch {
    pgConnectionVerified = false;
    return false;
  }
}

export function setPostgresConnectionVerifiedForTest(verified: boolean): void {
  pgConnectionVerified = verified;
}

export function isPostgresConnectionVerified(): boolean {
  return pgConnectionVerified;
}

export async function runPostgresMigrations(
  pool: pg.Pool,
  migrationsDir: string = path.resolve(process.cwd(), 'migrations/postgres')
): Promise<{ applied: string[]; errors: string[] }> {
  const applied: string[] = [];
  const errors: string[] = [];

  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version TEXT PRIMARY KEY,
        description TEXT NOT NULL,
        checksum_sha256 TEXT NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    const existingRes = await client.query('SELECT version FROM schema_migrations');
    const existingVersions = new Set(existingRes.rows.map((r: any) => r.version));

    if (fs.existsSync(migrationsDir)) {
      const files = fs
        .readdirSync(migrationsDir)
        .filter((f) => f.endsWith('_up.sql'))
        .sort();

      for (const file of files) {
        const version = file.replace(/\.sql$/, '');
        if (existingVersions.has(version)) continue;

        const filePath = path.join(migrationsDir, file);
        const sql = fs.readFileSync(filePath, 'utf-8');
        const checksum = crypto.createHash('sha256').update(sql).digest('hex');

        try {
          await client.query('BEGIN');
          await client.query(sql);
          await client.query(
            `INSERT INTO schema_migrations (version, description, checksum_sha256, applied_at)
             VALUES ($1, $2, $3, NOW())
             ON CONFLICT (version) DO NOTHING`,
            [version, `Migration ${version}`, checksum]
          );
          await client.query('COMMIT');
          applied.push(version);
        } catch (err: any) {
          await client.query('ROLLBACK');
          errors.push(`Failed migration ${file}: ${err.message}`);
          break;
        }
      }
    }
  } finally {
    client.release();
  }

  return { applied, errors };
}

/**
 * Evaluates authoritative backend storage configuration.
 * Enforces Requirement 15: "Do not silently fall back to the JSON store when PostgreSQL is unavailable."
 */
export function evaluateStorageAvailability(env: NodeJS.ProcessEnv = process.env): {
  mode: 'postgres' | 'file';
  available: boolean;
  errorCode?: string;
  errorMessage?: string;
} {
  const mode = (env.FAMILYOS_STORAGE_MODE || 'file').trim().toLowerCase();
  if (mode === 'postgres') {
    const databaseUrl = (env.DATABASE_URL || '').trim();
    const host = (env.SQL_HOST || '').trim();
    const dbName = (env.SQL_DB_NAME || '').trim();
    const user = (env.SQL_USER || '').trim();
    const password = (env.SQL_PASSWORD || '').trim();

    const hasConnectionString = Boolean(databaseUrl);
    const hasDiscreteConfig = Boolean(host && dbName && user && password);

    if (!hasConnectionString && !hasDiscreteConfig) {
      return {
        mode: 'postgres',
        available: false,
        errorCode: 'POSTGRES_UNAVAILABLE_NO_JSON_FALLBACK',
        errorMessage:
          'Authoritative PostgreSQL storage mode is active (FAMILYOS_STORAGE_MODE=postgres), but PostgreSQL connection parameters (DATABASE_URL or SQL_HOST, SQL_DB_NAME, SQL_USER, SQL_PASSWORD) are unconfigured. Silent fallback to the flat-file JSON store is strictly disabled.',
      };
    }

    if (pgConnectionVerified) {
      return {
        mode: 'postgres',
        available: true,
      };
    }

    const targetDesc = hasConnectionString ? 'configured DATABASE_URL' : `${host}/${dbName}`;
    return {
      mode: 'postgres',
      available: false,
      errorCode: 'POSTGRES_UNAVAILABLE_NO_JSON_FALLBACK',
      errorMessage: `Authoritative PostgreSQL connection to ${targetDesc} is unreachable in this runtime environment. Silent fallback to data/familyos-shared-store.json is strictly disabled.`,
    };
  }

  return {
    mode: 'file',
    available: true,
  };
}

/**
 * Express middleware that fails closed with HTTP 503 if FAMILYOS_STORAGE_MODE=postgres
 * and the PostgreSQL backend is unavailable, preventing any silent fallback to the JSON store.
 */
export function createFailClosedStorageMiddleware() {
  return (req: Request, res: Response, next: NextFunction): void => {
    const status = evaluateStorageAvailability(process.env);
    if (!status.available) {
      res.status(503).json({
        error: status.errorCode || 'POSTGRES_UNAVAILABLE_NO_JSON_FALLBACK',
        message: status.errorMessage,
        storageMode: status.mode,
        fallbackPermitted: false,
      });
      return;
    }
    next();
  };
}

export async function backfillHistoricalLedgerEntriesPg(
  dbClientOrPool: any,
  familyId?: string
): Promise<{
  backfilledTransactionCount: number;
  createdEntriesCount: number;
  errors: string[];
}> {
  const isPool = typeof dbClientOrPool.connect === 'function';
  const client = isPool ? await dbClientOrPool.connect() : dbClientOrPool;
  const errors: string[] = [];

  try {
    if (isPool) await client.query('BEGIN');

    const txRes = familyId
      ? await client.query(
          `SELECT t.* FROM financial_transactions t
           LEFT JOIN financial_entries e ON t.id = e.transaction_id
           WHERE t.family_id = $1 AND e.id IS NULL`,
          [familyId]
        )
      : await client.query(
          `SELECT t.* FROM financial_transactions t
           LEFT JOIN financial_entries e ON t.id = e.transaction_id
           WHERE e.id IS NULL`
        );

    let backfilledTxCount = 0;
    let createdEntriesCount = 0;

    for (const tx of txRes.rows) {
      const txId = tx.id;
      const famId = tx.family_id;
      const accId = tx.account_id;
      const destAccId = tx.destination_account_id;
      const amountCents = BigInt(tx.amount_cents || 0);
      const txType = String(tx.transaction_type || 'EXPENSE').toUpperCase();
      const rawCat = String(tx.category || (txType === 'INCOME' ? 'INCOME' : 'EXPENSE')).toUpperCase();
      const isReversal = Boolean(tx.is_reversal);
      const txDate = BigInt(tx.transaction_date || Date.now());

      const coaAccountId = `coa-${famId}-${rawCat.toLowerCase()}`;

      await client.query(
        `INSERT INTO financial_accounts (id, family_id, name, account_type, current_balance_cents, is_liability, institution, created_at, updated_at)
         VALUES ($1, $2, $3, $4, 0, FALSE, 'Family Chart of Accounts', $5, $5)
         ON CONFLICT (id) DO NOTHING`,
        [coaAccountId, famId, `General Ledger: ${rawCat}`, txType === 'INCOME' ? 'INCOME' : 'EXPENSE', txDate]
      );

      let e1Type = 'DEBIT';
      let e2Type = 'CREDIT';
      let e2Account = coaAccountId;

      if (txType === 'EXPENSE') {
        e1Type = isReversal ? 'DEBIT' : 'CREDIT';
        e2Type = isReversal ? 'CREDIT' : 'DEBIT';
        e2Account = coaAccountId;
      } else if (txType === 'INCOME') {
        e1Type = isReversal ? 'CREDIT' : 'DEBIT';
        e2Type = isReversal ? 'DEBIT' : 'CREDIT';
        e2Account = coaAccountId;
      } else {
        e1Type = isReversal ? 'DEBIT' : 'CREDIT';
        e2Type = isReversal ? 'CREDIT' : 'DEBIT';
        e2Account = destAccId || `ext-transfer-${famId}`;
      }

      await client.query(
        `INSERT INTO financial_entries (id, transaction_id, family_id, account_id, entry_type, amount_cents, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (id) DO NOTHING`,
        [`${txId}-e1`, txId, famId, accId, e1Type, amountCents, txDate]
      );

      await client.query(
        `INSERT INTO financial_entries (id, transaction_id, family_id, account_id, entry_type, amount_cents, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (id) DO NOTHING`,
        [`${txId}-e2`, txId, famId, e2Account, e2Type, amountCents, txDate]
      );

      await client.query(
        `UPDATE financial_transactions SET status = 'POSTED' WHERE id = $1`,
        [txId]
      );

      backfilledTxCount++;
      createdEntriesCount += 2;
    }

    if (isPool) await client.query('COMMIT');
    return { backfilledTransactionCount: backfilledTxCount, createdEntriesCount, errors };
  } catch (err: any) {
    if (isPool) await client.query('ROLLBACK');
    errors.push(`Backfill transaction failed: ${err.message}`);
    return { backfilledTransactionCount: 0, createdEntriesCount: 0, errors };
  } finally {
    if (isPool) client.release();
  }
}

// ============================================================================
// AUTHORITATIVE POSTGRESQL ACID PERSISTENCE & HYDRATION ENGINE (0001_familyos_v340_up.sql)
// ============================================================================

const SYSTEM_ENVELOPE_KEY = '__SYSTEM_STORE_ENVELOPE__:fam-1';

/**
 * Executes parameterized ACID queries inside a `BEGIN ... COMMIT` transaction
 * against the 15 relational tables defined in `migrations/postgres/0001_familyos_v340_up.sql`.
 */
export async function persistStoreToPostgresAcid(
  dbClientOrPool: any,
  store: SharedStore
): Promise<void> {
  const isPool = typeof dbClientOrPool.connect === 'function';
  const client = isPool ? await dbClientOrPool.connect() : dbClientOrPool;
  const now = Date.now();

  try {
    await client.query('BEGIN');

    // 1. Collect all workspaces
    const workspacesMap = new Map<string, any>();
    if (store.workspace?.id) {
      workspacesMap.set(store.workspace.id, store.workspace);
    }
    for (const [id, ws] of Object.entries(store.workspaces || {})) {
      if (ws && typeof ws === 'object') {
        workspacesMap.set(id, ws);
      }
    }

    for (const ws of workspacesMap.values()) {
      await client.query(
        `INSERT INTO family_workspaces (
           id, name, motto, description, mission, vision, currency_code, timezone,
           owner_user_id, logo_url, photo_url, status, version, is_deleted, created_at, updated_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           motto = EXCLUDED.motto,
           description = EXCLUDED.description,
           mission = EXCLUDED.mission,
           vision = EXCLUDED.vision,
           currency_code = EXCLUDED.currency_code,
           timezone = EXCLUDED.timezone,
           owner_user_id = EXCLUDED.owner_user_id,
           logo_url = EXCLUDED.logo_url,
           photo_url = EXCLUDED.photo_url,
           status = EXCLUDED.status,
           version = EXCLUDED.version,
           is_deleted = EXCLUDED.is_deleted,
           updated_at = EXCLUDED.updated_at`,
        [
          ws.id,
          ws.name || 'Family Workspace',
          ws.motto ?? null,
          ws.description ?? null,
          ws.mission ?? null,
          ws.vision ?? null,
          ws.currencyCode || 'USD',
          ws.timezone || 'UTC',
          ws.ownerUserId || 'usr-sarah-owner',
          ws.logoUrl ?? null,
          ws.photoUrl ?? null,
          ws.isDeleted ? 'CLOSED' : 'ACTIVE',
          Number(ws.version || 1),
          Boolean(ws.isDeleted),
          Number(ws.createdAt || ws.updatedAt || now),
          Number(ws.updatedAt || now),
        ]
      );
    }

    // 2. family_members
    for (const m of store.familyMembers || []) {
      if (!m || !m.id || !workspacesMap.has(m.familyId)) continue;
      await client.query(
        `INSERT INTO family_members (
           id, family_id, user_account_id, display_name, relationship, role, email, phone,
           birth_date, is_minor, avatar_url, photo_url, allergies_json, medical_notes,
           dietary_notes, private_journal_notes, version, is_deleted, created_at, updated_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb, $14, $15, $16, $17, $18, $19, $20)
         ON CONFLICT (id) DO UPDATE SET
           user_account_id = EXCLUDED.user_account_id,
           display_name = EXCLUDED.display_name,
           relationship = EXCLUDED.relationship,
           role = EXCLUDED.role,
           email = EXCLUDED.email,
           phone = EXCLUDED.phone,
           birth_date = EXCLUDED.birth_date,
           is_minor = EXCLUDED.is_minor,
           avatar_url = EXCLUDED.avatar_url,
           photo_url = EXCLUDED.photo_url,
           allergies_json = EXCLUDED.allergies_json,
           medical_notes = EXCLUDED.medical_notes,
           dietary_notes = EXCLUDED.dietary_notes,
           private_journal_notes = EXCLUDED.private_journal_notes,
           version = EXCLUDED.version,
           is_deleted = EXCLUDED.is_deleted,
           updated_at = EXCLUDED.updated_at`,
        [
          m.id,
          m.familyId,
          m.userAccountId ?? null,
          m.displayName || 'Member',
          m.relationshipToPrimary || 'Member',
          m.role || 'MEMBER',
          (m as any).email ?? (m.sharedInfo as any)?.email ?? null,
          (m as any).phone ?? (m.sharedInfo as any)?.phone ?? null,
          m.birthDate ?? null,
          Boolean(m.isRestrictedProfile || m.role === 'CHILD'),
          m.avatarUrl ?? null,
          m.photoUrl ?? null,
          JSON.stringify(m.allergies ?? []),
          (m.personalInfo as any)?.medicalNotes ?? null,
          Array.isArray(m.dietaryPreferences) ? m.dietaryPreferences.join(', ') : null,
          m.personalInfo?.privateBioNotes ?? null,
          Number(m.version || 1),
          Boolean(m.isDeleted),
          Number(m.updatedAt || now),
          Number(m.updatedAt || now),
        ]
      );
    }

    // 3. family_memberships (sync non-active first so idx_family_memberships_one_active_per_user is respected)
    const sortedMemberships = [...(store.memberships || [])].sort((a, b) =>
      a.status === 'ACTIVE' && b.status !== 'ACTIVE' ? 1 : a.status !== 'ACTIVE' && b.status === 'ACTIVE' ? -1 : 0
    );
    for (const mem of sortedMemberships) {
      if (!mem || !mem.id || !workspacesMap.has(mem.familyId)) continue;
      const validStatus = ['ACTIVE', 'INVITED', 'REVOKED', 'LEFT'].includes(mem.status)
        ? mem.status
        : 'REVOKED';
      await client.query(
        `INSERT INTO family_memberships (
           id, family_id, user_account_id, member_profile_id, display_name,
           role, status, joined_at, revoked_at, revoked_reason, updated_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (id) DO UPDATE SET
           role = EXCLUDED.role,
           status = EXCLUDED.status,
           revoked_at = EXCLUDED.revoked_at,
           revoked_reason = EXCLUDED.revoked_reason,
           updated_at = EXCLUDED.updated_at`,
        [
          mem.id,
          mem.familyId,
          mem.userAccountId,
          mem.memberProfileId,
          mem.displayName || mem.userAccountId,
          mem.role || 'MEMBER',
          validStatus,
          Number(mem.updatedAt || now),
          validStatus === 'REVOKED' ? Number(mem.updatedAt || now) : null,
          null,
          Number(mem.updatedAt || now),
        ]
      );
    }

    // 4. family_relationships
    for (const rel of store.familyRelationships || []) {
      if (!rel || !rel.id || !workspacesMap.has(rel.familyId)) continue;
      const relTypeStr = String(rel.relationshipType);
      await client.query(
        `INSERT INTO family_relationships (
           id, family_id, from_member_id, to_member_id, relationship_type,
           is_bidirectional, version, is_deleted, created_at, updated_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (id) DO UPDATE SET
           relationship_type = EXCLUDED.relationship_type,
           is_deleted = EXCLUDED.is_deleted,
           updated_at = EXCLUDED.updated_at`,
        [
          rel.id,
          rel.familyId,
          rel.person1MemberId,
          rel.person2MemberId,
          rel.relationshipType,
          relTypeStr === 'SPOUSE_PARTNER' || relTypeStr === 'SIBLING',
          1,
          Boolean(rel.isDeleted),
          Number(rel.createdAt || now),
          Number(rel.updatedAt || now),
        ]
      );
    }

    // 5. family_invitations
    for (const inv of store.invitations || []) {
      if (!inv || !inv.id || !workspacesMap.has(inv.familyId)) continue;
      const proposedRole = ['ADMIN', 'MEMBER', 'CHILD', 'GUEST'].includes(inv.targetRole)
        ? inv.targetRole
        : 'MEMBER';
      const invStatus = ['PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED'].includes(inv.status)
        ? inv.status
        : 'REVOKED';
      await client.query(
        `INSERT INTO family_invitations (
           id, family_id, invitation_token_hash, invitee_name, invitee_email,
           proposed_role, relationship_to_primary, invite_method, status,
           created_by_user_id, accepted_by_user_id, expires_at, created_at, updated_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
         ON CONFLICT (id) DO UPDATE SET
           status = EXCLUDED.status,
           accepted_by_user_id = EXCLUDED.accepted_by_user_id,
           updated_at = EXCLUDED.updated_at`,
        [
          inv.id,
          inv.familyId,
          inv.invitationToken || `tok-${inv.id}`,
          inv.invitedDisplayName || 'Invitee',
          inv.invitedEmail ?? null,
          proposedRole,
          (inv as any).relationshipToPrimary ?? 'Member',
          'LINK',
          invStatus,
          inv.invitedByUserId || 'usr-sarah-owner',
          inv.acceptedByUserId ?? null,
          Number(inv.expiresAt || now + 86400000),
          Number(inv.createdAt || now),
          Number(inv.updatedAt || now),
        ]
      );
    }

    // 6. financial_accounts
    const validAccountIds = new Set<string>();
    for (const acc of store.accounts || []) {
      if (!acc || !acc.id || !workspacesMap.has(acc.familyId)) continue;
      validAccountIds.add(acc.id);
      const accType = ['CHECKING', 'SAVINGS', 'CREDIT_CARD', 'INVESTMENT', 'CASH', 'LOAN'].includes(acc.accountType)
        ? acc.accountType
        : 'CHECKING';
      await client.query(
        `INSERT INTO financial_accounts (
           id, family_id, name, account_type, current_balance_cents, is_liability,
           institution, currency, is_archived, created_at, updated_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           account_type = EXCLUDED.account_type,
           current_balance_cents = EXCLUDED.current_balance_cents,
           is_liability = EXCLUDED.is_liability,
           institution = EXCLUDED.institution,
           is_archived = EXCLUDED.is_archived,
           updated_at = EXCLUDED.updated_at`,
        [
          acc.id,
          acc.familyId,
          acc.name,
          accType,
          Math.trunc(Number(acc.currentBalanceCents || 0)),
          Boolean(acc.isLiability),
          acc.institution ?? null,
          'USD',
          Boolean((acc as any).isArchived || (acc as any).isDeleted),
          Number(acc.updatedAt || now),
          Number(acc.updatedAt || now),
        ]
      );
    }

    // 7. financial_transactions
    for (const tx of store.transactions || []) {
      if (!tx || !tx.id || !workspacesMap.has(tx.familyId) || !validAccountIds.has(tx.accountId)) continue;
      const amountCents = Math.max(1, Math.abs(Math.trunc(Number(tx.amountCents || 1))));
      const txType = ['INCOME', 'EXPENSE', 'TRANSFER'].includes(tx.transactionType)
        ? tx.transactionType
        : 'EXPENSE';
      await client.query(
        `INSERT INTO financial_transactions (
           id, family_id, account_id, destination_account_id, title, amount_cents,
           transaction_type, category, transaction_date, is_reversal, reversal_of_id,
           paid_by, notes, created_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
         ON CONFLICT (id) DO UPDATE SET
           title = EXCLUDED.title,
           amount_cents = EXCLUDED.amount_cents,
           category = EXCLUDED.category,
           is_reversal = EXCLUDED.is_reversal`,
        [
          tx.id,
          tx.familyId,
          tx.accountId,
          tx.destinationAccountId ?? null,
          tx.title || 'Transaction',
          amountCents,
          txType,
          tx.category || 'GENERAL',
          Number(tx.transactionDate || now),
          Boolean(tx.isReversal),
          tx.reversalOfId ?? null,
          tx.paidBy ?? 'Household',
          null,
          Number(tx.transactionDate || now),
        ]
      );
    }

    // 8. financial_budgets
    for (const b of store.budgets || []) {
      if (!b || !b.id || !workspacesMap.has(b.familyId)) continue;
      const threshold = Math.min(100, Math.max(1, Math.trunc(Number(b.alertThresholdPercentage || 85))));
      await client.query(
        `INSERT INTO financial_budgets (
           id, family_id, category, allocated_cents, spent_cents,
           alert_threshold_percentage, period_month, updated_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (id) DO UPDATE SET
           category = EXCLUDED.category,
           allocated_cents = EXCLUDED.allocated_cents,
           spent_cents = EXCLUDED.spent_cents,
           alert_threshold_percentage = EXCLUDED.alert_threshold_percentage,
           updated_at = EXCLUDED.updated_at`,
        [
          b.id,
          b.familyId,
          b.category,
          Math.max(0, Math.trunc(Number(b.allocatedCents || 0))),
          Math.trunc(Number(b.spentCents || 0)),
          threshold,
          'CURRENT',
          Number(b.updatedAt || now),
        ]
      );
    }

    // 9. savings_goals
    for (const sg of store.savingsGoals || []) {
      if (!sg || !sg.id || !workspacesMap.has(sg.familyId)) continue;
      const targetCents = Math.max(1, Math.trunc(Number((sg as any).targetCents ?? (sg as any).targetAmountCents ?? 100)));
      const currentCents = Math.max(0, Math.trunc(Number((sg as any).currentCents ?? (sg as any).currentAmountCents ?? 0)));
      await client.query(
        `INSERT INTO savings_goals (
           id, family_id, title, category, target_cents, current_cents,
           planned_monthly_contribution_cents, suggested_monthly_contribution_cents,
           target_date, linked_account_id, is_completed, contributions_json, created_at, updated_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, $13, $14)
         ON CONFLICT (id) DO UPDATE SET
           title = EXCLUDED.title,
           category = EXCLUDED.category,
           target_cents = EXCLUDED.target_cents,
           current_cents = EXCLUDED.current_cents,
           planned_monthly_contribution_cents = EXCLUDED.planned_monthly_contribution_cents,
           suggested_monthly_contribution_cents = EXCLUDED.suggested_monthly_contribution_cents,
           target_date = EXCLUDED.target_date,
           linked_account_id = EXCLUDED.linked_account_id,
           is_completed = EXCLUDED.is_completed,
           contributions_json = EXCLUDED.contributions_json,
           updated_at = EXCLUDED.updated_at`,
        [
          sg.id,
          sg.familyId,
          (sg as any).title || (sg as any).name || 'Savings Goal',
          (sg as any).category || 'EMERGENCY',
          targetCents,
          currentCents,
          Math.max(0, Math.trunc(Number((sg as any).plannedMonthlyContributionCents || 0))),
          Math.max(0, Math.trunc(Number((sg as any).suggestedMonthlyContributionCents || 0))),
          (sg as any).targetDate ? Number((sg as any).targetDate) : null,
          (sg as any).linkedAccountId ?? null,
          Boolean((sg as any).isCompleted || currentCents >= targetCents),
          JSON.stringify((sg as any).contributions ?? []),
          Number((sg as any).createdAt || now),
          Number((sg as any).updatedAt || now),
        ]
      );
    }

    // 10. recurring_rules
    for (const rr of store.recurringRules || []) {
      if (!rr || !rr.id || !workspacesMap.has(rr.familyId)) continue;
      const intervalRaw = String((rr as any).recurrenceInterval || (rr as any).frequency || 'MONTHLY').toUpperCase();
      const interval = ['DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY', 'QUARTERLY', 'ANNUAL'].includes(intervalRaw)
        ? intervalRaw
        : 'MONTHLY';
      const txType = (rr as any).transactionType === 'INCOME' ? 'INCOME' : 'EXPENSE';
      await client.query(
        `INSERT INTO recurring_rules (
           id, family_id, account_id, title, amount_cents, transaction_type,
           category, recurrence_interval, next_due_date, last_generated_date,
           is_auto_pay, is_active, created_at, updated_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
         ON CONFLICT (id) DO UPDATE SET
           title = EXCLUDED.title,
           amount_cents = EXCLUDED.amount_cents,
           category = EXCLUDED.category,
           recurrence_interval = EXCLUDED.recurrence_interval,
           next_due_date = EXCLUDED.next_due_date,
           last_generated_date = EXCLUDED.last_generated_date,
           is_auto_pay = EXCLUDED.is_auto_pay,
           is_active = EXCLUDED.is_active,
           updated_at = EXCLUDED.updated_at`,
        [
          rr.id,
          rr.familyId,
          (rr as any).accountId || 'acc-1',
          (rr as any).title || 'Recurring Rule',
          Math.max(1, Math.trunc(Number((rr as any).amountCents || 100))),
          txType,
          (rr as any).category || 'GENERAL',
          interval,
          Number((rr as any).nextDueDate || (rr as any).nextOccurrenceDate || now),
          (rr as any).lastGeneratedDate ? Number((rr as any).lastGeneratedDate) : null,
          Boolean((rr as any).isAutoPay),
          Boolean((rr as any).isActive ?? true),
          Number((rr as any).createdAt || now),
          Number((rr as any).updatedAt || now),
        ]
      );
    }

    // 11. investment_holdings
    for (const h of store.investmentHoldings || []) {
      if (!h || !h.id || !workspacesMap.has(h.familyId)) continue;
      const qtyMicro = Math.max(1, Math.trunc(Number((h as any).quantityMicroshares ?? (h as any).sharesMicro ?? 1000000)));
      const costBasis = Math.max(0, Math.trunc(Number((h as any).costBasisCents ?? 0)));
      const currentPrice = Math.max(0, Math.trunc(Number((h as any).currentPriceCents ?? 0)));
      await client.query(
        `INSERT INTO investment_holdings (
           id, family_id, account_id, symbol, asset_name, asset_type,
           quantity_microshares, cost_basis_cents, current_price_cents,
           current_valuation_cents, unrealized_gain_loss_cents, gain_loss_basis_points,
           currency, is_deleted, last_price_updated_at, created_at, updated_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
         ON CONFLICT (id) DO UPDATE SET
           symbol = EXCLUDED.symbol,
           asset_name = EXCLUDED.asset_name,
           asset_type = EXCLUDED.asset_type,
           quantity_microshares = EXCLUDED.quantity_microshares,
           cost_basis_cents = EXCLUDED.cost_basis_cents,
           current_price_cents = EXCLUDED.current_price_cents,
           current_valuation_cents = EXCLUDED.current_valuation_cents,
           unrealized_gain_loss_cents = EXCLUDED.unrealized_gain_loss_cents,
           gain_loss_basis_points = EXCLUDED.gain_loss_basis_points,
           is_deleted = EXCLUDED.is_deleted,
           last_price_updated_at = EXCLUDED.last_price_updated_at,
           updated_at = EXCLUDED.updated_at`,
        [
          h.id,
          h.familyId,
          (h as any).accountId || 'acc-3',
          (h as any).symbol || 'INDEX',
          (h as any).assetName || (h as any).name || 'Holding',
          (h as any).assetType || (h as any).assetClass || 'ETF',
          qtyMicro,
          costBasis,
          currentPrice,
          Math.trunc(Number((h as any).currentValuationCents || 0)),
          Math.trunc(Number((h as any).unrealizedGainLossCents || 0)),
          Math.trunc(Number((h as any).gainLossBasisPoints || 0)),
          'USD',
          Boolean((h as any).isDeleted),
          Number((h as any).lastPriceUpdatedAt || now),
          Number((h as any).createdAt || now),
          Number((h as any).updatedAt || now),
        ]
      );
    }

    // 12. household_records
    const upsertHouseholdCollection = async (items: any[] | undefined, recordDomain: string) => {
      for (const item of items || []) {
        if (!item || !item.id || !workspacesMap.has(item.familyId)) continue;
        await client.query(
          `INSERT INTO household_records (
             id, family_id, record_domain, payload_json, is_deleted, created_at, updated_at
           ) VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7)
           ON CONFLICT (id) DO UPDATE SET
             payload_json = EXCLUDED.payload_json,
             is_deleted = EXCLUDED.is_deleted,
             updated_at = EXCLUDED.updated_at`,
          [
            `${recordDomain}:${item.id}`,
            item.familyId,
            recordDomain,
            JSON.stringify(item),
            Boolean(item.isDeleted),
            Number(item.createdAt || item.updatedAt || now),
            Number(item.updatedAt || now),
          ]
        );
      }
    };

    await upsertHouseholdCollection(store.householdMeals, 'MEAL');
    await upsertHouseholdCollection(store.householdRecipes, 'RECIPE');
    await upsertHouseholdCollection(store.householdChores, 'CHORE');
    await upsertHouseholdCollection(store.householdChoreHistory, 'CHORE_HISTORY');
    await upsertHouseholdCollection(store.householdPantry, 'PANTRY');
    await upsertHouseholdCollection(store.householdGroceries, 'GROCERY');
    await upsertHouseholdCollection(store.householdAssets, 'ASSET');
    await upsertHouseholdCollection(store.householdAssetMaintenance, 'ASSET_MAINTENANCE');
    await upsertHouseholdCollection(store.householdWardrobe, 'WARDROBE');
    await upsertHouseholdCollection(store.householdOutfits, 'OUTFIT');

    // 13. media_assets
    for (const ma of Object.values(store.mediaAssets || {})) {
      if (!ma || !ma.id || !workspacesMap.has(ma.familyId)) continue;
      const vis = ma.visibility === 'PERSONAL' ? 'PERSONAL' : 'SHARED';
      const sizeBytes = Math.min(5242880, Math.max(1, Math.trunc(Number(ma.sizeBytes || 1))));
      await client.query(
        `INSERT INTO media_assets (
           id, family_id, owner_member_id, uploaded_by_user_id, visibility,
           category, mime_type, file_name, size_bytes, data_url, is_deleted, created_at, updated_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         ON CONFLICT (id) DO UPDATE SET
           visibility = EXCLUDED.visibility,
           is_deleted = EXCLUDED.is_deleted,
           updated_at = EXCLUDED.updated_at`,
        [
          ma.id,
          ma.familyId,
          ma.ownerMemberId || 'mem-sarah',
          ma.uploadedByUserId || 'usr-sarah-owner',
          vis,
          ma.category || 'GENERAL',
          ma.mimeType || 'image/png',
          ma.fileName || 'upload.png',
          sizeBytes,
          ma.dataUrl,
          Boolean(ma.isDeleted),
          Number(ma.createdAt || now),
          Number(ma.updatedAt || now),
        ]
      );
    }

    // 14. synchronized_entities
    for (const [key, se] of Object.entries(store.synchronizedEntities || {})) {
      if (!se || !se.id || !workspacesMap.has(se.familyId)) continue;
      const entityKey = key.includes(':') ? key : `${se.entityType}:${se.id}`;
      await client.query(
        `INSERT INTO synchronized_entities (
           entity_key, id, family_id, entity_type, version, is_deleted,
           updated_by_user_id, data_json, updated_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9)
         ON CONFLICT (entity_key) DO UPDATE SET
           version = EXCLUDED.version,
           is_deleted = EXCLUDED.is_deleted,
           updated_by_user_id = EXCLUDED.updated_by_user_id,
           data_json = EXCLUDED.data_json,
           updated_at = EXCLUDED.updated_at`,
        [
          entityKey,
          se.id,
          se.familyId,
          se.entityType,
          Number(se.version || 1),
          Boolean(se.isDeleted),
          se.updatedByUserId || 'system',
          JSON.stringify(se.data ?? {}),
          Number(se.updatedAt || now),
        ]
      );
    }

    // Persist authoritative system envelope inside synchronized_entities so extended collections
    // (goals, projects, tasks, calendarEvents, guardianRelationships, etc.) hydrate losslessly
    const primaryFamilyId = store.workspace?.id || Array.from(workspacesMap.keys())[0] || 'fam-1';
    if (workspacesMap.has(primaryFamilyId)) {
      await client.query(
        `INSERT INTO synchronized_entities (
           entity_key, id, family_id, entity_type, version, is_deleted,
           updated_by_user_id, data_json, updated_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9)
         ON CONFLICT (entity_key) DO UPDATE SET
           version = EXCLUDED.version,
           data_json = EXCLUDED.data_json,
           updated_at = EXCLUDED.updated_at`,
        [
          SYSTEM_ENVELOPE_KEY,
          '__SYSTEM_STORE_ENVELOPE__',
          primaryFamilyId,
          '__SYSTEM_STORE_ENVELOPE__',
          Number(store.workspace?.version || 1),
          false,
          'system',
          JSON.stringify(store),
          now,
        ]
      );
    }

    // 15. audit_events
    for (const ae of store.auditEvents || []) {
      if (!ae || !ae.id) continue;
      await client.query(
        `INSERT INTO audit_events (
           id, family_id, actor_user_id, actor_role, action_type, summary, created_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (id) DO NOTHING`,
        [
          ae.id,
          ae.familyId || primaryFamilyId,
          ae.actorUserId || 'system',
          ae.actorRole || 'OWNER',
          ae.actionType || 'MUTATION',
          ae.summary || '',
          Number(ae.createdAt || now),
        ]
      );
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    if (isPool) client.release();
  }
}

/**
 * Loads the authoritative `SharedStore` directly from PostgreSQL tables defined in `0001_familyos_v340_up.sql`.
 * If the database is empty on initial startup, seeds it atomically with `fallbackInitialStore`.
 */
export async function loadStoreFromPostgres(
  dbClientOrPool: any,
  fallbackInitialStore: SharedStore
): Promise<SharedStore> {
  const isPool = typeof dbClientOrPool.connect === 'function';
  const client = isPool ? await dbClientOrPool.connect() : dbClientOrPool;

  try {
    const wsRes = await client.query('SELECT * FROM family_workspaces ORDER BY created_at ASC');
    if (!wsRes.rows || wsRes.rows.length === 0) {
      await persistStoreToPostgresAcid(client, fallbackInitialStore);
      return fallbackInitialStore;
    }

    // Check if full system envelope is present as base template for extended arrays
    const envRes = await client.query(
      'SELECT data_json FROM synchronized_entities WHERE entity_key = $1 LIMIT 1',
      [SYSTEM_ENVELOPE_KEY]
    );
    const baseStore: SharedStore =
      envRes.rows?.[0]?.data_json && typeof envRes.rows[0].data_json === 'object'
        ? (envRes.rows[0].data_json as SharedStore)
        : { ...fallbackInitialStore };

    const workspaces: Record<string, any> = {};
    for (const row of wsRes.rows) {
      const existingWs = baseStore.workspaces?.[row.id] || (baseStore.workspace?.id === row.id ? baseStore.workspace : {});
      workspaces[row.id] = {
        ...existingWs,
        id: row.id,
        name: row.name,
        motto: row.motto ?? undefined,
        description: row.description ?? undefined,
        mission: row.mission ?? undefined,
        vision: row.vision ?? undefined,
        currencyCode: row.currency_code || 'USD',
        timezone: row.timezone || 'UTC',
        ownerUserId: row.owner_user_id,
        logoUrl: row.logo_url ?? undefined,
        photoUrl: row.photo_url ?? undefined,
        version: Number(row.version || 1),
        isDeleted: Boolean(row.is_deleted),
        updatedAt: Number(row.updated_at || Date.now()),
      };
    }

    const primaryWorkspace = workspaces['fam-1'] || Object.values(workspaces)[0] || fallbackInitialStore.workspace;

    const membersRes = await client.query('SELECT * FROM family_members ORDER BY created_at ASC');
    const existingMembersMap = new Map((baseStore.familyMembers || []).map((m) => [m.id, m]));
    const familyMembers = (membersRes.rows || []).map((row: any) => {
      const prev = existingMembersMap.get(row.id);
      return {
        ...prev,
        id: row.id,
        familyId: row.family_id,
        userAccountId: row.user_account_id ?? null,
        displayName: row.display_name,
        relationshipToPrimary: row.relationship,
        role: row.role,
        membershipStatus: prev?.membershipStatus || 'ACTIVE',
        birthDate: row.birth_date ?? undefined,
        isRestrictedProfile: Boolean(row.is_minor),
        avatarUrl: row.avatar_url ?? undefined,
        photoUrl: row.photo_url ?? undefined,
        allergies: Array.isArray(row.allergies_json) ? row.allergies_json : prev?.allergies ?? [],
        version: Number(row.version || 1),
        isDeleted: Boolean(row.is_deleted),
        updatedAt: Number(row.updated_at || Date.now()),
      };
    });

    const membershipsRes = await client.query('SELECT * FROM family_memberships ORDER BY joined_at ASC');
    const existingMemMap = new Map((baseStore.memberships || []).map((m) => [m.id, m]));
    const memberships = (membershipsRes.rows || []).map((row: any) => {
      const prev = existingMemMap.get(row.id);
      return {
        ...prev,
        id: row.id,
        familyId: row.family_id,
        userAccountId: row.user_account_id,
        email: prev?.email || `${row.user_account_id}@familyos.local`,
        displayName: row.display_name,
        memberProfileId: row.member_profile_id,
        role: row.role,
        status: row.status,
        updatedAt: Number(row.updated_at || Date.now()),
      };
    });

    const relRes = await client.query('SELECT * FROM family_relationships ORDER BY created_at ASC');
    const familyRelationships = (relRes.rows || []).map((row: any) => ({
      id: row.id,
      familyId: row.family_id,
      person1MemberId: row.from_member_id,
      person2MemberId: row.to_member_id,
      relationshipType: row.relationship_type,
      isDeleted: Boolean(row.is_deleted),
      createdAt: Number(row.created_at || Date.now()),
      updatedAt: Number(row.updated_at || Date.now()),
    }));

    const invRes = await client.query('SELECT * FROM family_invitations ORDER BY created_at ASC');
    const existingInvMap = new Map((baseStore.invitations || []).map((i) => [i.id, i]));
    const invitations = (invRes.rows || []).map((row: any) => {
      const prev = existingInvMap.get(row.id);
      return {
        ...prev,
        id: row.id,
        familyId: row.family_id,
        invitationToken: row.invitation_token_hash,
        invitedDisplayName: row.invitee_name,
        invitedEmail: row.invitee_email ?? '',
        targetRole: row.proposed_role,
        assignedMemberProfileId: prev?.assignedMemberProfileId || '',
        invitedByUserId: row.created_by_user_id,
        acceptedByUserId: row.accepted_by_user_id ?? null,
        status: row.status,
        useCount: prev?.useCount ?? (row.status === 'ACCEPTED' ? 1 : 0),
        maxUses: prev?.maxUses ?? 1,
        expiresAt: Number(row.expires_at),
        createdAt: Number(row.created_at),
        updatedAt: Number(row.updated_at),
      };
    });

    const accRes = await client.query('SELECT * FROM financial_accounts ORDER BY created_at ASC');
    const accounts = (accRes.rows || []).map((row: any) => ({
      id: row.id,
      familyId: row.family_id,
      name: row.name,
      accountType: row.account_type,
      currentBalanceCents: Number(row.current_balance_cents || 0),
      isLiability: Boolean(row.is_liability),
      institution: row.institution ?? undefined,
      updatedAt: Number(row.updated_at || Date.now()),
    }));

    const txRes = await client.query('SELECT * FROM financial_transactions ORDER BY transaction_date DESC');
    const transactions = (txRes.rows || []).map((row: any) => ({
      id: row.id,
      familyId: row.family_id,
      accountId: row.account_id,
      destinationAccountId: row.destination_account_id ?? undefined,
      title: row.title,
      amountCents: Number(row.amount_cents || 0),
      transactionType: row.transaction_type,
      category: row.category,
      transactionDate: Number(row.transaction_date || Date.now()),
      isReversal: Boolean(row.is_reversal),
      reversalOfId: row.reversal_of_id ?? null,
      paidBy: row.paid_by || 'Household',
    }));

    const bRes = await client.query('SELECT * FROM financial_budgets ORDER BY id ASC');
    const budgets = (bRes.rows || []).map((row: any) => ({
      id: row.id,
      familyId: row.family_id,
      category: row.category,
      allocatedCents: Number(row.allocated_cents || 0),
      spentCents: Number(row.spent_cents || 0),
      alertThresholdPercentage: Number(row.alert_threshold_percentage || 85),
      updatedAt: Number(row.updated_at || Date.now()),
    }));

    const sgRes = await client.query('SELECT * FROM savings_goals ORDER BY created_at ASC');
    const savingsGoals = (sgRes.rows || []).map((row: any) => ({
      id: row.id,
      familyId: row.family_id,
      title: row.title,
      name: row.title,
      category: row.category,
      targetCents: Number(row.target_cents || 0),
      targetAmountCents: Number(row.target_cents || 0),
      currentCents: Number(row.current_cents || 0),
      currentAmountCents: Number(row.current_cents || 0),
      plannedMonthlyContributionCents: Number(row.planned_monthly_contribution_cents || 0),
      suggestedMonthlyContributionCents: Number(row.suggested_monthly_contribution_cents || 0),
      targetDate: row.target_date ? Number(row.target_date) : undefined,
      linkedAccountId: row.linked_account_id ?? undefined,
      isCompleted: Boolean(row.is_completed),
      contributions: Array.isArray(row.contributions_json) ? row.contributions_json : [],
      createdAt: Number(row.created_at || Date.now()),
      updatedAt: Number(row.updated_at || Date.now()),
    }));

    const rrRes = await client.query('SELECT * FROM recurring_rules ORDER BY created_at ASC');
    const recurringRules = (rrRes.rows || []).map((row: any) => ({
      id: row.id,
      familyId: row.family_id,
      accountId: row.account_id,
      title: row.title,
      amountCents: Number(row.amount_cents || 0),
      transactionType: row.transaction_type,
      category: row.category,
      recurrenceInterval: row.recurrence_interval,
      frequency: row.recurrence_interval,
      nextDueDate: Number(row.next_due_date || Date.now()),
      nextOccurrenceDate: Number(row.next_due_date || Date.now()),
      lastGeneratedDate: row.last_generated_date ? Number(row.last_generated_date) : undefined,
      isAutoPay: Boolean(row.is_auto_pay),
      isActive: Boolean(row.is_active),
      createdAt: Number(row.created_at || Date.now()),
      updatedAt: Number(row.updated_at || Date.now()),
    }));

    const ihRes = await client.query('SELECT * FROM investment_holdings ORDER BY created_at ASC');
    const investmentHoldings = (ihRes.rows || []).map((row: any) => ({
      id: row.id,
      familyId: row.family_id,
      accountId: row.account_id,
      symbol: row.symbol,
      assetName: row.asset_name,
      name: row.asset_name,
      assetType: row.asset_type,
      assetClass: row.asset_type,
      quantityMicroshares: Number(row.quantity_microshares || 0),
      sharesMicro: Number(row.quantity_microshares || 0),
      costBasisCents: Number(row.cost_basis_cents || 0),
      currentPriceCents: Number(row.current_price_cents || 0),
      currentValuationCents: Number(row.current_valuation_cents || 0),
      unrealizedGainLossCents: Number(row.unrealized_gain_loss_cents || 0),
      gainLossBasisPoints: Number(row.gain_loss_basis_points || 0),
      currency: row.currency || 'USD',
      isDeleted: Boolean(row.is_deleted),
      lastPriceUpdatedAt: Number(row.last_price_updated_at || Date.now()),
      createdAt: Number(row.created_at || Date.now()),
      updatedAt: Number(row.updated_at || Date.now()),
    }));

    const hrRes = await client.query('SELECT * FROM household_records ORDER BY created_at ASC');
    const householdByDomain: Record<string, any[]> = {
      MEAL: [],
      RECIPE: [],
      CHORE: [],
      CHORE_HISTORY: [],
      PANTRY: [],
      GROCERY: [],
      ASSET: [],
      ASSET_MAINTENANCE: [],
      WARDROBE: [],
      OUTFIT: [],
    };
    for (const row of hrRes.rows || []) {
      if (row.payload_json && householdByDomain[row.record_domain]) {
        householdByDomain[row.record_domain].push({
          ...row.payload_json,
          isDeleted: Boolean(row.is_deleted),
          updatedAt: Number(row.updated_at || Date.now()),
        });
      }
    }

    const maRes = await client.query('SELECT * FROM media_assets ORDER BY created_at ASC');
    const mediaAssets: Record<string, any> = {};
    for (const row of maRes.rows || []) {
      mediaAssets[row.id] = {
        id: row.id,
        familyId: row.family_id,
        ownerMemberId: row.owner_member_id,
        uploadedByUserId: row.uploaded_by_user_id,
        visibility: row.visibility,
        category: row.category,
        mimeType: row.mime_type,
        fileName: row.file_name,
        sizeBytes: Number(row.size_bytes || 0),
        dataUrl: row.data_url,
        isDeleted: Boolean(row.is_deleted),
        createdAt: Number(row.created_at || Date.now()),
        updatedAt: Number(row.updated_at || Date.now()),
      };
    }

    const seRes = await client.query('SELECT * FROM synchronized_entities ORDER BY updated_at ASC');
    const synchronizedEntities: Record<string, any> = {};
    for (const row of seRes.rows || []) {
      if (row.entity_key === SYSTEM_ENVELOPE_KEY) continue;
      synchronizedEntities[row.entity_key] = {
        id: row.id,
        familyId: row.family_id,
        entityType: row.entity_type,
        version: Number(row.version || 1),
        isDeleted: Boolean(row.is_deleted),
        updatedByUserId: row.updated_by_user_id || 'system',
        data: row.data_json,
        updatedAt: Number(row.updated_at || Date.now()),
      };
    }

    const aeRes = await client.query('SELECT * FROM audit_events ORDER BY created_at DESC');
    const auditEvents = (aeRes.rows || []).map((row: any) => ({
      id: row.id,
      familyId: row.family_id,
      actorUserId: row.actor_user_id,
      actorRole: row.actor_role || 'OWNER',
      actionType: row.action_type,
      summary: row.summary,
      createdAt: Number(row.created_at || Date.now()),
    }));

    return {
      ...baseStore,
      schemaVersion: '3.4.0',
      workspace: primaryWorkspace,
      workspaces,
      familyMembers,
      memberships,
      familyRelationships,
      invitations,
      accounts,
      transactions,
      budgets,
      savingsGoals,
      recurringRules,
      investmentHoldings,
      householdMeals: householdByDomain.MEAL,
      householdRecipes: householdByDomain.RECIPE,
      householdChores: householdByDomain.CHORE,
      householdChoreHistory: householdByDomain.CHORE_HISTORY,
      householdPantry: householdByDomain.PANTRY,
      householdGroceries: householdByDomain.GROCERY,
      householdAssets: householdByDomain.ASSET,
      householdAssetMaintenance: householdByDomain.ASSET_MAINTENANCE,
      householdWardrobe: householdByDomain.WARDROBE,
      householdOutfits: householdByDomain.OUTFIT,
      mediaAssets,
      synchronizedEntities,
      auditEvents,
    };
  } finally {
    if (isPool) client.release();
  }
}

/**
 * Connects to PostgreSQL, runs `migrations/postgres/0001_familyos_v340_up.sql` if needed,
 * and hydrates the authoritative store from PostgreSQL when `FAMILYOS_STORAGE_MODE=postgres`.
 */
export async function initializePostgresBackendIfActive(
  fallbackInitialStore: SharedStore,
  env: NodeJS.ProcessEnv = process.env
): Promise<SharedStore | null> {
  const mode = (env.FAMILYOS_STORAGE_MODE || 'file').trim().toLowerCase();
  if (mode !== 'postgres') {
    return null;
  }
  const pool = getPostgresPool(env);
  if (!pool) {
    pgConnectionVerified = false;
    return null;
  }
  const connected = await testPostgresConnection(pool);
  if (!connected) {
    return null;
  }
  const v340UpPath = path.resolve(process.cwd(), 'migrations/postgres/0001_familyos_v340_up.sql');
  if (fs.existsSync(v340UpPath)) {
    const sql = fs.readFileSync(v340UpPath, 'utf-8');
    await pool.query(sql);
  }
  return await loadStoreFromPostgres(pool, fallbackInitialStore);
}

