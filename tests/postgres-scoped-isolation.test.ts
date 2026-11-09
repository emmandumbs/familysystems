process.env.NODE_ENV = 'test';

import assert from 'node:assert/strict';
import {
  isPostgresPersistenceActive,
  getFamilyWorkspaceContext,
  getFinanceDomainData,
  getHouseholdDomainData,
  getFamilySectionData,
  insertTransactionScoped,
  reverseTransactionScoped,
  recordSavingsContributionScoped,
  updateChoreCompletionScoped,
  updatePantryItemScoped,
  updateMealPlanScoped,
  syncEntityScoped,
  softDeleteScopedEntity,
} from '../src/server/postgresRepositories';
import { setPostgresConnectionVerifiedForTest } from '../src/server/postgresMigrationAndBackup';

interface ExecutedSqlRecord {
  sql: string;
  params: any[];
}

/**
 * Creates a recording database client that verifies tenant isolation and records all queries.
 */
function createRecordingMockDbClient(tenantData: {
  workspaces?: any[];
  members?: any[];
  memberships?: any[];
  accounts?: any[];
  transactions?: any[];
  budgets?: any[];
  savingsGoals?: any[];
  householdRecords?: any[];
  mediaAssets?: any[];
  syncEntities?: any[];
}) {
  const executedQueries: ExecutedSqlRecord[] = [];

  const mockClient = {
    executedQueries,
    query: async (sqlText: string, params: any[] = []) => {
      const normalizedSql = sqlText.trim().replace(/\s+/g, ' ');
      executedQueries.push({ sql: normalizedSql, params });

      // Handle transactions
      if (normalizedSql === 'BEGIN' || normalizedSql === 'COMMIT' || normalizedSql === 'ROLLBACK') {
        return { rows: [], rowCount: 0 };
      }

      // SELECT from family_workspaces
      if (normalizedSql.includes('FROM family_workspaces')) {
        const familyId = params[0];
        const match = (tenantData.workspaces || []).filter((w) => w.id === familyId);
        return { rows: match, rowCount: match.length };
      }

      // SELECT from family_members
      if (normalizedSql.includes('FROM family_members')) {
        const familyId = params[0];
        const match = (tenantData.members || []).filter((m) => m.family_id === familyId);
        return { rows: match, rowCount: match.length };
      }

      // SELECT from family_memberships
      if (normalizedSql.includes('FROM family_memberships')) {
        const familyId = params[0];
        const match = (tenantData.memberships || []).filter((m) => m.family_id === familyId);
        return { rows: match, rowCount: match.length };
      }

      const targetFamilyId = params.find((p) => String(p).startsWith('family-')) || params[0];

      // SELECT from financial_accounts
      if (normalizedSql.includes('FROM financial_accounts')) {
        const idParam = params.find((p) => String(p).startsWith('acc-'));
        const match = (tenantData.accounts || []).filter(
          (a) => a.family_id === targetFamilyId && (!idParam || a.id === idParam)
        );
        return { rows: match, rowCount: match.length };
      }

      // SELECT from financial_transactions
      if (normalizedSql.includes('FROM financial_transactions')) {
        if (normalizedSql.includes('reversal_of_id =')) {
          const revTarget = params[0];
          const match = (tenantData.transactions || []).filter(
            (t) => t.family_id === targetFamilyId && t.reversal_of_id === revTarget
          );
          return { rows: match, rowCount: match.length };
        }
        const idParam = params.find((p) => String(p).startsWith('tx-'));
        const match = (tenantData.transactions || []).filter(
          (t) => t.family_id === targetFamilyId && (!idParam || t.id === idParam)
        );
        return { rows: match, rowCount: match.length };
      }

      // SELECT from financial_budgets
      if (normalizedSql.includes('FROM financial_budgets')) {
        const match = (tenantData.budgets || []).filter((b) => b.family_id === targetFamilyId);
        return { rows: match, rowCount: match.length };
      }

      // SELECT from savings_goals
      if (normalizedSql.includes('FROM savings_goals')) {
        const idParam = params.find((p) => String(p).startsWith('sg-'));
        const match = (tenantData.savingsGoals || []).filter(
          (s) => s.family_id === targetFamilyId && (!idParam || s.id === idParam)
        );
        return { rows: match, rowCount: match.length };
      }

      // SELECT from household_records
      if (normalizedSql.includes('FROM household_records')) {
        const familyId = params[0];
        const match = (tenantData.householdRecords || []).filter((h) => h.family_id === familyId);
        return { rows: match, rowCount: match.length };
      }

      // SELECT from media_assets
      if (normalizedSql.includes('FROM media_assets')) {
        const familyId = params[0];
        const match = (tenantData.mediaAssets || []).filter((m) => m.family_id === familyId);
        return { rows: match, rowCount: match.length };
      }

      // SELECT from synchronized_entities
      if (normalizedSql.includes('FROM synchronized_entities')) {
        const entityKey = params.find((p) => !String(p).startsWith('family-'));
        const match = (tenantData.syncEntities || []).filter(
          (e) => e.family_id === targetFamilyId && (!entityKey || e.entity_key === entityKey)
        );
        return { rows: match, rowCount: match.length };
      }

      // DML (INSERT, UPDATE, DELETE)
      return { rows: [], rowCount: 1 };
    },
  };

  return mockClient;
}

async function runScopedPostgresIsolationTests() {
  console.log('--- Starting Scoped PostgreSQL Repositories & Tenant Isolation Tests ---');

  // Test 1: Storage mode & connection detection
  console.log('1. Testing storage mode & connection verification helpers...');
  assert.strictEqual(
    typeof isPostgresPersistenceActive,
    'function',
    'isPostgresPersistenceActive should be a function'
  );
  setPostgresConnectionVerifiedForTest(false);
  assert.strictEqual(isPostgresPersistenceActive({ FAMILYOS_STORAGE_MODE: 'file' }), false);
  assert.strictEqual(isPostgresPersistenceActive({ FAMILYOS_STORAGE_MODE: 'postgres' }), false);
  setPostgresConnectionVerifiedForTest(true);
  assert.strictEqual(
    isPostgresPersistenceActive({
      FAMILYOS_STORAGE_MODE: 'postgres',
      SQL_HOST: 'localhost',
      SQL_DB_NAME: 'testdb',
      SQL_USER: 'postgres',
      SQL_PASSWORD: 'secretpassword',
    }),
    true
  );

  // Fixtures across two isolated tenant families: family-A and family-B
  const mockTenantData = {
    workspaces: [
      { id: 'family-A', name: 'Alpha Family', owner_user_id: 'usr-a', status: 'ACTIVE', version: 1 },
      { id: 'family-B', name: 'Beta Family', owner_user_id: 'usr-b', status: 'ACTIVE', version: 1 },
    ],
    members: [
      { id: 'mem-a1', family_id: 'family-A', display_name: 'Alice Alpha', role: 'OWNER' },
      { id: 'mem-b1', family_id: 'family-B', display_name: 'Bob Beta', role: 'OWNER' },
    ],
    memberships: [
      { id: 'm-a1', family_id: 'family-A', user_account_id: 'usr-a', status: 'ACTIVE' },
      { id: 'm-b1', family_id: 'family-B', user_account_id: 'usr-b', status: 'ACTIVE' },
    ],
    accounts: [
      { id: 'acc-a1', family_id: 'family-A', name: 'Alpha Checking', current_balance_cents: '500000', account_type: 'CHECKING' },
      { id: 'acc-b1', family_id: 'family-B', name: 'Beta Checking', current_balance_cents: '900000', account_type: 'CHECKING' },
    ],
    transactions: [
      { id: 'tx-a1', family_id: 'family-A', account_id: 'acc-a1', title: 'Alpha Groceries', amount_cents: '12000', transaction_type: 'EXPENSE', category: 'FOOD', transaction_date: Date.now() },
      { id: 'tx-b1', family_id: 'family-B', account_id: 'acc-b1', title: 'Beta Rent', amount_cents: '250000', transaction_type: 'EXPENSE', category: 'HOUSING', transaction_date: Date.now() },
    ],
    budgets: [
      { id: 'b-a1', family_id: 'family-A', category: 'FOOD', allocated_cents: '50000', spent_cents: '12000' },
      { id: 'b-b1', family_id: 'family-B', category: 'HOUSING', allocated_cents: '300000', spent_cents: '250000' },
    ],
    savingsGoals: [
      { id: 'sg-a1', family_id: 'family-A', title: 'Alpha Vacation', target_cents: '100000', current_cents: '25000' },
      { id: 'sg-b1', family_id: 'family-B', title: 'Beta Emergency', target_cents: '500000', current_cents: '100000' },
    ],
    householdRecords: [
      { id: 'PANTRY:pan-a1', family_id: 'family-A', record_domain: 'PANTRY', payload_json: { id: 'pan-a1', itemName: 'Alpha Milk', quantity: 2 } },
      { id: 'PANTRY:pan-b1', family_id: 'family-B', record_domain: 'PANTRY', payload_json: { id: 'pan-b1', itemName: 'Beta Cereal', quantity: 1 } },
    ],
    mediaAssets: [
      { id: 'media-a1', family_id: 'family-A', owner_member_id: 'mem-a1', visibility: 'SHARED', file_name: 'alpha.jpg', size_bytes: 1024, data_url: 'data:image/jpeg;base64,...' },
      { id: 'media-b1', family_id: 'family-B', owner_member_id: 'mem-b1', visibility: 'SHARED', file_name: 'beta.jpg', size_bytes: 2048, data_url: 'data:image/jpeg;base64,...' },
    ],
    syncEntities: [
      { entity_key: 'GOAL:g-a1', id: 'g-a1', family_id: 'family-A', entity_type: 'GOAL', version: 1, data_json: { title: 'Alpha Goal' } },
      { entity_key: 'GOAL:g-b1', id: 'g-b1', family_id: 'family-B', entity_type: 'GOAL', version: 1, data_json: { title: 'Beta Goal' } },
    ],
  };

  // Test 2: Scoped workspace read strictly filters by family_id
  console.log('2. Testing getFamilyWorkspaceContext strictly filters by family_id...');
  const clientA = createRecordingMockDbClient(mockTenantData);
  const contextA = await getFamilyWorkspaceContext(clientA, 'family-A');
  assert.strictEqual(contextA.workspace?.id, 'family-A');
  assert.strictEqual(contextA.members.length, 1);
  assert.strictEqual(contextA.members[0].displayName, 'Alice Alpha');
  // Verify that EVERY executed SQL statement had family-A as a parameter
  for (const q of clientA.executedQueries) {
    assert.ok(
      q.params.includes('family-A'),
      `Workspace context query should parameterize family-A: ${q.sql}`
    );
    assert.ok(
      !q.params.includes('family-B'),
      `Workspace context query for family-A must NEVER reference family-B: ${q.sql}`
    );
  }

  // Test 3: Scoped finance domain read strictly filters by family_id
  console.log('3. Testing getFinanceDomainData strictly filters by family_id...');
  const clientFin = createRecordingMockDbClient(mockTenantData);
  const finA = await getFinanceDomainData(clientFin, 'family-A');
  assert.strictEqual(finA.accounts.length, 1);
  assert.strictEqual(finA.accounts[0].name, 'Alpha Checking');
  assert.strictEqual(finA.transactions.length, 1);
  assert.strictEqual(finA.transactions[0].title, 'Alpha Groceries');
  assert.strictEqual(finA.budgets.length, 1);
  assert.strictEqual(finA.savingsGoals.length, 1);
  for (const q of clientFin.executedQueries) {
    assert.ok(
      q.params.includes('family-A'),
      `Finance query must parameterize family-A: ${q.sql}`
    );
    assert.ok(
      !q.params.includes('family-B'),
      `Finance query for family-A must never reference family-B: ${q.sql}`
    );
  }

  // Test 4: Scoped transaction insertion only touches family-A
  console.log('4. Testing insertTransactionScoped only affects family-A...');
  const clientTx = createRecordingMockDbClient(mockTenantData);
  const insertedTx = await insertTransactionScoped(clientTx, 'family-A', {
    id: 'tx-new-a2',
    accountId: 'acc-a1',
    title: 'New Alpha Coffee',
    amountCents: 450n,
    transactionType: 'EXPENSE',
    category: 'FOOD',
    transactionDate: Date.now(),
  });
  assert.strictEqual(insertedTx.id, 'tx-new-a2');
  assert.strictEqual(insertedTx.familyId, 'family-A');
  assert.strictEqual(insertedTx.amountCentsDecimal, '450');

  // Verify that all executed queries contain family-A and never family-B
  const txQueries = clientTx.executedQueries.filter(
    (q) => !['BEGIN', 'COMMIT', 'ROLLBACK'].includes(q.sql)
  );
  for (const q of txQueries) {
    assert.ok(
      q.params.includes('family-A'),
      `Transaction mutation must be scoped to family-A: ${q.sql} [params: ${JSON.stringify(q.params)}]`
    );
    assert.ok(
      !q.params.includes('family-B'),
      `Transaction mutation for family-A must never touch family-B: ${q.sql}`
    );
  }

  // Test 5: Reversal mutation strictly touches family-A
  console.log('5. Testing reverseTransactionScoped strictly scoped to family-A...');
  const clientRev = createRecordingMockDbClient(mockTenantData);
  const reversed = await reverseTransactionScoped(clientRev, 'family-A', 'tx-a1', {
    reversalTxId: 'tx-rev-a1',
    reason: 'Duplicate entry',
  });
  assert.strictEqual(reversed.id, 'tx-rev-a1');
  assert.strictEqual(reversed.reversalOfId, 'tx-a1');
  assert.strictEqual(reversed.familyId, 'family-A');
  const revQueries = clientRev.executedQueries.filter(
    (q) => !['BEGIN', 'COMMIT', 'ROLLBACK'].includes(q.sql)
  );
  for (const q of revQueries) {
    assert.ok(
      q.params.includes('family-A'),
      `Reversal query must parameterize family-A: ${q.sql}`
    );
    assert.ok(
      !q.params.includes('family-B'),
      `Reversal query for family-A must never parameterize family-B: ${q.sql}`
    );
  }

  // Test 6: Scoped savings contribution mutation strictly touches family-A
  console.log('6. Testing recordSavingsContributionScoped strictly scoped to family-A...');
  const clientSg = createRecordingMockDbClient(mockTenantData);
  const sgContrib = await recordSavingsContributionScoped(clientSg, 'family-A', 'sg-a1', {
    amountCents: 5000n,
    fundingAccountId: 'acc-a1',
    contributedBy: 'Alice Alpha',
  });
  assert.strictEqual(sgContrib.goalId, 'sg-a1');
  assert.strictEqual(sgContrib.familyId, 'family-A');
  const sgQueries = clientSg.executedQueries.filter(
    (q) => !['BEGIN', 'COMMIT', 'ROLLBACK'].includes(q.sql)
  );
  for (const q of sgQueries) {
    assert.ok(
      q.params.includes('family-A'),
      `Savings contribution query must parameterize family-A: ${q.sql}`
    );
    assert.ok(
      !q.params.includes('family-B'),
      `Savings contribution query for family-A must never parameterize family-B: ${q.sql}`
    );
  }

  // Test 7: Scoped chore completion only touches family-A
  console.log('7. Testing updateChoreCompletionScoped only affects family-A...');
  const clientChore = createRecordingMockDbClient(mockTenantData);
  const comp = await updateChoreCompletionScoped(clientChore, 'family-A', 'chore-a1', {
    completedByMemberId: 'mem-a1',
    pointsAwarded: 25,
  });
  assert.strictEqual(comp.familyId, 'family-A');
  assert.strictEqual(comp.choreId, 'chore-a1');
  const choreQueries = clientChore.executedQueries.filter(
    (q) => !['BEGIN', 'COMMIT', 'ROLLBACK'].includes(q.sql)
  );
  for (const q of choreQueries) {
    assert.ok(
      q.params.includes('family-A'),
      `Chore completion query must parameterize family-A: ${q.sql}`
    );
    assert.ok(
      !q.params.includes('family-B'),
      `Chore completion query for family-A must never touch family-B: ${q.sql}`
    );
  }

  // Test 8: Scoped pantry item and meal plan mutations only touch family-A
  console.log('8. Testing pantry and meal plan scoped mutations only touch family-A...');
  const clientPantry = createRecordingMockDbClient(mockTenantData);
  const pantryRes = await updatePantryItemScoped(clientPantry, 'family-A', {
    id: 'pan-new-a1',
    name: 'Organic Apples',
    category: 'PRODUCE',
    quantity: 6,
    unit: 'pieces',
  });
  assert.strictEqual(pantryRes.familyId, 'family-A');
  for (const q of clientPantry.executedQueries.filter((q) => !['BEGIN', 'COMMIT', 'ROLLBACK'].includes(q.sql))) {
    assert.ok(q.params.includes('family-A'));
    assert.ok(!q.params.includes('family-B'));
  }

  const clientMeal = createRecordingMockDbClient(mockTenantData);
  const mealRes = await updateMealPlanScoped(clientMeal, 'family-A', {
    id: 'meal-new-a1',
    planDate: Date.now(),
    mealType: 'DINNER',
    customMealName: 'Family Pasta Night',
    servings: 4,
  });
  assert.strictEqual(mealRes.familyId, 'family-A');
  for (const q of clientMeal.executedQueries.filter((q) => !['BEGIN', 'COMMIT', 'ROLLBACK'].includes(q.sql))) {
    assert.ok(q.params.includes('family-A'));
    assert.ok(!q.params.includes('family-B'));
  }

  // Test 9: Optimistic locking and 409 VERSION_CONFLICT detection in syncEntityScoped
  console.log('9. Testing syncEntityScoped optimistic locking and 409 conflict detection...');
  const clientSync = createRecordingMockDbClient(mockTenantData);

  // Successful sync with matching baseVersion = 1
  const syncSuccess = await syncEntityScoped(clientSync, 'family-A', {
    entityKey: 'GOAL:g-a1',
    id: 'g-a1',
    entityType: 'GOAL',
    data: { title: 'Updated Alpha Goal', status: 'IN_PROGRESS' },
    baseVersion: 1,
  });
  assert.strictEqual(syncSuccess.nextVersion, 2);
  assert.strictEqual(syncSuccess.record.familyId, 'family-A');

  // Conflict sync with stale baseVersion = 0 when server version is 1
  let conflictCaught = false;
  try {
    await syncEntityScoped(clientSync, 'family-A', {
      entityKey: 'GOAL:g-a1',
      id: 'g-a1',
      entityType: 'GOAL',
      data: { title: 'Stale update' },
      baseVersion: 0, // Stale base version
    });
  } catch (err: any) {
    conflictCaught = true;
    assert.strictEqual(err.code, 'VERSION_CONFLICT');
    assert.strictEqual(err.statusCode, 409);
    assert.strictEqual(err.serverVersion, 1);
  }
  assert.strictEqual(conflictCaught, true, 'syncEntityScoped should throw 409 VERSION_CONFLICT on stale baseVersion');

  // Test 10: Parameterized soft-delete strictly scopes to family_id
  console.log('10. Testing softDeleteScopedEntity strictly scopes to family_id...');
  const clientSoftDel = createRecordingMockDbClient(mockTenantData);
  const softDelRes = await softDeleteScopedEntity(clientSoftDel, 'pantry_items', 'family-A', 'pan-a1');
  assert.strictEqual(softDelRes, true);
  for (const q of clientSoftDel.executedQueries) {
    assert.ok(q.params.includes('family-A'));
    assert.ok(!q.params.includes('family-B'));
    assert.ok(q.sql.includes('UPDATE pantry_items SET is_deleted = TRUE'));
  }

  console.log('--- All Scoped PostgreSQL Repositories & Tenant Isolation Tests Passed! ---');
}

runScopedPostgresIsolationTests().catch((err) => {
  console.error('Scoped PostgreSQL integration test failed:', err);
  process.exit(1);
});
