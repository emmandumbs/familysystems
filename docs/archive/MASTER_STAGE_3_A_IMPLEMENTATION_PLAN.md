# FAMILYOS — MASTER STAGE 3.A TECHNICAL IMPLEMENTATION PLAN
**Stage 3.A: Finance, Personal Growth, Parenting, Couples & Family Wellbeing**

**Document Version:** 1.0.0  
**Status:** AUTHORIZED FOR EXECUTION  
**Authoritative Roadmap:** FamilyOS Master Development Journey — Stage 3  
**Workspace Tracking Identifier:** `8f842ec0-cec0-443c-b279-e4955acacfaf`  
**Prerequisites:** Master Stage 0, Stage 1, Stage 2 (100% Closed & Verified, 146/146 Automated Gates Passed)

---

## 1. Executive Mission & Architectural Boundaries

Master Stage 3 transforms FamilyOS from a task/household coordination tool into an authoritative life operating system supporting the holistic prosperity, spiritual grounding, character development, emotional health, and physical safety of the family.

### Non-Negotiable Architecture Rules
1. **Integer-Cents Accounting:** Floating-point numbers are strictly forbidden for all currency values (`Long` integer cents only).
2. **Double-Entry & Immutable Audit Reversals:** Transactions cannot be silently edited or deleted. Corrective adjustments must record an explicit reversal transaction referencing `reverses_transaction_id`.
3. **Zero-Trust Workspace Isolation:** Every query and mutation across all 6 sub-milestones must enforce active family membership with HTTP 403 `WORKSPACE_ISOLATION_VIOLATION` on non-member access.
4. **COPPA & Role-Based Privacy Enclaves:**
   - **Couple Private Zone (`CPL-01`):** Accessible exclusively by spousal partners (`ROLE_PARENT` / `ROLE_OWNER`). Child accounts and guest members receive 403 Forbidden.
   - **Guardian-Only Health Zone (`HLT-01`):** Sensitive medical history, insurance numbers, and clinical notes are restricted to guardians.
   - **Spiritual Reflections (`SPR-01`):** Supports `PRIVATE` (author only) vs `FAMILY_SHARED` visibility flags.
5. **Encrypted Offline-First Durability:** Android SQLCipher Room persistence with offline mutation queuing (`sync_queue`) and conflict resolution.

---

## 2. Master Stage 3.A Sub-Milestones Overview

```
                               MASTER STAGE 3.A
                                      │
  ┌───────────────┬───────────────────┼───────────────────┬─────────────────┐
  │               │                   │                   │                 │
3.A.1           3.A.2               3.A.3               3.A.4             3.A.5 & 3.A.6
Finance &       Spiritual Growth    Personal Habits     Parenting &       Couples Zone,
Investments     & Traditions        & Life Skills       Child Growth      Health & Safety
(FIN-01..08)    (SPR-01)            (DEV-01)            (PAR-01)          (CPL-01, HLT-01, SAF-01)
```

---

## 3. Sub-Milestone 3.A.1 — Finance & Financial Intelligence (`FIN-01` to `FIN-08`, `INV-01`)

### 3.1 Capabilities & Functional Scope
- **Multi-Account Ledger:** Checking, Savings, Credit Card, Investment, Cash, and Loans with signed integer cents balance (`current_balance_cents`).
- **Transaction Engine with Audit Reversal:** Atomic income, expense, and internal transfers. Idempotent reversals with linked transaction tracking.
- **Envelope Budgeting:** Monthly spending targets per category with real-time remaining balance calculations.
- **Savings Goals & Milestones:** Target savings goals with automated percentage contributions and target completion dates.
- **Recurring Bills & Subscription Watchdog:** Due date tracking, billing cycle frequencies, autopay statuses, and upcoming liability forecasts.
- **Investment Portfolio Cost-Basis Tracker (`INV-01`):** Asset holdings (equities, index funds, retirement accounts), purchase quantity, average cost basis in integer cents, current market price, and unrealized gain/loss calculations.

### 3.2 Data Models & Room Schema
Builds on existing Room entities in `Stage3Entities.kt` (`financial_accounts`, `financial_transactions`, `recurring_transactions`, `envelope_budgets`, `savings_goals`, `bills_subscriptions`) and adds Table #45 (`investment_holdings`):

```sql
CREATE TABLE IF NOT EXISTS investment_holdings (
    id TEXT NOT NULL PRIMARY KEY,
    family_id TEXT NOT NULL,
    account_id TEXT NOT NULL,
    symbol TEXT NOT NULL,
    asset_name TEXT NOT NULL,
    asset_type TEXT NOT NULL, -- 'STOCK', 'ETF', 'CRYPTO', 'MUTUAL_FUND', 'BOND', 'REAL_ESTATE'
    quantity_millishares INTEGER NOT NULL, -- 1.000 shares = 1000 millishares (avoids floating point)
    cost_basis_cents INTEGER NOT NULL,
    current_price_cents INTEGER NOT NULL,
    last_updated_at INTEGER NOT NULL,
    notes TEXT,
    created_at INTEGER NOT NULL,
    FOREIGN KEY(family_id) REFERENCES family_workspaces(id) ON DELETE CASCADE,
    FOREIGN KEY(account_id) REFERENCES financial_accounts(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS index_investments_family_id ON investment_holdings(family_id);
CREATE INDEX IF NOT EXISTS index_investments_account_id ON investment_holdings(account_id);
```

### 3.3 Backend API Endpoints
- `GET /api/v1/finance/:familyId/summary`: Net worth, total assets, total liabilities, monthly burn rate.
- `GET /api/v1/finance/:familyId/accounts`: List accounts with current balances.
- `POST /api/v1/finance/:familyId/accounts`: Create financial account.
- `GET /api/v1/finance/:familyId/transactions`: Paginated transaction history with filter by account/category.
- `POST /api/v1/finance/:familyId/transactions`: Create transaction with atomic account balance update.
- `POST /api/v1/finance/:familyId/transactions/:id/reverse`: Audit reversal creating offsetting transaction.
- `GET /api/v1/finance/:familyId/budgets`: Envelope budget list with monthly allocated vs spent.
- `POST /api/v1/finance/:familyId/budgets`: Allocate or modify envelope budget.
- `GET /api/v1/finance/:familyId/savings`: Savings goals with progress percentage.
- `POST /api/v1/finance/:familyId/savings`: Create/contribute to savings goal.
- `GET /api/v1/finance/:familyId/bills`: Upcoming bills and subscriptions with autopay indicator.
- `GET & POST /api/v1/finance/:familyId/investments`: Manage holdings, record cost basis, compute unrealized gains.

---

## 4. Sub-Milestone 3.A.2 — Spiritual Growth & Family Traditions (`SPR-01`)

### 4.1 Capabilities & Functional Scope
- **Spiritual Reflections Journal:** Private journal entries (author only) vs shared family reflections (visible to household members).
- **Prayer & Reading Plans:** Multi-day scripture/inspirational reading schedules, daily passages, check-off completions.
- **Family Traditions Agenda:** Annual cultural and sacred traditions, holiday rituals, memory logs, and historical heritage notes.

### 4.2 Data Models & Room Schema (Tables #46 & #47)
```sql
CREATE TABLE IF NOT EXISTS spiritual_reflections (
    id TEXT NOT NULL PRIMARY KEY,
    family_id TEXT NOT NULL,
    author_member_id TEXT NOT NULL,
    title TEXT NOT NULL,
    passage_reference TEXT,
    content TEXT NOT NULL,
    is_private INTEGER NOT NULL DEFAULT 1, -- 1 = private to author, 0 = shared with family
    gratitude_items_json TEXT NOT NULL DEFAULT '[]',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY(family_id) REFERENCES family_workspaces(id) ON DELETE CASCADE,
    FOREIGN KEY(author_member_id) REFERENCES family_members(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS index_reflections_family_id ON spiritual_reflections(family_id);
CREATE INDEX IF NOT EXISTS index_reflections_author ON spiritual_reflections(author_member_id);

CREATE TABLE IF NOT EXISTS spiritual_plans (
    id TEXT NOT NULL PRIMARY KEY,
    family_id TEXT NOT NULL,
    title TEXT NOT NULL,
    plan_type TEXT NOT NULL, -- 'READING', 'PRAYER', 'MEDITATION', 'TRADITION'
    total_days INTEGER NOT NULL,
    current_day INTEGER NOT NULL DEFAULT 1,
    assigned_member_ids_json TEXT NOT NULL DEFAULT '[]',
    recurrence_annual_date TEXT, -- e.g. "12-25" for Christmas traditions
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL,
    FOREIGN KEY(family_id) REFERENCES family_workspaces(id) ON DELETE CASCADE
);
```

### 4.3 Backend API Endpoints
- `GET /api/v1/growth/:familyId/reflections`: Returns member's own reflections plus any reflections with `is_private = 0`.
- `POST /api/v1/growth/:familyId/reflections`: Create reflection with privacy flag.
- `GET /api/v1/growth/:familyId/plans`: List active spiritual & reading plans.
- `POST /api/v1/growth/:familyId/plans/:id/advance`: Mark today's passage complete and advance current day.

---

## 5. Sub-Milestone 3.A.3 — Personal Development & Habits (`DEV-01`)

### 5.1 Capabilities & Functional Scope
- **Habit Tracker & Streak Mechanics:** Daily/weekly habits with streak counter, best streak, and streak freeze tokens.
- **Habit Log:** Check-in history recording time, optional note, and streak milestone celebration.
- **Life Skills Inventory & Mastery Milestones:** Structured progression matrix for children and adults (e.g., Financial Literacy, Cooking Essentials, Emergency First Aid, Home Maintenance). Level-based mastery (Novice, Apprentice, Practitioner, Master).

### 5.2 Data Models & Room Schema (Tables #48 & #49)
```sql
CREATE TABLE IF NOT EXISTS personal_habits (
    id TEXT NOT NULL PRIMARY KEY,
    family_id TEXT NOT NULL,
    member_id TEXT NOT NULL,
    title TEXT NOT NULL,
    category TEXT NOT NULL, -- 'HEALTH', 'MINDSET', 'FAMILY', 'LEARNING', 'PRODUCTIVITY'
    frequency TEXT NOT NULL, -- 'DAILY', 'WEEKDAYS', 'WEEKLY'
    target_days_per_week INTEGER NOT NULL DEFAULT 7,
    current_streak INTEGER NOT NULL DEFAULT 0,
    longest_streak INTEGER NOT NULL DEFAULT 0,
    freeze_days_remaining INTEGER NOT NULL DEFAULT 2,
    last_completed_date TEXT, -- 'YYYY-MM-DD'
    is_archived INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    FOREIGN KEY(family_id) REFERENCES family_workspaces(id) ON DELETE CASCADE,
    FOREIGN KEY(member_id) REFERENCES family_members(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS index_habits_family_member ON personal_habits(family_id, member_id);

CREATE TABLE IF NOT EXISTS life_skills (
    id TEXT NOT NULL PRIMARY KEY,
    family_id TEXT NOT NULL,
    member_id TEXT NOT NULL,
    skill_name TEXT NOT NULL,
    category TEXT NOT NULL, -- 'FINANCIAL', 'CULINARY', 'SAFETY', 'PRACTICAL', 'DIGITAL'
    mastery_level TEXT NOT NULL, -- 'NOVICE', 'APPRENTICE', 'PRACTITIONER', 'MASTER'
    completed_milestones_json TEXT NOT NULL DEFAULT '[]',
    mentor_member_id TEXT,
    verified_by_parent INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY(family_id) REFERENCES family_workspaces(id) ON DELETE CASCADE,
    FOREIGN KEY(member_id) REFERENCES family_members(id) ON DELETE CASCADE
);
```

### 5.3 Backend API Endpoints
- `GET /api/v1/growth/:familyId/habits`: Habits filtered by member with current streak status.
- `POST /api/v1/growth/:familyId/habits`: Create new personal habit.
- `POST /api/v1/growth/:familyId/habits/:id/checkin`: Daily completion checkin; idempotently increments streak, records `last_completed_date`.
- `GET /api/v1/growth/:familyId/skills`: Member life skills inventory.
- `POST /api/v1/growth/:familyId/skills/:id/progress`: Record milestone completion and update mastery tier.

---

## 6. Sub-Milestone 3.A.4 — Parenting & Child Development (`PAR-01`)

### 6.1 Capabilities & Functional Scope
- **Child Developmental Milestones:** Timeline of developmental stages (physical growth, speech, social, motor skills).
- **School & Academic Hub:** School profiles, grade level, academic calendars, subject tracking, teacher contact cards, and daily homework routines.
- **COPPA & Child Privacy Isolation:** Explicit enforcement preventing child user accounts from viewing parent financial ledgers, couple private zones, or adult medical files.

### 6.2 Data Models & Room Schema (Tables #50 & #51)
```sql
CREATE TABLE IF NOT EXISTS child_milestones (
    id TEXT NOT NULL PRIMARY KEY,
    family_id TEXT NOT NULL,
    child_member_id TEXT NOT NULL,
    title TEXT NOT NULL,
    category TEXT NOT NULL, -- 'MOTOR', 'SPEECH', 'COGNITIVE', 'EMOTIONAL', 'ACADEMIC'
    age_months INTEGER NOT NULL,
    milestone_date INTEGER NOT NULL,
    notes TEXT,
    photo_uri TEXT,
    created_at INTEGER NOT NULL,
    FOREIGN KEY(family_id) REFERENCES family_workspaces(id) ON DELETE CASCADE,
    FOREIGN KEY(child_member_id) REFERENCES family_members(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS index_milestones_child ON child_milestones(child_member_id);

CREATE TABLE IF NOT EXISTS school_profiles (
    id TEXT NOT NULL PRIMARY KEY,
    family_id TEXT NOT NULL,
    child_member_id TEXT NOT NULL,
    school_name TEXT NOT NULL,
    grade_level TEXT NOT NULL,
    teacher_name TEXT,
    teacher_email TEXT,
    daily_schedule_notes TEXT,
    academic_year TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY(family_id) REFERENCES family_workspaces(id) ON DELETE CASCADE,
    FOREIGN KEY(child_member_id) REFERENCES family_members(id) ON DELETE CASCADE
);
```

### 6.3 Backend API Endpoints
- `GET & POST /api/v1/parenting/:familyId/milestones`: Milestone logging with child ID filter.
- `GET & PUT /api/v1/parenting/:familyId/school/:childId`: School profile and academic agenda.
- `GET /api/v1/parenting/:familyId/coppa-check`: Verifies requesting actor's role against sensitive child data access rules.

---

## 7. Sub-Milestone 3.A.5 — Couples Preparation & Relationship Wellbeing (`CPL-01`)

### 7.1 Capabilities & Functional Scope
- **Couple Private Enclave:** Hard isolation. Only parents/spouses (`ROLE_OWNER`, `ROLE_ADMIN`, `ROLE_PARENT`) can read or write.
- **Alignment Check-Ins:** Pre-child and continuing spousal alignment questionnaires (parenting philosophy, financial values, household labour balance, emotional intimacy).
- **Date Night & Ritual Planner:** Scheduled intentional couple time, shared bucket lists, conversation card prompts.

### 7.2 Data Models & Room Schema (Tables #52 & #53)
```sql
CREATE TABLE IF NOT EXISTS couple_alignments (
    id TEXT NOT NULL PRIMARY KEY,
    family_id TEXT NOT NULL,
    topic TEXT NOT NULL, -- 'FINANCES', 'PARENTING_STYLE', 'HOUSEHOLD_LABOR', 'BOUNDARIES', 'VISION'
    partner1_response TEXT,
    partner2_response TEXT,
    alignment_score INTEGER, -- 1-100
    action_items_json TEXT NOT NULL DEFAULT '[]',
    updated_at INTEGER NOT NULL,
    FOREIGN KEY(family_id) REFERENCES family_workspaces(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS index_alignments_family_id ON couple_alignments(family_id);

CREATE TABLE IF NOT EXISTS couple_checkins (
    id TEXT NOT NULL PRIMARY KEY,
    family_id TEXT NOT NULL,
    checkin_date INTEGER NOT NULL,
    partner1_mood INTEGER, -- 1-5 scale
    partner2_mood INTEGER,
    appreciation_note_partner1 TEXT,
    appreciation_note_partner2 TEXT,
    next_date_night_date INTEGER,
    next_date_night_idea TEXT,
    created_at INTEGER NOT NULL,
    FOREIGN KEY(family_id) REFERENCES family_workspaces(id) ON DELETE CASCADE
);
```

### 7.3 Backend API Endpoints
- `GET /api/v1/couples/:familyId/dashboard`: Returns alignment metrics and check-in history. Blocks child accounts with HTTP 403 `COUPLES_ENCLAVE_ACCESS_DENIED`.
- `POST /api/v1/couples/:familyId/checkins`: Record weekly couple check-in and date night plan.
- `PUT /api/v1/couples/:familyId/alignments/:topic`: Submit alignment answers and update agreement scores.

---

## 8. Sub-Milestone 3.A.6 — Health & Emergency Safety (`HLT-01`, `SAF-01`)

### 8.1 Capabilities & Functional Scope
- **Family Medical Profiles (`HLT-01`):** Blood types, medical conditions, insurance details, primary care physician contacts.
- **Medication Tracker & Refill Alerts:** Scheduled medications, dosages, frequency, and active compliance logs.
- **Allergies & Critical Directives:** Allergen, severity level (`SEVERE_ANAPHYLACTIC`), and emergency action plans (e.g., EpiPen).
- **Vaccination Records & Well-Child Checks:** Immunization history and upcoming booster alerts.
- **Emergency Preparedness (`SAF-01`):** Emergency contacts directory (primary doctor, poison control, out-of-town contact), household evacuation meeting points, utility shut-off instructions (gas, water, electrical).
- **Emergency Supply Inventory:** Survival supplies, flashlight/battery readiness, water/food reserves, and expiration date alerts.
- **Readiness Drills Checklist:** Fire escape, earthquake, and severe storm drill records.

### 8.2 Data Models & Room Schema
Leverages existing Room tables #26-34 in `Stage3Entities.kt`:
- `wellbeing_profiles`, `health_allergies`, `health_medications`, `health_vaccinations`, `healthcare_appointments`
- `emergency_contacts`, `emergency_plans`, `emergency_supplies`, `emergency_checklist_items`

### 8.3 Backend API Endpoints
- `GET /api/v1/wellbeing/:familyId/profiles`: Full family medical profiles (guardian role enforced for sensitive records).
- `GET & POST /api/v1/wellbeing/:familyId/medications`: Active medication schedules.
- `POST /api/v1/wellbeing/:familyId/medications/:id/log`: Log medication dose adherence.
- `GET & POST /api/v1/wellbeing/:familyId/allergies`: Allergens and emergency response steps.
- `GET /api/v1/emergency/:familyId/readiness`: Combined emergency plan, supplies, contacts, and checklist status.
- `PUT /api/v1/emergency/:familyId/plan`: Update utility shutoffs and meeting points.
- `POST /api/v1/emergency/:familyId/supplies`: Register emergency supply with expiration tracking.
- `POST /api/v1/emergency/:familyId/checklists/:id/complete`: Complete emergency drill item.

---

## 9. Cross-Platform Integration Architecture

### 9.1 Android Kotlin Architecture
- **Room SQLite Migration 5 -> 6 (`MIGRATION_5_6`):** Creates tables #45-53 without modifying or dropping any of tables #1-44.
- **DAOs & Repositories:**
  - `FinanceRepository` (Accounts, Transactions, Budgets, Savings, Investments)
  - `GrowthRepository` (Spiritual reflections, Habits, Life Skills)
  - `ParentingRepository` (Milestones, School profiles, Child guardrails)
  - `CouplesRepository` (Alignments, Check-ins, Date nights)
  - `WellbeingRepository` (Medical profiles, Medications, Allergies)
  - `EmergencyRepository` (Contacts, Plans, Supplies, Drills)
- **ViewModels:** Expose immutable `StateFlow<T>` backed by encrypted Room tables.
- **Jetpack Compose Screens:**
  - `FinanceDashboardScreen.kt`: Net worth card, account list, envelope budget bars, transaction feed.
  - `GrowthTraditionsScreen.kt`: Reflection cards with privacy badges, prayer plans, habits streak grid.
  - `ParentingSchoolScreen.kt`: Child milestone cards, school routines, grade summary.
  - `CouplesEnclaveScreen.kt`: Private passcode/biometric locked spousal alignment cards.
  - `WellbeingEmergencyScreen.kt`: Medical cards, active medication badges, emergency quick-dial and supply kit status.

### 9.2 React + TypeScript Web Architecture
- **Stage 3 Master Dashboard (`Stage3Experience.tsx`):**
  - Tab 1: **Finance & Investments** (Net worth, 64-bit integer cent ledger, envelope progress bars, savings goals, investment table).
  - Tab 2: **Spiritual & Traditions** (Reflection journals, prayer plans, sacred calendar).
  - Tab 3: **Habits & Skills** (Streak tracker, habit check-in buttons, life skill mastery matrix).
  - Tab 4: **Parenting & Child Hub** (Developmental milestones, school agendas).
  - Tab 5: **Couples Enclave** (Password/role guarded spousal alignment, date night planner).
  - Tab 6: **Health & Emergency** (Medical profiles, medication schedule, emergency plan, supply readiness).

---

## 10. Automated Verification & Quality Gates (30 Gates)

| Gate Range | Scope | Verification Criteria |
| :--- | :--- | :--- |
| **G01 - G06** | Finance Engine | Signed integer cents arithmetic; zero float drift; transfer balance integrity; audit reversal correctness; investment cost-basis math. |
| **G07 - G10** | Spiritual & Traditions | Author-only privacy enforcement on private reflections; family reflection sharing; reading plan progress advancement. |
| **G11 - G14** | Habits & Skills | Daily check-in streak increment; freeze day consumption; skill mastery progression. |
| **G15 - G18** | Parenting & COPPA | Child milestone logging; academic routine sync; child account block on financial/couples routes. |
| **G19 - G22** | Couples Private Zone | Spousal-only RBAC access; non-spouse 403 enforcement; alignment scoring; date night scheduling. |
| **G23 - G26** | Health & Medications | Medical profile guardian isolation; medication adherence logs; allergy severity indicators. |
| **G27 - G30** | Emergency & Room Migration | Disaster supply expiry alerts; drill completion tracking; SQLite `MIGRATION_5_6` non-destructive execution. |

---

## 11. Phased Execution Roadmap

- **Phase 1: Database Migration & Entities (Room v5 -> v6):** Define new tables #45-53, write `MIGRATION_5_6`, verify non-destructive upgrade.
- **Phase 2: Express Server Routes & Zero-Trust RBAC:** Implement `/api/v1/finance`, `/api/v1/growth`, `/api/v1/parenting`, `/api/v1/couples`, `/api/v1/wellbeing`, and `/api/v1/emergency` with membership and role validation.
- **Phase 3: React Web Experience:** Implement `Stage3Experience.tsx` with all 6 comprehensive interactive domains and link to main navigation.
- **Phase 4: Android Room Repositories & Compose Screens:** Implement Kotlin DAOs, Repositories, ViewModels, and Compose UI screens.
- **Phase 5: Automated Test Suite & Multi-Platform Verification:** Execute all 30 verification gates and publish the Stage 3.A Completion Report.
