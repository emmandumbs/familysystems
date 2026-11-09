# FAMILYOS — STAGE 3.3.2 SOURCE AUDIT
## Unified Goals, Projects, Milestones, Tasks & Checklists

**Date:** 2026-11-01  
**Stage:** Stage 3.3.2 — Step 1 Source Audit  
**Scope:** Backend (`server.ts`, `src/server/*`, `firestore.rules`), Android (`Stage2Entities.kt`, `Stage2Daos.kt`, `Stage2Models.kt`, `Stage2RepositoriesImpl.kt`, `FamilyOSViewModel.kt`, `GoalsScreen.kt`, `CalendarScreen.kt`), Web (`src/App.tsx`, `src/components/*`), and Tests.

---

## 1. Executive Classification Matrix

| # | Area / Component | Classification | Primary Source Files | Audit Findings |
| :- | :--- | :--- | :--- | :--- |
| 1 | **Goals Entities & Repositories** | **PARTIAL** | `Stage2Entities.kt:56-88`, `Stage2Daos.kt:24-34`, `Stage2RepositoriesImpl.kt:101-134`, `Stage2Models.kt:43-54` | Room `family_goals` table and DAO exist, but lack `PERSONAL`/`COUPLE`/`FAMILY` scopes, short-term vs long-term horizon, measurable target/current metrics, mission/vision linkage, goal reviews, and completion history. |
| 2 | **Projects & Milestones** | **PARTIAL** | `Stage2Entities.kt:91-132`, `Stage2Models.kt:56-66`, `backupAndMigration.ts` | `projects` table exists in Room v2, but lacks `PERSONAL`/`SHARED` scope, assigned members, dependencies, comments, attachments, activity history, and archival. **Milestones** (`ProjectMilestone`) between Projects and Tasks are missing in domain/API/UI. |
| 3 | **Canonical Universal Tasks (`tasks`)** | **PARTIAL** | `Stage2Entities.kt:135-192`, `Stage2Daos.kt:45-63`, `Stage2Models.kt:68-83`, `server.ts:402-410` | `tasks` table supports `projectId`, `parentTaskId`, `priority`, `dueDate`, `recurrenceRule`. Missing `sourceModule` (`GOALS_PROJECTS`, `HOME_MANAGEMENT`, `MARRIAGE`, `PARENTING`, `SPIRITUAL_GROWTH`, `FAMILY_GOVERNANCE`, `PERSONAL_PLANNING`), `scope` (`PERSONAL`/`SHARED`), `status` (`TODO`, `IN_PROGRESS`, `BLOCKED`, `COMPLETED`, `ARCHIVED`), `milestoneId`, `goalId`, `estimatedDurationMinutes`, `dependencyTaskIds`, `comments`, `attachments`, and `activityHistory`. |
| 4 | **Checklists & Reusable Templates** | **PARTIAL** | `Stage2Entities.kt:195-216`, `Stage2Daos.kt:64-73`, `server.ts:2933-2968` | `task_checklist_items` table and `EVENT_BASED_MERGE` sync exist. Missing reusable checklist templates (`ChecklistTemplate`), item-level `assignedMemberId`, and deterministic rollup calculation into parent task, milestone, project, and goal progress without duplicate progress records. |
| 5 | **Task Assignment & Governance** | **PARTIAL** | `src/server/authAndRbac.ts`, `FamilySecurityPolicy.kt` | Zero-trust membership resolution exists from Stage 3.2/3.3.1, but task/goal/project endpoints need explicit enforcement for `PERSONAL` ownership, `COUPLE` visibility (restricted to adult couple/owners/admins; hidden from `CHILD`/`GUEST`), `CHILD` restrictions, `GUEST` read-only enforcement, and `REVOKED` member blocking. |
| 6 | **Family, Couple & Personal Scopes** | **PARTIAL** | `src/server/authAndRbac.ts`, `server.ts` | Personal vs shared member profile privacy is implemented in Stage 3.3.1, but not yet applied to Goals, Projects, Milestones, Tasks, and Calendar events. |
| 7 | **Calendar & Recurrence Integration** | **PARTIAL** | `Stage2Daos.kt:191-204`, `CalendarScreen.kt`, `ChoreRecurrenceCalculator.kt` | `CalendarScreen.kt` renders events, but task due dates do not bidirectionally sync with calendar events, personal task calendar entries are not privacy-filtered, and completing a recurring task does not automatically spawn the next occurrence with timezone preservation. |
| 8 | **Optional Family Reward System** | **MISSING** | `Models.kt:65`, `Stage2Models.kt:191` | `pointsBalance` on `FamilyMember` and `rewardPoints` on `Chore` exist, but there is no workspace-level configurable reward engine (disabled by default, points/coins config, eligible tasks, redemption rules, approval gate, and non-punitive reward history). |
| 9 | **Android ViewModels & Adaptive Screens** | **PARTIAL** | `GoalsScreen.kt:23-270`, `CalendarScreen.kt:25-185`, `FamilyOSViewModel.kt` | `GoalsScreen.kt` has a hardcoded `FamilyOSProgressIndicator(progress = 0.65f)` at line 124 and lacks views for Mission/Vision alignment, Milestones, Kanban, Timeline, My Tasks vs Family Tasks, Overdue, Upcoming, Completed, Archived, and adaptive phone/tablet layouts. |
| 10 | **Web Planning & Execution Experience** | **PARTIAL** | `src/App.tsx`, `src/components/Stage331FamilyExperience.tsx` | `src/App.tsx` Stage 2 `goals` sub-tab is a static architectural preview rather than a live unified planning & execution workspace connected to `/api/v1/planning/:familyId`. |
| 11 | **Synchronization Registrations** | **PARTIAL** | `server.ts:2617-2633`, `SyncManager.kt` | `TASK` and `CHECKLIST_ITEM` use `EVENT_BASED_MERGE`, while `GOAL` uses `TOMBSTONE_SOFT_DELETE`. Needs full bidirectional sync support for `GOAL`, `PROJECT`, `MILESTONE`, `TASK`, `CHECKLIST_ITEM`, `CHECKLIST_TEMPLATE`, and `REWARD_REDEMPTION` with privacy filtering on `/api/v1/sync/pull`. |
| 12 | **Database Migrations & Schema Protection** | **COMPLETE (v1-v3)** | `FamilyOSDatabase.kt` | 39 Room entities and `MIGRATION_1_2` + `MIGRATION_2_3` are intact. Stage 3.3.2 must preserve all 39 entities and existing migrations without destructive resets. |

---

## 2. Detailed Gap Analysis & Stage 3.3.2 Implementation Plan

### 2.1 Unified 7-Tier Hierarchy
`Family Mission` → `Family Vision` → `Goals` → `Projects` → `Milestones` → `Tasks` → `Checklists`
- Extend authoritative store and Android domain models so every `Goal` can link to `missionAlignment` and `visionAlignment`, every `Project` links to a parent `Goal`, every `Milestone` links to a parent `Project` (and `Goal`), every `Task` links to `goalId`, `projectId`, `milestoneId`, and `sourceModule`, and every `Checklist` item rolls up cleanly into its parent `Task`.

### 2.2 Canonical `productivity_tasks` Across All Modules
- Maintain one canonical task collection (`tasks` in Room / `TASK` in authoritative backend) with `sourceModule` supporting:
  - `GOALS_PROJECTS`
  - `HOME_MANAGEMENT`
  - `MARRIAGE`
  - `PARENTING`
  - `SPIRITUAL_GROWTH`
  - `FAMILY_GOVERNANCE`
  - `PERSONAL_PLANNING`
- Zero duplicate module-specific task tables will be created.

### 2.3 Privacy, Scopes & Governance
- **`PERSONAL` scope**: Visible and mutable **only** by `ownerMemberId` / `creatorMemberId` (even `OWNER`/`ADMIN` cannot read another adult's personal goals, projects, or tasks).
- **`COUPLE` scope**: Visible and mutable only by couple/adult leadership (`OWNER`, `ADMIN`, or members with `SPOUSE`/`SELF` relationship); strictly hidden from `CHILD` and `GUEST`.
- **`FAMILY` / `SHARED` scope**: Visible to active family members; `GUEST` is strictly read-only; `CHILD` can complete assigned tasks/checklists and create personal tasks, but cannot delete shared family goals/projects or reconfigure rewards.
- **`REVOKED` members**: Immediately blocked (`403 MEMBERSHIP_REVOKED`) across all planning, calendar, and sync endpoints.
