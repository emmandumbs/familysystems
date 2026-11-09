import assert from 'assert';
import fs from 'fs';
import path from 'path';
import type { Server } from 'http';
import { createApp } from '../server';
import { rollbackToPre32Backup, ensurePre32BackupAndMigrate } from '../src/server/backupAndMigration';

interface TestResult {
  phase: 'MIGRATION' | 'PHASE_1' | 'PHASE_2' | 'PHASE_3' | 'PHASE_4';
  code: string;
  name: string;
  passed: boolean;
  evidence: string;
}

const results: TestResult[] = [];

function recordResult(
  phase: TestResult['phase'],
  code: string,
  name: string,
  passed: boolean,
  evidence: string
) {
  results.push({ phase, code, name, passed, evidence });
  const badge = passed ? 'PASS' : 'FAIL';
  console.log(`[${badge}] [${phase}] ${code} — ${name}: ${evidence}`);
  if (!passed) {
    throw new Error(`Verification gate failed at ${code} (${name}): ${evidence}`);
  }
}

async function runVerification() {
  // Reset store state from backup prior to verification
  rollbackToPre32Backup();
  // Start an isolated test instance of the production Express app on an ephemeral port
  const app = await createApp();
  const server: Server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const addr = server.address();
  const port = typeof addr === 'object' && addr ? addr.port : 3099;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // Helper to acquire signed session token for any seeded user account
    async function getToken(userAccountId: string): Promise<string> {
      const res = await fetch(`${baseUrl}/api/v1/auth/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userAccountId }),
      });
      assert.strictEqual(res.status, 200, `Expected 200 acquiring token for ${userAccountId}`);
      const body = (await res.json()) as { token: string };
      return body.token;
    }

    const ownerToken = await getToken('usr-sarah-owner'); // OWNER in fam-1
    const adminToken = await getToken('usr-david-admin'); // ADMIN in fam-1
    const memberToken = await getToken('usr-maya-member'); // MEMBER in fam-1
    const childToken = await getToken('usr-lucas-child'); // CHILD in fam-1
    const guestToken = await getToken('usr-martha-guest'); // GUEST in fam-1
    const revokedToken = await getToken('usr-former-babysitter'); // REVOKED in fam-1
    const fam2OwnerToken = await getToken('usr-carter-owner'); // OWNER in fam-2

    // =========================================================================
    // MIGRATION & BACKUP PROTECTION VERIFICATION
    // =========================================================================
    {
      const backupRes = await fetch(`${baseUrl}/api/v1/admin/backup-status`, {
        headers: { Authorization: `Bearer ${ownerToken}` },
      });
      const backupBody = (await backupRes.json()) as any;
      recordResult(
        'MIGRATION',
        'MIG-1',
        'Pre-3.2 Backup & SHA-256 Reconciliation Checksum',
        backupRes.status === 200 && backupBody.backupVerified === true && backupBody.manifest.netWorthCents === 12540000,
        `status=${backupRes.status}, backupVerified=${backupBody.backupVerified}, sha256=${backupBody.actualSha256}, netWorthCents=${backupBody.manifest?.netWorthCents}`
      );
    }

    // =========================================================================
    // PHASE 1 — ZERO-TRUST SERVER AUTHENTICATION & RBAC MIDDLEWARE
    // =========================================================================
    {
      // P1-1: Unauthenticated request rejected with HTTP 401
      const unauthWorkspace = await fetch(`${baseUrl}/api/v1/workspace/fam-1`);
      recordResult(
        'PHASE_1',
        'P1-1',
        'Unauthenticated Workspace Read Blocked (HTTP 401)',
        unauthWorkspace.status === 401,
        `GET /api/v1/workspace/fam-1 without Bearer token -> HTTP ${unauthWorkspace.status}`
      );

      // P1-2: Forged Bearer token rejected with HTTP 401
      const forgedRes = await fetch(`${baseUrl}/api/v1/workspace/fam-1`, {
        headers: { Authorization: 'Bearer forged.jwt.signature' },
      });
      recordResult(
        'PHASE_1',
        'P1-2',
        'Forged Bearer Token Blocked (HTTP 401)',
        forgedRes.status === 401,
        `GET /api/v1/workspace/fam-1 with forged token -> HTTP ${forgedRes.status}`
      );

      // P1-3: Client-supplied actorRole="OWNER" from CHILD token is ignored and blocked (HTTP 403)
      const spoofedChildFinance = await fetch(`${baseUrl}/api/v1/finance/transaction`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${childToken}`,
          'X-Idempotency-Key': 'spoof-child-tx-1',
        },
        body: JSON.stringify({
          familyId: 'fam-1',
          accountId: 'acc-1',
          title: 'Spoofed Toy Purchase',
          amountCents: 9900,
          transactionType: 'EXPENSE',
          category: 'FOOD',
          actorRole: 'OWNER', // Attempted privilege escalation!
        }),
      });
      const spoofedBody = (await spoofedChildFinance.json()) as any;
      recordResult(
        'PHASE_1',
        'P1-3',
        'Client actorRole="OWNER" Spoofing by CHILD Blocked (HTTP 403)',
        spoofedChildFinance.status === 403 && spoofedBody.error === 'PERMISSION_DENIED',
        `POST /api/v1/finance/transaction by CHILD with actorRole=OWNER -> HTTP ${spoofedChildFinance.status} (${spoofedBody.error})`
      );

      // P1-4: Guardian health protection for minor child (mem-lucas)
      const guardianHealthRes = await fetch(`${baseUrl}/api/v1/wellbeing/fam-1/mem-lucas`, {
        headers: { Authorization: `Bearer ${ownerToken}` },
      });
      const nonGuardianHealthRes = await fetch(`${baseUrl}/api/v1/wellbeing/fam-1/mem-lucas`, {
        headers: { Authorization: `Bearer ${memberToken}` }, // Maya (sibling, not guardian)
      });
      const guestHealthRes = await fetch(`${baseUrl}/api/v1/wellbeing/fam-1/mem-lucas`, {
        headers: { Authorization: `Bearer ${guestToken}` }, // Grandma Martha (GUEST)
      });
      recordResult(
        'PHASE_1',
        'P1-4',
        'Minor Health Records Restricted to Verified Guardians Only',
        guardianHealthRes.status === 200 && nonGuardianHealthRes.status === 403 && guestHealthRes.status === 403,
        `Guardian OWNER=${guardianHealthRes.status}, Non-Guardian MEMBER=${nonGuardianHealthRes.status}, GUEST=${guestHealthRes.status}`
      );

      // P1-5: Private reflection journal restricted strictly to owning member
      const mayaJournalRes = await fetch(`${baseUrl}/api/v1/journal/fam-1/rj-maya-private`, {
        headers: { Authorization: `Bearer ${memberToken}` }, // Maya owns rj-maya-private
      });
      const ownerSnoopingJournalRes = await fetch(`${baseUrl}/api/v1/journal/fam-1/rj-maya-private`, {
        headers: { Authorization: `Bearer ${ownerToken}` }, // Sarah (OWNER) cannot read Maya's private journal
      });
      recordResult(
        'PHASE_1',
        'P1-5',
        'Private Reflection Journal Restricted Strictly to Owning Member',
        mayaJournalRes.status === 200 && ownerSnoopingJournalRes.status === 403,
        `Journal Owner (Maya)=${mayaJournalRes.status}, Non-Owner Parent (Sarah)=${ownerSnoopingJournalRes.status}`
      );

      // P1-6: Live Cloud Firestore Security Rules Reject Unauthenticated Direct Access
      const firestoreRestUrl = `https://firestore.googleapis.com/v1/projects/gen-lang-client-0741697651/databases/ai-studio-familyos-8f842ec0-cec0-443c-b279-e4955acacfaf/documents/workspaces/fam-1`;
      const directFirestoreRead = await fetch(firestoreRestUrl);
      recordResult(
        'PHASE_1',
        'P1-6',
        'Deployed Cloud Firestore Rules Reject Unauthenticated Direct Document Read (HTTP 403)',
        directFirestoreRead.status === 403,
        `Direct unauthenticated GET to Cloud Firestore database ai-studio-familyos-8f842ec0-cec0-443c-b279-e4955acacfaf -> HTTP ${directFirestoreRead.status}`
      );
    }

    // =========================================================================
    // PHASE 2 — ATOMIC AND IDEMPOTENT FINANCIAL ENGINE
    // =========================================================================
    {
      // P2-1: Missing idempotencyKey rejected with HTTP 400
      const noIdempRes = await fetch(`${baseUrl}/api/v1/finance/transaction`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ownerToken}`,
        },
        body: JSON.stringify({
          familyId: 'fam-1',
          accountId: 'acc-1',
          title: 'Missing Idempotency Key Tx',
          amountCents: 1500,
          transactionType: 'EXPENSE',
          category: 'FOOD',
        }),
      });
      recordResult(
        'PHASE_2',
        'P2-1',
        'Missing Idempotency Key Rejected (HTTP 400)',
        noIdempRes.status === 400,
        `POST /api/v1/finance/transaction without idempotencyKey -> HTTP ${noIdempRes.status}`
      );

      // P2-2: Floating-point amountCents rejected with HTTP 400
      const floatRes = await fetch(`${baseUrl}/api/v1/finance/transaction`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ownerToken}`,
          'X-Idempotency-Key': 'float-check-1',
        },
        body: JSON.stringify({
          familyId: 'fam-1',
          accountId: 'acc-1',
          title: 'Float Cents Attempt',
          amountCents: 19.99,
          transactionType: 'EXPENSE',
          category: 'FOOD',
        }),
      });
      recordResult(
        'PHASE_2',
        'P2-2',
        'Floating-Point amountCents Rejected (Zero Float Drift)',
        floatRes.status === 400,
        `POST /api/v1/finance/transaction with amountCents=19.99 -> HTTP ${floatRes.status}`
      );

      // P2-3: Idempotent Transaction Replay (3 identical requests debit balance & budget ONCE)
      const beforeWs = await (
        await fetch(`${baseUrl}/api/v1/workspace/fam-1`, {
          headers: { Authorization: `Bearer ${ownerToken}` },
        })
      ).json();
      const beforeChecking = beforeWs.accounts.find((a: any) => a.id === 'acc-1').currentBalanceCents;
      const beforeFoodSpent = beforeWs.budgets.find((b: any) => b.category === 'FOOD').spentCents;

      const idempKey = 'phase2-idemp-expense-5000';
      const payload = {
        familyId: 'fam-1',
        accountId: 'acc-1',
        title: 'Idempotent Bakery Expense',
        amountCents: 5000,
        transactionType: 'EXPENSE',
        category: 'FOOD',
        idempotencyKey: idempKey,
      };

      const call1 = await fetch(`${baseUrl}/api/v1/finance/transaction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ownerToken}` },
        body: JSON.stringify(payload),
      });
      const body1 = (await call1.json()) as any;

      const call2 = await fetch(`${baseUrl}/api/v1/finance/transaction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ownerToken}` },
        body: JSON.stringify(payload),
      });
      const body2 = (await call2.json()) as any;

      const afterWs = await (
        await fetch(`${baseUrl}/api/v1/workspace/fam-1`, {
          headers: { Authorization: `Bearer ${ownerToken}` },
        })
      ).json();
      const afterChecking = afterWs.accounts.find((a: any) => a.id === 'acc-1').currentBalanceCents;
      const afterFoodSpent = afterWs.budgets.find((b: any) => b.category === 'FOOD').spentCents;

      recordResult(
        'PHASE_2',
        'P2-3',
        'Idempotent Replay Deduplication & Exact Single Balance/Budget Mutation',
        call1.status === 201 &&
          call2.status === 200 &&
          body2.deduplicated === true &&
          body1.transaction.id === body2.transaction.id &&
          afterChecking === beforeChecking - 5000 &&
          afterFoodSpent === beforeFoodSpent + 5000,
        `call1=${call1.status}, call2=${call2.status} (deduplicated=${body2.deduplicated}), checkingDelta=${afterChecking - beforeChecking}, foodSpentDelta=${afterFoodSpent - beforeFoodSpent}`
      );

      // P2-4: Atomic Internal Transfer preserves net household worth (net delta = 0)
      const preTransferNetWorth = afterWs.netWorth.netWorthCents;
      const transferRes = await fetch(`${baseUrl}/api/v1/finance/transaction`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`, // David (ADMIN)
          'X-Idempotency-Key': 'phase2-transfer-25000',
        },
        body: JSON.stringify({
          familyId: 'fam-1',
          accountId: 'acc-1',
          destinationAccountId: 'acc-2',
          title: 'Monthly Savings Sweep Transfer',
          amountCents: 25000,
          transactionType: 'TRANSFER',
          category: 'TRANSFER',
        }),
      });
      const postTransferWs = await (
        await fetch(`${baseUrl}/api/v1/workspace/fam-1`, {
          headers: { Authorization: `Bearer ${ownerToken}` },
        })
      ).json();
      recordResult(
        'PHASE_2',
        'P2-4',
        'Atomic Internal Transfer Preserves Net Worth (Net Impact = 0 Cents)',
        transferRes.status === 201 && postTransferWs.netWorth.netWorthCents === preTransferNetWorth,
        `status=${transferRes.status}, preNetWorth=${preTransferNetWorth}, postNetWorth=${postTransferWs.netWorth.netWorthCents}`
      );
    }

    // =========================================================================
    // PHASE 3 — BIDIRECTIONAL SYNCHRONIZATION & CONFLICT RESOLUTION
    // =========================================================================
    {
      // P3-1: EVENT_BASED_MERGE merges checklist items additively
      const pushTask1 = await fetch(`${baseUrl}/api/v1/sync/push`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ownerToken}`,
          'X-Idempotency-Key': 'sync-task-merge-1',
        },
        body: JSON.stringify({
          operationId: 'op-merge-1',
          idempotencyKey: 'sync-task-merge-1',
          familyId: 'fam-1',
          entityType: 'TASK',
          entityId: 'task-shared-101',
          operationType: 'INSERT',
          payloadJson: {
            title: 'Pack Family Camping Gear',
            checklistItems: { tent: true, stove: false },
          },
        }),
      });

      const pushTask2 = await fetch(`${baseUrl}/api/v1/sync/push`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${memberToken}`,
          'X-Idempotency-Key': 'sync-task-merge-2',
        },
        body: JSON.stringify({
          operationId: 'op-merge-2',
          idempotencyKey: 'sync-task-merge-2',
          familyId: 'fam-1',
          entityType: 'TASK',
          entityId: 'task-shared-101',
          operationType: 'UPDATE',
          payloadJson: {
            checklistItems: { stove: true, sleepingBags: true },
          },
        }),
      });

      const pullAfterMerge = await (
        await fetch(`${baseUrl}/api/v1/sync/pull?familyId=fam-1&sinceTimestamp=0`, {
          headers: { Authorization: `Bearer ${ownerToken}` },
        })
      ).json();
      const mergedTask = pullAfterMerge.entities.find((e: any) => e.id === 'task-shared-101');
      const checklist = mergedTask?.data?.checklistItems || {};

      recordResult(
        'PHASE_3',
        'P3-1',
        'EVENT_BASED_MERGE Additively Merges Concurrent Checklist Updates',
        pushTask1.status === 200 &&
          pushTask2.status === 200 &&
          checklist.tent === true &&
          checklist.stove === true &&
          checklist.sleepingBags === true,
        `mergedChecklist=${JSON.stringify(checklist)}, version=${mergedTask?.version}`
      );

      // P3-2: APPEND_ONLY_LEDGER blocks UPDATE/DELETE of posted transactions via sync
      const illegalLedgerOverwrite = await fetch(`${baseUrl}/api/v1/sync/push`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ownerToken}`,
          'X-Idempotency-Key': 'sync-illegal-overwrite-tx1',
        },
        body: JSON.stringify({
          operationId: 'op-illegal-1',
          idempotencyKey: 'sync-illegal-overwrite-tx1',
          familyId: 'fam-1',
          entityType: 'EXPENSE',
          entityId: 'tx-1',
          operationType: 'DELETE',
          payloadJson: {},
        }),
      });
      const illegalBody = (await illegalLedgerOverwrite.json()) as any;
      recordResult(
        'PHASE_3',
        'P3-2',
        'APPEND_ONLY_LEDGER Rejects Direct Transaction Overwrite/Delete (HTTP 400)',
        illegalLedgerOverwrite.status === 400 && illegalBody.errorCode === 'IMMUTABLE_LEDGER_VIOLATION',
        `status=${illegalLedgerOverwrite.status}, errorCode=${illegalBody.errorCode}`
      );

      // P3-3: TOMBSTONE_SOFT_DELETE propagates deletion tombstones in sync pull
      await fetch(`${baseUrl}/api/v1/sync/push`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ownerToken}`,
          'X-Idempotency-Key': 'sync-recipe-create-1',
        },
        body: JSON.stringify({
          operationId: 'op-rec-1',
          idempotencyKey: 'sync-recipe-create-1',
          familyId: 'fam-1',
          entityType: 'RECIPE',
          entityId: 'rec-temp-99',
          operationType: 'INSERT',
          payloadJson: { title: 'Temporary Recipe' },
        }),
      });
      await fetch(`${baseUrl}/api/v1/sync/push`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ownerToken}`,
          'X-Idempotency-Key': 'sync-recipe-delete-1',
        },
        body: JSON.stringify({
          operationId: 'op-rec-2',
          idempotencyKey: 'sync-recipe-delete-1',
          familyId: 'fam-1',
          entityType: 'RECIPE',
          entityId: 'rec-temp-99',
          operationType: 'DELETE',
          payloadJson: { isDeleted: true },
        }),
      });
      const pullAfterDelete = await (
        await fetch(`${baseUrl}/api/v1/sync/pull?familyId=fam-1&sinceTimestamp=0`, {
          headers: { Authorization: `Bearer ${ownerToken}` },
        })
      ).json();
      const tombstoneRecipe = pullAfterDelete.entities.find((e: any) => e.id === 'rec-temp-99');
      recordResult(
        'PHASE_3',
        'P3-3',
        'TOMBSTONE_SOFT_DELETE Propagates Tombstone (isDeleted=true, version=2)',
        tombstoneRecipe?.isDeleted === true && tombstoneRecipe?.version === 2,
        `entityId=${tombstoneRecipe?.id}, isDeleted=${tombstoneRecipe?.isDeleted}, version=${tombstoneRecipe?.version}`
      );

      // P3-4: Revoked member offline sync rejected with HTTP 403 MEMBERSHIP_REVOKED
      const revokedSyncRes = await fetch(`${baseUrl}/api/v1/sync/push`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${revokedToken}`,
          'X-Idempotency-Key': 'sync-revoked-attempt-1',
        },
        body: JSON.stringify({
          operationId: 'op-revoked-1',
          idempotencyKey: 'sync-revoked-attempt-1',
          familyId: 'fam-1',
          entityType: 'CHORE',
          entityId: 'chore-1',
          operationType: 'UPDATE',
          payloadJson: { isCompleted: true },
        }),
      });
      const revokedSyncBody = (await revokedSyncRes.json()) as any;
      recordResult(
        'PHASE_3',
        'P3-4',
        'Revoked Member Offline Sync Rejected with MEMBERSHIP_REVOKED (HTTP 403)',
        revokedSyncRes.status === 403 && revokedSyncBody.errorCode === 'MEMBERSHIP_REVOKED',
        `status=${revokedSyncRes.status}, errorCode=${revokedSyncBody.errorCode}`
      );
    }

    // =========================================================================
    // PHASE 4 — CROSS-PLATFORM VERIFICATION TESTS A–G
    // =========================================================================
    {
      // TEST A: Android -> Web (Android pushes Chore, Meal Plan, Emergency Contact -> Web reflects all)
      const androidEntities = [
        {
          idempotencyKey: 'testA-chore-1',
          entityType: 'CHORE',
          entityId: 'chore-android-1',
          payloadJson: { title: 'Clean Garage Workbench', rewardPoints: 25, isCompleted: true },
        },
        {
          idempotencyKey: 'testA-meal-1',
          entityType: 'MEAL_PLAN',
          entityId: 'meal-android-1',
          payloadJson: { customMealTitle: 'Wild Salmon & Asparagus', mealType: 'DINNER', servings: 4 },
        },
        {
          idempotencyKey: 'testA-emergency-1',
          entityType: 'EMERGENCY_CONTACT',
          entityId: 'ec-android-1',
          payloadJson: { name: 'Westfield Fire Dispatch', phonePrimary: '555-911-0000' },
        },
      ];

      for (const item of androidEntities) {
        const res = await fetch(`${baseUrl}/api/v1/sync/push`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${ownerToken}`,
            'X-Idempotency-Key': item.idempotencyKey,
          },
          body: JSON.stringify({
            operationId: `op-${item.idempotencyKey}`,
            idempotencyKey: item.idempotencyKey,
            familyId: 'fam-1',
            entityType: item.entityType,
            entityId: item.entityId,
            operationType: 'INSERT',
            payloadJson: item.payloadJson,
          }),
        });
        assert.strictEqual(res.status, 200);
      }

      const webWorkspaceAfterA = await (
        await fetch(`${baseUrl}/api/v1/workspace/fam-1`, {
          headers: { Authorization: `Bearer ${ownerToken}` },
        })
      ).json();
      const syncedIds = (webWorkspaceAfterA.synchronizedEntities || []).map((e: any) => e.id);
      recordResult(
        'PHASE_4',
        'TEST-A',
        'Android -> Web Multi-Entity Sync Reflection',
        syncedIds.includes('chore-android-1') &&
          syncedIds.includes('meal-android-1') &&
          syncedIds.includes('ec-android-1'),
        `Web /api/v1/workspace/fam-1 contains Android-pushed entities: chore-android-1, meal-android-1, ec-android-1`
      );

      // TEST B: Web -> Android (Web creates/updates shared entity -> Android pulls delta via /api/v1/sync/pull)
      const beforePullTime = Date.now() - 50;
      const webCreateRes = await fetch(`${baseUrl}/api/v1/entities/fam-1`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          entityType: 'MEAL_PLAN',
          entityId: 'meal-web-sunday',
          operationType: 'UPSERT',
          data: {
            customMealTitle: 'Sunday Roast Chicken & Root Vegetables',
            mealType: 'DINNER',
            servings: 6,
          },
        }),
      });
      const androidDeltaPull = await (
        await fetch(`${baseUrl}/api/v1/sync/pull?familyId=fam-1&sinceTimestamp=${beforePullTime}`, {
          headers: { Authorization: `Bearer ${childToken}` }, // Lucas (CHILD) pulling shared family meal plan
        })
      ).json();
      const pulledMeal = (androidDeltaPull.entities || []).find((e: any) => e.id === 'meal-web-sunday');
      recordResult(
        'PHASE_4',
        'TEST-B',
        'Web -> Android Delta Pull Synchronization',
        webCreateRes.status === 200 &&
          pulledMeal?.data?.customMealTitle === 'Sunday Roast Chicken & Root Vegetables',
        `Android /api/v1/sync/pull received Web entity meal-web-sunday (version=${pulledMeal?.version})`
      );

      // TEST C: Offline Android Queue -> Reconnect & Retry -> Zero Duplicates on Web
      const offlineBatchKey = 'testC-offline-expense-3200';
      const offlinePayload = {
        operationId: 'op-offline-c1',
        idempotencyKey: offlineBatchKey,
        familyId: 'fam-1',
        entityType: 'EXPENSE',
        entityId: 'tx-offline-c1',
        operationType: 'INSERT',
        payloadJson: {
          accountId: 'acc-1',
          title: 'Offline Hardware Store Purchase',
          amountCents: 3200,
          category: 'HOUSING',
        },
      };
      const firstSyncAttempt = await (
        await fetch(`${baseUrl}/api/v1/sync/push`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${ownerToken}`,
            'X-Idempotency-Key': offlineBatchKey,
          },
          body: JSON.stringify(offlinePayload),
        })
      ).json();
      const retrySyncAttempt = await (
        await fetch(`${baseUrl}/api/v1/sync/push`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${ownerToken}`,
            'X-Idempotency-Key': offlineBatchKey,
          },
          body: JSON.stringify(offlinePayload),
        })
      ).json();
      const wsAfterC = await (
        await fetch(`${baseUrl}/api/v1/workspace/fam-1`, {
          headers: { Authorization: `Bearer ${ownerToken}` },
        })
      ).json();
      const matchingOfflineTxs = wsAfterC.transactions.filter((t: any) => t.id === 'tx-offline-c1');
      recordResult(
        'PHASE_4',
        'TEST-C',
        'Offline Android Queue Drain & Reconnect Retry Produces Zero Duplicates',
        firstSyncAttempt.acknowledged === true &&
          firstSyncAttempt.deduplicated === false &&
          retrySyncAttempt.acknowledged === true &&
          retrySyncAttempt.deduplicated === true &&
          matchingOfflineTxs.length === 1,
        `firstAck.deduplicated=${firstSyncAttempt.deduplicated}, retryAck.deduplicated=${retrySyncAttempt.deduplicated}, ledgerCountForTx=${matchingOfflineTxs.length}`
      );

      // TEST D: Financial Reversal Cross-Platform (Post Expense -> Reverse -> Verify Balance, Budget & Duplicate Block)
      const wsBeforeD = await (
        await fetch(`${baseUrl}/api/v1/workspace/fam-1`, {
          headers: { Authorization: `Bearer ${ownerToken}` },
        })
      ).json();
      const acc1BeforeD = wsBeforeD.accounts.find((a: any) => a.id === 'acc-1').currentBalanceCents;
      const diningBeforeD = wsBeforeD.budgets.find((b: any) => b.category === 'DINING').spentCents;

      const expResD = await (
        await fetch(`${baseUrl}/api/v1/finance/transaction`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${ownerToken}`,
            'X-Idempotency-Key': 'testD-dining-expense-6400',
          },
          body: JSON.stringify({
            id: 'tx-testD-6400',
            familyId: 'fam-1',
            accountId: 'acc-1',
            title: 'Family Pizza Night',
            amountCents: 6400,
            transactionType: 'EXPENSE',
            category: 'DINING',
          }),
        })
      ).json();

      const rev1Res = await fetch(`${baseUrl}/api/v1/finance/reverse`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ownerToken}`,
          'X-Idempotency-Key': 'testD-reverse-1',
        },
        body: JSON.stringify({
          transactionId: expResD.transaction.id,
          reason: 'Merchant refunded duplicate charge',
        }),
      });
      const rev1Body = (await rev1Res.json()) as any;

      const rev2DuplicateRes = await fetch(`${baseUrl}/api/v1/finance/reverse`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ownerToken}`,
          'X-Idempotency-Key': 'testD-reverse-2',
        },
        body: JSON.stringify({
          transactionId: expResD.transaction.id,
          reason: 'Second duplicate reversal attempt',
        }),
      });

      const wsAfterD = await (
        await fetch(`${baseUrl}/api/v1/workspace/fam-1`, {
          headers: { Authorization: `Bearer ${ownerToken}` },
        })
      ).json();
      const acc1AfterD = wsAfterD.accounts.find((a: any) => a.id === 'acc-1').currentBalanceCents;
      const diningAfterD = wsAfterD.budgets.find((b: any) => b.category === 'DINING').spentCents;

      recordResult(
        'PHASE_4',
        'TEST-D',
        'Cross-Platform Financial Reversal Restores Exact Cents & Blocks Duplicate Reversal',
        rev1Res.status === 201 &&
          rev1Body.reversal.isReversal === true &&
          rev1Body.reversal.reversalOfId === 'tx-testD-6400' &&
          rev2DuplicateRes.status === 400 &&
          acc1AfterD === acc1BeforeD &&
          diningAfterD === diningBeforeD,
        `rev1=${rev1Res.status}, rev2Duplicate=${rev2DuplicateRes.status}, acc1Restored=${acc1AfterD === acc1BeforeD} (${acc1AfterD}), diningRestored=${diningAfterD === diningBeforeD} (${diningAfterD})`
      );

      // TEST E: Role Enforcement Matrix (OWNER, ADMIN, MEMBER, CHILD, GUEST)
      const guestSyncRes = await fetch(`${baseUrl}/api/v1/sync/push`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${guestToken}`,
          'X-Idempotency-Key': 'testE-guest-write',
        },
        body: JSON.stringify({
          operationId: 'op-guest-1',
          idempotencyKey: 'testE-guest-write',
          familyId: 'fam-1',
          entityType: 'TASK',
          entityId: 'task-guest-1',
          operationType: 'INSERT',
          payloadJson: { title: 'Unauthorized Guest Task' },
        }),
      });
      const memberFinanceRes = await fetch(`${baseUrl}/api/v1/finance/transaction`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${memberToken}`,
          'X-Idempotency-Key': 'testE-member-finance',
        },
        body: JSON.stringify({
          familyId: 'fam-1',
          accountId: 'acc-1',
          title: 'Unauthorized Member Expense',
          amountCents: 1000,
          transactionType: 'EXPENSE',
          category: 'FOOD',
        }),
      });
      recordResult(
        'PHASE_4',
        'TEST-E',
        'Role Enforcement Matrix Across REST & Sync Endpoints',
        guestSyncRes.status === 403 && memberFinanceRes.status === 403,
        `GUEST sync push -> HTTP ${guestSyncRes.status}, MEMBER finance mutation -> HTTP ${memberFinanceRes.status}`
      );

      // TEST F: Family Workspace Isolation (fam-2 OWNER attempting to access or mutate fam-1)
      const crossFamilyRead = await fetch(`${baseUrl}/api/v1/workspace/fam-1`, {
        headers: { Authorization: `Bearer ${fam2OwnerToken}` },
      });
      const crossFamilyReadBody = (await crossFamilyRead.json()) as any;

      const crossFamilyWrite = await fetch(`${baseUrl}/api/v1/finance/transaction`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${fam2OwnerToken}`,
          'X-Idempotency-Key': 'testF-cross-family-write',
        },
        body: JSON.stringify({
          familyId: 'fam-1',
          accountId: 'acc-1',
          title: 'Cross-Family Attack',
          amountCents: 50000,
          transactionType: 'EXPENSE',
          category: 'FOOD',
        }),
      });
      recordResult(
        'PHASE_4',
        'TEST-F',
        'Strict Multi-Tenant Family Workspace Isolation (fam-2 -> fam-1 Blocked)',
        crossFamilyRead.status === 403 &&
          crossFamilyReadBody.error === 'WORKSPACE_ISOLATION_VIOLATION' &&
          crossFamilyWrite.status === 403,
        `fam-2 OWNER reading fam-1 -> HTTP ${crossFamilyRead.status} (${crossFamilyReadBody.error}); writing fam-1 -> HTTP ${crossFamilyWrite.status}`
      );

      // TEST G: Rollback & Clean Store Restoration Verification
      const restored = rollbackToPre32Backup();
      const restoredStoreDisk = JSON.parse(
        fs.readFileSync(path.resolve(process.cwd(), 'data/familyos-shared-store.json'), 'utf-8')
      );
      recordResult(
        'PHASE_4',
        'TEST-G',
        'Deterministic Rollback & Durable Recovery Verification',
        restored.accounts.length === 5 &&
          restored.transactions.length === 3 &&
          restoredStoreDisk.accounts[0].currentBalanceCents === 845250,
        `Rolled back to pre-3.2 baseline: accounts=${restored.accounts.length}, transactions=${restored.transactions.length}, acc-1=${restoredStoreDisk.accounts[0].currentBalanceCents} cents`
      );

      // Re-migrate store on disk so subsequent verification suites inherit full 3.3.3 schema
      const { migratedStore } = ensurePre32BackupAndMigrate(restored);
      fs.writeFileSync(
        path.resolve(process.cwd(), 'data/familyos-shared-store.json'),
        JSON.stringify(migratedStore, null, 2),
        'utf-8'
      );
    }

    console.log('\n================================================================');
    console.log(`ALL ${results.length}/${results.length} STAGE 3.2 VERIFICATION GATES PASSED!`);
    console.log('================================================================\n');
  } finally {
    server.close();
  }
}

runVerification().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});
