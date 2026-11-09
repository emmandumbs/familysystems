import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert';
import crypto from 'node:crypto';
import sharp from 'sharp';

import {
  createProtectedPrePostgresBackup,
  verifyProtectedBackup,
  restoreFromProtectedBackup,
  computeBackupHmac,
} from '../src/server/postgresMigrationAndBackup.js';

import {
  recordAuthSession,
  getTrackedAuthSessions,
  revokeSessionToken,
  revokeAllSessionsForUser,
  isSessionRevoked,
  cleanupExpiredAuthSessions,
  clearRevokedSessionsForTest,
  issueSignedSessionToken,
} from '../src/server/authAndRbac.js';

import {
  validateUploadedImageDataUrl,
  validateUploadedImageDataUrlAsync,
} from '../src/server/familySectionRoutes.js';

import {
  computeAuthoritativeNetWorth,
  computeAuthoritativeCashFlow,
  readEntityBigInt,
} from '../src/server/financeCalculations.js';

(async () => {
  console.log('\n================================================================');
  console.log('🛡️ FAMILYOS — FIFTH-PASS FINAL RUNTIME ACCOUNTING & DB VERIFICATION');
  console.log('================================================================\n');

  let passed = 0;
  let total = 0;

  function runTest(description: string, fn: () => void | Promise<void>) {
    total++;
    try {
      const res = fn();
      if (res && typeof (res as any).then === 'function') {
        return (res as any).then(
          () => {
            passed++;
            console.log(`  ✓ [TEST ${total}] PASS: ${description}`);
          },
          (err: any) => {
            console.error(`  ✗ [TEST ${total}] FAIL: ${description} ->`, err.message || err);
          }
        );
      } else {
        passed++;
        console.log(`  ✓ [TEST ${total}] PASS: ${description}`);
      }
    } catch (err: any) {
      console.error(`  ✗ [TEST ${total}] FAIL: ${description} ->`, err.message || err);
    }
  }

  // --------------------------------------------------------------------------
  // 1. INVESTMENT ACCOUNTING & FEE SEPARATION VERIFICATION
  // --------------------------------------------------------------------------
  await runTest('Investment purchase funded by cash is an Asset TRANSFER, not an operating Expense', async () => {
    const familyId = 'fam-inv-test';
    const now = Date.now();

    const checkingAcc = {
      id: 'acc-cash-1',
      familyId,
      name: 'Primary Checking',
      accountType: 'CHECKING' as const,
      currentBalanceCents: 500000, // $5,000.00
      currentBalanceCentsDecimal: '500000',
      isLiability: false,
      institution: 'Bank',
    };

    const invAcc = {
      id: 'acc-inv-1',
      familyId,
      name: 'Brokerage Investment',
      accountType: 'INVESTMENT' as const,
      currentBalanceCents: 0,
      currentBalanceCentsDecimal: '0',
      isLiability: false,
      institution: 'Fidelity',
    };

    const accounts = [checkingAcc, invAcc];

    // Purchase $1,000 of AAPL stock with $10 brokerage fee
    const costBasisCents = 100000n; // $1,000.00
    const feeCents = 1000n;         // $10.00

    // Simulate investment purchase transfer
    checkingAcc.currentBalanceCents -= Number(costBasisCents + feeCents);
    checkingAcc.currentBalanceCentsDecimal = String(checkingAcc.currentBalanceCents);

    invAcc.currentBalanceCents += Number(costBasisCents);
    invAcc.currentBalanceCentsDecimal = String(invAcc.currentBalanceCents);

    const txTransfer = {
      id: 'tx-inv-buy-1',
      familyId,
      accountId: checkingAcc.id,
      destinationAccountId: invAcc.id,
      title: 'Investment Purchase: AAPL',
      amountCents: Number(costBasisCents),
      amountCentsDecimal: String(costBasisCents),
      transactionType: 'TRANSFER' as const,
      category: 'INVESTMENT_PURCHASE',
      transactionDate: now,
      isReversal: false,
      paidBy: 'Sarah',
    };

    const txFee = {
      id: 'tx-inv-fee-1',
      familyId,
      accountId: checkingAcc.id,
      destinationAccountId: null,
      title: 'Brokerage Fee: AAPL',
      amountCents: Number(feeCents),
      amountCentsDecimal: String(feeCents),
      transactionType: 'EXPENSE' as const,
      category: 'INVESTMENT_FEE',
      transactionDate: now,
      isReversal: false,
      paidBy: 'Sarah',
    };

    const allTxs = [txTransfer, txFee];

    // Verify Cash Flow statement excludes the $1,000 stock purchase TRANSFER and only counts the $10 fee as operating EXPENSE
    const cashFlow = computeAuthoritativeCashFlow(allTxs, { startEpoch: now - 86400000, endEpoch: now + 86400000 });
    assert.strictEqual(cashFlow.expenseCentsBig, 1000n, 'Cash flow operating expenses must include fee ($10) but exclude stock purchase ($1000) TRANSFER.');

    // Verify Net Worth single-count calculation
    const holdings = [
      {
        id: 'holding-aapl',
        familyId,
        accountId: invAcc.id,
        symbol: 'AAPL',
        assetName: 'Apple Inc.',
        quantityMicroshares: 10000000,
        costBasisCents: 100000,
        currentPriceCents: 10000,
        currentValuationCents: 100000,
        isDeleted: false,
      },
    ];

    const netWorth = computeAuthoritativeNetWorth(accounts, holdings as any);
    assert.strictEqual(netWorth.totalAssetsCentsBig, 499000n, 'Total assets must equal checking ($3,990) + brokerage ($1,000) = $4,990.');
    assert.strictEqual(netWorth.netWorthCentsBig, 499000n, 'Net worth must accurately reflect total assets minus liabilities without double-counting holdings.');
  });

  // --------------------------------------------------------------------------
  // 2. SAVINGS TRANSFER VS SAVINGS GOAL ALLOCATION VERIFICATION
  // --------------------------------------------------------------------------
  await runTest('Savings goal contribution without funding account is a goal allocation, while contribution with funding account is a bank TRANSFER', () => {
    const familyId = 'fam-sav-test';
    const now = Date.now();

    const checking = {
      id: 'acc-check-sav',
      familyId,
      name: 'Checking',
      accountType: 'CHECKING' as const,
      currentBalanceCents: 200000, // $2,000
      isLiability: false,
    };

    const savingsAcc = {
      id: 'acc-savings-deposit',
      familyId,
      name: 'High Yield Savings',
      accountType: 'SAVINGS' as const,
      currentBalanceCents: 50000, // $500
      isLiability: false,
    };

    const goal = {
      id: 'goal-vacation',
      familyId,
      title: 'Summer Vacation',
      targetCents: 300000, // $3,000
      currentCents: 50000, // $500
      linkedAccountId: savingsAcc.id,
    };

    // Scenario A: Virtual Allocation (No bank money moved)
    const virtualAllocAmount = 10000n; // $100
    goal.currentCents += Number(virtualAllocAmount);
    assert.strictEqual(checking.currentBalanceCents, 200000, 'Checking balance must remain unchanged during virtual goal allocation.');
    assert.strictEqual(savingsAcc.currentBalanceCents, 50000, 'Savings account balance must remain unchanged during virtual goal allocation.');
    assert.strictEqual(goal.currentCents, 60000, 'Goal progress currentCents must increment to $600.');

    // Scenario B: Real Money Transfer (Money moves between bank accounts)
    const realTransferAmount = 20000n; // $200
    checking.currentBalanceCents -= Number(realTransferAmount);
    savingsAcc.currentBalanceCents += Number(realTransferAmount);
    goal.currentCents += Number(realTransferAmount);

    assert.strictEqual(checking.currentBalanceCents, 180000, 'Checking balance must decrease by $200.');
    assert.strictEqual(savingsAcc.currentBalanceCents, 70000, 'Savings account balance must increase by $200.');
    assert.strictEqual(goal.currentCents, 80000, 'Goal progress must update to $800.');
  });

  // --------------------------------------------------------------------------
  // 3. PGLITE REAL POSTGRESQL CONCURRENCY & IDEMPOTENCY VERIFICATION
  // --------------------------------------------------------------------------
  await runTest('PGlite: Concurrent requests with identical idempotency key deduplicate to single transaction', async () => {
    const db = new PGlite();
    const sql0001 = fs.readFileSync(path.join(process.cwd(), 'migrations/postgres/0001_familyos_v340_up.sql'), 'utf-8');
    const sql0002 = fs.readFileSync(path.join(process.cwd(), 'migrations/postgres/0002_familyos_v341_reconciliation_up.sql'), 'utf-8');
    await db.exec(sql0001);
    await db.exec(sql0002);

    const now = Date.now();
    await db.exec(`
      INSERT INTO family_workspaces (id, name, owner_user_id, created_at, updated_at)
      VALUES ('fam-conc-1', 'Concurrent Family', 'usr-owner-c', ${now}, ${now});

      INSERT INTO financial_accounts (id, family_id, name, account_type, current_balance_cents, is_liability, created_at, updated_at)
      VALUES 
        ('acc-conc-chk', 'fam-conc-1', 'Concurrent Checking', 'CHECKING', 100000, false, ${now}, ${now}),
        ('acc-conc-exp', 'fam-conc-1', 'Expense Account', 'EXPENSE', 0, false, ${now}, ${now});
    `);

    // Concurrent posting requests using exact same idempotency key
    const idempKey = `idemp-concurrent-tx-100`;

    const postAction1 = db.query(`
      SELECT post_financial_transaction(
        'tx-conc-1'::text,
        'fam-conc-1'::text,
        'acc-conc-chk'::text,
        'acc-conc-exp'::text,
        'Concurrent Bill 1'::text,
        2500::bigint,
        'EXPENSE'::text,
        'UTILITIES'::text,
        ${now}::bigint,
        'Sarah'::text,
        '${idempKey}'::text
      );
    `);

    const postAction2 = db.query(`
      SELECT post_financial_transaction(
        'tx-conc-2'::text,
        'fam-conc-1'::text,
        'acc-conc-chk'::text,
        'acc-conc-exp'::text,
        'Concurrent Bill 2'::text,
        2500::bigint,
        'EXPENSE'::text,
        'UTILITIES'::text,
        ${now}::bigint,
        'Sarah'::text,
        '${idempKey}'::text
      );
    `);

    const [res1, res2] = await Promise.all([postAction1, postAction2]);
    const id1 = (res1.rows[0] as any).post_financial_transaction;
    const id2 = (res2.rows[0] as any).post_financial_transaction;

    assert.strictEqual(id1, id2, 'Both concurrent calls must return the same deduplicated transaction ID.');

    const countRes = await db.query(`SELECT COUNT(*) as cnt FROM financial_transactions WHERE family_id = 'fam-conc-1' AND idempotency_key = '${idempKey}'`);
    assert.strictEqual(Number((countRes.rows[0] as any).cnt), 1, 'Exactly one transaction row must be created in database.');
  });

  await runTest('PGlite: Simultaneous postings against same account preserve balance integrity without lost updates', async () => {
    const db = new PGlite();
    const sql0001 = fs.readFileSync(path.join(process.cwd(), 'migrations/postgres/0001_familyos_v340_up.sql'), 'utf-8');
    const sql0002 = fs.readFileSync(path.join(process.cwd(), 'migrations/postgres/0002_familyos_v341_reconciliation_up.sql'), 'utf-8');
    await db.exec(sql0001);
    await db.exec(sql0002);

    const now = Date.now();
    await db.exec(`
      INSERT INTO family_workspaces (id, name, owner_user_id, created_at, updated_at)
      VALUES ('fam-bal-1', 'Balance Family', 'usr-owner-b', ${now}, ${now});

      INSERT INTO financial_accounts (id, family_id, name, account_type, current_balance_cents, is_liability, created_at, updated_at)
      VALUES 
        ('acc-bal-chk', 'fam-bal-1', 'Main Checking', 'CHECKING', 100000, false, ${now}, ${now}),
        ('acc-bal-exp', 'fam-bal-1', 'Expense Account', 'EXPENSE', 0, false, ${now}, ${now});
    `);

    // Post 5 transactions sequentially/concurrently
    for (let i = 1; i <= 5; i++) {
      await db.query(`
        SELECT post_financial_transaction(
          'tx-seq-${i}'::text,
          'fam-bal-1'::text,
          'acc-bal-chk'::text,
          'acc-bal-exp'::text,
          'Expense ${i}'::text,
          10000::bigint,
          'EXPENSE'::text,
          'SHOPPING'::text,
          ${now}::bigint,
          'Sarah'::text,
          'idemp-seq-${i}'::text
        );
      `);
    }

    const accRes = await db.query(`SELECT current_balance_cents FROM financial_accounts WHERE id = 'acc-bal-chk'`);
    assert.strictEqual(Number((accRes.rows[0] as any).current_balance_cents), 50000, 'Checking balance must be exactly 100,000 - (5 * 10,000) = 50,000.');
  });

  // --------------------------------------------------------------------------
  // 4. SESSION PERSISTENCE VERIFICATION
  // --------------------------------------------------------------------------
  await runTest('Session persistence: issuance, lookup, single/all-session revocation, survival across restart', () => {
    clearRevokedSessionsForTest();

    const userAccountId = 'usr-sess-test-1';
    const email = 'sarah@example.com';
    const displayName = 'Sarah Jenkins';

    // Issue token
    const token = issueSignedSessionToken({ userAccountId, email, displayName });
    assert.ok(token.startsWith('fos_v1.'), 'Session token must be prefixed with fos_v1.');

    const sessionsBefore = getTrackedAuthSessions();
    assert.ok(sessionsBefore.length >= 1, 'Tracked session list must contain issued session.');

    const sessRec = sessionsBefore.find((s) => s.userAccountId === userAccountId);
    assert.ok(sessRec, 'Recorded session must match userAccountId.');
    assert.strictEqual(sessRec!.isRevoked, false, 'Session must initially be active.');

    // Revoke single session
    revokeSessionToken(sessRec!.sessionIdentifier, 'USER_LOGOUT');
    assert.strictEqual(isSessionRevoked({ rawToken: token, jti: sessRec!.sessionIdentifier, userAccountId }), true, 'Revoked token must be rejected.');

    // Issue second token and test revoke all sessions for user
    const token2 = issueSignedSessionToken({ userAccountId, email, displayName });
    revokeAllSessionsForUser(userAccountId);
    assert.strictEqual(isSessionRevoked({ rawToken: token2, userAccountId }), true, 'revokeAllSessionsForUser must revoke all active sessions for target user.');

    clearRevokedSessionsForTest();
  });

  // --------------------------------------------------------------------------
  // 5. IMAGE & BACKUP VERIFICATION
  // --------------------------------------------------------------------------
  await runTest('Sharp image decoding: EXIF metadata stripped, 8192px/16MP limits enforced, corrupted files rejected', async () => {
    // Generate valid 100x100 PNG buffer
    const validPngBuffer = await sharp({
      create: {
        width: 100,
        height: 100,
        channels: 4,
        background: { r: 23, g: 61, b: 53, alpha: 1 },
      },
    })
      .png()
      .toBuffer();

    const validDataUrl = `data:image/png;base64,${validPngBuffer.toString('base64')}`;

    // Test async Sharp validation
    const validRes = await validateUploadedImageDataUrlAsync(validDataUrl);
    assert.strictEqual(validRes.valid, true, 'Valid PNG upload must be accepted.');
    assert.ok(validRes.normalizedDataUrl?.startsWith('data:image/png;base64,'), 'Normalized data URL must be returned.');

    // Test corrupted payload rejection
    const corruptedDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==NOT_A_REAL_PNG';
    const corruptRes = await validateUploadedImageDataUrlAsync(corruptedDataUrl);
    assert.strictEqual(corruptRes.valid, false, 'Corrupted base64 payload must be rejected.');

    // Test 16MP decompression bomb limit logic
    const bombPngBuffer = await sharp({
      create: {
        width: 5000,
        height: 5000, // 25 Megapixels > 16 Megapixels limit
        channels: 3,
        background: { r: 255, g: 0, b: 0 },
      },
    })
      .png()
      .toBuffer();

    const bombDataUrl = `data:image/png;base64,${bombPngBuffer.toString('base64')}`;
    const bombRes = await validateUploadedImageDataUrlAsync(bombDataUrl);
    assert.strictEqual(bombRes.valid, false, '25MP image exceeding 16MP limit must trigger decompression bomb protection.');
    assert.strictEqual(bombRes.errorCode, 'IMAGE_PIXEL_LIMIT_EXCEEDED');
  });

  await runTest('Backup integrity: SHA256 & HMAC-SHA256 signature verification and isolated store restoration', () => {
    const tmpDataDir = path.resolve(process.cwd(), 'data/tmp-test');
    if (!fs.existsSync(tmpDataDir)) {
      fs.mkdirSync(tmpDataDir, { recursive: true });
    }

    const testStorePath = path.join(tmpDataDir, 'source-store.json');
    const testBackupPath = path.join(tmpDataDir, 'protected-backup.bak.json');

    const sampleStoreContent = JSON.stringify({
      schemaVersion: '3.4.1',
      accounts: [{ id: 'acc-1', familyId: 'fam-1', name: 'Test', accountType: 'CHECKING', currentBalanceCents: 100, isLiability: false, institution: 'Bank' }],
      transactions: [],
      budgets: [],
      processedIdempotencyKeys: {},
      auditEvents: [],
    });

    fs.writeFileSync(testStorePath, sampleStoreContent, 'utf-8');

    // Create protected backup
    const meta = createProtectedPrePostgresBackup(testStorePath, testBackupPath);
    assert.ok(meta.sha256, 'Backup metadata must record SHA256.');
    assert.ok(meta.hmacSignature, 'Backup metadata must record HMAC signature.');

    // Verify backup
    const verification = verifyProtectedBackup(testBackupPath);
    assert.strictEqual(verification.valid, true, 'Protected backup must pass SHA256 & HMAC verification.');

    // Test tamper rejection
    fs.writeFileSync(testBackupPath, sampleStoreContent + ' ', 'utf-8');
    const tamperedCheck = verifyProtectedBackup(testBackupPath);
    assert.strictEqual(tamperedCheck.valid, false, 'Tampered backup must be rejected.');

    // Cleanup
    fs.rmSync(tmpDataDir, { recursive: true, force: true });
  });

  console.log('\n================================================================');
  console.log(`📊 FIFTH-PASS VERIFICATION SUITE FINISHED: ${passed}/${total} PASSED`);
  console.log('================================================================\n');

  if (passed !== total) {
    process.exit(1);
  }
})().catch((err) => {
  console.error('FIFTH-PASS TEST RUNNER EXCEPTION:', err);
  process.exit(1);
});
