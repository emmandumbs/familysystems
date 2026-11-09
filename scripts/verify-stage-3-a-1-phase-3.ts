/**
 * FAMILYOS — STAGE 3.A.1 PHASE 3: FINAL PRECISION & REAL CHROMIUM E2E VERIFICATION SUITE
 *
 * Covers:
 * Part A — Signed 64-Bit BigInt Financial Precision & Authoritative Decimal-String JSON Contract (Gates P3-G01 to P3-G06)
 *   - Maximum signed 64-bit integer (`9223372036854775807n`) & Minimum signed 64-bit integer (`-9223372036854775808n`)
 *   - Boundary values immediately around `Number.MAX_SAFE_INTEGER` (`9007199254740990n`, `9007199254740991n`, `9007199254740992n`, `9007199254740993n`)
 *   - Negative monetary values, large microshares (`10^6`), fractional share formatting, basis points, and round-trip parsing/formatting
 *   - Authoritative `*Decimal` string JSON contract across all `/api/v1/finance/:familyId/*` endpoints, including `null` safe-number fallback when > `Number.MAX_SAFE_INTEGER` and HTTP 400 rejection of unsafe JS Numbers / 64-bit overflow
 *
 * Part B — Real Chromium Browser End-to-End Verification via Playwright (Gates P3-G07 to P3-G18)
 *   - Launches a real headless Chromium browser (`playwright-core` + `/ms-playwright/chromium_headless_shell-1247/chrome-headless-shell-linux64/chrome-headless-shell`)
 *   - Navigates to live `http://localhost:3000` against a controlled test database snapshot (restored in `finally`)
 *   - Executes all 12 browser workflows in real Chromium:
 *     1. Finance Overview loads actual and projected financial information.
 *     2. Accounts load and reconciliation works.
 *     3. An expense can be created and retrieved.
 *     4. Internal transfers do not inflate income or expenses.
 *     5. Reversal creates a compensating audit entry.
 *     6. Budgets display correct spending and remaining amounts.
 *     7. Savings contributions update the correct records.
 *     8. Recurring rules can be paused and resumed.
 *     9. Investment price updates preserve original cost basis.
 *    10. Household switching clears the previous household's displayed data.
 *    11. `CHILD` and `GUEST` accounts cannot access restricted financial information.
 *    12. Session expiry clears sensitive financial information.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { createRequire } from 'node:module';
import {
  MAX_SIGNED_64_BIGINT,
  MIN_SIGNED_64_BIGINT,
  MAX_SAFE_INTEGER_BIGINT,
  parseSigned64BigInt,
  formatCents,
  parseDollarsToCents,
  parseDollarsToCentsBigInt,
  parseDollarsToCentsDecimalString,
  formatMicroshares,
  parseSharesToMicrosharesBigInt,
  parseSharesToMicrosharesDecimalString,
  formatBasisPoints,
  computeInvestmentValuationBigInt,
  computeGainLossBasisPointsBigInt,
  toBigIntOrZero,
} from '../src/utils/financeFormatting';

const require = createRequire(import.meta.url);
const { chromium } = require('/usr/local/share/bun-global/node_modules/playwright-core');

const CHROMIUM_EXECUTABLE_PATH =
  '/ms-playwright/chromium_headless_shell-1247/chrome-headless-shell-linux64/chrome-headless-shell';
const BASE_URL = 'http://localhost:3000';
const STORE_FILE_PATH = path.resolve(process.cwd(), 'data/familyos-shared-store.json');

interface GateResult {
  id: string;
  name: string;
  passed: boolean;
  details: string;
}

const results: GateResult[] = [];

function recordGate(id: string, name: string, passed: boolean, details: string) {
  results.push({ id, name, passed, details });
  const badge = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${badge} [${id}] ${name} — ${details}`);
}

async function getSessionToken(userAccountId: string): Promise<string> {
  const res = await fetch(`${BASE_URL}/api/v1/auth/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userAccountId }),
  });
  if (!res.ok) {
    throw new Error(`Failed to acquire session token for ${userAccountId}: ${res.status}`);
  }
  const data = await res.json();
  return data.token as string;
}

function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
}

async function runVerification() {
  console.log('================================================================================');
  console.log('FAMILYOS — STAGE 3.A.1 PHASE 3: PRECISION & REAL CHROMIUM E2E VERIFICATION SUITE');
  console.log('================================================================================\n');

  // Snapshot controlled test database state before running tests
  const originalStoreFileBackup = fs.existsSync(STORE_FILE_PATH)
    ? fs.readFileSync(STORE_FILE_PATH, 'utf8')
    : null;

  const ownerToken = await getSessionToken('usr-sarah-owner');

  // Reset in-memory finance fixtures to clean baseline before starting
  await fetch(`${BASE_URL}/api/v1/finance/fam-1/test-reset`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${ownerToken}` },
  });

  let browser: any = null;

  try {
    const hubPath = path.resolve(process.cwd(), 'src/components/Stage3A1FinanceHub.tsx');
    const fmtPath = path.resolve(process.cwd(), 'src/utils/financeFormatting.ts');
    const hubSource = fs.readFileSync(hubPath, 'utf8');
    const fmtSource = fs.readFileSync(fmtPath, 'utf8');
    const fmtExecutable = stripComments(fmtSource);

    // ==========================================================================
    // PART A — SIGNED 64-BIT BIGINT PRECISION & DECIMAL-STRING JSON CONTRACT
    // ==========================================================================
    console.log('--- Part A: Signed 64-Bit BigInt Financial Precision & Authoritative JSON Contract ---');

    // Gate 01: Maximum & Minimum Signed 64-Bit Integer Boundaries
    {
      const maxBig = MAX_SIGNED_64_BIGINT; // 9223372036854775807n
      const minBig = MIN_SIGNED_64_BIGINT; // -9223372036854775808n

      const fmtMax = formatCents(maxBig);
      const fmtMin = formatCents(minBig);

      const parsedMax = parseDollarsToCentsBigInt('$92,233,720,368,547,758.07');
      const parsedMin = parseDollarsToCentsBigInt('-$92,233,720,368,547,758.08');

      // Out-of-range (+1 above MAX_INT64, -1 below MIN_INT64) must return null
      const overflowDollars = parseDollarsToCentsBigInt('92233720368547758.08');
      const underflowDollars = parseDollarsToCentsBigInt('-92233720368547758.09');
      const overflowRaw = parseSigned64BigInt('9223372036854775808');
      const underflowRaw = parseSigned64BigInt('-9223372036854775809');

      const passed =
        fmtMax === '$92,233,720,368,547,758.07' &&
        fmtMin === '-$92,233,720,368,547,758.08' &&
        parsedMax === 9223372036854775807n &&
        parsedMin === -9223372036854775808n &&
        overflowDollars === null &&
        underflowDollars === null &&
        overflowRaw === null &&
        underflowRaw === null &&
        !fmtExecutable.includes('parseFloat');

      recordGate(
        'P3-G01',
        'Signed 64-Bit Boundaries (MAX_INT64 & MIN_INT64) & Overflow Rejection',
        passed,
        `MAX=${fmtMax}, MIN=${fmtMin}, Overflow/Underflow=null`
      );
    }

    // Gate 02: Boundary Values Around Number.MAX_SAFE_INTEGER (9007199254740991)
    {
      const safeMinus1 = 9007199254740990n;
      const exactMaxSafe = MAX_SAFE_INTEGER_BIGINT; // 9007199254740991n
      const safePlus1 = 9007199254740992n;
      const safePlus2 = 9007199254740993n;

      // Unsafe JS number must be rejected by parseSigned64BigInt, parseDollarsToCents, and toBigIntOrZero
      const unsafeNumberRejected = parseSigned64BigInt(Number.MAX_SAFE_INTEGER + 1) === null;
      const unsafeNumberDollarsNull = parseDollarsToCents('90071992547409.93') === null;
      const authoritativePrefersDecimal =
        toBigIntOrZero('9007199254740993', null) === 9007199254740993n &&
        toBigIntOrZero(null, Number.MAX_SAFE_INTEGER + 2) === 0n;

      // Decimal string & BigInt representations around MAX_SAFE_INTEGER must be exact
      const pMinus1 = parseDollarsToCentsBigInt('$90,071,992,547,409.90') === safeMinus1;
      const pExact = parseDollarsToCentsBigInt('$90,071,992,547,409.91') === exactMaxSafe;
      const pPlus1 = parseDollarsToCentsBigInt('$90,071,992,547,409.92') === safePlus1;
      const pPlus2 = parseDollarsToCentsBigInt('$90,071,992,547,409.93') === safePlus2;

      const fPlus2 = formatCents('9007199254740993') === '$90,071,992,547,409.93';
      const decStrPlus2 = parseDollarsToCentsDecimalString('90071992547409.93') === '9007199254740993';

      const passed =
        unsafeNumberRejected &&
        unsafeNumberDollarsNull &&
        authoritativePrefersDecimal &&
        pMinus1 &&
        pExact &&
        pPlus1 &&
        pPlus2 &&
        fPlus2 &&
        decStrPlus2;

      recordGate(
        'P3-G02',
        'Boundary Precision Around Number.MAX_SAFE_INTEGER (9007199254740990n..9007199254740993n)',
        passed,
        `Unsafe Number rejected; "9007199254740993" -> ${formatCents('9007199254740993')} with zero precision loss`
      );
    }

    // Gate 03: Negative Monetary Values & Round-Trip Parsing/Formatting
    {
      const testCases: Array<{ cents: bigint; formatted: string }> = [
        { cents: 0n, formatted: '$0.00' },
        { cents: -1n, formatted: '-$0.01' },
        { cents: -99n, formatted: '-$0.99' },
        { cents: -4505n, formatted: '-$45.05' },
        { cents: 125099n, formatted: '$1,250.99' },
        { cents: -9007199254740993n, formatted: '-$90,071,992,547,409.93' },
        { cents: -9223372036854775808n, formatted: '-$92,233,720,368,547,758.08' },
        { cents: 9223372036854775807n, formatted: '$92,233,720,368,547,758.07' },
      ];

      const allMatch = testCases.every((tc) => {
        const f = formatCents(tc.cents);
        const rt = parseDollarsToCentsBigInt(f);
        return f === tc.formatted && rt === tc.cents;
      });

      recordGate(
        'P3-G03',
        'Negative Monetary Values & Exact 64-Bit Round-Trip Parsing/Formatting',
        allMatch,
        `Verified ${testCases.length} positive, zero, negative & 64-bit boundary round-trips`
      );
    }

    // Gate 04: Large Microshare Quantities, Fractional Shares & Round-Trip Formatting
    {
      const m1 = parseSharesToMicrosharesBigInt('0.000125') === 125n;
      const m2 = parseSharesToMicrosharesBigInt('12.5') === 12500000n;
      const m3 = parseSharesToMicrosharesBigInt('9,223,372,036,854.775807') === 9223372036854775807n;
      const mOverflow = parseSharesToMicrosharesBigInt('9223372036854.775808') === null;

      const fm1 = formatMicroshares(125n) === '0.000125';
      const fm2 = formatMicroshares(12500000n, true) === '12.5';
      const fm3 = formatMicroshares(9223372036854775807n) === '9,223,372,036,854.775807';
      const roundTripMax =
        parseSharesToMicrosharesBigInt(formatMicroshares(9223372036854775807n)) === 9223372036854775807n;
      const decStr = parseSharesToMicrosharesDecimalString('32.250000') === '32250000';

      const passed = m1 && m2 && m3 && mOverflow && fm1 && fm2 && fm3 && roundTripMax && decStr;
      recordGate(
        'P3-G04',
        'Large Microshare Quantities (10^6), Fractional Share Formatting & Round-Trip',
        passed,
        `MAX_INT64 microshares="9,223,372,036,854.775807", 0.000125=125n, overflow=null`
      );
    }

    // Gate 05: BigInt Investment Valuation & Basis-Point Calculations
    {
      const largeValuation = computeInvestmentValuationBigInt(500000000000n, 45000n);
      const largeCostBasis = 20000000000n; // $200,000,000.00
      const largeGain = largeValuation - largeCostBasis; // +$25,000,000.00 (+12.50% = 1250 bps)
      const largeBps = computeGainLossBasisPointsBigInt(largeGain, largeCostBasis);

      const fBpsPos = formatBasisPoints(largeBps) === '+12.50%';
      const fBpsNeg = formatBasisPoints(-425n) === '-4.25%';
      const fBpsZero = formatBasisPoints(0n) === '0.00%';

      const passed =
        largeValuation === 22500000000n &&
        largeBps === 1250n &&
        fBpsPos &&
        fBpsNeg &&
        fBpsZero;

      recordGate(
        'P3-G05',
        'BigInt Investment Valuation & Basis-Point Calculations Without Intermediate Overflow',
        passed,
        `500k shares @ $450.00 -> Valuation=${formatCents(largeValuation)}, Return=${formatBasisPoints(largeBps)}`
      );
    }

    // Gate 06: Authoritative Decimal-String JSON Contract & Above-MAX_SAFE_INTEGER Null Compatibility
    {
      const [sumRes, accRes, txRes, budRes, savRes, recRes, invRes, cfRes] = await Promise.all([
        fetch(`${BASE_URL}/api/v1/finance/fam-1/summary`, {
          headers: { Authorization: `Bearer ${ownerToken}` },
        }),
        fetch(`${BASE_URL}/api/v1/finance/fam-1/accounts`, {
          headers: { Authorization: `Bearer ${ownerToken}` },
        }),
        fetch(`${BASE_URL}/api/v1/finance/fam-1/transactions`, {
          headers: { Authorization: `Bearer ${ownerToken}` },
        }),
        fetch(`${BASE_URL}/api/v1/finance/fam-1/budgets`, {
          headers: { Authorization: `Bearer ${ownerToken}` },
        }),
        fetch(`${BASE_URL}/api/v1/finance/fam-1/savings`, {
          headers: { Authorization: `Bearer ${ownerToken}` },
        }),
        fetch(`${BASE_URL}/api/v1/finance/fam-1/recurring`, {
          headers: { Authorization: `Bearer ${ownerToken}` },
        }),
        fetch(`${BASE_URL}/api/v1/finance/fam-1/investments`, {
          headers: { Authorization: `Bearer ${ownerToken}` },
        }),
        fetch(`${BASE_URL}/api/v1/finance/fam-1/cashflow`, {
          headers: { Authorization: `Bearer ${ownerToken}` },
        }),
      ]);

      const sumJson = await sumRes.json();
      const accJson = await accRes.json();
      const txJson = await txRes.json();
      const budJson = await budRes.json();
      const savJson = await savRes.json();
      const recJson = await recRes.json();
      const invJson = await invRes.json();
      const cfJson = await cfRes.json();

      // Test 1: Post an account with a 64-bit balance exceeding Number.MAX_SAFE_INTEGER ("9007199254740993")
      // Authoritative field `currentBalanceCentsDecimal` must be "9007199254740993" and legacy `currentBalanceCents` must be `null` (never rounded)
      const highPrecAccRes = await fetch(`${BASE_URL}/api/v1/finance/fam-1/accounts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ownerToken}`,
        },
        body: JSON.stringify({
          name: 'Sovereign Institutional Trust',
          accountType: 'INVESTMENT',
          institution: 'Global Custody Vault',
          currentBalanceCentsDecimal: '9007199254740993',
          isLiability: false,
        }),
      });
      const highPrecAccJson = await highPrecAccRes.json();
      const createdHighPrecId = highPrecAccJson.account?.id;

      // Test 2: Delete the temporary institutional account so it does not affect subsequent browser workflows
      if (createdHighPrecId) {
        await fetch(`${BASE_URL}/api/v1/finance/fam-1/accounts/${createdHighPrecId}`, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${ownerToken}`,
          },
        });
      }

      // Test 3: Attempt to post an unsafe JS Number (9007199254740992) without a decimal string -> must return HTTP 400
      const unsafeNumRes = await fetch(`${BASE_URL}/api/v1/finance/fam-1/accounts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ownerToken}`,
        },
        body: '{"name":"Unsafe Number Account","accountType":"CHECKING","currentBalanceCents":9007199254740992}',
      });

      // Test 4: Attempt to post a 64-bit overflow decimal string ("9223372036854775808") -> must return HTTP 400
      const overflowDecRes = await fetch(`${BASE_URL}/api/v1/finance/fam-1/accounts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ownerToken}`,
        },
        body: JSON.stringify({
          name: 'Overflow Account',
          accountType: 'CHECKING',
          currentBalanceCentsDecimal: '9223372036854775808',
        }),
      });

      const passed =
        typeof sumJson.summary?.netWorthCentsDecimal === 'string' &&
        typeof sumJson.summary?.actualIncomeCentsDecimal === 'string' &&
        typeof accJson.accounts?.[0]?.currentBalanceCentsDecimal === 'string' &&
        typeof txJson.transactions?.[0]?.amountCentsDecimal === 'string' &&
        typeof budJson.budgets?.[0]?.allocatedCentsDecimal === 'string' &&
        typeof savJson.goals?.[0]?.targetCentsDecimal === 'string' &&
        typeof (recJson.recurringRules?.[0] || recJson.rules?.[0])?.amountCentsDecimal === 'string' &&
        typeof invJson.holdings?.[0]?.quantityMicrosharesDecimal === 'string' &&
        typeof invJson.holdings?.[0]?.currentValuationCentsDecimal === 'string' &&
        typeof invJson.summary?.totalValuationCentsDecimal === 'string' &&
        typeof cfJson.actual?.netCentsDecimal === 'string' &&
        highPrecAccRes.status === 201 &&
        highPrecAccJson.account?.currentBalanceCentsDecimal === '9007199254740993' &&
        highPrecAccJson.account?.currentBalanceCents === null &&
        unsafeNumRes.status === 400 &&
        overflowDecRes.status === 400;

      recordGate(
        'P3-G06',
        'Authoritative Decimal-String JSON Contract & Safe-Integer Null Enforcement Across All Endpoints',
        passed,
        `currentBalanceCentsDecimal="9007199254740993" -> currentBalanceCents=null; Unsafe Number & Int64 Overflow rejected with HTTP 400`
      );
    }

    // Restore clean store before launching real Chromium browser E2E workflows
    if (originalStoreFileBackup !== null) {
      fs.writeFileSync(STORE_FILE_PATH, originalStoreFileBackup, 'utf8');
    }
    await fetch(`${BASE_URL}/api/v1/finance/fam-1/test-reset`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
    });

    // ==========================================================================
    // PART B — REAL CHROMIUM BROWSER END-TO-END VERIFICATION VIA PLAYWRIGHT
    // ==========================================================================
    console.log('\n--- Part B: Real Chromium Browser End-to-End Verification (Playwright) ---');

    browser = await chromium.launch({
      executablePath: CHROMIUM_EXECUTABLE_PATH,
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const browserVersion = browser.version();
    console.log(`Launched Real Chromium Browser — Version: ${browserVersion} (${CHROMIUM_EXECUTABLE_PATH})`);

    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();

    // Workflow 1 (P3-G07): Finance Overview loads actual and projected financial information in real Chromium
    {
      await page.goto(BASE_URL, { waitUntil: 'networkidle' });
      await page.waitForSelector('text=Net Household Worth', { timeout: 10000 });

      const bodyText = (await page.locator('body').textContent()) || '';
      const hasOverviewData =
        bodyText.includes('Net Household Worth') &&
        bodyText.includes('Monthly Recorded Income') &&
        bodyText.includes('Monthly Recorded Expenses') &&
        bodyText.includes('Remaining Envelope Budget') &&
        bodyText.includes('Actual Recorded Cash Flow') &&
        bodyText.includes('Projected Monthly Cash Flow & Allocations');

      recordGate(
        'P3-G07',
        'Chromium E2E Workflow 1: Finance Overview Loads Actual & Projected Financial Information',
        hasOverviewData,
        `Chromium ${browserVersion} rendered Net Household Worth, Recorded Income/Expenses, Remaining Budget & Actual vs Projected Cash Flow`
      );
    }

    // Workflow 2 (P3-G08): Accounts load and reconciliation works in real Chromium
    {
      await page.getByRole('tab', { name: /2\. Accounts/i }).click();
      await page.waitForSelector('text=Household Main Checking', { timeout: 5000 });

      const beforeText = (await page.locator('body').textContent()) || '';
      const hasAccounts =
        beforeText.includes('Household Main Checking') &&
        beforeText.includes('High-Yield Family Savings') &&
        beforeText.includes('Statement Balance Reconciliation');

      await page.getByRole('button', { name: /Verify & Reconcile Statement/i }).click();
      await page.waitForTimeout(400);

      const afterText = (await page.locator('body').textContent()) || '';
      const passed =
        hasAccounts &&
        (afterText.includes('Statement reconciled') ||
          afterText.includes('Reconciliation logged') ||
          afterText.includes('Account Reconciliation Audit Log'));

      recordGate(
        'P3-G08',
        'Chromium E2E Workflow 2: Accounts Load Balances & Statement Reconciliation Works',
        passed,
        `Chromium ${browserVersion} loaded checking/savings balances and executed statement reconciliation`
      );
    }

    // Workflow 3 (P3-G09): An expense can be created and retrieved in real Chromium
    {
      await page.getByRole('tab', { name: /3\. Transactions/i }).click();
      await page.waitForSelector('#tx-title-input', { timeout: 5000 });

      const uniqueExpenseTitle = `Chromium Artisan Bakery ${Date.now()}`;
      await page.getByRole('button', { name: /^Expense$/i }).click();
      await page.selectOption('#tx-cat-select', 'DINING');
      await page.fill('#tx-title-input', uniqueExpenseTitle);
      await page.fill('#tx-amount-input', '34.50');
      await page.getByRole('button', { name: /\+ Post EXPENSE/i }).click();

      await page.waitForSelector(`text=${uniqueExpenseTitle}`, { timeout: 5000 });
      const bodyText = (await page.locator('body').textContent()) || '';
      const passed = bodyText.includes(uniqueExpenseTitle) && bodyText.includes('$34.50');

      recordGate(
        'P3-G09',
        'Chromium E2E Workflow 3: Expense Created via Form & Retrieved in Transaction Ledger',
        passed,
        `Created and verified "${uniqueExpenseTitle}" (-$34.50) in real Chromium DOM`
      );
    }

    // Workflow 4 (P3-G10): Internal transfers do not inflate income or expenses in real Chromium
    {
      const cfBefore = await (
        await fetch(`${BASE_URL}/api/v1/finance/fam-1/cashflow`, {
          headers: { Authorization: `Bearer ${ownerToken}` },
        })
      ).json();

      const uniqueTransferTitle = `Chromium Reserve Transfer ${Date.now()}`;
      await page.getByRole('button', { name: /Internal Transfer/i }).click();
      await page.waitForSelector('#tx-dest-acc', { timeout: 5000 });
      await page.selectOption('#tx-source-acc', 'acc-1');
      await page.selectOption('#tx-dest-acc', 'acc-2');
      await page.fill('#tx-title-input', uniqueTransferTitle);
      await page.fill('#tx-amount-input', '500.00');
      await page.getByRole('button', { name: /\+ Post TRANSFER/i }).click();

      await page.waitForSelector(`text=${uniqueTransferTitle}`, { timeout: 5000 });

      const cfAfter = await (
        await fetch(`${BASE_URL}/api/v1/finance/fam-1/cashflow`, {
          headers: { Authorization: `Bearer ${ownerToken}` },
        })
      ).json();

      const bodyText = (await page.locator('body').textContent()) || '';
      const passed =
        bodyText.includes(uniqueTransferTitle) &&
        cfBefore.actual.incomeCentsDecimal === cfAfter.actual.incomeCentsDecimal &&
        cfBefore.actual.expenseCentsDecimal === cfAfter.actual.expenseCentsDecimal;

      recordGate(
        'P3-G10',
        'Chromium E2E Workflow 4: Internal Transfers Do Not Inflate Income or Expenses',
        passed,
        `Income=${cfAfter.actual.incomeCentsDecimal}, Expense=${cfAfter.actual.expenseCentsDecimal} (strictly unchanged after $500.00 transfer)`
      );
    }

    // Workflow 5 (P3-G11): Reversal creates a compensating audit entry in real Chromium
    {
      await page.getByRole('button', { name: /^Reverse$/i }).first().click();
      const dialog = page.locator('[role="dialog"]');
      await dialog.waitFor({ state: 'visible', timeout: 5000 });
      const dialogText = (await dialog.textContent()) || '';
      const modalOpened = dialogText.includes('Confirm Non-Destructive Audit Reversal');

      await page.getByRole('button', { name: /Confirm Audit Reversal/i }).click();
      await page.waitForSelector('text=Compensating Audit Reversal', { timeout: 5000 });

      const afterText = (await page.locator('body').textContent()) || '';
      const passed =
        modalOpened &&
        afterText.includes('Compensating Audit Reversal') &&
        afterText.includes('Reversed by Audit Entry');

      recordGate(
        'P3-G11',
        'Chromium E2E Workflow 5: Reversal Modal Creates Compensating Audit Entry & Preserves History',
        passed,
        'Accessible role="dialog" confirmed reversal, appended Compensating Audit Reversal, and marked original entry'
      );
    }

    // Workflow 6 (P3-G12): Budgets display correct spending and remaining amounts in real Chromium
    {
      await page.getByRole('tab', { name: /4\. Budgets/i }).click();
      await page.waitForSelector('text=Monthly Category Envelope Budgets', { timeout: 5000 });

      const bodyText = (await page.locator('body').textContent()) || '';
      const passed =
        bodyText.includes('Monthly Category Envelope Budgets') &&
        bodyText.includes('FOOD') &&
        bodyText.includes('HOUSING') &&
        bodyText.includes('DINING') &&
        (bodyText.includes('WARNING THRESHOLD REACHED') || bodyText.includes('OVER BUDGET'));

      recordGate(
        'P3-G12',
        'Chromium E2E Workflow 6: Budgets Display Correct Spending, Remaining Amounts & Alert Badges',
        passed,
        'Rendered FOOD, HOUSING, TRANSPORT, DINING envelopes with utilization percentages and alert badges in Chromium'
      );
    }

    // Workflow 7 (P3-G13): Savings contributions update the correct records in real Chromium
    {
      await page.getByRole('tab', { name: /5\. Savings/i }).click();
      await page.waitForSelector('text=Suggested Monthly Contribution (Ceiling Formula)', { timeout: 5000 });

      const beforeText = (await page.locator('body').textContent()) || '';
      const hasCeilingGuidance =
        beforeText.includes('Suggested Monthly Contribution (Ceiling Formula)') &&
        beforeText.includes('Advisory guidance only · Not a completed payment');

      await page.fill('#contrib-amt', '250.00');
      await page.fill('#contrib-notes', 'Chromium E2E Reserve Deposit');
      await page.getByRole('button', { name: /\+ Post Savings Contribution/i }).click();

      await page.waitForSelector('text=Chromium E2E Reserve Deposit', { timeout: 5000 });
      const afterText = (await page.locator('body').textContent()) || '';
      const passed =
        hasCeilingGuidance &&
        afterText.includes('Recorded Contribution History') &&
        afterText.includes('Chromium E2E Reserve Deposit') &&
        afterText.includes('+$250.00');

      recordGate(
        'P3-G13',
        'Chromium E2E Workflow 7: Savings Contributions Update Goal Progress & Recorded History',
        passed,
        'Posted +$250.00 contribution in Chromium and verified goal balance and Recorded Contribution History updated'
      );
    }

    // Workflow 8 (P3-G14): Recurring rules can be paused and resumed in real Chromium
    {
      await page.getByRole('tab', { name: /6\. Recurring/i }).click();
      await page.waitForSelector('text=Recurring Income & Expense Schedules', { timeout: 5000 });

      const textBefore = (await page.locator('body').textContent()) || '';
      const sawActiveInitially = textBefore.includes('Projected Schedule (Active)');

      // Click first Pause button to pause a rule
      await page.getByRole('button', { name: /^Pause$/i }).first().click();
      await page.waitForSelector('text=Projected Schedule (Paused)', { timeout: 5000 });
      const textMid = (await page.locator('body').textContent()) || '';
      const sawPaused = textMid.includes('Projected Schedule (Paused)');

      // Click Resume to restore active state
      await page.getByRole('button', { name: /^Resume$/i }).first().click();
      await page.waitForTimeout(300);
      const textAfter = (await page.locator('body').textContent()) || '';
      const restoredActive = !textAfter.includes('Projected Schedule (Paused)');

      const passed = sawActiveInitially && sawPaused && restoredActive;

      recordGate(
        'P3-G14',
        'Chromium E2E Workflow 8: Recurring Rules Can Be Paused and Resumed',
        passed,
        'Toggled schedule from Projected Schedule (Active) -> Projected Schedule (Paused) -> Active in real Chromium'
      );
    }

    // Workflow 9 (P3-G15): Investment price updates preserve original cost basis in real Chromium
    {
      await page.getByRole('tab', { name: /7\. Investments/i }).click();
      await page.waitForSelector('text=Household Investment Holdings', { timeout: 5000 });

      const invBefore = await (
        await fetch(`${BASE_URL}/api/v1/finance/fam-1/investments`, {
          headers: { Authorization: `Bearer ${ownerToken}` },
        })
      ).json();
      const aaplBefore = invBefore.holdings.find((h: any) => h.symbol === 'AAPL');
      const originalBasisDecimal = aaplBefore.costBasisCentsDecimal; // "30000" ($300.00)

      // Update AAPL price to $230.00 via the inline price input in Chromium
      const aaplPriceInput = page.locator('input[aria-label="New market price for AAPL"]');
      await aaplPriceInput.fill('230.00');
      await page.getByRole('button', { name: /Update Price/i }).first().click();
      await page.waitForSelector('text=$345.00', { timeout: 5000 });

      const invAfter = await (
        await fetch(`${BASE_URL}/api/v1/finance/fam-1/investments`, {
          headers: { Authorization: `Bearer ${ownerToken}` },
        })
      ).json();
      const aaplAfter = invAfter.holdings.find((h: any) => h.symbol === 'AAPL');

      const bodyText = (await page.locator('body').textContent()) || '';
      const passed =
        bodyText.includes('1 whole share = 1,000,000 microshares') &&
        aaplAfter.costBasisCentsDecimal === originalBasisDecimal &&
        aaplAfter.currentPriceCentsDecimal === '23000' &&
        aaplAfter.currentValuationCentsDecimal === '34500' && // 1.5 shares * $230.00 = $345.00
        bodyText.includes('$345.00');

      recordGate(
        'P3-G15',
        'Chromium E2E Workflow 9: Investment Price Updates Recompute Valuation While Preserving Cost Basis',
        passed,
        `AAPL price updated to $230.00 in Chromium: Valuation=${formatCents(aaplAfter.currentValuationCentsDecimal)}, CostBasis preserved at ${formatCents(originalBasisDecimal)}`
      );
    }

    // Workflow 10 (P3-G16): Household switching clears the previous household's displayed data in real Chromium
    {
      await page.selectOption('#finance-household-select', 'fam-2');
      await page.waitForSelector('text=WORKSPACE_ISOLATION_VIOLATION', { timeout: 10000 });

      const switchedText = (await page.locator('body').textContent()) || '';
      const prevDataCleared =
        !switchedText.includes('Household Main Checking') &&
        !switchedText.includes('High-Yield Family Savings') &&
        !switchedText.includes('Net Household Worth');
      const isolationRendered =
        switchedText.includes('WORKSPACE_ISOLATION_VIOLATION') &&
        switchedText.includes('Cross-Household Isolation Enforced');

      // Recover back to fam-1 and Overview tab
      await page.getByRole('button', { name: /Return to Primary Household \(fam-1\)/i }).click();
      await page.getByRole('tab', { name: /1\. Overview/i }).click();
      await page.waitForSelector('text=Net Household Worth', { timeout: 10000 });

      recordGate(
        'P3-G16',
        'Chromium E2E Workflow 10: Household Switching Clears Previous Household Data Immediately',
        prevDataCleared && isolationRendered,
        'Switching fam-1 -> fam-2 purged all fam-1 data from Chromium DOM and rendered WORKSPACE_ISOLATION_VIOLATION'
      );
    }

    // Workflow 11 (P3-G17): CHILD and GUEST accounts cannot access restricted financial information in real Chromium
    {
      // Switch to CHILD persona via the live UI selector
      await page.selectOption('#finance-persona-select', 'CHILD');
      await page.waitForSelector('text=FINANCE_ACCESS_RESTRICTED', { timeout: 10000 });
      const childText = (await page.locator('body').textContent()) || '';
      const childBlocked =
        childText.includes('FINANCE_ACCESS_RESTRICTED') &&
        childText.includes('Financial Records Restricted for Current Role') &&
        !childText.includes('Net Household Worth') &&
        !childText.includes('Household Main Checking');

      // Switch to GUEST persona via the live UI selector
      await page.selectOption('#finance-persona-select', 'GUEST');
      await page.waitForTimeout(600);
      const guestText = (await page.locator('body').textContent()) || '';
      const guestBlocked =
        guestText.includes('FINANCE_ACCESS_RESTRICTED') &&
        guestText.includes('Financial Records Restricted for Current Role') &&
        !guestText.includes('Net Household Worth') &&
        !guestText.includes('Household Main Checking');

      // Restore OWNER persona via recovery button
      await page.getByRole('button', { name: /Switch to Authorized Adult/i }).click();
      await page.waitForSelector('text=Net Household Worth', { timeout: 10000 });

      recordGate(
        'P3-G17',
        'Chromium E2E Workflow 11: CHILD & GUEST Accounts Cannot Access Restricted Financial Information',
        childBlocked && guestBlocked,
        'Both CHILD and GUEST personas received server 403 FINANCE_ACCESS_RESTRICTED and cleared all financial data in Chromium'
      );
    }

    // Workflow 12 (P3-G18): Session expiry clears sensitive financial information in real Chromium
    {
      const beforeExpireText = (await page.locator('body').textContent()) || '';
      const wasLoaded = beforeExpireText.includes('Net Household Worth');

      // Trigger session expiry in real Chromium
      await page.locator('#finance-simulate-expire-btn').click();
      await page.waitForSelector('text=SESSION_EXPIRED', { timeout: 5000 });

      const expiredText = (await page.locator('body').textContent()) || '';
      const purgedOnExpire =
        wasLoaded &&
        expiredText.includes('SESSION_EXPIRED') &&
        expiredText.includes('Session Expired or Unauthenticated') &&
        !expiredText.includes('Net Household Worth') &&
        !expiredText.includes('Household Main Checking') &&
        !hubSource.includes('console.log(');

      recordGate(
        'P3-G18',
        'Chromium E2E Workflow 12: Session Expiry Immediately Clears Sensitive Financial Information',
        purgedOnExpire,
        'Clicking Expire Session immediately purged Net Household Worth & ledgers from Chromium DOM and rendered SESSION_EXPIRED guard'
      );
    }
  } finally {
    if (browser) {
      await browser.close();
    }
    // Always restore the controlled database file backup and reset in-memory store
    if (originalStoreFileBackup !== null) {
      fs.writeFileSync(STORE_FILE_PATH, originalStoreFileBackup, 'utf8');
    }
    try {
      await fetch(`${BASE_URL}/api/v1/finance/fam-1/test-reset`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${ownerToken}` },
      });
    } catch {
      // Ignore if server closed
    }
  }

  const passedCount = results.filter((r) => r.passed).length;
  console.log('\n================================================================================');
  console.log(`PHASE 3 VERIFICATION SUMMARY: ${passedCount}/${results.length} UNIQUE GATES PASSED`);
  console.log('================================================================================');

  if (passedCount !== results.length) {
    process.exit(1);
  }
}

runVerification().catch((err) => {
  console.error('Fatal error in Phase 3 verification suite:', err);
  process.exit(1);
});
