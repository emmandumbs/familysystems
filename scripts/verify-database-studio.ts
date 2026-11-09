/**
 * verify-database-studio.ts
 * Verifies end-to-end CRUD across Database Studio tables (both Direct Array and Synchronized Entity storage engines)
 */

async function main() {
  const baseUrl = 'http://127.0.0.1:3000';
  console.log('Testing Database Studio APIs at:', baseUrl);

  // 1. Get auth token
  const authRes = await fetch(`${baseUrl}/api/v1/auth/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userAccountId: 'usr-sarah-owner', requestedRole: 'OWNER' }),
  });
  if (!authRes.ok) {
    throw new Error(`Failed to obtain auth token: ${authRes.status} ${await authRes.text()}`);
  }
  const authBody = await authRes.json();
  const sessionToken = authBody.token || authBody.sessionToken;
  const familyId = authBody.membership?.familyId || 'fam-1';
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${sessionToken}`,
  };
  console.log('✓ Obtained session token for family:', familyId);

  // 2. Test GET metadata
  const metaRes = await fetch(`${baseUrl}/api/v1/database/${familyId}/meta`, { headers });
  if (!metaRes.ok) {
    throw new Error(`Failed to fetch database meta: ${metaRes.status} ${await metaRes.text()}`);
  }
  const meta = await metaRes.json();
  console.log(`✓ Fetched database metadata: ${meta.tables.length} tables registered across ${meta.categories.length} categories.`);
  if (meta.tables.length < 25) {
    throw new Error(`Expected at least 25 tables, got ${meta.tables.length}`);
  }

  // 3. Test Synchronized Entity Table CRUD (e.g., pantry_items)
  console.log('\n--- Testing Synchronized Entity Table: pantry_items ---');
  // CREATE
  const createPantryRes = await fetch(`${baseUrl}/api/v1/database/${familyId}/table/pantry_items`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: 'Organic Jasmine Rice 5kg',
      category: 'grains',
      quantity: 5,
      unit: 'kg',
      location: 'Main Pantry Shelf B',
      notes: 'Imported from Thailand',
    }),
  });
  if (!createPantryRes.ok) {
    throw new Error(`Failed to create pantry item: ${createPantryRes.status} ${await createPantryRes.text()}`);
  }
  const createdPantry = await createPantryRes.json();
  const pantryRecordId = createdPantry.record.id;
  console.log('✓ Successfully created pantry item with ID:', pantryRecordId);

  // FULL EDIT (PUT)
  const editPantryRes = await fetch(`${baseUrl}/api/v1/database/${familyId}/table/pantry_items/${pantryRecordId}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({
      name: 'Organic Jasmine Rice 5kg (Premium)',
      category: 'grains',
      quantity: 4.5,
      unit: 'kg',
      location: 'Main Pantry Shelf B - Airtight Container',
      notes: 'Opened on test run, 500g used',
    }),
  });
  if (!editPantryRes.ok) {
    throw new Error(`Failed to update pantry item: ${editPantryRes.status} ${await editPantryRes.text()}`);
  }
  const updatedPantry = await editPantryRes.json();
  if (updatedPantry.record.name !== 'Organic Jasmine Rice 5kg (Premium)' || updatedPantry.record.quantity !== 4.5) {
    throw new Error('Pantry item fields were not updated properly');
  }
  console.log('✓ Successfully full-edited pantry item. New name:', updatedPantry.record.name);

  // QUERY / SEARCH
  const queryPantryRes = await fetch(`${baseUrl}/api/v1/database/${familyId}/table/pantry_items?q=Jasmine`, { headers });
  if (!queryPantryRes.ok) {
    throw new Error(`Failed to search pantry items: ${queryPantryRes.status}`);
  }
  const queryPantry = await queryPantryRes.json();
  const foundPantry = queryPantry.records.find((r: any) => r.id === pantryRecordId);
  if (!foundPantry) {
    throw new Error('Created and edited pantry item not found in search query');
  }
  console.log('✓ Successfully queried and found updated record via search endpoint');

  // 4. Test Direct Array Table CRUD (e.g., savings_goals)
  console.log('\n--- Testing Direct Array Table: savings_goals ---');
  // CREATE
  const createGoalRes = await fetch(`${baseUrl}/api/v1/database/${familyId}/table/savings_goals`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: 'Family Summer Cabin Retreat',
      targetAmount: 3500,
      currentAmount: 850,
      targetDate: '2026-08-15',
      category: 'vacation',
    }),
  });
  if (!createGoalRes.ok) {
    throw new Error(`Failed to create savings goal: ${createGoalRes.status} ${await createGoalRes.text()}`);
  }
  const createdGoal = await createGoalRes.json();
  const goalRecordId = createdGoal.record.id;
  console.log('✓ Successfully created savings goal with ID:', goalRecordId);

  // FULL EDIT (PUT)
  const editGoalRes = await fetch(`${baseUrl}/api/v1/database/${familyId}/table/savings_goals/${goalRecordId}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({
      name: 'Family Summer Mountain Lake Cabin Retreat',
      targetAmount: 4000,
      currentAmount: 1200,
      targetDate: '2026-08-20',
      category: 'vacation',
    }),
  });
  if (!editGoalRes.ok) {
    throw new Error(`Failed to update savings goal: ${editGoalRes.status} ${await editGoalRes.text()}`);
  }
  const updatedGoal = await editGoalRes.json();
  if (updatedGoal.record.targetAmount !== 4000 || updatedGoal.record.currentAmount !== 1200) {
    throw new Error('Savings goal fields were not updated properly');
  }
  console.log('✓ Successfully full-edited savings goal. New target:', updatedGoal.record.targetAmount);

  // 5. Test Batch Import
  console.log('\n--- Testing Batch Import ---');
  const batchRes = await fetch(`${baseUrl}/api/v1/database/${familyId}/table/pantry_items/batch-import`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      records: [
        { name: 'Extra Virgin Olive Oil', category: 'oils', quantity: 2, unit: 'liters' },
        { name: 'Rolled Oats', category: 'grains', quantity: 1.5, unit: 'kg' },
      ],
    }),
  });
  if (!batchRes.ok) {
    throw new Error(`Batch import failed: ${batchRes.status} ${await batchRes.text()}`);
  }
  const batchData = await batchRes.json();
  console.log(`✓ Batch imported ${batchData.importedCount} records successfully.`);

  // 6. Test DELETE
  console.log('\n--- Testing Deletion ---');
  const deletePantryRes = await fetch(`${baseUrl}/api/v1/database/${familyId}/table/pantry_items/${pantryRecordId}`, {
    method: 'DELETE',
    headers,
  });
  if (!deletePantryRes.ok) {
    throw new Error(`Failed to delete pantry record: ${deletePantryRes.status}`);
  }
  console.log('✓ Successfully deleted pantry record');

  const deleteGoalRes = await fetch(`${baseUrl}/api/v1/database/${familyId}/table/savings_goals/${goalRecordId}`, {
    method: 'DELETE',
    headers,
  });
  if (!deleteGoalRes.ok) {
    throw new Error(`Failed to delete goal record: ${deleteGoalRes.status}`);
  }
  console.log('✓ Successfully deleted goal record');

  console.log('\n===========================================');
  console.log('ALL DATABASE STUDIO CRUD TESTS PASSED (100%)');
  console.log('===========================================');
}

main().catch((err) => {
  console.error('Database Studio verification failed:', err);
  process.exit(1);
});
