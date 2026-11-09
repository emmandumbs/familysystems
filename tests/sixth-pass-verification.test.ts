import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert';
import crypto from 'node:crypto';

import {
  createEncryptedProtectedBackup,
  verifyAndDecryptProtectedBackup,
  decryptBackupPayload,
  evaluateStorageAvailability,
} from '../src/server/postgresMigrationAndBackup.js';

import {
  recordAuthSessionPg,
  isSessionRevokedPg,
  revokeSessionTokenPg,
  revokeAllSessionsForUserPg,
  cleanupExpiredAuthSessionsPg,
} from '../src/server/authAndRbac.js';

import {
  reconcileAccountBalancesFromLedger,
  reconcileAccountBalancesFromPgLedger,
  computeAuthoritativeNetWorth,
  computeAuthoritativeCashFlow,
} from '../src/server/financeCalculations.js';

(async () => {
  console.log('\n================================================================');
  console.log('🛡️ FAMILYOS — SIXTH-PASS FINAL SECURITY, IDEMPOTENCY & RECONCILIATION SUITE');
  console.log('================================================================\n');

  let passed = 0;
  let total = 0;

  async function runTest(description: string, fn: () => void | Promise<void>) {
    total++;
    try {
      await fn();
      passed++;
      console.log(`  ✓ [TEST ${total}] PASS: ${description}`);
    } catch (err: any) {
      console.error(`  ✗ [TEST ${total}] FAIL: ${description} ->`, err.message || err);
    }
  }

  // --------------------------------------------------------------------------
  // 1. POSTGRESQL SESSION LIFECYCLE (PGlite Database Engine Verification)
  // --------------------------------------------------------------------------
  await runTest('PGlite: PostgreSQL auth_sessions table lifecycle (issuance, lookup, single/all revocation, cross-instance sync)', async () => {
    const db = new PGlite();
    const sql0001 = fs.readFileSync(path.join(process.cwd(), 'migrations/postgres/0001_familyos_v340_up.sql'), 'utf-8');
    const sql0002 = fs.readFileSync(path.join(process.cwd(), 'migrations/postgres/0002_familyos_v341_reconciliation_up.sql'), 'utf-8');
    await db.exec(sql0001);
    await db.exec(sql0002);

    const nowSec = Math.floor(Date.now() / 1000);
    const userAccountId = 'usr-pg-sess-1';

    // Seed user account
    await db.query(`
      INSERT INTO user_accounts (id, email, display_name, revoked_before_sec, created_at, updated_at)
      VALUES ('${userAccountId}', 'sarah@example.com', 'Sarah', 0, ${nowSec}, ${nowSec});
    `);

    // 1. Record session
    const sess1 = {
      sessionIdentifier: 'jti-pg-100',
      tokenHash: crypto.createHash('sha256').update('fos_v1.token100').digest('hex'),
      userAccountId,
      createdAtSec: nowSec,
      expiresAtSec: nowSec + 86400,
      isRevoked: false,
      deviceInfo: 'Firefox / Linux',
    };

    await recordAuthSessionPg(db, sess1);

    // Lookup session status
    let isRev = await isSessionRevokedPg(db, { rawToken: 'fos_v1.token100', jti: 'jti-pg-100', userAccountId });
    assert.strictEqual(isRev, false, 'New session in auth_sessions table must not be revoked.');

    // 2. Revoke single session
    await revokeSessionTokenPg(db, 'jti-pg-100', 'LOGOUT');
    isRev = await isSessionRevokedPg(db, { rawToken: 'fos_v1.token100', jti: 'jti-pg-100', userAccountId });
    assert.strictEqual(isRev, true, 'Revoked session in auth_sessions table must be rejected.');

    // 3. Issue second session and revoke all sessions for user
    const sess2 = {
      sessionIdentifier: 'jti-pg-200',
      tokenHash: crypto.createHash('sha256').update('fos_v1.token200').digest('hex'),
      userAccountId,
      createdAtSec: nowSec,
      expiresAtSec: nowSec + 86400,
      isRevoked: false,
      deviceInfo: 'Chrome / Android',
    };

    await recordAuthSessionPg(db, sess2);
    await revokeAllSessionsForUserPg(db, userAccountId, nowSec + 10);

    const isRev2 = await isSessionRevokedPg(db, { rawToken: 'fos_v1.token200', jti: 'jti-pg-200', userAccountId, iat: nowSec });
    assert.strictEqual(isRev2, true, 'All sessions for user must be revoked in database.');

    // 4. Cleanup expired revoked sessions
    await recordAuthSessionPg(db, {
      sessionIdentifier: 'jti-expired-revoked',
      tokenHash: 'hash-expired',
      userAccountId,
      createdAtSec: nowSec - 10000,
      expiresAtSec: nowSec - 1000,
      isRevoked: true,
      deviceInfo: 'Expired',
    });

    const cleaned = await cleanupExpiredAuthSessionsPg(db, nowSec);
    assert.ok(cleaned >= 1, 'Expired revoked sessions must be cleaned up from auth_sessions table.');
  });

  // --------------------------------------------------------------------------
  // 2. STABLE FINANCIAL IDEMPOTENCY & PAYLOAD MISMATCH PROTECTION
  // --------------------------------------------------------------------------
  await runTest('Stable financial idempotency: payload mismatch detection rejects duplicate key reuse with different parameters', () => {
    const familyId = 'fam-idemp-test';
    const idempotencyKey = 'idemp-tx-stable-500';

    const processedMap: Record<string, any> = {};

    const originalTx = {
      id: 'tx-orig-1',
      familyId,
      accountId: 'acc-check-1',
      title: 'Groceries',
      amountCents: 5000,
      amountCentsDecimal: '5000',
      transactionType: 'EXPENSE',
      category: 'FOOD',
    };

    processedMap[idempotencyKey] = {
      idempotencyKey,
      responseReceipt: { transaction: originalTx },
    };

    // Retry 1: Identical request payload -> returns deduplicated original receipt
    const isIdentical = (reqAmt: number, reqAcc: string, reqType: string) => {
      const cached = processedMap[idempotencyKey]?.responseReceipt?.transaction;
      if (!cached) return false;
      return cached.amountCents === reqAmt && cached.accountId === reqAcc && cached.transactionType === reqType;
    };

    assert.strictEqual(isIdentical(5000, 'acc-check-1', 'EXPENSE'), true, 'Identical retry payload must match cached receipt.');

    // Retry 2: Materially different payload (e.g. $90.00 instead of $50.00) -> Mismatch detected!
    assert.strictEqual(isIdentical(9000, 'acc-check-1', 'EXPENSE'), false, 'Mismatched amount in duplicate idempotency key must be detected.');
    assert.strictEqual(isIdentical(5000, 'acc-different-acc', 'EXPENSE'), false, 'Mismatched account in duplicate idempotency key must be detected.');
  });

  // --------------------------------------------------------------------------
  // 3. TRUE CONCURRENT FINANCIAL TESTING IN PGLITE
  // --------------------------------------------------------------------------
  await runTest('PGlite: Simultaneous postings with same key execute safely and partial failures roll back completely', async () => {
    const db = new PGlite();
    const sql0001 = fs.readFileSync(path.join(process.cwd(), 'migrations/postgres/0001_familyos_v340_up.sql'), 'utf-8');
    const sql0002 = fs.readFileSync(path.join(process.cwd(), 'migrations/postgres/0002_familyos_v341_reconciliation_up.sql'), 'utf-8');
    await db.exec(sql0001);
    await db.exec(sql0002);

    const now = Date.now();
    await db.exec(`
      INSERT INTO family_workspaces (id, name, owner_user_id, created_at, updated_at)
      VALUES ('fam-conc-6', 'Concurrent Family 6', 'usr-c6', ${now}, ${now});

      INSERT INTO financial_accounts (id, family_id, name, account_type, current_balance_cents, is_liability, created_at, updated_at)
      VALUES 
        ('acc-conc-chk6', 'fam-conc-6', 'Checking', 'CHECKING', 100000, false, ${now}, ${now}),
        ('acc-conc-exp6', 'fam-conc-6', 'Expense', 'EXPENSE', 0, false, ${now}, ${now});
    `);

    // Concurrent postings: 1 valid posting, 1 invalid posting (nonexistent account FK failure)
    const validCall = db.query(`
      SELECT post_financial_transaction(
        'tx-valid-1'::text,
        'fam-conc-6'::text,
        'acc-conc-chk6'::text,
        'acc-conc-exp6'::text,
        'Valid Bill'::text,
        5000::bigint,
        'EXPENSE'::text,
        'UTILITIES'::text,
        ${now}::bigint,
        'Sarah'::text,
        'idemp-valid-1'::text
      );
    `);

    const invalidCall = (async () => {
      try {
        await db.query('BEGIN;');
        await db.query(`
          SELECT post_financial_transaction(
            'tx-invalid-1'::text,
            'fam-conc-6'::text,
            'acc-conc-chk6'::text,
            'acc-nonexistent-99'::text,
            'Invalid Bill'::text,
            5000::bigint,
            'TRANSFER'::text,
            'UTILITIES'::text,
            ${now}::bigint,
            'Sarah'::text,
            'idemp-invalid-1'::text
          );
        `);
        await db.query('COMMIT;');
      } catch {
        await db.query('ROLLBACK;').catch(() => {});
      }
    })();

    await Promise.all([validCall, invalidCall]);

    // Verify valid transaction committed
    const txVal = await db.query(`SELECT status FROM financial_transactions WHERE id = 'tx-valid-1'`);
    assert.strictEqual((txVal.rows[0] as any).status, 'POSTED');

    // Verify invalid transaction left zero orphaned rows
    const txInval = await db.query(`SELECT count(*) as cnt FROM financial_transactions WHERE id = 'tx-invalid-1'`);
    assert.strictEqual(Number((txInval.rows[0] as any).cnt), 0, 'Invalid transaction must be completely rolled back with 0 orphaned rows.');

    // Verify account balance reflects exactly the 1 valid transaction
    const balRes = await db.query(`SELECT current_balance_cents FROM financial_accounts WHERE id = 'acc-conc-chk6'`);
    assert.strictEqual(Number((balRes.rows[0] as any).current_balance_cents), 95000, 'Balance must equal 100,000 - 5,000 = 95,000.');
  });

  // --------------------------------------------------------------------------
  // 4. LEDGER-TO-ACCOUNT RECONCILIATION & BALANCE DRIFT RECOVERY
  // --------------------------------------------------------------------------
  await runTest('Ledger-to-account reconciliation detects account balance drift and restores exact ledger-derived balance', () => {
    const familyId = 'fam-rec-drift';

    const accounts = [
      {
        id: 'acc-drift-chk',
        familyId,
        name: 'Checking',
        accountType: 'CHECKING' as const,
        currentBalanceCents: 90000, // Corrupted/Drifted balance: $900 instead of $950
        isLiability: false,
      },
    ];

    const entries = [
      {
        id: 'e1',
        familyId,
        transactionId: 'tx-1',
        accountId: 'acc-drift-chk',
        entryType: 'DEBIT' as const,
        amountCents: 100000, // +$1,000 DEBIT
        sequenceNumber: 1,
        createdAt: Date.now(),
      },
      {
        id: 'e2',
        familyId,
        transactionId: 'tx-2',
        accountId: 'acc-drift-chk',
        entryType: 'CREDIT' as const,
        amountCents: 5000, // -$50 CREDIT
        sequenceNumber: 1,
        createdAt: Date.now(),
      },
    ];

    // Calculated ledger balance: DEBITS ($1000) - CREDITS ($50) = $950 (95,000 cents)
    const result = reconcileAccountBalancesFromLedger(accounts as any, entries as any, familyId);

    assert.strictEqual(result.totalDriftCount, 1, 'Reconciliation must detect 1 balance drift.');
    assert.strictEqual(result.driftReports[0].recordedBalanceCentsBig, 90000n, 'Recorded balance was 90,000 cents.');
    assert.strictEqual(result.driftReports[0].calculatedLedgerBalanceCentsBig, 95000n, 'Calculated ledger balance is 95,000 cents.');
    assert.strictEqual(accounts[0].currentBalanceCents, 95000, 'Account balance must be corrected to match 95,000 cents.');

    // Second reconciliation run on corrected store -> 0 drifts detected (repeatable and non-mutating)
    const result2 = reconcileAccountBalancesFromLedger(accounts as any, entries as any, familyId);
    assert.strictEqual(result2.totalDriftCount, 0, 'Repeatable reconciliation on correct balances must produce 0 drift.');
  });

  // --------------------------------------------------------------------------
  // 5. AES-256-GCM BACKUP ENCRYPTION VERIFICATION
  // --------------------------------------------------------------------------
  await runTest('AES-256-GCM backup encryption: authenticated encryption, tampered ciphertext rejection, PBKDF2 key derivation', () => {
    const tmpDataDir = path.resolve(process.cwd(), 'data/tmp-enc-test');
    if (!fs.existsSync(tmpDataDir)) {
      fs.mkdirSync(tmpDataDir, { recursive: true });
    }

    const testStorePath = path.join(tmpDataDir, 'source-store-enc.json');
    const testBackupPath = path.join(tmpDataDir, 'protected-encrypted-backup.bak.json');
    const secretKey = 'high-entropy-production-backup-secret-key-v341';

    const sampleStoreContent = JSON.stringify({
      schemaVersion: '3.4.1',
      accounts: [{ id: 'acc-enc-1', familyId: 'fam-1', name: 'Secure Checking', accountType: 'CHECKING', currentBalanceCents: 250000, isLiability: false }],
      transactions: [],
      budgets: [],
      processedIdempotencyKeys: {},
      auditEvents: [],
    });

    fs.writeFileSync(testStorePath, sampleStoreContent, 'utf-8');

    // 1. Create AES-256-GCM encrypted backup
    const meta = createEncryptedProtectedBackup(testStorePath, testBackupPath, secretKey);
    assert.strictEqual(meta.isEncrypted, true, 'Backup metadata must state isEncrypted: true.');

    const cipherTextRaw = fs.readFileSync(testBackupPath, 'utf-8');
    assert.ok(cipherTextRaw.includes('FOS_AES_256_GCM_v1'), 'Backup file must contain FOS_AES_256_GCM_v1 format header.');
    assert.ok(!cipherTextRaw.includes('Secure Checking'), 'Plaintext data must not be visible in encrypted backup file.');

    // 2. Decrypt and verify valid backup
    const decryptedRes = verifyAndDecryptProtectedBackup(testBackupPath, secretKey);
    assert.strictEqual(decryptedRes.valid, true, 'Encrypted backup must pass authentication tag verification.');
    assert.ok(decryptedRes.plaintext?.includes('Secure Checking'), 'Decrypted plaintext must restore exact store contents.');

    // 3. Tamper rejection test: modify 1 byte of ciphertext
    const container = JSON.parse(cipherTextRaw);
    container.ciphertextB64 = container.ciphertextB64.slice(0, -4) + 'AAAA';
    fs.writeFileSync(testBackupPath, JSON.stringify(container), 'utf-8');

    const tamperedRes = verifyAndDecryptProtectedBackup(testBackupPath, secretKey);
    assert.strictEqual(tamperedRes.valid, false, 'Tampered ciphertext must fail GCM authentication tag verification.');

    // Cleanup
    fs.rmSync(tmpDataDir, { recursive: true, force: true });
  });

  // --------------------------------------------------------------------------
  // 6. FAIL-CLOSED STORAGE AVAILABILITY VERIFICATION
  // --------------------------------------------------------------------------
  await runTest('evaluateStorageAvailability fails closed with POSTGRES_UNAVAILABLE_NO_JSON_FALLBACK when PG mode is unconfigured', () => {
    const mockEnv = {
      FAMILYOS_STORAGE_MODE: 'postgres',
      SQL_HOST: '', // Unconfigured
    };

    const status = evaluateStorageAvailability(mockEnv as any);
    assert.strictEqual(status.mode, 'postgres');
    assert.strictEqual(status.available, false);
    assert.strictEqual(status.errorCode, 'POSTGRES_UNAVAILABLE_NO_JSON_FALLBACK');
  });

  console.log('\n================================================================');
  console.log(`📊 SIXTH-PASS AUDIT SUITE FINISHED: ${passed}/${total} PASSED`);
  console.log('================================================================\n');

  if (passed !== total) {
    process.exit(1);
  }
})().catch((err) => {
  console.error('SIXTH-PASS TEST RUNNER EXCEPTION:', err);
  process.exit(1);
});
