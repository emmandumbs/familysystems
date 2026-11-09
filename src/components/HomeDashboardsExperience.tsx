import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Compass,
  DollarSign,
  Utensils,
  FolderTree,
  Heart,
  BookOpen,
  Shield,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Plus,
  ArrowRight,
  Clock,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Wallet,
  PiggyBank,
  Receipt,
  ShoppingBag,
  Home,
  Wrench,
  Target,
  Award,
  Users,
  MessageSquareHeart,
  GraduationCap,
  FileText,
  Car,
  Plane,
  Phone,
  Bell,
  X,
  RefreshCw,
  Lock,
  Check,
} from 'lucide-react';
import type { MainTabType } from './SidebarNavigation';
import { Stage332PlanningExperience } from './Stage332PlanningExperience';
import { RelationshipsCenter } from './RelationshipsCenter';

export interface HomeDashboardsExperienceProps {
  familyId: string;
  activeSubPage: string;
  onNavigate?: (tab: MainTabType, subItemId?: string) => void;
  authToken?: string;
}

function formatCents(cents: number | undefined | null, currency = 'USD'): string {
  const val = Number(cents || 0) / 100;
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
      maximumFractionDigits: 2,
    }).format(val);
  } catch {
    return `$${val.toFixed(2)}`;
  }
}

export const HomeDashboardsExperience: React.FC<HomeDashboardsExperienceProps> = ({
  familyId,
  activeSubPage,
  onNavigate,
  authToken,
}) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Quick Action Modal state
  const [quickModalType, setQuickModalType] = useState<
    null | 'TASK' | 'EVENT' | 'TRANSACTION' | 'GOAL' | 'REMINDER' | 'ACTIVITY' | 'CHORE' | 'GROCERY' | 'GRATITUDE' | 'STUDY' | 'ERRAND'
  >(null);
  const [formTitle, setFormTitle] = useState('');
  const [formSubtitle, setFormSubtitle] = useState('');
  const [formAmountDollars, setFormAmountDollars] = useState('45.00');
  const [formCategory, setFormCategory] = useState('GENERAL');
  const [formDate, setFormDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [submitting, setSubmitting] = useState(false);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const tokenRef = useRef<string>('');

  const resolveAuthHeaders = useCallback(async (): Promise<Record<string, string>> => {
    let token = authToken || tokenRef.current || '';
    if (!token && typeof window !== 'undefined') {
      token =
        window.localStorage.getItem('familyos_session_token_v1') ||
        window.localStorage.getItem('familyos_auth_token') ||
        '';
    }
    if (!token) {
      try {
        const res = await fetch('/api/v1/auth/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userAccountId: 'usr-sarah-owner' }),
        });
        if (res.ok) {
          const json = await res.json();
          token = json.token || '';
        }
      } catch {
        // Ignore
      }
    }
    if (token) {
      tokenRef.current = token;
    }
    return {
      'Content-Type': 'application/json',
      Authorization: token.startsWith('Bearer ') ? token : `Bearer ${token}`,
    };
  }, [authToken]);

  const fetchDashboardData = useCallback(async () => {
    if (!familyId) return;
    setLoading(true);
    setError(null);
    try {
      const headers = await resolveAuthHeaders();
      const res = await fetch(`/api/v1/home-dashboards/${encodeURIComponent(familyId)}`, {
        headers,
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.message || `Failed to load Home Dashboards (${res.status})`);
      }
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err.message || 'Unable to load dashboard data.');
    } finally {
      setLoading(false);
    }
  }, [familyId, resolveAuthHeaders]);

  useEffect(() => {
    void fetchDashboardData();
  }, [fetchDashboardData]);

  useEffect(() => {
    const handleSync = () => {
      void fetchDashboardData();
    };
    window.addEventListener('familyos-household-updated', handleSync);
    window.addEventListener('familyos-finance-updated', handleSync);
    window.addEventListener('familyos-planning-updated', handleSync);
    window.addEventListener('familyos-relationships-updated', handleSync);
    window.addEventListener('familyos-parenting-updated', handleSync);
    window.addEventListener('familyos-life-updated', handleSync);
    return () => {
      window.removeEventListener('familyos-household-updated', handleSync);
      window.removeEventListener('familyos-finance-updated', handleSync);
      window.removeEventListener('familyos-planning-updated', handleSync);
      window.removeEventListener('familyos-relationships-updated', handleSync);
      window.removeEventListener('familyos-parenting-updated', handleSync);
      window.removeEventListener('familyos-life-updated', handleSync);
    };
  }, [fetchDashboardData]);

  const openQuickModal = (
    type: NonNullable<typeof quickModalType>,
    defaultCategory = 'GENERAL'
  ) => {
    setQuickModalType(type);
    setFormTitle('');
    setFormSubtitle('');
    setFormAmountDollars('45.00');
    setFormCategory(defaultCategory);
    setFormDate(new Date().toISOString().slice(0, 10));
  };

  const handleQuickSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !quickModalType) return;
    setSubmitting(true);
    try {
      const headers = await resolveAuthHeaders();
      let endpoint = '';
      let body: Record<string, any> = {};

      if (quickModalType === 'TASK') {
        endpoint = `/api/v1/tasks/${encodeURIComponent(familyId)}`;
        body = {
          title: formTitle.trim(),
          description: formSubtitle.trim(),
          priority: formCategory === 'HIGH' ? 'HIGH' : 'MEDIUM',
          dueDate: formDate,
          dueDateIso: formDate,
          scope: 'SHARED',
          sourceModule: 'GOALS_PROJECTS',
        };
      } else if (quickModalType === 'EVENT') {
        endpoint = `/api/v1/calendar/${encodeURIComponent(familyId)}`;
        body = {
          title: formTitle.trim(),
          description: formSubtitle.trim(),
          eventDate: formDate,
          dateIso: formDate,
          startTime: '18:00',
          endTime: '19:00',
          category: 'FAMILY_EVENT',
          scope: 'FAMILY',
        };
      } else if (quickModalType === 'TRANSACTION') {
        const firstAccId = data?.financeDashboard?.accounts?.[0]?.id;
        if (!firstAccId) {
          throw new Error('Please create a financial account first before recording a transaction.');
        }
        const trimmedDollars = String(formAmountDollars || '0').trim();
        const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(trimmedDollars);
        if (!match) {
          throw new Error('Enter a valid dollar amount with up to 2 decimal places.');
        }
        const wholeCents = Number(match[1]) * 100;
        const fracCents = Number((match[2] || '').padEnd(2, '0'));
        const cents = wholeCents + fracCents;
        if (!Number.isSafeInteger(cents) || cents <= 0) {
          throw new Error('Transaction amount must be greater than $0.00.');
        }
        endpoint = `/api/v1/finance/${encodeURIComponent(familyId)}/transactions`;
        body = {
          accountId: firstAccId,
          title: formTitle.trim(),
          amountCents: cents,
          amountCentsDecimal: String(cents),
          transactionType: formCategory === 'INCOME' ? 'INCOME' : 'EXPENSE',
          category: formCategory === 'INCOME' ? 'SALARY' : 'FOOD',
          notes: formSubtitle.trim(),
        };
      } else if (quickModalType === 'GOAL') {
        endpoint = `/api/v1/goals/${encodeURIComponent(familyId)}`;
        body = {
          title: formTitle.trim(),
          description: formSubtitle.trim() || 'Created from Home Dashboard',
          category: 'FAMILY_GOVERNANCE',
          horizon: 'SHORT_TERM',
          scope: 'FAMILY',
          targetDate: formDate,
        };
      } else if (quickModalType === 'REMINDER') {
        endpoint = `/api/v1/workspace/${encodeURIComponent(familyId)}/reminders`;
        body = {
          title: formTitle.trim(),
          dueLabel: formDate,
          category: formCategory || 'HOUSEHOLD',
        };
      } else if (quickModalType === 'ACTIVITY') {
        endpoint = `/api/v1/family-section/${encodeURIComponent(familyId)}/activities`;
        body = {
          title: formTitle.trim(),
          description: formSubtitle.trim(),
          dateIso: formDate,
          startTime: '18:30',
          endTime: '20:30',
          location: 'Family Home',
          category: 'Family Gathering',
        };
      } else if (quickModalType === 'CHORE') {
        endpoint = `/api/v1/household/${encodeURIComponent(familyId)}/chores`;
        body = {
          title: formTitle.trim(),
          assignedToMemberName: formSubtitle.trim() || data?.caller?.displayName || 'Family Member',
          frequency: 'DAILY',
          rewardPoints: 15,
          pointsValue: 15,
          nextDueDate: Date.parse(formDate) || Date.now(),
          dueDate: Date.parse(formDate) || Date.now(),
        };
      } else if (quickModalType === 'GROCERY') {
        endpoint = `/api/v1/household/${encodeURIComponent(familyId)}/groceries`;
        body = {
          itemName: formTitle.trim(),
          name: formTitle.trim(),
          category: (formCategory || 'PRODUCE').toUpperCase(),
          quantity: 1,
          unit: formSubtitle.trim() || 'item',
        };
      } else if (quickModalType === 'GRATITUDE') {
        endpoint = `/api/v1/domain/${encodeURIComponent(familyId)}/relationships/gratitude`;
        body = {
          toMember: formSubtitle.trim() || 'Whole Family',
          message: formTitle.trim(),
          category: 'Appreciation',
          date: formDate,
        };
      } else if (quickModalType === 'STUDY') {
        const defaultChildName =
          data?.members?.find((m: any) => m.role === 'CHILD')?.displayName ||
          data?.members?.[0]?.displayName ||
          'Child Member';
        endpoint = `/api/v1/domain/${encodeURIComponent(familyId)}/parenting/studyItems`;
        body = {
          title: formTitle.trim(),
          childName: formSubtitle.trim() || defaultChildName,
          subject: formCategory || 'Reading & STEM',
          dueDate: formDate,
          status: 'In Progress',
        };
      } else if (quickModalType === 'ERRAND') {
        endpoint = `/api/v1/domain/${encodeURIComponent(familyId)}/life/personalTasks`;
        body = {
          title: formTitle.trim(),
          category: formCategory || 'Errand',
          dueDate: formDate,
          priority: 'High',
          status: 'Pending',
          scope: 'FAMILY',
          isPrivate: false,
        };
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'Action failed');
      }
      setQuickModalType(null);
      showToast(`Saved "${formTitle.trim()}" to family database.`);
      window.dispatchEvent(new CustomEvent('familyos-household-updated'));
      window.dispatchEvent(new CustomEvent('familyos-finance-updated'));
      window.dispatchEvent(new CustomEvent('familyos-relationships-updated'));
      window.dispatchEvent(new CustomEvent('familyos-parenting-updated'));
      window.dispatchEvent(new CustomEvent('familyos-life-updated'));
      await fetchDashboardData();
    } catch (err: any) {
      showToast(err.message || 'Could not save record');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleReminder = async (reminderId: string, currentCompleted: boolean) => {
    try {
      const headers = await resolveAuthHeaders();
      await fetch(`/api/v1/workspace/${encodeURIComponent(familyId)}/reminders`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ reminderId, toggleCompleted: !currentCompleted }),
      });
      await fetchDashboardData();
    } catch {
      showToast('Failed to update reminder');
    }
  };

  const handleDismissReminder = async (reminderId: string) => {
    try {
      const headers = await resolveAuthHeaders();
      await fetch(`/api/v1/workspace/${encodeURIComponent(familyId)}/reminders`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ reminderId, dismiss: true }),
      });
      await fetchDashboardData();
    } catch {
      showToast('Failed to dismiss reminder');
    }
  };

  const handleCompleteChore = async (choreId: string) => {
    try {
      const headers = await resolveAuthHeaders();
      await fetch(`/api/v1/household/${encodeURIComponent(familyId)}/chores/${encodeURIComponent(choreId)}/complete`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          memberId: data?.caller?.memberProfileId || 'mem-1',
          completedByMemberId: data?.caller?.memberProfileId || 'mem-1',
        }),
      });
      showToast('Chore marked complete!');
      window.dispatchEvent(new CustomEvent('familyos-household-updated'));
      await fetchDashboardData();
    } catch {
      showToast('Could not complete chore');
    }
  };

  const handleToggleGrocery = async (itemId: string) => {
    try {
      const headers = await resolveAuthHeaders();
      await fetch(`/api/v1/household/${encodeURIComponent(familyId)}/groceries/${encodeURIComponent(itemId)}/purchase`, {
        method: 'POST',
        headers,
      });
      window.dispatchEvent(new CustomEvent('familyos-household-updated'));
      await fetchDashboardData();
    } catch {
      showToast('Could not update grocery item');
    }
  };

  const handleToggleTaskStatus = async (task: any) => {
    try {
      const headers = await resolveAuthHeaders();
      const nextStatus = task.status === 'COMPLETED' ? 'TODO' : 'COMPLETED';
      await fetch(`/api/v1/tasks/${encodeURIComponent(familyId)}/${encodeURIComponent(task.id)}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ status: nextStatus, isCompleted: nextStatus === 'COMPLETED' }),
      });
      showToast(nextStatus === 'COMPLETED' ? 'Task completed!' : 'Task reopened');
      await fetchDashboardData();
    } catch {
      showToast('Could not update task');
    }
  };

  const dashboardTabs = [
    { id: 'home_command_center', label: 'Main Command Center', icon: Compass },
    { id: 'home_finance_dashboard', label: 'Finance Dashboard', icon: DollarSign },
    { id: 'home_house_dashboard', label: 'Household Dashboard', icon: Utensils },
    { id: 'home_goals_dashboard', label: 'Goals & Projects Dashboard', icon: FolderTree },
    { id: 'home_relationship_dashboard', label: 'Relationship Dashboard', icon: Heart },
    { id: 'home_parenting_dashboard', label: 'Parenting & Growth Dashboard', icon: BookOpen },
    { id: 'home_life_dashboard', label: 'Life Management Dashboard', icon: Shield },
  ];

  const resolvedSubPage = dashboardTabs.some((t) => t.id === activeSubPage)
    ? activeSubPage
    : 'home_command_center';

  if (loading && !data) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[420px]">
        <div className="flex items-center gap-3 text-stone-600 font-medium">
          <RefreshCw className="w-5 h-5 animate-spin text-emerald-800" />
          <span>Synchronizing live family operational dashboards...</span>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-900">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-rose-600" />
            Unable to Load Home Operational Dashboards
          </h3>
          <p className="text-sm mt-1 text-rose-700">{error}</p>
          <button
            onClick={() => void fetchDashboardData()}
            className="mt-4 px-4 py-2 rounded-xl bg-rose-700 text-white text-xs font-semibold hover:bg-rose-800"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  const ws = data?.workspace || {};
  const caller = data?.caller || {};
  const fin = data?.financeDashboard || {};
  const hh = data?.householdDashboard || {};
  const goalsData = data?.goalsDashboard || {};
  const relData = data?.relationshipDashboard || {};
  const parData = data?.parentingDashboard || {};
  const lifeData = data?.lifeDashboard || {};
  const calEvents = data?.calendarEvents || [];
  const celebrations = data?.upcomingCelebrations || [];
  const members = data?.members || [];

  const pendingTasks = (goalsData.tasks || []).filter((t: any) => t.status !== 'COMPLETED');
  const overdueTasks = pendingTasks.filter(
    (t: any) => t.isOverdue || (t.dueDateIso && t.dueDateIso < new Date().toISOString().slice(0, 10))
  );
  const pendingChores = (hh.chores || []).filter((c: any) => !c.isCompleted);
  const expiringPantry = (hh.pantry || []).filter(
    (p: any) => p.expiryStatus === 'EXPIRED' || p.expiryStatus === 'EXPIRING_SOON'
  );
  const unpurchasedGroceries = (hh.groceries || []).filter((g: any) => !g.isPurchased);

  return (
    <div className="space-y-6 pb-12" data-testid="home-dashboards-experience">
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl bg-emerald-950 text-amber-100 text-xs font-semibold shadow-xl border border-emerald-700">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toast}</span>
        </div>
      )}

      {/* Top Sub-Navigation Bar for the 7 Canonical Home Dashboards */}
      <div className="bg-white rounded-2xl border border-stone-200/90 p-2 shadow-xs flex flex-wrap items-center gap-1.5">
        {dashboardTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = resolvedSubPage === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              data-testid={`home-subnav-${tab.id}`}
              onClick={() => onNavigate?.('family_home', tab.id)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
                isActive
                  ? 'bg-[#173D35] text-[#F7F4EC] shadow-xs'
                  : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-[#E7D1AA]' : 'text-stone-400'}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* =====================================================================
          1. MAIN COMMAND CENTER (home_command_center)
         ===================================================================== */}
      {resolvedSubPage === 'home_command_center' && (
        <div className="space-y-6" data-testid="dashboard-home-command-center">
          {/* Command Center Hero & Quick Actions */}
          <div className="rounded-3xl bg-gradient-to-br from-[#173D35] via-[#1D4B41] to-[#112C26] text-[#F7F4EC] p-6 lg:p-8 shadow-md border border-emerald-900/40">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
              <div>
                <div className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-[#E7D1AA] font-semibold mb-2">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Household Operational Command Center • {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}</span>
                </div>
                <h1 className="text-2xl lg:text-3xl font-serif font-bold tracking-tight">
                  Welcome home, {caller.displayName || 'Family Steward'}
                </h1>
                <p className="text-sm text-emerald-100/85 mt-1 max-w-2xl">
                  {ws.name || 'Your Family'} — “{ws.motto || 'Together in Stewardship'}”. You have{' '}
                  <span className="font-semibold text-white">{pendingTasks.length} active tasks</span>,{' '}
                  <span className="font-semibold text-white">{calEvents.length} scheduled events</span>, and{' '}
                  <span className="font-semibold text-white">{pendingChores.length} household chores</span> queued.
                </p>
              </div>

              {/* Quick Action Buttons */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => openQuickModal('TASK', 'MEDIUM')}
                  className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold border border-white/15 flex items-center gap-1.5 transition"
                >
                  <Plus className="w-3.5 h-3.5 text-[#E7D1AA]" />
                  <span>New Task</span>
                </button>
                <button
                  type="button"
                  onClick={() => openQuickModal('EVENT')}
                  className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold border border-white/15 flex items-center gap-1.5 transition"
                >
                  <Calendar className="w-3.5 h-3.5 text-[#E7D1AA]" />
                  <span>Add Event</span>
                </button>
                {fin.authorized && (
                  <button
                    type="button"
                    onClick={() => openQuickModal('TRANSACTION', 'EXPENSE')}
                    className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold border border-white/15 flex items-center gap-1.5 transition"
                  >
                    <DollarSign className="w-3.5 h-3.5 text-[#E7D1AA]" />
                    <span>Log Transaction</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => openQuickModal('GOAL')}
                  className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold border border-white/15 flex items-center gap-1.5 transition"
                >
                  <Target className="w-3.5 h-3.5 text-[#E7D1AA]" />
                  <span>New Goal</span>
                </button>
                <button
                  type="button"
                  onClick={() => openQuickModal('REMINDER', 'HOUSEHOLD')}
                  className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold border border-white/15 flex items-center gap-1.5 transition"
                >
                  <Bell className="w-3.5 h-3.5 text-[#E7D1AA]" />
                  <span>Add Reminder</span>
                </button>
                <button
                  type="button"
                  onClick={() => openQuickModal('ACTIVITY')}
                  className="px-3.5 py-2 rounded-xl bg-[#C39A60] hover:bg-[#b3894f] text-stone-950 text-xs font-bold flex items-center gap-1.5 transition shadow-xs"
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Plan Family Activity</span>
                </button>
              </div>
            </div>

            {/* Executive Pulse Strip */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mt-6 pt-6 border-t border-white/10">
              <button
                type="button"
                onClick={() => onNavigate?.('family_home', 'home_finance_dashboard')}
                className="text-left p-3.5 rounded-2xl bg-black/20 hover:bg-black/30 border border-white/10 transition"
              >
                <div className="text-[11px] uppercase tracking-wider text-emerald-200/80">Net Worth</div>
                <div className="text-lg font-bold mt-0.5 text-white">
                  {fin.authorized ? formatCents(fin.netWorthCents, ws.currencyCode) : 'Restricted'}
                </div>
                <div className="text-[11px] text-[#E7D1AA] mt-1 flex items-center gap-1">
                  <span>Finance Dashboard</span>
                  <ArrowRight className="w-3 h-3" />
                </div>
              </button>

              <button
                type="button"
                onClick={() => onNavigate?.('family_home', 'home_house_dashboard')}
                className="text-left p-3.5 rounded-2xl bg-black/20 hover:bg-black/30 border border-white/10 transition"
              >
                <div className="text-[11px] uppercase tracking-wider text-emerald-200/80">Household Pulse</div>
                <div className="text-lg font-bold mt-0.5 text-white">
                  {pendingChores.length} Chores • {unpurchasedGroceries.length} Items
                </div>
                <div className="text-[11px] text-[#E7D1AA] mt-1 flex items-center gap-1">
                  <span>Household Dashboard</span>
                  <ArrowRight className="w-3 h-3" />
                </div>
              </button>

              <button
                type="button"
                onClick={() => onNavigate?.('family_home', 'home_goals_dashboard')}
                className="text-left p-3.5 rounded-2xl bg-black/20 hover:bg-black/30 border border-white/10 transition"
              >
                <div className="text-[11px] uppercase tracking-wider text-emerald-200/80">Goals & Tasks</div>
                <div className="text-lg font-bold mt-0.5 text-white">
                  {(goalsData.goals || []).length} Goals • {overdueTasks.length} Overdue
                </div>
                <div className="text-[11px] text-[#E7D1AA] mt-1 flex items-center gap-1">
                  <span>Goals Dashboard</span>
                  <ArrowRight className="w-3 h-3" />
                </div>
              </button>

              <button
                type="button"
                onClick={() => onNavigate?.('family_home', 'home_relationship_dashboard')}
                className="text-left p-3.5 rounded-2xl bg-black/20 hover:bg-black/30 border border-white/10 transition"
              >
                <div className="text-[11px] uppercase tracking-wider text-emerald-200/80">Relationships</div>
                <div className="text-lg font-bold mt-0.5 text-white">
                  {(relData.gratitude || []).length} Gratitude • {(relData.checkins || []).length} Check-ins
                </div>
                <div className="text-[11px] text-[#E7D1AA] mt-1 flex items-center gap-1">
                  <span>Relationship Dashboard</span>
                  <ArrowRight className="w-3 h-3" />
                </div>
              </button>

              <button
                type="button"
                onClick={() => onNavigate?.('family_home', 'home_parenting_dashboard')}
                className="text-left p-3.5 rounded-2xl bg-black/20 hover:bg-black/30 border border-white/10 transition"
              >
                <div className="text-[11px] uppercase tracking-wider text-emerald-200/80">Parenting & Growth</div>
                <div className="text-lg font-bold mt-0.5 text-white">
                  {(parData.childRoutines || []).length} Routines • {(parData.studyItems || []).length} Studies
                </div>
                <div className="text-[11px] text-[#E7D1AA] mt-1 flex items-center gap-1">
                  <span>Parenting Dashboard</span>
                  <ArrowRight className="w-3 h-3" />
                </div>
              </button>

              <button
                type="button"
                onClick={() => onNavigate?.('family_home', 'home_life_dashboard')}
                className="text-left p-3.5 rounded-2xl bg-black/20 hover:bg-black/30 border border-white/10 transition"
              >
                <div className="text-[11px] uppercase tracking-wider text-emerald-200/80">Life & Vault</div>
                <div className="text-lg font-bold mt-0.5 text-white">
                  {(lifeData.documents || []).length} Docs • {(lifeData.vehicles || []).length} Vehicles
                </div>
                <div className="text-[11px] text-[#E7D1AA] mt-1 flex items-center gap-1">
                  <span>Life Dashboard</span>
                  <ArrowRight className="w-3 h-3" />
                </div>
              </button>
            </div>
          </div>

          {/* Main Command Center Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Column 1: Today's Schedule, Appointments & Celebrations */}
            <div className="bg-white rounded-2xl border border-stone-200/90 p-5 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-base font-bold text-stone-900 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-emerald-800" />
                    <span>Schedule & Appointments</span>
                  </h2>
                  <button
                    type="button"
                    onClick={() => onNavigate?.('calendar_routines', 'cal_schedule')}
                    className="text-xs font-semibold text-emerald-800 hover:underline flex items-center gap-1"
                  >
                    <span>Open Planner</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>

                <div className="space-y-2.5">
                  {calEvents.slice(0, 5).map((ev: any) => (
                    <div
                      key={ev.id}
                      className="p-3 rounded-xl bg-stone-50 border border-stone-200/70 flex items-start justify-between gap-3"
                    >
                      <div>
                        <div className="text-xs font-bold text-stone-900">{ev.title}</div>
                        <div className="text-[11px] text-stone-500 mt-0.5">
                          {ev.dateIso || ev.date} • {ev.startTime || 'All Day'} {ev.location ? `• ${ev.location}` : ''}
                        </div>
                      </div>
                      <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-900">
                        {ev.category || 'EVENT'}
                      </span>
                    </div>
                  ))}
                  {calEvents.length === 0 && (
                    <p className="text-xs text-stone-500 py-4 text-center">No upcoming calendar events scheduled.</p>
                  )}
                </div>

                {/* Birthdays & Celebrations */}
                <div className="mt-5 pt-4 border-t border-stone-100">
                  <div className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-2.5">
                    Upcoming Birthdays & Celebrations
                  </div>
                  <div className="space-y-2">
                    {celebrations.slice(0, 3).map((cel: any) => (
                      <div key={cel.id} className="flex items-center justify-between text-xs py-1.5 px-2.5 rounded-lg bg-amber-50/70 border border-amber-200/60">
                        <span className="font-semibold text-stone-800">{cel.label}</span>
                        <span className="text-amber-900 font-medium">{cel.dateIso}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => openQuickModal('EVENT')}
                className="mt-4 w-full py-2 rounded-xl border border-stone-200 hover:bg-stone-50 text-xs font-semibold text-stone-700 flex items-center justify-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Schedule Family Appointment</span>
              </button>
            </div>

            {/* Column 2: Priority & Overdue Tasks + Active Goals Progress */}
            <div className="bg-white rounded-2xl border border-stone-200/90 p-5 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-base font-bold text-stone-900 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-800" />
                    <span>Priority Tasks & Goals</span>
                  </h2>
                  <button
                    type="button"
                    onClick={() => onNavigate?.('planning_execution', 'plan_tasks')}
                    className="text-xs font-semibold text-emerald-800 hover:underline flex items-center gap-1"
                  >
                    <span>All Tasks</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>

                {overdueTasks.length > 0 && (
                  <div className="mb-3 p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-900 flex items-center justify-between">
                    <span className="font-semibold flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                      {overdueTasks.length} overdue task{overdueTasks.length === 1 ? '' : 's'} require attention
                    </span>
                  </div>
                )}

                <div className="space-y-2">
                  {(goalsData.tasks || []).slice(0, 5).map((task: any) => (
                    <div
                      key={task.id}
                      className="p-2.5 rounded-xl bg-stone-50 border border-stone-200/70 flex items-center justify-between gap-2"
                    >
                      <button
                        type="button"
                        onClick={() => void handleToggleTaskStatus(task)}
                        className="flex items-center gap-2.5 text-left flex-1 min-w-0"
                      >
                        <span
                          className={`w-4 h-4 rounded-md flex items-center justify-center border ${
                            task.status === 'COMPLETED'
                              ? 'bg-emerald-700 border-emerald-700 text-white'
                              : 'border-stone-400 bg-white'
                          }`}
                        >
                          {task.status === 'COMPLETED' && <Check className="w-3 h-3" />}
                        </span>
                        <span
                          className={`text-xs font-semibold truncate ${
                            task.status === 'COMPLETED' ? 'line-through text-stone-400' : 'text-stone-900'
                          }`}
                        >
                          {task.title}
                        </span>
                      </button>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-stone-200/70 text-stone-700 shrink-0">
                        {task.dueDateIso || 'Active'}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="mt-5 pt-4 border-t border-stone-100">
                  <div className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-2.5">
                    Active Family Goals Progress
                  </div>
                  <div className="space-y-2.5">
                    {(goalsData.goals || []).slice(0, 3).map((g: any) => {
                      const pct = Math.min(100, Math.max(0, Number(g.progressPercentage ?? g.progressPercent ?? 50)));
                      return (
                        <div key={g.id} className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span className="font-semibold text-stone-800 truncate">{g.title}</span>
                            <span className="font-bold text-emerald-800">{pct}%</span>
                          </div>
                          <div className="w-full h-2 rounded-full bg-stone-100 overflow-hidden">
                            <div className="h-full bg-[#173D35] rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => openQuickModal('TASK', 'HIGH')}
                className="mt-4 w-full py-2 rounded-xl border border-stone-200 hover:bg-stone-50 text-xs font-semibold text-stone-700 flex items-center justify-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create Priority Task</span>
              </button>
            </div>

            {/* Column 3: Financial Alerts, Household Reminders & Domain Nudges */}
            <div className="bg-white rounded-2xl border border-stone-200/90 p-5 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-base font-bold text-stone-900 flex items-center gap-2">
                    <Bell className="w-4 h-4 text-emerald-800" />
                    <span>Alerts & Household Reminders</span>
                  </h2>
                  <button
                    type="button"
                    onClick={() => openQuickModal('REMINDER', 'HOUSEHOLD')}
                    className="text-xs font-semibold text-emerald-800 hover:underline flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add</span>
                  </button>
                </div>

                {/* Financial summary & alerts */}
                {fin.authorized && (
                  <div className="p-3 rounded-xl bg-emerald-950/5 border border-emerald-900/15 mb-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-stone-700">Monthly Surplus / Deficit</span>
                      <span
                        className={`font-bold ${
                          Number(fin.monthlySurplusCents || 0) >= 0 ? 'text-emerald-800' : 'text-rose-700'
                        }`}
                      >
                        {formatCents(fin.monthlySurplusCents, ws.currencyCode)}
                      </span>
                    </div>
                    {(fin.alerts || []).slice(0, 2).map((al: any) => (
                      <div key={al.id} className="mt-2 text-[11px] text-amber-900 bg-amber-50/90 px-2.5 py-1.5 rounded-lg border border-amber-200">
                        <span className="font-bold">{al.title}:</span> {al.detail}
                      </div>
                    ))}
                  </div>
                )}

                {/* Interactive Household Reminders */}
                <div className="space-y-2">
                  {(ws.reminders || []).slice(0, 4).map((rem: any) => (
                    <div
                      key={rem.id}
                      className="p-2.5 rounded-xl bg-stone-50 border border-stone-200/70 flex items-center justify-between gap-2"
                    >
                      <button
                        type="button"
                        onClick={() => void handleToggleReminder(rem.id, Boolean(rem.isCompleted))}
                        className="flex items-center gap-2 text-left flex-1 min-w-0"
                      >
                        <span
                          className={`w-4 h-4 rounded flex items-center justify-center border ${
                            rem.isCompleted ? 'bg-emerald-700 border-emerald-700 text-white' : 'border-stone-400 bg-white'
                          }`}
                        >
                          {rem.isCompleted && <Check className="w-3 h-3" />}
                        </span>
                        <span className={`text-xs font-medium truncate ${rem.isCompleted ? 'line-through text-stone-400' : 'text-stone-800'}`}>
                          {rem.title}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDismissReminder(rem.id)}
                        title="Dismiss reminder"
                        className="text-stone-400 hover:text-stone-700 p-1"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Relationship, Parenting & Safety Nudges */}
                <div className="mt-4 pt-3 border-t border-stone-100 space-y-2 text-xs">
                  <div className="flex items-center justify-between text-stone-700">
                    <span>Relationship Check-ins Logged</span>
                    <button
                      type="button"
                      onClick={() => onNavigate?.('relationships', 'rel_checkins')}
                      className="font-bold text-emerald-800 hover:underline"
                    >
                      {(relData.checkins || []).length} Check-ins →
                    </button>
                  </div>
                  <div className="flex items-center justify-between text-stone-700">
                    <span>Children’s Active Study Items</span>
                    <button
                      type="button"
                      onClick={() => onNavigate?.('parenting_growth', 'parent_education')}
                      className="font-bold text-emerald-800 hover:underline"
                    >
                      {(parData.studyItems || []).length} Active →
                    </button>
                  </div>
                  <div className="flex items-center justify-between text-stone-700">
                    <span>Pantry Expiry & Home Maintenance</span>
                    <button
                      type="button"
                      onClick={() => onNavigate?.('household_hub', 'house_pantry')}
                      className="font-bold text-amber-800 hover:underline"
                    >
                      {expiringPantry.length} Expiring Items →
                    </button>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onNavigate?.('people_relationships', 'home_overview')}
                className="mt-4 w-full py-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold flex items-center justify-center gap-1.5"
              >
                <Users className="w-3.5 h-3.5" />
                <span>Open Family Identity & Heritage Section</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          2. FINANCE DASHBOARD (home_finance_dashboard)
         ===================================================================== */}
      {resolvedSubPage === 'home_finance_dashboard' && (
        <div className="space-y-6" data-testid="dashboard-home-finance">
          {!fin.authorized ? (
            <div className="bg-white rounded-2xl border border-stone-200 p-8 text-center max-w-xl mx-auto">
              <Lock className="w-8 h-8 text-stone-400 mx-auto mb-3" />
              <h2 className="text-lg font-bold text-stone-900">Financial Dashboard Restricted</h2>
              <p className="text-xs text-stone-600 mt-1">
                Your current family role ({caller.role}) does not have permission to view household bank balances, net worth, or ledger transactions.
              </p>
            </div>
          ) : (
            <>
              <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-xs">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                      Home — Financial Stewardship Overview
                    </span>
                    <h1 className="text-2xl font-serif font-bold text-stone-900 mt-0.5">
                      Household Finance Dashboard
                    </h1>
                    <p className="text-xs text-stone-500 mt-0.5">
                      Live integer-cent balances, cash flow excluding internal transfers, envelope utilization, and upcoming bills.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openQuickModal('TRANSACTION', 'EXPENSE')}
                      className="px-3.5 py-2 rounded-xl bg-[#173D35] text-white text-xs font-semibold flex items-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Record Expense / Income</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onNavigate?.('finance_hub', 'fin_accounts')}
                      className="px-3.5 py-2 rounded-xl border border-stone-200 hover:bg-stone-50 text-xs font-semibold text-stone-800 flex items-center gap-1.5"
                    >
                      <span>Open Full Money Module</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Key Financial KPI Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5 mt-6">
                  <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200/80">
                    <div className="text-xs text-stone-500 font-medium">Household Net Worth</div>
                    <div className="text-xl font-bold text-stone-900 mt-1">
                      {formatCents(fin.netWorthCents, ws.currencyCode)}
                    </div>
                    <div className="text-[11px] text-emerald-700 mt-1">
                      Assets {formatCents(fin.totalAssetsCents)} • Debt {formatCents(fin.totalLiabilitiesCents)}
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200/80">
                    <div className="text-xs text-stone-500 font-medium">Available Liquid Cash</div>
                    <div className="text-xl font-bold text-emerald-800 mt-1">
                      {formatCents(fin.availableCashCents, ws.currencyCode)}
                    </div>
                    <div className="text-[11px] text-stone-500 mt-1">
                      Across {(fin.accounts || []).length} active accounts
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200/80">
                    <div className="text-xs text-stone-500 font-medium flex items-center gap-1">
                      <TrendingUp className="w-3.5 h-3.5 text-emerald-700" />
                      <span>Monthly Income</span>
                    </div>
                    <div className="text-xl font-bold text-emerald-800 mt-1">
                      {formatCents(fin.monthlyIncomeCents, ws.currencyCode)}
                    </div>
                    <div className="text-[11px] text-stone-500 mt-1">Excludes internal transfers</div>
                  </div>

                  <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200/80">
                    <div className="text-xs text-stone-500 font-medium flex items-center gap-1">
                      <TrendingDown className="w-3.5 h-3.5 text-rose-600" />
                      <span>Monthly Expenses</span>
                    </div>
                    <div className="text-xl font-bold text-rose-700 mt-1">
                      {formatCents(fin.monthlyExpensesCents, ws.currencyCode)}
                    </div>
                    <div className="text-[11px] text-stone-500 mt-1">Posted household spending</div>
                  </div>

                  <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200/80">
                    <div className="text-xs text-stone-500 font-medium">Monthly Surplus / Deficit</div>
                    <div
                      className={`text-xl font-bold mt-1 ${
                        Number(fin.monthlySurplusCents || 0) >= 0 ? 'text-emerald-800' : 'text-rose-700'
                      }`}
                    >
                      {formatCents(fin.monthlySurplusCents, ws.currencyCode)}
                    </div>
                    <div className="text-[11px] text-stone-500 mt-1">Net monthly operating cashflow</div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Envelope Budgets */}
                <div className="bg-white rounded-2xl border border-stone-200 p-5 shadow-xs">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2">
                      <Wallet className="w-4 h-4 text-emerald-800" />
                      <span>Budget Utilization</span>
                    </h3>
                    <button
                      type="button"
                      onClick={() => onNavigate?.('finance_hub', 'fin_budgets')}
                      className="text-xs font-semibold text-emerald-800 hover:underline"
                    >
                      Manage Budgets →
                    </button>
                  </div>
                  <div className="space-y-3">
                    {(fin.budgets || []).map((b: any) => {
                      const alloc = Number(b.allocatedCents || 0);
                      const spent = Number(b.spentCents || 0);
                      const pct = alloc > 0 ? Math.min(100, Math.round((spent / alloc) * 100)) : 0;
                      const isOver = spent > alloc;
                      return (
                        <div key={b.id} className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span className="font-semibold text-stone-800">{b.category}</span>
                            <span className={isOver ? 'text-rose-700 font-bold' : 'text-stone-600'}>
                              {formatCents(spent)} / {formatCents(alloc)} ({pct}%)
                            </span>
                          </div>
                          <div className="w-full h-2 rounded-full bg-stone-100 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${isOver ? 'bg-rose-600' : pct >= 85 ? 'bg-amber-500' : 'bg-[#173D35]'}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Savings Goals & Recurring Bills */}
                <div className="bg-white rounded-2xl border border-stone-200 p-5 shadow-xs space-y-5">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2">
                        <PiggyBank className="w-4 h-4 text-emerald-800" />
                        <span>Savings Goals Progress</span>
                      </h3>
                      <button
                        type="button"
                        onClick={() => onNavigate?.('finance_hub', 'fin_savings')}
                        className="text-xs font-semibold text-emerald-800 hover:underline"
                      >
                        Savings Hub →
                      </button>
                    </div>
                    <div className="space-y-2.5">
                      {(fin.savingsGoals || []).slice(0, 3).map((sg: any) => {
                        const target = Number(sg.targetAmountCents || 1);
                        const current = Number(sg.currentAmountCents || 0);
                        const pct = Math.min(100, Math.round((current / target) * 100));
                        return (
                          <div key={sg.id} className="p-2.5 rounded-xl bg-stone-50 border border-stone-200/70">
                            <div className="flex justify-between text-xs font-semibold text-stone-900">
                              <span>{sg.name}</span>
                              <span>{formatCents(current)} / {formatCents(target)}</span>
                            </div>
                            <div className="w-full h-1.5 rounded-full bg-stone-200 mt-1.5 overflow-hidden">
                              <div className="h-full bg-emerald-700 rounded-full" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="pt-4 border-t border-stone-100">
                    <div className="flex items-center justify-between mb-2.5">
                      <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2">
                        <Receipt className="w-4 h-4 text-emerald-800" />
                        <span>Upcoming Bills & Subscriptions</span>
                      </h3>
                      <button
                        type="button"
                        onClick={() => onNavigate?.('finance_hub', 'fin_recurring')}
                        className="text-xs font-semibold text-emerald-800 hover:underline"
                      >
                        All Bills →
                      </button>
                    </div>
                    <div className="space-y-2">
                      {(fin.recurringRules || []).slice(0, 4).map((rule: any) => (
                        <div key={rule.id} className="flex items-center justify-between text-xs p-2 rounded-lg bg-stone-50">
                          <div>
                            <div className="font-semibold text-stone-800">{rule.title}</div>
                            <div className="text-[11px] text-stone-500">{rule.frequency} • {rule.category}</div>
                          </div>
                          <span className="font-bold text-stone-900">{formatCents(rule.amountCents)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Recent Transactions */}
                <div className="bg-white rounded-2xl border border-stone-200 p-5 shadow-xs">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold text-stone-900">Recent Transactions</h3>
                    <button
                      type="button"
                      onClick={() => onNavigate?.('finance_hub', 'fin_transactions')}
                      className="text-xs font-semibold text-emerald-800 hover:underline"
                    >
                      Full Ledger →
                    </button>
                  </div>
                  <div className="space-y-2.5">
                    {(fin.recentTransactions || []).slice(0, 6).map((tx: any) => (
                      <div key={tx.id} className="flex items-center justify-between text-xs p-2.5 rounded-xl bg-stone-50 border border-stone-200/60">
                        <div className="min-w-0 pr-2">
                          <div className="font-semibold text-stone-900 truncate">{tx.title}</div>
                          <div className="text-[11px] text-stone-500">{tx.category} • {tx.transactionType}</div>
                        </div>
                        <span
                          className={`font-bold shrink-0 ${
                            tx.transactionType === 'INCOME' ? 'text-emerald-700' : 'text-stone-900'
                          }`}
                        >
                          {tx.transactionType === 'INCOME' ? '+' : '-'}
                          {formatCents(Math.abs(Number(tx.amountCents || 0)))}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* =====================================================================
          3. HOUSEHOLD DASHBOARD (home_house_dashboard)
         ===================================================================== */}
      {resolvedSubPage === 'home_house_dashboard' && (
        <div className="space-y-6" data-testid="dashboard-home-household">
          <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-xs">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                  Home — Daily Household Operations
                </span>
                <h1 className="text-2xl font-serif font-bold text-stone-900 mt-0.5">
                  Household Operations Dashboard
                </h1>
                <p className="text-xs text-stone-500 mt-0.5">
                  Chores, 7-day meal plan, pantry inventory & expiry tracking, smart grocery list, wardrobe, and home assets.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => openQuickModal('CHORE')}
                  className="px-3.5 py-2 rounded-xl bg-[#173D35] text-white text-xs font-semibold flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Assign Chore</span>
                </button>
                <button
                  type="button"
                  onClick={() => openQuickModal('GROCERY', 'Produce')}
                  className="px-3.5 py-2 rounded-xl border border-stone-200 hover:bg-stone-50 text-xs font-semibold text-stone-800 flex items-center gap-1.5"
                >
                  <ShoppingBag className="w-3.5 h-3.5" />
                  <span>Add Grocery Item</span>
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate?.('household_hub', 'house_meals')}
                  className="px-3.5 py-2 rounded-xl border border-stone-200 hover:bg-stone-50 text-xs font-semibold text-stone-800 flex items-center gap-1.5"
                >
                  <span>Open Full Household Hub</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5 mt-6">
              <button
                type="button"
                onClick={() => onNavigate?.('household_hub', 'house_chores')}
                className="p-4 rounded-2xl bg-stone-50 border border-stone-200/80 text-left hover:border-emerald-700 transition"
              >
                <div className="text-xs text-stone-500">Pending Chores</div>
                <div className="text-xl font-bold text-stone-900 mt-1">{pendingChores.length} Active</div>
                <div className="text-[11px] text-emerald-800 mt-1">Manage Chores →</div>
              </button>

              <button
                type="button"
                onClick={() => onNavigate?.('household_hub', 'house_meals')}
                className="p-4 rounded-2xl bg-stone-50 border border-stone-200/80 text-left hover:border-emerald-700 transition"
              >
                <div className="text-xs text-stone-500">Meals & Recipes</div>
                <div className="text-xl font-bold text-stone-900 mt-1">
                  {(hh.meals || []).length} Planned • {(hh.recipes || []).length} Recipes
                </div>
                <div className="text-[11px] text-emerald-800 mt-1">7-Day Meal Planner →</div>
              </button>

              <button
                type="button"
                onClick={() => onNavigate?.('household_hub', 'house_pantry')}
                className="p-4 rounded-2xl bg-stone-50 border border-stone-200/80 text-left hover:border-emerald-700 transition"
              >
                <div className="text-xs text-stone-500">Pantry & Expiry Alerts</div>
                <div className="text-xl font-bold text-amber-800 mt-1">
                  {(hh.pantry || []).length} Items ({expiringPantry.length} Alert)
                </div>
                <div className="text-[11px] text-emerald-800 mt-1">Pantry Tracker →</div>
              </button>

              <button
                type="button"
                onClick={() => onNavigate?.('household_hub', 'house_groceries')}
                className="p-4 rounded-2xl bg-stone-50 border border-stone-200/80 text-left hover:border-emerald-700 transition"
              >
                <div className="text-xs text-stone-500">Smart Grocery List</div>
                <div className="text-xl font-bold text-stone-900 mt-1">
                  {unpurchasedGroceries.length} To Buy
                </div>
                <div className="text-[11px] text-emerald-800 mt-1">Grocery List →</div>
              </button>

              <button
                type="button"
                onClick={() => onNavigate?.('household_hub', 'house_assets')}
                className="p-4 rounded-2xl bg-stone-50 border border-stone-200/80 text-left hover:border-emerald-700 transition"
              >
                <div className="text-xs text-stone-500">Assets & Wardrobe</div>
                <div className="text-xl font-bold text-stone-900 mt-1">
                  {(hh.assets || []).length} Assets • {(hh.wardrobe || []).length} Attire
                </div>
                <div className="text-[11px] text-emerald-800 mt-1">Home Assets →</div>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Chores & Responsibilities */}
            <div className="bg-white rounded-2xl border border-stone-200 p-5 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-stone-900">Household Chores Queue</h3>
                <button
                  type="button"
                  onClick={() => onNavigate?.('household_hub', 'house_chores')}
                  className="text-xs font-semibold text-emerald-800 hover:underline"
                >
                  All Chores →
                </button>
              </div>
              <div className="space-y-2.5">
                {(hh.chores || []).slice(0, 6).map((chore: any) => (
                  <div key={chore.id} className="p-3 rounded-xl bg-stone-50 border border-stone-200/70 flex items-center justify-between gap-2">
                    <div>
                      <div className={`text-xs font-semibold ${chore.isCompleted ? 'line-through text-stone-400' : 'text-stone-900'}`}>
                        {chore.title}
                      </div>
                      <div className="text-[11px] text-stone-500">
                        {chore.assignedToMemberName || 'Assigned'} • {chore.pointsValue || 10} pts
                      </div>
                    </div>
                    {!chore.isCompleted && (
                      <button
                        type="button"
                        onClick={() => void handleCompleteChore(chore.id)}
                        className="px-2.5 py-1 rounded-lg bg-emerald-800 text-white text-[11px] font-semibold hover:bg-emerald-900"
                      >
                        Complete
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Smart Grocery & Pantry Alerts */}
            <div className="bg-white rounded-2xl border border-stone-200 p-5 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-stone-900">Grocery List & Pantry Alerts</h3>
                <button
                  type="button"
                  onClick={() => onNavigate?.('household_hub', 'house_groceries')}
                  className="text-xs font-semibold text-emerald-800 hover:underline"
                >
                  Open Groceries →
                </button>
              </div>
              {expiringPantry.length > 0 && (
                <div className="mb-3 p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
                  <span className="font-bold">{expiringPantry.length} pantry item(s) expiring soon:</span>{' '}
                  {expiringPantry.map((p: any) => p.name).join(', ')}
                </div>
              )}
              <div className="space-y-2">
                {(hh.groceries || []).slice(0, 6).map((item: any) => (
                  <div key={item.id} className="p-2.5 rounded-xl bg-stone-50 border border-stone-200/60 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => void handleToggleGrocery(item.id)}
                      className="flex items-center gap-2 text-left"
                    >
                      <span
                        className={`w-4 h-4 rounded border flex items-center justify-center ${
                          item.isPurchased ? 'bg-emerald-700 border-emerald-700 text-white' : 'border-stone-400 bg-white'
                        }`}
                      >
                        {item.isPurchased && <Check className="w-3 h-3" />}
                      </span>
                      <span className={`text-xs font-medium ${item.isPurchased ? 'line-through text-stone-400' : 'text-stone-800'}`}>
                        {item.name} ({item.quantity} {item.unit})
                      </span>
                    </button>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-stone-200/70 text-stone-700">
                      {item.category}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Meal Plan & Home Assets */}
            <div className="bg-white rounded-2xl border border-stone-200 p-5 shadow-xs space-y-5">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-stone-900">Upcoming Planned Meals</h3>
                  <button
                    type="button"
                    onClick={() => onNavigate?.('household_hub', 'house_meals')}
                    className="text-xs font-semibold text-emerald-800 hover:underline"
                  >
                    Meal Planner →
                  </button>
                </div>
                <div className="space-y-2">
                  {(hh.meals || []).slice(0, 4).map((m: any) => (
                    <div key={m.id} className="p-2.5 rounded-xl bg-stone-50 border border-stone-200/60 flex justify-between text-xs">
                      <span className="font-semibold text-stone-800">{m.customMealTitle || m.mealType}</span>
                      <span className="text-stone-500">{m.mealType} • {m.servings} servings</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-stone-100">
                <div className="flex items-center justify-between mb-2.5">
                  <h3 className="text-sm font-bold text-stone-900 flex items-center gap-1.5">
                    <Wrench className="w-4 h-4 text-emerald-800" />
                    <span>Home Assets & Maintenance</span>
                  </h3>
                  <button
                    type="button"
                    onClick={() => onNavigate?.('household_hub', 'house_assets')}
                    className="text-xs font-semibold text-emerald-800 hover:underline"
                  >
                    Assets →
                  </button>
                </div>
                <div className="space-y-2">
                  {(hh.assets || []).slice(0, 3).map((asset: any) => (
                    <div key={asset.id} className="p-2 rounded-lg bg-stone-50 flex justify-between text-xs">
                      <span className="font-medium text-stone-800">{asset.name}</span>
                      <span className="text-stone-500">{asset.category || asset.condition}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          4. GOALS & PROJECTS DASHBOARD (home_goals_dashboard)
         ===================================================================== */}
      {resolvedSubPage === 'home_goals_dashboard' && (
        <div className="space-y-6" data-testid="dashboard-home-goals">
          <Stage332PlanningExperience
            sessionToken={authToken || localStorage.getItem('familyos_session_token') || 'usr-sarah-owner'}
            familyId={familyId}
            activeSubPage={
              activeSubPage === 'plan_projects' || activeSubPage === 'plan_tasks'
                ? activeSubPage
                : 'plan_goals'
            }
          />
        </div>
      )}

      {/* =====================================================================
          5. RELATIONSHIP DASHBOARD (home_relationship_dashboard)
         ===================================================================== */}
      {resolvedSubPage === 'home_relationship_dashboard' && (
        <div className="space-y-6" data-testid="dashboard-home-relationships">
          <RelationshipsCenter
            selectedRole={data?.callerRole || data?.actor?.role || 'OWNER'}
            sessionToken={authToken || localStorage.getItem('familyos_session_token') || 'usr-sarah-owner'}
            familyId={familyId}
            actorUserId={data?.actor?.userAccountId}
            actorMemberId={data?.actor?.memberProfileId}
            actorDisplayName={data?.actor?.displayName}
            members={members}
            activeSubPage={
              activeSubPage && activeSubPage.startsWith('rel_')
                ? activeSubPage
                : 'rel_checkins'
            }
          />
        </div>
      )}

      {/* =====================================================================
          6. PARENTING & GROWTH DASHBOARD (home_parenting_dashboard)
         ===================================================================== */}
      {resolvedSubPage === 'home_parenting_dashboard' && (
        <div className="space-y-6" data-testid="dashboard-home-parenting">
          <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-xs">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                  Home — Child Development & Family Learning
                </span>
                <h1 className="text-2xl font-serif font-bold text-stone-900 mt-0.5">
                  Parenting & Growth Dashboard
                </h1>
                <p className="text-xs text-stone-500 mt-0.5">
                  Child profiles, developmental milestones, morning/bedtime routines, reading & study logs, and family curricula.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => openQuickModal('STUDY', 'Reading & STEM')}
                  className="px-3.5 py-2 rounded-xl bg-[#173D35] text-white text-xs font-semibold flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Log Study / Reading Activity</span>
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate?.('parenting_growth', 'parent_profiles')}
                  className="px-3.5 py-2 rounded-xl border border-stone-200 hover:bg-stone-50 text-xs font-semibold text-stone-800 flex items-center gap-1.5"
                >
                  <span>Open Parenting & Growth Module</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Child Profiles & Milestones */}
            <div className="bg-white rounded-2xl border border-stone-200 p-5 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2">
                  <GraduationCap className="w-4 h-4 text-emerald-800" />
                  <span>Child Profiles & Milestones</span>
                </h3>
                <button
                  type="button"
                  onClick={() => onNavigate?.('parenting_growth', 'parent_profiles')}
                  className="text-xs font-semibold text-emerald-800 hover:underline"
                >
                  Profiles →
                </button>
              </div>
              <div className="space-y-3">
                {(parData.childProfiles || []).map((child: any) => (
                  <div key={child.id} className="p-3.5 rounded-xl bg-stone-50 border border-stone-200/70">
                    <div className="flex justify-between text-xs font-bold text-stone-900">
                      <span>{child.name || child.childName}</span>
                      <span className="text-emerald-800">{child.gradeOrStage || child.ageGroup || 'Youth'}</span>
                    </div>
                    <p className="text-xs text-stone-600 mt-1">
                      Focus: {child.currentMilestone || child.interests || 'Creative exploration & reading'}
                    </p>
                  </div>
                ))}
                {(parData.childProfiles || []).length === 0 && (
                  <div className="space-y-2">
                    {members
                      .filter((m: any) => m.role === 'CHILD')
                      .map((m: any) => (
                        <div key={m.id} className="p-3 rounded-xl bg-stone-50 border border-stone-200/70 text-xs">
                          <div className="font-bold text-stone-900">{m.displayName}</div>
                          <div className="text-stone-500">Individual Development Profile</div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>

            {/* Children's Daily Routines */}
            <div className="bg-white rounded-2xl border border-stone-200 p-5 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-stone-900">Children’s Daily Routines</h3>
                <button
                  type="button"
                  onClick={() => onNavigate?.('parenting_growth', 'parent_routines')}
                  className="text-xs font-semibold text-emerald-800 hover:underline"
                >
                  Routines →
                </button>
              </div>
              <div className="space-y-2.5">
                {(parData.childRoutines || []).map((rt: any) => (
                  <div key={rt.id} className="p-3 rounded-xl bg-stone-50 border border-stone-200/70 flex justify-between items-center text-xs">
                    <div>
                      <div className="font-bold text-stone-900">{rt.title || rt.routineName}</div>
                      <div className="text-stone-500">{rt.childName || 'Youth'} • {rt.timeOfDay || 'Daily'}</div>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 font-semibold text-[10px]">
                      {rt.status || 'Active'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Education, Reading & Family Learning */}
            <div className="bg-white rounded-2xl border border-stone-200 p-5 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-stone-900">Education & Family Learning</h3>
                <button
                  type="button"
                  onClick={() => onNavigate?.('parenting_growth', 'parent_education')}
                  className="text-xs font-semibold text-emerald-800 hover:underline"
                >
                  Learning Log →
                </button>
              </div>
              <div className="space-y-2.5">
                {(parData.studyItems || []).slice(0, 5).map((st: any) => (
                  <div key={st.id} className="p-3 rounded-xl bg-stone-50 border border-stone-200/70 text-xs">
                    <div className="font-bold text-stone-900">{st.title || st.subject}</div>
                    <div className="text-stone-500 mt-0.5">
                      {st.childName || 'Student'} • {st.subject || 'Study'} • {st.status || 'In Progress'}
                    </div>
                  </div>
                ))}
                {(parData.familyLearningItems || []).slice(0, 2).map((fl: any) => (
                  <div key={fl.id} className="p-3 rounded-xl bg-emerald-950/5 border border-emerald-900/15 text-xs">
                    <div className="font-bold text-emerald-950">Family Curriculum: {fl.topic || fl.title}</div>
                    <div className="text-stone-600 mt-0.5">{fl.progress || 'Active'}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          7. LIFE MANAGEMENT DASHBOARD (home_life_dashboard)
         ===================================================================== */}
      {resolvedSubPage === 'home_life_dashboard' && (
        <div className="space-y-6" data-testid="dashboard-home-life">
          <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-xs">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                  Home — Records, Logistics & Preparedness
                </span>
                <h1 className="text-2xl font-serif font-bold text-stone-900 mt-0.5">
                  Life Management Dashboard
                </h1>
                <p className="text-xs text-stone-500 mt-0.5">
                  Encrypted document vault, personal & shared errands, emergency contacts, travel itineraries, vehicles, and safety preparedness.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => openQuickModal('ERRAND', 'Errand')}
                  className="px-3.5 py-2 rounded-xl bg-[#173D35] text-white text-xs font-semibold flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Life Errand / Reminder</span>
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate?.('life_records', 'life_docs')}
                  className="px-3.5 py-2 rounded-xl border border-stone-200 hover:bg-stone-50 text-xs font-semibold text-stone-800 flex items-center gap-1.5"
                >
                  <span>Open Life Management Module</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Document Vault & Long-Term Records */}
            <div className="bg-white rounded-2xl border border-stone-200 p-5 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-emerald-800" />
                  <span>Important Documents & Vault</span>
                </h3>
                <button
                  type="button"
                  onClick={() => onNavigate?.('life_records', 'life_docs')}
                  className="text-xs font-semibold text-emerald-800 hover:underline"
                >
                  Open Vault →
                </button>
              </div>
              <div className="space-y-2.5">
                {(lifeData.documents || []).slice(0, 5).map((doc: any) => (
                  <div key={doc.id} className="p-3 rounded-xl bg-stone-50 border border-stone-200/70 flex justify-between items-center text-xs">
                    <div>
                      <div className="font-bold text-stone-900">{doc.title}</div>
                      <div className="text-stone-500">{doc.category} • Exp: {doc.expirationDate || 'Permanent'}</div>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-stone-200 text-stone-800 font-semibold text-[10px]">
                      AES-256
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Vehicles, Travel & Errands */}
            <div className="bg-white rounded-2xl border border-stone-200 p-5 shadow-xs space-y-5">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2">
                    <Car className="w-4 h-4 text-emerald-800" />
                    <span>Vehicles & Service Readiness</span>
                  </h3>
                  <button
                    type="button"
                    onClick={() => onNavigate?.('life_records', 'life_vehicles')}
                    className="text-xs font-semibold text-emerald-800 hover:underline"
                  >
                    Vehicles →
                  </button>
                </div>
                <div className="space-y-2">
                  {(lifeData.vehicles || []).map((v: any) => (
                    <div key={v.id} className="p-2.5 rounded-xl bg-stone-50 border border-stone-200/70 text-xs">
                      <div className="font-bold text-stone-900">{v.name || v.vehicle}</div>
                      <div className="text-stone-500">Service: {v.nextService || v.registrationRenewal || 'Up to date'}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-stone-100">
                <div className="flex items-center justify-between mb-2.5">
                  <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2">
                    <Plane className="w-4 h-4 text-emerald-800" />
                    <span>Travel & Holiday Plans</span>
                  </h3>
                  <button
                    type="button"
                    onClick={() => onNavigate?.('life_records', 'life_travel')}
                    className="text-xs font-semibold text-emerald-800 hover:underline"
                  >
                    Travel Hub →
                  </button>
                </div>
                <div className="space-y-2">
                  {(lifeData.trips || []).slice(0, 3).map((tr: any) => (
                    <div key={tr.id} className="p-2.5 rounded-xl bg-stone-50 border border-stone-200/70 text-xs">
                      <div className="font-bold text-stone-900">{tr.destination || tr.title}</div>
                      <div className="text-stone-500">{tr.dates || tr.startDate} • {tr.status || 'Planned'}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Emergency Contacts & Personal Errands */}
            <div className="bg-white rounded-2xl border border-stone-200 p-5 shadow-xs space-y-5">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2">
                    <Phone className="w-4 h-4 text-emerald-800" />
                    <span>Emergency & Key Contacts</span>
                  </h3>
                  <button
                    type="button"
                    onClick={() => onNavigate?.('life_records', 'life_contacts')}
                    className="text-xs font-semibold text-emerald-800 hover:underline"
                  >
                    Contacts →
                  </button>
                </div>
                <div className="space-y-2">
                  {(lifeData.contacts || []).slice(0, 4).map((c: any) => (
                    <div key={c.id} className="p-2.5 rounded-xl bg-stone-50 border border-stone-200/70 flex justify-between text-xs">
                      <div>
                        <div className="font-bold text-stone-900">{c.name}</div>
                        <div className="text-stone-500">{c.role || c.category}</div>
                      </div>
                      <span className="font-semibold text-emerald-800">{c.phone}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-stone-100">
                <div className="flex items-center justify-between mb-2.5">
                  <h3 className="text-sm font-bold text-stone-900">Life Errands & Organization</h3>
                  <button
                    type="button"
                    onClick={() => onNavigate?.('life_records', 'life_organization')}
                    className="text-xs font-semibold text-emerald-800 hover:underline"
                  >
                    All Errands →
                  </button>
                </div>
                <div className="space-y-2">
                  {(lifeData.personalTasks || []).slice(0, 4).map((pt: any) => (
                    <div key={pt.id} className="p-2 rounded-lg bg-stone-50 flex justify-between text-xs">
                      <span className="font-medium text-stone-800">{pt.title}</span>
                      <span className="text-stone-500">{pt.dueDate || pt.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          UNIVERSAL QUICK-ACTION MODAL
         ===================================================================== */}
      {quickModalType && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-stone-200 max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-stone-900">
                {quickModalType === 'TASK' && 'Create Family Task'}
                {quickModalType === 'EVENT' && 'Schedule Family Calendar Event'}
                {quickModalType === 'TRANSACTION' && 'Record Financial Transaction'}
                {quickModalType === 'GOAL' && 'Create Strategic Family Goal'}
                {quickModalType === 'REMINDER' && 'Add Household Reminder'}
                {quickModalType === 'ACTIVITY' && 'Plan Shared Family Activity'}
                {quickModalType === 'CHORE' && 'Assign Household Chore'}
                {quickModalType === 'GROCERY' && 'Add Smart Grocery Item'}
                {quickModalType === 'GRATITUDE' && 'Post Family Gratitude Note'}
                {quickModalType === 'STUDY' && 'Log Child Study / Reading Activity'}
                {quickModalType === 'ERRAND' && 'Add Life Management Errand'}
              </h3>
              <button
                type="button"
                onClick={() => setQuickModalType(null)}
                className="text-stone-400 hover:text-stone-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleQuickSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  {quickModalType === 'GRATITUDE' ? 'Appreciation Message' : 'Title'}
                </label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="Enter a clear title..."
                  className="w-full px-3.5 py-2 rounded-xl border border-stone-300 text-xs focus:outline-none focus:border-emerald-800"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  {quickModalType === 'CHORE'
                    ? 'Assigned Member Name'
                    : quickModalType === 'GRATITUDE'
                    ? 'To Family Member'
                    : quickModalType === 'STUDY'
                    ? 'Child Name'
                    : 'Details / Notes'}
                </label>
                <input
                  type="text"
                  value={formSubtitle}
                  onChange={(e) => setFormSubtitle(e.target.value)}
                  placeholder="Optional details..."
                  className="w-full px-3.5 py-2 rounded-xl border border-stone-300 text-xs focus:outline-none focus:border-emerald-800"
                />
              </div>

              {quickModalType === 'TRANSACTION' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">Amount ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      required
                      value={formAmountDollars}
                      onChange={(e) => setFormAmountDollars(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl border border-stone-300 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">Type</label>
                    <select
                      value={formCategory}
                      onChange={(e) => setFormCategory(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl border border-stone-300 text-xs bg-white"
                    >
                      <option value="EXPENSE">Expense</option>
                      <option value="INCOME">Income</option>
                    </select>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">Target Date</label>
                <input
                  type="date"
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-stone-300 text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setQuickModalType(null)}
                  className="px-4 py-2 rounded-xl border border-stone-200 text-xs font-semibold text-stone-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-xl bg-[#173D35] text-white text-xs font-semibold hover:bg-emerald-900 disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : 'Save to Family Database'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
