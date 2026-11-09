# FAMILYOS — COMPREHENSIVE TEST STRATEGY
**Version**: 1.0.0 (Stage 0 Baseline)  
**Standard**: Commercial Reliability, Zero-Tolerance Financial Error, Offline Resilience  

---

## 1. Test Pyramid & Tooling Matrix

```
       / \
      /   \      UI & Compose Integration Tests (10%)
     /     \     - ComposeTestRule, Navigation Tests, Accessibility Checks
    /-------\
   /         \   Repository & Database Migration Tests (30%)
  /           \  - In-Memory Room SQLite, RoomMigrationTestRule, SyncWorker Tests
 /-------------\
/               \ Unit & Domain UseCase Tests (60%)
/                 \ - JUnit 5, MockK, Turbine (Flows), Strict Integer Financial Calculators
-------------------
```

### Tooling Specification
- **Unit Testing**: `JUnit 5` (`org.junit.jupiter:junit-jupiter:5.11.3`)
- **Mocking**: `MockK` (`io.mockk:mockk:1.13.13`)
- **Coroutines & Flow Testing**: `kotlinx-coroutines-test:1.9.0` & `app.cash.turbine:turbine:1.2.0`
- **Database Testing**: `androidx.room:room-testing:2.6.1`
- **Compose UI Testing**: `androidx.compose.ui:ui-test-junit4`
- **Assertion Engine**: `Google Truth` (`com.google.truth:truth:1.4.4`)

---

## 2. Financial Calculation Integrity Rules & Test Suite

### 2.1 The Cardinal Rule of FamilyOS Finance
> Floating-point types (`Double`, `Float`) are strictly forbidden in domain calculations, Room entity fields, and serialization payloads for monetary values. All currency values are 64-bit integer cents (`Long`).

### 2.2 Mathematical Specifications & Test Cases
```kotlin
data class CashFlowSummary(
    val expectedIncomeCents: Long,
    val plannedRecurringExpenseCents: Long,
    val plannedVariableExpenseCents: Long,
    val plannedOtherCommitmentsCents: Long
) {
    // Available Before Savings = Expected Income - Recurring Expenses - Variable Expenses
    val availableBeforeSavingsCents: Long
        get() = expectedIncomeCents - plannedRecurringExpenseCents - plannedVariableExpenseCents

    // Available for Allocation = Available Before Savings - Other Planned Commitments
    val availableForAllocationCents: Long
        get() = availableBeforeSavingsCents - plannedOtherCommitmentsCents
}
```

### Mandatory Automated Financial Test Scenarios:
1. **Zero Balance & Negative Net Worth**: Handling liabilities exceeding total assets without overflow.
2. **Sub-Cent Rounding**: Explicit banker's rounding (`RoundingMode.HALF_EVEN`) when computing split-bills or tax percentages.
3. **Double-Counting Prevention**: Unit tests verifying that money transferred between internal accounts (e.g., Checking -> Savings) alters individual balances but yields a net zero impact on total household liquid assets.

---

## 3. The 17 Mandatory Architectural Verification Scenarios

| # | Critical Scenario | Test Level | Automated Assertion Criteria |
|---|---|:---:|---|
| **1** | App starts with an empty database | Repository / UI | App displays initial onboarding / workspace creation without crash or null pointer exceptions. |
| **2** | App survives process death | ViewModel Test | `SavedStateHandle` restores selected workspace, draft forms, and navigation backstack. |
| **3** | User loses internet access during write | Local Data Source | Write succeeds instantly in Room DB; record flagged `PENDING_SYNC`; UI shows offline badge. |
| **4** | User reconnects after being offline | WorkManager Test | `SyncWorker` dequeues pending transactions in FIFO order, receives remote IDs, flips status to `SYNCED`. |
| **5** | User attempts second `ACTIVE` family membership | Backend / Room Trigger | Rejected with HTTP `409 ONE_FAMILY_RULE_VIOLATION` on backend, `idx_one_active_family_membership` in PostgreSQL, and `SQLiteConstraintException` (`ONE_ACTIVE_FAMILY_PER_ACCOUNT`) via `trg_family_memberships_one_active_insert` / `trg_family_memberships_one_active_update` in Room. |
| **6** | Historical `REVOKED` / `LEFT` memberships preserved | Database / Domain Test | Historical `REVOKED` and `LEFT` rows coexist with a single `ACTIVE` membership for audit history; attempting to update a historical row back to `ACTIVE` while an `ACTIVE` membership exists is aborted. |
| **7** | User loses family membership | Security / Interactor | Backend rejection triggers local session cleanup and redirects user to single-family onboarding / invitation claim screen. |
| **8** | Unauthorized user attempts private read | Security Rules Test | Firestore emulator asserts `PERMISSION_DENIED` on another family's documents. |
| **9** | Family invitation token expires | Domain UseCase | Token redemption returns `InvitationExpiredException` with clear non-technical user feedback. |
| **10**| Synchronization request is repeated | Network / Idempotency | Backend detects duplicate idempotency key; returns cached success without duplicating records. |
| **11**| Two users edit the same record | Sync Conflict Engine | Field-level resolution: Task completion event merges; recipe edit prompts user with diff view. |
| **12**| User deletes item pending sync | Sync Queue | Sync queue purges pending `UPDATE` and submits single `DELETE` tombstone. |
| **13**| Database migration runs against data | Room Migration Test | `MigrationTestHelper` verifies schema updates from version N to N+1 preserve all existing rows. |
| **14**| Financial calculation with decimals | Domain Test | Parsing user input string "$1,250.99" converts precisely to `125099L`; no precision degradation. |
| **15**| Subscription expires | Entitlement Engine | Features gracefully gate to Free tier; existing data remains readable; zero data deletion. |
| **16**| User restores Google Play purchase | Billing Test | Billing client queries active purchase tokens and updates local signed entitlement cache. |
| **17**| Child profile restricted permissions | Compose UI / RBAC | Finance tabs, settings, and adult health records are invisible and blocked in child mode. |

---

## 4. Stage 2 Automated Test Suites (`android/app/src/test/java/com/familyos/`)

| Test Suite | Purpose | Key Assertions & Scenarios Tested |
|---|---|---|
| `Stage2FamilyTreeTest.kt` | Validates family relationships and tree integrity | - Parent-child loop prevention: detects directed acyclic graph cycles (A is parent of B, B cannot be parent of A).<br>- Self-referential relationship rejection.<br>- Minor child privacy: restricts sensitive information when `isRestrictedProfile` is true. |
| `Stage2GoalsHierarchyTest.kt` | 4-tier task hierarchy and progress rollup | - Task completion calculation: computes accurate rollup percentage (e.g., 2 of 4 tasks complete = 50%).<br>- Subtask checklist completion: verified when all checklist items are checked.<br>- Multi-member task assignment and priority filtering. |
| `Stage2MealsAndRecipesTest.kt` | Recipe scaling & meal planning | - Yield multiplier: scales ingredient quantities linearly without loss of unit fidelity (e.g. 2 cups * 3x = 6 cups).<br>- Grocery list generation: automatically collates recipe ingredients across planned 7-day meal entries. |
| `Stage2ChoresTest.kt` | Recurrence and positive reinforcement | - Recurrence scheduling: advances next due date accurately across DAILY (86,400s), WEEKLY (604,800s), and MONTHLY (2,592,000s) intervals.<br>- Positive reinforcement: awards integer points, logs completion history without public shaming. |
| `Stage2HomeAssetsTest.kt` | Exact cents asset tracking & warranties | - Zero floating-point arithmetic: purchase price and maintenance costs handled strictly in 64-bit integer cents.<br>- Warranty alert calculation: identifies expired vs active warranties based on epoch timestamps. |
| `Stage2CalendarTest.kt` | Household agenda aggregation | - Cross-module collation: merges birthdays, meal planning entries, chores, goal deadlines, and maintenance intervals into a unified chronological feed. |
| `Stage2RoomMigrationTest.kt` | Database schema migration v1 -> v2 | - Verifies `MIGRATION_1_2` DDL executes without data loss, creating all 16 new Stage 2 tables and indexing foreign keys. |

---

## 5. Stage 3 Automated Test Suites (`android/app/src/test/java/com/familyos/`)

| Test Suite | Purpose | Key Assertions & Scenarios Tested |
|---|---|---|
| `Stage3CashFlowTest.kt` | Exact Long cents math & cash flow planning | - Cash-flow formula: `Available = Expected Income - Recurring - Planned Variable`.<br>- Internal transfer net-zero invariant: money transferred between accounts changes individual balances but yields net-zero change to total household wealth.<br>- Reversal mechanics: transaction preservation and offset posting.<br>- Envelope budget alert thresholds (85%) and over-budget detection. |
| `Stage3WellbeingSecurityTest.kt` | Privacy invariants & guardian authorizations | - Medication reminder non-proof invariant: reminders do not constitute verification of ingestion.<br>- Guardian permissions: restricts minor health data from non-guardian members and guests.<br>- Allergy emergency protocols and emergency contact primary sorting. |
| `Stage3RoomMigrationTest.kt` | Database schema migration v2 -> v3 | - Verifies `MIGRATION_2_3` creates all 15 Stage 3 tables and critical query indexes without dropping existing data. |

---

## 6. UI, Accessibility & Performance Gates

- **Accessibility**: All interactive elements must have `contentDescription` and pass Android Accessibility Scanner with 0 critical violations.
- **Frame Rate Target**: 60 FPS smooth rendering during list flings; zero recomposition loops in Compose.
- **Cold Startup Benchmark**: Local Room DB initialization and first meaningful frame under 800ms on mid-tier hardware.
