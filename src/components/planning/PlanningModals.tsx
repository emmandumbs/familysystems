import React, { useState, useEffect } from 'react';
import {
  X,
  Plus,
  Check,
  Trash2,
  Edit2,
  ListChecks,
  AlertTriangle,
  FolderTree,
  Layers,
  Flag,
  ArrowUp,
  ArrowDown,
  BookmarkPlus,
  Sparkles,
  Calendar,
  User,
} from 'lucide-react';

export interface PlanningGoalItem {
  id: string;
  familyId: string;
  title: string;
  description: string;
  category: string;
  scope: 'PERSONAL' | 'COUPLE' | 'FAMILY';
  horizon: 'SHORT_TERM' | 'LONG_TERM';
  isMeasurable: boolean;
  metricUnit: string | null;
  targetValue: number | null;
  currentValue: number | null;
  budgetCents?: number;
  currentCents?: number;
  startDate: string | null;
  targetDate: string | null;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  ownerMemberId: string;
  ownerName: string;
  status: 'NOT_STARTED' | 'ACTIVE' | 'ON_HOLD' | 'COMPLETED' | 'ARCHIVED';
  progressPercentage: number;
}

export interface PlanningProjectItem {
  id: string;
  familyId: string;
  goalId: string | null;
  title: string;
  name?: string;
  description: string;
  ownerMemberId: string;
  assignedMemberIds: string[];
  scope: 'PERSONAL' | 'SHARED';
  startDate: string | null;
  targetDate: string | null;
  status: 'PLANNING' | 'ACTIVE' | 'ON_HOLD' | 'COMPLETED' | 'ARCHIVED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  budgetCents?: number;
  progressPercentage: number;
}

export interface PlanningChecklistItem {
  id: string;
  taskId: string;
  title: string;
  isDone: boolean;
  position: number;
  assignedMemberId: string | null;
  completedAt: number | null;
}

export interface PlanningTaskItem {
  id: string;
  familyId: string;
  title: string;
  description: string;
  creatorMemberId: string;
  assignedMemberId: string | null;
  assignedToName: string;
  scope: 'PERSONAL' | 'SHARED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  status: 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'BLOCKED' | 'COMPLETED' | 'ARCHIVED';
  isCompleted: boolean;
  startDate: string | null;
  dueDate: string | null;
  goalId: string | null;
  projectId: string | null;
  checklistItems: PlanningChecklistItem[];
  progressPercentage: number;
}

export interface PlanningChecklistTemplate {
  id: string;
  familyId: string;
  title: string;
  description: string;
  sourceModule: string;
  scope: 'PERSONAL' | 'SHARED';
  creatorMemberId: string;
  items: Array<{
    title: string;
    position: number;
    assignedMemberId: string | null;
  }>;
}

export interface FamilyMemberOption {
  id: string;
  displayName: string;
  role?: string;
}

export const GOAL_CATEGORIES = [
  'FINANCIAL',
  'HOUSEHOLD',
  'EDUCATION',
  'HEALTH',
  'SPIRITUAL',
  'MARRIAGE',
  'PARENTING',
  'LIFESTYLE',
  'OTHER',
] as const;

export const PRIORITY_OPTIONS = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;
export const GOAL_STATUS_OPTIONS = ['NOT_STARTED', 'ACTIVE', 'ON_HOLD', 'COMPLETED'] as const;
export const PROJECT_STATUS_OPTIONS = ['PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED'] as const;
export const TASK_STATUS_OPTIONS = ['TODO', 'IN_PROGRESS', 'REVIEW', 'BLOCKED', 'COMPLETED'] as const;

/* ============================================================================
   1. CREATE / EDIT GOAL MODAL
   ============================================================================ */
interface GoalModalProps {
  isOpen: boolean;
  initialGoal: PlanningGoalItem | null;
  members: FamilyMemberOption[];
  submitting: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (payload: Record<string, any>) => Promise<void>;
}

export const GoalFormModal: React.FC<GoalModalProps> = ({
  isOpen,
  initialGoal,
  members,
  submitting,
  error,
  onClose,
  onSubmit,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<string>('HOUSEHOLD');
  const [scope, setScope] = useState<'FAMILY' | 'COUPLE' | 'PERSONAL'>('FAMILY');
  const [horizon, setHorizon] = useState<'SHORT_TERM' | 'LONG_TERM'>('LONG_TERM');
  const [priority, setPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'>('HIGH');
  const [status, setStatus] = useState<'NOT_STARTED' | 'ACTIVE' | 'ON_HOLD' | 'COMPLETED'>('ACTIVE');
  const [ownerMemberId, setOwnerMemberId] = useState<string>('mem-sarah');
  const [startDate, setStartDate] = useState<string>('');
  const [targetDate, setTargetDate] = useState<string>('');
  const [isMeasurable, setIsMeasurable] = useState<boolean>(false);
  const [metricUnit, setMetricUnit] = useState<string>('');
  const [targetValue, setTargetValue] = useState<string>('100');
  const [currentValue, setCurrentValue] = useState<string>('0');
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setLocalError(null);
    if (initialGoal) {
      setTitle(initialGoal.title || '');
      setDescription(initialGoal.description || '');
      setCategory(initialGoal.category || 'HOUSEHOLD');
      setScope(initialGoal.scope || 'FAMILY');
      setHorizon(initialGoal.horizon || 'LONG_TERM');
      setPriority(initialGoal.priority || 'HIGH');
      setStatus(
        initialGoal.status === 'ARCHIVED' ? 'ACTIVE' : initialGoal.status || 'ACTIVE'
      );
      setOwnerMemberId(initialGoal.ownerMemberId || members[0]?.id || 'mem-sarah');
      setStartDate(initialGoal.startDate || new Date().toISOString().slice(0, 10));
      setTargetDate(initialGoal.targetDate || '');
      setIsMeasurable(Boolean(initialGoal.isMeasurable));
      setMetricUnit(initialGoal.metricUnit || '');
      setTargetValue(
        initialGoal.targetValue !== null && initialGoal.targetValue !== undefined
          ? String(initialGoal.targetValue)
          : '100'
      );
      setCurrentValue(
        initialGoal.currentValue !== null && initialGoal.currentValue !== undefined
          ? String(initialGoal.currentValue)
          : '0'
      );
    } else {
      setTitle('');
      setDescription('');
      setCategory('HOUSEHOLD');
      setScope('FAMILY');
      setHorizon('LONG_TERM');
      setPriority('HIGH');
      setStatus('ACTIVE');
      setOwnerMemberId(members[0]?.id || 'mem-sarah');
      setStartDate(new Date().toISOString().slice(0, 10));
      setTargetDate(new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10));
      setIsMeasurable(false);
      setMetricUnit('');
      setTargetValue('100');
      setCurrentValue('0');
    }
  }, [isOpen, initialGoal, members]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    if (!title.trim()) {
      setLocalError('Goal title is required.');
      return;
    }
    if (startDate && targetDate && targetDate < startDate) {
      setLocalError('Target date cannot be earlier than start date.');
      return;
    }
    let parsedTarget: number | null = null;
    let parsedCurrent: number | null = null;
    if (isMeasurable) {
      parsedTarget = Number(targetValue);
      parsedCurrent = Number(currentValue || 0);
      if (!Number.isFinite(parsedTarget) || parsedTarget <= 0) {
        setLocalError('Target metric value must be greater than 0.');
        return;
      }
      if (!Number.isFinite(parsedCurrent) || parsedCurrent < 0) {
        setLocalError('Current metric value cannot be negative.');
        return;
      }
    }

    await onSubmit({
      title: title.trim(),
      description: description.trim(),
      category,
      scope,
      horizon,
      priority,
      status,
      ownerMemberId,
      startDate: startDate || null,
      targetDate: targetDate || null,
      isMeasurable,
      metricUnit: isMeasurable ? metricUnit.trim() || 'Units' : null,
      targetValue: isMeasurable ? parsedTarget : null,
      currentValue: isMeasurable ? parsedCurrent : null,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl border border-stone-200 shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100">
          <div className="flex items-center gap-2">
            <Flag className="w-4 h-4 text-[#173D35]" />
            <h2 className="text-base font-bold text-stone-900">
              {initialGoal ? 'Edit Goal' : 'New Strategic Goal'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {(localError || error) && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-medium text-rose-800 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{localError || error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Goal Title *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Build 6-Month Emergency Reserve"
              className="w-full px-3.5 py-2 rounded-xl border border-stone-300 text-sm focus:outline-none focus:border-[#173D35]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Description & Outcome Vision
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the desired outcome and why it matters..."
              className="w-full px-3.5 py-2 rounded-xl border border-stone-300 text-sm focus:outline-none focus:border-[#173D35]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs font-medium bg-white"
              >
                {GOAL_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat.replace('_', ' ')}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Scope
              </label>
              <select
                value={scope}
                onChange={(e) => setScope(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs font-medium bg-white"
              >
                <option value="FAMILY">Family-Wide</option>
                <option value="COUPLE">Couple</option>
                <option value="PERSONAL">Personal / Private</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs font-medium bg-white"
              >
                {PRIORITY_OPTIONS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs font-medium bg-white"
              >
                {GOAL_STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s.replace('_', ' ')}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Horizon
              </label>
              <select
                value={horizon}
                onChange={(e) => setHorizon(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs font-medium bg-white"
              >
                <option value="SHORT_TERM">Short-Term</option>
                <option value="LONG_TERM">Long-Term</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Goal Owner
              </label>
              <select
                value={ownerMemberId}
                onChange={(e) => setOwnerMemberId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs font-medium bg-white"
              >
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.displayName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Target Date
              </label>
              <input
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs bg-white"
              />
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200/80 space-y-3">
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <span className="text-xs font-semibold text-stone-800 block">
                  Track Quantitative Target Metric
                </span>
                <span className="text-[11px] text-stone-500">
                  Note: When child Projects are linked, Goal progress automatically rolls up from Projects.
                </span>
              </div>
              <input
                type="checkbox"
                checked={isMeasurable}
                onChange={(e) => setIsMeasurable(e.target.checked)}
                className="rounded text-[#173D35]"
              />
            </label>

            {isMeasurable && (
              <div className="grid grid-cols-3 gap-2.5 pt-1">
                <div>
                  <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                    Current Value
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={currentValue}
                    onChange={(e) => setCurrentValue(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-stone-300 text-xs bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                    Target Value *
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={targetValue}
                    onChange={(e) => setTargetValue(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-stone-300 text-xs bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                    Unit Label
                  </label>
                  <input
                    type="text"
                    value={metricUnit}
                    onChange={(e) => setMetricUnit(e.target.value)}
                    placeholder="e.g., Recipes, kWh, $"
                    className="w-full px-2.5 py-1.5 rounded-lg border border-stone-300 text-xs bg-white"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-stone-200 text-xs font-semibold text-stone-600 hover:bg-stone-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded-xl bg-[#173D35] text-white text-xs font-semibold hover:bg-[#112d27] disabled:opacity-50"
            >
              {submitting ? 'Saving...' : initialGoal ? 'Save Changes' : 'Create Goal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* ============================================================================
   2. CREATE / EDIT PROJECT MODAL
   ============================================================================ */
interface ProjectModalProps {
  isOpen: boolean;
  initialProject: PlanningProjectItem | null;
  defaultGoalId: string | null;
  goals: PlanningGoalItem[];
  members: FamilyMemberOption[];
  submitting: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (payload: Record<string, any>) => Promise<void>;
}

export const ProjectFormModal: React.FC<ProjectModalProps> = ({
  isOpen,
  initialProject,
  defaultGoalId,
  goals,
  members,
  submitting,
  error,
  onClose,
  onSubmit,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [goalId, setGoalId] = useState<string>('');
  const [status, setStatus] = useState<'PLANNING' | 'ACTIVE' | 'ON_HOLD' | 'COMPLETED'>('ACTIVE');
  const [priority, setPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'>('HIGH');
  const [scope, setScope] = useState<'SHARED' | 'PERSONAL'>('SHARED');
  const [ownerMemberId, setOwnerMemberId] = useState<string>('mem-sarah');
  const [startDate, setStartDate] = useState<string>('');
  const [targetDate, setTargetDate] = useState<string>('');
  const [budgetDollars, setBudgetDollars] = useState<string>('0');
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setLocalError(null);
    if (initialProject) {
      setTitle(initialProject.title || initialProject.name || '');
      setDescription(initialProject.description || '');
      setGoalId(initialProject.goalId || '');
      setStatus(
        initialProject.status === 'ARCHIVED' ? 'ACTIVE' : initialProject.status || 'ACTIVE'
      );
      setPriority(initialProject.priority || 'HIGH');
      setScope(initialProject.scope || 'SHARED');
      setOwnerMemberId(initialProject.ownerMemberId || members[0]?.id || 'mem-sarah');
      setStartDate(initialProject.startDate || new Date().toISOString().slice(0, 10));
      setTargetDate(initialProject.targetDate || '');
      setBudgetDollars(
        typeof initialProject.budgetCents === 'number'
          ? String(Math.round(initialProject.budgetCents / 100))
          : '0'
      );
    } else {
      setTitle('');
      setDescription('');
      setGoalId(defaultGoalId || goals[0]?.id || '');
      setStatus('ACTIVE');
      setPriority('HIGH');
      setScope('SHARED');
      setOwnerMemberId(members[0]?.id || 'mem-sarah');
      setStartDate(new Date().toISOString().slice(0, 10));
      setTargetDate(new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10));
      setBudgetDollars('0');
    }
  }, [isOpen, initialProject, defaultGoalId, goals, members]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    if (!title.trim()) {
      setLocalError('Project title is required.');
      return;
    }
    if (!goalId) {
      setLocalError('Please select a parent Goal for this project.');
      return;
    }
    if (startDate && targetDate && targetDate < startDate) {
      setLocalError('Target date cannot be earlier than start date.');
      return;
    }
    const parsedBudget = Number(budgetDollars || 0);
    if (!Number.isFinite(parsedBudget) || parsedBudget < 0) {
      setLocalError('Budget must be a non-negative number.');
      return;
    }

    await onSubmit({
      title: title.trim(),
      name: title.trim(),
      description: description.trim(),
      goalId: goalId || null,
      status,
      priority,
      scope,
      ownerMemberId,
      startDate: startDate || null,
      targetDate: targetDate || null,
      budgetCents: Math.round(parsedBudget * 100),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl border border-stone-200 shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#173D35]" />
            <h2 className="text-base font-bold text-stone-900">
              {initialProject ? 'Edit Project' : 'New Project'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {(localError || error) && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-medium text-rose-800 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{localError || error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Parent Strategic Goal *
            </label>
            <select
              required
              value={goalId}
              onChange={(e) => setGoalId(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-stone-300 text-xs font-medium bg-white"
            >
              <option value="">Select Parent Goal...</option>
              {goals.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.title} ({g.category})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Project Title *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Contractor Bids & Municipal Approval"
              className="w-full px-3.5 py-2 rounded-xl border border-stone-300 text-sm focus:outline-none focus:border-[#173D35]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Description & Deliverables
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Key deliverables and scope for this project..."
              className="w-full px-3.5 py-2 rounded-xl border border-stone-300 text-sm focus:outline-none focus:border-[#173D35]"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs font-medium bg-white"
              >
                {PROJECT_STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s.replace('_', ' ')}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs font-medium bg-white"
              >
                {PRIORITY_OPTIONS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Scope
              </label>
              <select
                value={scope}
                onChange={(e) => setScope(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs font-medium bg-white"
              >
                <option value="SHARED">Shared Family</option>
                <option value="PERSONAL">Personal</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Project Lead
              </label>
              <select
                value={ownerMemberId}
                onChange={(e) => setOwnerMemberId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs font-medium bg-white"
              >
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.displayName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Target Date
              </label>
              <input
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs bg-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Estimated Project Budget ($ USD, Optional)
            </label>
            <input
              type="number"
              min="0"
              step="1"
              value={budgetDollars}
              onChange={(e) => setBudgetDollars(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-stone-300 text-xs bg-white"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-stone-200 text-xs font-semibold text-stone-600 hover:bg-stone-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded-xl bg-[#173D35] text-white text-xs font-semibold hover:bg-[#112d27] disabled:opacity-50"
            >
              {submitting ? 'Saving...' : initialProject ? 'Save Project' : 'Create Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* ============================================================================
   3. CREATE / EDIT TASK MODAL
   ============================================================================ */
interface TaskModalProps {
  isOpen: boolean;
  initialTask: PlanningTaskItem | null;
  defaultProjectId: string | null;
  defaultGoalId: string | null;
  projects: PlanningProjectItem[];
  goals: PlanningGoalItem[];
  members: FamilyMemberOption[];
  templates: PlanningChecklistTemplate[];
  submitting: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (payload: Record<string, any>) => Promise<void>;
}

export const TaskFormModal: React.FC<TaskModalProps> = ({
  isOpen,
  initialTask,
  defaultProjectId,
  defaultGoalId,
  projects,
  goals,
  members,
  templates,
  submitting,
  error,
  onClose,
  onSubmit,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [projectId, setProjectId] = useState<string>('');
  const [priority, setPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'>('MEDIUM');
  const [status, setStatus] = useState<'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'BLOCKED' | 'COMPLETED'>('TODO');
  const [scope, setScope] = useState<'SHARED' | 'PERSONAL'>('SHARED');
  const [assignedMemberId, setAssignedMemberId] = useState<string>('mem-sarah');
  const [dueDate, setDueDate] = useState<string>('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setLocalError(null);
    setSelectedTemplateId('');
    if (initialTask) {
      setTitle(initialTask.title || '');
      setDescription(initialTask.description || '');
      setProjectId(initialTask.projectId || '');
      setPriority(initialTask.priority || 'MEDIUM');
      setStatus(
        initialTask.status === 'ARCHIVED' ? 'TODO' : initialTask.status || 'TODO'
      );
      setScope(initialTask.scope || 'SHARED');
      setAssignedMemberId(initialTask.assignedMemberId || members[0]?.id || 'mem-sarah');
      setDueDate(initialTask.dueDate ? initialTask.dueDate.slice(0, 10) : '');
    } else {
      setTitle('');
      setDescription('');
      const resolvedProj =
        defaultProjectId ||
        (defaultGoalId
          ? projects.find((p) => p.goalId === defaultGoalId)?.id
          : projects[0]?.id) ||
        '';
      setProjectId(resolvedProj);
      setPriority('HIGH');
      setStatus('TODO');
      setScope('SHARED');
      setAssignedMemberId(members[0]?.id || 'mem-sarah');
      setDueDate(new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10));
    }
  }, [isOpen, initialTask, defaultProjectId, defaultGoalId, projects, members]);

  if (!isOpen) return null;

  const selectedProject = projects.find((p) => p.id === projectId) || null;
  const parentGoal = selectedProject?.goalId
    ? goals.find((g) => g.id === selectedProject.goalId) || null
    : defaultGoalId
    ? goals.find((g) => g.id === defaultGoalId) || null
    : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    if (!title.trim()) {
      setLocalError('Task title is required.');
      return;
    }
    if (!projectId) {
      setLocalError('Please select a parent Project for this task.');
      return;
    }

    const chosenTemplate = selectedTemplateId
      ? templates.find((t) => t.id === selectedTemplateId)
      : null;

    const payload: Record<string, any> = {
      title: title.trim(),
      description: description.trim(),
      projectId,
      goalId: selectedProject?.goalId || parentGoal?.id || null,
      priority,
      status,
      isCompleted: status === 'COMPLETED',
      scope,
      assignedMemberId: assignedMemberId || null,
      dueDate: dueDate || null,
      sourceModule: 'GOALS_PROJECTS',
    };

    if (!initialTask && chosenTemplate && Array.isArray(chosenTemplate.items)) {
      payload.checklistItems = chosenTemplate.items.map((it, idx) => ({
        title: it.title,
        isDone: false,
        position: idx,
        assignedMemberId: it.assignedMemberId || assignedMemberId || null,
      }));
    }

    await onSubmit(payload);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl border border-stone-200 shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100">
          <div className="flex items-center gap-2">
            <ListChecks className="w-4 h-4 text-[#173D35]" />
            <h2 className="text-base font-bold text-stone-900">
              {initialTask ? 'Edit Task' : 'New Project Task'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {(localError || error) && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-medium text-rose-800 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{localError || error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Parent Project *
            </label>
            <select
              required
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-stone-300 text-xs font-medium bg-white"
            >
              <option value="">Select Parent Project...</option>
              {projects.map((p) => {
                const g = goals.find((goal) => goal.id === p.goalId);
                return (
                  <option key={p.id} value={p.id}>
                    {p.title} {g ? `— [Goal: ${g.title}]` : ''}
                  </option>
                );
              })}
            </select>
            {parentGoal && (
              <p className="text-[11px] text-emerald-800 mt-1 font-medium">
                Rolls up to Goal: {parentGoal.title}
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Task Title *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Verify UL 9540A fire safety certification on quotes"
              className="w-full px-3.5 py-2 rounded-xl border border-stone-300 text-sm focus:outline-none focus:border-[#173D35]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Notes / Instructions
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional context or acceptance criteria..."
              className="w-full px-3.5 py-2 rounded-xl border border-stone-300 text-sm focus:outline-none focus:border-[#173D35]"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs font-medium bg-white"
              >
                {TASK_STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s.replace('_', ' ')}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs font-medium bg-white"
              >
                {PRIORITY_OPTIONS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Scope
              </label>
              <select
                value={scope}
                onChange={(e) => setScope(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs font-medium bg-white"
              >
                <option value="SHARED">Shared Family</option>
                <option value="PERSONAL">Personal</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Assigned Member
              </label>
              <select
                value={assignedMemberId}
                onChange={(e) => setAssignedMemberId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs font-medium bg-white"
              >
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.displayName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Due Date
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs bg-white"
              />
            </div>
          </div>

          {!initialTask && templates.length > 0 && (
            <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200/80">
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Initialize with Reusable Checklist Template (Optional)
              </label>
              <select
                value={selectedTemplateId}
                onChange={(e) => setSelectedTemplateId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs font-medium bg-white"
              >
                <option value="">No template — start with empty checklist</option>
                {templates.map((tpl) => (
                  <option key={tpl.id} value={tpl.id}>
                    {tpl.title} ({tpl.items?.length || 0} steps)
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-stone-200 text-xs font-semibold text-stone-600 hover:bg-stone-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded-xl bg-[#173D35] text-white text-xs font-semibold hover:bg-[#112d27] disabled:opacity-50"
            >
              {submitting ? 'Saving...' : initialTask ? 'Save Task' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* ============================================================================
   4. TASK CHECKLIST SLIDE-OVER DRAWER (LEVEL 4 PROGRESSIVE DISCLOSURE)
   ============================================================================ */
interface TaskChecklistDrawerProps {
  task: PlanningTaskItem | null;
  project: PlanningProjectItem | null;
  goal: PlanningGoalItem | null;
  templates: PlanningChecklistTemplate[];
  members: FamilyMemberOption[];
  submitting: boolean;
  onClose: () => void;
  onEditTask: (task: PlanningTaskItem) => void;
  onUpdateTaskStatus: (task: PlanningTaskItem, nextStatus: string) => Promise<void>;
  onAddChecklistItem: (taskId: string, title: string, assignedMemberId: string | null) => Promise<void>;
  onToggleChecklistItem: (taskId: string, itemId: string, isDone: boolean) => Promise<void>;
  onUpdateChecklistItemTitle: (taskId: string, itemId: string, title: string) => Promise<void>;
  onDeleteChecklistItem: (taskId: string, itemId: string) => Promise<void>;
  onReorderChecklistItem: (taskId: string, reorderIds: string[]) => Promise<void>;
  onClearCompletedChecklistItems: (taskId: string) => Promise<void>;
  onApplyChecklistTemplate: (taskId: string, templateId: string) => Promise<void>;
  onSaveChecklistAsTemplate: (title: string, description: string, items: PlanningChecklistItem[]) => Promise<void>;
  onOpenTemplateManager: () => void;
}

export const TaskChecklistDrawer: React.FC<TaskChecklistDrawerProps> = ({
  task,
  project,
  goal,
  templates,
  members,
  submitting,
  onClose,
  onEditTask,
  onUpdateTaskStatus,
  onAddChecklistItem,
  onToggleChecklistItem,
  onUpdateChecklistItemTitle,
  onDeleteChecklistItem,
  onReorderChecklistItem,
  onClearCompletedChecklistItems,
  onApplyChecklistTemplate,
  onSaveChecklistAsTemplate,
  onOpenTemplateManager,
}) => {
  const [newStepTitle, setNewStepTitle] = useState('');
  const [newStepAssignee, setNewStepAssignee] = useState<string>('');
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingItemTitle, setEditingItemTitle] = useState<string>('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [showSaveAsTemplateForm, setShowSaveAsTemplateForm] = useState<boolean>(false);
  const [newTemplateTitle, setNewTemplateTitle] = useState<string>('');
  const [newTemplateDesc, setNewTemplateDesc] = useState<string>('');

  useEffect(() => {
    setNewStepTitle('');
    setEditingItemId(null);
    setShowSaveAsTemplateForm(false);
  }, [task?.id]);

  if (!task) return null;

  const checklist = task.checklistItems || [];
  const doneCount = checklist.filter((i) => i.isDone).length;
  const totalCount = checklist.length;
  const pct = Math.min(100, Math.max(0, Number(task.progressPercentage ?? 0)));

  const handleAddStep = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStepTitle.trim()) return;
    await onAddChecklistItem(task.id, newStepTitle.trim(), newStepAssignee || task.assignedMemberId || null);
    setNewStepTitle('');
  };

  const handleMoveItem = async (index: number, direction: -1 | 1) => {
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= checklist.length) return;
    const copy = [...checklist];
    const [moved] = copy.splice(index, 1);
    copy.splice(targetIdx, 0, moved);
    await onReorderChecklistItem(
      task.id,
      copy.map((i) => i.id)
    );
  };

  const handleSaveEditedStep = async (itemId: string) => {
    if (!editingItemTitle.trim()) return;
    await onUpdateChecklistItemTitle(task.id, itemId, editingItemTitle.trim());
    setEditingItemId(null);
  };

  const handleSaveTemplateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTemplateTitle.trim() || checklist.length === 0) return;
    await onSaveChecklistAsTemplate(newTemplateTitle.trim(), newTemplateDesc.trim(), checklist);
    setNewTemplateTitle('');
    setNewTemplateDesc('');
    setShowSaveAsTemplateForm(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs">
      <div className="bg-white w-full max-w-xl h-full shadow-2xl border-l border-stone-200 flex flex-col overflow-hidden">
        {/* Drawer Header with Hierarchy Breadcrumb */}
        <div className="px-6 py-4 border-b border-stone-200 bg-stone-50/70">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-stone-500 truncate">
              <FolderTree className="w-3.5 h-3.5 text-[#173D35] shrink-0" />
              <span className="truncate">{goal?.title || 'Unlinked Goal'}</span>
              <span>→</span>
              <span className="truncate text-stone-700">{project?.title || 'Direct Task'}</span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => onEditTask(task)}
                className="px-2.5 py-1 rounded-lg border border-stone-200 bg-white text-xs font-semibold text-stone-700 hover:bg-stone-50 flex items-center gap-1"
              >
                <Edit2 className="w-3 h-3" />
                <span>Edit Task</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-200/60"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <h2 className="text-lg font-bold text-stone-900 mt-2">{task.title}</h2>
          {task.description && (
            <p className="text-xs text-stone-600 mt-1">{task.description}</p>
          )}

          {/* Task Status, Metadata & Live Hierarchy Rollup Bar */}
          <div className="mt-4 pt-3 border-t border-stone-200/70 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={task.status}
                onChange={(e) => void onUpdateTaskStatus(task, e.target.value)}
                className="px-2.5 py-1 rounded-lg border border-stone-300 text-xs font-bold bg-white text-stone-800"
              >
                {TASK_STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s.replace('_', ' ')}
                  </option>
                ))}
              </select>
              <span className="px-2 py-0.5 rounded-md bg-stone-200/80 text-stone-700 text-[11px] font-semibold">
                Priority: {task.priority}
              </span>
              {task.assignedToName && (
                <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 text-[11px] font-medium flex items-center gap-1">
                  <User className="w-3 h-3" />
                  {task.assignedToName}
                </span>
              )}
              {task.dueDate && (
                <span className="px-2 py-0.5 rounded-md bg-stone-100 text-stone-600 text-[11px] flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {task.dueDate}
                </span>
              )}
            </div>

            <div className="text-right">
              <span className="text-xs font-bold text-[#173D35] tabular-nums">
                Task Progress: {pct}%
              </span>
            </div>
          </div>

          <div className="w-full h-2 rounded-full bg-stone-200 mt-2 overflow-hidden">
            <div
              className="h-full bg-[#173D35] transition-all duration-300 rounded-full"
              style={{ width: `${pct}%` }}
            />
          </div>

          {/* Live Rollup Preview Pill */}
          <div className="mt-2.5 flex items-center justify-between text-[11px] text-stone-500">
            <span>
              Checklist Steps: <strong className="text-stone-800 tabular-nums">{doneCount}/{totalCount}</strong> completed
            </span>
            <div className="flex items-center gap-3 tabular-nums">
              {project && (
                <span>
                  Project Rollup: <strong className="text-emerald-800">{project.progressPercentage}%</strong>
                </span>
              )}
              {goal && (
                <span>
                  Goal Rollup: <strong className="text-emerald-800">{goal.progressPercentage}%</strong>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Drawer Body: Task Checklist & Reusable Templates */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Add Step Form */}
          <form onSubmit={handleAddStep} className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-stone-600">
              Step-by-Step Task Checklist
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={newStepTitle}
                onChange={(e) => setNewStepTitle(e.target.value)}
                placeholder="Add a step-by-step checklist item..."
                className="flex-1 px-3.5 py-2 rounded-xl border border-stone-300 text-xs focus:outline-none focus:border-[#173D35]"
              />
              <select
                value={newStepAssignee}
                onChange={(e) => setNewStepAssignee(e.target.value)}
                className="px-2.5 py-2 rounded-xl border border-stone-300 text-xs bg-white text-stone-700"
              >
                <option value="">Assignee (Default)</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.displayName}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                disabled={submitting || !newStepTitle.trim()}
                className="px-3.5 py-2 rounded-xl bg-[#173D35] text-white text-xs font-semibold hover:bg-[#112d27] disabled:opacity-50 flex items-center gap-1 shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Step</span>
              </button>
            </div>
          </form>

          {/* Checklist Items List */}
          {checklist.length === 0 ? (
            <div className="p-6 rounded-2xl border border-dashed border-stone-300 bg-stone-50/60 text-center space-y-2">
              <ListChecks className="w-6 h-6 text-stone-400 mx-auto" />
              <div className="text-xs font-semibold text-stone-700">
                No checklist steps on this task yet
              </div>
              <p className="text-[11px] text-stone-500 max-w-xs mx-auto">
                Add individual steps above or load a reusable checklist template below when this task requires step-by-step execution.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-stone-600">
                  {doneCount} of {totalCount} steps complete
                </span>
                {doneCount > 0 && (
                  <button
                    type="button"
                    onClick={() => void onClearCompletedChecklistItems(task.id)}
                    className="text-[11px] font-semibold text-rose-700 hover:underline"
                  >
                    Clear Completed ({doneCount})
                  </button>
                )}
              </div>

              <div className="divide-y divide-stone-100 rounded-2xl border border-stone-200 bg-white overflow-hidden">
                {checklist.map((item, idx) => {
                  const assigneeName = members.find((m) => m.id === item.assignedMemberId)?.displayName;
                  const isEditing = editingItemId === item.id;

                  return (
                    <div
                      key={item.id}
                      className={`p-3 flex items-center justify-between gap-2.5 transition ${
                        item.isDone ? 'bg-stone-50/80' : 'bg-white hover:bg-stone-50/40'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 flex-1 min-w-0">
                        <button
                          type="button"
                          onClick={() => void onToggleChecklistItem(task.id, item.id, !item.isDone)}
                          className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition ${
                            item.isDone
                              ? 'bg-[#173D35] border-[#173D35] text-white'
                              : 'border-stone-400 bg-white hover:border-[#173D35]'
                          }`}
                        >
                          {item.isDone && <Check className="w-3 h-3" />}
                        </button>

                        {isEditing ? (
                          <div className="flex items-center gap-1.5 flex-1">
                            <input
                              type="text"
                              value={editingItemTitle}
                              onChange={(e) => setEditingItemTitle(e.target.value)}
                              className="flex-1 px-2.5 py-1 rounded-lg border border-stone-300 text-xs"
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={() => void handleSaveEditedStep(item.id)}
                              className="px-2 py-1 rounded-lg bg-[#173D35] text-white text-[11px] font-semibold"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingItemId(null)}
                              className="px-2 py-1 rounded-lg border border-stone-200 text-[11px] text-stone-600"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="min-w-0 flex-1">
                            <div
                              className={`text-xs font-medium ${
                                item.isDone ? 'line-through text-stone-400' : 'text-stone-800'
                              }`}
                            >
                              {item.title}
                            </div>
                            {assigneeName && (
                              <span className="text-[10px] text-stone-500">
                                Assigned: {assigneeName}
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {!isEditing && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => void handleMoveItem(idx, -1)}
                            title="Move step up"
                            className="p-1 rounded text-stone-400 hover:text-stone-700 disabled:opacity-30"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={idx === checklist.length - 1}
                            onClick={() => void handleMoveItem(idx, 1)}
                            title="Move step down"
                            className="p-1 rounded text-stone-400 hover:text-stone-700 disabled:opacity-30"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingItemId(item.id);
                              setEditingItemTitle(item.title);
                            }}
                            title="Edit step"
                            className="p-1 rounded text-stone-400 hover:text-stone-700"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void onDeleteChecklistItem(task.id, item.id)}
                            title="Delete step"
                            className="p-1 rounded text-stone-400 hover:text-rose-600"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Reusable Checklist Templates Section */}
          <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200/80 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <BookmarkPlus className="w-4 h-4 text-[#173D35]" />
                <span className="text-xs font-bold text-stone-800">
                  Reusable Checklist Templates
                </span>
              </div>
              <button
                type="button"
                onClick={onOpenTemplateManager}
                className="text-[11px] font-semibold text-[#173D35] hover:underline"
              >
                Manage All Templates ({templates.length})
              </button>
            </div>

            <div className="flex gap-2">
              <select
                value={selectedTemplateId}
                onChange={(e) => setSelectedTemplateId(e.target.value)}
                className="flex-1 px-3 py-1.5 rounded-xl border border-stone-300 text-xs bg-white"
              >
                <option value="">Select a template to append steps...</option>
                {templates.map((tpl) => (
                  <option key={tpl.id} value={tpl.id}>
                    {tpl.title} ({tpl.items?.length || 0} steps)
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={!selectedTemplateId || submitting}
                onClick={() => {
                  if (selectedTemplateId) {
                    void onApplyChecklistTemplate(task.id, selectedTemplateId);
                    setSelectedTemplateId('');
                  }
                }}
                className="px-3 py-1.5 rounded-xl bg-stone-900 text-white text-xs font-semibold hover:bg-stone-800 disabled:opacity-40"
              >
                Load Steps
              </button>
            </div>

            {checklist.length > 0 && !showSaveAsTemplateForm && (
              <button
                type="button"
                onClick={() => {
                  setNewTemplateTitle(`${task.title} Checklist`);
                  setShowSaveAsTemplateForm(true);
                }}
                className="text-xs font-semibold text-emerald-800 hover:underline flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Save current {checklist.length} steps as a reusable template</span>
              </button>
            )}

            {showSaveAsTemplateForm && (
              <form
                onSubmit={handleSaveTemplateSubmit}
                className="p-3 rounded-xl bg-white border border-stone-200 space-y-2.5"
              >
                <div className="text-xs font-bold text-stone-800">
                  Save Current Steps as Reusable Template
                </div>
                <input
                  type="text"
                  required
                  value={newTemplateTitle}
                  onChange={(e) => setNewTemplateTitle(e.target.value)}
                  placeholder="Template Name"
                  className="w-full px-3 py-1.5 rounded-lg border border-stone-300 text-xs"
                />
                <input
                  type="text"
                  value={newTemplateDesc}
                  onChange={(e) => setNewTemplateDesc(e.target.value)}
                  placeholder="Optional description..."
                  className="w-full px-3 py-1.5 rounded-lg border border-stone-300 text-xs"
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowSaveAsTemplateForm(false)}
                    className="px-2.5 py-1 rounded-lg border border-stone-200 text-xs text-stone-600"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-3 py-1 rounded-lg bg-[#173D35] text-white text-xs font-semibold"
                  >
                    Save Template
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

/* ============================================================================
   5. REUSABLE CHECKLIST TEMPLATE MANAGER MODAL
   ============================================================================ */
interface TemplateManagerModalProps {
  isOpen: boolean;
  templates: PlanningChecklistTemplate[];
  submitting: boolean;
  onClose: () => void;
  onCreateTemplate: (payload: { title: string; description: string; items: string[] }) => Promise<void>;
  onUpdateTemplate: (
    templateId: string,
    payload: { title: string; description: string; items: string[] }
  ) => Promise<void>;
  onDeleteTemplate: (templateId: string) => Promise<void>;
}

export const ChecklistTemplateManagerModal: React.FC<TemplateManagerModalProps> = ({
  isOpen,
  templates,
  submitting,
  onClose,
  onCreateTemplate,
  onUpdateTemplate,
  onDeleteTemplate,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [itemsText, setItemsText] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setEditingId(null);
    setTitle('');
    setDescription('');
    setItemsText('');
    setLocalError(null);
  }, [isOpen]);

  if (!isOpen) return null;

  const startEdit = (tpl: PlanningChecklistTemplate) => {
    setEditingId(tpl.id);
    setTitle(tpl.title);
    setDescription(tpl.description || '');
    setItemsText((tpl.items || []).map((i) => i.title).join('\n'));
    setLocalError(null);
  };

  const resetForm = () => {
    setEditingId(null);
    setTitle('');
    setDescription('');
    setItemsText('');
    setLocalError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    const cleanItems = itemsText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    if (!title.trim()) {
      setLocalError('Template title is required.');
      return;
    }
    if (cleanItems.length === 0) {
      setLocalError('Please enter at least one checklist step (one per line).');
      return;
    }

    if (editingId) {
      await onUpdateTemplate(editingId, {
        title: title.trim(),
        description: description.trim(),
        items: cleanItems,
      });
    } else {
      await onCreateTemplate({
        title: title.trim(),
        description: description.trim(),
        items: cleanItems,
      });
    }
    resetForm();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl border border-stone-200 shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100">
          <div className="flex items-center gap-2">
            <BookmarkPlus className="w-4 h-4 text-[#173D35]" />
            <h2 className="text-base font-bold text-stone-900">
              Reusable Task Checklist Templates
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Existing Templates List */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500">
              Saved Templates ({templates.length})
            </h3>
            {templates.length === 0 ? (
              <p className="text-xs text-stone-500">No templates saved yet.</p>
            ) : (
              <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                {templates.map((tpl) => (
                  <div
                    key={tpl.id}
                    className="p-3 rounded-xl border border-stone-200 bg-stone-50/70 space-y-1.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-xs font-bold text-stone-900">{tpl.title}</div>
                        {tpl.description && (
                          <div className="text-[11px] text-stone-500">{tpl.description}</div>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => startEdit(tpl)}
                          className="p-1 rounded text-stone-500 hover:text-stone-900"
                          title="Edit template"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void onDeleteTemplate(tpl.id)}
                          className="p-1 rounded text-stone-500 hover:text-rose-600"
                          title="Delete template"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <ul className="text-[11px] text-stone-600 list-disc list-inside space-y-0.5">
                      {(tpl.items || []).slice(0, 4).map((item, idx) => (
                        <li key={idx} className="truncate">
                          {item.title}
                        </li>
                      ))}
                      {(tpl.items || []).length > 4 && (
                        <li className="text-stone-400">
                          +{(tpl.items || []).length - 4} more steps
                        </li>
                      )}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Create / Edit Template Form */}
          <form onSubmit={handleSubmit} className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500">
              {editingId ? 'Edit Template' : 'Create New Template'}
            </h3>
            {localError && (
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800">
                {localError}
              </div>
            )}
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Template Title *
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Contractor Bid Evaluation Steps"
                className="w-full px-3 py-1.5 rounded-xl border border-stone-300 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Description
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Short summary of when to use this checklist..."
                className="w-full px-3 py-1.5 rounded-xl border border-stone-300 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Checklist Steps (One per line) *
              </label>
              <textarea
                rows={5}
                required
                value={itemsText}
                onChange={(e) => setItemsText(e.target.value)}
                placeholder={'Verify license & insurance\nCompare warranty terms\nReview payment schedule'}
                className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs font-mono"
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-3 py-1.5 rounded-xl border border-stone-200 text-xs font-semibold text-stone-600"
                >
                  Cancel Edit
                </button>
              )}
              <button
                type="submit"
                disabled={submitting}
                className="px-3.5 py-1.5 rounded-xl bg-[#173D35] text-white text-xs font-semibold hover:bg-[#112d27] disabled:opacity-50"
              >
                {submitting ? 'Saving...' : editingId ? 'Update Template' : 'Save Template'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

/* ============================================================================
   6. CASCADING DELETE CONFIRMATION MODAL
   ============================================================================ */
export interface DeleteTargetState {
  entityType: 'GOAL' | 'PROJECT' | 'TASK';
  id: string;
  title: string;
  cascadeSummary: string;
}

interface DeleteConfirmModalProps {
  target: DeleteTargetState | null;
  submitting: boolean;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}

export const HierarchyDeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  target,
  submitting,
  onCancel,
  onConfirm,
}) => {
  if (!target) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl border border-stone-200 shadow-xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-rose-50 text-rose-600 shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-stone-900">
              Delete {target.entityType === 'GOAL' ? 'Goal' : target.entityType === 'PROJECT' ? 'Project' : 'Task'}?
            </h3>
            <p className="text-xs font-semibold text-stone-800 mt-1">
              “{target.title}”
            </p>
            <p className="text-xs text-stone-600 mt-1.5 leading-relaxed">
              {target.cascadeSummary}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-xl border border-stone-200 text-xs font-semibold text-stone-600 hover:bg-stone-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={() => void onConfirm()}
            className="px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700 disabled:opacity-50"
          >
            {submitting ? 'Deleting...' : 'Confirm Delete'}
          </button>
        </div>
      </div>
    </div>
  );
};
