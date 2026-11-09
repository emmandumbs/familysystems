/**
 * verify-inventory-locations-and-print.ts
 *
 * Verifies:
 * 1. GET /api/v1/household/:familyId/pantry/meta (retrieves default and custom locations/categories)
 * 2. POST /api/v1/household/:familyId/pantry/locations (adds custom location e.g. "Basement Root Cellar")
 * 3. POST /api/v1/household/:familyId/pantry/categories (adds custom category e.g. "EMERGENCY RATIONS")
 * 4. POST /api/v1/household/:familyId/pantry (creates item assigned to the custom location and category)
 * 5. GET /api/v1/household/:familyId/pantry (verifies item is in list with proper metadata)
 * 6. DELETE /api/v1/household/:familyId/pantry/locations/:location (removes custom location)
 * 7. DELETE /api/v1/household/:familyId/pantry/categories/:category (removes custom category)
 * 8. Comprehensive retrieval of all 7 household datasets for PDF/Print compilation
 */

async function testInventoryLocationsAndPrint() {
  const baseUrl = 'http://127.0.0.1:3000';
  console.log('Testing Inventory Locations, Categories & Print Data at:', baseUrl);

  // Authenticate as OWNER
  const authRes = await fetch(`${baseUrl}/api/v1/auth/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userAccountId: 'usr-sarah-owner', requestedRole: 'OWNER' }),
  });
  if (!authRes.ok) throw new Error(`Auth failed: ${authRes.status}`);
  const authData = await authRes.json();
  const sessionToken = authData.token || authData.sessionToken;
  const familyId = authData.membership?.familyId || 'fam-1';
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${sessionToken}`,
  };
  console.log('✓ Obtained session token for family:', familyId);

  // 1. Get pantry metadata
  console.log('\n--- 1. Testing GET /pantry/meta ---');
  const metaRes = await fetch(`${baseUrl}/api/v1/household/${familyId}/pantry/meta`, { headers });
  if (!metaRes.ok) throw new Error(`Failed to get pantry meta: ${metaRes.status}`);
  const meta = await metaRes.json();
  console.log(`✓ Fetched metadata: ${meta.locations.length} locations, ${meta.categories.length} categories`);
  if (!Array.isArray(meta.locations) || !Array.isArray(meta.categories)) {
    throw new Error('Pantry metadata response missing locations or categories array');
  }

  // 2. Add custom location
  console.log('\n--- 2. Testing POST /pantry/locations (Add custom location) ---');
  const customLoc = 'Wine & Preserve Cellar Room 3';
  const addLocRes = await fetch(`${baseUrl}/api/v1/household/${familyId}/pantry/locations`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ location: customLoc }),
  });
  if (!addLocRes.ok) throw new Error(`Failed to add location: ${addLocRes.status}`);
  const addLocData = await addLocRes.json();
  if (!addLocData.locations.includes(customLoc)) {
    throw new Error(`Expected location list to contain ${customLoc}`);
  }
  console.log(`✓ Added custom location: "${customLoc}"`);

  // 3. Add custom category
  console.log('\n--- 3. Testing POST /pantry/categories (Add custom category) ---');
  const customCat = 'ARTISAN PRESERVES';
  const addCatRes = await fetch(`${baseUrl}/api/v1/household/${familyId}/pantry/categories`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ category: customCat }),
  });
  if (!addCatRes.ok) throw new Error(`Failed to add category: ${addCatRes.status}`);
  const addCatData = await addCatRes.json();
  if (!addCatData.categories.includes(customCat)) {
    throw new Error(`Expected category list to contain ${customCat}`);
  }
  console.log(`✓ Added custom category: "${customCat}"`);

  // 4. Create pantry item with the custom location and custom category
  console.log('\n--- 4. Testing Item Creation with Custom Location & Category ---');
  const createItemRes = await fetch(`${baseUrl}/api/v1/household/${familyId}/pantry`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      itemName: 'Vintage Fig & Port Jam Jar',
      category: customCat,
      storageLocation: customLoc,
      quantity: 12,
      unit: 'jars',
      reorderThreshold: 3,
      costEstimate: 8.50,
      expiryDate: Date.now() + 180 * 86400000,
    }),
  });
  if (!createItemRes.ok) throw new Error(`Failed to create inventory item: ${createItemRes.status}`);
  const itemData = await createItemRes.json();
  const createdItem = itemData.pantryItem || itemData.item;
  if (!createdItem) throw new Error(`Missing pantryItem in response: ${JSON.stringify(itemData)}`);
  if (createdItem.storageLocation !== customLoc || createdItem.category !== customCat) {
    throw new Error('Created item did not preserve custom location or category');
  }
  console.log(`✓ Created item: "${createdItem.itemName}" in location "${createdItem.storageLocation}" under category "${createdItem.category}"`);

  // 5. Query pantry and check response metadata
  console.log('\n--- 5. Testing GET /pantry returns items and metadata ---');
  const pantryRes = await fetch(`${baseUrl}/api/v1/household/${familyId}/pantry`, { headers });
  if (!pantryRes.ok) throw new Error(`Failed to get pantry items: ${pantryRes.status}`);
  const pantryData = await pantryRes.json();
  const foundItem = pantryData.pantry.find((i: { id: string }) => i.id === createdItem.id);
  if (!foundItem) throw new Error('Created item not found in pantry list');
  if (!pantryData.locations.includes(customLoc) || !pantryData.categories.includes(customCat)) {
    throw new Error('Pantry response does not include custom location or category in metadata');
  }
  console.log(`✓ Verified pantry contains ${pantryData.pantry.length} items and current locations & categories`);

  // 6. Delete custom location
  console.log('\n--- 6. Testing DELETE /pantry/locations/:locationName ---');
  const delLocRes = await fetch(`${baseUrl}/api/v1/household/${familyId}/pantry/locations/${encodeURIComponent(customLoc)}`, {
    method: 'DELETE',
    headers,
  });
  if (!delLocRes.ok) throw new Error(`Failed to delete location: ${delLocRes.status}`);
  const delLocData = await delLocRes.json();
  if (delLocData.locations.includes(customLoc)) {
    throw new Error(`Location was not deleted`);
  }
  console.log(`✓ Deleted custom location "${customLoc}"`);

  // 7. Delete custom category
  console.log('\n--- 7. Testing DELETE /pantry/categories/:categoryName ---');
  const delCatRes = await fetch(`${baseUrl}/api/v1/household/${familyId}/pantry/categories/${encodeURIComponent(customCat)}`, {
    method: 'DELETE',
    headers,
  });
  if (!delCatRes.ok) throw new Error(`Failed to delete category: ${delCatRes.status}`);
  const delCatData = await delCatRes.json();
  if (delCatData.categories.includes(customCat)) {
    throw new Error(`Category was not deleted`);
  }
  console.log(`✓ Deleted custom category "${customCat}"`);

  // 8. Test all 7 Household domains are accessible for PDF/Print dossiers
  console.log('\n--- 8. Testing All 7 Household Domains for PDF/Print Readiness ---');
  const [meals, recipes, pantry, groceries, chores, wardrobe, assets] = await Promise.all([
    fetch(`${baseUrl}/api/v1/household/${familyId}/meals`, { headers }).then(r => r.json()),
    fetch(`${baseUrl}/api/v1/household/${familyId}/recipes`, { headers }).then(r => r.json()),
    fetch(`${baseUrl}/api/v1/household/${familyId}/pantry`, { headers }).then(r => r.json()),
    fetch(`${baseUrl}/api/v1/household/${familyId}/groceries`, { headers }).then(r => r.json()),
    fetch(`${baseUrl}/api/v1/household/${familyId}/chores`, { headers }).then(r => r.json()),
    fetch(`${baseUrl}/api/v1/household/${familyId}/wardrobe`, { headers }).then(r => r.json()),
    fetch(`${baseUrl}/api/v1/household/${familyId}/assets`, { headers }).then(r => r.json()),
  ]);

  console.log(`✓ Print Dossier Data Ready:`);
  console.log(`  - 7-Day Meals: ${meals.meals?.length ?? 0} scheduled meals`);
  console.log(`  - Full Recipes: ${recipes.recipes?.length ?? 0} master recipes`);
  console.log(`  - Inventory Items: ${pantry.pantry?.length ?? 0} items across ${pantry.locations?.length ?? 0} locations`);
  console.log(`  - Smart Groceries: ${groceries.groceries?.length ?? 0} items`);
  console.log(`  - Chores & Checklists: ${chores.chores?.length ?? 0} chores`);
  console.log(`  - Wardrobe & Laundry: ${wardrobe.wardrobe?.length ?? 0} garments`);
  console.log(`  - Home Assets & Maintenance: ${assets.assets?.length ?? 0} assets`);

  console.log('\n🎉 ALL INVENTORY LOCATIONS, CATEGORIES & PRINT VERIFICATIONS PASSED!\n');
}

testInventoryLocationsAndPrint().catch((err) => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
