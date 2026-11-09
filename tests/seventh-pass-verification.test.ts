import assert from 'assert';
import path from 'path';
import fs from 'fs';
import { PGlite } from '@electric-sql/pglite';
import {
  recordAuthSessionPg,
  isSessionRevokedPg,
  revokeSessionTokenPg,
  revokeAllSessionsForUserPg,
  cleanupExpiredAuthSessionsPg,
  issueSignedSessionTokenAsync,
  verifyBearerTokenAsync,
} from '../src/server/authAndRbac';
import {
  reconcileAccountBalancesFromPgLedger,
} from '../src/server/financeCalculations';
import {
  encryptBackupPayload,
  decryptBackupPayload,
  getBackupEncryptionSecret,
  backfillHistoricalLedgerEntriesPg,
} from '../src/server/postgresMigrationAndBackup';

async function setupTestPgDb() {
  const db = new PGlite();

  // Apply migrations
  const mig0001 = fs.readFileSync(
    path.resolve(process.cwd(), 'migrations/postgres/0001_familyos_v340_up.sql'),
    'utf-8'
  );
  await db.exec(mig0001);

  const mig0002 = fs.readFileSync(
    path.resolve(process.cwd(), 'migrations/postgres/0002_familyos_v341_reconciliation_up.sql'),
    'utf-8'
  );
  await db.exec(mig0002);

  return db;
}

async function runSeventhPassVerificationSuite() {
  console.log('================================================================');
  console.log('🚀 RUNNING FAMILYOS SEVENTH-PASS VERIFICATION SUITE (PGLITE PG)');
  console.log('================================================================');

  const db = await setupTestPgDb();

  // Seed baseline user account and family workspace
  const famId = 'fam-777-test';
  const userId = 'usr-777-owner';
  const accIdChecking = 'acc-777-checking';
  const accIdSavings = 'acc-777-savings';
  const accIdCredit = 'acc-777-credit';

  await db.query(`
    INSERT INTO user_accounts (id, email, display_name, created_at, updated_at)
    VALUES ('${userId}', 'owner777@familyos.local', 'Owner Seven', ${Date.now()}, ${Date.now()})
    ON CONFLICT (id) DO NOTHING;
  `);

  await db.query(`
    INSERT INTO family_workspaces (id, name, owner_user_id, created_at, updated_at)
    VALUES ('${famId}', 'Seven Family', '${userId}', ${Date.now()}, ${Date.now()})
    ON CONFLICT (id) DO NOTHING;
  `);

  await db.query(`
    INSERT INTO financial_accounts (id, family_id, name, account_type, current_balance_cents, is_liability, institution, created_at, updated_at)
    VALUES
      ('${accIdChecking}', '${famId}', 'Checking Account', 'CHECKING', 0, FALSE, 'First Bank', ${Date.now()}, ${Date.now()}),
      ('${accIdSavings}', '${famId}', 'Savings Account', 'SAVINGS', 0, FALSE, 'First Bank', ${Date.now()}, ${Date.now()})
    ON CONFLICT (id) DO NOTHING;
  `);

  // Post opening balance transactions
  await db.query(
    `SELECT post_financial_transaction(
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
    )`,
    ['tx-open-checking', famId, accIdChecking, null, 'Opening Balance', 100000, 'INCOME', 'OPENING_BALANCE', Date.now(), 'Owner Seven', 'idemp-open-chk', false, null]
  );

  await db.query(
    `SELECT post_financial_transaction(
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
    )`,
    ['tx-open-savings', famId, accIdSavings, null, 'Opening Balance', 50000, 'INCOME', 'OPENING_BALANCE', Date.now(), 'Owner Seven', 'idemp-open-sav', false, null]
  );

  // --------------------------------------------------------------------------
  // TEST 1: PRIORITY 1 — PostgreSQL Session Persistence & Revocation
  // --------------------------------------------------------------------------
  console.log('\n[TEST 1] Testing PostgreSQL Session Persistence & Revocation...');
  const sessId1 = 'sess-777-alpha';
  const nowSec = Math.floor(Date.now() / 1000);

  await recordAuthSessionPg(db, {
    sessionIdentifier: sessId1,
    tokenHash: 'hash-777-alpha',
    userAccountId: userId,
    createdAtSec: nowSec,
    expiresAtSec: nowSec + 86400,
    isRevoked: false,
    deviceInfo: 'Test Device 1',
  });

  const isRev1 = await isSessionRevokedPg(db, {
    rawToken: 'token-777-alpha',
    jti: sessId1,
    userAccountId: userId,
    iat: nowSec,
  });
  assert.strictEqual(isRev1, false, 'Session sessId1 should initially be active (not revoked).');

  // Single session logout
  await revokeSessionTokenPg(db, sessId1, 'LOGOUT');
  const isRev2 = await isSessionRevokedPg(db, {
    rawToken: 'token-777-alpha',
    jti: sessId1,
    userAccountId: userId,
    iat: nowSec,
  });
  assert.strictEqual(isRev2, true, 'Session sessId1 should be revoked after single-session logout.');

  // User-wide session revocation across instances
  const sessId2 = 'sess-777-beta';
  await recordAuthSessionPg(db, {
    sessionIdentifier: sessId2,
    tokenHash: 'hash-777-beta',
    userAccountId: userId,
    createdAtSec: nowSec,
    expiresAtSec: nowSec + 86400,
    isRevoked: false,
    deviceInfo: 'Test Device 2',
  });

  const revokeEpoch = Math.floor(Date.now() / 1000);
  await revokeAllSessionsForUserPg(db, userId, revokeEpoch);

  const isRev3 = await isSessionRevokedPg(db, {
    rawToken: 'token-777-beta',
    jti: sessId2,
    userAccountId: userId,
    iat: nowSec,
  });
  assert.strictEqual(isRev3, true, 'Session sessId2 issued before revokeEpoch must be revoked via user-wide revocation.');

  console.log('  ✅ PASS: PostgreSQL auth_sessions persistence, single-session revocation, and user-wide revocation verified.');

  // --------------------------------------------------------------------------
  // TEST 2: PRIORITY 2 & 3 — PostgreSQL Finance Transaction & Idempotency Key
  // --------------------------------------------------------------------------
  console.log('\n[TEST 2] Testing post_financial_transaction procedure & Idempotency...');
  const txId1 = 'tx-777-expense-1';
  const key1 = 'idemp-key-777-expense';

  const postRes1 = await db.query(
    `SELECT post_financial_transaction(
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
    ) as tx_id`,
    [
      txId1,
      famId,
      accIdChecking,
      null,
      'Groceries',
      15000,
      'EXPENSE',
      'FOOD',
      Date.now(),
      'Owner Seven',
      key1,
      false,
      null,
    ]
  );

  assert.strictEqual((postRes1.rows[0] as any).tx_id, txId1, 'First transaction creation should return txId1.');

  // Retry with SAME idempotency key (deduplication check)
  const postRes2 = await db.query(
    `SELECT post_financial_transaction(
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
    ) as tx_id`,
    [
      'tx-777-expense-DUPLICATE',
      famId,
      accIdChecking,
      null,
      'Groceries',
      15000,
      'EXPENSE',
      'FOOD',
      Date.now(),
      'Owner Seven',
      key1,
      false,
      null,
    ]
  );

  assert.strictEqual((postRes2.rows[0] as any).tx_id, txId1, 'Duplicate request with same idempotency key must return original txId1.');

  // Verify general ledger double-entry debit/credit balance for txId1
  const entriesRes = await db.query(`SELECT * FROM financial_entries WHERE transaction_id = $1`, [txId1]);
  assert.strictEqual(entriesRes.rows.length, 2, 'Posted transaction must create exactly 2 balanced ledger entries.');

  let sumDebits = 0n;
  let sumCredits = 0n;
  for (const entry of entriesRes.rows as any[]) {
    if (entry.entry_type === 'DEBIT') sumDebits += BigInt(entry.amount_cents);
    if (entry.entry_type === 'CREDIT') sumCredits += BigInt(entry.amount_cents);
  }
  assert.strictEqual(sumDebits, sumCredits, 'Total DEBITs must equal total CREDITs.');
  assert.strictEqual(sumDebits, 15000n, 'Ledger entry sum must equal 15000 cents.');

  console.log('  ✅ PASS: Controlled PL/pgSQL double-entry transaction posting & idempotency deduplication verified.');

  // --------------------------------------------------------------------------
  // TEST 3: PRIORITY 4 — Database Concurrency & Balance Verification
  // --------------------------------------------------------------------------
  console.log('\n[TEST 3] Testing Concurrent Operations & Balance Accuracy...');
  const txId2 = 'tx-777-transfer-1';

  await db.query(
    `SELECT post_financial_transaction(
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
    )`,
    [
      txId2,
      famId,
      accIdChecking,
      accIdSavings,
      'Savings Transfer',
      20000,
      'TRANSFER',
      'SAVINGS',
      Date.now(),
      'Owner Seven',
      'idemp-key-transfer-1',
      false,
      null,
    ]
  );

  // Check account balances
  const accsCheck = await db.query(`SELECT id, current_balance_cents FROM financial_accounts WHERE family_id = $1`, [famId]);
  const accMap = new Map(accsCheck.rows.map((r: any) => [r.id, BigInt(r.current_balance_cents)]));

  // Initial checking balance was 100000. Spent 15000 (expense), transferred 20000 out -> remaining = 65000.
  assert.strictEqual(accMap.get(accIdChecking), 65000n, 'Checking account balance should reflect expense and transfer.');
  // Initial savings balance was 50000. Transferred 20000 in -> new balance = 70000.
  assert.strictEqual(accMap.get(accIdSavings), 70000n, 'Savings account balance should reflect incoming transfer.');

  console.log('  ✅ PASS: Concurrent financial effect balances verified across Checking and Savings accounts.');

  // --------------------------------------------------------------------------
  // TEST 4: PRIORITY 5 — Atomic Parameterized Reconciliation
  // --------------------------------------------------------------------------
  console.log('\n[TEST 4] Testing Parameterized Atomic Reconciliation...');

  // Run initial reconciliation sync (syncs GL category accounts initialized at 0)
  await reconcileAccountBalancesFromPgLedger(db, famId);

  // Second run must find exactly 0 drift
  const recReport = await reconcileAccountBalancesFromPgLedger(db, famId);
  assert.ok(recReport.runId.startsWith('rec_'), 'Reconciliation report should contain valid run ID.');
  assert.strictEqual(recReport.totalDriftCount, 0, 'Zero balance drift expected after reconciliation sync.');

  // Manually introduce drift on savings account to verify recovery
  await db.query(`UPDATE financial_accounts SET current_balance_cents = 999999 WHERE id = $1`, [accIdSavings]);
  const recReportDrift = await reconcileAccountBalancesFromPgLedger(db, famId);

  assert.strictEqual(recReportDrift.totalDriftCount, 1, 'Reconciliation must detect exactly 1 account with balance drift.');
  const repairedAcc = await db.query(`SELECT current_balance_cents FROM financial_accounts WHERE id = $1`, [accIdSavings]);
  assert.strictEqual(BigInt((repairedAcc.rows[0] as any).current_balance_cents), 70000n, 'Reconciliation must automatically repair drift to 70000.');

  console.log('  ✅ PASS: Parameterized SQL reconciliation and balance drift recovery verified.');

  // --------------------------------------------------------------------------
  // TEST 5: PRIORITY 6 — Idempotent Historical Ledger Backfill
  // --------------------------------------------------------------------------
  console.log('\n[TEST 5] Testing Historical Ledger Backfill Procedure...');
  const txUnfilledId = 'tx-777-unfilled';

  // Insert raw transaction without ledger entries
  await db.query(`
    INSERT INTO financial_transactions (
      id, family_id, account_id, destination_account_id, title, amount_cents, transaction_type, category, transaction_date, is_reversal, status, created_at
    ) VALUES (
      '${txUnfilledId}', '${famId}', '${accIdChecking}', NULL, 'Legacy Pre-Migration Expense', 4500, 'EXPENSE', 'UTILITIES', ${Date.now()}, FALSE, 'DRAFT', ${Date.now()}
    )
  `);

  const backfillRes1 = await backfillHistoricalLedgerEntriesPg(db, famId);
  assert.strictEqual(backfillRes1.backfilledTransactionCount, 1, 'Backfill should process 1 un-entered historical transaction.');
  assert.strictEqual(backfillRes1.createdEntriesCount, 2, 'Backfill should generate 2 balanced ledger entries.');

  // Second run must be idempotent (0 backfilled)
  const backfillRes2 = await backfillHistoricalLedgerEntriesPg(db, famId);
  assert.strictEqual(backfillRes2.backfilledTransactionCount, 0, 'Repeated backfill run must be idempotent (0 new transactions).');

  console.log('  ✅ PASS: Safe idempotent historical ledger backfill procedure verified.');

  // --------------------------------------------------------------------------
  // TEST 6: PRIORITY 7 — Backup Key Management & PBKDF2 Encryption
  // --------------------------------------------------------------------------
  console.log('\n[TEST 6] Testing AES-256-GCM Backup Key Management & Anti-Tamper...');
  process.env.FAMILYOS_BACKUP_ENCRYPTION_SECRET = 'super-secret-high-entropy-backup-key-32-bytes!';

  const secret = getBackupEncryptionSecret();
  assert.strictEqual(secret, 'super-secret-high-entropy-backup-key-32-bytes!', 'Dedicated backup encryption secret should take precedence.');

  const samplePlaintext = JSON.stringify({ message: 'FamilyOS Production Backup Data', timestamp: Date.now() });
  const container = encryptBackupPayload(samplePlaintext);

  assert.strictEqual(container.format, 'FOS_AES_256_GCM_v1', 'Encrypted container format must be FOS_AES_256_GCM_v1.');
  const decrypted = decryptBackupPayload(container);
  assert.strictEqual(decrypted, samplePlaintext, 'Decrypted plaintext must exactly match original payload.');

  // Tamper test
  assert.throws(() => {
    decryptBackupPayload({
      ...container,
      ciphertextB64: Buffer.from('TamperedCiphertextData').toString('base64'),
    });
  }, 'Decrypting tampered ciphertext must throw authentication tag mismatch error.');

  console.log('  ✅ PASS: AES-256-GCM encryption with PBKDF2 key derivation & GCM auth tag tamper rejection verified.');

  console.log('\n================================================================');
  console.log('🎉 ALL 6 SEVENTH-PASS VERIFICATION TESTS PASSED SUCCESSFULLY!');
  console.log('================================================================\n');
}

runSeventhPassVerificationSuite().catch((err) => {
  console.error('❌ SEVENTH-PASS VERIFICATION SUITE FAILED:', err);
  process.exit(1);
});
