# FAMILYOS — STAGE 3.3.3 AUDIT REPORT
## Calendar & Routines Architecture, Implementation Inventory, Gap Analysis, and Reuse Plan

**Audit Date**: November 2026  
**Auditor**: FamilyOS Principal Systems & Synchronization Engineer  
**Stage Target**: Stage 3.3.3 — Calendar & Routines Audit  
**Authoritative Backend**: Firebase Auth + Cloud Firestore (`gen-lang-client-0741697651`, DB `ai-studio-familyos-8f842ec0-cec0-443c-b279-e4955acacfaf`), Express Gateway (`server.ts`, `calendarRoutes.ts`, `calendarAndRoutines.ts`, `planningRoutes.ts`, `planningAndExecution.ts`, `authAndRbac.ts`, `backupAndMigration.ts`)  
**Client Applications**: Android Native (Kotlin + Jetpack Compose + Room v3 + SQLCipher), React SPA (TypeScript + Tailwind CSS)

---

## 1. Executive Summary & Verification Methodology

This audit inspects the actual source code across the Android Native, Express Gateway, Cloud Firestore, and React Web layers of FamilyOS to establish the real implementation state of the **Calendar & Routines** subsystem.

### Room Database Entity Count Verification
As strictly mandated by the audit instructions, the Room SQLite database entities were directly inspected and counted in `android/app/src/main/java/com/familyos/core/database/FamilyOSDatabase.kt`:
- **Stage 1 Core Entities (8)**: `LocalUserProfileEntity`, `FamilyWorkspaceEntity`, `FamilyMembershipEntity`, `FamilyMemberEntity`, `FamilyInvitationEntity`, `GuardianRelationshipEntity`, `SyncQueueEntity`, `AuditEventEntity`.
- **Stage 2 Family & Household Entities (16)**: `FamilyRelationshipEntity`, `FamilyGoalEntity`, `ProjectEntity`, `TaskEntity`, `TaskChecklistItemEntity`, `RecipeEntity`, `RecipeIngredientEntity`, `RecipeInstructionEntity`, `MealPlanEntryEntity`, `GroceryListItemEntity`, `ChoreEntity`, `ChoreCompletionHistoryEntity`, `HomeAssetEntity`, `AssetMaintenanceEntity`, `HouseholdWishlistEntity`, `CalendarEventEntity`.
- **Stage 3 Finance & Wellbeing Entities (15)**: `FinancialAccountEntity`, `FinancialTransactionEntity`, `RecurringTransactionEntity`, `EnvelopeBudgetEntity`, `SavingsGoalEntity`, `BillSubscriptionEntity`, `WellbeingProfileEntity`, `HealthAllergyEntity`, `HealthMedicationEntity`, `HealthVaccinationEntity`, `HealthcareAppointmentEntity`, `EmergencyContactEntity`, `EmergencyPlanEntity`, `EmergencySupplyEntity`, `EmergencyChecklistItemEntity`.
- **Total Registered Entities**: **Exactly 39 Room Entities** registered in `@Database(entities = [...], version = 3)`.
- **Key Finding**: Room table `calendar_events` exists in Schema Version 3, but there are **no separate Room entities for Routines or Routine Occurrences**.

---

## 2. Feature Classification Matrix

Every feature is classified using the required audit criteria:
- **COMPLETE**: Implemented and verified by automated execution tests.
- **PARTIAL**: Implemented in code, but incomplete in edge cases or platform symmetry.
- **MISSING**: Not implemented in source code.
- **DUPLICATED**: Competing or duplicate implementations exist.
- **UNSAFE**: Privacy, security, data integrity, or architectural concern.
- **UNVERIFIED**: Implementation exists, but execution evidence is missing or unexecuted.

### 2.1 Calendar System

| Feature / Capability | Classification | File Paths & Symbols | Evidence from Source Code | Missing Functionality & Risks | Recommended Reuse Strategy |
| :--- | :---: | :--- | :--- | :--- | :--- |
| **Room Calendar Schema** | **COMPLETE** | `Stage2Entities.kt:554-585`<br>`calendar_events` table | `CalendarEventEntity` has `id`, `familyId`, `title`, `eventDate: Long`, `eventTimeMillis: Long?`, `category: String`, `sourceEntityId: String?`, `description: String?`, `createdAt`. Indexes on `(family_id, event_date)` and `category`. | Schema lacks native columns for `scope` (defaults to FAMILY) and `is_all_day` in SQL table. | **REUSE** `calendar_events` table as-is. Avoid breaking Room v3 schema migrations; encode scope/allDay in metadata or domain mapping. |
| **Room Calendar DAO** | **COMPLETE** | `Stage2Daos.kt:190-204`<br>`CalendarDao` | `observeEventsBetween(familyId, start, end): Flow<List<CalendarEventEntity>>`, `observeAllEvents(familyId)`, `insertEvent(event)`, `deleteEvent(id)`. | Reactive Flow queries are verified. Lacks full-text search query. | **REUSE** `CalendarDao` as canonical local DAO for calendar events. |
| **Android Calendar Repository** | **COMPLETE** | `Stage2RepositoriesImpl.kt:650-698`<br>`CalendarRepositoryImpl` | Implements `observeEvents`, `observeAllEvents`, `addEvent`, and `deleteEvent` using Room DAO on `Dispatchers.IO`. | Fully functional and non-destructive. | **REUSE** `CalendarRepositoryImpl` without alteration. |
| **Authoritative Calendar Backend Engine** | **COMPLETE** | `calendarAndRoutines.ts:40-95`<br>`AuthoritativeCalendarEvent` | Defines `id`, `familyId`, `title`, `description`, `eventDate`, `eventEpoch`, `endEpoch`, `isAllDay`, `category`, `scope`, `location`, `timezone`, `creatorMemberId`, `assignedMemberIds`, `attendees`, `reminders`, `recurrenceRule`, `isCompleted`. | Standalone and task-linked models unified. | **REUSE** `AuthoritativeCalendarEvent` as the canonical backend calendar representation. |
| **Calendar REST API Endpoints** | **COMPLETE** | `calendarRoutes.ts:60-350`<br>`GET/POST/PUT/DELETE /api/v1/calendar/:familyId` | Implements full CRUD, timeline filtering (`startDate`, `endDate`, `category`, `scope`, `memberId`), atomic updates, audit logging, and task sync. | None. Verified in test suite. | **REUSE** `calendarRoutes.ts` as canonical Express calendar API. |
| **All-Day vs Timed Events** | **COMPLETE** | `calendarAndRoutines.ts`<br>`CalendarScreen.kt`<br>`Stage333CalendarExperience.tsx` | Boolean `isAllDay` flag toggles time input on Web and Android; preserves start-of-day epoch vs specific millisecond timestamp. | None. Verified in Gate 4 & 5. | **REUSE** existing `isAllDay` logic. |
| **Zero-Trust Privacy Scopes (`PERSONAL`, `COUPLE`, `FAMILY`)** | **COMPLETE** | `calendarAndRoutines.ts:160-250`<br>`canViewCalendarEvent`<br>`canMutateCalendarEvent` | `COUPLE` scope strictly blocks `CHILD` and `GUEST` (returns false or 403). `PERSONAL` scope restricts visibility to creator/assignee. `GUEST` is strictly read-only (`GUEST_READ_ONLY`). `CHILD` blocked from deleting family events (`CHILD_CANNOT_DELETE_FAMILY_EVENT`). | None. Verified in Gates 8–15. | **REUSE** `canViewCalendarEvent` and `canMutateCalendarEvent`. |
| **Bidirectional Task-to-Calendar Sync** | **COMPLETE** | `planningAndExecution.ts:626-720`<br>`syncTaskWithCalendar`<br>`calendarRoutes.ts:210-250` | Tasks with `dueDate` create/update `CALENDAR_EVENT:cal-task-${task.id}`. `PUT /api/v1/calendar/...` edits update the underlying task's `dueDate` in lockstep! | None. Verified in Gates 16–19. | **REUSE** `syncTaskWithCalendar` as canonical sync bridge. |

---

### 2.2 Routines & Occurrences System

| Feature / Capability | Classification | File Paths & Symbols | Evidence from Source Code | Missing Functionality & Risks | Recommended Reuse Strategy |
| :--- | :---: | :--- | :--- | :--- | :--- |
| **Routines Definition Model** | **COMPLETE** | `calendarAndRoutines.ts:100-140`<br>`AuthoritativeRoutine` | Stores `category` (MORNING, EVENING, HOUSEHOLD, MARRIAGE, etc.), `frequency` (DAILY, WEEKDAYS, WEEKENDS, WEEKLY, BIWEEKLY, MONTHLY, CUSTOM), `targetWeekdays`, `targetTimeOfDay`, `anchorMonthDay`, `steps: RoutineStep[]`, `pointsReward`, `isPaused`, `streakCount`, `bestStreakCount`. | Modeled in Express backend and Android domain `Stage2Models.kt`. | **REUSE** `AuthoritativeRoutine` as canonical routine definition. |
| **Decoupled Occurrence Model** | **COMPLETE** | `calendarAndRoutines.ts:145-165`<br>`AuthoritativeRoutineOccurrence` | Stores `id: occ-${routineId}-${targetDate}`, `targetDate`, `status` (PENDING, IN_PROGRESS, COMPLETED, SKIPPED), `stepCompletions: Record<string, boolean>`, `pointsAwarded`, `linkedTaskId`. | Distinct from Routine definition. | **REUSE** `AuthoritativeRoutineOccurrence`. |
| **Decoupled Completion Invariant** | **COMPLETE** | `calendarAndRoutines.ts:510-580`<br>`completeRoutineOccurrence` | Completing occurrence marks occurrence as `COMPLETED`, increments `routine.streakCount`, awards member points balance, but **DOES NOT mutate or complete the parent Routine definition**. | Invariant verified in Gate 27 & 28. | **CRITICAL INVARIANT**: Always maintain this decoupling. |
| **Checklist Step Execution** | **COMPLETE** | `calendarAndRoutines.ts:650-700`<br>`toggleOccurrenceStep`<br>`calendarRoutes.ts:580-620` | Toggling individual steps updates `occurrence.stepCompletions[stepId]`. If all steps complete, auto-promotes occurrence to `COMPLETED`. | None. Verified in Gates 24–25. | **REUSE** `toggleOccurrenceStep`. |
| **Pause & Resume Routine** | **COMPLETE** | `calendarAndRoutines.ts`<br>`calendarRoutes.ts:630-660`<br>`POST /.../pause` | Toggles `routine.isPaused` flag, records `pausedReason` and `pausedAt`. Suspends occurrence generation. | None. Verified in Gates 31–34. | **REUSE** `pauseResumeRoutine`. |
| **Convert Routine Occurrence to Canonical Task** | **COMPLETE** | `calendarAndRoutines.ts:700-790`<br>`convertRoutineOccurrenceToTask` | Converts occurrence to canonical `AuthoritativeTask` (`sourceModule: ROUTINES`) with cloned checklist items and auto calendar sync. Links `occurrence.linkedTaskId`. | None. Verified in Gates 35–37. | **REUSE** `convertRoutineOccurrenceToTask`. |
| **Android Room Persistence for Routines** | **PARTIAL** | `FamilyOSViewModel.kt:174-245`<br>`FamilyOSDatabase.kt` | Android handles routines in-memory via `_routines` and `_routineOccurrences` StateFlows; Room database does not have dedicated `routines` table to preserve Room v3 schema. | Offline changes to routines in Android native are queued in `sync_queue` rather than a local SQLite table. | **RECOMMENDATION**: Keep Room v3 schema intact without forcing a v4 migration; sync routines via `SyncQueueEntity` or add Room v4 in dedicated migration step if required. |

---

### 2.3 Recurrence, Timezone & Month-End Anchor Day Calculation

| Feature / Capability | Classification | File Paths & Symbols | Evidence from Source Code | Missing Functionality & Risks | Recommended Reuse Strategy |
| :--- | :---: | :--- | :--- | :--- | :--- |
| **Month-End Anchor Day Math** | **COMPLETE** | `calendarAndRoutines.ts:167-185`<br>`calculateMonthAnchorDate` | Math unit tests verify: 31st anchor clamps to Feb 28 in non-leap year (`isClamped: true`), to Feb 29 in leap year (`isClamped: true`), and restores to March 31 without drift. | None. Verified in Gates 38–40. | **REUSE** `calculateMonthAnchorDate`. |
| **Android Chore Recurrence Engine** | **COMPLETE** | `ChoreRecurrenceCalculator.kt:1-85` | Timezone-aware calculation for chores supporting DST, monthly anchor preservation, and interval jumps. | Only used for chores previously. | **REUSE** patterns from `ChoreRecurrenceCalculator.kt` for any client-side interval math. |
| **IANA Timezone Preservation** | **COMPLETE** | `calendarAndRoutines.ts`<br>`planningAndExecution.ts` | Stores canonical string `America/Los_Angeles` across all calendar events and tasks. Preserves timestamps in UTC milliseconds. | None. Verified. | **REUSE** `America/Los_Angeles` as default household timezone. |

---

### 2.4 User Interface & Client Experience

| Feature / Capability | Classification | File Paths & Symbols | Evidence from Source Code | Missing Functionality & Risks | Recommended Reuse Strategy |
| :--- | :---: | :--- | :--- | :--- | :--- |
| **Android Compose Calendar Screen** | **COMPLETE** | `CalendarScreen.kt:1-350` | Day/Week/Month/Agenda selector, Category filters, Routines tab with interactive checklist check-offs, streak count badge (🔥), and "Add Event" modal dialog. | Removed old static `sampleCalendarEvents`. | **REUSE** `CalendarScreen.kt`. |
| **Android ViewModel Wiring** | **COMPLETE** | `FamilyOSViewModel.kt:170-245, 1040-1180` | Exposes `calendarEvents`, `routines`, `routineOccurrences`. Provides `createCalendarEvent`, `deleteCalendarEvent`, `completeRoutineOccurrence`, `skipRoutineOccurrence`, `toggleRoutineStep`, `pauseResumeRoutine`, `convertRoutineToTask`. | All actions enqueue sync and audit events. | **REUSE** `FamilyOSViewModel.kt`. |
| **Web React Calendar Workspace** | **COMPLETE** | `Stage333CalendarExperience.tsx:1-550`<br>`App.tsx:383, 442` | Complete Month, Week, Day, and Agenda schedule modes, interactive routines dashboard, streak badges, step check-offs, Add Event modal, and live persona switcher. | Mounted under top-level navigation tab. | **REUSE** `Stage333CalendarExperience.tsx`. |

---

## 3. Canonical Systems Identification

To prevent architectural duplication or conflicting implementations, the canonical systems are identified as follows:

1. **Canonical Calendar System**:
   - Local Android Storage: Room table `calendar_events` (`CalendarEventEntity` in `Stage2Entities.kt`) and `CalendarDao` in `Stage2Daos.kt`.
   - Authoritative Backend Store: `store.calendarEvents` (`AuthoritativeCalendarEvent` in `calendarAndRoutines.ts`).
   - Synchronized Entity Key: `CALENDAR_EVENT:${eventId}` in `store.synchronizedEntities`.
   - API Gateway: `calendarRoutes.ts` mounted in `server.ts`.

2. **Canonical Task System**:
   - Local Android Storage: Room table `tasks` (`TaskEntity` in `Stage2Entities.kt`) and `GoalsAndTasksDao`.
   - Authoritative Backend Store: `store.tasks` / `store.planningTasks` (`AuthoritativeTask` in `planningAndExecution.ts`).
   - Single Canonical Engine: Reused across all 7 FamilyOS modules (`GOALS_PROJECTS`, `HOME_MANAGEMENT`, `MARRIAGE`, `PARENTING`, `SPIRITUAL_GROWTH`, `FAMILY_GOVERNANCE`, `PERSONAL_PLANNING`, `ROUTINES`).
   - **Rule**: Never create a separate task engine for routines; use `convertRoutineOccurrenceToTask`.

3. **Canonical Routine System**:
   - Backend Models: `AuthoritativeRoutine` and `AuthoritativeRoutineOccurrence` in `src/server/calendarAndRoutines.ts`.
   - Android Models: `Routine`, `RoutineStep`, and `RoutineOccurrence` in `Stage2Models.kt`.
   - API Routes: `/api/v1/routines/*` in `calendarRoutes.ts`.
   - **Rule**: Occurrences must remain decoupled from routine definitions.

4. **Canonical Recurrence & Calculation System**:
   - Client: `ChoreRecurrenceCalculator.kt` (`com.familyos.core.domain`).
   - Backend: `calculateMonthAnchorDate` and `doesRoutineMatchDate` in `src/server/calendarAndRoutines.ts`.

5. **Canonical Offline Synchronization System**:
   - Client: Room table `sync_queue` (`SyncQueueEntity`), `SyncRepositoryImpl.kt`, `SyncWorker.kt`, and `RemoteSyncGateway.kt`.
   - Backend: `/api/v1/sync/push` and `/api/v1/sync/pull` with `processedIdempotencyKeys` and `EVENT_BASED_MERGE`.

---

## 4. Risks, Blockers & Architectural Invariants

### 4.1 Identified Risks & Safeguards
1. **Room Database Schema Invariant (39 Entities)**:
   - The current Room database contains exactly 39 entities at Version 3. Adding new tables for `routines` or `routine_occurrences` would require `MIGRATION_3_4` and database schema modification.
   - *Safeguard*: Routines are managed via domain models and synchronized via `sync_queue` and the authoritative backend. Do not modify Room entities or migrations without explicit schema versioning approval.
2. **Decoupled Routine Execution**:
   - A routine definition must never be marked "COMPLETED". If a routine definition were marked completed, it would cease generating occurrences for future days, breaking daily and weekly rhythms.
   - *Safeguard*: Enforced by unit logic in `completeRoutineOccurrence()` and verified by Test Gate 28.
3. **Privacy Leakage on Couple and Personal Events**:
   - Exposing couple events to children or guests would violate FamilyOS zero-trust privacy rules.
   - *Safeguard*: Enforced at the Express API gateway in `canViewCalendarEvent()` and `canViewRoutine()`, returning filtered arrays or 403 HTTP status codes.

---

## 5. Concise Architecture Assessment

The FamilyOS Calendar & Routines architecture is sound, robust, and cleanly integrated:
- The system reuses the existing Room `calendar_events` table and the canonical `tasks` engine, preventing duplication.
- Privacy scopes (`PERSONAL`, `COUPLE`, `FAMILY`) are enforced server-side before serializing data to clients.
- Bidirectional task-to-calendar synchronization is verified end-to-end: rescheduling a task-linked calendar event updates the underlying task in lockstep.
- Decoupling of routine definitions from routine occurrences ensures daily rhythms remain active indefinitely while accurately recording daily completions and streak counts.

---

## 6. List of Files to Reuse for Stage 3.3.3

1. `android/app/src/main/java/com/familyos/core/database/FamilyOSDatabase.kt` (preserves 39 entities and Room v3)
2. `android/app/src/main/java/com/familyos/core/database/Stage2Entities.kt` (`CalendarEventEntity`)
3. `android/app/src/main/java/com/familyos/core/database/Stage2Daos.kt` (`CalendarDao`)
4. `android/app/src/main/java/com/familyos/core/domain/Stage2Models.kt` (`CalendarEvent`, `Routine`, `RoutineOccurrence`)
5. `android/app/src/main/java/com/familyos/core/data/Stage2RepositoriesImpl.kt` (`CalendarRepositoryImpl`)
6. `android/app/src/main/java/com/familyos/core/domain/ChoreRecurrenceCalculator.kt` (DST and recurrence math)
7. `android/app/src/main/java/com/familyos/core/viewmodel/FamilyOSViewModel.kt` (state flows & actions)
8. `android/app/src/main/java/com/familyos/feature/calendar/CalendarScreen.kt` (interactive UI)
9. `src/server/calendarAndRoutines.ts` (authoritative models, RBAC, anchor math)
10. `src/server/calendarRoutes.ts` (Express REST routes)
11. `src/server/planningAndExecution.ts` (`syncTaskWithCalendar`)
12. `src/server/authAndRbac.ts` (server-side RBAC and session verification)
13. `src/components/Stage333CalendarExperience.tsx` (React workspace)
14. `src/App.tsx` (navigation & view mounting)
15. `scripts/verify-stage-3-3-3.ts` (automated verification test suite)

---

## 7. Proposed Changes Requiring Approval

1. **Room v4 Migration (Optional)**: Whether to keep routines managed via domain flows and `sync_queue` (current behavior, 0 schema changes), or introduce `MIGRATION_3_4` with `routines` and `routine_occurrences` SQLite tables. (Recommendation: Keep current Room v3 intact to avoid client migration overhead).
2. **Notification Subsystem**: Future integration of Android system notification alarms for event reminders via `AlarmManager` / `WorkManager` (scheduled for Stage 5).
3. **Recurrence Expansion Horizon**: Default server-side recurrence expansion window (currently set to 30 days ahead).
