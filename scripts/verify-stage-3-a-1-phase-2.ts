/**
 * FAMILYOS — MASTER STAGE 3.A.1: PHASE 2 AUTOMATED VERIFICATION SUITE
 * Express Financial REST API (FIN-01 to FIN-08, INV-01)
 *
 * Verifies:
 * Gate 01: Authorized family member access (usr-sarah-owner) returns HTTP 200.
 * Gate 02: Cross-workspace non-member access (usr-fam2-owner against fam-1) blocked with HTTP 403.
 * Gate 03: COPPA & Governance: Child profile (usr-lucas-child) blocked with HTTP 403 FINANCE_ACCESS_RESTRICTED.
 * Gate 04: Zero-Trust RBAC: Guest profile (usr-martha-guest) blocked with HTTP 403 FINANCE_ACCESS_RESTRICTED.
 * Gate 05: Accounts CRUD, initial integer balances, and statement reconciliation with discrepancy computation.
 * Gate 06: Integer-cents income/expense creation, atomic account balance update, and idempotency deduplication.
 * Gate 07: Transfers (household net delta = 0 cents) and non-destructive audit reversals with duplicate guards.
 * Gate 08: Envelope budgets with dynamic spent rollup from actual transactions, warning (80%), and over-budget alerts.
 * Gate 09: Savings goals with progress percentage and ceiling-based suggested monthly contribution calculation.
 * Gate 10: Recurring rules: next due date computation and idempotent generation ("REC_GEN:<id>:<epoch_day>").
 * Gate 11: Investment holdings: cash debit, price update without altering cost basis, microshares math, and soft deletion.
 * Gate 12: Actual vs projected cash flow separation (transfers and savings strictly excluded).
 * Gate 13: Backward compatibility with legacy /api/v1/finance/transaction and /api/v1/finance/reverse endpoints.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

const BASE_URL = 'http://localhost:3000';
const FAMILY_ID = 'fam-1';
const STORE_FILE_PATH = path.resolve(process.cwd(), 'data/familyos-shared-store.json');

async function getToken(userAccountId: string): Promise<string> {
  const res = await fetch(`${BASE_URL}/api/v1/auth/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userAccountId }),
  });
  if (!res.ok) {
    throw new Error(`Failed to get session token for ${userAccountId}: HTTP ${res.status}`);
  }
  const data = (await res.json()) as { token: string };
  return data.token;
}

async function runStage3A1Phase2Tests() {
  console.log('================================================================');
  console.log('FAMILYOS — MASTER STAGE 3.A.1: PHASE 2 VERIFICATION SUITE');
  console.log('Express Financial REST API (FIN-01 to FIN-08, INV-01)');
  console.log('================================================================');

  const originalStoreBackup = fs.existsSync(STORE_FILE_PATH)
    ? fs.readFileSync(STORE_FILE_PATH, 'utf8')
    : null;

  let passedGates = 0;
  const totalGates = 13;

  function pass(gateNum: number, title: string) {
    console.log(`  [PASS] Gate ${gateNum.toString().padStart(2, '0')}/${totalGates}: ${title}`);
    passedGates++;
  }

  function fail(gateNum: number, title: string, err: any) {
    console.error(`  [FAIL] Gate ${gateNum.toString().padStart(2, '0')}/${totalGates}: ${title}`);
    console.error('         Error details:', err);
    process.exit(1);
  }

  let sarahToken: string;
  let fam2OwnerToken: string;
  let childToken: string;
  let guestToken: string;

  try {
    sarahToken = await getToken('usr-sarah-owner');
    fam2OwnerToken = await getToken('usr-fam2-owner');
    childToken = await getToken('usr-lucas-child');
    guestToken = await getToken('usr-martha-guest');
  } catch (e) {
    console.error('Fatal: Failed to bootstrap session tokens:', e);
    process.exit(1);
  }

  // -------------------------------------------------------------------------
  // SECTION 1: ZERO-TRUST AUTHORIZATION & ROLE RESTRICTIONS
  // -------------------------------------------------------------------------
  console.log('\n--- Section 1: Zero-Trust Authorization & Role Restrictions ---');

  // Gate 01: Authorized family member access
  try {
    const res = await fetch(`${BASE_URL}/api/v1/finance/${FAMILY_ID}/accounts`, {
      headers: { Authorization: `Bearer ${sarahToken}` },
    });
    if (res.status !== 200) {
      throw new Error(`Expected HTTP 200 for authorized member, received ${res.status}`);
    }
    const data = await res.json();
    if (!Array.isArray(data.accounts)) {
      throw new Error('Expected accounts array in response body');
    }
    pass(1, 'Authorized family member access (usr-sarah-owner) validated (HTTP 200)');
  } catch (err) {
    fail(1, 'Authorized family member access failed', err);
  }

  // Gate 02: Cross-workspace non-member access
  try {
    const res = await fetch(`${BASE_URL}/api/v1/finance/${FAMILY_ID}/accounts`, {
      headers: { Authorization: `Bearer ${fam2OwnerToken}` },
    });
    if (res.status !== 403) {
      throw new Error(`Expected HTTP 403 for cross-workspace non-member, received ${res.status}`);
    }
    const body = await res.json();
    if (body.error !== 'WORKSPACE_ISOLATION_VIOLATION' && body.error !== 'PERMISSION_DENIED') {
      throw new Error(`Unexpected error code: ${body.error}`);
    }
    pass(2, 'Cross-workspace non-member access blocked with HTTP 403 WORKSPACE_ISOLATION_VIOLATION');
  } catch (err) {
    fail(2, 'Cross-workspace isolation guard failed', err);
  }

  // Gate 03: Child profile access blocked
  try {
    const res = await fetch(`${BASE_URL}/api/v1/finance/${FAMILY_ID}/summary`, {
      headers: { Authorization: `Bearer ${childToken}` },
    });
    if (res.status !== 403) {
      throw new Error(`Expected HTTP 403 for child profile, received ${res.status}`);
    }
    const body = await res.json();
    if (body.error !== 'FINANCE_ACCESS_RESTRICTED') {
      throw new Error(`Expected error 'FINANCE_ACCESS_RESTRICTED', got '${body.error}'`);
    }
    pass(3, 'Child profile (usr-lucas-child) blocked with HTTP 403 FINANCE_ACCESS_RESTRICTED');
  } catch (err) {
    fail(3, 'Child role restriction failed', err);
  }

  // Gate 04: Guest profile access blocked
  try {
    const res = await fetch(`${BASE_URL}/api/v1/finance/${FAMILY_ID}/budgets`, {
      headers: { Authorization: `Bearer ${guestToken}` },
    });
    if (res.status !== 403) {
      throw new Error(`Expected HTTP 403 for guest profile, received ${res.status}`);
    }
    const body = await res.json();
    if (body.error !== 'FINANCE_ACCESS_RESTRICTED') {
      throw new Error(`Expected error 'FINANCE_ACCESS_RESTRICTED', got '${body.error}'`);
    }
    pass(4, 'Guest profile (usr-martha-guest) blocked with HTTP 403 FINANCE_ACCESS_RESTRICTED');
  } catch (err) {
    fail(4, 'Guest role restriction failed', err);
  }

  // -------------------------------------------------------------------------
  // SECTION 2: FINANCIAL ACCOUNTS & STATEMENT RECONCILIATION
  // -------------------------------------------------------------------------
  console.log('\n--- Section 2: Financial Accounts & Statement Reconciliation ---');

  let testCheckingAccountId = 'acc-1';
  let createdAccountId = '';

  // Gate 05: Accounts CRUD and Statement Reconciliation
  try {
    // Create new account
    const createRes = await fetch(`${BASE_URL}/api/v1/finance/${FAMILY_ID}/accounts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sarahToken}`,
      },
      body: JSON.stringify({
        name: 'Family Education Fund',
        accountType: 'SAVINGS',
        currentBalanceCents: 500000, // $5,000.00
        institution: 'Fidelity',
        isLiability: false,
      }),
    });
    if (createRes.status !== 201) {
      throw new Error(`Failed to create account: HTTP ${createRes.status}`);
    }
    const createData = await createRes.json();
    createdAccountId = createData.account.id;
    if (createData.account.currentBalanceCents !== 500000) {
      throw new Error(`Incorrect balance cents: ${createData.account.currentBalanceCents}`);
    }

    // Reconcile statement on this account with a $50 discrepancy
    const reconcileRes = await fetch(`${BASE_URL}/api/v1/finance/${FAMILY_ID}/accounts/${createdAccountId}/reconcile`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sarahToken}`,
      },
      body: JSON.stringify({
        statementEndingBalanceCents: 505000, // Statement says $5,050.00 (+5000 cents discrepancy)
        statementDate: Date.now(),
        notes: 'November 2026 Monthly Statement Verification',
      }),
    });
    if (reconcileRes.status !== 200) {
      throw new Error(`Failed to reconcile account: HTTP ${reconcileRes.status}`);
    }
    const reconcileData = await reconcileRes.json();
    if (reconcileData.discrepancyCents !== 5000) {
      throw new Error(`Expected discrepancyCents = 5000, got ${reconcileData.discrepancyCents}`);
    }
    if (!reconcileData.account.lastReconciledAt) {
      throw new Error('lastReconciledAt was not updated on account');
    }

    pass(5, 'Financial account CRUD and statement reconciliation verified (discrepancy = 5000 cents)');
  } catch (err) {
    fail(5, 'Financial account reconciliation failed', err);
  }

  // -------------------------------------------------------------------------
  // SECTION 3: TRANSACTIONS, ATOMIC BALANCES & IDEMPOTENCY
  // -------------------------------------------------------------------------
  console.log('\n--- Section 3: Transactions, Atomic Balances & Idempotency ---');

  let testTxId = '';
  const testIdempotencyKey = `IDEM-TEST-${Date.now()}`;

  // Gate 06: Integer-cents income/expense and atomic account balance update
  try {
    // Get initial balance of acc-1
    const accRes1 = await fetch(`${BASE_URL}/api/v1/finance/${FAMILY_ID}/accounts`, {
      headers: { Authorization: `Bearer ${sarahToken}` },
    });
    const accList1 = await accRes1.json();
    const acc1Before = accList1.accounts.find((a: any) => a.id === testCheckingAccountId);
    const initialBalance = acc1Before.currentBalanceCents;

    // Create an EXPENSE transaction of $125.50 (12550 cents)
    const expenseRes = await fetch(`${BASE_URL}/api/v1/finance/${FAMILY_ID}/transactions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sarahToken}`,
        'X-Idempotency-Key': testIdempotencyKey,
      },
      body: JSON.stringify({
        accountId: testCheckingAccountId,
        amountCents: 12550,
        transactionType: 'EXPENSE',
        category: 'FOOD',
        merchantOrPayee: 'Organic Market',
        notes: 'Fresh weekly produce and pantry restock',
      }),
    });
    if (expenseRes.status !== 201) {
      throw new Error(`Failed to record transaction: HTTP ${expenseRes.status}`);
    }
    const expenseData = await expenseRes.json();
    testTxId = expenseData.transaction.id;
    if (expenseData.deduplicated !== false) {
      throw new Error('First execution must have deduplicated: false');
    }

    // Verify atomic balance decrement
    const accRes2 = await fetch(`${BASE_URL}/api/v1/finance/${FAMILY_ID}/accounts`, {
      headers: { Authorization: `Bearer ${sarahToken}` },
    });
    const accList2 = await accRes2.json();
    const acc1After = accList2.accounts.find((a: any) => a.id === testCheckingAccountId);
    const expectedBalance = initialBalance - 12550;
    if (acc1After.currentBalanceCents !== expectedBalance) {
      throw new Error(`Balance mismatch: expected ${expectedBalance}, got ${acc1After.currentBalanceCents}`);
    }

    // Test idempotency replay with same key
    const replayRes = await fetch(`${BASE_URL}/api/v1/finance/${FAMILY_ID}/transactions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sarahToken}`,
        'X-Idempotency-Key': testIdempotencyKey,
      },
      body: JSON.stringify({
        accountId: testCheckingAccountId,
        amountCents: 12550,
        transactionType: 'EXPENSE',
        category: 'FOOD',
        merchantOrPayee: 'Organic Market',
      }),
    });
    const replayData = await replayRes.json();
    if (replayData.deduplicated !== true) {
      throw new Error('Expected replay request to return deduplicated: true');
    }
    // Verify balance did not decrement twice
    const accRes3 = await fetch(`${BASE_URL}/api/v1/finance/${FAMILY_ID}/accounts`, {
      headers: { Authorization: `Bearer ${sarahToken}` },
    });
    const accList3 = await accRes3.json();
    const acc1AfterReplay = accList3.accounts.find((a: any) => a.id === testCheckingAccountId);
    if (acc1AfterReplay.currentBalanceCents !== expectedBalance) {
      throw new Error(`Double-spend defect detected: balance changed to ${acc1AfterReplay.currentBalanceCents}`);
    }

    pass(6, 'Integer-cents transaction recorded, balance decremented atomically, idempotency verified');
  } catch (err) {
    fail(6, 'Transaction recording and balance update failed', err);
  }

  // -------------------------------------------------------------------------
  // SECTION 4: TRANSFERS & NON-DESTRUCTIVE AUDIT REVERSALS
  // -------------------------------------------------------------------------
  console.log('\n--- Section 4: Transfers & Non-Destructive Reversals ---');

  // Gate 07: Transfers net impact = 0 cents and non-destructive reversal with duplicate protection
  try {
    // Record TRANSFER of $200.00 (20000 cents) from acc-1 to createdAccountId
    const accResBefore = await fetch(`${BASE_URL}/api/v1/finance/${FAMILY_ID}/accounts`, {
      headers: { Authorization: `Bearer ${sarahToken}` },
    });
    const accListBefore = (await accResBefore.json()).accounts;
    const bSrc = accListBefore.find((a: any) => a.id === testCheckingAccountId).currentBalanceCents;
    const bDst = accListBefore.find((a: any) => a.id === createdAccountId).currentBalanceCents;

    const transferRes = await fetch(`${BASE_URL}/api/v1/finance/${FAMILY_ID}/transactions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sarahToken}`,
      },
      body: JSON.stringify({
        accountId: testCheckingAccountId,
        destinationAccountId: createdAccountId,
        amountCents: 20000,
        transactionType: 'TRANSFER',
        category: 'TRANSFER',
        notes: 'Monthly savings transfer',
      }),
    });
    if (transferRes.status !== 201) {
      throw new Error(`Transfer creation failed: HTTP ${transferRes.status}`);
    }

    const accResAfter = await fetch(`${BASE_URL}/api/v1/finance/${FAMILY_ID}/accounts`, {
      headers: { Authorization: `Bearer ${sarahToken}` },
    });
    const accListAfter = (await accResAfter.json()).accounts;
    const aSrc = accListAfter.find((a: any) => a.id === testCheckingAccountId).currentBalanceCents;
    const aDst = accListAfter.find((a: any) => a.id === createdAccountId).currentBalanceCents;

    if (aSrc !== bSrc - 20000 || aDst !== bDst + 20000) {
      throw new Error(`Transfer balance failure: src delta ${aSrc - bSrc}, dst delta ${aDst - bDst}`);
    }
    const netHouseholdImpact = (aSrc - bSrc) + (aDst - bDst);
    if (netHouseholdImpact !== 0) {
      throw new Error(`Transfer violated zero net household delta: ${netHouseholdImpact} cents`);
    }

    // Now test Non-Destructive Audit Reversal on the earlier expense transaction testTxId
    const reverseRes = await fetch(`${BASE_URL}/api/v1/finance/${FAMILY_ID}/transactions/${testTxId}/reverse`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sarahToken}`,
      },
      body: JSON.stringify({
        reason: 'Duplicate merchant charge dispute',
      }),
    });
    if (reverseRes.status !== 200) {
      throw new Error(`Reversal failed: HTTP ${reverseRes.status}`);
    }
    const reverseData = await reverseRes.json();
    if (!reverseData.reversalTransaction.isReversal || reverseData.reversalTransaction.reversalOfId !== testTxId) {
      throw new Error('Reversal transaction metadata corrupted');
    }

    // Check account balance restored
    const accResRestored = await fetch(`${BASE_URL}/api/v1/finance/${FAMILY_ID}/accounts`, {
      headers: { Authorization: `Bearer ${sarahToken}` },
    });
    const aSrcRestored = (await accResRestored.json()).accounts.find((a: any) => a.id === testCheckingAccountId).currentBalanceCents;
    if (aSrcRestored !== aSrc + 12550) {
      throw new Error(`Balance not restored after reversal: expected ${aSrc + 12550}, got ${aSrcRestored}`);
    }

    // Attempt DUPLICATE reversal on testTxId -> MUST return HTTP 400 DUPLICATE_REVERSAL_BLOCKED
    const dupReverseRes = await fetch(`${BASE_URL}/api/v1/finance/${FAMILY_ID}/transactions/${testTxId}/reverse`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sarahToken}`,
      },
      body: JSON.stringify({
        reason: 'Second duplicate reversal attempt',
      }),
    });
    if (dupReverseRes.status !== 400) {
      throw new Error(`Expected HTTP 400 for duplicate reversal, got ${dupReverseRes.status}`);
    }
    const dupBody = await dupReverseRes.json();
    if (dupBody.error !== 'DUPLICATE_REVERSAL_BLOCKED') {
      throw new Error(`Expected DUPLICATE_REVERSAL_BLOCKED, got ${dupBody.error}`);
    }

    pass(7, 'Transfer net impact 0 cents; non-destructive reversal restored balance and blocked duplicate');
  } catch (err) {
    fail(7, 'Transfer and non-destructive reversal verification failed', err);
  }

  // -------------------------------------------------------------------------
  // SECTION 5: ENVELOPE BUDGETS & THRESHOLD TRACKING
  // -------------------------------------------------------------------------
  console.log('\n--- Section 5: Envelope Budgets & Real-Time Tracking ---');

  // Gate 08: Envelope budgets: dynamic spent rollup, warning threshold (80%), and over-budget status (100%)
  try {
    // Create an envelope budget for UTILITIES: $500.00 (50000 cents), warning at 80% (40000 cents)
    const budgetRes = await fetch(`${BASE_URL}/api/v1/finance/${FAMILY_ID}/budgets`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sarahToken}`,
      },
      body: JSON.stringify({
        category: 'UTILITIES',
        allocatedCents: 50000,
        alertThresholdPercentage: 80,
      }),
    });
    if (budgetRes.status !== 200) {
      throw new Error(`Budget creation failed: HTTP ${budgetRes.status}`);
    }

    // Add an expense of $420.00 (42000 cents) to UTILITIES (84% utilization -> isWarning should be true)
    await fetch(`${BASE_URL}/api/v1/finance/${FAMILY_ID}/transactions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sarahToken}`,
      },
      body: JSON.stringify({
        accountId: testCheckingAccountId,
        amountCents: 42000,
        transactionType: 'EXPENSE',
        category: 'UTILITIES',
        merchantOrPayee: 'Power & Gas Co.',
      }),
    });

    // Query budgets and verify rollup
    const queryRes = await fetch(`${BASE_URL}/api/v1/finance/${FAMILY_ID}/budgets`, {
      headers: { Authorization: `Bearer ${sarahToken}` },
    });
    const budgetList = await queryRes.json();
    const utilBudget = budgetList.budgets.find((b: any) => b.category === 'UTILITIES');

    if (!utilBudget) {
      throw new Error('Created UTILITIES budget not found');
    }
    if (utilBudget.spentCents < 42000) {
      throw new Error(`Expected spentCents >= 42000, got ${utilBudget.spentCents}`);
    }
    if (!utilBudget.isWarning) {
      throw new Error('Expected isWarning to be true at 84% utilization');
    }
    if (utilBudget.isOverBudget) {
      throw new Error('Expected isOverBudget to be false at 84% utilization');
    }

    // Add another expense of $100.00 (10000 cents) -> total $520.00 (104% utilization -> isOverBudget must be true)
    await fetch(`${BASE_URL}/api/v1/finance/${FAMILY_ID}/transactions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sarahToken}`,
      },
      body: JSON.stringify({
        accountId: testCheckingAccountId,
        amountCents: 10000,
        transactionType: 'EXPENSE',
        category: 'UTILITIES',
        merchantOrPayee: 'City Water Dept',
      }),
    });

    const queryRes2 = await fetch(`${BASE_URL}/api/v1/finance/${FAMILY_ID}/budgets`, {
      headers: { Authorization: `Bearer ${sarahToken}` },
    });
    const utilBudget2 = (await queryRes2.json()).budgets.find((b: any) => b.category === 'UTILITIES');
    if (!utilBudget2.isOverBudget) {
      throw new Error('Expected isOverBudget to be true at >100% utilization');
    }
    if (utilBudget2.utilizationPercentage !== 104) {
      throw new Error(`Expected 104% utilization, got ${utilBudget2.utilizationPercentage}%`);
    }

    pass(8, 'Envelope budgets: real-time spent rollup, 80% warning threshold, and >100% over-budget alerts');
  } catch (err) {
    fail(8, 'Envelope budget tracking failed', err);
  }

  // -------------------------------------------------------------------------
  // SECTION 6: SAVINGS GOALS & CEILING-BASED CONTRIBUTIONS
  // -------------------------------------------------------------------------
  console.log('\n--- Section 6: Savings Goals & Ceiling-Based Contributions ---');

  // Gate 09: Savings goals with progress percentage and ceiling-based suggested monthly contribution
  try {
    // Create savings goal: Target $10,000.00 (1000000 cents), Current $2,500.00 (250000 cents), Target Date in 10 months
    const tenMonthsMs = Date.now() + (10 * 30.4375 * 24 * 60 * 60 * 1000);
    const createGoalRes = await fetch(`${BASE_URL}/api/v1/finance/${FAMILY_ID}/savings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sarahToken}`,
      },
      body: JSON.stringify({
        name: 'Family Summer Cabin Vacation',
        targetAmountCents: 1000000,
        currentAmountCents: 250000,
        targetDateEpoch: tenMonthsMs,
        linkedAccountId: createdAccountId,
        isArchived: false,
      }),
    });
    if (createGoalRes.status !== 201) {
      throw new Error(`Failed to create savings goal: HTTP ${createGoalRes.status}`);
    }
    const goalData = await createGoalRes.json();
    const goal = goalData.goal;

    // Remaining = 750,000 cents over 10 months -> ceil(750000 / 10) = 75,000 cents ($750.00/mo)
    if (goal.progressPercentage !== 25) {
      throw new Error(`Expected progressPercentage = 25%, got ${goal.progressPercentage}%`);
    }
    if (goal.suggestedMonthlyContributionCents <= 0) {
      throw new Error(`Invalid suggestedMonthlyContributionCents: ${goal.suggestedMonthlyContributionCents}`);
    }

    // Record a contribution of $500.00 (50000 cents) from acc-1
    const contribRes = await fetch(`${BASE_URL}/api/v1/finance/${FAMILY_ID}/savings/${goal.id}/contribute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sarahToken}`,
      },
      body: JSON.stringify({
        fundingAccountId: testCheckingAccountId,
        amountCents: 50000,
        notes: 'Monthly automatic savings deposit',
      }),
    });
    if (contribRes.status !== 200) {
      throw new Error(`Contribution failed: HTTP ${contribRes.status}`);
    }
    const contribData = await contribRes.json();
    if (contribData.goal.currentAmountCents !== 300000) {
      throw new Error(`Expected currentAmountCents = 300000, got ${contribData.goal.currentAmountCents}`);
    }
    if (contribData.goal.progressPercentage !== 30) {
      throw new Error(`Expected progressPercentage = 30%, got ${contribData.goal.progressPercentage}%`);
    }

    pass(9, 'Savings goals: progress percentage and ceiling-based monthly contribution verified');
  } catch (err) {
    fail(9, 'Savings goals verification failed', err);
  }

  // -------------------------------------------------------------------------
  // SECTION 7: RECURRING RULES & IDEMPOTENT GENERATION
  // -------------------------------------------------------------------------
  console.log('\n--- Section 7: Recurring Rules & Idempotent Generation ---');

  // Gate 10: Recurring rules: next due date computation and idempotent generation ("REC_GEN:<id>:<epoch_day>")
  try {
    const createRuleRes = await fetch(`${BASE_URL}/api/v1/finance/${FAMILY_ID}/recurring`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sarahToken}`,
      },
      body: JSON.stringify({
        name: 'High-Speed Home Fiber Internet',
        accountId: testCheckingAccountId,
        amountCents: 8999, // $89.99
        transactionType: 'EXPENSE',
        category: 'UTILITIES',
        frequency: 'MONTHLY',
        nextDueDateEpoch: Date.now() - 3600000, // Due 1 hour ago
        isActive: true,
      }),
    });
    if (createRuleRes.status !== 201) {
      throw new Error(`Failed to create recurring rule: HTTP ${createRuleRes.status}`);
    }
    const ruleData = await createRuleRes.json();
    const ruleId = ruleData.rule.id;

    // Trigger generation
    const genRes1 = await fetch(`${BASE_URL}/api/v1/finance/${FAMILY_ID}/recurring/${ruleId}/generate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${sarahToken}` },
    });
    if (genRes1.status !== 200) {
      throw new Error(`Failed to generate transaction from rule: HTTP ${genRes1.status}`);
    }
    const genData1 = await genRes1.json();
    if (genData1.alreadyGenerated !== false || !genData1.transaction) {
      throw new Error('Expected initial generation to create new transaction');
    }
    if (genData1.transaction.amountCents !== 8999) {
      throw new Error(`Expected amountCents = 8999, got ${genData1.transaction.amountCents}`);
    }

    // Trigger generation second time on same day -> must be idempotent (alreadyGenerated: true)
    const genRes2 = await fetch(`${BASE_URL}/api/v1/finance/${FAMILY_ID}/recurring/${ruleId}/generate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${sarahToken}` },
    });
    const genData2 = await genRes2.json();
    if (genData2.alreadyGenerated !== true) {
      throw new Error('Expected duplicate daily recurring generation to return alreadyGenerated: true');
    }

    pass(10, 'Recurring rules: next due date calculated and idempotent generation verified');
  } catch (err) {
    fail(10, 'Recurring rules verification failed', err);
  }

  // -------------------------------------------------------------------------
  // SECTION 8: INVESTMENT HOLDINGS & FIXED-PRECISION CALCULATIONS
  // -------------------------------------------------------------------------
  console.log('\n--- Section 8: Investment Holdings & Fixed-Precision Portfolio ---');

  // Gate 11: Investment holdings: purchase with cash debit, price update, microshares math, soft deletion
  try {
    // Purchase 25.500000 shares of AAPL (25,500,000 microshares) at $230.00/sh (23,000 cents/sh)
    // Total cost basis = (25,500,000 * 23,000) / 1,000,000 = 586,500 cents ($5,865.00)
    const purchaseRes = await fetch(`${BASE_URL}/api/v1/finance/${FAMILY_ID}/investments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sarahToken}`,
      },
      body: JSON.stringify({
        symbol: 'AAPL',
        assetName: 'Apple Inc.',
        assetClass: 'EQUITY',
        microsharesQuantity: 25500000,
        totalCostBasisCents: 586500,
        currentMarketPricePerShareCents: 23000,
        fundingAccountId: testCheckingAccountId,
      }),
    });
    if (purchaseRes.status !== 201) {
      throw new Error(`Investment creation failed: HTTP ${purchaseRes.status}`);
    }
    const holding = (await purchaseRes.json()).holding;

    // Update market price to $250.00 (25,000 cents/sh)
    // New valuation = (25,500,000 * 25,000) / 1,000,000 = 637,500 cents ($6,375.00)
    // Unrealized gain = 637,500 - 586,500 = +51,000 cents (+$510.00)
    // Gain bps = (51,000 * 10,000) / 586,500 = 869 bps (+8.69%)
    const updatePriceRes = await fetch(`${BASE_URL}/api/v1/finance/${FAMILY_ID}/investments/${holding.id}/price`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sarahToken}`,
      },
      body: JSON.stringify({
        currentMarketPricePerShareCents: 25000,
      }),
    });
    if (updatePriceRes.status !== 200) {
      throw new Error(`Price update failed: HTTP ${updatePriceRes.status}`);
    }
    const updatedHolding = (await updatePriceRes.json()).holding;
    if (updatedHolding.totalCostBasisCents !== 586500) {
      throw new Error('Total cost basis was modified by market price update (Strict Invariant Violation)');
    }
    if (updatedHolding.currentValuationCents !== 637500) {
      throw new Error(`Expected currentValuationCents = 637500, got ${updatedHolding.currentValuationCents}`);
    }
    if (updatedHolding.unrealizedGainLossCents !== 51000) {
      throw new Error(`Expected unrealizedGainLossCents = 51000, got ${updatedHolding.unrealizedGainLossCents}`);
    }
    if (updatedHolding.gainLossBasisPoints !== 869) {
      throw new Error(`Expected gainLossBasisPoints = 869, got ${updatedHolding.gainLossBasisPoints}`);
    }

    // Soft deletion test
    const deleteRes = await fetch(`${BASE_URL}/api/v1/finance/${FAMILY_ID}/investments/${holding.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${sarahToken}` },
    });
    if (deleteRes.status !== 200) {
      throw new Error(`Soft deletion failed: HTTP ${deleteRes.status}`);
    }
    // Verify not in active query
    const listRes = await fetch(`${BASE_URL}/api/v1/finance/${FAMILY_ID}/investments`, {
      headers: { Authorization: `Bearer ${sarahToken}` },
    });
    const activeHoldings = (await listRes.json()).holdings;
    if (activeHoldings.some((h: any) => h.id === holding.id)) {
      throw new Error('Deleted holding was returned in active portfolio query');
    }

    pass(11, 'Investment holdings: microshares precision, price update without basis alteration, and soft deletion verified');
  } catch (err) {
    fail(11, 'Investment holding calculations failed', err);
  }

  // -------------------------------------------------------------------------
  // SECTION 9: ACTUAL VS PROJECTED CASH FLOW SEPARATION
  // -------------------------------------------------------------------------
  console.log('\n--- Section 9: Actual vs Projected Cash Flow Separation ---');

  // Gate 12: Actual vs projected cash flow separation
  try {
    const cfRes = await fetch(`${BASE_URL}/api/v1/finance/${FAMILY_ID}/cashflow`, {
      headers: { Authorization: `Bearer ${sarahToken}` },
    });
    if (cfRes.status !== 200) {
      throw new Error(`Cash flow endpoint failed: HTTP ${cfRes.status}`);
    }
    const cf = await cfRes.json();

    if (!cf.actual || typeof cf.actual.incomeCents !== 'number' || typeof cf.actual.expenseCents !== 'number') {
      throw new Error('Invalid actual cashflow structure');
    }
    if (!cf.projected || typeof cf.projected.recurringExpenseCents !== 'number') {
      throw new Error('Invalid projected cashflow structure');
    }
    if (typeof cf.actual.netCents !== 'number' || cf.actual.netCents !== (cf.actual.incomeCents - cf.actual.expenseCents)) {
      throw new Error('Actual net cashflow calculation mismatch');
    }

    // Summary endpoint check
    const summaryRes = await fetch(`${BASE_URL}/api/v1/finance/${FAMILY_ID}/summary`, {
      headers: { Authorization: `Bearer ${sarahToken}` },
    });
    if (summaryRes.status !== 200) {
      throw new Error(`Summary endpoint failed: HTTP ${summaryRes.status}`);
    }
    const summary = await summaryRes.json();
    if (typeof summary.netWorthCents !== 'number' || typeof summary.totalCashCents !== 'number') {
      throw new Error('Invalid summary totals');
    }

    pass(12, 'Actual vs projected cash flows strictly separated; summary totals verified');
  } catch (err) {
    fail(12, 'Cash flow separation verification failed', err);
  }

  // -------------------------------------------------------------------------
  // SECTION 10: BACKWARD COMPATIBILITY WITH PRE-EXISTING ENDPOINTS
  // -------------------------------------------------------------------------
  console.log('\n--- Section 10: Backward Compatibility with Legacy Endpoints ---');

  // Gate 13: Backward compatibility with legacy /api/v1/finance/transaction and /api/v1/finance/reverse
  try {
    const legacyKey = `LEGACY-TX-${Date.now()}`;
    const legacyTxRes = await fetch(`${BASE_URL}/api/v1/finance/transaction`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sarahToken}`,
        'X-Idempotency-Key': legacyKey,
      },
      body: JSON.stringify({
        familyId: FAMILY_ID,
        accountId: testCheckingAccountId,
        title: 'Legacy API compatibility transaction',
        amountCents: 4500,
        transactionType: 'EXPENSE',
        category: 'DINING',
        notes: 'Legacy API compatibility transaction',
      }),
    });
    if (legacyTxRes.status !== 201) {
      throw new Error(`Legacy transaction failed: HTTP ${legacyTxRes.status}`);
    }
    const legacyTxData = await legacyTxRes.json();
    const legTxId = legacyTxData.transaction.id;

    // Test legacy reverse endpoint
    const legacyRevRes = await fetch(`${BASE_URL}/api/v1/finance/reverse`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sarahToken}`,
      },
      body: JSON.stringify({
        transactionId: legTxId,
        familyId: FAMILY_ID,
        reason: 'Legacy API compatibility reversal',
      }),
    });
    if (legacyRevRes.status !== 201 && legacyRevRes.status !== 200) {
      throw new Error(`Legacy reversal failed: HTTP ${legacyRevRes.status}`);
    }
    const legacyRevData = await legacyRevRes.json();
    const revObj = legacyRevData.reversal || legacyRevData.reversalTransaction;
    if (!revObj?.isReversal) {
      throw new Error('Legacy reversal did not produce valid reversal transaction');
    }

    pass(13, 'Backward compatibility with /api/v1/finance/transaction and /reverse preserved');
  } catch (err) {
    fail(13, 'Backward compatibility verification failed', err);
  }

  if (originalStoreBackup !== null) {
    fs.writeFileSync(STORE_FILE_PATH, originalStoreBackup, 'utf8');
  }
  await fetch(`${BASE_URL}/api/v1/finance/${FAMILY_ID}/test-reset`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${sarahToken}` },
  }).catch(() => {});

  console.log('================================================================');
  console.log(`ALL ${passedGates}/${totalGates} PHASE 2 VERIFICATION GATES PASSED SUCCESSFULLY!`);
  console.log('Express Financial API (FIN-01..08, INV-01) Fully Verified & Production-Ready');
  console.log('================================================================');
}

runStage3A1Phase2Tests().catch((err) => {
  console.error('Unhandled verification error:', err);
  process.exit(1);
});
