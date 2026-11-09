# FAMILYOS — STAGE 3.2 IMPLEMENTATION PLAN
**Stage**: STAGE 3.2 — Backend Production Hardening & Cross-Platform Verification  
**Prerequisite Audit**: `STAGE_3_2_BACKEND_AUDIT.md`  
**Status**: AWAITING APPROVAL BEFORE DESTRUCTIVE CHANGES OR MIGRATIONS

---

## 1. Architectural Resolution & Authoritative Database Selection

### 1.1 Findings on Existing Infrastructure
- **No External Lovable/Supabase Backend Present**: Inspection of `package.json`, `.env.example`, `src/`, and `android/` confirmed there is no Supabase/Lovable project configured in this repository.
- **Native AI Studio + Android Ecosystem**:
  - The Android app (`android/app/build.gradle.kts:110–113`) already declares `firebase-bom`, `firebase-auth-ktx`, `firebase-firestore-ktx`, and `firebase-storage-ktx`.
  - The Android auth layer (`FirebaseAuthRepository.kt`) is already written for Firebase Authentication.
  - The Web + API server (`server.ts` + `src/App.tsx`) runs on Express + Vite in Google AI Studio / Cloud Run.

### 1.2 Authoritative Database Strategy
To provide a single authoritative production database shared by Android (`Kotlin + Jetpack Compose + Encrypted Room`) and Web (`React + Express`) while respecting zero-cost/low-cost infrastructure constraints:
1. **Primary Authoritative Cloud Store**: **Firebase (Cloud Firestore + Firebase Authentication)** provisioned via the AI Studio Firebase integration (`set_up_firebase` / `firebase-integration-rpc`), providing:
   - Unified identity (`uid`, email, verified ID tokens) across Android and Web.
   - ACID batch writes and document transactions for financial accounts, transactions, envelope budgets, and audit logs.
   - Persistent cloud storage that survives Cloud Run container restarts and redeployments.
2. **Transactional Server Gateway (`/api/v1/*` in `server.ts`)**:
   - All writes and reads pass through an atomic `AuthoritativeDataGateway` with an in-process mutex lock and transactional commit log, backed by Firestore in production and deterministic atomic snapshot persistence (`data/familyos-authoritative-store.json` + write-ahead backup in `data/backups/`) for local offline/CI test execution.

---

## 2. Backup, Migration & Rollback Plan (Zero Data Loss Guarantee)

Before migrating any existing data in `data/familyos-shared-store.json` or upgrading the store schema:
1. **Pre-Migration Snapshot Backup**:
   - Create a timestamped backup copy at `data/backups/familyos-shared-store.pre-3.2.<timestamp>.bak.json`.
   - Compute and record the SHA-256 checksum of the backup file in `data/backups/manifest.json`.
2. **Non-Destructive Schema Promotion (v3.1 -> v3.2)**:
   - Preserve existing `workspace` (`fam-1`), `accounts` (`acc-1`, `acc-2`, `acc-3`), `budgets` (`b-1`..`b-4`), `transactions` (`tx-1`..`tx-3`), `acknowledgedKeys`, and `auditEvents`.
   - Add authoritative collections for:
     - `users` & `memberships` (linking authenticated user IDs to `familyId`, `memberId`, and `role`: `OWNER`, `ADMIN`, `MEMBER`, `CHILD`, `GUEST`, plus `status`: `ACTIVE` | `REVOKED` and `invitations`).
     - `guardianRelationships` (linking `guardianMemberId` -> `minorMemberId` with `canManageHealthRecords`).
     - `tasks`, `checklistItems`, `chores`, `mealPlans`, `recipes`, `groceryItems`, `wellbeingProfiles`, `allergies`, `medications`, `reflectionJournals`, `emergencyContacts`, and `emergencyPlans`.
3. **Deterministic Rollback Procedure**:
   - If post-migration integrity verification fails (e.g., net worth cent mismatch, missing transaction, or checksum error), the migration engine automatically restores `data/backups/familyos-shared-store.pre-3.2.<timestamp>.bak.json` to `data/familyos-shared-store.json` and aborts startup with a diagnostic report.

---

## 3. Phased Implementation Plan

### Phase 1: Server-Side Authentication & Zero-Trust RBAC Middleware (`server.ts`)
- **Objective**: Eliminate all trust in client-supplied `actorRole`, `familyId`, and `memberId`.
- **Implementation**:
  1. Implement `authenticateRequest` middleware on `/api/v1/*`:
     - Extracts `Authorization: Bearer <token>` header.
     - Verifies the token against the authoritative session/Firebase identity registry (`uid` -> `UserAccount`).
     - Rejects unauthenticated requests with `HTTP 401 UNAUTHORIZED`.
  2. Implement `authorizeFamilyAccess(requiredOperation)` middleware:
     - Resolves the caller's `FamilyMembership` for the target `familyId` from the authoritative server database (never from `req.body`).
     - Rejects non-members or cross-family requests (`fam-other-999`) with `HTTP 403 WORKSPACE_ISOLATION_VIOLATION`.
     - Rejects `REVOKED` or `SUSPENDED` memberships with `HTTP 403 MEMBERSHIP_REVOKED`.
  3. Enforce domain-specific role & ownership rules on the server:
     - **Financial Ledger (`/api/v1/finance/*` and sync `INCOME`/`EXPENSE`/`TRANSFER`/`REVERSAL`/`FINANCIAL_ACCOUNT`)**: Only `OWNER` and `ADMIN` with `ACTIVE` membership are permitted (`HTTP 403 PERMISSION_DENIED` for `MEMBER`, `CHILD`, `GUEST`).
     - **Minor Health & Wellbeing Records (`wellbeing_profiles`, `health_allergies`, `health_medications`)**: Only accessible/mutable by `OWNER`, `ADMIN`, or a member with a verified `guardian_relationships` record (`canManageHealthRecords === true`) for that minor (`HTTP 403 GUARDIAN_AUTHORIZATION_REQUIRED`).
     - **Personal Private Records (`reflection_journals` with `isPrivate === true`)**: Only readable/writable by the owning `memberId` linked to the authenticated `userAccountId`.
     - **Chores & Tasks**: `CHILD` and `MEMBER` can complete tasks/chores assigned to them or unassigned chores, but cannot delete household goals, manage members, or modify financial accounts.
     - **Invitations & Membership Management**: Restricted strictly to `OWNER` and `ADMIN`.

### Phase 2: Financial Ledger Hardening & Atomic Idempotency (`server.ts` & Android `Stage3RepositoriesImpl.kt` / `Stage3Daos.kt`)
- **Objective**: Guarantee zero duplicate transactions, zero duplicate reversals, exact integer-cent math, and atomic multi-entity updates under concurrent load.
- **Implementation**:
  1. **Mandatory Transaction Idempotency**:
     - Require `idempotencyKey` (via `X-Idempotency-Key` header or `req.body.idempotencyKey`) on `POST /api/v1/finance/transaction` and `POST /api/v1/finance/reverse`.
     - Store full idempotent response receipts (`acknowledgedOperations[idempotencyKey]`) on the server. If the same `idempotencyKey` is submitted again (due to retry or double-tap), return the original transaction receipt with `deduplicated: true` without mutating account or budget balances a second time.
  2. **Serialized Atomic Ledger Execution**:
     - Wrap all store mutations in an async mutex transaction lock (`withAtomicTransaction(store => { ... })`) with atomic temp-file write + rename (`fs.writeFileSync(tmpPath)` -> `fs.renameSync(tmpPath, STORE_FILE)`) and Firestore batch commit so concurrent requests cannot interleave or corrupt balances.
  3. **Duplicate Reversal Prevention (Server + Android Room)**:
     - On `server.ts`: Enforce that `original.isReversal === false` AND no existing transaction has `reversalOfId === original.id`.
     - On Android (`Stage3Daos.kt` & `Stage3RepositoriesImpl.kt:68–90`): Add `getReversalForTransaction(originalId: String): FinancialTransactionEntity?` in `FinanceDao` and check it inside `FinanceRepositoryImpl.reverseTransaction()` so local offline reversals also block duplicate reversals of the same original transaction.

### Phase 3: Bi-Directional Offline Sync & Conflict Resolution (`server.ts`, `SyncManager.kt`, `SyncWorker.kt`, `FamilyOSViewModel.kt`)
- **Objective**: Enable full bi-directional cross-platform synchronization (`push` + `pull`) with explicit server conflict resolution and offline revocation handling.
- **Implementation**:
  1. **Server Conflict Resolution Engine (`POST /api/v1/sync/push`)**:
     - `EVENT_BASED_MERGE` (`TASK`, `CHECKLIST_ITEM`, `CHORE`): Merge completion states and checklist items additively by timestamp without clobbering sibling items.
     - `APPEND_ONLY_LEDGER` (`INCOME`, `EXPENSE`, `TRANSFER`, `REVERSAL`, `FINANCIAL_ACCOUNT`): Enforce role check (`OWNER`/`ADMIN`), apply idempotency check, append immutable transaction, and atomically update account balance + budget spent cents. Reject direct overwrites/deletes of posted transactions (`400 IMMUTABLE_LEDGER_VIOLATION`).
     - `SERVER_AUTHORITATIVE` (`FAMILY_MEMBERSHIP`, `INVITATION`): Verify `OWNER`/`ADMIN` role before applying membership or role updates.
     - `TOMBSTONE_SOFT_DELETE` (`RECIPE`, `MEAL_PLAN`, `GOAL`, `ASSET`, etc.): Set `isDeleted = true` and increment `version` so deletions propagate across devices.
  2. **Delta Pull Endpoint (`GET /api/v1/sync/pull?familyId=...&sinceVersion=...`)**:
     - Returns authenticated family workspace entities modified since `sinceVersion` (filtering out restricted minor medical records and private journals unauthorized for the caller).
  3. **Android Authenticated Sync & Revocation Quarantine (`SyncWorker.kt` & `SyncManager.kt`)**:
     - Attach `Authorization: Bearer <token>` in `HttpRemoteSyncGateway`.
     - If server responds with `403 MEMBERSHIP_REVOKED`, mark the operation as `QUARANTINED_REVOKED` in `sync_queue` so `SyncWorker` stops retrying unauthorized mutations.

### Phase 4: Cross-Platform Verification & Recovery Test Suite (Tests A–G)
- **Objective**: Execute and record real automated cross-platform and security verification tests (`scripts/verify-stage-3-2.ts`) against the live server and Android test suites:
  - **Test A (Android -> Web)**: Simulate Android `HttpRemoteSyncGateway` pushing a task, chore completion, and financial transaction -> verify Web `/api/v1/workspace/:familyId` reflects exact updated state.
  - **Test B (Web -> Android)**: Create/update a shared record via Web API -> pull via Android sync gateway (`GET /api/v1/sync/pull`) -> verify payload matches Room entity contract.
  - **Test C (Offline Android -> Reconnect -> Web)**: Queue operations while offline -> reconnect and drain queue -> verify zero duplicates on retry -> verify Web state.
  - **Test D (Financial Reversal Cross-Platform)**: Create expense (`14250` cents) -> verify account balance and `FOOD` budget `spentCents` -> reverse expense -> verify compensating entry (`isReversal: true, reversalOfId`), restored account balance, restored budget `spentCents`, and rejection of second reversal (`HTTP 400`).
  - **Test E (Role Enforcement)**: Verify `CHILD` and `GUEST` tokens receive `HTTP 403` on financial mutations, minor medical profiles, and member management across both REST endpoints and `/api/v1/sync/push`.
  - **Test F (Family Isolation)**: Verify an authenticated user in `fam-2` requesting or mutating `fam-1` receives `HTTP 403 WORKSPACE_ISOLATION_VIOLATION`.
  - **Test G (Restart & Recovery)**: Restart the backend server process, reload state from durable storage, verify idempotency keys still block duplicate replays, and verify backup/restore checksum integrity.

---

## 4. Approval Gate

Per your Stage 3.2 instructions:
> *"First inspect and report the existing backend architecture. Identify the best database option using the existing project infrastructure and cost constraints. Prepare the implementation plan and wait for approval before performing destructive changes or migrations."*

Please confirm whether you approve:
1. Provisioning **Firebase (Firestore + Authentication)** as the shared authoritative production database (or whether you prefer hardening the Express backend with transactional SQLite/atomic store first without cloud provisioning), and
2. Executing **Phases 1–4 of `STAGE_3_2_IMPLEMENTATION_PLAN.md`**.
