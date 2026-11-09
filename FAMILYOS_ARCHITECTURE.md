# FAMILYOS — TECHNICAL ARCHITECTURE SPECIFICATION
**Version**: 5.0.0 (One-Family-Per-Account & Simplification Stabilization)  
**Authoritative Reference**: `FAMILYOS_MASTER_PLAN.md` & Canonical Single-Family Architecture  
**System**: Android Native (Jetpack Compose / Clean Architecture), Room SQLite (v9, 57 Entities [52 Tables + 5 FTS4 Virtual Tables], MIGRATION_1_2 through MIGRATION_8_9, SQLCipher AES-256), and Web/Backend Services (React + TypeScript + Express + Durable Atomic Store v3.4.0)  

---

## 1. Platform & Environment Specification

### 1.1 Android SDK & Target Configurations
- **minSdkVersion**: `26` (Android 8.0 Oreo)
  - *Justification*: Provides 96.5%+ global Android active device coverage while giving native Java 8/time API support (`java.time.Instant`), notification channels, hardware-backed Keystore, modern biometric authentication APIs (`BiometricPrompt`), and robust WorkManager background job reliability without multidex overhead.
- **targetSdkVersion**: `35` (Android 15)
  - *Justification*: Required for Google Play Store compliance (Play Console requires targeting Android 14 API 34 minimum, moving to Android 15 API 35 for latest submissions), full predictive back gestures, Edge-to-Edge window enforcement, and strict foreground service type declarations.
- **compileSdkVersion**: `35`
- **Kotlin Version**: `2.0.21` (with Compose Compiler Gradle Plugin)
- **Android Gradle Plugin (AGP)**: `8.7.2`
- **Gradle Version**: `8.9`
- **JVM Target**: `Java 17`

---

## 2. Technology Stack & Library Version Matrix (Verified Mutually Compatible)

| Layer / Concern | Technology Selection | Version | Justification & Compatibility |
|---|---|---|---|
| **Build Tooling** | Android Gradle Plugin (AGP) | `8.7.2` | Current production stable release; requires Gradle 8.9+ and JDK 17. |
| **Build Engine** | Gradle Wrapper | `8.9` | Official compatible build engine for AGP 8.7.2. |
| **Language** | Kotlin & Compose Plugin | `2.0.21` | Modern Kotlin K2 compiler with native Compose compiler plugin. |
| **UI Toolkit** | Jetpack Compose (BOM) | `2024.10.01` | Pure declarative UI, zero legacy XML overhead, adaptive layouts for tablets/foldables. |
| **Design System** | Material 3 Components | `1.3.1` | Modern Material You theming customized with FamilyOS Warm Forest & Gold palette. |
| **Navigation** | Navigation Compose | `2.8.3` | Type-safe navigation with Kotlinx Serialization 1.7.3. |
| **Architecture** | Lifecycle & ViewModel | `2.8.7` | Predictable unidirectional data flow (UDF), ViewModel state preservation. |
| **Asynchrony** | Coroutines & Flow | `1.9.0` | Reactive streaming, backpressure handling, cancellation hierarchy. |
| **Local Database** | Room SQLite ORM | `2.6.1` | Type-safe SQL, FTS4 full-text search, compile-time query verification, Room Flow streams. |
| **Key-Value Store** | Jetpack DataStore (Preferences) | `1.1.1` | Thread-safe, asynchronous replacement for SharedPreferences. |
| **Background Tasks**| WorkManager | `2.9.1` | Guaranteed background execution for offline synchronization, data cleanup. |
| **Cloud Services** | Firebase Android SDK (BOM) | `33.5.1` | High-availability Auth, Firestore real-time sync, Storage for attachments, App Check. |
| **Database Encryption**| SQLCipher Android | `4.5.5` | `net.zetetic:sqlcipher-android:4.5.5` for 256-bit AES database encryption. |
| **Security & Crypto**| AndroidX Security Crypto | `1.1.0-alpha06` | Hardware-backed MasterKey via Android Keystore, EncryptedSharedPreferences. |
| **Biometrics** | AndroidX Biometric | `1.2.0-alpha05` | Standardized Face & Fingerprint authentication dialogs (local convenience unlock only). |
| **Play Billing** | Google Play Billing Library | `7.1.1` | Compliant in-app subscription and digital purchase management. |
| **JSON Serialization**| Kotlinx Serialization | `1.7.3` | Ultra-fast reflection-free JSON parsing for network payloads and Room type converters. |
| **Testing** | JUnit 4/5, MockK, Turbine | `1.13.13` / `1.2.0` | Comprehensive unit tests, Flow testing via Turbine, state-restoration tests. |

---

## 3. Clean Architecture & Layered Boundaries

```
+-----------------------------------------------------------------------------------------+
|                                    PRESENTATION LAYER                                    |
|   Composables (Screens, Custom Components, Theme) <--> ViewModels (StateFlow, Intents)  |
|   State: UiState<T> (Loading, Success, Empty, Error) | One-time Events: Channel / Flow   |
+-----------------------------------------------------------------------------------------+
                                             |
                                             v
+-----------------------------------------------------------------------------------------+
|                                      DOMAIN LAYER                                        |
|   Use Cases / Interactors (Single Responsibility: e.g. CalculateAvailableCashFlowUseCase) |
|   Domain Models (Immutable pure Kotlin models: Money, FamilyTree, MealPlan)              |
|   Repository Interfaces (Strict abstract contracts)                                      |
+-----------------------------------------------------------------------------------------+
                                             |
                                             v
+-----------------------------------------------------------------------------------------+
|                                       DATA LAYER                                         |
|   Repository Implementations (Offline-First source of truth coordinator)                |
|   - Reads Room Dao first -> returns Flow<List<DomainModel>>                             |
|   - Dispatches mutations to Room Dao + writes to SyncQueueEntity                         |
|   - Triggers SyncWorker to reconcile with Remote DataSource                             |
+-----------------------------------------------------------------------------------------+
                 |                                                         |
                 v                                                         v
+----------------------------------+                     +----------------------------------+
|          LOCAL DATA SOURCE       |                     |        REMOTE DATA SOURCE        |
| - Room Database (SQLite + FTS4)  |                     | - Firebase Firestore Client SDK  |
| - Encrypted DataStore            |                     | - Firebase Storage (Attachments) |
| - Android Keystore Cryptography  |                     | - Cloud Functions (Gemini Proxy) |
+----------------------------------+                     +----------------------------------+
```

---

## 4. Decoupled Identity, Single-Family Membership, Guardian & Permission Model

A critical architectural invariant in FamilyOS is **One Active Family Per Authenticated Account**, separating five distinct concepts:
1. **Authenticated User Account (`UserAccount`)**: Owned exclusively by the identity provider (Firebase Auth). Stores NO passwords, hashes, or auth secrets.
2. **Family Membership (`FamilyMembership`)**: Connects an authenticated user account to their single active family workspace (`status = 'ACTIVE'`) with a verified role. Historical `REVOKED` rows may be retained for audit history while a partial unique index (`WHERE status = 'ACTIVE'`) guarantees at most one active family per account.
3. **Family Member Profile (`FamilyMember`)**: The household human representation (name, birthday, dietary rules, milestones). Can exist independently without an account (crucial for minor children, dependents, or elderly family members).
4. **Guardian Relationship (`GuardianRelationship`)**: Explicit legal/parental stewardship mapping which adult accounts supervise which minor profiles.
5. **Permission Assignment (`PermissionAssignment`)**: Verified server-side capabilities (not client-side UI toggles).

```
+--------------------------------------------------------+
|                      UserAccount                       |
| - id: UUID (Internal unique reference)                 |
| - authenticationProvider: FIREBASE_GOOGLE | EMAIL_PASS |
| - providerUserId: String (Stable Auth UID from IdP)    |
| - email: String                                        |
| - displayName: String?                                 |
| - profilePictureUri: String?                           |
| - preferredLanguage: String                            |
| - accountStatus: ACTIVE | SUSPENDED | PENDING_DELETION |
| - createdAt: Long (epoch millis)                       |
| - updatedAt: Long (epoch millis)                       |
+--------------------------------------------------------+
                           |
                           | 0..1 ACTIVE (One active family membership per account;
                           |             revoked audit records preserved)
                           v
+--------------------------------------------------------+
|                    FamilyMembership                    |
| - id: UUID                                             |
| - familyId: UUID (FK -> FamilyWorkspace)               |
| - userAccountId: UUID (FK -> UserAccount)              |
| - memberProfileId: UUID (FK -> FamilyMember)           |
| - role: OWNER | ADMIN | MEMBER | CHILD | GUEST         |
| - status: ACTIVE | INVITED | REVOKED                   |
| - joinedAt: Long                                       |
+--------------------------------------------------------+
                           |
                           | 1..1
                           v
+--------------------------------------------------------+
|                      FamilyMember                      |
| - id: UUID (Primary Key)                               |
| - familyId: UUID (Foreign Key -> FamilyWorkspace)      |
| - displayName: String                                  |
| - relationshipToPrimary: SELF | SPOUSE | CHILD | ...   |
| - birthDate: Long?                                     |
| - avatarUrl: String?                                   |
| - dietaryPreferences: List<String>                     |
| - allergies: List<String>                              |
| - isRestrictedProfile: Boolean                         |
| - createdAt: Long                                      |
| - updatedAt: Long                                      |
+--------------------------------------------------------+
                           ^
                           | 0..* Supervised by Guardians
+--------------------------------------------------------+
|                  GuardianRelationship                  |
| - id: UUID                                             |
| - familyId: UUID (FK)                                  |
| - guardianMemberId: UUID (FK -> FamilyMember)          |
| - minorMemberId: UUID (FK -> FamilyMember)             |
| - relationshipType: PARENT | LEGAL_GUARDIAN            |
| - isEmergencyContact: Boolean                          |
| - canManageHealthRecords: Boolean                      |
| - createdAt: Long                                      |
+--------------------------------------------------------+
```

### Architectural Enforcement Rules:
1. **No Password Storage**: Zero password hashes or plain secrets are stored in the local SQLite database. Firebase Auth handles all credential verification.
2. **Biometrics as Device Protection**: Local biometric unlock (Fingerprint/Face) is strictly an on-device gate for app access convenience and does not replace server-authoritative Firebase token refresh.
3. **Child Profiles Without Accounts**: Minor children have a `FamilyMember` profile and a `GuardianRelationship` entity. A child profile is NOT an authenticated account. Guardian-managed devices provide pin-protected access to view assigned chores and achievements.
4. **Server-Side Authorization**: Permissions are validated on Firebase Cloud Functions / Firestore security rules. Client UI visibility is purely ergonomics, not a security boundary.

---

## 5. Dependency Injection Topology

Using standard Hilt scoping:
- `@Singleton`: Room Database, DataStore, Network Client, WorkManager Scheduler, Encryption Engine.
- `@ViewModelScoped`: Repositories, Domain Use Cases, Navigation Coordinators.
- `@ActivityRetainedScoped`: Workspace Context Manager (keeps active `currentFamilyId` stable across rotations).

---

## 6. Backend Integration & Secure Gemini AI Gateway

### 6.1 Direct SDK vs Proxy Strategy
Direct client-side Gemini API calls are strictly forbidden in production because:
1. Android APK decompilation can expose embedded API keys.
2. Direct API keys prevent centralized household rate-limiting and quota enforcement.
3. Client-side prompts cannot safely sanitize family privacy data before transit.

### 6.2 FamilyOS AI Gateway Architecture:
```
[Android Jetpack Compose] 
       | (HTTPS Bearer Token Auth)
       v
[Cloud Run / Firebase Cloud Functions: /api/ai/*]
       | 
       +---> 1. Validate Firebase JWT & verify Family Membership
       +---> 2. Apply rate-limiting & parental consent check
       +---> 3. Strip PII (names replaced with tokenized placeholders: Member_A, Member_B)
       +---> 4. Call @google/genai SDK (Gemini 2.5 Flash / Pro)
       +---> 5. Enforce structured JSON Schema response
       v
[Android Client Receives Structured Draft]
       v
[Human Approval Screen (User edits, approves or discards)]
       v
[Committed to Local Room DB & Sync Queue]
```

---

## 7. Master Stage 2 — Unified Planning, Canonical Task & Privacy Architecture (Milestone 3.3.2)

1. **7-Tier Deterministic Rollup Hierarchy**:
   - `Family Mission` → `Family Vision` → `Goals` → `Projects` → `Milestones` → `Tasks` → `Checklists`.
   - Progress rolls up deterministically from checklist item completion to tasks, milestones, projects, and goals without hardcoded progress bars or duplicate progress tables.
2. **Scope Privacy & Role Governance**:
   - `PERSONAL` goals, projects, tasks, and task-linked calendar events are visible and mutable only by `ownerMemberId` / `creatorMemberId`.
   - `COUPLE` goals and `MARRIAGE`-module tasks are restricted to adult couple members (`OWNER`, `ADMIN`, or `SELF`/`SPOUSE_PARTNER`).
   - `CHILD` members can complete assigned tasks/checklists and create self-tasks, but cannot assign tasks to other family members or delete shared adult tasks.
3. **Single Canonical Task Engine**:
   - A single canonical `Task` model (`productivity_tasks` / `planningTasks`) with `sourceModule` (`GOALS_PROJECTS`, `HOME_MANAGEMENT`, `MARRIAGE`, `PARENTING`, `SPIRITUAL_GROWTH`, `FAMILY_GOVERNANCE`, `PERSONAL_PLANNING`) serves the entire platform, with bidirectional `CALENDAR_EVENT` synchronization and `EVENT_BASED_MERGE` offline checklist conflict resolution.

---

## 8. Master Stage 2 — Shared Calendar, Reusable Routines & Notification Architecture (Milestone 3.3.3)

1. **Authoritative Calendar Architecture**:
   - Standalone and task-linked events unified under `AuthoritativeCalendarEvent` and Android Room `calendar_events`.
   - Supports all-day flags (`isAllDay`), UTC millisecond epoch timestamps, and IANA timezone strings (`America/Los_Angeles`).
   - Standard categories: `BIRTHDAY`, `ANNIVERSARY`, `GOAL_DUE`, `TASK_DUE`, `MEAL`, `CHORE`, `MAINTENANCE`, `FAMILY_EVENT`, `APPOINTMENT`, `ROUTINE`, `SPECIAL_OCCASION`.
2. **Zero-Trust Scope Privacy**:
   - `PERSONAL`: Accessible strictly to creator / assigned members.
   - `COUPLE`: Accessible strictly to adult partner members (`OWNER`, `ADMIN`, `SELF`/`SPOUSE_PARTNER`); filtered out completely for `CHILD` and `GUEST` roles.
   - `FAMILY`/`SHARED`: Visible to all authenticated members (with `GUEST` having read-only access).
3. **Decoupled Routines & Occurrence Execution**:
   - A `Routine` defines the cadence, target weekdays, target time, checklist steps template, and points reward.
   - A `RoutineOccurrence` represents an isolated execution instance on a target date (`occ-${routineId}-${targetDate}`).
   - **Critical Decoupling Invariant**: Marking an occurrence completed or checking off steps **NEVER completes or deletes the parent Routine definition**. The routine stays active for future days while updating streak metrics (`streakCount`, `bestStreakCount`) and awarding gamified family points.
4. **Promotion / Conversion of Routine Occurrence to Canonical Task**:
   - Promotes routine occurrence into a canonical task (`sourceModule: ROUTINES`) with cloned checklist items and automatic calendar synchronization.
5. **Month-End Anchor Day Calculation**:
   - Month-end anchor day preservation ensures recurring events on the 29th–31st safely clamp to the last valid day of shorter months (e.g., Feb 28 or 29) with `isClamped: true` and automatically restore to the 31st in longer months.
6. **SQLCipher Room v4 Durable Routine Persistence**:
   - Replaces in-memory StateFlows with durable, encrypted Room SQLite tables: `routines` (40) and `routine_occurrences` (41).
   - Upgraded via non-destructive `MIGRATION_3_4` with zero data loss across existing 39 tables.
   - Local mutations are committed to encrypted SQLite storage *before* updating UI flows, ensuring complete survival across app process termination and restarts.
7. **Native Event Editing & Recurrence Exception Mechanics**:
   - Interactive `EditCalendarEventDialog` in `CalendarScreen.kt` allows editing timestamps, categories, privacy scopes, IANA timezones, location, and notes.
   - Recurrence exception toggling allows targeting the entire series or appending the target date to `recurrenceExceptions` to modify a single instance without breaking the recurrence rule.
8. **Native Android Notification Delivery Subsystem**:
   - `CalendarReminderScheduler`: Coordinates with Android `AlarmManager` using `setExactAndAllowWhileIdle()` and exact alarm permissions (`SCHEDULE_EXACT_ALARM`).
   - `CalendarReminderReceiver`: BroadcastReceiver executing in `familyos_reminders_channel` with **Zero-Trust Privacy Concealment** (strips sensitive titles for `COUPLE` and `PERSONAL` scopes on lockscreens).
   - `BootReceiver`: Recovers and reschedules active event alarms on `ACTION_BOOT_COMPLETED`, `ACTION_TIME_CHANGED`, and `ACTION_TIMEZONE_CHANGED`.

---

## 9. Master Stage 3 — Finance, Growth & Wellbeing Architecture (Milestones 3 & 3.2)

1. **Exact 64-Bit Integer-Cents Financial Engine**:
   - Zero floating-point representation (`Float`/`Double` strictly forbidden for monetary arithmetic).
   - All monetary calculations are performed in `Long` integer cents (e.g. `$100.50` = `10050L`).
   - Atomic balance updates, write-ahead transaction logging, and strict duplicate transaction prevention via deterministic idempotency keys (`idempotency_key`).
2. **Category Envelope Budgets & Dynamic Spent Rollups**:
   - Reactive spent rollup computes `EnvelopeBudget.spentCents` from posted expenses and reversals without manual, error-prone balance columns.
   - Threshold warnings fire at configured percentages (e.g. 80%) before exceeding monthly allocations.
3. **Available Planned Cash-Flow Allocator**:
   - Formula: `Planned Cash Flow = Projected Income - Fixed Monthly Obligations - Envelope Budgets - Savings Commitments`.
   - Prevents over-allocation and enables confident savings milestone funding.
4. **Non-Destructive Transaction Reversals**:
   - Financial ledger entries are never hard-deleted; audit integrity is maintained via compensating reversal transactions linked to the original `transaction_id`.
5. **Guardian-Gated Health & Safety Boundaries**:
   - Minor health profiles, medication dosages, and medical appointments require verified guardian authorization (`FamilySecurityPolicy.canAccessChildMedicalRecords`).
   - Offline emergency preparedness directory (`emergency_contacts`, `safety_supplies`, `emergency_plans`) remains accessible instantly without network connectivity.



