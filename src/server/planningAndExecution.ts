import type {
  AuthoritativeMembership,
  SharedStore,
  SynchronizedEntityRecord,
} from './backupAndMigration';

export type GoalScope = 'PERSONAL' | 'COUPLE' | 'FAMILY';
export type GoalHorizon = 'SHORT_TERM' | 'LONG_TERM';
export type GoalStatus = 'NOT_STARTED' | 'ACTIVE' | 'ON_HOLD' | 'COMPLETED' | 'ARCHIVED';

export type ProjectScope = 'PERSONAL' | 'SHARED';
export type ProjectStatus = 'PLANNING' | 'ACTIVE' | 'ON_HOLD' | 'COMPLETED' | 'ARCHIVED';

export type MilestoneStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'ARCHIVED';

export type TaskScope = 'PERSONAL' | 'SHARED';
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'BLOCKED' | 'COMPLETED' | 'ARCHIVED';

export type CanonicalTaskSourceModule =
  | 'GOALS_PROJECTS'
  | 'HOME_MANAGEMENT'
  | 'MARRIAGE'
  | 'PARENTING'
  | 'SPIRITUAL_GROWTH'
  | 'FAMILY_GOVERNANCE'
  | 'PERSONAL_PLANNING';

export const VALID_TASK_SOURCE_MODULES: CanonicalTaskSourceModule[] = [
  'GOALS_PROJECTS',
  'HOME_MANAGEMENT',
  'MARRIAGE',
  'PARENTING',
  'SPIRITUAL_GROWTH',
  'FAMILY_GOVERNANCE',
  'PERSONAL_PLANNING',
];

export interface PlanningComment {
  id: string;
  authorMemberId: string;
  authorName: string;
  body: string;
  createdAt: number;
}

export interface PlanningAttachment {
  id: string;
  fileName: string;
  mimeType: string;
  url: string;
  uploadedByMemberId: string;
  createdAt: number;
}

export interface PlanningActivityEntry {
  id: string;
  actorMemberId: string;
  actorName: string;
  action: string;
  summary: string;
  timestamp: number;
}

export interface GoalReviewEntry {
  id: string;
  reviewerMemberId: string;
  reviewerName: string;
  notes: string;
  progressSnapshot: number;
  rating: number; // 1..5
  createdAt: number;
}

export interface GoalCompletionEvent {
  id: string;
  status: GoalStatus;
  actorMemberId: string;
  notes?: string;
  timestamp: number;
}

export interface AuthoritativeGoal {
  id: string;
  familyId: string;
  title: string;
  description: string;
  category: 'FINANCIAL' | 'HOUSEHOLD' | 'EDUCATION' | 'HEALTH' | 'SPIRITUAL' | 'MARRIAGE' | 'PARENTING' | 'LIFESTYLE' | 'OTHER';
  scope: GoalScope;
  horizon: GoalHorizon;
  isMeasurable: boolean;
  metricUnit?: string | null;
  targetValue?: number | null;
  currentValue?: number | null;
  budgetCents?: number;
  currentCents?: number;
  startDate: string | null;
  targetDate: string | null;
  priority: TaskPriority;
  ownerMemberId: string;
  ownerName: string;
  linkedMissionStatement: string | null;
  linkedVisionStatement: string | null;
  linkedToMission?: boolean;
  linkedToVision?: boolean;
  alignedValues: string[];
  status: GoalStatus;
  progressPercentage: number;
  progressPercent?: number;
  reviews: GoalReviewEntry[];
  completionHistory: GoalCompletionEvent[];
  isArchived: boolean;
  imageUrl?: string | null;
  bannerUrl?: string | null;
  version: number;
  createdAt: number;
  updatedAt: number;
  isDeleted: boolean;
}

export interface AuthoritativeProject {
  id: string;
  familyId: string;
  goalId: string | null;
  title: string;
  name: string; // Alias for backward compatibility with Stage 2
  description: string;
  ownerMemberId: string;
  leadMemberId: string; // Alias for Stage 2
  assignedMemberIds: string[];
  scope: ProjectScope;
  startDate: string | null;
  targetDate: string | null;
  status: ProjectStatus;
  priority: TaskPriority;
  budgetCents: number;
  dependencies: string[];
  dependencyProjectIds?: string[];
  progressPercentage: number;
  progressPercent?: number;
  comments: PlanningComment[];
  attachments: PlanningAttachment[];
  activityHistory: PlanningActivityEntry[];
  isArchived: boolean;
  completedAt: number | null;
  version: number;
  createdAt: number;
  updatedAt: number;
  isDeleted: boolean;
}

export interface AuthoritativeMilestone {
  id: string;
  familyId: string;
  projectId: string;
  goalId: string | null;
  title: string;
  description: string;
  ownerMemberId: string;
  dueDate: string | null;
  status: MilestoneStatus;
  isCompleted?: boolean;
  orderIndex: number;
  progressPercentage: number;
  progressPercent?: number;
  completedAt: number | null;
  version: number;
  createdAt: number;
  updatedAt: number;
  isDeleted: boolean;
}

export interface AuthoritativeChecklistItem {
  id: string;
  taskId: string;
  title: string;
  isDone: boolean;
  position: number;
  assignedMemberId?: string | null;
  completedAt?: number | null;
  updatedAt: number;
}

export interface TaskReminderEntry {
  id: string;
  taskId: string;
  offsetMinutesBeforeDue: number;
  label: string;
  channel: 'IN_APP' | 'PUSH';
}

export interface AuthoritativeTask {
  id: string;
  familyId: string;
  title: string;
  description: string;
  notes: string; // Backward-compatible alias
  creatorMemberId: string;
  assignedMemberId: string | null;
  assignedToName: string;
  scope: TaskScope;
  priority: TaskPriority;
  status: TaskStatus;
  isCompleted: boolean;
  completedAt: number | null;
  completedByMemberId: string | null;
  startDate: string | null;
  dueDate: string | null; // ISO YYYY-MM-DD or timestamp label
  dueLabel: string;
  dueEpoch: number | null;
  timezone: string;
  isOverdue: boolean;
  recurrenceRule: string | null; // e.g. 'FREQ=DAILY', 'FREQ=WEEKLY', 'FREQ=MONTHLY'
  estimatedDurationMinutes: number | null;
  actualDurationMinutes: number | null;
  goalId: string | null;
  projectId: string | null;
  milestoneId: string | null;
  parentTaskId: string | null;
  dependencyTaskIds: string[];
  sourceModule: CanonicalTaskSourceModule;
  checklistItems: AuthoritativeChecklistItem[];
  checklist?: AuthoritativeChecklistItem[];
  progressPercentage: number;
  progressPercent?: number;
  comments: PlanningComment[];
  attachments: PlanningAttachment[];
  reminders: TaskReminderEntry[];
  linkedCalendarEventId: string | null;
  rewardPoints: number;
  activityHistory: PlanningActivityEntry[];
  isArchived: boolean;
  version: number;
  createdAt: number;
  updatedAt: number;
  isDeleted: boolean;
}

export interface AuthoritativeChecklistTemplate {
  id: string;
  familyId: string;
  title: string;
  description: string;
  sourceModule: CanonicalTaskSourceModule;
  scope: TaskScope;
  creatorMemberId: string;
  items: Array<{
    title: string;
    position: number;
    assignedMemberId?: string | null;
  }>;
  version: number;
  createdAt: number;
  updatedAt: number;
  isDeleted: boolean;
}

export interface RewardRedemptionRule {
  id: string;
  title: string;
  costPoints: number;
  description: string;
  requiresApproval: boolean;
}

export interface RewardHistoryEntry {
  id: string;
  familyId: string;
  memberId: string;
  memberName: string;
  type: 'EARNED' | 'REDEEMED';
  pointsDelta: number; // Always positive for EARNED; redemption deducts from available balance only upon approval
  sourceTaskId?: string | null;
  redemptionRuleId?: string | null;
  title: string;
  status: 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';
  approvedByMemberId?: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface AuthoritativeRewardConfig {
  familyId: string;
  enabled: boolean; // Disabled by default per Section 9
  currencyName: string; // e.g., 'Family Coins' or 'Points'
  defaultTaskPoints: number;
  eligibleModules: CanonicalTaskSourceModule[];
  requiresApproval: boolean;
  disallowPunitiveDeductions: true; // Constitutional invariant
  redemptionRules: RewardRedemptionRule[];
  history: RewardHistoryEntry[];
  updatedAt: number;
}

/**
 * Checks whether a caller is part of the adult couple / household leadership for COUPLE-scoped records.
 */
export function canAccessCoupleScope(
  store: SharedStore,
  callerMembership: AuthoritativeMembership
): boolean {
  if (callerMembership.role === 'CHILD' || callerMembership.role === 'GUEST') {
    return false;
  }
  if (callerMembership.role === 'OWNER' || callerMembership.role === 'ADMIN') {
    return true;
  }
  const member = (store.familyMembers || []).find(
    (m) => m.id === callerMembership.memberProfileId && m.familyId === callerMembership.familyId
  );
  if (!member) return false;
  return ['SELF', 'SPOUSE', 'SPOUSE_PARTNER'].includes(member.relationshipToPrimary.toUpperCase());
}

/**
 * Checks whether a caller can view a Goal based on PERSONAL, COUPLE, or FAMILY scope.
 */
export function canViewGoal(
  store: SharedStore,
  callerMembership: AuthoritativeMembership,
  goal: AuthoritativeGoal
): boolean {
  if (goal.familyId !== callerMembership.familyId || goal.isDeleted) return false;
  if (goal.scope === 'PERSONAL') {
    return goal.ownerMemberId === callerMembership.memberProfileId;
  }
  if (goal.scope === 'COUPLE') {
    return canAccessCoupleScope(store, callerMembership);
  }
  return true;
}

/**
 * Checks whether a caller can mutate a Goal.
 */
export function canMutateGoal(
  store: SharedStore,
  callerMembership: AuthoritativeMembership,
  goal: AuthoritativeGoal,
  operation: 'CREATE' | 'UPDATE' | 'DELETE'
): boolean {
  if (callerMembership.role === 'GUEST') return false;
  if (goal.scope === 'PERSONAL') {
    return goal.ownerMemberId === callerMembership.memberProfileId;
  }
  if (goal.scope === 'COUPLE') {
    return canAccessCoupleScope(store, callerMembership);
  }
  // FAMILY scope
  if (operation === 'DELETE') {
    return callerMembership.role === 'OWNER' || callerMembership.role === 'ADMIN';
  }
  if (callerMembership.role === 'CHILD') {
    // Children can only edit goals they own
    return goal.ownerMemberId === callerMembership.memberProfileId;
  }
  return true;
}

/**
 * Checks whether a caller can view a Project.
 */
export function canViewProject(
  store: SharedStore,
  callerMembership: AuthoritativeMembership,
  project: AuthoritativeProject
): boolean {
  if (project.familyId !== callerMembership.familyId || project.isDeleted) return false;
  if (project.scope === 'PERSONAL') {
    return project.ownerMemberId === callerMembership.memberProfileId;
  }
  // If linked to a PERSONAL or COUPLE goal, enforce parent goal visibility
  if (project.goalId) {
    const parentGoal = (store.goals || []).find((g) => g.id === project.goalId && !g.isDeleted);
    if (parentGoal && !canViewGoal(store, callerMembership, parentGoal)) {
      return false;
    }
  }
  return true;
}

/**
 * Checks whether a caller can mutate a Project.
 */
export function canMutateProject(
  store: SharedStore,
  callerMembership: AuthoritativeMembership,
  project: AuthoritativeProject,
  operation: 'CREATE' | 'UPDATE' | 'DELETE'
): boolean {
  if (callerMembership.role === 'GUEST') return false;
  if (project.scope === 'PERSONAL') {
    return project.ownerMemberId === callerMembership.memberProfileId;
  }
  if (operation === 'DELETE') {
    return (
      callerMembership.role === 'OWNER' ||
      callerMembership.role === 'ADMIN' ||
      project.ownerMemberId === callerMembership.memberProfileId
    );
  }
  if (callerMembership.role === 'CHILD') {
    return (
      project.ownerMemberId === callerMembership.memberProfileId ||
      (project.assignedMemberIds || []).includes(callerMembership.memberProfileId)
    );
  }
  return true;
}

/**
 * Checks whether a caller can view a canonical Task.
 */
export function canViewTask(
  store: SharedStore,
  callerMembership: AuthoritativeMembership,
  task: AuthoritativeTask
): boolean {
  if (task.familyId !== callerMembership.familyId || task.isDeleted) return false;
  if (task.scope === 'PERSONAL') {
    return (
      task.creatorMemberId === callerMembership.memberProfileId ||
      task.assignedMemberId === callerMembership.memberProfileId
    );
  }
  if (task.sourceModule === 'MARRIAGE') {
    return canAccessCoupleScope(store, callerMembership);
  }
  if (task.goalId) {
    const parentGoal = (store.goals || []).find((g) => g.id === task.goalId && !g.isDeleted);
    if (parentGoal && !canViewGoal(store, callerMembership, parentGoal)) {
      return false;
    }
  }
  return true;
}

/**
 * Checks whether a caller can create, update, assign, or delete a Task.
 */
export function canMutateTask(
  store: SharedStore,
  callerMembership: AuthoritativeMembership,
  task: AuthoritativeTask,
  operation: 'CREATE' | 'UPDATE' | 'COMPLETE' | 'ASSIGN' | 'DELETE',
  proposedAssigneeMemberId?: string | null
): { allowed: boolean; errorCode?: string; errorMessage?: string } {
  if (callerMembership.role === 'GUEST') {
    return {
      allowed: false,
      errorCode: 'GUEST_READ_ONLY',
      errorMessage: 'GUEST role has read-only access and cannot create or modify tasks.',
    };
  }

  if (task.scope === 'PERSONAL') {
    const isOwner =
      task.creatorMemberId === callerMembership.memberProfileId ||
      task.assignedMemberId === callerMembership.memberProfileId;
    if (!isOwner) {
      return {
        allowed: false,
        errorCode: 'PERSONAL_TASK_PRIVACY_VIOLATION',
        errorMessage: 'Personal tasks can only be accessed or modified by their creator/owner.',
      };
    }
  }

  if (task.sourceModule === 'MARRIAGE' && !canAccessCoupleScope(store, callerMembership)) {
    return {
      allowed: false,
      errorCode: 'COUPLE_SCOPE_RESTRICTED',
      errorMessage: 'Marriage module tasks are restricted to adult couple members.',
    };
  }

  if (callerMembership.role === 'CHILD') {
    if (operation === 'DELETE' && task.scope === 'SHARED' && task.creatorMemberId !== callerMembership.memberProfileId) {
      return {
        allowed: false,
        errorCode: 'CHILD_DELETE_RESTRICTED',
        errorMessage: 'CHILD role cannot delete shared family tasks created by adults.',
      };
    }
    if (
      operation === 'ASSIGN' &&
      proposedAssigneeMemberId &&
      proposedAssigneeMemberId !== callerMembership.memberProfileId
    ) {
      return {
        allowed: false,
        errorCode: 'CHILD_ASSIGNMENT_RESTRICTED',
        errorMessage: 'CHILD role cannot assign or reassign tasks to other family members.',
      };
    }
  }

  return { allowed: true };
}

/**
 * Deterministic rollup engine:
 * Recalculates progress from Checklists -> Tasks -> Milestones -> Projects -> Goals
 * without creating duplicate progress records.
 */
export function recalculatePlanningHierarchyProgress(
  store: SharedStore,
  familyId: string
): void {
  const tasks = (store.planningTasks || []).filter((t) => t.familyId === familyId && !t.isDeleted);
  const milestones = (store.milestones || []).filter((m) => m.familyId === familyId && !m.isDeleted);
  const projects = (store.projects || []).filter((p) => p.familyId === familyId && !p.isDeleted);
  const goals = (store.goals || []).filter((g) => g.familyId === familyId && !g.isDeleted);

  // 1. Task progress from checklist items or completion flag
  for (const task of tasks) {
    const items = task.checklistItems || task.checklist || [];
    task.checklistItems = items;
    task.checklist = items;
    if (items.length > 0) {
      const doneCount = items.filter((i) => i.isDone).length;
      task.progressPercentage = Math.round((doneCount * 100) / items.length);
      if (doneCount === items.length) {
        task.progressPercentage = 100;
      } else if (task.isCompleted || task.status === 'COMPLETED') {
        task.progressPercentage = 100;
      }
    } else if (task.isCompleted || task.status === 'COMPLETED') {
      task.progressPercentage = 100;
    } else {
      task.progressPercentage =
        task.status === 'IN_PROGRESS' ? 50 : task.status === 'REVIEW' ? 75 : 0;
    }
    task.progressPercent = task.progressPercentage;
  }

  // 2. Milestone progress from linked tasks
  for (const ms of milestones) {
    const msTasks = tasks.filter((t) => t.milestoneId === ms.id && !t.isArchived);
    if (ms.status === 'COMPLETED' || ms.isCompleted) {
      ms.status = 'COMPLETED';
      ms.isCompleted = true;
      ms.progressPercentage = 100;
    } else if (msTasks.length > 0) {
      const sum = msTasks.reduce((acc, t) => acc + t.progressPercentage, 0);
      ms.progressPercentage = Math.round(sum / msTasks.length);
      if (msTasks.every((t) => t.isCompleted)) {
        ms.status = 'COMPLETED';
        ms.isCompleted = true;
        ms.completedAt = ms.completedAt || Date.now();
        ms.progressPercentage = 100;
      } else if (ms.progressPercentage > 0) {
        ms.status = 'IN_PROGRESS';
        ms.isCompleted = false;
      }
    } else {
      ms.isCompleted = false;
    }
    ms.progressPercent = ms.progressPercentage;
  }

  // 3. Project progress rolled up directly from linked Tasks (or Milestones if no tasks exist)
  for (const proj of projects) {
    const projTasks = tasks.filter((t) => t.projectId === proj.id && !t.isArchived);
    const projMilestones = milestones.filter((m) => m.projectId === proj.id && m.status !== 'ARCHIVED');

    if (proj.status === 'COMPLETED') {
      proj.progressPercentage = 100;
    } else if (projTasks.length > 0) {
      const sum = projTasks.reduce((acc, t) => acc + t.progressPercentage, 0);
      proj.progressPercentage = Math.round(sum / projTasks.length);
    } else if (projMilestones.length > 0) {
      const sum = projMilestones.reduce((acc, m) => acc + m.progressPercentage, 0);
      proj.progressPercentage = Math.round(sum / projMilestones.length);
    } else {
      proj.progressPercentage = proj.status === 'ACTIVE' ? (proj.progressPercentage || 0) : 0;
    }
    proj.progressPercent = proj.progressPercentage;
    proj.dependencyProjectIds = proj.dependencies || [];
  }

  // 4. Goal progress rolled up from linked Projects, direct Tasks, or measurable target/current values
  for (const goal of goals) {
    if (goal.status === 'COMPLETED') {
      goal.progressPercentage = 100;
      goal.progressPercent = 100;
      continue;
    }
    const goalProjects = projects.filter((p) => p.goalId === goal.id && !p.isArchived);
    const directGoalTasks = tasks.filter(
      (t) => t.goalId === goal.id && !t.projectId && !t.isArchived
    );

    if (goalProjects.length > 0 || directGoalTasks.length > 0) {
      const components: number[] = [];
      for (const p of goalProjects) components.push(p.progressPercentage);
      for (const t of directGoalTasks) components.push(t.progressPercentage);
      if (components.length > 0) {
        goal.progressPercentage = Math.round(
          components.reduce((a, b) => a + b, 0) / components.length
        );
      }
    } else if (
      goal.isMeasurable &&
      typeof goal.targetValue === 'number' &&
      goal.targetValue > 0 &&
      typeof goal.currentValue === 'number'
    ) {
      goal.progressPercentage = Math.min(
        100,
        Math.max(0, Math.round((goal.currentValue * 100) / goal.targetValue))
      );
    } else if (
      typeof goal.budgetCents === 'number' &&
      goal.budgetCents > 0 &&
      typeof goal.currentCents === 'number'
    ) {
      goal.progressPercentage = Math.min(
        100,
        Math.max(0, Math.round((goal.currentCents * 100) / goal.budgetCents))
      );
    } else {
      goal.progressPercentage = 0;
    }
    goal.progressPercent = goal.progressPercentage;
    goal.linkedToMission = Boolean(goal.linkedToMission ?? goal.linkedMissionStatement);
    goal.linkedToVision = Boolean(goal.linkedToVision ?? goal.linkedVisionStatement);
  }
}

/**
 * Synchronizes a task with a dueDate into the shared household Calendar (`CALENDAR_EVENT:cal-task-${task.id}`)
 * without creating duplicate calendar records or duplicate reminders.
 */
export function syncTaskWithCalendar(
  store: SharedStore,
  task: AuthoritativeTask,
  actorUserId: string
): SynchronizedEntityRecord | null {
  store.synchronizedEntities = store.synchronizedEntities || {};
  const calEntityId = `cal-task-${task.id}`;
  const calKey = `CALENDAR_EVENT:${calEntityId}`;

  if (task.isDeleted || task.isArchived || !task.dueDate) {
    if (store.synchronizedEntities[calKey]) {
      store.synchronizedEntities[calKey].isDeleted = true;
      store.synchronizedEntities[calKey].version += 1;
      store.synchronizedEntities[calKey].updatedAt = Date.now();
    }
    task.linkedCalendarEventId = null;
    return null;
  }

  const now = Date.now();
  const existing = store.synchronizedEntities[calKey];
  const isToday =
    task.dueDate.toLowerCase().includes('today') ||
    task.dueDate === new Date().toISOString().slice(0, 10);

  // Deduplicate reminders by offsetMinutesBeforeDue
  const seenOffsets = new Set<number>();
  const dedupedReminders: TaskReminderEntry[] = [];
  for (const rem of task.reminders || []) {
    const offset = Number(rem.offsetMinutesBeforeDue || 60);
    if (!seenOffsets.has(offset)) {
      seenOffsets.add(offset);
      dedupedReminders.push({
        id: rem.id || `rem-${task.id}-${offset}`,
        taskId: task.id,
        offsetMinutesBeforeDue: offset,
        label: rem.label || `${offset} mins before due`,
        channel: rem.channel || 'IN_APP',
      });
    }
  }
  task.reminders = dedupedReminders;
  task.linkedCalendarEventId = calEntityId;

  const calRecord: SynchronizedEntityRecord = {
    id: calEntityId,
    familyId: task.familyId,
    entityType: 'CALENDAR_EVENT',
    version: (existing?.version || 0) + 1,
    isDeleted: false,
    updatedAt: now,
    updatedByUserId: actorUserId,
    data: {
      id: calEntityId,
      familyId: task.familyId,
      title: task.title,
      timeLabel: task.dueDate,
      eventDate: task.dueDate,
      eventEpoch: task.dueEpoch || Date.parse(task.dueDate) || now,
      timezone: task.timezone || 'America/Los_Angeles',
      location: task.sourceModule.replace('_', ' '),
      category: 'TASK_DUE',
      sourceEntityId: task.id,
      sourceEntityType: 'TASK',
      scope: task.scope,
      creatorMemberId: task.creatorMemberId,
      assignedMemberId: task.assignedMemberId,
      isCompleted: task.isCompleted,
      isToday,
      reminders: dedupedReminders,
    },
  };

  store.synchronizedEntities[calKey] = calRecord;
  return calRecord;
}

/**
 * Computes the next occurrence ISO date (YYYY-MM-DD) for a recurring task rule.
 */
export function computeNextRecurrenceDateIso(
  currentDueDate: string | null,
  recurrenceRule: string
): { nextDateIso: string; nextEpoch: number } {
  const baseMs =
    currentDueDate && !Number.isNaN(Date.parse(currentDueDate))
      ? Date.parse(currentDueDate)
      : Date.now();
  const ruleUpper = recurrenceRule.toUpperCase();
  const dayMs = 24 * 3600 * 1000;

  let nextMs = baseMs + dayMs;
  if (ruleUpper.includes('DAILY')) {
    nextMs = baseMs + dayMs;
  } else if (ruleUpper.includes('BIWEEKLY') || ruleUpper.includes('INTERVAL=2;FREQ=WEEKLY')) {
    nextMs = baseMs + 14 * dayMs;
  } else if (ruleUpper.includes('WEEKLY')) {
    nextMs = baseMs + 7 * dayMs;
  } else if (ruleUpper.includes('MONTHLY')) {
    const d = new Date(baseMs);
    d.setUTCMonth(d.getUTCMonth() + 1);
    nextMs = d.getTime();
  } else if (ruleUpper.includes('YEARLY') || ruleUpper.includes('ANNUALLY')) {
    const d = new Date(baseMs);
    d.setUTCFullYear(d.getUTCFullYear() + 1);
    nextMs = d.getTime();
  }

  const isFullTimestamp = Boolean(currentDueDate && currentDueDate.includes('T'));
  const nextDateIso = isFullTimestamp
    ? new Date(nextMs).toISOString()
    : new Date(nextMs).toISOString().slice(0, 10);
  return { nextDateIso, nextEpoch: nextMs };
}

/**
 * Seeds default Stage 3.3.2 Unified Goals, Projects, Milestones, Universal Tasks,
 * Checklist Templates, and Optional Reward Configuration (disabled by default).
 */
export function buildDefaultStage332Data(now: number) {
  const defaultGoals: AuthoritativeGoal[] = [
    {
      id: 'goal-reserve',
      familyId: 'fam-1',
      title: '6-Month Family Emergency Reserve ($35,000 Target)',
      description: 'Maintain six months of core household operating expenses in liquid high-yield savings.',
      category: 'FINANCIAL',
      scope: 'FAMILY',
      horizon: 'LONG_TERM',
      isMeasurable: true,
      metricUnit: 'USD_CENTS',
      targetValue: 3500000,
      currentValue: 3080000,
      budgetCents: 3500000,
      currentCents: 3080000,
      startDate: '2026-01-01',
      targetDate: '2026-12-31',
      priority: 'HIGH',
      ownerMemberId: 'mem-sarah',
      ownerName: 'Sarah Henderson',
      linkedMissionStatement: 'To cultivate a warm, resilient, and well-ordered home where every generation is supported, heard, and equipped to thrive.',
      linkedVisionStatement: 'A multi-generational household operating with zero financial ambiguity, shared responsibility, and enduring family traditions.',
      alignedValues: ['Intentional Stewardship', 'Calm Preparedness'],
      status: 'ACTIVE',
      progressPercentage: 88,
      reviews: [
        {
          id: 'rev-goal-reserve-1',
          reviewerMemberId: 'mem-sarah',
          reviewerName: 'Sarah Henderson',
          notes: 'October automated sweep completed ahead of schedule.',
          progressSnapshot: 88,
          rating: 5,
          createdAt: now - 86400_000 * 7,
        },
      ],
      completionHistory: [],
      isArchived: false,
      version: 1,
      createdAt: now - 86400_000 * 60,
      updatedAt: now,
      isDeleted: false,
    },
    {
      id: 'goal-solar',
      familyId: 'fam-1',
      title: 'Home Solar & Whole-House Battery Resilience',
      description: 'Install roof solar array and backup LFP battery storage for storm outage protection.',
      category: 'HOUSEHOLD',
      scope: 'FAMILY',
      horizon: 'LONG_TERM',
      isMeasurable: true,
      metricUnit: 'kWh Capacity',
      targetValue: 27,
      currentValue: 18,
      budgetCents: 1500000,
      currentCents: 975000,
      startDate: '2026-06-01',
      targetDate: '2026-12-15',
      priority: 'HIGH',
      ownerMemberId: 'mem-david',
      ownerName: 'David Henderson',
      linkedMissionStatement: 'To cultivate a warm, resilient, and well-ordered home where every generation is supported, heard, and equipped to thrive.',
      linkedVisionStatement: 'A multi-generational household operating with zero financial ambiguity, shared responsibility, and enduring family traditions.',
      alignedValues: ['Calm Preparedness', 'Intentional Stewardship'],
      status: 'ACTIVE',
      progressPercentage: 65,
      reviews: [],
      completionHistory: [],
      isArchived: false,
      version: 1,
      createdAt: now - 86400_000 * 45,
      updatedAt: now,
      isDeleted: false,
    },
    {
      id: 'goal-traditions',
      familyId: 'fam-1',
      title: 'Digitize Grandma Martha’s 40 Heirloom Family Recipes',
      description: 'Preserve multi-generational culinary heritage with printable QR recipe cards.',
      category: 'LIFESTYLE',
      scope: 'FAMILY',
      horizon: 'SHORT_TERM',
      isMeasurable: true,
      metricUnit: 'Recipes',
      targetValue: 40,
      currentValue: 30,
      budgetCents: 25000,
      currentCents: 18750,
      startDate: '2026-09-01',
      targetDate: '2026-11-28',
      priority: 'MEDIUM',
      ownerMemberId: 'mem-martha',
      ownerName: 'Grandma Martha & Maya',
      linkedMissionStatement: 'To cultivate a warm, resilient, and well-ordered home where every generation is supported, heard, and equipped to thrive.',
      linkedVisionStatement: 'A multi-generational household operating with zero financial ambiguity, shared responsibility, and enduring family traditions.',
      alignedValues: ['Generational Connection', 'Joyful Hospitality'],
      status: 'ACTIVE',
      progressPercentage: 75,
      reviews: [],
      completionHistory: [],
      isArchived: false,
      version: 1,
      createdAt: now - 86400_000 * 30,
      updatedAt: now,
      isDeleted: false,
    },
    {
      id: 'goal-couple-retreat',
      familyId: 'fam-1',
      title: 'Annual Marriage Vision & Financial Alignment Retreat',
      description: 'Dedicated weekend check-in for 2027 parenting, giving, and marriage priorities.',
      category: 'MARRIAGE',
      scope: 'COUPLE',
      horizon: 'SHORT_TERM',
      isMeasurable: false,
      metricUnit: null,
      targetValue: null,
      currentValue: null,
      startDate: '2026-10-15',
      targetDate: '2026-11-20',
      priority: 'HIGH',
      ownerMemberId: 'mem-sarah',
      ownerName: 'Sarah & David Henderson',
      linkedMissionStatement: 'To cultivate a warm, resilient, and well-ordered home where every generation is supported, heard, and equipped to thrive.',
      linkedVisionStatement: 'A multi-generational household operating with zero financial ambiguity, shared responsibility, and enduring family traditions.',
      alignedValues: ['Truth & Transparency', 'Intentional Stewardship'],
      status: 'ACTIVE',
      progressPercentage: 50,
      reviews: [],
      completionHistory: [],
      isArchived: false,
      version: 1,
      createdAt: now - 86400_000 * 15,
      updatedAt: now,
      isDeleted: false,
    },
    {
      id: 'goal-david-personal',
      familyId: 'fam-1',
      title: 'David Personal Half-Marathon & Morning Prayer Discipline',
      description: 'Private personal fitness and spiritual contemplation goal.',
      category: 'HEALTH',
      scope: 'PERSONAL',
      horizon: 'SHORT_TERM',
      isMeasurable: true,
      metricUnit: 'Miles/Week',
      targetValue: 25,
      currentValue: 18,
      startDate: '2026-09-15',
      targetDate: '2026-12-01',
      priority: 'MEDIUM',
      ownerMemberId: 'mem-david',
      ownerName: 'David Henderson',
      linkedMissionStatement: null,
      linkedVisionStatement: null,
      alignedValues: ['Calm Preparedness'],
      status: 'ACTIVE',
      progressPercentage: 72,
      reviews: [],
      completionHistory: [],
      isArchived: false,
      version: 1,
      createdAt: now - 86400_000 * 20,
      updatedAt: now,
      isDeleted: false,
    },
  ];

  const defaultProjects: AuthoritativeProject[] = [
    {
      id: 'proj-solar-bids',
      familyId: 'fam-1',
      goalId: 'goal-solar',
      title: 'Contractor Bids & Municipal Net-Metering Approval',
      name: 'Contractor Bids & Municipal Net-Metering Approval',
      description: 'Collect 3 licensed installer proposals, structural roof audit, and utility interconnect permit.',
      ownerMemberId: 'mem-david',
      leadMemberId: 'mem-david',
      assignedMemberIds: ['mem-david', 'mem-sarah'],
      scope: 'SHARED',
      startDate: '2026-09-01',
      targetDate: '2026-11-30',
      status: 'ACTIVE',
      priority: 'HIGH',
      budgetCents: 1500000,
      dependencies: [],
      progressPercentage: 50,
      comments: [
        {
          id: 'cmt-proj-1',
          authorMemberId: 'mem-david',
          authorName: 'David Henderson',
          body: 'SunHarvest and Evergreen Solar both submitted 25-year panel warranties.',
          createdAt: now - 86400_000 * 2,
        },
      ],
      attachments: [
        {
          id: 'att-proj-1',
          fileName: 'Roof-Structural-Audit-2026.pdf',
          mimeType: 'application/pdf',
          url: '/docs/roof-structural-audit.pdf',
          uploadedByMemberId: 'mem-david',
          createdAt: now - 86400_000 * 3,
        },
      ],
      activityHistory: [
        {
          id: 'act-proj-1',
          actorMemberId: 'mem-david',
          actorName: 'David Henderson',
          action: 'PROJECT_CREATED',
          summary: 'Initialized Solar Contractor Bids project under Home Solar Goal',
          timestamp: now - 86400_000 * 30,
        },
      ],
      isArchived: false,
      completedAt: null,
      version: 1,
      createdAt: now - 86400_000 * 30,
      updatedAt: now,
      isDeleted: false,
    },
    {
      id: 'proj-treasury-sweep',
      familyId: 'fam-1',
      goalId: 'goal-reserve',
      title: 'Automated Monthly Treasury Sweep & Buffer Audit',
      name: 'Automated Monthly Treasury Sweep & Buffer Audit',
      description: 'Configure recurring checking-to-reserve transfers and quarterly insurance deductible review.',
      ownerMemberId: 'mem-sarah',
      leadMemberId: 'mem-sarah',
      assignedMemberIds: ['mem-sarah', 'mem-david'],
      scope: 'SHARED',
      startDate: '2026-08-01',
      targetDate: '2026-12-15',
      status: 'ACTIVE',
      priority: 'HIGH',
      budgetCents: 3500000,
      dependencies: [],
      progressPercentage: 75,
      comments: [],
      attachments: [],
      activityHistory: [],
      isArchived: false,
      completedAt: null,
      version: 1,
      createdAt: now - 86400_000 * 40,
      updatedAt: now,
      isDeleted: false,
    },
    {
      id: 'proj-heritage-cookbook',
      familyId: 'fam-1',
      goalId: 'goal-traditions',
      title: 'Henderson Kitchen Heritage Binder & QR Print Run',
      name: 'Henderson Kitchen Heritage Binder & QR Print Run',
      description: 'Photograph, test-cook, and format Grandma Martha’s recipes with laminated QR cards.',
      ownerMemberId: 'mem-maya',
      leadMemberId: 'mem-maya',
      assignedMemberIds: ['mem-martha', 'mem-maya', 'mem-sarah'],
      scope: 'SHARED',
      startDate: '2026-09-15',
      targetDate: '2026-11-25',
      status: 'ACTIVE',
      priority: 'MEDIUM',
      budgetCents: 25000,
      dependencies: [],
      progressPercentage: 75,
      comments: [],
      attachments: [],
      activityHistory: [],
      isArchived: false,
      completedAt: null,
      version: 1,
      createdAt: now - 86400_000 * 25,
      updatedAt: now,
      isDeleted: false,
    },
  ];

  const defaultMilestones: AuthoritativeMilestone[] = [
    {
      id: 'ms-solar-1',
      familyId: 'fam-1',
      projectId: 'proj-solar-bids',
      goalId: 'goal-solar',
      title: 'Phase 1: Structural Roof & Electrical Panel Load Audit',
      description: 'Verify 200A main service panel capacity and south-facing truss load rating.',
      ownerMemberId: 'mem-david',
      dueDate: '2026-10-25',
      status: 'COMPLETED',
      orderIndex: 1,
      progressPercentage: 100,
      completedAt: now - 86400_000 * 5,
      version: 1,
      createdAt: now - 86400_000 * 25,
      updatedAt: now - 86400_000 * 5,
      isDeleted: false,
    },
    {
      id: 'ms-solar-2',
      familyId: 'fam-1',
      projectId: 'proj-solar-bids',
      goalId: 'goal-solar',
      title: 'Phase 2: Finalize LFP Battery Installer Contract',
      description: 'Compare 3 bids and sign net-metering interconnection agreement.',
      ownerMemberId: 'mem-david',
      dueDate: '2026-11-15',
      status: 'IN_PROGRESS',
      orderIndex: 2,
      progressPercentage: 50,
      completedAt: null,
      version: 1,
      createdAt: now - 86400_000 * 20,
      updatedAt: now,
      isDeleted: false,
    },
    {
      id: 'ms-cookbook-1',
      familyId: 'fam-1',
      projectId: 'proj-heritage-cookbook',
      goalId: 'goal-traditions',
      title: 'Transcribe & Test-Cook First 30 Holiday Recipes',
      description: 'Standardize weights, prep times, and allergen tags.',
      ownerMemberId: 'mem-martha',
      dueDate: '2026-11-10',
      status: 'IN_PROGRESS',
      orderIndex: 1,
      progressPercentage: 75,
      completedAt: null,
      version: 1,
      createdAt: now - 86400_000 * 20,
      updatedAt: now,
      isDeleted: false,
    },
  ];

  const todayIso = new Date(now).toISOString().slice(0, 10);
  const tomorrowIso = new Date(now + 86400_000).toISOString().slice(0, 10);
  const overdueIso = new Date(now - 2 * 86400_000).toISOString().slice(0, 10);

  const defaultTasks: AuthoritativeTask[] = [
    {
      id: 'tsk-priority-1',
      familyId: 'fam-1',
      title: 'Finalize November Envelope Budget & Utility Cap',
      description: 'Review November heating and grocery envelope allocations before monthly auto-sweep.',
      notes: 'Review November heating and grocery envelope allocations before monthly auto-sweep.',
      creatorMemberId: 'mem-sarah',
      assignedMemberId: 'mem-sarah',
      assignedToName: 'Sarah Henderson',
      scope: 'SHARED',
      priority: 'HIGH',
      status: 'IN_PROGRESS',
      isCompleted: false,
      completedAt: null,
      completedByMemberId: null,
      startDate: todayIso,
      dueDate: todayIso,
      dueLabel: 'Today, 7:00 PM',
      dueEpoch: now,
      timezone: 'America/Los_Angeles',
      isOverdue: false,
      recurrenceRule: 'FREQ=MONTHLY',
      estimatedDurationMinutes: 30,
      actualDurationMinutes: null,
      goalId: 'goal-reserve',
      projectId: 'proj-treasury-sweep',
      milestoneId: null,
      parentTaskId: null,
      dependencyTaskIds: [],
      sourceModule: 'GOALS_PROJECTS',
      checklistItems: [
        {
          id: 'chk-p1-1',
          taskId: 'tsk-priority-1',
          title: 'Reconcile October grocery envelope receipts',
          isDone: true,
          position: 0,
          assignedMemberId: 'mem-sarah',
          completedAt: now - 3600_000,
          updatedAt: now - 3600_000,
        },
        {
          id: 'chk-p1-2',
          taskId: 'tsk-priority-1',
          title: 'Confirm $350 surplus transfer to Emergency Reserve',
          isDone: false,
          position: 1,
          assignedMemberId: 'mem-david',
          completedAt: null,
          updatedAt: now,
        },
      ],
      progressPercentage: 50,
      comments: [],
      attachments: [],
      reminders: [
        {
          id: 'rem-tsk-p1',
          taskId: 'tsk-priority-1',
          offsetMinutesBeforeDue: 60,
          label: '1 hour before due',
          channel: 'IN_APP',
        },
      ],
      linkedCalendarEventId: 'cal-task-tsk-priority-1',
      rewardPoints: 20,
      activityHistory: [],
      isArchived: false,
      version: 1,
      createdAt: now - 86400_000 * 3,
      updatedAt: now,
      isDeleted: false,
    },
    {
      id: 'tsk-priority-2',
      familyId: 'fam-1',
      title: 'Compare 3 licensed solar battery installer warranties',
      description: 'Evaluate 10-year vs 15-year throughput guarantees on LFP home battery units.',
      notes: 'Evaluate 10-year vs 15-year throughput guarantees on LFP home battery units.',
      creatorMemberId: 'mem-david',
      assignedMemberId: 'mem-david',
      assignedToName: 'David Henderson',
      scope: 'SHARED',
      priority: 'HIGH',
      status: 'IN_PROGRESS',
      isCompleted: false,
      completedAt: null,
      completedByMemberId: null,
      startDate: todayIso,
      dueDate: tomorrowIso,
      dueLabel: 'Tomorrow',
      dueEpoch: now + 86400_000,
      timezone: 'America/Los_Angeles',
      isOverdue: false,
      recurrenceRule: null,
      estimatedDurationMinutes: 45,
      actualDurationMinutes: null,
      goalId: 'goal-solar',
      projectId: 'proj-solar-bids',
      milestoneId: 'ms-solar-2',
      parentTaskId: null,
      dependencyTaskIds: [],
      sourceModule: 'GOALS_PROJECTS',
      checklistItems: [
        {
          id: 'chk-p2-1',
          taskId: 'tsk-priority-2',
          title: 'Verify UL 9540A fire safety certification on all 3 quotes',
          isDone: true,
          position: 0,
          assignedMemberId: 'mem-david',
          completedAt: now - 7200_000,
          updatedAt: now - 7200_000,
        },
        {
          id: 'chk-p2-2',
          taskId: 'tsk-priority-2',
          title: 'Confirm critical-load subpanel circuit list with Sarah',
          isDone: false,
          position: 1,
          assignedMemberId: 'mem-sarah',
          completedAt: null,
          updatedAt: now,
        },
      ],
      progressPercentage: 50,
      comments: [],
      attachments: [],
      reminders: [],
      linkedCalendarEventId: 'cal-task-tsk-priority-2',
      rewardPoints: 25,
      activityHistory: [],
      isArchived: false,
      version: 1,
      createdAt: now - 86400_000 * 4,
      updatedAt: now,
      isDeleted: false,
    },
    {
      id: 'tsk-priority-3',
      familyId: 'fam-1',
      title: 'Organize Cello Sheet Music & Robotics Notebook',
      description: 'Prepare school binder and digitize Grandma Martha’s cinnamon roll card.',
      notes: 'Prepare school binder and digitize Grandma Martha’s cinnamon roll card.',
      creatorMemberId: 'mem-sarah',
      assignedMemberId: 'mem-maya',
      assignedToName: 'Maya Henderson',
      scope: 'SHARED',
      priority: 'MEDIUM',
      status: 'COMPLETED',
      isCompleted: true,
      completedAt: now - 3600_000 * 4,
      completedByMemberId: 'mem-maya',
      startDate: todayIso,
      dueDate: tomorrowIso,
      dueLabel: 'Friday',
      dueEpoch: now + 86400_000,
      timezone: 'America/Los_Angeles',
      isOverdue: false,
      recurrenceRule: 'FREQ=WEEKLY',
      estimatedDurationMinutes: 25,
      actualDurationMinutes: 20,
      goalId: 'goal-traditions',
      projectId: 'proj-heritage-cookbook',
      milestoneId: 'ms-cookbook-1',
      parentTaskId: null,
      dependencyTaskIds: [],
      sourceModule: 'PARENTING',
      checklistItems: [
        {
          id: 'chk-p3-1',
          taskId: 'tsk-priority-3',
          title: 'Pack rosin and extra A-string in cello case',
          isDone: true,
          position: 0,
          assignedMemberId: 'mem-maya',
          completedAt: now - 3600_000 * 4,
          updatedAt: now - 3600_000 * 4,
        },
      ],
      progressPercentage: 100,
      comments: [],
      attachments: [],
      reminders: [],
      linkedCalendarEventId: 'cal-task-tsk-priority-3',
      rewardPoints: 15,
      activityHistory: [],
      isArchived: false,
      version: 1,
      createdAt: now - 86400_000 * 2,
      updatedAt: now - 3600_000 * 4,
      isDeleted: false,
    },
    {
      id: 'tsk-overdue-1',
      familyId: 'fam-1',
      title: 'Flush basement tankless water heater descaling loop',
      description: 'Annual vinegar circulation maintenance for Navien tankless unit.',
      notes: 'Annual vinegar circulation maintenance for Navien tankless unit.',
      creatorMemberId: 'mem-david',
      assignedMemberId: 'mem-david',
      assignedToName: 'David Henderson',
      scope: 'SHARED',
      priority: 'URGENT',
      status: 'TODO',
      isCompleted: false,
      completedAt: null,
      completedByMemberId: null,
      startDate: overdueIso,
      dueDate: overdueIso,
      dueLabel: 'Overdue by 2 days',
      dueEpoch: now - 2 * 86400_000,
      timezone: 'America/Los_Angeles',
      isOverdue: true,
      recurrenceRule: 'FREQ=YEARLY',
      estimatedDurationMinutes: 60,
      actualDurationMinutes: null,
      goalId: 'goal-solar',
      projectId: 'proj-solar-bids',
      milestoneId: 'ms-solar-1',
      parentTaskId: null,
      dependencyTaskIds: [],
      sourceModule: 'HOME_MANAGEMENT',
      checklistItems: [],
      progressPercentage: 0,
      comments: [],
      attachments: [],
      reminders: [],
      linkedCalendarEventId: 'cal-task-tsk-overdue-1',
      rewardPoints: 30,
      activityHistory: [],
      isArchived: false,
      version: 1,
      createdAt: now - 86400_000 * 5,
      updatedAt: now,
      isDeleted: false,
    },
    {
      id: 'tsk-overdue-2',
      familyId: 'fam-1',
      title: 'Upload Lucas updated anaphylaxis action card for school nurse',
      description: 'Signed pediatric allergy action form for Oakridge Elementary.',
      notes: 'Signed pediatric allergy action form for Oakridge Elementary.',
      creatorMemberId: 'mem-sarah',
      assignedMemberId: 'mem-sarah',
      assignedToName: 'Sarah Henderson',
      scope: 'SHARED',
      priority: 'HIGH',
      status: 'TODO',
      isCompleted: false,
      completedAt: null,
      completedByMemberId: null,
      startDate: overdueIso,
      dueDate: overdueIso,
      dueLabel: 'Overdue by 1 day',
      dueEpoch: now - 86400_000,
      timezone: 'America/Los_Angeles',
      isOverdue: true,
      recurrenceRule: null,
      estimatedDurationMinutes: 15,
      actualDurationMinutes: null,
      goalId: 'goal-reserve',
      projectId: null,
      milestoneId: null,
      parentTaskId: null,
      dependencyTaskIds: [],
      sourceModule: 'PARENTING',
      checklistItems: [],
      progressPercentage: 0,
      comments: [],
      attachments: [],
      reminders: [],
      linkedCalendarEventId: 'cal-task-tsk-overdue-2',
      rewardPoints: 10,
      activityHistory: [],
      isArchived: false,
      version: 1,
      createdAt: now - 86400_000 * 4,
      updatedAt: now,
      isDeleted: false,
    },
    {
      id: 'tsk-david-private-1',
      familyId: 'fam-1',
      title: 'Draft private anniversary letter & morning scripture reflection',
      description: 'Personal planning task visible only to David.',
      notes: 'Personal planning task visible only to David.',
      creatorMemberId: 'mem-david',
      assignedMemberId: 'mem-david',
      assignedToName: 'David Henderson',
      scope: 'PERSONAL',
      priority: 'HIGH',
      status: 'IN_PROGRESS',
      isCompleted: false,
      completedAt: null,
      completedByMemberId: null,
      startDate: todayIso,
      dueDate: tomorrowIso,
      dueLabel: 'Tomorrow',
      dueEpoch: now + 86400_000,
      timezone: 'America/Los_Angeles',
      isOverdue: false,
      recurrenceRule: null,
      estimatedDurationMinutes: 40,
      actualDurationMinutes: null,
      goalId: 'goal-david-personal',
      projectId: null,
      milestoneId: null,
      parentTaskId: null,
      dependencyTaskIds: [],
      sourceModule: 'SPIRITUAL_GROWTH',
      checklistItems: [],
      progressPercentage: 50,
      comments: [],
      attachments: [],
      reminders: [],
      linkedCalendarEventId: 'cal-task-tsk-david-private-1',
      rewardPoints: 0,
      activityHistory: [],
      isArchived: false,
      version: 1,
      createdAt: now - 86400_000,
      updatedAt: now,
      isDeleted: false,
    },
  ];

  const defaultTemplates: AuthoritativeChecklistTemplate[] = [
    {
      id: 'tpl-weekly-home-reset',
      familyId: 'fam-1',
      title: 'Weekly Home Reset Checklist',
      description: 'Reusable weekly preparation checklist for kitchen, backpacks, and calendar review.',
      sourceModule: 'HOME_MANAGEMENT',
      scope: 'SHARED',
      creatorMemberId: 'mem-sarah',
      items: [
        { title: 'Review 7-day meal plan & thaw Monday proteins', position: 0, assignedMemberId: 'mem-sarah' },
        { title: 'Pack school backpacks, instruments & signed forms', position: 1, assignedMemberId: 'mem-maya' },
        { title: 'Check entryway mudroom & charge device power banks', position: 2, assignedMemberId: 'mem-lucas' },
        { title: 'Confirm Monday morning calendar & carpool schedule', position: 3, assignedMemberId: 'mem-david' },
      ],
      version: 1,
      createdAt: now - 86400_000 * 30,
      updatedAt: now,
      isDeleted: false,
    },
    {
      id: 'tpl-sunday-reset',
      familyId: 'fam-1',
      title: 'Sunday Evening Household Reset Checklist',
      description: 'Reusable weekly preparation checklist for kitchen, backpacks, and calendar review.',
      sourceModule: 'HOME_MANAGEMENT',
      scope: 'SHARED',
      creatorMemberId: 'mem-sarah',
      items: [
        { title: 'Review 7-day meal plan & thaw Monday proteins', position: 0, assignedMemberId: 'mem-sarah' },
        { title: 'Pack school backpacks, instruments & signed forms', position: 1, assignedMemberId: 'mem-maya' },
        { title: 'Check entryway mudroom & charge device power banks', position: 2, assignedMemberId: 'mem-lucas' },
        { title: 'Confirm Monday morning calendar & carpool schedule', position: 3, assignedMemberId: 'mem-david' },
      ],
      version: 1,
      createdAt: now - 86400_000 * 30,
      updatedAt: now,
      isDeleted: false,
    },
    {
      id: 'tpl-family-council',
      familyId: 'fam-1',
      title: 'Monthly Family Governance Council Agenda',
      description: 'Reusable checklist for family mission review, gratitude sharing, and project milestones.',
      sourceModule: 'FAMILY_GOVERNANCE',
      scope: 'SHARED',
      creatorMemberId: 'mem-david',
      items: [
        { title: 'Read Family Motto & share one gratitude per person', position: 0, assignedMemberId: 'mem-sarah' },
        { title: 'Review upcoming birthdays, school events & travel', position: 1, assignedMemberId: 'mem-david' },
        { title: 'Update active family goal & milestone progress bars', position: 2, assignedMemberId: 'mem-maya' },
      ],
      version: 1,
      createdAt: now - 86400_000 * 30,
      updatedAt: now,
      isDeleted: false,
    },
  ];

  const defaultRewardConfig: AuthoritativeRewardConfig = {
    familyId: 'fam-1',
    enabled: false, // Disabled by default per Section 9
    currencyName: 'Family Coins',
    defaultTaskPoints: 15,
    eligibleModules: ['GOALS_PROJECTS', 'HOME_MANAGEMENT', 'PARENTING'],
    requiresApproval: true,
    disallowPunitiveDeductions: true,
    redemptionRules: [
      {
        id: 'rew-friday-movie',
        title: 'Choose Friday Family Movie & Homemade Popcorn Topping',
        costPoints: 50,
        description: 'Pick the feature film for Friday family night.',
        requiresApproval: true,
      },
      {
        id: 'rew-science-kit',
        title: 'STEM Robotics or Art Studio Supply Voucher ($25)',
        costPoints: 120,
        description: 'Redeemable toward a book, instrument accessory, or robotics kit.',
        requiresApproval: true,
      },
    ],
    history: [],
    updatedAt: now,
  };

  return {
    defaultGoals,
    defaultProjects,
    defaultMilestones,
    defaultTasks,
    defaultTemplates,
    defaultRewardConfig,
  };
}
