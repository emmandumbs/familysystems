import type {
  SharedAccount,
  SharedBudget,
  SharedTransaction,
  SharedFinancialEntry,
} from './backupAndMigration';
import type {
  SavingsGoal,
  RecurringRule,
  InvestmentHolding,
} from './financeData';
import {
  isValidSigned64BigInt,
  parseSigned64BigInt,
  serializeBigIntToDecimalString,
  toSafeNumberOrNull,
  MAX_SAFE_INTEGER_BIGINT,
  MIN_SAFE_INTEGER_BIGINT,
} from '../utils/financeFormatting';

/**
 * FAMILYOS AUTHORITATIVE SERVER-SIDE FINANCIAL CALCULATION ENGINE
 * ===============================================================
 * Rounding & Precision Policy:
 * 1. All monetary values are stored and calculated as signed 64-bit integer cents (`BigInt`).
 * 2. Floating-point arithmetic (`parseFloat`, `Math.round(val * 100)`, `.toFixed(2)`) is strictly
 *    prohibited for authoritative money calculations.
 * 3. Investment holding valuation uses exact integer division on microshares (`10^6` microshares = 1 share):
 *    `valuationCents = (quantityMicroshares * currentPriceCents) / 1_000_000n`.
 * 4. Budget utilization percentage uses integer floor division:
 *    `utilizationPercentage = Number((spentBig * 100n) / allocatedBig)`.
 * 5. Savings required monthly contribution uses integer ceiling division so targets are always met:
 *    `requiredMonthlyContribution = (remainingBig + monthsRemainingBig - 1n) / monthsRemainingBig`.
 * 6. Recurring monthly equivalence uses exact integer arithmetic:
 *    - DAILY:     `(amount * 365n) / 12n`
 *    - WEEKLY:    `(amount * 52n) / 12n`
 *    - BIWEEKLY:  `(amount * 26n) / 12n`
 *    - MONTHLY:   `amount`
 *    - QUARTERLY: `amount / 3n`
 *    - ANNUAL:    `amount / 12n`
 */

export function readEntityBigInt(
  entity: any,
  numericKey: string,
  decimalKey = `${numericKey}Decimal`
): bigint {
  if (!entity) return 0n;
  const decVal = entity[decimalKey];
  const numVal = entity[numericKey];
  if (typeof decVal === 'string') {
    const parsedDec = parseSigned64BigInt(decVal);
    if (parsedDec !== null) {
      if (
        typeof numVal === 'number' &&
        Number.isSafeInteger(numVal) &&
        parsedDec >= MIN_SAFE_INTEGER_BIGINT &&
        parsedDec <= MAX_SAFE_INTEGER_BIGINT &&
        BigInt(numVal) !== parsedDec
      ) {
        return BigInt(numVal);
      }
      return parsedDec;
    }
  }
  return parseSigned64BigInt(numVal) ?? 0n;
}

export function writeEntityBigInt(
  entity: any,
  numericKey: string,
  valBig: bigint,
  decimalKey = `${numericKey}Decimal`
): void {
  if (!isValidSigned64BigInt(valBig)) {
    throw new RangeError(`Financial field "${numericKey}" overflowed signed 64-bit integer range.`);
  }
  entity[decimalKey] = serializeBigIntToDecimalString(valBig);
  entity[numericKey] = toSafeNumberOrNull(valBig);
}

/**
 * Parses a decimal dollar string (e.g. "125.50") or integer cents into exact 64-bit BigInt cents
 * without any floating-point math.
 */
export function parseUserMoneyToCentsBigInt(
  input: string | number | bigint,
  options: { isDecimalDollars?: boolean; fieldName?: string } = {}
): bigint {
  const { isDecimalDollars = false, fieldName = 'amount' } = options;
  if (typeof input === 'bigint') {
    if (!isValidSigned64BigInt(input)) throw new RangeError(`${fieldName} exceeds 64-bit bounds`);
    return input;
  }

  if (!isDecimalDollars && typeof input === 'number' && Number.isSafeInteger(input)) {
    return BigInt(input);
  }

  const raw = String(input ?? '').trim().replace(/,/g, '');
  if (!raw) throw new Error(`${fieldName} is required`);

  if (!isDecimalDollars && /^[+-]?\d+$/.test(raw)) {
    const parsed = parseSigned64BigInt(raw);
    if (parsed === null) throw new RangeError(`${fieldName} exceeds 64-bit bounds`);
    return parsed;
  }

  const match = raw.match(/^([+-]?)(\d+)(?:\.(\d{1,2}))?$/);
  if (!match) {
    throw new Error(`${fieldName} must be a valid monetary value with at most 2 decimal places`);
  }
  const sign = match[1] === '-' ? -1n : 1n;
  const whole = BigInt(match[2]) * 100n;
  const frac = BigInt((match[3] || '').padEnd(2, '0'));
  const total = sign * (whole + frac);
  if (!isValidSigned64BigInt(total)) {
    throw new RangeError(`${fieldName} exceeds signed 64-bit integer range`);
  }
  return total;
}

// ============================================================================
// 1. NET WORTH CALCULATION (SINGLE-COUNTED INVESTMENTS)
// ============================================================================
export interface AuthoritativeNetWorthResult {
  cashAndCheckingCentsBig: bigint;
  savingsAccountsCentsBig: bigint;
  availableCashCentsBig: bigint;
  nonInvestmentAssetsCentsBig: bigint;
  standaloneInvestmentAccountsCentsBig: bigint;
  investmentHoldingsValuationCentsBig: bigint;
  investmentHoldingsCentsBig: bigint;
  totalInvestmentCentsBig: bigint;
  totalAssetsCentsBig: bigint;
  creditCardDebtCentsBig: bigint;
  loansAndMortgagesCentsBig: bigint;
  totalLiabilitiesCentsBig: bigint;
  netWorthCentsBig: bigint;
}

/**
 * Authoritative Net Worth calculation shared by Home Dashboards and Finance Hub:
 * - `nonInvestmentAssets` = sum of active non-liability accounts where `accountType !== 'INVESTMENT'`.
 * - `investmentHoldingsValuation` = sum of `(quantityMicroshares * currentPriceCents) / 1_000_000n`
 *   for all non-deleted `InvestmentHolding` records.
 * - Single-counts investments: if an `INVESTMENT` account has `InvestmentHolding` records linked to it,
 *   only the holdings are counted (preventing double-counting).
 */
export function computeAuthoritativeNetWorth(
  accounts: SharedAccount[],
  holdings: InvestmentHolding[]
): AuthoritativeNetWorthResult {
  const activeAccounts = (accounts || []).filter((a) => !(a as any).isArchived && !(a as any).isDeleted);
  const activeHoldings = (holdings || []).filter((h) => !h.isDeleted);

  let cashAndCheckingBig = 0n;
  let savingsAccountsBig = 0n;
  let otherNonInvestmentAssetsBig = 0n;
  let creditCardDebtBig = 0n;
  let loansAndMortgagesBig = 0n;

  for (const acc of activeAccounts) {
    const balBig = readEntityBigInt(acc, 'currentBalanceCents');
    const typeUpper = String(acc.accountType || (acc as any).type || 'CHECKING').toUpperCase();
    const isLiab =
      Boolean(acc.isLiability) ||
      typeUpper === 'CREDIT_CARD' ||
      typeUpper === 'LOAN' ||
      typeUpper === 'MORTGAGE';

    if (isLiab) {
      const absLiab = balBig < 0n ? -balBig : balBig;
      if (typeUpper === 'CREDIT_CARD') {
        creditCardDebtBig += absLiab;
      } else {
        loansAndMortgagesBig += absLiab;
      }
    } else if (typeUpper === 'INVESTMENT') {
      // Handled below to prevent double counting with holdings
    } else if (typeUpper === 'CHECKING' || typeUpper === 'CASH') {
      cashAndCheckingBig += balBig;
    } else if (typeUpper === 'SAVINGS') {
      savingsAccountsBig += balBig;
    } else {
      otherNonInvestmentAssetsBig += balBig;
    }
  }

  let holdingsValuationBig = 0n;
  const accountsWithHoldings = new Set<string>();
  for (const h of activeHoldings) {
    if (h.accountId) {
      accountsWithHoldings.add(h.accountId);
    }
    const qBig = readEntityBigInt(h, 'quantityMicroshares');
    const pBig = readEntityBigInt(h, 'currentPriceCents');
    if (qBig > 0n && pBig > 0n) {
      holdingsValuationBig += (qBig * pBig) / 1000000n;
    } else {
      holdingsValuationBig += readEntityBigInt(h, 'currentValuationCents');
    }
  }

  let standaloneInvestmentAccountsBig = 0n;
  for (const acc of activeAccounts) {
    const typeUpper = String(acc.accountType || (acc as any).type || '').toUpperCase();
    if (typeUpper === 'INVESTMENT' && !acc.isLiability) {
      if (!accountsWithHoldings.has(acc.id)) {
        const balBig = readEntityBigInt(acc, 'currentBalanceCents');
        if (balBig > 0n) {
          standaloneInvestmentAccountsBig += balBig;
        }
      }
    }
  }

  const availableCashBig = cashAndCheckingBig + savingsAccountsBig;
  const nonInvestmentAssetsBig = availableCashBig + otherNonInvestmentAssetsBig;
  const totalInvestmentBig = holdingsValuationBig + standaloneInvestmentAccountsBig;
  const totalAssetsBig = nonInvestmentAssetsBig + totalInvestmentBig;
  const totalLiabilitiesBig = creditCardDebtBig + loansAndMortgagesBig;
  const netWorthBig = nonInvestmentAssetsBig + totalInvestmentBig - totalLiabilitiesBig;

  return {
    cashAndCheckingCentsBig: cashAndCheckingBig,
    savingsAccountsCentsBig: savingsAccountsBig,
    availableCashCentsBig: availableCashBig,
    nonInvestmentAssetsCentsBig: nonInvestmentAssetsBig,
    standaloneInvestmentAccountsCentsBig: standaloneInvestmentAccountsBig,
    investmentHoldingsValuationCentsBig: holdingsValuationBig,
    investmentHoldingsCentsBig: totalInvestmentBig,
    totalInvestmentCentsBig: totalInvestmentBig,
    totalAssetsCentsBig: totalAssetsBig,
    creditCardDebtCentsBig: creditCardDebtBig,
    loansAndMortgagesCentsBig: loansAndMortgagesBig,
    totalLiabilitiesCentsBig: totalLiabilitiesBig,
    netWorthCentsBig: netWorthBig,
  };
}

// ============================================================================
// 2. TIMEZONE & CALENDAR BOUNDARY HELPERS
// ============================================================================
export function getZonedDateParts(
  epochMs: number,
  timezone = 'UTC'
): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
} {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    const parts = formatter.formatToParts(new Date(epochMs));
    const map: Record<string, number> = {};
    for (const part of parts) {
      if (part.type !== 'literal') {
        map[part.type] = Number(part.value);
      }
    }
    return {
      year: map.year,
      month: map.month,
      day: map.day,
      hour: map.hour === 24 ? 0 : map.hour,
      minute: map.minute,
      second: map.second,
    };
  } catch {
    const d = new Date(epochMs);
    return {
      year: d.getUTCFullYear(),
      month: d.getUTCMonth() + 1,
      day: d.getUTCDate(),
      hour: d.getUTCHours(),
      minute: d.getUTCMinutes(),
      second: d.getUTCSeconds(),
    };
  }
}

export function zonedMidnightToEpochMs(
  year: number,
  month: number,
  day: number,
  timezone = 'UTC'
): number {
  const approxUtc = Date.UTC(year, month - 1, day, 0, 0, 0, 0);
  const parts = getZonedDateParts(approxUtc, timezone);
  const zonedAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
    0
  );
  const offsetMs = zonedAsUtc - approxUtc;
  const firstGuess = approxUtc - offsetMs;
  const parts2 = getZonedDateParts(firstGuess, timezone);
  const zonedAsUtc2 = Date.UTC(
    parts2.year,
    parts2.month - 1,
    parts2.day,
    parts2.hour,
    parts2.minute,
    parts2.second,
    0
  );
  const offsetMs2 = zonedAsUtc2 - firstGuess;
  return approxUtc - offsetMs2;
}

export function getDaysInMonth(year: number, month1To12: number): number {
  return new Date(Date.UTC(year, month1To12, 0)).getUTCDate();
}

export function addCalendarMonthsClamped(
  anchorYear: number,
  anchorMonth: number,
  anchorDay: number,
  monthsToAdd: number
): { year: number; month: number; day: number } {
  const totalMonths = anchorYear * 12 + (anchorMonth - 1) + monthsToAdd;
  const targetYear = Math.floor(totalMonths / 12);
  const targetMonth = (totalMonths % 12) + 1;
  const maxDay = getDaysInMonth(targetYear, targetMonth);
  const targetDay = Math.min(anchorDay, maxDay);
  return { year: targetYear, month: targetMonth, day: targetDay };
}

export interface MonthWindowOptions {
  referenceEpochMs?: number;
  year?: number;
  month?: number; // 1..12
  timezone?: string;
}

export function getMonthWindow(
  optionsOrYear: MonthWindowOptions | number = {},
  maybeMonth?: number,
  maybeTimezone?: string
): {
  startEpoch: number;
  endEpoch: number;
  timezone: string;
  year: number;
  month: number;
} {
  const options: MonthWindowOptions =
    typeof optionsOrYear === 'number'
      ? {
          year: optionsOrYear,
          month: maybeMonth,
          timezone: maybeTimezone,
        }
      : optionsOrYear;
  const timezone = options.timezone || 'UTC';
  const refParts = getZonedDateParts(options.referenceEpochMs ?? Date.now(), timezone);
  const year = options.year ?? refParts.year;
  const month = options.month ?? refParts.month;

  const startEpoch = zonedMidnightToEpochMs(year, month, 1, timezone);
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const endEpoch = zonedMidnightToEpochMs(nextYear, nextMonth, 1, timezone);

  return { startEpoch, endEpoch, timezone, year, month };
}

// ============================================================================
// 3. ACTUAL CASH FLOW (DATE-SCOPED & REVERSAL-SAFE)
// ============================================================================
export interface ActualCashFlowSummaryResult {
  startEpoch: number;
  endEpoch: number;
  timezone: string;
  periodIncomeBig: bigint;
  periodExpenseBig: bigint;
  periodNetBig: bigint;
  incomeCentsBig: bigint;
  expenseCentsBig: bigint;
  netCashFlowCentsBig: bigint;
  lifetimeIncomeBig: bigint;
  lifetimeExpenseBig: bigint;
  lifetimeNetBig: bigint;
  totalLedgerIncomeCentsBig: bigint;
  totalLedgerExpenseCentsBig: bigint;
  periodExpenseByCategoryBig: Map<string, bigint>;
  lifetimeExpenseByCategoryBig: Map<string, bigint>;
}

/**
 * Computes actual cash flow from `SharedTransaction[]`:
 * - Uses `transactionDate` within `[startEpoch, endEpoch)` (inclusive start, exclusive end) for
 *   the selected period, and also computes lifetime ledger totals separately.
 * - Excludes `TRANSFER` transactions from both income and expense.
 * - Links reversals (`isReversal && reversalOfId`) to their original transaction and ensures
 *   each reversal is counted at most once per original transaction.
 * - When a reversal occurs in the period (or its linked original transaction is in the period),
 *   the reversed amount is subtracted cleanly.
 */
export function computeAuthoritativeCashFlow(
  transactions: SharedTransaction[],
  options: {
    startEpoch?: number;
    endEpoch?: number;
    timezone?: string;
    referenceEpochMs?: number;
  } = {}
): ActualCashFlowSummaryResult {
  const window =
    options.startEpoch !== undefined && options.endEpoch !== undefined
      ? {
          startEpoch: options.startEpoch,
          endEpoch: options.endEpoch,
          timezone: options.timezone || 'UTC',
        }
      : getMonthWindow({
          referenceEpochMs: options.referenceEpochMs,
          timezone: options.timezone,
        });

  const activeTxs = (transactions || []).filter((t) => !(t as any).isDeleted);
  const originalById = new Map<string, SharedTransaction>();
  for (const tx of activeTxs) {
    if (!tx.isReversal) {
      originalById.set(tx.id, tx);
    }
  }

  // Deduplicate reversals so a single original transaction can only be reversed once
  const seenReversalForOriginal = new Set<string>();
  const validTxs: SharedTransaction[] = [];
  for (const tx of activeTxs) {
    if (tx.isReversal) {
      if (tx.reversalOfId) {
        if (!originalById.has(tx.reversalOfId)) {
          continue; // Orphan reversal without matching original transaction
        }
        if (seenReversalForOriginal.has(tx.reversalOfId)) {
          continue; // Duplicate reversal for the same original transaction
        }
        seenReversalForOriginal.add(tx.reversalOfId);
      }
    }
    validTxs.push(tx);
  }

  let periodIncomeBig = 0n;
  let periodExpenseBig = 0n;
  let lifetimeIncomeBig = 0n;
  let lifetimeExpenseBig = 0n;
  const periodExpenseByCategoryBig = new Map<string, bigint>();
  const lifetimeExpenseByCategoryBig = new Map<string, bigint>();

  for (const tx of validTxs) {
    const txType = String(tx.transactionType || (tx as any).type || '').toUpperCase();
    if (txType === 'TRANSFER') continue;

    const amtBig = readEntityBigInt(tx, 'amountCents');
    const absAmt = amtBig < 0n ? -amtBig : amtBig;
    const catKey = String(tx.category || 'GENERAL').toUpperCase();

    const effectiveDate =
      tx.isReversal && tx.reversalOfId && originalById.has(tx.reversalOfId)
        ? Number(originalById.get(tx.reversalOfId)!.transactionDate)
        : Number(tx.transactionDate || (tx as any).timestamp || 0);

    const inPeriod = effectiveDate >= window.startEpoch && effectiveDate < window.endEpoch;

    if (txType === 'INCOME') {
      if (tx.isReversal) {
        lifetimeIncomeBig -= absAmt;
        if (inPeriod) periodIncomeBig -= absAmt;
      } else {
        lifetimeIncomeBig += absAmt;
        if (inPeriod) periodIncomeBig += absAmt;
      }
    } else if (txType === 'EXPENSE') {
      const prevLife = lifetimeExpenseByCategoryBig.get(catKey) || 0n;
      if (tx.isReversal) {
        lifetimeExpenseBig -= absAmt;
        lifetimeExpenseByCategoryBig.set(catKey, prevLife > absAmt ? prevLife - absAmt : 0n);
        if (inPeriod) {
          periodExpenseBig -= absAmt;
          const prevPer = periodExpenseByCategoryBig.get(catKey) || 0n;
          periodExpenseByCategoryBig.set(catKey, prevPer > absAmt ? prevPer - absAmt : 0n);
        }
      } else {
        lifetimeExpenseBig += absAmt;
        lifetimeExpenseByCategoryBig.set(catKey, prevLife + absAmt);
        if (inPeriod) {
          periodExpenseBig += absAmt;
          const prevPer = periodExpenseByCategoryBig.get(catKey) || 0n;
          periodExpenseByCategoryBig.set(catKey, prevPer + absAmt);
        }
      }
    }
  }

  const periodNetBig = periodIncomeBig - periodExpenseBig;
  const lifetimeNetBig = lifetimeIncomeBig - lifetimeExpenseBig;

  return {
    startEpoch: window.startEpoch,
    endEpoch: window.endEpoch,
    timezone: window.timezone,
    periodIncomeBig,
    periodExpenseBig,
    periodNetBig,
    incomeCentsBig: periodIncomeBig,
    expenseCentsBig: periodExpenseBig,
    netCashFlowCentsBig: periodNetBig,
    lifetimeIncomeBig,
    lifetimeExpenseBig,
    lifetimeNetBig,
    totalLedgerIncomeCentsBig: lifetimeIncomeBig,
    totalLedgerExpenseCentsBig: lifetimeExpenseBig,
    periodExpenseByCategoryBig,
    lifetimeExpenseByCategoryBig,
  };
}

// ============================================================================
// 4. RECURRING FORECAST & NORMALIZATION
// ============================================================================
export function computeRecurringMonthlyEquivalentBigInt(
  amountBig: bigint,
  interval: RecurringRule['recurrenceInterval'] | 'YEARLY'
): bigint {
  switch (interval) {
    case 'DAILY':
      return (amountBig * 365n) / 12n;
    case 'WEEKLY':
      return (amountBig * 52n) / 12n;
    case 'BIWEEKLY':
      return (amountBig * 26n) / 12n;
    case 'MONTHLY':
      return amountBig;
    case 'QUARTERLY':
      return amountBig / 3n;
    case 'ANNUAL':
    case 'YEARLY':
      return amountBig / 12n;
    default:
      return amountBig;
  }
}

export interface RecurringRuleMonthSchedule {
  ruleId: string;
  title: string;
  transactionType: RecurringRule['transactionType'];
  recurrenceInterval: RecurringRule['recurrenceInterval'];
  rawAmountCentsBig: bigint;
  amountCentsBig: bigint;
  averageMonthlyEquivalentCentsBig: bigint;
  scheduledOccurrencesInMonth: number;
  occurrencesInTargetMonth: number;
  scheduledInMonthTotalCentsBig: bigint;
  occurrenceTimestamps: number[];
  scheduledDatesInMonth: number[];
}

export function normalizeRecurringRuleForMonth(
  rule: RecurringRule,
  options: {
    year?: number;
    month?: number; // 1..12
    timezone?: string;
    referenceEpochMs?: number;
  } = {}
): RecurringRuleMonthSchedule {
  const timezone = options.timezone || 'UTC';
  const window = getMonthWindow({
    year: options.year,
    month: options.month,
    timezone,
    referenceEpochMs: options.referenceEpochMs,
  });

  const rawAmountBig = readEntityBigInt(rule, 'amountCents');
  if (!rule.isActive) {
    return {
      ruleId: rule.id,
      title: rule.title || '',
      transactionType: rule.transactionType,
      recurrenceInterval: rule.recurrenceInterval,
      rawAmountCentsBig: rawAmountBig,
      amountCentsBig: rawAmountBig,
      averageMonthlyEquivalentCentsBig: 0n,
      scheduledOccurrencesInMonth: 0,
      occurrencesInTargetMonth: 0,
      scheduledInMonthTotalCentsBig: 0n,
      occurrenceTimestamps: [],
      scheduledDatesInMonth: [],
    };
  }

  const avgMonthlyBig = computeRecurringMonthlyEquivalentBigInt(
    rawAmountBig,
    rule.recurrenceInterval
  );
  const anchorParts = getZonedDateParts(rule.nextDueDate, timezone);
  const occurrences: number[] = [];

  if (rule.recurrenceInterval === 'DAILY') {
    const daysCount = getDaysInMonth(window.year, window.month);
    for (let d = 1; d <= daysCount; d++) {
      const ts = zonedMidnightToEpochMs(window.year, window.month, d, timezone);
      if (ts >= window.startEpoch && ts < window.endEpoch) {
        occurrences.push(ts);
      }
    }
  } else if (rule.recurrenceInterval === 'WEEKLY' || rule.recurrenceInterval === 'BIWEEKLY') {
    const stepDays = rule.recurrenceInterval === 'WEEKLY' ? 7 : 14;
    const stepMs = stepDays * 86400000;
    const anchorMidnight = zonedMidnightToEpochMs(
      anchorParts.year,
      anchorParts.month,
      anchorParts.day,
      timezone
    );

    let current = anchorMidnight;
    if (current < window.startEpoch) {
      const steps = Math.floor((window.startEpoch - current) / stepMs);
      current += steps * stepMs;
      while (current < window.startEpoch) current += stepMs;
    } else if (current >= window.endEpoch) {
      const steps = Math.ceil((current - window.startEpoch) / stepMs);
      current -= steps * stepMs;
      while (current < window.startEpoch) current += stepMs;
    }

    while (current < window.endEpoch) {
      occurrences.push(current);
      current += stepMs;
    }
  } else if (
    rule.recurrenceInterval === 'MONTHLY' ||
    rule.recurrenceInterval === 'QUARTERLY' ||
    rule.recurrenceInterval === 'ANNUAL'
  ) {
    const stepMonths =
      rule.recurrenceInterval === 'MONTHLY'
        ? 1
        : rule.recurrenceInterval === 'QUARTERLY'
        ? 3
        : 12;
    const monthsDiff =
      (window.year - anchorParts.year) * 12 + (window.month - anchorParts.month);
    if (monthsDiff % stepMonths === 0) {
      const clamped = addCalendarMonthsClamped(
        anchorParts.year,
        anchorParts.month,
        anchorParts.day,
        monthsDiff
      );
      const ts = zonedMidnightToEpochMs(clamped.year, clamped.month, clamped.day, timezone);
      if (ts >= window.startEpoch && ts < window.endEpoch) {
        occurrences.push(ts);
      }
    }
  }

  return {
    ruleId: rule.id,
    title: rule.title || '',
    transactionType: rule.transactionType,
    recurrenceInterval: rule.recurrenceInterval,
    rawAmountCentsBig: rawAmountBig,
    amountCentsBig: rawAmountBig,
    averageMonthlyEquivalentCentsBig: avgMonthlyBig,
    scheduledOccurrencesInMonth: occurrences.length,
    occurrencesInTargetMonth: occurrences.length,
    scheduledInMonthTotalCentsBig: rawAmountBig * BigInt(occurrences.length),
    occurrenceTimestamps: occurrences,
    scheduledDatesInMonth: occurrences,
  };
}

export interface RecurringForecastResult {
  targetYear: number;
  targetMonth: number;
  averageMonthlyIncomeBig: bigint;
  averageMonthlyExpenseBig: bigint;
  averageMonthlyNetBig: bigint;
  averageMonthlyIncomeCentsBig: bigint;
  averageMonthlyExpenseCentsBig: bigint;
  averageMonthlyNetCentsBig: bigint;
  scheduledMonthIncomeBig: bigint;
  scheduledMonthExpenseBig: bigint;
  scheduledMonthNetBig: bigint;
  scheduledMonthIncomeCentsBig: bigint;
  scheduledMonthExpenseCentsBig: bigint;
  scheduledMonthNetCentsBig: bigint;
  schedules: RecurringRuleMonthSchedule[];
  rules: RecurringRuleMonthSchedule[];
}

export function computeAuthoritativeRecurringForecast(
  rules: RecurringRule[],
  options: {
    year?: number;
    month?: number;
    timezone?: string;
    referenceEpochMs?: number;
  } = {}
): RecurringForecastResult {
  const window = getMonthWindow(options);
  let avgIncomeBig = 0n;
  let avgExpenseBig = 0n;
  let schedIncomeBig = 0n;
  let schedExpenseBig = 0n;
  const schedules: RecurringRuleMonthSchedule[] = [];

  for (const r of rules || []) {
    if (!r.isActive) continue;
    const sched = normalizeRecurringRuleForMonth(r, options);
    schedules.push(sched);
    if (r.transactionType === 'INCOME') {
      avgIncomeBig += sched.averageMonthlyEquivalentCentsBig;
      schedIncomeBig += sched.scheduledInMonthTotalCentsBig;
    } else {
      avgExpenseBig += sched.averageMonthlyEquivalentCentsBig;
      schedExpenseBig += sched.scheduledInMonthTotalCentsBig;
    }
  }

  const avgNetBig = avgIncomeBig - avgExpenseBig;
  const schedNetBig = schedIncomeBig - schedExpenseBig;

  return {
    targetYear: window.year,
    targetMonth: window.month,
    averageMonthlyIncomeBig: avgIncomeBig,
    averageMonthlyExpenseBig: avgExpenseBig,
    averageMonthlyNetBig: avgNetBig,
    averageMonthlyIncomeCentsBig: avgIncomeBig,
    averageMonthlyExpenseCentsBig: avgExpenseBig,
    averageMonthlyNetCentsBig: avgNetBig,
    scheduledMonthIncomeBig: schedIncomeBig,
    scheduledMonthExpenseBig: schedExpenseBig,
    scheduledMonthNetBig: schedNetBig,
    scheduledMonthIncomeCentsBig: schedIncomeBig,
    scheduledMonthExpenseCentsBig: schedExpenseBig,
    scheduledMonthNetCentsBig: schedNetBig,
    schedules,
    rules: schedules,
  };
}

// ============================================================================
// 5. BUDGET METRICS & THRESHOLD VALIDATION
// ============================================================================
export function validateBudgetAlertThreshold(input: unknown): number {
  const num = Number(input);
  if (!Number.isInteger(num) || num < 1 || num > 100) {
    throw new Error('alertThresholdPercentage must be an integer between 1 and 100.');
  }
  return num;
}

/**
 * Authoritative Budget status calculation:
 * - `remaining = allocated - spent`
 * - `utilization = floor(spent * 100 / allocated)`
 * - `OVER_BUDGET` if `spent >= allocated`
 * - `WARNING` if `spent < allocated && utilization >= alertThresholdPercentage`
 *   (Strictly respects `alertThresholdPercentage` — removes the hardcoded `>= 80` bug!)
 */
export function computeAuthoritativeBudgetStatusBigInt(
  allocBig: bigint,
  spentBig: bigint,
  alertThresholdPercentage = 85
): {
  status: 'NORMAL' | 'WARNING' | 'OVER_BUDGET';
  spentPercentage: number;
  utilizationPercentage: number;
  remainingBig: bigint;
  remainingCentsBig: bigint;
  overBudgetBig: bigint;
} {
  const safeSpent = spentBig < 0n ? 0n : spentBig;
  const remainingBig = allocBig - safeSpent;
  const overBudgetBig = safeSpent > allocBig ? safeSpent - allocBig : 0n;
  const threshold =
    typeof alertThresholdPercentage === 'number' &&
    alertThresholdPercentage >= 1 &&
    alertThresholdPercentage <= 100
      ? Math.trunc(alertThresholdPercentage)
      : 85;

  if (allocBig <= 0n) {
    const pct = safeSpent > 0n ? 100 : 0;
    return {
      status: safeSpent > 0n ? 'OVER_BUDGET' : 'NORMAL',
      spentPercentage: pct,
      utilizationPercentage: pct,
      remainingBig,
      remainingCentsBig: remainingBig,
      overBudgetBig,
    };
  }

  const spentPercentage = Number((safeSpent * 100n) / allocBig);
  let status: 'NORMAL' | 'WARNING' | 'OVER_BUDGET' = 'NORMAL';
  if (safeSpent >= allocBig) {
    status = 'OVER_BUDGET';
  } else if (spentPercentage >= threshold) {
    status = 'WARNING';
  }

  return {
    status,
    spentPercentage,
    utilizationPercentage: spentPercentage,
    remainingBig,
    remainingCentsBig: remainingBig,
    overBudgetBig,
  };
}

// ============================================================================
// 6. SAVINGS GOALS (CEILING INTEGER DIVISION & AFFORDABILITY SEPARATION)
// ============================================================================
export function computeAuthoritativeSuggestedMonthlyContributionBigInt(
  targetBig: bigint,
  currentBig: bigint,
  targetDate?: number | null,
  nowMs: number = Date.now()
): bigint {
  const remainingBig = targetBig > currentBig ? targetBig - currentBig : 0n;
  if (remainingBig === 0n) return 0n;
  if (!targetDate || targetDate <= nowMs) return remainingBig;

  const msRemainingBig = BigInt(Math.max(1, Math.trunc(targetDate) - Math.trunc(nowMs)));
  // Exact integer milliseconds in an average Gregorian month (30.4375 days * 86,400,000 ms/day = 2,629,800,000 ms)
  const AVG_MONTH_MS_BIG = 2629800000n;
  const rawMonthsBig = (msRemainingBig + AVG_MONTH_MS_BIG - 1n) / AVG_MONTH_MS_BIG;
  const monthsRemaining = rawMonthsBig > 0n ? rawMonthsBig : 1n;
  // Ceiling integer division in BigInt: (remainingBig + monthsRemaining - 1n) / monthsRemaining
  return (remainingBig + monthsRemaining - 1n) / monthsRemaining;
}

// ============================================================================
// 7. LEDGER-TO-ACCOUNT RECONCILIATION & BALANCE DRIFT RECOVERY
// ============================================================================
export interface AccountReconciliationDriftReport {
  accountId: string;
  familyId: string;
  accountName: string;
  accountType: string;
  recordedBalanceCentsBig: bigint;
  calculatedLedgerBalanceCentsBig: bigint;
  driftCentsBig: bigint;
  hasDrift: boolean;
  corrected: boolean;
}

export function reconcileAccountBalancesFromLedger(
  accounts: SharedAccount[],
  financialEntries: SharedFinancialEntry[],
  familyId?: string
): {
  reconciledAccounts: SharedAccount[];
  driftReports: AccountReconciliationDriftReport[];
  totalDriftCount: number;
} {
  const targetAccounts = (accounts || []).filter(
    (a) => !familyId || a.familyId === familyId
  );
  const targetEntries = (financialEntries || []).filter(
    (e) => !familyId || e.familyId === familyId
  );

  const debitsByAccount = new Map<string, bigint>();
  const creditsByAccount = new Map<string, bigint>();

  for (const entry of targetEntries) {
    const amt = readEntityBigInt(entry, 'amountCents');
    const accId = entry.accountId;
    if (entry.entryType === 'DEBIT') {
      debitsByAccount.set(accId, (debitsByAccount.get(accId) || 0n) + amt);
    } else if (entry.entryType === 'CREDIT') {
      creditsByAccount.set(accId, (creditsByAccount.get(accId) || 0n) + amt);
    }
  }

  const driftReports: AccountReconciliationDriftReport[] = [];
  let totalDriftCount = 0;

  for (const acc of targetAccounts) {
    const recBalBig = readEntityBigInt(acc, 'currentBalanceCents');
    const debitsBig = debitsByAccount.get(acc.id) || 0n;
    const creditsBig = creditsByAccount.get(acc.id) || 0n;

    const typeUpper = String(acc.accountType || 'CHECKING').toUpperCase();
    const isLiab =
      Boolean(acc.isLiability) ||
      typeUpper === 'CREDIT_CARD' ||
      typeUpper === 'LOAN' ||
      typeUpper === 'LIABILITY';

    let calcBalBig = 0n;
    if (isLiab || typeUpper === 'INCOME' || typeUpper === 'EQUITY') {
      calcBalBig = creditsBig - debitsBig;
    } else {
      calcBalBig = debitsBig - creditsBig;
    }

    const driftCentsBig = calcBalBig - recBalBig;
    const hasDrift = driftCentsBig !== 0n;

    if (hasDrift) {
      totalDriftCount++;
      writeEntityBigInt(acc, 'currentBalanceCents', calcBalBig);
      acc.updatedAt = Date.now();
    }

    driftReports.push({
      accountId: acc.id,
      familyId: acc.familyId,
      accountName: acc.name,
      accountType: acc.accountType,
      recordedBalanceCentsBig: recBalBig,
      calculatedLedgerBalanceCentsBig: calcBalBig,
      driftCentsBig,
      hasDrift,
      corrected: hasDrift,
    });
  }

  return {
    reconciledAccounts: targetAccounts,
    driftReports,
    totalDriftCount,
  };
}

export async function reconcileAccountBalancesFromPgLedger(
  dbClientOrPool: any,
  familyId?: string
): Promise<{ driftReports: AccountReconciliationDriftReport[]; totalDriftCount: number; runId: string; timestamp: number }> {
  const runId = `rec_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const now = Date.now();
  const isPool = typeof dbClientOrPool.connect === 'function';
  const client = isPool ? await dbClientOrPool.connect() : dbClientOrPool;

  try {
    if (isPool) await client.query('BEGIN');

    const accsRes = familyId
      ? await client.query(`SELECT * FROM financial_accounts WHERE family_id = $1`, [familyId])
      : await client.query(`SELECT * FROM financial_accounts`);

    const driftReports: AccountReconciliationDriftReport[] = [];
    let totalDriftCount = 0;

    for (const acc of accsRes.rows) {
      const recBalBig = BigInt(acc.current_balance_cents || 0);
      const entriesRes = await client.query(
        `SELECT e.entry_type, SUM(e.amount_cents) as total_amt
         FROM financial_entries e
         JOIN financial_transactions t ON e.transaction_id = t.id
         WHERE e.account_id = $1 AND t.status = 'POSTED'
         GROUP BY e.entry_type`,
        [acc.id]
      );

      let debitsBig = 0n;
      let creditsBig = 0n;
      for (const row of entriesRes.rows) {
        if (row.entry_type === 'DEBIT') debitsBig = BigInt(row.total_amt || 0);
        if (row.entry_type === 'CREDIT') creditsBig = BigInt(row.total_amt || 0);
      }

      const typeUpper = String(acc.account_type || 'CHECKING').toUpperCase();
      const isLiab = Boolean(acc.is_liability) || typeUpper === 'CREDIT_CARD' || typeUpper === 'LOAN' || typeUpper === 'MORTGAGE' || typeUpper === 'LIABILITY';
      const isCreditNormal = isLiab || typeUpper === 'INCOME' || typeUpper === 'EQUITY';

      const calcBalBig = isCreditNormal ? creditsBig - debitsBig : debitsBig - creditsBig;
      const driftCentsBig = calcBalBig - recBalBig;
      const hasDrift = driftCentsBig !== 0n;

      if (hasDrift) {
        totalDriftCount++;
        await client.query(
          `UPDATE financial_accounts SET current_balance_cents = $1, updated_at = $2 WHERE id = $3`,
          [calcBalBig.toString(), now, acc.id]
        );
      }

      driftReports.push({
        accountId: acc.id,
        familyId: acc.family_id,
        accountName: acc.name,
        accountType: acc.account_type,
        recordedBalanceCentsBig: recBalBig,
        calculatedLedgerBalanceCentsBig: calcBalBig,
        driftCentsBig,
        hasDrift,
        corrected: hasDrift,
      });
    }

    if (isPool) await client.query('COMMIT');
    return { driftReports, totalDriftCount, runId, timestamp: now };
  } catch (err) {
    if (isPool) await client.query('ROLLBACK');
    throw err;
  } finally {
    if (isPool) client.release();
  }
}
