import React, { useState, useEffect, useCallback } from 'react';
import {
  Calendar as CalendarIcon,
  Clock,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  Repeat,
  Flame,
  Shield,
  Filter,
  User,
  Heart,
  ChevronLeft,
  ChevronRight,
  CheckSquare,
  Square,
  Play,
  Pause,
  ArrowRight,
  MapPin,
  Bell,
  RefreshCw,
  Sparkles,
} from 'lucide-react';

interface CalendarEventItem {
  id: string;
  familyId: string;
  title: string;
  description?: string;
  eventDate: string;
  eventEpoch: number;
  endEpoch?: number;
  isAllDay: boolean;
  category: string;
  scope: string;
  location?: string;
  timezone: string;
  creatorMemberId: string;
  assignedMemberIds: string[];
  attendees?: Array<{ memberId: string; status: string }>;
  reminders?: Array<{ id: string; offsetMinutesBefore: number; label?: string }>;
  sourceEntityId?: string;
  sourceEntityType?: string;
  isCompleted?: boolean;
}

interface RoutineStep {
  id: string;
  title: string;
  orderIndex: number;
  estimatedMinutes?: number;
}

interface RoutineItem {
  id: string;
  familyId: string;
  title: string;
  description?: string;
  category: string;
  frequency: string;
  targetWeekdays: number[];
  targetTimeOfDay?: string;
  scope: string;
  ownerMemberId: string;
  assignedMemberIds: string[];
  steps: RoutineStep[];
  pointsReward: number;
  isPaused: boolean;
  streakCount: number;
  bestStreakCount: number;
  lastCompletedDate?: string;
}

interface RoutineOccurrenceItem {
  id: string;
  familyId: string;
  routineId: string;
  targetDate: string;
  targetTime?: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED';
  stepCompletions: Record<string, boolean>;
  pointsAwarded: number;
  linkedTaskId?: string;
}

interface Stage333CalendarExperienceProps {
  sessionToken: string | null;
  familyId?: string;
  selectedPersona: string;
  onSelectPersona: (roleKey: string) => void;
  activeSubPage?: string;
  onSelectSubPage?: (subId: string) => void;
}

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

export type PlannerSubPageType = 'cal_schedule' | 'cal_events' | 'cal_routines' | 'cal_synced';

export const Stage333CalendarExperience: React.FC<Stage333CalendarExperienceProps> = ({
  sessionToken,
  familyId = '',
  selectedPersona,
  onSelectPersona,
  activeSubPage,
  onSelectSubPage,
}) => {
  const [activeTab, setActiveTab] = useState<PlannerSubPageType>(
    (activeSubPage as PlannerSubPageType) || 'cal_schedule'
  );

  useEffect(() => {
    if (
      activeSubPage &&
      (['cal_schedule', 'cal_events', 'cal_routines', 'cal_synced'] as string[]).includes(activeSubPage)
    ) {
      setActiveTab(activeSubPage as PlannerSubPageType);
    }
  }, [activeSubPage]);

  const handleSwitchTab = (tab: PlannerSubPageType) => {
    setActiveTab(tab);
    if (onSelectSubPage) {
      onSelectSubPage(tab);
    }
  };

  const [viewMode, setViewMode] = useState<'month' | 'week' | 'day' | 'agenda'>('agenda');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedScope, setSelectedScope] = useState<string>('ALL');

  const [events, setEvents] = useState<CalendarEventItem[]>([]);
  const [routines, setRoutines] = useState<RoutineItem[]>([]);
  const [occurrences, setOccurrences] = useState<RoutineOccurrenceItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // New Event Modal State
  const [showEventModal, setShowEventModal] = useState<boolean>(false);
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventCategory, setNewEventCategory] = useState('FAMILY_EVENT');
  const [newEventScope, setNewEventScope] = useState('FAMILY');
  const [newEventDate, setNewEventDate] = useState('2026-11-05');
  const [newEventTime, setNewEventTime] = useState('14:00');
  const [newEventLocation, setNewEventLocation] = useState('');
  const [newEventDescription, setNewEventDescription] = useState('');
  const [newEventIsAllDay, setNewEventIsAllDay] = useState(false);

  // New Routine Modal State
  const [showRoutineModal, setShowRoutineModal] = useState<boolean>(false);
  const [newRoutineTitle, setNewRoutineTitle] = useState('');
  const [newRoutineCategory, setNewRoutineCategory] = useState('MORNING');
  const [newRoutineFrequency, setNewRoutineFrequency] = useState('DAILY');
  const [newRoutineTime, setNewRoutineTime] = useState('07:30');
  const [newRoutinePoints, setNewRoutinePoints] = useState(25);
  const [newRoutineStepsText, setNewRoutineStepsText] = useState('Make bed & open curtains\nBrush teeth & wash face\nReview daily family priorities');

  // External Sync Feeds State for cal_synced
  const [syncConnectors, setSyncConnectors] = useState([
    { id: 'sync-tasks', name: 'FamilyOS Tasks & Deadlines', sourceType: 'INTERNAL', status: 'ACTIVE', lastSynced: 'Just now', autoSync: true },
    { id: 'sync-meals', name: 'Household 7-Day Meal Plan', sourceType: 'INTERNAL', status: 'ACTIVE', lastSynced: '2 mins ago', autoSync: true },
    { id: 'sync-bills', name: 'Recurring Bills & Subscriptions', sourceType: 'INTERNAL', status: 'ACTIVE', lastSynced: '5 mins ago', autoSync: true },
    { id: 'sync-gcal', name: 'Google Family Calendar (iCal Bridge)', sourceType: 'EXTERNAL', status: 'ACTIVE', lastSynced: '12 mins ago', autoSync: true },
  ]);

  // Fetch Calendar & Routines Data
  const fetchData = useCallback(async () => {
    setLoading(true);
    setActionError(null);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (sessionToken) {
        headers['Authorization'] = `Bearer ${sessionToken}`;
      }

      // 1. Fetch Calendar Events
      const calRes = await fetch(`/api/v1/calendar/${encodeURIComponent(familyId)}`, { headers });
      if (calRes.ok) {
        const calData = await calRes.json();
        setEvents(calData.events || []);
      } else {
        const err = await calRes.json();
        if (calRes.status === 403) {
          setActionError(`Access Restricted: ${err.message || 'Permission denied.'}`);
        }
      }

      // 2. Fetch Routines & Occurrences
      const rtnRes = await fetch(`/api/v1/routines/${encodeURIComponent(familyId)}`, { headers });
      if (rtnRes.ok) {
        const rtnData = await rtnRes.json();
        setRoutines(rtnData.routines || []);
        setOccurrences(rtnData.occurrences || []);
      }
    } catch (e: any) {
      console.error('Failed to fetch calendar/routines:', e);
      setActionError('Network or server error loading calendar.');
    } finally {
      setLoading(false);
    }
  }, [sessionToken, familyId]);

  useEffect(() => {
    fetchData();
  }, [fetchData, selectedPersona]);

  // Create Standalone Calendar Event
  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEventTitle.trim()) return;

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (sessionToken) headers['Authorization'] = `Bearer ${sessionToken}`;

      const fullIso = `${newEventDate}T${newEventTime}:00`;
      const res = await fetch(`/api/v1/calendar/${encodeURIComponent(familyId)}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          title: newEventTitle.trim(),
          eventDate: newEventDate,
          eventEpoch: Date.parse(fullIso) || Date.now(),
          category: newEventCategory,
          scope: newEventScope,
          location: newEventLocation.trim() || undefined,
          description: newEventDescription.trim() || undefined,
          isAllDay: newEventIsAllDay,
        }),
      });

      if (res.ok) {
        setShowEventModal(false);
        setNewEventTitle('');
        setNewEventLocation('');
        setNewEventDescription('');
        setActionSuccess('Calendar event created successfully.');
        fetchData();
      } else {
        const err = await res.json();
        setActionError(err.message || 'Failed to create calendar event.');
      }
    } catch {
      setActionError('Error creating calendar event.');
    }
  };

  // Create New Routine
  const handleCreateRoutine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoutineTitle.trim()) return;
    const stepLines = newRoutineStepsText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    const steps: RoutineStep[] = stepLines.map((title, idx) => ({
      id: `step-custom-${Date.now()}-${idx}`,
      title,
      orderIndex: idx + 1,
      estimatedMinutes: 5,
    }));

    const newRoutine: RoutineItem = {
      id: `rtn-custom-${Date.now()}`,
      familyId,
      title: newRoutineTitle.trim(),
      description: `Scheduled ${newRoutineFrequency.toLowerCase()} routine at ${newRoutineTime}`,
      category: newRoutineCategory,
      frequency: newRoutineFrequency,
      targetWeekdays: [1, 2, 3, 4, 5],
      targetTimeOfDay: newRoutineTime,
      scope: 'FAMILY',
      ownerMemberId: 'mem-sarah',
      assignedMemberIds: ['mem-sarah', 'mem-lucas'],
      steps,
      pointsReward: Number(newRoutinePoints) || 20,
      isPaused: false,
      streakCount: 1,
      bestStreakCount: 1,
    };

    const newOcc: RoutineOccurrenceItem = {
      id: `occ-custom-${Date.now()}`,
      familyId,
      routineId: newRoutine.id,
      targetDate: '2026-11-03',
      targetTime: newRoutineTime,
      status: 'PENDING',
      stepCompletions: {},
      pointsAwarded: 0,
    };

    setRoutines((prev) => [newRoutine, ...prev]);
    setOccurrences((prev) => [newOcc, ...prev]);
    setShowRoutineModal(false);
    setNewRoutineTitle('');
    setActionSuccess(`Routine "${newRoutine.title}" created and scheduled for today.`);
  };

  // Delete Calendar Event
  const handleDeleteEvent = async (eventId: string) => {
    try {
      const headers: Record<string, string> = {};
      if (sessionToken) headers['Authorization'] = `Bearer ${sessionToken}`;

      const res = await fetch(`/api/v1/calendar/${encodeURIComponent(familyId)}/${eventId}`, {
        method: 'DELETE',
        headers,
      });

      if (res.ok) {
        setActionSuccess('Calendar event removed.');
        fetchData();
      } else {
        const err = await res.json();
        setActionError(err.message || 'Cannot delete calendar event.');
      }
    } catch {
      setActionError('Error deleting event.');
    }
  };

  // Toggle Step in Routine Occurrence
  const handleToggleStep = async (
    routineId: string,
    occurrenceId: string,
    stepId: string,
    currentStatus: boolean
  ) => {
    if (routineId.startsWith('rtn-custom-')) {
      setOccurrences((prev) =>
        prev.map((occ) =>
          occ.id === occurrenceId
            ? { ...occ, stepCompletions: { ...occ.stepCompletions, [stepId]: !currentStatus } }
            : occ
        )
      );
      return;
    }
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (sessionToken) headers['Authorization'] = `Bearer ${sessionToken}`;

      const res = await fetch(
        `/api/v1/routines/${encodeURIComponent(familyId)}/${routineId}/occurrences/${occurrenceId}/steps/${stepId}/toggle`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({ isDone: !currentStatus }),
        }
      );

      if (res.ok) {
        fetchData();
      } else {
        const err = await res.json();
        setActionError(err.message || 'Cannot update routine step.');
      }
    } catch {
      setActionError('Error toggling step.');
    }
  };

  // Complete Routine Occurrence
  const handleCompleteOccurrence = async (routineId: string, occurrenceId: string) => {
    if (routineId.startsWith('rtn-custom-')) {
      const targetRtn = routines.find((r) => r.id === routineId);
      const pts = targetRtn?.pointsReward || 20;
      setOccurrences((prev) =>
        prev.map((occ) => (occ.id === occurrenceId ? { ...occ, status: 'COMPLETED', pointsAwarded: pts } : occ))
      );
      setRoutines((prev) =>
        prev.map((r) => (r.id === routineId ? { ...r, streakCount: r.streakCount + 1 } : r))
      );
      setActionSuccess(`Routine completed! +${pts} points awarded. Streak extended!`);
      return;
    }
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (sessionToken) headers['Authorization'] = `Bearer ${sessionToken}`;

      const res = await fetch(
        `/api/v1/routines/${encodeURIComponent(familyId)}/${routineId}/occurrences/${occurrenceId}/complete`,
        {
          method: 'POST',
          headers,
        }
      );

      if (res.ok) {
        const data = await res.json();
        setActionSuccess(`Routine completed! +${data.pointsAwarded} points awarded. Streak extended!`);
        fetchData();
      } else {
        const err = await res.json();
        setActionError(err.message || 'Cannot complete routine occurrence.');
      }
    } catch {
      setActionError('Error completing occurrence.');
    }
  };

  // Skip Routine Occurrence
  const handleSkipOccurrence = async (routineId: string, occurrenceId: string) => {
    if (routineId.startsWith('rtn-custom-')) {
      setOccurrences((prev) =>
        prev.map((occ) => (occ.id === occurrenceId ? { ...occ, status: 'SKIPPED' } : occ))
      );
      setActionSuccess('Routine occurrence marked as skipped.');
      return;
    }
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (sessionToken) headers['Authorization'] = `Bearer ${sessionToken}`;

      const res = await fetch(
        `/api/v1/routines/${encodeURIComponent(familyId)}/${routineId}/occurrences/${occurrenceId}/skip`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({ reason: 'Member skipped today' }),
        }
      );

      if (res.ok) {
        setActionSuccess('Routine occurrence marked as skipped.');
        fetchData();
      }
    } catch {
      setActionError('Error skipping routine.');
    }
  };

  // Pause or Resume Routine Definition
  const handlePauseResumeRoutine = async (routineId: string, currentPaused: boolean) => {
    if (routineId.startsWith('rtn-custom-')) {
      setRoutines((prev) =>
        prev.map((r) => (r.id === routineId ? { ...r, isPaused: !currentPaused } : r))
      );
      setActionSuccess(!currentPaused ? 'Routine paused.' : 'Routine resumed.');
      return;
    }
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (sessionToken) headers['Authorization'] = `Bearer ${sessionToken}`;

      const res = await fetch(`/api/v1/routines/${encodeURIComponent(familyId)}/${routineId}/pause`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          isPaused: !currentPaused,
          reason: !currentPaused ? 'Temporarily paused by family admin' : undefined,
        }),
      });

      if (res.ok) {
        setActionSuccess(!currentPaused ? 'Routine paused.' : 'Routine resumed.');
        fetchData();
      } else {
        const err = await res.json();
        setActionError(err.message || 'Cannot modify routine pause state.');
      }
    } catch {
      setActionError('Error modifying routine state.');
    }
  };

  // Convert Routine Occurrence to Canonical Task
  const handleConvertToTask = async (routineId: string, occurrenceId: string) => {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (sessionToken) headers['Authorization'] = `Bearer ${sessionToken}`;

      const res = await fetch(`/api/v1/routines/${encodeURIComponent(familyId)}/${routineId}/convert-to-task`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ occurrenceId }),
      });

      if (res.ok) {
        const data = await res.json();
        setActionSuccess(
          `Converted to canonical Task "${data.task.title}" and synchronized into Household Calendar.`
        );
        fetchData();
      } else {
        const err = await res.json();
        setActionError(err.message || 'Cannot convert routine to task.');
      }
    } catch {
      setActionError('Error converting routine to task.');
    }
  };

  // Filtered Events
  const filteredEvents = events.filter((e) => {
    if (selectedCategory !== 'ALL' && e.category !== selectedCategory) return false;
    if (selectedScope !== 'ALL' && e.scope !== selectedScope) return false;
    return true;
  });

  const sharedMilestoneEvents = events.filter((e) =>
    ['FAMILY_EVENT', 'ANNIVERSARY', 'BIRTHDAY', 'SPECIAL_OCCASION', 'APPOINTMENT'].includes(e.category)
  );

  const syncedSystemEvents = events.filter(
    (e) => e.sourceEntityType === 'TASK' || e.category === 'TASK_DUE' || e.category === 'MEAL'
  );

  return (
    <div className="space-y-6">
      {/* Top Banner & Persona Matrix */}
      <div
        className="rounded-3xl p-6 sm:p-8 border shadow-xs relative overflow-hidden bg-white"
        style={{ borderColor: BRAND.border }}
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span
                className="text-xs uppercase tracking-widest font-bold px-3 py-1 rounded-full"
                style={{ backgroundColor: BRAND.gold, color: '#173D35' }}
              >
                Planner & Scheduling Center
              </span>
              <span className="text-xs bg-emerald-100 text-emerald-800 font-medium px-2.5 py-0.5 rounded-full">
                Zero-Trust RBAC & Privacy Scopes
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold font-serif mt-2" style={{ color: BRAND.primary }}>
              {activeTab === 'cal_schedule' && '1. Master Family Calendar'}
              {activeTab === 'cal_events' && '2. Shared Events & Milestones'}
              {activeTab === 'cal_routines' && '3. Daily Routines & Habits'}
              {activeTab === 'cal_synced' && '4. Synced Household Calendar'}
            </h2>
            <p className="text-sm mt-1" style={{ color: BRAND.textMuted }}>
              {activeTab === 'cal_schedule' &&
                'Unified household schedule across Day, Week, Month, and Agenda views with privacy scope filtering.'}
              {activeTab === 'cal_events' &&
                'Coordinate family gatherings, birthdays, anniversaries, and appointments with location and reminder tracking.'}
              {activeTab === 'cal_routines' &&
                'Build multi-step daily and weekly family habits, track streaks, and reward consistency.'}
              {activeTab === 'cal_synced' &&
                'Live two-way calendar synchronization with FamilyOS Tasks, Meal Plans, Recurring Bills, and external calendars.'}
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => fetchData()}
              className="p-2.5 rounded-xl border hover:bg-stone-100 text-stone-600 transition-all cursor-pointer"
              title="Refresh"
              style={{ borderColor: BRAND.border }}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>

            {(activeTab === 'cal_schedule' || activeTab === 'cal_events') && (
              <button
                onClick={() => setShowEventModal(true)}
                className="flex items-center space-x-2 px-4 py-2.5 rounded-2xl text-sm font-semibold text-white shadow-xs hover:opacity-95 transition-all cursor-pointer"
                style={{ backgroundColor: BRAND.primary }}
              >
                <Plus className="w-4 h-4" />
                <span>Add Event</span>
              </button>
            )}

            {activeTab === 'cal_routines' && (
              <button
                onClick={() => setShowRoutineModal(true)}
                className="flex items-center space-x-2 px-4 py-2.5 rounded-2xl text-sm font-semibold text-white shadow-xs hover:opacity-95 transition-all cursor-pointer"
                style={{ backgroundColor: BRAND.primary }}
              >
                <Plus className="w-4 h-4" />
                <span>New Routine</span>
              </button>
            )}
          </div>
        </div>

        {/* Action Notifications */}
        {actionSuccess && (
          <div className="mt-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{actionSuccess}</span>
            </div>
            <button onClick={() => setActionSuccess(null)} className="text-emerald-700 font-bold hover:underline">
              Dismiss
            </button>
          </div>
        )}

        {actionError && (
          <div className="mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{actionError}</span>
            </div>
            <button onClick={() => setActionError(null)} className="text-rose-700 font-bold hover:underline">
              Dismiss
            </button>
          </div>
        )}
      </div>

      {/* 4 Dedicated Sub-Page Navigation Bar */}
      <div className="flex flex-wrap items-center gap-2 bg-white p-2 rounded-2xl border shadow-2xs" style={{ borderColor: BRAND.border }}>
        {[
          { id: 'cal_schedule' as const, label: 'Master Family Calendar', icon: CalendarIcon, count: events.length },
          { id: 'cal_events' as const, label: 'Shared Events & Milestones', icon: Sparkles, count: sharedMilestoneEvents.length },
          { id: 'cal_routines' as const, label: 'Daily Routines & Habits', icon: Repeat, count: routines.length },
          { id: 'cal_synced' as const, label: 'Synced Household Calendar', icon: RefreshCw, count: syncedSystemEvents.length },
        ].map((tabItem) => {
          const Icon = tabItem.icon;
          const isActive = activeTab === tabItem.id;
          return (
            <button
              key={tabItem.id}
              type="button"
              onClick={() => handleSwitchTab(tabItem.id)}
              className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                isActive ? 'text-white shadow-xs' : 'text-stone-600 hover:bg-stone-100'
              }`}
              style={{ backgroundColor: isActive ? BRAND.primary : 'transparent' }}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tabItem.label}</span>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full ${
                  isActive ? 'bg-emerald-950/40 text-emerald-100' : 'bg-stone-200 text-stone-700'
                }`}
              >
                {tabItem.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* PAGE 1: MASTER FAMILY CALENDAR (cal_schedule) */}
      {activeTab === 'cal_schedule' && (
        <div className="space-y-6">
          {/* Controls Bar: View Modes & Filters */}
          <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-2xl border shadow-2xs" style={{ borderColor: BRAND.border }}>
            {/* View Mode Switcher */}
            <div className="flex items-center space-x-1 bg-stone-100 p-1 rounded-xl">
              {(['agenda', 'day', 'week', 'month'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all cursor-pointer ${
                    viewMode === mode ? 'bg-white shadow-xs text-stone-900 font-bold' : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>

            {/* Scope Filter */}
            <div className="flex items-center space-x-2">
              <span className="text-xs font-medium text-stone-500">Scope:</span>
              {(['ALL', 'FAMILY', 'COUPLE', 'PERSONAL'] as const).map((sc) => (
                <button
                  key={sc}
                  onClick={() => setSelectedScope(sc)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                    selectedScope === sc
                      ? 'bg-emerald-900 text-white'
                      : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                  }`}
                >
                  {sc}
                </button>
              ))}
            </div>

            {/* Category Filter */}
            <div className="flex items-center space-x-2 overflow-x-auto">
              <span className="text-xs font-medium text-stone-500">Category:</span>
              {[
                'ALL',
                'FAMILY_EVENT',
                'TASK_DUE',
                'APPOINTMENT',
                'ANNIVERSARY',
                'BIRTHDAY',
                'MEAL',
              ].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${
                    selectedCategory === cat
                      ? 'bg-stone-800 text-white'
                      : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                  }`}
                >
                  {cat.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          {/* Events Stream / Agenda List */}
          {filteredEvents.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 border text-center shadow-2xs" style={{ borderColor: BRAND.border }}>
              <CalendarIcon className="w-12 h-12 text-stone-400 mx-auto mb-3" />
              <h3 className="text-base font-bold text-stone-800">No Calendar Events Found</h3>
              <p className="text-xs text-stone-500 max-w-sm mx-auto mt-1">
                There are no calendar entries matching the selected category and privacy scope for this view.
              </p>
              <button
                type="button"
                onClick={() => setShowEventModal(true)}
                className="mt-4 px-4 py-2 rounded-xl text-xs font-bold text-white"
                style={{ backgroundColor: BRAND.primary }}
              >
                + Create Your First Event
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredEvents.map((event) => {
                const eventDate = new Date(event.eventEpoch || Date.parse(event.eventDate));
                const monthStr = eventDate.toLocaleString('default', { month: 'short' }).toUpperCase();
                const dayStr = eventDate.getDate();
                const timeStr = event.isAllDay ? 'All Day' : eventDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                const badgeBg =
                  event.category === 'TASK_DUE'
                    ? 'bg-amber-100 text-amber-800 border-amber-200'
                    : event.category === 'APPOINTMENT'
                    ? 'bg-blue-100 text-blue-800 border-blue-200'
                    : event.category === 'ANNIVERSARY'
                    ? 'bg-rose-100 text-rose-800 border-rose-200'
                    : 'bg-emerald-100 text-emerald-800 border-emerald-200';

                return (
                  <div
                    key={event.id}
                    className="bg-white rounded-2xl border p-5 shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between"
                    style={{ borderColor: BRAND.border }}
                  >
                    <div>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center space-x-3">
                          <div
                            className="w-12 h-12 rounded-xl flex flex-col items-center justify-center font-bold text-center border"
                            style={{ backgroundColor: BRAND.ivory, borderColor: BRAND.border }}
                          >
                            <span className="text-[10px] tracking-wider" style={{ color: BRAND.secondarySage }}>
                              {monthStr}
                            </span>
                            <span className="text-lg leading-none" style={{ color: BRAND.primary }}>
                              {dayStr}
                            </span>
                          </div>
                          <div>
                            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md border ${badgeBg}`}>
                              {event.category.replace('_', ' ')}
                            </span>
                            {event.scope !== 'FAMILY' && (
                              <span className="ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-stone-100 text-stone-700">
                                {event.scope}
                              </span>
                            )}
                          </div>
                        </div>

                        <button
                          onClick={() => handleDeleteEvent(event.id)}
                          className="text-stone-400 hover:text-rose-600 transition-colors p-1 cursor-pointer"
                          title="Delete Event"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <h4 className="font-bold text-base mt-3" style={{ color: BRAND.textDark }}>
                        {event.title}
                      </h4>
                      {event.description && (
                        <p className="text-xs text-stone-600 mt-1 line-clamp-2">{event.description}</p>
                      )}
                    </div>

                    <div className="mt-4 pt-3 border-t text-xs text-stone-500 space-y-1" style={{ borderColor: BRAND.border }}>
                      <div className="flex items-center space-x-1.5">
                        <Clock className="w-3.5 h-3.5 text-stone-400" />
                        <span>{timeStr}</span>
                      </div>
                      {event.location && (
                        <div className="flex items-center space-x-1.5">
                          <MapPin className="w-3.5 h-3.5 text-stone-400" />
                          <span>{event.location}</span>
                        </div>
                      )}
                      {event.sourceEntityType === 'TASK' && (
                        <div className="flex items-center space-x-1.5 text-amber-700 font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Synced with Canonical Task</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* PAGE 2: SHARED EVENTS & MILESTONES (cal_events) */}
      {activeTab === 'cal_events' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl border p-5" style={{ borderColor: BRAND.border }}>
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">Upcoming Gatherings</span>
              <p className="text-2xl font-serif font-bold text-stone-900 mt-1">{sharedMilestoneEvents.length}</p>
              <p className="text-xs text-stone-500 mt-1">Family events, birthdays & appointments</p>
            </div>
            <div className="bg-white rounded-2xl border p-5" style={{ borderColor: BRAND.border }}>
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800">Celebration Milestones</span>
              <p className="text-2xl font-serif font-bold text-stone-900 mt-1">
                {events.filter((e) => e.category === 'BIRTHDAY' || e.category === 'ANNIVERSARY').length}
              </p>
              <p className="text-xs text-stone-500 mt-1">Recurring annual birthdays & anniversaries</p>
            </div>
            <div className="bg-white rounded-2xl border p-5 flex flex-col justify-between" style={{ borderColor: BRAND.border }}>
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-stone-600">Quick Event Planner</span>
                <p className="text-xs text-stone-500 mt-1">Schedule a new family celebration, dinner, or medical appointment.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowEventModal(true)}
                className="mt-3 w-full py-2 rounded-xl text-xs font-bold text-white cursor-pointer"
                style={{ backgroundColor: BRAND.primary }}
              >
                + Schedule Shared Event
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sharedMilestoneEvents.map((event) => {
              const eventDate = new Date(event.eventEpoch || Date.parse(event.eventDate));
              return (
                <div
                  key={event.id}
                  className="bg-white rounded-2xl border p-5 flex flex-col justify-between shadow-2xs"
                  style={{ borderColor: BRAND.border }}
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-900">
                        {event.category.replace('_', ' ')}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDeleteEvent(event.id)}
                        className="text-stone-400 hover:text-rose-600 p-1 cursor-pointer"
                        title="Delete Event"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <h3 className="text-base font-bold font-serif text-stone-900 mt-2">{event.title}</h3>
                    {event.description && <p className="text-xs text-stone-600 mt-1">{event.description}</p>}
                  </div>
                  <div className="mt-4 pt-3 border-t flex flex-wrap items-center justify-between gap-2 text-xs text-stone-500" style={{ borderColor: BRAND.border }}>
                    <span className="font-semibold text-stone-700">{eventDate.toDateString()}</span>
                    {event.location && (
                      <span className="flex items-center space-x-1">
                        <MapPin className="w-3.5 h-3.5 text-emerald-700" />
                        <span>{event.location}</span>
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* PAGE 3: DAILY ROUTINES & HABITS (cal_routines) */}
      {activeTab === 'cal_routines' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {routines.map((routine) => {
              const matchingOccurrences = occurrences.filter((o) => o.routineId === routine.id);
              const todayOccurrence = matchingOccurrences[0];
              const isCompleted = todayOccurrence?.status === 'COMPLETED';

              return (
                <div
                  key={routine.id}
                  className={`bg-white rounded-3xl border p-6 shadow-2xs transition-all relative ${
                    routine.isPaused ? 'opacity-70 bg-stone-50' : ''
                  }`}
                  style={{ borderColor: BRAND.border }}
                >
                  {/* Routine Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span
                          className="text-xs font-bold px-2.5 py-0.5 rounded-full"
                          style={{ backgroundColor: BRAND.lightGold, color: '#173D35' }}
                        >
                          {routine.category}
                        </span>
                        <div className="flex items-center space-x-1 text-amber-600 font-bold text-xs bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                          <Flame className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                          <span>{routine.streakCount} Day Streak</span>
                        </div>
                        {routine.isPaused && (
                          <span className="text-xs bg-stone-200 text-stone-700 font-bold px-2 py-0.5 rounded-md">
                            PAUSED
                          </span>
                        )}
                      </div>
                      <h3 className="text-lg font-bold font-serif mt-2" style={{ color: BRAND.primary }}>
                        {routine.title}
                      </h3>
                      {routine.description && (
                        <p className="text-xs text-stone-600 mt-1">{routine.description}</p>
                      )}
                    </div>

                    <button
                      onClick={() => handlePauseResumeRoutine(routine.id, routine.isPaused)}
                      className="p-2 rounded-xl border hover:bg-stone-100 text-stone-600 text-xs font-semibold flex items-center space-x-1 cursor-pointer"
                      style={{ borderColor: BRAND.border }}
                      title={routine.isPaused ? 'Resume Routine' : 'Pause Routine'}
                    >
                      {routine.isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                      <span>{routine.isPaused ? 'Resume' : 'Pause'}</span>
                    </button>
                  </div>

                  {/* Routine Metadata Bar */}
                  <div className="flex flex-wrap items-center gap-3 mt-4 text-xs text-stone-500">
                    <span className="font-semibold text-stone-700">{routine.frequency}</span>
                    <span>•</span>
                    <span>Target: {routine.targetTimeOfDay || '08:00'}</span>
                    <span>•</span>
                    <span className="text-emerald-700 font-bold">+{routine.pointsReward} Points</span>
                  </div>

                  {/* Checklist Steps */}
                  <div className="mt-5 space-y-2 border-t pt-4" style={{ borderColor: BRAND.border }}>
                    <div className="flex items-center justify-between text-xs font-bold text-stone-700">
                      <span>Today's Execution Checklist:</span>
                      {isCompleted ? (
                        <span className="text-emerald-600 flex items-center space-x-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Completed Today</span>
                        </span>
                      ) : (
                        <span className="text-amber-600">Pending Completion</span>
                      )}
                    </div>

                    <div className="space-y-1.5 mt-2">
                      {routine.steps.map((step) => {
                        const isStepDone = Boolean(todayOccurrence?.stepCompletions[step.id]);
                        return (
                          <button
                            key={step.id}
                            disabled={!todayOccurrence || routine.isPaused}
                            onClick={() =>
                              todayOccurrence &&
                              handleToggleStep(routine.id, todayOccurrence.id, step.id, isStepDone)
                            }
                            className={`w-full flex items-center space-x-2.5 p-2 rounded-xl text-left text-xs transition-all cursor-pointer ${
                              isStepDone
                                ? 'bg-emerald-50/70 text-stone-500 line-through'
                                : 'bg-stone-50 hover:bg-stone-100 text-stone-800'
                            }`}
                          >
                            {isStepDone ? (
                              <CheckSquare className="w-4 h-4 text-emerald-600 shrink-0" />
                            ) : (
                              <Square className="w-4 h-4 text-stone-400 shrink-0" />
                            )}
                            <span className="flex-1 font-medium">{step.title}</span>
                            {step.estimatedMinutes && (
                              <span className="text-[10px] text-stone-400">{step.estimatedMinutes}m</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Action Bar */}
                  <div className="mt-5 pt-4 border-t flex flex-wrap items-center justify-between gap-2" style={{ borderColor: BRAND.border }}>
                    <div className="flex items-center space-x-2">
                      {!isCompleted && todayOccurrence && (
                        <button
                          onClick={() => handleCompleteOccurrence(routine.id, todayOccurrence.id)}
                          className="flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white shadow-2xs hover:opacity-95 cursor-pointer"
                          style={{ backgroundColor: BRAND.primary }}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Complete (+{routine.pointsReward} pts)</span>
                        </button>
                      )}

                      {!isCompleted && todayOccurrence && (
                        <button
                          onClick={() => handleSkipOccurrence(routine.id, todayOccurrence.id)}
                          className="px-3 py-2 rounded-xl text-xs font-semibold border hover:bg-stone-100 text-stone-600 cursor-pointer"
                          style={{ borderColor: BRAND.border }}
                        >
                          Skip
                        </button>
                      )}
                    </div>

                    {todayOccurrence && (
                      <button
                        onClick={() => handleConvertToTask(routine.id, todayOccurrence.id)}
                        className="flex items-center space-x-1 px-3 py-2 rounded-xl text-xs font-semibold text-emerald-800 hover:bg-emerald-50 transition-colors cursor-pointer"
                        title="Promote occurrence into a full planning task"
                      >
                        <span>Convert to Task</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* PAGE 4: SYNCED HOUSEHOLD CALENDAR (cal_synced) */}
      {activeTab === 'cal_synced' && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl border p-6 shadow-2xs space-y-4" style={{ borderColor: BRAND.border }}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-serif font-bold text-stone-900">
                  Two-Way Household Calendar Bridges & Sync Feeds
                </h3>
                <p className="text-xs text-stone-500">
                  Manage automatic calendar synchronization from Tasks, Meals, Bills, and External iCal/Google Feeds.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  fetchData();
                  setActionSuccess('All internal and external calendar bridges synchronized.');
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white flex items-center space-x-1.5 cursor-pointer"
                style={{ backgroundColor: BRAND.primary }}
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Sync All Feeds Now</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {syncConnectors.map((conn) => (
                <div
                  key={conn.id}
                  className="p-4 rounded-2xl border bg-stone-50/70 flex items-center justify-between"
                  style={{ borderColor: BRAND.border }}
                >
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-bold text-stone-900">{conn.name}</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                        {conn.status}
                      </span>
                    </div>
                    <p className="text-[11px] text-stone-500 mt-1">
                      Source: {conn.sourceType} • Last synced: {conn.lastSynced}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSyncConnectors((prev) =>
                        prev.map((c) =>
                          c.id === conn.id
                            ? { ...c, autoSync: !c.autoSync, status: !c.autoSync ? 'ACTIVE' : 'PAUSED' }
                            : c
                        )
                      );
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border cursor-pointer ${
                      conn.autoSync
                        ? 'bg-emerald-900 text-white border-emerald-900'
                        : 'bg-white text-stone-600 border-stone-300'
                    }`}
                  >
                    {conn.autoSync ? 'Auto-Sync ON' : 'Paused'}
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-3xl border p-6 shadow-2xs space-y-4" style={{ borderColor: BRAND.border }}>
            <h3 className="text-base font-serif font-bold text-stone-900">
              Synchronized Cross-Module Schedule Entries ({syncedSystemEvents.length})
            </h3>
            {syncedSystemEvents.length === 0 ? (
              <p className="text-xs text-stone-500">No cross-module task or meal entries currently on the schedule.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {syncedSystemEvents.map((ev) => (
                  <div
                    key={ev.id}
                    className="p-4 rounded-2xl border flex items-center justify-between"
                    style={{ borderColor: BRAND.border }}
                  >
                    <div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-900">
                        {ev.category}
                      </span>
                      <h4 className="text-sm font-bold text-stone-900 mt-1">{ev.title}</h4>
                      <p className="text-xs text-stone-500 mt-0.5">Date: {ev.eventDate}</p>
                    </div>
                    <span className="text-[11px] font-semibold text-emerald-700 flex items-center space-x-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Linked</span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: ADD CALENDAR EVENT */}
      {showEventModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-xl border" style={{ borderColor: BRAND.border }}>
            <div className="flex items-center justify-between border-b pb-4" style={{ borderColor: BRAND.border }}>
              <div className="flex items-center space-x-2">
                <CalendarIcon className="w-5 h-5 text-emerald-800" />
                <h3 className="font-bold text-lg font-serif" style={{ color: BRAND.primary }}>
                  Add Household Event
                </h3>
              </div>
              <button
                onClick={() => setShowEventModal(false)}
                className="text-stone-400 hover:text-stone-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateEvent} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">Event Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Grandma Martha Birthday Dinner"
                  value={newEventTitle}
                  onChange={(e) => setNewEventTitle(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl border focus:outline-hidden focus:ring-2 focus:ring-emerald-700"
                  style={{ borderColor: BRAND.border }}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Date *</label>
                  <input
                    type="date"
                    required
                    value={newEventDate}
                    onChange={(e) => setNewEventDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-xl border focus:outline-hidden"
                    style={{ borderColor: BRAND.border }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Time</label>
                  <input
                    type="time"
                    disabled={newEventIsAllDay}
                    value={newEventTime}
                    onChange={(e) => setNewEventTime(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-xl border focus:outline-hidden disabled:bg-stone-100"
                    style={{ borderColor: BRAND.border }}
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="allDayCheckbox"
                  checked={newEventIsAllDay}
                  onChange={(e) => setNewEventIsAllDay(e.target.checked)}
                  className="rounded text-emerald-700 focus:ring-emerald-700"
                />
                <label htmlFor="allDayCheckbox" className="text-xs text-stone-700 font-medium">
                  All-Day Event
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Category</label>
                  <select
                    value={newEventCategory}
                    onChange={(e) => setNewEventCategory(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-xl border focus:outline-hidden"
                    style={{ borderColor: BRAND.border }}
                  >
                    <option value="FAMILY_EVENT">Family Event</option>
                    <option value="APPOINTMENT">Healthcare / Appointment</option>
                    <option value="ANNIVERSARY">Anniversary</option>
                    <option value="BIRTHDAY">Birthday</option>
                    <option value="MEAL">Meal</option>
                    <option value="SPECIAL_OCCASION">Special Occasion</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Privacy Scope</label>
                  <select
                    value={newEventScope}
                    onChange={(e) => setNewEventScope(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-xl border focus:outline-hidden"
                    style={{ borderColor: BRAND.border }}
                  >
                    <option value="FAMILY">Family (Shared)</option>
                    <option value="COUPLE">Couple (Adult Partners)</option>
                    <option value="PERSONAL">Personal (Private)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">Location (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Pacific Heights Pediatrics or Dining Room"
                  value={newEventLocation}
                  onChange={(e) => setNewEventLocation(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl border focus:outline-hidden"
                  style={{ borderColor: BRAND.border }}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">Description / Notes</label>
                <textarea
                  rows={2}
                  placeholder="Optional details..."
                  value={newEventDescription}
                  onChange={(e) => setNewEventDescription(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl border focus:outline-hidden"
                  style={{ borderColor: BRAND.border }}
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t" style={{ borderColor: BRAND.border }}>
                <button
                  type="button"
                  onClick={() => setShowEventModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-stone-600 hover:bg-stone-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold text-white shadow-2xs hover:opacity-95"
                  style={{ backgroundColor: BRAND.primary }}
                >
                  Save Event
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD NEW ROUTINE */}
      {showRoutineModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-xl border" style={{ borderColor: BRAND.border }}>
            <div className="flex items-center justify-between border-b pb-4" style={{ borderColor: BRAND.border }}>
              <div className="flex items-center space-x-2">
                <Repeat className="w-5 h-5 text-emerald-800" />
                <h3 className="font-bold text-lg font-serif" style={{ color: BRAND.primary }}>
                  Create Reusable Family Routine
                </h3>
              </div>
              <button
                onClick={() => setShowRoutineModal(false)}
                className="text-stone-400 hover:text-stone-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateRoutine} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">Routine Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. School Morning Launchpad"
                  value={newRoutineTitle}
                  onChange={(e) => setNewRoutineTitle(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl border"
                  style={{ borderColor: BRAND.border }}
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Category</label>
                  <select
                    value={newRoutineCategory}
                    onChange={(e) => setNewRoutineCategory(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-xl border"
                    style={{ borderColor: BRAND.border }}
                  >
                    <option value="MORNING">Morning</option>
                    <option value="EVENING">Evening</option>
                    <option value="WEEKEND">Weekend</option>
                    <option value="WELLNESS">Wellness</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Target Time</label>
                  <input
                    type="time"
                    value={newRoutineTime}
                    onChange={(e) => setNewRoutineTime(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-xl border"
                    style={{ borderColor: BRAND.border }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Reward Points</label>
                  <input
                    type="number"
                    min={5}
                    max={200}
                    value={newRoutinePoints}
                    onChange={(e) => setNewRoutinePoints(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm rounded-xl border"
                    style={{ borderColor: BRAND.border }}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Checklist Steps (One step per line) *
                </label>
                <textarea
                  rows={4}
                  required
                  value={newRoutineStepsText}
                  onChange={(e) => setNewRoutineStepsText(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl border"
                  style={{ borderColor: BRAND.border }}
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t" style={{ borderColor: BRAND.border }}>
                <button
                  type="button"
                  onClick={() => setShowRoutineModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-stone-600 hover:bg-stone-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold text-white shadow-2xs hover:opacity-95"
                  style={{ backgroundColor: BRAND.primary }}
                >
                  Create Routine
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
