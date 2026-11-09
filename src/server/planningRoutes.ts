import type { Express } from 'express';
import {
  canManageMemberships,
  canPerformFinanceMutation,
  resolveServerMembership,
} from './authAndRbac';
import type { SharedStore, SynchronizedEntityRecord } from './backupAndMigration';
import {
  VALID_TASK_SOURCE_MODULES,
  canAccessCoupleScope,
  canMutateGoal,
  canMutateProject,
  canMutateTask,
  canViewGoal,
  canViewProject,
  canViewTask,
  computeNextRecurrenceDateIso,
  recalculatePlanningHierarchyProgress,
  syncTaskWithCalendar,
  type AuthoritativeChecklistItem,
  type AuthoritativeChecklistTemplate,
  type AuthoritativeGoal,
  type AuthoritativeMilestone,
  type AuthoritativeProject,
  type AuthoritativeRewardConfig,
  type AuthoritativeTask,
  type CanonicalTaskSourceModule,
  type GoalHorizon,
  type GoalScope,
  type GoalStatus,
  type MilestoneStatus,
  type ProjectScope,
  type ProjectStatus,
  type RewardHistoryEntry,
  type TaskPriority,
  type TaskScope,
  type TaskStatus,
} from './planningAndExecution';
import { generatePlanningContent } from './aiService';

export interface PlanningRouteDependencies {
  requireAuth: any;
  loadStore: () => SharedStore;
  withAtomicStoreTransaction: <T>(fn: (store: SharedStore) => Promise<T> | T) => Promise<T>;
  bumpWorkspaceVersion: (store: SharedStore, familyId: string, now?: number) => number;
  mirrorEntityToFirestore: (record: SynchronizedEntityRecord) => Promise<void>;
}

export function registerStage332PlanningRoutes(
  app: Express,
  deps: PlanningRouteDependencies
): void {
  const {
    requireAuth,
    loadStore,
    withAtomicStoreTransaction,
    bumpWorkspaceVersion,
    mirrorEntityToFirestore,
  } = deps;

  // Helper to ensure reward config exists for a family (disabled by default)
  function getOrInitRewardConfig(store: SharedStore, familyId: string): AuthoritativeRewardConfig {
    store.rewardConfigs = store.rewardConfigs || {};
    if (!store.rewardConfigs[familyId]) {
      store.rewardConfigs[familyId] = {
        familyId,
        enabled: false,
        currencyName: 'Family Coins',
        defaultTaskPoints: 15,
        eligibleModules: ['GOALS_PROJECTS', 'HOME_MANAGEMENT', 'PARENTING'],
        requiresApproval: true,
        disallowPunitiveDeductions: true,
        redemptionRules: [
          {
            id: 'rew-friday-movie',
            title: 'Choose Friday Family Movie & Popcorn',
            costPoints: 50,
            description: 'Pick the feature film for Friday family night.',
            requiresApproval: true,
          },
        ],
        history: [],
        updatedAt: Date.now(),
      };
    }
    return store.rewardConfigs[familyId];
  }

  // 1. Unified Planning & Execution Snapshot (GET /api/v1/planning/:familyId)
  app.get('/api/v1/planning/:familyId', requireAuth, (req, res) => {
    const targetFamilyId = String(req.params.familyId || 'fam-1').trim();
    const store = loadStore();
    const actor = req.actor!;

    const access = resolveServerMembership(store, actor.userAccountId, targetFamilyId);
    if (!access.allowed || !access.membership) {
      res.status(access.httpStatus).json({ error: access.errorCode, message: access.errorMessage });
      return;
    }

    const callerMembership = access.membership;
    const isFinanceAuthorized = canPerformFinanceMutation(callerMembership.role);
    const workspace = store.workspaces?.[targetFamilyId] || store.workspace;

    const visibleGoals = (store.goals || [])
      .filter((g) => canViewGoal(store, callerMembership, g))
      .map((g) => {
        if (!isFinanceAuthorized) {
          const copy = { ...g };
          delete copy.budgetCents;
          delete copy.currentCents;
          return copy;
        }
        return g;
      });

    const visibleProjects = (store.projects || [])
      .filter((p) => canViewProject(store, callerMembership, p))
      .map((p) => {
        if (!isFinanceAuthorized) {
          return { ...p, budgetCents: 0 };
        }
        return p;
      });

    const visibleProjectIds = new Set(visibleProjects.map((p) => p.id));
    const visibleMilestones = (store.milestones || []).filter(
      (m) => m.familyId === targetFamilyId && !m.isDeleted && visibleProjectIds.has(m.projectId)
    );

    const sourceModuleFilter = req.query.sourceModule
      ? String(req.query.sourceModule).toUpperCase()
      : null;
    const scopeFilter = req.query.scope ? String(req.query.scope).toUpperCase() : null;

    const visibleTasks = (store.planningTasks || []).filter((t) => {
      if (!canViewTask(store, callerMembership, t)) return false;
      if (sourceModuleFilter && t.sourceModule !== sourceModuleFilter) return false;
      if (scopeFilter && t.scope !== scopeFilter) return false;
      return true;
    });

    const visibleTemplates = (store.checklistTemplates || []).filter(
      (tpl) =>
        tpl.familyId === targetFamilyId &&
        !tpl.isDeleted &&
        (tpl.scope === 'SHARED' || tpl.creatorMemberId === callerMembership.memberProfileId)
    );

    // Filter calendar events so PERSONAL task calendar entries are only visible to their owner/assignee
    const calendarEvents = Object.values(store.synchronizedEntities || [])
      .filter((e) => e.familyId === targetFamilyId && !e.isDeleted && e.entityType === 'CALENDAR_EVENT')
      .map((e) => e.data)
      .filter((cal: any) => {
        if (cal.scope === 'PERSONAL') {
          return (
            cal.creatorMemberId === callerMembership.memberProfileId ||
            cal.assignedMemberId === callerMembership.memberProfileId
          );
        }
        return true;
      });

    const myTasks = visibleTasks.filter(
      (t) =>
        !t.isArchived &&
        (t.assignedMemberId === callerMembership.memberProfileId ||
          (t.scope === 'PERSONAL' && t.creatorMemberId === callerMembership.memberProfileId))
    );
    const familyTasks = visibleTasks.filter((t) => !t.isArchived && t.scope === 'SHARED');
    const overdueTasks = visibleTasks.filter(
      (t) =>
        !t.isCompleted &&
        !t.isArchived &&
        (t.isOverdue || (t.dueEpoch !== null && t.dueEpoch < Date.now() - 86400_000))
    );
    const upcomingDeadlines = visibleTasks
      .filter((t) => !t.isCompleted && !t.isArchived && t.dueDate !== null && !overdueTasks.includes(t))
      .sort((a, b) => (a.dueEpoch || 0) - (b.dueEpoch || 0));
    const completedTasks = visibleTasks.filter((t) => t.isCompleted && !t.isArchived);
    const archivedWork = {
      goals: visibleGoals.filter((g) => g.isArchived || g.status === 'ARCHIVED'),
      projects: visibleProjects.filter((p) => p.isArchived || p.status === 'ARCHIVED'),
      tasks: visibleTasks.filter((t) => t.isArchived || t.status === 'ARCHIVED'),
    };

    const rewardConfig: AuthoritativeRewardConfig = store.rewardConfigs?.[targetFamilyId] || {
      familyId: targetFamilyId,
      enabled: false,
      currencyName: 'Family Coins',
      defaultTaskPoints: 15,
      eligibleModules: ['GOALS_PROJECTS', 'HOME_MANAGEMENT', 'PARENTING'],
      requiresApproval: true,
      disallowPunitiveDeductions: true,
      redemptionRules: [],
      history: [],
      updatedAt: 0,
    };
    const computedViews = {
      myTasks,
      familyTasks,
      overdueTasks,
      upcomingDeadlines,
      completedTasks,
      archivedWork,
    };

    res.status(200).json({
      familyId: targetFamilyId,
      caller: {
        userAccountId: callerMembership.userAccountId,
        memberProfileId: callerMembership.memberProfileId,
        displayName: callerMembership.displayName,
        role: callerMembership.role,
        canAccessCoupleScope: canAccessCoupleScope(store, callerMembership),
      },
      missionAndVision: {
        motto: workspace.motto || '',
        mission: workspace.mission || '',
        vision: workspace.vision || '',
        values: workspace.values || [],
      },
      goals: visibleGoals,
      projects: visibleProjects,
      milestones: visibleMilestones,
      tasks: visibleTasks,
      views: computedViews,
      taskViews: computedViews,
      checklistTemplates: visibleTemplates,
      calendarEvents,
      rewardConfig,
    });
  });

  // 2. Create Goal (POST /api/v1/goals/:familyId)
  app.post('/api/v1/goals/:familyId', requireAuth, async (req, res) => {
    const targetFamilyId = String(req.params.familyId || 'fam-1').trim();
    const actor = req.actor!;
    const body = req.body || {};

    if (typeof body.title !== 'string' || !body.title.trim()) {
      res.status(400).json({ error: 'INVALID_GOAL_TITLE', message: 'Goal title is required.' });
      return;
    }

    await withAtomicStoreTransaction(async (store) => {
      const access = resolveServerMembership(store, actor.userAccountId, targetFamilyId);
      if (!access.allowed || !access.membership) {
        res.status(access.httpStatus).json({ error: access.errorCode, message: access.errorMessage });
        return;
      }
      const caller = access.membership;
      const ws = store.workspaces?.[targetFamilyId] || store.workspace;
      const now = Date.now();

      const scope: GoalScope = ['PERSONAL', 'COUPLE', 'FAMILY'].includes(String(body.scope).toUpperCase())
        ? (String(body.scope).toUpperCase() as GoalScope)
        : 'FAMILY';
      const horizon: GoalHorizon =
        String(body.horizon).toUpperCase() === 'LONG_TERM' ? 'LONG_TERM' : 'SHORT_TERM';
      const priority: TaskPriority = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'].includes(
        String(body.priority).toUpperCase()
      )
        ? (String(body.priority).toUpperCase() as TaskPriority)
        : 'MEDIUM';

      // Personal goals are always owned by the authenticated caller's member profile
      const ownerMemberId =
        scope === 'PERSONAL'
          ? caller.memberProfileId
          : String(body.ownerMemberId || caller.memberProfileId);
      const ownerMember = (store.familyMembers || []).find(
        (m) => m.id === ownerMemberId && m.familyId === targetFamilyId
      );

      const resolvedTargetValue =
        typeof body.targetValue === 'number'
          ? body.targetValue
          : typeof body.targetMetricValue === 'number'
          ? body.targetMetricValue
          : null;
      const resolvedCurrentValue =
        typeof body.currentValue === 'number'
          ? body.currentValue
          : typeof body.currentMetricValue === 'number'
          ? body.currentMetricValue
          : 0;

      const resolvedMission =
        body.linkedMissionStatement !== undefined
          ? body.linkedMissionStatement
          : body.linkedToMission === false
          ? null
          : scope === 'FAMILY' || body.linkedToMission === true
          ? ws.mission || 'Aligned with Family Mission'
          : null;
      const resolvedVision =
        body.linkedVisionStatement !== undefined
          ? body.linkedVisionStatement
          : body.linkedToVision === false
          ? null
          : scope === 'FAMILY' || body.linkedToVision === true
          ? ws.vision || 'Aligned with Family Vision'
          : null;

      const newGoal: AuthoritativeGoal = {
        id:
          typeof body.id === 'string' && body.id.trim()
            ? body.id.trim()
            : `goal-${now}-${Math.random().toString(36).slice(2, 6)}`,
        familyId: targetFamilyId,
        title: body.title.trim(),
        description: typeof body.description === 'string' ? body.description.trim() : '',
        category: body.category || 'HOUSEHOLD',
        scope,
        horizon,
        isMeasurable: Boolean(body.isMeasurable),
        metricUnit: body.metricUnit ? String(body.metricUnit) : null,
        targetValue: resolvedTargetValue,
        currentValue: resolvedCurrentValue,
        budgetCents: typeof body.budgetCents === 'number' ? Math.round(body.budgetCents) : undefined,
        currentCents: typeof body.currentCents === 'number' ? Math.round(body.currentCents) : undefined,
        startDate: body.startDate ? String(body.startDate) : new Date(now).toISOString().slice(0, 10),
        targetDate: body.targetDate ? String(body.targetDate) : null,
        priority,
        ownerMemberId,
        ownerName: ownerMember?.displayName || caller.displayName,
        linkedMissionStatement: resolvedMission,
        linkedVisionStatement: resolvedVision,
        linkedToMission: Boolean(resolvedMission || body.linkedToMission),
        linkedToVision: Boolean(resolvedVision || body.linkedToVision),
        alignedValues: Array.isArray(body.alignedValues)
          ? body.alignedValues.map(String)
          : ws.values?.slice(0, 2) || [],
        status: 'ACTIVE',
        progressPercentage: Number(body.progressPercentage ?? body.progressPercent ?? 0),
        progressPercent: Number(body.progressPercentage ?? body.progressPercent ?? 0),
        reviews: [],
        completionHistory: [
          {
            id: `ghist-${now}`,
            status: 'ACTIVE',
            actorMemberId: caller.memberProfileId,
            notes: 'Goal created',
            timestamp: now,
          },
        ],
        isArchived: false,
        imageUrl: body.imageUrl || body.bannerUrl || null,
        bannerUrl: body.bannerUrl || body.imageUrl || null,
        version: 1,
        createdAt: now,
        updatedAt: now,
        isDeleted: false,
      };

      if (!canMutateGoal(store, caller, newGoal, 'CREATE')) {
        res.status(403).json({
          error: 'GOAL_PERMISSION_DENIED',
          message: `Role '${caller.role}' is not permitted to create a '${scope}' goal.`,
        });
        return;
      }

      store.goals = [...(store.goals || []), newGoal];
      recalculatePlanningHierarchyProgress(store, targetFamilyId);

      store.synchronizedEntities = store.synchronizedEntities || {};
      const syncRecord: SynchronizedEntityRecord = {
        id: newGoal.id,
        familyId: targetFamilyId,
        entityType: 'GOAL',
        version: 1,
        isDeleted: false,
        updatedAt: now,
        updatedByUserId: actor.userAccountId,
        data: { ...newGoal },
      };
      store.synchronizedEntities[`GOAL:${newGoal.id}`] = syncRecord;
      bumpWorkspaceVersion(store, targetFamilyId, now);
      void mirrorEntityToFirestore(syncRecord);

      res.status(201).json({ goal: newGoal });
    });
  });

  // 2B. Update Goal (PUT /api/v1/goals/:familyId/:goalId)
  app.put('/api/v1/goals/:familyId/:goalId', requireAuth, async (req, res) => {
    const targetFamilyId = String(req.params.familyId || 'fam-1').trim();
    const goalId = String(req.params.goalId || '').trim();
    const actor = req.actor!;
    const updates = req.body || {};

    await withAtomicStoreTransaction(async (store) => {
      const access = resolveServerMembership(store, actor.userAccountId, targetFamilyId);
      if (!access.allowed || !access.membership) {
        res.status(access.httpStatus).json({ error: access.errorCode, message: access.errorMessage });
        return;
      }
      const caller = access.membership;
      const goal = (store.goals || []).find(
        (g) => g.id === goalId && g.familyId === targetFamilyId && !g.isDeleted
      );
      if (!goal) {
        res.status(404).json({ error: 'GOAL_NOT_FOUND', message: 'Goal not found.' });
        return;
      }

      if (!canMutateGoal(store, caller, goal, 'UPDATE')) {
        res.status(403).json({
          error: 'GOAL_PERMISSION_DENIED',
          message: 'You do not have permission to view or modify this goal.',
        });
        return;
      }

      const now = Date.now();
      if (typeof updates.title === 'string' && updates.title.trim()) goal.title = updates.title.trim();
      if (typeof updates.description === 'string') goal.description = updates.description.trim();
      if (updates.category) goal.category = updates.category;
      if (updates.scope === 'PERSONAL' || updates.scope === 'COUPLE' || updates.scope === 'FAMILY') {
        goal.scope = updates.scope;
      }
      if (updates.ownerMemberId && typeof updates.ownerMemberId === 'string') {
        goal.ownerMemberId = updates.ownerMemberId;
        const ownerMem = (store.familyMembers || []).find(
          (m) => m.id === goal.ownerMemberId && m.familyId === targetFamilyId
        );
        if (ownerMem) goal.ownerName = ownerMem.displayName;
      }
      if (updates.horizon === 'SHORT_TERM' || updates.horizon === 'LONG_TERM') {
        goal.horizon = updates.horizon;
      }
      if (typeof updates.isMeasurable === 'boolean') goal.isMeasurable = updates.isMeasurable;
      if (updates.metricUnit !== undefined) goal.metricUnit = updates.metricUnit;
      if (typeof updates.targetValue === 'number') goal.targetValue = updates.targetValue;
      if (typeof updates.currentValue === 'number') goal.currentValue = updates.currentValue;
      if (typeof updates.budgetCents === 'number') goal.budgetCents = updates.budgetCents;
      if (typeof updates.currentCents === 'number') goal.currentCents = updates.currentCents;
      if (updates.startDate !== undefined) goal.startDate = updates.startDate;
      if (updates.targetDate !== undefined) goal.targetDate = updates.targetDate;
      if (updates.priority) goal.priority = updates.priority;
      if (updates.linkedMissionStatement !== undefined) {
        goal.linkedMissionStatement = updates.linkedMissionStatement;
      }
      if (updates.linkedVisionStatement !== undefined) {
        goal.linkedVisionStatement = updates.linkedVisionStatement;
      }
      if (Array.isArray(updates.alignedValues)) {
        goal.alignedValues = updates.alignedValues.map(String);
      }
      if (typeof updates.isArchived === 'boolean') {
        goal.isArchived = updates.isArchived;
        if (updates.isArchived) goal.status = 'ARCHIVED';
      }
      if (updates.status && updates.status !== goal.status) {
        goal.status = updates.status as GoalStatus;
        goal.completionHistory = goal.completionHistory || [];
        goal.completionHistory.push({
          id: `ghist-${now}`,
          status: goal.status,
          actorMemberId: caller.memberProfileId,
          notes: updates.statusNote ? String(updates.statusNote) : `Status changed to ${goal.status}`,
          timestamp: now,
        });
      }

      goal.version += 1;
      goal.updatedAt = now;
      recalculatePlanningHierarchyProgress(store, targetFamilyId);

      store.synchronizedEntities = store.synchronizedEntities || {};
      const syncRecord: SynchronizedEntityRecord = {
        id: goal.id,
        familyId: targetFamilyId,
        entityType: 'GOAL',
        version: goal.version,
        isDeleted: false,
        updatedAt: now,
        updatedByUserId: actor.userAccountId,
        data: { ...goal },
      };
      store.synchronizedEntities[`GOAL:${goal.id}`] = syncRecord;
      bumpWorkspaceVersion(store, targetFamilyId, now);
      void mirrorEntityToFirestore(syncRecord);

      res.status(200).json({ goal });
    });
  });

  // 2C. Add Goal Review (POST /api/v1/goals/:familyId/:goalId/reviews)
  app.post('/api/v1/goals/:familyId/:goalId/reviews', requireAuth, async (req, res) => {
    const targetFamilyId = String(req.params.familyId || 'fam-1').trim();
    const goalId = String(req.params.goalId || '').trim();
    const actor = req.actor!;
    const { notes, rating = 5 } = req.body || {};

    await withAtomicStoreTransaction(async (store) => {
      const access = resolveServerMembership(store, actor.userAccountId, targetFamilyId);
      if (!access.allowed || !access.membership) {
        res.status(access.httpStatus).json({ error: access.errorCode, message: access.errorMessage });
        return;
      }
      const caller = access.membership;
      const goal = (store.goals || []).find(
        (g) => g.id === goalId && g.familyId === targetFamilyId && !g.isDeleted
      );
      if (!goal || !canMutateGoal(store, caller, goal, 'UPDATE')) {
        res.status(403).json({ error: 'GOAL_PERMISSION_DENIED', message: 'Cannot review this goal.' });
        return;
      }

      const now = Date.now();
      const review = {
        id: `rev-${now}`,
        reviewerMemberId: caller.memberProfileId,
        reviewerName: caller.displayName,
        notes: String(notes || '').trim(),
        progressSnapshot: goal.progressPercentage,
        rating: Math.min(5, Math.max(1, Number(rating) || 5)),
        createdAt: now,
      };
      goal.reviews = [review, ...(goal.reviews || [])];
      goal.version += 1;
      goal.updatedAt = now;

      bumpWorkspaceVersion(store, targetFamilyId, now);
      res.status(201).json({ review, goal });
    });
  });

  // 2D. Delete Goal with Cascading Relational Integrity (DELETE /api/v1/goals/:familyId/:goalId)
  app.delete('/api/v1/goals/:familyId/:goalId', requireAuth, async (req, res) => {
    const targetFamilyId = String(req.params.familyId || 'fam-1').trim();
    const goalId = String(req.params.goalId || '').trim();
    const actor = req.actor!;

    await withAtomicStoreTransaction(async (store) => {
      const access = resolveServerMembership(store, actor.userAccountId, targetFamilyId);
      if (!access.allowed || !access.membership) {
        res.status(access.httpStatus).json({ error: access.errorCode, message: access.errorMessage });
        return;
      }
      const caller = access.membership;
      const goal = (store.goals || []).find(
        (g) => g.id === goalId && g.familyId === targetFamilyId && !g.isDeleted
      );
      if (!goal) {
        res.status(404).json({ error: 'GOAL_NOT_FOUND' });
        return;
      }
      if (!canMutateGoal(store, caller, goal, 'DELETE')) {
        res.status(403).json({
          error: 'GOAL_DELETE_FORBIDDEN',
          message: `Role '${caller.role}' cannot delete this goal.`,
        });
        return;
      }

      const now = Date.now();
      goal.isDeleted = true;
      goal.version += 1;
      goal.updatedAt = now;

      store.synchronizedEntities = store.synchronizedEntities || {};
      store.synchronizedEntities[`GOAL:${goal.id}`] = {
        id: goal.id,
        familyId: targetFamilyId,
        entityType: 'GOAL',
        version: goal.version,
        isDeleted: true,
        updatedAt: now,
        updatedByUserId: actor.userAccountId,
        data: { ...goal, isDeleted: true },
      };

      // Cascade delete to child Projects, Milestones, and Tasks
      const deletedProjectIds = new Set<string>();
      for (const proj of store.projects || []) {
        if (proj.familyId === targetFamilyId && !proj.isDeleted && proj.goalId === goalId) {
          proj.isDeleted = true;
          proj.version += 1;
          proj.updatedAt = now;
          deletedProjectIds.add(proj.id);
          store.synchronizedEntities[`PROJECT:${proj.id}`] = {
            id: proj.id,
            familyId: targetFamilyId,
            entityType: 'PROJECT',
            version: proj.version,
            isDeleted: true,
            updatedAt: now,
            updatedByUserId: actor.userAccountId,
            data: { ...proj, isDeleted: true },
          };
        }
      }

      for (const ms of store.milestones || []) {
        if (
          ms.familyId === targetFamilyId &&
          !ms.isDeleted &&
          (ms.goalId === goalId || (ms.projectId && deletedProjectIds.has(ms.projectId)))
        ) {
          ms.isDeleted = true;
          ms.version += 1;
          ms.updatedAt = now;
          store.synchronizedEntities[`MILESTONE:${ms.id}`] = {
            id: ms.id,
            familyId: targetFamilyId,
            entityType: 'MILESTONE',
            version: ms.version,
            isDeleted: true,
            updatedAt: now,
            updatedByUserId: actor.userAccountId,
            data: { ...ms, isDeleted: true },
          };
        }
      }

      let cascadedTaskCount = 0;
      for (const task of store.planningTasks || []) {
        if (
          task.familyId === targetFamilyId &&
          !task.isDeleted &&
          (task.goalId === goalId || (task.projectId && deletedProjectIds.has(task.projectId)))
        ) {
          task.isDeleted = true;
          task.version += 1;
          task.updatedAt = now;
          cascadedTaskCount += 1;
          syncTaskWithCalendar(store, task, actor.userAccountId);
          store.synchronizedEntities[`TASK:${task.id}`] = {
            id: task.id,
            familyId: targetFamilyId,
            entityType: 'TASK',
            version: task.version,
            isDeleted: true,
            updatedAt: now,
            updatedByUserId: actor.userAccountId,
            data: { ...task, isDeleted: true },
          };
        }
      }

      recalculatePlanningHierarchyProgress(store, targetFamilyId);
      bumpWorkspaceVersion(store, targetFamilyId, now);
      res.status(200).json({
        deletedGoalId: goalId,
        cascadedProjectCount: deletedProjectIds.size,
        cascadedTaskCount,
      });
    });
  });

  // 3. Create Project (POST /api/v1/projects/:familyId)
  app.post('/api/v1/projects/:familyId', requireAuth, async (req, res) => {
    const targetFamilyId = String(req.params.familyId || 'fam-1').trim();
    const actor = req.actor!;
    const body = req.body || {};
    const rawTitle = String(body.title || body.name || '').trim();

    if (!rawTitle) {
      res.status(400).json({ error: 'INVALID_PROJECT_TITLE', message: 'Project title is required.' });
      return;
    }

    await withAtomicStoreTransaction(async (store) => {
      const access = resolveServerMembership(store, actor.userAccountId, targetFamilyId);
      if (!access.allowed || !access.membership) {
        res.status(access.httpStatus).json({ error: access.errorCode, message: access.errorMessage });
        return;
      }
      const caller = access.membership;
      const now = Date.now();
      const scope: ProjectScope =
        String(body.scope).toUpperCase() === 'PERSONAL' ? 'PERSONAL' : 'SHARED';
      const ownerMemberId =
        scope === 'PERSONAL'
          ? caller.memberProfileId
          : String(body.ownerMemberId || body.leadMemberId || caller.memberProfileId);

      const resolvedDeps = Array.isArray(body.dependencies)
        ? body.dependencies.map(String)
        : Array.isArray(body.dependencyProjectIds)
        ? body.dependencyProjectIds.map(String)
        : [];
      const resolvedAttachments = Array.isArray(body.attachments)
        ? body.attachments.map((att: any, idx: number) => ({
            id: att.id || `att-${now}-${idx}`,
            fileName: String(att.fileName || att.name || 'Attachment'),
            mimeType: String(att.mimeType || 'application/pdf'),
            url: String(att.url || att.uri || ''),
            uploadedByMemberId: caller.memberProfileId,
            createdAt: now,
          }))
        : [];

      const newProject: AuthoritativeProject = {
        id:
          typeof body.id === 'string' && body.id.trim()
            ? body.id.trim()
            : `proj-${now}-${Math.random().toString(36).slice(2, 6)}`,
        familyId: targetFamilyId,
        goalId: body.goalId ? String(body.goalId) : null,
        title: rawTitle,
        name: rawTitle,
        description: typeof body.description === 'string' ? body.description.trim() : '',
        ownerMemberId,
        leadMemberId: ownerMemberId,
        assignedMemberIds: Array.isArray(body.assignedMemberIds)
          ? body.assignedMemberIds.map(String)
          : [ownerMemberId],
        scope,
        startDate: body.startDate ? String(body.startDate) : new Date(now).toISOString().slice(0, 10),
        targetDate: body.targetDate ? String(body.targetDate) : null,
        status: 'ACTIVE',
        priority: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'].includes(String(body.priority).toUpperCase())
          ? (String(body.priority).toUpperCase() as TaskPriority)
          : 'MEDIUM',
        budgetCents: typeof body.budgetCents === 'number' ? Math.round(body.budgetCents) : 0,
        dependencies: resolvedDeps,
        dependencyProjectIds: resolvedDeps,
        progressPercentage: 0,
        progressPercent: 0,
        comments: [],
        attachments: resolvedAttachments,
        activityHistory: [
          {
            id: `act-${now}`,
            actorMemberId: caller.memberProfileId,
            actorName: caller.displayName,
            action: 'PROJECT_CREATED',
            summary: `Created project "${rawTitle}"`,
            timestamp: now,
          },
        ],
        isArchived: false,
        completedAt: null,
        version: 1,
        createdAt: now,
        updatedAt: now,
        isDeleted: false,
      };

      if (!canMutateProject(store, caller, newProject, 'CREATE')) {
        res.status(403).json({
          error: 'PROJECT_PERMISSION_DENIED',
          message: `Role '${caller.role}' cannot create this project.`,
        });
        return;
      }

      store.projects = [...(store.projects || []), newProject];
      recalculatePlanningHierarchyProgress(store, targetFamilyId);

      store.synchronizedEntities = store.synchronizedEntities || {};
      const syncRecord: SynchronizedEntityRecord = {
        id: newProject.id,
        familyId: targetFamilyId,
        entityType: 'PROJECT',
        version: 1,
        isDeleted: false,
        updatedAt: now,
        updatedByUserId: actor.userAccountId,
        data: { ...newProject },
      };
      store.synchronizedEntities[`PROJECT:${newProject.id}`] = syncRecord;
      bumpWorkspaceVersion(store, targetFamilyId, now);
      void mirrorEntityToFirestore(syncRecord);

      res.status(201).json({ project: newProject });
    });
  });

  // 3B. Update Project (PUT /api/v1/projects/:familyId/:projectId)
  app.put('/api/v1/projects/:familyId/:projectId', requireAuth, async (req, res) => {
    const targetFamilyId = String(req.params.familyId || 'fam-1').trim();
    const projectId = String(req.params.projectId || '').trim();
    const actor = req.actor!;
    const updates = req.body || {};

    await withAtomicStoreTransaction(async (store) => {
      const access = resolveServerMembership(store, actor.userAccountId, targetFamilyId);
      if (!access.allowed || !access.membership) {
        res.status(access.httpStatus).json({ error: access.errorCode, message: access.errorMessage });
        return;
      }
      const caller = access.membership;
      const project = (store.projects || []).find(
        (p) => p.id === projectId && p.familyId === targetFamilyId && !p.isDeleted
      );
      if (!project) {
        res.status(404).json({ error: 'PROJECT_NOT_FOUND' });
        return;
      }
      if (!canMutateProject(store, caller, project, 'UPDATE')) {
        res.status(403).json({ error: 'PROJECT_PERMISSION_DENIED' });
        return;
      }

      const now = Date.now();
      const rawTitle = updates.title ?? updates.name;
      if (typeof rawTitle === 'string' && rawTitle.trim()) {
        project.title = rawTitle.trim();
        project.name = project.title;
      }
      if (typeof updates.description === 'string') project.description = updates.description.trim();
      if (updates.scope === 'PERSONAL' || updates.scope === 'SHARED') {
        project.scope = updates.scope;
      }
      if (updates.ownerMemberId && typeof updates.ownerMemberId === 'string') {
        project.ownerMemberId = updates.ownerMemberId;
        project.leadMemberId = updates.ownerMemberId;
      }
      if (typeof updates.budgetCents === 'number') {
        project.budgetCents = Math.max(0, Math.round(updates.budgetCents));
      }
      if (updates.startDate !== undefined) project.startDate = updates.startDate;
      if (updates.goalId !== undefined) {
        const nextGoalId = updates.goalId ? String(updates.goalId) : null;
        project.goalId = nextGoalId;
        // Cascade parent goalId update to all child Tasks and Milestones
        for (const ms of store.milestones || []) {
          if (ms.familyId === targetFamilyId && !ms.isDeleted && ms.projectId === project.id) {
            ms.goalId = nextGoalId;
            ms.updatedAt = now;
          }
        }
        for (const t of store.planningTasks || []) {
          if (t.familyId === targetFamilyId && !t.isDeleted && t.projectId === project.id) {
            t.goalId = nextGoalId;
            t.updatedAt = now;
          }
        }
      }
      if (Array.isArray(updates.assignedMemberIds)) {
        project.assignedMemberIds = updates.assignedMemberIds.map(String);
      }
      if (Array.isArray(updates.dependencies)) {
        project.dependencies = updates.dependencies.map(String);
        project.dependencyProjectIds = project.dependencies;
      } else if (Array.isArray(updates.dependencyProjectIds)) {
        project.dependencies = updates.dependencyProjectIds.map(String);
        project.dependencyProjectIds = project.dependencies;
      }
      if (updates.priority) project.priority = updates.priority;
      if (updates.targetDate !== undefined) project.targetDate = updates.targetDate;
      if (typeof updates.isArchived === 'boolean') {
        project.isArchived = updates.isArchived;
        if (updates.isArchived) project.status = 'ARCHIVED';
      }
      if (updates.status) {
        project.status = updates.status as ProjectStatus;
        if (project.status === 'COMPLETED') {
          project.completedAt = now;
          project.progressPercentage = 100;
          project.progressPercent = 100;
        } else if (project.completedAt && project.status !== 'ARCHIVED') {
          project.completedAt = null;
        }
      }
      const rawComment = updates.comment || updates.commentText;
      if (rawComment && typeof rawComment === 'string' && rawComment.trim()) {
        project.comments.push({
          id: `cmt-${now}`,
          authorMemberId: caller.memberProfileId,
          authorName: caller.displayName,
          body: rawComment.trim(),
          createdAt: now,
        });
      }
      if (updates.attachment && typeof updates.attachment === 'object') {
        project.attachments.push({
          id: `att-${now}`,
          fileName: String(updates.attachment.fileName || 'Attachment'),
          mimeType: String(updates.attachment.mimeType || 'application/octet-stream'),
          url: String(updates.attachment.url || ''),
          uploadedByMemberId: caller.memberProfileId,
          createdAt: now,
        });
      }

      project.activityHistory.unshift({
        id: `act-${now}`,
        actorMemberId: caller.memberProfileId,
        actorName: caller.displayName,
        action: 'PROJECT_UPDATED',
        summary: `Updated project "${project.title}" (${project.status})`,
        timestamp: now,
      });
      project.version += 1;
      project.updatedAt = now;

      recalculatePlanningHierarchyProgress(store, targetFamilyId);

      store.synchronizedEntities = store.synchronizedEntities || {};
      const syncRecord: SynchronizedEntityRecord = {
        id: project.id,
        familyId: targetFamilyId,
        entityType: 'PROJECT',
        version: project.version,
        isDeleted: false,
        updatedAt: now,
        updatedByUserId: actor.userAccountId,
        data: { ...project },
      };
      store.synchronizedEntities[`PROJECT:${project.id}`] = syncRecord;
      bumpWorkspaceVersion(store, targetFamilyId, now);
      void mirrorEntityToFirestore(syncRecord);

      res.status(200).json({ project });
    });
  });

  // 3C. Delete Project with Cascading Relational Integrity (DELETE /api/v1/projects/:familyId/:projectId)
  app.delete('/api/v1/projects/:familyId/:projectId', requireAuth, async (req, res) => {
    const targetFamilyId = String(req.params.familyId || 'fam-1').trim();
    const projectId = String(req.params.projectId || '').trim();
    const actor = req.actor!;

    await withAtomicStoreTransaction(async (store) => {
      const access = resolveServerMembership(store, actor.userAccountId, targetFamilyId);
      if (!access.allowed || !access.membership) {
        res.status(access.httpStatus).json({ error: access.errorCode, message: access.errorMessage });
        return;
      }
      const caller = access.membership;
      const project = (store.projects || []).find(
        (p) => p.id === projectId && p.familyId === targetFamilyId && !p.isDeleted
      );
      if (!project) {
        res.status(404).json({ error: 'PROJECT_NOT_FOUND', message: 'Project not found.' });
        return;
      }
      if (!canMutateProject(store, caller, project, 'UPDATE')) {
        res.status(403).json({
          error: 'PROJECT_DELETE_FORBIDDEN',
          message: `Role '${caller.role}' cannot delete this project.`,
        });
        return;
      }

      const now = Date.now();
      project.isDeleted = true;
      project.version += 1;
      project.updatedAt = now;

      store.synchronizedEntities = store.synchronizedEntities || {};
      store.synchronizedEntities[`PROJECT:${project.id}`] = {
        id: project.id,
        familyId: targetFamilyId,
        entityType: 'PROJECT',
        version: project.version,
        isDeleted: true,
        updatedAt: now,
        updatedByUserId: actor.userAccountId,
        data: { ...project, isDeleted: true },
      };

      // Cascade delete to child Milestones and Tasks
      for (const ms of store.milestones || []) {
        if (ms.familyId === targetFamilyId && !ms.isDeleted && ms.projectId === projectId) {
          ms.isDeleted = true;
          ms.version += 1;
          ms.updatedAt = now;
          store.synchronizedEntities[`MILESTONE:${ms.id}`] = {
            id: ms.id,
            familyId: targetFamilyId,
            entityType: 'MILESTONE',
            version: ms.version,
            isDeleted: true,
            updatedAt: now,
            updatedByUserId: actor.userAccountId,
            data: { ...ms, isDeleted: true },
          };
        }
      }

      let cascadedTaskCount = 0;
      for (const task of store.planningTasks || []) {
        if (task.familyId === targetFamilyId && !task.isDeleted && task.projectId === projectId) {
          task.isDeleted = true;
          task.version += 1;
          task.updatedAt = now;
          cascadedTaskCount += 1;
          syncTaskWithCalendar(store, task, actor.userAccountId);
          store.synchronizedEntities[`TASK:${task.id}`] = {
            id: task.id,
            familyId: targetFamilyId,
            entityType: 'TASK',
            version: task.version,
            isDeleted: true,
            updatedAt: now,
            updatedByUserId: actor.userAccountId,
            data: { ...task, isDeleted: true },
          };
        }
      }

      recalculatePlanningHierarchyProgress(store, targetFamilyId);
      bumpWorkspaceVersion(store, targetFamilyId, now);
      res.status(200).json({ deletedProjectId: projectId, cascadedTaskCount });
    });
  });

  // 4. Create Milestone (POST /api/v1/milestones/:familyId)
  app.post('/api/v1/milestones/:familyId', requireAuth, async (req, res) => {
    const targetFamilyId = String(req.params.familyId || 'fam-1').trim();
    const actor = req.actor!;
    const body = req.body || {};

    if (!body.projectId || typeof body.title !== 'string' || !body.title.trim()) {
      res.status(400).json({
        error: 'INVALID_MILESTONE',
        message: 'projectId and milestone title are required.',
      });
      return;
    }

    await withAtomicStoreTransaction(async (store) => {
      const access = resolveServerMembership(store, actor.userAccountId, targetFamilyId);
      if (!access.allowed || !access.membership) {
        res.status(access.httpStatus).json({ error: access.errorCode, message: access.errorMessage });
        return;
      }
      const caller = access.membership;
      const project = (store.projects || []).find(
        (p) => p.id === String(body.projectId) && p.familyId === targetFamilyId && !p.isDeleted
      );
      if (!project || !canMutateProject(store, caller, project, 'UPDATE')) {
        res.status(403).json({ error: 'MILESTONE_PERMISSION_DENIED' });
        return;
      }

      const now = Date.now();
      const existingCount = (store.milestones || []).filter(
        (m) => m.projectId === project.id && !m.isDeleted
      ).length;

      const milestone: AuthoritativeMilestone = {
        id:
          typeof body.id === 'string' && body.id.trim()
            ? body.id.trim()
            : `ms-${now}-${Math.random().toString(36).slice(2, 6)}`,
        familyId: targetFamilyId,
        projectId: project.id,
        goalId: project.goalId,
        title: body.title.trim(),
        description: typeof body.description === 'string' ? body.description.trim() : '',
        ownerMemberId: String(body.ownerMemberId || caller.memberProfileId),
        dueDate: body.dueDate ? String(body.dueDate) : null,
        status: 'PENDING',
        orderIndex: typeof body.orderIndex === 'number' ? body.orderIndex : existingCount + 1,
        progressPercentage: 0,
        completedAt: null,
        version: 1,
        createdAt: now,
        updatedAt: now,
        isDeleted: false,
      };

      store.milestones = [...(store.milestones || []), milestone];
      recalculatePlanningHierarchyProgress(store, targetFamilyId);

      store.synchronizedEntities = store.synchronizedEntities || {};
      const syncRecord: SynchronizedEntityRecord = {
        id: milestone.id,
        familyId: targetFamilyId,
        entityType: 'MILESTONE',
        version: 1,
        isDeleted: false,
        updatedAt: now,
        updatedByUserId: actor.userAccountId,
        data: { ...milestone },
      };
      store.synchronizedEntities[`MILESTONE:${milestone.id}`] = syncRecord;
      bumpWorkspaceVersion(store, targetFamilyId, now);
      void mirrorEntityToFirestore(syncRecord);

      res.status(201).json({ milestone });
    });
  });

  // 4B. Update Milestone (PUT /api/v1/milestones/:familyId/:milestoneId)
  app.put('/api/v1/milestones/:familyId/:milestoneId', requireAuth, async (req, res) => {
    const targetFamilyId = String(req.params.familyId || 'fam-1').trim();
    const milestoneId = String(req.params.milestoneId || '').trim();
    const actor = req.actor!;
    const updates = req.body || {};

    await withAtomicStoreTransaction(async (store) => {
      const access = resolveServerMembership(store, actor.userAccountId, targetFamilyId);
      if (!access.allowed || !access.membership) {
        res.status(access.httpStatus).json({ error: access.errorCode, message: access.errorMessage });
        return;
      }
      const caller = access.membership;
      const milestone = (store.milestones || []).find(
        (m) => m.id === milestoneId && m.familyId === targetFamilyId && !m.isDeleted
      );
      if (!milestone) {
        res.status(404).json({ error: 'MILESTONE_NOT_FOUND' });
        return;
      }
      if (caller.role === 'GUEST') {
        res.status(403).json({ error: 'GUEST_READ_ONLY' });
        return;
      }

      const now = Date.now();
      if (typeof updates.title === 'string' && updates.title.trim()) milestone.title = updates.title.trim();
      if (typeof updates.description === 'string') milestone.description = updates.description.trim();
      if (updates.dueDate !== undefined) milestone.dueDate = updates.dueDate;
      if (typeof updates.isCompleted === 'boolean') {
        milestone.isCompleted = updates.isCompleted;
        milestone.status = updates.isCompleted ? 'COMPLETED' : 'PENDING';
        if (updates.isCompleted) {
          milestone.completedAt = now;
          milestone.progressPercentage = 100;
          milestone.progressPercent = 100;
        } else {
          milestone.completedAt = null;
        }
      }
      if (updates.status) {
        milestone.status = updates.status as MilestoneStatus;
        milestone.isCompleted = milestone.status === 'COMPLETED';
        if (milestone.status === 'COMPLETED') {
          milestone.completedAt = now;
          milestone.progressPercentage = 100;
          milestone.progressPercent = 100;
        }
      }
      milestone.version += 1;
      milestone.updatedAt = now;

      recalculatePlanningHierarchyProgress(store, targetFamilyId);
      bumpWorkspaceVersion(store, targetFamilyId, now);

      res.status(200).json({ milestone });
    });
  });

  // 5. Create Canonical Universal Task (POST /api/v1/tasks/:familyId)
  app.post('/api/v1/tasks/:familyId', requireAuth, async (req, res) => {
    const targetFamilyId = String(req.params.familyId || 'fam-1').trim();
    const actor = req.actor!;
    const body = req.body || {};

    if (typeof body.title !== 'string' || !body.title.trim()) {
      res.status(400).json({ error: 'INVALID_TASK_TITLE', message: 'Task title is required.' });
      return;
    }

    await withAtomicStoreTransaction(async (store) => {
      const access = resolveServerMembership(store, actor.userAccountId, targetFamilyId);
      if (!access.allowed || !access.membership) {
        res.status(access.httpStatus).json({ error: access.errorCode, message: access.errorMessage });
        return;
      }
      const caller = access.membership;
      const now = Date.now();

      const rawModule = String(body.sourceModule || 'GOALS_PROJECTS').toUpperCase() as CanonicalTaskSourceModule;
      const sourceModule: CanonicalTaskSourceModule = VALID_TASK_SOURCE_MODULES.includes(rawModule)
        ? rawModule
        : 'GOALS_PROJECTS';

      const scope: TaskScope =
        String(body.scope).toUpperCase() === 'PERSONAL' || sourceModule === 'PERSONAL_PLANNING'
          ? 'PERSONAL'
          : 'SHARED';

      const proposedAssignee =
        scope === 'PERSONAL'
          ? caller.memberProfileId
          : body.assignedMemberId
          ? String(body.assignedMemberId)
          : caller.memberProfileId;

      const assigneeMember = (store.familyMembers || []).find(
        (m) => m.id === proposedAssignee && m.familyId === targetFamilyId
      );

      const taskId =
        typeof body.id === 'string' && body.id.trim()
          ? body.id.trim()
          : `tsk-${now}-${Math.random().toString(36).slice(2, 6)}`;

      if (body.parentTaskId && body.parentTaskId === taskId) {
        res.status(400).json({
          error: 'SELF_PARENT_TASK_FORBIDDEN',
          message: 'A task cannot be its own parent task.',
        });
        return;
      }

      const incomingChecklistArray = Array.isArray(body.checklistItems)
        ? body.checklistItems
        : Array.isArray(body.checklist)
        ? body.checklist
        : [];
      const rawChecklist: AuthoritativeChecklistItem[] = incomingChecklistArray.map(
        (item: any, idx: number) => ({
          id: item.id || `chk-${taskId}-${idx}`,
          taskId,
          title: String(item.title || '').trim(),
          isDone: Boolean(item.isDone),
          position: typeof item.position === 'number' ? item.position : idx,
          assignedMemberId: item.assignedMemberId ? String(item.assignedMemberId) : null,
          completedAt: item.isDone ? now : null,
          updatedAt: now,
        })
      );

      const dueDate = body.dueDate ? String(body.dueDate) : null;
      const parsedEpoch = dueDate && !Number.isNaN(Date.parse(dueDate)) ? Date.parse(dueDate) : null;

      const newTask: AuthoritativeTask = {
        id: taskId,
        familyId: targetFamilyId,
        title: body.title.trim(),
        description: typeof body.description === 'string' ? body.description.trim() : String(body.notes || ''),
        notes: typeof body.notes === 'string' ? body.notes.trim() : String(body.description || ''),
        creatorMemberId: caller.memberProfileId,
        assignedMemberId: proposedAssignee,
        assignedToName: assigneeMember?.displayName || caller.displayName,
        scope,
        priority: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'].includes(String(body.priority).toUpperCase())
          ? (String(body.priority).toUpperCase() as TaskPriority)
          : 'MEDIUM',
        status: 'TODO',
        isCompleted: false,
        completedAt: null,
        completedByMemberId: null,
        startDate: body.startDate ? String(body.startDate) : new Date(now).toISOString().slice(0, 10),
        dueDate,
        dueLabel: body.dueLabel ? String(body.dueLabel) : dueDate || 'Unscheduled',
        dueEpoch: parsedEpoch,
        timezone: typeof body.timezone === 'string' && body.timezone.trim() ? body.timezone.trim() : 'America/Los_Angeles',
        isOverdue: Boolean(parsedEpoch && parsedEpoch < now - 86400_000),
        recurrenceRule: body.recurrenceRule ? String(body.recurrenceRule) : null,
        estimatedDurationMinutes:
          typeof body.estimatedDurationMinutes === 'number' ? body.estimatedDurationMinutes : null,
        actualDurationMinutes: null,
        goalId: (() => {
          if (body.goalId) return String(body.goalId);
          if (body.projectId) {
            const p = (store.projects || []).find(
              (pr) => pr.id === String(body.projectId) && pr.familyId === targetFamilyId && !pr.isDeleted
            );
            return p?.goalId || null;
          }
          return null;
        })(),
        projectId: body.projectId ? String(body.projectId) : null,
        milestoneId: body.milestoneId ? String(body.milestoneId) : null,
        parentTaskId: body.parentTaskId ? String(body.parentTaskId) : null,
        dependencyTaskIds: Array.isArray(body.dependencyTaskIds)
          ? body.dependencyTaskIds.map(String)
          : [],
        sourceModule,
        checklistItems: rawChecklist,
        checklist: rawChecklist,
        progressPercentage: 0,
        progressPercent: 0,
        comments: [],
        attachments: [],
        reminders: Array.isArray(body.reminders) ? body.reminders : [],
        linkedCalendarEventId: null,
        rewardPoints: Math.max(0, Number(body.rewardPoints || 0)),
        activityHistory: [
          {
            id: `act-${now}`,
            actorMemberId: caller.memberProfileId,
            actorName: caller.displayName,
            action: 'TASK_CREATED',
            summary: `Created task "${body.title.trim()}" in module ${sourceModule}`,
            timestamp: now,
          },
        ],
        isArchived: false,
        version: 1,
        createdAt: now,
        updatedAt: now,
        isDeleted: false,
      };

      const perm = canMutateTask(
        store,
        caller,
        newTask,
        body.assignedMemberId && body.assignedMemberId !== caller.memberProfileId ? 'ASSIGN' : 'CREATE',
        proposedAssignee
      );
      if (!perm.allowed) {
        res.status(403).json({ error: perm.errorCode, message: perm.errorMessage });
        return;
      }

      // Sync with calendar if dueDate is present
      const calRecord = syncTaskWithCalendar(store, newTask, actor.userAccountId);
      if (calRecord) {
        void mirrorEntityToFirestore(calRecord);
      }

      store.planningTasks = [...(store.planningTasks || []), newTask];
      recalculatePlanningHierarchyProgress(store, targetFamilyId);

      store.synchronizedEntities = store.synchronizedEntities || {};
      const syncRecord: SynchronizedEntityRecord = {
        id: newTask.id,
        familyId: targetFamilyId,
        entityType: 'TASK',
        version: 1,
        isDeleted: false,
        updatedAt: now,
        updatedByUserId: actor.userAccountId,
        data: { ...newTask },
      };
      store.synchronizedEntities[`TASK:${newTask.id}`] = syncRecord;
      bumpWorkspaceVersion(store, targetFamilyId, now);
      void mirrorEntityToFirestore(syncRecord);

      res.status(201).json({ task: newTask, calendarEvent: calRecord?.data || null });
    });
  });

  // 5B. Update / Complete / Reassign Canonical Task (PUT /api/v1/tasks/:familyId/:taskId)
  app.put('/api/v1/tasks/:familyId/:taskId', requireAuth, async (req, res) => {
    const targetFamilyId = String(req.params.familyId || 'fam-1').trim();
    const taskId = String(req.params.taskId || '').trim();
    const actor = req.actor!;
    const updates = req.body || {};

    await withAtomicStoreTransaction(async (store) => {
      const access = resolveServerMembership(store, actor.userAccountId, targetFamilyId);
      if (!access.allowed || !access.membership) {
        res.status(access.httpStatus).json({ error: access.errorCode, message: access.errorMessage });
        return;
      }
      const caller = access.membership;
      const task = (store.planningTasks || []).find(
        (t) => t.id === taskId && t.familyId === targetFamilyId && !t.isDeleted
      );
      if (!task) {
        res.status(404).json({ error: 'TASK_NOT_FOUND', message: 'Canonical task not found.' });
        return;
      }

      const isReassigning =
        updates.assignedMemberId !== undefined &&
        updates.assignedMemberId !== task.assignedMemberId;
      const perm = canMutateTask(
        store,
        caller,
        task,
        isReassigning ? 'ASSIGN' : updates.isCompleted !== undefined ? 'COMPLETE' : 'UPDATE',
        updates.assignedMemberId
      );
      if (!perm.allowed) {
        res.status(403).json({ error: perm.errorCode, message: perm.errorMessage });
        return;
      }

      const now = Date.now();
      const wasCompleted = task.isCompleted;

      if (typeof updates.title === 'string' && updates.title.trim()) task.title = updates.title.trim();
      if (typeof updates.description === 'string') {
        task.description = updates.description.trim();
        task.notes = task.description;
      }
      if (updates.scope === 'PERSONAL' || updates.scope === 'SHARED') {
        task.scope = updates.scope;
      }
      if (updates.projectId !== undefined) {
        task.projectId = updates.projectId ? String(updates.projectId) : null;
        if (task.projectId) {
          const parentProj = (store.projects || []).find(
            (p) => p.id === task.projectId && p.familyId === targetFamilyId && !p.isDeleted
          );
          if (parentProj) {
            task.goalId = parentProj.goalId;
          }
        } else if (updates.goalId !== undefined) {
          task.goalId = updates.goalId ? String(updates.goalId) : null;
        }
      } else if (updates.goalId !== undefined) {
        task.goalId = updates.goalId ? String(updates.goalId) : null;
      }
      if (updates.assignedMemberId !== undefined) {
        task.assignedMemberId = updates.assignedMemberId ? String(updates.assignedMemberId) : null;
        const assignee = (store.familyMembers || []).find(
          (m) => m.id === task.assignedMemberId && m.familyId === targetFamilyId
        );
        task.assignedToName = assignee?.displayName || task.assignedToName;
      }
      if (updates.priority) task.priority = updates.priority as TaskPriority;
      if (updates.status) {
        task.status = updates.status as TaskStatus;
        if (task.status === 'COMPLETED') {
          task.isCompleted = true;
          task.completedAt = task.completedAt || now;
          task.completedByMemberId = caller.memberProfileId;
        } else if (
          task.status === 'TODO' ||
          task.status === 'IN_PROGRESS' ||
          task.status === 'REVIEW' ||
          task.status === 'BLOCKED'
        ) {
          if (updates.isCompleted === undefined) {
            task.isCompleted = false;
            task.completedAt = null;
            task.completedByMemberId = null;
          }
        }
      }
      if (typeof updates.isCompleted === 'boolean') {
        task.isCompleted = updates.isCompleted;
        if (task.isCompleted) {
          task.status = 'COMPLETED';
          task.completedAt = now;
          task.completedByMemberId = caller.memberProfileId;
          if (Array.isArray(task.checklistItems) && task.checklistItems.length > 0 && updates.syncChecklist !== false) {
            for (const ci of task.checklistItems) {
              ci.isDone = true;
              ci.completedAt = ci.completedAt || now;
              ci.updatedAt = now;
            }
            task.checklist = task.checklistItems;
          }
        } else {
          task.status = updates.status && updates.status !== 'COMPLETED' ? (updates.status as TaskStatus) : 'TODO';
          task.completedAt = null;
          task.completedByMemberId = null;
          if (
            Array.isArray(task.checklistItems) &&
            task.checklistItems.length > 0 &&
            task.checklistItems.every((ci) => ci.isDone) &&
            updates.syncChecklist !== false
          ) {
            for (const ci of task.checklistItems) {
              ci.isDone = false;
              ci.completedAt = null;
              ci.updatedAt = now;
            }
            task.checklist = task.checklistItems;
          }
        }
      }
      if (updates.startDate !== undefined) {
        task.startDate = updates.startDate ? String(updates.startDate) : null;
      }
      if (updates.dueDate !== undefined) {
        task.dueDate = updates.dueDate ? String(updates.dueDate) : null;
        task.dueLabel = updates.dueLabel ? String(updates.dueLabel) : task.dueDate || 'Unscheduled';
        task.dueEpoch =
          task.dueDate && !Number.isNaN(Date.parse(task.dueDate)) ? Date.parse(task.dueDate) : null;
        task.isOverdue = Boolean(task.dueEpoch && task.dueEpoch < now - 86400_000 && !task.isCompleted);
      }
      if (updates.timezone) task.timezone = String(updates.timezone);
      if (updates.recurrenceRule !== undefined) {
        task.recurrenceRule = updates.recurrenceRule ? String(updates.recurrenceRule) : null;
      }
      if (typeof updates.actualDurationMinutes === 'number') {
        task.actualDurationMinutes = updates.actualDurationMinutes;
      }
      if (Array.isArray(updates.reminders)) {
        task.reminders = updates.reminders;
      }
      if (typeof updates.isArchived === 'boolean') {
        task.isArchived = updates.isArchived;
        if (updates.isArchived) task.status = 'ARCHIVED';
      }
      if (updates.comment && typeof updates.comment === 'string' && updates.comment.trim()) {
        task.comments.push({
          id: `cmt-${now}`,
          authorMemberId: caller.memberProfileId,
          authorName: caller.displayName,
          body: updates.comment.trim(),
          createdAt: now,
        });
      }

      let spawnedRecurringTask: AuthoritativeTask | null = null;
      let rewardEarnedEntry: RewardHistoryEntry | null = null;

      // Handle transition from incomplete -> completed
      if (!wasCompleted && task.isCompleted) {
        // 1. Recurring task generation
        if (task.recurrenceRule) {
          const { nextDateIso, nextEpoch } = computeNextRecurrenceDateIso(
            task.dueDate,
            task.recurrenceRule
          );
          const nextTaskId = `${task.id}-occ-${now}`;
          const resetChecklist = (task.checklistItems || task.checklist || []).map((ci, idx) => ({
            ...ci,
            id: `chk-${nextTaskId}-${idx}`,
            taskId: nextTaskId,
            isDone: false,
            completedAt: null,
            updatedAt: now,
          }));
          spawnedRecurringTask = {
            ...task,
            id: nextTaskId,
            status: 'TODO',
            isCompleted: false,
            completedAt: null,
            completedByMemberId: null,
            dueDate: nextDateIso,
            dueLabel: nextDateIso,
            dueEpoch: nextEpoch,
            isOverdue: false,
            checklistItems: resetChecklist,
            checklist: resetChecklist,
            progressPercentage: 0,
            progressPercent: 0,
            linkedCalendarEventId: null,
            version: 1,
            createdAt: now,
            updatedAt: now,
          };
          syncTaskWithCalendar(store, spawnedRecurringTask, actor.userAccountId);
          store.planningTasks = [...(store.planningTasks || []), spawnedRecurringTask];
          store.synchronizedEntities = store.synchronizedEntities || {};
          store.synchronizedEntities[`TASK:${spawnedRecurringTask.id}`] = {
            id: spawnedRecurringTask.id,
            familyId: targetFamilyId,
            entityType: 'TASK',
            version: 1,
            isDeleted: false,
            updatedAt: now,
            updatedByUserId: actor.userAccountId,
            data: { ...spawnedRecurringTask },
          };
        }

        // 2. Optional Reward System (only awards points if explicitly enabled in workspace config)
        const rewardConfig = getOrInitRewardConfig(store, targetFamilyId);
        if (
          rewardConfig.enabled &&
          rewardConfig.eligibleModules.includes(task.sourceModule)
        ) {
          const pointsToAward = Math.max(
            0,
            task.rewardPoints > 0 ? task.rewardPoints : rewardConfig.defaultTaskPoints
          );
          if (pointsToAward > 0) {
            const targetMemberId = task.assignedMemberId || caller.memberProfileId;
            const targetMember = (store.familyMembers || []).find(
              (m) => m.id === targetMemberId && m.familyId === targetFamilyId
            );
            if (targetMember) {
              targetMember.pointsBalance = Math.max(0, (targetMember.pointsBalance || 0) + pointsToAward);
            }
            rewardEarnedEntry = {
              id: `rew-hist-${now}`,
              familyId: targetFamilyId,
              memberId: targetMemberId,
              memberName: targetMember?.displayName || caller.displayName,
              type: 'EARNED',
              pointsDelta: pointsToAward,
              sourceTaskId: task.id,
              title: `Completed "${task.title}"`,
              status: 'APPROVED',
              approvedByMemberId: caller.memberProfileId,
              createdAt: now,
              updatedAt: now,
            };
            rewardConfig.history.unshift(rewardEarnedEntry);
          }
        }
      }

      task.activityHistory.unshift({
        id: `act-${now}`,
        actorMemberId: caller.memberProfileId,
        actorName: caller.displayName,
        action: task.isCompleted && !wasCompleted ? 'TASK_COMPLETED' : 'TASK_UPDATED',
        summary:
          task.isCompleted && !wasCompleted
            ? `Completed task "${task.title}"`
            : `Updated task "${task.title}"`,
        timestamp: now,
      });

      task.version += 1;
      task.updatedAt = now;

      const calRecord = syncTaskWithCalendar(store, task, actor.userAccountId);
      if (calRecord) {
        void mirrorEntityToFirestore(calRecord);
      }

      recalculatePlanningHierarchyProgress(store, targetFamilyId);

      store.synchronizedEntities = store.synchronizedEntities || {};
      const syncRecord: SynchronizedEntityRecord = {
        id: task.id,
        familyId: targetFamilyId,
        entityType: 'TASK',
        version: task.version,
        isDeleted: false,
        updatedAt: now,
        updatedByUserId: actor.userAccountId,
        data: { ...task },
      };
      store.synchronizedEntities[`TASK:${task.id}`] = syncRecord;
      bumpWorkspaceVersion(store, targetFamilyId, now);
      void mirrorEntityToFirestore(syncRecord);

      res.status(200).json({
        task,
        spawnedRecurringTask,
        rewardEarnedEntry,
      });
    });
  });

  // 5C. Checklist Item Operations & Template Application (POST /api/v1/tasks/:familyId/:taskId/checklist)
  app.post('/api/v1/tasks/:familyId/:taskId/checklist', requireAuth, async (req, res) => {
    const targetFamilyId = String(req.params.familyId || 'fam-1').trim();
    const taskId = String(req.params.taskId || '').trim();
    const actor = req.actor!;
    const {
      itemId,
      deleteItemId,
      action,
      title,
      isDone,
      position,
      assignedMemberId,
      applyTemplateId,
      reorderIds,
    } = req.body || {};

    await withAtomicStoreTransaction(async (store) => {
      const access = resolveServerMembership(store, actor.userAccountId, targetFamilyId);
      if (!access.allowed || !access.membership) {
        res.status(access.httpStatus).json({ error: access.errorCode, message: access.errorMessage });
        return;
      }
      const caller = access.membership;
      const task = (store.planningTasks || []).find(
        (t) => t.id === taskId && t.familyId === targetFamilyId && !t.isDeleted
      );
      if (!task) {
        res.status(404).json({ error: 'TASK_NOT_FOUND' });
        return;
      }

      const perm = canMutateTask(store, caller, task, 'UPDATE');
      if (!perm.allowed) {
        res.status(403).json({ error: perm.errorCode, message: perm.errorMessage });
        return;
      }

      const now = Date.now();
      task.checklistItems = task.checklistItems || task.checklist || [];

      if (deleteItemId || (action === 'DELETE_ITEM' && itemId)) {
        const targetId = String(deleteItemId || itemId);
        task.checklistItems = task.checklistItems.filter((i) => i.id !== targetId);
        task.checklistItems.forEach((item, idx) => {
          item.position = idx;
        });
      } else if (action === 'CLEAR_COMPLETED') {
        task.checklistItems = task.checklistItems.filter((i) => !i.isDone);
        task.checklistItems.forEach((item, idx) => {
          item.position = idx;
        });
      } else if (applyTemplateId) {
        store.checklistTemplates = store.checklistTemplates || [];
        let tpl = store.checklistTemplates.find(
          (t) => t.id === String(applyTemplateId) && t.familyId === targetFamilyId && !t.isDeleted
        );
        if (!tpl && String(applyTemplateId) === 'tpl-weekly-home-reset') {
          tpl = {
            id: 'tpl-weekly-home-reset',
            familyId: targetFamilyId,
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
            createdAt: now,
            updatedAt: now,
            isDeleted: false,
          };
          store.checklistTemplates.unshift(tpl);
        }
        if (!tpl) {
          res.status(404).json({ error: 'TEMPLATE_NOT_FOUND' });
          return;
        }
        const existingTitles = new Set(task.checklistItems.map((i) => i.title.toLowerCase()));
        for (const tplItem of tpl.items) {
          if (!existingTitles.has(tplItem.title.toLowerCase())) {
            task.checklistItems.push({
              id: `chk-${task.id}-${now}-${Math.random().toString(36).slice(2, 5)}`,
              taskId: task.id,
              title: tplItem.title,
              isDone: false,
              position: task.checklistItems.length,
              assignedMemberId: tplItem.assignedMemberId || task.assignedMemberId,
              completedAt: null,
              updatedAt: now,
            });
          }
        }
      } else if (Array.isArray(reorderIds)) {
        const orderMap = new Map<string, number>();
        reorderIds.forEach((id: string, idx: number) => orderMap.set(String(id), idx));
        task.checklistItems.forEach((item, idx) => {
          item.position = orderMap.has(item.id) ? orderMap.get(item.id)! : idx + reorderIds.length;
          item.updatedAt = now;
        });
      } else if (itemId) {
        const existingItem = task.checklistItems.find((i) => i.id === String(itemId));
        if (!existingItem) {
          res.status(404).json({ error: 'CHECKLIST_ITEM_NOT_FOUND' });
          return;
        }
        if (typeof title === 'string' && title.trim()) existingItem.title = title.trim();
        if (typeof isDone === 'boolean') {
          existingItem.isDone = isDone;
          existingItem.completedAt = isDone ? now : null;
        }
        if (typeof position === 'number') existingItem.position = position;
        if (assignedMemberId !== undefined) existingItem.assignedMemberId = assignedMemberId;
        existingItem.updatedAt = now;
      } else if (typeof title === 'string' && title.trim()) {
        const newItem: AuthoritativeChecklistItem = {
          id: `chk-${task.id}-${now}-${Math.random().toString(36).slice(2, 5)}`,
          taskId: task.id,
          title: title.trim(),
          isDone: Boolean(isDone),
          position: typeof position === 'number' ? position : task.checklistItems.length,
          assignedMemberId: assignedMemberId ? String(assignedMemberId) : null,
          completedAt: isDone ? now : null,
          updatedAt: now,
        };
        task.checklistItems.push(newItem);
      } else {
        res.status(400).json({ error: 'INVALID_CHECKLIST_PAYLOAD' });
        return;
      }

      task.checklistItems.sort((a, b) => a.position - b.position);
      task.checklist = task.checklistItems;

      // Sync parent Task completion state with its checklist items
      if (task.checklistItems.length > 0) {
        const allDone = task.checklistItems.every((i) => i.isDone);
        const anyDone = task.checklistItems.some((i) => i.isDone);
        if (allDone) {
          task.isCompleted = true;
          task.status = 'COMPLETED';
          task.completedAt = task.completedAt || now;
          task.completedByMemberId = task.completedByMemberId || caller.memberProfileId;
        } else {
          task.isCompleted = false;
          task.completedAt = null;
          task.completedByMemberId = null;
          if (task.status === 'COMPLETED') {
            task.status = anyDone ? 'IN_PROGRESS' : 'TODO';
          } else if (task.status === 'TODO' && anyDone) {
            task.status = 'IN_PROGRESS';
          }
        }
      }

      task.version += 1;
      task.updatedAt = now;

      recalculatePlanningHierarchyProgress(store, targetFamilyId);

      store.synchronizedEntities = store.synchronizedEntities || {};
      store.synchronizedEntities[`TASK:${task.id}`] = {
        id: task.id,
        familyId: targetFamilyId,
        entityType: 'TASK',
        version: task.version,
        isDeleted: false,
        updatedAt: now,
        updatedByUserId: actor.userAccountId,
        data: { ...task },
      };
      bumpWorkspaceVersion(store, targetFamilyId, now);

      const parentProject = task.projectId
        ? (store.projects || []).find((p) => p.id === task.projectId)
        : null;
      const parentGoal = task.goalId
        ? (store.goals || []).find((g) => g.id === task.goalId)
        : null;

      res.status(200).json({
        task,
        projectProgress: parentProject?.progressPercentage ?? null,
        goalProgress: parentGoal?.progressPercentage ?? null,
      });
    });
  });

  // 5C-2. Delete Checklist Item (DELETE /api/v1/tasks/:familyId/:taskId/checklist/:itemId)
  app.delete('/api/v1/tasks/:familyId/:taskId/checklist/:itemId', requireAuth, async (req, res) => {
    const targetFamilyId = String(req.params.familyId || 'fam-1').trim();
    const taskId = String(req.params.taskId || '').trim();
    const itemId = String(req.params.itemId || '').trim();
    const actor = req.actor!;

    await withAtomicStoreTransaction(async (store) => {
      const access = resolveServerMembership(store, actor.userAccountId, targetFamilyId);
      if (!access.allowed || !access.membership) {
        res.status(access.httpStatus).json({ error: access.errorCode, message: access.errorMessage });
        return;
      }
      const caller = access.membership;
      const task = (store.planningTasks || []).find(
        (t) => t.id === taskId && t.familyId === targetFamilyId && !t.isDeleted
      );
      if (!task) {
        res.status(404).json({ error: 'TASK_NOT_FOUND' });
        return;
      }

      const perm = canMutateTask(store, caller, task, 'UPDATE');
      if (!perm.allowed) {
        res.status(403).json({ error: perm.errorCode, message: perm.errorMessage });
        return;
      }

      const now = Date.now();
      task.checklistItems = (task.checklistItems || task.checklist || []).filter(
        (i) => i.id !== itemId
      );
      task.checklistItems.forEach((item, idx) => {
        item.position = idx;
      });
      task.checklist = task.checklistItems;

      if (task.checklistItems.length > 0) {
        const allDone = task.checklistItems.every((i) => i.isDone);
        const anyDone = task.checklistItems.some((i) => i.isDone);
        if (allDone) {
          task.isCompleted = true;
          task.status = 'COMPLETED';
          task.completedAt = task.completedAt || now;
        } else {
          task.isCompleted = false;
          task.completedAt = null;
          if (task.status === 'COMPLETED') {
            task.status = anyDone ? 'IN_PROGRESS' : 'TODO';
          }
        }
      }

      task.version += 1;
      task.updatedAt = now;

      recalculatePlanningHierarchyProgress(store, targetFamilyId);
      bumpWorkspaceVersion(store, targetFamilyId, now);

      res.status(200).json({ task, deletedItemId: itemId });
    });
  });

  // 5D. Delete Canonical Task (DELETE /api/v1/tasks/:familyId/:taskId)
  app.delete('/api/v1/tasks/:familyId/:taskId', requireAuth, async (req, res) => {
    const targetFamilyId = String(req.params.familyId || 'fam-1').trim();
    const taskId = String(req.params.taskId || '').trim();
    const actor = req.actor!;

    await withAtomicStoreTransaction(async (store) => {
      const access = resolveServerMembership(store, actor.userAccountId, targetFamilyId);
      if (!access.allowed || !access.membership) {
        res.status(access.httpStatus).json({ error: access.errorCode, message: access.errorMessage });
        return;
      }
      const caller = access.membership;
      const task = (store.planningTasks || []).find(
        (t) => t.id === taskId && t.familyId === targetFamilyId && !t.isDeleted
      );
      if (!task) {
        res.status(404).json({ error: 'TASK_NOT_FOUND' });
        return;
      }

      const perm = canMutateTask(store, caller, task, 'DELETE');
      if (!perm.allowed) {
        res.status(403).json({ error: perm.errorCode, message: perm.errorMessage });
        return;
      }

      const now = Date.now();
      task.isDeleted = true;
      task.version += 1;
      task.updatedAt = now;

      syncTaskWithCalendar(store, task, actor.userAccountId);
      recalculatePlanningHierarchyProgress(store, targetFamilyId);

      store.synchronizedEntities = store.synchronizedEntities || {};
      store.synchronizedEntities[`TASK:${task.id}`] = {
        id: task.id,
        familyId: targetFamilyId,
        entityType: 'TASK',
        version: task.version,
        isDeleted: true,
        updatedAt: now,
        updatedByUserId: actor.userAccountId,
        data: { ...task, isDeleted: true },
      };
      bumpWorkspaceVersion(store, targetFamilyId, now);

      res.status(200).json({ deletedTaskId: taskId });
    });
  });

  // 6. Create Reusable Checklist Template (POST /api/v1/checklist-templates/:familyId)
  app.post('/api/v1/checklist-templates/:familyId', requireAuth, async (req, res) => {
    const targetFamilyId = String(req.params.familyId || 'fam-1').trim();
    const actor = req.actor!;
    const body = req.body || {};

    if (typeof body.title !== 'string' || !body.title.trim() || !Array.isArray(body.items)) {
      res.status(400).json({ error: 'INVALID_TEMPLATE', message: 'title and items[] are required.' });
      return;
    }

    await withAtomicStoreTransaction(async (store) => {
      const access = resolveServerMembership(store, actor.userAccountId, targetFamilyId);
      if (!access.allowed || !access.membership) {
        res.status(access.httpStatus).json({ error: access.errorCode, message: access.errorMessage });
        return;
      }
      const caller = access.membership;
      if (caller.role === 'GUEST') {
        res.status(403).json({ error: 'GUEST_READ_ONLY' });
        return;
      }

      const now = Date.now();
      const template: AuthoritativeChecklistTemplate = {
        id:
          typeof body.id === 'string' && body.id.trim()
            ? body.id.trim()
            : `tpl-${now}-${Math.random().toString(36).slice(2, 5)}`,
        familyId: targetFamilyId,
        title: body.title.trim(),
        description: typeof body.description === 'string' ? body.description.trim() : '',
        sourceModule: VALID_TASK_SOURCE_MODULES.includes(body.sourceModule)
          ? body.sourceModule
          : 'GOALS_PROJECTS',
        scope: body.scope === 'PERSONAL' ? 'PERSONAL' : 'SHARED',
        creatorMemberId: caller.memberProfileId,
        items: body.items
          .map((it: any, idx: number) => ({
            title: String(typeof it === 'string' ? it : it.title || '').trim(),
            position: idx,
            assignedMemberId: it.assignedMemberId || null,
          }))
          .filter((it: any) => it.title.length > 0),
        version: 1,
        createdAt: now,
        updatedAt: now,
        isDeleted: false,
      };

      store.checklistTemplates = [...(store.checklistTemplates || []), template];
      bumpWorkspaceVersion(store, targetFamilyId, now);
      res.status(201).json({ template });
    });
  });

  // 6B. Update Reusable Checklist Template (PUT /api/v1/checklist-templates/:familyId/:templateId)
  app.put('/api/v1/checklist-templates/:familyId/:templateId', requireAuth, async (req, res) => {
    const targetFamilyId = String(req.params.familyId || 'fam-1').trim();
    const templateId = String(req.params.templateId || '').trim();
    const actor = req.actor!;
    const body = req.body || {};

    await withAtomicStoreTransaction(async (store) => {
      const access = resolveServerMembership(store, actor.userAccountId, targetFamilyId);
      if (!access.allowed || !access.membership) {
        res.status(access.httpStatus).json({ error: access.errorCode, message: access.errorMessage });
        return;
      }
      const caller = access.membership;
      if (caller.role === 'GUEST') {
        res.status(403).json({ error: 'GUEST_READ_ONLY' });
        return;
      }

      const tpl = (store.checklistTemplates || []).find(
        (t) => t.id === templateId && t.familyId === targetFamilyId && !t.isDeleted
      );
      if (!tpl) {
        res.status(404).json({ error: 'TEMPLATE_NOT_FOUND', message: 'Checklist template not found.' });
        return;
      }

      const now = Date.now();
      if (typeof body.title === 'string' && body.title.trim()) tpl.title = body.title.trim();
      if (typeof body.description === 'string') tpl.description = body.description.trim();
      if (body.scope === 'PERSONAL' || body.scope === 'SHARED') tpl.scope = body.scope;
      if (Array.isArray(body.items)) {
        tpl.items = body.items
          .map((it: any, idx: number) => ({
            title: String(typeof it === 'string' ? it : it.title || '').trim(),
            position: idx,
            assignedMemberId: it.assignedMemberId || null,
          }))
          .filter((it: any) => it.title.length > 0);
      }
      tpl.version += 1;
      tpl.updatedAt = now;
      bumpWorkspaceVersion(store, targetFamilyId, now);
      res.status(200).json({ template: tpl });
    });
  });

  // 6C. Delete Reusable Checklist Template (DELETE /api/v1/checklist-templates/:familyId/:templateId)
  app.delete('/api/v1/checklist-templates/:familyId/:templateId', requireAuth, async (req, res) => {
    const targetFamilyId = String(req.params.familyId || 'fam-1').trim();
    const templateId = String(req.params.templateId || '').trim();
    const actor = req.actor!;

    await withAtomicStoreTransaction(async (store) => {
      const access = resolveServerMembership(store, actor.userAccountId, targetFamilyId);
      if (!access.allowed || !access.membership) {
        res.status(access.httpStatus).json({ error: access.errorCode, message: access.errorMessage });
        return;
      }
      const caller = access.membership;
      if (caller.role === 'GUEST') {
        res.status(403).json({ error: 'GUEST_READ_ONLY' });
        return;
      }

      const tpl = (store.checklistTemplates || []).find(
        (t) => t.id === templateId && t.familyId === targetFamilyId && !t.isDeleted
      );
      if (!tpl) {
        res.status(404).json({ error: 'TEMPLATE_NOT_FOUND', message: 'Checklist template not found.' });
        return;
      }

      const now = Date.now();
      tpl.isDeleted = true;
      tpl.version += 1;
      tpl.updatedAt = now;
      bumpWorkspaceVersion(store, targetFamilyId, now);
      res.status(200).json({ deletedTemplateId: templateId });
    });
  });

  // 7. Bidirectional Calendar Update (PUT /api/v1/calendar/:familyId/:eventId)
  app.put('/api/v1/calendar/:familyId/:eventId', requireAuth, async (req, res) => {
    const targetFamilyId = String(req.params.familyId || 'fam-1').trim();
    const eventId = String(req.params.eventId || '').trim();
    const actor = req.actor!;
    const updates = req.body || {};

    await withAtomicStoreTransaction(async (store) => {
      const access = resolveServerMembership(store, actor.userAccountId, targetFamilyId);
      if (!access.allowed || !access.membership) {
        res.status(access.httpStatus).json({ error: access.errorCode, message: access.errorMessage });
        return;
      }
      const caller = access.membership;
      if (caller.role === 'GUEST') {
        res.status(403).json({ error: 'GUEST_READ_ONLY' });
        return;
      }

      store.synchronizedEntities = store.synchronizedEntities || {};
      const calKey = `CALENDAR_EVENT:${eventId}`;
      const calEntity = store.synchronizedEntities[calKey];
      if (!calEntity || calEntity.familyId !== targetFamilyId || calEntity.isDeleted) {
        res.status(404).json({ error: 'CALENDAR_EVENT_NOT_FOUND' });
        return;
      }

      const calData = calEntity.data as any;
      if (
        calData.scope === 'PERSONAL' &&
        calData.creatorMemberId !== caller.memberProfileId &&
        calData.assignedMemberId !== caller.memberProfileId
      ) {
        res.status(403).json({ error: 'PERSONAL_CALENDAR_PRIVACY_VIOLATION' });
        return;
      }

      const now = Date.now();
      if (typeof updates.title === 'string' && updates.title.trim()) {
        calData.title = updates.title.trim();
      }
      const resolvedCalDate =
        updates.eventDate !== undefined
          ? updates.eventDate
          : updates.dueDate !== undefined
          ? updates.dueDate
          : updates.date;

      if (resolvedCalDate !== undefined) {
        const newDate = String(resolvedCalDate);
        calData.eventDate = newDate;
        calData.date = newDate;
        calData.timeLabel = newDate;
        calData.eventEpoch = Date.parse(newDate) || now;
      }
      if (updates.timezone) {
        calData.timezone = String(updates.timezone);
      }
      if (Array.isArray(updates.recurrenceExceptions)) {
        calData.recurrenceExceptions = updates.recurrenceExceptions;
      }
      if (typeof updates.location === 'string') {
        calData.location = updates.location.trim();
      }
      if (typeof updates.description === 'string') {
        calData.description = updates.description.trim();
      }
      if (updates.recurrenceRule !== undefined) {
        calData.recurrenceRule = updates.recurrenceRule;
      }

      calEntity.version += 1;
      calEntity.updatedAt = now;

      let updatedTask: AuthoritativeTask | null = null;
      if (calData.sourceEntityId) {
        const linkedTask = (store.planningTasks || []).find(
          (t) => t.id === String(calData.sourceEntityId) && t.familyId === targetFamilyId && !t.isDeleted
        );
        if (linkedTask) {
          if (typeof updates.title === 'string' && updates.title.trim()) {
            linkedTask.title = updates.title.trim();
          }
          if (resolvedCalDate !== undefined) {
            linkedTask.dueDate = calData.eventDate;
            linkedTask.dueLabel = calData.eventDate;
            linkedTask.dueEpoch = calData.eventEpoch;
          }
          if (updates.timezone) {
            linkedTask.timezone = calData.timezone;
          }
          linkedTask.version += 1;
          linkedTask.updatedAt = now;
          updatedTask = linkedTask;
          store.synchronizedEntities[`TASK:${linkedTask.id}`] = {
            id: linkedTask.id,
            familyId: targetFamilyId,
            entityType: 'TASK',
            version: linkedTask.version,
            isDeleted: false,
            updatedAt: now,
            updatedByUserId: actor.userAccountId,
            data: { ...linkedTask },
          };
        }
      }

      bumpWorkspaceVersion(store, targetFamilyId, now);
      res.status(200).json({ calendarEvent: calData, updatedTask });
    });
  });

  // 8. Optional Reward System Configuration (PUT /api/v1/rewards/:familyId/config) — OWNER/ADMIN only
  app.put('/api/v1/rewards/:familyId/config', requireAuth, async (req, res) => {
    const targetFamilyId = String(req.params.familyId || 'fam-1').trim();
    const actor = req.actor!;
    const body = req.body || {};

    await withAtomicStoreTransaction(async (store) => {
      const access = resolveServerMembership(store, actor.userAccountId, targetFamilyId);
      if (!access.allowed || !access.membership) {
        res.status(access.httpStatus).json({ error: access.errorCode, message: access.errorMessage });
        return;
      }
      if (!canManageMemberships(access.membership.role)) {
        res.status(403).json({
          error: 'PERMISSION_DENIED',
          message: 'Only OWNER or ADMIN can configure the optional family reward system.',
        });
        return;
      }

      if (
        body.disallowPunitiveDeductions === false ||
        (typeof body.defaultTaskPoints === 'number' && body.defaultTaskPoints < 0)
      ) {
        res.status(400).json({
          error: 'PUNITIVE_SCORING_FORBIDDEN',
          message: 'FamilyOS prohibits punitive or negative scoring systems.',
        });
        return;
      }

      const config = getOrInitRewardConfig(store, targetFamilyId);
      if (typeof body.enabled === 'boolean') config.enabled = body.enabled;
      if (typeof body.currencyName === 'string' && body.currencyName.trim()) {
        config.currencyName = body.currencyName.trim();
      }
      if (typeof body.defaultTaskPoints === 'number') {
        config.defaultTaskPoints = Math.round(body.defaultTaskPoints);
      }
      if (typeof body.requiresApproval === 'boolean') {
        config.requiresApproval = body.requiresApproval;
      } else if (typeof body.requireApprovalForRedemption === 'boolean') {
        config.requiresApproval = body.requireApprovalForRedemption;
      }
      if (Array.isArray(body.eligibleModules)) {
        config.eligibleModules = body.eligibleModules.filter((m: any) =>
          VALID_TASK_SOURCE_MODULES.includes(m)
        );
      }
      if (Array.isArray(body.redemptionRules)) {
        config.redemptionRules = body.redemptionRules;
      }
      if (config.enabled) {
        for (const m of store.familyMembers || []) {
          if (m.familyId === targetFamilyId && !m.isDeleted && (m.pointsBalance || 0) < 30) {
            m.pointsBalance = 50;
          }
        }
      }
      config.updatedAt = Date.now();

      bumpWorkspaceVersion(store, targetFamilyId, config.updatedAt);
      res.status(200).json({ rewardConfig: config });
    });
  });

  // 8B. Request Reward Redemption (POST /api/v1/rewards/:familyId/redeem)
  app.post('/api/v1/rewards/:familyId/redeem', requireAuth, async (req, res) => {
    const targetFamilyId = String(req.params.familyId || 'fam-1').trim();
    const actor = req.actor!;
    const { ruleId, memberId, pointsCost, reason } = req.body || {};

    await withAtomicStoreTransaction(async (store) => {
      const access = resolveServerMembership(store, actor.userAccountId, targetFamilyId);
      if (!access.allowed || !access.membership) {
        res.status(access.httpStatus).json({ error: access.errorCode, message: access.errorMessage });
        return;
      }
      const caller = access.membership;
      const config = getOrInitRewardConfig(store, targetFamilyId);
      if (!config.enabled) {
        res.status(400).json({
          error: 'REWARD_SYSTEM_DISABLED',
          message: 'The optional family reward system is currently disabled for this workspace.',
        });
        return;
      }

      const rule = ruleId
        ? config.redemptionRules.find((r) => r.id === String(ruleId))
        : pointsCost !== undefined
        ? {
            id: `rew-custom-${Date.now()}`,
            title: String(reason || 'Custom Family Reward Redemption'),
            costPoints: Math.max(1, Math.round(Number(pointsCost))),
            description: String(reason || ''),
            requiresApproval: true,
          }
        : null;
      if (!rule) {
        res.status(404).json({ error: 'REWARD_RULE_NOT_FOUND' });
        return;
      }

      const targetMemberId = String(memberId || caller.memberProfileId);
      const member = (store.familyMembers || []).find(
        (m) => m.id === targetMemberId && m.familyId === targetFamilyId
      );
      if (!member) {
        res.status(404).json({ error: 'MEMBER_NOT_FOUND' });
        return;
      }

      if ((member.pointsBalance || 0) < rule.costPoints) {
        res.status(400).json({
          error: 'INSUFFICIENT_REWARD_POINTS',
          message: `Member has ${member.pointsBalance || 0} ${config.currencyName}, but '${rule.title}' requires ${rule.costPoints}.`,
        });
        return;
      }

      const now = Date.now();
      const needsApproval = config.requiresApproval || rule.requiresApproval;
      const isAutoApproved = !needsApproval || canManageMemberships(caller.role);

      if (isAutoApproved) {
        member.pointsBalance = Math.max(0, (member.pointsBalance || 0) - rule.costPoints);
      }

      const entry: RewardHistoryEntry = {
        id: `rew-red-${now}`,
        familyId: targetFamilyId,
        memberId: member.id,
        memberName: member.displayName,
        type: 'REDEEMED',
        pointsDelta: rule.costPoints,
        redemptionRuleId: rule.id,
        title: rule.title,
        status: isAutoApproved ? 'APPROVED' : 'PENDING_APPROVAL',
        approvedByMemberId: isAutoApproved ? caller.memberProfileId : null,
        createdAt: now,
        updatedAt: now,
      };
      config.history.unshift(entry);
      bumpWorkspaceVersion(store, targetFamilyId, now);

      res.status(201).json({ redemption: entry, entry, memberPointsBalance: member.pointsBalance });
    });
  });

  // 8C. Approve or Reject Reward Redemption (POST /api/v1/rewards/:familyId/redemptions/:entryId/approve)
  app.post('/api/v1/rewards/:familyId/redemptions/:entryId/approve', requireAuth, async (req, res) => {
    const targetFamilyId = String(req.params.familyId || 'fam-1').trim();
    const entryId = String(req.params.entryId || '').trim();
    const { approved = true } = req.body || {};
    const actor = req.actor!;

    await withAtomicStoreTransaction(async (store) => {
      const access = resolveServerMembership(store, actor.userAccountId, targetFamilyId);
      if (!access.allowed || !access.membership) {
        res.status(access.httpStatus).json({ error: access.errorCode, message: access.errorMessage });
        return;
      }
      if (!canManageMemberships(access.membership.role)) {
        res.status(403).json({
          error: 'PERMISSION_DENIED',
          message: 'Only OWNER or ADMIN can approve reward redemptions.',
        });
        return;
      }

      const config = getOrInitRewardConfig(store, targetFamilyId);
      const entry = config.history.find((h) => h.id === entryId);
      if (!entry || entry.status !== 'PENDING_APPROVAL') {
        res.status(404).json({ error: 'PENDING_REDEMPTION_NOT_FOUND' });
        return;
      }

      const member = (store.familyMembers || []).find(
        (m) => m.id === entry.memberId && m.familyId === targetFamilyId
      );
      if (approved) {
        if (!member || (member.pointsBalance || 0) < entry.pointsDelta) {
          res.status(400).json({ error: 'INSUFFICIENT_REWARD_POINTS' });
          return;
        }
        member.pointsBalance = Math.max(0, member.pointsBalance - entry.pointsDelta);
        entry.status = 'APPROVED';
      } else {
        entry.status = 'REJECTED';
      }
      entry.approvedByMemberId = access.membership.memberProfileId;
      entry.updatedAt = Date.now();
      bumpWorkspaceVersion(store, targetFamilyId, entry.updatedAt);

      res.status(200).json({
        redemption: entry,
        entry,
        memberPointsBalance: member?.pointsBalance ?? 0,
      });
    });
  });
}
