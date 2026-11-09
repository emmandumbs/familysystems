# FAMILYOS — DATABASE SCHEMA ARCHITECTURE
**Version**: 6.1.0 (Master Stage 5 Hardening & Parity — 58 Android Room Entities + Durable Backend Store v3.4.1)  
**Database Engine**: Room (SQLite 3.39+ with FTS4 and SQLCipher AES-256) & Atomic Cross-Process Backend Store (`data/familyos-shared-store.json`)  
**ORM / Data Types**: Pure Kotlin Data Entities / Signed 64-Bit `BigInt` + `*Decimal` Strings, Zero Floating-Point for Currency  
**Active Schema Version**: Room Database `version = 10` with `MIGRATION_1_2` through `MIGRATION_9_10`  

---

## 1. Core Architectural Schema Principles

1. **Monetary Values**: Stored exclusively as `Long` / 64-bit `BigInt` integer cents (`*Cents` and `*CentsDecimal`). Storing or computing currency with `Float`, `Double`, `parseFloat`, or `Math.round` is prohibited.
2. **Offline-Sync Metadata**: Every table that syncs to the cloud implements the `SyncableEntity` contract:
   - `id: String` (UUID v4)
   - `familyId: String` (Foreign key to active family workspace)
   - `version: Long` (Monotonically incrementing revision counter)
   - `syncStatus: String` (`LOCAL_ONLY`, `PENDING_SYNC`, `SYNCED`, `SYNC_FAILED`)
   - `syncErrorMessage: String?`
   - `isDeleted: Boolean` (Soft-delete tombstone)
   - `deletedAt: Long?` (Epoch milliseconds timestamp)
   - `updatedAt: Long` (Epoch milliseconds timestamp)
   - `createdAt: Long` (Epoch milliseconds timestamp)
3. **Indexing Strategy**: Every foreign key (`familyId`, `memberId`, `goalId`, `projectId`, `taskId`) is explicitly indexed in Room via `@Index` to prevent full table scans.

---

## 2. Core Shared Entities (Foundational Platform)

### 2.1 `user_profiles`
```sql
CREATE TABLE user_profiles (
    id TEXT PRIMARY KEY NOT NULL, -- Internal UUID
    authentication_provider TEXT NOT NULL, -- 'FIREBASE_GOOGLE', 'FIREBASE_EMAIL'
    provider_user_id TEXT NOT NULL, -- Stable Auth UID from Identity Provider
    email TEXT NOT NULL,
    display_name TEXT,
    profile_picture_uri TEXT,
    preferred_language TEXT NOT NULL DEFAULT 'en',
    account_status TEXT NOT NULL DEFAULT 'ACTIVE',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX idx_user_profiles_provider_uid ON user_profiles(provider_user_id);
CREATE INDEX idx_user_profiles_email ON user_profiles(email);
-- CRITICAL: Zero passwords, password hashes, or authentication secrets stored.
```

### 2.2 `family_workspaces`
```sql
CREATE TABLE family_workspaces (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    logo_url TEXT,
    currency_code TEXT NOT NULL DEFAULT 'USD',
    owner_user_id TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    sync_status TEXT NOT NULL DEFAULT 'LOCAL_ONLY',
    is_deleted INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX idx_family_workspaces_owner ON family_workspaces(owner_user_id);
```

### 2.3 `family_memberships`
```sql
CREATE TABLE family_memberships (
    id TEXT PRIMARY KEY NOT NULL,
    family_id TEXT NOT NULL,
    user_account_id TEXT NOT NULL,
    member_profile_id TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'MEMBER', -- 'OWNER', 'ADMIN', 'MEMBER', 'CHILD', 'GUEST'
    status TEXT NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE', 'INVITED', 'REVOKED'
    joined_at INTEGER NOT NULL,
    FOREIGN KEY(family_id) REFERENCES family_workspaces(id) ON DELETE CASCADE,
    FOREIGN KEY(user_account_id) REFERENCES user_profiles(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX index_family_memberships_family_id_user_account_id ON family_memberships(family_id, user_account_id);
CREATE INDEX index_family_memberships_user_account_id_status ON family_memberships(user_account_id, status);
-- Note: Single-active-membership uniqueness per user_account_id is enforced in SQLite/Room via
-- BEFORE INSERT and BEFORE UPDATE triggers (`trg_family_memberships_one_active_insert` and
-- `trg_family_memberships_one_active_update`, see Section 10.1 & MIGRATION_6_7) so Room's
-- runtime TableInfo schema validator succeeds while preserving historical REVOKED/LEFT rows.
```

### 2.4 `family_members`
```sql
CREATE TABLE family_members (
    id TEXT PRIMARY KEY NOT NULL,
    family_id TEXT NOT NULL,
    display_name TEXT NOT NULL,
    relationship_to_primary TEXT NOT NULL, -- e.g. 'SELF', 'SPOUSE', 'CHILD', 'PARENT'
    birth_date INTEGER,
    avatar_url TEXT,
    dietary_preferences_json TEXT NOT NULL DEFAULT '[]',
    allergies_json TEXT NOT NULL DEFAULT '[]',
    is_restricted_profile INTEGER NOT NULL DEFAULT 0,
    points_balance INTEGER NOT NULL DEFAULT 0,
    version INTEGER NOT NULL DEFAULT 1,
    sync_status TEXT NOT NULL DEFAULT 'LOCAL_ONLY',
    is_deleted INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY(family_id) REFERENCES family_workspaces(id) ON DELETE CASCADE
);
CREATE INDEX idx_family_members_family ON family_members(family_id);
-- Decoupled from user account. Minor children have profiles without login accounts.
```

### 2.5 `guardian_relationships`
```sql
CREATE TABLE guardian_relationships (
    id TEXT PRIMARY KEY NOT NULL,
    family_id TEXT NOT NULL,
    guardian_member_id TEXT NOT NULL,
    minor_member_id TEXT NOT NULL,
    relationship_type TEXT NOT NULL DEFAULT 'PARENT', -- 'PARENT', 'LEGAL_GUARDIAN'
    is_emergency_contact INTEGER NOT NULL DEFAULT 1,
    can_manage_health_records INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL,
    FOREIGN KEY(family_id) REFERENCES family_workspaces(id) ON DELETE CASCADE,
    FOREIGN KEY(guardian_member_id) REFERENCES family_members(id) ON DELETE CASCADE,
    FOREIGN KEY(minor_member_id) REFERENCES family_members(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX idx_guardian_rel_unique ON guardian_relationships(family_id, guardian_member_id, minor_member_id);
```

### 2.6 `sync_queue`
```sql
CREATE TABLE sync_queue (
    queue_id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    operation_id TEXT NOT NULL,
    idempotency_key TEXT NOT NULL,
    family_id TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    operation_type TEXT NOT NULL, -- 'INSERT', 'UPDATE', 'DELETE'
    payload_json TEXT NOT NULL,
    attempt_count INTEGER NOT NULL DEFAULT 0,
    last_attempt_at INTEGER,
    retry_state TEXT NOT NULL DEFAULT 'PENDING',
    last_error TEXT,
    created_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX idx_sync_queue_idempotency ON sync_queue(idempotency_key);
CREATE INDEX idx_sync_queue_lookup ON sync_queue(entity_type, entity_id);
```

### 2.7 `audit_events`
```sql
CREATE TABLE audit_events (
    id TEXT PRIMARY KEY NOT NULL,
    family_id TEXT NOT NULL,
    actor_user_id TEXT NOT NULL,
    action_type TEXT NOT NULL, -- e.g. 'MEMBER_ROLE_CHANGED', 'EXPENSE_REVERSED'
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    summary TEXT NOT NULL,
    metadata_json TEXT,
    created_at INTEGER NOT NULL,
    FOREIGN KEY(family_id) REFERENCES family_workspaces(id) ON DELETE CASCADE
);
CREATE INDEX idx_audit_events_family ON audit_events(family_id, created_at);
```

---

## 3. Productivity Engine Entities (Hierarchy: Goal -> Project -> Task -> Checklist)

### 3.1 `family_goals`
```sql
CREATE TABLE IF NOT EXISTS family_goals (
    id TEXT NOT NULL PRIMARY KEY,
    family_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL, -- 'FINANCIAL', 'HOUSEHOLD', 'EDUCATION', 'HEALTH', 'SPIRITUAL'
    target_date INTEGER,
    priority TEXT NOT NULL,
    owner_member_id TEXT,
    status TEXT NOT NULL, -- 'NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'ON_HOLD'
    is_archived INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY(family_id) REFERENCES family_workspaces(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS index_family_goals_family_id ON family_goals(family_id);
```

### 3.2 `projects`
```sql
CREATE TABLE IF NOT EXISTS projects (
    id TEXT NOT NULL PRIMARY KEY,
    family_id TEXT NOT NULL,
    goal_id TEXT, -- Optional linkage to a parent Goal
    name TEXT NOT NULL,
    description TEXT,
    budget_cents INTEGER NOT NULL, -- Monetary Long integer cents
    target_date INTEGER,
    status TEXT NOT NULL,
    lead_member_id TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY(family_id) REFERENCES family_workspaces(id) ON DELETE CASCADE,
    FOREIGN KEY(goal_id) REFERENCES family_goals(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS index_projects_family_id ON projects(family_id);
CREATE INDEX IF NOT EXISTS index_projects_goal_id ON projects(goal_id);
```

### 3.3 `tasks`
```sql
CREATE TABLE IF NOT EXISTS tasks (
    id TEXT NOT NULL PRIMARY KEY,
    family_id TEXT NOT NULL,
    project_id TEXT, -- Optional linkage to a Project
    parent_task_id TEXT, -- Optional linkage to a parent Task
    title TEXT NOT NULL,
    notes TEXT,
    assigned_member_id TEXT,
    priority TEXT NOT NULL, -- 'LOW', 'MEDIUM', 'HIGH', 'URGENT'
    due_date INTEGER,
    is_completed INTEGER NOT NULL,
    completed_at INTEGER,
    completed_by_member_id TEXT,
    recurrence_rule TEXT, -- iCalendar RFC 5545 RRULE string or null
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY(family_id) REFERENCES family_workspaces(id) ON DELETE CASCADE,
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE SET NULL,
    FOREIGN KEY(parent_task_id) REFERENCES tasks(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS index_tasks_family_id ON tasks(family_id);
CREATE INDEX IF NOT EXISTS index_tasks_project_id ON tasks(project_id);
CREATE INDEX IF NOT EXISTS index_tasks_parent_task_id ON tasks(parent_task_id);
CREATE INDEX IF NOT EXISTS index_tasks_assigned_member_id ON tasks(assigned_member_id);
```

### 3.4 `task_checklist_items`
```sql
CREATE TABLE IF NOT EXISTS task_checklist_items (
    id TEXT NOT NULL PRIMARY KEY,
    task_id TEXT NOT NULL,
    title TEXT NOT NULL,
    is_done INTEGER NOT NULL,
    position INTEGER NOT NULL,
    FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS index_task_checklist_items_task_id ON task_checklist_items(task_id);
```

### 3.5 Stage 3.3.2 Unified 7-Tier Planning Extensions (Authoritative Firestore & Room Sync)
- **7-Tier Hierarchy**: `family_workspaces (mission, vision, values)` → `family_goals (scope: PERSONAL | COUPLE | FAMILY, horizon: SHORT_TERM | LONG_TERM, isMeasurable, metricUnit, targetValue, currentValue, reviews)` → `projects (goalId, dependencies, comments, attachments)` → `milestones (projectId, goalId, orderIndex, status, progressPercentage)` → `productivity_tasks (goalId, projectId, milestoneId, parentTaskId, sourceModule, scope, timezone, recurrenceRule, linkedCalendarEventId, rewardPoints)` → `task_checklist_items (taskId, position, isDone, assignedMemberId)` + `checklist_templates` + `rewardConfigs (enabled: false by default, disallowPunitiveDeductions: true)`.
- **Canonical Universal Task Reuse**: All 7 FamilyOS modules (`GOALS_PROJECTS`, `HOME_MANAGEMENT`, `MARRIAGE`, `PARENTING`, `SPIRITUAL_GROWTH`, `FAMILY_GOVERNANCE`, `PERSONAL_PLANNING`) store tasks in the single canonical `productivity_tasks` / `planningTasks` collection without duplicate module-specific task tables.

### 3.6 Stage 3.3.3 Shared Calendar & Reusable Routines Engine
```sql
CREATE TABLE IF NOT EXISTS calendar_events (
    id TEXT NOT NULL PRIMARY KEY, -- UUID or 'cal-task-{taskId}'
    family_id TEXT NOT NULL,
    title TEXT NOT NULL,
    event_date INTEGER NOT NULL, -- Epoch milliseconds date
    event_time_millis INTEGER, -- Nullable for all-day events
    category TEXT NOT NULL, -- 'BIRTHDAY', 'ANNIVERSARY', 'GOAL_DUE', 'TASK_DUE', 'MEAL', 'CHORE', 'MAINTENANCE', 'FAMILY_EVENT', 'APPOINTMENT', 'ROUTINE', 'SPECIAL_OCCASION'
    source_entity_id TEXT, -- Linked task ID, milestone ID, chore ID, etc.
    description TEXT,
    created_at INTEGER NOT NULL,
    FOREIGN KEY(family_id) REFERENCES family_workspaces(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS index_calendar_events_family_id_event_date ON calendar_events(family_id, event_date);
CREATE INDEX IF NOT EXISTS index_calendar_events_category ON calendar_events(category);
```
- **Authoritative Routine Definitions (`store.routines`)**: Stores frequency (`DAILY`, `WEEKDAYS`, `WEEKENDS`, `WEEKLY`, `BIWEEKLY`, `MONTHLY`, `CUSTOM`), target time of day, points reward, ordered checklist steps JSON (`steps_json`), pause status (`is_paused`), and streak metrics (`streak_count`, `best_streak_count`, `last_completed_date`).
- **Decoupled Routine Occurrences (`store.routineOccurrences`)**: Distinct execution instance model decoupled from routine definition. Stores `target_date` (YYYY-MM-DD), status (`PENDING`, `IN_PROGRESS`, `COMPLETED`, `SKIPPED`), checklist step completion JSON (`step_completions_json`), points awarded, and `linked_task_id`.
- **Decoupling Invariant**: Occurrence completion or checklist check-off **NEVER mutates, marks complete, or deletes the parent Routine definition**.
- **Anchor-Day Preservation**: Month-end anchor days (29th-31st) clamp to the last valid day of shorter months (e.g., Feb 28 or 29) with `isClamped: true` and automatically restore in longer months (e.g., March 31st).

---

## 4. Household Management Module Entities

### 4.1 `recipes`, `recipe_ingredients` & `recipe_instructions`
```sql
CREATE TABLE IF NOT EXISTS recipes (
    id TEXT NOT NULL PRIMARY KEY,
    family_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    image_uri TEXT,
    prep_time_minutes INTEGER NOT NULL,
    cook_time_minutes INTEGER NOT NULL,
    servings INTEGER NOT NULL,
    difficulty TEXT NOT NULL,
    category TEXT NOT NULL,
    dietary_notes TEXT,
    family_rating INTEGER NOT NULL,
    is_favorite INTEGER NOT NULL,
    source TEXT,
    storage_instructions TEXT,
    is_archived INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY(family_id) REFERENCES family_workspaces(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS index_recipes_family_id ON recipes(family_id);

CREATE TABLE IF NOT EXISTS recipe_ingredients (
    id TEXT NOT NULL PRIMARY KEY,
    recipe_id TEXT NOT NULL,
    item_name TEXT NOT NULL,
    quantity REAL NOT NULL,
    unit TEXT NOT NULL,
    notes TEXT,
    FOREIGN KEY(recipe_id) REFERENCES recipes(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS index_recipe_ingredients_recipe_id ON recipe_ingredients(recipe_id);

CREATE TABLE IF NOT EXISTS recipe_instructions (
    id TEXT NOT NULL PRIMARY KEY,
    recipe_id TEXT NOT NULL,
    step_number INTEGER NOT NULL,
    instruction_text TEXT NOT NULL,
    FOREIGN KEY(recipe_id) REFERENCES recipes(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS index_recipe_instructions_recipe_id ON recipe_instructions(recipe_id);
```

### 4.2 `meal_plan_entries` & `grocery_list_items`
```sql
CREATE TABLE IF NOT EXISTS meal_plan_entries (
    id TEXT NOT NULL PRIMARY KEY,
    family_id TEXT NOT NULL,
    plan_date INTEGER NOT NULL, -- Date epoch at 00:00:00
    meal_type TEXT NOT NULL, -- 'BREAKFAST', 'LUNCH', 'DINNER', 'SNACK'
    recipe_id TEXT,
    custom_meal_title TEXT,
    servings INTEGER NOT NULL,
    notes TEXT,
    FOREIGN KEY(family_id) REFERENCES family_workspaces(id) ON DELETE CASCADE,
    FOREIGN KEY(recipe_id) REFERENCES recipes(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS index_meal_plan_entries_family_id_plan_date ON meal_plan_entries(family_id, plan_date);
CREATE INDEX IF NOT EXISTS index_meal_plan_entries_recipe_id ON meal_plan_entries(recipe_id);

CREATE TABLE IF NOT EXISTS grocery_list_items (
    id TEXT NOT NULL PRIMARY KEY,
    family_id TEXT NOT NULL,
    item_name TEXT NOT NULL,
    category TEXT NOT NULL,
    quantity REAL NOT NULL,
    unit TEXT NOT NULL,
    is_purchased INTEGER NOT NULL,
    source_recipe_id TEXT,
    created_at INTEGER NOT NULL,
    FOREIGN KEY(family_id) REFERENCES family_workspaces(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS index_grocery_list_items_family_id ON grocery_list_items(family_id);
```

### 4.3 `chores` & `chore_completion_history`
*(Note: The early `food_inventory` draft table was superseded by canonical `pantry_items` [Table #42] in Section 8.1 — `MIGRATION_4_5`.)*
```sql
CREATE TABLE IF NOT EXISTS chores (
    id TEXT NOT NULL PRIMARY KEY,
    family_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    assigned_member_id TEXT,
    zone TEXT NOT NULL, -- 'KITCHEN', 'LIVING_ROOM', 'BEDROOMS', 'BATHROOMS', 'OUTDOORS', 'HOME'
    frequency TEXT NOT NULL, -- 'DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY'
    reward_points INTEGER NOT NULL,
    next_due_date INTEGER NOT NULL,
    requires_verification INTEGER NOT NULL,
    is_completed INTEGER NOT NULL,
    is_archived INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY(family_id) REFERENCES family_workspaces(id) ON DELETE CASCADE,
    FOREIGN KEY(assigned_member_id) REFERENCES family_members(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS index_chores_family_id ON chores(family_id);
CREATE INDEX IF NOT EXISTS index_chores_assigned_member_id ON chores(assigned_member_id);

CREATE TABLE IF NOT EXISTS chore_completion_history (
    id TEXT NOT NULL PRIMARY KEY,
    chore_id TEXT NOT NULL,
    completed_by_member_id TEXT NOT NULL,
    completed_at INTEGER NOT NULL,
    points_earned INTEGER NOT NULL,
    FOREIGN KEY(chore_id) REFERENCES chores(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS index_chore_completion_history_chore_id ON chore_completion_history(chore_id);
```

### 4.4 `home_assets`, `asset_maintenance_records` & `household_wishlist`
```sql
CREATE TABLE IF NOT EXISTS home_assets (
    id TEXT NOT NULL PRIMARY KEY,
    family_id TEXT NOT NULL,
    name TEXT NOT NULL,
    category TEXT NOT NULL, -- 'APPLIANCES', 'FURNITURE', 'ELECTRONICS', 'TOOLS', 'HVAC'
    description TEXT,
    purchase_date INTEGER,
    purchase_price_cents INTEGER NOT NULL, -- Long cents
    warranty_expiry_date INTEGER,
    serial_number TEXT,
    location TEXT,
    next_maintenance_date INTEGER,
    is_archived INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY(family_id) REFERENCES family_workspaces(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS index_home_assets_family_id ON home_assets(family_id);

CREATE TABLE IF NOT EXISTS asset_maintenance_records (
    id TEXT NOT NULL PRIMARY KEY,
    asset_id TEXT NOT NULL,
    title TEXT NOT NULL,
    cost_cents INTEGER NOT NULL,
    performed_date INTEGER NOT NULL,
    notes TEXT,
    service_provider TEXT,
    FOREIGN KEY(asset_id) REFERENCES home_assets(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS index_asset_maintenance_records_asset_id ON asset_maintenance_records(asset_id);

CREATE TABLE IF NOT EXISTS household_wishlist (
    id TEXT NOT NULL PRIMARY KEY,
    family_id TEXT NOT NULL,
    item_name TEXT NOT NULL,
    estimated_cost_cents INTEGER NOT NULL,
    priority TEXT NOT NULL,
    category TEXT NOT NULL,
    url TEXT,
    created_at INTEGER NOT NULL,
    FOREIGN KEY(family_id) REFERENCES family_workspaces(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS index_household_wishlist_family_id ON household_wishlist(family_id);
```
*(Note: Canonical `wardrobe_items` and `outfit_plans` definitions are located in Section 8.2 and Section 8.3 — Room v5.)*

---

## 5. Financial Management Engine Entities (Strict Long Integer Cents)

### 5.1 `financial_accounts`
```sql
CREATE TABLE IF NOT EXISTS financial_accounts (
    id TEXT NOT NULL PRIMARY KEY,
    family_id TEXT NOT NULL,
    name TEXT NOT NULL,
    account_type TEXT NOT NULL, -- 'CHECKING', 'SAVINGS', 'CREDIT_CARD', 'INVESTMENT', 'LOAN'
    current_balance_cents INTEGER NOT NULL, -- Signed Long cents
    is_liability INTEGER NOT NULL,
    currency TEXT NOT NULL,
    institution TEXT,
    is_archived INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY(family_id) REFERENCES family_workspaces(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS index_financial_accounts_family_id ON financial_accounts(family_id);
CREATE INDEX IF NOT EXISTS index_financial_accounts_account_type ON financial_accounts(account_type);
```

### 5.2 `financial_transactions` & `recurring_transactions`
*(Note: Supersedes early v1 draft names `income_records` and `expense_records`; matches `MIGRATION_2_3` and `MIGRATION_8_9` in `FamilyOSDatabase.kt`.)*
```sql
CREATE TABLE IF NOT EXISTS financial_transactions (
    id TEXT NOT NULL PRIMARY KEY,
    family_id TEXT NOT NULL,
    account_id TEXT NOT NULL,
    destination_account_id TEXT,
    title TEXT NOT NULL,
    amount_cents INTEGER NOT NULL, -- Positive Long cents
    transaction_type TEXT NOT NULL, -- 'INCOME', 'EXPENSE', 'TRANSFER'
    category TEXT NOT NULL,
    transaction_date INTEGER NOT NULL,
    is_cleared INTEGER NOT NULL,
    is_reversal INTEGER NOT NULL,
    reversal_of_id TEXT,
    notes TEXT,
    paid_by_member_id TEXT,
    idempotency_key TEXT, -- Added in MIGRATION_8_9 for ledger transaction idempotency
    created_at INTEGER NOT NULL,
    FOREIGN KEY(family_id) REFERENCES family_workspaces(id) ON DELETE CASCADE,
    FOREIGN KEY(account_id) REFERENCES financial_accounts(id) ON DELETE RESTRICT,
    FOREIGN KEY(destination_account_id) REFERENCES financial_accounts(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS index_financial_transactions_family_id ON financial_transactions(family_id);
CREATE INDEX IF NOT EXISTS index_financial_transactions_account_id ON financial_transactions(account_id);
CREATE INDEX IF NOT EXISTS index_financial_transactions_destination_account_id ON financial_transactions(destination_account_id);
CREATE INDEX IF NOT EXISTS index_financial_transactions_transaction_date ON financial_transactions(transaction_date);
CREATE INDEX IF NOT EXISTS index_financial_transactions_category ON financial_transactions(category);
CREATE UNIQUE INDEX IF NOT EXISTS index_financial_transactions_idempotency_key ON financial_transactions(idempotency_key);

CREATE TABLE IF NOT EXISTS recurring_transactions (
    id TEXT NOT NULL PRIMARY KEY,
    family_id TEXT NOT NULL,
    account_id TEXT NOT NULL,
    title TEXT NOT NULL,
    amount_cents INTEGER NOT NULL,
    transaction_type TEXT NOT NULL, -- 'INCOME', 'EXPENSE'
    category TEXT NOT NULL,
    recurrence_interval TEXT NOT NULL, -- 'WEEKLY', 'BIWEEKLY', 'MONTHLY', 'YEARLY'
    next_due_date INTEGER NOT NULL,
    is_active INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY(family_id) REFERENCES family_workspaces(id) ON DELETE CASCADE,
    FOREIGN KEY(account_id) REFERENCES financial_accounts(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS index_recurring_transactions_family_id ON recurring_transactions(family_id);
CREATE INDEX IF NOT EXISTS index_recurring_transactions_account_id ON recurring_transactions(account_id);
```

### 5.3 `savings_goals` & `envelope_budgets`
*(Note: `envelope_budgets` supersedes the early `budgets` draft name; `spent_cents` is computed dynamically from `financial_transactions`.)*
```sql
CREATE TABLE IF NOT EXISTS savings_goals (
    id TEXT NOT NULL PRIMARY KEY,
    family_id TEXT NOT NULL,
    linked_account_id TEXT,
    title TEXT NOT NULL,
    target_cents INTEGER NOT NULL, -- Long cents
    current_cents INTEGER NOT NULL, -- Long cents
    planned_monthly_contribution_cents INTEGER NOT NULL,
    target_date INTEGER,
    is_completed INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY(family_id) REFERENCES family_workspaces(id) ON DELETE CASCADE,
    FOREIGN KEY(linked_account_id) REFERENCES financial_accounts(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS index_savings_goals_family_id ON savings_goals(family_id);
CREATE INDEX IF NOT EXISTS index_savings_goals_linked_account_id ON savings_goals(linked_account_id);

CREATE TABLE IF NOT EXISTS envelope_budgets (
    id TEXT NOT NULL PRIMARY KEY,
    family_id TEXT NOT NULL,
    category TEXT NOT NULL,
    allocated_cents INTEGER NOT NULL, -- Long cents
    month_epoch INTEGER NOT NULL,
    alert_threshold_percentage INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY(family_id) REFERENCES family_workspaces(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS index_envelope_budgets_family_id ON envelope_budgets(family_id);
CREATE UNIQUE INDEX IF NOT EXISTS index_envelope_budgets_family_id_category_month_epoch ON envelope_budgets(family_id, category, month_epoch);
```

### 5.4 `bills_subscriptions`
```sql
CREATE TABLE IF NOT EXISTS bills_subscriptions (
    id TEXT NOT NULL PRIMARY KEY,
    family_id TEXT NOT NULL,
    preferred_account_id TEXT,
    payee TEXT NOT NULL,
    amount_cents INTEGER NOT NULL,
    billing_cycle TEXT NOT NULL,
    due_date INTEGER NOT NULL,
    is_subscription INTEGER NOT NULL,
    is_auto_pay INTEGER NOT NULL,
    reminder_days_before INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY(family_id) REFERENCES family_workspaces(id) ON DELETE CASCADE,
    FOREIGN KEY(preferred_account_id) REFERENCES financial_accounts(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS index_bills_subscriptions_family_id ON bills_subscriptions(family_id);
CREATE INDEX IF NOT EXISTS index_bills_subscriptions_preferred_account_id ON bills_subscriptions(preferred_account_id);
CREATE INDEX IF NOT EXISTS index_bills_subscriptions_due_date ON bills_subscriptions(due_date);
```

---

## 6. Wellbeing, Health & Emergency Preparedness Entities (`MIGRATION_2_3`)

### 6.1 `wellbeing_profiles` & `health_allergies`
*(Note: Private and shared spiritual reflections `SPR-01` and couples alignment check-ins `CPL-01` are persisted via the authoritative per-record domain API `/api/v1/domain/:familyId/relationships/:collection/:recordId`.)*
```sql
CREATE TABLE IF NOT EXISTS wellbeing_profiles (
    id TEXT NOT NULL PRIMARY KEY,
    family_id TEXT NOT NULL,
    member_id TEXT NOT NULL,
    blood_type TEXT,
    medical_conditions_json TEXT NOT NULL,
    insurance_provider TEXT,
    insurance_policy_number TEXT,
    primary_physician_name TEXT,
    primary_physician_phone TEXT,
    notes TEXT,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY(family_id) REFERENCES family_workspaces(id) ON DELETE CASCADE,
    FOREIGN KEY(member_id) REFERENCES family_members(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS index_wellbeing_profiles_family_id ON wellbeing_profiles(family_id);
CREATE UNIQUE INDEX IF NOT EXISTS index_wellbeing_profiles_member_id ON wellbeing_profiles(member_id);

CREATE TABLE IF NOT EXISTS health_allergies (
    id TEXT NOT NULL PRIMARY KEY,
    family_id TEXT NOT NULL,
    member_id TEXT NOT NULL,
    allergen TEXT NOT NULL,
    severity TEXT NOT NULL,
    reaction TEXT NOT NULL,
    emergency_treatment TEXT,
    created_at INTEGER NOT NULL,
    FOREIGN KEY(family_id) REFERENCES family_workspaces(id) ON DELETE CASCADE,
    FOREIGN KEY(member_id) REFERENCES family_members(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS index_health_allergies_family_id ON health_allergies(family_id);
CREATE INDEX IF NOT EXISTS index_health_allergies_member_id ON health_allergies(member_id);
```

### 6.2 `health_medications`, `health_vaccinations` & `healthcare_appointments`
```sql
CREATE TABLE IF NOT EXISTS health_medications (
    id TEXT NOT NULL PRIMARY KEY,
    family_id TEXT NOT NULL,
    member_id TEXT NOT NULL,
    medication_name TEXT NOT NULL,
    dosage TEXT NOT NULL,
    schedule_frequency TEXT NOT NULL,
    schedule_times_json TEXT NOT NULL, -- e.g. ["08:00", "20:00"]
    instructions TEXT,
    is_active INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY(family_id) REFERENCES family_workspaces(id) ON DELETE CASCADE,
    FOREIGN KEY(member_id) REFERENCES family_members(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS index_health_medications_family_id ON health_medications(family_id);
CREATE INDEX IF NOT EXISTS index_health_medications_member_id ON health_medications(member_id);

CREATE TABLE IF NOT EXISTS health_vaccinations (
    id TEXT NOT NULL PRIMARY KEY,
    family_id TEXT NOT NULL,
    member_id TEXT NOT NULL,
    vaccine_name TEXT NOT NULL,
    date_administered INTEGER NOT NULL,
    next_booster_date INTEGER,
    provider TEXT,
    lot_number TEXT,
    created_at INTEGER NOT NULL,
    FOREIGN KEY(family_id) REFERENCES family_workspaces(id) ON DELETE CASCADE,
    FOREIGN KEY(member_id) REFERENCES family_members(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS index_health_vaccinations_family_id ON health_vaccinations(family_id);
CREATE INDEX IF NOT EXISTS index_health_vaccinations_member_id ON health_vaccinations(member_id);

CREATE TABLE IF NOT EXISTS healthcare_appointments (
    id TEXT NOT NULL PRIMARY KEY,
    family_id TEXT NOT NULL,
    member_id TEXT NOT NULL,
    provider_name TEXT NOT NULL,
    specialty TEXT NOT NULL,
    appointment_time INTEGER NOT NULL,
    location TEXT,
    notes TEXT,
    created_at INTEGER NOT NULL,
    FOREIGN KEY(family_id) REFERENCES family_workspaces(id) ON DELETE CASCADE,
    FOREIGN KEY(member_id) REFERENCES family_members(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS index_healthcare_appointments_family_id ON healthcare_appointments(family_id);
CREATE INDEX IF NOT EXISTS index_healthcare_appointments_member_id ON healthcare_appointments(member_id);
CREATE INDEX IF NOT EXISTS index_healthcare_appointments_appointment_time ON healthcare_appointments(appointment_time);
```

### 6.3 `emergency_contacts`, `emergency_plans`, `emergency_supplies` & `emergency_checklist_items`
```sql
CREATE TABLE IF NOT EXISTS emergency_contacts (
    id TEXT NOT NULL PRIMARY KEY,
    family_id TEXT NOT NULL,
    name TEXT NOT NULL,
    relationship TEXT NOT NULL,
    phone_primary TEXT NOT NULL,
    phone_secondary TEXT,
    is_primary INTEGER NOT NULL,
    notes TEXT,
    created_at INTEGER NOT NULL,
    FOREIGN KEY(family_id) REFERENCES family_workspaces(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS index_emergency_contacts_family_id ON emergency_contacts(family_id);

CREATE TABLE IF NOT EXISTS emergency_plans (
    id TEXT NOT NULL PRIMARY KEY,
    family_id TEXT NOT NULL,
    primary_meeting_point TEXT NOT NULL,
    secondary_meeting_point TEXT NOT NULL,
    evacuation_route TEXT,
    gas_shutoff_location TEXT,
    water_shutoff_location TEXT,
    electrical_panel_location TEXT,
    notes TEXT,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY(family_id) REFERENCES family_workspaces(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS index_emergency_plans_family_id ON emergency_plans(family_id);

CREATE TABLE IF NOT EXISTS emergency_supplies (
    id TEXT NOT NULL PRIMARY KEY,
    family_id TEXT NOT NULL,
    item_name TEXT NOT NULL,
    category TEXT NOT NULL, -- 'FIRST_AID', 'FIRE_SAFETY', 'EMERGENCY_FOOD', 'LIGHTING', 'WATER'
    quantity TEXT NOT NULL,
    storage_location TEXT NOT NULL,
    expiry_date INTEGER,
    is_checked INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY(family_id) REFERENCES family_workspaces(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS index_emergency_supplies_family_id ON emergency_supplies(family_id);

CREATE TABLE IF NOT EXISTS emergency_checklist_items (
    id TEXT NOT NULL PRIMARY KEY,
    family_id TEXT NOT NULL,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    is_completed INTEGER NOT NULL,
    assigned_member_id TEXT,
    completed_at INTEGER,
    created_at INTEGER NOT NULL,
    FOREIGN KEY(family_id) REFERENCES family_workspaces(id) ON DELETE CASCADE,
    FOREIGN KEY(assigned_member_id) REFERENCES family_members(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS index_emergency_checklist_items_family_id ON emergency_checklist_items(family_id);
CREATE INDEX IF NOT EXISTS index_emergency_checklist_items_assigned_member_id ON emergency_checklist_items(assigned_member_id);
```

*(Note: Canonical `investment_holdings` microshares definition is located in Section 9.1 — Room v6.)*

---

## 7. Master Stage 2 — Routine Persistence Entities (Room v4, Internal Milestone 3.3.3 — 41 Entities Total)

### 7.1 `routines` (Table #40)
```sql
CREATE TABLE IF NOT EXISTS routines (
    id TEXT NOT NULL PRIMARY KEY, -- UUID v4
    family_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL, -- 'MORNING', 'AFTERNOON', 'EVENING', 'HOUSEHOLD', 'HEALTH'
    frequency TEXT NOT NULL, -- 'DAILY', 'WEEKDAYS', 'WEEKENDS', 'WEEKLY', 'BIWEEKLY', 'MONTHLY', 'CUSTOM'
    target_time_of_day TEXT NOT NULL, -- HH:mm 24h format or time block
    scope TEXT NOT NULL, -- 'FAMILY', 'COUPLE', 'PERSONAL'
    owner_member_id TEXT NOT NULL,
    assigned_member_ids_json TEXT NOT NULL, -- JSON array of member IDs
    steps_json TEXT NOT NULL, -- JSON array of ordered routine steps
    points_reward INTEGER NOT NULL,
    is_paused INTEGER NOT NULL, -- Invariant: remains 0 (active) on occurrence completion
    streak_count INTEGER NOT NULL,
    best_streak_count INTEGER NOT NULL,
    last_completed_date TEXT, -- YYYY-MM-DD
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY(family_id) REFERENCES family_workspaces(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS index_routines_family_id ON routines(family_id);
CREATE INDEX IF NOT EXISTS index_routines_category ON routines(category);
CREATE INDEX IF NOT EXISTS index_routines_is_paused ON routines(is_paused);
```

### 7.2 `routine_occurrences` (Table #41)
```sql
CREATE TABLE IF NOT EXISTS routine_occurrences (
    id TEXT NOT NULL PRIMARY KEY, -- UUID v4 or 'occ-{routineId}-{targetDate}'
    family_id TEXT NOT NULL,
    routine_id TEXT NOT NULL,
    target_date TEXT NOT NULL, -- YYYY-MM-DD
    status TEXT NOT NULL, -- 'PENDING', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED'
    step_completions_json TEXT NOT NULL, -- JSON map/array of step completion states
    completed_at INTEGER, -- Epoch milliseconds
    completed_by_member_id TEXT,
    skipped_reason TEXT,
    points_awarded INTEGER NOT NULL,
    linked_task_id TEXT, -- ID if promoted to canonical task
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY(family_id) REFERENCES family_workspaces(id) ON DELETE CASCADE,
    FOREIGN KEY(routine_id) REFERENCES routines(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS index_routine_occurrences_family_id ON routine_occurrences(family_id);
CREATE UNIQUE INDEX IF NOT EXISTS index_routine_occurrences_routine_id_target_date ON routine_occurrences(routine_id, target_date);
CREATE INDEX IF NOT EXISTS index_routine_occurrences_target_date ON routine_occurrences(target_date);
CREATE INDEX IF NOT EXISTS index_routine_occurrences_status ON routine_occurrences(status);
```

### 7.3 Room Non-Destructive Migration Script (`MIGRATION_3_4`)
`MIGRATION_3_4` increments database version from 3 to 4, executes the `CREATE TABLE` and `CREATE INDEX` statements above, and leaves all 39 pre-existing tables and their stored records completely intact.

---

## 8. Master Stage 2.A — Food Pantry, Wardrobe & Outfit Planner (Room Database Version 5)

The database version is incremented from `version = 4` to `version = 5` via non-destructive migration `MIGRATION_4_5`. This adds canonical storage for Food Pantry & Fridge Inventory (`HSE-04`) and Wardrobe & Weekly Outfit Planner (`HSE-07`), bringing total Room entities to 44.

### 8.1 `pantry_items` (Table #42)
```sql
CREATE TABLE IF NOT EXISTS pantry_items (
    id TEXT PRIMARY KEY NOT NULL,
    family_id TEXT NOT NULL,
    item_name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'PANTRY', -- 'PANTRY', 'FRIDGE', 'FREEZER', 'SPICES', 'SNACKS', 'BEVERAGES', 'OTHER'
    quantity REAL NOT NULL DEFAULT 1.0,
    unit TEXT NOT NULL DEFAULT 'item',
    storage_location TEXT,
    expiry_date INTEGER, -- Epoch millis
    min_threshold REAL NOT NULL DEFAULT 1.0,
    is_low_stock INTEGER NOT NULL DEFAULT 0,
    notes TEXT,
    version INTEGER NOT NULL DEFAULT 1,
    sync_status TEXT NOT NULL DEFAULT 'LOCAL_ONLY',
    is_deleted INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY(family_id) REFERENCES family_workspaces(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS index_pantry_items_family_id ON pantry_items(family_id);
CREATE INDEX IF NOT EXISTS index_pantry_items_category ON pantry_items(category);
CREATE INDEX IF NOT EXISTS index_pantry_items_expiry_date ON pantry_items(expiry_date);
```

### 8.2 `wardrobe_items` (Table #43)
```sql
CREATE TABLE IF NOT EXISTS wardrobe_items (
    id TEXT PRIMARY KEY NOT NULL,
    family_id TEXT NOT NULL,
    member_id TEXT NOT NULL,
    item_name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'TOPS', -- 'TOPS', 'BOTTOMS', 'DRESSES', 'OUTERWEAR', 'SHOES', 'ACCESSORIES', 'OTHER'
    color TEXT,
    season TEXT NOT NULL DEFAULT 'ALL_SEASON', -- 'SPRING', 'SUMMER', 'FALL', 'WINTER', 'ALL_SEASON'
    is_clean INTEGER NOT NULL DEFAULT 1,
    image_uri TEXT,
    notes TEXT,
    version INTEGER NOT NULL DEFAULT 1,
    sync_status TEXT NOT NULL DEFAULT 'LOCAL_ONLY',
    is_deleted INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY(family_id) REFERENCES family_workspaces(id) ON DELETE CASCADE,
    FOREIGN KEY(member_id) REFERENCES family_members(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS index_wardrobe_items_family_id ON wardrobe_items(family_id);
CREATE INDEX IF NOT EXISTS index_wardrobe_items_member_id ON wardrobe_items(member_id);
CREATE INDEX IF NOT EXISTS index_wardrobe_items_category ON wardrobe_items(category);
```

### 8.3 `outfit_plans` (Table #44)
```sql
CREATE TABLE IF NOT EXISTS outfit_plans (
    id TEXT NOT NULL PRIMARY KEY,
    family_id TEXT NOT NULL,
    member_id TEXT NOT NULL,
    plan_date TEXT NOT NULL, -- ISO date string e.g. '2026-05-12'
    outfit_name TEXT NOT NULL,
    item_ids_json TEXT NOT NULL,
    occasion TEXT NOT NULL, -- 'DAILY', 'WORK_SCHOOL', 'FORMAL', 'ATHLETIC', 'SPECIAL'
    notes TEXT,
    version INTEGER NOT NULL,
    sync_status TEXT NOT NULL,
    is_deleted INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY(family_id) REFERENCES family_workspaces(id) ON DELETE CASCADE,
    FOREIGN KEY(member_id) REFERENCES family_members(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS index_outfit_plans_family_id ON outfit_plans(family_id);
CREATE INDEX IF NOT EXISTS index_outfit_plans_member_id_plan_date ON outfit_plans(member_id, plan_date);
CREATE UNIQUE INDEX IF NOT EXISTS index_outfit_plans_member_id_plan_date_occasion ON outfit_plans(member_id, plan_date, occasion);
```

### 8.4 Room Non-Destructive Migration Script (`MIGRATION_4_5`)
`MIGRATION_4_5` increments Room database version from 4 to 5, executes the DDL creating tables `pantry_items`, `wardrobe_items`, and `outfit_plans`, creates required foreign key and query performance indices, and guarantees 100% preservation across all 41 pre-existing tables without data drop or reset.

---

## 9. Master Stage 3.A.1 Entities & Room Migration v6

### 9.1 `investment_holdings` (Table #45)
Fixed-precision microshares fractional asset tracking (`INV-01`).
- `1.000000` share = `1,000,000` microshares (zero floating-point representation).
- `cost_basis_cents` = total purchase cost in signed integer cents (`Long`).
- `current_price_cents` = market price per 1.0 whole share in integer cents (`Long`).
- Current market valuation formula: `(quantity_microshares * current_price_cents) / 1,000,000`.
- Unrealized gain/loss formula: `current_valuation_cents - cost_basis_cents`.

```sql
CREATE TABLE IF NOT EXISTS investment_holdings (
    id TEXT PRIMARY KEY NOT NULL,
    family_id TEXT NOT NULL,
    account_id TEXT NOT NULL,
    symbol TEXT NOT NULL,
    asset_name TEXT NOT NULL,
    asset_type TEXT NOT NULL, -- 'STOCK', 'ETF', 'CRYPTO', 'MUTUAL_FUND', 'BOND', 'RETIREMENT'
    quantity_microshares INTEGER NOT NULL, -- 1.0 share = 1,000,000 microshares
    cost_basis_cents INTEGER NOT NULL, -- Total purchase cost in integer cents
    current_price_cents INTEGER NOT NULL, -- Market price per 1.0 whole share in cents
    currency TEXT NOT NULL DEFAULT 'USD',
    notes TEXT,
    last_price_updated_at INTEGER NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    sync_status TEXT NOT NULL DEFAULT 'LOCAL_ONLY',
    is_deleted INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY(family_id) REFERENCES family_workspaces(id) ON DELETE CASCADE,
    FOREIGN KEY(account_id) REFERENCES financial_accounts(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS index_investment_holdings_family_id ON investment_holdings(family_id);
CREATE INDEX IF NOT EXISTS index_investment_holdings_account_id ON investment_holdings(account_id);
CREATE INDEX IF NOT EXISTS index_investment_holdings_symbol ON investment_holdings(symbol);
```

### 9.2 Room Non-Destructive Migration Script (`MIGRATION_5_6`)
`MIGRATION_5_6` increments Room database version from 5 to 6, executes the DDL creating Table #45 (`investment_holdings`), applies required foreign key and query performance indices, and guarantees 100% data preservation across all 44 pre-existing tables.

---

## 10. Family Section & Extended Heritage Map Entities & Room Migration v7

### 10.1 Active Membership Uniqueness & Historical Membership Preservation (`family_memberships`)
In Room Database **v7** (`version = 7`, **52 total registered `@Entity` tables**), `family_memberships` replaces the legacy unconditional unique index on `(user_account_id)` with:
- Status-scoped lookup index: `index_family_memberships_user_account_id_status` on `(user_account_id, status)`.
- Family-member composite unique index: `index_family_memberships_family_id_user_account_id` on `(family_id, user_account_id)`.
- SQLite `BEFORE INSERT` and `BEFORE UPDATE` triggers (`trg_family_memberships_one_active_insert` and `trg_family_memberships_one_active_update`) that abort any attempt to insert or activate a second `ACTIVE` membership for the same `user_account_id` while allowing historical `REVOKED` or `LEFT` membership rows to coexist.

### 10.2 `family_gallery_albums` (Table #46)
```sql
CREATE TABLE IF NOT EXISTS `family_gallery_albums` (
    `id` TEXT NOT NULL PRIMARY KEY,
    `family_id` TEXT NOT NULL,
    `title` TEXT NOT NULL,
    `description` TEXT,
    `category` TEXT NOT NULL,
    `cover_photo_url` TEXT,
    `created_by_user_id` TEXT NOT NULL,
    `version` INTEGER NOT NULL,
    `is_deleted` INTEGER NOT NULL,
    `created_at` INTEGER NOT NULL,
    `updated_at` INTEGER NOT NULL,
    FOREIGN KEY(`family_id`) REFERENCES `family_workspaces`(`id`) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS `index_family_gallery_albums_family_id` ON `family_gallery_albums` (`family_id`);
```

### 10.3 `family_gallery_photos` (Table #47)
```sql
CREATE TABLE IF NOT EXISTS `family_gallery_photos` (
    `id` TEXT NOT NULL PRIMARY KEY,
    `family_id` TEXT NOT NULL,
    `album_id` TEXT,
    `title` TEXT NOT NULL,
    `caption` TEXT,
    `image_url` TEXT NOT NULL,
    `visibility` TEXT NOT NULL,
    `uploaded_by_user_id` TEXT NOT NULL,
    `uploaded_by_member_id` TEXT,
    `version` INTEGER NOT NULL,
    `is_deleted` INTEGER NOT NULL,
    `created_at` INTEGER NOT NULL,
    `updated_at` INTEGER NOT NULL,
    FOREIGN KEY(`family_id`) REFERENCES `family_workspaces`(`id`) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS `index_family_gallery_photos_family_id` ON `family_gallery_photos` (`family_id`);
CREATE INDEX IF NOT EXISTS `index_family_gallery_photos_album_id` ON `family_gallery_photos` (`album_id`);
```

### 10.4 `family_constitution_versions` (Table #48)
```sql
CREATE TABLE IF NOT EXISTS `family_constitution_versions` (
    `id` TEXT NOT NULL PRIMARY KEY,
    `family_id` TEXT NOT NULL,
    `version_number` INTEGER NOT NULL,
    `motto` TEXT NOT NULL,
    `mission_statement` TEXT NOT NULL,
    `vision_statement` TEXT NOT NULL,
    `core_values_json` TEXT NOT NULL,
    `acknowledgments_json` TEXT NOT NULL,
    `edited_by_user_id` TEXT NOT NULL,
    `created_at` INTEGER NOT NULL,
    `updated_at` INTEGER NOT NULL,
    FOREIGN KEY(`family_id`) REFERENCES `family_workspaces`(`id`) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS `index_family_constitution_versions_family_id_version_number` ON `family_constitution_versions` (`family_id`, `version_number`);
```

### 10.5 `family_traditions` (Table #49)
```sql
CREATE TABLE IF NOT EXISTS `family_traditions` (
    `id` TEXT NOT NULL PRIMARY KEY,
    `family_id` TEXT NOT NULL,
    `title` TEXT NOT NULL,
    `category` TEXT NOT NULL,
    `cadence` TEXT NOT NULL,
    `next_occurrence_date` TEXT,
    `origin_story` TEXT,
    `linked_recipe_id` TEXT,
    `version` INTEGER NOT NULL,
    `is_deleted` INTEGER NOT NULL,
    `created_at` INTEGER NOT NULL,
    `updated_at` INTEGER NOT NULL,
    FOREIGN KEY(`family_id`) REFERENCES `family_workspaces`(`id`) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS `index_family_traditions_family_id` ON `family_traditions` (`family_id`);
```

### 10.6 `family_shared_activities` (Table #50)
```sql
CREATE TABLE IF NOT EXISTS `family_shared_activities` (
    `id` TEXT NOT NULL PRIMARY KEY,
    `family_id` TEXT NOT NULL,
    `title` TEXT NOT NULL,
    `category` TEXT NOT NULL,
    `date_iso` TEXT NOT NULL,
    `location` TEXT,
    `budget_cents` INTEGER NOT NULL,
    `status` TEXT NOT NULL,
    `linked_calendar_event_id` TEXT,
    `version` INTEGER NOT NULL,
    `is_deleted` INTEGER NOT NULL,
    `created_at` INTEGER NOT NULL,
    `updated_at` INTEGER NOT NULL,
    FOREIGN KEY(`family_id`) REFERENCES `family_workspaces`(`id`) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS `index_family_shared_activities_family_id` ON `family_shared_activities` (`family_id`);
```

### 10.7 `family_rules` (Table #51)
```sql
CREATE TABLE IF NOT EXISTS `family_rules` (
    `id` TEXT NOT NULL PRIMARY KEY,
    `family_id` TEXT NOT NULL,
    `title` TEXT NOT NULL,
    `category` TEXT NOT NULL,
    `description` TEXT NOT NULL,
    `applies_to_role` TEXT NOT NULL,
    `version` INTEGER NOT NULL,
    `is_deleted` INTEGER NOT NULL,
    `created_at` INTEGER NOT NULL,
    `updated_at` INTEGER NOT NULL,
    FOREIGN KEY(`family_id`) REFERENCES `family_workspaces`(`id`) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS `index_family_rules_family_id` ON `family_rules` (`family_id`);
```

### 10.8 `family_extended_relatives` (Table #52)
```sql
CREATE TABLE IF NOT EXISTS `family_extended_relatives` (
    `id` TEXT NOT NULL PRIMARY KEY,
    `family_id` TEXT NOT NULL,
    `full_name` TEXT NOT NULL,
    `relationship_label` TEXT NOT NULL,
    `lineage_side` TEXT NOT NULL,
    `generation` TEXT NOT NULL,
    `birth_year` INTEGER,
    `occupation` TEXT,
    `city` TEXT,
    `country` TEXT,
    `avatar_url` TEXT,
    `growth_areas_json` TEXT NOT NULL,
    `encouragement_notes_json` TEXT NOT NULL,
    `version` INTEGER NOT NULL,
    `is_deleted` INTEGER NOT NULL,
    `created_at` INTEGER NOT NULL,
    `updated_at` INTEGER NOT NULL,
    FOREIGN KEY(`family_id`) REFERENCES `family_workspaces`(`id`) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS `index_family_extended_relatives_family_id` ON `family_extended_relatives` (`family_id`);
CREATE INDEX IF NOT EXISTS `index_family_extended_relatives_lineage_side` ON `family_extended_relatives` (`lineage_side`);
```

### 10.9 Room Non-Destructive Migration Script (`MIGRATION_6_7`)
`MIGRATION_6_7` increments Room database version from 6 to 7, updates the `family_memberships` index and active-membership triggers, creates Tables #46 through #52 (`family_gallery_albums`, `family_gallery_photos`, `family_constitution_versions`, `family_traditions`, `family_shared_activities`, `family_rules`, `family_extended_relatives`), and preserves 100% of existing records across all 45 pre-existing tables without destructive fallback.

---

## 11. Master Stage 4/5 — Full-Text Search Virtual Entities (Room v8)

### 11.1 `recipes_fts` (Virtual Table #53)
```sql
CREATE VIRTUAL TABLE IF NOT EXISTS `recipes_fts` USING FTS4(`title`, `description`, `category`, `dietary_notes`, content=`recipes`);
-- Populated via:
INSERT INTO `recipes_fts` (`docid`, `title`, `description`, `category`, `dietary_notes`)
SELECT `rowid`, `title`, `description`, `category`, `dietary_notes` FROM `recipes`;
```

### 11.2 `tasks_fts` (Virtual Table #54)
```sql
CREATE VIRTUAL TABLE IF NOT EXISTS `tasks_fts` USING FTS4(`title`, `notes`, content=`tasks`);
-- Populated via:
INSERT INTO `tasks_fts` (`docid`, `title`, `notes`)
SELECT `rowid`, `title`, `notes` FROM `tasks`;
```

### 11.3 `family_goals_fts` (Virtual Table #55)
```sql
CREATE VIRTUAL TABLE IF NOT EXISTS `family_goals_fts` USING FTS4(`title`, `description`, `category`, content=`family_goals`);
-- Populated via:
INSERT INTO `family_goals_fts` (`docid`, `title`, `description`, `category`)
SELECT `rowid`, `title`, `description`, `category` FROM `family_goals`;
```

### 11.4 `home_assets_fts` (Virtual Table #56)
```sql
CREATE VIRTUAL TABLE IF NOT EXISTS `home_assets_fts` USING FTS4(`name`, `category`, `description`, `location`, content=`home_assets`);
-- Populated via:
INSERT INTO `home_assets_fts` (`docid`, `name`, `category`, `description`, `location`)
SELECT `rowid`, `name`, `category`, `description`, `location` FROM `home_assets`;
```

### 11.5 `family_traditions_fts` (Virtual Table #57)
```sql
CREATE VIRTUAL TABLE IF NOT EXISTS `family_traditions_fts` USING FTS4(`title`, `category`, `origin_story`, content=`family_traditions`);
-- Populated via:
INSERT INTO `family_traditions_fts` (`docid`, `title`, `category`, `origin_story`)
SELECT `rowid`, `title`, `category`, `origin_story` FROM `family_traditions`;
```

### 11.6 Room Non-Destructive Migration Script (`MIGRATION_7_8`)
`MIGRATION_7_8` increments Room database version from 7 to 8, creates the 5 FTS4 virtual tables (`recipes_fts`, `tasks_fts`, `family_goals_fts`, `home_assets_fts`, `family_traditions_fts`), populates existing data from base tables without dropping or altering any pre-existing rows, and enables full-text search across household recipes, planning goals, tasks, home assets, and family traditions.

---

## 12. Master Stage 5 — Financial Ledger Idempotency Hardening (Room v9)

### 12.1 Room Non-Destructive Migration Script (`MIGRATION_8_9`)
`MIGRATION_8_9` increments Room database version from 8 to 9, adding `idempotency_key TEXT` with a unique index (`index_financial_transactions_idempotency_key`) on `financial_transactions` to enforce transaction idempotency across retries and offline sync:

```sql
ALTER TABLE `financial_transactions` ADD COLUMN `idempotency_key` TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS `index_financial_transactions_idempotency_key` ON `financial_transactions` (`idempotency_key`);
```
