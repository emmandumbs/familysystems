# FAMILYOS — STAGE 3.1 IMPLEMENTATION PLAN
## Production Hardening, End-to-End Wiring & Shared Backend Alignment

**Version**: 3.1.0  
**Prerequisite Audit**: `STAGE_3_1_AUDIT.md`  
**Objective**: Eliminate all P0/P1 production blockers, fix compilation errors, wire all Stage 1–3 screens to Room repositories via ViewModels, enforce non-destructive offline sync queuing, enable SQLCipher encryption, and align the Android and Web platforms on a single shared backend.

---

## 1. Dependency-Aware Implementation Sequence

```
[Phase 1: P0 Compilation & Sync Queue Safety (FIRST)]
   │  - Fix Kotlin syntax in 4 Compose screens & FamilyOSMigrationInstrumentedTest.kt
   │  - Harden SyncManager.kt: never dequeue without verified remote ack
   ▼
[Phase 2: Database Encryption, JSON Mappers & Schema Hygiene]
   │  - Wire SQLCipher SupportOpenHelperFactory + Android Keystore MasterKey
   │  - Fix dietary/allergy JSON serialization & envelope budget spend rollup
   ▼
[Phase 3: Shared Backend Provisioning & API Alignment]
   │  - Provision shared Firebase (Auth + Firestore) & Express /api/* sync gateway
   │  - Deploy Firestore security rules enforcing workspace & guardian isolation
   ▼
[Phase 4: Authentication & Family Onboarding Flow]
   │  - Connect FirebaseAuthRepository + Workspace onboarding / switcher UI
   │  - Persist active familyId & memberId session in DataStore
   ▼
[Phase 5: ViewModel Layer & End-to-End CRUD Wiring (Stages 1–3)]
   │  - Create ViewModels for Dashboard, FamilyTree, Goals, Meals/Recipes/Chores/Assets,
   │    Calendar, Finance, Wellbeing, and Emergency
   │  - Expose sub-navigation in Household hub (Meals, Recipes, Chores, Assets)
   │  - Wire real Add/Edit/Complete/Reverse dialogs & Intent.ACTION_DIAL
   ▼
[Phase 6: Safe Offline Sync Execution, RBAC & Audit Logging]
   │  - Enqueue SyncOperation & AuditEvent inside repository write transactions
   │  - Implement WorkManager SyncWorker with exponential backoff & conflict policies
   ▼
[Phase 7: Android & Web Shared Data Consistency]
   │  - Connect React web portal (src/App.tsx) to the same authoritative backend
   │    so mutations on Web and Android reflect identical family workspace state
   ▼
[Phase 8: Automated Unit, Migration & End-to-End Verification]
      - Run unit tests, Room v1->v2->v3 instrumented migration test, lint, and APK build
```

---

## 2. Detailed Work Packages & Acceptance Criteria

### Phase 1: P0 Compilation Repair & Sync Queue Safety (Immediate First Task)
- **Target Files**:
  - `android/app/src/main/java/com/familyos/feature/family/FamilyTreeScreen.kt`
  - `android/app/src/main/java/com/familyos/feature/meals/MealPlannerScreen.kt`
  - `android/app/src/main/java/com/familyos/feature/assets/HomeAssetsScreen.kt`
  - `android/app/src/main/java/com/familyos/feature/calendar/CalendarScreen.kt`
  - `android/app/src/androidTest/java/com/familyos/FamilyOSMigrationInstrumentedTest.kt`
  - `android/app/src/main/java/com/familyos/core/sync/SyncManager.kt`
- **Actions**:
  1. Replace invalid TypeScript union types (`mutableStateOf<"A" | "B">("A")` and `as any`) in the 4 Compose screens with valid Kotlin `String` or enum types (`mutableStateOf("A")`).
  2. Align `FamilyOSMigrationInstrumentedTest.kt` (lines 377–463) with the exact constructor signatures of `FinancialAccountEntity`, `FinancialTransactionEntity`, `WellbeingProfileEntity`, `HealthAllergyEntity`, and `EmergencyPlanEntity` in `Stage3Entities.kt` and the exact DAO method names in `Stage3Daos.kt` (`insertOrUpdateAccount`, `insertOrUpdateProfile`, `getProfileForMember`, `observeAllergiesForMember`, `insertOrUpdateEmergencyPlan`, `getEmergencyPlan`).
  3. Refactor `SyncRepositoryImpl.processPendingQueue()` in `SyncManager.kt` to accept a `RemoteSyncGateway` interface. When no remote gateway is configured or when a network call fails, call `syncQueueDao.updateOperationAttempt(queueId, state = "FAILED", error = ...)` and **never** call `dequeueOperation(queueId)` unless `remoteGateway.dispatch(op)` returns `Result.success( RemoteAck(verified = true) )`.
- **Acceptance Criteria**:
  - Zero TypeScript syntax remains in `.kt` files.
  - `FamilyOSMigrationInstrumentedTest.kt` matches `Stage3Entities.kt` and `Stage3Daos.kt` 100%.
  - Unit test in `SyncPolicyAndIdempotencyTest.kt` proves unacknowledged operations remain in `sync_queue` with incremented `attempt_count` and `retry_state = "FAILED"` (retryable).

---

### Phase 2: Database Encryption, JSON Serialization & Financial Rollup Integrity
- **Target Files**:
  - `android/app/src/main/java/com/familyos/core/database/FamilyOSDatabase.kt`
  - `android/app/src/main/java/com/familyos/core/data/FamilyRepositoryImpl.kt`
  - `android/app/src/main/java/com/familyos/core/database/Stage3Daos.kt`
- **Actions**:
  1. Create `DatabaseKeyManager` using `androidx.security.crypto.MasterKey` and `EncryptedSharedPreferences` to generate and persist a random 256-bit passphrase in the Android Keystore, passing `SupportOpenHelperFactory(passphraseBytes)` to `Room.databaseBuilder()` in `FamilyOSDatabase.getInstance()`.
  2. Update `FamilyMemberEntity.toDomain()` in `FamilyRepositoryImpl.kt` to parse `dietaryPreferencesJson` and `allergiesJson` using `kotlinx.serialization.json.Json`.
  3. Update `FinanceDao.recordExpense()` and `reverseTransaction()` in `Stage3Daos.kt` to atomically update `envelope_budgets.spent_cents` for the matching `family_id` and `category`.
- **Acceptance Criteria**:
  - Production database is encrypted at rest via SQLCipher; in-memory/migration test builders remain compatible with standard SQLite test runners.
  - Recording or reversing an expense atomically updates both the account balance and the category envelope budget.

---

### Phase 3: Shared Backend Alignment (Firebase / Unified API)
- **Target Files**:
  - `firebase-blueprint.json`, `firestore.rules` (via AI Studio Firebase integration or shared Express/SQLite/Firestore backend)
  - `server.ts` (API routes `/api/sync`, `/api/workspaces`, `/api/ai/*`)
- **Actions**:
  1. Provision a single authoritative backend so both the React web app and the Android client read and write the same family workspace data.
  2. Enforce server-side RBAC rules matching `FamilySecurityPolicy.kt` (`OWNER`, `ADMIN`, `MEMBER`, `GUEST`, and `guardian_relationships` for minor profiles).
- **Acceptance Criteria**:
  - Unauthenticated or cross-family requests are rejected server-side with `403 PERMISSION_DENIED`.

---

### Phase 4: Authentication & Family Workspace Onboarding
- **Target Files**:
  - `android/app/src/main/java/com/familyos/feature/auth/AuthOnboardingScreen.kt` (new)
  - `android/app/src/main/java/com/familyos/core/data/SessionPreferencesRepository.kt` (new, DataStore)
  - `android/app/src/main/java/com/familyos/MainActivity.kt`
- **Actions**:
  1. Persist active `userId`, `activeFamilyId`, `activeMemberId`, and `activeRole` in Jetpack `DataStore`.
  2. When no workspace exists locally, present an onboarding flow allowing the user to create their household workspace (or sign in to sync an existing workspace) instead of hardcoding `"The Henderson Household"`.
- **Acceptance Criteria**:
  - Cold start on a clean install guides the user to create or join a real `FamilyWorkspaceEntity` in Room, which immediately becomes the active workspace across all screens.

---

### Phase 5: ViewModel Layer & End-to-End CRUD Wiring
- **Target Files**:
  - `android/app/src/main/java/com/familyos/core/viewmodel/FamilyOSViewModels.kt` (new)
  - `MainActivity.kt` and all screens in `com.familyos.feature.*`
- **Actions**:
  1. Implement `ViewModel` classes backed by `FamilyOSDatabase` repositories (`DashboardViewModel`, `FamilyTreeViewModel`, `GoalsViewModel`, `HouseholdViewModel`, `FinanceViewModel`, `WellbeingViewModel`, `EmergencyViewModel`, `CalendarViewModel`).
  2. Add a top module switcher inside `FamilyOSDestination.HOUSEHOLD` so users can navigate between **Meal Planner**, **Recipe Library**, **Chores & Points**, and **Home Assets**.
  3. Wire interactive BottomSheets/Dialogs for creating and updating records (Add Member, Add Relationship, New Goal/Project/Task, Add Meal/Recipe, Complete Chore, Add Account/Income/Expense/Transfer/Reverse, Add Allergy/Medication, Add Emergency Contact/Check Supply).
  4. Wire `Intent.ACTION_DIAL` in `EmergencyScreen.kt` and deep-link `recipeId` selection in `RecipeLibraryScreen.kt`.
- **Acceptance Criteria**:
  - Every data item displayed on screen originates from Room `Flow` streams.
  - All user mutations persist across app restarts.

---

### Phase 6: Safe Offline Synchronization, RBAC Enforcement & Audit Trail
- **Target Files**:
  - `FamilyRepositoryImpl.kt`, `Stage2RepositoriesImpl.kt`, `Stage3RepositoriesImpl.kt`
  - `android/app/src/main/java/com/familyos/core/sync/SyncWorker.kt` (new)
- **Actions**:
  1. Enforce `FamilySecurityPolicy` checks inside repository write methods.
  2. Append a `SyncQueueEntity` (`retryState = "PENDING"`) and `AuditEventEntity` on repository mutations.
  3. Schedule `SyncWorker` via `WorkManager` with `NetworkType.CONNECTED` constraint and exponential backoff.
- **Acceptance Criteria**:
  - Offline mutations increment the live pending sync counter in `FamilyOSAppShell` and remain queued until the remote server confirms receipt.

---

### Phase 7: Automated & End-to-End Verification Gate
- **Actions**:
  1. Execute local verification suite (`scripts/verify-stage3.ts`) and all 14 JUnit test suites + `FamilyOSMigrationInstrumentedTest` in GitHub Actions CI.
  2. Verify zero lint errors, APK artifact generation, and full persistence across app restarts.
