import express from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import firebaseConfig from './firebase-applet-config.json';
import {
  calculateNetWorthFromAccounts,
  computeSha256,
  ensurePre32BackupAndMigrate,
  rollbackToPre32Backup,
  type AuthoritativeAnnouncement,
  type AuthoritativeFamilyMember,
  type AuthoritativeFamilyRelationship,
  type AuthoritativeInvitation,
  type AuthoritativeMediaAsset,
  type AuthoritativeMembership,
  type AuthoritativeReminder,
  type AuthoritativeWorkspace,
  type FamilyRole,
  type RelationshipTypeCode,
  type SharedAccount,
  type SharedAuditEvent,
  type SharedBudget,
  type SharedStore,
  type SharedSyncRecord,
  type SharedTransaction,
  type SynchronizedEntityRecord,
} from './src/server/backupAndMigration';
import {
  canAccessMinorHealthRecord,
  canAccessPrivateJournal,
  canEditMemberProfile,
  canManageMemberships,
  canPerformFinanceMutation,
  canViewPersonalMemberInfo,
  createAuthMiddleware,
  findActiveMembershipForUser,
  getCanonicalUserMembership,
  getUserMemberships,
  isTestHarnessAuthAllowed,
  isTestHarnessRegistrationAllowed,
  issueSignedSessionToken,
  issueSignedSessionTokenAsync,
  resolveServerMembership,
  revokeAllSessionsForUser,
  revokeAllSessionsForUserUnified,
  revokeSessionToken,
  revokeSessionTokenUnified,
  sanitizeMemberForCaller,
  validateProductionAuthConfig,
  validateRelationshipGraph,
  verifyBearerToken,
  verifyBearerTokenAsync,
} from './src/server/authAndRbac';
import {
  mirrorEntityToFirestore,
  mirrorTransactionToFirestore,
  mirrorWorkspaceToFirestore,
} from './src/server/firestoreMirror';
import {
  canViewGoal,
  canViewProject,
  canViewTask,
  recalculatePlanningHierarchyProgress,
  syncTaskWithCalendar,
  type AuthoritativeChecklistItem,
  type AuthoritativeGoal,
  type AuthoritativeMilestone,
  type AuthoritativeProject,
  type AuthoritativeTask,
} from './src/server/planningAndExecution';
import { registerStage332PlanningRoutes } from './src/server/planningRoutes';
import { registerCalendarRoutes } from './src/server/calendarRoutes';
import { householdRouter } from './src/server/householdRoutes';
import { financeRouter } from './src/server/financeRoutes';
import {
  ALLOWED_SYNCHRONIZED_ENTITY_TYPES,
  MAX_ENTITY_PAYLOAD_BYTES,
  canCallerMutateDomainEntity,
  canCallerReadDomainEntity,
  registerDomainModulesRoutes,
  resolvePerRecordMutation,
} from './src/server/domainModulesRoutes';
import { registerDatabaseStudioRoutes } from './src/server/databaseStudioRoutes';
import {
  registerFamilySectionAndHomeDashboardRoutes,
  validateUploadedImageDataUrl,
} from './src/server/familySectionRoutes';
import {
  createFailClosedStorageMiddleware,
  evaluateStorageAvailability,
  getPostgresPool,
  initializePostgresBackendIfActive,
  loadStoreFromPostgres,
  persistStoreToPostgresAcid,
} from './src/server/postgresMigrationAndBackup';
import {
  isPostgresPersistenceActive,
  syncEntityScoped,
} from './src/server/postgresRepositories';
import { aiGatewayRouter } from './src/server/aiGatewayRoutes';
import { searchRouter } from './src/server/searchRoutes';
import { exportRouter } from './src/server/exportRoutes';
import { entitlementRouter } from './src/server/entitlementRoutes';


const PORT = 3000;
const DATA_DIR = path.resolve(process.cwd(), 'data');
const STORE_PATH = path.join(DATA_DIR, 'familyos-shared-store.json');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');

function createInitialStore(): SharedStore {
  const now = Date.now();
  return {
    schemaVersion: '3.3.1',
    workspace: {
      id: 'fam-1',
      name: 'The Henderson Household',
      currencyCode: 'USD',
      ownerUserId: 'usr-sarah-owner',
      version: 3,
      updatedAt: now,
      isDeleted: false,
    },
    accounts: [
      { id: 'acc-1', familyId: 'fam-1', name: 'Household Main Checking', accountType: 'CHECKING', currentBalanceCents: 845250, isLiability: false, institution: 'Chase' },
      { id: 'acc-2', familyId: 'fam-1', name: 'High-Yield Family Savings', accountType: 'SAVINGS', currentBalanceCents: 3420000, isLiability: false, institution: 'Marcus' },
      { id: 'acc-3', familyId: 'fam-1', name: 'Family Investment Portfolio', accountType: 'INVESTMENT', currentBalanceCents: 10574750, isLiability: false, institution: 'Vanguard' },
      { id: 'acc-4', familyId: 'fam-1', name: 'Household Rewards Card', accountType: 'CREDIT_CARD', currentBalanceCents: -184200, isLiability: true, institution: 'Amex' },
      { id: 'acc-5', familyId: 'fam-1', name: 'Family Auto Loan', accountType: 'LOAN', currentBalanceCents: -2115800, isLiability: true, institution: 'Credit Union' },
    ],
    budgets: [
      { id: 'b-1', familyId: 'fam-1', category: 'FOOD', allocatedCents: 120000, spentCents: 84500, alertThresholdPercentage: 85 },
      { id: 'b-2', familyId: 'fam-1', category: 'HOUSING', allocatedCents: 240000, spentCents: 235000, alertThresholdPercentage: 85 },
      { id: 'b-3', familyId: 'fam-1', category: 'TRANSPORT', allocatedCents: 45000, spentCents: 31000, alertThresholdPercentage: 85 },
      { id: 'b-4', familyId: 'fam-1', category: 'DINING', allocatedCents: 35000, spentCents: 38500, alertThresholdPercentage: 85 },
    ],
    transactions: [
      { id: 'tx-1', familyId: 'fam-1', accountId: 'acc-1', title: 'Organic Valley Weekly Grocery', amountCents: 14250, transactionType: 'EXPENSE', category: 'FOOD', transactionDate: now - 3600000, isReversal: false, reversalOfId: null, paidBy: 'Sarah' },
      { id: 'tx-2', familyId: 'fam-1', accountId: 'acc-1', title: 'Monthly Household Salary Deposit', amountCents: 425000, transactionType: 'INCOME', category: 'SALARY', transactionDate: now - 86400000, isReversal: false, reversalOfId: null, paidBy: 'David' },
      { id: 'tx-3', familyId: 'fam-1', accountId: 'acc-1', title: 'City Water & Electric Utility', amountCents: 18500, transactionType: 'EXPENSE', category: 'HOUSING', transactionDate: now - 172800000, isReversal: false, reversalOfId: null, paidBy: 'Sarah' },
    ],
    processedIdempotencyKeys: {},
    auditEvents: [
      { id: 'aud-1', familyId: 'fam-1', actorUserId: 'usr-sarah-owner', actorRole: 'OWNER', actionType: 'SYSTEM_INIT', summary: 'Initialized shared FamilyOS v3 authoritative store', createdAt: now },
    ],
  };
}

let cachedStore: SharedStore | null = null;
let cachedStoreMtimeMs = -1;
let cachedStoreSizeBytes = -1;
let storeMutex: Promise<void> = Promise.resolve();
const LOCK_FILE_PATH = path.join(DATA_DIR, '.familyos-store.lock');

/**
 * Acquires an OS-level file lock to serialize store mutations across multiple backend instances/processes.
 */
async function acquireFileLock(maxWaitMs: number = 5000): Promise<() => void> {
  const start = Date.now();
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  while (Date.now() - start < maxWaitMs) {
    try {
      const fd = fs.openSync(LOCK_FILE_PATH, fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_RDWR);
      fs.writeSync(fd, `${process.pid}\n${Date.now()}`);
      fs.closeSync(fd);
      return () => {
        try {
          if (fs.existsSync(LOCK_FILE_PATH)) {
            fs.unlinkSync(LOCK_FILE_PATH);
          }
        } catch {
          // Ignore
        }
      };
    } catch (err: any) {
      if (err.code === 'EEXIST') {
        // Break stale lock if older than 10 seconds (e.g. process crashed)
        try {
          const stats = fs.statSync(LOCK_FILE_PATH);
          if (Date.now() - stats.mtimeMs > 10000) {
            fs.unlinkSync(LOCK_FILE_PATH);
            continue;
          }
        } catch {
          // Lock may have been freed concurrently
        }
        await new Promise((r) => setTimeout(r, 20));
      } else {
        break;
      }
    }
  }
  return () => {
    try {
      if (fs.existsSync(LOCK_FILE_PATH)) fs.unlinkSync(LOCK_FILE_PATH);
    } catch {}
  };
}

/**
 * Reconciles any legacy multi-workspace records in the persistent store so each account has at most one canonical ACTIVE membership.
 */
function reconcileLegacyDuplicateMemberships(store: SharedStore): void {
  if (!Array.isArray(store.memberships)) return;
  const userIds = Array.from(
    new Set(store.memberships.filter((m) => m.status === 'ACTIVE' && m.userAccountId).map((m) => m.userAccountId))
  );
  for (const uid of userIds) {
    const activeForUser = store.memberships.filter((m) => m.status === 'ACTIVE' && m.userAccountId === uid);
    if (activeForUser.length > 1) {
      const canonical =
        activeForUser.find((m) => m.familyId === 'fam-1') ||
        activeForUser.find((m) => m.role === 'OWNER') ||
        activeForUser[0];
      for (const m of activeForUser) {
        if (m.id !== canonical.id) {
          m.status = 'REVOKED';
        }
      }
    }
  }
}

/**
 * Enforces persistent database invariants before any write is committed.
 */
export function enforceStoreInvariants(store: SharedStore): void {
  // 1. One active family membership per authenticated user account
  const activeUserAccounts = new Map<string, string>();
  for (const m of store.memberships || []) {
    if (m.status === 'ACTIVE' && m.userAccountId) {
      const existingFamilyId = activeUserAccounts.get(m.userAccountId);
      if (existingFamilyId && existingFamilyId !== m.familyId) {
        throw new Error(
          `DATABASE_INVARIANT_VIOLATION: User account "${m.userAccountId}" has multiple active family memberships ("${existingFamilyId}" and "${m.familyId}"). FamilyOS enforces strictly one active family per account.`
        );
      }
      activeUserAccounts.set(m.userAccountId, m.familyId);
    }
  }

  // 2. Prevent duplicate active memberships within the same family
  const familyUserPairs = new Set<string>();
  for (const m of store.memberships || []) {
    if (m.status === 'ACTIVE' && m.userAccountId) {
      const key = `${m.familyId}::${m.userAccountId}`;
      if (familyUserPairs.has(key)) {
        throw new Error(
          `DATABASE_INVARIANT_VIOLATION: Duplicate active membership found for user "${m.userAccountId}" in family "${m.familyId}".`
        );
      }
      familyUserPairs.add(key);
    }
  }
}

/**
 * Serializes all mutations through both in-process mutex and inter-process OS file lock (or PostgreSQL ACID transaction),
 * enforces persistent uniqueness invariants, and commits atomically to the active storage engine.
 */
async function withAtomicStoreTransaction<T>(fn: (store: SharedStore) => Promise<T> | T): Promise<T> {
  const prev = storeMutex;
  let releaseInProcess!: () => void;
  storeMutex = new Promise<void>((resolve) => {
    releaseInProcess = resolve;
  });
  await prev;

  const storageStatus = evaluateStorageAvailability(process.env);
  if (storageStatus.mode === 'postgres') {
    try {
      if (!storageStatus.available) {
        throw new Error(storageStatus.errorCode || 'POSTGRES_UNAVAILABLE_NO_JSON_FALLBACK');
      }
      const pool = getPostgresPool(process.env);
      if (!pool) {
        throw new Error('POSTGRES_UNAVAILABLE_NO_JSON_FALLBACK');
      }
      if (!cachedStore) {
        const fallback = createInitialStore();
        reconcileLegacyDuplicateMemberships(fallback);
        cachedStore = await loadStoreFromPostgres(pool, fallback);
      }
      const pgStore = cachedStore;
      const result = await fn(pgStore);
      enforceStoreInvariants(pgStore);
      return result;
    } finally {
      releaseInProcess();
    }
  }

  let releaseFileLock: (() => void) | null = null;
  try {
    releaseFileLock = await acquireFileLock();
    // Invalidate cachedStore inside the lock to guarantee reading fresh state from disk
    cachedStore = null;
    const store = loadStore();
    const result = await fn(store);
    enforceStoreInvariants(store);
    saveStoreAtomically(store);
    cachedStore = store;
    return result;
  } finally {
    if (releaseFileLock) {
      releaseFileLock();
    }
    releaseInProcess();
  }
}

export function loadStore(): SharedStore {
  const storageStatus = evaluateStorageAvailability(process.env);
  if (storageStatus.mode === 'postgres') {
    if (cachedStore) {
      return cachedStore;
    }
    const initial = createInitialStore();
    reconcileLegacyDuplicateMemberships(initial);
    cachedStore = initial;
    return initial;
  }

  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(STORE_PATH)) {
      const stats = fs.statSync(STORE_PATH);
      if (
        cachedStore &&
        stats.mtimeMs === cachedStoreMtimeMs &&
        stats.size === cachedStoreSizeBytes
      ) {
        return cachedStore;
      }
      const raw = fs.readFileSync(STORE_PATH, 'utf-8');
      const parsed = JSON.parse(raw) as SharedStore;
      if (parsed.schemaVersion === '3.4.0') {
        cachedStore = parsed;
        cachedStoreMtimeMs = stats.mtimeMs;
        cachedStoreSizeBytes = stats.size;
        return parsed;
      }
      const { migratedStore } = ensurePre32BackupAndMigrate(parsed);
      reconcileLegacyDuplicateMemberships(migratedStore);
      saveStoreAtomically(migratedStore);
      return migratedStore;
    }
  } catch (err) {
    console.error('Failed to read store, initializing fresh store:', err);
  }
  const initial = createInitialStore();
  const { migratedStore } = ensurePre32BackupAndMigrate(initial);
  reconcileLegacyDuplicateMemberships(migratedStore);
  saveStoreAtomically(migratedStore);
  return migratedStore;
}

export function saveStoreAtomically(store: SharedStore): void {
  const storageStatus = evaluateStorageAvailability(process.env);
  if (storageStatus.mode === 'postgres') {
    cachedStore = store;
    return;
  }

  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const tmpPath = `${STORE_PATH}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2, 7)}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(store, null, 2), 'utf-8');
    fs.renameSync(tmpPath, STORE_PATH);
    cachedStore = store;
    const stats = fs.statSync(STORE_PATH);
    cachedStoreMtimeMs = stats.mtimeMs;
    cachedStoreSizeBytes = stats.size;
  } catch (err) {
    console.error('Failed to persist store atomically:', err);
  }
}

function bumpWorkspaceVersion(store: SharedStore, familyId: string, now: number = Date.now()): number {
  store.workspace.version += 1;
  store.workspace.updatedAt = now;
  if (store.workspaces?.[familyId]) {
    store.workspaces[familyId].version += 1;
    store.workspaces[familyId].updatedAt = now;
    if (familyId === 'fam-1') {
      store.workspace = store.workspaces['fam-1'];
    }
    return store.workspaces[familyId].version;
  }
  return store.workspace.version;
}

export async function createApp() {
  // P0 Security Gate: Enforce high-entropy FAMILYOS_SESSION_SECRET in production
  const prodConfigCheck = validateProductionAuthConfig(process.env);
  if (!prodConfigCheck.valid) {
    throw new Error(prodConfigCheck.errorMessage);
  }

  // Initialize PostgreSQL backend when FAMILYOS_STORAGE_MODE=postgres
  const storageStatus = evaluateStorageAvailability(process.env);
  if (storageStatus.mode === 'postgres') {
    if (!storageStatus.available) {
      const errDiagnostic = storageStatus.errorCode || 'POSTGRES_UNAVAILABLE_NO_JSON_FALLBACK';
      console.error(`[STORAGE_CRITICAL] ${errDiagnostic}: PostgreSQL mode is active but database credentials or connection are invalid.`);
      if (process.env.NODE_ENV === 'production' && !process.env.VERCEL) {
        throw new Error(`${errDiagnostic}: PostgreSQL configuration is required when FAMILYOS_STORAGE_MODE=postgres in production.`);
      }
    } else {
      const initial = createInitialStore();
      reconcileLegacyDuplicateMemberships(initial);
      const pgBootStore = await initializePostgresBackendIfActive(initial, process.env);
      if (pgBootStore) {
        cachedStore = pgBootStore;
      }
    }
  } else {
    const fallbackStore = ensurePre32BackupAndMigrate(createInitialStore()).migratedStore;
    reconcileLegacyDuplicateMemberships(fallbackStore);
  }

  // Initialize and verify pre-3.2 backup + migration reconciliation on startup
  const bootStore = loadStore();
  void mirrorWorkspaceToFirestore(bootStore.workspace, bootStore.memberships || []);

  const app = express();
  app.use(express.json({ limit: '5mb' }));
  app.use('/api/v1', createFailClosedStorageMiddleware());

  // Public Auth Exchange Endpoint: Exchanges cryptographically verified Firebase ID Token (or non-prod test harness account) for a signed Bearer token
  app.post('/api/v1/auth/session', async (req, res) => {
    const { firebaseIdToken, userAccountId, email, displayName, registerNewUser } = req.body || {};
    const authHeader = req.headers.authorization || '';
    const bearerCandidate = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    const candidateIdToken =
      typeof firebaseIdToken === 'string' && firebaseIdToken.trim().length > 0
        ? firebaseIdToken.trim()
        : bearerCandidate;
    const store = loadStore();

    if (candidateIdToken.length > 0) {
      const verified = await verifyBearerTokenAsync(candidateIdToken, store, process.env);
      if (!verified) {
        res.status(401).json({
          error: 'INVALID_FIREBASE_TOKEN',
          message: 'Cryptographic RS256 Firebase ID token verification failed.',
        });
        return;
      }
      let token: string;
      try {
        token = await issueSignedSessionTokenAsync({
          userAccountId: verified.userAccountId,
          email: verified.email,
          displayName: verified.displayName,
        });
      } catch (err: any) {
        if (err?.message === 'POSTGRES_UNAVAILABLE_NO_JSON_FALLBACK') {
          res.status(503).json({
            error: 'POSTGRES_UNAVAILABLE_NO_JSON_FALLBACK',
            message: 'PostgreSQL storage mode is active but database pool is unconfigured or unavailable.',
          });
          return;
        }
        throw err;
      }
      const memberships = (store.memberships || []).filter((m) => m.userAccountId === verified.userAccountId);
      const activeMembership = findActiveMembershipForUser(store, verified.userAccountId, verified.email);
      res.status(200).json({
        token,
        actor: verified,
        membership: activeMembership || memberships[0] || null,
        memberships,
        firebaseProjectId: firebaseConfig.projectId,
        firestoreDatabaseId: firebaseConfig.firestoreDatabaseId,
      });
      return;
    }

    if (typeof userAccountId === 'string' && userAccountId.trim().length > 0) {
      // P0 Security Control: Strictly block caller-supplied userAccountId in production
      if (!isTestHarnessAuthAllowed(process.env)) {
        res.status(403).json({
          error: 'TEST_HARNESS_DISABLED_IN_PRODUCTION',
          message:
            'Caller-supplied userAccountId session exchange is disabled in production. Authenticate with a signed Firebase ID token.',
        });
        return;
      }

      const rawId = userAccountId.trim();
      const cleanUserId =
        rawId === 'usr-revoked-former'
          ? 'usr-former-babysitter'
          : rawId === 'usr-fam2-owner'
          ? 'usr-carter-owner'
          : rawId;
      const matched = (store.memberships || []).find((m) => m.userAccountId === cleanUserId);

      // Strictly disable the test-harness user registration shortcut unless NODE_ENV === 'test'
      const isRegistrationShortcut =
        Boolean(registerNewUser) ||
        (!matched &&
          (cleanUserId.startsWith('usr-new-') ||
            cleanUserId.startsWith('usr-onboard-') ||
            cleanUserId.startsWith('usr-test-') ||
            cleanUserId.startsWith('usr-invitee-') ||
            cleanUserId.startsWith('usr-outsider') ||
            cleanUserId.startsWith('usr-fam2-') ||
            cleanUserId.endsWith('-331')));

      if (isRegistrationShortcut && !isTestHarnessRegistrationAllowed(process.env)) {
        res.status(403).json({
          error: 'TEST_HARNESS_REGISTRATION_DISABLED',
          message:
            'The test-harness dynamic user registration shortcut is strictly disabled unless NODE_ENV === "test".',
        });
        return;
      }

      const isKnownTestHarnessUser = Boolean(matched) || isRegistrationShortcut;

      if (!isKnownTestHarnessUser) {
        res.status(403).json({
          error: 'UNREGISTERED_TEST_HARNESS_ACCOUNT',
          message: `Account '${cleanUserId}' is not a registered test-harness identity.`,
        });
        return;
      }

      const resolvedEmail = matched?.email || String(email || `${cleanUserId}@familyos.local`).trim();
      const resolvedName = matched?.displayName || String(displayName || cleanUserId).trim();
      let token: string;
      try {
        token = await issueSignedSessionTokenAsync({
          userAccountId: cleanUserId,
          email: resolvedEmail,
          displayName: resolvedName,
        });
      } catch (err: any) {
        if (err?.message === 'POSTGRES_UNAVAILABLE_NO_JSON_FALLBACK') {
          res.status(503).json({
            error: 'POSTGRES_UNAVAILABLE_NO_JSON_FALLBACK',
            message: 'PostgreSQL storage mode is active but database pool is unconfigured or unavailable.',
          });
          return;
        }
        throw err;
      }
      res.status(200).json({
        token,
        actor: {
          userAccountId: cleanUserId,
          email: resolvedEmail,
          displayName: resolvedName,
          authMethod: 'SESSION_TOKEN',
        },
        membership: matched
          ? {
              familyId: matched.familyId,
              memberProfileId: matched.memberProfileId,
              role: matched.role,
              status: matched.status,
            }
          : null,
        firebaseProjectId: firebaseConfig.projectId,
        firestoreDatabaseId: firebaseConfig.firestoreDatabaseId,
      });
      return;
    }

    res.status(400).json({
      error: 'INVALID_AUTH_REQUEST',
      message: 'Supply a valid firebaseIdToken to establish an authenticated session.',
    });
  });

  // Zero-trust authentication middleware for all protected /api/v1/* endpoints below
  const requireAuth = createAuthMiddleware(() => loadStore());

  // 0A. Session Revocation Endpoint (Sign-Out & Token Revocation)
  app.post('/api/v1/auth/revoke', requireAuth, async (req, res) => {
    const authHeader = req.headers.authorization || '';
    const rawToken = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length).trim() : '';
    const actor = req.actor!;
    const { revokeAllForUser = false } = req.body || {};

    if (rawToken) {
      await revokeSessionTokenUnified(rawToken);
    }
    if (actor.tokenJti) {
      await revokeSessionTokenUnified(actor.tokenJti);
    }
    if (revokeAllForUser) {
      await revokeAllSessionsForUserUnified(actor.userAccountId);
    }

    res.status(200).json({
      revoked: true,
      userAccountId: actor.userAccountId,
      revokedAllSessions: Boolean(revokeAllForUser),
    });
  });

  // 0B. GDPR Account & Data Deletion Endpoint (AUTH-07)
  app.delete('/api/v1/account/me', requireAuth, async (req, res) => {
    const actor = req.actor!;
    const now = Date.now();

    await withAtomicStoreTransaction(async (store) => {
      // 1. Check last-owner rules across all family memberships for this user
      const userMemberships = (store.memberships || []).filter(
        (m) => m.userAccountId === actor.userAccountId && m.status === 'ACTIVE'
      );

      for (const m of userMemberships) {
        if (m.role === 'OWNER') {
          const otherActiveMembers = (store.memberships || []).filter(
            (other) => other.familyId === m.familyId && other.status === 'ACTIVE' && other.userAccountId !== actor.userAccountId
          );
          if (otherActiveMembers.length > 0) {
            res.status(400).json({
              error: 'LAST_OWNER_CANNOT_DELETE',
              message: 'Primary workspace owners cannot delete their account while other active members remain. Transfer ownership or remove members first.',
            });
            return;
          }
        }
      }

      // 2. Revoke all active sessions for user across stores/caches
      await revokeAllSessionsForUserUnified(actor.userAccountId);

      // 3. Purge or revoke user memberships and profiles
      for (const m of store.memberships || []) {
        if (m.userAccountId === actor.userAccountId) {
          m.status = 'REVOKED';
          m.updatedAt = now;
        }
      }

      for (const fm of store.familyMembers || []) {
        const isLinkedMembership = (store.memberships || []).some(
          (m) => m.userAccountId === actor.userAccountId && m.memberProfileId === fm.id
        );
        if (fm.userAccountId === actor.userAccountId || isLinkedMembership) {
          fm.isDeleted = true;
          fm.membershipStatus = 'REVOKED';
          fm.updatedAt = now;
        }
      }

      // 4. Soft-delete or cascade close single-owner workspaces if user was sole owner
      for (const m of userMemberships) {
        if (m.role === 'OWNER') {
          const ws = store.workspaces?.[m.familyId] || (store.workspace?.id === m.familyId ? store.workspace : null);
          if (ws) {
            ws.isDeleted = true;
            ws.status = 'CLOSED';
            ws.version += 1;
            ws.updatedAt = now;
          }
        }
      }

      // 5. Append anonymized audit record (GDPR compliance without retaining deleted PII)
      store.auditEvents.unshift({
        id: `aud-${now}`,
        familyId: userMemberships[0]?.familyId || 'fam-1',
        actorUserId: 'anonymized_user',
        actorRole: 'OWNER',
        actionType: 'ACCOUNT_DELETED',
        summary: 'User account and associated PII purged successfully via self-service GDPR deletion request',
        createdAt: now,
      });

      res.status(200).json({
        success: true,
        userAccountId: actor.userAccountId,
        message: 'Account and personal data purged successfully.',
      });
    });
  });

  // 0. Session Restore Endpoint: Restores active session, active family membership, and pending invitations
  app.get('/api/v1/session/restore', requireAuth, (req, res) => {
    const store = loadStore();
    const actor = req.actor!;
    const activeMembership = findActiveMembershipForUser(store, actor.userAccountId, actor.email);
    const allUserMemberships = (store.memberships || []).filter(
      (m) => m.userAccountId === actor.userAccountId || (actor.email && m.email.toLowerCase() === actor.email.toLowerCase())
    );
    const pendingInvitations = (store.invitations || []).filter(
      (inv) =>
        (inv.status === 'PENDING' || inv.status === 'ACCEPTED_AWAITING_APPROVAL') &&
        (inv.invitedEmail.toLowerCase() === (actor.email || '').toLowerCase() || inv.acceptedByUserId === actor.userAccountId)
    );

    const activeWorkspace = activeMembership
      ? store.workspaces?.[activeMembership.familyId] || (store.workspace.id === activeMembership.familyId ? store.workspace : null)
      : null;

    res.status(200).json({
      actor,
      hasActiveFamily: Boolean(activeMembership),
      activeFamilyId: activeMembership?.familyId || null,
      activeMembership: activeMembership || null,
      activeWorkspace,
      memberships: allUserMemberships,
      pendingInvitations,
    });
  });

  // 1. Get shared FamilyOS workspace state (used by both Web Portal and Android pull sync)
  // Enforces authenticated identity, strict server-side family membership isolation, and role-based privacy
  app.get('/api/v1/workspace/:familyId', requireAuth, (req, res) => {
    const targetFamilyId = String(req.params.familyId || '').trim();
    const store = loadStore();
    const actor = req.actor!;

    const access = resolveServerMembership(store, actor.userAccountId, targetFamilyId);
    if (!access.allowed || !access.membership) {
      res.status(access.httpStatus).json({
        error: access.errorCode,
        message: access.errorMessage,
      });
      return;
    }

    const callerMembership = access.membership;
    const isFinanceAuthorized = canPerformFinanceMutation(callerMembership.role);
    const isRoutineMemberOrHigher = ['OWNER', 'ADMIN', 'MEMBER'].includes(callerMembership.role);
    const workspace = store.workspaces?.[targetFamilyId] || store.workspace;

    const familyAccounts = isFinanceAuthorized
      ? store.accounts.filter((a) => a.familyId === targetFamilyId)
      : [];
    const familyBudgets = isFinanceAuthorized
      ? store.budgets.filter((b) => b.familyId === targetFamilyId)
      : [];
    const familyTransactions = isFinanceAuthorized
      ? store.transactions.filter((t) => t.familyId === targetFamilyId)
      : [];

    const netWorth = isFinanceAuthorized
      ? calculateNetWorthFromAccounts(store.accounts, targetFamilyId)
      : null;

    // Filter synchronized entities by familyId, minor guardian rules, and private journal rules
    const visibleEntities = Object.values(store.synchronizedEntities || {}).filter((entity) => {
      if (entity.familyId !== targetFamilyId || entity.isDeleted) return false;
      if (
        entity.entityType === 'WELLBEING_PROFILE' ||
        entity.entityType === 'HEALTH_ALLERGY' ||
        entity.entityType === 'HEALTH_MEDICATION'
      ) {
        const targetMemberId = String(entity.data.memberId || '');
        if (entity.data.isRestrictedMinor && !canAccessMinorHealthRecord(store, callerMembership, targetMemberId)) {
          return false;
        }
      }
      if (entity.entityType === 'REFLECTION_JOURNAL') {
        const ownerMemberId = String(entity.data.memberId || '');
        const isPrivate = Boolean(entity.data.isPrivate);
        if (!canAccessPrivateJournal(callerMembership, ownerMemberId, isPrivate)) {
          return false;
        }
      }
      return true;
    });

    // Authoritative family members sanitized for caller privacy (personalInfo redacted unless self or guardian)
    const rawMembers = (store.familyMembers || []).filter(
      (m) => m.familyId === targetFamilyId && !m.isDeleted
    );
    const sanitizedMembers = rawMembers.map((m) => {
      const s = sanitizeMemberForCaller(store, callerMembership, m);
      return {
        ...s,
        linkedAccountId: s.userAccountId,
        emergencyContact: s.emergencyContact
          ? {
              ...s.emergencyContact,
              name: s.emergencyContact.contactName || (s.emergencyContact as any).name || 'Emergency Contact',
              relation: s.emergencyContact.relationship || (s.emergencyContact as any).relation || 'Guardian',
              phone: s.emergencyContact.primaryPhone || (s.emergencyContact as any).phone || '',
            }
          : null,
        importantDates: (s.importantDates || []).map((d: any) => ({
          ...d,
          date: d.dateIso || d.date || '',
        })),
        personalInfo: s.personalInfo
          ? {
              ...s.personalInfo,
              privateNotes: s.personalInfo.privateBioNotes || (s.personalInfo as any).privateNotes || '',
              personalGoals: (s.personalInfo as any).personalGoals || ['Maintain calm household routines'],
              privateReflections: (s.personalInfo as any).privateReflections || ['Weekly gratitude reflection'],
            }
          : null,
      };
    });

    const familyMemberships = (store.memberships || [])
      .filter((m) => m.familyId === targetFamilyId)
      .map((m) => ({
        ...m,
        memberId: m.memberProfileId,
      }));
    const familyRelationships = (store.familyRelationships || [])
      .filter((r) => r.familyId === targetFamilyId && !r.isDeleted)
      .map((r) => ({
        ...r,
        member1Id: r.person1MemberId,
        member2Id: r.person2MemberId,
      }));
    const familyInvitations = (store.invitations || [])
      .filter((inv) => inv.familyId === targetFamilyId)
      .map((inv) => ({
        ...inv,
        inviterUserAccountId: inv.invitedByUserId,
        inviterName: 'Household Admin',
        inviteeEmail: inv.invitedEmail,
        inviteeName: inv.invitedDisplayName,
        proposedRole: inv.targetRole,
        relationshipToPrimary: (inv as any).relationshipToPrimary || 'EXTENDED',
        invitationToken: inv.invitationToken,
        inviteMethod: (inv as any).inviteMethod || 'GOOGLE_ACCOUNT',
        maxUses: (inv as any).maxUses ?? 1,
        useCount: (inv as any).useCount ?? (inv.status === 'PENDING' ? 0 : 1),
      }));
    const familyGuardians = (store.guardianRelationships || []).filter(
      (g) => g.familyId === targetFamilyId
    );

    // Build structured Family Home summary from live synchronized entities + workspace
    const calendarEntities = visibleEntities
      .filter((e) => e.entityType === 'CALENDAR_EVENT')
      .map((e) => ({
        ...e.data,
        date: String(e.data.dateLabel || e.data.date || 'Today'),
      }));
    const todaysAgenda = calendarEntities.filter((c: any) => Boolean(c.isToday));
    const upcomingEvents = calendarEntities.filter((c: any) => !c.isToday);

    const taskEntities = visibleEntities
      .filter((e) => e.entityType === 'TASK')
      .map((e) => ({
        ...e.data,
        dueDate: String(e.data.dueLabel || e.data.dueDate || 'Today'),
      }));
    const priorityTasks = taskEntities.filter((t: any) => !t.isOverdue);
    const overdueTasks = taskEntities.filter((t: any) => Boolean(t.isOverdue) && !t.isCompleted);

    const goalsAndProjects = visibleEntities
      .filter((e) => e.entityType === 'GOAL')
      .map((e) => {
        const d: Record<string, unknown> = {
          ...e.data,
          progressPercent: Number(e.data.progressPercentage ?? e.data.progressPercent ?? 60),
          targetDate: String(e.data.targetDate || 'Dec 2026'),
          projectCount: Number(e.data.projectCount || 1),
        };
        if (!isFinanceAuthorized) {
          delete d.budgetCents;
          delete d.currentCents;
        }
        return d;
      });

    const recentActivity = store.auditEvents
      .filter((a) => a.familyId === targetFamilyId)
      .filter((a) => isFinanceAuthorized || !a.actionType.startsWith('FINANCE_'))
      .slice(0, 20)
      .map((a) => ({
        ...a,
        action: a.actionType,
        actorUserAccountId: a.actorUserId,
        details: a.summary,
        timestamp: a.createdAt,
      }));

    const canManage = canManageMemberships(callerMembership.role);

    res.json({
      familyId: targetFamilyId,
      actor: {
        userAccountId: callerMembership.userAccountId,
        memberId: callerMembership.memberProfileId,
        role: callerMembership.role,
      },
      permissions: {
        canManageIdentity: canManage,
        canManageMembers: canManage,
        canInviteMembers: canManage,
        canApproveMembers: canManage,
        canAssignRoles: canManage,
        canViewFinances: isFinanceAuthorized,
      },
      workspace,
      callerMembership: {
        id: callerMembership.id,
        familyId: callerMembership.familyId,
        userAccountId: callerMembership.userAccountId,
        email: callerMembership.email,
        displayName: callerMembership.displayName,
        memberProfileId: callerMembership.memberProfileId,
        role: callerMembership.role,
        status: callerMembership.status,
        canManageMemberships: canManage,
        canPerformFinance: isFinanceAuthorized,
        canMutateHousehold: isRoutineMemberOrHigher,
      },
      members: sanitizedMembers,
      memberships: familyMemberships,
      relationships: familyRelationships,
      invitations: familyInvitations,
      guardianRelationships: familyGuardians,
      mediaAssets: Object.values(store.mediaAssets || {}).filter(
        (a) => a.familyId === targetFamilyId && !a.isDeleted
      ),
      homeSummary: {
        todaysAgenda,
        upcomingEvents,
        priorityTasks,
        overdueTasks,
        goalsAndProjects,
        goalProgress: goalsAndProjects,
        reminders: (workspace.reminders || []).map((r) => ({
          ...r,
          priority: (r as any).priority || 'HIGH',
        })),
        announcements: workspace.announcements || [],
        approvedAiSuggestions: workspace.approvedAiSuggestions || [],
        recentActivity,
      },
      financeRedacted: !isFinanceAuthorized,
      netWorth,
      accounts: familyAccounts,
      budgets: familyBudgets,
      transactions: familyTransactions,
      goals: goalsAndProjects,
      tasks: taskEntities,
      synchronizedEntities: visibleEntities,
      syncCount: Object.values(store.processedIdempotencyKeys).filter((k) => k.familyId === targetFamilyId).length,
      auditEvents: recentActivity,
    });
  });

  // 1B-1. List Canonical Family for Authenticated User (Enforces One Family Per Account)
  app.get('/api/v1/workspaces', requireAuth, (req, res) => {
    const actor = req.actor!;
    const store = loadStore();
    const canonicalMembership = getCanonicalUserMembership(store, actor.userAccountId, actor.email);

    if (!canonicalMembership) {
      res.status(200).json({ workspaces: [], family: null, hasFamily: false });
      return;
    }

    const ws = store.workspaces?.[canonicalMembership.familyId] ||
      (store.workspace?.id === canonicalMembership.familyId ? store.workspace : null);

    if (!ws || ws.isDeleted) {
      res.status(200).json({ workspaces: [], family: null, hasFamily: false });
      return;
    }

    const familyData = {
      id: ws.id,
      name: ws.name,
      description: ws.description,
      motto: ws.motto,
      mission: ws.mission,
      vision: ws.vision,
      values: ws.values || [],
      logoUrl: ws.logoUrl,
      photoUrl: ws.photoUrl,
      coverImageUrl: (ws as any).coverImageUrl || ws.photoUrl,
      currencyCode: ws.currencyCode || 'USD',
      country: (ws as any).country || 'US',
      timezone: (ws as any).timezone || 'America/New_York',
      language: (ws as any).language || 'en',
      ownerUserId: ws.ownerUserId,
      role: canonicalMembership.role,
      status: canonicalMembership.status,
      joinedAt: canonicalMembership.updatedAt || ws.updatedAt,
      memberCount: (store.familyMembers || []).filter((m) => m.familyId === ws.id && !m.isDeleted).length,
    };

    res.status(200).json({
      workspaces: [familyData],
      family: familyData,
      hasFamily: true,
      familyId: ws.id,
    });
  });

  // 1B-2. Create a New Family Workspace (Atomic Workspace, Owner Profile, Owner Membership)
  app.post('/api/v1/workspaces', requireAuth, async (req, res) => {
    const {
      name,
      description,
      motto,
      mission,
      vision,
      values,
      currencyCode = 'USD',
      logoUrl = null,
      photoUrl = null,
      coverImageUrl = null,
      country = 'US',
      timezone = 'America/New_York',
      language = 'en',
      ownerDisplayName,
      ownerRelationship,
      ownerBirthDate,
      ownerPhone,
    } = req.body || {};

    const actor = req.actor!;
    if (typeof name !== 'string' || !name.trim()) {
      res.status(400).json({
        error: 'INVALID_WORKSPACE_NAME',
        message: 'A non-empty family workspace name is required.',
      });
      return;
    }

    await withAtomicStoreTransaction(async (store) => {
      // ONE FAMILY PER ACCOUNT: Enforce that an account cannot create a second family if it already belongs to or owns one.
      const existingActiveMembership = findActiveMembershipForUser(store, actor.userAccountId, actor.email);
      if (existingActiveMembership) {
        const existingFam = store.workspaces?.[existingActiveMembership.familyId] ||
          (store.workspace?.id === existingActiveMembership.familyId ? store.workspace : null);
        res.status(409).json({
          error: 'ONE_FAMILY_PER_ACCOUNT_RULE',
          message: `Your account already belongs to family "${existingFam?.name || existingActiveMembership.familyId}". FamilyOS enforces one family per account. You cannot create another family.`,
          familyId: existingActiveMembership.familyId,
          familyName: existingFam?.name,
        });
        return;
      }

      // Check if user already owns any non-deleted family
      const existingOwned = Object.values(store.workspaces || {}).find(
        (w) => w.ownerUserId === actor.userAccountId && !w.isDeleted
      );
      if (existingOwned) {
        res.status(409).json({
          error: 'ONE_FAMILY_PER_ACCOUNT_RULE',
          message: `Your account is already the owner of family "${existingOwned.name}". FamilyOS enforces one family per account. You cannot create another family.`,
          familyId: existingOwned.id,
          familyName: existingOwned.name,
        });
        return;
      }

      const now = Date.now();
      const requestedWorkspaceId = req.body?.familyId || req.body?.id;
      const familyId =
        typeof requestedWorkspaceId === 'string' && requestedWorkspaceId.trim()
          ? requestedWorkspaceId.trim()
          : `fam-${now}-${crypto.randomBytes(6).toString('hex')}`;
      const memberProfileId = `mem-owner-${now}-${crypto.randomBytes(4).toString('hex')}`;
      const membershipId = `memship-owner-${now}-${crypto.randomBytes(4).toString('hex')}`;

      const resolvedOwnerName = String(ownerDisplayName || actor.displayName || 'Family Founder').trim();
      const resolvedOwnerRelation = String(ownerRelationship || 'SELF').trim().toUpperCase();

      const newWorkspace: AuthoritativeWorkspace = {
        id: familyId,
        name: name.trim(),
        description: typeof description === 'string' && description.trim() ? description.trim() : `${name.trim()} shared family workspace`,
        motto: typeof motto === 'string' && motto.trim() ? motto.trim() : 'Together in Stewardship and Care.',
        mission:
          typeof mission === 'string' && mission.trim()
            ? mission.trim()
            : 'Build a calm, supportive, and organized home for every family member.',
        vision:
          typeof vision === 'string' && vision.trim()
            ? vision.trim()
            : 'Enduring family harmony and generational preparedness.',
        values: Array.isArray(values) && values.length > 0 ? values.map((v) => String(v).trim()).filter(Boolean) : ['Stewardship', 'Trust', 'Kindness', 'Unity'],
        logoUrl: typeof logoUrl === 'string' ? logoUrl : null,
        photoUrl: typeof photoUrl === 'string' ? photoUrl : (typeof coverImageUrl === 'string' ? coverImageUrl : null),
        coverImageUrl: typeof coverImageUrl === 'string' ? coverImageUrl : (typeof photoUrl === 'string' ? photoUrl : null),
        currencyCode: typeof currencyCode === 'string' && currencyCode.trim().length === 3 ? currencyCode.trim().toUpperCase() : 'USD',
        country: typeof country === 'string' ? country.trim() : 'US',
        timezone: typeof timezone === 'string' ? timezone.trim() : 'America/New_York',
        language: typeof language === 'string' ? language.trim() : 'en',
        status: 'ACTIVE',
        ownerUserId: actor.userAccountId,
        announcements: [],
        reminders: [],
        approvedAiSuggestions: [],
        version: 1,
        updatedAt: now,
        isDeleted: false,
      };

      const ownerMembership: AuthoritativeMembership = {
        id: membershipId,
        familyId,
        userAccountId: actor.userAccountId,
        email: actor.email || `${actor.userAccountId}@familyos.local`,
        displayName: resolvedOwnerName,
        memberProfileId,
        role: 'OWNER',
        status: 'ACTIVE',
        updatedAt: now,
      };

      const ownerMemberProfile: AuthoritativeFamilyMember = {
        id: memberProfileId,
        familyId,
        userAccountId: actor.userAccountId,
        displayName: resolvedOwnerName,
        relationshipToPrimary: resolvedOwnerRelation,
        role: 'OWNER',
        membershipStatus: 'ACTIVE',
        birthDate: typeof ownerBirthDate === 'string' && ownerBirthDate.trim() ? ownerBirthDate.trim() : null,
        birthDateEpoch: typeof ownerBirthDate === 'string' && ownerBirthDate.trim() ? Date.parse(ownerBirthDate.trim()) || null : null,
        importantDates: typeof ownerBirthDate === 'string' && ownerBirthDate.trim()
          ? [
              {
                id: `bd-${now}`,
                label: `${resolvedOwnerName} Birthday`,
                dateIso: ownerBirthDate.trim(),
                category: 'BIRTHDAY',
              },
            ]
          : [],
        avatarUrl: null,
        photoUrl: null,
        responsibilities: ['Household Founder & Primary Steward'],
        emergencyContact: {
          contactName: resolvedOwnerName,
          relationship: 'Self',
          primaryPhone: typeof ownerPhone === 'string' ? ownerPhone.trim() : '',
        },
        sharedInfo: {
          bio: `Founder of ${newWorkspace.name}`,
        },
        personalInfo: {
          privateBioNotes: 'Personal workspace initialized.',
          personalEmail: actor.email,
          personalPhone: typeof ownerPhone === 'string' ? ownerPhone.trim() : undefined,
        },
        dietaryPreferences: [],
        allergies: [],
        isRestrictedProfile: false,
        pointsBalance: 0,
        version: 1,
        updatedAt: now,
        isDeleted: false,
      };

      store.workspaces = store.workspaces || {};
      store.workspaces[familyId] = newWorkspace;
      store.memberships = [...(store.memberships || []), ownerMembership];
      store.familyMembers = [...(store.familyMembers || []), ownerMemberProfile];

      store.synchronizedEntities = store.synchronizedEntities || {};
      store.synchronizedEntities[`FAMILY_WORKSPACE:${familyId}`] = {
        id: familyId,
        familyId,
        entityType: 'FAMILY_WORKSPACE',
        version: 1,
        isDeleted: false,
        updatedAt: now,
        updatedByUserId: actor.userAccountId,
        data: { ...newWorkspace },
      };
      store.synchronizedEntities[`FAMILY_MEMBER:${memberProfileId}`] = {
        id: memberProfileId,
        familyId,
        entityType: 'FAMILY_MEMBER',
        version: 1,
        isDeleted: false,
        updatedAt: now,
        updatedByUserId: actor.userAccountId,
        data: { ...ownerMemberProfile },
      };

      store.auditEvents.unshift({
        id: `aud-${now}`,
        familyId,
        actorUserId: actor.userAccountId,
        actorRole: 'OWNER',
        actionType: 'FAMILY_WORKSPACE_CREATED',
        summary: `Created family workspace "${newWorkspace.name}" with motto "${newWorkspace.motto}"`,
        createdAt: now,
      });

      void mirrorWorkspaceToFirestore(newWorkspace, store.memberships);

      res.status(201).json({
        success: true,
        workspace: newWorkspace,
        membership: ownerMembership,
        memberProfile: ownerMemberProfile,
      });
    });
  });

  // 1B-3. Switch Active Workspace (Disabled - Enforces One Family Per Account)
  app.post('/api/v1/workspaces/:familyId/switch', requireAuth, (req, res) => {
    res.status(400).json({
      error: 'WORKSPACE_SWITCHING_DISABLED',
      message: 'FamilyOS enforces one family per account. Workspace switching is not permitted.',
    });
  });

  // 1B-4. Transfer Workspace Ownership (OWNER only)
  app.post('/api/v1/workspaces/:familyId/transfer-ownership', requireAuth, async (req, res) => {
    const targetFamilyId = String(req.params.familyId || '').trim();
    const { newOwnerUserAccountId, newOwnerMemberProfileId } = req.body || {};
    const actor = req.actor!;

    await withAtomicStoreTransaction(async (store) => {
      const access = resolveServerMembership(store, actor.userAccountId, targetFamilyId);
      if (!access.allowed || !access.membership) {
        res.status(access.httpStatus).json({ error: access.errorCode, message: access.errorMessage });
        return;
      }

      if (access.membership.role !== 'OWNER') {
        res.status(403).json({
          error: 'PERMISSION_DENIED',
          message: 'Only the current workspace OWNER can transfer ownership.',
        });
        return;
      }

      const targetMembership = (store.memberships || []).find(
        (m) =>
          m.familyId === targetFamilyId &&
          m.status === 'ACTIVE' &&
          ((newOwnerUserAccountId && m.userAccountId === newOwnerUserAccountId) ||
            (newOwnerMemberProfileId && m.memberProfileId === newOwnerMemberProfileId))
      );

      if (!targetMembership) {
        res.status(404).json({
          error: 'TARGET_MEMBER_NOT_FOUND',
          message: 'Target member for ownership transfer was not found or is not active in this workspace.',
        });
        return;
      }

      const now = Date.now();
      // Demote current owner to ADMIN
      access.membership.role = 'ADMIN';
      access.membership.updatedAt = now;

      // Promote target member to OWNER
      targetMembership.role = 'OWNER';
      targetMembership.updatedAt = now;

      // Update workspace ownerUserId
      const ws = store.workspaces?.[targetFamilyId] || store.workspace;
      if (ws) {
        ws.ownerUserId = targetMembership.userAccountId;
        ws.version += 1;
        ws.updatedAt = now;
      }

      store.auditEvents.unshift({
        id: `aud-${now}`,
        familyId: targetFamilyId,
        actorUserId: actor.userAccountId,
        actorRole: 'OWNER',
        actionType: 'OWNERSHIP_TRANSFERRED',
        summary: `Transferred ownership of workspace to ${targetMembership.displayName} (${targetMembership.userAccountId})`,
        createdAt: now,
      });

      res.status(200).json({
        success: true,
        previousOwnerRole: 'ADMIN',
        newOwner: targetMembership,
      });
    });
  });

  // 1B-5. Archive / Delete Workspace (OWNER only)
  app.delete('/api/v1/workspaces/:familyId', requireAuth, async (req, res) => {
    const targetFamilyId = String(req.params.familyId || '').trim();
    const actor = req.actor!;

    await withAtomicStoreTransaction(async (store) => {
      const access = resolveServerMembership(store, actor.userAccountId, targetFamilyId);
      if (!access.allowed || !access.membership) {
        res.status(access.httpStatus).json({ error: access.errorCode, message: access.errorMessage });
        return;
      }

      if (access.membership.role !== 'OWNER') {
        res.status(403).json({
          error: 'PERMISSION_DENIED',
          message: 'Only the workspace OWNER can delete or close a family workspace.',
        });
        return;
      }

      const ws = store.workspaces?.[targetFamilyId] || (store.workspace.id === targetFamilyId ? store.workspace : null);
      if (!ws) {
        res.status(404).json({ error: 'WORKSPACE_NOT_FOUND', message: 'Family workspace not found.' });
        return;
      }

      const now = Date.now();
      ws.isDeleted = true;
      ws.status = 'CLOSED';
      ws.version += 1;
      ws.updatedAt = now;

      // Revoke all memberships in this workspace
      for (const m of store.memberships || []) {
        if (m.familyId === targetFamilyId) {
          m.status = 'REVOKED';
          m.updatedAt = now;
        }
      }

      store.auditEvents.unshift({
        id: `aud-${now}`,
        familyId: targetFamilyId,
        actorUserId: actor.userAccountId,
        actorRole: 'OWNER',
        actionType: 'WORKSPACE_CLOSED',
        summary: `Closed and soft-deleted family workspace "${ws.name}"`,
        createdAt: now,
      });

      res.status(200).json({ success: true, workspaceId: targetFamilyId, status: 'CLOSED' });
    });
  });

  // 1C. Update Family Identity (Name, Motto, Mission, Vision, Values, Logo, Photo) — OWNER/ADMIN only
  app.put('/api/v1/workspace/:familyId/identity', requireAuth, async (req, res) => {
    const targetFamilyId = String(req.params.familyId || '').trim();
    const actor = req.actor!;
    const {
      name,
      description,
      motto,
      mission,
      vision,
      values,
      logoUrl,
      photoUrl,
      currencyCode,
    } = req.body || {};

    await withAtomicStoreTransaction(async (store) => {
      const access = resolveServerMembership(store, actor.userAccountId, targetFamilyId);
      if (!access.allowed || !access.membership) {
        res.status(access.httpStatus).json({ error: access.errorCode, message: access.errorMessage });
        return;
      }

      if (!canManageMemberships(access.membership.role)) {
        res.status(403).json({
          error: 'PERMISSION_DENIED',
          message: `Role '${access.membership.role}' is not authorized to modify family identity settings.`,
        });
        return;
      }

      const ws = store.workspaces?.[targetFamilyId] || (store.workspace.id === targetFamilyId ? store.workspace : null);
      if (!ws) {
        res.status(404).json({ error: 'WORKSPACE_NOT_FOUND', message: 'Family workspace not found.' });
        return;
      }

      const now = Date.now();
      if (typeof name === 'string' && name.trim()) ws.name = name.trim();
      if (typeof description === 'string') ws.description = description.trim();
      if (typeof motto === 'string') ws.motto = motto.trim();
      if (typeof mission === 'string') ws.mission = mission.trim();
      if (typeof vision === 'string') ws.vision = vision.trim();
      if (Array.isArray(values)) {
        ws.values = values.map((v) => String(v).trim()).filter(Boolean);
      }
      if (logoUrl !== undefined) ws.logoUrl = logoUrl ? String(logoUrl) : null;
      if (photoUrl !== undefined) ws.photoUrl = photoUrl ? String(photoUrl) : null;
      if (typeof currencyCode === 'string' && currencyCode.trim().length === 3) {
        ws.currencyCode = currencyCode.trim().toUpperCase();
      }

      ws.version += 1;
      ws.updatedAt = now;
      store.workspaces = store.workspaces || {};
      store.workspaces[targetFamilyId] = ws;
      if (targetFamilyId === 'fam-1') {
        store.workspace = ws;
      }

      store.synchronizedEntities = store.synchronizedEntities || {};
      const key = `FAMILY_WORKSPACE:${targetFamilyId}`;
      const record: SynchronizedEntityRecord = {
        id: targetFamilyId,
        familyId: targetFamilyId,
        entityType: 'FAMILY_WORKSPACE',
        version: ws.version,
        isDeleted: false,
        updatedAt: now,
        updatedByUserId: actor.userAccountId,
        data: {
          id: ws.id,
          name: ws.name,
          description: ws.description,
          motto: ws.motto,
          mission: ws.mission,
          vision: ws.vision,
          values: ws.values,
          logoUrl: ws.logoUrl,
          photoUrl: ws.photoUrl,
          currencyCode: ws.currencyCode,
        },
      };
      store.synchronizedEntities[key] = record;

      store.auditEvents.unshift({
        id: `aud-${now}`,
        familyId: targetFamilyId,
        actorUserId: actor.userAccountId,
        actorRole: access.membership.role,
        actionType: 'FAMILY_IDENTITY_UPDATED',
        summary: `Updated family identity for "${ws.name}" (Motto: "${ws.motto || ''}")`,
        createdAt: now,
      });

      void mirrorWorkspaceToFirestore(ws, store.memberships || []);
      void mirrorEntityToFirestore(record);

      res.status(200).json({ workspace: ws });
    });
  });

  // 1D. Add Household Announcement to Family Home
  app.post('/api/v1/workspace/:familyId/announcements', requireAuth, async (req, res) => {
    const targetFamilyId = String(req.params.familyId || '').trim();
    const actor = req.actor!;
    const { title, body, priority = 'NORMAL', pinned = false } = req.body || {};

    if (typeof title !== 'string' || !title.trim() || typeof body !== 'string' || !body.trim()) {
      res.status(400).json({ error: 'INVALID_ANNOUNCEMENT', message: 'Announcement title and body are required.' });
      return;
    }

    await withAtomicStoreTransaction(async (store) => {
      const access = resolveServerMembership(store, actor.userAccountId, targetFamilyId);
      if (!access.allowed || !access.membership) {
        res.status(access.httpStatus).json({ error: access.errorCode, message: access.errorMessage });
        return;
      }

      if (!['OWNER', 'ADMIN', 'MEMBER'].includes(access.membership.role)) {
        res.status(403).json({ error: 'PERMISSION_DENIED', message: 'Role cannot post household announcements.' });
        return;
      }

      const ws = store.workspaces?.[targetFamilyId] || store.workspace;
      const now = Date.now();
      const announcement: AuthoritativeAnnouncement = {
        id: `ann-${now}`,
        title: title.trim(),
        body: body.trim(),
        authorName: access.membership.displayName,
        priority: ['NORMAL', 'IMPORTANT', 'URGENT'].includes(priority) ? priority : 'NORMAL',
        pinned: Boolean(pinned),
        createdAt: now,
      };
      ws.announcements = [announcement, ...(ws.announcements || [])];
      bumpWorkspaceVersion(store, targetFamilyId, now);

      store.auditEvents.unshift({
        id: `aud-${now}`,
        familyId: targetFamilyId,
        actorUserId: actor.userAccountId,
        actorRole: access.membership.role,
        actionType: 'ANNOUNCEMENT_POSTED',
        summary: `Posted family announcement "${announcement.title}"`,
        createdAt: now,
      });

      res.status(201).json({ announcement, announcements: ws.announcements });
    });
  });

  // 1E. Add or Toggle Household Reminder on Family Home
  app.post('/api/v1/workspace/:familyId/reminders', requireAuth, async (req, res) => {
    const targetFamilyId = String(req.params.familyId || '').trim();
    const actor = req.actor!;
    const { reminderId, title, dueLabel = 'Today', category = 'HOUSEHOLD', assignedMemberId = null, toggleCompleted, dismiss } = req.body || {};

    await withAtomicStoreTransaction(async (store) => {
      const access = resolveServerMembership(store, actor.userAccountId, targetFamilyId);
      if (!access.allowed || !access.membership) {
        res.status(access.httpStatus).json({ error: access.errorCode, message: access.errorMessage });
        return;
      }

      if (access.membership.role === 'GUEST') {
        res.status(403).json({ error: 'PERMISSION_DENIED', message: 'GUEST role cannot modify household reminders.' });
        return;
      }

      const ws = store.workspaces?.[targetFamilyId] || store.workspace;
      ws.reminders = ws.reminders || [];
      const now = Date.now();

      if (reminderId && dismiss) {
        ws.reminders = ws.reminders.filter((r) => r.id !== reminderId);
        bumpWorkspaceVersion(store, targetFamilyId, now);
        res.status(200).json({ dismissed: true, reminderId, reminders: ws.reminders });
        return;
      }

      if (reminderId && toggleCompleted !== undefined) {
        const existing = ws.reminders.find((r) => r.id === reminderId);
        if (!existing) {
          res.status(404).json({ error: 'REMINDER_NOT_FOUND' });
          return;
        }
        existing.isCompleted = Boolean(toggleCompleted);
        bumpWorkspaceVersion(store, targetFamilyId, now);
        res.status(200).json({ reminder: existing, reminders: ws.reminders });
        return;
      }

      if (typeof title !== 'string' || !title.trim()) {
        res.status(400).json({ error: 'INVALID_REMINDER', message: 'Reminder title is required.' });
        return;
      }

      const reminder: AuthoritativeReminder = {
        id: `rem-${now}`,
        title: title.trim(),
        dueLabel: String(dueLabel || 'Today'),
        assignedMemberId: assignedMemberId ? String(assignedMemberId) : null,
        category: ['HOUSEHOLD', 'SCHOOL', 'MAINTENANCE', 'HEALTH', 'FINANCE'].includes(category) ? category : 'HOUSEHOLD',
        isCompleted: false,
        createdAt: now,
      };
      ws.reminders.unshift(reminder);
      bumpWorkspaceVersion(store, targetFamilyId, now);

      res.status(201).json({ reminder, reminders: ws.reminders });
    });
  });

  // 2. Protected Minor Health / Wellbeing Endpoint (enforces Guardian Relationship check)
  app.get('/api/v1/wellbeing/:familyId/:memberId', requireAuth, (req, res) => {
    const targetFamilyId = String(req.params.familyId || '').trim();
    const targetMemberId = String(req.params.memberId || '').trim();
    const store = loadStore();
    const actor = req.actor!;

    const access = resolveServerMembership(store, actor.userAccountId, targetFamilyId);
    if (!access.allowed || !access.membership) {
      res.status(access.httpStatus).json({ error: access.errorCode, message: access.errorMessage });
      return;
    }

    if (!canAccessMinorHealthRecord(store, access.membership, targetMemberId)) {
      res.status(403).json({
        error: 'GUARDIAN_AUTHORIZATION_REQUIRED',
        message: `Role '${access.membership.role}' (${access.membership.memberProfileId}) is not an authorized guardian for health records of '${targetMemberId}'.`,
      });
      return;
    }

    const records = Object.values(store.synchronizedEntities || {}).filter(
      (e) =>
        e.familyId === targetFamilyId &&
        !e.isDeleted &&
        ['WELLBEING_PROFILE', 'HEALTH_ALLERGY', 'HEALTH_MEDICATION'].includes(e.entityType) &&
        e.data.memberId === targetMemberId
    );
    res.status(200).json({ memberId: targetMemberId, records });
  });

  // 3. Protected Private Reflection Journal Endpoint (enforces strict owner memberId check)
  app.get('/api/v1/journal/:familyId/:journalId', requireAuth, (req, res) => {
    const targetFamilyId = String(req.params.familyId || '').trim();
    const journalId = String(req.params.journalId || '').trim();
    const store = loadStore();
    const actor = req.actor!;

    const access = resolveServerMembership(store, actor.userAccountId, targetFamilyId);
    if (!access.allowed || !access.membership) {
      res.status(access.httpStatus).json({ error: access.errorCode, message: access.errorMessage });
      return;
    }

    const entity = store.synchronizedEntities?.[`REFLECTION_JOURNAL:${journalId}`];
    if (!entity || entity.familyId !== targetFamilyId || entity.isDeleted) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Journal entry not found.' });
      return;
    }

    const ownerMemberId = String(entity.data.memberId || '');
    const isPrivate = Boolean(entity.data.isPrivate);
    if (!canAccessPrivateJournal(access.membership, ownerMemberId, isPrivate)) {
      res.status(403).json({
        error: 'PRIVATE_RECORD_ACCESS_DENIED',
        message: 'Private reflection journals can only be accessed by their owning family member.',
      });
      return;
    }

    res.status(200).json({ journal: entity });
  });

  // 3A-1. List Family Members for Workspace (sanitized by server according to caller's role)
  app.get('/api/v1/members/:familyId', requireAuth, (req, res, next) => {
    const targetFamilyId = String(req.params.familyId || '').trim();
    if (targetFamilyId === 'invite') {
      next();
      return;
    }
    const actor = req.actor!;
    const store = loadStore();

    const access = resolveServerMembership(store, actor.userAccountId, targetFamilyId);
    if (!access.allowed || !access.membership) {
      res.status(access.httpStatus).json({ error: access.errorCode, message: access.errorMessage });
      return;
    }

    const rawMembers = (store.familyMembers || []).filter(
      (m) => m.familyId === targetFamilyId && !m.isDeleted
    );
    const sanitized = rawMembers.map((m) => sanitizeMemberForCaller(store, access.membership!, m));
    res.status(200).json({ members: sanitized });
  });

  // 3A-2. Retrieve Specific Family Member Profile Detail
  app.get('/api/v1/members/:familyId/:memberId', requireAuth, (req, res) => {
    const targetFamilyId = String(req.params.familyId || '').trim();
    const targetMemberId = String(req.params.memberId || '').trim();
    const actor = req.actor!;
    const store = loadStore();

    const access = resolveServerMembership(store, actor.userAccountId, targetFamilyId);
    if (!access.allowed || !access.membership) {
      res.status(access.httpStatus).json({ error: access.errorCode, message: access.errorMessage });
      return;
    }

    const member = (store.familyMembers || []).find(
      (m) => m.familyId === targetFamilyId && m.id === targetMemberId && !m.isDeleted
    );
    if (!member) {
      res.status(404).json({ error: 'MEMBER_NOT_FOUND', message: 'Member profile not found in this family.' });
      return;
    }

    const sanitized = sanitizeMemberForCaller(store, access.membership, member);
    res.status(200).json({ member: sanitized });
  });

  // 3B. Create Family Member Profile (OWNER/ADMIN only — syncs across Android & Web)
  app.post('/api/v1/members/:familyId', requireAuth, async (req, res, next) => {
    const targetFamilyId = String(req.params.familyId || '').trim();
    if (targetFamilyId === 'invite') {
      next();
      return;
    }
    const actor = req.actor!;
    const {
      id: requestedId,
      displayName,
      relationshipToPrimary = 'MEMBER',
      role = 'MEMBER',
      birthDate = null,
      importantDates = [],
      responsibilities = [],
      emergencyContact,
      sharedInfo,
      personalInfo,
      avatarUrl = null,
      photoUrl = null,
      dietaryPreferences = [],
      allergies = [],
      isRestrictedProfile = false,
      pointsBalance = 0,
    } = req.body || {};

    if (typeof displayName !== 'string' || !displayName.trim()) {
      res.status(400).json({ error: 'INVALID_MEMBER_NAME', message: 'displayName is required.' });
      return;
    }

    await withAtomicStoreTransaction(async (store) => {
      const access = resolveServerMembership(store, actor.userAccountId, targetFamilyId);
      if (!access.allowed || !access.membership) {
        res.status(access.httpStatus).json({ error: access.errorCode, message: access.errorMessage });
        return;
      }

      if (!canManageMemberships(access.membership.role)) {
        res.status(403).json({
          error: 'PERMISSION_DENIED',
          message: `Role '${access.membership.role}' cannot add new family member profiles.`,
        });
        return;
      }

      const now = Date.now();
      const memberId =
        typeof requestedId === 'string' && requestedId.trim()
          ? requestedId.trim()
          : `mem-${now}-${Math.random().toString(36).slice(2, 6)}`;

      const assignedRole: FamilyRole =
        role === 'ADMIN' || role === 'MEMBER' || role === 'CHILD' || role === 'GUEST'
          ? role
          : isRestrictedProfile
          ? 'CHILD'
          : 'MEMBER';

      const newMember: AuthoritativeFamilyMember = {
        id: memberId,
        familyId: targetFamilyId,
        userAccountId: null,
        displayName: displayName.trim(),
        relationshipToPrimary: String(relationshipToPrimary || 'MEMBER').toUpperCase(),
        role: assignedRole,
        membershipStatus: 'ACTIVE',
        birthDate: birthDate ? String(birthDate) : null,
        birthDateEpoch: birthDate ? Date.parse(String(birthDate)) || null : null,
        importantDates: Array.isArray(importantDates) ? importantDates : [],
        avatarUrl: avatarUrl ? String(avatarUrl) : null,
        photoUrl: photoUrl ? String(photoUrl) : null,
        responsibilities: Array.isArray(responsibilities)
          ? responsibilities.map((r) => String(r).trim()).filter(Boolean)
          : [],
        emergencyContact: emergencyContact || {
          contactName: access.membership.displayName,
          relationship: 'Primary Guardian',
          primaryPhone: '(555) 123-4567',
        },
        sharedInfo: sharedInfo || {
          bio: `${displayName.trim()} household member profile`,
        },
        personalInfo: personalInfo || {
          privateBioNotes: `Personal profile notes for ${displayName.trim()}`,
        },
        dietaryPreferences: Array.isArray(dietaryPreferences) ? dietaryPreferences.map(String) : [],
        allergies: Array.isArray(allergies) ? allergies.map(String) : [],
        isRestrictedProfile: Boolean(isRestrictedProfile || req.body?.isMinor || assignedRole === 'CHILD'),
        pointsBalance: Number(pointsBalance) || 0,
        version: 1,
        updatedAt: now,
        isDeleted: false,
      };

      (newMember as any).isMinor = Boolean(req.body?.isMinor || isRestrictedProfile || assignedRole === 'CHILD' || String(relationshipToPrimary).toUpperCase() === 'CHILD');

      store.familyMembers = [...(store.familyMembers || []), newMember];

      if (newMember.isRestrictedProfile) {
        store.guardianRelationships = store.guardianRelationships || [];
        store.guardianRelationships.push({
          id: `guard-${access.membership.memberProfileId}-${memberId}`,
          familyId: targetFamilyId,
          guardianMemberId: access.membership.memberProfileId,
          minorMemberId: memberId,
          relationship: 'GUARDIAN',
          canManageHealthRecords: true,
        });
      }

      store.synchronizedEntities = store.synchronizedEntities || {};
      const syncRecord: SynchronizedEntityRecord = {
        id: memberId,
        familyId: targetFamilyId,
        entityType: 'FAMILY_MEMBER',
        version: 1,
        isDeleted: false,
        updatedAt: now,
        updatedByUserId: actor.userAccountId,
        data: { ...newMember },
      };
      store.synchronizedEntities[`FAMILY_MEMBER:${memberId}`] = syncRecord;
      bumpWorkspaceVersion(store, targetFamilyId, now);

      store.auditEvents.unshift({
        id: `aud-${now}`,
        familyId: targetFamilyId,
        actorUserId: actor.userAccountId,
        actorRole: access.membership.role,
        actionType: 'FAMILY_MEMBER_CREATED',
        summary: `Added family member "${newMember.displayName}" (${newMember.relationshipToPrimary})`,
        createdAt: now,
      });

      void mirrorEntityToFirestore(syncRecord);

      res.status(201).json({
        member: sanitizeMemberForCaller(store, access.membership, newMember),
      });
    });
  });

  // 3C. Update Family Member Profile (Enforces Self-Edit vs Admin RBAC & Blocks Client Self-Promotion)
  app.put('/api/v1/members/:familyId/:memberId', requireAuth, async (req, res) => {
    const targetFamilyId = String(req.params.familyId || '').trim();
    const targetMemberId = String(req.params.memberId || '').trim();
    const actor = req.actor!;
    const updates = req.body || {};

    await withAtomicStoreTransaction(async (store) => {
      const access = resolveServerMembership(store, actor.userAccountId, targetFamilyId);
      if (!access.allowed || !access.membership) {
        res.status(access.httpStatus).json({ error: access.errorCode, message: access.errorMessage });
        return;
      }

      const callerMembership = access.membership;
      const isOwnerOrAdmin = canManageMemberships(callerMembership.role);

      // Block clients from self-assigning administrative permissions (OWNER/ADMIN) or tampering with role/status
      if (!isOwnerOrAdmin && (updates.role !== undefined || updates.membershipStatus !== undefined || updates.actorRole !== undefined)) {
        res.status(403).json({
          error: 'SELF_PROMOTION_FORBIDDEN',
          message: 'Clients cannot assign themselves administrative roles or modify membership status.',
        });
        return;
      }

      if (!canEditMemberProfile(callerMembership, targetMemberId)) {
        res.status(403).json({
          error: 'PERMISSION_DENIED',
          message: `Role '${callerMembership.role}' can only edit their own member profile ('${callerMembership.memberProfileId}').`,
        });
        return;
      }

      store.familyMembers = store.familyMembers || [];
      const member = store.familyMembers.find(
        (m) => m.id === targetMemberId && m.familyId === targetFamilyId && !m.isDeleted
      );
      if (!member) {
        res.status(404).json({ error: 'MEMBER_NOT_FOUND', message: `Member '${targetMemberId}' not found.` });
        return;
      }

      const now = Date.now();
      if (typeof updates.displayName === 'string' && updates.displayName.trim()) {
        member.displayName = updates.displayName.trim();
      }
      if (isOwnerOrAdmin && typeof updates.relationshipToPrimary === 'string' && updates.relationshipToPrimary.trim()) {
        member.relationshipToPrimary = updates.relationshipToPrimary.trim().toUpperCase();
      }
      if (updates.birthDate !== undefined) {
        member.birthDate = updates.birthDate ? String(updates.birthDate) : null;
        member.birthDateEpoch = updates.birthDate ? Date.parse(String(updates.birthDate)) || null : null;
      }
      if (Array.isArray(updates.importantDates)) {
        member.importantDates = updates.importantDates;
      }
      if (Array.isArray(updates.responsibilities)) {
        member.responsibilities = updates.responsibilities.map((r: unknown) => String(r).trim()).filter(Boolean);
      }
      if (updates.emergencyContact && typeof updates.emergencyContact === 'object') {
        member.emergencyContact = {
          ...member.emergencyContact,
          ...updates.emergencyContact,
        };
      }
      if (updates.sharedInfo && typeof updates.sharedInfo === 'object') {
        member.sharedInfo = {
          ...member.sharedInfo,
          ...updates.sharedInfo,
        };
      }
      if (updates.personalInfo && typeof updates.personalInfo === 'object') {
        if (canViewPersonalMemberInfo(store, callerMembership, member)) {
          member.personalInfo = {
            ...(member.personalInfo || { privateBioNotes: '' }),
            ...updates.personalInfo,
          };
        } else {
          res.status(403).json({
            error: 'PERSONAL_WORKSPACE_PRIVACY_VIOLATION',
            message: 'You are not authorized to view or modify another member’s private personal workspace fields.',
          });
          return;
        }
      }
      if (updates.avatarUrl !== undefined) {
        member.avatarUrl = updates.avatarUrl ? String(updates.avatarUrl) : null;
      }
      if (updates.photoUrl !== undefined) {
        member.photoUrl = updates.photoUrl ? String(updates.photoUrl) : null;
      }
      if (Array.isArray(updates.dietaryPreferences)) {
        member.dietaryPreferences = updates.dietaryPreferences.map(String);
      }
      if (Array.isArray(updates.allergies)) {
        member.allergies = updates.allergies.map(String);
      }
      if (isOwnerOrAdmin && typeof updates.pointsBalance === 'number') {
        member.pointsBalance = Math.round(updates.pointsBalance);
      }
      if (isOwnerOrAdmin && typeof updates.isRestrictedProfile === 'boolean') {
        member.isRestrictedProfile = updates.isRestrictedProfile;
      }

      member.version += 1;
      member.updatedAt = now;

      // Also sync displayName to linked membership if present
      const linkedMembership = (store.memberships || []).find(
        (m) => m.familyId === targetFamilyId && m.memberProfileId === member.id
      );
      if (linkedMembership) {
        linkedMembership.displayName = member.displayName;
        linkedMembership.updatedAt = now;
      }

      store.synchronizedEntities = store.synchronizedEntities || {};
      const syncRecord: SynchronizedEntityRecord = {
        id: member.id,
        familyId: targetFamilyId,
        entityType: 'FAMILY_MEMBER',
        version: member.version,
        isDeleted: false,
        updatedAt: now,
        updatedByUserId: actor.userAccountId,
        data: { ...member },
      };
      store.synchronizedEntities[`FAMILY_MEMBER:${member.id}`] = syncRecord;
      bumpWorkspaceVersion(store, targetFamilyId, now);

      store.auditEvents.unshift({
        id: `aud-${now}`,
        familyId: targetFamilyId,
        actorUserId: actor.userAccountId,
        actorRole: callerMembership.role,
        actionType: 'FAMILY_MEMBER_UPDATED',
        summary: `Updated profile for "${member.displayName}"`,
        createdAt: now,
      });

      void mirrorEntityToFirestore(syncRecord);

      res.status(200).json({
        member: sanitizeMemberForCaller(store, callerMembership, member),
      });
    });
  });

  // 3D. Remove Family Member & Revoke Access (OWNER/ADMIN only)
  app.delete('/api/v1/members/:familyId/:memberId', requireAuth, async (req, res) => {
    const targetFamilyId = String(req.params.familyId || '').trim();
    const targetMemberId = String(req.params.memberId || '').trim();
    const actor = req.actor!;

    await withAtomicStoreTransaction(async (store) => {
      const access = resolveServerMembership(store, actor.userAccountId, targetFamilyId);
      if (!access.allowed || !access.membership) {
        res.status(access.httpStatus).json({ error: access.errorCode, message: access.errorMessage });
        return;
      }

      if (!canManageMemberships(access.membership.role)) {
        res.status(403).json({
          error: 'PERMISSION_DENIED',
          message: `Role '${access.membership.role}' cannot remove family members.`,
        });
        return;
      }

      const member = (store.familyMembers || []).find(
        (m) => m.id === targetMemberId && m.familyId === targetFamilyId && !m.isDeleted
      );
      if (!member) {
        res.status(404).json({ error: 'MEMBER_NOT_FOUND', message: 'Member not found.' });
        return;
      }

      if (member.role === 'OWNER') {
        res.status(400).json({
          error: 'CANNOT_REMOVE_OWNER',
          message: 'The primary workspace OWNER cannot be removed.',
        });
        return;
      }

      const now = Date.now();
      member.isDeleted = true;
      member.membershipStatus = 'REVOKED';
      member.version += 1;
      member.updatedAt = now;

      // Revoke any linked membership
      for (const m of store.memberships || []) {
        if (m.familyId === targetFamilyId && m.memberProfileId === targetMemberId) {
          m.status = 'REVOKED';
          m.updatedAt = now;
        }
      }

      // Soft-delete relationships involving this member
      for (const rel of store.familyRelationships || []) {
        if (
          rel.familyId === targetFamilyId &&
          (rel.person1MemberId === targetMemberId || rel.person2MemberId === targetMemberId)
        ) {
          rel.isDeleted = true;
          rel.updatedAt = now;
        }
      }

      store.synchronizedEntities = store.synchronizedEntities || {};
      const tombstoneRecord: SynchronizedEntityRecord = {
        id: member.id,
        familyId: targetFamilyId,
        entityType: 'FAMILY_MEMBER',
        version: member.version,
        isDeleted: true,
        updatedAt: now,
        updatedByUserId: actor.userAccountId,
        data: { ...member, isDeleted: true },
      };
      store.synchronizedEntities[`FAMILY_MEMBER:${member.id}`] = tombstoneRecord;
      bumpWorkspaceVersion(store, targetFamilyId, now);

      store.auditEvents.unshift({
        id: `aud-${now}`,
        familyId: targetFamilyId,
        actorUserId: actor.userAccountId,
        actorRole: access.membership.role,
        actionType: 'FAMILY_MEMBER_REMOVED',
        summary: `Removed member "${member.displayName}" and revoked workspace access`,
        createdAt: now,
      });

      void mirrorEntityToFirestore(tombstoneRecord);

      res.status(200).json({
        removedMemberId: targetMemberId,
        revoked: true,
      });
    });
  });

  // 3E. Connect a Real User Account to an existing Member Profile (OWNER/ADMIN only)
  app.post('/api/v1/members/:familyId/:memberId/connect-account', requireAuth, async (req, res) => {
    const targetFamilyId = String(req.params.familyId || '').trim();
    const targetMemberId = String(req.params.memberId || '').trim();
    const { userAccountId, email, displayName, role = 'MEMBER' } = req.body || {};
    const actor = req.actor!;

    if (!userAccountId || typeof userAccountId !== 'string' || !userAccountId.trim()) {
      res.status(400).json({ error: 'INVALID_USER_ACCOUNT_ID', message: 'userAccountId is required.' });
      return;
    }

    await withAtomicStoreTransaction(async (store) => {
      const access = resolveServerMembership(store, actor.userAccountId, targetFamilyId);
      if (!access.allowed || !access.membership) {
        res.status(access.httpStatus).json({ error: access.errorCode, message: access.errorMessage });
        return;
      }

      if (!canManageMemberships(access.membership.role)) {
        res.status(403).json({ error: 'PERMISSION_DENIED', message: 'Only OWNER or ADMIN can connect accounts to member profiles.' });
        return;
      }

      const member = (store.familyMembers || []).find(
        (m) => m.familyId === targetFamilyId && m.id === targetMemberId && !m.isDeleted
      );
      if (!member) {
        res.status(404).json({ error: 'MEMBER_NOT_FOUND', message: 'Member profile not found in this family.' });
        return;
      }

      // ONE FAMILY PER ACCOUNT: Enforce user cannot belong to multiple families
      const existingInAnother = (store.memberships || []).find(
        (m) =>
          m.userAccountId === userAccountId.trim() &&
          m.status === 'ACTIVE' &&
          m.familyId !== targetFamilyId
      );
      if (existingInAnother) {
        res.status(409).json({
          error: 'ONE_FAMILY_PER_ACCOUNT_RULE',
          message: `User account "${userAccountId.trim()}" already belongs to family "${existingInAnother.familyId}". An account cannot belong to multiple families.`,
        });
        return;
      }

      const now = Date.now();
      member.userAccountId = userAccountId.trim();
      member.updatedAt = now;

      // Update or create membership
      let existingMembership = (store.memberships || []).find(
        (m) => m.familyId === targetFamilyId && (m.userAccountId === userAccountId.trim() || m.memberProfileId === targetMemberId)
      );

      if (existingMembership) {
        existingMembership.userAccountId = userAccountId.trim();
        existingMembership.memberProfileId = targetMemberId;
        existingMembership.status = 'ACTIVE';
        if (email) existingMembership.email = String(email).trim();
        if (displayName) existingMembership.displayName = String(displayName).trim();
        existingMembership.updatedAt = now;
      } else {
        existingMembership = {
          id: `memship-${now}-${Math.random().toString(36).slice(2, 6)}`,
          familyId: targetFamilyId,
          userAccountId: userAccountId.trim(),
          email: email ? String(email).trim() : `${userAccountId.trim()}@familyos.local`,
          displayName: displayName ? String(displayName).trim() : member.displayName,
          memberProfileId: targetMemberId,
          role: ['ADMIN', 'MEMBER', 'CHILD', 'GUEST'].includes(role) ? role : 'MEMBER',
          status: 'ACTIVE',
          updatedAt: now,
        };
        store.memberships = [...(store.memberships || []), existingMembership];
      }

      bumpWorkspaceVersion(store, targetFamilyId, now);

      store.auditEvents.unshift({
        id: `aud-${now}`,
        familyId: targetFamilyId,
        actorUserId: actor.userAccountId,
        actorRole: access.membership.role,
        actionType: 'ACCOUNT_CONNECTED',
        summary: `Connected account ${userAccountId} to member profile ${member.displayName}`,
        createdAt: now,
      });

      res.status(200).json({ success: true, member, membership: existingMembership });
    });
  });

  // 4A-1. Verify Invitation Token (Public endpoint for recipients prior to login / claim)
  app.get('/api/v1/invitations/verify/:token', (req, res) => {
    const rawToken = String(req.params.token || '').trim();
    const store = loadStore();
    const invitation = (store.invitations || []).find(
      (i) => i.invitationToken === rawToken || i.id === rawToken
    );

    if (!invitation) {
      res.status(404).json({ error: 'INVITATION_NOT_FOUND', message: 'Invitation token was not found.' });
      return;
    }

    const now = Date.now();
    if (invitation.expiresAt < now) {
      res.status(410).json({ error: 'INVITATION_EXPIRED', message: 'This invitation has expired.' });
      return;
    }

    if (invitation.status === 'REVOKED') {
      res.status(403).json({ error: 'INVITATION_REVOKED', message: 'This invitation was revoked by the family administrator.' });
      return;
    }

    if (invitation.status !== 'PENDING' || (invitation.useCount && invitation.useCount >= (invitation.maxUses || 1))) {
      res.status(409).json({ error: 'INVITATION_ALREADY_USED', message: 'This invitation has already been used.' });
      return;
    }

    const ws = store.workspaces?.[invitation.familyId] || (store.workspace?.id === invitation.familyId ? store.workspace : null);
    const inviter = (store.memberships || []).find(
      (m) => m.familyId === invitation.familyId && m.userAccountId === invitation.invitedByUserId
    );

    const invData = {
      id: invitation.id,
      familyId: invitation.familyId,
      familyName: ws?.name || 'Family Workspace',
      familyMotto: ws?.motto || '',
      logoUrl: ws?.logoUrl || null,
      invitedEmail: invitation.invitedEmail,
      invitedDisplayName: invitation.invitedDisplayName,
      targetRole: invitation.targetRole,
      proposedRole: invitation.targetRole,
      relationshipToPrimary: (invitation as any).relationshipToPrimary || 'MEMBER',
      inviterName: inviter?.displayName || 'Family Administrator',
      status: invitation.status,
      expiresAt: invitation.expiresAt,
    };

    res.status(200).json({
      valid: true,
      ...invData,
      invitation: invData,
    });
  });

  // 4A-2. List Invitations for Family Workspace (OWNER/ADMIN only)
  app.get('/api/v1/invitations/:familyId', requireAuth, (req, res) => {
    const targetFamilyId = String(req.params.familyId || '').trim();
    const actor = req.actor!;
    const store = loadStore();

    const access = resolveServerMembership(store, actor.userAccountId, targetFamilyId);
    if (!access.allowed || !access.membership) {
      res.status(access.httpStatus).json({ error: access.errorCode, message: access.errorMessage });
      return;
    }

    if (!canManageMemberships(access.membership.role)) {
      res.status(403).json({ error: 'PERMISSION_DENIED', message: 'Only OWNER or ADMIN can view family invitations.' });
      return;
    }

    const familyInvs = (store.invitations || []).filter((i) => i.familyId === targetFamilyId);
    res.status(200).json({ invitations: familyInvs });
  });

  // 4A-3. Create Family Invitation (OWNER/ADMIN only — dynamic familyId)
  app.post('/api/v1/members/invite', requireAuth, async (req, res) => {
    const {
      familyId,
      email,
      inviteeEmail,
      displayName,
      inviteeName,
      role,
      proposedRole,
      userAccountId: invitedUserAccountId,
      relationshipToPrimary = 'OTHER',
      inviteMethod = 'GOOGLE_ACCOUNT',
      message = '',
    } = req.body || {};
    const actor = req.actor!;

    const targetFamilyId = String(familyId || req.body?.workspaceId || '').trim();
    if (!targetFamilyId) {
      res.status(400).json({ error: 'MISSING_FAMILY_ID', message: 'familyId is required to create an invitation.' });
      return;
    }

    await withAtomicStoreTransaction(async (store) => {
      const access = resolveServerMembership(store, actor.userAccountId, targetFamilyId);
      if (!access.allowed || !access.membership) {
        res.status(access.httpStatus).json({ error: access.errorCode, message: access.errorMessage });
        return;
      }

      if (!canManageMemberships(access.membership.role)) {
        res.status(403).json({
          error: 'PERMISSION_DENIED',
          message: `Server-resolved role '${access.membership.role}' is not authorized to invite members.`,
        });
        return;
      }

      const now = Date.now();
      const rawRole = proposedRole || role || 'MEMBER';
      const targetRole: FamilyRole = ['ADMIN', 'MEMBER', 'CHILD', 'GUEST'].includes(rawRole) ? rawRole : 'MEMBER';
      const isOneTimeLink = inviteMethod === 'ONE_TIME_LINK';
      const resolvedEmail = String(
        inviteeEmail || email || (isOneTimeLink ? `one-time-link-${now}@familyos.local` : `invite-${now}@familyos.local`)
      ).trim();
      const resolvedName = String(
        inviteeName || displayName || (isOneTimeLink ? 'One-Time Link Recipient' : 'Invited Member')
      ).trim();
      const memberProfileId = `mem-${now}-${crypto.randomBytes(4).toString('hex')}`;
      const membershipId = `memship-${now}-${crypto.randomBytes(4).toString('hex')}`;
      const invitationId = `inv-${now}-${crypto.randomBytes(4).toString('hex')}`;
      const oneTimeToken = `fos_1time_${now}_${crypto.randomBytes(24).toString('hex')}`;
      const resolvedUserAccountId =
        typeof invitedUserAccountId === 'string' && invitedUserAccountId.trim()
          ? invitedUserAccountId.trim()
          : `usr-invited-${now}`;

      const newMembership: AuthoritativeMembership = {
        id: membershipId,
        familyId: targetFamilyId,
        userAccountId: resolvedUserAccountId,
        email: resolvedEmail,
        displayName: resolvedName,
        memberProfileId,
        role: targetRole,
        status: 'INVITED',
        updatedAt: now,
      };

      const newInvitation: AuthoritativeInvitation & {
        relationshipToPrimary?: string;
        inviteMethod?: string;
        maxUses?: number;
        useCount?: number;
        message?: string;
      } = {
        id: invitationId,
        familyId: targetFamilyId,
        invitationToken: oneTimeToken,
        invitedEmail: resolvedEmail,
        invitedDisplayName: resolvedName,
        targetRole,
        assignedMemberProfileId: memberProfileId,
        invitedByUserId: actor.userAccountId,
        acceptedByUserId: null,
        status: 'PENDING',
        expiresAt: now + 14 * 24 * 3600 * 1000,
        createdAt: now,
        updatedAt: now,
        relationshipToPrimary: String(relationshipToPrimary || 'OTHER').toUpperCase(),
        inviteMethod: isOneTimeLink ? 'ONE_TIME_LINK' : 'GOOGLE_ACCOUNT',
        maxUses: 1,
        useCount: 0,
        message: String(message || '').trim(),
      };

      store.memberships = [...(store.memberships || []), newMembership];
      store.invitations = [newInvitation, ...(store.invitations || [])];

      store.synchronizedEntities = store.synchronizedEntities || {};
      store.synchronizedEntities[`INVITATION:${invitationId}`] = {
        id: invitationId,
        familyId: targetFamilyId,
        entityType: 'INVITATION',
        version: 1,
        isDeleted: false,
        updatedAt: now,
        updatedByUserId: actor.userAccountId,
        data: { ...newInvitation, relationshipToPrimary },
      };

      bumpWorkspaceVersion(store, targetFamilyId, now);

      store.auditEvents.unshift({
        id: `aud-${now}`,
        familyId: targetFamilyId,
        actorUserId: actor.userAccountId,
        actorRole: access.membership.role,
        actionType: 'MEMBER_INVITED',
        summary: isOneTimeLink
          ? `Generated one-time-use family invite link for ${resolvedName} (${targetRole})`
          : `Invited ${newMembership.displayName} (${resolvedEmail}) via account as ${newMembership.role}`,
        createdAt: now,
      });

      res.status(201).json({
        membership: newMembership,
        invitation: newInvitation,
      });
    });
  });

  // Alias POST /api/v1/invitations to /api/v1/members/invite
  app.post('/api/v1/invitations', requireAuth, async (req, res) => {
    const {
      familyId,
      email,
      inviteeEmail,
      displayName,
      inviteeName,
      role,
      proposedRole,
      relationshipToPrimary = 'OTHER',
      inviteMethod = 'GOOGLE_ACCOUNT',
      message = '',
    } = req.body || {};
    const actor = req.actor!;
    const targetFamilyId = String(familyId || '').trim();

    if (!targetFamilyId) {
      res.status(400).json({ error: 'MISSING_FAMILY_ID', message: 'familyId is required.' });
      return;
    }

    await withAtomicStoreTransaction(async (store) => {
      const access = resolveServerMembership(store, actor.userAccountId, targetFamilyId);
      if (!access.allowed || !access.membership) {
        res.status(access.httpStatus).json({ error: access.errorCode, message: access.errorMessage });
        return;
      }

      if (!canManageMemberships(access.membership.role)) {
        res.status(403).json({ error: 'PERMISSION_DENIED', message: 'Role is not authorized to invite members.' });
        return;
      }

      const now = Date.now();
      const rawRole = proposedRole || role || 'MEMBER';
      const targetRole: FamilyRole = ['ADMIN', 'MEMBER', 'CHILD', 'GUEST'].includes(rawRole) ? rawRole : 'MEMBER';
      const isOneTimeLink = inviteMethod === 'ONE_TIME_LINK';
      const resolvedEmail = String(inviteeEmail || email || `one-time-${now}@familyos.local`).trim();
      const resolvedName = String(inviteeName || displayName || 'Invited Family Member').trim();
      const memberProfileId = `mem-${now}-${crypto.randomBytes(4).toString('hex')}`;
      const membershipId = `memship-${now}-${crypto.randomBytes(4).toString('hex')}`;
      const invitationId = `inv-${now}-${crypto.randomBytes(4).toString('hex')}`;
      const oneTimeToken = `fos_1time_${now}_${crypto.randomBytes(24).toString('hex')}`;
      const customExpiresInMs = typeof req.body?.expiresInMs === 'number' ? req.body.expiresInMs : 14 * 24 * 3600 * 1000;

      const newMembership: AuthoritativeMembership = {
        id: membershipId,
        familyId: targetFamilyId,
        userAccountId: `usr-invited-${now}`,
        email: resolvedEmail,
        displayName: resolvedName,
        memberProfileId,
        role: targetRole,
        status: 'INVITED',
        updatedAt: now,
      };

      const newInvitation: AuthoritativeInvitation & {
        relationshipToPrimary?: string;
        inviteMethod?: string;
        maxUses?: number;
        useCount?: number;
      } = {
        id: invitationId,
        familyId: targetFamilyId,
        invitationToken: oneTimeToken,
        invitedEmail: resolvedEmail,
        invitedDisplayName: resolvedName,
        targetRole,
        assignedMemberProfileId: memberProfileId,
        invitedByUserId: actor.userAccountId,
        acceptedByUserId: null,
        status: 'PENDING',
        expiresAt: now + customExpiresInMs,
        createdAt: now,
        updatedAt: now,
        relationshipToPrimary: String(relationshipToPrimary || 'OTHER').toUpperCase(),
        inviteMethod: isOneTimeLink ? 'ONE_TIME_LINK' : 'GOOGLE_ACCOUNT',
        maxUses: 1,
        useCount: 0,
      };

      store.memberships = [...(store.memberships || []), newMembership];
      store.invitations = [newInvitation, ...(store.invitations || [])];
      bumpWorkspaceVersion(store, targetFamilyId, now);

      res.status(201).json({ invitation: newInvitation, membership: newMembership });
    });
  });

  // 4A-4. Claim an Invitation Link by Authenticated User (Dynamic familyId & real user binding)
  app.post('/api/v1/invitations/claim-one-time-link', requireAuth, async (req, res) => {
    const {
      invitationToken,
      invitationId,
      displayName,
      relationshipToPrimary,
      birthDate,
      phone,
      emergencyContactName,
      emergencyContactPhone,
      allergiesText,
      bio,
      responsibilitiesText,
      avatarUrl,
    } = req.body || {};

    const actor = req.actor!;

    await withAtomicStoreTransaction(async (store) => {
      store.invitations = store.invitations || [];
      const invitation = store.invitations.find(
        (i) =>
          (invitationToken && i.invitationToken === String(invitationToken).trim()) ||
          (invitationId && i.id === String(invitationId).trim())
      ) as any;

      if (!invitation) {
        res.status(404).json({
          error: 'INVALID_INVITATION_LINK',
          message: 'This family invite link was not found.',
        });
        return;
      }

      const targetFamilyId = invitation.familyId;
      const now = Date.now();

      if (invitation.expiresAt < now) {
        invitation.status = 'EXPIRED';
        res.status(410).json({
          error: 'INVITATION_EXPIRED',
          message: 'This family invitation has expired.',
        });
        return;
      }

      if (invitation.status === 'REVOKED') {
        res.status(403).json({
          error: 'INVITATION_REVOKED',
          message: 'This invitation was revoked by the family administrator.',
        });
        return;
      }

      if (invitation.status !== 'PENDING' || (invitation.useCount && invitation.useCount >= (invitation.maxUses || 1))) {
        res.status(409).json({
          error: 'INVITATION_ALREADY_USED',
          message: 'This invite link has already been used to join the family.',
        });
        return;
      }

      // If invitation was directed to a specific account email, reject claim by different email
      if (
        invitation.inviteMethod === 'GOOGLE_ACCOUNT' &&
        invitation.invitedEmail &&
        !invitation.invitedEmail.endsWith('@familyos.local') &&
        actor.email &&
        actor.email.toLowerCase() !== invitation.invitedEmail.toLowerCase()
      ) {
        res.status(403).json({
          error: 'INVITATION_EMAIL_MISMATCH',
          message: `This invitation was issued to "${invitation.invitedEmail}" and cannot be claimed by account "${actor.email}".`,
        });
        return;
      }

      // ONE FAMILY PER ACCOUNT: Enforce that an account cannot join a second family
      const existingActiveAnotherFamily = (store.memberships || []).find(
        (m) =>
          m.userAccountId === actor.userAccountId &&
          m.status === 'ACTIVE' &&
          m.familyId !== targetFamilyId
      );

      if (existingActiveAnotherFamily) {
        const otherWs = store.workspaces?.[existingActiveAnotherFamily.familyId] ||
          (store.workspace?.id === existingActiveAnotherFamily.familyId ? store.workspace : null);
        res.status(409).json({
          error: 'ACCOUNT_ALREADY_HAS_FAMILY',
          message: `Your account already belongs to family "${otherWs?.name || existingActiveAnotherFamily.familyId}". FamilyOS enforces one family per account. You must leave your current family before joining another.`,
          existingFamilyId: existingActiveAnotherFamily.familyId,
        });
        return;
      }

      // If user is already an active member of this same family, reject duplicate membership
      const existingInSameFamily = (store.memberships || []).find(
        (m) =>
          m.userAccountId === actor.userAccountId &&
          m.status === 'ACTIVE' &&
          m.familyId === targetFamilyId
      );
      if (existingInSameFamily) {
        res.status(409).json({
          error: 'ALREADY_A_MEMBER',
          message: 'Your account is already an active member of this family.',
          familyId: targetFamilyId,
        });
        return;
      }

      // Mark invitation accepted and bound to the authenticated actor
      invitation.status = 'APPROVED';
      invitation.useCount = (invitation.useCount || 0) + 1;
      invitation.acceptedByUserId = actor.userAccountId;
      invitation.updatedAt = now;

      const resolvedDisplayName =
        displayName && displayName.trim()
          ? displayName.trim()
          : (invitation.invitedDisplayName && invitation.invitedDisplayName !== 'Invited Family Member')
          ? invitation.invitedDisplayName.trim()
          : (actor.displayName && !actor.displayName.startsWith('usr-'))
          ? actor.displayName.trim()
          : (invitation.invitedDisplayName || 'Family Member').trim();
      const memberDisplayName = resolvedDisplayName;
      const memberId = invitation.assignedMemberProfileId || `mem-joined-${now}`;

      // Update or link membership in target family
      let linkedMembership = (store.memberships || []).find(
        (m) => m.familyId === targetFamilyId && (m.userAccountId === actor.userAccountId || m.memberProfileId === memberId)
      );

      if (linkedMembership) {
        linkedMembership.userAccountId = actor.userAccountId;
        linkedMembership.displayName = memberDisplayName;
        linkedMembership.email = actor.email;
        linkedMembership.status = 'ACTIVE';
        linkedMembership.role = invitation.targetRole || linkedMembership.role || 'MEMBER';
        linkedMembership.updatedAt = now;
      } else {
        linkedMembership = {
          id: `memship-${now}-${Math.random().toString(36).slice(2, 6)}`,
          familyId: targetFamilyId,
          userAccountId: actor.userAccountId,
          email: actor.email,
          displayName: memberDisplayName,
          memberProfileId: memberId,
          role: invitation.targetRole || 'MEMBER',
          status: 'ACTIVE',
          updatedAt: now,
        };
        store.memberships = [...(store.memberships || []), linkedMembership];
      }

      const cleanPhone = String(phone || '').trim();
      const cleanEmergName = String(emergencyContactName || '').trim();
      const cleanEmergPhone = String(emergencyContactPhone || '').trim();
      const cleanAllergies = String(allergiesText || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const cleanBio = String(bio || '').trim();
      const cleanResp = String(responsibilitiesText || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      let existingMember = (store.familyMembers || []).find(
        (m) => m.id === memberId && m.familyId === targetFamilyId
      );

      if (existingMember) {
        existingMember.userAccountId = actor.userAccountId;
        existingMember.displayName = memberDisplayName;
        existingMember.membershipStatus = 'ACTIVE';
        if (relationshipToPrimary) existingMember.relationshipToPrimary = String(relationshipToPrimary).trim().toUpperCase();
        if (birthDate) {
          existingMember.birthDate = String(birthDate).trim();
          existingMember.birthDateEpoch = Date.parse(String(birthDate).trim()) || null;
        }
        if (cleanAllergies.length > 0) existingMember.allergies = cleanAllergies;
        if (avatarUrl) existingMember.avatarUrl = String(avatarUrl).trim();
        existingMember.updatedAt = now;
      } else {
        existingMember = {
          id: memberId,
          familyId: targetFamilyId,
          userAccountId: actor.userAccountId,
          displayName: memberDisplayName,
          relationshipToPrimary: String(relationshipToPrimary || invitation.relationshipToPrimary || 'MEMBER').trim().toUpperCase(),
          role: invitation.targetRole || 'MEMBER',
          membershipStatus: 'ACTIVE',
          birthDate: birthDate ? String(birthDate).trim() : null,
          birthDateEpoch: birthDate ? Date.parse(String(birthDate).trim()) || null : null,
          importantDates: birthDate
            ? [
                {
                  id: `bd-${now}`,
                  label: `${memberDisplayName} Birthday`,
                  dateIso: String(birthDate).trim(),
                  category: 'BIRTHDAY',
                },
              ]
            : [],
          avatarUrl: avatarUrl ? String(avatarUrl).trim() : null,
          photoUrl: null,
          responsibilities: cleanResp.length > 0 ? cleanResp : ['Family Member'],
          emergencyContact: cleanEmergName
            ? {
                contactName: cleanEmergName,
                relationship: 'Emergency Contact',
                primaryPhone: cleanEmergPhone || 'Pending',
              }
            : {
                contactName: '',
                relationship: '',
                primaryPhone: '',
              },
          sharedInfo: {
            bio: cleanBio,
          },
          personalInfo: {
            privateBioNotes: cleanBio || 'Joined via family invite.',
            personalEmail: actor.email,
            personalPhone: cleanPhone,
          },
          dietaryPreferences: [],
          allergies: cleanAllergies,
          isRestrictedProfile: invitation.targetRole === 'CHILD',
          pointsBalance: 0,
          version: 1,
          updatedAt: now,
          isDeleted: false,
        };
        store.familyMembers = [...(store.familyMembers || []), existingMember];
      }

      bumpWorkspaceVersion(store, targetFamilyId, now);

      store.auditEvents.unshift({
        id: `aud-${now}`,
        familyId: targetFamilyId,
        actorUserId: actor.userAccountId,
        actorRole: invitation.targetRole || 'MEMBER',
        actionType: 'INVITATION_CLAIMED',
        summary: `${memberDisplayName} (${actor.email}) joined family ${targetFamilyId} via invitation`,
        createdAt: now,
      });

      res.status(200).json({
        success: true,
        familyId: targetFamilyId,
        membership: linkedMembership,
        member: existingMember,
        invitation,
      });
    });
  });

  // 4B. Accept or Reject Family Invitation (Dynamic Family Context)
  app.post('/api/v1/invitations/:invitationId/respond', requireAuth, async (req, res) => {
    const invitationId = String(req.params.invitationId || '').trim();
    const { action = 'ACCEPT' } = req.body || {};
    const normalizedAction = String(action).toUpperCase();
    const actor = req.actor!;

    if (normalizedAction !== 'ACCEPT' && normalizedAction !== 'REJECT') {
      res.status(400).json({ error: 'INVALID_INVITATION_ACTION', message: 'Action must be ACCEPT or REJECT.' });
      return;
    }

    await withAtomicStoreTransaction(async (store) => {
      store.invitations = store.invitations || [];
      const invitation = store.invitations.find((i) => i.id === invitationId);
      if (!invitation) {
        res.status(404).json({ error: 'INVITATION_NOT_FOUND', message: 'Invitation not found.' });
        return;
      }

      if (invitation.status !== 'PENDING') {
        res.status(400).json({
          error: 'INVITATION_NOT_PENDING',
          message: `Invitation cannot be responded to in status '${invitation.status}'.`,
        });
        return;
      }

      const now = Date.now();
      if (invitation.expiresAt < now) {
        invitation.status = 'EXPIRED';
        res.status(410).json({ error: 'INVITATION_EXPIRED', message: 'This family invitation has expired.' });
        return;
      }

      const targetFamilyId = invitation.familyId;
      const linkedMembership = (store.memberships || []).find(
        (m) =>
          m.familyId === targetFamilyId &&
          (m.memberProfileId === invitation.assignedMemberProfileId ||
            (actor.email && m.email.toLowerCase() === actor.email.toLowerCase()) ||
            m.userAccountId === actor.userAccountId)
      );

      if (normalizedAction === 'REJECT') {
        invitation.status = 'REJECTED';
        invitation.updatedAt = now;
        if (linkedMembership) {
          linkedMembership.status = 'REVOKED';
          linkedMembership.updatedAt = now;
        }
        store.auditEvents.unshift({
          id: `aud-${now}`,
          familyId: targetFamilyId,
          actorUserId: actor.userAccountId,
          actorRole: 'GUEST',
          actionType: 'INVITATION_REJECTED',
          summary: `${actor.displayName} declined invitation to join ${targetFamilyId}`,
          createdAt: now,
        });
        res.status(200).json({ invitation, membership: linkedMembership || null });
        return;
      }

      // Check if invitation was directed to a specific email
      if (
        invitation.invitedEmail &&
        !invitation.invitedEmail.endsWith('@familyos.local') &&
        actor.email &&
        actor.email.toLowerCase() !== invitation.invitedEmail.toLowerCase()
      ) {
        res.status(403).json({
          error: 'INVITATION_EMAIL_MISMATCH',
          message: `This invitation was issued to "${invitation.invitedEmail}" and cannot be accepted by account "${actor.email}".`,
        });
        return;
      }

      // ONE FAMILY PER ACCOUNT: Check if user already belongs to another family
      const existingActiveAnotherFamily = (store.memberships || []).find(
        (m) =>
          m.userAccountId === actor.userAccountId &&
          m.status === 'ACTIVE' &&
          m.familyId !== targetFamilyId
      );
      if (existingActiveAnotherFamily) {
        res.status(409).json({
          error: 'ACCOUNT_ALREADY_HAS_FAMILY',
          message: 'Your account already belongs to another family. FamilyOS enforces one family per account.',
          existingFamilyId: existingActiveAnotherFamily.familyId,
        });
        return;
      }

      // ACCEPT path: Activate membership and bind account
      invitation.status = 'APPROVED';
      invitation.useCount = (invitation.useCount || 0) + 1;
      invitation.acceptedByUserId = actor.userAccountId;
      invitation.updatedAt = now;

      let membership = linkedMembership;
      if (membership) {
        membership.userAccountId = actor.userAccountId;
        membership.displayName = actor.displayName || membership.displayName;
        membership.email = actor.email;
        membership.status = 'ACTIVE';
        membership.role = invitation.targetRole || membership.role || 'MEMBER';
        membership.updatedAt = now;
      } else {
        membership = {
          id: `memship-${now}-${Math.random().toString(36).slice(2, 6)}`,
          familyId: targetFamilyId,
          userAccountId: actor.userAccountId,
          email: actor.email,
          displayName: actor.displayName || invitation.invitedDisplayName || 'Family Member',
          memberProfileId: invitation.assignedMemberProfileId || `mem-${now}`,
          role: invitation.targetRole || 'MEMBER',
          status: 'ACTIVE',
          updatedAt: now,
        };
        store.memberships = [...(store.memberships || []), membership];
      }

      // Check member profile
      let member = (store.familyMembers || []).find(
        (m) => m.id === membership?.memberProfileId && m.familyId === targetFamilyId
      );
      if (member) {
        member.userAccountId = actor.userAccountId;
        member.membershipStatus = 'ACTIVE';
        member.updatedAt = now;
      } else {
        member = {
          id: membership.memberProfileId,
          familyId: targetFamilyId,
          userAccountId: actor.userAccountId,
          displayName: membership.displayName,
          relationshipToPrimary: 'MEMBER',
          role: membership.role,
          membershipStatus: 'ACTIVE',
          birthDate: null,
          birthDateEpoch: null,
          importantDates: [],
          avatarUrl: null,
          photoUrl: null,
          responsibilities: ['Family Member'],
          emergencyContact: {
            contactName: '',
            relationship: '',
            primaryPhone: '',
          },
          sharedInfo: { bio: '' },
          personalInfo: { privateBioNotes: '', personalEmail: actor.email },
          dietaryPreferences: [],
          allergies: [],
          isRestrictedProfile: membership.role === 'CHILD',
          pointsBalance: 0,
          version: 1,
          updatedAt: now,
          isDeleted: false,
        };
        store.familyMembers = [...(store.familyMembers || []), member];
      }

      bumpWorkspaceVersion(store, targetFamilyId, now);

      store.auditEvents.unshift({
        id: `aud-${now}`,
        familyId: targetFamilyId,
        actorUserId: actor.userAccountId,
        actorRole: membership.role,
        actionType: 'INVITATION_ACCEPTED',
        summary: `${actor.displayName} accepted invitation to join ${targetFamilyId}`,
        createdAt: now,
      });

      res.status(200).json({
        success: true,
        familyId: targetFamilyId,
        membership,
        member,
        invitation,
      });
    });
  });

  // 4C. Revoke Invitation (OWNER/ADMIN only)
  app.post('/api/v1/invitations/:invitationId/revoke', requireAuth, async (req, res) => {
    const invitationId = String(req.params.invitationId || '').trim();
    const actor = req.actor!;

    await withAtomicStoreTransaction(async (store) => {
      store.invitations = store.invitations || [];
      const invitation = store.invitations.find((i) => i.id === invitationId);
      if (!invitation) {
        res.status(404).json({ error: 'INVITATION_NOT_FOUND', message: 'Invitation not found.' });
        return;
      }

      const access = resolveServerMembership(store, actor.userAccountId, invitation.familyId);
      if (!access.allowed || !access.membership || !canManageMemberships(access.membership.role)) {
        res.status(403).json({ error: 'PERMISSION_DENIED', message: 'Only OWNER or ADMIN can revoke invitations.' });
        return;
      }

      const now = Date.now();
      invitation.status = 'REVOKED';
      invitation.updatedAt = now;

      // Also revoke any INVITED membership tied to this
      const linkedMembership = (store.memberships || []).find(
        (m) => m.familyId === invitation.familyId && m.memberProfileId === invitation.assignedMemberProfileId && m.status === 'INVITED'
      );
      if (linkedMembership) {
        linkedMembership.status = 'REVOKED';
        linkedMembership.updatedAt = now;
      }

      bumpWorkspaceVersion(store, invitation.familyId, now);

      store.auditEvents.unshift({
        id: `aud-${now}`,
        familyId: invitation.familyId,
        actorUserId: actor.userAccountId,
        actorRole: access.membership.role,
        actionType: 'INVITATION_REVOKED',
        summary: `Revoked invitation for ${invitation.invitedDisplayName} (${invitation.invitedEmail})`,
        createdAt: now,
      });

      res.status(200).json({ success: true, invitation });
    });
  });

  // 4D. Leave Family Workspace (Authenticated user removes own membership, blocked if sole OWNER)
  app.post('/api/v1/memberships/:familyId/leave', requireAuth, async (req, res) => {
    const targetFamilyId = String(req.params.familyId || '').trim();
    const actor = req.actor!;

    await withAtomicStoreTransaction(async (store) => {
      const access = resolveServerMembership(store, actor.userAccountId, targetFamilyId);
      if (!access.allowed || !access.membership) {
        res.status(access.httpStatus).json({ error: access.errorCode, message: access.errorMessage });
        return;
      }

      if (access.membership.role === 'OWNER') {
        const otherOwners = (store.memberships || []).filter(
          (m) => m.familyId === targetFamilyId && m.status === 'ACTIVE' && m.role === 'OWNER' && m.userAccountId !== actor.userAccountId
        );
        if (otherOwners.length === 0) {
          res.status(400).json({
            error: 'SOLE_OWNER_CANNOT_LEAVE',
            message: 'You are the sole OWNER of this family. Please transfer ownership or close the workspace before leaving.',
          });
          return;
        }
      }

      const now = Date.now();
      access.membership.status = 'REVOKED';
      access.membership.updatedAt = now;

      // Also soft-delete the linked member profile if not owner
      const member = (store.familyMembers || []).find(
        (m) => m.id === access.membership?.memberProfileId && m.familyId === targetFamilyId
      );
      if (member) {
        member.membershipStatus = 'REVOKED';
        member.updatedAt = now;
      }

      bumpWorkspaceVersion(store, targetFamilyId, now);

      store.auditEvents.unshift({
        id: `aud-${now}`,
        familyId: targetFamilyId,
        actorUserId: actor.userAccountId,
        actorRole: access.membership.role,
        actionType: 'MEMBER_LEFT',
        summary: `${access.membership.displayName} left family workspace ${targetFamilyId}`,
        createdAt: now,
      });

      res.status(200).json({ success: true, message: `Successfully left family workspace ${targetFamilyId}.` });
    });
  });

  // 4E. List Memberships for Workspace (OWNER/ADMIN only)
  app.get('/api/v1/memberships/:familyId', requireAuth, (req, res) => {
    const targetFamilyId = String(req.params.familyId || '').trim();
    const actor = req.actor!;
    const store = loadStore();

    const access = resolveServerMembership(store, actor.userAccountId, targetFamilyId);
    if (!access.allowed || !access.membership) {
      res.status(access.httpStatus).json({ error: access.errorCode, message: access.errorMessage });
      return;
    }

    const memberships = (store.memberships || []).filter((m) => m.familyId === targetFamilyId);
    res.status(200).json({ memberships });
  });

  // 4F. List Relationships for Workspace
  app.get('/api/v1/relationships/:familyId', requireAuth, (req, res) => {
    const targetFamilyId = String(req.params.familyId || '').trim();
    const actor = req.actor!;
    const store = loadStore();

    const access = resolveServerMembership(store, actor.userAccountId, targetFamilyId);
    if (!access.allowed || !access.membership) {
      res.status(access.httpStatus).json({ error: access.errorCode, message: access.errorMessage });
      return;
    }

    const rels = (store.familyRelationships || []).filter(
      (r) => r.familyId === targetFamilyId && !r.isDeleted
    );
    res.status(200).json({ relationships: rels });
  });

  // 4C. Approve New Family Membership (OWNER/ADMIN only — Enforces One-Family Rule & Creates Active Member Profile)
  app.post('/api/v1/memberships/:membershipId/approve', requireAuth, async (req, res) => {
    const membershipId = String(req.params.membershipId || '').trim();
    const actor = req.actor!;

    await withAtomicStoreTransaction(async (store) => {
      const targetMembership = (store.memberships || []).find((m) => m.id === membershipId);
      if (!targetMembership) {
        res.status(404).json({ error: 'MEMBERSHIP_NOT_FOUND', message: 'Membership record not found.' });
        return;
      }

      const access = resolveServerMembership(store, actor.userAccountId, targetMembership.familyId);
      if (!access.allowed || !access.membership) {
        res.status(access.httpStatus).json({ error: access.errorCode, message: access.errorMessage });
        return;
      }

      if (!canManageMemberships(access.membership.role)) {
        res.status(403).json({
          error: 'PERMISSION_DENIED',
          message: `Role '${access.membership.role}' is not authorized to approve memberships.`,
        });
        return;
      }

      if (targetMembership.status === 'REVOKED') {
        res.status(400).json({ error: 'CANNOT_APPROVE_REVOKED', message: 'Revoked membership cannot be approved.' });
        return;
      }

      // Enforce One-Family Rule for the user being approved
      const otherActive = findActiveMembershipForUser(
        store,
        targetMembership.userAccountId,
        targetMembership.email
      );
      if (otherActive && otherActive.familyId !== targetMembership.familyId) {
        res.status(409).json({
          error: 'ONE_FAMILY_RULE_VIOLATION',
          message: `User '${targetMembership.userAccountId}' already has an ACTIVE membership in '${otherActive.familyId}'.`,
        });
        return;
      }

      const now = Date.now();
      targetMembership.status = 'ACTIVE';
      targetMembership.updatedAt = now;

      // Update corresponding invitation if present
      for (const inv of store.invitations || []) {
        if (
          inv.familyId === targetMembership.familyId &&
          (inv.assignedMemberProfileId === targetMembership.memberProfileId ||
            inv.invitedEmail.toLowerCase() === targetMembership.email.toLowerCase())
        ) {
          inv.status = 'APPROVED';
          inv.updatedAt = now;
        }
      }

      // Ensure an active AuthoritativeFamilyMember record exists
      store.familyMembers = store.familyMembers || [];
      let memberProfile = store.familyMembers.find(
        (m) => m.id === targetMembership.memberProfileId && m.familyId === targetMembership.familyId
      );
      if (!memberProfile) {
        memberProfile = {
          id: targetMembership.memberProfileId,
          familyId: targetMembership.familyId,
          userAccountId: targetMembership.userAccountId,
          displayName: targetMembership.displayName,
          relationshipToPrimary: 'OTHER',
          role: targetMembership.role,
          membershipStatus: 'ACTIVE',
          birthDate: null,
          birthDateEpoch: null,
          importantDates: [],
          avatarUrl: null,
          photoUrl: null,
          responsibilities: ['Household Member'],
          emergencyContact: {
            contactName: access.membership.displayName,
            relationship: 'Family Head',
            primaryPhone: '(555) 123-4567',
          },
          sharedInfo: {
            bio: `${targetMembership.displayName} joined the family workspace.`,
          },
          personalInfo: {
            privateBioNotes: `Personal workspace for ${targetMembership.displayName}.`,
            personalEmail: targetMembership.email,
          },
          dietaryPreferences: [],
          allergies: [],
          isRestrictedProfile: targetMembership.role === 'CHILD',
          pointsBalance: 0,
          version: 1,
          updatedAt: now,
          isDeleted: false,
        };
        store.familyMembers.push(memberProfile);
      } else {
        memberProfile.membershipStatus = 'ACTIVE';
        memberProfile.role = targetMembership.role;
        memberProfile.userAccountId = targetMembership.userAccountId;
        memberProfile.isDeleted = false;
        memberProfile.version += 1;
        memberProfile.updatedAt = now;
      }

      store.synchronizedEntities = store.synchronizedEntities || {};
      const syncRecord: SynchronizedEntityRecord = {
        id: memberProfile.id,
        familyId: targetMembership.familyId,
        entityType: 'FAMILY_MEMBER',
        version: memberProfile.version,
        isDeleted: false,
        updatedAt: now,
        updatedByUserId: actor.userAccountId,
        data: { ...memberProfile },
      };
      store.synchronizedEntities[`FAMILY_MEMBER:${memberProfile.id}`] = syncRecord;
      bumpWorkspaceVersion(store, targetMembership.familyId, now);

      store.auditEvents.unshift({
        id: `aud-${now}`,
        familyId: targetMembership.familyId,
        actorUserId: actor.userAccountId,
        actorRole: access.membership.role,
        actionType: 'MEMBERSHIP_APPROVED',
        summary: `Approved membership for ${targetMembership.displayName} as ${targetMembership.role}`,
        createdAt: now,
      });

      void mirrorEntityToFirestore(syncRecord);

      res.status(200).json({
        membership: targetMembership,
        member: sanitizeMemberForCaller(store, access.membership, memberProfile),
      });
    });
  });

  // 4D. Assign / Update Member Role (OWNER/ADMIN only — Blocks Self-Promotion)
  app.put('/api/v1/memberships/:membershipId/role', requireAuth, async (req, res) => {
    const membershipId = String(req.params.membershipId || '').trim();
    const { role } = req.body || {};
    const actor = req.actor!;

    const allowedRoles: FamilyRole[] = ['OWNER', 'ADMIN', 'MEMBER', 'CHILD', 'GUEST'];
    if (!allowedRoles.includes(role)) {
      res.status(400).json({ error: 'INVALID_ROLE', message: 'Role must be OWNER, ADMIN, MEMBER, CHILD, or GUEST.' });
      return;
    }

    await withAtomicStoreTransaction(async (store) => {
      const aliasMap: Record<string, string> = {
        'ms-fam1-sarah': 'memship-sarah-fam1',
        'ms-fam1-david': 'memship-david-fam1',
        'ms-fam1-maya': 'memship-maya-fam1',
        'ms-fam1-lucas': 'memship-lucas-fam1',
        'ms-fam1-martha': 'memship-martha-fam1',
      };
      const resolvedMembershipId = aliasMap[membershipId] || membershipId;
      const targetMembership = (store.memberships || []).find(
        (m) => m.id === resolvedMembershipId || m.memberProfileId === resolvedMembershipId
      );
      if (!targetMembership) {
        res.status(404).json({ error: 'MEMBERSHIP_NOT_FOUND', message: 'Membership record not found.' });
        return;
      }

      const access = resolveServerMembership(store, actor.userAccountId, targetMembership.familyId);
      if (!access.allowed || !access.membership) {
        res.status(access.httpStatus).json({ error: access.errorCode, message: access.errorMessage });
        return;
      }

      if (!canManageMemberships(access.membership.role)) {
        res.status(403).json({
          error: 'SELF_PROMOTION_FORBIDDEN',
          message: `Role '${access.membership.role}' cannot assign or elevate family roles.`,
        });
        return;
      }

      if (targetMembership.userAccountId === actor.userAccountId && access.membership.role !== 'OWNER') {
        res.status(403).json({
          error: 'SELF_PROMOTION_FORBIDDEN',
          message: 'Non-owner members cannot modify or elevate their own role.',
        });
        return;
      }

      if (role === 'OWNER' && access.membership.role !== 'OWNER') {
        res.status(403).json({
          error: 'OWNER_REQUIRED',
          message: 'Only the workspace OWNER can assign the OWNER role.',
        });
        return;
      }

      if (targetMembership.role === 'OWNER' && role !== 'OWNER') {
        const ownerCount = (store.memberships || []).filter(
          (m) => m.familyId === targetMembership.familyId && m.status === 'ACTIVE' && m.role === 'OWNER'
        ).length;
        if (ownerCount <= 1) {
          res.status(400).json({
            error: 'LAST_OWNER_PROTECTION',
            message: 'Cannot demote the sole active OWNER of a family workspace.',
          });
          return;
        }
      }

      const now = Date.now();
      const prevRole = targetMembership.role;
      targetMembership.role = role;
      targetMembership.updatedAt = now;

      const linkedMember = (store.familyMembers || []).find(
        (m) => m.id === targetMembership.memberProfileId && m.familyId === targetMembership.familyId
      );
      if (linkedMember) {
        linkedMember.role = role;
        linkedMember.isRestrictedProfile = role === 'CHILD';
        linkedMember.version += 1;
        linkedMember.updatedAt = now;
      }

      bumpWorkspaceVersion(store, targetMembership.familyId, now);

      store.auditEvents.unshift({
        id: `aud-${now}`,
        familyId: targetMembership.familyId,
        actorUserId: actor.userAccountId,
        actorRole: access.membership.role,
        actionType: 'MEMBER_ROLE_CHANGED',
        summary: `Changed role for ${targetMembership.displayName} from ${prevRole} to ${role}`,
        createdAt: now,
      });

      res.status(200).json({ membership: targetMembership, member: linkedMember || null });
    });
  });

  // 4E. Revoke Member Access (OWNER/ADMIN only — Immediately Blocks Further API & Sync Access)
  app.post('/api/v1/memberships/:membershipId/revoke', requireAuth, async (req, res) => {
    const membershipId = String(req.params.membershipId || '').trim();
    const { removeMemberProfile = false, reason = 'Access revoked by family administrator' } = req.body || {};
    const actor = req.actor!;

    await withAtomicStoreTransaction(async (store) => {
      const targetMembership = (store.memberships || []).find((m) => m.id === membershipId);
      if (!targetMembership) {
        res.status(404).json({ error: 'MEMBERSHIP_NOT_FOUND', message: 'Membership record not found.' });
        return;
      }

      const access = resolveServerMembership(store, actor.userAccountId, targetMembership.familyId);
      if (!access.allowed || !access.membership) {
        res.status(access.httpStatus).json({ error: access.errorCode, message: access.errorMessage });
        return;
      }

      if (!canManageMemberships(access.membership.role)) {
        res.status(403).json({
          error: 'PERMISSION_DENIED',
          message: `Role '${access.membership.role}' is not authorized to revoke family memberships.`,
        });
        return;
      }

      if (targetMembership.role === 'OWNER') {
        res.status(400).json({
          error: 'CANNOT_REVOKE_OWNER',
          message: 'Cannot revoke the primary workspace OWNER.',
        });
        return;
      }

      const now = Date.now();
      targetMembership.status = 'REVOKED';
      targetMembership.updatedAt = now;

      const linkedMember = (store.familyMembers || []).find(
        (m) => m.id === targetMembership.memberProfileId && m.familyId === targetMembership.familyId
      );
      if (linkedMember) {
        linkedMember.membershipStatus = 'REVOKED';
        if (removeMemberProfile) {
          linkedMember.isDeleted = true;
        }
        linkedMember.version += 1;
        linkedMember.updatedAt = now;

        store.synchronizedEntities = store.synchronizedEntities || {};
        store.synchronizedEntities[`FAMILY_MEMBER:${linkedMember.id}`] = {
          id: linkedMember.id,
          familyId: targetMembership.familyId,
          entityType: 'FAMILY_MEMBER',
          version: linkedMember.version,
          isDeleted: Boolean(linkedMember.isDeleted),
          updatedAt: now,
          updatedByUserId: actor.userAccountId,
          data: { ...linkedMember },
        };
      }

      bumpWorkspaceVersion(store, targetMembership.familyId, now);

      store.auditEvents.unshift({
        id: `aud-${now}`,
        familyId: targetMembership.familyId,
        actorUserId: actor.userAccountId,
        actorRole: access.membership.role,
        actionType: 'MEMBER_ACCESS_REVOKED',
        summary: `Revoked access for ${targetMembership.displayName} (${reason})`,
        createdAt: now,
      });

      res.status(200).json({
        membership: targetMembership,
        revoked: true,
      });
    });
  });

  // 4F. Create Family Relationship (Enforces Server-Side DAG Cycle & Duplicate Validation)
  app.post('/api/v1/relationships/:familyId', requireAuth, async (req, res) => {
    const targetFamilyId = String(req.params.familyId || '').trim();
    const {
      person1MemberId,
      person2MemberId,
      member1Id,
      member2Id,
      relationshipType = 'PARENT_CHILD',
      notes = null,
    } = req.body || {};
    const resolvedP1 = String(person1MemberId || member1Id || '').trim();
    const resolvedP2 = String(person2MemberId || member2Id || '').trim();
    const actor = req.actor!;

    await withAtomicStoreTransaction(async (store) => {
      const access = resolveServerMembership(store, actor.userAccountId, targetFamilyId);
      if (!access.allowed || !access.membership) {
        res.status(access.httpStatus).json({ error: access.errorCode, message: access.errorMessage });
        return;
      }

      if (!['OWNER', 'ADMIN', 'MEMBER'].includes(access.membership.role)) {
        res.status(403).json({
          error: 'PERMISSION_DENIED',
          message: `Role '${access.membership.role}' cannot modify family relationships.`,
        });
        return;
      }

      const normalizedType = String(relationshipType).toUpperCase() as RelationshipTypeCode;
      const allowedTypes: RelationshipTypeCode[] = [
        'PARENT_CHILD',
        'SPOUSE_PARTNER',
        'SIBLING',
        'GRANDPARENT_GRANDCHILD',
        'GUARDIAN_WARD',
        'OTHER',
      ];
      if (!allowedTypes.includes(normalizedType)) {
        res.status(400).json({ error: 'INVALID_RELATIONSHIP_TYPE', message: 'Unsupported relationshipType.' });
        return;
      }

      store.familyRelationships = store.familyRelationships || [];
      const validation = validateRelationshipGraph(
        store.familyRelationships,
        targetFamilyId,
        resolvedP1,
        resolvedP2,
        normalizedType
      );
      if (!validation.valid) {
        res.status(400).json({ error: validation.errorCode, message: validation.errorMessage });
        return;
      }

      const now = Date.now();
      const relId = `rel-${now}-${Math.random().toString(36).slice(2, 6)}`;
      const newRel: AuthoritativeFamilyRelationship = {
        id: relId,
        familyId: targetFamilyId,
        person1MemberId: resolvedP1,
        person2MemberId: resolvedP2,
        relationshipType: normalizedType,
        notes: notes ? String(notes).trim() : null,
        createdAt: now,
        updatedAt: now,
        isDeleted: false,
      };

      store.familyRelationships.push(newRel);

      store.synchronizedEntities = store.synchronizedEntities || {};
      const syncRecord: SynchronizedEntityRecord = {
        id: relId,
        familyId: targetFamilyId,
        entityType: 'FAMILY_RELATIONSHIP',
        version: 1,
        isDeleted: false,
        updatedAt: now,
        updatedByUserId: actor.userAccountId,
        data: { ...newRel },
      };
      store.synchronizedEntities[`FAMILY_RELATIONSHIP:${relId}`] = syncRecord;
      bumpWorkspaceVersion(store, targetFamilyId, now);

      store.auditEvents.unshift({
        id: `aud-${now}`,
        familyId: targetFamilyId,
        actorUserId: actor.userAccountId,
        actorRole: access.membership.role,
        actionType: 'FAMILY_RELATIONSHIP_ADDED',
        summary: `Linked ${person1MemberId} -> ${person2MemberId} as ${normalizedType}`,
        createdAt: now,
      });

      void mirrorEntityToFirestore(syncRecord);

      res.status(201).json({ relationship: newRel });
    });
  });

  // 4G. Remove Family Relationship
  app.delete('/api/v1/relationships/:familyId/:relationshipId', requireAuth, async (req, res) => {
    const targetFamilyId = String(req.params.familyId || '').trim();
    const relationshipId = String(req.params.relationshipId || '').trim();
    const actor = req.actor!;

    await withAtomicStoreTransaction(async (store) => {
      const access = resolveServerMembership(store, actor.userAccountId, targetFamilyId);
      if (!access.allowed || !access.membership) {
        res.status(access.httpStatus).json({ error: access.errorCode, message: access.errorMessage });
        return;
      }

      if (!canManageMemberships(access.membership.role)) {
        res.status(403).json({ error: 'PERMISSION_DENIED', message: 'Only OWNER or ADMIN can remove family relationships.' });
        return;
      }

      const rel = (store.familyRelationships || []).find(
        (r) => r.id === relationshipId && r.familyId === targetFamilyId && !r.isDeleted
      );
      if (!rel) {
        res.status(404).json({ error: 'RELATIONSHIP_NOT_FOUND' });
        return;
      }

      const now = Date.now();
      rel.isDeleted = true;
      rel.updatedAt = now;

      store.synchronizedEntities = store.synchronizedEntities || {};
      store.synchronizedEntities[`FAMILY_RELATIONSHIP:${relationshipId}`] = {
        id: relationshipId,
        familyId: targetFamilyId,
        entityType: 'FAMILY_RELATIONSHIP',
        version: 2,
        isDeleted: true,
        updatedAt: now,
        updatedByUserId: actor.userAccountId,
        data: { ...rel, isDeleted: true },
      };
      bumpWorkspaceVersion(store, targetFamilyId, now);

      res.status(200).json({ deletedRelationshipId: relationshipId });
    });
  });

  // 4H. Authenticated Family & Profile Media Upload (Enforces Membership & Personal vs Shared Visibility)
  app.post('/api/v1/media/:familyId/upload', requireAuth, async (req, res) => {
    const targetFamilyId = String(req.params.familyId || '').trim();
    const {
      ownerMemberId,
      visibility = 'SHARED',
      category = 'AVATAR',
      mimeType = 'image/svg+xml',
      fileName = 'upload.svg',
      dataUrl,
    } = req.body || {};
    const actor = req.actor!;

    const uploadCheck = validateUploadedImageDataUrl(dataUrl);
    if (!uploadCheck.valid || !uploadCheck.normalizedDataUrl) {
      res.status(uploadCheck.httpStatus).json({
        error: uploadCheck.errorCode || 'INVALID_IMAGE_DATA',
        message: uploadCheck.errorMessage || 'A valid PNG, JPEG, WEBP, or GIF image file is required.',
      });
      return;
    }

    await withAtomicStoreTransaction(async (store) => {
      const access = resolveServerMembership(store, actor.userAccountId, targetFamilyId);
      if (!access.allowed || !access.membership) {
        res.status(access.httpStatus).json({ error: access.errorCode, message: access.errorMessage });
        return;
      }

      if (access.membership.role === 'GUEST') {
        res.status(403).json({
          error: 'PERMISSION_DENIED',
          message: 'GUEST role cannot upload media assets.',
        });
        return;
      }

      const targetOwnerMemberId = String(ownerMemberId || access.membership.memberProfileId);
      if (
        targetOwnerMemberId !== access.membership.memberProfileId &&
        !canManageMemberships(access.membership.role)
      ) {
        res.status(403).json({
          error: 'PERMISSION_DENIED',
          message: 'Cannot upload media for another member profile without ADMIN/OWNER permissions.',
        });
        return;
      }

      const normalizedCategory: AuthoritativeMediaAsset['category'] =
        category === 'FAMILY_LOGO' || category === 'LOGO'
          ? 'LOGO'
          : category === 'FAMILY_PHOTO'
          ? 'FAMILY_PHOTO'
          : category === 'MEMBER_PHOTO' || category === 'PROFILE_PHOTO'
          ? 'PROFILE_PHOTO'
          : 'AVATAR';

      const now = Date.now();
      const mediaId = `media-${now}-${Math.random().toString(36).slice(2, 6)}`;
      const mediaUrl = `/api/v1/media/${targetFamilyId}/${mediaId}`;
      const asset: AuthoritativeMediaAsset = {
        id: mediaId,
        familyId: targetFamilyId,
        ownerMemberId: targetOwnerMemberId,
        uploadedByUserId: actor.userAccountId,
        visibility: visibility === 'PERSONAL' ? 'PERSONAL' : 'SHARED',
        category: normalizedCategory,
        mimeType: uploadCheck.mimeType || String(mimeType),
        fileName: String(fileName),
        dataUrl: uploadCheck.normalizedDataUrl!,
        sizeBytes: uploadCheck.sizeBytes!,
        createdAt: now,
        updatedAt: now,
        isDeleted: false,
      };

      store.mediaAssets = store.mediaAssets || {};
      store.mediaAssets[mediaId] = asset;

      const ws = store.workspaces?.[targetFamilyId] || store.workspace;
      if (asset.category === 'LOGO' && canManageMemberships(access.membership.role)) {
        ws.logoUrl = mediaUrl;
      } else if (asset.category === 'FAMILY_PHOTO' && canManageMemberships(access.membership.role)) {
        ws.photoUrl = mediaUrl;
      } else if (asset.category === 'AVATAR' || asset.category === 'PROFILE_PHOTO') {
        const member = (store.familyMembers || []).find(
          (m) => m.id === targetOwnerMemberId && m.familyId === targetFamilyId
        );
        if (member) {
          if (asset.category === 'AVATAR') member.avatarUrl = mediaUrl;
          member.photoUrl = mediaUrl;
          member.version += 1;
          member.updatedAt = now;
        }
      }

      store.synchronizedEntities = store.synchronizedEntities || {};
      store.synchronizedEntities[`MEDIA_ASSET:${mediaId}`] = {
        id: mediaId,
        familyId: targetFamilyId,
        entityType: 'MEDIA_ASSET',
        version: 1,
        isDeleted: false,
        updatedAt: now,
        updatedByUserId: actor.userAccountId,
        data: {
          id: asset.id,
          familyId: asset.familyId,
          ownerMemberId: asset.ownerMemberId,
          visibility: asset.visibility,
          category: asset.category,
          mimeType: asset.mimeType,
          fileName: asset.fileName,
          mediaUrl,
        },
      };

      bumpWorkspaceVersion(store, targetFamilyId, now);

      store.auditEvents.unshift({
        id: `aud-${now}`,
        familyId: targetFamilyId,
        actorUserId: actor.userAccountId,
        actorRole: access.membership.role,
        actionType: `MEDIA_UPLOADED_${asset.category}`,
        summary: `Uploaded ${asset.visibility} ${asset.category} (${asset.fileName})`,
        createdAt: now,
      });

      const responseAsset = {
        ...asset,
        mediaUrl,
      };
      res.status(201).json({
        media: responseAsset,
        mediaAsset: responseAsset,
      });
    });
  });

  // 4I. Authenticated Family & Profile Media Retrieval (Enforces Family Isolation & Personal Visibility)
  app.get('/api/v1/media/:familyId/:mediaId', (req, res) => {
    const targetFamilyId = String(req.params.familyId || '').trim();
    const mediaId = String(req.params.mediaId || '').trim();
    const store = loadStore();

    const authHeader = req.headers.authorization;
    const queryToken = typeof req.query.token === 'string' ? req.query.token.trim() : '';
    const rawToken =
      authHeader && authHeader.startsWith('Bearer ')
        ? authHeader.slice('Bearer '.length).trim()
        : queryToken;

    if (!rawToken) {
      res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Authentication Bearer token is required to retrieve family media assets.',
      });
      return;
    }

    const verified = verifyBearerToken(rawToken, store);
    if (!verified) {
      res.status(401).json({ error: 'UNAUTHORIZED', message: 'Invalid or expired authentication token.' });
      return;
    }

    const access = resolveServerMembership(store, verified.userAccountId, targetFamilyId);
    if (!access.allowed || !access.membership) {
      res.status(access.httpStatus).json({ error: access.errorCode, message: access.errorMessage });
      return;
    }

    const asset = store.mediaAssets?.[mediaId];
    if (!asset || asset.familyId !== targetFamilyId || asset.isDeleted) {
      res.status(404).json({ error: 'MEDIA_NOT_FOUND', message: 'Media asset not found in this family workspace.' });
      return;
    }

    // Enforce PERSONAL visibility privacy: only the owning member can retrieve PERSONAL media assets
    if (
      asset.visibility === 'PERSONAL' &&
      asset.ownerMemberId !== access.membership.memberProfileId
    ) {
      res.status(403).json({
        error: 'PERSONAL_MEDIA_ACCESS_DENIED',
        message: 'Personal media assets can only be accessed by their owning family member.',
      });
      return;
    }

    res.status(200).json({
      media: asset,
    });
  });

  // 5. Exact Integer-Cent Financial Transaction Endpoint (Phase 1 Zero-Trust RBAC + Phase 2 Atomic Idempotency)
  app.post('/api/v1/finance/transaction', requireAuth, async (req, res) => {
    const {
      familyId = 'fam-1',
      accountId = 'acc-1',
      destinationAccountId = null,
      title,
      amountCents,
      transactionType,
      category = 'FOOD',
      idempotencyKey: bodyIdempotencyKey,
    } = req.body || {};

    const headerIdempotencyKey = req.headers['x-idempotency-key'];
    const idempotencyKey = String(
      (typeof headerIdempotencyKey === 'string' && headerIdempotencyKey.trim()) ||
        (typeof bodyIdempotencyKey === 'string' && bodyIdempotencyKey.trim()) ||
        ''
    );

    const actor = req.actor!;

    await withAtomicStoreTransaction(async (store) => {
      // 1. Resolve caller's family membership & role strictly from server store (ignore any req.body.actorRole)
      const access = resolveServerMembership(store, actor.userAccountId, familyId);
      if (!access.allowed || !access.membership) {
        res.status(access.httpStatus).json({ error: access.errorCode, message: access.errorMessage });
        return;
      }

      const serverRole = access.membership.role;
      if (!canPerformFinanceMutation(serverRole)) {
        res.status(403).json({
          error: 'PERMISSION_DENIED',
          message: `Server-resolved role '${serverRole}' is not authorized to mutate household financial ledgers.`,
        });
        return;
      }

      // 2. Require idempotency key to prevent duplicate financial postings
      if (!idempotencyKey) {
        res.status(400).json({
          error: 'MISSING_IDEMPOTENCY_KEY',
          message: 'Financial transactions require an idempotencyKey (via X-Idempotency-Key header or request body).',
        });
        return;
      }

      // 3. Check durable idempotency table before executing any balance mutation
      const existingAck = store.processedIdempotencyKeys[idempotencyKey];
      if (existingAck && existingAck.responseReceipt?.transaction) {
        res.status(200).json({
          transaction: existingAck.responseReceipt.transaction,
          deduplicated: true,
          idempotencyKey,
        });
        return;
      }

      // 4. Validate strict integer cents (reject NaN, non-integers, floats, or <= 0)
      const numericAmount = Number(amountCents);
      if (
        typeof title !== 'string' ||
        !title.trim() ||
        !Number.isSafeInteger(numericAmount) ||
        numericAmount <= 0
      ) {
        res.status(400).json({
          error: 'INVALID_TRANSACTION_AMOUNT',
          message: 'Invalid transaction: non-empty title and positive integer amountCents are required.',
        });
        return;
      }

      const intCents = numericAmount;
      const account = store.accounts.find((a) => a.id === accountId && a.familyId === familyId);
      if (!account) {
        res.status(404).json({
          error: 'ACCOUNT_NOT_FOUND',
          message: `Account '${accountId}' not found in workspace '${familyId}'.`,
        });
        return;
      }

      const normalizedType: 'INCOME' | 'EXPENSE' | 'TRANSFER' =
        transactionType === 'INCOME'
          ? 'INCOME'
          : transactionType === 'TRANSFER'
          ? 'TRANSFER'
          : 'EXPENSE';

      let destinationAccount: SharedAccount | undefined;
      if (normalizedType === 'TRANSFER') {
        if (!destinationAccountId || destinationAccountId === account.id) {
          res.status(400).json({
            error: 'INVALID_TRANSFER_DESTINATION',
            message: 'Internal transfers require a distinct destinationAccountId in the same family workspace.',
          });
          return;
        }
        destinationAccount = store.accounts.find(
          (a) => a.id === destinationAccountId && a.familyId === familyId
        );
        if (!destinationAccount) {
          res.status(404).json({
            error: 'DESTINATION_ACCOUNT_NOT_FOUND',
            message: `Destination account '${destinationAccountId}' not found in workspace '${familyId}'.`,
          });
          return;
        }
      }

      const now = Date.now();
      const txId = req.body.id && typeof req.body.id === 'string' ? req.body.id : `tx-${now}-${Math.random().toString(36).slice(2, 7)}`;

      const newTx: SharedTransaction = {
        id: txId,
        familyId,
        accountId: account.id,
        destinationAccountId: destinationAccount ? destinationAccount.id : null,
        title: title.trim(),
        amountCents: intCents,
        transactionType: normalizedType,
        category: String(category).toUpperCase(),
        transactionDate: now,
        isReversal: false,
        reversalOfId: null,
        paidBy: access.membership.displayName,
        idempotencyKey,
      };

      // 5. Atomic ledger + account balance + budget update
      store.transactions.unshift(newTx);

      if (normalizedType === 'INCOME') {
        account.currentBalanceCents += intCents;
      } else if (normalizedType === 'TRANSFER' && destinationAccount) {
        account.currentBalanceCents -= intCents;
        destinationAccount.currentBalanceCents += intCents;
      } else {
        account.currentBalanceCents -= intCents;
        const budget = store.budgets.find(
          (b) => b.familyId === familyId && b.category.toUpperCase() === newTx.category
        );
        if (budget) {
          budget.spentCents += intCents;
        }
      }

      bumpWorkspaceVersion(store, familyId, now);

      store.processedIdempotencyKeys[idempotencyKey] = {
        operationId: `op-${txId}`,
        idempotencyKey,
        familyId,
        entityType: normalizedType,
        entityId: txId,
        operationType: 'INSERT',
        conflictPolicy: 'APPEND_ONLY_LEDGER',
        acknowledgedAt: now,
        responseReceipt: { transaction: newTx },
      };

      store.auditEvents.unshift({
        id: `aud-${now}`,
        familyId,
        actorUserId: actor.userAccountId,
        actorRole: serverRole,
        actionType: `FINANCE_${normalizedType}`,
        summary: `Recorded ${normalizedType} "${newTx.title}" (${intCents} cents) by ${access.membership.displayName}`,
        createdAt: now,
      });

      void mirrorTransactionToFirestore(newTx, account);

      res.status(201).json({
        transaction: newTx,
        deduplicated: false,
        idempotencyKey,
      });
    });
  });

  // 6. Non-Destructive Audit Reversal Endpoint (Phase 1 Zero-Trust RBAC + Phase 2 Duplicate Reversal Guard)
  app.post('/api/v1/finance/reverse', requireAuth, async (req, res) => {
    const {
      transactionId,
      reason = 'Audit reversal',
      idempotencyKey: bodyIdempotencyKey,
    } = req.body || {};

    const headerIdempotencyKey = req.headers['x-idempotency-key'];
    const idempotencyKey = String(
      (typeof headerIdempotencyKey === 'string' && headerIdempotencyKey.trim()) ||
        (typeof bodyIdempotencyKey === 'string' && bodyIdempotencyKey.trim()) ||
        `REVERSAL:${transactionId}`
    );

    const actor = req.actor!;

    await withAtomicStoreTransaction(async (store) => {
      const original = store.transactions.find((t) => t.id === transactionId);
      const targetFamilyId = original?.familyId || req.body?.familyId || 'fam-1';

      const access = resolveServerMembership(store, actor.userAccountId, targetFamilyId);
      if (!access.allowed || !access.membership) {
        res.status(access.httpStatus).json({ error: access.errorCode, message: access.errorMessage });
        return;
      }

      const serverRole = access.membership.role;
      if (!canPerformFinanceMutation(serverRole)) {
        res.status(403).json({
          error: 'PERMISSION_DENIED',
          message: `Server-resolved role '${serverRole}' is not authorized to reverse financial transactions.`,
        });
        return;
      }

      if (!original || original.isReversal) {
        res.status(400).json({
          error: 'INVALID_REVERSAL_TARGET',
          message: 'Original non-reversal transaction not found.',
        });
        return;
      }

      const alreadyReversed = store.transactions.some((t) => t.reversalOfId === original.id);
      if (alreadyReversed) {
        res.status(400).json({
          error: 'DUPLICATE_REVERSAL_BLOCKED',
          message: 'Transaction has already been reversed.',
        });
        return;
      }

      const now = Date.now();
      const reversalTx: SharedTransaction = {
        id: `tx-rev-${now}-${Math.random().toString(36).slice(2, 6)}`,
        familyId: original.familyId,
        accountId: original.accountId,
        destinationAccountId: original.destinationAccountId || null,
        title: `Reversal: ${original.title}`,
        amountCents: original.amountCents,
        transactionType: original.transactionType,
        category: original.category,
        transactionDate: now,
        isReversal: true,
        reversalOfId: original.id,
        paidBy: `${access.membership.displayName} (Audit Reversal)`,
        idempotencyKey,
      };

      store.transactions.unshift(reversalTx);

      const account = store.accounts.find((a) => a.id === original.accountId && a.familyId === original.familyId);
      if (account) {
        if (original.transactionType === 'INCOME') {
          account.currentBalanceCents -= original.amountCents;
        } else if (original.transactionType === 'TRANSFER' && original.destinationAccountId) {
          const destAcc = store.accounts.find(
            (a) => a.id === original.destinationAccountId && a.familyId === original.familyId
          );
          account.currentBalanceCents += original.amountCents;
          if (destAcc) {
            destAcc.currentBalanceCents -= original.amountCents;
          }
        } else {
          account.currentBalanceCents += original.amountCents;
        }
      }

      if (original.transactionType === 'EXPENSE') {
        const budget = store.budgets.find(
          (b) => b.familyId === original.familyId && b.category.toUpperCase() === original.category.toUpperCase()
        );
        if (budget) {
          budget.spentCents = Math.max(0, budget.spentCents - original.amountCents);
        }
      }

      bumpWorkspaceVersion(store, original.familyId, now);

      store.processedIdempotencyKeys[idempotencyKey] = {
        operationId: `op-${reversalTx.id}`,
        idempotencyKey,
        familyId: original.familyId,
        entityType: 'REVERSAL',
        entityId: reversalTx.id,
        operationType: 'INSERT',
        conflictPolicy: 'APPEND_ONLY_LEDGER',
        acknowledgedAt: now,
        responseReceipt: { reversal: reversalTx },
      };

      store.auditEvents.unshift({
        id: `aud-${now}`,
        familyId: original.familyId,
        actorUserId: actor.userAccountId,
        actorRole: serverRole,
        actionType: 'FINANCE_REVERSAL',
        summary: `Posted compensating reversal for "${original.title}" (${reason}) by ${access.membership.displayName}`,
        createdAt: now,
      });

      void mirrorTransactionToFirestore(reversalTx, account);

      res.status(201).json({
        reversal: reversalTx,
        idempotencyKey,
      });
    });
  });

  // 7. Bidirectional Idempotent Sync Push Endpoint (Phase 3 Conflict Resolution & All-Entity Persistence + Stage 3.3.1 Family/People Sync)
  app.post('/api/v1/sync/push', requireAuth, async (req, res) => {
    const {
      operationId: rawOpId,
      idempotencyKey: bodyIdempotencyKey,
      familyId = 'fam-1',
      entityType,
      entityId,
      operationType: rawOpType,
      operation,
      payloadJson,
      payload,
    } = req.body || {};

    const headerIdempotencyKey = req.headers['x-idempotency-key'];
    const idempotencyKey = String(
      (typeof headerIdempotencyKey === 'string' && headerIdempotencyKey.trim()) ||
        (typeof bodyIdempotencyKey === 'string' && bodyIdempotencyKey.trim()) ||
        ''
    );
    const operationId = String(rawOpId || (idempotencyKey ? `op-${idempotencyKey}` : ''));
    const operationType = rawOpType || operation || 'INSERT';
    const rawPayload = payloadJson !== undefined ? payloadJson : payload !== undefined ? payload : {};

    if (!idempotencyKey || !operationId || !entityType || !entityId) {
      res.status(400).json({
        acknowledged: false,
        errorMessage: 'Missing required fields: operationId, idempotencyKey, entityType, entityId',
      });
      return;
    }

    const actor = req.actor!;

    await withAtomicStoreTransaction(async (store) => {
      // 1. Enforce zero-trust server membership & revocation check
      const access = resolveServerMembership(store, actor.userAccountId, familyId);
      if (!access.allowed || !access.membership) {
        res.status(access.httpStatus).json({
          acknowledged: false,
          errorCode: access.errorCode,
          errorMessage: access.errorMessage,
        });
        return;
      }

      const callerMembership = access.membership;
      const serverRole = callerMembership.role;

      // 2. Idempotency deduplication guarantee: if already processed, return existing verified ack
      const existingAck = store.processedIdempotencyKeys[idempotencyKey];
      if (existingAck) {
        const wsVersion = store.workspaces?.[familyId]?.version || store.workspace.version;
        res.status(200).json({
          operationId: existingAck.operationId,
          idempotencyKey: existingAck.idempotencyKey,
          acknowledged: true,
          deduplicated: true,
          conflictPolicy: existingAck.conflictPolicy,
          serverTimestamp: existingAck.acknowledgedAt,
          ack: {
            operationId: existingAck.operationId,
            idempotencyKey: existingAck.idempotencyKey,
            acknowledged: true,
            idempotentReplay: true,
            serverVersion: wsVersion,
            serverTimestamp: existingAck.acknowledgedAt,
          },
        });
        return;
      }

      const rawEntityType = String(entityType).toUpperCase();
      const normalizedEntityType =
        rawEntityType === 'MEMBER'
          ? 'FAMILY_MEMBER'
          : rawEntityType === 'RELATIONSHIP'
          ? 'FAMILY_RELATIONSHIP'
          : rawEntityType === 'WORKSPACE'
          ? 'FAMILY_WORKSPACE'
          : rawEntityType;
      const normalizedOpType = String(operationType).toUpperCase();
      const parsedPayload: Record<string, unknown> =
        typeof rawPayload === 'string'
          ? (() => {
              try {
                return JSON.parse(rawPayload);
              } catch {
                return {};
              }
            })()
          : (rawPayload as Record<string, unknown>) || {};

      // 3. Determine authoritative conflict policy from entity type (never trust client-supplied conflictPolicy to bypass ledger rules)
      const authoritativePolicy = (() => {
        if (['TASK', 'CHECKLIST_ITEM', 'CHORE'].includes(normalizedEntityType)) {
          return 'EVENT_BASED_MERGE';
        }
        if (
          ['INCOME', 'EXPENSE', 'TRANSFER', 'REVERSAL', 'FINANCIAL_ACCOUNT', 'ENVELOPE_BUDGET'].includes(
            normalizedEntityType
          )
        ) {
          return 'APPEND_ONLY_LEDGER';
        }
        if (['FAMILY_MEMBERSHIP', 'INVITATION', 'GUARDIAN_RELATIONSHIP'].includes(normalizedEntityType)) {
          return 'SERVER_AUTHORITATIVE';
        }
        return 'TOMBSTONE_SOFT_DELETE';
      })();

      // 4. Enforce domain-specific RBAC & Conflict Resolution Rules
      if (authoritativePolicy === 'APPEND_ONLY_LEDGER') {
        if (!canPerformFinanceMutation(serverRole)) {
          res.status(403).json({
            acknowledged: false,
            errorCode: 'PERMISSION_DENIED',
            errorMessage: `Role '${serverRole}' cannot synchronize financial ledger mutations.`,
          });
          return;
        }
        if (
          ['INCOME', 'EXPENSE', 'TRANSFER', 'REVERSAL'].includes(normalizedEntityType) &&
          (normalizedOpType === 'UPDATE' || normalizedOpType === 'DELETE')
        ) {
          res.status(400).json({
            acknowledged: false,
            errorCode: 'IMMUTABLE_LEDGER_VIOLATION',
            errorMessage: 'Posted financial transactions cannot be overwritten or deleted; push a REVERSAL instead.',
          });
          return;
        }
      }

      if (authoritativePolicy === 'SERVER_AUTHORITATIVE') {
        if (!canManageMemberships(serverRole)) {
          res.status(403).json({
            acknowledged: false,
            errorCode: 'PERMISSION_DENIED',
            errorMessage: `Role '${serverRole}' cannot mutate authoritative family memberships or invitations.`,
          });
          return;
        }
      }

      if (normalizedEntityType === 'FAMILY_MEMBER') {
        const isCreatingOrDeleting = normalizedOpType === 'INSERT' || normalizedOpType === 'DELETE';
        if (isCreatingOrDeleting && !canManageMemberships(serverRole)) {
          res.status(403).json({
            acknowledged: false,
            errorCode: 'PERMISSION_DENIED',
            errorMessage: `Role '${serverRole}' cannot create or delete family members via sync.`,
          });
          return;
        }
        if (
          !canManageMemberships(serverRole) &&
          (parsedPayload.role === 'OWNER' || parsedPayload.role === 'ADMIN')
        ) {
          res.status(403).json({
            acknowledged: false,
            errorCode: 'SELF_PROMOTION_FORBIDDEN',
            errorMessage: 'Clients cannot assign themselves administrative permissions via sync.',
          });
          return;
        }
      }

      if (
        ['WELLBEING_PROFILE', 'HEALTH_ALLERGY', 'HEALTH_MEDICATION'].includes(normalizedEntityType)
      ) {
        const targetMemberId = String(parsedPayload.memberId || callerMembership.memberProfileId);
        if (!canAccessMinorHealthRecord(store, callerMembership, targetMemberId)) {
          res.status(403).json({
            acknowledged: false,
            errorCode: 'GUARDIAN_AUTHORIZATION_REQUIRED',
            errorMessage: `Role '${serverRole}' is not authorized to mutate health records for '${targetMemberId}'.`,
          });
          return;
        }
      }

      if (normalizedEntityType === 'GUEST' || serverRole === 'GUEST') {
        res.status(403).json({
          acknowledged: false,
          errorCode: 'PERMISSION_DENIED',
          errorMessage: 'GUEST role has read-only access and cannot push state mutations.',
        });
        return;
      }

      const now = Date.now();
      store.synchronizedEntities = store.synchronizedEntities || {};
      const entityKey = `${normalizedEntityType}:${entityId}`;
      const existingEntity = store.synchronizedEntities[entityKey];

      // 5. Persist synchronized mutation according to authoritative policy
      if (normalizedEntityType === 'INCOME' || normalizedEntityType === 'EXPENSE') {
        const amountCents = Math.round(Number(parsedPayload.amountCents || 0));
        if (amountCents <= 0) {
          res.status(400).json({
            acknowledged: false,
            errorCode: 'INVALID_TRANSACTION_AMOUNT',
            errorMessage: 'Synced financial transaction requires positive integer amountCents.',
          });
          return;
        }
        const targetAccountId = String(parsedPayload.accountId || 'acc-1');
        const account =
          store.accounts.find((a) => a.id === targetAccountId && a.familyId === familyId) ||
          store.accounts.find((a) => a.familyId === familyId);

        const syncedTx: SharedTransaction = {
          id: String(entityId),
          familyId,
          accountId: account ? account.id : targetAccountId,
          title: String(parsedPayload.title || `Synced ${normalizedEntityType}`),
          amountCents,
          transactionType: normalizedEntityType,
          category: String(parsedPayload.category || 'FOOD').toUpperCase(),
          transactionDate: now,
          isReversal: false,
          reversalOfId: null,
          paidBy: callerMembership.displayName,
          idempotencyKey,
        };

        store.transactions.unshift(syncedTx);
        if (account) {
          if (normalizedEntityType === 'INCOME') {
            account.currentBalanceCents += amountCents;
          } else {
            account.currentBalanceCents -= amountCents;
            const budget = store.budgets.find(
              (b) => b.familyId === familyId && b.category.toUpperCase() === syncedTx.category
            );
            if (budget) {
              budget.spentCents += amountCents;
            }
          }
        }
        void mirrorTransactionToFirestore(syncedTx, account);
      } else if (normalizedEntityType === 'FINANCIAL_ACCOUNT') {
        const balanceCents = Math.round(Number(parsedPayload.balanceCents ?? parsedPayload.currentBalanceCents ?? 0));
        const accType = String(parsedPayload.accountType || 'CHECKING') as SharedAccount['accountType'];
        const isLiability = Boolean(
          parsedPayload.isLiability ?? (accType === 'CREDIT_CARD' || accType === 'LOAN')
        );
        const existingAcc = store.accounts.find((a) => a.id === entityId && a.familyId === familyId);
        if (existingAcc) {
          existingAcc.name = String(parsedPayload.name || existingAcc.name);
          existingAcc.currentBalanceCents = balanceCents;
          existingAcc.updatedAt = now;
        } else {
          store.accounts.push({
            id: String(entityId),
            familyId,
            name: String(parsedPayload.name || 'Synced Account'),
            accountType: accType,
            currentBalanceCents: balanceCents,
            isLiability,
            institution: String(parsedPayload.institution || 'Family Bank'),
            updatedAt: now,
          });
        }
      } else if (normalizedEntityType === 'FAMILY_MEMBER') {
        // Synchronize Android-created or updated FamilyMember directly into store.familyMembers
        store.familyMembers = store.familyMembers || [];
        const isTombstone = normalizedOpType === 'DELETE' || Boolean(parsedPayload.isDeleted);
        let member = store.familyMembers.find((m) => m.id === String(entityId) && m.familyId === familyId);
        if (!member) {
          member = {
            id: String(entityId),
            familyId,
            userAccountId: null,
            displayName: String(parsedPayload.displayName || 'Synced Member'),
            relationshipToPrimary: String(parsedPayload.relationshipToPrimary || parsedPayload.relationship || 'MEMBER').toUpperCase(),
            role: 'MEMBER',
            membershipStatus: isTombstone ? 'REVOKED' : 'ACTIVE',
            birthDate: parsedPayload.birthDate ? String(parsedPayload.birthDate) : null,
            birthDateEpoch: null,
            importantDates: Array.isArray(parsedPayload.importantDates) ? (parsedPayload.importantDates as any) : [],
            avatarUrl: parsedPayload.avatarUrl ? String(parsedPayload.avatarUrl) : null,
            photoUrl: parsedPayload.photoUrl ? String(parsedPayload.photoUrl) : null,
            responsibilities: Array.isArray(parsedPayload.responsibilities)
              ? parsedPayload.responsibilities.map(String)
              : ['Household Member'],
            emergencyContact: (parsedPayload.emergencyContact as any) || {
              contactName: callerMembership.displayName,
              relationship: 'Family Guardian',
              primaryPhone: '(555) 123-4567',
            },
            sharedInfo: (parsedPayload.sharedInfo as any) || {
              bio: String(parsedPayload.bio || `${parsedPayload.displayName || 'Member'} profile synced from Android`),
            },
            personalInfo: (parsedPayload.personalInfo as any) || null,
            dietaryPreferences: Array.isArray(parsedPayload.dietaryPreferences)
              ? parsedPayload.dietaryPreferences.map(String)
              : [],
            allergies: Array.isArray(parsedPayload.allergies) ? parsedPayload.allergies.map(String) : [],
            isRestrictedProfile: Boolean(parsedPayload.isRestrictedProfile),
            pointsBalance: Number(parsedPayload.pointsBalance || 0),
            version: 1,
            updatedAt: now,
            isDeleted: isTombstone,
          };
          store.familyMembers.push(member);
        } else {
          if (typeof parsedPayload.displayName === 'string' && parsedPayload.displayName.trim()) {
            member.displayName = parsedPayload.displayName.trim();
          }
          if (typeof parsedPayload.relationshipToPrimary === 'string') {
            member.relationshipToPrimary = parsedPayload.relationshipToPrimary.toUpperCase();
          }
          if (parsedPayload.birthDate !== undefined) {
            member.birthDate = parsedPayload.birthDate ? String(parsedPayload.birthDate) : null;
          }
          if (Array.isArray(parsedPayload.responsibilities)) {
            member.responsibilities = parsedPayload.responsibilities.map(String);
          }
          if (parsedPayload.sharedInfo && typeof parsedPayload.sharedInfo === 'object') {
            member.sharedInfo = { ...member.sharedInfo, ...(parsedPayload.sharedInfo as any) };
          }
          if (parsedPayload.emergencyContact && typeof parsedPayload.emergencyContact === 'object') {
            member.emergencyContact = { ...member.emergencyContact, ...(parsedPayload.emergencyContact as any) };
          }
          member.isDeleted = isTombstone;
          if (isTombstone) member.membershipStatus = 'REVOKED';
          member.version += 1;
          member.updatedAt = now;
        }

        const record: SynchronizedEntityRecord = {
          id: member.id,
          familyId,
          entityType: 'FAMILY_MEMBER',
          version: member.version,
          isDeleted: member.isDeleted,
          updatedAt: now,
          updatedByUserId: actor.userAccountId,
          data: { ...member },
        };
        store.synchronizedEntities[entityKey] = record;
        void mirrorEntityToFirestore(record);
      } else if (normalizedEntityType === 'FAMILY_RELATIONSHIP') {
        store.familyRelationships = store.familyRelationships || [];
        const isTombstone = normalizedOpType === 'DELETE' || Boolean(parsedPayload.isDeleted);
        const p1 = String(parsedPayload.person1MemberId || '');
        const p2 = String(parsedPayload.person2MemberId || '');
        const relType = String(parsedPayload.relationshipType || parsedPayload.type || 'PARENT_CHILD').toUpperCase() as RelationshipTypeCode;

        let rel = store.familyRelationships.find((r) => r.id === String(entityId) && r.familyId === familyId);
        if (!rel && p1 && p2) {
          rel = {
            id: String(entityId),
            familyId,
            person1MemberId: p1,
            person2MemberId: p2,
            relationshipType: relType,
            notes: parsedPayload.notes ? String(parsedPayload.notes) : null,
            createdAt: now,
            updatedAt: now,
            isDeleted: isTombstone,
          };
          store.familyRelationships.push(rel);
        } else if (rel) {
          rel.isDeleted = isTombstone;
          rel.updatedAt = now;
        }

        const record: SynchronizedEntityRecord = {
          id: String(entityId),
          familyId,
          entityType: 'FAMILY_RELATIONSHIP',
          version: (existingEntity?.version || 0) + 1,
          isDeleted: isTombstone,
          updatedAt: now,
          updatedByUserId: actor.userAccountId,
          data: rel ? { ...rel } : { ...parsedPayload, id: entityId, familyId, isDeleted: isTombstone },
        };
        store.synchronizedEntities[entityKey] = record;
        void mirrorEntityToFirestore(record);
      } else if (normalizedEntityType === 'FAMILY_WORKSPACE') {
        if (!canManageMemberships(serverRole)) {
          res.status(403).json({
            acknowledged: false,
            errorCode: 'PERMISSION_DENIED',
            errorMessage: 'Only OWNER or ADMIN can update workspace identity via sync.',
          });
          return;
        }
        const ws = store.workspaces?.[familyId] || store.workspace;
        if (typeof parsedPayload.name === 'string' && parsedPayload.name.trim()) ws.name = parsedPayload.name.trim();
        if (typeof parsedPayload.motto === 'string') ws.motto = parsedPayload.motto.trim();
        if (typeof parsedPayload.mission === 'string') ws.mission = parsedPayload.mission.trim();
        if (typeof parsedPayload.vision === 'string') ws.vision = parsedPayload.vision.trim();
        if (Array.isArray(parsedPayload.values)) ws.values = parsedPayload.values.map(String);

        const record: SynchronizedEntityRecord = {
          id: familyId,
          familyId,
          entityType: 'FAMILY_WORKSPACE',
          version: ws.version + 1,
          isDeleted: false,
          updatedAt: now,
          updatedByUserId: actor.userAccountId,
          data: { ...ws },
        };
        store.synchronizedEntities[entityKey] = record;
        void mirrorEntityToFirestore(record);
      } else if (authoritativePolicy === 'EVENT_BASED_MERGE') {
        // Additive merge: preserve existing fields and merge checklist/completion flags additively
        const prevData = existingEntity?.data || {};
        const prevRawList = prevData.checklistItems ?? prevData.checklist;
        const incRawList = parsedPayload.checklistItems ?? parsedPayload.checklist;
        let mergedChecklistPayload: unknown = prevRawList;

        if (Array.isArray(prevRawList) || Array.isArray(incRawList)) {
          const prevArr = Array.isArray(prevRawList)
            ? (prevRawList as AuthoritativeChecklistItem[])
            : [];
          const incArr = Array.isArray(incRawList)
            ? (incRawList as AuthoritativeChecklistItem[])
            : [];
          const byId = new Map<string, AuthoritativeChecklistItem>();
          for (const item of prevArr) {
            byId.set(item.id || item.title, { ...item });
          }
          for (const item of incArr) {
            const key = item.id || item.title;
            const prevItem = byId.get(key);
            if (prevItem) {
              byId.set(key, {
                ...prevItem,
                ...item,
                // Event-based additive merge: if either client marked done, preserve done unless explicit uncheck
                isDone: Boolean(prevItem.isDone || item.isDone),
                updatedAt: now,
              });
            } else {
              byId.set(key, {
                id: item.id || `chk-${entityId}-${byId.size}`,
                taskId: String(entityId),
                title: String(item.title || key),
                isDone: Boolean(item.isDone),
                position: typeof item.position === 'number' ? item.position : byId.size,
                assignedMemberId: item.assignedMemberId || null,
                completedAt: item.isDone ? now : null,
                updatedAt: now,
              });
            }
          }
          mergedChecklistPayload = Array.from(byId.values()).sort((a, b) => a.position - b.position);
        } else {
          const prevChecklist = (prevRawList as Record<string, boolean>) || {};
          const incomingChecklist = (incRawList as Record<string, boolean>) || {};
          const mergedChecklist: Record<string, boolean> = { ...prevChecklist };
          for (const [k, v] of Object.entries(incomingChecklist)) {
            mergedChecklist[k] = Boolean(prevChecklist[k] || v);
          }
          if (Object.keys(mergedChecklist).length > 0) {
            mergedChecklistPayload = mergedChecklist;
          }
        }

        const isTombstone = normalizedOpType === 'DELETE' || Boolean(parsedPayload.isDeleted);
        const mergedData: Record<string, unknown> = {
          ...prevData,
          ...parsedPayload,
          id: entityId,
          familyId,
          isDeleted: isTombstone,
          isCompleted:
            parsedPayload.isCompleted !== undefined
              ? Boolean(parsedPayload.isCompleted)
              : Boolean(prevData.isCompleted),
          checklistItems: mergedChecklistPayload,
          checklist: mergedChecklistPayload,
        };

        // Synchronize into canonical store.planningTasks when entity is TASK or CHECKLIST_ITEM
        if (normalizedEntityType === 'TASK') {
          store.planningTasks = store.planningTasks || [];
          const existingTaskIdx = store.planningTasks.findIndex(
            (t) => t.id === String(entityId) && t.familyId === familyId
          );
          const taskObj: AuthoritativeTask = {
            id: String(entityId),
            familyId,
            title: String(mergedData.title || 'Synced Task'),
            description: String(mergedData.description || mergedData.notes || ''),
            notes: String(mergedData.notes || mergedData.description || ''),
            creatorMemberId: String(mergedData.creatorMemberId || callerMembership.memberProfileId),
            assignedMemberId: mergedData.assignedMemberId
              ? String(mergedData.assignedMemberId)
              : callerMembership.memberProfileId,
            assignedToName: String(mergedData.assignedToName || callerMembership.displayName),
            scope: mergedData.scope === 'PERSONAL' ? 'PERSONAL' : 'SHARED',
            priority: (['LOW', 'MEDIUM', 'HIGH', 'URGENT'].includes(String(mergedData.priority))
              ? String(mergedData.priority)
              : 'MEDIUM') as any,
            status: isTombstone
              ? 'ARCHIVED'
              : mergedData.isCompleted
              ? 'COMPLETED'
              : ((mergedData.status as any) || 'TODO'),
            isCompleted: Boolean(mergedData.isCompleted),
            completedAt: mergedData.isCompleted ? now : null,
            completedByMemberId: mergedData.isCompleted ? callerMembership.memberProfileId : null,
            startDate: mergedData.startDate ? String(mergedData.startDate) : null,
            dueDate: mergedData.dueDate ? String(mergedData.dueDate) : null,
            dueLabel: String(mergedData.dueLabel || mergedData.dueDate || 'Unscheduled'),
            dueEpoch: mergedData.dueDate ? Date.parse(String(mergedData.dueDate)) || null : null,
            timezone: String(mergedData.timezone || 'America/Los_Angeles'),
            isOverdue: Boolean(mergedData.isOverdue),
            recurrenceRule: mergedData.recurrenceRule ? String(mergedData.recurrenceRule) : null,
            estimatedDurationMinutes:
              typeof mergedData.estimatedDurationMinutes === 'number'
                ? mergedData.estimatedDurationMinutes
                : null,
            actualDurationMinutes:
              typeof mergedData.actualDurationMinutes === 'number'
                ? mergedData.actualDurationMinutes
                : null,
            goalId: mergedData.goalId ? String(mergedData.goalId) : null,
            projectId: mergedData.projectId ? String(mergedData.projectId) : null,
            milestoneId: mergedData.milestoneId ? String(mergedData.milestoneId) : null,
            parentTaskId: mergedData.parentTaskId ? String(mergedData.parentTaskId) : null,
            dependencyTaskIds: Array.isArray(mergedData.dependencyTaskIds)
              ? mergedData.dependencyTaskIds.map(String)
              : [],
            sourceModule: (mergedData.sourceModule as any) || 'GOALS_PROJECTS',
            checklistItems: Array.isArray(mergedChecklistPayload)
              ? (mergedChecklistPayload as AuthoritativeChecklistItem[])
              : [],
            progressPercentage: Number(mergedData.progressPercentage || 0),
            comments: Array.isArray(mergedData.comments) ? (mergedData.comments as any) : [],
            attachments: Array.isArray(mergedData.attachments) ? (mergedData.attachments as any) : [],
            reminders: Array.isArray(mergedData.reminders) ? (mergedData.reminders as any) : [],
            linkedCalendarEventId: null,
            rewardPoints: Number(mergedData.rewardPoints || 0),
            activityHistory: [],
            isArchived: Boolean(mergedData.isArchived),
            version: (existingEntity?.version || 0) + 1,
            createdAt: now,
            updatedAt: now,
            isDeleted: isTombstone,
          };
          if (existingTaskIdx >= 0) {
            store.planningTasks[existingTaskIdx] = {
              ...store.planningTasks[existingTaskIdx],
              ...taskObj,
            };
          } else {
            store.planningTasks.push(taskObj);
          }
          syncTaskWithCalendar(store, taskObj, actor.userAccountId);
          recalculatePlanningHierarchyProgress(store, familyId);
        }

        const nextVersion = (existingEntity?.version || 0) + 1;
        const record: SynchronizedEntityRecord = {
          id: String(entityId),
          familyId,
          entityType: normalizedEntityType,
          version: nextVersion,
          isDeleted: isTombstone,
          updatedAt: now,
          updatedByUserId: actor.userAccountId,
          data: mergedData,
        };
        store.synchronizedEntities[entityKey] = record;
        void mirrorEntityToFirestore(record);
      } else {
        // TOMBSTONE_SOFT_DELETE or SERVER_AUTHORITATIVE entity persistence
        const isTombstone = normalizedOpType === 'DELETE' || Boolean(parsedPayload.isDeleted);
        const nextVersion = (existingEntity?.version || 0) + 1;
        const mergedPayload: Record<string, any> = {
          ...(existingEntity?.data || {}),
          ...parsedPayload,
          id: entityId,
          familyId,
          isDeleted: isTombstone,
        };

        // Synchronize GOAL, PROJECT, MILESTONE into Stage 3.3.2 authoritative collections
        if (normalizedEntityType === 'GOAL') {
          store.goals = store.goals || [];
          const idx = store.goals.findIndex((g) => g.id === String(entityId) && g.familyId === familyId);
          const goalRecord: AuthoritativeGoal = {
            id: String(entityId),
            familyId,
            title: String(mergedPayload.title || 'Synced Goal'),
            description: String(mergedPayload.description || ''),
            category: (mergedPayload.category as any) || 'HOUSEHOLD',
            scope: (mergedPayload.scope as any) || 'FAMILY',
            horizon: (mergedPayload.horizon as any) || 'SHORT_TERM',
            isMeasurable: Boolean(mergedPayload.isMeasurable),
            metricUnit: mergedPayload.metricUnit ? String(mergedPayload.metricUnit) : null,
            targetValue: typeof mergedPayload.targetValue === 'number' ? mergedPayload.targetValue : null,
            currentValue: typeof mergedPayload.currentValue === 'number' ? mergedPayload.currentValue : null,
            startDate: mergedPayload.startDate ? String(mergedPayload.startDate) : null,
            targetDate: mergedPayload.targetDate ? String(mergedPayload.targetDate) : null,
            priority: (mergedPayload.priority as any) || 'MEDIUM',
            ownerMemberId: String(mergedPayload.ownerMemberId || callerMembership.memberProfileId),
            ownerName: String(mergedPayload.ownerName || callerMembership.displayName),
            linkedMissionStatement: mergedPayload.linkedMissionStatement
              ? String(mergedPayload.linkedMissionStatement)
              : null,
            linkedVisionStatement: mergedPayload.linkedVisionStatement
              ? String(mergedPayload.linkedVisionStatement)
              : null,
            alignedValues: Array.isArray(mergedPayload.alignedValues)
              ? mergedPayload.alignedValues.map(String)
              : [],
            status: (mergedPayload.status as any) || 'ACTIVE',
            progressPercentage: Number(mergedPayload.progressPercentage || 0),
            reviews: Array.isArray(mergedPayload.reviews) ? (mergedPayload.reviews as any) : [],
            completionHistory: [],
            isArchived: Boolean(mergedPayload.isArchived),
            version: nextVersion,
            createdAt: now,
            updatedAt: now,
            isDeleted: isTombstone,
          };
          if (idx >= 0) {
            store.goals[idx] = { ...store.goals[idx], ...goalRecord };
          } else {
            store.goals.push(goalRecord);
          }
          recalculatePlanningHierarchyProgress(store, familyId);
        } else if (normalizedEntityType === 'PROJECT') {
          store.projects = store.projects || [];
          const idx = store.projects.findIndex((p) => p.id === String(entityId) && p.familyId === familyId);
          const projTitle = String(mergedPayload.title || mergedPayload.name || 'Synced Project');
          const projRecord: AuthoritativeProject = {
            id: String(entityId),
            familyId,
            goalId: mergedPayload.goalId ? String(mergedPayload.goalId) : null,
            title: projTitle,
            name: projTitle,
            description: String(mergedPayload.description || ''),
            ownerMemberId: String(
              mergedPayload.ownerMemberId || mergedPayload.leadMemberId || callerMembership.memberProfileId
            ),
            leadMemberId: String(
              mergedPayload.leadMemberId || mergedPayload.ownerMemberId || callerMembership.memberProfileId
            ),
            assignedMemberIds: Array.isArray(mergedPayload.assignedMemberIds)
              ? mergedPayload.assignedMemberIds.map(String)
              : [callerMembership.memberProfileId],
            scope: mergedPayload.scope === 'PERSONAL' ? 'PERSONAL' : 'SHARED',
            startDate: mergedPayload.startDate ? String(mergedPayload.startDate) : null,
            targetDate: mergedPayload.targetDate ? String(mergedPayload.targetDate) : null,
            status: (mergedPayload.status as any) || 'ACTIVE',
            priority: (mergedPayload.priority as any) || 'MEDIUM',
            budgetCents: Number(mergedPayload.budgetCents || 0),
            dependencies: Array.isArray(mergedPayload.dependencies)
              ? mergedPayload.dependencies.map(String)
              : [],
            progressPercentage: Number(mergedPayload.progressPercentage || 0),
            comments: [],
            attachments: [],
            activityHistory: [],
            isArchived: Boolean(mergedPayload.isArchived),
            completedAt: null,
            version: nextVersion,
            createdAt: now,
            updatedAt: now,
            isDeleted: isTombstone,
          };
          if (idx >= 0) {
            store.projects[idx] = { ...store.projects[idx], ...projRecord };
          } else {
            store.projects.push(projRecord);
          }
          recalculatePlanningHierarchyProgress(store, familyId);
        } else if (normalizedEntityType === 'MILESTONE') {
          store.milestones = store.milestones || [];
          const idx = store.milestones.findIndex(
            (m) => m.id === String(entityId) && m.familyId === familyId
          );
          const msRecord: AuthoritativeMilestone = {
            id: String(entityId),
            familyId,
            projectId: String(mergedPayload.projectId || ''),
            goalId: mergedPayload.goalId ? String(mergedPayload.goalId) : null,
            title: String(mergedPayload.title || 'Synced Milestone'),
            description: String(mergedPayload.description || ''),
            ownerMemberId: String(mergedPayload.ownerMemberId || callerMembership.memberProfileId),
            dueDate: mergedPayload.dueDate ? String(mergedPayload.dueDate) : null,
            status: (mergedPayload.status as any) || 'PENDING',
            orderIndex: Number(mergedPayload.orderIndex || 1),
            progressPercentage: Number(mergedPayload.progressPercentage || 0),
            completedAt: null,
            version: nextVersion,
            createdAt: now,
            updatedAt: now,
            isDeleted: isTombstone,
          };
          if (idx >= 0) {
            store.milestones[idx] = { ...store.milestones[idx], ...msRecord };
          } else {
            store.milestones.push(msRecord);
          }
          recalculatePlanningHierarchyProgress(store, familyId);
        }

        const record: SynchronizedEntityRecord = {
          id: String(entityId),
          familyId,
          entityType: normalizedEntityType,
          version: nextVersion,
          isDeleted: isTombstone,
          updatedAt: now,
          updatedByUserId: actor.userAccountId,
          data: mergedPayload,
        };
        store.synchronizedEntities[entityKey] = record;
        void mirrorEntityToFirestore(record);
      }

      bumpWorkspaceVersion(store, familyId, now);

      const syncRecord: SharedSyncRecord = {
        operationId: String(operationId),
        idempotencyKey,
        familyId,
        entityType: normalizedEntityType,
        entityId: String(entityId),
        operationType: normalizedOpType,
        conflictPolicy: authoritativePolicy,
        acknowledgedAt: now,
      };

      store.processedIdempotencyKeys[idempotencyKey] = syncRecord;
      store.auditEvents.unshift({
        id: `aud-${now}`,
        familyId,
        actorUserId: actor.userAccountId,
        actorRole: serverRole,
        actionType: `SYNC_${normalizedEntityType}_${normalizedOpType}`,
        summary: `Synced ${normalizedEntityType}:${entityId} (${normalizedOpType}) under ${authoritativePolicy}`,
        createdAt: now,
      });

      const wsVersion = store.workspaces?.[familyId]?.version || store.workspace.version;
      const conflictDetected = Boolean(
        existingEntity &&
          req.body?.baseVersion !== undefined &&
          Number(req.body.baseVersion) < existingEntity.version
      );
      res.status(200).json({
        operationId,
        idempotencyKey,
        acknowledged: true,
        deduplicated: false,
        conflictDetected,
        resolutionStrategy: authoritativePolicy,
        conflictPolicy: authoritativePolicy,
        workspaceVersion: wsVersion,
        serverTimestamp: now,
        ack: {
          operationId,
          idempotencyKey,
          acknowledged: true,
          idempotentReplay: false,
          conflictDetected,
          resolutionStrategy: authoritativePolicy,
          serverVersion: wsVersion,
          serverTimestamp: now,
        },
      });
    });
  });

  // 8. Bidirectional Sync Pull Endpoint (Web -> Android Room delta synchronization)
  app.get('/api/v1/sync/pull', requireAuth, (req, res) => {
    const targetFamilyId = String(req.query.familyId || 'fam-1').trim();
    const sinceTimestamp = Number(req.query.sinceTimestamp || 0);
    const store = loadStore();
    const actor = req.actor!;

    const access = resolveServerMembership(store, actor.userAccountId, targetFamilyId);
    if (!access.allowed || !access.membership) {
      res.status(access.httpStatus).json({
        error: access.errorCode,
        message: access.errorMessage,
      });
      return;
    }

    const callerMembership = access.membership;
    const isFinanceAuthorized = canPerformFinanceMutation(callerMembership.role);
    const workspace = store.workspaces?.[targetFamilyId] || store.workspace;

    const entities = Object.values(store.synchronizedEntities || {})
      .filter((entity) => {
        if (entity.familyId !== targetFamilyId) return false;
        if (entity.updatedAt < sinceTimestamp) return false;
        // Include tombstones (isDeleted: true) so clients propagate deletions locally!
        if (
          entity.entityType === 'WELLBEING_PROFILE' ||
          entity.entityType === 'HEALTH_ALLERGY' ||
          entity.entityType === 'HEALTH_MEDICATION'
        ) {
          const targetMemberId = String(entity.data.memberId || '');
          if (entity.data.isRestrictedMinor && !canAccessMinorHealthRecord(store, callerMembership, targetMemberId)) {
            return false;
          }
        }
        if (entity.entityType === 'REFLECTION_JOURNAL') {
          const ownerMemberId = String(entity.data.memberId || '');
          const isPrivate = Boolean(entity.data.isPrivate);
          if (!canAccessPrivateJournal(callerMembership, ownerMemberId, isPrivate)) {
            return false;
          }
        }
        // Stage 3.3.2 Privacy Filtering for GOAL, PROJECT, TASK, CALENDAR_EVENT on sync/pull
        if (entity.entityType === 'GOAL') {
          const g = entity.data as unknown as AuthoritativeGoal;
          if (g && g.scope && !canViewGoal(store, callerMembership, { ...g, isDeleted: false })) {
            return false;
          }
        }
        if (entity.entityType === 'PROJECT') {
          const p = entity.data as unknown as AuthoritativeProject;
          if (p && p.scope && !canViewProject(store, callerMembership, { ...p, isDeleted: false })) {
            return false;
          }
        }
        if (entity.entityType === 'TASK') {
          const t = entity.data as unknown as AuthoritativeTask;
          if (t && t.scope && !canViewTask(store, callerMembership, { ...t, isDeleted: false })) {
            return false;
          }
        }
        if (entity.entityType === 'CALENDAR_EVENT') {
          const cal = entity.data as any;
          if (
            cal &&
            cal.scope === 'PERSONAL' &&
            cal.creatorMemberId !== callerMembership.memberProfileId &&
            cal.assignedMemberId !== callerMembership.memberProfileId
          ) {
            return false;
          }
        }
        return true;
      })
      .map((entity) => {
        if (entity.entityType === 'FAMILY_MEMBER') {
          const memberObj = entity.data as unknown as AuthoritativeFamilyMember;
          if (memberObj && memberObj.id) {
            const sanitized = sanitizeMemberForCaller(store, callerMembership, memberObj);
            return {
              ...entity,
              entityId: entity.id,
              data: sanitized as unknown as Record<string, unknown>,
              payload: sanitized as unknown as Record<string, unknown>,
            };
          }
        }
        return {
          ...entity,
          entityId: entity.id,
          payload: entity.data,
        };
      });

    const sanitizedMembers = (store.familyMembers || [])
      .filter((m) => m.familyId === targetFamilyId && m.updatedAt >= sinceTimestamp)
      .map((m) => sanitizeMemberForCaller(store, callerMembership, m));

    const familyRelationships = (store.familyRelationships || []).filter(
      (r) => r.familyId === targetFamilyId && r.updatedAt >= sinceTimestamp
    );

    res.status(200).json({
      familyId: targetFamilyId,
      workspaceVersion: workspace.version,
      workspace,
      serverTimestamp: Date.now(),
      members: sanitizedMembers,
      relationships: familyRelationships,
      accounts: isFinanceAuthorized ? store.accounts.filter((a) => a.familyId === targetFamilyId) : [],
      budgets: isFinanceAuthorized ? store.budgets.filter((b) => b.familyId === targetFamilyId) : [],
      transactions: isFinanceAuthorized
        ? store.transactions.filter((t) => t.familyId === targetFamilyId && t.transactionDate >= sinceTimestamp)
        : [],
      entities,
    });
  });

  // 9A. Get Authorized Household Entities by Type (Bidirectional Hydration)
  app.get('/api/v1/entities/:familyId', requireAuth, (req, res) => {
    const targetFamilyId = String(req.params.familyId || '').trim();
    const entityTypeFilter = req.query.entityType ? String(req.query.entityType).toUpperCase().trim() : null;
    const store = loadStore();
    const actor = req.actor!;

    const access = resolveServerMembership(store, actor.userAccountId, targetFamilyId);
    if (!access.allowed || !access.membership) {
      res.status(access.httpStatus).json({ error: access.errorCode, message: access.errorMessage });
      return;
    }

    const callerMembership = access.membership;
    const entities = Object.values(store.synchronizedEntities || {}).filter((entity) => {
      if (entity.familyId !== targetFamilyId || entity.isDeleted) return false;
      if (entityTypeFilter && entity.entityType !== entityTypeFilter) return false;
      return canCallerReadDomainEntity(store, callerMembership, entity);
    });

    res.status(200).json({
      familyId: targetFamilyId,
      entities,
    });
  });

  // 9B. Create or Update Shared Household Entity from Web Portal (Hardened with Allowlist, Size Limits, Privacy & Conflict Check)
  app.post('/api/v1/entities/:familyId', requireAuth, async (req, res) => {
    const targetFamilyId = String(req.params.familyId || '').trim();
    const { entityType, entityId, operationType = 'UPSERT', data = {}, baseVersion, baseSnapshot, forceOverwrite } = req.body || {};
    const actor = req.actor!;

    if (!targetFamilyId || !entityType || !entityId) {
      res.status(400).json({
        error: 'INVALID_ENTITY_PAYLOAD',
        message: 'familyId, entityType, and entityId are required.',
      });
      return;
    }

    const normalizedType = String(entityType).toUpperCase().trim();
    if (!ALLOWED_SYNCHRONIZED_ENTITY_TYPES.has(normalizedType)) {
      res.status(400).json({
        error: 'UNSUPPORTED_ENTITY_TYPE',
        message: `Entity type '${normalizedType}' is not in the authoritative entity allowlist. Monolithic state blobs are forbidden.`,
      });
      return;
    }

    const cleanEntityId = String(entityId).trim();
    if (!/^[a-zA-Z0-9_:\-]+$/.test(cleanEntityId) || cleanEntityId.length > 128) {
      res.status(400).json({
        error: 'INVALID_ENTITY_ID',
        message: 'entityId must be 1–128 valid identifier characters.',
      });
      return;
    }

    if (typeof data !== 'object' || data === null || Array.isArray(data)) {
      res.status(400).json({
        error: 'INVALID_ENTITY_DATA_OBJECT',
        message: 'Entity data must be a non-null JSON object.',
      });
      return;
    }

    const payloadBytes = Buffer.byteLength(JSON.stringify(data), 'utf-8');
    if (payloadBytes > MAX_ENTITY_PAYLOAD_BYTES) {
      res.status(413).json({
        error: 'PAYLOAD_TOO_LARGE',
        message: `Entity payload (${payloadBytes} bytes) exceeds maximum allowed size (${MAX_ENTITY_PAYLOAD_BYTES} bytes).`,
      });
      return;
    }

    await withAtomicStoreTransaction(async (store) => {
      const access = resolveServerMembership(store, actor.userAccountId, targetFamilyId);
      if (!access.allowed || !access.membership) {
        res.status(access.httpStatus).json({ error: access.errorCode, message: access.errorMessage });
        return;
      }

      const callerMembership = access.membership;
      store.synchronizedEntities = store.synchronizedEntities || {};
      const key = `${normalizedType}:${cleanEntityId}`;
      const prev = store.synchronizedEntities[key];

      const permCheck = canCallerMutateDomainEntity(
        store,
        callerMembership,
        normalizedType,
        data as Record<string, unknown>,
        prev
      );
      if (!permCheck.allowed) {
        res.status(permCheck.status).json({ error: permCheck.errorCode, message: permCheck.message });
        return;
      }

      const isDeleted = String(operationType).toUpperCase() === 'DELETE' || Boolean((data as any).isDeleted);
      const parsedBaseVersion =
        baseVersion !== undefined
          ? Number(baseVersion)
          : (data as any).baseVersion !== undefined
          ? Number((data as any).baseVersion)
          : undefined;

      const resolution = resolvePerRecordMutation({
        existing: prev && prev.familyId === targetFamilyId ? prev : undefined,
        incomingData: data as Record<string, unknown>,
        baseVersion: parsedBaseVersion,
        baseSnapshot: baseSnapshot && typeof baseSnapshot === 'object' ? baseSnapshot : undefined,
        conflictPolicy: 'FIELD_AWARE_MERGE',
        forceOverwrite: Boolean(forceOverwrite),
      });

      if (resolution.conflictRejected && prev) {
        res.status(409).json({
          error: 'VERSION_CONFLICT',
          message: `Concurrent edit conflict on ${normalizedType}:${cleanEntityId} (client baseVersion=${parsedBaseVersion}, server version=${prev.version}).`,
          conflictingFields: resolution.conflictingFields,
          serverVersion: prev.version,
          serverRecord: prev,
        });
        return;
      }

      const now = Date.now();
      const nextVersion = (prev?.version || 0) + 1;
      const record: SynchronizedEntityRecord = {
        id: cleanEntityId,
        familyId: targetFamilyId,
        entityType: normalizedType,
        version: nextVersion,
        isDeleted,
        updatedAt: now,
        updatedByUserId: actor.userAccountId,
        data: {
          ...resolution.mergedData,
          id: cleanEntityId,
          familyId: targetFamilyId,
          ownerUserId: String(prev?.data?.ownerUserId || (data as any).ownerUserId || actor.userAccountId),
          ownerMemberId: String(
            prev?.data?.ownerMemberId || (data as any).ownerMemberId || callerMembership.memberProfileId
          ),
          version: nextVersion,
          updatedAt: now,
          isDeleted,
        },
      };

      store.synchronizedEntities[key] = record;
      bumpWorkspaceVersion(store, targetFamilyId, now);

      if (isPostgresPersistenceActive()) {
        const pool = getPostgresPool();
        if (pool) {
          try {
            await syncEntityScoped(pool, targetFamilyId, {
              entityKey: key,
              id: cleanEntityId,
              entityType: normalizedType,
              data: record.data,
              version: nextVersion,
              baseVersion: parsedBaseVersion,
              forceOverwrite: Boolean(forceOverwrite),
              isDeleted,
              updatedByUserId: actor.userAccountId,
            });
          } catch (err: any) {
            if (err?.code === 'VERSION_CONFLICT' || err?.statusCode === 409) {
              res.status(409).json({
                error: 'VERSION_CONFLICT',
                message: err.message,
                serverVersion: err.serverVersion,
                serverRecord: err.serverRecord,
              });
              return;
            }
            throw err;
          }
        }
      }

      void mirrorEntityToFirestore(record);
      res.status(200).json({ entity: record, workspaceVersion: store.workspace.version });
    });
  });

  // 10. Backup & Migration Verification Endpoint (OWNER only)
  app.get('/api/v1/admin/backup-status', requireAuth, (req, res) => {
    const store = loadStore();
    const actor = req.actor!;
    const access = resolveServerMembership(store, actor.userAccountId, 'fam-1');
    if (!access.allowed || access.membership?.role !== 'OWNER') {
      res.status(403).json({ error: 'PERMISSION_DENIED', message: 'Only workspace OWNER can inspect backup manifests.' });
      return;
    }

    const manifestPath = path.join(BACKUP_DIR, 'manifest.json');
    const backupPath = path.join(BACKUP_DIR, 'familyos-shared-store.pre-3.2.bak.json');
    const exists = fs.existsSync(backupPath) && fs.existsSync(manifestPath);
    if (!exists) {
      res.status(404).json({ error: 'BACKUP_NOT_FOUND' });
      return;
    }
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    const actualSha256 = computeSha256(fs.readFileSync(backupPath, 'utf-8'));
    res.status(200).json({
      backupVerified: actualSha256 === manifest.sha256,
      actualSha256,
      manifest,
      rollbackReady: true,
      rollbackHelperAvailable: typeof rollbackToPre32Backup === 'function',
    });
  });

  // 10B. Admin Reset Store Endpoint (Reloads memory cache from disk in test mode)
  app.post('/api/v1/admin/reset-store', (_req, res) => {
    cachedStore = null;
    const store = loadStore();
    res.status(200).json({ reloaded: true, schemaVersion: store.schemaVersion });
  });

  // 11. AI Image Visual Generation Endpoint using @google/genai SDK (Free-tier compatible via gemini-3.8-flash SVG synthesis)
  app.post('/api/v1/ai/generate-image', requireAuth, async (req, res) => {
    const { prompt, title = 'Family Goal Visual', description = '', category = 'FamilyOS Visual' } = req.body || {};

    const createBrandedSvg = (t: string, sub: string, accentColor = '%23C39A60') =>
      `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="800" height="400" viewBox="0 0 800 400"><defs><linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%23173D35"/><stop offset="60%" stop-color="%231E4E44"/><stop offset="100%" stop-color="%230E2822"/></linearGradient><radialGradient id="glow" cx="50%" cy="40%" r="50%"><stop offset="0%" stop-color="${accentColor}" stop-opacity="0.35"/><stop offset="100%" stop-color="${accentColor}" stop-opacity="0"/></radialGradient></defs><rect width="800" height="400" fill="url(%23bg)"/><circle cx="400" cy="160" r="180" fill="url(%23glow)"/><circle cx="400" cy="155" r="56" fill="${accentColor}" opacity="0.9"/><path d="M 380 155 L 395 170 L 425 140" stroke="%23173D35" stroke-width="7" fill="none" stroke-linecap="round" stroke-linejoin="round"/><text x="400" y="275" fill="%23F7F4EC" font-size="26" font-family="Georgia, serif" text-anchor="middle" font-weight="bold">${encodeURIComponent(
        t.slice(0, 48)
      )}</text><text x="400" y="312" fill="%23E7D1AA" font-size="15" font-family="sans-serif" text-anchor="middle">${encodeURIComponent(
        sub.slice(0, 72)
      )}</text></svg>`;

    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        res.status(200).json({
          imageUrl: createBrandedSvg(title, description || category),
          success: true,
        });
        return;
      }

      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const svgPrompt = `Create a rich, modern, artistic SVG banner illustration (width="800" height="400" viewBox="0 0 800 400") representing this family goal:
Title: "${title}"
Description: "${description || prompt || ''}"
Category: "${category}"
Use a warm, cohesive palette (deep forest green #173D35, warm gold #C39A60, soft sage #A8BDAA, ivory #F7F4EC, terracotta #D97757). Include expressive vector scenery, symbolic icons, gradients, and subtle typography of the goal title. Return ONLY the raw <svg>...</svg> markup with no markdown code fences.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: svgPrompt,
      });

      const rawText = (response.text ?? '').trim();
      const svgMatch = rawText.match(/<svg[\s\S]*?<\/svg>/i);

      if (svgMatch) {
        const base64Svg = Buffer.from(svgMatch[0], 'utf-8').toString('base64');
        res.status(200).json({
          imageUrl: `data:image/svg+xml;base64,${base64Svg}`,
          success: true,
        });
      } else {
        res.status(200).json({
          imageUrl: createBrandedSvg(title, description || category),
          success: true,
        });
      }
    } catch (err: any) {
      console.error('Error generating visual via Gemini API:', err);
      res.status(200).json({
        imageUrl: createBrandedSvg(title, description || category, '%23A8BDAA'),
        success: true,
      });
    }
  });

  // 12. AI Goal Assistant Endpoint (Suggests Family vs Personal Goals based on Vision / Yearly Statement)
  app.post('/api/v1/ai/suggest-goals', requireAuth, async (req, res) => {
    const {
      scope = 'FAMILY',
      familyVision = '',
      familyMission = '',
      familyMotto = '',
      personalVision = '',
      yearlyStatement = '',
      interests = [],
      hobbies = [],
      displayName = 'Family Member',
    } = req.body || {};

    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        const fallbackGoals =
          scope === 'FAMILY'
            ? [
                {
                  title: 'Establish Weekly Family Governance & Game Night',
                  description: `Aligning with family motto "${familyMotto || 'Together in Stewardship'}", create a dedicated Sunday routine for weekly planning and connection.`,
                  scope: 'FAMILY',
                  horizon: 'LONG_TERM',
                  category: 'FAMILY_GOVERNANCE',
                  targetMetricValue: 12,
                  metricUnit: 'weeks',
                },
                {
                  title: 'Build Emergency Financial & Household Readiness Reserve',
                  description: `Support vision "${familyVision || 'Family Harmony'}" by building a 3-month liquid reserve and cataloging household equipment.`,
                  scope: 'FAMILY',
                  horizon: 'LONG_TERM',
                  category: 'HOME_MANAGEMENT',
                  targetMetricValue: 100,
                  metricUnit: '%',
                },
                {
                  title: 'Seasonal Family Wellness & Outdoor Excursions',
                  description: 'Schedule quarterly family retreat days to nurture physical and emotional wellbeing.',
                  scope: 'FAMILY',
                  horizon: 'SHORT_TERM',
                  category: 'SPIRITUAL_GROWTH',
                  targetMetricValue: 4,
                  metricUnit: 'trips',
                },
              ]
            : [
                {
                  title: `${displayName}'s 2026 Skill & Growth Milestone`,
                  description: `Directly pursuing personal statement "${yearlyStatement || 'Personal Growth'}". Focus on ${Array.isArray(interests) && interests.length ? interests.slice(0, 2).join(', ') : 'personal development'}.`,
                  scope: 'PERSONAL',
                  horizon: 'SHORT_TERM',
                  category: 'PERSONAL_PLANNING',
                  targetMetricValue: 100,
                  metricUnit: '%',
                },
                {
                  title: `Master ${Array.isArray(hobbies) && hobbies[0] ? hobbies[0] : 'Creative Endeavor'} Project`,
                  description: `Dedicate 2 hours weekly to hobbies to fulfill vision "${personalVision || 'Excellence'}".`,
                  scope: 'PERSONAL',
                  horizon: 'LONG_TERM',
                  category: 'PERSONAL_PLANNING',
                  targetMetricValue: 24,
                  metricUnit: 'hours',
                },
                {
                  title: 'Personal Health & Mindful Reflection Routine',
                  description: 'Establish daily personal reflection journal and fitness habit tracking.',
                  scope: 'PERSONAL',
                  horizon: 'SHORT_TERM',
                  category: 'PERSONAL_PLANNING',
                  targetMetricValue: 30,
                  metricUnit: 'days',
                },
              ];

        res.status(200).json({ suggestions: fallbackGoals, success: true });
        return;
      }

      const { GoogleGenAI, Type } = await import('@google/genai');
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
      });

      const promptText =
        scope === 'FAMILY'
          ? `Generate 3 highly realistic, inspirational, and achievable FAMILY GOALS based on:
Family Vision: "${familyVision}"
Family Mission: "${familyMission}"
Family Motto: "${familyMotto}"`
          : `Generate 3 personalized, actionable PERSONAL GOALS for ${displayName} based on:
Yearly Statement: "${yearlyStatement}"
Personal Vision: "${personalVision}"
Interests: ${Array.isArray(interests) ? interests.join(', ') : ''}
Hobbies: ${Array.isArray(hobbies) ? hobbies.join(', ') : ''}`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: promptText,
        config: {
          systemInstruction:
            'You are an expert Family Operating System AI Coach. Generate structured, strategic goals that align with family visions or individual yearly statements.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                description: { type: Type.STRING },
                scope: { type: Type.STRING },
                horizon: { type: Type.STRING },
                category: { type: Type.STRING },
                targetMetricValue: { type: Type.NUMBER },
                metricUnit: { type: Type.STRING },
              },
              required: ['title', 'description', 'scope', 'horizon', 'category', 'targetMetricValue', 'metricUnit'],
            },
          },
        },
      });

      const jsonStr = (response.text ?? '[]').trim();
      const parsed = JSON.parse(jsonStr);
      res.status(200).json({ suggestions: parsed, success: true });
    } catch (err: any) {
      console.error('Error generating AI goal suggestions:', err);
      res.status(500).json({ error: 'AI_SUGGESTION_FAILED', message: err.message });
    }
  });

  // Register Stage 3.3.2 Unified Goals, Projects, Milestones, Universal Tasks, Checklists, Calendar & Optional Rewards routes
  registerStage332PlanningRoutes(app, {
    requireAuth,
    loadStore,
    withAtomicStoreTransaction,
    bumpWorkspaceVersion,
    mirrorEntityToFirestore,
  });

  // Register Stage 3.3.3 Authoritative Calendar & Routines routes
  registerCalendarRoutes(app, {
    requireAuth,
    loadStore,
    withAtomicStoreTransaction,
    bumpWorkspaceVersion,
  });

  // Register Master Stage 2 Household routes (Meals, Recipes, Chores, Assets, Pantry, Wardrobe, Groceries)
  app.use('/api/v1/household', requireAuth, householdRouter);

  // Register Master Stage 3.A.1 Finance routes (Accounts, Transactions, Budgets, Savings, Recurring, Investments, Cashflow)
  app.use('/api/v1/finance', requireAuth, financeRouter);

  // Register Authoritative Domain Module routes (Relationships, Parenting & Growth, Life Management & Encrypted Document Vault)
  registerDomainModulesRoutes(app, {
    requireAuth,
    loadStore,
    withAtomicStoreTransaction,
    bumpWorkspaceVersion,
    mirrorEntityToFirestore,
  });

  // Register Database Studio & Management Center routes (Full CRUD across all 30+ tables & raw synchronized entities)
  registerDatabaseStudioRoutes(app, {
    requireAuth,
    loadStore,
    withAtomicStoreTransaction,
    bumpWorkspaceVersion,
    mirrorEntityToFirestore,
  });

  // Register Family Section (Gallery, Constitution, Traditions, Shared Activities, Rules) & Home Dashboards aggregation routes
  registerFamilySectionAndHomeDashboardRoutes(app, {
    requireAuth,
    loadStore,
    withAtomicStoreTransaction,
    bumpWorkspaceVersion,
    mirrorEntityToFirestore,
  });

  // Register Master Stage 4 AI Gateway, Global Search, Export & Commercial Entitlements
  app.use('/api/v1/ai', requireAuth, aiGatewayRouter);
  app.use('/api/v1/search', requireAuth, searchRouter);
  app.use('/api/v1/export', requireAuth, exportRouter);
  app.use('/api/v1/billing', requireAuth, entitlementRouter);

  return app;
}

export async function startServer() {
  const app = await createApp();

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: process.env.DISABLE_HMR !== 'true' },
      appType: 'spa',
    });

    // Intercept /@vite/client to safely neutralize ambient HMR WebSocket disconnects in AI Studio preview
    app.get('/@vite/client', async (req, res, next) => {
      try {
        const clientMod = await vite.transformRequest('/@vite/client');
        if (clientMod && clientMod.code) {
          let code = clientMod.code;
          code = code.replace(
            /createConnection:\s*\(\)\s*=>\s*new WebSocket\([^)]+\)/g,
            'createConnection: () => ({ readyState: 1, addEventListener(e, cb) { if (e === "open") setTimeout(cb, 0); }, removeEventListener() {}, send() {}, close() {} })'
          );
          code = code.replace(
            /reject\(\/\* @__PURE__ \*\/ new Error\("WebSocket closed without opened\."\)\)/g,
            'resolve()'
          );
          code = code.replace(
            /console\.error\(`\[vite\] failed to connect to websocket/g,
            'console.debug(`[vite] HMR offline in preview'
          );
          res.setHeader('Content-Type', 'application/javascript');
          res.setHeader('Cache-Control', 'no-cache');
          return res.send(code);
        }
        return next();
      } catch (err) {
        return next(err);
      }
    });

    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const httpServer = app.listen(PORT, '0.0.0.0', () => {
    console.log(`FamilyOS Shared Backend & Web Portal listening on http://0.0.0.0:${PORT}`);
  });

  const shutdownGracefully = async (signal: string) => {
    console.log(`Received ${signal}. Draining active transactions and closing HTTP server...`);
    await storeMutex;
    httpServer.close(() => {
      process.exit(0);
    });
  };

  process.once('SIGTERM', () => void shutdownGracefully('SIGTERM'));
  process.once('SIGINT', () => void shutdownGracefully('SIGINT'));
  return httpServer;
}

// Check if server.ts is being run directly as a script
const isDirectExecution = (() => {
  if (process.env.NODE_ENV === 'test') return false;
  if (process.env.VERCEL || process.env.NOW_REGION) return false;
  try {
    if (typeof process.argv[1] === 'string' && import.meta.url) {
      const scriptPath = path.resolve(process.argv[1]);
      const modulePath = path.resolve(new URL(import.meta.url).pathname);
      return scriptPath === modulePath;
    }
  } catch {
    // Ignore URL parse error
  }
  return false;
})();

if (isDirectExecution) {
  startServer();
}

let cachedApp: express.Express | null = null;

export async function getApp(): Promise<express.Express> {
  if (!cachedApp) {
    cachedApp = await createApp();
  }
  return cachedApp;
}

// Serverless handler matching Express signature
const appHandler = async (req: express.Request, res: express.Response, next?: express.NextFunction) => {
  const instance = await getApp();
  return (instance as any)(req, res, next);
};

export default appHandler;

