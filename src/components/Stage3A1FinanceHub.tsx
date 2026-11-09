import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  DollarSign,
  Landmark,
  ArrowLeftRight,
  PieChart,
  PiggyBank,
  CalendarClock,
  TrendingUp,
  RefreshCw,
  Plus,
  Search,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  WifiOff,
  RotateCcw,
  Trash2,
  Edit3,
  PauseCircle,
  PlayCircle,
  SlidersHorizontal,
  Info,
  Lock,
  X,
  Archive,
  ArchiveRestore,
  FileText,
  Check,
  ExternalLink,
  Eye,
  Printer,
} from 'lucide-react';
import {
  formatCents,
  parseDollarsToCents,
  parseDollarsToCentsBigInt,
  formatMicroshares,
  parseSharesToMicroshares,
  parseSharesToMicrosharesBigInt,
  formatBasisPoints,
  formatSignedIntegerWithCommas,
  toBigIntOrZero,
  serializeBigIntToDecimalString,
  toSafeNumberOrNull,
  getDynamicBudgetColor,
} from '../utils/financeFormatting';
import { SavingsGoalsCard } from './SavingsGoalsCard';
import { AccountManagementView } from './finance/AccountManagementView';

export type FinanceHubSection =
  | 'overview'
  | 'accounts'
  | 'transactions'
  | 'budgets'
  | 'savings'
  | 'recurring'
  | 'investments';

export interface Stage3A1FinanceHubProps {
  sessionToken: string | null;
  familyId?: string;
  selectedPersona: string;
  onSelectPersona?: (roleKey: string) => void;
  onExpireSession?: () => void;
  onRefreshGlobalWorkspace?: () => void;
  initialSection?: FinanceHubSection;
  activeSubPage?: string;
  onSelectSubPage?: (subId: string) => void;
}

const SUBPAGE_TO_FINANCE_SECTION: Record<string, FinanceHubSection> = {
  fin_accounts: 'accounts',
  fin_transactions: 'transactions',
  fin_budgets: 'budgets',
  fin_savings: 'savings',
  fin_recurring: 'recurring',
  fin_investments: 'investments',
};

const FINANCE_SECTION_TO_SUBPAGE: Record<FinanceHubSection, string> = {
  overview: 'fin_accounts',
  accounts: 'fin_accounts',
  transactions: 'fin_transactions',
  budgets: 'fin_budgets',
  savings: 'fin_savings',
  recurring: 'fin_recurring',
  investments: 'fin_investments',
};

const BRAND = {
  primary: '#173D35',
  ivory: '#F7F4EC',
  sage: '#A8BDAA',
  secondarySage: '#6B8A6E',
  gold: '#C39A60',
  lightGold: '#E7D1AA',
  textDark: '#11231E',
  textMuted: '#4F635D',
  border: '#E2DCD0',
};

export const Stage3A1FinanceHub: React.FC<Stage3A1FinanceHubProps> = ({
  sessionToken,
  familyId = '',
  selectedPersona,
  onSelectPersona,
  onExpireSession,
  onRefreshGlobalWorkspace,
  initialSection = 'overview',
  activeSubPage,
  onSelectSubPage,
}) => {
  const [activeSection, setActiveSection] = useState<FinanceHubSection>(
    (activeSubPage && SUBPAGE_TO_FINANCE_SECTION[activeSubPage]) || initialSection
  );

  useEffect(() => {
    if (activeSubPage && SUBPAGE_TO_FINANCE_SECTION[activeSubPage]) {
      setActiveSection(SUBPAGE_TO_FINANCE_SECTION[activeSubPage]);
    }
  }, [activeSubPage]);

  const handleSelectSection = (sec: FinanceHubSection) => {
    setActiveSection(sec);
    if (onSelectSubPage) {
      onSelectSubPage(FINANCE_SECTION_TO_SUBPAGE[sec]);
    }
  };
  const [activeFamilyId, setActiveFamilyId] = useState<string>(familyId || '');
  useEffect(() => {
    if (familyId) {
      setActiveFamilyId(familyId);
    }
  }, [familyId]);
  const [sessionExpiredOverride, setSessionExpiredOverride] = useState<boolean>(false);
  const effectiveSessionToken = sessionExpiredOverride ? null : sessionToken;

  // Network, loading, & authorization states
  const [loading, setLoading] = useState<boolean>(false);
  const [errorState, setErrorState] = useState<{
    type: 'UNAUTHORIZED' | 'ACCESS_RESTRICTED' | 'WORKSPACE_ISOLATION' | 'NETWORK' | 'VALIDATION' | null;
    code?: string;
    message: string;
  } | null>(null);
  const [feedbackBanner, setFeedbackBanner] = useState<{
    tone: 'success' | 'warning' | 'error';
    message: string;
  } | null>(null);

  // Authoritative backend financial state (cleared immediately on household or session change)
  const [summaryData, setSummaryData] = useState<any | null>(null);
  const [cashflowData, setCashflowData] = useState<any | null>(null);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [reconciliations, setReconciliations] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [budgets, setBudgets] = useState<any[]>([]);
  const [savingsGoals, setSavingsGoals] = useState<any[]>([]);
  const [recurringRules, setRecurringRules] = useState<any[]>([]);
  const [investmentHoldings, setInvestmentHoldings] = useState<any[]>([]);
  const [investmentSummary, setInvestmentSummary] = useState<any | null>(null);

  // Interactive Cash-Flow Simulator (What-If Planning Calculator)
  const [simIncomeDollars, setSimIncomeDollars] = useState<string>('8500.00');
  const [simRecurringDollars, setSimRecurringDollars] = useState<string>('3200.00');
  const [simVariableDollars, setSimVariableDollars] = useState<string>('1500.00');
  const [simSavingsAllocDollars, setSimSavingsAllocDollars] = useState<string>('800.00');

  // Section 2: Accounts & Reconciliation state
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [newAccName, setNewAccName] = useState<string>('');
  const [newAccType, setNewAccType] = useState<string>('CHECKING');
  const [newAccInstitution, setNewAccInstitution] = useState<string>('');
  const [newAccBalanceDollars, setNewAccBalanceDollars] = useState<string>('0.00');
  const [editAccId, setEditAccId] = useState<string | null>(null);
  const [editAccName, setEditAccName] = useState<string>('');
  const [editAccInstitution, setEditAccInstitution] = useState<string>('');
  const [editAccType, setEditAccType] = useState<string>('CHECKING');
  const [editAccIsLiability, setEditAccIsLiability] = useState<boolean>(false);
  const [isAccountMutating, setIsAccountMutating] = useState<boolean>(false);
  const [reconcileAccountId, setReconcileAccountId] = useState<string>('acc-1');
  const [reconcileStatementDollars, setReconcileStatementDollars] = useState<string>('8452.50');
  const [reconcileDateIso, setReconcileDateIso] = useState<string>(new Date().toISOString().slice(0, 10));

  // Enhanced Accounts Sub-Page State
  const [accTypeFilter, setAccTypeFilter] = useState<string>('ALL');
  const [accSearchQuery, setAccSearchQuery] = useState<string>('');
  const [isTransferModalOpen, setIsTransferModalOpen] = useState<boolean>(false);
  const [transferSourceAccId, setTransferSourceAccId] = useState<string>('');
  const [transferDestAccId, setTransferDestAccId] = useState<string>('');
  const [transferAmountDollars, setTransferAmountDollars] = useState<string>('');
  const [transferNotes, setTransferNotes] = useState<string>('');
  const [viewingAccountDetail, setViewingAccountDetail] = useState<any | null>(null);
  const [detailTxSearch, setDetailTxSearch] = useState<string>('');
  const [recSearchFilter, setRecSearchFilter] = useState<string>('');
  const [recStatusFilter, setRecStatusFilter] = useState<'ALL' | 'RECONCILED' | 'DISCREPANCY'>('ALL');

  const [isAddAccountModalOpen, setIsAddAccountModalOpen] = useState<boolean>(false);
  const [reconcileModalAccount, setReconcileModalAccount] = useState<any | null>(null);

  // Section 3: Transactions, Search/Filters & Audit Reversal state
  const [txEntryMode, setTxEntryMode] = useState<'EXPENSE' | 'INCOME' | 'TRANSFER' | 'BILL_PAYMENT' | 'SAVINGS_CONTRIB'>('EXPENSE');
  const [txAccountId, setTxAccountId] = useState<string>('acc-1');
  const [txDestAccountId, setTxDestAccountId] = useState<string>('acc-2');
  const [txGoalId, setTxGoalId] = useState<string>('goal-emergency-fund');
  const [txTitle, setTxTitle] = useState<string>('');
  const [txAmountDollars, setTxAmountDollars] = useState<string>('');
  const [txCategory, setTxCategory] = useState<string>('FOOD');
  const [txNotes, setTxNotes] = useState<string>('');

  const [txSearchQuery, setTxSearchQuery] = useState<string>('');
  const [txFilterType, setTxFilterType] = useState<string>('ALL');
  const [txFilterAccount, setTxFilterAccount] = useState<string>('ALL');
  const [txFilterCategory, setTxFilterCategory] = useState<string>('ALL');
  const [selectedTxDetail, setSelectedTxDetail] = useState<any | null>(null);
  const [isAddTxModalOpen, setIsAddTxModalOpen] = useState<boolean>(false);
  const [editingTx, setEditingTx] = useState<any | null>(null);

  // Consequential Action Confirmation Dialog state (Reversals & Soft/Hard Deletions)
  const [confirmModal, setConfirmModal] = useState<{
    kind:
      | 'REVERSE_TX'
      | 'DELETE_HOLDING'
      | 'DELETE_ACCOUNT'
      | 'DELETE_TX'
      | 'DELETE_BUDGET'
      | 'DELETE_GOAL'
      | 'DELETE_RULE';
    targetId: string;
    targetLabel: string;
    amountLabel?: string;
    reason: string;
  } | null>(null);

  // Section 4: Budgets state
  const [budgetCatInput, setBudgetCatInput] = useState<string>('UTILITIES');
  const [budgetAllocDollars, setBudgetAllocDollars] = useState<string>('400.00');
  const [budgetThresholdPct, setBudgetThresholdPct] = useState<number>(80);
  const [budgetSearchQuery, setBudgetSearchQuery] = useState<string>('');
  const [budgetStatusFilter, setBudgetStatusFilter] = useState<'ALL' | 'NORMAL' | 'WARNING' | 'OVER_BUDGET'>('ALL');
  const [isAddBudgetModalOpen, setIsAddBudgetModalOpen] = useState<boolean>(false);
  const [editingBudget, setEditingBudget] = useState<{
    id: string;
    category: string;
    allocatedDollars: string;
    spentDollars: string;
    alertThresholdPercentage: number;
  } | null>(null);
  const [isBudgetMutating, setIsBudgetMutating] = useState<boolean>(false);

  // Section 5: Savings Goals state
  const [newGoalTitle, setNewGoalTitle] = useState<string>('');
  const [newGoalTargetDollars, setNewGoalTargetDollars] = useState<string>('5000.00');
  const [newGoalCurrentDollars, setNewGoalCurrentDollars] = useState<string>('0.00');
  const [newGoalPlannedMonthlyDollars, setNewGoalPlannedMonthlyDollars] = useState<string>('250.00');
  const [newGoalTargetDateIso, setNewGoalTargetDateIso] = useState<string>(
    new Date(Date.now() + 180 * 86400000).toISOString().slice(0, 10)
  );
  const [newGoalLinkedAccountId, setNewGoalLinkedAccountId] = useState<string>('acc-2');
  const [contribGoalId, setContribGoalId] = useState<string>('goal-emergency-fund');
  const [contribAmountDollars, setContribAmountDollars] = useState<string>('250.00');
  const [contribFundingAccountId, setContribFundingAccountId] = useState<string>('acc-1');
  const [contribNotes, setContribNotes] = useState<string>('Monthly reserve deposit');
  const [savingsSearchQuery, setSavingsSearchQuery] = useState<string>('');
  const [savingsStatusFilter, setSavingsStatusFilter] = useState<'ALL' | 'ACTIVE' | 'COMPLETED'>('ALL');
  const [isAddGoalModalOpen, setIsAddGoalModalOpen] = useState<boolean>(false);
  const [isContributeModalOpen, setIsContributeModalOpen] = useState<boolean>(false);
  const [editingGoal, setEditingGoal] = useState<{
    id: string;
    title: string;
    targetDollars: string;
    currentDollars: string;
    plannedMonthlyDollars: string;
    targetDateIso: string;
    linkedAccountId: string;
  } | null>(null);
  const [isSavingsMutating, setIsSavingsMutating] = useState<boolean>(false);

  // Savings Installment Transfer Modal state
  const [installmentModalGoal, setInstallmentModalGoal] = useState<any | null>(null);
  const [installmentFundingAccId, setInstallmentFundingAccId] = useState<string>('acc-1');
  const [installmentAmtDollars, setInstallmentAmtDollars] = useState<string>('250.00');
  const [installmentNotesVal, setInstallmentNotesVal] = useState<string>('Monthly savings installment check-off (Transfer)');

  // Section 6: Recurring Rules state
  const [newRuleTitle, setNewRuleTitle] = useState<string>('');
  const [newRuleAccountId, setNewRuleAccountId] = useState<string>('acc-1');
  const [newRuleType, setNewRuleType] = useState<'EXPENSE' | 'INCOME'>('EXPENSE');
  const [newRuleCategory, setNewRuleCategory] = useState<string>('UTILITIES');
  const [newRuleAmountDollars, setNewRuleAmountDollars] = useState<string>('95.00');
  const [newRuleFrequency, setNewRuleFrequency] = useState<string>('MONTHLY');
  const [newRuleDueDateIso, setNewRuleDueDateIso] = useState<string>(new Date().toISOString().slice(0, 10));
  const [recurringSearchQuery, setRecurringSearchQuery] = useState<string>('');
  const [recurringFilter, setRecurringFilter] = useState<'ALL' | 'ACTIVE' | 'PAUSED' | 'INCOME' | 'EXPENSE'>('ALL');
  const [isAddRuleModalOpen, setIsAddRuleModalOpen] = useState<boolean>(false);
  const [editingRule, setEditingRule] = useState<{
    id: string;
    title: string;
    accountId: string;
    transactionType: 'EXPENSE' | 'INCOME';
    category: string;
    amountDollars: string;
    frequency: string;
    dueDateIso: string;
    isActive: boolean;
  } | null>(null);
  const [isRecurringMutating, setIsRecurringMutating] = useState<boolean>(false);

  // Print Database modal state
  const [isPrintModalOpen, setIsPrintModalOpen] = useState<boolean>(false);
  const [isSavingsPrintModalOpen, setIsSavingsPrintModalOpen] = useState<boolean>(false);

  // Section 7: Investments state
  const [invSymbol, setInvSymbol] = useState<string>('');
  const [invAssetName, setInvAssetName] = useState<string>('');
  const [invAssetType, setInvAssetType] = useState<string>('STOCK');
  const [invSharesInput, setInvSharesInput] = useState<string>('10.000000');
  const [invCostBasisDollars, setInvCostBasisDollars] = useState<string>('1500.00');
  const [invUnitPriceDollars, setInvUnitPriceDollars] = useState<string>('155.00');
  const [invFundingAccountId, setInvFundingAccountId] = useState<string>('');
  const [priceUpdateMap, setPriceUpdateMap] = useState<Record<string, string>>({});
  const [invSearchQuery, setInvSearchQuery] = useState<string>('');
  const [invTypeFilter, setInvTypeFilter] = useState<string>('ALL');
  const [isAddHoldingModalOpen, setIsAddHoldingModalOpen] = useState<boolean>(false);
  const [editingHolding, setEditingHolding] = useState<{
    id: string;
    symbol: string;
    assetName: string;
    assetType: string;
    sharesInput: string;
    costBasisDollars: string;
    unitPriceDollars: string;
  } | null>(null);
  const [isInvMutating, setIsInvMutating] = useState<boolean>(false);

  const showFeedback = useCallback((tone: 'success' | 'warning' | 'error', message: string) => {
    setFeedbackBanner({ tone, message });
  }, []);

  const requestSeqRef = useRef<number>(0);

  /**
   * Security Requirement 5: Clear all cached financial records immediately when
   * switching households, personas, or when session expires to prevent data leakage.
   */
  const clearSensitiveFinanceCache = useCallback(() => {
    setSummaryData(null);
    setCashflowData(null);
    setAccounts([]);
    setReconciliations([]);
    setTransactions([]);
    setBudgets([]);
    setSavingsGoals([]);
    setRecurringRules([]);
    setInvestmentHoldings([]);
    setInvestmentSummary(null);
    setSelectedAccountId(null);
    setViewingAccountDetail(null);
    setIsTransferModalOpen(false);
    setSelectedTxDetail(null);
    setConfirmModal(null);
  }, []);

  const fetchAllFinanceHubData = useCallback(async () => {
    const reqId = ++requestSeqRef.current;

    if (!effectiveSessionToken) {
      clearSensitiveFinanceCache();
      setErrorState({
        type: 'UNAUTHORIZED',
        code: 'SESSION_EXPIRED',
        message: 'Your authenticated session has expired or is missing. Please re-authenticate to access household financial records.',
      });
      return;
    }

    if (selectedPersona === 'CHILD' || selectedPersona === 'GUEST') {
      clearSensitiveFinanceCache();
      setErrorState({
        type: 'ACCESS_RESTRICTED',
        code: 'FINANCE_ACCESS_RESTRICTED',
        message:
          'Zero-Trust Server RBAC: This profile or household membership is not permitted to view financial ledgers.',
      });
      setLoading(false);
      // Also fire backend request so server-side RBAC audit logs the 403 rejection
      fetch(`/api/v1/finance/${activeFamilyId}/summary`, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${effectiveSessionToken}`,
        },
      }).catch(() => {});
      return;
    }

    setLoading(true);
    setErrorState(null);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${effectiveSessionToken}`,
    };

    try {
      const summaryRes = await fetch(`/api/v1/finance/${activeFamilyId}/summary`, { headers });
      if (reqId !== requestSeqRef.current) return;

      if (summaryRes.status === 401) {
        clearSensitiveFinanceCache();
        setErrorState({
          type: 'UNAUTHORIZED',
          code: 'UNAUTHORIZED',
          message: 'Session token expired or invalid. Cached financial state has been purged.',
        });
        setLoading(false);
        return;
      }

      if (summaryRes.status === 403) {
        clearSensitiveFinanceCache();
        const errBody = await summaryRes.json().catch(() => ({}));
        if (reqId !== requestSeqRef.current) return;
        const isIsolation = errBody.error === 'WORKSPACE_ISOLATION_VIOLATION';
        setErrorState({
          type: isIsolation ? 'WORKSPACE_ISOLATION' : 'ACCESS_RESTRICTED',
          code: errBody.error || 'FINANCE_ACCESS_RESTRICTED',
          message:
            errBody.message ||
            'Zero-Trust Server RBAC: This profile or household membership is not permitted to view financial ledgers.',
        });
        setLoading(false);
        return;
      }

      if (!summaryRes.ok) {
        throw new Error(`HTTP ${summaryRes.status}`);
      }

      const [
        summaryJson,
        cashflowRes,
        accountsRes,
        txRes,
        budgetsRes,
        savingsRes,
        recurringRes,
        investmentsRes,
      ] = await Promise.all([
        summaryRes.json(),
        fetch(`/api/v1/finance/${activeFamilyId}/cashflow`, { headers }),
        fetch(`/api/v1/finance/${activeFamilyId}/accounts`, { headers }),
        fetch(`/api/v1/finance/${activeFamilyId}/transactions?limit=100`, { headers }),
        fetch(`/api/v1/finance/${activeFamilyId}/budgets`, { headers }),
        fetch(`/api/v1/finance/${activeFamilyId}/savings`, { headers }),
        fetch(`/api/v1/finance/${activeFamilyId}/recurring`, { headers }),
        fetch(`/api/v1/finance/${activeFamilyId}/investments`, { headers }),
      ]);
      if (reqId !== requestSeqRef.current) return;

      setSummaryData(summaryJson);
      if (cashflowRes.ok) {
        const cfJson = await cashflowRes.json();
        if (reqId !== requestSeqRef.current) return;
        setCashflowData(cfJson);
      }
      if (accountsRes.ok) {
        const accJson = await accountsRes.json();
        if (reqId !== requestSeqRef.current) return;
        setAccounts(accJson.accounts || []);
        setReconciliations(accJson.reconciliations || []);
      }
      if (txRes.ok) {
        const txJson = await txRes.json();
        if (reqId !== requestSeqRef.current) return;
        setTransactions(txJson.transactions || []);
      }
      if (budgetsRes.ok) {
        const bJson = await budgetsRes.json();
        if (reqId !== requestSeqRef.current) return;
        setBudgets(bJson.budgets || []);
      }
      if (savingsRes.ok) {
        const sJson = await savingsRes.json();
        if (reqId !== requestSeqRef.current) return;
        setSavingsGoals(sJson.goals || []);
      }
      if (recurringRes.ok) {
        const rJson = await recurringRes.json();
        if (reqId !== requestSeqRef.current) return;
        setRecurringRules(rJson.recurringRules || []);
      }
      if (investmentsRes.ok) {
        const invJson = await investmentsRes.json();
        if (reqId !== requestSeqRef.current) return;
        const holdingsList = invJson.holdings || [];
        setInvestmentHoldings(holdingsList);
        setInvestmentSummary(invJson.summary || null);
        const nextPriceMap: Record<string, string> = {};
        for (const h of holdingsList) {
          const priceBig = toBigIntOrZero(h.currentPriceCentsDecimal, h.currentPriceCents);
          const whole = (priceBig / 100n).toString(10);
          const rem = (priceBig % 100n).toString(10).padStart(2, '0');
          nextPriceMap[h.id] = `${whole}.${rem}`;
        }
        setPriceUpdateMap(nextPriceMap);
      }
    } catch {
      if (reqId !== requestSeqRef.current) return;
      setErrorState({
        type: 'NETWORK',
        code: 'NETWORK_FAILURE',
        message: 'Unable to reach the FamilyOS financial server. Verify network connectivity and retry.',
      });
    } finally {
      if (reqId === requestSeqRef.current) {
        setLoading(false);
      }
    }
  }, [activeFamilyId, clearSensitiveFinanceCache, effectiveSessionToken, selectedPersona]);

  useEffect(() => {
    if (sessionToken) {
      setSessionExpiredOverride(false);
    }
  }, [sessionToken, selectedPersona]);

  // Clear sensitive state immediately when familyId, persona, or effectiveSessionToken changes
  useEffect(() => {
    clearSensitiveFinanceCache();
    fetchAllFinanceHubData();
  }, [activeFamilyId, selectedPersona, effectiveSessionToken, clearSensitiveFinanceCache, fetchAllFinanceHubData]);

  // Global cross-tab & cross-component finance sync event listener
  useEffect(() => {
    const handleGlobalFinanceEvent = (e: Event) => {
      const detail = (e as CustomEvent)?.detail;
      if (!detail?.familyId || detail.familyId === activeFamilyId) {
        fetchAllFinanceHubData();
      }
    };
    window.addEventListener('familyos-finance-updated', handleGlobalFinanceEvent);
    return () => window.removeEventListener('familyos-finance-updated', handleGlobalFinanceEvent);
  }, [activeFamilyId, fetchAllFinanceHubData]);

  // Accounts Sub-Page Computed Metrics (64-bit BigInt)
  const accountMetrics = useMemo(() => {
    let totalAssetsBig = 0n;
    let totalLiabilitiesBig = 0n;
    let activeCount = 0;
    let archivedCount = 0;
    let reconciled30DaysCount = 0;
    const thirtyDaysAgo = Date.now() - 30 * 86400 * 1000;

    for (const acc of accounts) {
      if (acc.isArchived) {
        archivedCount++;
        continue;
      }
      activeCount++;
      const balBig = toBigIntOrZero(acc.currentBalanceCentsDecimal, acc.currentBalanceCents);
      if (acc.isLiability) {
        totalLiabilitiesBig += balBig < 0n ? -balBig : balBig;
      } else {
        if (balBig < 0n) {
          totalLiabilitiesBig += -balBig;
        } else {
          totalAssetsBig += balBig;
        }
      }
      if (acc.lastReconciledAt && acc.lastReconciledAt >= thirtyDaysAgo) {
        reconciled30DaysCount++;
      }
    }

    const netCashBig = totalAssetsBig - totalLiabilitiesBig;

    return {
      totalAssetsCents: serializeBigIntToDecimalString(totalAssetsBig),
      totalLiabilitiesCents: serializeBigIntToDecimalString(totalLiabilitiesBig),
      netCashCents: serializeBigIntToDecimalString(netCashBig),
      totalAssetsBig,
      totalLiabilitiesBig,
      netCashBig,
      activeCount,
      archivedCount,
      reconciled30DaysCount,
    };
  }, [accounts]);

  // Transactions Sub-Page Computed Metrics (64-bit BigInt)
  const txMetrics = useMemo(() => {
    let totalIncomeBig = 0n;
    let totalExpenseBig = 0n;
    let reversalCount = 0;

    for (const tx of transactions) {
      if (tx.isReversal) {
        reversalCount++;
        continue;
      }
      const amtBig = toBigIntOrZero(tx.amountCentsDecimal, tx.amountCents);
      if (tx.transactionType === 'INCOME') {
        totalIncomeBig += amtBig;
      } else if (tx.transactionType === 'EXPENSE') {
        totalExpenseBig += amtBig;
      }
    }

    const netCashFlowBig = totalIncomeBig - totalExpenseBig;

    return {
      totalIncomeCents: serializeBigIntToDecimalString(totalIncomeBig),
      totalExpenseCents: serializeBigIntToDecimalString(totalExpenseBig),
      netCashFlowCents: serializeBigIntToDecimalString(netCashFlowBig),
      netCashFlowBig,
      totalCount: transactions.length,
      reversalCount,
    };
  }, [transactions]);

  // Filtered accounts list by category, search query, and archive status
  const filteredAccounts = useMemo(() => {
    return accounts.filter((acc) => {
      if (accTypeFilter === 'ARCHIVED') {
        if (!acc.isArchived) return false;
      } else {
        if (acc.isArchived) return false;
        if (accTypeFilter === 'ASSETS' && acc.isLiability) return false;
        if (accTypeFilter === 'LIABILITIES' && !acc.isLiability) return false;
        if (
          accTypeFilter !== 'ALL' &&
          accTypeFilter !== 'ASSETS' &&
          accTypeFilter !== 'LIABILITIES' &&
          acc.accountType !== accTypeFilter
        ) {
          return false;
        }
      }

      if (accSearchQuery.trim()) {
        const q = accSearchQuery.trim().toLowerCase();
        const nameMatch = (acc.name || '').toLowerCase().includes(q);
        const instMatch = (acc.institution || '').toLowerCase().includes(q);
        const idMatch = (acc.id || '').toLowerCase().includes(q);
        const typeMatch = (acc.accountType || '').toLowerCase().includes(q);
        if (!nameMatch && !instMatch && !idMatch && !typeMatch) return false;
      }

      return true;
    });
  }, [accounts, accTypeFilter, accSearchQuery]);

  // Filtered reconciliations list
  const filteredReconciliations = useMemo(() => {
    return reconciliations.filter((r) => {
      const acc = accounts.find((a) => a.id === r.accountId);
      const accName = acc?.name || r.accountId;
      const inst = acc?.institution || '';
      if (recSearchFilter.trim()) {
        const q = recSearchFilter.trim().toLowerCase();
        if (!accName.toLowerCase().includes(q) && !inst.toLowerCase().includes(q) && !r.accountId.toLowerCase().includes(q)) {
          return false;
        }
      }
      if (recStatusFilter === 'RECONCILED' && !r.isReconciled) return false;
      if (recStatusFilter === 'DISCREPANCY' && r.isReconciled) return false;
      return true;
    });
  }, [reconciliations, accounts, recSearchFilter, recStatusFilter]);

  // Real-time statement reconciliation discrepancy preview
  const liveReconcileDiscrepancy = useMemo(() => {
    const targetAcc = accounts.find((a) => a.id === reconcileAccountId);
    if (!targetAcc) return null;
    const ledgerBig = toBigIntOrZero(targetAcc.currentBalanceCentsDecimal, targetAcc.currentBalanceCents);
    const stmtBig = parseDollarsToCentsBigInt(reconcileStatementDollars);
    if (stmtBig === null) return null;
    const discBig = stmtBig - ledgerBig;
    return {
      targetAcc,
      ledgerBig,
      stmtBig,
      discBig,
      isMatch: discBig === 0n,
    };
  }, [accounts, reconcileAccountId, reconcileStatementDollars]);

  const budgetRollup = useMemo(() => {
    let totalAllocatedBig = 0n;
    let totalSpentBig = 0n;
    let warningCount = 0;
    let overBudgetCount = 0;

    for (const b of budgets) {
      totalAllocatedBig += toBigIntOrZero(b.allocatedCentsDecimal, b.allocatedCents);
      totalSpentBig += toBigIntOrZero(b.spentCentsDecimal, b.spentCents);
      if (b.isOverBudget || b.status === 'OVER_BUDGET') overBudgetCount++;
      else if (b.isWarning || b.status === 'WARNING') warningCount++;
    }

    const totalRemainingBig = totalAllocatedBig - totalSpentBig;
    return {
      totalAllocatedCents: serializeBigIntToDecimalString(totalAllocatedBig),
      totalSpentCents: serializeBigIntToDecimalString(totalSpentBig),
      totalRemainingCents: serializeBigIntToDecimalString(totalRemainingBig),
      totalRemainingBig,
      warningCount,
      overBudgetCount,
    };
  }, [budgets]);

  const filteredBudgets = useMemo(() => {
    return budgets.filter((b) => {
      if (budgetStatusFilter !== 'ALL') {
        const isOver = Boolean(b.isOverBudget || b.status === 'OVER_BUDGET');
        const isWarn = Boolean(!isOver && (b.isWarning || b.status === 'WARNING'));
        if (budgetStatusFilter === 'OVER_BUDGET' && !isOver) return false;
        if (budgetStatusFilter === 'WARNING' && !isWarn) return false;
        if (budgetStatusFilter === 'NORMAL' && (isOver || isWarn)) return false;
      }
      if (budgetSearchQuery.trim() !== '') {
        const q = budgetSearchQuery.trim().toLowerCase();
        const catMatch = String(b.category || '').toLowerCase().includes(q);
        if (!catMatch) return false;
      }
      return true;
    });
  }, [budgets, budgetStatusFilter, budgetSearchQuery]);

  const savingsRollup = useMemo(() => {
    let totalTargetBig = 0n;
    let totalCurrentBig = 0n;
    let totalRemainingBig = 0n;
    let totalPlannedMonthlyBig = 0n;
    let completedCount = 0;
    let inProgressCount = 0;

    for (const g of savingsGoals) {
      const targetBig = toBigIntOrZero(g.targetCentsDecimal, g.targetCents);
      const currentBig = toBigIntOrZero(g.currentCentsDecimal, g.currentCents);
      const plannedBig = toBigIntOrZero(
        g.plannedMonthlyContributionCentsDecimal,
        g.plannedMonthlyContributionCents
      );
      totalTargetBig += targetBig;
      totalCurrentBig += currentBig;
      if (targetBig > currentBig) {
        totalRemainingBig += targetBig - currentBig;
      }
      totalPlannedMonthlyBig += plannedBig;
      const done = Boolean(g.isCompleted || (targetBig > 0n && currentBig >= targetBig));
      if (done) completedCount++;
      else inProgressCount++;
    }

    const overallProgressPct =
      totalTargetBig > 0n ? Math.min(100, Number((totalCurrentBig * 100n) / totalTargetBig)) : 0;

    return {
      totalTargetCents: serializeBigIntToDecimalString(totalTargetBig),
      totalCurrentCents: serializeBigIntToDecimalString(totalCurrentBig),
      totalRemainingCents: serializeBigIntToDecimalString(totalRemainingBig),
      totalPlannedMonthlyCents: serializeBigIntToDecimalString(totalPlannedMonthlyBig),
      overallProgressPct,
      completedCount,
      inProgressCount,
    };
  }, [savingsGoals]);

  const filteredSavingsGoals = useMemo(() => {
    return savingsGoals.filter((g) => {
      const targetBig = toBigIntOrZero(g.targetCentsDecimal, g.targetCents);
      const currentBig = toBigIntOrZero(g.currentCentsDecimal, g.currentCents);
      const done = Boolean(g.isCompleted || (targetBig > 0n && currentBig >= targetBig));
      if (savingsStatusFilter === 'COMPLETED' && !done) return false;
      if (savingsStatusFilter === 'ACTIVE' && done) return false;
      if (savingsSearchQuery.trim() !== '') {
        const q = savingsSearchQuery.trim().toLowerCase();
        const titleMatch = String(g.title || '').toLowerCase().includes(q);
        if (!titleMatch) return false;
      }
      return true;
    });
  }, [savingsGoals, savingsStatusFilter, savingsSearchQuery]);

  const recurringRollup = useMemo(() => {
    let monthlyIncomeBig = 0n;
    let monthlyExpenseBig = 0n;
    let activeCount = 0;
    let pausedCount = 0;
    let incomeCount = 0;
    let expenseCount = 0;
    let dueNowCount = 0;
    const now = Date.now();

    const toMonthlyEquivalent = (amtBig: bigint, interval: string): bigint => {
      switch (String(interval || 'MONTHLY').toUpperCase()) {
        case 'DAILY':
          return amtBig * 30n;
        case 'WEEKLY':
          return (amtBig * 52n) / 12n;
        case 'BIWEEKLY':
          return (amtBig * 26n) / 12n;
        case 'QUARTERLY':
          return amtBig / 3n;
        case 'ANNUAL':
          return amtBig / 12n;
        case 'MONTHLY':
        default:
          return amtBig;
      }
    };

    for (const r of recurringRules) {
      const amtBig = toBigIntOrZero(r.amountCentsDecimal, r.amountCents);
      const isInc = String(r.transactionType || 'EXPENSE').toUpperCase() === 'INCOME';
      if (isInc) incomeCount++;
      else expenseCount++;

      if (r.isActive) {
        activeCount++;
        if (r.nextDueDate && Number(r.nextDueDate) <= now) {
          dueNowCount++;
        }
        const monthlyEq = toMonthlyEquivalent(amtBig, r.recurrenceInterval || r.frequency);
        if (isInc) monthlyIncomeBig += monthlyEq;
        else monthlyExpenseBig += monthlyEq;
      } else {
        pausedCount++;
      }
    }

    const netMonthlyBig = monthlyIncomeBig - monthlyExpenseBig;
    return {
      monthlyIncomeCents: serializeBigIntToDecimalString(monthlyIncomeBig),
      monthlyExpenseCents: serializeBigIntToDecimalString(monthlyExpenseBig),
      netMonthlyCents: serializeBigIntToDecimalString(netMonthlyBig),
      netMonthlyBig,
      activeCount,
      pausedCount,
      incomeCount,
      expenseCount,
      dueNowCount,
    };
  }, [recurringRules]);

  const filteredRecurringRules = useMemo(() => {
    return recurringRules.filter((r) => {
      const isInc = String(r.transactionType || 'EXPENSE').toUpperCase() === 'INCOME';
      if (recurringFilter === 'ACTIVE' && !r.isActive) return false;
      if (recurringFilter === 'PAUSED' && r.isActive) return false;
      if (recurringFilter === 'INCOME' && !isInc) return false;
      if (recurringFilter === 'EXPENSE' && isInc) return false;
      if (recurringSearchQuery.trim() !== '') {
        const q = recurringSearchQuery.trim().toLowerCase();
        const titleMatch = String(r.title || '').toLowerCase().includes(q);
        const catMatch = String(r.category || '').toLowerCase().includes(q);
        if (!titleMatch && !catMatch) return false;
      }
      return true;
    });
  }, [recurringRules, recurringFilter, recurringSearchQuery]);

  const filteredHoldings = useMemo(() => {
    return investmentHoldings.filter((h) => {
      if (invTypeFilter !== 'ALL' && String(h.assetType || '').toUpperCase() !== invTypeFilter) {
        return false;
      }
      if (invSearchQuery.trim() !== '') {
        const q = invSearchQuery.trim().toLowerCase();
        const symMatch = String(h.symbol || '').toLowerCase().includes(q);
        const nameMatch = String(h.assetName || '').toLowerCase().includes(q);
        if (!symMatch && !nameMatch) return false;
      }
      return true;
    });
  }, [investmentHoldings, invTypeFilter, invSearchQuery]);

  // What-If Simulator integer cents calculations (pure 64-bit BigInt)
  const simCalculations = useMemo(() => {
    const incBig = parseDollarsToCentsBigInt(simIncomeDollars) ?? 0n;
    const recBig = parseDollarsToCentsBigInt(simRecurringDollars) ?? 0n;
    const variableBig = parseDollarsToCentsBigInt(simVariableDollars) ?? 0n;
    const allocBig = parseDollarsToCentsBigInt(simSavingsAllocDollars) ?? 0n;
    const availableBeforeSavingsBig = incBig - recBig - variableBig;
    const unallocatedMarginBig = availableBeforeSavingsBig - allocBig;
    return {
      inc: serializeBigIntToDecimalString(incBig),
      rec: serializeBigIntToDecimalString(recBig),
      variable: serializeBigIntToDecimalString(variableBig),
      alloc: serializeBigIntToDecimalString(allocBig),
      availableBeforeSavingsCents: serializeBigIntToDecimalString(availableBeforeSavingsBig),
      unallocatedMarginCents: serializeBigIntToDecimalString(unallocatedMarginBig),
    };
  }, [simIncomeDollars, simRecurringDollars, simVariableDollars, simSavingsAllocDollars]);

  // Filtered Transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      if (txFilterType === 'REVERSAL' && !tx.isReversal) return false;
      if (txFilterType !== 'ALL' && txFilterType !== 'REVERSAL' && tx.transactionType !== txFilterType) {
        return false;
      }
      if (txFilterAccount !== 'ALL' && tx.accountId !== txFilterAccount && tx.destinationAccountId !== txFilterAccount) {
        return false;
      }
      if (txFilterCategory !== 'ALL' && String(tx.category).toUpperCase() !== txFilterCategory) {
        return false;
      }
      if (txSearchQuery.trim()) {
        const q = txSearchQuery.trim().toLowerCase();
        const matchTitle = String(tx.title || '').toLowerCase().includes(q);
        const matchCat = String(tx.category || '').toLowerCase().includes(q);
        const matchPaidBy = String(tx.paidBy || '').toLowerCase().includes(q);
        if (!matchTitle && !matchCat && !matchPaidBy) return false;
      }
      return true;
    });
  }, [transactions, txFilterType, txFilterAccount, txFilterCategory, txSearchQuery]);

  // Set of original transaction IDs that have already been reversed
  const reversedOriginalIds = useMemo(() => {
    const set = new Set<string>();
    for (const tx of transactions) {
      if (tx.isReversal && tx.reversalOfId) {
        set.add(tx.reversalOfId);
      }
    }
    return set;
  }, [transactions]);

  // ============================================================================
  // MUTATION HANDLERS (ALL CONNECTED TO EXPRESS API WITH AUTO-REFRESH)
  // ============================================================================

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccName.trim()) {
      showFeedback('error', 'Account name is required.');
      return;
    }
    const balanceBig = parseDollarsToCentsBigInt(newAccBalanceDollars);
    if (balanceBig === null) {
      showFeedback('error', 'Enter a valid signed 64-bit dollar amount (e.g. 2500.00).');
      return;
    }
    const balanceDecimal = serializeBigIntToDecimalString(balanceBig);

    setIsAccountMutating(true);
    try {
      const res = await fetch(`/api/v1/finance/${activeFamilyId}/accounts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          name: newAccName.trim(),
          accountType: newAccType,
          institution: newAccInstitution.trim() || 'Family Treasury',
          currentBalanceCents: toSafeNumberOrNull(balanceBig) ?? balanceDecimal,
          currentBalanceCentsDecimal: balanceDecimal,
          isLiability: newAccType === 'CREDIT_CARD' || newAccType === 'LOAN',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showFeedback('error', data.message || 'Failed to create account.');
        return;
      }
      setNewAccName('');
      setNewAccInstitution('');
      setNewAccBalanceDollars('0.00');
      showFeedback('success', `Created account "${data.account.name}" with balance ${formatCents(data.account.currentBalanceCentsDecimal ?? data.account.currentBalanceCents)}.`);
      await fetchAllFinanceHubData();
      onRefreshGlobalWorkspace?.();
      window.dispatchEvent(new CustomEvent('familyos-finance-updated', { detail: { familyId: activeFamilyId } }));
    } catch {
      showFeedback('error', 'Network error while creating account.');
    } finally {
      setIsAccountMutating(false);
    }
  };

  const handleSaveAccountEdit = async (accountId: string) => {
    if (!editAccName.trim()) {
      showFeedback('error', 'Account name cannot be empty.');
      return;
    }
    setIsAccountMutating(true);
    try {
      const res = await fetch(`/api/v1/finance/${activeFamilyId}/accounts/${accountId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          name: editAccName.trim(),
          institution: editAccInstitution.trim(),
          accountType: editAccType,
          isLiability: editAccIsLiability,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showFeedback('error', data.message || 'Failed to update account details.');
        return;
      }
      setEditAccId(null);
      showFeedback('success', `Updated account details for "${data.account.name}".`);
      await fetchAllFinanceHubData();
      onRefreshGlobalWorkspace?.();
      window.dispatchEvent(new CustomEvent('familyos-finance-updated', { detail: { familyId: activeFamilyId } }));
    } catch {
      showFeedback('error', 'Failed to update account details.');
    } finally {
      setIsAccountMutating(false);
    }
  };

  const handleArchiveAccount = async (accId: string, archiveStatus: boolean) => {
    try {
      const res = await fetch(`/api/v1/finance/${activeFamilyId}/accounts/${accId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          isArchived: archiveStatus,
        }),
      });
      if (res.ok) {
        showFeedback(
          'success',
          archiveStatus ? 'Account archived.' : 'Account restored to active accounts.'
        );
        await fetchAllFinanceHubData();
        onRefreshGlobalWorkspace?.();
        window.dispatchEvent(new CustomEvent('familyos-finance-updated', { detail: { familyId: activeFamilyId } }));
      } else {
        const data = await res.json().catch(() => ({}));
        showFeedback('error', data.message || 'Failed to update account archive status.');
      }
    } catch {
      showFeedback('error', 'Network error while updating account archive status.');
    }
  };

  const handleDeleteAccountConfirm = (acc: any) => {
    setConfirmModal({
      kind: 'DELETE_ACCOUNT',
      targetId: acc.id,
      targetLabel: acc.name,
      reason: '',
    });
  };

  const handleDeleteTxConfirm = (tx: any) => {
    setConfirmModal({
      kind: 'DELETE_TX',
      targetId: tx.id,
      targetLabel: tx.title,
      amountLabel: formatCents(tx.amountCentsDecimal ?? tx.amountCents),
      reason: 'User transaction deletion',
    });
  };

  const handleQuickTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferSourceAccId || !transferDestAccId) {
      showFeedback('error', 'Select both source and destination accounts.');
      return;
    }
    if (transferSourceAccId === transferDestAccId) {
      showFeedback('error', 'Source and destination accounts must be different.');
      return;
    }
    const amtBig = parseDollarsToCentsBigInt(transferAmountDollars);
    if (!amtBig || amtBig <= 0n) {
      showFeedback('error', 'Transfer amount must be greater than $0.00.');
      return;
    }
    const amtDecimal = serializeBigIntToDecimalString(amtBig);
    const idempotencyKey = `TRANSFER:${activeFamilyId}:${transferSourceAccId}:${transferDestAccId}:${amtDecimal}:${Date.now()}`;

    try {
      const res = await fetch(`/api/v1/finance/${activeFamilyId}/transactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
          'X-Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify({
          accountId: transferSourceAccId,
          destinationAccountId: transferDestAccId,
          title: transferNotes.trim() || 'Internal Account Transfer',
          amountCents: toSafeNumberOrNull(amtBig) ?? amtDecimal,
          amountCentsDecimal: amtDecimal,
          transactionType: 'TRANSFER',
          category: 'TRANSFER',
          notes: transferNotes.trim() || undefined,
          idempotencyKey,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showFeedback('error', data.message || 'Transfer failed.');
        return;
      }
      setIsTransferModalOpen(false);
      setTransferAmountDollars('');
      setTransferNotes('');
      showFeedback('success', `Transferred ${formatCents(amtBig)} successfully.`);
      await fetchAllFinanceHubData();
      onRefreshGlobalWorkspace?.();
    } catch {
      showFeedback('error', 'Network error during account transfer.');
    }
  };

  const handleReconcileStatement = async (e: React.FormEvent) => {
    e.preventDefault();
    const statementBig = parseDollarsToCentsBigInt(reconcileStatementDollars);
    if (statementBig === null) {
      showFeedback('error', 'Enter a valid statement ending balance (e.g. 8452.50).');
      return;
    }
    const statementDecimal = serializeBigIntToDecimalString(statementBig);
    try {
      const statementEpoch = reconcileDateIso ? new Date(reconcileDateIso).getTime() : Date.now();
      const res = await fetch(`/api/v1/finance/${activeFamilyId}/accounts/${reconcileAccountId}/reconcile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          statementEndingBalanceCents: toSafeNumberOrNull(statementBig) ?? statementDecimal,
          statementEndingBalanceCentsDecimal: statementDecimal,
          statementDate: statementEpoch,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showFeedback('error', data.message || 'Statement reconciliation failed.');
        return;
      }
      const discBig = toBigIntOrZero(data.discrepancyCentsDecimal, data.discrepancyCents);
      if (discBig === 0n) {
        showFeedback('success', 'Statement reconciled with zero discrepancy ($0.00 difference).');
      } else {
        showFeedback(
          'warning',
          `Reconciliation logged with discrepancy of ${formatCents(discBig)} between statement and ledger.`
        );
      }
      await fetchAllFinanceHubData();
    } catch {
      showFeedback('error', 'Network error during statement reconciliation.');
    }
  };

  const handleRecordTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountBig = parseDollarsToCentsBigInt(txAmountDollars);
    if (amountBig === null || amountBig <= 0n) {
      showFeedback('error', 'Transaction amount must be greater than $0.00.');
      return;
    }
    const amountDecimal = serializeBigIntToDecimalString(amountBig);
    const amountCentsPayload = toSafeNumberOrNull(amountBig) ?? amountDecimal;

    // If user chose Savings Contribution mode from the Transaction bar, route to savings contribution endpoint
    if (txEntryMode === 'SAVINGS_CONTRIB') {
      try {
        const res = await fetch(`/api/v1/finance/${activeFamilyId}/savings/${txGoalId}/contribute`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${sessionToken}`,
          },
          body: JSON.stringify({
            amountCents: amountCentsPayload,
            amountCentsDecimal: amountDecimal,
            fundingAccountId: txAccountId,
            notes: txTitle.trim() || 'Savings goal contribution',
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          showFeedback('error', data.message || 'Failed to record savings contribution.');
          return;
        }
        setTxTitle('');
        setTxAmountDollars('');
        showFeedback(
          'success',
          `Recorded ${formatCents(amountBig)} savings contribution to "${data.goal.title}" (Transfer — excluded from expenses).`
        );
        await fetchAllFinanceHubData();
        onRefreshGlobalWorkspace?.();
      } catch {
        showFeedback('error', 'Network error while recording savings contribution.');
      }
      return;
    }

    const effectiveType =
      txEntryMode === 'INCOME'
        ? 'INCOME'
        : txEntryMode === 'TRANSFER'
        ? 'TRANSFER'
        : 'EXPENSE';

    const effectiveCategory =
      txEntryMode === 'TRANSFER'
        ? 'TRANSFER'
        : txEntryMode === 'BILL_PAYMENT'
        ? txCategory === 'FOOD'
          ? 'BILLS'
          : txCategory
        : txEntryMode === 'INCOME'
        ? txCategory === 'FOOD'
          ? 'SALARY'
          : txCategory
        : txCategory;

    const finalTitle =
      txTitle.trim() ||
      (txEntryMode === 'TRANSFER'
        ? 'Internal Account Transfer'
        : txEntryMode === 'BILL_PAYMENT'
        ? `Bill Payment (${effectiveCategory})`
        : `${effectiveType} (${effectiveCategory})`);

    if (effectiveType === 'TRANSFER' && txAccountId === txDestAccountId) {
      showFeedback('error', 'Internal transfers require a different destination account.');
      return;
    }

    const idempotencyKey = `WEB-TX:${activeFamilyId}:${effectiveType}:${amountDecimal}:${Date.now()}`;

    try {
      const res = await fetch(`/api/v1/finance/${activeFamilyId}/transactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
          'X-Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify({
          accountId: txAccountId,
          destinationAccountId: effectiveType === 'TRANSFER' ? txDestAccountId : null,
          title: finalTitle,
          amountCents: amountCentsPayload,
          amountCentsDecimal: amountDecimal,
          transactionType: effectiveType,
          category: effectiveCategory,
          notes: txNotes.trim() || undefined,
          idempotencyKey,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showFeedback('error', data.message || 'Failed to record transaction.');
        return;
      }
      setTxTitle('');
      setTxAmountDollars('');
      setTxNotes('');
      setIsAddTxModalOpen(false);
      showFeedback(
        'success',
        `Recorded ${effectiveType.toLowerCase()} "${data.transaction.title}" (${formatCents(amountBig)}).`
      );
      await fetchAllFinanceHubData();
      onRefreshGlobalWorkspace?.();
      window.dispatchEvent(new CustomEvent('familyos-finance-updated', { detail: { familyId: activeFamilyId } }));
    } catch {
      showFeedback('error', 'Network error while posting transaction.');
    }
  };

  const handleSaveTxEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTx || !editingTx.title.trim()) {
      showFeedback('error', 'Transaction title is required.');
      return;
    }
    try {
      const res = await fetch(`/api/v1/finance/${activeFamilyId}/transactions/${editingTx.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          title: editingTx.title.trim(),
          category: editingTx.category,
          notes: editingTx.notes || '',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showFeedback('error', data.message || 'Failed to update transaction.');
        return;
      }
      setEditingTx(null);
      showFeedback('success', `Updated transaction "${data.transaction.title}".`);
      await fetchAllFinanceHubData();
      onRefreshGlobalWorkspace?.();
      window.dispatchEvent(new CustomEvent('familyos-finance-updated', { detail: { familyId: activeFamilyId } }));
    } catch {
      showFeedback('error', 'Network error while updating transaction.');
    }
  };

  const executeConfirmedAction = async () => {
    if (!confirmModal) return;

    if (confirmModal.kind === 'REVERSE_TX') {
      try {
        const res = await fetch(
          `/api/v1/finance/${activeFamilyId}/transactions/${confirmModal.targetId}/reverse`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${sessionToken}`,
            },
            body: JSON.stringify({
              reason: confirmModal.reason.trim() || 'User-confirmed audit reversal',
            }),
          }
        );
        const data = await res.json();
        setConfirmModal(null);
        if (!res.ok) {
          showFeedback('error', data.message || 'Audit reversal rejected.');
          return;
        }
        showFeedback(
          'success',
          `Posted compensating audit reversal for ${confirmModal.targetLabel}. Original ledger entry preserved.`
        );
        await fetchAllFinanceHubData();
        onRefreshGlobalWorkspace?.();
        window.dispatchEvent(new CustomEvent('familyos-finance-updated', { detail: { familyId: activeFamilyId } }));
      } catch {
        setConfirmModal(null);
        showFeedback('error', 'Network error while reversing transaction.');
      }
    } else if (confirmModal.kind === 'DELETE_TX') {
      try {
        const res = await fetch(
          `/api/v1/finance/${activeFamilyId}/transactions/${confirmModal.targetId}`,
          {
            method: 'DELETE',
            headers: {
              Authorization: `Bearer ${sessionToken}`,
            },
          }
        );
        setConfirmModal(null);
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          showFeedback('error', errData.message || 'Failed to delete transaction.');
          return;
        }
        showFeedback('success', `Deleted transaction "${confirmModal.targetLabel}" and restored account balance.`);
        await fetchAllFinanceHubData();
        onRefreshGlobalWorkspace?.();
        window.dispatchEvent(new CustomEvent('familyos-finance-updated', { detail: { familyId: activeFamilyId } }));
      } catch {
        setConfirmModal(null);
        showFeedback('error', 'Network error while deleting transaction.');
      }
    } else if (confirmModal.kind === 'DELETE_HOLDING') {
      try {
        const res = await fetch(
          `/api/v1/finance/${activeFamilyId}/investments/${confirmModal.targetId}`,
          {
            method: 'DELETE',
            headers: {
              Authorization: `Bearer ${sessionToken}`,
            },
          }
        );
        setConfirmModal(null);
        if (!res.ok) {
          showFeedback('error', 'Failed to archive investment holding.');
          return;
        }
        showFeedback('success', `Soft-deleted holding "${confirmModal.targetLabel}".`);
        await fetchAllFinanceHubData();
        onRefreshGlobalWorkspace?.();
        window.dispatchEvent(new CustomEvent('familyos-finance-updated', { detail: { familyId: activeFamilyId } }));
      } catch {
        setConfirmModal(null);
        showFeedback('error', 'Network error while removing holding.');
      }
    } else if (confirmModal.kind === 'DELETE_ACCOUNT') {
      try {
        const res = await fetch(
          `/api/v1/finance/${activeFamilyId}/accounts/${confirmModal.targetId}`,
          {
            method: 'DELETE',
            headers: {
              Authorization: `Bearer ${sessionToken}`,
            },
          }
        );
        setConfirmModal(null);
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          showFeedback('error', errData.message || 'Failed to delete financial account.');
          return;
        }
        showFeedback('success', `Deleted financial account "${confirmModal.targetLabel}".`);
        await fetchAllFinanceHubData();
        onRefreshGlobalWorkspace?.();
        window.dispatchEvent(new CustomEvent('familyos-finance-updated', { detail: { familyId: activeFamilyId } }));
      } catch {
        setConfirmModal(null);
        showFeedback('error', 'Network error while deleting financial account.');
      }
    } else if (confirmModal.kind === 'DELETE_BUDGET') {
      try {
        const res = await fetch(
          `/api/v1/finance/${activeFamilyId}/budgets/${confirmModal.targetId}`,
          {
            method: 'DELETE',
            headers: {
              Authorization: `Bearer ${sessionToken}`,
            },
          }
        );
        setConfirmModal(null);
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          showFeedback('error', errData.message || 'Failed to delete budget envelope.');
          return;
        }
        showFeedback('success', `Deleted "${confirmModal.targetLabel}" budget envelope.`);
        await fetchAllFinanceHubData();
        onRefreshGlobalWorkspace?.();
        window.dispatchEvent(new CustomEvent('familyos-finance-updated', { detail: { familyId: activeFamilyId } }));
      } catch {
        setConfirmModal(null);
        showFeedback('error', 'Network error while deleting budget envelope.');
      }
    } else if (confirmModal.kind === 'DELETE_GOAL') {
      try {
        const res = await fetch(
          `/api/v1/finance/${activeFamilyId}/savings/${confirmModal.targetId}`,
          {
            method: 'DELETE',
            headers: {
              Authorization: `Bearer ${sessionToken}`,
            },
          }
        );
        setConfirmModal(null);
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          showFeedback('error', errData.message || 'Failed to delete savings goal.');
          return;
        }
        showFeedback('success', `Deleted savings goal "${confirmModal.targetLabel}".`);
        await fetchAllFinanceHubData();
        onRefreshGlobalWorkspace?.();
        window.dispatchEvent(new CustomEvent('familyos-finance-updated', { detail: { familyId: activeFamilyId } }));
      } catch {
        setConfirmModal(null);
        showFeedback('error', 'Network error while deleting savings goal.');
      }
    } else if (confirmModal.kind === 'DELETE_RULE') {
      try {
        const res = await fetch(
          `/api/v1/finance/${activeFamilyId}/recurring/${confirmModal.targetId}`,
          {
            method: 'DELETE',
            headers: {
              Authorization: `Bearer ${sessionToken}`,
            },
          }
        );
        setConfirmModal(null);
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          showFeedback('error', errData.message || 'Failed to delete recurring schedule.');
          return;
        }
        showFeedback('success', `Deleted recurring schedule "${confirmModal.targetLabel}".`);
        await fetchAllFinanceHubData();
        onRefreshGlobalWorkspace?.();
        window.dispatchEvent(new CustomEvent('familyos-finance-updated', { detail: { familyId: activeFamilyId } }));
      } catch {
        setConfirmModal(null);
        showFeedback('error', 'Network error while deleting recurring schedule.');
      }
    }
  };

  const handleSaveBudgetEnvelope = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCategory = budgetCatInput.trim().toUpperCase();
    if (!cleanCategory) {
      showFeedback('error', 'Budget category name is required.');
      return;
    }
    const allocatedBig = parseDollarsToCentsBigInt(budgetAllocDollars);
    if (allocatedBig === null || allocatedBig < 0n) {
      showFeedback('error', 'Enter a valid non-negative envelope allocation ($0.00 or more).');
      return;
    }
    if (!Number.isFinite(budgetThresholdPct) || budgetThresholdPct < 50 || budgetThresholdPct > 100) {
      showFeedback('error', 'Alert threshold must be between 50% and 100%.');
      return;
    }
    const allocatedDecimal = serializeBigIntToDecimalString(allocatedBig);
    const existing = budgets.find(
      (b) => String(b.category).toUpperCase() === cleanCategory
    );
    setIsBudgetMutating(true);
    try {
      const res = await fetch(`/api/v1/finance/${activeFamilyId}/budgets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          category: cleanCategory,
          allocatedCents: toSafeNumberOrNull(allocatedBig) ?? allocatedDecimal,
          allocatedCentsDecimal: allocatedDecimal,
          spentCents: existing ? existing.spentCents : 0,
          alertThresholdPercentage: Math.round(budgetThresholdPct),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showFeedback('error', data.message || 'Failed to save budget envelope.');
        return;
      }
      setIsAddBudgetModalOpen(false);
      setBudgetCatInput('');
      setBudgetAllocDollars('400.00');
      setBudgetThresholdPct(80);
      showFeedback(
        'success',
        `Saved ${data.budget.category} envelope budget (${formatCents(data.budget.allocatedCentsDecimal ?? data.budget.allocatedCents)} limit).`
      );
      await fetchAllFinanceHubData();
      onRefreshGlobalWorkspace?.();
      window.dispatchEvent(new CustomEvent('familyos-finance-updated', { detail: { familyId: activeFamilyId } }));
    } catch {
      showFeedback('error', 'Network error while saving budget envelope.');
    } finally {
      setIsBudgetMutating(false);
    }
  };

  const handleUpdateBudgetEnvelope = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBudget) return;
    const cleanCategory = editingBudget.category.trim().toUpperCase();
    if (!cleanCategory) {
      showFeedback('error', 'Budget category name is required.');
      return;
    }
    const allocatedBig = parseDollarsToCentsBigInt(editingBudget.allocatedDollars);
    if (allocatedBig === null || allocatedBig < 0n) {
      showFeedback('error', 'Enter a valid non-negative monthly allocation ($0.00 or more).');
      return;
    }
    const spentBig = parseDollarsToCentsBigInt(editingBudget.spentDollars);
    if (spentBig === null || spentBig < 0n) {
      showFeedback('error', 'Enter a valid non-negative spent amount ($0.00 or more).');
      return;
    }
    const threshold = Math.round(Number(editingBudget.alertThresholdPercentage));
    if (!Number.isFinite(threshold) || threshold < 50 || threshold > 100) {
      showFeedback('error', 'Alert threshold must be between 50% and 100%.');
      return;
    }

    const allocatedDecimal = serializeBigIntToDecimalString(allocatedBig);
    const spentDecimal = serializeBigIntToDecimalString(spentBig);

    setIsBudgetMutating(true);
    try {
      const res = await fetch(`/api/v1/finance/${activeFamilyId}/budgets/${editingBudget.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          category: cleanCategory,
          allocatedCents: toSafeNumberOrNull(allocatedBig) ?? allocatedDecimal,
          allocatedCentsDecimal: allocatedDecimal,
          spentCents: toSafeNumberOrNull(spentBig) ?? spentDecimal,
          spentCentsDecimal: spentDecimal,
          alertThresholdPercentage: threshold,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showFeedback('error', data.message || 'Failed to update budget envelope.');
        return;
      }
      setEditingBudget(null);
      showFeedback(
        'success',
        `Updated ${data.budget.category} envelope (${formatCents(data.budget.allocatedCentsDecimal ?? data.budget.allocatedCents)} monthly limit).`
      );
      await fetchAllFinanceHubData();
      onRefreshGlobalWorkspace?.();
      window.dispatchEvent(new CustomEvent('familyos-finance-updated', { detail: { familyId: activeFamilyId } }));
    } catch {
      showFeedback('error', 'Network error while updating budget envelope.');
    } finally {
      setIsBudgetMutating(false);
    }
  };

  const handleDeleteBudgetConfirm = (b: any) => {
    setConfirmModal({
      kind: 'DELETE_BUDGET',
      targetId: b.id,
      targetLabel: b.category,
      amountLabel: formatCents(b.allocatedCentsDecimal ?? b.allocatedCents),
      reason: 'User deleted budget envelope',
    });
  };

  const handleCreateSavingsGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGoalTitle.trim()) {
      showFeedback('error', 'Savings goal title is required.');
      return;
    }
    const targetBig = parseDollarsToCentsBigInt(newGoalTargetDollars);
    const currentBig = parseDollarsToCentsBigInt(newGoalCurrentDollars);
    const plannedMonthlyBig = parseDollarsToCentsBigInt(newGoalPlannedMonthlyDollars);

    if (targetBig === null || targetBig <= 0n) {
      showFeedback('error', 'Target amount must be greater than $0.00.');
      return;
    }
    if (currentBig === null || currentBig < 0n) {
      showFeedback('error', 'Opening saved balance must be $0.00 or more.');
      return;
    }
    if (plannedMonthlyBig === null || plannedMonthlyBig < 0n) {
      showFeedback('error', 'Planned monthly allocation must be $0.00 or more.');
      return;
    }

    const targetDecimal = serializeBigIntToDecimalString(targetBig);
    const currentDecimal = serializeBigIntToDecimalString(currentBig);
    const plannedDecimal = serializeBigIntToDecimalString(plannedMonthlyBig);

    setIsSavingsMutating(true);
    try {
      const targetDate = newGoalTargetDateIso ? new Date(newGoalTargetDateIso).getTime() : null;
      const res = await fetch(`/api/v1/finance/${activeFamilyId}/savings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          title: newGoalTitle.trim(),
          targetCents: toSafeNumberOrNull(targetBig) ?? targetDecimal,
          targetCentsDecimal: targetDecimal,
          currentCents: toSafeNumberOrNull(currentBig) ?? currentDecimal,
          currentCentsDecimal: currentDecimal,
          plannedMonthlyContributionCents: toSafeNumberOrNull(plannedMonthlyBig) ?? plannedDecimal,
          plannedMonthlyContributionCentsDecimal: plannedDecimal,
          targetDate,
          linkedAccountId: newGoalLinkedAccountId || 'acc-2',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showFeedback('error', data.message || 'Failed to create savings goal.');
        return;
      }
      setIsAddGoalModalOpen(false);
      setNewGoalTitle('');
      setNewGoalTargetDollars('5000.00');
      setNewGoalCurrentDollars('0.00');
      setNewGoalPlannedMonthlyDollars('250.00');
      showFeedback(
        'success',
        `Created savings goal "${data.goal.title}" with suggested monthly target ${formatCents(
          data.goal.suggestedMonthlyContributionCentsDecimal ?? data.goal.suggestedMonthlyContributionCents
        )}.`
      );
      await fetchAllFinanceHubData();
      onRefreshGlobalWorkspace?.();
      window.dispatchEvent(new CustomEvent('familyos-finance-updated', { detail: { familyId: activeFamilyId } }));
    } catch {
      showFeedback('error', 'Network error while creating savings goal.');
    } finally {
      setIsSavingsMutating(false);
    }
  };

  const handleUpdateSavingsGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGoal) return;
    const cleanTitle = editingGoal.title.trim();
    if (!cleanTitle) {
      showFeedback('error', 'Savings goal title is required.');
      return;
    }
    const targetBig = parseDollarsToCentsBigInt(editingGoal.targetDollars);
    const currentBig = parseDollarsToCentsBigInt(editingGoal.currentDollars);
    const plannedBig = parseDollarsToCentsBigInt(editingGoal.plannedMonthlyDollars);

    if (targetBig === null || targetBig <= 0n) {
      showFeedback('error', 'Target amount must be greater than $0.00.');
      return;
    }
    if (currentBig === null || currentBig < 0n) {
      showFeedback('error', 'Current saved balance must be $0.00 or more.');
      return;
    }
    if (plannedBig === null || plannedBig < 0n) {
      showFeedback('error', 'Planned monthly allocation must be $0.00 or more.');
      return;
    }

    const targetDecimal = serializeBigIntToDecimalString(targetBig);
    const currentDecimal = serializeBigIntToDecimalString(currentBig);
    const plannedDecimal = serializeBigIntToDecimalString(plannedBig);
    const targetDate = editingGoal.targetDateIso
      ? new Date(editingGoal.targetDateIso).getTime()
      : null;

    setIsSavingsMutating(true);
    try {
      const res = await fetch(`/api/v1/finance/${activeFamilyId}/savings/${editingGoal.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          title: cleanTitle,
          targetCents: toSafeNumberOrNull(targetBig) ?? targetDecimal,
          targetCentsDecimal: targetDecimal,
          currentCents: toSafeNumberOrNull(currentBig) ?? currentDecimal,
          currentCentsDecimal: currentDecimal,
          plannedMonthlyContributionCents: toSafeNumberOrNull(plannedBig) ?? plannedDecimal,
          plannedMonthlyContributionCentsDecimal: plannedDecimal,
          targetDate,
          linkedAccountId: editingGoal.linkedAccountId || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showFeedback('error', data.message || 'Failed to update savings goal.');
        return;
      }
      setEditingGoal(null);
      showFeedback(
        'success',
        `Updated savings goal "${data.goal.title}" (${formatCents(data.goal.currentCentsDecimal ?? data.goal.currentCents)} / ${formatCents(data.goal.targetCentsDecimal ?? data.goal.targetCents)}).`
      );
      await fetchAllFinanceHubData();
      onRefreshGlobalWorkspace?.();
      window.dispatchEvent(new CustomEvent('familyos-finance-updated', { detail: { familyId: activeFamilyId } }));
    } catch {
      showFeedback('error', 'Network error while updating savings goal.');
    } finally {
      setIsSavingsMutating(false);
    }
  };

  const handleDeleteSavingsGoalConfirm = (goal: any) => {
    setConfirmModal({
      kind: 'DELETE_GOAL',
      targetId: goal.id,
      targetLabel: goal.title,
      amountLabel: `${formatCents(goal.currentCentsDecimal ?? goal.currentCents)} saved of ${formatCents(goal.targetCentsDecimal ?? goal.targetCents)}`,
      reason: 'User deleted savings goal',
    });
  };

  const handleContributeToSavings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contribGoalId) {
      showFeedback('error', 'Select a target savings goal.');
      return;
    }
    const amountBig = parseDollarsToCentsBigInt(contribAmountDollars);
    if (amountBig === null || amountBig <= 0n) {
      showFeedback('error', 'Contribution amount must be greater than $0.00.');
      return;
    }
    const amountDecimal = serializeBigIntToDecimalString(amountBig);
    setIsSavingsMutating(true);
    try {
      const res = await fetch(`/api/v1/finance/${activeFamilyId}/savings/${contribGoalId}/contribute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          amountCents: toSafeNumberOrNull(amountBig) ?? amountDecimal,
          amountCentsDecimal: amountDecimal,
          fundingAccountId: contribFundingAccountId || null,
          notes: contribNotes.trim() || 'Savings goal contribution',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showFeedback('error', data.message || 'Failed to record contribution.');
        return;
      }
      setIsContributeModalOpen(false);
      showFeedback(
        'success',
        `Contributed ${formatCents(amountBig)} to "${data.goal.title}" (${data.progressPercentage}% complete).`
      );
      await fetchAllFinanceHubData();
      onRefreshGlobalWorkspace?.();
      window.dispatchEvent(new CustomEvent('familyos-finance-updated', { detail: { familyId: activeFamilyId } }));
    } catch {
      showFeedback('error', 'Network error while contributing to savings goal.');
    } finally {
      setIsSavingsMutating(false);
    }
  };

  const handleCheckOffInstallment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!installmentModalGoal) return;
    const amountBig = parseDollarsToCentsBigInt(installmentAmtDollars);
    if (amountBig === null || amountBig <= 0n) {
      showFeedback('error', 'Installment amount must be greater than $0.00.');
      return;
    }
    const amountDecimal = serializeBigIntToDecimalString(amountBig);
    setIsSavingsMutating(true);
    try {
      const res = await fetch(`/api/v1/finance/${activeFamilyId}/savings/${installmentModalGoal.id}/contribute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          amountCents: toSafeNumberOrNull(amountBig) ?? amountDecimal,
          amountCentsDecimal: amountDecimal,
          fundingAccountId: installmentFundingAccId || null,
          notes: installmentNotesVal.trim() || 'Monthly savings installment check-off',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showFeedback('error', data.message || 'Failed to record installment transfer.');
        return;
      }
      setInstallmentModalGoal(null);
      showFeedback(
        'success',
        `Recorded real transfer of ${formatCents(amountBig)} to savings goal "${data.goal.title}" (${data.progressPercentage}% complete).`
      );
      await fetchAllFinanceHubData();
      onRefreshGlobalWorkspace?.();
      window.dispatchEvent(new CustomEvent('familyos-finance-updated', { detail: { familyId: activeFamilyId } }));
    } catch {
      showFeedback('error', 'Network error while recording installment transfer.');
    } finally {
      setIsSavingsMutating(false);
    }
  };

  const handleCreateRecurringRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRuleTitle.trim()) {
      showFeedback('error', 'Schedule title is required.');
      return;
    }
    if (!newRuleCategory.trim()) {
      showFeedback('error', 'Category is required.');
      return;
    }
    const amountBig = parseDollarsToCentsBigInt(newRuleAmountDollars);
    if (amountBig === null || amountBig <= 0n) {
      showFeedback('error', 'Recurring amount must be greater than $0.00.');
      return;
    }
    const amountDecimal = serializeBigIntToDecimalString(amountBig);
    setIsRecurringMutating(true);
    try {
      const nextDueDate = newRuleDueDateIso ? new Date(newRuleDueDateIso).getTime() : Date.now();
      const res = await fetch(`/api/v1/finance/${activeFamilyId}/recurring`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          title: newRuleTitle.trim(),
          accountId: newRuleAccountId,
          amountCents: toSafeNumberOrNull(amountBig) ?? amountDecimal,
          amountCentsDecimal: amountDecimal,
          transactionType: newRuleType,
          category: newRuleCategory.trim().toUpperCase(),
          recurrenceInterval: newRuleFrequency,
          nextDueDate,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showFeedback('error', data.message || 'Failed to create recurring schedule.');
        return;
      }
      setIsAddRuleModalOpen(false);
      setNewRuleTitle('');
      showFeedback('success', `Created recurring ${newRuleFrequency.toLowerCase()} rule "${data.rule.title}".`);
      await fetchAllFinanceHubData();
      onRefreshGlobalWorkspace?.();
      window.dispatchEvent(new CustomEvent('familyos-finance-updated', { detail: { familyId: activeFamilyId } }));
    } catch {
      showFeedback('error', 'Network error while creating recurring schedule.');
    } finally {
      setIsRecurringMutating(false);
    }
  };

  const handleUpdateRecurringRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRule) return;
    if (!editingRule.title.trim()) {
      showFeedback('error', 'Schedule title is required.');
      return;
    }
    if (!editingRule.category.trim()) {
      showFeedback('error', 'Category is required.');
      return;
    }
    const amountBig = parseDollarsToCentsBigInt(editingRule.amountDollars);
    if (amountBig === null || amountBig <= 0n) {
      showFeedback('error', 'Recurring amount must be greater than $0.00.');
      return;
    }
    const amountDecimal = serializeBigIntToDecimalString(amountBig);
    const nextDueDate = editingRule.dueDateIso
      ? new Date(editingRule.dueDateIso).getTime()
      : Date.now();

    setIsRecurringMutating(true);
    try {
      const res = await fetch(`/api/v1/finance/${activeFamilyId}/recurring/${editingRule.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          title: editingRule.title.trim(),
          accountId: editingRule.accountId,
          transactionType: editingRule.transactionType,
          category: editingRule.category.trim().toUpperCase(),
          recurrenceInterval: editingRule.frequency,
          amountCents: toSafeNumberOrNull(amountBig) ?? amountDecimal,
          amountCentsDecimal: amountDecimal,
          nextDueDate,
          isActive: editingRule.isActive,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showFeedback('error', data.message || 'Failed to update recurring schedule.');
        return;
      }
      setEditingRule(null);
      showFeedback(
        'success',
        `Updated recurring schedule "${data.rule.title}" (${formatCents(data.rule.amountCentsDecimal ?? data.rule.amountCents)}).`
      );
      await fetchAllFinanceHubData();
      onRefreshGlobalWorkspace?.();
      window.dispatchEvent(new CustomEvent('familyos-finance-updated', { detail: { familyId: activeFamilyId } }));
    } catch {
      showFeedback('error', 'Network error while updating recurring schedule.');
    } finally {
      setIsRecurringMutating(false);
    }
  };

  const handleDeleteRecurringRuleConfirm = (rule: any) => {
    setConfirmModal({
      kind: 'DELETE_RULE',
      targetId: rule.id,
      targetLabel: rule.title,
      amountLabel: `${formatCents(rule.amountCentsDecimal ?? rule.amountCents)} (${rule.recurrenceInterval || rule.frequency})`,
      reason: 'User deleted recurring schedule',
    });
  };

  const handleToggleRecurringRule = async (rule: any) => {
    setIsRecurringMutating(true);
    try {
      const res = await fetch(`/api/v1/finance/${activeFamilyId}/recurring/${rule.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          isActive: !rule.isActive,
        }),
      });
      if (res.ok) {
        showFeedback(
          'success',
          `Recurring schedule "${rule.title}" ${!rule.isActive ? 'resumed (Active)' : 'paused'}.`
        );
        await fetchAllFinanceHubData();
        onRefreshGlobalWorkspace?.();
        window.dispatchEvent(new CustomEvent('familyos-finance-updated', { detail: { familyId: activeFamilyId } }));
      } else {
        const errData = await res.json().catch(() => ({}));
        showFeedback('error', errData.message || 'Failed to update recurring rule status.');
      }
    } catch {
      showFeedback('error', 'Failed to update recurring rule status.');
    } finally {
      setIsRecurringMutating(false);
    }
  };

  const handleGenerateRecurringTransaction = async (rule: any) => {
    setIsRecurringMutating(true);
    try {
      const res = await fetch(`/api/v1/finance/${activeFamilyId}/recurring/${rule.id}/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showFeedback('error', data.message || 'Failed to generate recurring transaction.');
        return;
      }
      if (data.alreadyGenerated) {
        showFeedback(
          'warning',
          `Idempotency Guard (${data.idempotencyKey || 'REC_GEN'}): Cycle transaction for "${rule.title}" was already posted.`
        );
      } else {
        showFeedback(
          'success',
          `Posted scheduled transaction "${data.transaction.title}" (${formatCents(
            data.transaction.amountCentsDecimal ?? data.transaction.amountCents
          )}) and advanced next due date.`
        );
      }
      await fetchAllFinanceHubData();
      onRefreshGlobalWorkspace?.();
      window.dispatchEvent(new CustomEvent('familyos-finance-updated', { detail: { familyId: activeFamilyId } }));
    } catch {
      showFeedback('error', 'Network error while generating recurring transaction.');
    } finally {
      setIsRecurringMutating(false);
    }
  };

  const handleRecordInvestmentPurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invSymbol.trim() || !invAssetName.trim()) {
      showFeedback('error', 'Ticker symbol and asset name are required.');
      return;
    }
    const quantityBig = parseSharesToMicrosharesBigInt(invSharesInput);
    const costBasisBig = parseDollarsToCentsBigInt(invCostBasisDollars);
    const currentPriceBig = parseDollarsToCentsBigInt(invUnitPriceDollars);

    if (!quantityBig || quantityBig <= 0n) {
      showFeedback('error', 'Enter a valid share quantity (up to 6 decimal places).');
      return;
    }
    if (!costBasisBig || costBasisBig <= 0n || !currentPriceBig || currentPriceBig <= 0n) {
      showFeedback('error', 'Total cost basis and current unit market price must be positive.');
      return;
    }

    const quantityDec = serializeBigIntToDecimalString(quantityBig);
    const costBasisDec = serializeBigIntToDecimalString(costBasisBig);
    const priceDec = serializeBigIntToDecimalString(currentPriceBig);

    setIsInvMutating(true);
    try {
      const res = await fetch(`/api/v1/finance/${activeFamilyId}/investments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          symbol: invSymbol.trim().toUpperCase(),
          assetName: invAssetName.trim(),
          assetType: invAssetType,
          quantityMicroshares: toSafeNumberOrNull(quantityBig) ?? quantityDec,
          quantityMicrosharesDecimal: quantityDec,
          costBasisCents: toSafeNumberOrNull(costBasisBig) ?? costBasisDec,
          costBasisCentsDecimal: costBasisDec,
          currentPriceCents: toSafeNumberOrNull(currentPriceBig) ?? priceDec,
          currentPriceCentsDecimal: priceDec,
          fundingAccountId: invFundingAccountId || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showFeedback('error', data.message || 'Failed to record investment holding.');
        return;
      }
      setIsAddHoldingModalOpen(false);
      setInvSymbol('');
      setInvAssetName('');
      showFeedback(
        'success',
        `Recorded ${data.holding.symbol} (${formatMicroshares(
          data.holding.quantityMicrosharesDecimal ?? data.holding.quantityMicroshares,
          true
        )} shares, cost basis ${formatCents(data.holding.costBasisCentsDecimal ?? data.holding.costBasisCents)}).`
      );
      await fetchAllFinanceHubData();
      onRefreshGlobalWorkspace?.();
      window.dispatchEvent(new CustomEvent('familyos-finance-updated', { detail: { familyId: activeFamilyId } }));
    } catch {
      showFeedback('error', 'Network error while recording investment purchase.');
    } finally {
      setIsInvMutating(false);
    }
  };

  const handleUpdateInvestmentHolding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingHolding) return;
    if (!editingHolding.symbol.trim() || !editingHolding.assetName.trim()) {
      showFeedback('error', 'Ticker symbol and asset name are required.');
      return;
    }
    const quantityBig = parseSharesToMicrosharesBigInt(editingHolding.sharesInput);
    const costBasisBig = parseDollarsToCentsBigInt(editingHolding.costBasisDollars);
    const currentPriceBig = parseDollarsToCentsBigInt(editingHolding.unitPriceDollars);

    if (!quantityBig || quantityBig <= 0n) {
      showFeedback('error', 'Enter a valid share quantity (up to 6 decimal places).');
      return;
    }
    if (!costBasisBig || costBasisBig <= 0n || !currentPriceBig || currentPriceBig <= 0n) {
      showFeedback('error', 'Total cost basis and unit market price must be greater than $0.00.');
      return;
    }

    const quantityDec = serializeBigIntToDecimalString(quantityBig);
    const costBasisDec = serializeBigIntToDecimalString(costBasisBig);
    const priceDec = serializeBigIntToDecimalString(currentPriceBig);

    setIsInvMutating(true);
    try {
      const res = await fetch(`/api/v1/finance/${activeFamilyId}/investments/${editingHolding.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          symbol: editingHolding.symbol.trim().toUpperCase(),
          assetName: editingHolding.assetName.trim(),
          assetType: editingHolding.assetType,
          quantityMicroshares: toSafeNumberOrNull(quantityBig) ?? quantityDec,
          quantityMicrosharesDecimal: quantityDec,
          costBasisCents: toSafeNumberOrNull(costBasisBig) ?? costBasisDec,
          costBasisCentsDecimal: costBasisDec,
          currentPriceCents: toSafeNumberOrNull(currentPriceBig) ?? priceDec,
          currentPriceCentsDecimal: priceDec,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showFeedback('error', data.message || 'Failed to update investment holding.');
        return;
      }
      setEditingHolding(null);
      showFeedback(
        'success',
        `Updated ${data.holding.symbol} position (${formatMicroshares(
          data.holding.quantityMicrosharesDecimal ?? data.holding.quantityMicroshares,
          true
        )} units · Valuation ${formatCents(data.holding.currentValuationCentsDecimal ?? data.holding.currentValuationCents)}).`
      );
      await fetchAllFinanceHubData();
      onRefreshGlobalWorkspace?.();
      window.dispatchEvent(new CustomEvent('familyos-finance-updated', { detail: { familyId: activeFamilyId } }));
    } catch {
      showFeedback('error', 'Network error while updating investment holding.');
    } finally {
      setIsInvMutating(false);
    }
  };

  const handleUpdateMarketPrice = async (holding: any) => {
    const rawInput = priceUpdateMap[holding.id] ?? '';
    const newPriceBig = parseDollarsToCentsBigInt(rawInput);
    if (!newPriceBig || newPriceBig <= 0n) {
      showFeedback('error', 'Enter a valid positive unit market price.');
      return;
    }
    const priceDec = serializeBigIntToDecimalString(newPriceBig);
    setIsInvMutating(true);
    try {
      const res = await fetch(`/api/v1/finance/${activeFamilyId}/investments/${holding.id}/price`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          currentPriceCents: toSafeNumberOrNull(newPriceBig) ?? priceDec,
          currentPriceCentsDecimal: priceDec,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showFeedback('error', data.message || 'Failed to update market price.');
        return;
      }
      showFeedback(
        'success',
        `Updated ${data.holding.symbol} unit price to ${formatCents(
          data.holding.currentPriceCentsDecimal ?? data.holding.currentPriceCents
        )}. Cost basis preserved at ${formatCents(data.holding.costBasisCentsDecimal ?? data.holding.costBasisCents)}.`
      );
      await fetchAllFinanceHubData();
      onRefreshGlobalWorkspace?.();
      window.dispatchEvent(new CustomEvent('familyos-finance-updated', { detail: { familyId: activeFamilyId } }));
    } catch {
      showFeedback('error', 'Network error while updating market price.');
    } finally {
      setIsInvMutating(false);
    }
  };

  // ============================================================================
  // NAVIGATION TABS DEFINITION
  // ============================================================================
  const SECTIONS: Array<{ id: FinanceHubSection; label: string; icon: any }> = [
    { id: 'overview', label: '1. Overview', icon: DollarSign },
    { id: 'accounts', label: '2. Accounts', icon: Landmark },
    { id: 'transactions', label: '3. Transactions', icon: ArrowLeftRight },
    { id: 'budgets', label: '4. Budgets', icon: PieChart },
    { id: 'savings', label: '5. Savings', icon: PiggyBank },
    { id: 'recurring', label: '6. Recurring', icon: CalendarClock },
    { id: 'investments', label: '7. Investments', icon: TrendingUp },
  ];

  const summary = summaryData?.summary || {
    actualIncomeCents: 0,
    actualIncomeCentsDecimal: '0',
    actualExpenseCents: 0,
    actualExpenseCentsDecimal: '0',
    actualNetCashFlowCents: 0,
    actualNetCashFlowCentsDecimal: '0',
    totalAssetsCents: 0,
    totalAssetsCentsDecimal: '0',
    totalLiabilitiesCents: 0,
    totalLiabilitiesCentsDecimal: '0',
    netWorthCents: 0,
    netWorthCentsDecimal: '0',
    projectedMonthlyRecurringIncomeCents: 0,
    projectedMonthlyRecurringIncomeCentsDecimal: '0',
    projectedMonthlyRecurringExpenseCents: 0,
    projectedMonthlyRecurringExpenseCentsDecimal: '0',
    plannedVariableExpensesCents: 0,
    plannedVariableExpensesCentsDecimal: '0',
    availablePlannedCashFlowCents: 0,
    availablePlannedCashFlowCentsDecimal: '0',
    plannedAllocationsCents: 0,
    plannedAllocationsCentsDecimal: '0',
    discretionaryMarginCents: 0,
    discretionaryMarginCentsDecimal: '0',
  };

  const combinedHouseholdNetWorthDecimal =
    summary.netWorthCentsDecimal ?? summaryData?.netWorthCentsDecimal ?? summary.netWorthCents;
  const actualNetCashFlowBig = toBigIntOrZero(summary.actualNetCashFlowCentsDecimal, summary.actualNetCashFlowCents);

  return (
    <section aria-label="FamilyOS Finance Hub" className="space-y-6">

      {/* Feedback Notification Banner */}
      {feedbackBanner && (
        <div
          role="status"
          aria-live="polite"
          className={`rounded-xl p-4 border flex items-center justify-between text-xs font-medium ${
            feedbackBanner.tone === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
              : feedbackBanner.tone === 'warning'
              ? 'bg-amber-50 border-amber-200 text-amber-950'
              : 'bg-rose-50 border-rose-200 text-rose-950'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {feedbackBanner.tone === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
            )}
            <span>{feedbackBanner.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedbackBanner(null)}
            className="text-stone-500 hover:text-stone-800 px-2 py-0.5 font-semibold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Security / Access Restricted / Session Expired / Network Error State */}
      {errorState && (
        <div
          role="alert"
          className="rounded-2xl p-6 bg-rose-50/90 border border-rose-200 text-rose-950 space-y-3"
        >
          <div className="flex items-start gap-3">
            {errorState.type === 'NETWORK' ? (
              <WifiOff className="w-6 h-6 text-rose-700 shrink-0 mt-0.5" />
            ) : (
              <ShieldAlert className="w-6 h-6 text-rose-700 shrink-0 mt-0.5" />
            )}
            <div className="space-y-1">
              <div className="text-xs font-mono uppercase tracking-wider text-rose-700">
                {errorState.code || errorState.type}
              </div>
              <h3 className="text-base font-serif font-bold text-rose-950">
                {errorState.type === 'ACCESS_RESTRICTED'
                  ? 'Financial Records Restricted for Current Role'
                  : errorState.type === 'WORKSPACE_ISOLATION'
                  ? 'Cross-Household Isolation Enforced'
                  : errorState.type === 'UNAUTHORIZED'
                  ? 'Session Expired or Unauthenticated'
                  : 'Financial Service Connection Error'}
              </h3>
              <p className="text-xs text-rose-900 leading-relaxed">{errorState.message}</p>
              <p className="text-[11px] text-rose-800 pt-1">
                Zero-Trust Protection: All cached household balances, transactions, budgets, and holdings have been cleared from memory.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 pt-2">
            {activeFamilyId !== 'fam-1' && (
              <button
                type="button"
                onClick={() => setActiveFamilyId('fam-1')}
                className="px-3.5 py-2 rounded-lg bg-rose-800 text-white text-xs font-semibold hover:bg-rose-900"
              >
                Return to Primary Household (fam-1)
              </button>
            )}
            {onSelectPersona && (selectedPersona === 'CHILD' || selectedPersona === 'GUEST') && (
              <button
                type="button"
                onClick={() => onSelectPersona('OWNER')}
                className="px-3.5 py-2 rounded-lg bg-stone-900 text-white text-xs font-semibold hover:bg-stone-800"
              >
                Switch to Authorized Adult (Sarah — OWNER)
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setSessionExpiredOverride(false);
                fetchAllFinanceHubData();
              }}
              className="px-3.5 py-2 rounded-lg border border-rose-300 bg-white text-rose-900 text-xs font-semibold hover:bg-rose-100"
            >
              Retry Connection
            </button>
          </div>
        </div>
      )}

      {/* Executive Segmented Navigation Bar & Print Action */}
      <div
        className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white p-2.5 sm:p-3 rounded-2xl border border-stone-200/90 shadow-xs w-full relative z-10 transition-all"
        style={{ borderColor: BRAND.border }}
      >
        <div
          role="tablist"
          aria-label="Finance Hub Sections"
          className="flex flex-wrap md:flex-nowrap items-center gap-1 sm:gap-1.5 p-1 rounded-xl bg-stone-100/90 border border-stone-200/80 w-full min-w-0 flex-1 overflow-x-auto scrollbar-none"
        >
          {SECTIONS.map((sec) => {
            const Icon = sec.icon;
            const isSelected = activeSection === sec.id;
            return (
              <button
                key={sec.id}
                type="button"
                role="tab"
                aria-selected={isSelected}
                aria-controls={`finance-panel-${sec.id}`}
                id={`finance-tab-${sec.id}`}
                onClick={() => handleSelectSection(sec.id)}
                className={`group flex items-center justify-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold flex-1 md:flex-initial whitespace-nowrap transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-emerald-800 shrink-0 ${
                  isSelected
                    ? 'bg-stone-900 text-white shadow-xs border border-stone-900 font-bold'
                    : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/60 font-medium'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 shrink-0 transition-colors ${isSelected ? 'text-emerald-400' : 'text-stone-400 group-hover:text-stone-700'}`} />
                <span className="truncate">{sec.label}</span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => setIsPrintModalOpen(true)}
          className="px-4 py-2 rounded-xl bg-stone-900 hover:bg-emerald-950 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer shrink-0 border border-stone-800 active:scale-98 w-full md:w-auto"
          title="Print Complete Finance Database & General Ledger Report"
        >
          <Printer className="w-4 h-4 text-emerald-400" />
          <span>Print Master Ledger</span>
        </button>
      </div>

      {/* Loading Skeleton */}
      {loading && !summaryData && !errorState && (
        <div
          role="status"
          aria-label="Loading household financial records"
          className="rounded-2xl p-8 bg-white border text-center space-y-3"
          style={{ borderColor: BRAND.border }}
        >
          <RefreshCw className="w-6 h-6 text-emerald-800 animate-spin mx-auto" />
          <p className="text-sm font-medium text-stone-700">
            Loading verified integer-cents financial ledger for {activeFamilyId}...
          </p>
        </div>
      )}

      {/* =====================================================================
          SECTION 1: OVERVIEW
      ===================================================================== */}
      {!errorState && activeSection === 'overview' && (
        <div
          id="finance-panel-overview"
          role="tabpanel"
          aria-labelledby="finance-tab-overview"
          className="space-y-6"
        >
          {/* Key Household Metrics Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* 1. Net Household Worth */}
            <div className="rounded-2xl p-5 bg-white border" style={{ borderColor: BRAND.border }}>
              <span className="text-xs text-stone-500 block mb-1">Net Household Worth</span>
              <div className="text-2xl font-serif font-bold text-stone-900 font-mono">
                {formatCents(combinedHouseholdNetWorthDecimal)}
              </div>
              <div className="mt-2 pt-2 border-t border-stone-100 text-[11px] text-stone-600 space-y-0.5">
                <div className="flex justify-between">
                  <span>Assets:</span>
                  <span className="font-mono text-emerald-800">
                    {formatCents(summary.totalAssetsCentsDecimal ?? summary.totalAssetsCents)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Liabilities:</span>
                  <span className="font-mono text-rose-700">
                    -{formatCents(summary.totalLiabilitiesCentsDecimal ?? summary.totalLiabilitiesCents)}
                  </span>
                </div>
              </div>
            </div>

            {/* 2. Monthly Recorded Income */}
            <div className="rounded-2xl p-5 bg-white border" style={{ borderColor: BRAND.border }}>
              <span className="text-xs text-stone-500 block mb-1">Monthly Recorded Income</span>
              <div className="text-2xl font-serif font-bold text-emerald-800 font-mono">
                {formatCents(summary.actualIncomeCentsDecimal ?? summary.actualIncomeCents)}
              </div>
              <p className="text-[11px] text-stone-500 mt-2">
                Actual posted income entries · Excludes internal transfers
              </p>
            </div>

            {/* 3. Monthly Recorded Expenses */}
            <div className="rounded-2xl p-5 bg-white border" style={{ borderColor: BRAND.border }}>
              <span className="text-xs text-stone-500 block mb-1">Monthly Recorded Expenses</span>
              <div className="text-2xl font-serif font-bold text-rose-800 font-mono">
                {formatCents(summary.actualExpenseCentsDecimal ?? summary.actualExpenseCents)}
              </div>
              <p className="text-[11px] text-stone-500 mt-2">
                Actual posted expense entries · Net of audit reversals
              </p>
            </div>

            {/* 4. Actual Monthly Surplus / Deficit */}
            <div className="rounded-2xl p-5 bg-white border" style={{ borderColor: BRAND.border }}>
              <span className="text-xs text-stone-500 block mb-1">
                Actual Monthly {actualNetCashFlowBig >= 0n ? 'Surplus' : 'Deficit'}
              </span>
              <div
                className={`text-2xl font-serif font-bold font-mono ${
                  actualNetCashFlowBig >= 0n ? 'text-emerald-900' : 'text-rose-700'
                }`}
              >
                {actualNetCashFlowBig >= 0n ? '+' : ''}
                {formatCents(summary.actualNetCashFlowCentsDecimal ?? summary.actualNetCashFlowCents)}
              </div>
              <p className="text-[11px] text-stone-500 mt-2">
                Recorded Income − Recorded Expenses
              </p>
            </div>

            {/* 5. Remaining Envelope Budget */}
            <div className="rounded-2xl p-5 bg-white border flex flex-col justify-between" style={{ borderColor: BRAND.border }}>
              <div>
                <span className="text-xs text-stone-500 block mb-1">Remaining Envelope Budget</span>
                <div
                  className={`text-2xl font-serif font-bold font-mono ${
                    budgetRollup.totalRemainingBig >= 0n ? 'text-stone-900' : 'text-rose-700'
                  }`}
                >
                  {formatCents(budgetRollup.totalRemainingCents)}
                </div>
              </div>

              {(() => {
                const overviewColor = getDynamicBudgetColor(
                  budgetRollup.totalSpentCents,
                  budgetRollup.totalAllocatedCents
                );
                return (
                  <div className="mt-3 space-y-1.5">
                    <div className="w-full h-2 rounded-full bg-stone-100 overflow-hidden border border-stone-200/80">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min(100, Math.max(0, overviewColor.percentage))}%`,
                          background: overviewColor.gradientStyle,
                        }}
                      />
                    </div>
                    <div className="flex justify-between items-center text-[11px] text-stone-500">
                      <span>Spent {formatCents(budgetRollup.totalSpentCents)} ({overviewColor.percentage}%)</span>
                      <span className={overviewColor.twTextClass}>{overviewColor.statusLabel}</span>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Actual vs. Projected Cash Flow Comparison */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Actual Recorded Cash Flow */}
            <div className="rounded-2xl p-6 bg-white border space-y-4" style={{ borderColor: BRAND.border }}>
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs text-emerald-800 font-semibold">Actual Ledger Record</span>
                  <h3 className="text-lg font-serif font-bold text-stone-900">
                    Actual Recorded Cash Flow
                  </h3>
                </div>
                <span className="text-xs font-mono text-stone-500">Settled Transactions Only</span>
              </div>
              <p className="text-xs text-stone-600">
                Computed strictly from posted income and expense transactions. Internal account transfers and planned savings allocations are excluded so household cash flow is never distorted.
              </p>
              <div className="space-y-2.5 pt-2 text-xs">
                <div className="flex justify-between py-2 border-b border-stone-100">
                  <span className="text-stone-600">Recorded Household Income</span>
                  <span className="font-mono font-bold text-emerald-800">
                    +{formatCents(cashflowData?.actual?.incomeCentsDecimal ?? summary.actualIncomeCentsDecimal ?? summary.actualIncomeCents)}
                  </span>
                </div>
                <div className="flex justify-between py-2 border-b border-stone-100">
                  <span className="text-stone-600">Recorded Household Expenses</span>
                  <span className="font-mono font-bold text-rose-700">
                    -{formatCents(cashflowData?.actual?.expenseCentsDecimal ?? summary.actualExpenseCentsDecimal ?? summary.actualExpenseCents)}
                  </span>
                </div>
                <div className="flex justify-between py-2.5 bg-stone-50 px-3 rounded-xl font-semibold">
                  <span className="text-stone-900">
                    Actual Net Cash Flow ({actualNetCashFlowBig >= 0n ? 'Surplus' : 'Deficit'})
                  </span>
                  <span
                    className={`font-mono font-bold ${
                      actualNetCashFlowBig >= 0n ? 'text-emerald-900' : 'text-rose-700'
                    }`}
                  >
                    {formatCents(cashflowData?.actual?.netCentsDecimal ?? summary.actualNetCashFlowCentsDecimal ?? summary.actualNetCashFlowCents)}
                  </span>
                </div>
              </div>
            </div>

            {/* Projected Monthly Cash Flow & Allocations */}
            <div className="rounded-2xl p-6 bg-white border space-y-4" style={{ borderColor: BRAND.border }}>
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs text-amber-800 font-semibold">Projected / Planned Forecast</span>
                  <h3 className="text-lg font-serif font-bold text-stone-900">
                    Projected Monthly Cash Flow & Allocations
                  </h3>
                </div>
                <span className="text-xs font-mono text-amber-900">Forecast Only · Not Posted</span>
              </div>
              <p className="text-xs text-stone-600">
                Derived from active recurring schedules, category budget envelopes, and planned monthly savings targets. Projected items do not alter account balances until generated or posted.
              </p>
              <div className="space-y-2 pt-1 text-xs">
                <div className="flex justify-between py-1.5 border-b border-stone-100">
                  <span className="text-stone-600">Projected Recurring Monthly Income</span>
                  <span className="font-mono font-semibold text-emerald-800">
                    +{formatCents(summary.projectedMonthlyRecurringIncomeCentsDecimal ?? summary.projectedMonthlyRecurringIncomeCents)}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-stone-100">
                  <span className="text-stone-600">Projected Recurring Fixed Expenses</span>
                  <span className="font-mono font-semibold text-rose-700">
                    -{formatCents(summary.projectedMonthlyRecurringExpenseCentsDecimal ?? summary.projectedMonthlyRecurringExpenseCents)}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-stone-100">
                  <span className="text-stone-600">Planned Envelope Budget Allocations</span>
                  <span className="font-mono font-semibold text-amber-800">
                    -{formatCents(summary.plannedVariableExpensesCentsDecimal ?? summary.plannedVariableExpensesCents)}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-stone-100 font-medium">
                  <span className="text-stone-800">= Available Planned Cash Flow (Before Savings)</span>
                  <span className="font-mono font-bold text-stone-900">
                    {formatCents(summary.availablePlannedCashFlowCentsDecimal ?? summary.availablePlannedCashFlowCents)}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-stone-100">
                  <span className="text-stone-600">Planned Monthly Savings Allocations (Target Only)</span>
                  <span className="font-mono font-semibold text-stone-700">
                    -{formatCents(summary.plannedAllocationsCentsDecimal ?? summary.plannedAllocationsCents)}
                  </span>
                </div>
                <div className="flex justify-between py-2 bg-amber-50/70 px-3 rounded-xl font-semibold">
                  <span className="text-amber-950">Projected Discretionary Margin</span>
                  <span className="font-mono font-bold text-amber-950">
                    {formatCents(summary.discretionaryMarginCentsDecimal ?? summary.discretionaryMarginCents)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Interactive What-If Cash-Flow Planning Simulator */}
          <div className="rounded-2xl p-6 bg-white border space-y-4" style={{ borderColor: BRAND.border }}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="text-xs text-stone-500">Interactive Scenario Sandbox</span>
                <h3 className="text-base font-serif font-bold text-stone-900">
                  What-If Monthly Cash-Flow Allocator (Integer-Cents Formula)
                </h3>
              </div>
              <span className="text-xs font-mono text-stone-500">
                Available = Income − Fixed Recurring − Planned Variable − Savings Target
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              <div>
                <label htmlFor="sim-inc" className="block text-stone-600 font-medium mb-1">
                  Simulated Monthly Income ($)
                </label>
                <input
                  id="sim-inc"
                  type="text"
                  value={simIncomeDollars}
                  onChange={(e) => setSimIncomeDollars(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-stone-300 font-mono"
                />
              </div>
              <div>
                <label htmlFor="sim-rec" className="block text-stone-600 font-medium mb-1">
                  Simulated Fixed Bills ($)
                </label>
                <input
                  id="sim-rec"
                  type="text"
                  value={simRecurringDollars}
                  onChange={(e) => setSimRecurringDollars(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-stone-300 font-mono"
                />
              </div>
              <div>
                <label htmlFor="sim-var" className="block text-stone-600 font-medium mb-1">
                  Simulated Variable Budgets ($)
                </label>
                <input
                  id="sim-var"
                  type="text"
                  value={simVariableDollars}
                  onChange={(e) => setSimVariableDollars(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-stone-300 font-mono"
                />
              </div>
              <div>
                <label htmlFor="sim-sav" className="block text-stone-600 font-medium mb-1">
                  Simulated Savings Target ($)
                </label>
                <input
                  id="sim-sav"
                  type="text"
                  value={simSavingsAllocDollars}
                  onChange={(e) => setSimSavingsAllocDollars(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-stone-300 font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200 flex justify-between items-center text-xs">
                <span className="font-medium text-stone-700">Simulated Available Before Savings:</span>
                <span className="font-mono font-bold text-sm text-stone-900">
                  {formatCents(simCalculations.availableBeforeSavingsCents)}
                </span>
              </div>
              <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200 flex justify-between items-center text-xs">
                <span className="font-semibold text-emerald-950">Simulated Unallocated Margin:</span>
                <span className="font-mono font-bold text-sm text-emerald-950">
                  {formatCents(simCalculations.unallocatedMarginCents)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          SECTION 2: STREAMLINED MINIMALIST ACCOUNT MANAGEMENT
      ===================================================================== */}
      {!errorState && activeSection === 'accounts' && (
        <AccountManagementView
          familyId={activeFamilyId}
          sessionToken={effectiveSessionToken}
          selectedPersona={selectedPersona}
          accounts={accounts}
          transactions={transactions}
          reconciliations={reconciliations}
          onRefreshFinanceData={fetchAllFinanceHubData}
          onFeedback={setFeedbackBanner}
        />
      )}

      {/* =====================================================================
          SECTION 3: TRANSACTIONS & GENERAL LEDGER MANAGEMENT
      ===================================================================== */}
      {!errorState && activeSection === 'transactions' && (
        <div
          id="finance-panel-transactions"
          role="tabpanel"
          aria-labelledby="finance-tab-transactions"
          className="space-y-6"
        >
          {/* Top KPI Metrics Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl bg-white border border-stone-200 space-y-1">
              <span className="text-xs text-stone-500 font-medium block">Total Recorded Income</span>
              <div className="text-2xl font-mono font-bold text-emerald-800">
                +{formatCents(txMetrics.totalIncomeCents)}
              </div>
              <p className="text-[11px] text-stone-500">Settled inflow entries</p>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-stone-200 space-y-1">
              <span className="text-xs text-stone-500 font-medium block">Total Recorded Expenses</span>
              <div className="text-2xl font-mono font-bold text-rose-800">
                -{formatCents(txMetrics.totalExpenseCents)}
              </div>
              <p className="text-[11px] text-stone-500">Settled outflow entries</p>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-stone-200 space-y-1">
              <span className="text-xs text-stone-500 font-medium block">Net Recorded Cash Flow</span>
              <div
                className={`text-2xl font-mono font-bold ${
                  txMetrics.netCashFlowBig < 0n ? 'text-rose-700' : 'text-stone-900'
                }`}
              >
                {txMetrics.netCashFlowBig >= 0n ? '+' : ''}
                {formatCents(txMetrics.netCashFlowCents)}
              </div>
              <p className="text-[11px] text-stone-500">Income minus expenses</p>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-stone-200 space-y-1">
              <span className="text-xs text-stone-500 font-medium block">Total Ledger Activity</span>
              <div className="text-2xl font-mono font-bold text-stone-900">
                {txMetrics.totalCount}
              </div>
              <p className="text-[11px] text-stone-500">
                {txMetrics.reversalCount > 0
                  ? `${txMetrics.reversalCount} audit reversals recorded`
                  : 'Immutable append-only entries'}
              </p>
            </div>
          </div>

          {/* Search, Filter & Action Bar */}
          <div className="p-4 rounded-2xl bg-white border border-stone-200 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
            {/* Filter Group */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <div className="relative flex-1 sm:w-60 min-w-[180px]">
                <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="search"
                  value={txSearchQuery}
                  onChange={(e) => setTxSearchQuery(e.target.value)}
                  placeholder="Search payee, description, or category..."
                  className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-stone-300 bg-white text-xs"
                />
              </div>

              <select
                aria-label="Filter by Type"
                value={txFilterType}
                onChange={(e) => setTxFilterType(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-stone-300 bg-white text-xs font-medium"
              >
                <option value="ALL">All Entry Types</option>
                <option value="EXPENSE">Expenses Only</option>
                <option value="INCOME">Income Only</option>
                <option value="TRANSFER">Transfers Only</option>
                <option value="REVERSAL">Reversals Only</option>
              </select>

              <select
                aria-label="Filter by Account"
                value={txFilterAccount}
                onChange={(e) => setTxFilterAccount(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-stone-300 bg-white text-xs font-medium"
              >
                <option value="ALL">All Accounts</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>

              <select
                aria-label="Filter by Category"
                value={txFilterCategory}
                onChange={(e) => setTxFilterCategory(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-stone-300 bg-white text-xs font-medium"
              >
                <option value="ALL">All Categories</option>
                <option value="FOOD">FOOD</option>
                <option value="HOUSING">HOUSING</option>
                <option value="UTILITIES">UTILITIES</option>
                <option value="TRANSPORT">TRANSPORT</option>
                <option value="DINING">DINING</option>
                <option value="BILLS">BILLS</option>
                <option value="SALARY">SALARY</option>
                <option value="SAVINGS_CONTRIBUTION">SAVINGS_CONTRIBUTION</option>
                <option value="TRANSFER">TRANSFER</option>
              </select>
            </div>

            {/* Post Entry Primary Button */}
            <button
              type="button"
              onClick={() => setIsAddTxModalOpen(true)}
              className="px-3.5 py-1.5 rounded-xl text-white font-semibold text-xs transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer shrink-0"
              style={{ backgroundColor: BRAND.primary }}
            >
              <Plus className="w-4 h-4" />
              <span>Post Ledger Entry</span>
            </button>
          </div>

          {/* Transactions List */}
          <div className="rounded-2xl p-6 bg-white border space-y-4" style={{ borderColor: BRAND.border }}>
            <div className="flex items-center justify-between border-b border-stone-200 pb-3">
              <h3 className="text-base font-serif font-bold text-stone-900">
                General Ledger History ({filteredTransactions.length} entries)
              </h3>
              <span className="text-xs text-stone-500 font-mono">
                Integer-Cents Signed Precision
              </span>
            </div>

            {filteredTransactions.length === 0 ? (
              <div className="p-12 text-center text-xs text-stone-500 border border-dashed border-stone-300 rounded-2xl bg-white space-y-1">
                <p className="font-serif font-bold text-sm text-stone-800">No transactions found</p>
                <p>No ledger records match your current filter or search query.</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {filteredTransactions.map((tx) => {
                  const isAlreadyReversed = reversedOriginalIds.has(tx.id);
                  const isInspected = selectedTxDetail?.id === tx.id;
                  const srcAccName = accounts.find((a) => a.id === tx.accountId)?.name || tx.accountId;
                  const dstAccName = tx.destinationAccountId
                    ? accounts.find((a) => a.id === tx.destinationAccountId)?.name || tx.destinationAccountId
                    : null;

                  return (
                    <div
                      key={tx.id}
                      className={`rounded-xl border p-4 transition-all bg-white hover:border-stone-300 shadow-2xs space-y-2 ${
                        tx.isReversal
                          ? 'bg-sky-50/40 border-sky-200'
                          : isAlreadyReversed
                          ? 'bg-stone-50 border-stone-200 opacity-80'
                          : 'border-stone-200'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-xs">
                            <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-stone-100 border border-stone-200 text-stone-800">
                              {tx.transactionType}
                            </span>
                            <span className="font-semibold text-stone-700 text-[11px] px-2 py-0.5 rounded bg-stone-100 border border-stone-200">
                              {tx.category}
                            </span>
                            <span className="text-stone-500 text-xs">
                              {srcAccName}
                              {dstAccName ? ` → ${dstAccName}` : ''}
                            </span>
                          </div>

                          <h4 className="text-sm font-semibold text-stone-900">{tx.title}</h4>

                          <p className="text-[11px] text-stone-500">
                            Posted by {tx.paidBy || 'Member'} ·{' '}
                            {tx.transactionDate ? new Date(tx.transactionDate).toLocaleDateString() : 'Recorded'}
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <span
                            className={`text-base font-mono font-bold ${
                              tx.isReversal
                                ? 'text-sky-900'
                                : tx.transactionType === 'INCOME'
                                ? 'text-emerald-800'
                                : tx.transactionType === 'TRANSFER'
                                ? 'text-stone-700'
                                : 'text-rose-800'
                            }`}
                          >
                            {tx.transactionType === 'INCOME'
                              ? '+'
                              : tx.transactionType === 'TRANSFER'
                              ? '⇄ '
                              : '-'}
                            {formatCents(tx.amountCentsDecimal ?? tx.amountCents)}
                          </span>

                          <div className="flex items-center gap-1 pl-2 border-l border-stone-200">
                            <button
                              type="button"
                              onClick={() => setEditingTx(tx)}
                              className="p-1.5 rounded-lg border border-stone-200 text-stone-600 hover:bg-stone-100"
                              title="Edit Title & Category"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => setSelectedTxDetail(isInspected ? null : tx)}
                              className="px-2 py-1 rounded-lg border border-stone-200 text-stone-700 text-xs font-semibold hover:bg-stone-100"
                              title="Inspect Audit Metadata"
                            >
                              Audit
                            </button>

                            {!tx.isReversal && !isAlreadyReversed && (
                              <button
                                type="button"
                                onClick={() =>
                                  setConfirmModal({
                                    kind: 'REVERSE_TX',
                                    targetId: tx.id,
                                    targetLabel: tx.title,
                                    amountLabel: formatCents(tx.amountCentsDecimal ?? tx.amountCents),
                                    reason: 'Audit correction',
                                  })
                                }
                                className="p-1.5 rounded-lg border border-sky-200 text-sky-800 hover:bg-sky-50"
                                title="Post Compensating Reversal"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => handleDeleteTxConfirm(tx)}
                              className="p-1.5 rounded-lg border border-stone-200 text-rose-600 hover:bg-rose-50 hover:border-rose-300"
                              title="Delete Transaction"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>

                      {isInspected && (
                        <div className="mt-2 pt-2 border-t border-stone-100 grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] text-stone-600 font-mono bg-stone-50 p-2.5 rounded-lg">
                          <div>Ledger ID: {tx.id}</div>
                          <div>Idempotency Key: {tx.idempotencyKey || 'SERVER_GENERATED'}</div>
                          <div>
                            Status:{' '}
                            {tx.isReversal
                              ? `Reversal of ${tx.reversalOfId}`
                              : isAlreadyReversed
                              ? 'Reversed Original'
                              : 'Settled Entry'}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Post Transaction Modal */}
          {isAddTxModalOpen && (
            <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-2xl p-6 max-w-lg w-full border border-stone-200 space-y-4 shadow-xl">
                <div className="flex items-center justify-between border-b border-stone-200 pb-3">
                  <h3 className="text-lg font-serif font-bold text-stone-900">Post General Ledger Entry</h3>
                  <button
                    type="button"
                    onClick={() => setIsAddTxModalOpen(false)}
                    className="p-1 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Entry Mode Selector */}
                <div className="flex gap-1 p-1 rounded-xl bg-stone-100 border border-stone-200 text-xs">
                  {[
                    { id: 'EXPENSE', label: 'Expense' },
                    { id: 'INCOME', label: 'Income' },
                    { id: 'TRANSFER', label: 'Transfer' },
                  ].map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setTxEntryMode(m.id as any)}
                      className={`flex-1 py-1.5 rounded-lg font-semibold transition-colors ${
                        txEntryMode === m.id
                          ? 'bg-stone-900 text-white shadow-xs'
                          : 'text-stone-600 hover:text-stone-900'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>

                <form onSubmit={handleRecordTransaction} className="space-y-3 text-xs">
                  <div>
                    <label className="block text-stone-600 font-medium mb-1">
                      {txEntryMode === 'INCOME' ? 'Deposit Account' : 'Source Account'}
                    </label>
                    <select
                      value={txAccountId}
                      onChange={(e) => setTxAccountId(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white"
                    >
                      {accounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name} ({formatCents(a.currentBalanceCentsDecimal ?? a.currentBalanceCents)})
                        </option>
                      ))}
                    </select>
                  </div>

                  {txEntryMode === 'TRANSFER' && (
                    <div>
                      <label className="block text-stone-600 font-medium mb-1">Destination Account</label>
                      <select
                        value={txDestAccountId}
                        onChange={(e) => setTxDestAccountId(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white"
                      >
                        {accounts.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name} ({formatCents(a.currentBalanceCentsDecimal ?? a.currentBalanceCents)})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {txEntryMode !== 'TRANSFER' && (
                    <div>
                      <label className="block text-stone-600 font-medium mb-1">Category</label>
                      <select
                        value={txCategory}
                        onChange={(e) => setTxCategory(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white"
                      >
                        <option value="FOOD">FOOD</option>
                        <option value="HOUSING">HOUSING</option>
                        <option value="UTILITIES">UTILITIES</option>
                        <option value="TRANSPORT">TRANSPORT</option>
                        <option value="DINING">DINING</option>
                        <option value="BILLS">BILLS</option>
                        <option value="SALARY">SALARY</option>
                        <option value="HEALTHCARE">HEALTHCARE</option>
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="block text-stone-600 font-medium mb-1">Payee / Title</label>
                    <input
                      type="text"
                      value={txTitle}
                      onChange={(e) => setTxTitle(e.target.value)}
                      placeholder="e.g. Organic Grocery Market"
                      className="w-full px-3 py-2 rounded-xl border border-stone-300"
                    />
                  </div>

                  <div>
                    <label className="block text-stone-600 font-medium mb-1">Amount ($)</label>
                    <input
                      type="text"
                      value={txAmountDollars}
                      onChange={(e) => setTxAmountDollars(e.target.value)}
                      placeholder="e.g. 84.50"
                      className="w-full px-3 py-2 rounded-xl border border-stone-300 font-mono text-sm"
                    />
                  </div>

                  <div className="pt-2 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setIsAddTxModalOpen(false)}
                      className="px-4 py-2 rounded-xl border border-stone-300 text-stone-700 font-semibold hover:bg-stone-100"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-semibold shadow-xs"
                    >
                      Post Entry
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Edit Transaction Modal */}
          {editingTx && (
            <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-2xl p-6 max-w-md w-full border border-stone-200 space-y-4 shadow-xl">
                <div className="flex items-center justify-between border-b border-stone-200 pb-3">
                  <h3 className="text-lg font-serif font-bold text-stone-900">Edit Transaction Entry</h3>
                  <button
                    type="button"
                    onClick={() => setEditingTx(null)}
                    className="p-1 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleSaveTxEdit} className="space-y-3 text-xs">
                  <div>
                    <label className="block text-stone-600 font-medium mb-1">Payee Title</label>
                    <input
                      type="text"
                      value={editingTx.title}
                      onChange={(e) => setEditingTx({ ...editingTx, title: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-stone-600 font-medium mb-1">Category</label>
                    <select
                      value={editingTx.category}
                      onChange={(e) => setEditingTx({ ...editingTx, category: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white text-xs"
                    >
                      <option value="FOOD">FOOD</option>
                      <option value="HOUSING">HOUSING</option>
                      <option value="UTILITIES">UTILITIES</option>
                      <option value="TRANSPORT">TRANSPORT</option>
                      <option value="DINING">DINING</option>
                      <option value="BILLS">BILLS</option>
                      <option value="SALARY">SALARY</option>
                      <option value="TRANSFER">TRANSFER</option>
                    </select>
                  </div>

                  <div className="pt-2 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingTx(null)}
                      className="px-4 py-2 rounded-xl border border-stone-300 text-stone-700 font-semibold hover:bg-stone-100"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-white font-semibold shadow-xs"
                    >
                      Save Changes
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          SECTION 4: ENVELOPE BUDGETS (STREAMLINED MINIMALIST CRUD VIEW)
      ===================================================================== */}
      {!errorState && activeSection === 'budgets' && (
        <div
          id="finance-panel-budgets"
          role="tabpanel"
          aria-labelledby="finance-tab-budgets"
          className="space-y-6"
        >
          {/* Top KPI Summary Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-2xl p-4 bg-white border border-stone-200 shadow-xs">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">
                Total Monthly Allocated
              </span>
              <p className="text-xl font-serif font-bold text-stone-900 font-mono mt-1">
                {formatCents(budgetRollup.totalAllocatedCents)}
              </p>
              <span className="text-[11px] text-stone-500">
                Across {budgets.length} active category {budgets.length === 1 ? 'envelope' : 'envelopes'}
              </span>
            </div>

            <div className="rounded-2xl p-4 bg-white border border-stone-200 shadow-xs">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">
                Total Monthly Spent
              </span>
              <p className="text-xl font-serif font-bold text-stone-900 font-mono mt-1">
                {formatCents(budgetRollup.totalSpentCents)}
              </p>
              <span className="text-[11px] text-stone-500">
                Synced with household ledger expenses
              </span>
            </div>

            <div className="rounded-2xl p-4 bg-white border border-stone-200 shadow-xs">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">
                Remaining Envelope Margin
              </span>
              <p
                className={`text-xl font-serif font-bold font-mono mt-1 ${
                  budgetRollup.totalRemainingBig < 0n ? 'text-rose-700' : 'text-emerald-800'
                }`}
              >
                {budgetRollup.totalRemainingBig < 0n
                  ? `-${formatCents(-budgetRollup.totalRemainingBig)}`
                  : formatCents(budgetRollup.totalRemainingCents)}
              </p>
              <span className="text-[11px] text-stone-500">
                {budgetRollup.totalRemainingBig < 0n ? 'Net allocation exceeded' : 'Available unspent capacity'}
              </span>
            </div>

            <div className="rounded-2xl p-4 bg-white border border-stone-200 shadow-xs">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">
                Threshold Health Status
              </span>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-xl font-serif font-bold text-stone-900">
                  {budgetRollup.overBudgetCount === 0 && budgetRollup.warningCount === 0
                    ? 'All On Track'
                    : `${budgetRollup.overBudgetCount + budgetRollup.warningCount} Flagged`}
                </span>
              </div>
              <span className="text-[11px] text-stone-500">
                {budgetRollup.overBudgetCount} exceeded · {budgetRollup.warningCount} warning
              </span>
            </div>
          </div>

          {/* Filter, Search & Primary Action Bar */}
          <div className="rounded-2xl p-4 bg-white border border-stone-200 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {(
                [
                  { id: 'ALL', label: `All (${budgets.length})` },
                  {
                    id: 'NORMAL',
                    label: `On Track (${Math.max(0, budgets.length - budgetRollup.warningCount - budgetRollup.overBudgetCount)})`,
                  },
                  { id: 'WARNING', label: `Warning (${budgetRollup.warningCount})` },
                  { id: 'OVER_BUDGET', label: `Exceeded (${budgetRollup.overBudgetCount})` },
                ] as const
              ).map((tab) => {
                const active = budgetStatusFilter === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setBudgetStatusFilter(tab.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                      active
                        ? 'bg-emerald-900 text-white'
                        : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <div className="relative flex-1 sm:flex-initial sm:w-60">
                <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={budgetSearchQuery}
                  onChange={(e) => setBudgetSearchQuery(e.target.value)}
                  placeholder="Search category..."
                  aria-label="Search budget categories"
                  className="w-full pl-8 pr-7 py-1.5 rounded-xl border border-stone-300 text-xs focus:outline-none focus:border-emerald-800"
                />
                {budgetSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setBudgetSearchQuery('')}
                    aria-label="Clear search"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => {
                  setBudgetCatInput('');
                  setBudgetAllocDollars('400.00');
                  setBudgetThresholdPct(80);
                  setIsAddBudgetModalOpen(true);
                }}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white shadow-xs transition-colors cursor-pointer"
                style={{ backgroundColor: BRAND.primary }}
              >
                <Plus className="w-3.5 h-3.5" />
                New Budget Envelope
              </button>
            </div>
          </div>

          {/* Minimalist Envelope Cards Grid */}
          {filteredBudgets.length === 0 ? (
            <div className="rounded-2xl p-10 bg-white border border-dashed border-stone-300 text-center space-y-3">
              <PieChart className="w-8 h-8 text-stone-400 mx-auto" />
              <div className="space-y-1">
                <h3 className="text-sm font-serif font-bold text-stone-800">
                  {budgets.length === 0
                    ? 'No Envelope Budgets Configured'
                    : 'No Matching Budget Envelopes'}
                </h3>
                <p className="text-xs text-stone-500 max-w-md mx-auto">
                  {budgets.length === 0
                    ? 'Create your first monthly category envelope to track household spending limits and threshold alerts.'
                    : 'Try clearing your category search or switching the status filter above.'}
                </p>
              </div>
              {budgets.length === 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    setBudgetCatInput('GROCERIES');
                    setBudgetAllocDollars('600.00');
                    setBudgetThresholdPct(80);
                    setIsAddBudgetModalOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white"
                  style={{ backgroundColor: BRAND.primary }}
                >
                  <Plus className="w-3.5 h-3.5" />
                  Create First Envelope
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setBudgetSearchQuery('');
                    setBudgetStatusFilter('ALL');
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-stone-300 text-stone-700 hover:bg-stone-100"
                >
                  Reset Filters
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredBudgets.map((b) => {
                const allocBig = toBigIntOrZero(b.allocatedCentsDecimal, b.allocatedCents);
                const spentBig = toBigIntOrZero(b.spentCentsDecimal, b.spentCents);
                const remainingBig = allocBig - spentBig;
                const thresholdPct = b.alertThresholdPercentage ?? 80;

                const dynamicColor = getDynamicBudgetColor(
                  b.spentCentsDecimal ?? b.spentCents,
                  b.allocatedCentsDecimal ?? b.allocatedCents,
                  thresholdPct
                );

                return (
                  <div
                    key={b.id}
                    className={`rounded-2xl border p-5 flex flex-col justify-between gap-4 transition-all bg-white shadow-xs ${dynamicColor.twBorderClass}`}
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span
                              className="w-2.5 h-2.5 rounded-full inline-block shrink-0"
                              style={{ backgroundColor: dynamicColor.hexColor }}
                              aria-hidden="true"
                            />
                            <h4 className="text-base font-serif font-bold text-stone-900 tracking-tight">
                              {b.category}
                            </h4>
                          </div>
                          <p className="text-[11px] text-stone-500">
                            Alert threshold at {thresholdPct}% · {dynamicColor.percentage}% utilized
                          </p>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              const allocDollars = (Number(allocBig) / 100).toFixed(2);
                              const spentDollars = (Number(spentBig) / 100).toFixed(2);
                              setEditingBudget({
                                id: b.id,
                                category: b.category,
                                allocatedDollars: allocDollars,
                                spentDollars: spentDollars,
                                alertThresholdPercentage: thresholdPct,
                              });
                            }}
                            title={`Edit ${b.category} envelope`}
                            aria-label={`Edit ${b.category} envelope`}
                            className="p-1.5 rounded-lg text-stone-500 hover:text-stone-900 hover:bg-stone-100 transition-colors"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteBudgetConfirm(b)}
                            title={`Delete ${b.category} envelope`}
                            aria-label={`Delete ${b.category} envelope`}
                            className="p-1.5 rounded-lg text-stone-500 hover:text-rose-700 hover:bg-rose-50 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Spent vs Allocated Figures */}
                      <div className="pt-1 flex items-baseline justify-between gap-2">
                        <div>
                          <span className="text-[11px] text-stone-500 block">Spent</span>
                          <span className="text-lg font-mono font-bold text-stone-900">
                            {formatCents(b.spentCentsDecimal ?? b.spentCents)}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-[11px] text-stone-500 block">Monthly Limit</span>
                          <span className="text-sm font-mono font-semibold text-stone-700">
                            {formatCents(b.allocatedCentsDecimal ?? b.allocatedCents)}
                          </span>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="w-full h-2.5 rounded-full bg-stone-100 overflow-hidden border border-stone-200/80 p-0.5">
                        <div
                          className="h-full rounded-full transition-all duration-500 ease-out"
                          style={{
                            width: `${Math.min(100, Math.max(0, dynamicColor.percentage))}%`,
                            background: dynamicColor.gradientStyle,
                          }}
                        />
                      </div>
                    </div>

                    <div className="pt-2 border-t border-stone-100 flex items-center justify-between text-xs">
                      <span
                        className={
                          remainingBig < 0n
                            ? 'text-rose-700 font-semibold font-mono'
                            : 'text-emerald-800 font-mono font-medium'
                        }
                      >
                        {remainingBig < 0n
                          ? `Over by ${formatCents(-remainingBig)}`
                          : `${formatCents(remainingBig)} left`}
                      </span>

                      <span className={`text-[11px] font-semibold ${dynamicColor.twTextClass}`}>
                        {dynamicColor.statusLabel}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Create Budget Envelope Modal */}
          {isAddBudgetModalOpen && (
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="add-budget-modal-title"
              className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
            >
              <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 border border-stone-200 shadow-xl">
                <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                  <div>
                    <h3 id="add-budget-modal-title" className="text-base font-serif font-bold text-stone-900">
                      New Monthly Budget Envelope
                    </h3>
                    <p className="text-xs text-stone-500">
                      Configure a monthly category spending limit and alert threshold.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsAddBudgetModalOpen(false)}
                    className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100"
                    aria-label="Close modal"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <form onSubmit={handleSaveBudgetEnvelope} className="space-y-4 text-xs">
                  <div>
                    <label htmlFor="budget-cat-input" className="block text-stone-700 font-semibold mb-1">
                      Category Name
                    </label>
                    <input
                      id="budget-cat-input"
                      type="text"
                      required
                      value={budgetCatInput}
                      onChange={(e) => setBudgetCatInput(e.target.value)}
                      placeholder="e.g. GROCERIES, UTILITIES, DINING"
                      className="w-full px-3 py-2 rounded-xl border border-stone-300 uppercase font-mono focus:outline-none focus:border-emerald-800"
                    />
                  </div>

                  <div>
                    <label htmlFor="budget-alloc-input" className="block text-stone-700 font-semibold mb-1">
                      Monthly Allocation ($)
                    </label>
                    <input
                      id="budget-alloc-input"
                      type="text"
                      required
                      value={budgetAllocDollars}
                      onChange={(e) => setBudgetAllocDollars(e.target.value)}
                      placeholder="400.00"
                      className="w-full px-3 py-2 rounded-xl border border-stone-300 font-mono focus:outline-none focus:border-emerald-800"
                    />
                  </div>

                  <div>
                    <label htmlFor="budget-thresh-input" className="block text-stone-700 font-semibold mb-1">
                      Warning Alert Threshold (50% – 100%)
                    </label>
                    <input
                      id="budget-thresh-input"
                      type="number"
                      min={50}
                      max={100}
                      required
                      value={budgetThresholdPct}
                      onChange={(e) => setBudgetThresholdPct(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl border border-stone-300 font-mono focus:outline-none focus:border-emerald-800"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100">
                    <button
                      type="button"
                      disabled={isBudgetMutating}
                      onClick={() => setIsAddBudgetModalOpen(false)}
                      className="px-4 py-2 rounded-xl border border-stone-300 text-stone-700 font-semibold hover:bg-stone-100 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isBudgetMutating}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-white font-semibold shadow-xs disabled:opacity-50"
                      style={{ backgroundColor: BRAND.primary }}
                    >
                      {isBudgetMutating && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                      {isBudgetMutating ? 'Saving...' : 'Save Envelope'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Edit Budget Envelope Modal */}
          {editingBudget && (
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="edit-budget-modal-title"
              className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
            >
              <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 border border-stone-200 shadow-xl">
                <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                  <div>
                    <h3 id="edit-budget-modal-title" className="text-base font-serif font-bold text-stone-900">
                      Edit Budget Envelope
                    </h3>
                    <p className="text-xs text-stone-500">
                      Update category name, monthly limit, spent balance, or alert threshold.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditingBudget(null)}
                    className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100"
                    aria-label="Close edit modal"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <form onSubmit={handleUpdateBudgetEnvelope} className="space-y-4 text-xs">
                  <div>
                    <label htmlFor="edit-budget-cat" className="block text-stone-700 font-semibold mb-1">
                      Category Name
                    </label>
                    <input
                      id="edit-budget-cat"
                      type="text"
                      required
                      value={editingBudget.category}
                      onChange={(e) =>
                        setEditingBudget((prev) => (prev ? { ...prev, category: e.target.value } : null))
                      }
                      className="w-full px-3 py-2 rounded-xl border border-stone-300 uppercase font-mono focus:outline-none focus:border-emerald-800"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="edit-budget-alloc" className="block text-stone-700 font-semibold mb-1">
                        Monthly Limit ($)
                      </label>
                      <input
                        id="edit-budget-alloc"
                        type="text"
                        required
                        value={editingBudget.allocatedDollars}
                        onChange={(e) =>
                          setEditingBudget((prev) =>
                            prev ? { ...prev, allocatedDollars: e.target.value } : null
                          )
                        }
                        className="w-full px-3 py-2 rounded-xl border border-stone-300 font-mono focus:outline-none focus:border-emerald-800"
                      />
                    </div>

                    <div>
                      <label htmlFor="edit-budget-spent" className="block text-stone-700 font-semibold mb-1">
                        Spent Amount ($)
                      </label>
                      <input
                        id="edit-budget-spent"
                        type="text"
                        required
                        value={editingBudget.spentDollars}
                        onChange={(e) =>
                          setEditingBudget((prev) =>
                            prev ? { ...prev, spentDollars: e.target.value } : null
                          )
                        }
                        className="w-full px-3 py-2 rounded-xl border border-stone-300 font-mono focus:outline-none focus:border-emerald-800"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="edit-budget-thresh" className="block text-stone-700 font-semibold mb-1">
                      Warning Alert Threshold (50% – 100%)
                    </label>
                    <input
                      id="edit-budget-thresh"
                      type="number"
                      min={50}
                      max={100}
                      required
                      value={editingBudget.alertThresholdPercentage}
                      onChange={(e) =>
                        setEditingBudget((prev) =>
                          prev ? { ...prev, alertThresholdPercentage: Number(e.target.value) } : null
                        )
                      }
                      className="w-full px-3 py-2 rounded-xl border border-stone-300 font-mono focus:outline-none focus:border-emerald-800"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100">
                    <button
                      type="button"
                      disabled={isBudgetMutating}
                      onClick={() => setEditingBudget(null)}
                      className="px-4 py-2 rounded-xl border border-stone-300 text-stone-700 font-semibold hover:bg-stone-100 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isBudgetMutating}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-white font-semibold shadow-xs disabled:opacity-50"
                      style={{ backgroundColor: BRAND.primary }}
                    >
                      {isBudgetMutating && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                      {isBudgetMutating ? 'Updating...' : 'Save Changes'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          SECTION 5: SAVINGS GOALS & CONTRIBUTION HISTORY (STREAMLINED CRUD VIEW)
      ===================================================================== */}
      {!errorState && activeSection === 'savings' && (
        <div
          id="finance-panel-savings"
          role="tabpanel"
          aria-labelledby="finance-tab-savings"
          className="space-y-6"
        >
          {/* Top KPI Summary Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-2xl p-4 bg-white border border-stone-200 shadow-xs">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">
                Total Saved Reserves
              </span>
              <p className="text-xl font-serif font-bold text-emerald-900 font-mono mt-1">
                {formatCents(savingsRollup.totalCurrentCents)}
              </p>
              <span className="text-[11px] text-stone-500">
                Across {savingsGoals.length} {savingsGoals.length === 1 ? 'goal' : 'goals'} ({savingsRollup.overallProgressPct}% funded)
              </span>
            </div>

            <div className="rounded-2xl p-4 bg-white border border-stone-200 shadow-xs">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">
                Combined Target Reserve
              </span>
              <p className="text-xl font-serif font-bold text-stone-900 font-mono mt-1">
                {formatCents(savingsRollup.totalTargetCents)}
              </p>
              <span className="text-[11px] text-stone-500">
                {savingsRollup.completedCount} completed · {savingsRollup.inProgressCount} active
              </span>
            </div>

            <div className="rounded-2xl p-4 bg-white border border-stone-200 shadow-xs">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">
                Remaining to Target
              </span>
              <p className="text-xl font-serif font-bold text-stone-900 font-mono mt-1">
                {formatCents(savingsRollup.totalRemainingCents)}
              </p>
              <span className="text-[11px] text-stone-500">
                Unfunded reserve capacity
              </span>
            </div>

            <div className="rounded-2xl p-4 bg-white border border-stone-200 shadow-xs">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">
                Planned Monthly Savings
              </span>
              <p className="text-xl font-serif font-bold text-emerald-800 font-mono mt-1">
                {formatCents(savingsRollup.totalPlannedMonthlyCents)}
              </p>
              <span className="text-[11px] text-stone-500">
                Combined monthly installment target
              </span>
            </div>
          </div>

          {/* Filter, Search & Primary Action Bar */}
          <div className="rounded-2xl p-4 bg-white border border-stone-200 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {(
                [
                  { id: 'ALL', label: `All Goals (${savingsGoals.length})` },
                  { id: 'ACTIVE', label: `In Progress (${savingsRollup.inProgressCount})` },
                  { id: 'COMPLETED', label: `Completed (${savingsRollup.completedCount})` },
                ] as const
              ).map((tab) => {
                const active = savingsStatusFilter === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setSavingsStatusFilter(tab.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                      active
                        ? 'bg-emerald-900 text-white'
                        : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 sm:flex-initial sm:w-56">
                <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={savingsSearchQuery}
                  onChange={(e) => setSavingsSearchQuery(e.target.value)}
                  placeholder="Search savings goal..."
                  aria-label="Search savings goals"
                  className="w-full pl-8 pr-7 py-1.5 rounded-xl border border-stone-300 text-xs focus:outline-none focus:border-emerald-800"
                />
                {savingsSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setSavingsSearchQuery('')}
                    aria-label="Clear goal search"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => setIsSavingsPrintModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-stone-300 bg-white hover:bg-stone-50 text-stone-700 text-xs font-semibold cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Report</span>
              </button>

              {savingsGoals.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    if (!savingsGoals.some((g) => g.id === contribGoalId) && savingsGoals[0]) {
                      setContribGoalId(savingsGoals[0].id);
                    }
                    if (!accounts.some((a) => a.id === contribFundingAccountId) && accounts[0]) {
                      setContribFundingAccountId(accounts[0].id);
                    }
                    setContribAmountDollars('250.00');
                    setContribNotes('Monthly reserve deposit');
                    setIsContributeModalOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-emerald-800 text-emerald-900 hover:bg-emerald-50 text-xs font-semibold cursor-pointer"
                >
                  <PiggyBank className="w-3.5 h-3.5" />
                  <span>Record Deposit</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setNewGoalTitle('');
                  setNewGoalTargetDollars('5000.00');
                  setNewGoalCurrentDollars('0.00');
                  setNewGoalPlannedMonthlyDollars('250.00');
                  setNewGoalTargetDateIso(
                    new Date(Date.now() + 180 * 86400000).toISOString().slice(0, 10)
                  );
                  const defaultSavingsAcc =
                    accounts.find((a) => a.accountType === 'SAVINGS')?.id ||
                    accounts[0]?.id ||
                    'acc-2';
                  setNewGoalLinkedAccountId(defaultSavingsAcc);
                  setIsAddGoalModalOpen(true);
                }}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white shadow-xs transition-colors cursor-pointer"
                style={{ backgroundColor: BRAND.primary }}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Savings Goal</span>
              </button>
            </div>
          </div>

          {/* Minimalist Savings Goal Cards Grid */}
          {filteredSavingsGoals.length === 0 ? (
            <div className="rounded-2xl p-10 bg-white border border-dashed border-stone-300 text-center space-y-3">
              <PiggyBank className="w-8 h-8 text-stone-400 mx-auto" />
              <div className="space-y-1">
                <h3 className="text-sm font-serif font-bold text-stone-800">
                  {savingsGoals.length === 0
                    ? 'No Savings Goals Configured'
                    : 'No Matching Savings Goals'}
                </h3>
                <p className="text-xs text-stone-500 max-w-md mx-auto">
                  {savingsGoals.length === 0
                    ? 'Create your first household reserve goal to track target dates, monthly installments, and verified account transfers.'
                    : 'Try clearing your search query or switching the status filter above.'}
                </p>
              </div>
              {savingsGoals.length === 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    setNewGoalTitle('Emergency Reserve Fund');
                    setNewGoalTargetDollars('10000.00');
                    setNewGoalCurrentDollars('0.00');
                    setNewGoalPlannedMonthlyDollars('500.00');
                    setIsAddGoalModalOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white"
                  style={{ backgroundColor: BRAND.primary }}
                >
                  <Plus className="w-3.5 h-3.5" />
                  Create First Savings Goal
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setSavingsSearchQuery('');
                    setSavingsStatusFilter('ALL');
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-stone-300 text-stone-700 hover:bg-stone-100"
                >
                  Reset Filters
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filteredSavingsGoals.map((g) => {
                const linkedAccName = accounts.find((a) => a.id === g.linkedAccountId)?.name;
                return (
                  <SavingsGoalsCard
                    key={g.id}
                    goal={g}
                    brandBorder={BRAND.border}
                    linkedAccountName={linkedAccName}
                    onCheckOff={(goal) => {
                      setInstallmentModalGoal(goal);
                      const plannedBig = toBigIntOrZero(
                        goal.plannedMonthlyContributionCentsDecimal,
                        goal.plannedMonthlyContributionCents
                      );
                      const defaultAmtCents = plannedBig > 0n ? plannedBig : 25000n;
                      setInstallmentAmtDollars((Number(defaultAmtCents) / 100).toFixed(2));
                      if (!accounts.some((a) => a.id === installmentFundingAccId) && accounts[0]) {
                        setInstallmentFundingAccId(accounts[0].id);
                      }
                    }}
                    onEdit={(goal) => {
                      const targetBig = toBigIntOrZero(goal.targetCentsDecimal, goal.targetCents);
                      const currentBig = toBigIntOrZero(goal.currentCentsDecimal, goal.currentCents);
                      const plannedBig = toBigIntOrZero(
                        goal.plannedMonthlyContributionCentsDecimal,
                        goal.plannedMonthlyContributionCents
                      );
                      const isoDate = goal.targetDate
                        ? new Date(goal.targetDate).toISOString().slice(0, 10)
                        : '';
                      setEditingGoal({
                        id: goal.id,
                        title: goal.title,
                        targetDollars: (Number(targetBig) / 100).toFixed(2),
                        currentDollars: (Number(currentBig) / 100).toFixed(2),
                        plannedMonthlyDollars: (Number(plannedBig) / 100).toFixed(2),
                        targetDateIso: isoDate,
                        linkedAccountId:
                          goal.linkedAccountId ||
                          accounts.find((a) => a.accountType === 'SAVINGS')?.id ||
                          accounts[0]?.id ||
                          'acc-2',
                      });
                    }}
                    onDelete={(goal) => handleDeleteSavingsGoalConfirm(goal)}
                  />
                );
              })}
            </div>
          )}

          {/* Create Savings Goal Modal */}
          {isAddGoalModalOpen && (
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="add-goal-modal-title"
              className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
            >
              <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 border border-stone-200 shadow-xl">
                <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                  <div>
                    <h3 id="add-goal-modal-title" className="text-base font-serif font-bold text-stone-900">
                      Create New Savings Goal
                    </h3>
                    <p className="text-xs text-stone-500">
                      Define a target reserve amount, monthly installment plan, and linked account.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsAddGoalModalOpen(false)}
                    className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100"
                    aria-label="Close modal"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <form onSubmit={handleCreateSavingsGoal} className="space-y-4 text-xs">
                  <div>
                    <label htmlFor="new-goal-title" className="block text-stone-700 font-semibold mb-1">
                      Goal Name
                    </label>
                    <input
                      id="new-goal-title"
                      type="text"
                      required
                      value={newGoalTitle}
                      onChange={(e) => setNewGoalTitle(e.target.value)}
                      placeholder="e.g. Emergency Reserve, Family Summer Trip"
                      className="w-full px-3 py-2 rounded-xl border border-stone-300 focus:outline-none focus:border-emerald-800"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="new-goal-target" className="block text-stone-700 font-semibold mb-1">
                        Target Amount ($)
                      </label>
                      <input
                        id="new-goal-target"
                        type="text"
                        required
                        value={newGoalTargetDollars}
                        onChange={(e) => setNewGoalTargetDollars(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-stone-300 font-mono focus:outline-none focus:border-emerald-800"
                      />
                    </div>
                    <div>
                      <label htmlFor="new-goal-cur" className="block text-stone-700 font-semibold mb-1">
                        Opening Saved ($)
                      </label>
                      <input
                        id="new-goal-cur"
                        type="text"
                        required
                        value={newGoalCurrentDollars}
                        onChange={(e) => setNewGoalCurrentDollars(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-stone-300 font-mono focus:outline-none focus:border-emerald-800"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="new-goal-plan" className="block text-stone-700 font-semibold mb-1">
                        Planned Monthly ($)
                      </label>
                      <input
                        id="new-goal-plan"
                        type="text"
                        required
                        value={newGoalPlannedMonthlyDollars}
                        onChange={(e) => setNewGoalPlannedMonthlyDollars(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-stone-300 font-mono focus:outline-none focus:border-emerald-800"
                      />
                    </div>
                    <div>
                      <label htmlFor="new-goal-date" className="block text-stone-700 font-semibold mb-1">
                        Target Date
                      </label>
                      <input
                        id="new-goal-date"
                        type="date"
                        value={newGoalTargetDateIso}
                        onChange={(e) => setNewGoalTargetDateIso(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-stone-300 focus:outline-none focus:border-emerald-800"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="new-goal-linked-acc" className="block text-stone-700 font-semibold mb-1">
                      Linked Reserve Account
                    </label>
                    <select
                      id="new-goal-linked-acc"
                      value={newGoalLinkedAccountId}
                      onChange={(e) => setNewGoalLinkedAccountId(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white focus:outline-none focus:border-emerald-800"
                    >
                      {accounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name} ({formatCents(a.currentBalanceCentsDecimal ?? a.currentBalanceCents)})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100">
                    <button
                      type="button"
                      disabled={isSavingsMutating}
                      onClick={() => setIsAddGoalModalOpen(false)}
                      className="px-4 py-2 rounded-xl border border-stone-300 text-stone-700 font-semibold hover:bg-stone-100 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSavingsMutating}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-white font-semibold shadow-xs disabled:opacity-50"
                      style={{ backgroundColor: BRAND.primary }}
                    >
                      {isSavingsMutating && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                      {isSavingsMutating ? 'Creating...' : 'Create Goal'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Edit Savings Goal Modal */}
          {editingGoal && (
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="edit-goal-modal-title"
              className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
            >
              <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 border border-stone-200 shadow-xl">
                <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                  <div>
                    <h3 id="edit-goal-modal-title" className="text-base font-serif font-bold text-stone-900">
                      Edit Savings Goal
                    </h3>
                    <p className="text-xs text-stone-500">
                      Update goal title, target amount, saved balance, monthly plan, or target date.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditingGoal(null)}
                    className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100"
                    aria-label="Close edit modal"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <form onSubmit={handleUpdateSavingsGoal} className="space-y-4 text-xs">
                  <div>
                    <label htmlFor="edit-goal-title" className="block text-stone-700 font-semibold mb-1">
                      Goal Name
                    </label>
                    <input
                      id="edit-goal-title"
                      type="text"
                      required
                      value={editingGoal.title}
                      onChange={(e) =>
                        setEditingGoal((prev) => (prev ? { ...prev, title: e.target.value } : null))
                      }
                      className="w-full px-3 py-2 rounded-xl border border-stone-300 focus:outline-none focus:border-emerald-800"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="edit-goal-target" className="block text-stone-700 font-semibold mb-1">
                        Target Amount ($)
                      </label>
                      <input
                        id="edit-goal-target"
                        type="text"
                        required
                        value={editingGoal.targetDollars}
                        onChange={(e) =>
                          setEditingGoal((prev) =>
                            prev ? { ...prev, targetDollars: e.target.value } : null
                          )
                        }
                        className="w-full px-3 py-2 rounded-xl border border-stone-300 font-mono focus:outline-none focus:border-emerald-800"
                      />
                    </div>
                    <div>
                      <label htmlFor="edit-goal-cur" className="block text-stone-700 font-semibold mb-1">
                        Current Saved ($)
                      </label>
                      <input
                        id="edit-goal-cur"
                        type="text"
                        required
                        value={editingGoal.currentDollars}
                        onChange={(e) =>
                          setEditingGoal((prev) =>
                            prev ? { ...prev, currentDollars: e.target.value } : null
                          )
                        }
                        className="w-full px-3 py-2 rounded-xl border border-stone-300 font-mono focus:outline-none focus:border-emerald-800"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="edit-goal-plan" className="block text-stone-700 font-semibold mb-1">
                        Planned Monthly ($)
                      </label>
                      <input
                        id="edit-goal-plan"
                        type="text"
                        required
                        value={editingGoal.plannedMonthlyDollars}
                        onChange={(e) =>
                          setEditingGoal((prev) =>
                            prev ? { ...prev, plannedMonthlyDollars: e.target.value } : null
                          )
                        }
                        className="w-full px-3 py-2 rounded-xl border border-stone-300 font-mono focus:outline-none focus:border-emerald-800"
                      />
                    </div>
                    <div>
                      <label htmlFor="edit-goal-date" className="block text-stone-700 font-semibold mb-1">
                        Target Date
                      </label>
                      <input
                        id="edit-goal-date"
                        type="date"
                        value={editingGoal.targetDateIso}
                        onChange={(e) =>
                          setEditingGoal((prev) =>
                            prev ? { ...prev, targetDateIso: e.target.value } : null
                          )
                        }
                        className="w-full px-3 py-2 rounded-xl border border-stone-300 focus:outline-none focus:border-emerald-800"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="edit-goal-linked-acc" className="block text-stone-700 font-semibold mb-1">
                      Linked Reserve Account
                    </label>
                    <select
                      id="edit-goal-linked-acc"
                      value={editingGoal.linkedAccountId}
                      onChange={(e) =>
                        setEditingGoal((prev) =>
                          prev ? { ...prev, linkedAccountId: e.target.value } : null
                        )
                      }
                      className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white focus:outline-none focus:border-emerald-800"
                    >
                      {accounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name} ({formatCents(a.currentBalanceCentsDecimal ?? a.currentBalanceCents)})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100">
                    <button
                      type="button"
                      disabled={isSavingsMutating}
                      onClick={() => setEditingGoal(null)}
                      className="px-4 py-2 rounded-xl border border-stone-300 text-stone-700 font-semibold hover:bg-stone-100 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSavingsMutating}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-white font-semibold shadow-xs disabled:opacity-50"
                      style={{ backgroundColor: BRAND.primary }}
                    >
                      {isSavingsMutating && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                      {isSavingsMutating ? 'Updating...' : 'Save Changes'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Record Savings Contribution Modal */}
          {isContributeModalOpen && (
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="contribute-goal-modal-title"
              className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
            >
              <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 border border-stone-200 shadow-xl">
                <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                  <div>
                    <h3 id="contribute-goal-modal-title" className="text-base font-serif font-bold text-stone-900">
                      Record Savings Contribution
                    </h3>
                    <p className="text-xs text-stone-500">
                      Transfer funds from a household account into a designated savings goal.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsContributeModalOpen(false)}
                    className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100"
                    aria-label="Close contribution modal"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <form onSubmit={handleContributeToSavings} className="space-y-4 text-xs">
                  <div>
                    <label htmlFor="contrib-goal-select" className="block text-stone-700 font-semibold mb-1">
                      Target Savings Goal
                    </label>
                    <select
                      id="contrib-goal-select"
                      value={contribGoalId}
                      onChange={(e) => setContribGoalId(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white focus:outline-none focus:border-emerald-800"
                    >
                      {savingsGoals.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.title} ({formatCents(g.currentCentsDecimal ?? g.currentCents)} / {formatCents(g.targetCentsDecimal ?? g.targetCents)})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="contrib-funding-acc" className="block text-stone-700 font-semibold mb-1">
                      Source Funding Account (Debit)
                    </label>
                    <select
                      id="contrib-funding-acc"
                      value={contribFundingAccountId}
                      onChange={(e) => setContribFundingAccountId(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white focus:outline-none focus:border-emerald-800"
                    >
                      {accounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name} ({formatCents(a.currentBalanceCentsDecimal ?? a.currentBalanceCents)})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="contrib-amt" className="block text-stone-700 font-semibold mb-1">
                      Contribution Amount ($)
                    </label>
                    <input
                      id="contrib-amt"
                      type="text"
                      required
                      value={contribAmountDollars}
                      onChange={(e) => setContribAmountDollars(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-stone-300 font-mono focus:outline-none focus:border-emerald-800"
                    />
                  </div>

                  <div>
                    <label htmlFor="contrib-notes" className="block text-stone-700 font-semibold mb-1">
                      Contribution Note
                    </label>
                    <input
                      id="contrib-notes"
                      type="text"
                      value={contribNotes}
                      onChange={(e) => setContribNotes(e.target.value)}
                      placeholder="Monthly reserve deposit"
                      className="w-full px-3 py-2 rounded-xl border border-stone-300 focus:outline-none focus:border-emerald-800"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100">
                    <button
                      type="button"
                      disabled={isSavingsMutating}
                      onClick={() => setIsContributeModalOpen(false)}
                      className="px-4 py-2 rounded-xl border border-stone-300 text-stone-700 font-semibold hover:bg-stone-100 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSavingsMutating}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-white font-semibold shadow-xs disabled:opacity-50"
                      style={{ backgroundColor: BRAND.primary }}
                    >
                      {isSavingsMutating && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                      {isSavingsMutating ? 'Posting...' : 'Post Contribution'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          SECTION 6: RECURRING INCOME & EXPENSES (STREAMLINED CRUD VIEW)
      ===================================================================== */}
      {!errorState && activeSection === 'recurring' && (
        <div
          id="finance-panel-recurring"
          role="tabpanel"
          aria-labelledby="finance-tab-recurring"
          className="space-y-6"
        >
          {/* Top KPI Summary Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-2xl p-4 bg-white border border-stone-200 shadow-xs">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">
                Projected Monthly Income
              </span>
              <p className="text-xl font-serif font-bold text-emerald-800 font-mono mt-1">
                +{formatCents(recurringRollup.monthlyIncomeCents)}
              </p>
              <span className="text-[11px] text-stone-500">
                From {recurringRollup.incomeCount} recurring income {recurringRollup.incomeCount === 1 ? 'schedule' : 'schedules'}
              </span>
            </div>

            <div className="rounded-2xl p-4 bg-white border border-stone-200 shadow-xs">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">
                Projected Monthly Expenses
              </span>
              <p className="text-xl font-serif font-bold text-rose-800 font-mono mt-1">
                -{formatCents(recurringRollup.monthlyExpenseCents)}
              </p>
              <span className="text-[11px] text-stone-500">
                From {recurringRollup.expenseCount} recurring expense {recurringRollup.expenseCount === 1 ? 'schedule' : 'schedules'}
              </span>
            </div>

            <div className="rounded-2xl p-4 bg-white border border-stone-200 shadow-xs">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">
                Net Monthly Schedule Impact
              </span>
              <p
                className={`text-xl font-serif font-bold font-mono mt-1 ${
                  recurringRollup.netMonthlyBig < 0n ? 'text-rose-700' : 'text-emerald-900'
                }`}
              >
                {recurringRollup.netMonthlyBig < 0n
                  ? `-${formatCents(-recurringRollup.netMonthlyBig)}`
                  : `+${formatCents(recurringRollup.netMonthlyCents)}`}
              </p>
              <span className="text-[11px] text-stone-500">
                Normalized monthly cash-flow delta
              </span>
            </div>

            <div className="rounded-2xl p-4 bg-white border border-stone-200 shadow-xs">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">
                Schedule Status
              </span>
              <p className="text-xl font-serif font-bold text-stone-900 mt-1">
                {recurringRollup.activeCount} Active · {recurringRollup.pausedCount} Paused
              </p>
              <span className="text-[11px] text-stone-500">
                {recurringRollup.dueNowCount} {recurringRollup.dueNowCount === 1 ? 'entry' : 'entries'} currently due
              </span>
            </div>
          </div>

          {/* Filter, Search & Primary Action Bar */}
          <div className="rounded-2xl p-4 bg-white border border-stone-200 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {(
                [
                  { id: 'ALL', label: `All (${recurringRules.length})` },
                  { id: 'ACTIVE', label: `Active (${recurringRollup.activeCount})` },
                  { id: 'PAUSED', label: `Paused (${recurringRollup.pausedCount})` },
                  { id: 'INCOME', label: `Income (${recurringRollup.incomeCount})` },
                  { id: 'EXPENSE', label: `Expenses (${recurringRollup.expenseCount})` },
                ] as const
              ).map((tab) => {
                const active = recurringFilter === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setRecurringFilter(tab.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                      active
                        ? 'bg-emerald-900 text-white'
                        : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <div className="relative flex-1 sm:flex-initial sm:w-60">
                <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={recurringSearchQuery}
                  onChange={(e) => setRecurringSearchQuery(e.target.value)}
                  placeholder="Search title or category..."
                  aria-label="Search recurring schedules"
                  className="w-full pl-8 pr-7 py-1.5 rounded-xl border border-stone-300 text-xs focus:outline-none focus:border-emerald-800"
                />
                {recurringSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setRecurringSearchQuery('')}
                    aria-label="Clear recurring search"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => {
                  setNewRuleTitle('');
                  setNewRuleAccountId(accounts[0]?.id || 'acc-1');
                  setNewRuleType('EXPENSE');
                  setNewRuleCategory('UTILITIES');
                  setNewRuleAmountDollars('95.00');
                  setNewRuleFrequency('MONTHLY');
                  setNewRuleDueDateIso(new Date().toISOString().slice(0, 10));
                  setIsAddRuleModalOpen(true);
                }}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white shadow-xs transition-colors cursor-pointer"
                style={{ backgroundColor: BRAND.primary }}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Recurring Schedule</span>
              </button>
            </div>
          </div>

          {/* Minimalist Recurring Schedule Cards Grid */}
          {filteredRecurringRules.length === 0 ? (
            <div className="rounded-2xl p-10 bg-white border border-dashed border-stone-300 text-center space-y-3">
              <CalendarClock className="w-8 h-8 text-stone-400 mx-auto" />
              <div className="space-y-1">
                <h3 className="text-sm font-serif font-bold text-stone-800">
                  {recurringRules.length === 0
                    ? 'No Recurring Schedules Configured'
                    : 'No Matching Recurring Schedules'}
                </h3>
                <p className="text-xs text-stone-500 max-w-md mx-auto">
                  {recurringRules.length === 0
                    ? 'Add recurring income and expense schedules to automate ledger posting and cash-flow projections.'
                    : 'Try clearing your search query or switching the status filter above.'}
                </p>
              </div>
              {recurringRules.length === 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    setNewRuleTitle('Electric & Solar Utility');
                    setNewRuleAccountId(accounts[0]?.id || 'acc-1');
                    setNewRuleType('EXPENSE');
                    setNewRuleCategory('UTILITIES');
                    setNewRuleAmountDollars('95.00');
                    setNewRuleFrequency('MONTHLY');
                    setIsAddRuleModalOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white"
                  style={{ backgroundColor: BRAND.primary }}
                >
                  <Plus className="w-3.5 h-3.5" />
                  Create First Schedule
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setRecurringSearchQuery('');
                    setRecurringFilter('ALL');
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-stone-300 text-stone-700 hover:bg-stone-100"
                >
                  Reset Filters
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filteredRecurringRules.map((r) => {
                const accName = accounts.find((a) => a.id === r.accountId)?.name || r.accountId;
                const amtBig = toBigIntOrZero(r.amountCentsDecimal, r.amountCents);
                const isInc = String(r.transactionType || 'EXPENSE').toUpperCase() === 'INCOME';

                return (
                  <div
                    key={r.id}
                    className={`rounded-2xl border p-5 flex flex-col justify-between gap-4 transition-all shadow-xs ${
                      r.isActive ? 'bg-white border-stone-200' : 'bg-stone-50/80 border-stone-200 opacity-80'
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500">
                          <span className="font-mono font-bold text-stone-800 uppercase">
                            {r.recurrenceInterval || r.frequency}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span
                            className={`font-semibold ${
                              isInc ? 'text-emerald-800' : 'text-rose-800'
                            }`}
                          >
                            {r.transactionType}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono">{r.category}</span>
                          <span aria-hidden="true">·</span>
                          <span
                            className={`font-semibold ${
                              r.isActive ? 'text-emerald-800' : 'text-amber-800'
                            }`}
                          >
                            {r.isActive ? 'Active' : 'Paused'}
                          </span>
                        </div>
                        <h4 className="text-base font-serif font-bold text-stone-900 tracking-tight">
                          {r.title}
                        </h4>
                        <p className="text-xs text-stone-500">
                          Account: <strong className="text-stone-700">{accName}</strong> · Next Due:{' '}
                          <strong className="text-stone-800">
                            {new Date(r.nextDueDate).toLocaleDateString()}
                          </strong>
                        </p>
                      </div>

                      <div className="text-right">
                        <div
                          className={`text-lg font-mono font-bold ${
                            isInc ? 'text-emerald-800' : 'text-rose-800'
                          }`}
                        >
                          {isInc ? '+' : '-'}
                          {formatCents(r.amountCentsDecimal ?? r.amountCents)}
                        </div>
                        <span className="text-[11px] text-stone-500 block">
                          Scheduled cycle amount
                        </span>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-stone-100 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={!r.isActive || isRecurringMutating}
                          onClick={() => handleGenerateRecurringTransaction(r)}
                          className="px-3 py-1.5 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-semibold disabled:opacity-40 cursor-pointer transition-colors"
                        >
                          Post Due Entry
                        </button>
                        <button
                          type="button"
                          disabled={isRecurringMutating}
                          onClick={() => handleToggleRecurringRule(r)}
                          className="px-2.5 py-1.5 rounded-xl border border-stone-300 text-xs font-semibold text-stone-700 hover:bg-stone-100 inline-flex items-center gap-1 cursor-pointer transition-colors disabled:opacity-50"
                        >
                          {r.isActive ? (
                            <>
                              <PauseCircle className="w-3.5 h-3.5" />
                              <span>Pause</span>
                            </>
                          ) : (
                            <>
                              <PlayCircle className="w-3.5 h-3.5" />
                              <span>Resume</span>
                            </>
                          )}
                        </button>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            const dueIso = r.nextDueDate
                              ? new Date(r.nextDueDate).toISOString().slice(0, 10)
                              : new Date().toISOString().slice(0, 10);
                            setEditingRule({
                              id: r.id,
                              title: r.title,
                              accountId: r.accountId || accounts[0]?.id || 'acc-1',
                              transactionType: isInc ? 'INCOME' : 'EXPENSE',
                              category: r.category || 'UTILITIES',
                              amountDollars: (Number(amtBig) / 100).toFixed(2),
                              frequency: r.recurrenceInterval || r.frequency || 'MONTHLY',
                              dueDateIso: dueIso,
                              isActive: Boolean(r.isActive),
                            });
                          }}
                          title={`Edit ${r.title}`}
                          aria-label={`Edit ${r.title}`}
                          className="p-1.5 rounded-lg text-stone-500 hover:text-stone-900 hover:bg-stone-100 transition-colors cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteRecurringRuleConfirm(r)}
                          title={`Delete ${r.title}`}
                          aria-label={`Delete ${r.title}`}
                          className="p-1.5 rounded-lg text-stone-500 hover:text-rose-700 hover:bg-rose-50 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Create Recurring Schedule Modal */}
          {isAddRuleModalOpen && (
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="add-rule-modal-title"
              className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
            >
              <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 border border-stone-200 shadow-xl">
                <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                  <div>
                    <h3 id="add-rule-modal-title" className="text-base font-serif font-bold text-stone-900">
                      New Recurring Schedule
                    </h3>
                    <p className="text-xs text-stone-500">
                      Configure a recurring income or expense schedule linked to a household account.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsAddRuleModalOpen(false)}
                    className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100"
                    aria-label="Close modal"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <form onSubmit={handleCreateRecurringRule} className="space-y-4 text-xs">
                  <div>
                    <label htmlFor="rec-rule-title" className="block text-stone-700 font-semibold mb-1">
                      Schedule Title
                    </label>
                    <input
                      id="rec-rule-title"
                      type="text"
                      required
                      value={newRuleTitle}
                      onChange={(e) => setNewRuleTitle(e.target.value)}
                      placeholder="e.g. Electric & Solar Utility"
                      className="w-full px-3 py-2 rounded-xl border border-stone-300 focus:outline-none focus:border-emerald-800"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="rec-rule-type" className="block text-stone-700 font-semibold mb-1">
                        Transaction Type
                      </label>
                      <select
                        id="rec-rule-type"
                        value={newRuleType}
                        onChange={(e) => setNewRuleType(e.target.value as any)}
                        className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white focus:outline-none focus:border-emerald-800"
                      >
                        <option value="EXPENSE">EXPENSE</option>
                        <option value="INCOME">INCOME</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="rec-rule-freq" className="block text-stone-700 font-semibold mb-1">
                        Recurrence Frequency
                      </label>
                      <select
                        id="rec-rule-freq"
                        value={newRuleFrequency}
                        onChange={(e) => setNewRuleFrequency(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white focus:outline-none focus:border-emerald-800"
                      >
                        <option value="DAILY">DAILY</option>
                        <option value="WEEKLY">WEEKLY</option>
                        <option value="BIWEEKLY">BIWEEKLY</option>
                        <option value="MONTHLY">MONTHLY</option>
                        <option value="QUARTERLY">QUARTERLY</option>
                        <option value="ANNUAL">ANNUAL</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="rec-rule-acc" className="block text-stone-700 font-semibold mb-1">
                        Linked Account
                      </label>
                      <select
                        id="rec-rule-acc"
                        value={newRuleAccountId}
                        onChange={(e) => setNewRuleAccountId(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white focus:outline-none focus:border-emerald-800"
                      >
                        {accounts.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="rec-rule-cat" className="block text-stone-700 font-semibold mb-1">
                        Category
                      </label>
                      <input
                        id="rec-rule-cat"
                        type="text"
                        required
                        value={newRuleCategory}
                        onChange={(e) => setNewRuleCategory(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-stone-300 uppercase font-mono focus:outline-none focus:border-emerald-800"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="rec-rule-amt" className="block text-stone-700 font-semibold mb-1">
                        Amount ($)
                      </label>
                      <input
                        id="rec-rule-amt"
                        type="text"
                        required
                        value={newRuleAmountDollars}
                        onChange={(e) => setNewRuleAmountDollars(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-stone-300 font-mono focus:outline-none focus:border-emerald-800"
                      />
                    </div>
                    <div>
                      <label htmlFor="rec-rule-due" className="block text-stone-700 font-semibold mb-1">
                        Next Due Date
                      </label>
                      <input
                        id="rec-rule-due"
                        type="date"
                        required
                        value={newRuleDueDateIso}
                        onChange={(e) => setNewRuleDueDateIso(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-stone-300 focus:outline-none focus:border-emerald-800"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100">
                    <button
                      type="button"
                      disabled={isRecurringMutating}
                      onClick={() => setIsAddRuleModalOpen(false)}
                      className="px-4 py-2 rounded-xl border border-stone-300 text-stone-700 font-semibold hover:bg-stone-100 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isRecurringMutating}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-white font-semibold shadow-xs disabled:opacity-50"
                      style={{ backgroundColor: BRAND.primary }}
                    >
                      {isRecurringMutating && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                      {isRecurringMutating ? 'Saving...' : 'Save Schedule'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Edit Recurring Schedule Modal */}
          {editingRule && (
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="edit-rule-modal-title"
              className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
            >
              <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 border border-stone-200 shadow-xl">
                <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                  <div>
                    <h3 id="edit-rule-modal-title" className="text-base font-serif font-bold text-stone-900">
                      Edit Recurring Schedule
                    </h3>
                    <p className="text-xs text-stone-500">
                      Update schedule title, account, frequency, amount, or next due date.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditingRule(null)}
                    className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100"
                    aria-label="Close edit modal"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <form onSubmit={handleUpdateRecurringRule} className="space-y-4 text-xs">
                  <div>
                    <label htmlFor="edit-rule-title" className="block text-stone-700 font-semibold mb-1">
                      Schedule Title
                    </label>
                    <input
                      id="edit-rule-title"
                      type="text"
                      required
                      value={editingRule.title}
                      onChange={(e) =>
                        setEditingRule((prev) => (prev ? { ...prev, title: e.target.value } : null))
                      }
                      className="w-full px-3 py-2 rounded-xl border border-stone-300 focus:outline-none focus:border-emerald-800"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="edit-rule-type" className="block text-stone-700 font-semibold mb-1">
                        Transaction Type
                      </label>
                      <select
                        id="edit-rule-type"
                        value={editingRule.transactionType}
                        onChange={(e) =>
                          setEditingRule((prev) =>
                            prev ? { ...prev, transactionType: e.target.value as any } : null
                          )
                        }
                        className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white focus:outline-none focus:border-emerald-800"
                      >
                        <option value="EXPENSE">EXPENSE</option>
                        <option value="INCOME">INCOME</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="edit-rule-freq" className="block text-stone-700 font-semibold mb-1">
                        Recurrence Frequency
                      </label>
                      <select
                        id="edit-rule-freq"
                        value={editingRule.frequency}
                        onChange={(e) =>
                          setEditingRule((prev) =>
                            prev ? { ...prev, frequency: e.target.value } : null
                          )
                        }
                        className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white focus:outline-none focus:border-emerald-800"
                      >
                        <option value="DAILY">DAILY</option>
                        <option value="WEEKLY">WEEKLY</option>
                        <option value="BIWEEKLY">BIWEEKLY</option>
                        <option value="MONTHLY">MONTHLY</option>
                        <option value="QUARTERLY">QUARTERLY</option>
                        <option value="ANNUAL">ANNUAL</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="edit-rule-acc" className="block text-stone-700 font-semibold mb-1">
                        Linked Account
                      </label>
                      <select
                        id="edit-rule-acc"
                        value={editingRule.accountId}
                        onChange={(e) =>
                          setEditingRule((prev) =>
                            prev ? { ...prev, accountId: e.target.value } : null
                          )
                        }
                        className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white focus:outline-none focus:border-emerald-800"
                      >
                        {accounts.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="edit-rule-cat" className="block text-stone-700 font-semibold mb-1">
                        Category
                      </label>
                      <input
                        id="edit-rule-cat"
                        type="text"
                        required
                        value={editingRule.category}
                        onChange={(e) =>
                          setEditingRule((prev) =>
                            prev ? { ...prev, category: e.target.value } : null
                          )
                        }
                        className="w-full px-3 py-2 rounded-xl border border-stone-300 uppercase font-mono focus:outline-none focus:border-emerald-800"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="edit-rule-amt" className="block text-stone-700 font-semibold mb-1">
                        Amount ($)
                      </label>
                      <input
                        id="edit-rule-amt"
                        type="text"
                        required
                        value={editingRule.amountDollars}
                        onChange={(e) =>
                          setEditingRule((prev) =>
                            prev ? { ...prev, amountDollars: e.target.value } : null
                          )
                        }
                        className="w-full px-3 py-2 rounded-xl border border-stone-300 font-mono focus:outline-none focus:border-emerald-800"
                      />
                    </div>
                    <div>
                      <label htmlFor="edit-rule-due" className="block text-stone-700 font-semibold mb-1">
                        Next Due Date
                      </label>
                      <input
                        id="edit-rule-due"
                        type="date"
                        required
                        value={editingRule.dueDateIso}
                        onChange={(e) =>
                          setEditingRule((prev) =>
                            prev ? { ...prev, dueDateIso: e.target.value } : null
                          )
                        }
                        className="w-full px-3 py-2 rounded-xl border border-stone-300 focus:outline-none focus:border-emerald-800"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100">
                    <button
                      type="button"
                      disabled={isRecurringMutating}
                      onClick={() => setEditingRule(null)}
                      className="px-4 py-2 rounded-xl border border-stone-300 text-stone-700 font-semibold hover:bg-stone-100 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isRecurringMutating}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-white font-semibold shadow-xs disabled:opacity-50"
                      style={{ backgroundColor: BRAND.primary }}
                    >
                      {isRecurringMutating && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                      {isRecurringMutating ? 'Updating...' : 'Save Changes'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          SECTION 7: INVESTMENTS & COST-BASIS PORTFOLIO (STREAMLINED CRUD VIEW)
      ===================================================================== */}
      {!errorState && activeSection === 'investments' && (
        <div
          id="finance-panel-investments"
          role="tabpanel"
          aria-labelledby="finance-tab-investments"
          className="space-y-6"
        >
          {/* Top KPI Summary Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-2xl p-4 bg-white border border-stone-200 shadow-xs">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">
                Total Purchase Cost Basis
              </span>
              <p className="text-xl font-serif font-bold font-mono text-stone-900 mt-1">
                {formatCents(investmentSummary?.totalCostBasisCentsDecimal ?? investmentSummary?.totalCostBasisCents ?? 0)}
              </p>
              <span className="text-[11px] text-stone-500">
                Across {investmentHoldings.length} active {investmentHoldings.length === 1 ? 'position' : 'positions'}
              </span>
            </div>

            <div className="rounded-2xl p-4 bg-white border border-stone-200 shadow-xs">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">
                Current Portfolio Valuation
              </span>
              <p className="text-xl font-serif font-bold font-mono text-emerald-900 mt-1">
                {formatCents(investmentSummary?.totalValuationCentsDecimal ?? investmentSummary?.totalValuationCents ?? 0)}
              </p>
              <span className="text-[11px] text-stone-500">
                ⌊(microshares × unitPriceCents) / 10⁶⌋
              </span>
            </div>

            <div className="rounded-2xl p-4 bg-white border border-stone-200 shadow-xs">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">
                Total Unrealized Gain / Loss
              </span>
              <p
                className={`text-xl font-serif font-bold font-mono mt-1 ${
                  toBigIntOrZero(
                    investmentSummary?.totalUnrealizedGainLossCentsDecimal,
                    investmentSummary?.totalUnrealizedGainLossCents
                  ) >= 0n
                    ? 'text-emerald-800'
                    : 'text-rose-700'
                }`}
              >
                {toBigIntOrZero(
                  investmentSummary?.totalUnrealizedGainLossCentsDecimal,
                  investmentSummary?.totalUnrealizedGainLossCents
                ) >= 0n
                  ? '+'
                  : ''}
                {formatCents(
                  investmentSummary?.totalUnrealizedGainLossCentsDecimal ??
                    investmentSummary?.totalUnrealizedGainLossCents ??
                    0
                )}
              </p>
              <span className="text-[11px] text-stone-500">
                Valuation minus purchase cost basis
              </span>
            </div>

            <div className="rounded-2xl p-4 bg-white border border-stone-200 shadow-xs">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">
                Portfolio Return (Basis Points)
              </span>
              <p
                className={`text-xl font-serif font-bold font-mono mt-1 ${
                  toBigIntOrZero(
                    investmentSummary?.totalReturnBasisPointsDecimal,
                    investmentSummary?.totalReturnBasisPoints
                  ) >= 0n
                    ? 'text-emerald-800'
                    : 'text-rose-700'
                }`}
              >
                {formatBasisPoints(
                  investmentSummary?.totalReturnBasisPointsDecimal ?? investmentSummary?.totalReturnBasisPoints ?? 0
                )}
              </p>
              <span className="text-[11px] text-stone-500">
                {investmentSummary?.totalReturnBasisPointsDecimal ?? investmentSummary?.totalReturnBasisPoints ?? 0} bps (100 bps = 1.00%)
              </span>
            </div>
          </div>

          {/* Filter, Search & Primary Action Bar */}
          <div className="rounded-2xl p-4 bg-white border border-stone-200 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {(['ALL', 'STOCK', 'ETF', 'CRYPTO', 'MUTUAL_FUND', 'BOND', 'RETIREMENT'] as const).map(
                (typeId) => {
                  const active = invTypeFilter === typeId;
                  return (
                    <button
                      key={typeId}
                      type="button"
                      onClick={() => setInvTypeFilter(typeId)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                        active
                          ? 'bg-emerald-900 text-white'
                          : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                      }`}
                    >
                      {typeId === 'ALL' ? `All (${investmentHoldings.length})` : typeId.replace('_', ' ')}
                    </button>
                  );
                }
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <div className="relative flex-1 sm:flex-initial sm:w-60">
                <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={invSearchQuery}
                  onChange={(e) => setInvSearchQuery(e.target.value)}
                  placeholder="Search ticker or asset..."
                  aria-label="Search investment holdings"
                  className="w-full pl-8 pr-7 py-1.5 rounded-xl border border-stone-300 text-xs focus:outline-none focus:border-emerald-800"
                />
                {invSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setInvSearchQuery('')}
                    aria-label="Clear investment search"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => {
                  setInvSymbol('');
                  setInvAssetName('');
                  setInvAssetType('STOCK');
                  setInvSharesInput('10.000000');
                  setInvCostBasisDollars('1500.00');
                  setInvUnitPriceDollars('155.00');
                  setInvFundingAccountId('');
                  setIsAddHoldingModalOpen(true);
                }}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white shadow-xs transition-colors cursor-pointer"
                style={{ backgroundColor: BRAND.primary }}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Record Investment Position</span>
              </button>
            </div>
          </div>

          {/* Minimalist Holdings Grid */}
          {filteredHoldings.length === 0 ? (
            <div className="rounded-2xl p-10 bg-white border border-dashed border-stone-300 text-center space-y-3">
              <TrendingUp className="w-8 h-8 text-stone-400 mx-auto" />
              <div className="space-y-1">
                <h3 className="text-sm font-serif font-bold text-stone-800">
                  {investmentHoldings.length === 0
                    ? 'No Active Investment Holdings'
                    : 'No Matching Investment Holdings'}
                </h3>
                <p className="text-xs text-stone-500 max-w-md mx-auto">
                  {investmentHoldings.length === 0
                    ? 'Record your first stock, ETF, retirement, or bond position with microshare precision.'
                    : 'Try clearing your ticker search or switching the asset type filter above.'}
                </p>
              </div>
              {investmentHoldings.length === 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    setInvSymbol('VTI');
                    setInvAssetName('Vanguard Total Stock Market ETF');
                    setInvAssetType('ETF');
                    setInvSharesInput('10.000000');
                    setInvCostBasisDollars('2500.00');
                    setInvUnitPriceDollars('265.00');
                    setIsAddHoldingModalOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white"
                  style={{ backgroundColor: BRAND.primary }}
                >
                  <Plus className="w-3.5 h-3.5" />
                  Record First Holding
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setInvSearchQuery('');
                    setInvTypeFilter('ALL');
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-stone-300 text-stone-700 hover:bg-stone-100"
                >
                  Reset Filters
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filteredHoldings.map((h) => {
                const gainBig = toBigIntOrZero(h.unrealizedGainLossCentsDecimal, h.unrealizedGainLossCents);
                const isPositive = gainBig >= 0n;
                const qBig = toBigIntOrZero(h.quantityMicrosharesDecimal, h.quantityMicroshares);
                const basisBig = toBigIntOrZero(h.costBasisCentsDecimal, h.costBasisCents);
                const priceBig = toBigIntOrZero(h.currentPriceCentsDecimal, h.currentPriceCents);

                return (
                  <div
                    key={h.id}
                    className="rounded-2xl border border-stone-200 p-5 bg-white shadow-xs flex flex-col justify-between gap-4 transition-all hover:shadow-md"
                  >
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2 text-xs text-stone-500">
                            <span className="px-2 py-0.5 rounded-md bg-stone-100 font-mono font-bold text-stone-900">
                              {h.symbol}
                            </span>
                            <span>{h.assetType}</span>
                            <span aria-hidden="true">·</span>
                            <span>
                              Updated{' '}
                              {new Date(h.lastPriceUpdatedAt).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                          <h4 className="text-base font-serif font-bold text-stone-900 mt-1">
                            {h.assetName}
                          </h4>
                        </div>

                        <div className="flex items-center gap-2">
                          <div className="text-right">
                            <div className="text-lg font-mono font-bold text-stone-900">
                              {formatCents(h.currentValuationCentsDecimal ?? h.currentValuationCents)}
                            </div>
                            <div
                              className={`text-xs font-mono font-semibold ${
                                isPositive ? 'text-emerald-800' : 'text-rose-700'
                              }`}
                            >
                              {isPositive ? '+' : ''}
                              {formatCents(h.unrealizedGainLossCentsDecimal ?? h.unrealizedGainLossCents)} (
                              {formatBasisPoints(h.gainLossBasisPointsDecimal ?? h.gainLossBasisPoints)})
                            </div>
                          </div>

                          <div className="flex items-center gap-1 ml-1">
                            <button
                              type="button"
                              onClick={() => {
                                const whole = qBig / 1000000n;
                                const frac = (qBig % 1000000n).toString().padStart(6, '0');
                                setEditingHolding({
                                  id: h.id,
                                  symbol: h.symbol,
                                  assetName: h.assetName,
                                  assetType: h.assetType || 'STOCK',
                                  sharesInput: `${whole.toString()}.${frac}`,
                                  costBasisDollars: (Number(basisBig) / 100).toFixed(2),
                                  unitPriceDollars: (Number(priceBig) / 100).toFixed(2),
                                });
                              }}
                              title={`Edit ${h.symbol} position`}
                              aria-label={`Edit ${h.symbol} position`}
                              className="p-1.5 rounded-lg text-stone-500 hover:text-stone-900 hover:bg-stone-100 transition-colors cursor-pointer"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              aria-label={`Archive holding ${h.symbol}`}
                              title={`Archive holding ${h.symbol}`}
                              onClick={() =>
                                setConfirmModal({
                                  kind: 'DELETE_HOLDING',
                                  targetId: h.id,
                                  targetLabel: `${h.symbol} (${h.assetName})`,
                                  amountLabel: formatCents(
                                    h.currentValuationCentsDecimal ?? h.currentValuationCents
                                  ),
                                  reason: 'Portfolio rebalance / archive',
                                })
                              }
                              className="p-1.5 rounded-lg text-stone-500 hover:text-rose-700 hover:bg-rose-50 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Compact 3-Column Position Metrics */}
                      <div className="grid grid-cols-3 gap-2 pt-1 text-xs">
                        <div className="p-2.5 rounded-xl bg-stone-50 border border-stone-200/80">
                          <span className="text-[10px] text-stone-500 block">Quantity</span>
                          <span className="font-mono font-bold text-stone-900">
                            {formatMicroshares(h.quantityMicrosharesDecimal ?? h.quantityMicroshares, true)}
                          </span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-stone-50 border border-stone-200/80">
                          <span className="text-[10px] text-stone-500 block">Cost Basis</span>
                          <span className="font-mono font-bold text-stone-900">
                            {formatCents(h.costBasisCentsDecimal ?? h.costBasisCents)}
                          </span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-stone-50 border border-stone-200/80">
                          <span className="text-[10px] text-stone-500 block">Unit Price</span>
                          <span className="font-mono font-bold text-stone-900">
                            {formatCents(h.currentPriceCentsDecimal ?? h.currentPriceCents)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Quick Unit Price Update Bar */}
                    <div className="pt-3 border-t border-stone-100 flex items-center justify-between gap-2 text-xs">
                      <span className="text-[11px] text-stone-500 font-mono">
                        {formatSignedIntegerWithCommas(h.quantityMicrosharesDecimal ?? h.quantityMicroshares)} microshares
                      </span>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          aria-label={`New market price for ${h.symbol}`}
                          placeholder="New price ($)"
                          value={priceUpdateMap[h.id] ?? ''}
                          onChange={(e) =>
                            setPriceUpdateMap((prev) => ({ ...prev, [h.id]: e.target.value }))
                          }
                          className="w-28 px-2.5 py-1.5 rounded-xl border border-stone-300 font-mono text-xs focus:outline-none focus:border-emerald-800"
                        />
                        <button
                          type="button"
                          disabled={isInvMutating}
                          onClick={() => handleUpdateMarketPrice(h)}
                          className="px-3 py-1.5 rounded-xl bg-stone-900 text-white font-semibold hover:bg-stone-800 disabled:opacity-50 cursor-pointer"
                        >
                          Update Price
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Record Investment Position Modal */}
          {isAddHoldingModalOpen && (
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="add-holding-modal-title"
              className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
            >
              <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 border border-stone-200 shadow-xl">
                <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                  <div>
                    <h3 id="add-holding-modal-title" className="text-base font-serif font-bold text-stone-900">
                      Record Investment Position
                    </h3>
                    <p className="text-xs text-stone-500">
                      Add a holding with 6-decimal microshare precision and integer-cents cost basis.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsAddHoldingModalOpen(false)}
                    className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100"
                    aria-label="Close modal"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <form onSubmit={handleRecordInvestmentPurchase} className="space-y-4 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="inv-symbol" className="block text-stone-700 font-semibold mb-1">
                        Ticker Symbol
                      </label>
                      <input
                        id="inv-symbol"
                        type="text"
                        required
                        value={invSymbol}
                        onChange={(e) => setInvSymbol(e.target.value)}
                        placeholder="e.g. MSFT, VTI"
                        className="w-full px-3 py-2 rounded-xl border border-stone-300 font-mono uppercase focus:outline-none focus:border-emerald-800"
                      />
                    </div>
                    <div>
                      <label htmlFor="inv-type" className="block text-stone-700 font-semibold mb-1">
                        Asset Type
                      </label>
                      <select
                        id="inv-type"
                        value={invAssetType}
                        onChange={(e) => setInvAssetType(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white focus:outline-none focus:border-emerald-800"
                      >
                        <option value="STOCK">STOCK</option>
                        <option value="ETF">ETF</option>
                        <option value="CRYPTO">CRYPTO</option>
                        <option value="MUTUAL_FUND">MUTUAL_FUND</option>
                        <option value="BOND">BOND</option>
                        <option value="RETIREMENT">RETIREMENT</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="inv-name" className="block text-stone-700 font-semibold mb-1">
                      Asset Name
                    </label>
                    <input
                      id="inv-name"
                      type="text"
                      required
                      value={invAssetName}
                      onChange={(e) => setInvAssetName(e.target.value)}
                      placeholder="e.g. Microsoft Corp."
                      className="w-full px-3 py-2 rounded-xl border border-stone-300 focus:outline-none focus:border-emerald-800"
                    />
                  </div>

                  <div>
                    <label htmlFor="inv-shares" className="block text-stone-700 font-semibold mb-1">
                      Share / Unit Quantity (up to 6 decimals)
                    </label>
                    <input
                      id="inv-shares"
                      type="text"
                      required
                      value={invSharesInput}
                      onChange={(e) => setInvSharesInput(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-stone-300 font-mono focus:outline-none focus:border-emerald-800"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="inv-cost" className="block text-stone-700 font-semibold mb-1">
                        Total Cost Basis ($)
                      </label>
                      <input
                        id="inv-cost"
                        type="text"
                        required
                        value={invCostBasisDollars}
                        onChange={(e) => setInvCostBasisDollars(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-stone-300 font-mono focus:outline-none focus:border-emerald-800"
                      />
                    </div>
                    <div>
                      <label htmlFor="inv-price" className="block text-stone-700 font-semibold mb-1">
                        Unit Market Price ($)
                      </label>
                      <input
                        id="inv-price"
                        type="text"
                        required
                        value={invUnitPriceDollars}
                        onChange={(e) => setInvUnitPriceDollars(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-stone-300 font-mono focus:outline-none focus:border-emerald-800"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="inv-funding" className="block text-stone-700 font-semibold mb-1">
                      Debit Cash Funding Account (Optional)
                    </label>
                    <select
                      id="inv-funding"
                      value={invFundingAccountId}
                      onChange={(e) => setInvFundingAccountId(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white focus:outline-none focus:border-emerald-800"
                    >
                      <option value="">Existing Position (No Cash Debit)</option>
                      {accounts
                        .filter((a) => !a.isLiability)
                        .map((a) => (
                          <option key={a.id} value={a.id}>
                            Debit {a.name} ({formatCents(a.currentBalanceCentsDecimal ?? a.currentBalanceCents)})
                          </option>
                        ))}
                    </select>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100">
                    <button
                      type="button"
                      disabled={isInvMutating}
                      onClick={() => setIsAddHoldingModalOpen(false)}
                      className="px-4 py-2 rounded-xl border border-stone-300 text-stone-700 font-semibold hover:bg-stone-100 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isInvMutating}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-white font-semibold shadow-xs disabled:opacity-50"
                      style={{ backgroundColor: BRAND.primary }}
                    >
                      {isInvMutating && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                      {isInvMutating ? 'Recording...' : 'Record Holding'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Edit Investment Position Modal */}
          {editingHolding && (
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="edit-holding-modal-title"
              className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
            >
              <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 border border-stone-200 shadow-xl">
                <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                  <div>
                    <h3 id="edit-holding-modal-title" className="text-base font-serif font-bold text-stone-900">
                      Edit Investment Position
                    </h3>
                    <p className="text-xs text-stone-500">
                      Update ticker symbol, asset name, share quantity, cost basis, or market price.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditingHolding(null)}
                    className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100"
                    aria-label="Close edit modal"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <form onSubmit={handleUpdateInvestmentHolding} className="space-y-4 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="edit-inv-symbol" className="block text-stone-700 font-semibold mb-1">
                        Ticker Symbol
                      </label>
                      <input
                        id="edit-inv-symbol"
                        type="text"
                        required
                        value={editingHolding.symbol}
                        onChange={(e) =>
                          setEditingHolding((prev) =>
                            prev ? { ...prev, symbol: e.target.value } : null
                          )
                        }
                        className="w-full px-3 py-2 rounded-xl border border-stone-300 font-mono uppercase focus:outline-none focus:border-emerald-800"
                      />
                    </div>
                    <div>
                      <label htmlFor="edit-inv-type" className="block text-stone-700 font-semibold mb-1">
                        Asset Type
                      </label>
                      <select
                        id="edit-inv-type"
                        value={editingHolding.assetType}
                        onChange={(e) =>
                          setEditingHolding((prev) =>
                            prev ? { ...prev, assetType: e.target.value } : null
                          )
                        }
                        className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white focus:outline-none focus:border-emerald-800"
                      >
                        <option value="STOCK">STOCK</option>
                        <option value="ETF">ETF</option>
                        <option value="CRYPTO">CRYPTO</option>
                        <option value="MUTUAL_FUND">MUTUAL_FUND</option>
                        <option value="BOND">BOND</option>
                        <option value="RETIREMENT">RETIREMENT</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="edit-inv-name" className="block text-stone-700 font-semibold mb-1">
                      Asset Name
                    </label>
                    <input
                      id="edit-inv-name"
                      type="text"
                      required
                      value={editingHolding.assetName}
                      onChange={(e) =>
                        setEditingHolding((prev) =>
                          prev ? { ...prev, assetName: e.target.value } : null
                        )
                      }
                      className="w-full px-3 py-2 rounded-xl border border-stone-300 focus:outline-none focus:border-emerald-800"
                    />
                  </div>

                  <div>
                    <label htmlFor="edit-inv-shares" className="block text-stone-700 font-semibold mb-1">
                      Share / Unit Quantity (up to 6 decimals)
                    </label>
                    <input
                      id="edit-inv-shares"
                      type="text"
                      required
                      value={editingHolding.sharesInput}
                      onChange={(e) =>
                        setEditingHolding((prev) =>
                          prev ? { ...prev, sharesInput: e.target.value } : null
                        )
                      }
                      className="w-full px-3 py-2 rounded-xl border border-stone-300 font-mono focus:outline-none focus:border-emerald-800"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="edit-inv-cost" className="block text-stone-700 font-semibold mb-1">
                        Total Cost Basis ($)
                      </label>
                      <input
                        id="edit-inv-cost"
                        type="text"
                        required
                        value={editingHolding.costBasisDollars}
                        onChange={(e) =>
                          setEditingHolding((prev) =>
                            prev ? { ...prev, costBasisDollars: e.target.value } : null
                          )
                        }
                        className="w-full px-3 py-2 rounded-xl border border-stone-300 font-mono focus:outline-none focus:border-emerald-800"
                      />
                    </div>
                    <div>
                      <label htmlFor="edit-inv-price" className="block text-stone-700 font-semibold mb-1">
                        Unit Market Price ($)
                      </label>
                      <input
                        id="edit-inv-price"
                        type="text"
                        required
                        value={editingHolding.unitPriceDollars}
                        onChange={(e) =>
                          setEditingHolding((prev) =>
                            prev ? { ...prev, unitPriceDollars: e.target.value } : null
                          )
                        }
                        className="w-full px-3 py-2 rounded-xl border border-stone-300 font-mono focus:outline-none focus:border-emerald-800"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100">
                    <button
                      type="button"
                      disabled={isInvMutating}
                      onClick={() => setEditingHolding(null)}
                      className="px-4 py-2 rounded-xl border border-stone-300 text-stone-700 font-semibold hover:bg-stone-100 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isInvMutating}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-white font-semibold shadow-xs disabled:opacity-50"
                      style={{ backgroundColor: BRAND.primary }}
                    >
                      {isInvMutating && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                      {isInvMutating ? 'Updating...' : 'Save Changes'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          ACCESSIBLE CONFIRMATION MODAL FOR CONSEQUENTIAL ACTIONS
      ===================================================================== */}
      {confirmModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="finance-confirm-title"
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 border border-stone-200 shadow-lg">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <h3 id="finance-confirm-title" className="text-base font-serif font-bold text-stone-900">
                  {confirmModal.kind === 'REVERSE_TX'
                    ? 'Confirm Non-Destructive Audit Reversal'
                    : confirmModal.kind === 'DELETE_ACCOUNT'
                    ? 'Confirm Account Deletion'
                    : confirmModal.kind === 'DELETE_TX'
                    ? 'Confirm Transaction Deletion'
                    : confirmModal.kind === 'DELETE_BUDGET'
                    ? 'Confirm Budget Envelope Deletion'
                    : confirmModal.kind === 'DELETE_GOAL'
                    ? 'Confirm Savings Goal Deletion'
                    : confirmModal.kind === 'DELETE_RULE'
                    ? 'Confirm Recurring Schedule Deletion'
                    : 'Confirm Holding Soft-Deletion'}
                </h3>
                <p className="text-xs text-stone-600 mt-1">
                  {confirmModal.kind === 'REVERSE_TX'
                    ? `This will append a compensating reversal entry for "${confirmModal.targetLabel}" (${confirmModal.amountLabel}) and restore the account balance while preserving the original transaction in the audit log.`
                    : confirmModal.kind === 'DELETE_ACCOUNT'
                    ? `Are you sure you want to delete financial account "${confirmModal.targetLabel}"? This operation will remove the account from your household workspace.`
                    : confirmModal.kind === 'DELETE_TX'
                    ? `Are you sure you want to delete transaction "${confirmModal.targetLabel}" (${confirmModal.amountLabel})? This will automatically reverse its balance impact on the linked account.`
                    : confirmModal.kind === 'DELETE_BUDGET'
                    ? `Are you sure you want to delete the "${confirmModal.targetLabel}" (${confirmModal.amountLabel} limit) budget envelope?`
                    : confirmModal.kind === 'DELETE_GOAL'
                    ? `Are you sure you want to delete savings goal "${confirmModal.targetLabel}" (${confirmModal.amountLabel})?`
                    : confirmModal.kind === 'DELETE_RULE'
                    ? `Are you sure you want to delete recurring schedule "${confirmModal.targetLabel}" (${confirmModal.amountLabel})?`
                    : `This will mark "${confirmModal.targetLabel}" (${confirmModal.amountLabel}) as soft-deleted in the portfolio.`}
                </p>
              </div>
            </div>

            {confirmModal.kind === 'REVERSE_TX' && (
              <div className="text-xs">
                <label htmlFor="confirm-rev-reason" className="block text-stone-600 font-medium mb-1">
                  Audit Reversal Reason
                </label>
                <input
                  id="confirm-rev-reason"
                  type="text"
                  value={confirmModal.reason}
                  onChange={(e) =>
                    setConfirmModal((prev) => (prev ? { ...prev, reason: e.target.value } : null))
                  }
                  className="w-full px-3 py-2 rounded-lg border border-stone-300"
                />
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 text-xs">
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                className="px-4 py-2 rounded-lg border border-stone-300 font-semibold text-stone-700 hover:bg-stone-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeConfirmedAction}
                className="px-4 py-2 rounded-lg bg-rose-700 text-white font-semibold hover:bg-rose-800"
              >
                {confirmModal.kind === 'REVERSE_TX'
                  ? 'Confirm Audit Reversal'
                  : confirmModal.kind === 'DELETE_ACCOUNT'
                  ? 'Delete Account'
                  : confirmModal.kind === 'DELETE_TX'
                  ? 'Delete Transaction'
                  : confirmModal.kind === 'DELETE_BUDGET'
                  ? 'Delete Envelope'
                  : confirmModal.kind === 'DELETE_GOAL'
                  ? 'Delete Goal'
                  : confirmModal.kind === 'DELETE_RULE'
                  ? 'Delete Schedule'
                  : 'Confirm Archive'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Savings Installment Transfer Confirmation Modal */}
      {installmentModalGoal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="installment-modal-title"
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
        >
          <form
            onSubmit={handleCheckOffInstallment}
            className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 border border-stone-200 shadow-lg text-xs"
          >
            <div className="flex items-start gap-3">
              <PiggyBank className="w-6 h-6 text-emerald-800 shrink-0 mt-0.5" />
              <div>
                <h3 id="installment-modal-title" className="text-base font-serif font-bold text-stone-900">
                  Record Deposit / Monthly Installment
                </h3>
                <p className="text-stone-600 mt-0.5">
                  Goal: <strong className="text-stone-900">{installmentModalGoal.title}</strong>. Record a verified transfer from your funding account into this savings goal.
                </p>
              </div>
            </div>

            <div>
              <label htmlFor="inst-src-acc" className="block text-stone-600 font-medium mb-1">
                Source Funding Account (Debit)
              </label>
              <select
                id="inst-src-acc"
                value={installmentFundingAccId}
                onChange={(e) => setInstallmentFundingAccId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-stone-300 bg-white"
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({formatCents(a.currentBalanceCentsDecimal ?? a.currentBalanceCents)})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="inst-amt" className="block text-stone-600 font-medium mb-1">
                Transfer Amount ($)
              </label>
              <input
                id="inst-amt"
                type="text"
                required
                value={installmentAmtDollars}
                onChange={(e) => setInstallmentAmtDollars(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-stone-300 font-mono"
              />
            </div>

            <div>
              <label htmlFor="inst-notes" className="block text-stone-600 font-medium mb-1">
                Transfer Notes
              </label>
              <input
                id="inst-notes"
                type="text"
                value={installmentNotesVal}
                onChange={(e) => setInstallmentNotesVal(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-stone-300"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={isSavingsMutating}
                onClick={() => setInstallmentModalGoal(null)}
                className="px-4 py-2 rounded-lg border border-stone-300 font-semibold text-stone-700 hover:bg-stone-100 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSavingsMutating}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-800 hover:bg-emerald-900 text-white font-semibold disabled:opacity-50"
              >
                {isSavingsMutating && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                {isSavingsMutating ? 'Recording...' : 'Confirm & Record Transfer'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Print Finance Database Master Report Modal */}
      {isPrintModalOpen && (
        <div className="fixed inset-0 z-50 bg-stone-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div id="household-print-area" className="bg-white rounded-3xl max-w-4xl w-full p-6 sm:p-8 border border-stone-200 shadow-2xl space-y-6 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-stone-200 pb-4">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg">
                  FamilyOS Financial Database Export
                </span>
                <h3 className="text-2xl font-serif font-bold text-stone-900 mt-1">
                  Master Financial Stewardship Report & Ledger
                </h3>
                <p className="text-xs text-stone-500">
                  Household: {activeFamilyId} • Generated: {new Date().toLocaleString()} • Active Persona: {selectedPersona}
                </p>
              </div>
              <div className="flex items-center gap-2 no-print">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-2.5 rounded-xl bg-[#173D35] hover:bg-emerald-950 text-white text-xs font-bold flex items-center gap-2 cursor-pointer shadow-sm"
                >
                  <span>🖨️ Print Now</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsPrintModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-bold cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>

            {/* Printable Report Content */}
            <div className="space-y-6 text-xs text-stone-800">
              {/* Summary Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-2xl bg-stone-50 border border-stone-200">
                <div>
                  <span className="text-stone-500 block">Net Worth</span>
                  <span className="text-base font-mono font-bold text-emerald-900">
                    {formatCents(combinedHouseholdNetWorthDecimal)}
                  </span>
                </div>
                <div>
                  <span className="text-stone-500 block">Total Liquid Assets</span>
                  <span className="text-base font-mono font-bold text-stone-900">
                    {formatCents(summary.totalAssetsCents)}
                  </span>
                </div>
                <div>
                  <span className="text-stone-500 block">Total Liabilities</span>
                  <span className="text-base font-mono font-bold text-rose-800">
                    {formatCents(summary.totalLiabilitiesCents)}
                  </span>
                </div>
                <div>
                  <span className="text-stone-500 block">Actual Net Cash Flow</span>
                  <span className="text-base font-mono font-bold text-emerald-800">
                    {formatCents(summary.actualNetCashFlowCents)}
                  </span>
                </div>
              </div>

              {/* Accounts Table */}
              <div className="space-y-2">
                <h4 className="font-serif font-bold text-sm text-stone-900">1. Financial Accounts Ledger ({accounts.length})</h4>
                <div className="border border-stone-200 rounded-2xl overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-stone-100 border-b border-stone-200 text-[11px] font-bold text-stone-700">
                      <tr>
                        <th className="p-3">Account Name</th>
                        <th className="p-3">Type</th>
                        <th className="p-3">Institution</th>
                        <th className="p-3 text-right">Current Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-200">
                      {accounts.map((acc: any) => (
                        <tr key={acc.id} className="hover:bg-stone-50">
                          <td className="p-3 font-semibold text-stone-900">{acc.name}</td>
                          <td className="p-3 uppercase text-[11px]">{acc.accountType}</td>
                          <td className="p-3 text-stone-600">{acc.institution || 'Standard'}</td>
                          <td className="p-3 text-right font-mono font-bold text-emerald-900">
                            {formatCents(acc.currentBalanceCentsDecimal ?? acc.currentBalanceCents)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Transactions Table */}
              <div className="space-y-2">
                <h4 className="font-serif font-bold text-sm text-stone-900">2. Transaction Ledger ({transactions.length})</h4>
                <div className="border border-stone-200 rounded-2xl overflow-hidden max-h-60 overflow-y-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-stone-100 border-b border-stone-200 text-[11px] font-bold text-stone-700 sticky top-0">
                      <tr>
                        <th className="p-3">Date</th>
                        <th className="p-3">Title</th>
                        <th className="p-3">Category</th>
                        <th className="p-3">Type</th>
                        <th className="p-3 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-200">
                      {transactions.map((tx: any) => (
                        <tr key={tx.id} className="hover:bg-stone-50">
                          <td className="p-3 text-stone-500 whitespace-nowrap">
                            {new Date(tx.createdAt || Date.now()).toLocaleDateString()}
                          </td>
                          <td className="p-3 font-medium text-stone-900">{tx.title}</td>
                          <td className="p-3 uppercase text-[11px]">{tx.category}</td>
                          <td className="p-3 uppercase text-[11px] font-bold text-stone-600">{tx.transactionType}</td>
                          <td className={`p-3 text-right font-mono font-bold ${tx.transactionType === 'INCOME' ? 'text-emerald-800' : 'text-stone-900'}`}>
                            {tx.transactionType === 'INCOME' ? '+' : '-'}{formatCents(tx.amountCentsDecimal ?? tx.amountCents)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Envelope Budgets Table */}
              <div className="space-y-2">
                <h4 className="font-serif font-bold text-sm text-stone-900">3. Envelope Budgets ({budgets.length})</h4>
                <div className="border border-stone-200 rounded-2xl overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-stone-100 border-b border-stone-200 text-[11px] font-bold text-stone-700">
                      <tr>
                        <th className="p-3">Category</th>
                        <th className="p-3 text-right">Allocated</th>
                        <th className="p-3 text-right">Spent</th>
                        <th className="p-3 text-right">Remaining</th>
                        <th className="p-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-200">
                      {budgets.map((b: any) => {
                        const alloc = toBigIntOrZero(b.allocatedCentsDecimal, b.allocatedCents);
                        const spent = toBigIntOrZero(b.spentCentsDecimal, b.spentCents);
                        const rem = alloc - spent;
                        return (
                          <tr key={b.id} className="hover:bg-stone-50">
                            <td className="p-3 font-bold uppercase">{b.category}</td>
                            <td className="p-3 text-right font-mono">{formatCents(alloc)}</td>
                            <td className="p-3 text-right font-mono text-rose-800">{formatCents(spent)}</td>
                            <td className="p-3 text-right font-mono font-bold text-emerald-900">{formatCents(rem)}</td>
                            <td className="p-3 text-center">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${b.isOverBudget ? 'bg-rose-100 text-rose-900' : 'bg-emerald-100 text-emerald-900'}`}>
                                {b.status || (b.isOverBudget ? 'Over Budget' : 'On Track')}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Savings Goals */}
              <div className="space-y-2">
                <h4 className="font-serif font-bold text-sm text-stone-900">4. Savings Reserve Goals ({savingsGoals.length})</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {savingsGoals.map((g: any) => (
                    <div key={g.id} className="p-3.5 rounded-2xl bg-stone-50 border border-stone-200 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-stone-900">{g.title}</span>
                        <span className="font-mono font-bold text-emerald-900 text-xs">
                          {formatCents(g.currentCentsDecimal ?? g.currentCents)} / {formatCents(g.targetCentsDecimal ?? g.targetCents)}
                        </span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-stone-200 overflow-hidden">
                        <div className="h-full bg-emerald-700" style={{ width: `${g.progressPercentage || 0}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Print Savings Goals Report Modal */}
      {isSavingsPrintModalOpen && (
        <div className="fixed inset-0 z-50 bg-stone-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div id="household-print-area" className="bg-white rounded-3xl max-w-3xl w-full p-6 sm:p-8 border border-stone-200 shadow-2xl space-y-6 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-stone-200 pb-4">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg">
                  FamilyOS Savings Goals Export
                </span>
                <h3 className="text-2xl font-serif font-bold text-stone-900 mt-1">
                  Savings Reserve Goals & Contribution History Report
                </h3>
                <p className="text-xs text-stone-500">
                  Household: {activeFamilyId} • Generated: {new Date().toLocaleString()}
                </p>
              </div>
              <div className="flex items-center gap-2 no-print">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-2.5 rounded-xl bg-[#173D35] hover:bg-emerald-950 text-white text-xs font-bold flex items-center gap-2 cursor-pointer shadow-sm"
                >
                  <span>🖨️ Print Now</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsSavingsPrintModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-bold cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="space-y-4 text-xs text-stone-800">
              {savingsGoals.map((g: any) => {
                const targetBig = toBigIntOrZero(g.targetCentsDecimal, g.targetCents);
                const currentBig = toBigIntOrZero(g.currentCentsDecimal, g.currentCents);
                const pct = g.progressPercentage ?? (targetBig > 0n ? Math.min(100, Number((currentBig * 100n) / targetBig)) : 0);
                const contribs = g.contributions || [];

                return (
                  <div key={g.id} className="p-4 rounded-2xl bg-stone-50 border border-stone-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-serif font-bold text-base text-stone-900">{g.title}</h4>
                        {g.targetDate && <p className="text-stone-500 text-[11px]">Target Date: {new Date(g.targetDate).toLocaleDateString()}</p>}
                      </div>
                      <div className="text-right font-mono">
                        <span className="font-bold text-emerald-900 text-sm">
                          {formatCents(g.currentCentsDecimal ?? g.currentCents)}
                        </span>
                        <span className="text-stone-500"> / {formatCents(g.targetCentsDecimal ?? g.targetCents)} ({pct}%)</span>
                      </div>
                    </div>
                    <div className="w-full h-2.5 rounded-full bg-stone-200 overflow-hidden">
                      <div className="h-full bg-emerald-700" style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
                    </div>
                    <div className="text-[11px] text-stone-600 grid grid-cols-2 gap-2 pt-1">
                      <div>Suggested Monthly: <strong className="font-mono text-stone-900">{formatCents(g.suggestedMonthlyContributionCentsDecimal ?? g.suggestedMonthlyContributionCents)}</strong></div>
                      <div>Planned Allocation: <strong className="font-mono text-stone-900">{formatCents(g.plannedMonthlyContributionCentsDecimal ?? g.plannedMonthlyContributionCents)}</strong></div>
                    </div>
                    {contribs.length > 0 && (
                      <div className="pt-2 border-t border-stone-200 space-y-1">
                        <span className="font-semibold text-stone-700">Contributions ({contribs.length}):</span>
                        {contribs.map((c: any) => (
                          <div key={c.id} className="flex justify-between py-1 px-2 rounded bg-white border border-stone-200 text-[11px]">
                            <span>{c.notes || 'Deposit'} ({c.contributedBy || 'Member'})</span>
                            <span className="font-mono font-bold text-emerald-800">+{formatCents(c.amountCentsDecimal ?? c.amountCents)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
