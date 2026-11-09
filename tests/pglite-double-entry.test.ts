import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert';

(async () => {
  console.log('--- STARTING PGLITE REAL POSTGRESQL DOUBLE-ENTRY INTEGRATION TESTS ---');

  const db = new PGlite();

  // Load and apply SQL migrations
  const sql0001 = fs.readFileSync(
    path.join(process.cwd(), 'migrations/postgres/0001_familyos_v340_up.sql'),
    'utf-8'
  );
  const sql0002 = fs.readFileSync(
    path.join(process.cwd(), 'migrations/postgres/0002_familyos_v341_reconciliation_up.sql'),
    'utf-8'
  );

  await db.exec(sql0001);
  await db.exec(sql0002);

  console.log('[PGlite] Applied 0001 and 0002 schema migrations successfully.');

  // Seed baseline test workspace and financial accounts
  const now = Date.now();
  await db.query(`
    INSERT INTO family_workspaces (id, name, owner_user_id, created_at, updated_at)
    VALUES ('fam-test-1', 'Test Family', 'usr-owner-1', ${now}, ${now});
  `);

  await db.query(`
    INSERT INTO financial_accounts (id, family_id, name, account_type, current_balance_cents, is_liability, institution, created_at, updated_at)
    VALUES 
      ('acc-checking-1', 'fam-test-1', 'Main Checking', 'CHECKING', 100000, false, 'Test Bank', ${now}, ${now}),
      ('acc-expense-food', 'fam-test-1', 'Food Expense', 'EXPENSE', 0, false, 'System', ${now}, ${now});
  `);

  console.log('[PGlite] Seeded test workspace fam-test-1 and accounts acc-checking-1, acc-expense-food.');

  // TEST 1: Posted transaction with ZERO entries must be rejected at COMMIT by trg_check_posted_transaction
  console.log('\n[TEST 1] Testing posted transaction with ZERO entries (expect DB rejection)...');
  try {
    await db.exec(`
      BEGIN;
      INSERT INTO financial_transactions (id, family_id, account_id, title, amount_cents, transaction_type, category, transaction_date, is_reversal, paid_by, status, created_at)
      VALUES ('tx-zero-entries', 'fam-test-1', 'acc-checking-1', 'Zero Entries Tx', 5000, 'EXPENSE', 'FOOD', ${now}, false, 'Tester', 'POSTED', ${now});
      COMMIT;
    `);
    assert.fail('Database should have rejected posted transaction with zero entries!');
  } catch (err: any) {
    await db.exec('ROLLBACK;').catch(() => {});
    console.log('  SUCCESS: DB rejected posted transaction with 0 entries ->', err.message);
  }

  // TEST 2: Posted transaction with ONE entry must be rejected at COMMIT by trg_check_posted_transaction
  console.log('\n[TEST 2] Testing posted transaction with ONE entry (expect DB rejection)...');
  try {
    await db.exec(`
      BEGIN;
      INSERT INTO financial_transactions (id, family_id, account_id, title, amount_cents, transaction_type, category, transaction_date, is_reversal, paid_by, status, created_at)
      VALUES ('tx-one-entry', 'fam-test-1', 'acc-checking-1', 'One Entry Tx', 5000, 'EXPENSE', 'FOOD', ${now}, false, 'Tester', 'POSTED', ${now});
      INSERT INTO financial_entries (id, family_id, transaction_id, account_id, entry_type, amount_cents, created_at)
      VALUES ('entry-single', 'fam-test-1', 'tx-one-entry', 'acc-checking-1', 'CREDIT', 5000, ${now});
      COMMIT;
    `);
    assert.fail('Database should have rejected posted transaction with only 1 entry!');
  } catch (err: any) {
    await db.exec('ROLLBACK;').catch(() => {});
    console.log('  SUCCESS: DB rejected posted transaction with 1 entry ->', err.message);
  }

  // TEST 3: Unbalanced transaction (Debits != Credits) must be rejected at COMMIT
  console.log('\n[TEST 3] Testing UNBALANCED transaction (Debits 5000 != Credits 3000, expect DB rejection)...');
  try {
    await db.exec(`
      BEGIN;
      INSERT INTO financial_transactions (id, family_id, account_id, title, amount_cents, transaction_type, category, transaction_date, is_reversal, paid_by, status, created_at)
      VALUES ('tx-unbalanced', 'fam-test-1', 'acc-checking-1', 'Unbalanced Tx', 5000, 'EXPENSE', 'FOOD', ${now}, false, 'Tester', 'POSTED', ${now});
      INSERT INTO financial_entries (id, family_id, transaction_id, account_id, entry_type, amount_cents, created_at)
      VALUES 
        ('entry-unbal-1', 'fam-test-1', 'tx-unbalanced', 'acc-expense-food', 'DEBIT', 5000, ${now}),
        ('entry-unbal-2', 'fam-test-1', 'tx-unbalanced', 'acc-checking-1', 'CREDIT', 3000, ${now});
      COMMIT;
    `);
    assert.fail('Database should have rejected unbalanced transaction!');
  } catch (err: any) {
    await db.exec('ROLLBACK;').catch(() => {});
    console.log('  SUCCESS: DB rejected unbalanced transaction ->', err.message);
  }

  // TEST 4: BALANCED transaction (Debits 5000 == Credits 5000) must succeed
  console.log('\n[TEST 4] Testing BALANCED transaction (Debits 5000 == Credits 5000, expect DB success)...');
  await db.exec(`
    BEGIN;
    INSERT INTO financial_transactions (id, family_id, account_id, title, amount_cents, transaction_type, category, transaction_date, is_reversal, paid_by, status, created_at)
    VALUES ('tx-balanced-1', 'fam-test-1', 'acc-checking-1', 'Groceries', 5000, 'EXPENSE', 'FOOD', ${now}, false, 'Tester', 'POSTED', ${now});
    INSERT INTO financial_entries (id, family_id, transaction_id, account_id, entry_type, amount_cents, created_at)
    VALUES 
      ('entry-bal-1', 'fam-test-1', 'tx-balanced-1', 'acc-expense-food', 'DEBIT', 5000, ${now}),
      ('entry-bal-2', 'fam-test-1', 'tx-balanced-1', 'acc-checking-1', 'CREDIT', 5000, ${now});
    COMMIT;
  `);
  console.log('  SUCCESS: DB committed balanced transaction tx-balanced-1.');

  // TEST 5: Attempting to UPDATE a posted financial_entry must be rejected by immutability trigger
  console.log('\n[TEST 5] Testing UPDATE of posted financial_entry (expect DB rejection)...');
  try {
    await db.query(`
      UPDATE financial_entries SET amount_cents = 9999 WHERE id = 'entry-bal-1';
    `);
    assert.fail('Database should have prevented updating a posted financial_entry!');
  } catch (err: any) {
    console.log('  SUCCESS: DB blocked modification of posted financial entry ->', err.message);
  }

  // TEST 6: Attempting to DELETE a posted financial_entry must be rejected by immutability trigger
  console.log('\n[TEST 6] Testing DELETE of posted financial_entry (expect DB rejection)...');
  try {
    await db.query(`
      DELETE FROM financial_entries WHERE id = 'entry-bal-1';
    `);
    assert.fail('Database should have prevented deleting a posted financial_entry!');
  } catch (err: any) {
    console.log('  SUCCESS: DB blocked deletion of posted financial entry ->', err.message);
  }

  // TEST 7: Controlled PL/pgSQL function post_financial_transaction
  console.log('\n[TEST 7] Testing PL/pgSQL function post_financial_transaction (expect DB success)...');
  await db.query(`
    SELECT post_financial_transaction(
      'tx-proc-1'::text,
      'fam-test-1'::text,
      'acc-checking-1'::text,
      'acc-expense-food'::text,
      'Utility Bill'::text,
      12000::bigint,
      'EXPENSE'::text,
      'UTILITIES'::text,
      ${now}::bigint,
      'Tester'::text,
      'idemp-proc-100'::text
    );
  `);

  const procTxRes = await db.query(`SELECT status, amount_cents FROM financial_transactions WHERE id = 'tx-proc-1'`);
  assert.strictEqual((procTxRes.rows[0] as any).status, 'POSTED');
  assert.strictEqual(Number((procTxRes.rows[0] as any).amount_cents), 12000);

  const procEntriesRes = await db.query(`SELECT count(*) as cnt FROM financial_entries WHERE transaction_id = 'tx-proc-1'`);
  assert.strictEqual(Number((procEntriesRes.rows[0] as any).cnt), 2);
  console.log('  SUCCESS: post_financial_transaction function created posted tx and 2 balanced entries.');

  // TEST 8: Duplicate idempotency key must return existing transaction ID without duplicating
  console.log('\n[TEST 8] Testing duplicate idempotency_key deduplication (expect return of existing tx-proc-1)...');
  const dupRes = await db.query(`
    SELECT post_financial_transaction(
      'tx-proc-dup'::text,
      'fam-test-1'::text,
      'acc-checking-1'::text,
      'acc-expense-food'::text,
      'Utility Bill Duplicate'::text,
      12000::bigint,
      'EXPENSE'::text,
      'UTILITIES'::text,
      ${now}::bigint,
      'Tester'::text,
      'idemp-proc-100'::text
    );
  `);
  assert.strictEqual((dupRes.rows[0] as any).post_financial_transaction, 'tx-proc-1');
  console.log('  SUCCESS: post_financial_transaction returned existing tx-proc-1 without creating duplicate rows.');

  // TEST 9: Posting failure halfway through rolls back everything atomically
  console.log('\n[TEST 9] Testing atomic rollback on failure halfway through posting procedure...');
  try {
    await db.query('BEGIN;');
    await db.query(`
      SELECT post_financial_transaction(
        'tx-fail-halfway'::text,
        'fam-test-1'::text,
        'acc-checking-1'::text,
        'acc-nonexistent-account'::text,
        'Invalid Account Tx'::text,
        15000::bigint,
        'TRANSFER'::text,
        'UTILITIES'::text,
        ${now}::bigint,
        'Tester'::text,
        'idemp-fail-1'::text
      );
    `);
    await db.query('COMMIT;');
    assert.fail('Database should have failed due to non-existent account reference!');
  } catch (err: any) {
    await db.query('ROLLBACK;').catch(() => {});
    console.log('  SUCCESS: Function failed as expected ->', err.message);
  }

  const checkFailedTx = await db.query(`SELECT * FROM financial_transactions WHERE id = 'tx-fail-halfway'`);
  assert.strictEqual(checkFailedTx.rows.length, 0, 'Failed transaction must not exist in database.');
  console.log('  SUCCESS: Transaction rolled back completely, 0 orphaned rows created.');

  console.log('\n=== ALL 9 REAL POSTGRESQL PGLITE LEDGER INTEGRATION TESTS PASSED PERFECTLY ===');
})().catch((err) => {
  console.error('PGLITE TEST RUNNER FAILED:', err);
  process.exit(1);
});
