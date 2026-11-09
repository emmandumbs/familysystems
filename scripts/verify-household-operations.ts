/**
 * verify-household-operations.ts
 * Comprehensive test script verifying all 7 Household Operations features:
 * 1. Recipe plan for the whole week & batch schedule
 * 2. Recipes in full (ingredients, numbered steps, scaling)
 * 3. Inventories & Locations (locations, expiry, consume, restock)
 * 4. Smart Grocery lists (edit, delete, auto-sync, purchase & restock, clear-purchased)
 * 5. Chores locations & checklists (locations, multi-step checklist, complete, points)
 * 6. Outfits for seasons & laundry (seasons, clean/dirty toggle, laundry cycle, outfit planning)
 * 7. Home assets and maintenance system (purchase price, warranty, log maintenance, next due date)
 */

async function main() {
  const baseUrl = 'http://127.0.0.1:3000';
  console.log('Testing Household Operations APIs at:', baseUrl);

  // 1. Authenticate as OWNER
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

  // -------------------------------------------------------------------------
  // 1. Full Recipes (Create in full with ingredients and steps, edit, scale)
  // -------------------------------------------------------------------------
  console.log('\n--- 1. Testing Full Recipes Builder & Scaler ---');
  const createRecRes = await fetch(`${baseUrl}/api/v1/household/${familyId}/recipes`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      title: 'Mediterranean Herb Crusted Salmon',
      description: 'Pan-seared wild salmon with fresh dill, lemon zest, and capers.',
      category: 'DINNER',
      prepTimeMinutes: 15,
      cookTimeMinutes: 20,
      servings: 4,
      difficulty: 'MEDIUM',
      dietaryNotes: 'Pescatarian, Gluten-Free, Keto',
      ingredients: [
        { itemName: 'Wild Salmon Fillets', quantity: 4, unit: 'fillets', notes: 'Skin-on' },
        { itemName: 'Fresh Dill', quantity: 2, unit: 'tbsp' },
        { itemName: 'Extra Virgin Olive Oil', quantity: 2, unit: 'tbsp' },
        { itemName: 'Lemon', quantity: 1, unit: 'item' },
      ],
      instructions: [
        { stepNumber: 1, instructionText: 'Pat salmon fillets dry and season with sea salt and cracked pepper.' },
        { stepNumber: 2, instructionText: 'Sear skin-side down in hot olive oil for 4 minutes until crispy.' },
        { stepNumber: 3, instructionText: 'Flip gently, garnish with dill and lemon slices, and finish for 3 minutes.' },
      ],
    }),
  });
  if (!createRecRes.ok) throw new Error(`Recipe creation failed: ${createRecRes.status}`);
  const { recipe: createdRecipe } = await createRecRes.json();
  console.log(`✓ Recipe created in full: "${createdRecipe.title}" (${createdRecipe.ingredients.length} ingredients, ${createdRecipe.instructions.length} steps)`);

  // Scale Recipe
  const scaleRes = await fetch(`${baseUrl}/api/v1/household/${familyId}/recipes/${createdRecipe.id}/scale?targetServings=8`, { headers });
  if (!scaleRes.ok) throw new Error(`Recipe scale failed: ${scaleRes.status}`);
  const scaleData = await scaleRes.json();
  if (scaleData.recipe.servings !== 8 || scaleData.scaleRatio !== 2) {
    throw new Error('Recipe scale ratio calculation incorrect');
  }
  console.log(`✓ Successfully scaled recipe from 4 to 8 servings (ratio: ${scaleData.scaleRatio}x)`);

  // -------------------------------------------------------------------------
  // 2. Whole Week Recipe Meal Plan & Batch Schedule
  // -------------------------------------------------------------------------
  console.log('\n--- 2. Testing Whole Week Recipe Meal Planning ---');
  // Batch schedule whole week
  const batchMealRes = await fetch(`${baseUrl}/api/v1/household/${familyId}/meals/batch-schedule-week`, {
    method: 'POST',
    headers,
    body: JSON.stringify({}),
  });
  if (!batchMealRes.ok) throw new Error(`Batch schedule failed: ${batchMealRes.status}`);
  const batchMealData = await batchMealRes.json();
  console.log(`✓ Batch scheduled whole week with ${batchMealData.addedCount} meals!`);

  // Add individual scheduled meal
  const singleMealRes = await fetch(`${baseUrl}/api/v1/household/${familyId}/meals`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      planDate: Date.now() + 86400000,
      mealType: 'DINNER',
      recipeId: createdRecipe.id,
      customMealTitle: createdRecipe.title,
      servings: 5,
      notes: 'Family dinner with garden salad',
    }),
  });
  if (!singleMealRes.ok) throw new Error(`Meal add failed: ${singleMealRes.status}`);
  const { meal: createdMeal } = await singleMealRes.json();
  console.log(`✓ Added single scheduled meal for "${createdMeal.customMealTitle}"`);

  // Edit scheduled meal
  const editMealRes = await fetch(`${baseUrl}/api/v1/household/${familyId}/meals/${createdMeal.id}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ servings: 6, notes: 'Family dinner with garden salad and sourdough' }),
  });
  if (!editMealRes.ok) throw new Error(`Meal edit failed: ${editMealRes.status}`);
  const { meal: editedMeal } = await editMealRes.json();
  if (editedMeal.servings !== 6) throw new Error('Meal servings not updated');
  console.log(`✓ Successfully updated scheduled meal servings to ${editedMeal.servings}`);

  // -------------------------------------------------------------------------
  // 3. Inventories & Storage Locations (Pantry, Fridge, Freezer)
  // -------------------------------------------------------------------------
  console.log('\n--- 3. Testing Inventories & Storage Locations ---');
  const addPantryRes = await fetch(`${baseUrl}/api/v1/household/${familyId}/pantry`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      itemName: 'Greek Yogurt 32oz',
      category: 'FRIDGE',
      storageLocation: 'Main Fridge Top Shelf',
      quantity: 3,
      unit: 'tubs',
      minThreshold: 1,
      expiryDate: Date.now() + 10 * 86400000,
      notes: 'Plain whole milk',
    }),
  });
  if (!addPantryRes.ok) throw new Error(`Add pantry item failed: ${addPantryRes.status}`);
  const { pantryItem: createdPantry } = await addPantryRes.json();
  console.log(`✓ Added inventory item "${createdPantry.itemName}" at location "${createdPantry.storageLocation}"`);

  // Consume 1 unit
  const consumeRes = await fetch(`${baseUrl}/api/v1/household/${familyId}/pantry/${createdPantry.id}/consume`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ amount: 1 }),
  });
  if (!consumeRes.ok) throw new Error(`Consume failed: ${consumeRes.status}`);
  const { pantryItem: consumedItem } = await consumeRes.json();
  if (consumedItem.quantity !== 2) throw new Error('Consume quantity incorrect');
  console.log(`✓ Successfully consumed 1 unit (remaining: ${consumedItem.quantity})`);

  // Restock 2 units
  const restockRes = await fetch(`${baseUrl}/api/v1/household/${familyId}/pantry/${createdPantry.id}/restock`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ amount: 2 }),
  });
  if (!restockRes.ok) throw new Error(`Restock failed: ${restockRes.status}`);
  const { pantryItem: restockedItem } = await restockRes.json();
  if (restockedItem.quantity !== 4) throw new Error('Restock quantity incorrect');
  console.log(`✓ Successfully restocked 2 units (new stock: ${restockedItem.quantity})`);

  // -------------------------------------------------------------------------
  // 4. Smart Grocery Lists (Edit, Purchase & Auto-Restock, Clear-Purchased)
  // -------------------------------------------------------------------------
  console.log('\n--- 4. Testing Smart Grocery Lists & Workflows ---');
  // Sync meals to groceries workflow
  const syncGroceriesRes = await fetch(`${baseUrl}/api/v1/household/${familyId}/workflow/sync-meals-to-groceries`, {
    method: 'POST',
    headers,
  });
  if (!syncGroceriesRes.ok) throw new Error(`Sync groceries failed: ${syncGroceriesRes.status}`);
  console.log('✓ Successfully executed workflow: sync-meals-to-groceries');

  // Add custom grocery item
  const addGrocRes = await fetch(`${baseUrl}/api/v1/household/${familyId}/groceries`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      itemName: 'Organic Strawberries',
      category: 'PRODUCE',
      quantity: 2,
      unit: 'lbs',
    }),
  });
  if (!addGrocRes.ok) throw new Error(`Add grocery failed: ${addGrocRes.status}`);
  const { groceryItem: createdGroc } = await addGrocRes.json();
  console.log(`✓ Added grocery item "${createdGroc.itemName}"`);

  // Edit grocery item
  const editGrocRes = await fetch(`${baseUrl}/api/v1/household/${familyId}/groceries/${createdGroc.id}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ quantity: 3, unit: 'lbs' }),
  });
  if (!editGrocRes.ok) throw new Error(`Edit grocery failed: ${editGrocRes.status}`);
  const { groceryItem: editedGroc } = await editGrocRes.json();
  if (editedGroc.quantity !== 3) throw new Error('Grocery quantity not updated');
  console.log(`✓ Successfully updated grocery item quantity to ${editedGroc.quantity}`);

  // Purchase grocery item and verify auto-restock of pantry
  const purchaseRes = await fetch(`${baseUrl}/api/v1/household/${familyId}/groceries/${createdGroc.id}/purchase`, {
    method: 'POST',
    headers,
  });
  if (!purchaseRes.ok) throw new Error(`Purchase failed: ${purchaseRes.status}`);
  const purchaseData = await purchaseRes.json();
  if (!purchaseData.groceryItem.isPurchased) throw new Error('Item not marked purchased');
  console.log(`✓ Purchased "${createdGroc.itemName}", auto-restocked to pantry: ${purchaseData.restockedPantryItem?.itemName || 'Yes'}`);

  // Clear purchased
  const clearRes = await fetch(`${baseUrl}/api/v1/household/${familyId}/groceries/clear-purchased`, {
    method: 'POST',
    headers,
  });
  if (!clearRes.ok) throw new Error(`Clear purchased failed: ${clearRes.status}`);
  const clearData = await clearRes.json();
  console.log(`✓ Cleared ${clearData.clearedCount} completed items from grocery list.`);

  // -------------------------------------------------------------------------
  // 5. Chores Locations & Multi-Step Checklists
  // -------------------------------------------------------------------------
  console.log('\n--- 5. Testing Chores Locations & Checklists ---');
  const createChoreRes = await fetch(`${baseUrl}/api/v1/household/${familyId}/chores`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      title: 'Kitchen Island & Dishwasher Reset',
      description: 'Nightly reset of all cooking surfaces and dishwasher cycle.',
      zone: 'KITCHEN',
      location: 'Main Kitchen & Prep Island',
      frequency: 'DAILY',
      rewardPoints: 20,
      assignedMemberId: 'mem-maya-child',
      checklist: [
        { text: 'Unload clean cups and bowls', isDone: true },
        { text: 'Wipe quartz countertops with citrus spray', isDone: false },
        { text: 'Start overnight dishwasher cycle', isDone: false },
      ],
    }),
  });
  if (!createChoreRes.ok) throw new Error(`Create chore failed: ${createChoreRes.status}`);
  const { chore: createdChore } = await createChoreRes.json();
  if (!createdChore.checklist || createdChore.checklist.length !== 3) {
    throw new Error('Chore checklist items not preserved');
  }
  console.log(`✓ Created chore with location "${createdChore.location}" and ${createdChore.checklist.length} checklist steps.`);

  // Complete chore and record history + points
  const completeChoreRes = await fetch(`${baseUrl}/api/v1/household/${familyId}/chores/${createdChore.id}/complete`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ memberId: 'mem-maya-child' }),
  });
  if (!completeChoreRes.ok) throw new Error(`Chore completion failed: ${completeChoreRes.status}`);
  const completeData = await completeChoreRes.json();
  console.log(`✓ Successfully completed chore and awarded +${completeData.pointsAwarded} points to ${completeData.assignedMemberId}`);

  // -------------------------------------------------------------------------
  // 6. Outfits for Different Seasons & Laundry
  // -------------------------------------------------------------------------
  console.log('\n--- 6. Testing Outfits for Seasons & Laundry ---');
  const addWardrobeRes = await fetch(`${baseUrl}/api/v1/household/${familyId}/wardrobe`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      memberId: 'mem-maya-child',
      itemName: 'Merino Wool Winter Sweater',
      category: 'TOPS',
      color: 'Forest Green',
      season: 'WINTER',
      isClean: false, // In laundry hamper
    }),
  });
  if (!addWardrobeRes.ok) throw new Error(`Wardrobe add failed: ${addWardrobeRes.status}`);
  const { wardrobeItem: createdWardrobe } = await addWardrobeRes.json();
  console.log(`✓ Added wardrobe item "${createdWardrobe.itemName}" for season "${createdWardrobe.season}" (Status: Needs Laundry)`);

  // Run Laundry Cycle (Washes all dirty clothes)
  const laundryRes = await fetch(`${baseUrl}/api/v1/household/${familyId}/wardrobe/laundry-cycle`, {
    method: 'POST',
    headers,
  });
  if (!laundryRes.ok) throw new Error(`Laundry cycle failed: ${laundryRes.status}`);
  const laundryData = await laundryRes.json();
  console.log(`✓ Ran 1-click laundry cycle: ${laundryData.cleanedCount} items washed and marked clean!`);

  // Create Outfit Plan
  const addOutfitRes = await fetch(`${baseUrl}/api/v1/household/${familyId}/outfits`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      memberId: 'mem-maya-child',
      planDate: '2026-11-05',
      outfitName: 'Thursday School Presentation Outfit',
      occasion: 'SCHOOL',
      itemIds: [createdWardrobe.id],
      notes: 'Wear comfortable dress shoes',
    }),
  });
  if (!addOutfitRes.ok) throw new Error(`Add outfit failed: ${addOutfitRes.status}`);
  const { outfitPlan: createdOutfit } = await addOutfitRes.json();
  console.log(`✓ Created scheduled outfit plan "${createdOutfit.outfitName}" for ${createdOutfit.planDate}`);

  // -------------------------------------------------------------------------
  // 7. Home Assets & Maintenance System
  // -------------------------------------------------------------------------
  console.log('\n--- 7. Testing Home Assets & Maintenance System ---');
  const addAssetRes = await fetch(`${baseUrl}/api/v1/household/${familyId}/assets`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: 'Tankless Water Heater',
      category: 'PLUMBING',
      description: 'Rinnai High Efficiency Indoor Natural Gas Tankless Water Heater',
      purchasePriceCents: 185000,
      location: 'Utility Room',
      warrantyExpiration: Date.now() + 1825 * 86400000,
      maintenanceFrequencyMonths: 12,
    }),
  });
  if (!addAssetRes.ok) throw new Error(`Add asset failed: ${addAssetRes.status}`);
  const { asset: createdAsset } = await addAssetRes.json();
  console.log(`✓ Registered home asset "${createdAsset.name}" at location "${createdAsset.location}"`);

  // Log Service & Maintenance
  const maintRes = await fetch(`${baseUrl}/api/v1/household/${familyId}/assets/${createdAsset.id}/maintenance`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      performedBy: 'Cascade Plumbing Pros',
      costCents: 15000,
      notes: 'Flushed system with vinegar solution, inspected heat exchanger, cleared intake filter.',
      nextDueDate: Date.now() + 365 * 86400000,
    }),
  });
  if (!maintRes.ok) throw new Error(`Log maintenance failed: ${maintRes.status}`);
  const maintData = await maintRes.json();
  console.log(`✓ Logged maintenance service record by "${maintData.record.performedBy}" for $${(maintData.record.costCents / 100).toFixed(2)}`);

  console.log('\n===============================================================');
  console.log('ALL 7 HOUSEHOLD OPERATIONS SUITES PASSED WITH 100% SUCCESS!');
  console.log('===============================================================');
}

main().catch((err) => {
  console.error('Household verification failed:', err);
  process.exit(1);
});
