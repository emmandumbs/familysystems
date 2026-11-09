import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  FolderTree,
  Flag,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Calendar,
  Plus,
  Users,
  RefreshCw,
  ListChecks,
  Layers,
  ChevronRight,
  ChevronDown,
  Search,
  Filter,
  ArrowUpDown,
  Edit2,
  Trash2,
  Check,
  BookmarkPlus,
  User,
} from 'lucide-react';
import {
  GoalFormModal,
  ProjectFormModal,
  TaskFormModal,
  TaskChecklistDrawer,
  ChecklistTemplateManagerModal,
  HierarchyDeleteConfirmModal,
  PlanningGoalItem,
  PlanningProjectItem,
  PlanningTaskItem,
  PlanningChecklistItem,
  PlanningChecklistTemplate,
  FamilyMemberOption,
  DeleteTargetState,
  GOAL_CATEGORIES,
  PRIORITY_OPTIONS,
  GOAL_STATUS_OPTIONS,
  PROJECT_STATUS_OPTIONS,
  TASK_STATUS_OPTIONS,
} from './planning/PlanningModals';

export interface Stage332Props {
  sessionToken: string;
  familyId?: string;
  selectedPersona?: string;
  onSelectPersona?: (role: string) => void;
  activeSubPage?: string;
  onSelectSubPage?: (subId: string) => void;
}

type HierarchyMainView = 'goals' | 'projects' | 'tasks';

const SUBPAGE_TO_VIEW: Record<string, HierarchyMainView> = {
  plan_goals: 'goals',
  plan_projects: 'projects',
  plan_tasks: 'tasks',
  plan_rewards: 'goals',
};

const VIEW_TO_SUBPAGE: Record<HierarchyMainView, string> = {
  goals: 'plan_goals',
  projects: 'plan_projects',
  tasks: 'plan_tasks',
};

const PRIORITY_WEIGHT: Record<string, number> = {
  URGENT: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};

const PRIORITY_BADGE_STYLE: Record<string, string> = {
  URGENT: 'bg-rose-100 text-rose-800 border-rose-200',
  HIGH: 'bg-amber-100 text-amber-800 border-amber-200',
  MEDIUM: 'bg-stone-100 text-stone-700 border-stone-200',
  LOW: 'bg-stone-50 text-stone-500 border-stone-200',
};

const STATUS_BADGE_STYLE: Record<string, string> = {
  COMPLETED: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  ACTIVE: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  IN_PROGRESS: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  PLANNING: 'bg-stone-100 text-stone-700 border-stone-200',
  NOT_STARTED: 'bg-stone-100 text-stone-600 border-stone-200',
  TODO: 'bg-stone-100 text-stone-600 border-stone-200',
  REVIEW: 'bg-amber-50 text-amber-800 border-amber-200',
  ON_HOLD: 'bg-amber-50 text-amber-800 border-amber-200',
  BLOCKED: 'bg-rose-50 text-rose-800 border-rose-200',
};

const FALLBACK_MEMBERS: FamilyMemberOption[] = [
  { id: 'mem-sarah', displayName: 'Sarah Henderson', role: 'OWNER' },
  { id: 'mem-david', displayName: 'David Henderson', role: 'ADMIN' },
  { id: 'mem-maya', displayName: 'Maya Henderson', role: 'MEMBER' },
  { id: 'mem-lucas', displayName: 'Lucas Henderson', role: 'CHILD' },
  { id: 'mem-martha', displayName: 'Grandma Martha', role: 'MEMBER' },
];

export const Stage332PlanningExperience: React.FC<Stage332Props> = ({
  sessionToken,
  familyId = 'fam-1',
  activeSubPage,
  onSelectSubPage,
}) => {
  const effectiveFamilyId = familyId || 'fam-1';

  const [planningData, setPlanningData] = useState<{
    goals: PlanningGoalItem[];
    projects: PlanningProjectItem[];
    tasks: PlanningTaskItem[];
    checklistTemplates: PlanningChecklistTemplate[];
    members?: FamilyMemberOption[];
  } | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [statusBanner, setStatusBanner] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const [activeView, setActiveView] = useState<HierarchyMainView>(
    (activeSubPage && SUBPAGE_TO_VIEW[activeSubPage]) || 'goals'
  );

  useEffect(() => {
    if (activeSubPage && SUBPAGE_TO_VIEW[activeSubPage]) {
      setActiveView(SUBPAGE_TO_VIEW[activeSubPage]);
    }
  }, [activeSubPage]);

  const handleSelectView = (view: HierarchyMainView) => {
    setActiveView(view);
    if (onSelectSubPage) {
      onSelectSubPage(VIEW_TO_SUBPAGE[view]);
    }
  };

  // Progressive disclosure expansion states
  const [expandedGoalIds, setExpandedGoalIds] = useState<Record<string, boolean>>({});
  const [expandedProjectIds, setExpandedProjectIds] = useState<Record<string, boolean>>({});

  // Goal Filters & Sorting
  const [goalSearch, setGoalSearch] = useState('');
  const [goalCategoryFilter, setGoalCategoryFilter] = useState<string>('ALL');
  const [goalStatusFilter, setGoalStatusFilter] = useState<string>('ALL');
  const [goalPriorityFilter, setGoalPriorityFilter] = useState<string>('ALL');
  const [goalScopeFilter, setGoalScopeFilter] = useState<string>('ALL');
  const [goalSortBy, setGoalSortBy] = useState<'progress' | 'targetDate' | 'priority' | 'title'>('priority');

  // Project Filters & Sorting
  const [projectSearch, setProjectSearch] = useState('');
  const [selectedGoalFilterId, setSelectedGoalFilterId] = useState<string>('ALL');
  const [projectStatusFilter, setProjectStatusFilter] = useState<string>('ALL');
  const [projectPriorityFilter, setProjectPriorityFilter] = useState<string>('ALL');
  const [projectSortBy, setProjectSortBy] = useState<'progress' | 'targetDate' | 'priority' | 'title'>('priority');

  // Task Filters & Sorting (used inside Projects & in the All Tasks view)
  const [taskSearch, setTaskSearch] = useState('');
  const [selectedProjectFilterId, setSelectedProjectFilterId] = useState<string>('ALL');
  const [taskStatusFilter, setTaskStatusFilter] = useState<string>('ALL');
  const [taskPriorityFilter, setTaskPriorityFilter] = useState<string>('ALL');
  const [taskAssigneeFilter, setTaskAssigneeFilter] = useState<string>('ALL');
  const [taskSortBy, setTaskSortBy] = useState<'dueDate' | 'priority' | 'progress' | 'title'>('priority');

  // Modals & Slide-Over Drawer State
  const [goalModalOpen, setGoalModalOpen] = useState<boolean>(false);
  const [editingGoal, setEditingGoal] = useState<PlanningGoalItem | null>(null);

  const [projectModalOpen, setProjectModalOpen] = useState<boolean>(false);
  const [editingProject, setEditingProject] = useState<PlanningProjectItem | null>(null);
  const [defaultProjectGoalId, setDefaultProjectGoalId] = useState<string | null>(null);

  const [taskModalOpen, setTaskModalOpen] = useState<boolean>(false);
  const [editingTask, setEditingTask] = useState<PlanningTaskItem | null>(null);
  const [defaultTaskProjectId, setDefaultTaskProjectId] = useState<string | null>(null);
  const [defaultTaskGoalId, setDefaultTaskGoalId] = useState<string | null>(null);

  const [activeChecklistTaskId, setActiveChecklistTaskId] = useState<string | null>(null);
  const [templateManagerOpen, setTemplateManagerOpen] = useState<boolean>(false);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTargetState | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);

  const notifyGlobalSync = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('familyos-planning-updated'));
    }
  }, []);

  const fetchPlanningData = useCallback(async () => {
    if (!sessionToken) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/planning/${encodeURIComponent(effectiveFamilyId)}`, {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setStatusBanner({
          type: 'error',
          text: err.message || err.error || `Failed to load planning hierarchy (${res.status})`,
        });
        return;
      }
      const data = await res.json();
      setPlanningData({
        goals: Array.isArray(data.goals) ? data.goals : [],
        projects: Array.isArray(data.projects) ? data.projects : [],
        tasks: Array.isArray(data.tasks) ? data.tasks : [],
        checklistTemplates: Array.isArray(data.checklistTemplates) ? data.checklistTemplates : [],
        members: Array.isArray(data.members) && data.members.length > 0 ? data.members : FALLBACK_MEMBERS,
      });

      // Expand first project by default so tasks are immediately scannable in Projects view
      if (Array.isArray(data.projects) && data.projects.length > 0) {
        setExpandedProjectIds((prev) => {
          if (Object.keys(prev).length > 0) return prev;
          return { [data.projects[0].id]: true };
        });
      }
    } catch {
      setStatusBanner({
        type: 'error',
        text: 'Network error while syncing Goals & Projects data.',
      });
    } finally {
      setLoading(false);
    }
  }, [sessionToken, effectiveFamilyId]);

  useEffect(() => {
    void fetchPlanningData();
  }, [fetchPlanningData]);

  useEffect(() => {
    const handleExternalSync = () => {
      void fetchPlanningData();
    };
    window.addEventListener('familyos-planning-updated', handleExternalSync);
    return () => window.removeEventListener('familyos-planning-updated', handleExternalSync);
  }, [fetchPlanningData]);

  const goals = useMemo(() => planningData?.goals || [], [planningData]);
  const projects = useMemo(() => planningData?.projects || [], [planningData]);
  const tasks = useMemo(() => planningData?.tasks || [], [planningData]);
  const templates = useMemo(() => planningData?.checklistTemplates || [], [planningData]);
  const members = useMemo(
    () => (planningData?.members && planningData.members.length > 0 ? planningData.members : FALLBACK_MEMBERS),
    [planningData]
  );

  // Maps for fast relational lookup
  const goalById = useMemo(() => {
    const map = new Map<string, PlanningGoalItem>();
    goals.forEach((g) => map.set(g.id, g));
    return map;
  }, [goals]);

  const projectById = useMemo(() => {
    const map = new Map<string, PlanningProjectItem>();
    projects.forEach((p) => map.set(p.id, p));
    return map;
  }, [projects]);

  const projectsByGoalId = useMemo(() => {
    const map = new Map<string, PlanningProjectItem[]>();
    projects.forEach((p) => {
      const key = p.goalId || 'UNLINKED';
      const list = map.get(key) || [];
      list.push(p);
      map.set(key, list);
    });
    return map;
  }, [projects]);

  const tasksByProjectId = useMemo(() => {
    const map = new Map<string, PlanningTaskItem[]>();
    tasks.forEach((t) => {
      const key = t.projectId || 'UNLINKED';
      const list = map.get(key) || [];
      list.push(t);
      map.set(key, list);
    });
    return map;
  }, [tasks]);

  // KPI Metrics
  const kpiStats = useMemo(() => {
    const activeGoals = goals.filter((g) => g.status !== 'ARCHIVED');
    const avgGoalProgress =
      activeGoals.length > 0
        ? Math.round(
            activeGoals.reduce((acc, g) => acc + Number(g.progressPercentage || 0), 0) /
              activeGoals.length
          )
        : 0;
    const completedTasksCount = tasks.filter((t) => t.isCompleted || t.status === 'COMPLETED').length;
    const openTasksCount = tasks.length - completedTasksCount;
    return {
      totalGoals: activeGoals.length,
      avgGoalProgress,
      totalProjects: projects.length,
      openTasksCount,
      completedTasksCount,
    };
  }, [goals, projects, tasks]);

  // Filtered & Sorted Goals
  const filteredGoals = useMemo(() => {
    return goals
      .filter((g) => {
        if (goalCategoryFilter !== 'ALL' && g.category !== goalCategoryFilter) return false;
        if (goalStatusFilter !== 'ALL' && g.status !== goalStatusFilter) return false;
        if (goalPriorityFilter !== 'ALL' && g.priority !== goalPriorityFilter) return false;
        if (goalScopeFilter !== 'ALL' && g.scope !== goalScopeFilter) return false;
        if (goalSearch.trim()) {
          const q = goalSearch.toLowerCase();
          const matchTitle = g.title.toLowerCase().includes(q);
          const matchDesc = (g.description || '').toLowerCase().includes(q);
          const matchCat = (g.category || '').toLowerCase().includes(q);
          if (!matchTitle && !matchDesc && !matchCat) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (goalSortBy === 'progress') {
          return Number(b.progressPercentage || 0) - Number(a.progressPercentage || 0);
        }
        if (goalSortBy === 'targetDate') {
          return String(a.targetDate || '9999-12-31').localeCompare(
            String(b.targetDate || '9999-12-31')
          );
        }
        if (goalSortBy === 'priority') {
          return (PRIORITY_WEIGHT[b.priority] || 0) - (PRIORITY_WEIGHT[a.priority] || 0);
        }
        return a.title.localeCompare(b.title);
      });
  }, [
    goals,
    goalCategoryFilter,
    goalStatusFilter,
    goalPriorityFilter,
    goalScopeFilter,
    goalSearch,
    goalSortBy,
  ]);

  // Filtered & Sorted Projects
  const filteredProjects = useMemo(() => {
    return projects
      .filter((p) => {
        if (selectedGoalFilterId !== 'ALL' && p.goalId !== selectedGoalFilterId) return false;
        if (projectStatusFilter !== 'ALL' && p.status !== projectStatusFilter) return false;
        if (projectPriorityFilter !== 'ALL' && p.priority !== projectPriorityFilter) return false;
        if (projectSearch.trim()) {
          const q = projectSearch.toLowerCase();
          const matchTitle = p.title.toLowerCase().includes(q);
          const matchDesc = (p.description || '').toLowerCase().includes(q);
          if (!matchTitle && !matchDesc) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (projectSortBy === 'progress') {
          return Number(b.progressPercentage || 0) - Number(a.progressPercentage || 0);
        }
        if (projectSortBy === 'targetDate') {
          return String(a.targetDate || '9999-12-31').localeCompare(
            String(b.targetDate || '9999-12-31')
          );
        }
        if (projectSortBy === 'priority') {
          return (PRIORITY_WEIGHT[b.priority] || 0) - (PRIORITY_WEIGHT[a.priority] || 0);
        }
        return a.title.localeCompare(b.title);
      });
  }, [
    projects,
    selectedGoalFilterId,
    projectStatusFilter,
    projectPriorityFilter,
    projectSearch,
    projectSortBy,
  ]);

  // Helper to filter & sort tasks (either for a specific project or across all tasks)
  const filterAndSortTasks = useCallback(
    (sourceTasks: PlanningTaskItem[]) => {
      return sourceTasks
        .filter((t) => {
          if (taskStatusFilter !== 'ALL' && t.status !== taskStatusFilter) return false;
          if (taskPriorityFilter !== 'ALL' && t.priority !== taskPriorityFilter) return false;
          if (taskAssigneeFilter !== 'ALL' && t.assignedMemberId !== taskAssigneeFilter) return false;
          if (taskSearch.trim()) {
            const q = taskSearch.toLowerCase();
            if (
              !t.title.toLowerCase().includes(q) &&
              !(t.description || '').toLowerCase().includes(q)
            ) {
              return false;
            }
          }
          return true;
        })
        .sort((a, b) => {
          if (taskSortBy === 'dueDate') {
            return String(a.dueDate || '9999-12-31').localeCompare(
              String(b.dueDate || '9999-12-31')
            );
          }
          if (taskSortBy === 'priority') {
            return (PRIORITY_WEIGHT[b.priority] || 0) - (PRIORITY_WEIGHT[a.priority] || 0);
          }
          if (taskSortBy === 'progress') {
            return Number(b.progressPercentage || 0) - Number(a.progressPercentage || 0);
          }
          return a.title.localeCompare(b.title);
        });
    },
    [taskStatusFilter, taskPriorityFilter, taskAssigneeFilter, taskSearch, taskSortBy]
  );

  /* ==========================================================================
     CRUD HANDLERS: LEVEL 1 (GOALS), LEVEL 2 (PROJECTS), LEVEL 3 (TASKS), LEVEL 4 (CHECKLISTS)
     ========================================================================== */

  // 1. Create / Update Goal
  const handleSaveGoal = async (payload: Record<string, any>) => {
    setSubmitting(true);
    setModalError(null);
    try {
      const url = editingGoal
        ? `/api/v1/goals/${encodeURIComponent(effectiveFamilyId)}/${encodeURIComponent(editingGoal.id)}`
        : `/api/v1/goals/${encodeURIComponent(effectiveFamilyId)}`;
      const method = editingGoal ? 'PUT' : 'POST';

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
        setModalError(data.message || data.error || 'Failed to save goal.');
        return;
      }

      setGoalModalOpen(false);
      setEditingGoal(null);
      setStatusBanner({
        type: 'success',
        text: editingGoal ? `Updated goal "${payload.title}".` : `Created goal "${payload.title}".`,
      });
      await fetchPlanningData();
      notifyGlobalSync();
    } finally {
      setSubmitting(false);
    }
  };

  // 2. Create / Update Project
  const handleSaveProject = async (payload: Record<string, any>) => {
    setSubmitting(true);
    setModalError(null);
    try {
      const url = editingProject
        ? `/api/v1/projects/${encodeURIComponent(effectiveFamilyId)}/${encodeURIComponent(editingProject.id)}`
        : `/api/v1/projects/${encodeURIComponent(effectiveFamilyId)}`;
      const method = editingProject ? 'PUT' : 'POST';

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
        setModalError(data.message || data.error || 'Failed to save project.');
        return;
      }

      setProjectModalOpen(false);
      setEditingProject(null);
      if (data.project?.id) {
        setExpandedProjectIds((prev) => ({ ...prev, [data.project.id]: true }));
      }
      setStatusBanner({
        type: 'success',
        text: editingProject
          ? `Updated project "${payload.title}".`
          : `Created project "${payload.title}".`,
      });
      await fetchPlanningData();
      notifyGlobalSync();
    } finally {
      setSubmitting(false);
    }
  };

  // 3. Create / Update Task
  const handleSaveTask = async (payload: Record<string, any>) => {
    setSubmitting(true);
    setModalError(null);
    try {
      const url = editingTask
        ? `/api/v1/tasks/${encodeURIComponent(effectiveFamilyId)}/${encodeURIComponent(editingTask.id)}`
        : `/api/v1/tasks/${encodeURIComponent(effectiveFamilyId)}`;
      const method = editingTask ? 'PUT' : 'POST';

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
        setModalError(data.message || data.error || 'Failed to save task.');
        return;
      }

      setTaskModalOpen(false);
      setEditingTask(null);
      if (payload.projectId) {
        setExpandedProjectIds((prev) => ({ ...prev, [payload.projectId]: true }));
      }
      setStatusBanner({
        type: 'success',
        text: editingTask ? `Updated task "${payload.title}".` : `Created task "${payload.title}".`,
      });
      await fetchPlanningData();
      notifyGlobalSync();
    } finally {
      setSubmitting(false);
    }
  };

  // Quick Task Completion Toggle
  const handleToggleTaskCompletion = async (task: PlanningTaskItem) => {
    setSubmitting(true);
    try {
      const nextCompleted = !task.isCompleted;
      const res = await fetch(
        `/api/v1/tasks/${encodeURIComponent(effectiveFamilyId)}/${encodeURIComponent(task.id)}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${sessionToken}`,
          },
          body: JSON.stringify({
            isCompleted: nextCompleted,
            status: nextCompleted ? 'COMPLETED' : 'TODO',
          }),
        }
      );
      if (res.ok) {
        await fetchPlanningData();
        notifyGlobalSync();
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Quick Task Status Update
  const handleUpdateTaskStatus = async (task: PlanningTaskItem, nextStatus: string) => {
    setSubmitting(true);
    try {
      const res = await fetch(
        `/api/v1/tasks/${encodeURIComponent(effectiveFamilyId)}/${encodeURIComponent(task.id)}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${sessionToken}`,
          },
          body: JSON.stringify({
            status: nextStatus,
            isCompleted: nextStatus === 'COMPLETED',
          }),
        }
      );
      if (res.ok) {
        await fetchPlanningData();
        notifyGlobalSync();
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Cascading Delete Handler (Goal / Project / Task)
  const requestDeleteEntity = (entityType: 'GOAL' | 'PROJECT' | 'TASK', item: any) => {
    if (entityType === 'GOAL') {
      const childProjects = projectsByGoalId.get(item.id) || [];
      const childProjectIds = new Set(childProjects.map((p) => p.id));
      const childTasks = tasks.filter(
        (t) => t.goalId === item.id || (t.projectId && childProjectIds.has(t.projectId))
      );
      setDeleteTarget({
        entityType: 'GOAL',
        id: item.id,
        title: item.title,
        cascadeSummary: `Deleting this Goal will also permanently remove ${childProjects.length} linked Project(s) and ${childTasks.length} linked Task(s) (including their task checklists).`,
      });
    } else if (entityType === 'PROJECT') {
      const childTasks = tasksByProjectId.get(item.id) || [];
      setDeleteTarget({
        entityType: 'PROJECT',
        id: item.id,
        title: item.title,
        cascadeSummary: `Deleting this Project will also remove ${childTasks.length} child Task(s) and automatically recalculate its parent Goal's progress.`,
      });
    } else {
      setDeleteTarget({
        entityType: 'TASK',
        id: item.id,
        title: item.title,
        cascadeSummary: `Deleting this Task will remove its ${(item.checklistItems || []).length} checklist step(s) and automatically recalculate parent Project and Goal progress.`,
      });
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setSubmitting(true);
    try {
      const endpointMap = {
        GOAL: `/api/v1/goals/${encodeURIComponent(effectiveFamilyId)}/${encodeURIComponent(deleteTarget.id)}`,
        PROJECT: `/api/v1/projects/${encodeURIComponent(effectiveFamilyId)}/${encodeURIComponent(deleteTarget.id)}`,
        TASK: `/api/v1/tasks/${encodeURIComponent(effectiveFamilyId)}/${encodeURIComponent(deleteTarget.id)}`,
      };
      const res = await fetch(endpointMap[deleteTarget.entityType], {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setStatusBanner({
          type: 'error',
          text: err.message || err.error || `Failed to delete ${deleteTarget.entityType.toLowerCase()}.`,
        });
        setDeleteTarget(null);
        return;
      }

      if (deleteTarget.entityType === 'TASK' && activeChecklistTaskId === deleteTarget.id) {
        setActiveChecklistTaskId(null);
      }
      if (deleteTarget.entityType === 'GOAL' && selectedGoalFilterId === deleteTarget.id) {
        setSelectedGoalFilterId('ALL');
      }
      setStatusBanner({
        type: 'success',
        text: `Deleted ${deleteTarget.entityType.toLowerCase()} "${deleteTarget.title}" and updated hierarchy progress.`,
      });
      setDeleteTarget(null);
      await fetchPlanningData();
      notifyGlobalSync();
    } finally {
      setSubmitting(false);
    }
  };

  // Level 4: Checklist Item Operations
  const mutateTaskChecklist = async (taskId: string, payload: Record<string, any>) => {
    setSubmitting(true);
    try {
      const res = await fetch(
        `/api/v1/tasks/${encodeURIComponent(effectiveFamilyId)}/${encodeURIComponent(taskId)}/checklist`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${sessionToken}`,
          },
          body: JSON.stringify(payload),
        }
      );
      if (res.ok) {
        await fetchPlanningData();
        notifyGlobalSync();
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateChecklistTemplate = async (payload: {
    title: string;
    description: string;
    items: string[];
  }) => {
    setSubmitting(true);
    try {
      const res = await fetch(
        `/api/v1/checklist-templates/${encodeURIComponent(effectiveFamilyId)}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${sessionToken}`,
          },
          body: JSON.stringify({
            title: payload.title,
            description: payload.description,
            sourceModule: 'GOALS_PROJECTS',
            scope: 'SHARED',
            items: payload.items.map((title, idx) => ({ title, position: idx })),
          }),
        }
      );
      if (res.ok) {
        setStatusBanner({
          type: 'success',
          text: `Saved reusable checklist template "${payload.title}".`,
        });
        await fetchPlanningData();
        notifyGlobalSync();
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateChecklistTemplate = async (
    templateId: string,
    payload: { title: string; description: string; items: string[] }
  ) => {
    setSubmitting(true);
    try {
      const res = await fetch(
        `/api/v1/checklist-templates/${encodeURIComponent(effectiveFamilyId)}/${encodeURIComponent(templateId)}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${sessionToken}`,
          },
          body: JSON.stringify({
            title: payload.title,
            description: payload.description,
            items: payload.items.map((title, idx) => ({ title, position: idx })),
          }),
        }
      );
      if (res.ok) {
        setStatusBanner({
          type: 'success',
          text: `Updated checklist template "${payload.title}".`,
        });
        await fetchPlanningData();
        notifyGlobalSync();
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteChecklistTemplate = async (templateId: string) => {
    setSubmitting(true);
    try {
      const res = await fetch(
        `/api/v1/checklist-templates/${encodeURIComponent(effectiveFamilyId)}/${encodeURIComponent(templateId)}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${sessionToken}` },
        }
      );
      if (res.ok) {
        await fetchPlanningData();
        notifyGlobalSync();
      }
    } finally {
      setSubmitting(false);
    }
  };

  const activeChecklistTask = useMemo(
    () => (activeChecklistTaskId ? tasks.find((t) => t.id === activeChecklistTaskId) || null : null),
    [activeChecklistTaskId, tasks]
  );

  const activeChecklistProject = useMemo(
    () =>
      activeChecklistTask?.projectId
        ? projectById.get(activeChecklistTask.projectId) || null
        : null,
    [activeChecklistTask, projectById]
  );

  const activeChecklistGoal = useMemo(
    () =>
      activeChecklistTask?.goalId
        ? goalById.get(activeChecklistTask.goalId) || null
        : activeChecklistProject?.goalId
        ? goalById.get(activeChecklistProject.goalId) || null
        : null,
    [activeChecklistTask, activeChecklistProject, goalById]
  );

  /* ==========================================================================
     REUSABLE TASK ROW RENDERER (Used inside Project Cards & All Tasks View)
     ========================================================================== */
  const renderTaskRow = (task: PlanningTaskItem, showHierarchyBadges = false) => {
    const checklist = task.checklistItems || [];
    const doneSteps = checklist.filter((c) => c.isDone).length;
    const totalSteps = checklist.length;
    const pct = Math.min(100, Math.max(0, Number(task.progressPercentage ?? 0)));
    const parentProj = task.projectId ? projectById.get(task.projectId) : null;
    const parentGoal = task.goalId
      ? goalById.get(task.goalId)
      : parentProj?.goalId
      ? goalById.get(parentProj.goalId)
      : null;

    return (
      <div
        key={task.id}
        className={`p-3.5 rounded-xl border transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
          task.isCompleted
            ? 'bg-stone-50/70 border-stone-200/70'
            : 'bg-white border-stone-200 hover:border-stone-300'
        }`}
      >
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <button
            type="button"
            onClick={() => void handleToggleTaskCompletion(task)}
            title={task.isCompleted ? 'Mark task incomplete' : 'Complete task'}
            className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 transition cursor-pointer ${
              task.isCompleted
                ? 'bg-[#173D35] border-[#173D35] text-white'
                : 'border-stone-400 bg-white hover:border-[#173D35]'
            }`}
          >
            {task.isCompleted && <Check className="w-3 h-3" />}
          </button>

          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`text-xs font-bold ${
                  task.isCompleted ? 'line-through text-stone-400' : 'text-stone-900'
                }`}
              >
                {task.title}
              </span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                  PRIORITY_BADGE_STYLE[task.priority] || PRIORITY_BADGE_STYLE.MEDIUM
                }`}
              >
                {task.priority}
              </span>
              {task.assignedToName && (
                <span className="text-[11px] text-stone-600 flex items-center gap-1">
                  <User className="w-3 h-3 text-stone-400" />
                  {task.assignedToName}
                </span>
              )}
              {task.dueDate && (
                <span className="text-[11px] text-stone-500 flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-stone-400" />
                  {task.dueDate}
                </span>
              )}
            </div>

            {task.description && (
              <p className="text-[11px] text-stone-500 line-clamp-1">{task.description}</p>
            )}

            {showHierarchyBadges && (parentGoal || parentProj) && (
              <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-stone-500 pt-0.5">
                {parentGoal && (
                  <span className="px-2 py-0.5 rounded bg-stone-100 text-stone-700 font-medium">
                    Goal: {parentGoal.title}
                  </span>
                )}
                {parentProj && (
                  <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 font-medium">
                    Project: {parentProj.title}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Controls: Status Dropdown, Checklist Drawer Trigger, Progress & Edit/Delete */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <select
            value={task.status}
            onChange={(e) => void handleUpdateTaskStatus(task, e.target.value)}
            className="px-2 py-1 rounded-lg border border-stone-200 text-[11px] font-semibold bg-stone-50 text-stone-700"
          >
            {TASK_STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s.replace('_', ' ')}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => setActiveChecklistTaskId(task.id)}
            className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold flex items-center gap-1.5 transition cursor-pointer ${
              totalSteps > 0
                ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900 hover:bg-emerald-100/80'
                : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50'
            }`}
          >
            <ListChecks className="w-3.5 h-3.5 text-[#173D35]" />
            <span className="tabular-nums">
              {totalSteps > 0 ? `Steps ${doneSteps}/${totalSteps}` : 'Checklist'}
            </span>
          </button>

          <span className="text-[11px] font-bold text-stone-700 tabular-nums w-9 text-right">
            {pct}%
          </span>

          <button
            type="button"
            onClick={() => {
              setEditingTask(task);
              setDefaultTaskProjectId(task.projectId);
              setDefaultTaskGoalId(task.goalId);
              setModalError(null);
              setTaskModalOpen(true);
            }}
            title="Edit task"
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-800 hover:bg-stone-100"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => requestDeleteEntity('TASK', task)}
            title="Delete task"
            className="p-1.5 rounded-lg text-stone-400 hover:text-rose-600 hover:bg-rose-50"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6" data-testid="planning-hierarchy-root">
      {/* Top Status Toast Banner */}
      {statusBanner && (
        <div
          className={`px-4 py-3 rounded-xl border text-xs font-medium flex items-center justify-between ${
            statusBanner.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : 'bg-emerald-50 border-emerald-200 text-emerald-900'
          }`}
        >
          <span>{statusBanner.text}</span>
          <button
            type="button"
            onClick={() => setStatusBanner(null)}
            className="text-xs font-bold underline ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Clean Header & Hierarchy Navigation Bar */}
      <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-xs space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#173D35]">
              <FolderTree className="w-4 h-4" />
              <span>Goals → Projects → Tasks → Task Checklists</span>
            </div>
            <h1 className="text-2xl font-serif font-bold text-stone-900 mt-1">
              Strategic Goals & Execution
            </h1>
            <p className="text-xs text-stone-500 mt-0.5">
              Strictly hierarchical planning with automatic progress rollups from task checklists to tasks, projects, and goals.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setTemplateManagerOpen(true)}
              className="px-3 py-2 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 text-xs font-semibold text-stone-700 flex items-center gap-1.5 cursor-pointer"
            >
              <BookmarkPlus className="w-3.5 h-3.5 text-[#173D35]" />
              <span>Checklist Templates ({templates.length})</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setEditingGoal(null);
                setModalError(null);
                setGoalModalOpen(true);
              }}
              className="px-3.5 py-2 rounded-xl bg-[#173D35] hover:bg-[#112d27] text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Goal</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setEditingProject(null);
                setDefaultProjectGoalId(
                  selectedGoalFilterId !== 'ALL' ? selectedGoalFilterId : goals[0]?.id || null
                );
                setModalError(null);
                setProjectModalOpen(true);
              }}
              className="px-3.5 py-2 rounded-xl border border-stone-300 bg-white hover:bg-stone-50 text-xs font-semibold text-stone-800 flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Project</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setEditingTask(null);
                setDefaultTaskProjectId(
                  selectedProjectFilterId !== 'ALL'
                    ? selectedProjectFilterId
                    : projects[0]?.id || null
                );
                setDefaultTaskGoalId(
                  selectedGoalFilterId !== 'ALL' ? selectedGoalFilterId : null
                );
                setModalError(null);
                setTaskModalOpen(true);
              }}
              className="px-3.5 py-2 rounded-xl border border-stone-300 bg-white hover:bg-stone-50 text-xs font-semibold text-stone-800 flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Task</span>
            </button>

            <button
              type="button"
              onClick={() => void fetchPlanningData()}
              disabled={loading}
              title="Refresh hierarchy"
              className="p-2 rounded-xl border border-stone-200 text-stone-500 hover:text-stone-900 hover:bg-stone-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Summary KPI Strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
          <div className="p-4 rounded-xl bg-stone-50 border border-stone-200/80">
            <div className="text-xs text-stone-500 font-medium">Strategic Goals</div>
            <div className="text-xl font-bold text-stone-900 mt-1 tabular-nums">
              {kpiStats.totalGoals} Active
            </div>
          </div>
          <div className="p-4 rounded-xl bg-stone-50 border border-stone-200/80">
            <div className="text-xs text-stone-500 font-medium">Avg Goal Rollup</div>
            <div className="text-xl font-bold text-[#173D35] mt-1 tabular-nums">
              {kpiStats.avgGoalProgress}%
            </div>
          </div>
          <div className="p-4 rounded-xl bg-stone-50 border border-stone-200/80">
            <div className="text-xs text-stone-500 font-medium">Active Projects</div>
            <div className="text-xl font-bold text-stone-900 mt-1 tabular-nums">
              {kpiStats.totalProjects} Projects
            </div>
          </div>
          <div className="p-4 rounded-xl bg-stone-50 border border-stone-200/80">
            <div className="text-xs text-stone-500 font-medium">Project Tasks</div>
            <div className="text-xl font-bold text-stone-900 mt-1 tabular-nums">
              {kpiStats.openTasksCount} Open • {kpiStats.completedTasksCount} Done
            </div>
          </div>
        </div>

        {/* Hierarchy Level Switcher Tabs */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-stone-100">
          <button
            type="button"
            onClick={() => handleSelectView('goals')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer ${
              activeView === 'goals'
                ? 'bg-[#173D35] text-white shadow-xs'
                : 'bg-stone-100 text-stone-700 hover:bg-stone-200/70'
            }`}
          >
            <Flag className="w-3.5 h-3.5" />
            <span>1. Goals ({goals.length})</span>
          </button>

          <ChevronRight className="w-4 h-4 text-stone-300 hidden sm:block" />

          <button
            type="button"
            onClick={() => handleSelectView('projects')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer ${
              activeView === 'projects'
                ? 'bg-[#173D35] text-white shadow-xs'
                : 'bg-stone-100 text-stone-700 hover:bg-stone-200/70'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>2. Projects & Tasks ({projects.length})</span>
          </button>

          <ChevronRight className="w-4 h-4 text-stone-300 hidden sm:block" />

          <button
            type="button"
            onClick={() => handleSelectView('tasks')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer ${
              activeView === 'tasks'
                ? 'bg-[#173D35] text-white shadow-xs'
                : 'bg-stone-100 text-stone-700 hover:bg-stone-200/70'
            }`}
          >
            <ListChecks className="w-3.5 h-3.5" />
            <span>3. All Tasks Queue ({tasks.length})</span>
          </button>
        </div>
      </div>

      {/* =====================================================================
          LEVEL 1 VIEW: GOALS (Scannable Cards + Progressive Disclosure of Projects)
          ===================================================================== */}
      {activeView === 'goals' && (
        <div className="space-y-4">
          {/* Goals Filter & Sort Bar */}
          <div className="bg-white rounded-2xl border border-stone-200 p-4 shadow-xs flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={goalSearch}
                onChange={(e) => setGoalSearch(e.target.value)}
                placeholder="Search goals by title, category, or description..."
                className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-stone-200 text-xs focus:outline-none focus:border-[#173D35]"
              />
            </div>

            <select
              value={goalCategoryFilter}
              onChange={(e) => setGoalCategoryFilter(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-stone-200 text-xs font-medium bg-white text-stone-700"
            >
              <option value="ALL">All Categories</option>
              {GOAL_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            <select
              value={goalStatusFilter}
              onChange={(e) => setGoalStatusFilter(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-stone-200 text-xs font-medium bg-white text-stone-700"
            >
              <option value="ALL">All Statuses</option>
              {GOAL_STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s.replace('_', ' ')}
                </option>
              ))}
            </select>

            <select
              value={goalPriorityFilter}
              onChange={(e) => setGoalPriorityFilter(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-stone-200 text-xs font-medium bg-white text-stone-700"
            >
              <option value="ALL">All Priorities</option>
              {PRIORITY_OPTIONS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>

            <select
              value={goalScopeFilter}
              onChange={(e) => setGoalScopeFilter(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-stone-200 text-xs font-medium bg-white text-stone-700"
            >
              <option value="ALL">All Scopes</option>
              <option value="FAMILY">Family</option>
              <option value="COUPLE">Couple</option>
              <option value="PERSONAL">Personal</option>
            </select>

            <div className="flex items-center gap-1.5">
              <ArrowUpDown className="w-3.5 h-3.5 text-stone-400" />
              <select
                value={goalSortBy}
                onChange={(e) => setGoalSortBy(e.target.value as any)}
                className="px-3 py-1.5 rounded-xl border border-stone-200 text-xs font-semibold bg-stone-50 text-stone-800"
              >
                <option value="priority">Sort: Priority</option>
                <option value="progress">Sort: Progress %</option>
                <option value="targetDate">Sort: Target Date</option>
                <option value="title">Sort: Title</option>
              </select>
            </div>
          </div>

          {/* Goals Card Grid */}
          {filteredGoals.length === 0 ? (
            <div className="bg-white rounded-2xl border border-stone-200 p-10 text-center space-y-3">
              <Flag className="w-8 h-8 text-stone-300 mx-auto" />
              <div className="text-sm font-bold text-stone-800">No matching goals found</div>
              <p className="text-xs text-stone-500 max-w-md mx-auto">
                Create a strategic goal to organize your household projects, tasks, and checklists.
              </p>
              <button
                type="button"
                onClick={() => {
                  setEditingGoal(null);
                  setModalError(null);
                  setGoalModalOpen(true);
                }}
                className="px-4 py-2 rounded-xl bg-[#173D35] text-white text-xs font-semibold inline-flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create Goal</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filteredGoals.map((goal) => {
                const childProjects = projectsByGoalId.get(goal.id) || [];
                const childProjectIds = new Set(childProjects.map((p) => p.id));
                const childTasks = tasks.filter(
                  (t) => t.goalId === goal.id || (t.projectId && childProjectIds.has(t.projectId))
                );
                const completedChildTasks = childTasks.filter((t) => t.isCompleted).length;
                const pct = Math.min(100, Math.max(0, Number(goal.progressPercentage ?? 0)));
                const isExpanded = Boolean(expandedGoalIds[goal.id]);

                return (
                  <div
                    key={goal.id}
                    className="bg-white rounded-2xl border border-stone-200 p-5 shadow-xs flex flex-col justify-between space-y-4"
                  >
                    <div className="space-y-3">
                      {/* Badges & Actions Header */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="px-2 py-0.5 rounded-md bg-stone-100 text-stone-700 text-[10px] font-bold uppercase">
                            {goal.category}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-md border text-[10px] font-bold ${
                              PRIORITY_BADGE_STYLE[goal.priority] || PRIORITY_BADGE_STYLE.MEDIUM
                            }`}
                          >
                            {goal.priority}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-md border text-[10px] font-semibold ${
                              STATUS_BADGE_STYLE[goal.status] || STATUS_BADGE_STYLE.ACTIVE
                            }`}
                          >
                            {goal.status.replace('_', ' ')}
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-stone-50 border border-stone-200 text-stone-600 text-[10px] font-medium">
                            {goal.scope}
                          </span>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingGoal(goal);
                              setModalError(null);
                              setGoalModalOpen(true);
                            }}
                            title="Edit goal"
                            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-800 hover:bg-stone-100"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => requestDeleteEntity('GOAL', goal)}
                            title="Delete goal"
                            className="p-1.5 rounded-lg text-stone-400 hover:text-rose-600 hover:bg-rose-50"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Goal Title & Description */}
                      <div>
                        <h3 className="text-base font-bold text-stone-900">{goal.title}</h3>
                        {goal.description && (
                          <p className="text-xs text-stone-600 mt-1 line-clamp-2">
                            {goal.description}
                          </p>
                        )}
                      </div>

                      {/* Metadata Row */}
                      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-stone-500">
                        <span>Owner: <strong className="text-stone-700">{goal.ownerName || 'Family'}</strong></span>
                        {goal.targetDate && (
                          <span>Target: <strong className="text-stone-700">{goal.targetDate}</strong></span>
                        )}
                      </div>

                      {/* Progress Bar */}
                      <div className="space-y-1.5 pt-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-stone-600">
                            {childProjects.length > 0
                              ? `Rolled up from ${childProjects.length} project(s)`
                              : goal.isMeasurable && goal.targetValue
                              ? `Metric: ${goal.currentValue ?? 0} / ${goal.targetValue} ${goal.metricUnit || ''}`
                              : 'Goal Progress'}
                          </span>
                          <span className="font-bold text-[#173D35] tabular-nums">{pct}%</span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-stone-100 overflow-hidden">
                          <div
                            className="h-full bg-[#173D35] rounded-full transition-all duration-300"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Progressive Disclosure Footer: Expand Projects or Add Project */}
                    <div className="pt-3 border-t border-stone-100 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedGoalIds((prev) => ({ ...prev, [goal.id]: !prev[goal.id] }))
                          }
                          className="text-xs font-bold text-stone-800 hover:text-[#173D35] flex items-center gap-1.5 cursor-pointer"
                        >
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-[#173D35]" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-stone-400" />
                          )}
                          <span>
                            {childProjects.length} Project{childProjects.length === 1 ? '' : 's'}
                          </span>
                          <span className="text-stone-400 font-normal">
                            • {completedChildTasks}/{childTasks.length} Tasks Done
                          </span>
                        </button>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingProject(null);
                              setDefaultProjectGoalId(goal.id);
                              setModalError(null);
                              setProjectModalOpen(true);
                            }}
                            className="px-2.5 py-1 rounded-lg border border-stone-200 hover:bg-stone-50 text-[11px] font-semibold text-stone-700 flex items-center gap-1 cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                            <span>Add Project</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setSelectedGoalFilterId(goal.id);
                              handleSelectView('projects');
                            }}
                            className="px-2.5 py-1 rounded-lg bg-stone-100 hover:bg-stone-200/80 text-[11px] font-semibold text-[#173D35] cursor-pointer"
                          >
                            Open Projects →
                          </button>
                        </div>
                      </div>

                      {/* Progressive Disclosure: Child Projects Preview */}
                      {isExpanded && (
                        <div className="pt-2 space-y-2">
                          {childProjects.length === 0 ? (
                            <div className="p-3 rounded-xl bg-stone-50 border border-dashed border-stone-200 text-center text-xs text-stone-500">
                              No projects linked to this goal yet. Click “+ Add Project” to break this goal into actionable projects.
                            </div>
                          ) : (
                            childProjects.map((proj) => {
                              const pTasks = tasksByProjectId.get(proj.id) || [];
                              const pDone = pTasks.filter((t) => t.isCompleted).length;
                              const pPct = Math.min(
                                100,
                                Math.max(0, Number(proj.progressPercentage ?? 0))
                              );

                              return (
                                <div
                                  key={proj.id}
                                  className="p-3 rounded-xl bg-stone-50 border border-stone-200/80 flex items-center justify-between gap-3"
                                >
                                  <div className="min-w-0 flex-1 space-y-1">
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs font-bold text-stone-900 truncate">
                                        {proj.title}
                                      </span>
                                      <span className="text-[10px] font-semibold text-stone-500 tabular-nums">
                                        ({pDone}/{pTasks.length} tasks)
                                      </span>
                                    </div>
                                    <div className="w-full h-1.5 rounded-full bg-stone-200 overflow-hidden">
                                      <div
                                        className="h-full bg-emerald-700 rounded-full"
                                        style={{ width: `${pPct}%` }}
                                      />
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-2 shrink-0">
                                    <span className="text-xs font-bold text-emerald-800 tabular-nums">
                                      {pPct}%
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setSelectedGoalFilterId(goal.id);
                                        setExpandedProjectIds((prev) => ({
                                          ...prev,
                                          [proj.id]: true,
                                        }));
                                        handleSelectView('projects');
                                      }}
                                      className="px-2.5 py-1 rounded-lg bg-white border border-stone-200 hover:bg-stone-100 text-[11px] font-semibold text-stone-800 cursor-pointer"
                                    >
                                      Tasks →
                                    </button>
                                  </div>
                                </div>
                              );
                            })
                          )}
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

      {/* =====================================================================
          LEVEL 2 VIEW: PROJECTS & THEIR CHILD TASKS (Progressive Disclosure)
          ===================================================================== */}
      {activeView === 'projects' && (
        <div className="space-y-4">
          {/* Projects Filter & Sort Bar */}
          <div className="bg-white rounded-2xl border border-stone-200 p-4 shadow-xs space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={projectSearch}
                  onChange={(e) => setProjectSearch(e.target.value)}
                  placeholder="Search projects..."
                  className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-stone-200 text-xs focus:outline-none focus:border-[#173D35]"
                />
              </div>

              <select
                value={selectedGoalFilterId}
                onChange={(e) => setSelectedGoalFilterId(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-stone-200 text-xs font-semibold bg-white text-stone-800"
              >
                <option value="ALL">All Parent Goals</option>
                {goals.map((g) => (
                  <option key={g.id} value={g.id}>
                    Goal: {g.title}
                  </option>
                ))}
              </select>

              <select
                value={projectStatusFilter}
                onChange={(e) => setProjectStatusFilter(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-stone-200 text-xs font-medium bg-white text-stone-700"
              >
                <option value="ALL">All Project Statuses</option>
                {PROJECT_STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s.replace('_', ' ')}
                  </option>
                ))}
              </select>

              <select
                value={projectPriorityFilter}
                onChange={(e) => setProjectPriorityFilter(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-stone-200 text-xs font-medium bg-white text-stone-700"
              >
                <option value="ALL">All Priorities</option>
                {PRIORITY_OPTIONS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>

              <div className="flex items-center gap-1.5">
                <ArrowUpDown className="w-3.5 h-3.5 text-stone-400" />
                <select
                  value={projectSortBy}
                  onChange={(e) => setProjectSortBy(e.target.value as any)}
                  className="px-3 py-1.5 rounded-xl border border-stone-200 text-xs font-semibold bg-stone-50 text-stone-800"
                >
                  <option value="priority">Sort Projects: Priority</option>
                  <option value="progress">Sort Projects: Progress %</option>
                  <option value="targetDate">Sort Projects: Target Date</option>
                  <option value="title">Sort Projects: Title</option>
                </select>
              </div>
            </div>

            {/* Secondary Filter Bar for Tasks inside Projects */}
            <div className="pt-3 border-t border-stone-100 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-1.5 text-stone-500 font-semibold">
                <Filter className="w-3.5 h-3.5 text-[#173D35]" />
                <span>Filter Tasks Inside Projects:</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={taskStatusFilter}
                  onChange={(e) => setTaskStatusFilter(e.target.value)}
                  className="px-2.5 py-1 rounded-lg border border-stone-200 text-[11px] bg-stone-50 text-stone-700"
                >
                  <option value="ALL">Task Status: All</option>
                  {TASK_STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s.replace('_', ' ')}
                    </option>
                  ))}
                </select>
                <select
                  value={taskPriorityFilter}
                  onChange={(e) => setTaskPriorityFilter(e.target.value)}
                  className="px-2.5 py-1 rounded-lg border border-stone-200 text-[11px] bg-stone-50 text-stone-700"
                >
                  <option value="ALL">Task Priority: All</option>
                  {PRIORITY_OPTIONS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
                <select
                  value={taskAssigneeFilter}
                  onChange={(e) => setTaskAssigneeFilter(e.target.value)}
                  className="px-2.5 py-1 rounded-lg border border-stone-200 text-[11px] bg-stone-50 text-stone-700"
                >
                  <option value="ALL">Assignee: All</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.displayName}
                    </option>
                  ))}
                </select>
                <select
                  value={taskSortBy}
                  onChange={(e) => setTaskSortBy(e.target.value as any)}
                  className="px-2.5 py-1 rounded-lg border border-stone-200 text-[11px] font-semibold bg-stone-50 text-stone-800"
                >
                  <option value="priority">Sort Tasks: Priority</option>
                  <option value="dueDate">Sort Tasks: Due Date</option>
                  <option value="progress">Sort Tasks: Progress %</option>
                  <option value="title">Sort Tasks: Title</option>
                </select>
              </div>
            </div>
          </div>

          {/* Projects List with Embedded Tasks */}
          {filteredProjects.length === 0 ? (
            <div className="bg-white rounded-2xl border border-stone-200 p-10 text-center space-y-3">
              <Layers className="w-8 h-8 text-stone-300 mx-auto" />
              <div className="text-sm font-bold text-stone-800">No projects match your filter</div>
              <div className="flex justify-center gap-2">
                {selectedGoalFilterId !== 'ALL' && (
                  <button
                    type="button"
                    onClick={() => setSelectedGoalFilterId('ALL')}
                    className="px-3.5 py-2 rounded-xl border border-stone-200 text-xs font-semibold text-stone-700"
                  >
                    Show All Goals’ Projects
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setEditingProject(null);
                    setDefaultProjectGoalId(
                      selectedGoalFilterId !== 'ALL' ? selectedGoalFilterId : goals[0]?.id || null
                    );
                    setModalError(null);
                    setProjectModalOpen(true);
                  }}
                  className="px-4 py-2 rounded-xl bg-[#173D35] text-white text-xs font-semibold inline-flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create Project</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredProjects.map((project) => {
                const parentGoal = project.goalId ? goalById.get(project.goalId) : null;
                const rawProjectTasks = tasksByProjectId.get(project.id) || [];
                const visibleProjectTasks = filterAndSortTasks(rawProjectTasks);
                const doneTasksCount = rawProjectTasks.filter((t) => t.isCompleted).length;
                const pct = Math.min(100, Math.max(0, Number(project.progressPercentage ?? 0)));
                const isExpanded = Boolean(expandedProjectIds[project.id]);
                const leadName =
                  members.find((m) => m.id === project.ownerMemberId)?.displayName || 'Family Lead';

                return (
                  <div
                    key={project.id}
                    className="bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden"
                  >
                    {/* Project Card Header */}
                    <div className="p-5 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                        <div className="space-y-1.5">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {parentGoal && (
                              <button
                                type="button"
                                onClick={() => setSelectedGoalFilterId(parentGoal.id)}
                                className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-900 border border-emerald-200 text-[10px] font-bold flex items-center gap-1 hover:bg-emerald-100 cursor-pointer"
                              >
                                <Flag className="w-2.5 h-2.5" />
                                <span>Goal: {parentGoal.title}</span>
                              </button>
                            )}
                            <span
                              className={`px-2 py-0.5 rounded-md border text-[10px] font-bold ${
                                PRIORITY_BADGE_STYLE[project.priority] || PRIORITY_BADGE_STYLE.MEDIUM
                              }`}
                            >
                              {project.priority}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-md border text-[10px] font-semibold ${
                                STATUS_BADGE_STYLE[project.status] || STATUS_BADGE_STYLE.ACTIVE
                              }`}
                            >
                              {project.status.replace('_', ' ')}
                            </span>
                            <span className="text-[11px] text-stone-500">
                              Lead: <strong className="text-stone-700">{leadName}</strong>
                            </span>
                            {project.targetDate && (
                              <span className="text-[11px] text-stone-500">
                                • Target: <strong className="text-stone-700">{project.targetDate}</strong>
                              </span>
                            )}
                          </div>

                          <h3 className="text-base font-bold text-stone-900">{project.title}</h3>
                          {project.description && (
                            <p className="text-xs text-stone-600">{project.description}</p>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingTask(null);
                              setDefaultTaskProjectId(project.id);
                              setDefaultTaskGoalId(project.goalId);
                              setModalError(null);
                              setTaskModalOpen(true);
                            }}
                            className="px-3 py-1.5 rounded-xl bg-[#173D35] text-white text-xs font-semibold hover:bg-[#112d27] flex items-center gap-1 cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Add Task</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setEditingProject(project);
                              setDefaultProjectGoalId(project.goalId);
                              setModalError(null);
                              setProjectModalOpen(true);
                            }}
                            title="Edit project"
                            className="p-1.5 rounded-lg border border-stone-200 text-stone-500 hover:text-stone-900 hover:bg-stone-50"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => requestDeleteEntity('PROJECT', project)}
                            title="Delete project"
                            className="p-1.5 rounded-lg border border-stone-200 text-stone-500 hover:text-rose-600 hover:bg-rose-50"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Project Progress Bar & Expand Toggle */}
                      <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedProjectIds((prev) => ({
                              ...prev,
                              [project.id]: !prev[project.id],
                            }))
                          }
                          className="text-xs font-bold text-stone-800 hover:text-[#173D35] flex items-center gap-1.5 cursor-pointer"
                        >
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-[#173D35]" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-stone-400" />
                          )}
                          <span>
                            { isExpanded ? 'Hide Project Tasks' : 'Show Project Tasks' } ({doneTasksCount}/{rawProjectTasks.length} completed)
                          </span>
                        </button>

                        <div className="flex items-center gap-3 sm:w-64">
                          <div className="flex-1 h-2 rounded-full bg-stone-100 overflow-hidden">
                            <div
                              className="h-full bg-[#173D35] rounded-full transition-all duration-300"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-xs font-bold text-[#173D35] tabular-nums w-10 text-right">
                            {pct}%
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Embedded Project Tasks Container */}
                    {isExpanded && (
                      <div className="p-5 bg-stone-50/70 border-t border-stone-200/80 space-y-2.5">
                        {visibleProjectTasks.length === 0 ? (
                          <div className="p-4 rounded-xl bg-white border border-dashed border-stone-200 text-center space-y-1.5">
                            <div className="text-xs font-semibold text-stone-700">
                              {rawProjectTasks.length === 0
                                ? 'No tasks in this project yet'
                                : 'No tasks match your current task filter'}
                            </div>
                            <p className="text-[11px] text-stone-500">
                              Add actionable tasks to track execution and automatically roll up progress to this project.
                            </p>
                          </div>
                        ) : (
                          visibleProjectTasks.map((task) => renderTaskRow(task, false))
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          LEVEL 3 VIEW: ALL TASKS QUEUE (Filtered / Sorted Execution View)
          ===================================================================== */}
      {activeView === 'tasks' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-stone-200 p-4 shadow-xs flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={taskSearch}
                onChange={(e) => setTaskSearch(e.target.value)}
                placeholder="Search tasks by title or description..."
                className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-stone-200 text-xs focus:outline-none focus:border-[#173D35]"
              />
            </div>

            <select
              value={selectedProjectFilterId}
              onChange={(e) => setSelectedProjectFilterId(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-stone-200 text-xs font-medium bg-white text-stone-700"
            >
              <option value="ALL">All Projects</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  Project: {p.title}
                </option>
              ))}
            </select>

            <select
              value={taskStatusFilter}
              onChange={(e) => setTaskStatusFilter(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-stone-200 text-xs font-medium bg-white text-stone-700"
            >
              <option value="ALL">All Statuses</option>
              {TASK_STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s.replace('_', ' ')}
                </option>
              ))}
            </select>

            <select
              value={taskPriorityFilter}
              onChange={(e) => setTaskPriorityFilter(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-stone-200 text-xs font-medium bg-white text-stone-700"
            >
              <option value="ALL">All Priorities</option>
              {PRIORITY_OPTIONS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>

            <select
              value={taskAssigneeFilter}
              onChange={(e) => setTaskAssigneeFilter(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-stone-200 text-xs font-medium bg-white text-stone-700"
            >
              <option value="ALL">All Assignees</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.displayName}
                </option>
              ))}
            </select>

            <div className="flex items-center gap-1.5">
              <ArrowUpDown className="w-3.5 h-3.5 text-stone-400" />
              <select
                value={taskSortBy}
                onChange={(e) => setTaskSortBy(e.target.value as any)}
                className="px-3 py-1.5 rounded-xl border border-stone-200 text-xs font-semibold bg-stone-50 text-stone-800"
              >
                <option value="priority">Sort: Priority</option>
                <option value="dueDate">Sort: Due Date</option>
                <option value="progress">Sort: Progress %</option>
                <option value="title">Sort: Title</option>
              </select>
            </div>
          </div>

          {(() => {
            const baseTasks =
              selectedProjectFilterId === 'ALL'
                ? tasks
                : tasks.filter((t) => t.projectId === selectedProjectFilterId);
            const finalTasks = filterAndSortTasks(baseTasks);

            if (finalTasks.length === 0) {
              return (
                <div className="bg-white rounded-2xl border border-stone-200 p-10 text-center space-y-3">
                  <ListChecks className="w-8 h-8 text-stone-300 mx-auto" />
                  <div className="text-sm font-bold text-stone-800">No tasks match your filter</div>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingTask(null);
                      setDefaultTaskProjectId(
                        selectedProjectFilterId !== 'ALL'
                          ? selectedProjectFilterId
                          : projects[0]?.id || null
                      );
                      setModalError(null);
                      setTaskModalOpen(true);
                    }}
                    className="px-4 py-2 rounded-xl bg-[#173D35] text-white text-xs font-semibold inline-flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Create Task</span>
                  </button>
                </div>
              );
            }

            return (
              <div className="space-y-2.5">
                {finalTasks.map((task) => renderTaskRow(task, true))}
              </div>
            );
          })()}
        </div>
      )}

      {/* =====================================================================
          MODALS & SLIDE-OVER DRAWERS
          ===================================================================== */}
      <GoalFormModal
        isOpen={goalModalOpen}
        initialGoal={editingGoal}
        members={members}
        submitting={submitting}
        error={modalError}
        onClose={() => {
          setGoalModalOpen(false);
          setEditingGoal(null);
        }}
        onSubmit={handleSaveGoal}
      />

      <ProjectFormModal
        isOpen={projectModalOpen}
        initialProject={editingProject}
        defaultGoalId={defaultProjectGoalId}
        goals={goals}
        members={members}
        submitting={submitting}
        error={modalError}
        onClose={() => {
          setProjectModalOpen(false);
          setEditingProject(null);
        }}
        onSubmit={handleSaveProject}
      />

      <TaskFormModal
        isOpen={taskModalOpen}
        initialTask={editingTask}
        defaultProjectId={defaultTaskProjectId}
        defaultGoalId={defaultTaskGoalId}
        projects={projects}
        goals={goals}
        members={members}
        templates={templates}
        submitting={submitting}
        error={modalError}
        onClose={() => {
          setTaskModalOpen(false);
          setEditingTask(null);
        }}
        onSubmit={handleSaveTask}
      />

      <TaskChecklistDrawer
        task={activeChecklistTask}
        project={activeChecklistProject}
        goal={activeChecklistGoal}
        templates={templates}
        members={members}
        submitting={submitting}
        onClose={() => setActiveChecklistTaskId(null)}
        onEditTask={(task) => {
          setEditingTask(task);
          setDefaultTaskProjectId(task.projectId);
          setDefaultTaskGoalId(task.goalId);
          setModalError(null);
          setTaskModalOpen(true);
        }}
        onUpdateTaskStatus={handleUpdateTaskStatus}
        onAddChecklistItem={async (taskId, title, assignedMemberId) => {
          await mutateTaskChecklist(taskId, { title, isDone: false, assignedMemberId });
        }}
        onToggleChecklistItem={async (taskId, itemId, isDone) => {
          await mutateTaskChecklist(taskId, { itemId, isDone });
        }}
        onUpdateChecklistItemTitle={async (taskId, itemId, title) => {
          await mutateTaskChecklist(taskId, { itemId, title });
        }}
        onDeleteChecklistItem={async (taskId, itemId) => {
          await mutateTaskChecklist(taskId, { deleteItemId: itemId });
        }}
        onReorderChecklistItem={async (taskId, reorderIds) => {
          await mutateTaskChecklist(taskId, { reorderIds });
        }}
        onClearCompletedChecklistItems={async (taskId) => {
          await mutateTaskChecklist(taskId, { action: 'CLEAR_COMPLETED' });
        }}
        onApplyChecklistTemplate={async (taskId, templateId) => {
          await mutateTaskChecklist(taskId, { applyTemplateId: templateId });
        }}
        onSaveChecklistAsTemplate={async (title, description, items) => {
          await handleCreateChecklistTemplate({
            title,
            description,
            items: items.map((i) => i.title),
          });
        }}
        onOpenTemplateManager={() => setTemplateManagerOpen(true)}
      />

      <ChecklistTemplateManagerModal
        isOpen={templateManagerOpen}
        templates={templates}
        submitting={submitting}
        onClose={() => setTemplateManagerOpen(false)}
        onCreateTemplate={handleCreateChecklistTemplate}
        onUpdateTemplate={handleUpdateChecklistTemplate}
        onDeleteTemplate={handleDeleteChecklistTemplate}
      />

      <HierarchyDeleteConfirmModal
        target={deleteTarget}
        submitting={submitting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
};
