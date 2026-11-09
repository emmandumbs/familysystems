/**
 * FamilyOS — Stage 3.3.3 Authoritative Calendar & Routines Engine
 *
 * Core architectural capabilities:
 * 1. Authoritative Calendar Events (Standalone & Task-Linked, All-day vs Timed, Timezones & DST, Scope isolation).
 * 2. Privacy Scopes (PERSONAL, COUPLE, FAMILY/SHARED) with strict zero-trust RBAC.
 * 3. Authoritative Routines Engine (Daily, Weekdays, Weekends, Weekly, Monthly with Anchor Day preservation).
 * 4. Decoupled Routine Occurrences (Occurrence completion DOES NOT complete or mutate Routine definition).
 * 5. Occurrence Checklists, Streak Calculations, Points Rewards, and Pause/Resume.
 * 6. Promotion / Conversion of Routine Occurrences into Canonical Tasks (with automatic calendar sync).
 * 7. Bidirectional Task-to-Calendar synchronization and audit trail logging.
 */

import {
  SharedStore,
  AuthoritativeMembership,
  AuthoritativeFamilyMember,
  SynchronizedEntityRecord,
} from './backupAndMigration.js';
import {
  AuthoritativeTask,
  canViewTask,
  canAccessCoupleScope,
  syncTaskWithCalendar,
} from './planningAndExecution.js';

export type CalendarEventCategory =
  | 'BIRTHDAY'
  | 'ANNIVERSARY'
  | 'GOAL_DUE'
  | 'TASK_DUE'
  | 'MEAL'
  | 'CHORE'
  | 'MAINTENANCE'
  | 'FAMILY_EVENT'
  | 'APPOINTMENT'
  | 'ROUTINE'
  | 'SPECIAL_OCCASION';

export type EventPrivacyScope = 'PERSONAL' | 'COUPLE' | 'FAMILY' | 'SHARED';

export type RoutineCategory =
  | 'MORNING'
  | 'EVENING'
  | 'HOUSEHOLD'
  | 'MARRIAGE'
  | 'PARENTING'
  | 'SPIRITUAL'
  | 'PERSONAL'
  | 'WORK';

export type RoutineFrequency =
  | 'DAILY'
  | 'WEEKDAYS'
  | 'WEEKENDS'
  | 'WEEKLY'
  | 'BIWEEKLY'
  | 'MONTHLY'
  | 'CUSTOM';

export interface CalendarEventReminder {
  id: string;
  offsetMinutesBefore: number;
  channel: 'IN_APP' | 'PUSH' | 'EMAIL';
  label?: string;
}

export interface CalendarEventAttendee {
  memberId: string;
  status: 'INVITED' | 'ACCEPTED' | 'DECLINED' | 'TENTATIVE';
  notes?: string;
}

export interface AuthoritativeCalendarEvent {
  id: string;
  familyId: string;
  title: string;
  description?: string;
  eventDate: string; // ISO string or YYYY-MM-DD
  eventEpoch: number; // UTC millisecond epoch
  endEpoch?: number;
  isAllDay: boolean;
  category: CalendarEventCategory;
  scope: EventPrivacyScope;
  location?: string;
  timezone: string; // IANA e.g. 'America/Los_Angeles'
  creatorMemberId: string;
  assignedMemberIds: string[];
  attendees: CalendarEventAttendee[];
  reminders: CalendarEventReminder[];
  recurrenceRule?: string; // RFC-5545 or simplified (e.g., 'FREQ=DAILY')
  recurrenceExceptions?: string[]; // ISO date strings skipped
  sourceEntityId?: string; // Linked task ID, milestone ID, chore ID, etc.
  sourceEntityType?: string; // 'TASK' | 'ROUTINE' | 'MILESTONE' | 'CHORE'
  isCompleted?: boolean;
  completedAt?: number;
  isDeleted: boolean;
  createdAt: number;
  updatedAt: number;
  version: number;
}

export interface RoutineStep {
  id: string;
  title: string;
  orderIndex: number;
  estimatedMinutes?: number;
}

export interface AuthoritativeRoutine {
  id: string;
  familyId: string;
  title: string;
  description?: string;
  category: RoutineCategory;
  frequency: RoutineFrequency;
  targetWeekdays: number[]; // 0 = Sunday, 1 = Monday, ... 6 = Saturday
  targetTimeOfDay?: string; // '07:30'
  anchorMonthDay?: number; // 1-31 (preserves anchor day in months with fewer days)
  scope: EventPrivacyScope;
  ownerMemberId: string;
  assignedMemberIds: string[];
  steps: RoutineStep[];
  pointsReward: number;
  timezone: string;
  isPaused: boolean;
  pausedReason?: string;
  pausedAt?: number;
  streakCount: number;
  bestStreakCount: number;
  lastCompletedDate?: string; // 'YYYY-MM-DD'
  isDeleted: boolean;
  createdAt: number;
  updatedAt: number;
  version: number;
}

export type OccurrenceStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED';

export interface AuthoritativeRoutineOccurrence {
  id: string; // occ-${routineId}-${targetDate}
  familyId: string;
  routineId: string;
  targetDate: string; // 'YYYY-MM-DD'
  targetTime?: string;
  status: OccurrenceStatus;
  completedAt?: number;
  completedByMemberId?: string;
  skippedReason?: string;
  skippedByMemberId?: string;
  stepCompletions: Record<string, boolean>; // stepId -> isDone
  pointsAwarded: number;
  linkedTaskId?: string; // Set when converted to a canonical task
  createdAt: number;
  updatedAt: number;
}

/**
 * Calculates the next anchor date for monthly recurrence, clamping to the last valid day of shorter months
 * while preserving the anchor day in subsequent months.
 */
export function calculateMonthAnchorDate(
  year: number,
  zeroBasedMonth: number,
  anchorDay: number
): { year: number; month: number; day: number; isClamped: boolean } {
  // Days in month: day 0 of month + 1
  const daysInTargetMonth = new Date(year, zeroBasedMonth + 1, 0).getDate();
  const day = Math.min(anchorDay, daysInTargetMonth);
  return {
    year,
    month: zeroBasedMonth + 1,
    day,
    isClamped: day < anchorDay,
  };
}

/**
 * Normalizes privacy scope: 'SHARED' aliases to 'FAMILY'.
 */
export function normalizeScope(scope?: string): EventPrivacyScope {
  if (!scope) return 'FAMILY';
  const upper = scope.toUpperCase().trim();
  if (upper === 'SHARED') return 'FAMILY';
  if (upper === 'PERSONAL' || upper === 'COUPLE' || upper === 'FAMILY') return upper;
  return 'FAMILY';
}

/**
 * Security Rule: Evaluates whether a caller membership can view a Calendar Event.
 */
export function canViewCalendarEvent(
  store: SharedStore,
  callerMembership: AuthoritativeMembership,
  event: AuthoritativeCalendarEvent
): boolean {
  if (event.familyId !== callerMembership.familyId || event.isDeleted) return false;

  const scope = normalizeScope(event.scope);

  // 1. PERSONAL Scope: only creator or assigned member can view
  if (scope === 'PERSONAL') {
    return (
      event.creatorMemberId === callerMembership.memberProfileId ||
      (event.assignedMemberIds || []).includes(callerMembership.memberProfileId)
    );
  }

  // 2. COUPLE Scope: restricted to adult partners (OWNER, ADMIN, or COUPLE role)
  if (scope === 'COUPLE') {
    return canAccessCoupleScope(store, callerMembership);
  }

  // 3. Linked Task delegation
  if (event.sourceEntityType === 'TASK' && event.sourceEntityId) {
    const parentTask = (store.tasks || store.planningTasks || []).find(
      (t) => t.id === event.sourceEntityId && !t.isDeleted
    );
    if (parentTask && !canViewTask(store, callerMembership, parentTask)) {
      return false;
    }
  }

  // 4. FAMILY / SHARED: visible to all authenticated members (including GUEST read-only)
  return true;
}

/**
 * Security Rule: Evaluates whether a caller membership can mutate a Calendar Event.
 */
export function canMutateCalendarEvent(
  store: SharedStore,
  callerMembership: AuthoritativeMembership,
  event: AuthoritativeCalendarEvent,
  operation: 'CREATE' | 'UPDATE' | 'DELETE'
): { allowed: boolean; errorCode?: string; errorMessage?: string } {
  // GUEST cannot mutate any records
  if (callerMembership.role === 'GUEST') {
    return {
      allowed: false,
      errorCode: 'GUEST_READ_ONLY',
      errorMessage: 'GUEST role has read-only access and cannot create or modify calendar events.',
    };
  }

  const scope = normalizeScope(event.scope);

  // PERSONAL scope: only owner can mutate
  if (scope === 'PERSONAL') {
    const isOwner =
      event.creatorMemberId === callerMembership.memberProfileId ||
      (event.assignedMemberIds || []).includes(callerMembership.memberProfileId);
    if (!isOwner) {
      return {
        allowed: false,
        errorCode: 'PERSONAL_SCOPE_RESTRICTED',
        errorMessage: 'Cannot modify a personal calendar event owned by another family member.',
      };
    }
    return { allowed: true };
  }

  // COUPLE scope: restricted to adult partners
  if (scope === 'COUPLE') {
    if (!canAccessCoupleScope(store, callerMembership)) {
      return {
        allowed: false,
        errorCode: 'COUPLE_SCOPE_RESTRICTED',
        errorMessage: 'Couple events are restricted to adult partners and family administrators.',
      };
    }
    return { allowed: true };
  }

  // CHILD role restrictions on FAMILY events
  if (callerMembership.role === 'CHILD') {
    if (operation === 'DELETE') {
      return {
        allowed: false,
        errorCode: 'CHILD_CANNOT_DELETE_FAMILY_EVENT',
        errorMessage: 'Children cannot delete shared household calendar events.',
      };
    }
    // Children can only update events they created or are assigned to
    if (operation === 'UPDATE') {
      const isAssigned =
        event.creatorMemberId === callerMembership.memberProfileId ||
        (event.assignedMemberIds || []).includes(callerMembership.memberProfileId);
      if (!isAssigned) {
        return {
          allowed: false,
          errorCode: 'PERMISSION_DENIED',
          errorMessage: 'Children can only modify calendar events they created or are assigned to.',
        };
      }
    }
  }

  return { allowed: true };
}

/**
 * Security Rule: Evaluates whether a caller membership can view a Routine.
 */
export function canViewRoutine(
  store: SharedStore,
  callerMembership: AuthoritativeMembership,
  routine: AuthoritativeRoutine
): boolean {
  if (routine.familyId !== callerMembership.familyId || routine.isDeleted) return false;

  const scope = normalizeScope(routine.scope);
  if (scope === 'PERSONAL') {
    return (
      routine.ownerMemberId === callerMembership.memberProfileId ||
      (routine.assignedMemberIds || []).includes(callerMembership.memberProfileId)
    );
  }
  if (scope === 'COUPLE') {
    return canAccessCoupleScope(store, callerMembership);
  }
  return true;
}

/**
 * Security Rule: Evaluates whether a caller membership can mutate a Routine definition.
 */
export function canMutateRoutine(
  store: SharedStore,
  callerMembership: AuthoritativeMembership,
  routine: AuthoritativeRoutine,
  operation: 'CREATE' | 'UPDATE' | 'DELETE' | 'PAUSE'
): { allowed: boolean; errorCode?: string; errorMessage?: string } {
  if (callerMembership.role === 'GUEST') {
    return {
      allowed: false,
      errorCode: 'GUEST_READ_ONLY',
      errorMessage: 'GUEST role has read-only access and cannot create or modify routines.',
    };
  }

  const scope = normalizeScope(routine.scope);
  if (scope === 'PERSONAL') {
    const isOwner =
      routine.ownerMemberId === callerMembership.memberProfileId ||
      (routine.assignedMemberIds || []).includes(callerMembership.memberProfileId);
    if (!isOwner) {
      return {
        allowed: false,
        errorCode: 'PERSONAL_SCOPE_RESTRICTED',
        errorMessage: 'Cannot modify a personal routine belonging to another family member.',
      };
    }
    return { allowed: true };
  }

  if (scope === 'COUPLE') {
    if (!canAccessCoupleScope(store, callerMembership)) {
      return {
        allowed: false,
        errorCode: 'COUPLE_SCOPE_RESTRICTED',
        errorMessage: 'Couple routines can only be modified by adult partners.',
      };
    }
    return { allowed: true };
  }

  // Children cannot delete or create family-wide routines
  if (callerMembership.role === 'CHILD') {
    if (operation === 'DELETE' || operation === 'CREATE') {
      return {
        allowed: false,
        errorCode: 'CHILD_CANNOT_MANAGE_ROUTINES',
        errorMessage: 'Children cannot create or delete shared family routines.',
      };
    }
    if (
      routine.ownerMemberId !== callerMembership.memberProfileId &&
      !(routine.assignedMemberIds || []).includes(callerMembership.memberProfileId)
    ) {
      return {
        allowed: false,
        errorCode: 'PERMISSION_DENIED',
        errorMessage: 'Children can only modify routines assigned to them.',
      };
    }
  }

  return { allowed: true };
}

/**
 * Determines whether a routine is scheduled to execute on a specific date (YYYY-MM-DD).
 */
export function doesRoutineMatchDate(routine: AuthoritativeRoutine, dateIso: string): boolean {
  if (routine.isDeleted || routine.isPaused) return false;

  const [yStr, mStr, dStr] = dateIso.split('-');
  const year = parseInt(yStr, 10);
  const month = parseInt(mStr, 10) - 1; // 0-based
  const day = parseInt(dStr, 10);
  const dateObj = new Date(year, month, day);
  const dayOfWeek = dateObj.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday

  switch (routine.frequency) {
    case 'DAILY':
      return true;
    case 'WEEKDAYS':
      return dayOfWeek >= 1 && dayOfWeek <= 5;
    case 'WEEKENDS':
      return dayOfWeek === 0 || dayOfWeek === 6;
    case 'WEEKLY':
      return (
        (routine.targetWeekdays || []).includes(dayOfWeek) ||
        (routine.targetWeekdays.length === 0 && dayOfWeek === 1) // default Monday
      );
    case 'BIWEEKLY': {
      // Check if dayOfWeek matches target and week number parity matches
      const targetMatches = (routine.targetWeekdays || []).includes(dayOfWeek);
      if (!targetMatches) return false;
      const startOfYear = new Date(year, 0, 1);
      const pastDays = Math.floor((dateObj.getTime() - startOfYear.getTime()) / 86400000);
      const weekNumber = Math.ceil((pastDays + startOfYear.getDay() + 1) / 7);
      return weekNumber % 2 === 0;
    }
    case 'MONTHLY': {
      const anchor = routine.anchorMonthDay || 1;
      const { day: targetDay } = calculateMonthAnchorDate(year, month, anchor);
      return day === targetDay;
    }
    case 'CUSTOM':
      return (routine.targetWeekdays || []).includes(dayOfWeek);
    default:
      return true;
  }
}

/**
 * Ensures routine occurrences are generated for a given date range.
 * Does NOT duplicate existing occurrences or overwrite user modifications.
 */
export function ensureRoutineOccurrencesForRange(
  store: SharedStore,
  familyId: string,
  startDateIso: string,
  endDateIso: string,
  persistToStore = true
): AuthoritativeRoutineOccurrence[] {
  const routines = store.routines || [];
  const occurrences: AuthoritativeRoutineOccurrence[] = (store as any).routineOccurrences || [];

  const activeRoutines = routines.filter((r) => r.familyId === familyId && !r.isDeleted);
  const start = new Date(startDateIso);
  const end = new Date(endDateIso);
  const generated: AuthoritativeRoutineOccurrence[] = [];

  const curr = new Date(start);
  while (curr <= end) {
    const dateIso = curr.toISOString().slice(0, 10);

    for (const routine of activeRoutines) {
      if (doesRoutineMatchDate(routine, dateIso)) {
        const occId = `occ-${routine.id}-${dateIso}`;
        let existing = occurrences.find((o) => o.id === occId);
        if (!existing) {
          const stepCompletions: Record<string, boolean> = {};
          (routine.steps || []).forEach((s: RoutineStep) => {
            stepCompletions[s.id] = false;
          });

          existing = {
            id: occId,
            familyId,
            routineId: routine.id,
            targetDate: dateIso,
            targetTime: routine.targetTimeOfDay,
            status: 'PENDING',
            stepCompletions,
            pointsAwarded: 0,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };
          if (persistToStore) {
            (store as any).routineOccurrences = occurrences;
            occurrences.push(existing);
          }
        }
        generated.push(existing);
      }
    }
    curr.setDate(curr.getDate() + 1);
  }

  return generated;
}

/**
 * Completes a routine occurrence for a target date.
 * IMPORTANT: This operation DOES NOT mark or mutate the parent Routine definition as completed!
 * The routine definition remains active for future occurrences while updating streak and awarding points.
 */
export function completeRoutineOccurrence(
  store: SharedStore,
  familyId: string,
  routineId: string,
  occurrenceId: string,
  completingMemberId: string
): { occurrence: AuthoritativeRoutineOccurrence; routine: AuthoritativeRoutine; pointsAwarded: number } {
  store.routines = store.routines || [];
  (store as any).routineOccurrences = (store as any).routineOccurrences || [];
  const occurrences: AuthoritativeRoutineOccurrence[] = (store as any).routineOccurrences;

  const routine = store.routines.find((r) => r.id === routineId && r.familyId === familyId);
  if (!routine) {
    throw new Error('ROUTINE_NOT_FOUND');
  }

  let occurrence = occurrences.find((o) => o.id === occurrenceId && o.familyId === familyId);
  const now = Date.now();

  if (!occurrence) {
    // Auto-create occurrence if completing on the fly
    const todayIso = new Date().toISOString().slice(0, 10);
    const stepCompletions: Record<string, boolean> = {};
    (routine.steps || []).forEach((s: RoutineStep) => {
      stepCompletions[s.id] = true;
    });

    occurrence = {
      id: occurrenceId,
      familyId,
      routineId,
      targetDate: todayIso,
      targetTime: routine.targetTimeOfDay,
      status: 'COMPLETED',
      completedAt: now,
      completedByMemberId: completingMemberId,
      stepCompletions,
      pointsAwarded: routine.pointsReward || 10,
      createdAt: now,
      updatedAt: now,
    };
    occurrences.push(occurrence);
  } else {
    // Mark all steps as complete
    const stepCompletions: Record<string, boolean> = { ...occurrence.stepCompletions };
    (routine.steps || []).forEach((s: RoutineStep) => {
      stepCompletions[s.id] = true;
    });

    occurrence.status = 'COMPLETED';
    occurrence.completedAt = now;
    occurrence.completedByMemberId = completingMemberId;
    occurrence.stepCompletions = stepCompletions;
    occurrence.pointsAwarded = routine.pointsReward || 10;
    occurrence.updatedAt = now;
  }

  // Award points to the completing member
  const member = (store.familyMembers || []).find((m) => m.id === completingMemberId);
  if (member) {
    member.pointsBalance = (member.pointsBalance || 0) + (routine.pointsReward || 10);
    member.updatedAt = now;
  }

  // Update routine streak metrics WITHOUT modifying routine completion status
  const targetDateIso = occurrence.targetDate;
  const lastDate = routine.lastCompletedDate;

  if (lastDate) {
    const diffDays = Math.round(
      (new Date(targetDateIso).getTime() - new Date(lastDate).getTime()) / 86400000
    );
    if (diffDays === 1) {
      routine.streakCount += 1;
    } else if (diffDays === 0) {
      // Completed another occurrence on the same day; preserve streak
    } else {
      routine.streakCount = 1;
    }
  } else {
    routine.streakCount = 1;
  }

  routine.bestStreakCount = Math.max(routine.bestStreakCount || 0, routine.streakCount);
  routine.lastCompletedDate = targetDateIso;
  routine.version += 1;
  routine.updatedAt = now;

  return {
    occurrence,
    routine,
    pointsAwarded: routine.pointsReward || 10,
  };
}

/**
 * Skips a routine occurrence with an optional reason.
 */
export function skipRoutineOccurrence(
  store: SharedStore,
  familyId: string,
  routineId: string,
  occurrenceId: string,
  skippingMemberId: string,
  reason?: string
): { occurrence: AuthoritativeRoutineOccurrence; routine: AuthoritativeRoutine } {
  store.routines = store.routines || [];
  (store as any).routineOccurrences = (store as any).routineOccurrences || [];
  const occurrences: AuthoritativeRoutineOccurrence[] = (store as any).routineOccurrences;

  const routine = store.routines.find((r) => r.id === routineId && r.familyId === familyId);
  if (!routine) {
    throw new Error('ROUTINE_NOT_FOUND');
  }

  let occurrence = occurrences.find((o) => o.id === occurrenceId && o.familyId === familyId);
  const now = Date.now();

  if (!occurrence) {
    occurrence = {
      id: occurrenceId,
      familyId,
      routineId,
      targetDate: new Date().toISOString().slice(0, 10),
      targetTime: routine.targetTimeOfDay,
      status: 'SKIPPED',
      skippedReason: reason || 'Skipped by member',
      skippedByMemberId: skippingMemberId,
      stepCompletions: {},
      pointsAwarded: 0,
      createdAt: now,
      updatedAt: now,
    };
    occurrences.push(occurrence);
  } else {
    occurrence.status = 'SKIPPED';
    occurrence.skippedReason = reason || 'Skipped by member';
    occurrence.skippedByMemberId = skippingMemberId;
    occurrence.updatedAt = now;
  }

  return { occurrence, routine };
}

/**
 * Toggles a checklist step within an occurrence.
 * If all steps become completed, the occurrence automatically advances to COMPLETED.
 */
export function toggleOccurrenceStep(
  store: SharedStore,
  familyId: string,
  routineId: string,
  occurrenceId: string,
  stepId: string,
  isDone: boolean,
  actingMemberId: string
): { occurrence: AuthoritativeRoutineOccurrence; routine: AuthoritativeRoutine } {
  store.routines = store.routines || [];
  (store as any).routineOccurrences = (store as any).routineOccurrences || [];
  const occurrences: AuthoritativeRoutineOccurrence[] = (store as any).routineOccurrences;

  const routine = store.routines.find((r) => r.id === routineId && r.familyId === familyId);
  if (!routine) throw new Error('ROUTINE_NOT_FOUND');

  let occurrence = occurrences.find((o) => o.id === occurrenceId && o.familyId === familyId);
  const now = Date.now();

  if (!occurrence) {
    const stepCompletions: Record<string, boolean> = {};
    (routine.steps || []).forEach((s: RoutineStep) => {
      stepCompletions[s.id] = s.id === stepId ? isDone : false;
    });
    occurrence = {
      id: occurrenceId,
      familyId,
      routineId,
      targetDate: new Date().toISOString().slice(0, 10),
      status: 'IN_PROGRESS',
      stepCompletions,
      pointsAwarded: 0,
      createdAt: now,
      updatedAt: now,
    };
    occurrences.push(occurrence);
  } else {
    occurrence.stepCompletions[stepId] = isDone;
    occurrence.updatedAt = now;

    // Check if all steps done
    const allDone = (routine.steps || []).every((s: RoutineStep) => occurrence!.stepCompletions[s.id]);
    if (allDone) {
      return completeRoutineOccurrence(store, familyId, routineId, occurrenceId, actingMemberId);
    } else {
      const anyDone = Object.values(occurrence.stepCompletions).some(Boolean);
      occurrence.status = anyDone ? 'IN_PROGRESS' : 'PENDING';
    }
  }

  return { occurrence, routine };
}

/**
 * Converts a routine occurrence into a full canonical task in the unified planning system.
 * Automatically wires task checklists and triggers calendar synchronization.
 */
export function convertRoutineOccurrenceToTask(
  store: SharedStore,
  familyId: string,
  routineId: string,
  occurrenceId: string,
  callerMembership: AuthoritativeMembership
): { task: AuthoritativeTask; occurrence: AuthoritativeRoutineOccurrence } {
  store.routines = store.routines || [];
  (store as any).routineOccurrences = (store as any).routineOccurrences || [];
  const occurrences: AuthoritativeRoutineOccurrence[] = (store as any).routineOccurrences;

  const routine = store.routines.find((r) => r.id === routineId && r.familyId === familyId);
  if (!routine) throw new Error('ROUTINE_NOT_FOUND');

  const occurrence = occurrences.find((o) => o.id === occurrenceId && o.familyId === familyId);
  if (!occurrence) throw new Error('OCCURRENCE_NOT_FOUND');

  store.tasks = store.tasks || store.planningTasks || [];
  const now = Date.now();
  const taskId = `task-routine-${routine.id}-${occurrence.targetDate}`;

  // Check if already converted
  const existingTask = store.tasks.find((t) => t.id === taskId);
  if (existingTask) {
    occurrence.linkedTaskId = taskId;
    return { task: existingTask, occurrence };
  }

  const checklistItems = (routine.steps || []).map((s: RoutineStep, idx: number) => ({
    id: `chk-${idx + 1}`,
    taskId,
    title: s.title,
    isDone: Boolean(occurrence.stepCompletions[s.id]),
    isCompleted: Boolean(occurrence.stepCompletions[s.id]),
    position: idx,
    updatedAt: now,
  }));

  const newTask: AuthoritativeTask = {
    id: taskId,
    familyId,
    title: `Routine: ${routine.title}`,
    description: routine.description || `Generated from ${routine.frequency} routine: ${routine.title}`,
    notes: routine.description || `Generated from ${routine.frequency} routine: ${routine.title}`,
    creatorMemberId: callerMembership.memberProfileId,
    assignedMemberId: routine.assignedMemberIds[0] || callerMembership.memberProfileId,
    assignedToName: 'Household Member',
    sourceModule: 'ROUTINES' as any,
    scope: (routine.scope === 'COUPLE' ? 'COUPLE' : (routine.scope === 'PERSONAL' ? 'PERSONAL' : 'SHARED')) as any,
    priority: 'MEDIUM',
    status: occurrence.status === 'COMPLETED' ? 'COMPLETED' : 'TODO',
    isCompleted: occurrence.status === 'COMPLETED',
    completedAt: occurrence.completedAt || null,
    completedByMemberId: occurrence.completedByMemberId || null,
    startDate: null,
    dueDate: `${occurrence.targetDate}T${routine.targetTimeOfDay || '09:00'}:00`,
    dueLabel: `${occurrence.targetDate} ${routine.targetTimeOfDay || '09:00'}`,
    dueEpoch: Date.parse(`${occurrence.targetDate}T${routine.targetTimeOfDay || '09:00'}:00`) || now,
    timezone: routine.timezone || 'America/Los_Angeles',
    isOverdue: false,
    recurrenceRule: null,
    estimatedDurationMinutes: null,
    actualDurationMinutes: null,
    goalId: null,
    projectId: null,
    milestoneId: null,
    parentTaskId: null,
    dependencyTaskIds: [],
    checklistItems,
    checklist: checklistItems,
    progressPercentage: occurrence.status === 'COMPLETED' ? 100 : 0,
    comments: [],
    attachments: [],
    reminders: [
      {
        id: `rem-${taskId}-30`,
        taskId,
        offsetMinutesBeforeDue: 30,
        channel: 'IN_APP',
        label: '30 mins before routine',
      },
    ],
    linkedCalendarEventId: null,
    rewardPoints: routine.pointsReward || 15,
    activityHistory: [],
    isArchived: false,
    version: 1,
    createdAt: now,
    updatedAt: now,
    isDeleted: false,
  };

  store.tasks.push(newTask);
  occurrence.linkedTaskId = taskId;
  occurrence.updatedAt = now;

  // Synchronize into household calendar
  syncTaskWithCalendar(store, newTask, callerMembership.userAccountId || 'system');

  return { task: newTask, occurrence };
}

/**
 * Initializes default authoritative calendar events and routines for fam-1 if empty.
 */
export function seedDefaultCalendarAndRoutines(store: SharedStore, familyId = 'fam-1'): void {
  if (process.env.NODE_ENV === 'production' || familyId !== 'fam-1') {
    return;
  }
  const now = Date.now();
  store.calendarEvents = store.calendarEvents || [];
  store.routines = store.routines || [];
  (store as any).routineOccurrences = (store as any).routineOccurrences || [];

  const todayIso = new Date().toISOString().slice(0, 10);
  const tomorrowIso = new Date(now + 86400000).toISOString().slice(0, 10);
  const saturdayIso = new Date(now + 86400000 * 3).toISOString().slice(0, 10);

  if (!store.calendarEvents.some((e) => e.familyId === familyId)) {
    store.calendarEvents.push(
      {
        id: 'cal-event-1',
        familyId,
        title: 'Henderson Family Council & Sunday Roast',
        description: 'Weekly alignment, mission check-in, chore reviews, and dinner.',
        eventDate: todayIso,
        eventEpoch: Date.parse(`${todayIso}T16:00:00Z`) || now,
        isAllDay: false,
        category: 'FAMILY_EVENT',
        scope: 'FAMILY',
        location: 'Dining Room & Kitchen',
        timezone: 'America/Los_Angeles',
        creatorMemberId: 'mem-sarah',
        assignedMemberIds: ['mem-sarah', 'mem-david'],
        attendees: [
          { memberId: 'mem-sarah', status: 'ACCEPTED' },
          { memberId: 'mem-david', status: 'ACCEPTED' },
          { memberId: 'mem-lucas', status: 'INVITED' },
          { memberId: 'mem-charlotte', status: 'INVITED' },
        ],
        reminders: [
          { id: 'rem-c1', offsetMinutesBefore: 120, channel: 'IN_APP', label: '2 hours before council' },
        ],
        recurrenceRule: 'FREQ=WEEKLY;BYDAY=SU',
        isDeleted: false,
        createdAt: now - 86400000 * 3,
        updatedAt: now,
        version: 1,
      },
      {
        id: 'cal-event-2',
        familyId,
        title: 'David & Sarah Anniversary Weekend Planning',
        description: 'Private couple alignment on travel itinerary and budget.',
        eventDate: tomorrowIso,
        eventEpoch: Date.parse(`${tomorrowIso}T20:30:00Z`) || now + 86400000,
        isAllDay: false,
        category: 'ANNIVERSARY',
        scope: 'COUPLE',
        location: 'Study / Terrace',
        timezone: 'America/Los_Angeles',
        creatorMemberId: 'mem-david',
        assignedMemberIds: ['mem-sarah', 'mem-david'],
        attendees: [
          { memberId: 'mem-sarah', status: 'ACCEPTED' },
          { memberId: 'mem-david', status: 'ACCEPTED' },
        ],
        reminders: [
          { id: 'rem-c2', offsetMinutesBefore: 60, channel: 'IN_APP', label: '1 hour before alignment' },
        ],
        isDeleted: false,
        createdAt: now - 86400000 * 2,
        updatedAt: now,
        version: 1,
      },
      {
        id: 'cal-event-3',
        familyId,
        title: 'Charlotte Pediatric Wellness Checkup',
        description: 'Annual wellness and immunization visit with Dr. Vance.',
        eventDate: saturdayIso,
        eventEpoch: Date.parse(`${saturdayIso}T10:00:00Z`) || now + 86400000 * 3,
        isAllDay: false,
        category: 'APPOINTMENT',
        scope: 'FAMILY',
        location: 'Pacific Heights Pediatrics',
        timezone: 'America/Los_Angeles',
        creatorMemberId: 'mem-sarah',
        assignedMemberIds: ['mem-sarah', 'mem-charlotte'],
        attendees: [
          { memberId: 'mem-sarah', status: 'ACCEPTED' },
          { memberId: 'mem-charlotte', status: 'ACCEPTED' },
        ],
        reminders: [
          { id: 'rem-c3', offsetMinutesBefore: 1440, channel: 'IN_APP', label: '1 day before appointment' },
        ],
        isDeleted: false,
        createdAt: now - 86400000,
        updatedAt: now,
        version: 1,
      }
    );
  }

  if (!store.routines.some((r) => r.familyId === familyId)) {
    store.routines.push(
      {
        id: 'rtn-morning-household',
        familyId,
        title: 'Morning Household Rhythm',
        description: 'Mindful wake-up, bedroom tidy, dog walk, and nutritious breakfast.',
        category: 'MORNING',
        frequency: 'WEEKDAYS',
        targetWeekdays: [1, 2, 3, 4, 5],
        targetTimeOfDay: '07:00',
        scope: 'FAMILY',
        ownerMemberId: 'mem-sarah',
        assignedMemberIds: ['mem-sarah', 'mem-david', 'mem-lucas', 'mem-charlotte'],
        steps: [
          { id: 'step-m1', title: 'Make bed and open bedroom blinds', orderIndex: 0, estimatedMinutes: 5 },
          { id: 'step-m2', title: 'Feed & walk Buster (golden retriever)', orderIndex: 1, estimatedMinutes: 20 },
          { id: 'step-m3', title: 'Prepare fresh breakfast and pack water bottles', orderIndex: 2, estimatedMinutes: 15 },
          { id: 'step-m4', title: '5-minute family daily intention & gratitude', orderIndex: 3, estimatedMinutes: 5 },
        ],
        pointsReward: 15,
        timezone: 'America/Los_Angeles',
        isPaused: false,
        streakCount: 6,
        bestStreakCount: 14,
        lastCompletedDate: new Date(now - 86400000).toISOString().slice(0, 10),
        isDeleted: false,
        createdAt: now - 86400000 * 14,
        updatedAt: now,
        version: 1,
      },
      {
        id: 'rtn-evening-winddown',
        familyId,
        title: 'Evening Kitchen Close & Wind-Down',
        description: 'Reset counters, run dishwasher, pack backpacks, and read for 20 minutes.',
        category: 'EVENING',
        frequency: 'DAILY',
        targetWeekdays: [0, 1, 2, 3, 4, 5, 6],
        targetTimeOfDay: '20:30',
        scope: 'FAMILY',
        ownerMemberId: 'mem-david',
        assignedMemberIds: ['mem-david', 'mem-lucas', 'mem-charlotte'],
        steps: [
          { id: 'step-e1', title: 'Wipe countertops and start dishwasher cycle', orderIndex: 0, estimatedMinutes: 10 },
          { id: 'step-e2', title: 'Pack school backpacks and check homework folders', orderIndex: 1, estimatedMinutes: 10 },
          { id: 'step-e3', title: 'Lock doors, arm perimeter, and set thermostat to 66°F', orderIndex: 2, estimatedMinutes: 5 },
          { id: 'step-e4', title: '20-minute lights-out quiet reading', orderIndex: 3, estimatedMinutes: 20 },
        ],
        pointsReward: 20,
        timezone: 'America/Los_Angeles',
        isPaused: false,
        streakCount: 9,
        bestStreakCount: 21,
        lastCompletedDate: new Date(now - 86400000).toISOString().slice(0, 10),
        isDeleted: false,
        createdAt: now - 86400000 * 20,
        updatedAt: now,
        version: 1,
      },
      {
        id: 'rtn-couple-connection',
        familyId,
        title: 'Evening Decompression & Check-In',
        description: 'Private 15-minute adult connection, calendar review, and gratitude sharing.',
        category: 'MARRIAGE',
        frequency: 'DAILY',
        targetWeekdays: [0, 1, 2, 3, 4, 5, 6],
        targetTimeOfDay: '21:30',
        scope: 'COUPLE',
        ownerMemberId: 'mem-sarah',
        assignedMemberIds: ['mem-sarah', 'mem-david'],
        steps: [
          { id: 'step-c1', title: 'Tea / decaf espresso check-in on today highlights', orderIndex: 0, estimatedMinutes: 5 },
          { id: 'step-c2', title: 'Preview tomorrow schedule & school logistics', orderIndex: 1, estimatedMinutes: 5 },
          { id: 'step-c3', title: 'Affirmation and partner gratitude', orderIndex: 2, estimatedMinutes: 5 },
        ],
        pointsReward: 25,
        timezone: 'America/Los_Angeles',
        isPaused: false,
        streakCount: 12,
        bestStreakCount: 30,
        lastCompletedDate: new Date(now - 86400000).toISOString().slice(0, 10),
        isDeleted: false,
        createdAt: now - 86400000 * 30,
        updatedAt: now,
        version: 1,
      }
    );
  }

  // Pre-seed occurrences for today
  ensureRoutineOccurrencesForRange(store, familyId, todayIso, saturdayIso);
}
