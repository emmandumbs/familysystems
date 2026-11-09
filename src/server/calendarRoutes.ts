/**
 * FamilyOS — Stage 3.3.3 Calendar & Routines Express Routes
 *
 * REST Endpoints:
 * - GET    /api/v1/calendar/:familyId
 * - POST   /api/v1/calendar/:familyId
 * - PUT    /api/v1/calendar/:familyId/:eventId
 * - DELETE /api/v1/calendar/:familyId/:eventId
 * - GET    /api/v1/routines/:familyId
 * - POST   /api/v1/routines/:familyId
 * - PUT    /api/v1/routines/:familyId/:routineId
 * - DELETE /api/v1/routines/:familyId/:routineId
 * - POST   /api/v1/routines/:familyId/:routineId/occurrences/:occurrenceId/complete
 * - POST   /api/v1/routines/:familyId/:routineId/occurrences/:occurrenceId/skip
 * - POST   /api/v1/routines/:familyId/:routineId/occurrences/:occurrenceId/steps/:stepId/toggle
 * - POST   /api/v1/routines/:familyId/:routineId/pause
 * - POST   /api/v1/routines/:familyId/:routineId/convert-to-task
 */

import type { Express, Request, Response } from 'express';
import type {
  SharedStore,
  AuthoritativeMembership,
} from './backupAndMigration.js';
import { resolveServerMembership } from './authAndRbac.js';
import {
  AuthoritativeCalendarEvent,
  AuthoritativeRoutine,
  AuthoritativeRoutineOccurrence,
  canViewCalendarEvent,
  canMutateCalendarEvent,
  canViewRoutine,
  canMutateRoutine,
  ensureRoutineOccurrencesForRange,
  completeRoutineOccurrence,
  skipRoutineOccurrence,
  toggleOccurrenceStep,
  convertRoutineOccurrenceToTask,
  seedDefaultCalendarAndRoutines,
  normalizeScope,
} from './calendarAndRoutines.js';
import { AuthoritativeTask, syncTaskWithCalendar } from './planningAndExecution.js';

export interface CalendarRouteDependencies {
  requireAuth: any;
  loadStore: () => SharedStore;
  withAtomicStoreTransaction: <T>(fn: (store: SharedStore) => Promise<T> | T) => Promise<T>;
  bumpWorkspaceVersion: (store: SharedStore, familyId: string, now?: number) => number;
}

export function registerCalendarRoutes(
  app: Express,
  deps: CalendarRouteDependencies
): void {
  const {
    requireAuth,
    loadStore,
    withAtomicStoreTransaction,
    bumpWorkspaceVersion,
  } = deps;

  function recordLocalAuditEvent(
    store: SharedStore,
    actorUserId: string,
    role: string,
    actionType: string,
    entityType: string,
    entityId: string,
    details: Record<string, unknown>
  ) {
    store.auditEvents = store.auditEvents || [];
    store.auditEvents.push({
      id: `aud-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      familyId: 'fam-1',
      actorUserId,
      actorRole: role,
      actionType,
      summary: `${actionType} ${entityType} ${entityId}`,
      createdAt: Date.now(),
      details,
    } as any);
  }

  // 1. Get Calendar Timeline & Aggregated Events (GET /api/v1/calendar/:familyId)
  app.get('/api/v1/calendar/:familyId', requireAuth, (req: Request, res: Response) => {
    const targetFamilyId = String(req.params.familyId || 'fam-1').trim();
    const store = loadStore();
    const actor = (req as any).actor!;

    const access = resolveServerMembership(store, actor.userAccountId, targetFamilyId);
    if (!access.allowed || !access.membership) {
      res.status(access.httpStatus).json({ error: access.errorCode, message: access.errorMessage });
      return;
    }

    const callerMembership: AuthoritativeMembership = access.membership;

    const {
      startDate,
      endDate,
      category,
      scope,
      memberId,
    } = req.query as Record<string, string | undefined>;

    const startEpoch = startDate ? (Date.parse(startDate) || 0) : 0;
    const endEpoch = endDate ? (Date.parse(endDate) || LongMaxValue()) : LongMaxValue();

    // 1. Filter standalone and stored calendar events
    const rawEvents: AuthoritativeCalendarEvent[] = store.calendarEvents || [];
    const visibleEvents = rawEvents
      .filter((e: AuthoritativeCalendarEvent) => e.familyId === targetFamilyId && !e.isDeleted)
      .filter((e: AuthoritativeCalendarEvent) => canViewCalendarEvent(store, callerMembership, e))
      .filter((e: AuthoritativeCalendarEvent) => {
        if (startEpoch && e.eventEpoch < startEpoch) return false;
        if (endEpoch && e.eventEpoch > endEpoch) return false;
        if (category && category !== 'ALL' && e.category !== category) return false;
        if (scope && scope !== 'ALL' && normalizeScope(e.scope) !== normalizeScope(scope)) return false;
        if (memberId && memberId !== 'ALL') {
          const isAssigned =
            e.creatorMemberId === memberId ||
            (e.assignedMemberIds || []).includes(memberId) ||
            (e.attendees || []).some((a: any) => a.memberId === memberId);
          if (!isAssigned) return false;
        }
        return true;
      });

    // 2. Also aggregate task-linked events from synchronizedEntities if not already in store
    const syncedEntities = store.synchronizedEntities || {};
    const taskLinkedEvents: AuthoritativeCalendarEvent[] = [];

    for (const key of Object.keys(syncedEntities)) {
      if (key.startsWith('CALENDAR_EVENT:cal-task-')) {
        const syncRec = syncedEntities[key];
        if (syncRec && syncRec.familyId === targetFamilyId && !syncRec.isDeleted) {
          const data = syncRec.data as any;
          if (!visibleEvents.some((e: AuthoritativeCalendarEvent) => e.id === data.id)) {
            const mappedEvent: AuthoritativeCalendarEvent = {
              id: data.id,
              familyId: targetFamilyId,
              title: data.title || 'Task Due',
              description: data.location ? `Module: ${data.location}` : undefined,
              eventDate: data.eventDate || new Date(data.eventEpoch || Date.now()).toISOString().slice(0, 10),
              eventEpoch: Number(data.eventEpoch || Date.now()),
              isAllDay: false,
              category: 'TASK_DUE',
              scope: normalizeScope(data.scope),
              timezone: data.timezone || 'America/Los_Angeles',
              creatorMemberId: data.creatorMemberId || 'mem-sarah',
              assignedMemberIds: data.assignedMemberId ? [data.assignedMemberId] : [],
              attendees: data.assignedMemberId ? [{ memberId: data.assignedMemberId, status: 'ACCEPTED' }] : [],
              reminders: data.reminders || [],
              sourceEntityId: data.sourceEntityId,
              sourceEntityType: 'TASK',
              isCompleted: Boolean(data.isCompleted),
              isDeleted: false,
              createdAt: syncRec.updatedAt || Date.now(),
              updatedAt: syncRec.updatedAt || Date.now(),
              version: syncRec.version || 1,
            };

            if (canViewCalendarEvent(store, callerMembership, mappedEvent)) {
              if (
                (!startEpoch || mappedEvent.eventEpoch >= startEpoch) &&
                (!endEpoch || mappedEvent.eventEpoch <= endEpoch) &&
                (!category || category === 'ALL' || category === 'TASK_DUE') &&
                (!scope || scope === 'ALL' || normalizeScope(mappedEvent.scope) === normalizeScope(scope))
              ) {
                taskLinkedEvents.push(mappedEvent);
              }
            }
          }
        }
      }
    }

    const allEvents = [...visibleEvents, ...taskLinkedEvents].sort((a, b) => a.eventEpoch - b.eventEpoch);

    res.status(200).json({
      familyId: targetFamilyId,
      totalCount: allEvents.length,
      events: allEvents,
    });
  });

  // 2. Create Standalone Calendar Event (POST /api/v1/calendar/:familyId)
  app.post('/api/v1/calendar/:familyId', requireAuth, async (req: Request, res: Response) => {
    const targetFamilyId = String(req.params.familyId || 'fam-1').trim();
    const actor = (req as any).actor!;
    const body = req.body || {};

    await withAtomicStoreTransaction(async (store: SharedStore) => {
      const access = resolveServerMembership(store, actor.userAccountId, targetFamilyId);
      if (!access.allowed || !access.membership) {
        res.status(access.httpStatus).json({ error: access.errorCode, message: access.errorMessage });
        return;
      }

      const callerMembership: AuthoritativeMembership = access.membership;

      const title = String(body.title || '').trim();
      if (!title) {
        res.status(400).json({ error: 'MISSING_TITLE', message: 'Event title is required.' });
        return;
      }

      const now = Date.now();
      const eventDate = String(body.eventDate || new Date().toISOString().slice(0, 10));
      const eventEpoch = body.eventEpoch ? Number(body.eventEpoch) : (Date.parse(eventDate) || now);
      const isAllDay = Boolean(body.isAllDay);
      const category = (body.category || 'FAMILY_EVENT') as any;
      const scope = normalizeScope(body.scope);

      const newEvent: AuthoritativeCalendarEvent = {
        id: body.id || `cal-${now}-${Math.floor(Math.random() * 10000)}`,
        familyId: targetFamilyId,
        title,
        description: body.description?.trim() || undefined,
        eventDate,
        eventEpoch,
        endEpoch: body.endEpoch ? Number(body.endEpoch) : undefined,
        isAllDay,
        category,
        scope,
        location: body.location?.trim() || undefined,
        timezone: body.timezone || 'America/Los_Angeles',
        creatorMemberId: callerMembership.memberProfileId,
        assignedMemberIds: Array.isArray(body.assignedMemberIds) ? body.assignedMemberIds : [callerMembership.memberProfileId],
        attendees: Array.isArray(body.attendees)
          ? body.attendees
          : [{ memberId: callerMembership.memberProfileId, status: 'ACCEPTED' }],
        reminders: Array.isArray(body.reminders) ? body.reminders : [],
        recurrenceRule: body.recurrenceRule?.trim() || undefined,
        recurrenceExceptions: Array.isArray(body.recurrenceExceptions) ? body.recurrenceExceptions : [],
        isCompleted: false,
        isDeleted: false,
        createdAt: now,
        updatedAt: now,
        version: 1,
      };

      const check = canMutateCalendarEvent(store, callerMembership, newEvent, 'CREATE');
      if (!check.allowed) {
        res.status(403).json({ error: check.errorCode, message: check.errorMessage });
        return;
      }

      store.calendarEvents = store.calendarEvents || [];
      store.calendarEvents.push(newEvent);

      // Register in synchronizedEntities
      store.synchronizedEntities = store.synchronizedEntities || {};
      store.synchronizedEntities[`CALENDAR_EVENT:${newEvent.id}`] = {
        id: newEvent.id,
        familyId: targetFamilyId,
        entityType: 'CALENDAR_EVENT',
        version: 1,
        isDeleted: false,
        updatedAt: now,
        updatedByUserId: actor.userAccountId,
        data: newEvent as any,
      };

      bumpWorkspaceVersion(store, targetFamilyId, now);
      recordLocalAuditEvent(
        store,
        actor.userAccountId,
        callerMembership.role,
        'INSERT',
        'CALENDAR_EVENT',
        newEvent.id,
        { title: newEvent.title, scope: newEvent.scope, category: newEvent.category }
      );

      res.status(201).json({ event: newEvent });
    });
  });

  // 3. Update Calendar Event (PUT /api/v1/calendar/:familyId/:eventId)
  app.put('/api/v1/calendar/:familyId/:eventId', requireAuth, async (req: Request, res: Response) => {
    const targetFamilyId = String(req.params.familyId || 'fam-1').trim();
    const eventId = String(req.params.eventId || '').trim();
    const actor = (req as any).actor!;
    const body = req.body || {};

    await withAtomicStoreTransaction(async (store: SharedStore) => {
      const access = resolveServerMembership(store, actor.userAccountId, targetFamilyId);
      if (!access.allowed || !access.membership) {
        res.status(access.httpStatus).json({ error: access.errorCode, message: access.errorMessage });
        return;
      }

      const callerMembership: AuthoritativeMembership = access.membership;

      store.calendarEvents = store.calendarEvents || [];
      let event = store.calendarEvents.find((e: AuthoritativeCalendarEvent) => e.id === eventId && e.familyId === targetFamilyId);

      // Check if it's a task-linked event (e.g., cal-task-...)
      if (!event && eventId.startsWith('cal-task-')) {
        const taskId = eventId.replace('cal-task-', '');
        const task = (store.tasks || store.planningTasks || []).find((t: AuthoritativeTask) => t.id === taskId);
        if (task) {
          if (body.dueDate || body.eventDate) {
            task.dueDate = body.dueDate || body.eventDate;
            task.dueEpoch = body.eventEpoch || (Date.parse(task.dueDate) || task.dueEpoch);
          }
          if (body.title) task.title = body.title;
          if (body.isCompleted !== undefined) {
            task.isCompleted = Boolean(body.isCompleted);
            task.completedAt = task.isCompleted ? Date.now() : null;
          }
          task.updatedAt = Date.now();
          task.version += 1;

          // Resync task with calendar
          const calRec = syncTaskWithCalendar(store, task, actor.userAccountId);
          bumpWorkspaceVersion(store, targetFamilyId, Date.now());

          res.status(200).json({ event: calRec?.data || task, syncedWithTask: true });
          return;
        }
      }

      if (!event) {
        res.status(404).json({ error: 'EVENT_NOT_FOUND', message: 'Calendar event not found.' });
        return;
      }

      const check = canMutateCalendarEvent(store, callerMembership, event, 'UPDATE');
      if (!check.allowed) {
        res.status(403).json({ error: check.errorCode, message: check.errorMessage });
        return;
      }

      const now = Date.now();
      if (body.title) event.title = String(body.title).trim();
      if (body.description !== undefined) event.description = body.description?.trim();
      if (body.eventDate) event.eventDate = String(body.eventDate);
      if (body.eventEpoch) event.eventEpoch = Number(body.eventEpoch);
      if (body.endEpoch !== undefined) event.endEpoch = body.endEpoch ? Number(body.endEpoch) : undefined;
      if (body.isAllDay !== undefined) event.isAllDay = Boolean(body.isAllDay);
      if (body.category) event.category = body.category;
      if (body.scope) event.scope = normalizeScope(body.scope);
      if (body.location !== undefined) event.location = body.location?.trim();
      if (body.timezone) event.timezone = body.timezone;
      if (Array.isArray(body.assignedMemberIds)) event.assignedMemberIds = body.assignedMemberIds;
      if (Array.isArray(body.attendees)) event.attendees = body.attendees;
      if (Array.isArray(body.reminders)) event.reminders = body.reminders;
      if (body.recurrenceRule !== undefined) event.recurrenceRule = body.recurrenceRule;
      if (Array.isArray(body.recurrenceExceptions)) event.recurrenceExceptions = body.recurrenceExceptions;
      if (body.isCompleted !== undefined) {
        event.isCompleted = Boolean(body.isCompleted);
        event.completedAt = event.isCompleted ? now : undefined;
      }

      event.updatedAt = now;
      event.version += 1;

      // If linked to a canonical task, update the task in lockstep
      if (event.sourceEntityType === 'TASK' && event.sourceEntityId) {
        const task = (store.tasks || store.planningTasks || []).find((t: AuthoritativeTask) => t.id === event!.sourceEntityId);
        if (task) {
          task.dueDate = event.eventDate;
          task.dueEpoch = event.eventEpoch;
          task.isCompleted = Boolean(event.isCompleted);
          task.completedAt = event.completedAt || null;
          task.updatedAt = now;
          task.version += 1;
        }
      }

      // Sync entity map
      store.synchronizedEntities = store.synchronizedEntities || {};
      store.synchronizedEntities[`CALENDAR_EVENT:${event.id}`] = {
        id: event.id,
        familyId: targetFamilyId,
        entityType: 'CALENDAR_EVENT',
        version: event.version,
        isDeleted: false,
        updatedAt: now,
        updatedByUserId: actor.userAccountId,
        data: event as any,
      };

      bumpWorkspaceVersion(store, targetFamilyId, now);
      recordLocalAuditEvent(
        store,
        actor.userAccountId,
        callerMembership.role,
        'UPDATE',
        'CALENDAR_EVENT',
        event.id,
        { title: event.title, eventDate: event.eventDate }
      );

      res.status(200).json({ event });
    });
  });

  // 4. Delete Calendar Event (DELETE /api/v1/calendar/:familyId/:eventId)
  app.delete('/api/v1/calendar/:familyId/:eventId', requireAuth, async (req: Request, res: Response) => {
    const targetFamilyId = String(req.params.familyId || 'fam-1').trim();
    const eventId = String(req.params.eventId || '').trim();
    const actor = (req as any).actor!;

    await withAtomicStoreTransaction(async (store: SharedStore) => {
      const access = resolveServerMembership(store, actor.userAccountId, targetFamilyId);
      if (!access.allowed || !access.membership) {
        res.status(access.httpStatus).json({ error: access.errorCode, message: access.errorMessage });
        return;
      }

      const callerMembership: AuthoritativeMembership = access.membership;
      store.calendarEvents = store.calendarEvents || [];
      const event = store.calendarEvents.find((e: AuthoritativeCalendarEvent) => e.id === eventId && e.familyId === targetFamilyId);

      if (!event) {
        res.status(404).json({ error: 'EVENT_NOT_FOUND', message: 'Calendar event not found.' });
        return;
      }

      const check = canMutateCalendarEvent(store, callerMembership, event, 'DELETE');
      if (!check.allowed) {
        res.status(403).json({ error: check.errorCode, message: check.errorMessage });
        return;
      }

      const now = Date.now();
      event.isDeleted = true;
      event.updatedAt = now;
      event.version += 1;

      // Unlink from task if sourceEntityType was TASK
      if (event.sourceEntityType === 'TASK' && event.sourceEntityId) {
        const task = (store.tasks || store.planningTasks || []).find((t: AuthoritativeTask) => t.id === event.sourceEntityId);
        if (task) {
          task.linkedCalendarEventId = null;
          task.updatedAt = now;
        }
      }

      // Mark deleted in synchronizedEntities
      store.synchronizedEntities = store.synchronizedEntities || {};
      const syncKey = `CALENDAR_EVENT:${event.id}`;
      if (store.synchronizedEntities[syncKey]) {
        store.synchronizedEntities[syncKey].isDeleted = true;
        store.synchronizedEntities[syncKey].version += 1;
        store.synchronizedEntities[syncKey].updatedAt = now;
      }

      bumpWorkspaceVersion(store, targetFamilyId, now);
      recordLocalAuditEvent(
        store,
        actor.userAccountId,
        callerMembership.role,
        'DELETE',
        'CALENDAR_EVENT',
        event.id,
        { title: event.title }
      );

      res.status(200).json({ success: true, deletedEventId: event.id });
    });
  });

  // 5. Get Routines & Active Occurrences (GET /api/v1/routines/:familyId)
  app.get('/api/v1/routines/:familyId', requireAuth, (req: Request, res: Response) => {
    const targetFamilyId = String(req.params.familyId || 'fam-1').trim();
    const store = loadStore();
    const actor = (req as any).actor!;

    const access = resolveServerMembership(store, actor.userAccountId, targetFamilyId);
    if (!access.allowed || !access.membership) {
      res.status(access.httpStatus).json({ error: access.errorCode, message: access.errorMessage });
      return;
    }

    const callerMembership: AuthoritativeMembership = access.membership;

    const {
      startDate,
      endDate,
      category,
      scope,
    } = req.query as Record<string, string | undefined>;

    const todayIso = new Date().toISOString().slice(0, 10);
    const startIso = startDate || todayIso;
    const endIso = endDate || todayIso;

    // Compute occurrences within requested range without mutating store on GET
    const computedOccurrences = ensureRoutineOccurrencesForRange(store, targetFamilyId, startIso, endIso, false);

    const allRoutines: AuthoritativeRoutine[] = store.routines || [];
    const visibleRoutines = allRoutines
      .filter((r: AuthoritativeRoutine) => r.familyId === targetFamilyId && !r.isDeleted)
      .filter((r: AuthoritativeRoutine) => canViewRoutine(store, callerMembership, r))
      .filter((r: AuthoritativeRoutine) => {
        if (category && category !== 'ALL' && r.category !== category) return false;
        if (scope && scope !== 'ALL' && normalizeScope(r.scope) !== normalizeScope(scope)) return false;
        return true;
      });

    const visibleRoutineIds = new Set(visibleRoutines.map((r: AuthoritativeRoutine) => r.id));
    const visibleOccurrences = computedOccurrences.filter(
      (o: AuthoritativeRoutineOccurrence) =>
        o.familyId === targetFamilyId &&
        visibleRoutineIds.has(o.routineId) &&
        o.targetDate >= startIso &&
        o.targetDate <= endIso
    );

    res.status(200).json({
      familyId: targetFamilyId,
      routines: visibleRoutines,
      occurrences: visibleOccurrences,
    });
  });

  // 6. Create Routine Definition (POST /api/v1/routines/:familyId)
  app.post('/api/v1/routines/:familyId', requireAuth, async (req: Request, res: Response) => {
    const targetFamilyId = String(req.params.familyId || 'fam-1').trim();
    const actor = (req as any).actor!;
    const body = req.body || {};

    await withAtomicStoreTransaction(async (store: SharedStore) => {
      const access = resolveServerMembership(store, actor.userAccountId, targetFamilyId);
      if (!access.allowed || !access.membership) {
        res.status(access.httpStatus).json({ error: access.errorCode, message: access.errorMessage });
        return;
      }

      const callerMembership: AuthoritativeMembership = access.membership;

      const title = String(body.title || '').trim();
      if (!title) {
        res.status(400).json({ error: 'MISSING_TITLE', message: 'Routine title is required.' });
        return;
      }

      const now = Date.now();
      const scope = normalizeScope(body.scope);
      const category = (body.category || 'HOUSEHOLD') as any;
      const frequency = (body.frequency || 'DAILY') as any;

      const steps = Array.isArray(body.steps)
        ? body.steps.map((s: any, idx: number) => ({
            id: s.id || `step-${now}-${idx + 1}`,
            title: String(s.title || '').trim(),
            orderIndex: s.orderIndex ?? idx,
            estimatedMinutes: s.estimatedMinutes ? Number(s.estimatedMinutes) : undefined,
          }))
        : [];

      const newRoutine: AuthoritativeRoutine = {
        id: body.id || `rtn-${now}-${Math.floor(Math.random() * 10000)}`,
        familyId: targetFamilyId,
        title,
        description: body.description?.trim() || undefined,
        category,
        frequency,
        targetWeekdays: Array.isArray(body.targetWeekdays) ? body.targetWeekdays : [1, 2, 3, 4, 5],
        targetTimeOfDay: body.targetTimeOfDay || '08:00',
        anchorMonthDay: body.anchorMonthDay ? Number(body.anchorMonthDay) : undefined,
        scope,
        ownerMemberId: callerMembership.memberProfileId,
        assignedMemberIds: Array.isArray(body.assignedMemberIds)
          ? body.assignedMemberIds
          : [callerMembership.memberProfileId],
        steps,
        pointsReward: body.pointsReward ? Number(body.pointsReward) : 15,
        timezone: body.timezone || 'America/Los_Angeles',
        isPaused: false,
        streakCount: 0,
        bestStreakCount: 0,
        isDeleted: false,
        createdAt: now,
        updatedAt: now,
        version: 1,
      };

      const check = canMutateRoutine(store, callerMembership, newRoutine, 'CREATE');
      if (!check.allowed) {
        res.status(403).json({ error: check.errorCode, message: check.errorMessage });
        return;
      }

      store.routines = store.routines || [];
      store.routines.push(newRoutine);

      // Pre-generate occurrence for today if matches
      const todayIso = new Date().toISOString().slice(0, 10);
      ensureRoutineOccurrencesForRange(store, targetFamilyId, todayIso, todayIso);

      bumpWorkspaceVersion(store, targetFamilyId, now);
      recordLocalAuditEvent(
        store,
        actor.userAccountId,
        callerMembership.role,
        'INSERT',
        'ROUTINE',
        newRoutine.id,
        { title: newRoutine.title, category: newRoutine.category, frequency: newRoutine.frequency }
      );

      res.status(201).json({ routine: newRoutine });
    });
  });

  // 7. Update Routine Definition (PUT /api/v1/routines/:familyId/:routineId)
  app.put('/api/v1/routines/:familyId/:routineId', requireAuth, async (req: Request, res: Response) => {
    const targetFamilyId = String(req.params.familyId || 'fam-1').trim();
    const routineId = String(req.params.routineId || '').trim();
    const actor = (req as any).actor!;
    const body = req.body || {};

    await withAtomicStoreTransaction(async (store: SharedStore) => {
      const access = resolveServerMembership(store, actor.userAccountId, targetFamilyId);
      if (!access.allowed || !access.membership) {
        res.status(access.httpStatus).json({ error: access.errorCode, message: access.errorMessage });
        return;
      }

      const callerMembership: AuthoritativeMembership = access.membership;
      store.routines = store.routines || [];
      const routine = store.routines.find((r: AuthoritativeRoutine) => r.id === routineId && r.familyId === targetFamilyId);

      if (!routine) {
        res.status(404).json({ error: 'ROUTINE_NOT_FOUND', message: 'Routine not found.' });
        return;
      }

      const check = canMutateRoutine(store, callerMembership, routine, 'UPDATE');
      if (!check.allowed) {
        res.status(403).json({ error: check.errorCode, message: check.errorMessage });
        return;
      }

      const now = Date.now();
      if (body.title) routine.title = String(body.title).trim();
      if (body.description !== undefined) routine.description = body.description?.trim();
      if (body.category) routine.category = body.category;
      if (body.frequency) routine.frequency = body.frequency;
      if (Array.isArray(body.targetWeekdays)) routine.targetWeekdays = body.targetWeekdays;
      if (body.targetTimeOfDay) routine.targetTimeOfDay = body.targetTimeOfDay;
      if (body.anchorMonthDay !== undefined) routine.anchorMonthDay = Number(body.anchorMonthDay);
      if (body.scope) routine.scope = normalizeScope(body.scope);
      if (Array.isArray(body.assignedMemberIds)) routine.assignedMemberIds = body.assignedMemberIds;
      if (Array.isArray(body.steps)) {
        routine.steps = body.steps.map((s: any, idx: number) => ({
          id: s.id || `step-${now}-${idx + 1}`,
          title: String(s.title || '').trim(),
          orderIndex: s.orderIndex ?? idx,
          estimatedMinutes: s.estimatedMinutes ? Number(s.estimatedMinutes) : undefined,
        }));
      }
      if (body.pointsReward !== undefined) routine.pointsReward = Number(body.pointsReward);
      if (body.timezone) routine.timezone = body.timezone;

      routine.updatedAt = now;
      routine.version += 1;

      bumpWorkspaceVersion(store, targetFamilyId, now);
      res.status(200).json({ routine });
    });
  });

  // 8. Delete Routine Definition (DELETE /api/v1/routines/:familyId/:routineId)
  app.delete('/api/v1/routines/:familyId/:routineId', requireAuth, async (req: Request, res: Response) => {
    const targetFamilyId = String(req.params.familyId || 'fam-1').trim();
    const routineId = String(req.params.routineId || '').trim();
    const actor = (req as any).actor!;

    await withAtomicStoreTransaction(async (store: SharedStore) => {
      const access = resolveServerMembership(store, actor.userAccountId, targetFamilyId);
      if (!access.allowed || !access.membership) {
        res.status(access.httpStatus).json({ error: access.errorCode, message: access.errorMessage });
        return;
      }

      const callerMembership: AuthoritativeMembership = access.membership;
      store.routines = store.routines || [];
      const routine = store.routines.find((r: AuthoritativeRoutine) => r.id === routineId && r.familyId === targetFamilyId);

      if (!routine) {
        res.status(404).json({ error: 'ROUTINE_NOT_FOUND', message: 'Routine not found.' });
        return;
      }

      const check = canMutateRoutine(store, callerMembership, routine, 'DELETE');
      if (!check.allowed) {
        res.status(403).json({ error: check.errorCode, message: check.errorMessage });
        return;
      }

      const now = Date.now();
      routine.isDeleted = true;
      routine.updatedAt = now;
      routine.version += 1;

      bumpWorkspaceVersion(store, targetFamilyId, now);
      res.status(200).json({ success: true, deletedRoutineId: routine.id });
    });
  });

  // 9. Complete Occurrence (POST /api/v1/routines/:familyId/:routineId/occurrences/:occurrenceId/complete)
  app.post(
    '/api/v1/routines/:familyId/:routineId/occurrences/:occurrenceId/complete',
    requireAuth,
    async (req: Request, res: Response) => {
      const targetFamilyId = String(req.params.familyId || 'fam-1').trim();
      const routineId = String(req.params.routineId || '').trim();
      const occurrenceId = String(req.params.occurrenceId || '').trim();
      const actor = (req as any).actor!;

      await withAtomicStoreTransaction(async (store: SharedStore) => {
        const access = resolveServerMembership(store, actor.userAccountId, targetFamilyId);
        if (!access.allowed || !access.membership) {
          res.status(access.httpStatus).json({ error: access.errorCode, message: access.errorMessage });
          return;
        }

        const callerMembership: AuthoritativeMembership = access.membership;
        if (callerMembership.role === 'GUEST') {
          res.status(403).json({ error: 'GUEST_READ_ONLY', message: 'Guests cannot complete routine occurrences.' });
          return;
        }

        const routine = (store.routines || []).find((r: AuthoritativeRoutine) => r.id === routineId && r.familyId === targetFamilyId);
        if (!routine) {
          res.status(404).json({ error: 'ROUTINE_NOT_FOUND', message: 'Routine not found.' });
          return;
        }

        if (!canViewRoutine(store, callerMembership, routine)) {
          res.status(403).json({ error: 'PERMISSION_DENIED', message: 'Cannot access this routine.' });
          return;
        }

        const result = completeRoutineOccurrence(
          store,
          targetFamilyId,
          routineId,
          occurrenceId,
          callerMembership.memberProfileId
        );

        bumpWorkspaceVersion(store, targetFamilyId, Date.now());
        recordLocalAuditEvent(
          store,
          actor.userAccountId,
          callerMembership.role,
          'UPDATE',
          'ROUTINE_OCCURRENCE',
          occurrenceId,
          { routineTitle: routine.title, pointsAwarded: result.pointsAwarded, streak: result.routine.streakCount }
        );

        res.status(200).json({
          occurrence: result.occurrence,
          routine: result.routine,
          pointsAwarded: result.pointsAwarded,
        });
      });
    }
  );

  // 10. Skip Occurrence (POST /api/v1/routines/:familyId/:routineId/occurrences/:occurrenceId/skip)
  app.post(
    '/api/v1/routines/:familyId/:routineId/occurrences/:occurrenceId/skip',
    requireAuth,
    async (req: Request, res: Response) => {
      const targetFamilyId = String(req.params.familyId || 'fam-1').trim();
      const routineId = String(req.params.routineId || '').trim();
      const occurrenceId = String(req.params.occurrenceId || '').trim();
      const { reason } = req.body || {};
      const actor = (req as any).actor!;

      await withAtomicStoreTransaction(async (store: SharedStore) => {
        const access = resolveServerMembership(store, actor.userAccountId, targetFamilyId);
        if (!access.allowed || !access.membership) {
          res.status(access.httpStatus).json({ error: access.errorCode, message: access.errorMessage });
          return;
        }

        const callerMembership: AuthoritativeMembership = access.membership;
        if (callerMembership.role === 'GUEST') {
          res.status(403).json({ error: 'GUEST_READ_ONLY', message: 'Guests cannot skip routines.' });
          return;
        }

        const result = skipRoutineOccurrence(
          store,
          targetFamilyId,
          routineId,
          occurrenceId,
          callerMembership.memberProfileId,
          reason
        );

        bumpWorkspaceVersion(store, targetFamilyId, Date.now());
        res.status(200).json(result);
      });
    }
  );

  // 11. Toggle Step in Occurrence (POST /api/v1/routines/:familyId/:routineId/occurrences/:occurrenceId/steps/:stepId/toggle)
  app.post(
    '/api/v1/routines/:familyId/:routineId/occurrences/:occurrenceId/steps/:stepId/toggle',
    requireAuth,
    async (req: Request, res: Response) => {
      const targetFamilyId = String(req.params.familyId || 'fam-1').trim();
      const routineId = String(req.params.routineId || '').trim();
      const occurrenceId = String(req.params.occurrenceId || '').trim();
      const stepId = String(req.params.stepId || '').trim();
      const { isDone = true } = req.body || {};
      const actor = (req as any).actor!;

      await withAtomicStoreTransaction(async (store: SharedStore) => {
        const access = resolveServerMembership(store, actor.userAccountId, targetFamilyId);
        if (!access.allowed || !access.membership) {
          res.status(access.httpStatus).json({ error: access.errorCode, message: access.errorMessage });
          return;
        }

        const callerMembership: AuthoritativeMembership = access.membership;
        if (callerMembership.role === 'GUEST') {
          res.status(403).json({ error: 'GUEST_READ_ONLY' });
          return;
        }

        const result = toggleOccurrenceStep(
          store,
          targetFamilyId,
          routineId,
          occurrenceId,
          stepId,
          Boolean(isDone),
          callerMembership.memberProfileId
        );

        bumpWorkspaceVersion(store, targetFamilyId, Date.now());
        res.status(200).json(result);
      });
    }
  );

  // 12. Pause or Resume Routine (POST /api/v1/routines/:familyId/:routineId/pause)
  app.post('/api/v1/routines/:familyId/:routineId/pause', requireAuth, async (req: Request, res: Response) => {
    const targetFamilyId = String(req.params.familyId || 'fam-1').trim();
    const routineId = String(req.params.routineId || '').trim();
    const { isPaused = true, reason } = req.body || {};
    const actor = (req as any).actor!;

    await withAtomicStoreTransaction(async (store: SharedStore) => {
      const access = resolveServerMembership(store, actor.userAccountId, targetFamilyId);
      if (!access.allowed || !access.membership) {
        res.status(access.httpStatus).json({ error: access.errorCode, message: access.errorMessage });
        return;
      }

      const callerMembership: AuthoritativeMembership = access.membership;
      const routine = (store.routines || []).find((r: AuthoritativeRoutine) => r.id === routineId && r.familyId === targetFamilyId);
      if (!routine) {
        res.status(404).json({ error: 'ROUTINE_NOT_FOUND' });
        return;
      }

      const check = canMutateRoutine(store, callerMembership, routine, 'PAUSE');
      if (!check.allowed) {
        res.status(403).json({ error: check.errorCode, message: check.errorMessage });
        return;
      }

      const now = Date.now();
      routine.isPaused = Boolean(isPaused);
      routine.pausedReason = reason?.trim();
      routine.pausedAt = routine.isPaused ? now : undefined;
      routine.updatedAt = now;
      routine.version += 1;

      bumpWorkspaceVersion(store, targetFamilyId, now);
      res.status(200).json({ routine });
    });
  });

  // 13. Convert Routine Occurrence to Canonical Task (POST /api/v1/routines/:familyId/:routineId/convert-to-task)
  app.post(
    '/api/v1/routines/:familyId/:routineId/convert-to-task',
    requireAuth,
    async (req: Request, res: Response) => {
      const targetFamilyId = String(req.params.familyId || 'fam-1').trim();
      const routineId = String(req.params.routineId || '').trim();
      const { occurrenceId } = req.body || {};
      const actor = (req as any).actor!;

      if (!occurrenceId) {
        res.status(400).json({ error: 'MISSING_OCCURRENCE_ID', message: 'occurrenceId is required.' });
        return;
      }

      await withAtomicStoreTransaction(async (store: SharedStore) => {
        const access = resolveServerMembership(store, actor.userAccountId, targetFamilyId);
        if (!access.allowed || !access.membership) {
          res.status(access.httpStatus).json({ error: access.errorCode, message: access.errorMessage });
          return;
        }

        const callerMembership: AuthoritativeMembership = access.membership;
        if (callerMembership.role === 'GUEST') {
          res.status(403).json({ error: 'GUEST_READ_ONLY' });
          return;
        }

        const result = convertRoutineOccurrenceToTask(
          store,
          targetFamilyId,
          routineId,
          occurrenceId,
          callerMembership
        );

        bumpWorkspaceVersion(store, targetFamilyId, Date.now());
        recordLocalAuditEvent(
          store,
          actor.userAccountId,
          callerMembership.role,
          'INSERT',
          'TASK_FROM_ROUTINE',
          result.task.id,
          { routineId, occurrenceId, taskTitle: result.task.title }
        );

        res.status(201).json({
          task: result.task,
          occurrence: result.occurrence,
          message: 'Routine occurrence successfully converted to canonical task and synced to calendar.',
        });
      });
    }
  );
}

function LongMaxValue(): number {
  return 8640000000000000;
}
