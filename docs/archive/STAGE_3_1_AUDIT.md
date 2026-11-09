# FAMILYOS — STAGE 3.1.1 PRODUCTION FOUNDATION AUDIT

**Date**: 2026-11-01  
**Audit Scope**: Complete source-code inspection of Native Android (`/android/`) and Web Application (`/src/`), compared against canonical architectural specifications (`FAMILYOS_*.md`).  
**Standard**: Zero acceptance of documentation claims without source-code verification.

---

## 1. Executive Summary & Single Highest-Priority Blocker

A line-by-line inspection of the 42 Kotlin source files, 15 test suites, React web application, and Gradle/CI configurations reveals a clear architectural split:

- **What is Genuinely Built**: The Room SQLite schema (39 entities across 3 versions), `MIGRATION_1_2` and `MIGRATION_2_3` DDL scripts, 14 DAO interfaces, pure Kotlin domain models (strict 64-bit integer cents, DAG cycle checks, calendar-aware recurrence), RBAC security policy functions (`FamilySecurityPolicy.kt`), and 16 Material 3 design system components are genuinely implemented in source code.
- **What is Disconnected or Broken**:
  1. **Compilation Blocker in Instrumented Test**: `FamilyOSMigrationInstrumentedTest.kt` (lines 377–463) invokes non-existent constructors and DAO methods (`insertAccount`, `upsertProfile`, `getProfileByMemberId`, `getAllergiesForMember`, `upsertPlan`, `getPlan`) that do not match `Stage3Entities.kt` and `Stage3Daos.kt`.
  2. **Invalid Kotlin Syntax in Compose Screens**: Four feature screens (`FamilyTreeScreen.kt:40`, `MealPlannerScreen.kt:31`, `HomeAssetsScreen.kt:29`, `CalendarScreen.kt:30,76`) use TypeScript union type syntax (`mutableStateOf<"TREE" | "LIST">("TREE")` and `mode as any`) instead of valid Kotlin types, which will fail `compileDebugKotlin`.
  3. **Destructive Sync Queue Drain**: `SyncRepositoryImpl.processPendingQueue()` (`SyncManager.kt:69–72`) unconditionally deletes pending operations (`syncQueueDao.dequeueOperation(op.queueId)`) inside a loop with a comment `// Dispatch to remote API gateway...` without any remote server call or acknowledgement.
  4. **Zero ViewModels & Disconnected Screens**: There are **0 `ViewModel` classes** in the codebase. All 10 Compose screens in `com.familyos.feature.*` render hardcoded static sample data (`"The Henderson Family"`, `defaultSampleMembers`, `sampleGoals`, `sampleMeals`, hardcoded `CashFlowPlan`) and are never connected to the Room database or repository implementations.
  5. **Unwired Database Encryption**: `sqlcipher-android` and `androidx.security.crypto` are declared in `build.gradle.kts`, but `FamilyOSDatabase.getInstance()` (`FamilyOSDatabase.kt:701`) initializes a standard unencrypted Room database without `SupportOpenHelperFactory` or Android Keystore `MasterKey`.
  6. **Unconfigured Shared Backend**: Neither `google-services.json` nor any backend server (`server.ts` / Firebase project / REST API) exists. Both Android and Web (`src/App.tsx`) operate on isolated, hardcoded in-memory demonstration states.

### Single Highest-Priority Blocker
**P0-1: Native Kotlin Compilation Failures in Compose Screens & Instrumented Tests + Unconditional Sync Queue Deletion (`SyncManager.kt`)**.  
Before any feature can be wired or deployed, the TypeScript union syntax in the 4 Kotlin Compose screens and the mismatched Stage 3 entity/DAO calls in `FamilyOSMigrationInstrumentedTest.kt` prevent the Android app and test suite from compiling, and `SyncManager.kt` silently destroys queued offline mutations.

### Exact First Implementation Task (Upon Approval)
**Task 3.1.1-A**: Fix the Kotlin compilation errors in `FamilyTreeScreen.kt`, `MealPlannerScreen.kt`, `HomeAssetsScreen.kt`, `CalendarScreen.kt`, and `FamilyOSMigrationInstrumentedTest.kt`, and harden `SyncRepositoryImpl.processPendingQueue()` in `SyncManager.kt` so queued operations are **never** dequeued without a verified remote acknowledgement (remaining in `PENDING` / `FAILED` retryable state when no backend is reachable).

---

## 2. Comprehensive Feature & Component Classification Matrix

Classification Key:
- `IMPLEMENTED AND CONNECTED`: Implemented in source code and wired end-to-end (DB <-> Repo <-> ViewModel <-> UI).
- `IMPLEMENTED BUT NOT CONNECTED`: Real logic/schema/repository exists in code, but is not wired into the runtime UI or application graph.
- `PARTIALLY IMPLEMENTED`: Some layers exist, but required methods, encryption, or workflows are incomplete.
- `PLACEHOLDER / DEMONSTRATION DATA`: UI or adapter displays hardcoded demo data or empty lambdas.
- `NOT IMPLEMENTED`: Documented in specs, but no source code exists.
- `IMPLEMENTED BUT NOT VERIFIED`: Code exists, but contains syntax/signature mismatches or has not been verified in an Android SDK build.

| Feature ID / Component | Classification | Supporting Source Files & Exact Line Evidence |
|---|---|---|
| **Room Database Schema (39 Entities) & Migrations (`v1 -> v2 -> v3`)** | `IMPLEMENTED BUT NOT CONNECTED` | `Entities.kt`, `Stage2Entities.kt`, `Stage3Entities.kt`, `FamilyOSDatabase.kt:14-697`. Pre-warmed in `FamilyOSApplication.kt:17`, but never injected or queried by `MainActivity.kt` or any screen. `exportSchema = false` (`FamilyOSDatabase.kt:62`) disables schema JSON snapshot export despite `build.gradle.kts:27`. |
| **SQLCipher & Keystore Encryption at Rest** | `PARTIALLY IMPLEMENTED` (Dependency Only / Unwired) | `android/app/build.gradle.kts:105-107` includes `sqlcipher.android` and `security.crypto`, but `FamilyOSDatabase.kt:701-707` uses standard `Room.databaseBuilder()` without `SupportOpenHelperFactory` or `MasterKey`. |
| **`AUTH-01` to `AUTH-07`: Authentication & Account Management** | `PARTIALLY IMPLEMENTED` & `IMPLEMENTED BUT NOT CONNECTED` | `FirebaseAuthRepository.kt:24-163` implements `observeAuthState`, `signInWithEmail`, `registerWithEmail`, and `signOut` with `FirebaseAuth`, storing profiles in `UserProfileDao` without passwords. However: (1) `signInWithGoogle` (`line 136`) throws `UnsupportedOperationException`, (2) no `google-services.json` exists, (3) no Login/Onboarding screen exists, and (4) `MainActivity.kt` bypasses auth completely. Biometrics (`AUTH-05`), Email Verification (`AUTH-02`), Password Reset (`AUTH-04`), Session Mgmt (`AUTH-06`), and GDPR Deletion (`AUTH-07`) are `NOT IMPLEMENTED`. |
| **`SYS-01`: Offline Sync Queue & Conflict Resolution** | `PARTIALLY IMPLEMENTED` (Critical P0 Flaw) | `SyncManager.kt:23-91`, `Entities.kt:248-283`, `Daos.kt:88-103`. `enqueue()` and `resolveConflictPolicy()` work, **but** `processPendingQueue()` (`SyncManager.kt:69-72`) immediately calls `syncQueueDao.dequeueOperation(op.queueId)` without any server call, permanently deleting unsynced operations. Furthermore, no Repository (`FamilyRepositoryImpl.kt`, `Stage2RepositoriesImpl.kt`, `Stage3RepositoriesImpl.kt`) actually calls `syncRepository.enqueue()` during local writes, and no `WorkManager` `CoroutineWorker` exists. |
| **`FAM-01` & `FAM-02`: Family Workspaces & Member Profiles** | `IMPLEMENTED BUT NOT CONNECTED` (Repo) / `PLACEHOLDER` (UI) | `FamilyRepositoryImpl.kt:12-162` implements full Room CRUD for workspaces and members (`createWorkspaceWithOwner`, `addMember`, `updateMember`, `removeMember`). Note: `FamilyMemberEntity.toDomain()` (`lines 182-183`) hardcodes `dietaryPreferences = emptyList()` and `allergies = emptyList()` instead of parsing JSON. In `MainActivity.kt:58` and `DashboardScreen.kt:27-29`, the UI is hardcoded to `"The Henderson Household"` and `listOf("David", "Sarah", "Lucas", "Maya")`. |
| **`FAM-03`: Secure Invitation Tokens & Deep Links** | `PARTIALLY IMPLEMENTED` | `FamilyInvitationEntity` exists in `Entities.kt:160-192`, but there is **no `FamilyInvitationDao`**, no repository implementation, and no UI screen to generate or redeem invitations. |
| **`FAM-04`: Family Roles & Access Control (RBAC)** | `IMPLEMENTED BUT NOT CONNECTED` | `FamilySecurityPolicy.kt:7-180` implements pure authorization checks (verified by `RbacPermissionTest.kt`), **but** `FamilySecurityPolicy` is never invoked inside `FamilyRepositoryImpl.kt`, `Stage2RepositoriesImpl.kt`, `Stage3RepositoriesImpl.kt`, or any UI screen. |
| **`FAM-05`: Family Tree & Relationship Map** | `IMPLEMENTED BUT NOT VERIFIED` (UI Syntax Bug) | `Stage2RepositoriesImpl.kt:14-98` implements `FamilyRelationshipRepositoryImpl` with real BFS cycle detection (`lines 49-70`). However, `FamilyTreeScreen.kt:35-36` uses hardcoded `defaultSampleMembers`, `MainActivity.kt:77-78` passes empty lambdas `onAddMember = { /* Opens Add Member Sheet */ }`, and `FamilyTreeScreen.kt:40` contains invalid Kotlin syntax `mutableStateOf<"TREE" | "LIST">("TREE")`. |
| **`FAM-06`: Family Governance & Constitution** | `NOT IMPLEMENTED` | Mentioned in `FAMILYOS_FEATURE_REGISTER.md`, but no Room entity, DAO, repository, or UI exists. |
| **`FAM-07` & `SYS-02`: Unified Household Calendar** | `IMPLEMENTED BUT NOT VERIFIED` (UI Syntax Bug) | `Stage2RepositoriesImpl.kt:610-697` implements `CalendarRepositoryImpl` aggregating events, goals, chores, and maintenance. However, `CalendarScreen.kt:26` uses static `sampleCalendarEvents`, `MainActivity.kt:104` passes an empty `onAddEvent = {}`, and `CalendarScreen.kt:30,76` contains invalid Kotlin syntax (`"DAY" | "WEEK" | "MONTH"` and `mode as any`). |
| **`TASK-01` to `TASK-05`: 4-Tier Goals, Projects, Tasks & Checklists** | `IMPLEMENTED BUT NOT CONNECTED` | `Stage2Entities.kt:37-197`, `Stage2Daos.kt:27-100`, and `GoalsAndTasksRepositoryImpl` (`Stage2RepositoriesImpl.kt:101-258`) implement real database persistence and rollup math. However, `GoalsScreen.kt:24-29` renders static `sampleGoals`, `sampleProjects`, `sampleTasks` with no-op callbacks in `MainActivity.kt:83-84`. |
| **`HSE-01`, `HSE-02`, `HSE-05`: Meal Planner, Recipes & Grocery List** | `IMPLEMENTED BUT NOT VERIFIED` (UI Syntax Bug) | `Stage2RepositoriesImpl.kt:260-476` implements `RecipesRepositoryImpl` (with ingredient scaling) and `MealPlannerRepositoryImpl` (with automated grocery deduplication). However, `MealPlannerScreen.kt:25-26` and `RecipeLibraryScreen.kt:30` use static sample lists, `RecipeLibraryScreen` is never navigated to from `MainActivity.kt`, and `MealPlannerScreen.kt:31` uses invalid Kotlin union syntax `mutableStateOf<"MEALS" | "GROCERIES">("MEALS")`. |
| **`HSE-03`: Printable Recipe Cards & Deep Link Routing** | `PARTIALLY IMPLEMENTED` | `RecipeDeepLinkHandler.kt` parses `familyos://recipes/{id}` and is wired in `MainActivity.kt:38,135`. However, `MainActivity.kt:45-46` only routes to `FamilyOSDestination.HOUSEHOLD` (`MealPlannerScreen`) and discards the parsed `recipeId` without opening `RecipeLibraryScreen` or the target recipe. QR rendering in `RecipeLibraryScreen.kt` is a visual placeholder box, not an encoded QR matrix. |
| **`HSE-04` & `HSE-07`: Pantry Inventory & Wardrobe Planner** | `NOT IMPLEMENTED` | No Room entities, DAOs, repositories, or screens exist for Pantry Inventory or Wardrobe Planner despite `FAMILYOS_FEATURE_REGISTER.md` claiming `HSE-04` schema was complete. |
| **`HSE-06`: Chores & Positive Reinforcement** | `IMPLEMENTED BUT NOT CONNECTED` | `ChoresRepositoryImpl` (`Stage2RepositoriesImpl.kt:478-545`) and `ChoreRecurrenceCalculator.kt` implement calendar-aware recurrence and point awards. However, `ChoresScreen.kt` is not even reachable from `MainActivity.kt` (`FamilyOSDestination.HOUSEHOLD` only renders `MealPlannerScreen`), and `ChoresScreen.kt:25` uses static `sampleChores`. |
| **`HSE-08`: Home Assets, Maintenance & Wishlist** | `IMPLEMENTED BUT NOT VERIFIED` (UI Syntax Bug) | `HomeAssetsRepositoryImpl` (`Stage2RepositoriesImpl.kt:547-608`) implements Room persistence. However, `HomeAssetsScreen.kt` is not reachable from `MainActivity.kt`, uses static `sampleAssets`, and contains invalid Kotlin union syntax at `line 29` (`mutableStateOf<"ASSETS" | "WISHLIST">("ASSETS")`). |
| **`FIN-01` to `FIN-08`: Financial Accounts, Cash-Flow, Envelopes, Transfers & Reversals** | `IMPLEMENTED BUT NOT CONNECTED` | `Stage3Entities.kt:20-293`, `Stage3Daos.kt:14-119`, `Stage3FinanceModels.kt`, and `FinanceRepositoryImpl` (`Stage3RepositoriesImpl.kt:11-180`) implement atomic integer-cent transfers, reversals, net worth, and cash flow. However, `FinanceScreen.kt:108-576` uses local `remember { ... }` hardcoded demo lists and never calls `FinanceRepository`. Also, `FinanceDao.recordExpense()` (`Stage3Daos.kt:53`) does not increment `EnvelopeBudgetEntity.spentCents`. |
| **`HLT-01`: Wellbeing Profiles, Allergies, Medications, Vaccinations & Appointments** | `IMPLEMENTED BUT NOT CONNECTED` | `Stage3Entities.kt:302-518`, `Stage3Daos.kt:121-170`, `Stage3WellbeingModels.kt`, and `WellbeingRepositoryImpl` (`Stage3RepositoriesImpl.kt:182-320`) are implemented. However, `WellbeingScreen.kt:36-330` uses hardcoded strings (`"Sarah (Self)"`, `"Lucas (Child - Restricted)"`) and static cards without querying `WellbeingRepository` or checking `FamilySecurityPolicy`. |
| **`SAF-01`: Emergency Directory, Plan, Supplies & Readiness Checklist** | `IMPLEMENTED BUT NOT CONNECTED` | `Stage3Entities.kt:527-667`, `Stage3Daos.kt:172-214`, and `EmergencyRepositoryImpl` (`Stage3RepositoriesImpl.kt:322-440`) are implemented. However, `EmergencyScreen.kt:96-304` uses hardcoded `remember { listOf(...) }` demo data and empty `onClick = {}` handlers (`lines 150, 156`). |
| **Modules 6, 7, 8, 9, 12 (`SPR-01`, `DEV-01`, `CPL-01`, `PAR-01`, `INV-01`)** | `PLACEHOLDER / NOT IMPLEMENTED` | `MainActivity.kt:107-122` routes `SPIRITUAL_GROWTH`, `PERSONAL_DEV`, `COUPLES_PREP`, `PARENTING_CHILD`, `INVESTMENTS`, and `SETTINGS` to a generic `FamilyOSEmptyState` placeholder. No Room entities exist for these 5 modules. |
| **React Web Application (`src/App.tsx`)** | `PLACEHOLDER / DEMONSTRATION DATA` | `src/App.tsx` (1,535 lines) is a standalone interactive architecture showcase and calculator testbed with in-memory React `useState`. It has zero backend API calls, zero authentication, and zero shared persistence with Android. |
| **Instrumented Migration Test (`FamilyOSMigrationInstrumentedTest.kt`)** | `IMPLEMENTED BUT NOT VERIFIED` (Compile Error) | `FamilyOSMigrationInstrumentedTest.kt:377-463` calls `FinancialAccountEntity(institutionName=..., currencyCode=..., isActive=..., isIncludedInNetWorth=...)`, `db.financeDao().insertAccount()`, `db.wellbeingDao().upsertProfile()`, `db.wellbeingDao().getProfileByMemberId()`, `HealthAllergyEntity(reactionNotes=..., hasEpipen=...)`, `EmergencyPlanEntity(planName=..., electricShutoffLocation=...)`, and `db.emergencyDao().upsertPlan()`. None of these field/method names match `Stage3Entities.kt` or `Stage3Daos.kt`. |

---

## 3. Shared-Backend Architecture Assessment (Android + Web Alignment)

### 3.1 Current State of Backend Configuration
- **Status**: **UNCONFIGURED / NOT CONNECTED**.
- Neither `android/app/google-services.json` nor a backend server (`server.ts`) nor a cloud database project (Firebase / Cloud SQL / Supabase) is currently provisioned in the workspace.
- `package.json` includes `"express": "^4.21.2"` and `"@google/genai": "^2.4.0"`, and `android/app/build.gradle.kts` includes `firebase-auth-ktx`, `firebase-firestore-ktx`, and `firebase-storage-ktx` (`BOM 33.5.1`), but neither platform is connected to an active backend instance.

### 3.2 Shared-Backend Architecture Blueprint (Single Authoritative Backend)
To ensure the Android native app and the Web application share the exact same authoritative family data without creating two competing backends:

| Architectural Pillar | Current State in Codebase | Target Shared-Backend Alignment (Stage 3.1) |
|---|---|---|
| **1. Authentication Provider** | `FirebaseAuthRepository.kt` on Android (missing `google-services.json`); None on Web. | **Firebase Authentication** (Email/Password + Google Sign-In) shared across Android (`com.google.firebase:firebase-auth-ktx`) and Web (`firebase/auth`), issuing unified Firebase ID JWTs. |
| **2. Authoritative Database** | None (Local Room SQLite on Android; in-memory React state on Web). | **Cloud Firestore** (or Unified Cloud Backend API backed by Firestore) partitioned by `family_workspaces/{familyId}`, matching the 39-entity canonical schema. |
| **3. Family Workspace Isolation** | Enforced locally in SQL `WHERE family_id = :familyId` and `FamilySecurityPolicy.isWorkspaceAuthorized()`. | Every document/record lives under `/family_workspaces/{familyId}/...` with strict tenant isolation verified by `familyId` membership lookup. |
| **4. Server-Side Authorization** | Documented in `FAMILYOS_SECURITY_PLAN.md` (`lines 77-120`), not deployed. | Deployed `firestore.rules` + Express `/api/*` middleware verifying Firebase Auth UID and `family_memberships` role (`OWNER`, `ADMIN`, `MEMBER`, `GUEST`) and `guardian_relationships` before any read/write. |
| **5. File & Image Storage** | Dependency `firebase-storage-ktx` in `build.gradle.kts:113`; unused. | Firebase Cloud Storage partitioned by `/families/{familyId}/media/{mediaId}` with signed URLs and role validation. |
| **6. API Contracts & AI Proxy** | None. | Shared JSON schema contracts (`kotlinx.serialization` on Android, TypeScript interfaces on Web/Server) with integer-cent fields (`*Cents: Long/number`), epoch ms timestamps, and `/api/ai/*` server-side Gemini proxy (`server.ts`). |
| **7. Offline Local Storage** | Android: Room SQLite v3 (39 tables). Web: None (`useState`). | Android: Room SQLite v3 encrypted with SQLCipher. Web: Firestore persistent IndexedDB cache + offline queue. |
| **8. Synchronization Mechanism** | `SyncManager.kt` (broken: deletes without remote call, not invoked by repositories). | Repositories atomically write to Room + `sync_queue` (`PENDING`). `SyncWorker` (`WorkManager`) pushes batches to remote backend with `idempotencyKey`, and **only** marks `SUCCESS` / dequeues after HTTP 200 / Firestore commit ack. |
| **9. Conflict Resolution** | `ConflictPolicy` enum defined in `SyncManager.kt:16-21`, never executed. | Executed during sync: `APPEND_ONLY_LEDGER` for finance (never overwrite transactions; reversals only), `EVENT_BASED_MERGE` for tasks/checklists, `SERVER_AUTHORITATIVE` for memberships/roles, `TOMBSTONE_SOFT_DELETE` (`version` + `updatedAt`) for general records. |
| **10. Audit Logging** | `AuditEventEntity` and `AuditEventDao` exist (`Daos.kt:106-112`), never called. | Sensitive mutations (role changes, transaction reversals, minor health access, workspace deletion) write immutable `AuditEventEntity` records locally and sync to `/family_workspaces/{familyId}/audit_events`. |
| **11. Data Backup & Recovery** | `allowBackup="false"` in `AndroidManifest.xml:13`. | Local unencrypted Drive backup disabled (`allowBackup="false"`). Recovery via authenticated cloud re-sync + user-initiated encrypted JSON workspace export/import. |

---

## 4. Severity-Ranked Production Blockers

### P0 — Critical Blockers (Compilation Failures, Silent Data Loss, Unencrypted Sensitive Data)
1. **P0-1: Kotlin Compilation Errors in 4 Compose Screens**:
   - `FamilyTreeScreen.kt:40`: `mutableStateOf<"TREE" | "LIST">("TREE")`
   - `MealPlannerScreen.kt:31`: `mutableStateOf<"MEALS" | "GROCERIES">("MEALS")`
   - `HomeAssetsScreen.kt:29`: `mutableStateOf<"ASSETS" | "WISHLIST">("ASSETS")`
   - `CalendarScreen.kt:30,76`: `mutableStateOf<"DAY" | "WEEK" | "MONTH">("WEEK")` and `mode as any`
   - *Impact*: TypeScript union syntax in `.kt` files causes immediate `compileDebugKotlin` failure.
2. **P0-2: Compilation Errors in `FamilyOSMigrationInstrumentedTest.kt`**:
   - Lines `377–463` reference non-existent entity properties (`institutionName`, `currencyCode`, `isActive`, `isIncludedInNetWorth`, `payee`, `isPending`, `envelopeId`, `physicianName`, `isRestrictedMinor`, `reactionNotes`, `hasEpipen`, `planName`, `electricShutoffLocation`) and non-existent DAO methods (`insertAccount`, `upsertProfile`, `getProfileByMemberId`, `getAllergiesForMember`, `upsertPlan`, `getPlan`).
   - *Impact*: `compileDebugAndroidTestKotlin` and `connectedDebugAndroidTest` will fail to compile.
3. **P0-3: Silent Data Loss in `SyncManager.kt` (`processPendingQueue`)**:
   - `SyncManager.kt:69-72` loops over `syncQueueDao.getPendingOperations()` and immediately calls `syncQueueDao.dequeueOperation(op.queueId)` without dispatching to any server or checking acknowledgement.
   - *Impact*: Violates the core offline-first invariant—pending offline operations are permanently destroyed without ever reaching the backend.
4. **P0-4: Unwired SQLCipher Database Encryption**:
   - `FamilyOSDatabase.kt:701` builds a plaintext SQLite database despite storing sensitive health records, allergies, medications, and financial accounts.
   - *Impact*: Security & compliance violation against `FAMILYOS_SECURITY_PLAN.md` Section 1.3.

### P1 — Core Functionality & Backend Integration Blockers
1. **P1-1: Zero ViewModels & Disconnected Compose Screens**:
   - None of the 10 Compose screens observe Room `Flow`s or invoke Repository suspend functions. All UI interactions (adding goals, tasks, meals, chores, transactions, health records, emergency contacts) either invoke empty lambdas `{}` or mutate transient in-memory state lost on navigation/restart.
2. **P1-2: Unreachable Stage 2 Screens in Navigation**:
   - `RecipeLibraryScreen.kt`, `ChoresScreen.kt`, and `HomeAssetsScreen.kt` exist in source code, but `MainActivity.kt:87-92` only renders `MealPlannerScreen` under `FamilyOSDestination.HOUSEHOLD`, making Recipes, Chores, and Home Assets completely inaccessible to the user.
3. **P1-3: Repositories Do Not Enqueue Sync Operations or Enforce RBAC / Audit Logs**:
   - `FamilyRepositoryImpl.kt`, `Stage2RepositoriesImpl.kt`, and `Stage3RepositoriesImpl.kt` write to Room DAOs but never call `SyncRepository.enqueue()`, `AuditEventDao.logEvent()`, or `FamilySecurityPolicy`.
4. **P1-4: Missing Shared Backend & Authentication Onboarding Flow**:
   - No `LoginScreen` / `WorkspaceOnboardingScreen` exists on Android, and neither Android nor Web (`src/App.tsx`) is connected to a shared Firebase/Backend instance.
5. **P1-5: Missing Envelope Budget Spend Rollup on Expense Recording**:
   - `FinanceDao.recordExpense()` (`Stage3Daos.kt:53-56`) updates `financial_accounts.current_balance_cents`, but does not update the matching category's `envelope_budgets.spent_cents`.

### P2 — Reliability, Schema Hygiene & Usability Issues
1. **P2-1: Room Schema Export Disabled**:
   - `FamilyOSDatabase.kt:62` sets `exportSchema = false`, overriding the KSP schema location configured in `android/app/build.gradle.kts:27`.
2. **P2-2: Unparsed JSON Fields in `FamilyMemberEntity.toDomain()`**:
   - `FamilyRepositoryImpl.kt:182-183` returns `emptyList()` for `dietaryPreferences` and `allergies` instead of deserializing `dietaryPreferencesJson` and `allergiesJson` via `kotlinx.serialization`.
3. **P2-3: Incomplete Recipe Deep Link Target Navigation**:
   - `MainActivity.kt:45` detects `DeepLinkResult.RecipeDetail(recipeId)` and switches to `HOUSEHOLD`, but never passes `recipeId` to open the specific recipe detail modal.
4. **P2-4: Emergency 1-Tap Dial & Share Buttons Are Empty Lambdas**:
   - `EmergencyScreen.kt:150,156` has `onClick = { /* Dial Action */ }` instead of launching `Intent(Intent.ACTION_DIAL, Uri.parse("tel:..."))`.

### P3 — Deferred Stage 4 / Stage 5 Enhancements
1. **P3-1**: Remaining Stage 3/4 secondary modules (`SPR-01` Spiritual, `DEV-01` Personal Dev, `CPL-01` Couples, `PAR-01` Parenting, `INV-01` Investments, `HSE-04` Pantry, `HSE-07` Wardrobe, `FAM-06` Constitution).
2. **P3-2**: Stage 4 Gemini AI Proxy, QR Matrix Generator, FTS5 Search, and Google Play Billing (`SYS-03`, `SYS-04`, `TASK-04`).
