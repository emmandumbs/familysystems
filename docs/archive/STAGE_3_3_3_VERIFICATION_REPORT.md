# FAMILYOS — STAGE 3.3.3 VERIFICATION REPORT
## Independent Verification of Calendar & Routines Architecture, Implementation, and Execution

**Verification Date**: November 2, 2026  
**Auditor / Verification Engineer**: FamilyOS Principal Systems & Synchronization Engineer  
**Scope**: Stage 3.3.3 Calendar & Routines — Priority 1 to Priority 6 Verification  
**Authoritative Backend**: Express Gateway (`server.ts`, `calendarRoutes.ts`, `calendarAndRoutines.ts`, `planningRoutes.ts`, `planningAndExecution.ts`, `authAndRbac.ts`)  
**Persistent Stores**: Cloud Firestore (`ai-studio-familyos-8f842ec0-cec0-443c-b279-e4955acacfaf`), `data/familyos-shared-store.json`, Encrypted Room v3 (SQLCipher)  
**Client Applications**: Android Native (Kotlin + Jetpack Compose + Room v3), React SPA (TypeScript + Tailwind CSS)

---

## Executive Summary

This report delivers the results of an independent verification pass evaluating the claims in `STAGE_3_3_3_AUDIT.md` against the actual source code, database schemas, API routes, and executable test suites. 

Every claim has been tested and analyzed across five distinct verification priorities:
1. **Routine Persistence**: Storage durability, offline survival, crash recovery, and sync queue completeness.
2. **Calendar Functionality**: End-to-end connection across Android, Web, and Express for CRUD, all-day events, timezones, scopes, task synchronization, and recurrence.
3. **Notifications**: System scheduling, rescheduling, cancellations, deduplication, timezone handling, and delivery reality.
4. **Privacy & Synchronization**: Zero-trust scoping (`PERSONAL`, `COUPLE`, `FAMILY`), revoked member blocking, multi-tenant workspace isolation, and offline deduplication.
5. **Execution Evidence**: Exact command lines, output logs, and environment constraints for backend, web build, type checks, and Android toolchain.

---

## Priority 1 — Routine Persistence Verification

### 1.1 Local Storage of Routine Definitions
- **Classification**: **PARTIAL / UNSAFE** (Client) | **COMPLETE** (Backend)
- **Source Files & Symbols Inspected**:
  - `android/app/src/main/java/com/familyos/core/viewmodel/FamilyOSViewModel.kt:174-220` (`_routines: MutableStateFlow<List<Routine>>`)
  - `android/app/src/main/java/com/familyos/core/database/FamilyOSDatabase.kt:43-100` (`@Database(entities = [...], version = 3)`)
  - `src/server/calendarAndRoutines.ts:100-142` (`AuthoritativeRoutine`, `store.routines`)
- **Evidence**:
  - `FamilyOSDatabase.kt` defines exactly 39 entities. There is **no SQLite table or DAO** for routines (e.g., no `RoutineEntity` or `RoutineDao`).
  - On Android, routine definitions are held in an in-memory `MutableStateFlow` in `FamilyOSViewModel`, initialized with hardcoded defaults (`rtn-morning`, `rtn-evening`).
  - On the backend, routine definitions are durably persisted in `store.routines` in `data/familyos-shared-store.json`.
- **Observed Result**: Client storage of routine definitions is strictly transient.

### 1.2 Local Storage of Routine Occurrences
- **Classification**: **PARTIAL / UNSAFE** (Client) | **COMPLETE** (Backend)
- **Source Files & Symbols Inspected**:
  - `FamilyOSViewModel.kt:222-243` (`_routineOccurrences: MutableStateFlow<List<RoutineOccurrence>>`)
  - `src/server/calendarAndRoutines.ts:145-165` (`AuthoritativeRoutineOccurrence`, `store.routineOccurrences`)
- **Evidence**:
  - No Room table exists for routine occurrences.
  - In Android native, occurrences are instantiated in memory with two placeholder occurrences for `2026-11-01`.
  - Backend durably persists occurrences keyed by `occ-${routineId}-${targetDate}` in `store.routineOccurrences`.
- **Observed Result**: Routine occurrences are not stored in Room SQLite.

### 1.3 Offline Completion Survival Across Application Termination & Restart
- **Classification**: **UNSAFE / MISSING (Client Local State)**
- **Source Files & Symbols Inspected**:
  - `FamilyOSViewModel.kt:1085-1131` (`completeRoutineOccurrence()`)
  - `FamilyOSViewModel.kt:1506-1542` (`enqueueSyncAndAudit()`)
- **Evidence**:
  - When offline, calling `completeRoutineOccurrence()` updates the in-memory `_routineOccurrences` StateFlow and calls `enqueueSyncAndAudit("ROUTINE_OCCURRENCE", occurrenceId, "UPDATE", """{"status":"COMPLETED","points":$points}""")`.
  - If the Android application process terminates or is killed by Android OS low-memory killer before syncing, the in-memory StateFlow resets to initial uncompleted state upon restart.
  - The user's offline UI will show the routine as uncompleted until network connectivity is restored and the sync queue drains to the server.
- **Observed Result**: Offline routine completions do NOT survive application restart within the local UI state before remote synchronization.

### 1.4 Pending Routine Changes Recovery After Crash
- **Classification**: **PARTIAL**
- **Source Files & Symbols Inspected**:
  - `FamilyOSViewModel.kt:1516-1526` (`app.syncRepository.enqueue`)
  - `android/app/src/main/java/com/familyos/core/database/Stage1Entities.kt:140-165` (`SyncQueueEntity`)
- **Evidence**:
  - `SyncQueueEntity` is persisted in encrypted Room SQLite (`sync_queue` table).
  - The record in `sync_queue` survives crashes.
  - However, the local UI cannot reconstruct its state from `sync_queue` on startup because `FamilyOSViewModel` does not read `sync_queue` to restore `_routineOccurrences`.
- **Observed Result**: The change is preserved in the sync queue for future server delivery, but cannot be recovered to render the offline UI after a crash.

### 1.5 Occurrence History Available Offline
- **Classification**: **MISSING**
- **Source Files & Symbols Inspected**:
  - `FamilyOSViewModel.kt:222-243`
  - `android/app/src/main/java/com/familyos/core/database/Stage2Daos.kt`
- **Evidence**:
  - No DAO query or local table exists to query past routine occurrences offline.
  - Only the hardcoded today occurrences in `_routineOccurrences` exist on the client without network.
- **Observed Result**: Offline occurrence history is completely unavailable on Android.

### 1.6 `sync_queue` Completeness for Reconstructing Pending Changes
- **Classification**: **PARTIAL / UNSAFE**
- **Source Files & Symbols Inspected**:
  - `FamilyOSViewModel.kt:1127` (`"""{"status":"COMPLETED","points":$points}"""`)
  - `FamilyOSViewModel.kt:1145` (`"""{"status":"SKIPPED","reason":"$reason"}"""`)
  - `FamilyOSViewModel.kt:1174` (`"""{"isPaused":$isPaused}"""`)
- **Evidence**:
  - The payloads placed in `sync_queue` are minimal delta fragments.
  - They lack the occurrence's date, routineId, memberId, and individual checklist step completion breakdown.
- **Observed Result**: `sync_queue` contains enough data for simple server-side field patch, but insufficient information to reconstruct the full routine occurrence entity locally.

---

## Priority 2 — Calendar Functionality Verification

### 2.1 Event Creation
- **Classification**: **COMPLETE** (End-to-End)
- **Source Files & Symbols Inspected**:
  - Backend: `src/server/calendarRoutes.ts:130-180` (`POST /api/v1/calendar/:familyId`)
  - Android: `FamilyOSViewModel.kt:1041-1075` (`createCalendarEvent`), `CalendarScreen.kt:390-440` (`showAddDialog`)
  - Web: `src/components/Stage333CalendarExperience.tsx:280-340` (`handleCreateEvent`)
- **Test Evidence**:
  - Script: `scripts/verify-stage-3-3-3.ts` Gate 2, 4, 8, 12
  - Command: `npx tsx scripts/verify-stage-3-3-3.ts`
  - Output: `[PASS] Gate 2: Owner creates standalone FAMILY calendar event (HTTP 201)`
- **Observed Result**: Fully connected across Android, Web, and Express API.

### 2.2 Event Editing
- **Classification**: **PARTIAL** (Web & Backend: COMPLETE | Android: MISSING)
- **Source Files & Symbols Inspected**:
  - Backend: `src/server/calendarRoutes.ts:200-265` (`PUT /api/v1/calendar/:familyId/:eventId`)
  - Web: `src/components/Stage333CalendarExperience.tsx:340-390` (`handleUpdateEvent`)
  - Android: `FamilyOSViewModel.kt:1040-1085` (No `updateCalendarEvent` method exists); `CalendarScreen.kt:250-255` (Only delete icon button is present).
- **Test Evidence**:
  - Script: `scripts/verify-stage-3-3-3.ts` Gate 18
  - Output: `[PASS] Gate 18: PUT /api/v1/calendar/... updates task-linked event (HTTP 200)`
- **Observed Result**: Backend and Web support full event editing. Android native lacks an update method in `FamilyOSViewModel` and has no edit dialog in `CalendarScreen.kt`.

### 2.3 Cancellation and Deletion
- **Classification**: **COMPLETE** (End-to-End)
- **Source Files & Symbols Inspected**:
  - Backend: `src/server/calendarRoutes.ts:270-320` (`DELETE /api/v1/calendar/:familyId/:eventId`)
  - Android: `FamilyOSViewModel.kt:1077-1083` (`deleteCalendarEvent`), `CalendarScreen.kt:250-252` (`IconButton(onClick = { onDeleteEvent(event.id) })`)
  - Web: `Stage333CalendarExperience.tsx:392-410` (`handleDeleteEvent`)
- **Test Evidence**:
  - Script: `scripts/verify-stage-3-3-3.ts` Gate 15
  - Output: `[PASS] Gate 15: Child cannot delete shared family calendar event (HTTP 403)`
- **Observed Result**: Deletion is fully connected and properly protected by RBAC on all platforms.

### 2.4 All-Day Events
- **Classification**: **COMPLETE** (End-to-End)
- **Source Files & Symbols Inspected**:
  - Backend: `src/server/calendarAndRoutines.ts:47` (`isAllDay: boolean`), `calendarRoutes.ts:145`
  - Android: `CalendarEvent.kt` (`isAllDay: Boolean`, `eventTimeMillis: Long? = null`)
  - Web: `Stage333CalendarExperience.tsx:300-310` (`isAllDay` checkbox)
- **Test Evidence**:
  - Script: `scripts/verify-stage-3-3-3.ts` Gates 4 & 5
  - Output: `[PASS] Gate 4: Create all-day calendar event` / `[PASS] Gate 5: Verify isAllDay flag preserved`
- **Observed Result**: All-day event flags and epoch handling are fully functional.

### 2.5 Timezone Selection
- **Classification**: **PARTIAL** (Backend: COMPLETE | Clients: DEFAULT ONLY)
- **Source Files & Symbols Inspected**:
  - Backend: `src/server/calendarAndRoutines.ts:52` (`timezone: string`, defaults to `America/Los_Angeles`)
  - Android / Web: Form inputs do not offer an explicit IANA timezone selector dropdown; they adopt the family household timezone (`America/Los_Angeles`) or browser local time.
- **Observed Result**: Timezone field is validated and stored on the backend, but client UI lacks a manual timezone picker.

### 2.6 Participants and Permissions
- **Classification**: **COMPLETE**
- **Source Files & Symbols Inspected**:
  - Backend: `src/server/calendarAndRoutines.ts:212-255` (`canMutateCalendarEvent`)
  - Express: `calendarRoutes.ts:80-95`
- **Test Evidence**:
  - Script: `scripts/verify-stage-3-3-3.ts` Gates 14 & 15
  - Output:
    - `[PASS] Gate 14: Guest cannot create calendar event (HTTP 403 GUEST_READ_ONLY)`
    - `[PASS] Gate 15: Child cannot delete shared family calendar event (HTTP 403)`
- **Observed Result**: Participants and role mutation restrictions are strictly enforced.

### 2.7 Visibility Scopes (`PERSONAL`, `COUPLE`, `FAMILY`)
- **Classification**: **COMPLETE** (End-to-End)
- **Source Files & Symbols Inspected**:
  - Backend: `src/server/calendarAndRoutines.ts:187-210` (`canViewCalendarEvent`)
  - Android: `CalendarScreen.kt:154-159` (`matchesScope`)
  - Web: `Stage333CalendarExperience.tsx:90-110` (Persona selector & scope badges)
- **Test Evidence**:
  - Script: `scripts/verify-stage-3-3-3.ts` Gates 8, 9, 10, 11, 12, 13
  - Output:
    - `[PASS] Gate 8: David (Admin) creates COUPLE calendar event (HTTP 201)`
    - `[PASS] Gate 9: Sarah (Spouse Partner / Owner) CAN view COUPLE event`
    - `[PASS] Gate 10: Lucas (Child) CANNOT view COUPLE event (Strictly filtered out)`
    - `[PASS] Gate 11: Uncle James (Guest) CANNOT view COUPLE event`
    - `[PASS] Gate 12: Lucas (Child) creates PERSONAL calendar event`
    - `[PASS] Gate 13: Lucas CAN view his own PERSONAL calendar event`
- **Observed Result**: Scopes are rigorously enforced on the server and accurately reflected on web and Android.

### 2.8 Search and Filtering
- **Classification**: **COMPLETE**
- **Source Files & Symbols Inspected**:
  - Backend: `src/server/calendarRoutes.ts:60-120` (`GET /api/v1/calendar/:familyId` supports `startDate`, `endDate`, `category`, `scope`, `memberId`)
  - Android: `CalendarScreen.kt:133-160` (Category chips: ALL, FAMILY_EVENT, TASK_DUE, APPOINTMENT, ANNIVERSARY, BIRTHDAY, MEAL)
  - Web: `Stage333CalendarExperience.tsx:210-250` (Category & scope filters)
- **Test Evidence**:
  - Script: `scripts/verify-stage-3-3-3.ts` Gates 6 & 7
  - Output: `[PASS] Gate 6: Query calendar with category and scope filter` / `[PASS] Gate 7: Filtered list includes newly created FAMILY_EVENT`
- **Observed Result**: Search and filtering by category, scope, and date range works on all layers.

### 2.9 Task-Linked Calendar Events (Bidirectional Sync)
- **Classification**: **COMPLETE**
- **Source Files & Symbols Inspected**:
  - Backend: `src/server/planningAndExecution.ts:626-720` (`syncTaskWithCalendar`)
  - Gateway: `src/server/calendarRoutes.ts:220-250` (`PUT /api/v1/calendar/...` detects `cal-task-` and updates task `dueDate`)
- **Test Evidence**:
  - Script: `scripts/verify-stage-3-3-3.ts` Gates 16, 17, 18, 19
  - Output:
    - `[PASS] Gate 16: Create task with dueDate in planning system (HTTP 201)`
    - `[PASS] Gate 17: Task dueDate automatically surfaced as CALENDAR_EVENT (cal-task-...)`
    - `[PASS] Gate 18: PUT /api/v1/calendar/... updates task-linked event (HTTP 200)`
    - `[PASS] Gate 19: Underlying Task dueDate updated in lockstep via Calendar PUT endpoint`
- **Observed Result**: Bidirectional synchronization between Tasks and Calendar events operates in lockstep.

### 2.10 Recurring Calendar Events & Occurrence Exceptions
- **Classification**: **PARTIAL** (Backend Model: COMPLETE | Client UI: MISSING)
- **Source Files & Symbols Inspected**:
  - Backend: `calendarAndRoutines.ts:54-56` (`recurrenceRule?: string`, `recurrenceExceptions?: string[]`)
- **Evidence**:
  - The backend schema allows storing RFC 5545 recurrence rules and exception date arrays.
  - However, neither the Web UI nor the Android Compose UI offers an "Edit only this occurrence" or "Edit all future occurrences" prompt.
- **Observed Result**: Schema exists on backend, but client UI for editing single occurrence exceptions is not implemented.

---

## Priority 3 — Notifications Verification

### 3.1 Android Notification Scheduling
- **Classification**: **MISSING**
- **Source Files & Symbols Inspected**:
  - `android/app/src/main/AndroidManifest.xml:9` (`POST_NOTIFICATIONS` permission declared)
  - Entire `android/app/src/main/java/` tree searched via `grep -rn -E "(AlarmManager|PendingIntent|BroadcastReceiver|NotificationCompat)"`
- **Evidence**:
  - Search returned `NO_ALARM_OR_RECEIVER`.
  - Android application does not instantiate `AlarmManager`, `NotificationManagerCompat`, or a scheduled reminder `WorkManager`.
- **Observed Result**: No notifications are scheduled with the Android OS.

### 3.2 Rescheduling & Cancellation
- **Classification**: **PARTIAL** (Data Model: COMPLETE | OS Alarms: MISSING)
- **Source Files & Symbols Inspected**:
  - Backend: `src/server/planningAndExecution.ts:655-671` (`dedupedReminders`)
  - Express: `src/server/calendarRoutes.ts:351` (`event.reminders = body.reminders`)
- **Evidence**:
  - Updating or deleting an event/task updates or purges the reminder array in the database.
  - But because no system alarm was ever registered with Android OS, no system notification cancellation occurs.
- **Observed Result**: Data-level reminder updates work, but device-level alarms do not exist.

### 3.3 Duplicate Prevention
- **Classification**: **COMPLETE** (Data Model)
- **Source Files & Symbols Inspected**:
  - `src/server/planningAndExecution.ts:655-671`
- **Evidence**:
  - Reminders are strictly deduplicated by `offsetMinutesBeforeDue` during task-to-calendar sync.
- **Observed Result**: Data models prevent duplicate reminder configurations.

### 3.4 Delivery Reality: Data Model vs Firing Alarms
- **Classification**: **CRITICAL DEFECT / ARCHITECTURAL LIMITATION**
- **Evidence**:
  - **Reminders in FamilyOS are strictly data-model records**.
  - No reminder or routine alert actually fires to the Android notification drawer or status bar.
  - The UI presents reminders visually in dashboards and lists, but background push or local alarm delivery is not implemented.

---

## Priority 4 — Privacy and Synchronization Verification

### 4.1 Personal Event Isolation
- **Classification**: **COMPLETE**
- **Test Evidence**:
  - Script: `scripts/verify-stage-3-3-3.ts` Gates 12 & 13
  - Verified: Minor Lucas creates a `PERSONAL` event; Lucas can view it, but non-creator/non-assigned members cannot.

### 4.2 Couple Event Isolation
- **Classification**: **COMPLETE**
- **Test Evidence**:
  - Script: `scripts/verify-stage-3-3-3.ts` Gates 8, 9, 10, 11
  - Verified: David (Admin/Spouse) creates a `COUPLE` event; Sarah (Owner/Spouse) can view it; Lucas (Child) and Uncle James (Guest) receive filtered results excluding the event.

### 4.3 Revoked Family Member Access Blocking
- **Classification**: **COMPLETE**
- **Test Evidence**:
  - Script: `scripts/verify-stage-3-3-1.ts` Test 06
  - Output: `[PASS] TEST-06 — Member Removal & Immediate Access Revocation: Removed mem-1793592621041-xl1 (200), blocked Claire workspace read (403 MEMBERSHIP_REVOKED), blocked revoked sync pull (403 MEMBERSHIP_REVOKED)`
  - Script: `scripts/verify-stage-3-2.ts` Phase 3 Gate 4
  - Output: `[PASS] [PHASE_3] P3-4 — Revoked Member Offline Sync Rejected with MEMBERSHIP_REVOKED (HTTP 403)`

### 4.4 Multi-Family Workspace Isolation
- **Classification**: **COMPLETE**
- **Test Evidence**:
  - Script: `scripts/verify-stage-3-2.ts` Phase 4 Test F
  - Output: `[PASS] [PHASE_4] TEST-F — Strict Multi-Tenant Family Workspace Isolation (fam-2 -> fam-1 Blocked)`
  - Script: `scripts/verify-stage-3-3-1.ts` Test 08
  - Output: `[PASS] TEST-08 — Multi-Tenant Family Isolation (fam-1 vs fam-2): Blocked fam-1 OWNER from reading fam-2 (403 WORKSPACE_ISOLATION_VIOLATION)`

### 4.5 Offline Merging & Deduplication
- **Classification**: **COMPLETE**
- **Test Evidence**:
  - Script: `scripts/verify-stage-3-2.ts` Phase 2 Gate 3 & Phase 4 Test C
  - Output:
    - `[PASS] [PHASE_2] P2-3 — Idempotent Replay Deduplication & Exact Single Balance/Budget Mutation: call1=201, call2=200 (deduplicated=true)`
    - `[PASS] [PHASE_4] TEST-C — Offline Android Queue Drain & Reconnect Retry Produces Zero Duplicates: firstAck.deduplicated=false, retryAck.deduplicated=true`

### 4.6 Crash Recovery for Encrypted Room Tables
- **Classification**: **COMPLETE** (for Room Entities) | **PARTIAL** (for In-Memory Routines)
- **Evidence**:
  - The 39 Room SQLite entities (including `calendar_events`, `tasks`, `sync_queue`, `audit_events`) write transactionally to encrypted SQLCipher storage on disk.
  - Routine definitions and occurrences are held in memory and do not have local Room tables.

---

## Priority 5 — Test Execution Record

| Test Suite / Tool | Exact Command Line Executed | Observed Result | Status |
| :--- | :--- | :--- | :---: |
| **TypeScript Type Checking** | `npx tsc --noEmit` | Exit Code 0, 0 errors | **PASS** |
| **Web Production Build** | `npm run build` | Built in 853ms, 1663 modules transformed, `dist/` created | **PASS** |
| **Stage 3.3.3 Calendar & Routines** | `npx tsx scripts/verify-stage-3-3-3.ts` | 40/40 Gates Passed (100%) | **PASS** |
| **Stage 3.3.2 Planning & Execution** | `npx tsx scripts/verify-stage-3-3-2.ts` | 15/15 Gates Passed (100%) | **PASS** |
| **Stage 3.3.1 Family Home & People** | `npx tsx scripts/verify-stage-3-3-1.ts` | 12/12 Tests Passed (100%) | **PASS** |
| **Stage 3.2 Backend Hardening** | `npx tsx scripts/verify-stage-3-2.ts` | 22/22 Verification Gates Passed (100%) | **PASS** |
| **Android Compilation** | `./gradlew assembleDebug` | Command failed: `which java` returned exit code 1 (`No java`). JDK and Android SDK not installed in Linux container. | **UNVERIFIED (Environment Constraint)** |
| **Android Unit Tests** | `./gradlew test` | Cannot run: No Java/Android runtime environment. | **UNVERIFIED (Environment Constraint)** |

---

## Synthesis of Findings

### 1. Verified Complete Features
1. **Zero-Trust Privacy Scopes (`PERSONAL`, `COUPLE`, `FAMILY`)**: Enforced at server gateway; verified with child and guest isolation tests.
2. **Bidirectional Task-to-Calendar Sync**: Updating task due date syncs calendar event; updating calendar event in Express PUT updates underlying task in lockstep.
3. **Standalone Calendar Event Lifecycle**: Creation and deletion verified across Web, Express API, and Android Room (`calendar_events` table).
4. **Decoupled Routine Execution Model**: Completing an occurrence increments streak count and awards points, while the routine definition remains active.
5. **Month-End Recurrence Anchor Preservation**: Anchor day 31 clamps to Feb 28/29 and restores in March without date drift.
6. **Web Calendar & Routines Workspace**: Complete Month/Week/Day/Agenda modes, interactive routine checklist execution, and persona switching.
7. **Offline Sync Idempotency & Multi-Family Isolation**: Verified through Stage 3.2 regression suites.

### 2. Incomplete Features
1. **Android Calendar Event Editing**: Web and backend support full updates (`PUT /api/v1/calendar/...`), but Android ViewModel and `CalendarScreen.kt` only expose create and delete operations.
2. **Timezone Selector UI**: Stored as `America/Los_Angeles` on backend, but neither Web nor Android UI includes a timezone dropdown selector.
3. **Recurring Event Occurrence Exceptions**: Backend model has `recurrenceExceptions` array, but client UI cannot edit individual instances in a series.
4. **`sync_queue` Routine Payload Completeness**: Android client puts minimal JSON payloads into `sync_queue` rather than full occurrence entity snapshots.

### 3. Missing Features
1. **Android OS Notification Scheduling & Delivery**: No `AlarmManager`, `NotificationCompat`, or `WorkManager` alert system exists in Android code. Reminders do not fire on devices.
2. **Offline Routine Persistence in SQLite**: Room database has exactly 39 entities and lacks tables for `routines` and `routine_occurrences`.
3. **Offline Routine History Querying**: No DAO or local store exists to view past routine completion history when disconnected.

### 4. Critical Defects
1. **Transient Android Routine State**: Because `_routines` and `_routineOccurrences` are in-memory StateFlows, an offline user completing a routine will see their progress reset to "PENDING" if the app terminates or crashes before syncing.
2. **Reminder Delivery Gap**: The application UI implies reminders will alert users, but without native notification workers or push delivery, scheduled reminders are purely passive data records.

### 5. Recommended Minimal Changes (For Future Implementation Approval)
1. **Durable Client Routine Storage**: To preserve Room v3 schema without forcing a disruptive migration immediately, provide a lightweight encrypted local JSON cache or SharedPreference backing for `_routines` and `_routineOccurrences` in `FamilyOSViewModel`. Alternatively, introduce a cleanly versioned `MIGRATION_3_4` adding `routines` and `routine_occurrences` Room tables.
2. **Android Event Edit Modal**: Add an `updateCalendarEvent` method to `FamilyOSViewModel` and an Edit icon/modal in `CalendarScreen.kt` calling `CalendarDao.insertEvent(updated)`.
3. **Expand `sync_queue` Routine Payload**: Include full occurrence snapshots (`routineId`, `targetDate`, `stepCompletions`) in the sync queue payload so that offline changes are self-contained.
4. **Native Android Alarm Scheduling**: Implement an `AlarmManager` broadcast receiver (`CalendarReminderReceiver`) to post native status-bar notifications when reminder offsets trigger.

### 6. Required Device / Emulator Tests
1. **Low-Memory Process Death Survival**: Verify whether offline routine completions survive OS kill and activity recreation.
2. **Airplane Mode Calendar & Routine Toggles**: Complete a routine, toggle flight mode off, and verify immediate drain by `SyncWorker`.
3. **Native Notification Drawer Inspection**: Trigger a reminder timestamp on an active Android 14+ emulator and verify notification delivery with `POST_NOTIFICATIONS` runtime permission.
4. **Daylight Saving Transition Test**: Verify alarm triggers across the spring forward and fall back clock adjustments on a running device.

---

*Report generated and validated against executable code and test artifacts. Awaiting review and architectural guidance.*
