import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Landmark,
  CreditCard,
  Briefcase,
  ArrowLeftRight,
  Plus,
  Search,
  RefreshCw,
  Trash2,
  Edit3,
  X,
  Archive,
  ArchiveRestore,
  Eye,
  CheckCircle2,
  AlertTriangle,
  SlidersHorizontal,
} from 'lucide-react';
import {
  formatCents,
  parseDollarsToCentsBigInt,
  toBigIntOrZero,
  serializeBigIntToDecimalString,
  toSafeNumberOrNull,
} from '../../utils/financeFormatting';

export type AccountTypeCode =
  | 'CHECKING'
  | 'SAVINGS'
  | 'CASH'
  | 'CREDIT_CARD'
  | 'LOAN'
  | 'ASSET_TRACKER'
  | 'INVESTMENT';

export interface ManagedFinancialAccount {
  id: string;
  familyId: string;
  name: string;
  accountType: AccountTypeCode;
  institution: string;
  currentBalanceCents?: number | null;
  currentBalanceCentsDecimal?: string;
  isLiability?: boolean;
  isArchived?: boolean;
  creditLimitCents?: number;
  aprPercentage?: number;
  dueDayOfMonth?: number;
  assetCategory?: string;
  accountNumberLast4?: string;
  notes?: string;
  updatedAt?: number;
}

export interface AccountManagementViewProps {
  familyId: string;
  sessionToken: string | null;
  selectedPersona?: string;
  accounts?: ManagedFinancialAccount[];
  transactions?: any[];
  reconciliations?: any[];
  onRefreshFinanceData?: () => Promise<void> | void;
  onFeedback?: (banner: { tone: 'success' | 'warning' | 'error'; message: string }) => void;
}

type AccountFilterTab = 'ALL' | 'BANK' | 'CREDIT_CARDS' | 'ASSET_TRACKERS' | 'ARCHIVED';

export const AccountManagementView: React.FC<AccountManagementViewProps> = ({
  familyId,
  sessionToken,
  selectedPersona = 'OWNER',
  accounts: externalAccounts,
  transactions: externalTransactions,
  onRefreshFinanceData,
  onFeedback,
}) => {
  const canMutate = selectedPersona === 'OWNER' || selectedPersona === 'ADMIN';

  const [localAccounts, setLocalAccounts] = useState<ManagedFinancialAccount[]>(
    externalAccounts || []
  );
  const [localTransactions, setLocalTransactions] = useState<any[]>(externalTransactions || []);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isMutating, setIsMutating] = useState<boolean>(false);
  const [localBanner, setLocalBanner] = useState<{
    tone: 'success' | 'warning' | 'error';
    message: string;
  } | null>(null);

  useEffect(() => {
    if (externalAccounts) {
      setLocalAccounts(externalAccounts);
    }
  }, [externalAccounts]);

  useEffect(() => {
    if (externalTransactions) {
      setLocalTransactions(externalTransactions);
    }
  }, [externalTransactions]);

  const showNotice = useCallback(
    (tone: 'success' | 'warning' | 'error', message: string) => {
      setLocalBanner({ tone, message });
      if (onFeedback) {
        onFeedback({ tone, message });
      }
      setTimeout(() => {
        setLocalBanner((prev) => (prev?.message === message ? null : prev));
      }, 4000);
    },
    [onFeedback]
  );

  const fetchAccountsFromApi = useCallback(async () => {
    if (!sessionToken || !familyId) return;
    setIsLoading(true);
    try {
      const [accRes, txRes] = await Promise.all([
        fetch(`/api/v1/finance/${encodeURIComponent(familyId)}/accounts`, {
          headers: { Authorization: `Bearer ${sessionToken}` },
        }),
        fetch(`/api/v1/finance/${encodeURIComponent(familyId)}/transactions`, {
          headers: { Authorization: `Bearer ${sessionToken}` },
        }),
      ]);
      if (accRes.ok) {
        const accData = await accRes.json();
        if (Array.isArray(accData.accounts)) {
          setLocalAccounts(accData.accounts);
        }
      }
      if (txRes.ok) {
        const txData = await txRes.json();
        if (Array.isArray(txData.transactions)) {
          setLocalTransactions(txData.transactions);
        }
      }
    } catch {
      // Handled by parent or offline state
    } finally {
      setIsLoading(false);
    }
  }, [familyId, sessionToken]);

  useEffect(() => {
    if (!externalAccounts && sessionToken && familyId) {
      void fetchAccountsFromApi();
    }
  }, [externalAccounts, sessionToken, familyId, fetchAccountsFromApi]);

  const triggerSync = async () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('familyos-finance-updated'));
    }
    if (onRefreshFinanceData) {
      await onRefreshFinanceData();
    } else {
      await fetchAccountsFromApi();
    }
  };

  // Filter & Search State
  const [filterTab, setFilterTab] = useState<AccountFilterTab>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<'NAME' | 'BALANCE_DESC' | 'TYPE'>('BALANCE_DESC');

  // Modal States (Create/Edit, Reconcile, Transfer, Ledger, Delete)
  const [isAccountModalOpen, setIsAccountModalOpen] = useState<boolean>(false);
  const [editingAccount, setEditingAccount] = useState<ManagedFinancialAccount | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);

  // Form fields inside Create/Edit Account Modal
  const [formCategoryGroup, setFormCategoryGroup] = useState<'BANK' | 'CREDIT_CARD' | 'ASSET_TRACKER'>('BANK');
  const [formName, setFormName] = useState<string>('');
  const [formAccountType, setFormAccountType] = useState<AccountTypeCode>('CHECKING');
  const [formInstitution, setFormInstitution] = useState<string>('');
  const [formBalanceDollars, setFormBalanceDollars] = useState<string>('0.00');
  const [formIsLiability, setFormIsLiability] = useState<boolean>(false);
  const [formCreditLimitDollars, setFormCreditLimitDollars] = useState<string>('');
  const [formAprPct, setFormAprPct] = useState<string>('');
  const [formDueDay, setFormDueDay] = useState<string>('15');
  const [formAssetCategory, setFormAssetCategory] = useState<string>('Real Estate & Property');
  const [formLast4, setFormLast4] = useState<string>('');
  const [formNotes, setFormNotes] = useState<string>('');

  // Reconcile Modal State
  const [reconcileAccount, setReconcileAccount] = useState<ManagedFinancialAccount | null>(null);
  const [reconcileStatementDollars, setReconcileStatementDollars] = useState<string>('0.00');
  const [reconcileDateIso, setReconcileDateIso] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );

  // Transfer Modal State
  const [isTransferModalOpen, setIsTransferModalOpen] = useState<boolean>(false);
  const [transferSourceId, setTransferSourceId] = useState<string>('');
  const [transferDestId, setTransferDestId] = useState<string>('');
  const [transferAmountDollars, setTransferAmountDollars] = useState<string>('');
  const [transferMemo, setTransferMemo] = useState<string>('');

  // Ledger Inspection Modal State
  const [ledgerAccount, setLedgerAccount] = useState<ManagedFinancialAccount | null>(null);
  const [ledgerSearch, setLedgerSearch] = useState<string>('');

  // Delete Confirmation Modal State
  const [deleteTarget, setDeleteTarget] = useState<ManagedFinancialAccount | null>(null);

  // ============================================================================
  // COMPUTED METRICS & FILTERING
  // ============================================================================
  const metrics = useMemo(() => {
    const active = localAccounts.filter((a) => !a.isArchived);
    const archived = localAccounts.filter((a) => Boolean(a.isArchived));

    let bankCashBig = 0n;
    let creditDebtBig = 0n;
    let trackedAssetsBig = 0n;

    for (const acc of active) {
      const bal = toBigIntOrZero(acc.currentBalanceCentsDecimal, acc.currentBalanceCents);
      const absBal = bal < 0n ? -bal : bal;

      if (acc.isLiability || acc.accountType === 'CREDIT_CARD' || acc.accountType === 'LOAN') {
        creditDebtBig += absBal;
      } else if (acc.accountType === 'ASSET_TRACKER' || acc.accountType === 'INVESTMENT') {
        trackedAssetsBig += bal;
      } else {
        bankCashBig += bal;
      }
    }

    const totalAssetsBig = bankCashBig + trackedAssetsBig;
    const netEquityBig = totalAssetsBig - creditDebtBig;

    return {
      activeCount: active.length,
      archivedCount: archived.length,
      bankCount: active.filter((a) =>
        ['CHECKING', 'SAVINGS', 'CASH'].includes(a.accountType) && !a.isLiability
      ).length,
      creditCount: active.filter(
        (a) => a.isLiability || a.accountType === 'CREDIT_CARD' || a.accountType === 'LOAN'
      ).length,
      trackerCount: active.filter(
        (a) =>
          (a.accountType === 'ASSET_TRACKER' || a.accountType === 'INVESTMENT') && !a.isLiability
      ).length,
      bankCashBig,
      creditDebtBig,
      trackedAssetsBig,
      totalAssetsBig,
      netEquityBig,
    };
  }, [localAccounts]);

  const filteredAccounts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = localAccounts.filter((acc) => {
      if (filterTab === 'ARCHIVED') {
        if (!acc.isArchived) return false;
      } else {
        if (acc.isArchived) return false;
        const isCreditOrLoan =
          acc.isLiability || acc.accountType === 'CREDIT_CARD' || acc.accountType === 'LOAN';
        const isTracker =
          !isCreditOrLoan &&
          (acc.accountType === 'ASSET_TRACKER' || acc.accountType === 'INVESTMENT');
        const isBank = !isCreditOrLoan && !isTracker;

        if (filterTab === 'BANK' && !isBank) return false;
        if (filterTab === 'CREDIT_CARDS' && !isCreditOrLoan) return false;
        if (filterTab === 'ASSET_TRACKERS' && !isTracker) return false;
      }

      if (!q) return true;
      return (
        (acc.name || '').toLowerCase().includes(q) ||
        (acc.institution || '').toLowerCase().includes(q) ||
        (acc.accountType || '').toLowerCase().includes(q) ||
        (acc.assetCategory || '').toLowerCase().includes(q) ||
        (acc.notes || '').toLowerCase().includes(q)
      );
    });

    return [...list].sort((a, b) => {
      if (sortBy === 'NAME') {
        return a.name.localeCompare(b.name);
      }
      if (sortBy === 'TYPE') {
        return a.accountType.localeCompare(b.accountType);
      }
      const balA = toBigIntOrZero(a.currentBalanceCentsDecimal, a.currentBalanceCents);
      const balB = toBigIntOrZero(b.currentBalanceCentsDecimal, b.currentBalanceCents);
      if (balB > balA) return 1;
      if (balB < balA) return -1;
      return 0;
    });
  }, [localAccounts, filterTab, searchQuery, sortBy]);

  // ============================================================================
  // MODAL OPENERS
  // ============================================================================
  const openCreateModal = (presetGroup?: 'BANK' | 'CREDIT_CARD' | 'ASSET_TRACKER') => {
    const group =
      presetGroup ||
      (filterTab === 'CREDIT_CARDS'
        ? 'CREDIT_CARD'
        : filterTab === 'ASSET_TRACKERS'
        ? 'ASSET_TRACKER'
        : 'BANK');
    setEditingAccount(null);
    setModalError(null);
    setFormCategoryGroup(group);
    setFormName('');
    setFormInstitution('');
    setFormBalanceDollars('0.00');
    setFormCreditLimitDollars('');
    setFormAprPct('');
    setFormDueDay('15');
    setFormAssetCategory('Real Estate & Property');
    setFormLast4('');
    setFormNotes('');

    if (group === 'CREDIT_CARD') {
      setFormAccountType('CREDIT_CARD');
      setFormIsLiability(true);
    } else if (group === 'ASSET_TRACKER') {
      setFormAccountType('ASSET_TRACKER');
      setFormIsLiability(false);
    } else {
      setFormAccountType('CHECKING');
      setFormIsLiability(false);
    }
    setIsAccountModalOpen(true);
  };

  const openEditModal = (acc: ManagedFinancialAccount) => {
    setEditingAccount(acc);
    setModalError(null);
    const isCredit =
      acc.isLiability || acc.accountType === 'CREDIT_CARD' || acc.accountType === 'LOAN';
    const isTracker =
      !isCredit && (acc.accountType === 'ASSET_TRACKER' || acc.accountType === 'INVESTMENT');

    setFormCategoryGroup(isCredit ? 'CREDIT_CARD' : isTracker ? 'ASSET_TRACKER' : 'BANK');
    setFormName(acc.name || '');
    setFormAccountType(acc.accountType || 'CHECKING');
    setFormInstitution(acc.institution || '');

    const balBig = toBigIntOrZero(acc.currentBalanceCentsDecimal, acc.currentBalanceCents);
    const absBalBig = balBig < 0n ? -balBig : balBig;
    setFormBalanceDollars((Number(absBalBig) / 100).toFixed(2));
    setFormIsLiability(Boolean(acc.isLiability));
    setFormCreditLimitDollars(
      acc.creditLimitCents ? (acc.creditLimitCents / 100).toFixed(2) : ''
    );
    setFormAprPct(acc.aprPercentage !== undefined ? String(acc.aprPercentage) : '');
    setFormDueDay(acc.dueDayOfMonth !== undefined ? String(acc.dueDayOfMonth) : '15');
    setFormAssetCategory(acc.assetCategory || 'Real Estate & Property');
    setFormLast4(acc.accountNumberLast4 || '');
    setFormNotes(acc.notes || '');
    setIsAccountModalOpen(true);
  };

  // ============================================================================
  // CRUD HANDLERS (POST, PUT, DELETE, RECONCILE, TRANSFER)
  // ============================================================================
  const handleSaveAccountForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionToken || !familyId) return;

    const trimmedName = formName.trim();
    if (!trimmedName) {
      setModalError('Please enter an account, card, or asset name.');
      return;
    }

    const parsedBalBig = parseDollarsToCentsBigInt(formBalanceDollars || '0');
    if (parsedBalBig === null) {
      setModalError('Please enter a valid numeric dollar amount for the balance/valuation.');
      return;
    }

    const parsedCreditLimitBig = formCreditLimitDollars.trim()
      ? parseDollarsToCentsBigInt(formCreditLimitDollars)
      : 0n;

    const payload: Record<string, any> = {
      name: trimmedName,
      accountType: formAccountType,
      institution: formInstitution.trim() || 'Household Treasury',
      currentBalanceCents: toSafeNumberOrNull(parsedBalBig),
      currentBalanceCentsDecimal: serializeBigIntToDecimalString(parsedBalBig),
      isLiability:
        Boolean(formIsLiability) ||
        formAccountType === 'CREDIT_CARD' ||
        formAccountType === 'LOAN',
      creditLimitCents: parsedCreditLimitBig ? Number(parsedCreditLimitBig) : undefined,
      aprPercentage: formAprPct.trim() ? Number(formAprPct) : undefined,
      dueDayOfMonth: formDueDay.trim() ? Number(formDueDay) : undefined,
      assetCategory:
        formAccountType === 'ASSET_TRACKER' || formAccountType === 'INVESTMENT'
          ? formAssetCategory.trim()
          : undefined,
      accountNumberLast4: formLast4.trim() ? formLast4.trim().slice(-4) : undefined,
      notes: formNotes.trim() || undefined,
    };

    setIsMutating(true);
    setModalError(null);
    try {
      const url = editingAccount
        ? `/api/v1/finance/${encodeURIComponent(familyId)}/accounts/${encodeURIComponent(editingAccount.id)}`
        : `/api/v1/finance/${encodeURIComponent(familyId)}/accounts`;
      const method = editingAccount ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setModalError(data.message || data.error || 'Could not save account.');
        return;
      }

      if (data.account) {
        if (editingAccount) {
          setLocalAccounts((prev) =>
            prev.map((a) => (a.id === editingAccount.id ? data.account : a))
          );
        } else {
          setLocalAccounts((prev) => [...prev, data.account]);
        }
      }

      setIsAccountModalOpen(false);
      setEditingAccount(null);
      showNotice(
        'success',
        editingAccount
          ? `Updated “${trimmedName}”.`
          : `Created ${formAccountType.replace('_', ' ')} “${trimmedName}”.`
      );
      await triggerSync();
    } catch {
      setModalError('Network error while saving account.');
    } finally {
      setIsMutating(false);
    }
  };

  const handleToggleArchive = async (acc: ManagedFinancialAccount) => {
    if (!sessionToken || !familyId || !canMutate) return;
    setIsMutating(true);
    try {
      const nextArchived = !acc.isArchived;
      const res = await fetch(
        `/api/v1/finance/${encodeURIComponent(familyId)}/accounts/${encodeURIComponent(acc.id)}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${sessionToken}`,
          },
          body: JSON.stringify({ isArchived: nextArchived }),
        }
      );
      if (res.ok) {
        const data = await res.json();
        if (data.account) {
          setLocalAccounts((prev) => prev.map((a) => (a.id === acc.id ? data.account : a)));
        }
        showNotice(
          'success',
          nextArchived ? `Archived “${acc.name}”.` : `Restored “${acc.name}” to active accounts.`
        );
        await triggerSync();
      }
    } finally {
      setIsMutating(false);
    }
  };

  const handleConfirmDeleteAccount = async () => {
    if (!deleteTarget || !sessionToken || !familyId) return;
    setIsMutating(true);
    try {
      const res = await fetch(
        `/api/v1/finance/${encodeURIComponent(familyId)}/accounts/${encodeURIComponent(deleteTarget.id)}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${sessionToken}` },
        }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        showNotice('error', err.message || 'Could not delete account.');
        return;
      }
      const deletedName = deleteTarget.name;
      setLocalAccounts((prev) => prev.filter((a) => a.id !== deleteTarget.id));
      setDeleteTarget(null);
      showNotice('success', `Deleted account “${deletedName}”.`);
      await triggerSync();
    } finally {
      setIsMutating(false);
    }
  };

  const handleReconcileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reconcileAccount || !sessionToken || !familyId) return;
    const stmtBig = parseDollarsToCentsBigInt(reconcileStatementDollars || '0');
    if (stmtBig === null) {
      showNotice('error', 'Please enter a valid statement ending balance.');
      return;
    }
    setIsMutating(true);
    try {
      const res = await fetch(
        `/api/v1/finance/${encodeURIComponent(familyId)}/accounts/${encodeURIComponent(reconcileAccount.id)}/reconcile`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${sessionToken}`,
          },
          body: JSON.stringify({
            statementEndingBalanceCents: toSafeNumberOrNull(stmtBig),
            statementEndingBalanceCentsDecimal: serializeBigIntToDecimalString(stmtBig),
            statementDate: reconcileDateIso
              ? new Date(reconcileDateIso).getTime()
              : Date.now(),
          }),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showNotice('error', data.message || 'Could not reconcile account statement.');
        return;
      }
      setReconcileAccount(null);
      showNotice('success', `Statement reconciled for “${reconcileAccount.name}”.`);
      await triggerSync();
    } finally {
      setIsMutating(false);
    }
  };

  const handleTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionToken || !familyId) return;
    if (!transferSourceId || !transferDestId || transferSourceId === transferDestId) {
      showNotice('error', 'Please choose two distinct accounts for the transfer.');
      return;
    }
    const amtBig = parseDollarsToCentsBigInt(transferAmountDollars || '0');
    if (amtBig === null || amtBig <= 0n) {
      showNotice('error', 'Please enter a positive transfer amount.');
      return;
    }
    setIsMutating(true);
    try {
      const res = await fetch(
        `/api/v1/finance/${encodeURIComponent(familyId)}/transactions`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${sessionToken}`,
          },
          body: JSON.stringify({
            accountId: transferSourceId,
            destinationAccountId: transferDestId,
            title: transferMemo.trim() || 'Account-to-Account Transfer',
            amountCents: toSafeNumberOrNull(amtBig),
            amountCentsDecimal: serializeBigIntToDecimalString(amtBig),
            transactionType: 'TRANSFER',
            category: 'TRANSFER',
          }),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showNotice('error', data.message || 'Could not complete transfer.');
        return;
      }
      setIsTransferModalOpen(false);
      setTransferAmountDollars('');
      setTransferMemo('');
      showNotice('success', `Transferred ${formatCents(amtBig)} between accounts.`);
      await triggerSync();
    } finally {
      setIsMutating(false);
    }
  };

  const liveReconcileDiscrepancy = useMemo(() => {
    if (!reconcileAccount) return null;
    const stmtBig = parseDollarsToCentsBigInt(reconcileStatementDollars || '0') ?? 0n;
    const ledgerBig = toBigIntOrZero(
      reconcileAccount.currentBalanceCentsDecimal,
      reconcileAccount.currentBalanceCents
    );
    const discBig = stmtBig - ledgerBig;
    return {
      stmtBig,
      ledgerBig,
      discBig,
      isMatch: discBig === 0n,
    };
  }, [reconcileAccount, reconcileStatementDollars]);

  return (
    <div
      id="finance-panel-accounts"
      role="tabpanel"
      aria-labelledby="finance-tab-accounts"
      className="space-y-6"
    >
      {/* Feedback Banner */}
      {localBanner && (
        <div
          className={`p-3.5 rounded-2xl border text-xs font-medium flex items-center justify-between ${
            localBanner.tone === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-900'
              : localBanner.tone === 'warning'
              ? 'bg-amber-50 border-amber-200 text-amber-900'
              : 'bg-emerald-50 border-emerald-200 text-emerald-950'
          }`}
        >
          <div className="flex items-center gap-2">
            {localBanner.tone === 'error' ? (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
            )}
            <span>{localBanner.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setLocalBanner(null)}
            className="text-xs font-bold underline ml-3 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Top KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-white border border-stone-200 space-y-1">
          <div className="flex items-center justify-between text-xs text-stone-500 font-medium">
            <span>Bank & Liquid Cash</span>
            <Landmark className="w-4 h-4 text-emerald-800" />
          </div>
          <div className="text-2xl font-mono font-bold text-emerald-900">
            {formatCents(metrics.bankCashBig)}
          </div>
          <p className="text-[11px] text-stone-500">
            {metrics.bankCount} Checking, Savings & Cash accounts
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-stone-200 space-y-1">
          <div className="flex items-center justify-between text-xs text-stone-500 font-medium">
            <span>Credit Cards & Debt</span>
            <CreditCard className="w-4 h-4 text-rose-700" />
          </div>
          <div className="text-2xl font-mono font-bold text-rose-700">
            {formatCents(metrics.creditDebtBig)}
          </div>
          <p className="text-[11px] text-stone-500">
            {metrics.creditCount} Credit Cards & Active Loans
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-stone-200 space-y-1">
          <div className="flex items-center justify-between text-xs text-stone-500 font-medium">
            <span>Tracked Assets & Valuations</span>
            <Briefcase className="w-4 h-4 text-indigo-700" />
          </div>
          <div className="text-2xl font-mono font-bold text-stone-900">
            {formatCents(metrics.trackedAssetsBig)}
          </div>
          <p className="text-[11px] text-stone-500">
            {metrics.trackerCount} Asset Trackers & Investments
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-stone-200 space-y-1">
          <div className="flex items-center justify-between text-xs text-stone-500 font-medium">
            <span>Net Account Equity</span>
            <span className="font-mono text-[11px] text-stone-400">
              {metrics.activeCount} Active
            </span>
          </div>
          <div
            className={`text-2xl font-mono font-bold ${
              metrics.netEquityBig < 0n ? 'text-rose-700' : 'text-stone-900'
            }`}
          >
            {formatCents(metrics.netEquityBig)}
          </div>
          <p className="text-[11px] text-stone-500">
            Total bank & tracked assets minus liabilities
          </p>
        </div>
      </div>

      {/* Filter Bar, Search & Primary Actions */}
      <div className="p-4 rounded-2xl bg-white border border-stone-200 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        {/* Category Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {[
            { id: 'ALL', label: `All Active (${metrics.activeCount})` },
            { id: 'BANK', label: `Bank Accounts (${metrics.bankCount})` },
            { id: 'CREDIT_CARDS', label: `Credit Cards & Loans (${metrics.creditCount})` },
            { id: 'ASSET_TRACKERS', label: `Asset Trackers (${metrics.trackerCount})` },
            { id: 'ARCHIVED', label: `Archived (${metrics.archivedCount})` },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterTab(tab.id as AccountFilterTab)}
              className={`px-3 py-1.5 rounded-xl font-semibold transition-colors cursor-pointer ${
                filterTab === tab.id
                  ? 'bg-[#173D35] text-white'
                  : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search, Sort & Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 sm:w-56 min-w-[180px]">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search accounts, cards, assets..."
              className="w-full pl-8 pr-7 py-1.5 rounded-xl border border-stone-200 bg-white text-xs text-stone-900 placeholder:text-stone-400"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1 text-xs">
            <SlidersHorizontal className="w-3.5 h-3.5 text-stone-400 hidden sm:inline" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-2.5 py-1.5 rounded-xl border border-stone-200 bg-stone-50 text-xs text-stone-700 font-medium"
            >
              <option value="BALANCE_DESC">Sort: Highest Balance</option>
              <option value="NAME">Sort: Name (A–Z)</option>
              <option value="TYPE">Sort: Account Type</option>
            </select>
          </div>

          {canMutate && (
            <>
              <button
                type="button"
                onClick={() => {
                  if (localAccounts.length >= 2) {
                    setTransferSourceId(localAccounts[0].id);
                    setTransferDestId(localAccounts[1].id);
                  }
                  setIsTransferModalOpen(true);
                }}
                className="px-3 py-1.5 rounded-xl border border-stone-200 bg-white text-stone-800 font-semibold text-xs hover:bg-stone-50 flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                <ArrowLeftRight className="w-3.5 h-3.5 text-emerald-800" />
                <span>Transfer</span>
              </button>

              <button
                type="button"
                onClick={() => openCreateModal()}
                className="px-3.5 py-1.5 rounded-xl bg-[#173D35] hover:bg-emerald-950 text-white font-semibold text-xs flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Add Account</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="p-6 rounded-2xl bg-white border border-stone-200 text-center text-xs text-stone-500">
          Loading household accounts, credit cards, and asset trackers...
        </div>
      )}

      {/* Accounts, Credit Cards & Asset Trackers Grid */}
      {!isLoading && filteredAccounts.length === 0 ? (
        <div className="p-12 text-center text-xs text-stone-500 border border-dashed border-stone-300 rounded-2xl bg-white space-y-3">
          <p className="font-serif font-bold text-base text-stone-900">
            No accounts match your current view
          </p>
          <p className="max-w-md mx-auto">
            Add a bank checking/savings account, credit card, or physical/financial asset tracker to manage balances and reconciliations in one place.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            {(filterTab !== 'ALL' || searchQuery) && (
              <button
                type="button"
                onClick={() => {
                  setFilterTab('ALL');
                  setSearchQuery('');
                }}
                className="px-3.5 py-2 rounded-xl border border-stone-200 text-stone-700 font-semibold hover:bg-stone-50 cursor-pointer"
              >
                Reset Filters
              </button>
            )}
            {canMutate && (
              <button
                type="button"
                onClick={() => openCreateModal()}
                className="px-4 py-2 rounded-xl bg-[#173D35] text-white font-semibold cursor-pointer"
              >
                + Add First Account
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAccounts.map((acc) => {
            const balBig = toBigIntOrZero(
              acc.currentBalanceCentsDecimal,
              acc.currentBalanceCents
            );
            const isCreditOrLoan =
              acc.isLiability ||
              acc.accountType === 'CREDIT_CARD' ||
              acc.accountType === 'LOAN';
            const isTracker =
              !isCreditOrLoan &&
              (acc.accountType === 'ASSET_TRACKER' || acc.accountType === 'INVESTMENT');

            const badgeColor =
              acc.accountType === 'CHECKING'
                ? 'bg-slate-100 text-slate-800 border-slate-200'
                : acc.accountType === 'SAVINGS'
                ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                : acc.accountType === 'CREDIT_CARD'
                ? 'bg-rose-50 text-rose-900 border-rose-200'
                : acc.accountType === 'LOAN'
                ? 'bg-amber-50 text-amber-900 border-amber-200'
                : acc.accountType === 'ASSET_TRACKER' || acc.accountType === 'INVESTMENT'
                ? 'bg-indigo-50 text-indigo-900 border-indigo-200'
                : 'bg-stone-100 text-stone-800 border-stone-200';

            const creditLimitCents = Number(acc.creditLimitCents || 0);
            const absBalanceCents = Math.abs(Number(balBig));
            const creditUtilizationPct =
              isCreditOrLoan && creditLimitCents > 0
                ? Math.min(100, Math.round((absBalanceCents / creditLimitCents) * 100))
                : null;

            return (
              <div
                key={acc.id}
                className="rounded-2xl border border-stone-200 p-5 bg-white flex flex-col justify-between space-y-4 hover:border-stone-300 transition-colors"
              >
                <div className="space-y-3">
                  {/* Top Badge & Institution */}
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`px-2.5 py-0.5 rounded-md text-[11px] font-mono font-bold border ${badgeColor}`}
                      >
                        {acc.accountType.replace('_', ' ')}
                      </span>
                      {acc.accountNumberLast4 && (
                        <span className="font-mono text-[11px] text-stone-400">
                          •••• {acc.accountNumberLast4}
                        </span>
                      )}
                    </div>
                    <span className="text-stone-500 font-medium truncate">
                      {acc.institution}
                    </span>
                  </div>

                  {/* Account Title & Metadata */}
                  <div>
                    <h4 className="text-base font-serif font-bold text-stone-900 truncate">
                      {acc.name}
                    </h4>
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-stone-500 mt-0.5">
                      <span>
                        ID: <span className="font-mono text-stone-700">{acc.id}</span>
                      </span>
                      <span>·</span>
                      <span>
                        {isCreditOrLoan
                          ? 'Liability'
                          : isTracker
                          ? acc.assetCategory || 'Tracked Asset'
                          : 'Liquid Asset'}
                      </span>
                      {acc.aprPercentage !== undefined && acc.aprPercentage > 0 && (
                        <>
                          <span>·</span>
                          <span className="font-mono">{acc.aprPercentage}% APR</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Authoritative Balance / Valuation */}
                  <div className="pt-2 border-t border-stone-100 flex items-baseline justify-between">
                    <span className="text-[11px] text-stone-500 font-medium">
                      {isCreditOrLoan
                        ? 'Current Balance Owed'
                        : isTracker
                        ? 'Tracked Valuation'
                        : 'Ledger Balance'}
                    </span>
                    <span
                      className={`text-xl font-mono font-bold ${
                        isCreditOrLoan || balBig < 0n
                          ? 'text-rose-700'
                          : 'text-emerald-900'
                      }`}
                    >
                      {formatCents(acc.currentBalanceCentsDecimal ?? acc.currentBalanceCents)}
                    </span>
                  </div>

                  {/* Credit Card Utilization Bar (when creditLimitCents is set) */}
                  {creditUtilizationPct !== null && (
                    <div className="space-y-1 pt-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-stone-500">
                          Credit Limit: <span className="font-mono">{formatCents(creditLimitCents)}</span>
                        </span>
                        <span
                          className={`font-mono font-semibold ${
                            creditUtilizationPct >= 80
                              ? 'text-rose-700'
                              : creditUtilizationPct >= 30
                              ? 'text-amber-700'
                              : 'text-emerald-800'
                          }`}
                        >
                          {creditUtilizationPct}% utilized
                        </span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-stone-100 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            creditUtilizationPct >= 80
                              ? 'bg-rose-600'
                              : creditUtilizationPct >= 30
                              ? 'bg-amber-500'
                              : 'bg-emerald-700'
                          }`}
                          style={{ width: `${creditUtilizationPct}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {acc.notes && (
                    <p className="text-[11px] text-stone-500 bg-stone-50 px-2.5 py-1.5 rounded-xl border border-stone-200/70 line-clamp-2">
                      {acc.notes}
                    </p>
                  )}
                </div>

                {/* Card Footer Actions */}
                <div className="pt-3 border-t border-stone-100 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setLedgerSearch('');
                        setLedgerAccount(acc);
                      }}
                      className="px-2.5 py-1.5 rounded-lg border border-stone-200 text-stone-700 font-semibold hover:bg-stone-50 flex items-center gap-1 cursor-pointer"
                      title="Inspect Account Ledger Activity"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Ledger</span>
                    </button>

                    {canMutate && (
                      <button
                        type="button"
                        onClick={() => {
                          const bal = toBigIntOrZero(
                            acc.currentBalanceCentsDecimal,
                            acc.currentBalanceCents
                          );
                          setReconcileStatementDollars((Number(bal) / 100).toFixed(2));
                          setReconcileDateIso(new Date().toISOString().slice(0, 10));
                          setReconcileAccount(acc);
                        }}
                        className="px-2.5 py-1.5 rounded-lg border border-stone-200 text-stone-700 font-semibold hover:bg-stone-50 cursor-pointer"
                        title="Reconcile Statement Balance"
                      >
                        Reconcile
                      </button>
                    )}
                  </div>

                  {canMutate && (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        aria-label={`Edit ${acc.name}`}
                        onClick={() => openEditModal(acc)}
                        className="p-1.5 rounded-lg border border-stone-200 text-stone-600 hover:bg-stone-100 cursor-pointer"
                        title="Edit Account in Modal"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        aria-label={
                          acc.isArchived ? `Restore ${acc.name}` : `Archive ${acc.name}`
                        }
                        onClick={() => void handleToggleArchive(acc)}
                        className="p-1.5 rounded-lg border border-stone-200 text-stone-600 hover:bg-stone-100 cursor-pointer"
                        title={acc.isArchived ? 'Restore Account' : 'Archive Account'}
                      >
                        {acc.isArchived ? (
                          <ArchiveRestore className="w-3.5 h-3.5 text-emerald-800" />
                        ) : (
                          <Archive className="w-3.5 h-3.5 text-stone-500" />
                        )}
                      </button>

                      <button
                        type="button"
                        aria-label={`Delete ${acc.name}`}
                        onClick={() => setDeleteTarget(acc)}
                        className="p-1.5 rounded-lg border border-stone-200 text-rose-600 hover:bg-rose-50 hover:border-rose-300 cursor-pointer"
                        title={`Delete ${acc.name}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* =====================================================================
          MODAL 1: CREATE / EDIT ACCOUNT, CREDIT CARD, OR ASSET TRACKER
         ===================================================================== */}
      {isAccountModalOpen && (
        <div className="fixed inset-0 bg-stone-950/55 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-lg w-full border border-stone-200 space-y-5 shadow-xl my-8">
            <div className="flex items-start justify-between border-b border-stone-100 pb-4">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                  Household Treasury & Asset Registry
                </span>
                <h3 className="text-xl font-serif font-bold text-stone-900 mt-0.5">
                  {editingAccount ? `Edit ${editingAccount.name}` : 'Add Financial Account'}
                </h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  Configure a bank account, credit card, or asset tracker with persistent ledger storage.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsAccountModalOpen(false);
                  setEditingAccount(null);
                }}
                className="p-1.5 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Category Selector Tabs */}
            <div className="grid grid-cols-3 gap-2 p-1 rounded-2xl bg-stone-100 text-xs font-semibold">
              <button
                type="button"
                onClick={() => {
                  setFormCategoryGroup('BANK');
                  setFormAccountType('CHECKING');
                  setFormIsLiability(false);
                }}
                className={`py-2 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer ${
                  formCategoryGroup === 'BANK'
                    ? 'bg-white text-stone-900 shadow-2xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <Landmark className="w-3.5 h-3.5" />
                <span>Bank Account</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setFormCategoryGroup('CREDIT_CARD');
                  setFormAccountType('CREDIT_CARD');
                  setFormIsLiability(true);
                }}
                className={`py-2 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer ${
                  formCategoryGroup === 'CREDIT_CARD'
                    ? 'bg-white text-stone-900 shadow-2xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>Credit Card</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setFormCategoryGroup('ASSET_TRACKER');
                  setFormAccountType('ASSET_TRACKER');
                  setFormIsLiability(false);
                }}
                className={`py-2 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer ${
                  formCategoryGroup === 'ASSET_TRACKER'
                    ? 'bg-white text-stone-900 shadow-2xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <Briefcase className="w-3.5 h-3.5" />
                <span>Asset Tracker</span>
              </button>
            </div>

            {modalError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs font-medium">
                {modalError}
              </div>
            )}

            <form onSubmit={handleSaveAccountForm} className="space-y-4 text-xs">
              <div>
                <label htmlFor="modal-acc-name" className="block text-stone-700 font-semibold mb-1">
                  Account / Asset Name *
                </label>
                <input
                  id="modal-acc-name"
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder={
                    formCategoryGroup === 'CREDIT_CARD'
                      ? 'e.g. Family Rewards Visa'
                      : formCategoryGroup === 'ASSET_TRACKER'
                      ? 'e.g. Primary Residence Equity or Treasury I-Bonds'
                      : 'e.g. Household Operating Checking'
                  }
                  className="w-full px-3 py-2 rounded-xl border border-stone-200"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="modal-acc-type" className="block text-stone-700 font-semibold mb-1">
                    Account Classification
                  </label>
                  <select
                    id="modal-acc-type"
                    value={formAccountType}
                    onChange={(e) => {
                      const val = e.target.value as AccountTypeCode;
                      setFormAccountType(val);
                      if (val === 'CREDIT_CARD' || val === 'LOAN') {
                        setFormIsLiability(true);
                        setFormCategoryGroup('CREDIT_CARD');
                      } else if (val === 'ASSET_TRACKER' || val === 'INVESTMENT') {
                        setFormIsLiability(false);
                        setFormCategoryGroup('ASSET_TRACKER');
                      } else {
                        setFormIsLiability(false);
                        setFormCategoryGroup('BANK');
                      }
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-stone-200 bg-white"
                  >
                    <option value="CHECKING">CHECKING (Bank)</option>
                    <option value="SAVINGS">SAVINGS (High-Yield / Reserve)</option>
                    <option value="CASH">CASH (Physical / Petty Cash)</option>
                    <option value="CREDIT_CARD">CREDIT_CARD (Liability)</option>
                    <option value="LOAN">LOAN / MORTGAGE (Liability)</option>
                    <option value="ASSET_TRACKER">ASSET_TRACKER (Tracked Asset)</option>
                    <option value="INVESTMENT">INVESTMENT (Brokerage / Retirement)</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="modal-acc-inst" className="block text-stone-700 font-semibold mb-1">
                    Institution or Custodian
                  </label>
                  <input
                    id="modal-acc-inst"
                    type="text"
                    value={formInstitution}
                    onChange={(e) => setFormInstitution(e.target.value)}
                    placeholder="e.g. Chase, Vanguard, County Assessor"
                    className="w-full px-3 py-2 rounded-xl border border-stone-200"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="modal-acc-bal" className="block text-stone-700 font-semibold mb-1">
                    {editingAccount ? 'Current Balance / Valuation ($)' : 'Opening Balance ($)'}
                  </label>
                  <input
                    id="modal-acc-bal"
                    type="text"
                    value={formBalanceDollars}
                    onChange={(e) => setFormBalanceDollars(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-3 py-2 rounded-xl border border-stone-200 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-stone-700 font-semibold mb-1">
                    Last 4 Digits (Optional)
                  </label>
                  <input
                    type="text"
                    maxLength={4}
                    value={formLast4}
                    onChange={(e) => setFormLast4(e.target.value.replace(/\D/g, ''))}
                    placeholder="e.g. 4821"
                    className="w-full px-3 py-2 rounded-xl border border-stone-200 font-mono"
                  />
                </div>
              </div>

              {/* Conditional Credit Card / Loan Fields */}
              {(formCategoryGroup === 'CREDIT_CARD' ||
                formAccountType === 'CREDIT_CARD' ||
                formAccountType === 'LOAN') && (
                <div className="p-3.5 rounded-2xl bg-rose-50/50 border border-rose-200/70 grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-stone-700 font-semibold mb-1">
                      Credit Limit ($)
                    </label>
                    <input
                      type="text"
                      value={formCreditLimitDollars}
                      onChange={(e) => setFormCreditLimitDollars(e.target.value)}
                      placeholder="15000.00"
                      className="w-full px-2.5 py-1.5 rounded-xl border border-stone-200 bg-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-stone-700 font-semibold mb-1">
                      Interest APR (%)
                    </label>
                    <input
                      type="text"
                      value={formAprPct}
                      onChange={(e) => setFormAprPct(e.target.value)}
                      placeholder="19.99"
                      className="w-full px-2.5 py-1.5 rounded-xl border border-stone-200 bg-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-stone-700 font-semibold mb-1">
                      Statement Due Day
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={31}
                      value={formDueDay}
                      onChange={(e) => setFormDueDay(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-xl border border-stone-200 bg-white font-mono"
                    />
                  </div>
                </div>
              )}

              {/* Conditional Asset Tracker Fields */}
              {(formCategoryGroup === 'ASSET_TRACKER' ||
                formAccountType === 'ASSET_TRACKER' ||
                formAccountType === 'INVESTMENT') && (
                <div className="p-3.5 rounded-2xl bg-indigo-50/50 border border-indigo-200/70 space-y-2">
                  <label className="block text-stone-700 font-semibold">
                    Tracked Asset Class
                  </label>
                  <select
                    value={formAssetCategory}
                    onChange={(e) => setFormAssetCategory(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-stone-200 bg-white"
                  >
                    <option value="Real Estate & Property">Real Estate & Property</option>
                    <option value="Vehicles & Mobility">Vehicles & Mobility</option>
                    <option value="Treasury Bonds & CDs">Treasury Bonds & CDs</option>
                    <option value="Brokerage & Index Funds">Brokerage & Index Funds</option>
                    <option value="Valuables & Collectibles">Valuables & Collectibles</option>
                    <option value="Private Equity & Business">Private Equity & Business</option>
                  </select>
                </div>
              )}

              <div>
                <label className="block text-stone-700 font-semibold mb-1">
                  Account / Valuation Notes (Optional)
                </label>
                <input
                  type="text"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="e.g. Joint household operating account or annual appraisal note..."
                  className="w-full px-3 py-2 rounded-xl border border-stone-200"
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer text-stone-700 pt-1">
                <input
                  type="checkbox"
                  checked={formIsLiability}
                  onChange={(e) => setFormIsLiability(e.target.checked)}
                  className="rounded border-stone-300 text-emerald-800"
                />
                <span className="text-xs font-medium">
                  Treat balance as a household liability (subtracted from net worth)
                </span>
              </label>

              <div className="pt-3 border-t border-stone-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsAccountModalOpen(false);
                    setEditingAccount(null);
                  }}
                  className="px-4 py-2 rounded-xl border border-stone-200 text-stone-700 font-semibold hover:bg-stone-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isMutating}
                  className="px-5 py-2 rounded-xl bg-[#173D35] hover:bg-emerald-950 text-white font-semibold flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  {isMutating && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>
                    {isMutating
                      ? 'Saving...'
                      : editingAccount
                      ? 'Save Account Changes'
                      : 'Create Account'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 2: STATEMENT RECONCILIATION MODAL
         ===================================================================== */}
      {reconcileAccount && (
        <div className="fixed inset-0 bg-stone-950/55 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full border border-stone-200 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div>
                <h3 className="text-lg font-serif font-bold text-stone-900">
                  Reconcile {reconcileAccount.name}
                </h3>
                <p className="text-xs text-stone-500">
                  Ledger Balance:{' '}
                  <span className="font-mono font-bold text-stone-800">
                    {formatCents(
                      reconcileAccount.currentBalanceCentsDecimal ??
                        reconcileAccount.currentBalanceCents
                    )}
                  </span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReconcileAccount(null)}
                className="p-1 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleReconcileSubmit} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor="modal-rec-stmt-bal" className="block text-stone-600 font-medium mb-1">
                    Statement Balance ($)
                  </label>
                  <input
                    id="modal-rec-stmt-bal"
                    type="text"
                    value={reconcileStatementDollars}
                    onChange={(e) => setReconcileStatementDollars(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-stone-200 font-mono"
                  />
                </div>
                <div>
                  <label htmlFor="modal-rec-stmt-date" className="block text-stone-600 font-medium mb-1">
                    Statement Date
                  </label>
                  <input
                    id="modal-rec-stmt-date"
                    type="date"
                    value={reconcileDateIso}
                    onChange={(e) => setReconcileDateIso(e.target.value)}
                    className="w-full px-2.5 py-2 rounded-xl border border-stone-200"
                  />
                </div>
              </div>

              {liveReconcileDiscrepancy && (
                <div
                  className={`p-3 rounded-xl border flex items-center justify-between font-mono text-xs ${
                    liveReconcileDiscrepancy.isMatch
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                      : 'bg-amber-50 border-amber-200 text-amber-900'
                  }`}
                >
                  <div>
                    <span className="font-sans block text-[11px] font-semibold">
                      {liveReconcileDiscrepancy.isMatch
                        ? 'Perfect Balance Match'
                        : 'Discrepancy Detected'}
                    </span>
                    <span className="text-[10px] text-stone-600">
                      Ledger: {formatCents(liveReconcileDiscrepancy.ledgerBig)}
                    </span>
                  </div>
                  <span className="font-bold text-sm">
                    {liveReconcileDiscrepancy.discBig > 0n ? '+' : ''}
                    {formatCents(liveReconcileDiscrepancy.discBig)}
                  </span>
                </div>
              )}

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setReconcileAccount(null)}
                  className="px-4 py-2 rounded-xl border border-stone-200 text-stone-700 font-semibold hover:bg-stone-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isMutating}
                  className="px-4 py-2 rounded-xl bg-[#173D35] hover:bg-emerald-950 text-white font-semibold cursor-pointer"
                >
                  Verify & Reconcile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 3: ACCOUNT-TO-ACCOUNT TRANSFER MODAL
         ===================================================================== */}
      {isTransferModalOpen && (
        <div className="fixed inset-0 bg-stone-950/55 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full border border-stone-200 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div className="flex items-center gap-2">
                <ArrowLeftRight className="w-5 h-5 text-emerald-800" />
                <h3 className="text-lg font-serif font-bold text-stone-900">
                  Account-to-Account Transfer
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsTransferModalOpen(false)}
                className="p-1 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleTransferSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-stone-700 font-semibold mb-1">
                  From Source Account
                </label>
                <select
                  value={transferSourceId}
                  onChange={(e) => setTransferSourceId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-stone-200 bg-white"
                >
                  {localAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({formatCents(a.currentBalanceCentsDecimal ?? a.currentBalanceCents)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-stone-700 font-semibold mb-1">
                  To Destination Account
                </label>
                <select
                  value={transferDestId}
                  onChange={(e) => setTransferDestId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-stone-200 bg-white"
                >
                  {localAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({formatCents(a.currentBalanceCentsDecimal ?? a.currentBalanceCents)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-stone-700 font-semibold mb-1">
                  Transfer Amount ($)
                </label>
                <input
                  type="text"
                  value={transferAmountDollars}
                  onChange={(e) => setTransferAmountDollars(e.target.value)}
                  placeholder="e.g. 500.00"
                  className="w-full px-3 py-2 rounded-xl border border-stone-200 font-mono text-sm"
                />
              </div>

              <div>
                <label className="block text-stone-700 font-semibold mb-1">
                  Transfer Memo
                </label>
                <input
                  type="text"
                  value={transferMemo}
                  onChange={(e) => setTransferMemo(e.target.value)}
                  placeholder="e.g. Monthly credit card payment or savings allocation"
                  className="w-full px-3 py-2 rounded-xl border border-stone-200"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsTransferModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-stone-200 text-stone-700 font-semibold hover:bg-stone-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isMutating}
                  className="px-4 py-2 rounded-xl bg-[#173D35] hover:bg-emerald-950 text-white font-semibold cursor-pointer"
                >
                  Execute Transfer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 4: ACCOUNT GENERAL LEDGER ACTIVITY INSPECTOR
         ===================================================================== */}
      {ledgerAccount && (
        <div className="fixed inset-0 bg-stone-950/55 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 max-w-2xl w-full border border-stone-200 space-y-4 shadow-xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-stone-100 border border-stone-200 text-stone-800">
                    {ledgerAccount.accountType}
                  </span>
                  <h3 className="text-lg font-serif font-bold text-stone-900">
                    {ledgerAccount.name}
                  </h3>
                </div>
                <p className="text-xs text-stone-500 mt-0.5">
                  {ledgerAccount.institution} · ID:{' '}
                  <span className="font-mono">{ledgerAccount.id}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setLedgerAccount(null)}
                className="p-1 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 flex items-center justify-between">
              <div>
                <span className="text-xs text-stone-500 block">Authoritative Ledger Balance</span>
                <span className="text-2xl font-mono font-bold text-emerald-900">
                  {formatCents(
                    ledgerAccount.currentBalanceCentsDecimal ?? ledgerAccount.currentBalanceCents
                  )}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {canMutate && (
                  <button
                    type="button"
                    onClick={() => {
                      const target = ledgerAccount;
                      setLedgerAccount(null);
                      openEditModal(target);
                    }}
                    className="px-3 py-1.5 rounded-xl border border-stone-200 bg-white text-stone-800 font-semibold text-xs hover:bg-stone-100 cursor-pointer"
                  >
                    Edit Account
                  </button>
                )}
                {canMutate && (
                  <button
                    type="button"
                    onClick={() => {
                      setTransferSourceId(ledgerAccount.id);
                      setLedgerAccount(null);
                      setIsTransferModalOpen(true);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-[#173D35] text-white font-semibold text-xs hover:bg-emerald-950 cursor-pointer"
                  >
                    + Transfer From Here
                  </button>
                )}
              </div>
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                type="text"
                value={ledgerSearch}
                onChange={(e) => setLedgerSearch(e.target.value)}
                placeholder="Filter account ledger entries..."
                className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-stone-200 text-xs"
              />
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1 text-xs">
              {localTransactions
                .filter(
                  (t) =>
                    (t.accountId === ledgerAccount.id ||
                      t.destinationAccountId === ledgerAccount.id) &&
                    (!ledgerSearch.trim() ||
                      (t.title || '').toLowerCase().includes(ledgerSearch.toLowerCase()) ||
                      (t.category || '').toLowerCase().includes(ledgerSearch.toLowerCase()))
                )
                .map((tx) => {
                  const isDest = tx.destinationAccountId === ledgerAccount.id;
                  const isInflow = tx.transactionType === 'INCOME' || isDest;
                  return (
                    <div
                      key={tx.id}
                      className="p-3 rounded-xl border border-stone-200 bg-white flex items-center justify-between"
                    >
                      <div>
                        <div className="font-semibold text-stone-900">{tx.title}</div>
                        <div className="text-[11px] text-stone-500 mt-0.5">
                          {new Date(tx.createdAt || Date.now()).toLocaleDateString()} ·{' '}
                          {tx.category} · {tx.transactionType}
                        </div>
                      </div>
                      <div className="text-right font-mono font-bold text-sm">
                        <span className={isInflow ? 'text-emerald-800' : 'text-rose-700'}>
                          {isInflow ? '+' : '-'}
                          {formatCents(tx.amountCentsDecimal ?? tx.amountCents)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              {localTransactions.filter(
                (t) =>
                  t.accountId === ledgerAccount.id ||
                  t.destinationAccountId === ledgerAccount.id
              ).length === 0 && (
                <p className="text-stone-500 py-6 text-center">
                  No ledger entries recorded for this account yet.
                </p>
              )}
            </div>

            <div className="pt-2 border-t border-stone-100 flex justify-end">
              <button
                type="button"
                onClick={() => setLedgerAccount(null)}
                className="px-4 py-2 rounded-xl bg-stone-900 text-white text-xs font-semibold hover:bg-stone-800 cursor-pointer"
              >
                Close Ledger Inspector
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 5: DELETE ACCOUNT CONFIRMATION MODAL
         ===================================================================== */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-stone-950/55 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full border border-stone-200 space-y-4 shadow-xl">
            <h3 className="text-lg font-serif font-bold text-stone-900">
              Delete “{deleteTarget.name}”?
            </h3>
            <p className="text-xs text-stone-600 leading-relaxed">
              This will permanently remove{' '}
              <span className="font-bold text-stone-900">{deleteTarget.name}</span> (
              {deleteTarget.institution}) with current balance{' '}
              <span className="font-mono font-bold text-stone-900">
                {formatCents(
                  deleteTarget.currentBalanceCentsDecimal ?? deleteTarget.currentBalanceCents
                )}
              </span>{' '}
              from your household Finance Hub.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 rounded-xl border border-stone-200 text-xs font-semibold text-stone-700 hover:bg-stone-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isMutating}
                onClick={() => void handleConfirmDeleteAccount()}
                className="px-4 py-2 rounded-xl bg-rose-700 hover:bg-rose-800 text-white text-xs font-semibold cursor-pointer"
              >
                {isMutating ? 'Deleting...' : 'Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
