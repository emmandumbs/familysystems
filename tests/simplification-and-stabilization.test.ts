process.env.NODE_ENV = 'test';

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createApp, loadStore } from '../server';
import {
  computeAuthoritativeNetWorth,
  computeAuthoritativeCashFlow,
  computeAuthoritativeRecurringForecast,
  computeAuthoritativeBudgetStatusBigInt,
  validateBudgetAlertThreshold,
  computeAuthoritativeSuggestedMonthlyContributionBigInt,
  getMonthWindow,
} from '../src/server/financeCalculations';
import {
  computeExpiryStatus,
  computeNextChoreDueDate,
  convertHouseholdQuantity,
} from '../src/server/householdData';
import { resolveCanonicalDestination } from '../src/utils/routeRegistry';
import {
  createProtectedPrePostgresBackup,
  verifyProtectedBackup,
  restoreFromProtectedBackup,
  runIdempotentPostgresMigrationExport,
  loadStoreFromPostgres,
  persistStoreToPostgresAcid,
} from '../src/server/postgresMigrationAndBackup';
import { FIRESTORE_SYNCHRONIZATION_POLICY } from '../src/server/firestoreMirror';

const STORE_PATH = path.join(process.cwd(), 'data', 'familyos-shared-store.json');

const tokenCache = new Map<string, string>();

async function getBearerToken(baseUrl: string, userId: string): Promise<string> {
  const cached = tokenCache.get(`${baseUrl}:${userId}`);
  if (cached) return cached;
  const res = await fetch(`${baseUrl}/api/v1/auth/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userAccountId: userId,
      email: `${userId}@example.com`,
      registerNewUser: true,
    }),
  });
  const data = await res.json();
  if (!res.ok || !data.token) {
    throw new Error(`Failed to acquire auth session for ${userId}: ${res.status}`);
  }
  tokenCache.set(`${baseUrl}:${userId}`, data.token);
  return data.token;
}

async function requestJson(
  baseUrl: string,
  method: string,
  urlPath: string,
  body?: unknown,
  testUserId?: string
): Promise<{ status: number; data: any }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (testUserId) {
    const token = await getBearerToken(baseUrl, testUserId);
    headers['Authorization'] = `Bearer ${token}`;
  }
  const res = await fetch(`${baseUrl}${urlPath}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function runTests() {
  console.log('\n================================================================');
  console.log('FAMILYOS SIMPLIFICATION & STABILIZATION VERIFICATION SUITE');
  console.log('================================================================\n');

  const storeSnapshotBefore = fs.existsSync(STORE_PATH)
    ? fs.readFileSync(STORE_PATH, 'utf-8')
    : null;

  const app = await createApp();
  const server = app.listen(0);
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  const baseUrl = `http://127.0.0.1:${port}`;

  let passed = 0;
  const test = async (name: string, fn: () => Promise<void> | void) => {
    try {
      await fn();
      passed++;
      console.log(`  PASS [${passed}]: ${name}`);
    } catch (err) {
      console.error(`  FAIL: ${name}`);
      console.error(err);
      server.close();
      if (storeSnapshotBefore !== null) {
        fs.writeFileSync(STORE_PATH, storeSnapshotBefore, 'utf-8');
      }
      process.exit(1);
    }
  };

  try {
    // =========================================================================
    // 1. PERSISTENCE GATES & NEW FAMILY ZERO-SEEDING INVARIANT
    // =========================================================================
    const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const newOwnerUserId = `usr-clean-owner-${uniqueSuffix}`;
    let cleanFamilyId = '';

    await test('New family creation starts with 0 demo records across all modules', async () => {
      const createRes = await requestJson(
        baseUrl,
        'POST',
        '/api/v1/workspaces',
        {
          name: 'Clean Slate Family',
          motto: 'Simple, True, Durable',
          mission: 'Zero seeded demo data.',
          currencyCode: 'USD',
          ownerDisplayName: 'Clean Owner',
        },
        newOwnerUserId
      );
      assert.ok(
        createRes.status === 201 || createRes.status === 200,
        `Expected 201/200, got ${createRes.status}: ${JSON.stringify(createRes.data)}`
      );
      cleanFamilyId = createRes.data.workspace?.id || createRes.data.familyId;
      assert.ok(cleanFamilyId && cleanFamilyId !== 'fam-1', 'Must generate a dynamic non-fam-1 family ID');

      // Inspect Home Dashboards for the new family
      const homeRes = await requestJson(
        baseUrl,
        'GET',
        `/api/v1/home-dashboards/${encodeURIComponent(cleanFamilyId)}`,
        undefined,
        newOwnerUserId
      );
      assert.equal(homeRes.status, 200);
      assert.equal(homeRes.data.financeDashboard.accounts.length, 0, 'New family must have 0 accounts');
      assert.equal(homeRes.data.financeDashboard.budgets.length, 0, 'New family must have 0 budgets');
      assert.equal(homeRes.data.financeDashboard.savingsGoals.length, 0, 'New family must have 0 savings goals');
      assert.equal(homeRes.data.financeDashboard.recurringRules.length, 0, 'New family must have 0 recurring rules');
      assert.equal(homeRes.data.financeDashboard.investments.length, 0, 'New family must have 0 investments');
      assert.equal(homeRes.data.financeDashboard.recentTransactions.length, 0, 'New family must have 0 transactions');
      assert.equal(homeRes.data.householdDashboard.meals.length, 0, 'New family must have 0 meals');
      assert.equal(homeRes.data.householdDashboard.recipes.length, 0, 'New family must have 0 recipes');
      assert.equal(homeRes.data.householdDashboard.chores.length, 0, 'New family must have 0 chores');
      assert.equal(homeRes.data.householdDashboard.pantry.length, 0, 'New family must have 0 pantry items');
      assert.equal(homeRes.data.householdDashboard.groceries.length, 0, 'New family must have 0 groceries');
      assert.equal(homeRes.data.householdDashboard.assets.length, 0, 'New family must have 0 assets');
      assert.equal(homeRes.data.calendarEvents.length, 0, 'New family must have 0 calendar events');

      // Inspect Family Section for the new family
      const famSecRes = await requestJson(
        baseUrl,
        'GET',
        `/api/v1/family-section/${encodeURIComponent(cleanFamilyId)}`,
        undefined,
        newOwnerUserId
      );
      assert.equal(famSecRes.status, 200);
      assert.equal(famSecRes.data.albums.length, 0, 'New family must have 0 seeded albums');
      assert.equal(famSecRes.data.photos.length, 0, 'New family must have 0 seeded photos');
      assert.equal(famSecRes.data.currentConstitution, null, 'New family must have null constitution initially');
      assert.equal(famSecRes.data.traditions.length, 0, 'New family must have 0 seeded traditions');
      assert.equal(famSecRes.data.sharedActivities.length, 0, 'New family must have 0 seeded shared activities');
      assert.equal(famSecRes.data.rules.length, 0, 'New family must have 0 seeded rules');
      assert.equal(famSecRes.data.extendedRelatives.length, 0, 'New family must have 0 seeded extended relatives');
    });

    await test('GET endpoints are strictly read-only and do not mutate disk store', async () => {
      const beforeRaw = fs.readFileSync(STORE_PATH, 'utf-8');
      const endpoints = [
        `/api/v1/home-dashboards/${encodeURIComponent(cleanFamilyId)}`,
        `/api/v1/family-section/${encodeURIComponent(cleanFamilyId)}`,
        `/api/v1/finance/${encodeURIComponent(cleanFamilyId)}/summary`,
        `/api/v1/finance/${encodeURIComponent(cleanFamilyId)}/cashflow`,
        `/api/v1/household/${encodeURIComponent(cleanFamilyId)}/summary`,
        `/api/v1/calendar/${encodeURIComponent(cleanFamilyId)}`,
        `/api/v1/routines/${encodeURIComponent(cleanFamilyId)}`,
        `/api/v1/planning/${encodeURIComponent(cleanFamilyId)}`,
      ];
      for (const ep of endpoints) {
        const res = await requestJson(baseUrl, 'GET', ep, undefined, newOwnerUserId);
        assert.equal(res.status, 200, `GET ${ep} failed with ${res.status}`);
      }
      const afterRaw = fs.readFileSync(STORE_PATH, 'utf-8');
      assert.equal(afterRaw, beforeRaw, 'GET requests must not write or mutate the persistent store file');
    });

    await test('Finance & Household records are durably persisted to disk and survive process/cache reload', async () => {
      // 1. Create Checking Account ($5,000.00 = 500000 cents)
      const accRes = await requestJson(
        baseUrl,
        'POST',
        `/api/v1/finance/${encodeURIComponent(cleanFamilyId)}/accounts`,
        {
          name: 'Operating Checking',
          accountType: 'CHECKING',
          currentBalanceCents: 500000,
          isLiability: false,
        },
        newOwnerUserId
      );
      assert.equal(accRes.status, 201);
      const checkingAccId = accRes.data.account.id;

      // 2. Create Investment Account ($20,000.00 = 2000000 cents) + Investment Holding ($20,000.00)
      const invAccRes = await requestJson(
        baseUrl,
        'POST',
        `/api/v1/finance/${encodeURIComponent(cleanFamilyId)}/accounts`,
        {
          name: 'Brokerage Account',
          accountType: 'INVESTMENT',
          currentBalanceCents: 2000000,
          isLiability: false,
        },
        newOwnerUserId
      );
      assert.equal(invAccRes.status, 201);
      const brokerageAccId = invAccRes.data.account.id;

      const holdRes = await requestJson(
        baseUrl,
        'POST',
        `/api/v1/finance/${encodeURIComponent(cleanFamilyId)}/investments`,
        {
          accountId: brokerageAccId,
          symbol: 'VTI',
          assetName: 'Vanguard Total Stock Market ETF',
          assetType: 'ETF',
          quantityMicroshares: 100_000_000, // 100 shares
          costBasisCents: 1800000,
          currentPriceCents: 20000, // $200/share -> $20,000.00 valuation (2000000 cents)
        },
        newOwnerUserId
      );
      assert.equal(holdRes.status, 201);

      // 3. Create Savings Goal, Recurring Rule, Pantry Item, and Chore
      const savRes = await requestJson(
        baseUrl,
        'POST',
        `/api/v1/finance/${encodeURIComponent(cleanFamilyId)}/savings`,
        {
          title: 'Emergency Reserve',
          targetCents: 100000,
          currentCents: 25000,
          linkedAccountId: checkingAccId,
        },
        newOwnerUserId
      );
      assert.equal(savRes.status, 201);

      const recRes = await requestJson(
        baseUrl,
        'POST',
        `/api/v1/finance/${encodeURIComponent(cleanFamilyId)}/recurring`,
        {
          accountId: checkingAccId,
          title: 'Fiber Internet',
          amountCents: 8500,
          transactionType: 'EXPENSE',
          category: 'UTILITIES',
          recurrenceInterval: 'MONTHLY',
          nextDueDate: Date.now(),
        },
        newOwnerUserId
      );
      assert.equal(recRes.status, 201);

      const panRes = await requestJson(
        baseUrl,
        'POST',
        `/api/v1/household/${encodeURIComponent(cleanFamilyId)}/pantry`,
        {
          itemName: 'Organic Olive Oil',
          category: 'PANTRY',
          quantity: 2,
          unit: 'l',
          minThreshold: 1,
        },
        newOwnerUserId
      );
      assert.equal(panRes.status, 201);

      // Verify all entities exist on disk in data/familyos-shared-store.json
      const diskJson = JSON.parse(fs.readFileSync(STORE_PATH, 'utf-8'));
      assert.ok(
        (diskJson.investmentHoldings || []).some((h: any) => h.familyId === cleanFamilyId && h.symbol === 'VTI'),
        'Investment holding must be durably stored on disk'
      );
      assert.ok(
        (diskJson.savingsGoals || []).some((g: any) => g.familyId === cleanFamilyId && g.title === 'Emergency Reserve'),
        'Savings goal must be durably stored on disk'
      );
      assert.ok(
        (diskJson.recurringRules || []).some((r: any) => r.familyId === cleanFamilyId && r.title === 'Fiber Internet'),
        'Recurring rule must be durably stored on disk'
      );
      assert.ok(
        (diskJson.householdPantry || []).some((p: any) => p.familyId === cleanFamilyId && p.itemName === 'Organic Olive Oil'),
        'Household pantry item must be durably stored on disk'
      );
    });

    // =========================================================================
    // 2. CALCULATION GATES (NET WORTH SINGLE-COUNTING & HOME/FINANCE PARITY)
    // =========================================================================
    await test('Net worth single-counts investment holdings and matches 100% between Finance Hub and Home Money Dashboard', async () => {
      // Checking = 500,000 cents ($5,000), Brokerage Account = 2,000,000 cents ($20,000) WITH VTI holding = 2,000,000 cents ($20,000).
      // Authoritative net worth MUST be 2,500,000 cents ($25,000), NOT 4,500,000 cents!
      const finSumRes = await requestJson(
        baseUrl,
        'GET',
        `/api/v1/finance/${encodeURIComponent(cleanFamilyId)}/summary`,
        undefined,
        newOwnerUserId
      );
      assert.equal(finSumRes.status, 200);
      assert.equal(finSumRes.data.netWorthCents, 2500000);
      assert.equal(finSumRes.data.netWorthCentsDecimal, '2500000');
      assert.equal(finSumRes.data.availableCashCents, 500000);

      const homeRes = await requestJson(
        baseUrl,
        'GET',
        `/api/v1/home-dashboards/${encodeURIComponent(cleanFamilyId)}`,
        undefined,
        newOwnerUserId
      );
      assert.equal(homeRes.status, 200);
      const hf = homeRes.data.financeDashboard;
      assert.equal(hf.netWorthCents, finSumRes.data.netWorthCents);
      assert.equal(hf.netWorthCentsDecimal, finSumRes.data.netWorthCentsDecimal);
      assert.equal(hf.availableCashCents, finSumRes.data.availableCashCents);
      assert.equal(hf.totalAssetsCents, finSumRes.data.totalAssetsCents);
      assert.equal(hf.totalLiabilitiesCents, finSumRes.data.totalLiabilitiesCents);
    });

    await test('Cash flow respects [startEpoch, endEpoch) boundaries, excludes TRANSFER, and applies reversals once', () => {
      const win = getMonthWindow(2026, 11, 'UTC');
      const txs: any[] = [
        // Inside period: Income $3,000 (300000 cents)
        {
          id: 'tx-inc-1',
          familyId: 'fam-test',
          accountId: 'a1',
          title: 'Salary',
          amountCents: 300000,
          amountCentsDecimal: '300000',
          transactionType: 'INCOME',
          category: 'SALARY',
          transactionDate: win.startEpoch + 1000,
          isReversal: false,
          reversalOfId: null,
        },
        // Inside period: Expense $400 (40000 cents)
        {
          id: 'tx-exp-1',
          familyId: 'fam-test',
          accountId: 'a1',
          title: 'Groceries',
          amountCents: 40000,
          amountCentsDecimal: '40000',
          transactionType: 'EXPENSE',
          category: 'GROCERIES',
          transactionDate: win.startEpoch + 2000,
          isReversal: false,
          reversalOfId: null,
        },
        // Reversal of tx-exp-1 ($400)
        {
          id: 'tx-rev-1',
          familyId: 'fam-test',
          accountId: 'a1',
          title: 'REVERSAL: Groceries',
          amountCents: 40000,
          amountCentsDecimal: '40000',
          transactionType: 'EXPENSE',
          category: 'GROCERIES',
          transactionDate: win.startEpoch + 3000,
          isReversal: true,
          reversalOfId: 'tx-exp-1',
        },
        // Internal TRANSFER $1,000 (must be excluded from income and expenses)
        {
          id: 'tx-xfer-1',
          familyId: 'fam-test',
          accountId: 'a1',
          destinationAccountId: 'a2',
          title: 'Transfer to Savings',
          amountCents: 100000,
          amountCentsDecimal: '100000',
          transactionType: 'TRANSFER',
          category: 'TRANSFER',
          transactionDate: win.startEpoch + 4000,
          isReversal: false,
          reversalOfId: null,
        },
        // Outside period (exact endEpoch is exclusive)
        {
          id: 'tx-outside-1',
          familyId: 'fam-test',
          accountId: 'a1',
          title: 'Next Month Rent',
          amountCents: 200000,
          amountCentsDecimal: '200000',
          transactionType: 'EXPENSE',
          category: 'HOUSING',
          transactionDate: win.endEpoch,
          isReversal: false,
          reversalOfId: null,
        },
      ];

      const cf = computeAuthoritativeCashFlow(txs, {
        startEpoch: win.startEpoch,
        endEpoch: win.endEpoch,
        timezone: 'UTC',
      });
      assert.equal(cf.incomeCentsBig, 300000n, 'Income in period should be 300000n');
      assert.equal(cf.expenseCentsBig, 0n, 'Reversed expense in period should net to 0n');
      assert.equal(cf.netCashFlowCentsBig, 300000n, 'Net cash flow in period should be 300000n');
    });

    await test('Recurring forecast normalizes daily, weekly, biweekly, monthly, quarterly, annual, and month-end rules', () => {
      const rules: any[] = [
        {
          id: 'r-weekly',
          familyId: 'fam-test',
          accountId: 'a1',
          title: 'Weekly Allowance',
          amountCents: 1200,
          amountCentsDecimal: '1200',
          transactionType: 'EXPENSE',
          category: 'ALLOWANCE',
          recurrenceInterval: 'WEEKLY',
          nextDueDate: Date.UTC(2028, 1, 1, 12, 0, 0), // Feb 1, 2028 (leap year Feb has 29 days -> 5 Tuesdays: Feb 1, 8, 15, 22, 29)
          isActive: true,
          isAutoPay: true,
          createdAt: 0,
          updatedAt: 0,
        },
        {
          id: 'r-annual',
          familyId: 'fam-test',
          accountId: 'a1',
          title: 'Annual Property Tax',
          amountCents: 120000,
          amountCentsDecimal: '120000',
          transactionType: 'EXPENSE',
          category: 'TAXES',
          recurrenceInterval: 'ANNUAL',
          nextDueDate: Date.UTC(2028, 5, 15, 12, 0, 0), // June 2028 (0 occurrences in Feb 2028, but $100/mo average equivalent)
          isActive: true,
          isAutoPay: false,
          createdAt: 0,
          updatedAt: 0,
        },
      ];

      const forecast = computeAuthoritativeRecurringForecast(rules, {
        year: 2028,
        month: 2,
        timezone: 'UTC',
      });
      // Weekly $12.00 -> average monthly = (1200 * 52) / 12 = 5200 cents; Annual $1,200.00 -> average monthly = 10000 cents
      assert.equal(forecast.averageMonthlyExpenseCentsBig, 15200n);
      // In Feb 2028 (leap year), Feb 1 occurs 5 times (Feb 1, 8, 15, 22, 29) -> 5 * 1200 = 6000 cents; Annual in June has 0 occurrences in Feb
      assert.equal(forecast.scheduledMonthExpenseCentsBig, 6000n);
    });

    await test('Budget status strictly respects alertThresholdPercentage and validates 1..100', async () => {
      // 82% spent with a 90% threshold MUST be NORMAL (not WARNING!)
      const status82With90 = computeAuthoritativeBudgetStatusBigInt(10000n, 8200n, 90);
      assert.equal(status82With90.status, 'NORMAL');
      assert.equal(status82With90.spentPercentage, 82);

      // 90% spent with a 90% threshold MUST be WARNING
      const status90With90 = computeAuthoritativeBudgetStatusBigInt(10000n, 9000n, 90);
      assert.equal(status90With90.status, 'WARNING');

      // 100% spent MUST be OVER_BUDGET
      const status100 = computeAuthoritativeBudgetStatusBigInt(10000n, 10000n, 90);
      assert.equal(status100.status, 'OVER_BUDGET');

      // Invalid threshold via API must return 400
      const badBudgetRes = await requestJson(
        baseUrl,
        'POST',
        `/api/v1/finance/${encodeURIComponent(cleanFamilyId)}/budgets`,
        {
          category: 'DINING',
          allocatedCents: 50000,
          alertThresholdPercentage: 105,
        },
        newOwnerUserId
      );
      assert.equal(badBudgetRes.status, 400);
    });

    await test('Savings required monthly contribution uses exact ceiling integer division', () => {
      const now = Date.UTC(2026, 0, 1);
      const threeMonthsLater = Date.UTC(2026, 3, 1);
      // Remaining = 1000 cents over 3 months -> ceil(1000 / 3) = 334 cents
      const reqMonthly = computeAuthoritativeSuggestedMonthlyContributionBigInt(
        1000n,
        0n,
        threeMonthsLater,
        now
      );
      assert.equal(reqMonthly, 334n);
    });

    await test('Household calculations: shared expiry status, calendar-aware monthly chore recurrence, and unit conversion', () => {
      const now = Date.UTC(2026, 5, 10, 12, 0, 0);
      assert.equal(computeExpiryStatus(now - 1000, now), 'EXPIRED');
      assert.equal(computeExpiryStatus(now + 2 * 86400_000, now), 'EXPIRING_SOON');
      assert.equal(computeExpiryStatus(now + 5 * 86400_000, now), 'SAFE');

      // Monthly chore recurrence from Jan 31, 2026 -> Feb 28, 2026 (non-leap year)
      const jan31 = Date.UTC(2026, 0, 31, 9, 0, 0);
      const nextDue2026 = computeNextChoreDueDate(jan31, 'MONTHLY');
      const nextDate2026 = new Date(nextDue2026);
      assert.equal(nextDate2026.getUTCFullYear(), 2026);
      assert.equal(nextDate2026.getUTCMonth(), 1); // Feb
      assert.equal(nextDate2026.getUTCDate(), 28);

      // Monthly chore recurrence from Jan 31, 2028 -> Feb 29, 2028 (leap year)
      const jan31Leap = Date.UTC(2028, 0, 31, 9, 0, 0);
      const nextDue2028 = computeNextChoreDueDate(jan31Leap, 'MONTHLY');
      const nextDate2028 = new Date(nextDue2028);
      assert.equal(nextDate2028.getUTCFullYear(), 2028);
      assert.equal(nextDate2028.getUTCMonth(), 1); // Feb
      assert.equal(nextDate2028.getUTCDate(), 29);

      // Compatible unit conversion: 1500 g -> 1.5 kg; incompatible g -> ml returns null
      assert.equal(convertHouseholdQuantity(1500, 'g', 'kg'), 1.5);
      assert.equal(convertHouseholdQuantity(2, 'l', 'ml'), 2000);
      assert.equal(convertHouseholdQuantity(500, 'g', 'ml'), null);
    });

    await test('Canonical Route Registry maps legacy sub-items and tabs to single-owner destinations', () => {
      const finDest = resolveCanonicalDestination('finance_hub', 'fin_budgets');
      assert.equal(finDest.activeTab, 'family_home');
      assert.equal(finDest.activeSubItemId, 'home_finance_dashboard');
      assert.equal(finDest.internalDomainSection, 'budgets');

      const hhDest = resolveCanonicalDestination('household_hub', 'house_groceries');
      assert.equal(hhDest.activeTab, 'family_home');
      assert.equal(hhDest.activeSubItemId, 'home_house_dashboard');
      assert.equal(hhDest.internalDomainSection, 'groceries');

      const famDest = resolveCanonicalDestination('people_relationships', 'people_gallery');
      assert.equal(famDest.activeTab, 'people_relationships');
      assert.equal(famDest.activeSubItemId, 'people_gallery');

      const calDest = resolveCanonicalDestination('calendar_routines', 'cal_schedule');
      assert.equal(calDest.activeTab, 'calendar_routines');
      assert.equal(calDest.activeSubItemId, 'cal_schedule');

      const dbDest = resolveCanonicalDestination('database', 'database');
      assert.equal(dbDest.activeTab, 'database');
      assert.equal(dbDest.activeSubItemId, 'database');
    });

    await test('Section 3: Authorization & Family Isolation (unauthenticated 401, cross-family 403, second family 409, member access, revoked member 403)', async () => {
      // 1. Unauthenticated request -> 401
      const unauthRes = await requestJson(
        baseUrl,
        'GET',
        `/api/v1/finance/${encodeURIComponent(cleanFamilyId)}/summary`
      );
      assert.equal(unauthRes.status, 401);

      // 2. Cross-family access -> 403 across Finance, Household, and Family Section
      const crossFin = await requestJson(
        baseUrl,
        'GET',
        `/api/v1/finance/${encodeURIComponent(cleanFamilyId)}/summary`,
        undefined,
        'usr-sarah-owner'
      );
      assert.equal(crossFin.status, 403);

      const crossHh = await requestJson(
        baseUrl,
        'GET',
        `/api/v1/household/${encodeURIComponent(cleanFamilyId)}/summary`,
        undefined,
        'usr-sarah-owner'
      );
      assert.equal(crossHh.status, 403);

      const crossFamSec = await requestJson(
        baseUrl,
        'GET',
        `/api/v1/family-section/${encodeURIComponent(cleanFamilyId)}`,
        undefined,
        'usr-sarah-owner'
      );
      assert.equal(crossFamSec.status, 403);

      // 3. Second active family creation attempt by existing OWNER -> 409
      const secondFamRes = await requestJson(
        baseUrl,
        'POST',
        '/api/v1/workspaces',
        { name: 'Illegal Second Family', currencyCode: 'USD' },
        newOwnerUserId
      );
      assert.equal(secondFamRes.status, 409);

      // 4. Invite a member to cleanFamilyId, claim invitation, verify member access (200), then revoke and verify 403
      const inviteeUserId = `usr-clean-member-${uniqueSuffix}`;
      const invRes = await requestJson(
        baseUrl,
        'POST',
        '/api/v1/invitations',
        {
          familyId: cleanFamilyId,
          inviteeName: 'Invited Adult Member',
          proposedRole: 'MEMBER',
          inviteMethod: 'ONE_TIME_LINK',
        },
        newOwnerUserId
      );
      assert.equal(invRes.status, 201);
      const rawInviteToken = invRes.data.invitation?.invitationToken;
      assert.ok(rawInviteToken);

      const acceptRes = await requestJson(
        baseUrl,
        'POST',
        '/api/v1/invitations/claim-one-time-link',
        {
          invitationToken: rawInviteToken,
        },
        inviteeUserId
      );
      assert.equal(acceptRes.status, 200);
      const membershipId = acceptRes.data.membership.id;

      // Member can access permitted family records
      const memberReadRes = await requestJson(
        baseUrl,
        'GET',
        `/api/v1/family-section/${encodeURIComponent(cleanFamilyId)}`,
        undefined,
        inviteeUserId
      );
      assert.equal(memberReadRes.status, 200);

      // Owner revokes member via POST /api/v1/memberships/:membershipId/revoke
      const revokeRes = await requestJson(
        baseUrl,
        'POST',
        `/api/v1/memberships/${encodeURIComponent(membershipId)}/revoke`,
        { reason: 'Verification test revocation' },
        newOwnerUserId
      );
      assert.equal(revokeRes.status, 200);
      assert.equal(revokeRes.data.revoked, true);

      // Revoked member attempting to access former family's records -> 403
      const revokedReadRes = await requestJson(
        baseUrl,
        'GET',
        `/api/v1/family-section/${encodeURIComponent(cleanFamilyId)}`,
        undefined,
        inviteeUserId
      );
      assert.equal(revokedReadRes.status, 403);
    });

    await test('Section 4 & 5: Savings contribution real money movement, invalid fundingAccountId rejection, 64-bit precision, and Home/Finance consistency', async () => {
      const summaryBefore = await requestJson(
        baseUrl,
        'GET',
        `/api/v1/finance/${encodeURIComponent(cleanFamilyId)}/summary`,
        undefined,
        newOwnerUserId
      );
      assert.equal(summaryBefore.status, 200);
      const checkingAcc = summaryBefore.data.accounts.find((a: any) => a.name === 'Operating Checking');
      const goal = summaryBefore.data.savingsGoals.find((g: any) => g.title === 'Emergency Reserve');
      assert.ok(checkingAcc && goal);

      // 1. Invalid fundingAccountId must be rejected with 404 without mutating goal
      const badFundRes = await requestJson(
        baseUrl,
        'POST',
        `/api/v1/finance/${encodeURIComponent(cleanFamilyId)}/savings/${encodeURIComponent(goal.id)}/contribute`,
        {
          amountCents: 10000,
          fundingAccountId: 'acc-non-existent-999',
        },
        newOwnerUserId
      );
      assert.equal(badFundRes.status, 404);

      // 2. Create a Dedicated Savings Account and a new Savings Goal linked to it, then fund from Operating Checking
      const savAccRes = await requestJson(
        baseUrl,
        'POST',
        `/api/v1/finance/${encodeURIComponent(cleanFamilyId)}/accounts`,
        {
          name: 'Dedicated Goal Vault',
          accountType: 'SAVINGS',
          currentBalanceCents: 100000, // $1,000.00
          isLiability: false,
        },
        newOwnerUserId
      );
      assert.equal(savAccRes.status, 201);
      const vaultAccId = savAccRes.data.account.id;

      const vaultGoalRes = await requestJson(
        baseUrl,
        'POST',
        `/api/v1/finance/${encodeURIComponent(cleanFamilyId)}/savings`,
        {
          title: 'Education Fund',
          targetCents: 500000,
          currentCents: 100000,
          linkedAccountId: vaultAccId,
        },
        newOwnerUserId
      );
      assert.equal(vaultGoalRes.status, 201);
      const vaultGoalId = vaultGoalRes.data.goal.id;

      // Contribute $250.00 (25000 cents) from Operating Checking (500000) -> Dedicated Goal Vault (100000)
      const contribRes = await requestJson(
        baseUrl,
        'POST',
        `/api/v1/finance/${encodeURIComponent(cleanFamilyId)}/savings/${encodeURIComponent(vaultGoalId)}/contribute`,
        {
          amountCents: 25000,
          fundingAccountId: checkingAcc.id,
          notes: 'Monthly transfer to Education Fund',
        },
        newOwnerUserId
      );
      assert.equal(contribRes.status, 200);
      assert.equal(contribRes.data.goal.currentCents, 125000);
      assert.equal(contribRes.data.sourceType, 'INTERNAL_ACCOUNT_TRANSFER');
      assert.ok(contribRes.data.ledgerTransactionId);

      // Verify Operating Checking decreased to 475,000, Vault increased to 125,000, and Home vs Finance Hub match 100%
      const finAfter = await requestJson(
        baseUrl,
        'GET',
        `/api/v1/finance/${encodeURIComponent(cleanFamilyId)}/summary`,
        undefined,
        newOwnerUserId
      );
      const homeAfter = await requestJson(
        baseUrl,
        'GET',
        `/api/v1/home-dashboards/${encodeURIComponent(cleanFamilyId)}`,
        undefined,
        newOwnerUserId
      );
      assert.equal(finAfter.status, 200);
      assert.equal(homeAfter.status, 200);

      const updatedChecking = finAfter.data.accounts.find((a: any) => a.id === checkingAcc.id);
      const updatedVault = finAfter.data.accounts.find((a: any) => a.id === vaultAccId);
      assert.equal(updatedChecking.currentBalanceCents, 475000);
      assert.equal(updatedVault.currentBalanceCents, 125000);

      // Compare Finance Hub summary vs Home Finance Dashboard
      const hf = homeAfter.data.financeDashboard;
      assert.equal(hf.netWorthCentsDecimal, finAfter.data.netWorthCentsDecimal);
      assert.equal(hf.availableCashCentsDecimal, finAfter.data.availableCashCentsDecimal);
      assert.equal(hf.monthlyIncomeCentsDecimal, finAfter.data.monthlyIncomeCentsDecimal);
      assert.equal(hf.monthlyExpensesCentsDecimal, finAfter.data.monthlyExpensesCentsDecimal);
      assert.equal(hf.savingsGoals.length, finAfter.data.savingsGoals.length);

      // 3. Verify 64-bit integer precision above Number.MAX_SAFE_INTEGER (9,007,199,254,740,991)
      const largenw = computeAuthoritativeNetWorth(
        [
          {
            id: 'acc-large',
            familyId: 'fam-large',
            name: 'Sovereign Trust',
            accountType: 'SAVINGS',
            currentBalanceCents: null as any,
            currentBalanceCentsDecimal: '9200000000000005',
            isLiability: false,
          } as any,
        ],
        []
      );
      assert.equal(largenw.netWorthCentsBig, 9200000000000005n);
      assert.equal(largenw.totalAssetsCentsBig, 9200000000000005n);
    });

    await test('Section 6: Household workflows (meals, recipes, chores completion + recurrence, maintenance & asset logs, wardrobe) persist and isolate per family', async () => {
      // 1. Recipe & Meal Plan
      const recRes = await requestJson(
        baseUrl,
        'POST',
        `/api/v1/household/${encodeURIComponent(cleanFamilyId)}/recipes`,
        {
          title: 'Lemon Herb Roast Chicken',
          prepTimeMinutes: 20,
          cookTimeMinutes: 65,
          servings: 4,
          ingredients: [
            { itemName: 'Whole Chicken', quantity: 1, unit: 'count' },
            { itemName: 'Organic Olive Oil', quantity: 50, unit: 'ml' },
          ],
        },
        newOwnerUserId
      );
      assert.equal(recRes.status, 201);

      const mealRes = await requestJson(
        baseUrl,
        'POST',
        `/api/v1/household/${encodeURIComponent(cleanFamilyId)}/meals`,
        {
          planDate: Date.now(),
          mealType: 'DINNER',
          customMealTitle: 'Lemon Herb Roast Chicken',
          recipeId: recRes.data.recipe.id,
        },
        newOwnerUserId
      );
      assert.equal(mealRes.status, 201);

      // 2. Chore creation, assignment, and completion
      const choreRes = await requestJson(
        baseUrl,
        'POST',
        `/api/v1/household/${encodeURIComponent(cleanFamilyId)}/chores`,
        {
          title: 'Deep Clean Kitchen Appliances',
          assignedToMemberName: 'Clean Owner',
          rewardPoints: 25,
          frequency: 'MONTHLY',
          nextDueDate: Date.UTC(2026, 0, 31, 9, 0, 0),
        },
        newOwnerUserId
      );
      assert.equal(choreRes.status, 201);
      const choreId = choreRes.data.chore.id;

      const completeChoreRes = await requestJson(
        baseUrl,
        'POST',
        `/api/v1/household/${encodeURIComponent(cleanFamilyId)}/chores/${encodeURIComponent(choreId)}/complete`,
        {},
        newOwnerUserId
      );
      assert.equal(completeChoreRes.status, 200);
      assert.equal(completeChoreRes.data.chore.isCompleted, true);
      assert.equal(completeChoreRes.data.pointsAwarded, 25);

      // 3. Asset & Maintenance cost log
      const assetRes = await requestJson(
        baseUrl,
        'POST',
        `/api/v1/household/${encodeURIComponent(cleanFamilyId)}/assets`,
        {
          name: 'Heat Pump Water Heater',
          category: 'APPLIANCES',
          purchasePriceCents: 185000,
        },
        newOwnerUserId
      );
      assert.equal(assetRes.status, 201);
      const assetId = assetRes.data.asset.id;

      const logRes = await requestJson(
        baseUrl,
        'POST',
        `/api/v1/household/${encodeURIComponent(cleanFamilyId)}/assets/${encodeURIComponent(assetId)}/maintenance`,
        {
          performedBy: 'GreenHome Mechanical',
          costCents: 14500,
          notes: 'Annual Anode Rod & Filter Service',
        },
        newOwnerUserId
      );
      assert.equal(logRes.status, 200);
      assert.equal(logRes.data.record.costCents, 14500);

      // 4. Wardrobe item creation
      const wardRes = await requestJson(
        baseUrl,
        'POST',
        `/api/v1/household/${encodeURIComponent(cleanFamilyId)}/wardrobe`,
        {
          memberId: 'mem-clean-owner',
          itemName: 'Merino Wool Winter Coat',
          category: 'OUTERWEAR',
          season: 'WINTER',
        },
        newOwnerUserId
      );
      assert.equal(wardRes.status, 201);
    });

    await test('Section 7: Media & Gallery upload validation enforces actual file, MIME allowlist, magic bytes, 5MB limit, and rejects external URLs', async () => {
      // 1. Missing image file -> 400 IMAGE_FILE_REQUIRED
      const missingRes = await requestJson(
        baseUrl,
        'POST',
        `/api/v1/family-section/${encodeURIComponent(cleanFamilyId)}/photos`,
        { title: 'No File Photo' },
        newOwnerUserId
      );
      assert.equal(missingRes.status, 400);
      assert.equal(missingRes.data.error, 'IMAGE_FILE_REQUIRED');

      // 2. Arbitrary external URL -> 400 EXTERNAL_URL_FORBIDDEN
      const extUrlRes = await requestJson(
        baseUrl,
        'POST',
        `/api/v1/family-section/${encodeURIComponent(cleanFamilyId)}/photos`,
        {
          title: 'External URL Bypass Attempt',
          imageUrl: 'https://evil.example.com/tracker.png',
        },
        newOwnerUserId
      );
      assert.equal(extUrlRes.status, 400);
      assert.equal(extUrlRes.data.error, 'EXTERNAL_URL_FORBIDDEN');

      // 3. Spoofed file signature (claims image/png, but binary payload is ASCII "HELLO_WORLD") -> 400 INVALID_FILE_SIGNATURE
      const spoofedBase64 = Buffer.from('HELLO_WORLD_NOT_A_PNG', 'utf-8').toString('base64');
      const spoofRes = await requestJson(
        baseUrl,
        'POST',
        `/api/v1/family-section/${encodeURIComponent(cleanFamilyId)}/photos`,
        {
          title: 'Spoofed Magic Bytes',
          imageUrl: `data:image/png;base64,${spoofedBase64}`,
        },
        newOwnerUserId
      );
      assert.equal(spoofRes.status, 400);
      assert.equal(spoofRes.data.error, 'INVALID_FILE_SIGNATURE');

      // 4. Valid 1x1 PNG -> 201 and media asset persisted atomically in store.mediaAssets
      const validPngDataUrl =
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      const validRes = await requestJson(
        baseUrl,
        'POST',
        `/api/v1/family-section/${encodeURIComponent(cleanFamilyId)}/photos`,
        {
          title: 'Verified Family Portrait',
          imageUrl: validPngDataUrl,
        },
        newOwnerUserId
      );
      assert.equal(validRes.status, 201);
      assert.equal(validRes.data.persisted, true);
      assert.ok(validRes.data.mediaId, 'Must persist media asset and return mediaId');

      const diskStore = loadStore();
      assert.ok(
        diskStore.mediaAssets?.[validRes.data.mediaId],
        'Media asset must be stored in store.mediaAssets before API reports success'
      );
    });

    await test('Section 8: Protected backup/restore, idempotent PostgreSQL migration reconciliation, fail-closed storage mode, and Firestore policy', async () => {
      // 1. Verify explicit Firestore unidirectional mirror policy
      assert.equal(FIRESTORE_SYNCHRONIZATION_POLICY.role, 'DOWNSTREAM_READ_ONLY_MIRROR');
      assert.equal(FIRESTORE_SYNCHRONIZATION_POLICY.direction, 'BACKEND_TO_FIRESTORE_UNIDIRECTIONAL');
      assert.equal(FIRESTORE_SYNCHRONIZATION_POLICY.conflictPolicy, 'AUTHORITATIVE_BACKEND_WINS_BY_VERSION');
      assert.equal(FIRESTORE_SYNCHRONIZATION_POLICY.allowDirectClientAuthoritativeWrites, false);

      // 2. Verify protected pre-PostgreSQL backup creation, SHA-256 verification, and lossless restore
      const backupMeta = createProtectedPrePostgresBackup();
      assert.ok(backupMeta.sha256.length === 64, 'Protected backup must record a 64-char SHA-256 hex digest');
      const verifyResult = verifyProtectedBackup(backupMeta.backupPath);
      assert.equal(verifyResult.valid, true, 'Protected backup must pass SHA-256 and JSON verification');
      assert.equal(verifyResult.sha256, backupMeta.sha256);

      // 3. Run idempotent PostgreSQL migration export & reconciliation report
      const report = runIdempotentPostgresMigrationExport();
      assert.equal(report.reconciled, true, `Expected 0 validation errors, got: ${report.validationErrors.join('; ')}`);
      assert.equal(report.referentialIntegrityPassed, true);
      assert.equal(report.oneActiveMembershipRulePassed, true);
      assert.deepEqual(report.extractedRecordCounts, report.sourceRecordCounts);
      assert.ok(report.extractedRecordCounts.family_workspaces >= 1);
      assert.ok(report.extractedRecordCounts.family_memberships >= 1);
      assert.ok(
        report.preservedHistoricalMembershipsCount.REVOKED >= 1,
        'Historical REVOKED memberships must be preserved during migration'
      );
      assert.ok(fs.existsSync(report.sqlBundlePath), 'SQL migration bundle must be written to disk');

      // Test lossless restore from protected backup
      const restoreRes = restoreFromProtectedBackup(backupMeta.backupPath);
      assert.equal(restoreRes.restored, true);
      assert.equal(restoreRes.sha256, backupMeta.sha256);

      // 4. Verify Requirement 15: Fail-closed behavior when FAMILYOS_STORAGE_MODE=postgres and PostgreSQL is unavailable
      const prevMode = process.env.FAMILYOS_STORAGE_MODE;
      try {
        process.env.FAMILYOS_STORAGE_MODE = 'postgres';
        const failClosedRes = await fetch(`${baseUrl}/api/v1/workspaces`, {
          method: 'GET',
        });
        assert.equal(
          failClosedRes.status,
          503,
          'API must fail closed with HTTP 503 when FAMILYOS_STORAGE_MODE=postgres and PostgreSQL is unavailable'
        );
        const failClosedBody = await failClosedRes.json();
        assert.equal(failClosedBody.error, 'POSTGRES_UNAVAILABLE_NO_JSON_FALLBACK');
        assert.equal(failClosedBody.fallbackPermitted, false);
      } finally {
        if (prevMode === undefined) {
          delete process.env.FAMILYOS_STORAGE_MODE;
        } else {
          process.env.FAMILYOS_STORAGE_MODE = prevMode;
        }
      }

      // 5. Verify hardened production/unconfigured auth registration guard (NODE_ENV !== 'test' blocks registerNewUser)
      const prevNodeEnv = process.env.NODE_ENV;
      try {
        process.env.NODE_ENV = 'development';
        const blockedRegRes = await fetch(`${baseUrl}/api/v1/auth/session`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userAccountId: `usr-new-unseeded-${Date.now()}`,
            registerNewUser: true,
          }),
        });
        assert.equal(
          blockedRegRes.status,
          403,
          'Unseeded test-harness registration must be rejected when NODE_ENV !== "test"'
        );
        const blockedRegBody = await blockedRegRes.json();
        assert.equal(blockedRegBody.error, 'TEST_HARNESS_REGISTRATION_DISABLED');
      } finally {
        process.env.NODE_ENV = prevNodeEnv;
      }

      // 6. Verify parameterized PostgreSQL ACID persistence (BEGIN -> parameterized INSERT ON CONFLICT -> COMMIT)
      const executedSqlQueries: Array<{ sql: string; params: any[] }> = [];
      const mockPgClient = {
        async query(sql: string, params: any[] = []) {
          executedSqlQueries.push({ sql: sql.trim(), params });
          return { rows: [] };
        },
      };
      const currentStore = loadStore();
      await persistStoreToPostgresAcid(mockPgClient, currentStore);
      assert.equal(executedSqlQueries[0]?.sql, 'BEGIN', 'ACID transaction must start with BEGIN');
      assert.equal(
        executedSqlQueries[executedSqlQueries.length - 1]?.sql,
        'COMMIT',
        'ACID transaction must end with COMMIT'
      );
      assert.ok(
        executedSqlQueries.some((q) => q.sql.includes('INSERT INTO family_workspaces') && q.params.length === 16),
        'Must execute parameterized INSERT into family_workspaces'
      );
      assert.ok(
        executedSqlQueries.some((q) => q.sql.includes('INSERT INTO family_memberships') && q.params.length === 11),
        'Must execute parameterized INSERT into family_memberships'
      );
      assert.ok(
        executedSqlQueries.some((q) => q.sql.includes('INSERT INTO financial_accounts') && q.params.length === 11),
        'Must execute parameterized INSERT into financial_accounts'
      );
    });

    console.log(`\nALL ${passed} SIMPLIFICATION & STABILIZATION TESTS PASSED!\n`);
  } finally {
    server.close();
    if (storeSnapshotBefore !== null) {
      fs.writeFileSync(STORE_PATH, storeSnapshotBefore, 'utf-8');
      loadStore();
    }
  }
}

runTests();
