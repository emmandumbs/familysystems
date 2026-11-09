import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import https from 'https';
import type { Request, Response, NextFunction } from 'express';
import firebaseConfig from '../../firebase-applet-config.json';
import type {
  AuthoritativeFamilyMember,
  AuthoritativeFamilyRelationship,
  AuthoritativeMembership,
  FamilyRole,
  RelationshipTypeCode,
  SharedStore,
} from './backupAndMigration';
import {
  evaluateStorageAvailability,
  getPostgresPool,
  isPostgresConnectionVerified,
} from './postgresMigrationAndBackup';

export interface VerifiedActorContext {
  userAccountId: string;
  email: string;
  displayName: string;
  authMethod: 'FIREBASE_ID_TOKEN' | 'SESSION_TOKEN';
  tokenJti?: string;
  emailVerified?: boolean;
}

export interface AuthorizedFamilyContext extends VerifiedActorContext {
  familyId: string;
  memberProfileId: string;
  role: FamilyRole;
  membershipStatus: string;
}

declare global {
  namespace Express {
    interface Request {
      actor?: VerifiedActorContext;
      familyContext?: AuthorizedFamilyContext;
    }
  }
}

const MIN_SECRET_LENGTH = 32;
const DEV_FALLBACK_RUNTIME_SECRET = crypto
  .createHash('sha256')
  .update(`familyos-dev-only-secret-${process.pid}-${firebaseConfig.projectId}`)
  .digest('hex');

/**
 * Validates that production deployments supply a high-entropy FAMILYOS_SESSION_SECRET
 * from the secret manager and never fall back to public Firebase config identifiers.
 */
export function validateProductionAuthConfig(env: NodeJS.ProcessEnv = process.env): {
  valid: boolean;
  errorCode?: string;
  errorMessage?: string;
} {
  const isProd = env.NODE_ENV === 'production';
  const rawSecret = env.FAMILYOS_SESSION_SECRET || '';

  if (isProd) {
    if (!rawSecret || rawSecret.trim().length < MIN_SECRET_LENGTH) {
      return {
        valid: false,
        errorCode: 'MISSING_OR_WEAK_PRODUCTION_SESSION_SECRET',
        errorMessage: `CRITICAL P0 SECURITY FAILURE: FAMILYOS_SESSION_SECRET must be set to a high-entropy secret (>= ${MIN_SECRET_LENGTH} chars) in production.`,
      };
    }
    if (
      rawSecret.includes(firebaseConfig.projectId) ||
      rawSecret.includes(firebaseConfig.appId) ||
      rawSecret.includes('gen-lang-client-') ||
      rawSecret.startsWith('familyos-hmac-')
    ) {
      return {
        valid: false,
        errorCode: 'DETERMINISTIC_SECRET_FORBIDDEN_IN_PRODUCTION',
        errorMessage:
          'CRITICAL P0 SECURITY FAILURE: FAMILYOS_SESSION_SECRET must not be derived from public Firebase project or app identifiers.',
      };
    }
  }

  return { valid: true };
}

export function getSessionSecret(env: NodeJS.ProcessEnv = process.env): string {
  const check = validateProductionAuthConfig(env);
  if (!check.valid) {
    throw new Error(check.errorMessage);
  }
  if (env.FAMILYOS_SESSION_SECRET && env.FAMILYOS_SESSION_SECRET.trim().length >= MIN_SECRET_LENGTH) {
    return env.FAMILYOS_SESSION_SECRET.trim();
  }
  return DEV_FALLBACK_RUNTIME_SECRET;
}

export function getPreviousSessionSecret(env: NodeJS.ProcessEnv = process.env): string | null {
  const prev = env.FAMILYOS_SESSION_SECRET_PREVIOUS;
  if (prev && prev.trim().length >= MIN_SECRET_LENGTH) {
    return prev.trim();
  }
  return null;
}

/**
 * Determines whether the non-production test harness `userAccountId` session exchange is permitted.
 * Strictly disabled in production (`NODE_ENV === 'production'`).
 */
export function isTestHarnessAuthAllowed(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.NODE_ENV === 'production') {
    return false;
  }
  if (env.FAMILYOS_DISABLE_TEST_AUTH === 'true' || env.FAMILYOS_ALLOW_TEST_HARNESS_AUTH === 'false') {
    return false;
  }
  return true;
}

/**
 * Determines whether the test-harness user registration shortcut (`registerNewUser` or unseeded test accounts)
 * in `/api/v1/auth/session` is permitted.
 * Strictly disabled unless `NODE_ENV === 'test'` (blocking it in both production and unconfigured environments).
 */
export function isTestHarnessRegistrationAllowed(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.NODE_ENV !== 'test') {
    return false;
  }
  if (env.FAMILYOS_DISABLE_TEST_AUTH === 'true' || env.FAMILYOS_ALLOW_TEST_HARNESS_AUTH === 'false') {
    return false;
  }
  return true;
}

// ============================================================================
// PERSISTENT SESSION REVOCATION & ROTATION REGISTRY (POSTGRESQL + ATOMIC DISK)
// ============================================================================
const DATA_DIR = path.resolve(process.cwd(), 'data');
const REVOCATIONS_FILE = path.join(DATA_DIR, 'auth-revocations.json');

export interface AuthSessionRecord {
  sessionIdentifier: string; // jti
  tokenHash: string; // sha256 of raw token
  userAccountId: string;
  createdAtSec: number;
  expiresAtSec: number;
  isRevoked: boolean;
  revokedAtSec?: number;
  revokedReason?: string;
  deviceInfo?: string;
}

const revokedTokenJtis = new Set<string>();
const revokedRawTokens = new Set<string>();
const userRevokedBeforeEpochSec = new Map<string, number>();
const trackedAuthSessions = new Map<string, AuthSessionRecord>();
let lastRevocationsMtimeMs = 0;

export function loadRevocationsFromDisk(): void {
  try {
    if (!fs.existsSync(REVOCATIONS_FILE)) return;
    const stat = fs.statSync(REVOCATIONS_FILE);
    lastRevocationsMtimeMs = stat.mtimeMs;
    const raw = fs.readFileSync(REVOCATIONS_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed.revokedTokenJtis)) {
      parsed.revokedTokenJtis.forEach((jti: string) => revokedTokenJtis.add(jti));
    }
    if (Array.isArray(parsed.revokedRawTokens)) {
      parsed.revokedRawTokens.forEach((t: string) => revokedRawTokens.add(t));
    }
    if (parsed.userRevokedBeforeEpochSec && typeof parsed.userRevokedBeforeEpochSec === 'object') {
      for (const [uid, sec] of Object.entries(parsed.userRevokedBeforeEpochSec)) {
        if (typeof sec === 'number') {
          userRevokedBeforeEpochSec.set(uid, sec);
        }
      }
    }
    if (Array.isArray(parsed.authSessions)) {
      for (const sess of parsed.authSessions) {
        if (sess && sess.sessionIdentifier) {
          trackedAuthSessions.set(sess.sessionIdentifier, sess);
          if (sess.isRevoked) {
            revokedTokenJtis.add(sess.sessionIdentifier);
          }
        }
      }
    }
  } catch {
    // Non-fatal if corrupt or unreadable
  }
}

function syncRevocationsIfModifiedExternally(): void {
  try {
    if (!fs.existsSync(REVOCATIONS_FILE)) return;
    const stat = fs.statSync(REVOCATIONS_FILE);
    if (stat.mtimeMs > lastRevocationsMtimeMs) {
      loadRevocationsFromDisk();
    }
  } catch {
    // Ignore
  }
}

export function saveRevocationsToDisk(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const data = {
      revokedTokenJtis: Array.from(revokedTokenJtis),
      revokedRawTokens: Array.from(revokedRawTokens),
      userRevokedBeforeEpochSec: Object.fromEntries(userRevokedBeforeEpochSec.entries()),
      authSessions: Array.from(trackedAuthSessions.values()),
      updatedAt: Date.now(),
    };
    const tmpFile = `${REVOCATIONS_FILE}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(tmpFile, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tmpFile, REVOCATIONS_FILE);
    const stat = fs.statSync(REVOCATIONS_FILE);
    lastRevocationsMtimeMs = stat.mtimeMs;
  } catch {
    // Non-fatal
  }
}

// Initialize on module load
loadRevocationsFromDisk();

export function recordAuthSession(record: AuthSessionRecord): void {
  trackedAuthSessions.set(record.sessionIdentifier, record);
  saveRevocationsToDisk();
}

export function getTrackedAuthSessions(): AuthSessionRecord[] {
  syncRevocationsIfModifiedExternally();
  return Array.from(trackedAuthSessions.values());
}

export function cleanupExpiredAuthSessions(nowSec: number = Math.floor(Date.now() / 1000)): number {
  syncRevocationsIfModifiedExternally();
  let removed = 0;
  for (const [id, sess] of trackedAuthSessions.entries()) {
    if (sess.expiresAtSec < nowSec && sess.isRevoked) {
      trackedAuthSessions.delete(id);
      removed++;
    }
  }
  if (removed > 0) {
    saveRevocationsToDisk();
  }
  return removed;
}

export function revokeSessionToken(tokenOrJti: string, reason = 'LOGOUT'): void {
  if (!tokenOrJti) return;
  syncRevocationsIfModifiedExternally();
  revokedRawTokens.add(tokenOrJti);
  revokedTokenJtis.add(tokenOrJti);
  const tokenHash = crypto.createHash('sha256').update(tokenOrJti).digest('hex');
  const nowSec = Math.floor(Date.now() / 1000);
  for (const session of trackedAuthSessions.values()) {
    if (session.sessionIdentifier === tokenOrJti || session.tokenHash === tokenHash || session.tokenHash === tokenOrJti) {
      session.isRevoked = true;
      session.revokedAtSec = nowSec;
      session.revokedReason = reason;
      revokedTokenJtis.add(session.sessionIdentifier);
    }
  }
  saveRevocationsToDisk();
}

export function revokeAllSessionsForUser(userAccountId: string, revokedAtSec: number = Math.floor(Date.now() / 1000)): void {
  if (!userAccountId) return;
  syncRevocationsIfModifiedExternally();
  userRevokedBeforeEpochSec.set(userAccountId, revokedAtSec);
  for (const session of trackedAuthSessions.values()) {
    if (session.userAccountId === userAccountId) {
      session.isRevoked = true;
      session.revokedAtSec = revokedAtSec;
      session.revokedReason = 'REVOKE_ALL_USER_SESSIONS';
      revokedTokenJtis.add(session.sessionIdentifier);
    }
  }
  saveRevocationsToDisk();
}

export function isSessionRevoked(params: {
  rawToken: string;
  jti?: string;
  userAccountId: string;
  iat?: number;
}): boolean {
  syncRevocationsIfModifiedExternally();
  if (revokedRawTokens.has(params.rawToken)) return true;
  if (params.jti && revokedTokenJtis.has(params.jti)) return true;
  if (params.jti) {
    const sess = trackedAuthSessions.get(params.jti);
    if (sess && sess.isRevoked) return true;
  }
  const tokenHash = crypto.createHash('sha256').update(params.rawToken).digest('hex');
  for (const sess of trackedAuthSessions.values()) {
    if (sess.tokenHash === tokenHash && sess.isRevoked) return true;
  }
  const userRevokedAt = userRevokedBeforeEpochSec.get(params.userAccountId);
  if (userRevokedAt !== undefined && typeof params.iat === 'number' && params.iat <= userRevokedAt) {
    return true;
  }
  return false;
}

export function clearRevokedSessionsForTest(): void {
  revokedTokenJtis.clear();
  revokedRawTokens.clear();
  userRevokedBeforeEpochSec.clear();
  trackedAuthSessions.clear();
  lastRevocationsMtimeMs = 0;
  try {
    if (fs.existsSync(REVOCATIONS_FILE)) {
      fs.unlinkSync(REVOCATIONS_FILE);
    }
  } catch {
    // Ignore
  }
}

// ============================================================================
// POSTGRESQL-BACKED PERSISTENT SESSION LIFECYCLE (auth_sessions & user_accounts)
// ============================================================================
export async function recordAuthSessionPg(dbClientOrPool: any, record: AuthSessionRecord): Promise<void> {
  const tokenHash = record.tokenHash || crypto.createHash('sha256').update(record.sessionIdentifier).digest('hex');
  await dbClientOrPool.query(
    `INSERT INTO auth_sessions (session_id, user_account_id, token_hash, created_at, expires_at, is_revoked, device_info)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (session_id) DO UPDATE SET is_revoked = EXCLUDED.is_revoked, revoked_at = EXCLUDED.revoked_at`,
    [
      record.sessionIdentifier,
      record.userAccountId,
      tokenHash,
      record.createdAtSec,
      record.expiresAtSec,
      record.isRevoked || false,
      record.deviceInfo || 'Standard Session',
    ]
  );
}

export async function isSessionRevokedPg(
  dbClientOrPool: any,
  params: { rawToken: string; jti?: string; userAccountId: string; iat?: number }
): Promise<boolean> {
  const tokenHash = crypto.createHash('sha256').update(params.rawToken).digest('hex');
  const sessionRes = await dbClientOrPool.query(
    `SELECT is_revoked FROM auth_sessions WHERE session_id = $1 OR token_hash = $2`,
    [params.jti || params.rawToken, tokenHash]
  );
  if (sessionRes.rows.length > 0 && sessionRes.rows[0].is_revoked) {
    return true;
  }

  const userRes = await dbClientOrPool.query(
    `SELECT revoked_before_sec FROM user_accounts WHERE id = $1`,
    [params.userAccountId]
  );
  if (userRes.rows.length > 0) {
    const revokedBeforeSec = Number(userRes.rows[0].revoked_before_sec || 0);
    if (typeof params.iat === 'number' && params.iat <= revokedBeforeSec) {
      return true;
    }
  }

  return false;
}

export async function revokeSessionTokenPg(
  dbClientOrPool: any,
  tokenOrJti: string,
  reason = 'LOGOUT'
): Promise<void> {
  const tokenHash = crypto.createHash('sha256').update(tokenOrJti).digest('hex');
  const nowSec = Math.floor(Date.now() / 1000);
  await dbClientOrPool.query(
    `UPDATE auth_sessions SET is_revoked = TRUE, revoked_at = $1, revoked_reason = $2
     WHERE session_id = $3 OR token_hash = $3 OR token_hash = $4`,
    [nowSec, reason, tokenOrJti, tokenHash]
  );
}

export async function revokeAllSessionsForUserPg(
  dbClientOrPool: any,
  userAccountId: string,
  revokedAtSec: number = Math.floor(Date.now() / 1000)
): Promise<void> {
  await dbClientOrPool.query(
    `UPDATE auth_sessions SET is_revoked = TRUE, revoked_at = $1, revoked_reason = 'REVOKE_ALL_USER_SESSIONS'
     WHERE user_account_id = $2`,
    [revokedAtSec, userAccountId]
  );
  await dbClientOrPool.query(
    `UPDATE user_accounts SET revoked_before_sec = $1 WHERE id = $2`,
    [revokedAtSec, userAccountId]
  );
}

export async function cleanupExpiredAuthSessionsPg(
  dbClientOrPool: any,
  nowSec: number = Math.floor(Date.now() / 1000)
): Promise<number> {
  const res = await dbClientOrPool.query(
    `DELETE FROM auth_sessions WHERE expires_at < $1 AND is_revoked = TRUE`,
    [nowSec]
  );
  return res.rowCount || 0;
}

// ============================================================================
// GOOGLE FIREBASE PUBLIC KEY CACHE & CRYPTOGRAPHIC RS256 VERIFIER
// ============================================================================
const GOOGLE_SECURETOKEN_CERTS_URL =
  'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';

const trustedFirebasePublicKeys = new Map<string, string>();
let lastCertFetchMs = 0;

export function registerTrustedFirebasePublicKey(kid: string, publicKeyOrCertPem: string): void {
  trustedFirebasePublicKeys.set(kid, publicKeyOrCertPem);
}

export function unregisterTrustedFirebasePublicKey(kid: string): void {
  trustedFirebasePublicKeys.delete(kid);
}

export function refreshGoogleSigningCertificatesBackground(): void {
  const now = Date.now();
  if (now - lastCertFetchMs < 15 * 60 * 1000) return;
  lastCertFetchMs = now;
  try {
    https
      .get(GOOGLE_SECURETOKEN_CERTS_URL, (res) => {
        if (res.statusCode !== 200) return;
        let raw = '';
        res.on('data', (chunk) => {
          raw += chunk;
        });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(raw) as Record<string, string>;
            for (const [kid, certPem] of Object.entries(parsed)) {
              if (typeof certPem === 'string' && certPem.includes('BEGIN CERTIFICATE')) {
                trustedFirebasePublicKeys.set(kid, certPem);
              }
            }
          } catch {
            // Ignore malformed response
          }
        });
      })
      .on('error', () => {
        // Offline / sandbox environment without external internet access
      });
  } catch {
    // Ignore
  }
}

// Trigger initial non-blocking fetch of Google's X.509 signing certs
refreshGoogleSigningCertificatesBackground();

function timingSafeCompareStrings(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf-8');
  const bufB = Buffer.from(b, 'utf-8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Issues a cryptographically signed HMAC-SHA256 session token (`fos_v1.<payload>.<sig>`)
 * using the high-entropy server secret. Includes unique `jti` for revocation support.
 */
export function issueSignedSessionToken(
  actor: {
    userAccountId: string;
    email: string;
    displayName: string;
    emailVerified?: boolean;
    expiresInMs?: number;
  },
  env: NodeJS.ProcessEnv = process.env
): string {
  const secret = getSessionSecret(env);
  const nowSec = Math.floor(Date.now() / 1000);
  const expiresInMs = actor.expiresInMs ?? 24 * 3600 * 1000;
  const expSec = Math.floor((Date.now() + expiresInMs) / 1000);
  const jti = `jti_${nowSec}_${crypto.randomBytes(12).toString('hex')}`;

  const payload = {
    jti,
    sub: actor.userAccountId,
    email: actor.email,
    name: actor.displayName,
    email_verified: actor.emailVerified ?? true,
    iss: `https://securetoken.google.com/${firebaseConfig.projectId}`,
    aud: firebaseConfig.projectId,
    iat: nowSec,
    exp: expSec,
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(payloadB64).digest('base64url');
  const token = `fos_v1.${payloadB64}.${sig}`;

  recordAuthSession({
    sessionIdentifier: jti,
    tokenHash: crypto.createHash('sha256').update(token).digest('hex'),
    userAccountId: actor.userAccountId,
    createdAtSec: nowSec,
    expiresAtSec: expSec,
    isRevoked: false,
    deviceInfo: (actor as any).deviceInfo,
  });

  return token;
}

export async function issueSignedSessionTokenAsync(
  actor: {
    userAccountId: string;
    email: string;
    displayName: string;
    emailVerified?: boolean;
    expiresInMs?: number;
    deviceInfo?: string;
  },
  env: NodeJS.ProcessEnv = process.env,
  dbPool?: any
): Promise<string> {
  const token = issueSignedSessionToken(actor, env);
  const storage = evaluateStorageAvailability(env);
  if (storage.mode === 'postgres') {
    const pool = dbPool || getPostgresPool(env);
    if (!pool || !isPostgresConnectionVerified()) {
      throw new Error('POSTGRES_UNAVAILABLE_NO_JSON_FALLBACK');
    }
    const parts = token.split('.');
    const decoded = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf-8'));
    await recordAuthSessionPg(pool, {
      sessionIdentifier: decoded.jti,
      tokenHash: crypto.createHash('sha256').update(token).digest('hex'),
      userAccountId: actor.userAccountId,
      createdAtSec: decoded.iat,
      expiresAtSec: decoded.exp,
      isRevoked: false,
      deviceInfo: actor.deviceInfo || 'Standard Session',
    });
  }
  return token;
}

export async function revokeSessionTokenUnified(
  tokenOrJti: string,
  reason = 'LOGOUT',
  env: NodeJS.ProcessEnv = process.env,
  dbPool?: any
): Promise<void> {
  revokeSessionToken(tokenOrJti, reason);
  const storage = evaluateStorageAvailability(env);
  if (storage.mode === 'postgres') {
    const pool = dbPool || getPostgresPool(env);
    if (pool && isPostgresConnectionVerified()) {
      await revokeSessionTokenPg(pool, tokenOrJti, reason);
    }
  }
}

export async function revokeAllSessionsForUserUnified(
  userAccountId: string,
  revokedAtSec: number = Math.floor(Date.now() / 1000),
  env: NodeJS.ProcessEnv = process.env,
  dbPool?: any
): Promise<void> {
  revokeAllSessionsForUser(userAccountId, revokedAtSec);
  const storage = evaluateStorageAvailability(env);
  if (storage.mode === 'postgres') {
    const pool = dbPool || getPostgresPool(env);
    if (pool && isPostgresConnectionVerified()) {
      await revokeAllSessionsForUserPg(pool, userAccountId, revokedAtSec);
    }
  }
}

export async function verifyBearerTokenAsync(
  token: string,
  store: SharedStore,
  env: NodeJS.ProcessEnv = process.env,
  dbPool?: any
): Promise<VerifiedActorContext | null> {
  const verified = verifyBearerToken(token, store, env);
  if (!verified) return null;

  const storage = evaluateStorageAvailability(env);
  if (storage.mode === 'postgres') {
    const pool = dbPool || getPostgresPool(env);
    if (!pool || !isPostgresConnectionVerified()) {
      throw new Error('POSTGRES_UNAVAILABLE_NO_JSON_FALLBACK');
    }
    const isRevokedInPg = await isSessionRevokedPg(pool, {
      rawToken: token,
      jti: verified.tokenJti,
      userAccountId: verified.userAccountId,
    });
    if (isRevokedInPg) return null;
  }
  return verified;
}

/**
 * Cryptographically verifies a 3-part Firebase ID Token (RS256 signature, kid, iss, aud, sub, iat, exp, revocation).
 * Rejects any unsigned, tampered, or `alg !== 'RS256'` JWT.
 */
export function verifyFirebaseJwtCryptographically(
  token: string,
  store: SharedStore
): VerifiedActorContext | null {
  const jwtParts = token.split('.');
  if (jwtParts.length !== 3) return null;
  const [headerB64, payloadB64, signatureB64] = jwtParts;
  if (!headerB64 || !payloadB64 || !signatureB64) return null;

  try {
    const header = JSON.parse(Buffer.from(headerB64, 'base64url').toString('utf-8'));
    if (!header || header.alg !== 'RS256' || typeof header.kid !== 'string' || !header.kid.trim()) {
      return null;
    }

    const publicKeyPem = trustedFirebasePublicKeys.get(header.kid);
    if (!publicKeyPem) {
      refreshGoogleSigningCertificatesBackground();
      return null;
    }

    const verifier = crypto.createVerify('RSA-SHA256');
    verifier.update(`${headerB64}.${payloadB64}`);
    verifier.end();

    const sigBuf = Buffer.from(signatureB64, 'base64url');
    const signatureValid = verifier.verify(publicKeyPem, sigBuf);
    if (!signatureValid) {
      return null;
    }

    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf-8'));
    const nowSec = Math.floor(Date.now() / 1000);
    const validIssuer = `https://securetoken.google.com/${firebaseConfig.projectId}`;

    if (
      payload.iss !== validIssuer ||
      payload.aud !== firebaseConfig.projectId ||
      typeof payload.sub !== 'string' ||
      payload.sub.trim().length === 0 ||
      typeof payload.exp !== 'number' ||
      payload.exp <= nowSec ||
      (typeof payload.iat === 'number' && payload.iat > nowSec + 300)
    ) {
      return null;
    }

    if (
      isSessionRevoked({
        rawToken: token,
        jti: payload.jti,
        userAccountId: payload.sub,
        iat: payload.iat,
      })
    ) {
      return null;
    }

    const matchedMembership = (store.memberships || []).find(
      (m) => m.userAccountId === payload.sub || (payload.email && m.email.toLowerCase() === String(payload.email).toLowerCase())
    );

    const resolvedUserId = matchedMembership ? matchedMembership.userAccountId : payload.sub;
    if (
      isSessionRevoked({
        rawToken: token,
        jti: payload.jti,
        userAccountId: resolvedUserId,
        iat: payload.iat,
      })
    ) {
      return null;
    }

    return {
      userAccountId: resolvedUserId,
      email: payload.email || matchedMembership?.email || '',
      displayName: payload.name || matchedMembership?.displayName || 'Authenticated User',
      authMethod: 'FIREBASE_ID_TOKEN',
      tokenJti: payload.jti,
      emailVerified: Boolean(payload.email_verified),
    };
  } catch {
    return null;
  }
}

/**
 * Verifies either:
 * 1. A server-issued `fos_v1.<payload>.<hmac>` token (using timing-safe HMAC comparison + secret rotation + revocation check), OR
 * 2. A cryptographically verified RS256 Firebase JWT ID token (`header.payload.signature`).
 */
export function verifyBearerToken(
  token: string,
  store: SharedStore,
  env: NodeJS.ProcessEnv = process.env
): VerifiedActorContext | null {
  if (!token || typeof token !== 'string') return null;

  // 1. Check server-signed HMAC session token
  if (token.startsWith('fos_v1.')) {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [, payloadB64, providedSig] = parts;
    if (!payloadB64 || !providedSig) return null;

    let activeSecret: string;
    try {
      activeSecret = getSessionSecret(env);
    } catch {
      return null;
    }

    const expectedSig = crypto
      .createHmac('sha256', activeSecret)
      .update(payloadB64)
      .digest('base64url');

    let sigMatches = timingSafeCompareStrings(providedSig, expectedSig);
    if (!sigMatches) {
      const prevSecret = getPreviousSessionSecret(env);
      if (prevSecret) {
        const expectedPrevSig = crypto
          .createHmac('sha256', prevSecret)
          .update(payloadB64)
          .digest('base64url');
        sigMatches = timingSafeCompareStrings(providedSig, expectedPrevSig);
      }
    }

    if (!sigMatches) return null;

    try {
      const decoded = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf-8'));
      const nowSec = Math.floor(Date.now() / 1000);
      if (
        !decoded ||
        typeof decoded.sub !== 'string' ||
        decoded.sub.trim().length === 0 ||
        typeof decoded.exp !== 'number' ||
        decoded.exp <= nowSec ||
        decoded.iss !== `https://securetoken.google.com/${firebaseConfig.projectId}` ||
        decoded.aud !== firebaseConfig.projectId
      ) {
        return null;
      }

      if (
        isSessionRevoked({
          rawToken: token,
          jti: decoded.jti,
          userAccountId: decoded.sub,
          iat: decoded.iat,
        })
      ) {
        return null;
      }

      return {
        userAccountId: decoded.sub,
        email: decoded.email || '',
        displayName: decoded.name || decoded.sub,
        authMethod: 'SESSION_TOKEN',
        tokenJti: decoded.jti,
        emailVerified: Boolean(decoded.email_verified ?? true),
      };
    } catch {
      return null;
    }
  }

  // 2. Cryptographically verify standard 3-part Firebase RS256 ID token
  return verifyFirebaseJwtCryptographically(token, store);
}

/**
 * Express middleware that enforces authenticated identity on all protected `/api/v1/*` routes.
 */
export function createAuthMiddleware(getStore: () => SharedStore, env: NodeJS.ProcessEnv = process.env) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Missing or invalid Authorization Bearer token. Firebase Authentication is required.',
      });
      return;
    }

    const rawToken = authHeader.slice('Bearer '.length).trim();
    const store = getStore();

    try {
      const verified = await verifyBearerTokenAsync(rawToken, store, env);
      if (!verified) {
        res.status(401).json({
          error: 'UNAUTHORIZED',
          message: 'Invalid, forged, expired, or revoked authentication token.',
        });
        return;
      }

      req.actor = verified;
      next();
    } catch (err: any) {
      if (err?.message === 'POSTGRES_UNAVAILABLE_NO_JSON_FALLBACK') {
        res.status(503).json({
          error: 'POSTGRES_UNAVAILABLE_NO_JSON_FALLBACK',
          message: 'PostgreSQL storage mode is active but database pool is unconfigured or unavailable.',
        });
        return;
      }
      res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Authentication token verification failed.',
      });
    }
  };
}

/**
 * Gatekeeper middleware enforcing that the authenticated actor's email address has been verified.
 * Blocks unverified email accounts from performing sensitive administrative or destructive operations.
 */
export function requireEmailVerified(req: Request, res: Response, next: NextFunction) {
  if (!req.actor) {
    res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'Authentication required.',
    });
    return;
  }
  if (req.actor.emailVerified === false) {
    res.status(403).json({
      error: 'EMAIL_NOT_VERIFIED',
      message: 'A verified email address is required to perform this action. Please verify your email.',
    });
    return;
  }
  next();
}

/**
 * Resolves the caller's authoritative FamilyMembership for a target `familyId` strictly from server records.
 * NEVER trusts client-supplied `actorRole`, `familyId`, or `memberId`.
 */
export function resolveServerMembership(
  store: SharedStore,
  userAccountId: string,
  targetFamilyId: string
): {
  allowed: boolean;
  httpStatus: number;
  errorCode?: string;
  errorMessage?: string;
  membership?: AuthoritativeMembership;
} {
  const memberships = store.memberships || [];
  const membership = memberships.find(
    (m) => m.userAccountId === userAccountId && m.familyId === targetFamilyId
  );

  if (!membership) {
    return {
      allowed: false,
      httpStatus: 403,
      errorCode: 'WORKSPACE_ISOLATION_VIOLATION',
      errorMessage: `Access denied: user '${userAccountId}' is not a member of family workspace '${targetFamilyId}'.`,
    };
  }

  if (membership.status === 'REVOKED' || membership.status === 'SUSPENDED') {
    return {
      allowed: false,
      httpStatus: 403,
      errorCode: 'MEMBERSHIP_REVOKED',
      errorMessage: `Access denied: membership for '${userAccountId}' in '${targetFamilyId}' has status '${membership.status}'.`,
    };
  }

  if (membership.status !== 'ACTIVE') {
    return {
      allowed: false,
      httpStatus: 403,
      errorCode: 'MEMBERSHIP_NOT_ACTIVE',
      errorMessage: `Access denied: membership status is '${membership.status}'.`,
    };
  }

  return {
    allowed: true,
    httpStatus: 200,
    membership,
  };
}

/**
 * Enforces the one-family membership rule: finds any existing ACTIVE membership for a user account across all workspaces.
 */
export function findActiveMembershipForUser(
  store: SharedStore,
  userAccountId: string,
  email?: string
): AuthoritativeMembership | undefined {
  const normalizedEmail = (email || '').trim().toLowerCase();
  return (store.memberships || []).find(
    (m) =>
      m.status === 'ACTIVE' &&
      (m.userAccountId === userAccountId ||
        (normalizedEmail.length > 0 && m.email.toLowerCase() === normalizedEmail))
  );
}

/**
 * Returns all active memberships for a user account across all family workspaces.
 */
export function getUserMemberships(
  store: SharedStore,
  userAccountId: string,
  email?: string
): AuthoritativeMembership[] {
  const normalizedEmail = (email || '').trim().toLowerCase();
  return (store.memberships || []).filter(
    (m) =>
      m.status === 'ACTIVE' &&
      (m.userAccountId === userAccountId ||
        (normalizedEmail.length > 0 && m.email.toLowerCase() === normalizedEmail))
  );
}

/**
 * Resolves the single canonical family membership for a user account under the ONE-FAMILY-PER-ACCOUNT rule.
 * Prioritizes:
 * 1. Family where user is OWNER.
 * 2. Oldest active membership.
 */
export function getCanonicalUserMembership(
  store: SharedStore,
  userAccountId: string,
  email?: string
): AuthoritativeMembership | null {
  const memberships = getUserMemberships(store, userAccountId, email);
  if (memberships.length === 0) return null;
  if (memberships.length === 1) return memberships[0];

  // If user is owner of any family, that is their canonical family
  const owned = memberships.find((m) => m.role === 'OWNER');
  if (owned) return owned;

  // Otherwise pick the earliest joined/updated membership
  return [...memberships].sort((a, b) => a.updatedAt - b.updatedAt)[0];
}


/**
 * Domain-specific permission matrix evaluated strictly against server-resolved `role`, `memberProfileId`, and `guardianRelationships`.
 */
export function canPerformFinanceMutation(role: FamilyRole): boolean {
  return role === 'OWNER' || role === 'ADMIN';
}

export function canManageMemberships(role: FamilyRole): boolean {
  return role === 'OWNER' || role === 'ADMIN';
}

export function canEditMemberProfile(
  callerMembership: AuthoritativeMembership,
  targetMemberProfileId: string
): boolean {
  if (callerMembership.role === 'OWNER' || callerMembership.role === 'ADMIN') {
    return true;
  }
  if (callerMembership.role === 'GUEST') {
    return false;
  }
  return callerMembership.memberProfileId === targetMemberProfileId;
}

export function canAccessMinorHealthRecord(
  store: SharedStore,
  callerMembership: AuthoritativeMembership,
  targetMemberId: string
): boolean {
  if (callerMembership.memberProfileId === targetMemberId) {
    return true;
  }
  const guardians = store.guardianRelationships || [];
  const isVerifiedGuardian = guardians.some(
    (g) =>
      g.familyId === callerMembership.familyId &&
      g.guardianMemberId === callerMembership.memberProfileId &&
      g.minorMemberId === targetMemberId &&
      g.canManageHealthRecords
  );
  return isVerifiedGuardian;
}

export function canAccessPrivateJournal(
  callerMembership: AuthoritativeMembership,
  ownerMemberId: string,
  isPrivate: boolean
): boolean {
  if (!isPrivate) return true;
  return callerMembership.memberProfileId === ownerMemberId;
}

export function canAccessCoupleEnclave(role: FamilyRole): boolean {
  return role === 'OWNER' || role === 'ADMIN';
}

export function canAccessDocumentByLevel(
  role: FamilyRole,
  accessLevel: 'Owner & Admin Only' | 'Adult Members' | 'All Household' | string
): boolean {
  if (accessLevel === 'Owner & Admin Only') {
    return role === 'OWNER' || role === 'ADMIN';
  }
  if (accessLevel === 'Adult Members') {
    return role === 'OWNER' || role === 'ADMIN' || role === 'MEMBER';
  }
  return role !== 'GUEST' || accessLevel === 'All Household';
}

export function canViewPersonalMemberInfo(
  store: SharedStore,
  callerMembership: AuthoritativeMembership,
  targetMember: AuthoritativeFamilyMember
): boolean {
  if (callerMembership.memberProfileId === targetMember.id) {
    return true;
  }
  if (targetMember.isRestrictedProfile) {
    return canAccessMinorHealthRecord(store, callerMembership, targetMember.id);
  }
  return false;
}

export function sanitizeMemberForCaller(
  store: SharedStore,
  callerMembership: AuthoritativeMembership,
  member: AuthoritativeFamilyMember
): AuthoritativeFamilyMember & { personalInfoRedacted?: boolean } {
  const canViewPersonal = canViewPersonalMemberInfo(store, callerMembership, member);
  if (canViewPersonal) {
    return {
      ...member,
      personalInfoRedacted: false,
    };
  }
  return {
    ...member,
    personalInfo: null,
    personalInfoRedacted: true,
  };
}

/**
 * Validates relationship graph constraints:
 * 1. Cannot link a member to themselves.
 * 2. Cannot duplicate an existing relationship edge.
 * 3. Cannot create a directed PARENT_CHILD cycle (DAG check).
 */
export function validateRelationshipGraph(
  existingRelationships: AuthoritativeFamilyRelationship[],
  familyId: string,
  person1MemberId: string,
  person2MemberId: string,
  relationshipType: RelationshipTypeCode
): { valid: boolean; errorCode?: string; errorMessage?: string } {
  if (!person1MemberId || !person2MemberId) {
    return {
      valid: false,
      errorCode: 'INVALID_RELATIONSHIP_MEMBERS',
      errorMessage: 'Both person1MemberId and person2MemberId are required.',
    };
  }

  if (person1MemberId === person2MemberId) {
    return {
      valid: false,
      errorCode: 'SELF_RELATIONSHIP_FORBIDDEN',
      errorMessage: 'A family member cannot have a relationship with themselves.',
    };
  }

  const familyRels = existingRelationships.filter(
    (r) => r.familyId === familyId && !r.isDeleted
  );

  const isDuplicate = familyRels.some(
    (r) =>
      (r.person1MemberId === person1MemberId &&
        r.person2MemberId === person2MemberId &&
        r.relationshipType === relationshipType) ||
      (relationshipType !== 'PARENT_CHILD' &&
        relationshipType !== 'GRANDPARENT_GRANDCHILD' &&
        relationshipType !== 'GUARDIAN_WARD' &&
        r.person1MemberId === person2MemberId &&
        r.person2MemberId === person1MemberId &&
        r.relationshipType === relationshipType)
  );

  if (isDuplicate) {
    return {
      valid: false,
      errorCode: 'DUPLICATE_RELATIONSHIP',
      errorMessage: 'This relationship between the selected family members already exists.',
    };
  }

  if (relationshipType === 'PARENT_CHILD' || relationshipType === 'GRANDPARENT_GRANDCHILD') {
    const parentToChildren = new Map<string, string[]>();
    for (const r of familyRels) {
      if (r.relationshipType === 'PARENT_CHILD' || r.relationshipType === 'GRANDPARENT_GRANDCHILD') {
        const list = parentToChildren.get(r.person1MemberId) || [];
        list.push(r.person2MemberId);
        parentToChildren.set(r.person1MemberId, list);
      }
    }
    const visited = new Set<string>();
    const queue: string[] = [person2MemberId];
    while (queue.length > 0) {
      const curr = queue.shift()!;
      if (curr === person1MemberId) {
        return {
          valid: false,
          errorCode: 'RELATIONSHIP_CYCLE_DETECTED',
          errorMessage: `Parent-child cycle detected: '${person1MemberId}' is already a descendant of '${person2MemberId}'.`,
        };
      }
      if (!visited.has(curr)) {
        visited.add(curr);
        const children = parentToChildren.get(curr) || [];
        queue.push(...children);
      }
    }
  }

  return { valid: true };
}
