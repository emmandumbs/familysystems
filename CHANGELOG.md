# FAMILYOS — CHANGELOG

All notable changes to the FamilyOS project will be documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.4.1] — 2026-11-01

### Added & Fixed — STAGE 3.1: Production Foundation Remediation & Shared Backend Alignment
- **P0 Kotlin Compose & Instrumented Test Compilation Fixes**:
  - Replaced invalid TypeScript union generics (`mutableStateOf<"A" | "B">`) and `as any` casts with strongly typed Kotlin enums across `FamilyTreeScreen.kt` (`FamilyViewMode`), `MealPlannerScreen.kt` (`MealPlannerSubView`), `HomeAssetsScreen.kt` (`HomeAssetsTab`), and `CalendarScreen.kt` (`CalendarViewMode`).
  - Reconciled `FamilyOSMigrationInstrumentedTest.kt` Stage 3 entity constructors and DAO calls (`insertOrUpdateAccount`, `recordExpense`, `insertOrUpdateProfile`, `getProfileForMember`, `observeAllergiesForMember`, `insertOrUpdateEmergencyPlan`, `getEmergencyPlan`) with `Stage3Entities.kt` and `Stage3Daos.kt`.
- **SQLCipher AES-256 Database Encryption & Keystore Manager (`com.familyos.core.database`)**:
  - Added `DatabaseKeyManager.kt` using `androidx.security.crypto.MasterKey`, `EncryptedSharedPreferences`, and `net.zetetic.database.sqlcipher.SupportOpenHelperFactory`.
  - Wired `DatabaseKeyManager.createEncryptedOpenHelperFactory(context)` into `FamilyOSDatabase.getInstance(context)`.
- **Non-Destructive Sync Queue & WorkManager SyncWorker (`com.familyos.core.sync`)**:
  - Added `RemoteSyncGateway` and `RemoteSyncAck` in `SyncManager.kt` so `SyncRepositoryImpl.processPendingQueue()` retains unacknowledged or offline operations in `sync_queue` with incremented `attempt_count` and `retry_state = "FAILED"`, only dequeuing upon verified server acknowledgement matching `idempotencyKey`.
  - Added `SyncWorker.kt` (`CoroutineWorker` + `HttpRemoteSyncGateway`) scheduled via `WorkManager` in `FamilyOSApplication.kt`.
  - Updated `SyncPolicyAndIdempotencyTest.kt` to test the real `SyncRepositoryImpl` with a `FakeSyncQueueDao`.
- **Reactive ViewModel Layer & End-to-End Room Wiring (`com.familyos.core.viewmodel`)**:
  - Created `FamilyOSViewModel.kt` connecting all 12 domain repositories to reactive `StateFlow` streams, seeding initial persistent workspace records on first cold launch, and writing `SyncOperation` + `AuditEventEntity` records on every mutation.
  - Wired `MainActivity.kt`, `FinanceScreen.kt`, `WellbeingScreen.kt`, `EmergencyScreen.kt` (including `Intent.ACTION_DIAL` on emergency contact call button), and `RecipeLibraryScreen.kt` (`familyos://recipe/{id}` deep link support) to live Room state and callbacks.
  - Added 4-tab Household Hub sub-navigation switcher (`Meal Planner`, `Recipes`, `Chores`, `Home Assets`) and `QuickCreateDialog` (`+` FAB) in `MainActivity.kt`.
- **Data Mapper & Repository Fixes (`com.familyos.core.data`)**:
  - Wired `kotlinx.serialization.json.Json` serialization/deserialization for `dietaryPreferencesJson` and `allergiesJson` in `FamilyRepositoryImpl.kt`.
  - Wired reactive `EnvelopeBudget.spentCents` rollup from posted `EXPENSE` and reversal transactions in `FinanceRepositoryImpl.observeBudgets()`.
  - Fixed `ChoresRepositoryImpl.completeChore()` using `ChoresDao.getChoreById(choreId)`.
  - Wired `GoogleAuthProvider.getCredential(idToken, null)` in `FirebaseAuthRepository.kt`.
- **Shared Authoritative Backend & Web Portal Alignment (`server.ts` & `src/App.tsx`)**:
  - Added `server.ts` Express + Vite backend serving `/api/v1/workspace/:familyId`, `/api/v1/sync/push` (idempotency deduplicated), `/api/v1/finance/transaction`, and `/api/v1/finance/reverse` with RBAC enforcement and disk persistence (`data/familyos-shared-store.json`).
  - Connected `src/App.tsx` Finance & Shared Backend views to live `/api/v1/*` endpoints.

---

## [0.4.0] — 2026-10-30

### Added — STAGE 3: Finance & Wellbeing Management System
- **Room SQLite Entities & Database v3 (`com.familyos.core.database`)**:
  - Added 15 normalized Room entities in `Stage3Entities.kt`: `FinancialAccountEntity`, `FinancialTransactionEntity`, `RecurringTransactionEntity`, `EnvelopeBudgetEntity`, `SavingsGoalEntity`, `BillSubscriptionEntity`, `WellbeingProfileEntity`, `HealthAllergyEntity`, `HealthMedicationEntity`, `HealthVaccinationEntity`, `HealthcareAppointmentEntity`, `EmergencyContactEntity`, `EmergencyPlanEntity`, `EmergencySupplyEntity`, `EmergencyChecklistItemEntity`.
  - Added 3 dedicated DAOs in `Stage3Daos.kt`: `FinanceDao`, `WellbeingDao`, `EmergencyDao` with atomic transfers and audit reversal support.
  - Bumped `FamilyOSDatabase` to Version 3 (39 total Room entities) with `MIGRATION_2_3`.
- **Domain Layer & Business Rules (`com.familyos.core.domain` & `com.familyos.core.data`)**:
  - Exact 64-bit Long integer cents arithmetic across all financial domains (Float/Double forbidden).
  - Cash-Flow Planning Engine: `Expected Income − Recurring Expenses − Other Planned Expenses = Available Planned Cash Flow`.
  - Net Worth computation: Liquid/investment assets minus liabilities.
  - Internal transfer isolation: transfers between accounts yield net-zero impact on household wealth.
  - Audit trail preservation: transactions are reversed via offset transactions rather than hard deletion.
  - Wellbeing profiles with blood type, primary doctor, and insurance references.
  - Severe allergy classifications with emergency treatment protocols.
  - Medication schedules with explicit legal/medical non-proof disclaimers.
  - Offline household crisis directory with 1-tap emergency contacts.
  - Meeting points plan (primary & secondary) and utility shutoff guides.
- **Jetpack Compose Feature Screens (`com.familyos.feature.*`)**:
  - `FinanceScreen.kt`: Net worth overview, cash-flow allocation planner, category envelope progress bars, transaction ledger with reversal indicators, recurring bills.
  - `WellbeingScreen.kt`: Member wellbeing summary, restricted child access, allergies & emergency treatments, active medication doses, immunization log, upcoming appointments.
  - `EmergencyScreen.kt`: Offline emergency directory, primary/secondary meeting points, utility shutoff guide, supplies inventory with expiry dates, readiness checklist with member assignments.
  - Integrated into `MainActivity.kt` with destinations `FINANCE`, `HEALTH_FITNESS`, and `FAMILY_SAFETY`.
- **Automated Unit Tests (`android/app/src/test/java/com/familyos/`)**:
  - `Stage3CashFlowTest.kt`: Validates cash flow formula, exact cents math, internal transfer net-zero invariant, net worth calculation, envelope budget alert thresholds, and savings progress.
  - `Stage3WellbeingSecurityTest.kt`: Asserts medication reminder non-proof invariant, guardian authorization for minor health data, and emergency contact prioritization.
  - `Stage3RoomMigrationTest.kt`: Validates `MIGRATION_2_3` start/end versions, DDL table creation, and foreign key indices.
- **Interactive Web Preview Portal (`src/App.tsx`)**:
  - Added Stage 3 Finance & Wellbeing interactive explorer with live cash flow calculator, envelope budgets, ledger reversals, member health summaries, and emergency crisis plan.

### Fixed — Android CI Workflow Repair (`.github/workflows/android.yml`)
- Upgraded `android-actions/setup-android` from v3 to v4 across both CI jobs (`verify-and-build` and `instrumentation-tests`).
- Eliminated legacy and obsolete `tools` package reference that caused `Warning: Failed to find package 'tools'` and `Error: sdkmanager failed with exit code 1`.
- Configured explicit package installation lists retaining `platform-tools`, `platforms;android-35`, `platforms;android-34`, `build-tools;35.0.0`, `emulator`, and `system-images;android-34;google_apis;x86_64`.
- Replaced error-masking `|| true` on license acceptance with supported non-interactive pipe that preserves failure propagation on legitimate `sdkmanager` errors while handling SIGPIPE exit code 141.

---

## [0.3.0] — 2026-10-30

### Added — STAGE 2: Family & Household Management System
- **Room SQLite Entities & Database v2 (`com.familyos.core.database`)**:
  - Added 16 normalized relational Room entities in `Stage2Entities.kt`: `FamilyRelationshipEntity`, `FamilyGoalEntity`, `ProjectEntity`, `TaskEntity`, `TaskChecklistItemEntity`, `RecipeEntity`, `RecipeIngredientEntity`, `RecipeInstructionEntity`, `MealPlanEntryEntity`, `GroceryListItemEntity`, `ChoreEntity`, `ChoreCompletionHistoryEntity`, `HomeAssetEntity`, `AssetMaintenanceRecordEntity`, `HouseholdWishlistItemEntity`, `CalendarEventEntity`.
  - Added 8 dedicated DAOs in `Stage2Daos.kt` with reactive Kotlin Flow queries.
  - Bumped `FamilyOSDatabase` to Version 2 with 24 total Room entities.
  - Implemented `MIGRATION_1_2` safe SQLite DDL migration script to preserve all v1 user data.
- **Domain Layer & Repositories (`com.familyos.core.domain` & `com.familyos.core.data`)**:
  - Added Stage 2 domain data models in `Stage2Models.kt` cleanly decoupled from Room annotations.
  - Defined repository interfaces in `Stage2Repositories.kt`.
  - Implemented production repositories in `Stage2RepositoriesImpl.kt` featuring:
    - Directed acyclic graph loop validation for parent-child relationship creation.
    - 4-tier task hierarchy rollup percentage computation.
    - Linear yield scaling for recipe ingredient quantities.
    - Automated chore next-due-date progression based on recurrence rules.
    - Cross-module calendar event aggregation.
- **Jetpack Compose Feature Screens (`com.familyos.feature.*`)**:
  - `FamilyTreeScreen.kt`: Visual tree rendered across Generations I–III with zoom/pan controls, member selector, and guardian protections for restricted minor profiles.
  - `GoalsScreen.kt`: 4-tier hierarchy viewer with nested accordion tree, progress indicators, and multi-member assignment.
  - `MealPlannerScreen.kt`: 7-day calendar matrix across Breakfast, Lunch, Dinner, and Snacks with 1-click recipe linkage and instant grocery list generation.
  - `RecipeLibraryScreen.kt`: Scalable servings manager, printable card view mode, and standard offline deep-link QR code payload.
  - `ChoresScreen.kt`: Daily/weekly/monthly recurrence scheduler, point award system, positive family encouragement, and private completion history.
  - `HomeAssetsScreen.kt`: Home equipment & appliance tracker with exact 64-bit integer cents (`$1.00 = 100L`), warranty expiration monitors, maintenance logs, and prioritized wishlist.
  - `CalendarScreen.kt`: Unified household calendar aggregating birthdays, meals, chores, goal deadlines, and maintenance intervals.
  - `MainActivity.kt`: Integrated Stage 2 navigation destinations and screen routing into `FamilyOSAppShell`.
- **Automated Unit Test Suites (`android/app/src/test/java/com/familyos/`)**:
  - `Stage2FamilyTreeTest.kt`: Validates parent-child cycle prevention and minor profile guardian restrictions.
  - `Stage2GoalsHierarchyTest.kt`: Tests multi-tier task rollup calculations and subtask checklist completion.
  - `Stage2MealsAndRecipesTest.kt`: Verifies dynamic recipe yield multiplier calculation and grocery aggregation.
  - `Stage2ChoresTest.kt`: Verifies recurrence interval advancement and positive reinforcement rules.
  - `Stage2HomeAssetsTest.kt`: Asserts zero floating-point cents arithmetic on asset valuations and warranty expiration alerts.
  - `Stage2CalendarTest.kt`: Tests cross-module household event aggregation.
  - `Stage2RoomMigrationTest.kt`: Tests `MIGRATION_1_2` DDL table and index generation.
- **Interactive Web Preview Portal (`src/App.tsx`)**:
  - Added dedicated Stage 2 Family & Household interactive module explorer:
    - Multigenerational Family Tree explorer with zoom controls and member modal.
    - 4-tier Goal & Task hierarchy viewer with interactive checklist toggles.
    - 7-day Meal Planner grid with 1-click grocery list generation.
    - Recipe Library with live serving yield scaler (1x, 2x, 3x) and offline QR code format.
    - Chores board with active completion and point accumulation.
    - Home Assets registry with exact integer cents calculations and warranty badges.
    - Unified Household Calendar agenda feed.

## [0.2.0] — 2026-10-30

### Added — STAGE 0.1 & STAGE 1: Native Android Foundation & Core Platform
- **Native Android Project Structure (`android/`)**:
  - `settings.gradle.kts`, `build.gradle.kts`, `gradle/libs.versions.toml`, `gradle.properties`, `gradlew`, `gradle/wrapper/`.
  - `app/build.gradle.kts` configured with Kotlin 2.0.21, AGP 8.7.2, targetSdk 35, minSdk 26, Jetpack Compose, Room SQLite, DataStore, WorkManager, SQLCipher, and Firebase SDK BOM 33.5.1.
  - `AndroidManifest.xml` with `FamilyOSApplication` and `MainActivity`.
- **Design System Implementation in Jetpack Compose (`com.familyos.core.designsystem`)**:
  - `Color.kt`, `Type.kt`, `Shape.kt`, `Theme.kt`.
  - 16 production-grade reusable components: `FamilyOSPrimaryButton`, `FamilyOSSecondaryButton`, `FamilyOSOutlinedButton`, `FamilyOSCard`, `FamilyOSSectionHeader`, `FamilyOSTextField`, `FamilyOSSearchField`, `FamilyOSAvatar`, `FamilyOSProfileHeader`, `FamilyOSEmptyState`, `FamilyOSLoadingState`, `FamilyOSErrorState`, `FamilyOSConfirmationDialog`, `FamilyOSBottomSheet`, `FamilyOSProgressIndicator`, `FamilyOSStatusBadge`.
- **Room SQLite Database Foundation (`com.familyos.core.database`)**:
  - 8 core relational entities: `LocalUserProfileEntity`, `FamilyWorkspaceEntity`, `FamilyMembershipEntity`, `FamilyMemberEntity`, `FamilyInvitationEntity`, `GuardianRelationshipEntity`, `SyncQueueEntity`, `AuditEventEntity`.
  - Comprehensive DAOs (`UserProfileDao`, `FamilyWorkspaceDao`, `FamilyMemberDao`, `GuardianRelationshipDao`, `SyncQueueDao`, `AuditEventDao`).
  - `FamilyOSDatabase` Room database class with in-memory test factory.
- **Domain Layer & Repositories (`com.familyos.core.domain` & `com.familyos.core.data`)**:
  - Decoupled `UserAccount` vs `FamilyMember` domain models with 5 distinct concepts.
  - `FamilyWorkspaceRepository`, `FamilyMemberRepository`, and `SyncRepository` implementations.
- **Offline Synchronization Pipeline (`com.familyos.core.sync`)**:
  - Controlled sync queue with idempotency key deduplication.
  - Domain-specific conflict policies (`EVENT_BASED_MERGE`, `APPEND_ONLY_LEDGER`, `SERVER_AUTHORITATIVE`, `TOMBSTONE_SOFT_DELETE`).
- **Application Shell & Initial Dashboard (`com.familyos.feature.dashboard`)**:
  - `FamilyOSAppShell` with adaptive phone (bottom bar), tablet (NavigationRail), and desktop (collapsible drawer) layouts.
  - Canonical 16-destination navigation registry.
  - Responsive Dashboard with greeting, family avatar row, schedule list, responsibilities, and development placeholders.
- **Automated Unit Test Suites (`android/app/src/test/java/com/familyos/`)**:
  - `FinancialCalculationTest`: Zero floating-point cash-flow formula verification and exact string parsing.
  - `SyncPolicyAndIdempotencyTest`: Conflict policies and deduplication verification.
  - `RbacPermissionTest`: Role privilege boundary assertions.

### Changed
- Corrected `FAMILYOS_ARCHITECTURE.md`: Version matrix updated, UserAccount decoupled from credentials (zero passwords stored).
- Corrected `FAMILYOS_SECURITY_PLAN.md`: Evaluated SQLCipher vs Keystore, documented AI privacy limits and Play Billing rules.
- Corrected `FAMILYOS_DATABASE_SCHEMA.md`: 8 core shared entities formalized.

#### Added
- **Master Plan (`FAMILYOS_MASTER_PLAN.md`)**: Comprehensive multi-stage roadmap, product vision, executive tenets, and module breakdown across all 12 modules.
- **Technical Architecture (`FAMILYOS_ARCHITECTURE.md`)**: Platform definitions, Kotlin 2.0 / Compose BOM / Room stack selection, Clean Architecture MVVM layers, User Account vs Family Member decoupling, and server-side Gemini AI gateway.
- **Database Schema (`FAMILYOS_DATABASE_SCHEMA.md`)**: Room SQLite DDL covering all 12 modules, strict `Long` integer cents rule for currency, offline sync queue model, tombstone deletion flags, and foreign key indices.
- **Security & Privacy Plan (`FAMILYOS_SECURITY_PLAN.md`)**: Deny-by-default RBAC matrix (Owner, Admin, Member, Child, Guest), COPPA & GDPR-K child data protection, Android Keystore encryption, R8 anti-cloning, and Cloud Firestore security rules.
- **Design System (`FAMILYOS_DESIGN_SYSTEM.md`)**: Warm Forest Green (`#173D35`), Ivory (`#F7F4EC`), and Gold (`#C39A60`) tokens, 8dp spacing hierarchy, serif/sans typography pairing, and adaptive phone/tablet/desktop layouts.
- **Feature Register (`FAMILYOS_FEATURE_REGISTER.md`)**: Granular tracking table of all module capabilities with IDs, dependencies, and entity mappings.
- **Test Strategy (`FAMILYOS_TEST_STRATEGY.md`)**: Test pyramid, integer arithmetic verification, and automated validation for the 17 mission-critical architectural scenarios.
- **Release Checklist (`FAMILYOS_RELEASE_CHECKLIST.md`)**: Google Play Store policy checklist, Data Safety, Family Policy, billing compliance, and quality gates.
- **Master Progress Tracker (`FAMILYOS_MASTER_PROGRESS.md`)**: Central stage status, task completion metrics, and next assignment roadmap.
