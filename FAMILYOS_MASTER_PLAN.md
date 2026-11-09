# FAMILYOS — MASTER PROJECT PLAN
**Status**: STAGE 0 (Architecture and Product Foundation)  
**Author**: Principal Software Architect & Product Lead  
**Target Platform**: Android (Kotlin, Jetpack Compose, Room, MVVM Clean Architecture) & Cloud Backend (Firebase / Gemini)  
**Revision**: 1.0.0 (Stage 0 Baseline)

---

## 1. Executive Summary & Product Vision

**FamilyOS** is a commercial-grade, premium digital operating system for household and family life. Its mission is to unite responsibilities, financial stewardship, shared goals, meal and household planning, spiritual reflection, personal growth, child development, health routines, emergency preparedness, and long-term investments in an offline-first, privacy-respecting, aesthetically elevated platform.

### Core Tenets:
1. **Offline-First & Resilient**: All operational household tasks, recipes, meal plans, schedules, and checklists function seamlessly without network access using local SQLite/Room with explicit synchronization queuing and conflict policies.
2. **Strict Financial Integrity**: Zero floating-point math (`Float` / `Double` strictly prohibited for currency). All currency stored and computed as 64-bit integer cents (`Long`), with certified rounding and audit trails.
3. **Decoupled User Accounts vs Family Profiles**: A family member profile can exist independently of an authenticated account (essential for minor children, dependents, or elderly relatives without mobile devices).
4. **Deny-by-Default Privacy & Child Protection**: Strict boundary isolation between families, granular role-based permissions, zero covert surveillance, and no sharing of children's data with AI models or external trackers.
5. **No AI Hallucinations in System of Record**: All AI-assisted suggestions (meal planning, goal breakdown, chore balance) require mandatory human review and explicit confirmation before persistence.

---

## 2. Five-Stage Implementation Roadmap

```
+---------------------------------------------------------------------------------------------------+
| STAGE 0: ARCHITECTURE & FOUNDATION (Current)                                                      |
| - Technical architecture, database schemas, security specs, design system, test strategy         |
+---------------------------------------------------------------------------------------------------+
                                                  |
                                                  v
+---------------------------------------------------------------------------------------------------+
| STAGE 1: CORE PLATFORM                                                                            |
| - Auth (Firebase + Biometrics), User Profiles vs Member Profiles, Family Workspaces, RBAC         |
| - Room Local Database Foundation, Sync Queue & State Machine, Core Navigation Shell & Dashboard   |
+---------------------------------------------------------------------------------------------------+
                                                  |
                                                  v
+---------------------------------------------------------------------------------------------------+
| STAGE 2: FAMILY & HOUSEHOLD                                                                       |
| - Family Tree, Governance (Constitution), Goals -> Projects -> Tasks -> Checklists Hierarchy      |
| - Meals & Recipes (Printable QR Cards), Food Inventory, Chores & Points, Wardrobe, Home Assets    |
+---------------------------------------------------------------------------------------------------+
                                                  |
                                                  v
+---------------------------------------------------------------------------------------------------+
| STAGE 3: FINANCE & WELLBEING                                                                      |
| - Exact Integer Cents Finance Engine (Income, Expenses, Cash-Flow Allocator, Budgets, Net Worth)   |
| - Investment Tracker, Spiritual Growth, Personal Development, Couples Prep, Parenting & Child Dev |
| - Health & Medication Reminders, Family Emergency & Safety Directory                              |
+---------------------------------------------------------------------------------------------------+
                                                  |
                                                  v
+---------------------------------------------------------------------------------------------------+
| STAGE 4: AI & ADVANCED EXPERIENCES                                                                |
| - Secure Server-Side Gemini 2.5 API Gateway (Meal generation, Goal breakdown, Smart wardrobe)     |
| - Global Search & Unified Calendar, Export Engine (PDFs, Recipe Cards), Google Play Billing Sub   |
+---------------------------------------------------------------------------------------------------+
                                                  |
                                                  v
+---------------------------------------------------------------------------------------------------+
| STAGE 5: HARDENING, QUALITY ASSURANCE & RELEASE                                                   |
| - Automated Regression Suites, Security Audits, GDPR/COPPA Privacy Review, Google Play Release    |
+---------------------------------------------------------------------------------------------------+
```

---

## 3. Product Modules Breakdown (12 Modules)

| Module ID | Module Name | Primary Entities | Key Capabilities |
|---|---|---|---|
| **MOD-01** | **Authentication & Accounts** | `UserAccount`, `Session`, `DeviceRegistration` | Email/Pass, Google OAuth, Biometric unlock, Device tracking, Multi-device revocation, GDPR deletion |
| **MOD-02** | **The Family & Governance** | `FamilyWorkspace`, `FamilyMember`, `Relationship`, `GovernanceDoc`, `Event` | Workspaces, Member profiles (with/without account), Family Tree, Roles/Permissions, Constitution, Milestones |
| **MOD-03** | **Goals, Projects & Tasks** | `Goal`, `Project`, `Task`, `ChecklistItem`, `TaskHistory` | 4-level strict hierarchy, Assignees, Dependencies, Recurring engine, Target dates, AI breakdown approvals |
| **MOD-04** | **The Household** | `MealPlan`, `Recipe`, `InventoryItem`, `Chore`, `WardrobeItem`, `HomeAsset` | 7-day Meal planner, Recipe scaler + QR export, Stock reorder thresholds, Chores & positive points, Asset warranties |
| **MOD-05** | **Finance Engine** | `Account`, `Income`, `Expense`, `Budget`, `SavingsGoal`, `NetWorthSnapshot` | Integer-cents math, Available-before-savings allocation, Envelope budgeting, Assets vs Liabilities, Zero floating point |
| **MOD-06** | **Spiritual Growth** | `ReflectionEntry`, `ReadingPlan`, `StudyNote`, `FamilyTradition` | Personal & family journals, Reading plans, Traditions, Granular privacy levels (Private vs Family Shared) |
| **MOD-07** | **Personal & Family Development** | `PersonalDevelopmentPlan`, `Skill`, `Habit`, `ReadingTrackerItem` | Skills inventory, Habit tracker, Shared family learning, Linkage to Goal/Task engine |
| **MOD-08** | **Couples Preparation** | `CouplesTopic`, `RelationshipCheckin`, `ExpectationItem`, `SharedAgreement` | Educational & constructive check-ins, Household expectation matrix, Financial alignment, Pre-child planning |
| **MOD-09** | **Parenting & Child Development** | `ChildProfile`, `ChildMilestone`, `LifeSkill`, `HomeworkPlan`, `Achievement` | Age-appropriate milestones, Guardian access controls, COPPA-compliant data minimization, Growth logs |
| **MOD-10** | **Health & Fitness** | `WellbeingGoal`, `WorkoutRoutine`, `MedicationReminder`, `HealthAppointment` | Private health records, Hydration & sleep routines, Secure medication schedules, Vaccination & history logs |
| **MOD-11** | **Family Safety & Emergency** | `EmergencyContact`, `EmergencyPlan`, `SafetySupplyItem`, `DrillRecord`, `DeviceMaintenance` | Offline crisis directory, Smoke/CO alarm schedules, First aid kits, Evacuation checklists, Consent check-ins |
| **MOD-12** | **Investment Planner** | `InvestmentAccount`, `AssetHolding`, `ValuationHistory`, `ContributionPlan` | Asset allocation, Cost basis vs Market value, Scenario calculators, Educational disclaimer boundaries |

---

## 4. Core Shared Infrastructure Systems

1. **Global Unified Calendar**: Aggregates tasks, chores, meal plans, health appointments, anniversaries, and safety maintenance into a single unified timeline.
2. **Central Notification Engine**: Android AlarmManager + WorkManager for exact alarms (medications, appointments) and batched notifications (chores, habits).
3. **Global Full-Text Search (FTS4)**: Local Room v8 SQLite FTS4 virtual table indexing (`recipes_fts`, `tasks_fts`, `family_goals_fts`, `home_assets_fts`, `family_traditions_fts`) with automatic content-sync triggers across recipes, tasks, family goals, home assets, and family traditions.
4. **Document & Media Storage**: Local encrypted cache + Firebase Cloud Storage with signed URLs and member-level access control.
5. **Activity Log & Audit Trail**: Immutable change record for auditing sensitive family actions (member invites, role alterations, finance edits).
6. **Entitlement & Subscription Engine**: Local cryptographically signed token caching Play Billing status across Free, Individual, and Family tiers.

---

## 5. Development Governance & Standards

- **Single Source of Truth**: All progress, schema changes, and architectural decisions are tracked in the 10 canonical documents.
- **Verification Gate**: No stage or feature is declared complete without automated unit/integration tests and build verification.
- **Strict Coding Style**: Kotlin 2.0+ idiomatic patterns, strict null safety, immutable data classes (`val`), Kotlin Result/Arrow error handling, and Jetpack Compose state hoisting.
