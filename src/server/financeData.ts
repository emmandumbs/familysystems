/**
 * FAMILYOS — AUTHORITATIVE FINANCIAL DATA MODELS & CALCULATION ENGINE
 * Exact 64-bit integer cents (Long) & fixed-precision microshares (10^6).
 * 
 * Rules:
 * 1. Floating-point arithmetic is strictly forbidden for money.
 * 2. 1 whole share = 1,000,000 microshares.
 * 3. Double-entry / transfer integrity: Net household impact = 0 cents.
 * 4. Audit reversals: Original records immutable; compensating reversal records posted.
 */

import { toSafeNumberOrNull } from '../utils/financeFormatting';

export interface FinancialAccount {
  id: string;
  familyId: string;
  name: string;
  accountType: 'CHECKING' | 'SAVINGS' | 'CREDIT_CARD' | 'INVESTMENT' | 'CASH' | 'LOAN';
  currentBalanceCents: number; // Signed integer cents
  isLiability: boolean;
  institution: string;
  currency: string;
  isArchived: boolean;
  lastReconciledAt?: number;
  createdAt: number;
  updatedAt: number;
}

export interface FinancialTransaction {
  id: string;
  familyId: string;
  accountId: string;
  destinationAccountId?: string | null;
  title: string;
  amountCents: number; // Positive integer cents
  transactionType: 'INCOME' | 'EXPENSE' | 'TRANSFER';
  category: string;
  transactionDate: number;
  isCleared: boolean;
  isReversal: boolean;
  reversalOfId?: string | null;
  paidBy: string;
  notes?: string;
  idempotencyKey?: string;
  createdAt: number;
}

export interface EnvelopeBudget {
  id: string;
  familyId: string;
  category: string;
  allocatedCents: number;
  spentCents: number;
  alertThresholdPercentage: number;
  status: 'NORMAL' | 'WARNING' | 'OVER_BUDGET';
  monthEpoch: number;
  updatedAt: number;
}

export interface SavingsContribution {
  id: string;
  goalId: string;
  amountCents: number;
  fundingAccountId?: string | null;
  notes?: string;
  contributedBy: string;
  contributedAt: number;
}

export interface SavingsGoal {
  id: string;
  familyId: string;
  linkedAccountId?: string | null;
  title: string;
  targetCents: number;
  currentCents: number;
  plannedMonthlyContributionCents: number;
  targetDate?: number | null;
  isCompleted: boolean;
  suggestedMonthlyContributionCents: number;
  contributions?: SavingsContribution[];
  createdAt: number;
  updatedAt: number;
}

export interface RecurringRule {
  id: string;
  familyId: string;
  accountId: string;
  title: string;
  amountCents: number;
  transactionType: 'INCOME' | 'EXPENSE';
  category: string;
  recurrenceInterval: 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUAL';
  nextDueDate: number;
  isActive: boolean;
  isAutoPay: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface InvestmentHolding {
  id: string;
  familyId: string;
  accountId: string;
  symbol: string;
  assetName: string;
  assetType: 'STOCK' | 'ETF' | 'CRYPTO' | 'MUTUAL_FUND' | 'BOND' | 'RETIREMENT';
  quantityMicroshares: number; // 1 share = 1,000,000 microshares
  costBasisCents: number; // Total cost in integer cents
  currentPriceCents: number; // Price per 1.0 whole share in integer cents
  currency: string;
  notes?: string | null;
  lastPriceUpdatedAt: number;
  currentValuationCents: number;
  unrealizedGainLossCents: number;
  gainLossBasisPoints: number; // 100 bps = 1.00%
  version: number;
  isDeleted: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface AccountReconciliation {
  id: string;
  familyId: string;
  accountId: string;
  statementDate: number;
  statementEndingBalanceCents: number;
  ledgerBalanceCents: number;
  discrepancyCents: number;
  isReconciled: boolean;
  reconciledBy: string;
  reconciledAt: number;
}

export interface CashFlowSummary {
  // Actual Recorded Money (Cleared Ledger Transactions)
  actualIncomeCents: number;
  actualExpenseCents: number;
  actualNetCashFlowCents: number;
  
  // Total Balances Across Accounts
  totalAssetsCents: number;
  totalLiabilitiesCents: number;
  netWorthCents: number;
  
  // Projected Recurring Cash Flow
  projectedMonthlyRecurringIncomeCents: number;
  projectedMonthlyRecurringExpenseCents: number;
  plannedVariableExpensesCents: number;
  availablePlannedCashFlowCents: number;
  plannedAllocationsCents: number;
  discretionaryMarginCents: number;
}

// ============================================================================
// DETERMINISTIC INTEGER-CENTS MATHEMATICAL FORMULAS
// ============================================================================

export function computeInvestmentValuation(quantityMicroshares: number | bigint | string, currentPriceCents: number | bigint | string): number {
  return toSafeNumberOrNull(computeInvestmentValuationBigInt(quantityMicroshares, currentPriceCents)) ?? 0;
}

export function computeInvestmentValuationBigInt(quantityMicroshares: number | bigint | string, currentPriceCents: number | bigint | string): bigint {
  const q = BigInt(quantityMicroshares);
  const p = BigInt(currentPriceCents);
  if (q <= 0n || p <= 0n) return 0n;
  return (q * p) / 1000000n;
}

export function computeUnrealizedGainLoss(currentValuationCents: number | bigint | string, costBasisCents: number | bigint | string): number {
  return toSafeNumberOrNull(computeUnrealizedGainLossBigInt(currentValuationCents, costBasisCents)) ?? 0;
}

export function computeUnrealizedGainLossBigInt(currentValuationCents: number | bigint | string, costBasisCents: number | bigint | string): bigint {
  return BigInt(currentValuationCents) - BigInt(costBasisCents);
}

export function computeGainLossBasisPoints(unrealizedGainLossCents: number | bigint | string, costBasisCents: number | bigint | string): number {
  return toSafeNumberOrNull(computeGainLossBasisPointsBigInt(unrealizedGainLossCents, costBasisCents)) ?? 0;
}

export function computeGainLossBasisPointsBigInt(unrealizedGainLossCents: number | bigint | string, costBasisCents: number | bigint | string): bigint {
  const basis = BigInt(costBasisCents);
  if (basis <= 0n) return 0n;
  const gain = BigInt(unrealizedGainLossCents);
  return (gain * 10000n) / basis;
}

export function computeSuggestedMonthlyContribution(targetCents: number, currentCents: number, targetDate?: number | null): number {
  const targetBig = BigInt(Math.trunc(targetCents));
  const currentBig = BigInt(Math.trunc(currentCents));
  const remainingBig = targetBig > currentBig ? targetBig - currentBig : 0n;
  if (remainingBig === 0n) return 0;
  const nowMs = Date.now();
  if (!targetDate || targetDate <= nowMs) return toSafeNumberOrNull(remainingBig) ?? 0;

  const msRemainingBig = BigInt(Math.max(1, Math.trunc(targetDate) - Math.trunc(nowMs)));
  const AVG_MONTH_MS_BIG = 2629800000n;
  const rawMonthsBig = (msRemainingBig + AVG_MONTH_MS_BIG - 1n) / AVG_MONTH_MS_BIG;
  const monthsRemaining = rawMonthsBig > 0n ? rawMonthsBig : 1n;
  return toSafeNumberOrNull((remainingBig + monthsRemaining - 1n) / monthsRemaining) ?? 0;
}

export function computeBudgetStatus(allocatedCents: number, spentCents: number, alertThresholdPercentage = 85): {
  status: 'NORMAL' | 'WARNING' | 'OVER_BUDGET';
  spentPercentage: number;
} {
  const allocBig = BigInt(Math.trunc(allocatedCents));
  const spentBig = BigInt(Math.trunc(spentCents));
  if (allocBig <= 0n) {
    return {
      status: spentBig > 0n ? 'OVER_BUDGET' : 'NORMAL',
      spentPercentage: spentBig > 0n ? 100 : 0,
    };
  }

  const spentPercentage = Number((spentBig * 100n) / allocBig);
  let status: 'NORMAL' | 'WARNING' | 'OVER_BUDGET' = 'NORMAL';
  if (spentBig >= allocBig) {
    status = 'OVER_BUDGET';
  } else if (spentPercentage >= alertThresholdPercentage) {
    status = 'WARNING';
  }
  return { status, spentPercentage };
}

export function computeNextDueDate(interval: RecurringRule['recurrenceInterval'], currentDueDate: number): number {
  const date = new Date(currentDueDate);
  const dayMs = 24 * 3600 * 1000;

  switch (interval) {
    case 'DAILY':
      return currentDueDate + dayMs;
    case 'WEEKLY':
      return currentDueDate + 7 * dayMs;
    case 'BIWEEKLY':
      return currentDueDate + 14 * dayMs;
    case 'MONTHLY': {
      const targetMonth = date.getMonth() + 1;
      const targetYear = date.getFullYear() + (targetMonth > 11 ? 1 : 0);
      const normalizedMonth = targetMonth % 12;
      const originalDay = date.getDate();
      const lastDayOfTargetMonth = new Date(targetYear, normalizedMonth + 1, 0).getDate();
      const clampedDay = Math.min(originalDay, lastDayOfTargetMonth);
      const nextDate = new Date(targetYear, normalizedMonth, clampedDay, date.getHours(), date.getMinutes(), date.getSeconds());
      return nextDate.getTime();
    }
    case 'QUARTERLY': {
      const targetMonth = date.getMonth() + 3;
      const targetYear = date.getFullYear() + Math.floor(targetMonth / 12);
      const normalizedMonth = targetMonth % 12;
      const originalDay = date.getDate();
      const lastDayOfTargetMonth = new Date(targetYear, normalizedMonth + 1, 0).getDate();
      const clampedDay = Math.min(originalDay, lastDayOfTargetMonth);
      const nextDate = new Date(targetYear, normalizedMonth, clampedDay, date.getHours(), date.getMinutes(), date.getSeconds());
      return nextDate.getTime();
    }
    case 'ANNUAL': {
      const targetYear = date.getFullYear() + 1;
      const originalMonth = date.getMonth();
      const originalDay = date.getDate();
      const lastDayOfTargetMonth = new Date(targetYear, originalMonth + 1, 0).getDate();
      const clampedDay = Math.min(originalDay, lastDayOfTargetMonth);
      const nextDate = new Date(targetYear, originalMonth, clampedDay, date.getHours(), date.getMinutes(), date.getSeconds());
      return nextDate.getTime();
    }
    default:
      return currentDueDate + 30 * dayMs;
  }
}

// ============================================================================
// DURABLE DISK-BACKED FINANCE STORE REPOSITORY (Family-Scoped)
// ============================================================================

import { loadStore, saveStoreAtomically } from '../../server.js';
import { buildFam1DemoFinanceData } from '../../tests/fixtures/demoFixtures';

export interface FamilyFinanceStore {
  savingsGoals: Map<string, SavingsGoal>;
  recurringRules: Map<string, RecurringRule>;
  investmentHoldings: Map<string, InvestmentHolding>;
  reconciliations: Map<string, AccountReconciliation>;
}

function wrapEntityProxy<T extends object>(entity: T, onMutate: () => void): T {
  return new Proxy(entity, {
    set(target, prop, value, receiver) {
      const result = Reflect.set(target, prop, value, receiver);
      onMutate();
      return result;
    },
  });
}

class DurableFinanceMap<K, V extends { id: string; familyId: string }> extends Map<K, V> {
  private onMutate?: () => void;

  constructor(entries: Array<[K, V]>, onMutate?: () => void) {
    super(entries.map(([k, v]) => [k, onMutate ? wrapEntityProxy(v, onMutate) : v]));
    this.onMutate = onMutate;
  }

  override set(key: K, value: V): this {
    const wrapped = this.onMutate ? wrapEntityProxy(value, this.onMutate) : value;
    super.set(key, wrapped);
    if (this.onMutate) this.onMutate();
    return this;
  }

  override delete(key: K): boolean {
    const res = super.delete(key);
    if (res && this.onMutate) this.onMutate();
    return res;
  }

  override clear(): void {
    super.clear();
    if (this.onMutate) this.onMutate();
  }
}

function replaceFamilySlice<T extends { id: string; familyId: string }>(
  existing: T[] | undefined,
  familyId: string,
  map: Map<string, T>
): T[] {
  const others = (existing || []).filter((item) => item.familyId !== familyId);
  const current = Array.from(map.values()).map((item) => ({ ...item, familyId }));
  return [...others, ...current];
}

export function getFinanceStore(familyId: string): FamilyFinanceStore {
  const shared = loadStore();

  let storeRef: FamilyFinanceStore | null = null;
  let syncing = false;

  const persist = () => {
    if (syncing || !storeRef) return;
    syncing = true;
    try {
      const currentShared = loadStore();
      currentShared.savingsGoals = replaceFamilySlice(
        currentShared.savingsGoals,
        familyId,
        storeRef.savingsGoals
      );
      currentShared.recurringRules = replaceFamilySlice(
        currentShared.recurringRules,
        familyId,
        storeRef.recurringRules
      );
      currentShared.investmentHoldings = replaceFamilySlice(
        currentShared.investmentHoldings,
        familyId,
        storeRef.investmentHoldings
      );
      currentShared.reconciliations = replaceFamilySlice(
        currentShared.reconciliations,
        familyId,
        storeRef.reconciliations
      );
      saveStoreAtomically(currentShared);
    } finally {
      syncing = false;
    }
  };

  const goalsEntries: Array<[string, SavingsGoal]> = (shared.savingsGoals || [])
    .filter((g: SavingsGoal) => g.familyId === familyId)
    .map((g: SavingsGoal) => [g.id, { ...g }]);

  const rulesEntries: Array<[string, RecurringRule]> = (shared.recurringRules || [])
    .filter((r: RecurringRule) => r.familyId === familyId)
    .map((r: RecurringRule) => [r.id, { ...r }]);

  const holdingsEntries: Array<[string, InvestmentHolding]> = (shared.investmentHoldings || [])
    .filter((h: InvestmentHolding) => h.familyId === familyId)
    .map((h: InvestmentHolding) => [h.id, { ...h }]);

  const reconciliationsEntries: Array<[string, AccountReconciliation]> = (shared.reconciliations || [])
    .filter((r: AccountReconciliation) => r.familyId === familyId)
    .map((r: AccountReconciliation) => [r.id, { ...r }]);

  storeRef = {
    savingsGoals: new DurableFinanceMap(goalsEntries, persist),
    recurringRules: new DurableFinanceMap(rulesEntries, persist),
    investmentHoldings: new DurableFinanceMap(holdingsEntries, persist),
    reconciliations: new DurableFinanceMap(reconciliationsEntries, persist),
  };

  return storeRef;
}

export function resetFinanceStore(familyId: string): FamilyFinanceStore {
  const shared = loadStore();
  shared.savingsGoals = (shared.savingsGoals || []).filter((g: SavingsGoal) => g.familyId !== familyId);
  shared.recurringRules = (shared.recurringRules || []).filter((r: RecurringRule) => r.familyId !== familyId);
  shared.investmentHoldings = (shared.investmentHoldings || []).filter(
    (h: InvestmentHolding) => h.familyId !== familyId
  );
  shared.reconciliations = (shared.reconciliations || []).filter(
    (r: AccountReconciliation) => r.familyId !== familyId
  );

  if (familyId === 'fam-1' && process.env.NODE_ENV !== 'production') {
    const demo = buildFam1DemoFinanceData('fam-1');
    shared.savingsGoals.push(...demo.savingsGoals);
    shared.recurringRules.push(...demo.recurringRules);
    shared.investmentHoldings.push(...demo.investmentHoldings);
    shared.reconciliations.push(...demo.reconciliations);
  }

  saveStoreAtomically(shared);
  return getFinanceStore(familyId);
}

