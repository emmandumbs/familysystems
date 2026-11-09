import { Router, Request, Response } from 'express';
import {
  getHouseholdStore,
  computeExpiryStatus,
  syncMealPlanToGroceryList,
  purchaseGroceryItem,
  recordChoreCompletion,
  Recipe,
  MealPlanEntry,
  Chore,
  HomeAsset,
  AssetMaintenanceRecord,
  PantryItem,
  WardrobeItem,
  OutfitPlan,
  GroceryListItem,
  ChecklistTemplate,
  HouseholdAttachment,
} from './householdData';
import { loadStore } from '../../server.js';
import { resolveServerMembership } from './authAndRbac.js';
import { getPostgresPool } from './postgresMigrationAndBackup';
import {
  isPostgresPersistenceActive,
  updateChoreCompletionScoped,
  updatePantryItemScoped,
  updateMealPlanScoped,
  softDeleteScopedEntity,
} from './postgresRepositories';

export const householdRouter = Router();

function sanitizeAttachments(raw: any): HouseholdAttachment[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  return raw
    .filter((a: any) => a && typeof a.name === 'string' && typeof a.dataUrl === 'string')
    .map((a: any, idx: number) => ({
      id: a.id || `att-${Date.now()}-${idx}`,
      name: String(a.name).trim() || `Attachment ${idx + 1}`,
      type: a.type === 'DOCUMENT' ? 'DOCUMENT' : 'PHOTO',
      mimeType: String(a.mimeType || 'application/octet-stream'),
      dataUrl: String(a.dataUrl),
      sizeBytes: a.sizeBytes !== undefined ? Number(a.sizeBytes) : undefined,
      uploadedAt: a.uploadedAt ? Number(a.uploadedAt) : Date.now(),
    }));
}

// ============================================================================
// ZERO-TRUST FAMILY MEMBERSHIP AUTHORIZATION PARAMETER MIDDLEWARE
// ============================================================================
householdRouter.param('familyId', (req: Request, res: Response, next, familyId) => {
  const actor = (req as any).actor;
  if (!actor || !actor.userAccountId) {
    return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Missing authenticated session.' });
  }

  const store = loadStore();
  const access = resolveServerMembership(store, actor.userAccountId, familyId);
  if (!access.allowed || !access.membership) {
    return res.status(access.httpStatus).json({
      error: access.errorCode || 'WORKSPACE_ISOLATION_VIOLATION',
      message: access.errorMessage || 'Access denied for family workspace.',
    });
  }

  (req as any).membership = access.membership;
  next();
});

// ==========================================
// 0. REUSABLE CHECKLIST TEMPLATES CRUD
// ==========================================

householdRouter.get('/:familyId/templates', (req: Request, res: Response) => {
  const { familyId } = req.params;
  const { domain } = req.query;
  const store = getHouseholdStore(familyId);
  let templates = Array.from(store.checklistTemplates.values()).sort(
    (a, b) => b.updatedAt - a.updatedAt
  );
  if (domain && String(domain).toUpperCase() !== 'ALL') {
    templates = templates.filter((t) => t.domain === String(domain).toUpperCase());
  }
  res.json({ templates });
});

householdRouter.post('/:familyId/templates', (req: Request, res: Response) => {
  const { familyId } = req.params;
  const { name, domain, category, items } = req.body;

  const trimmedName = String(name || '').trim();
  if (!trimmedName) {
    return res.status(400).json({ error: 'TEMPLATE_NAME_REQUIRED', message: 'Template name is required.' });
  }

  const normalizedItems = Array.isArray(items)
    ? items.map((s: any) => String(typeof s === 'string' ? s : s?.text || '').trim()).filter(Boolean)
    : [];

  if (normalizedItems.length === 0) {
    return res.status(400).json({
      error: 'TEMPLATE_ITEMS_REQUIRED',
      message: 'Please provide at least one checklist step for the template.',
    });
  }

  const store = getHouseholdStore(familyId);
  const now = Date.now();
  const validDomain = ['CHORE', 'MAINTENANCE', 'ROUTINE'].includes(String(domain || '').toUpperCase())
    ? (String(domain).toUpperCase() as ChecklistTemplate['domain'])
    : 'CHORE';

  const newTemplate: ChecklistTemplate = {
    id: `tpl-${now}-${Math.random().toString(36).substr(2, 5)}`,
    familyId,
    name: trimmedName,
    domain: validDomain,
    category: String(category || 'GENERAL').trim().toUpperCase(),
    items: normalizedItems,
    createdAt: now,
    updatedAt: now,
  };

  store.checklistTemplates.set(newTemplate.id, newTemplate);
  res.status(201).json({ template: newTemplate, templates: Array.from(store.checklistTemplates.values()) });
});

householdRouter.put('/:familyId/templates/:templateId', (req: Request, res: Response) => {
  const { familyId, templateId } = req.params;
  const store = getHouseholdStore(familyId);
  const template = store.checklistTemplates.get(templateId);
  if (!template) {
    return res.status(404).json({ error: 'TEMPLATE_NOT_FOUND', message: 'Checklist template not found.' });
  }

  const { name, domain, category, items } = req.body;
  if (name !== undefined) {
    const trimmed = String(name).trim();
    if (!trimmed) {
      return res.status(400).json({ error: 'TEMPLATE_NAME_REQUIRED', message: 'Template name cannot be empty.' });
    }
    template.name = trimmed;
  }
  if (domain !== undefined && ['CHORE', 'MAINTENANCE', 'ROUTINE'].includes(String(domain).toUpperCase())) {
    template.domain = String(domain).toUpperCase() as ChecklistTemplate['domain'];
  }
  if (category !== undefined) {
    template.category = String(category).trim().toUpperCase();
  }
  if (Array.isArray(items)) {
    const normalizedItems = items
      .map((s: any) => String(typeof s === 'string' ? s : s?.text || '').trim())
      .filter(Boolean);
    if (normalizedItems.length === 0) {
      return res.status(400).json({
        error: 'TEMPLATE_ITEMS_REQUIRED',
        message: 'Template must contain at least one step.',
      });
    }
    template.items = normalizedItems;
  }
  template.updatedAt = Date.now();
  store.checklistTemplates.set(template.id, template);

  res.json({ template, templates: Array.from(store.checklistTemplates.values()) });
});

householdRouter.delete('/:familyId/templates/:templateId', (req: Request, res: Response) => {
  const { familyId, templateId } = req.params;
  const store = getHouseholdStore(familyId);
  if (!store.checklistTemplates.has(templateId)) {
    return res.status(404).json({ error: 'TEMPLATE_NOT_FOUND' });
  }
  store.checklistTemplates.delete(templateId);
  res.json({
    success: true,
    deletedTemplateId: templateId,
    templates: Array.from(store.checklistTemplates.values()),
  });
});

// ==========================================
// 1. MEALS & 7-DAY MEAL PLANNER
// ==========================================

householdRouter.get('/:familyId/meals', (req: Request, res: Response) => {
  const { familyId } = req.params;
  const store = getHouseholdStore(familyId);
  const meals = Array.from(store.meals.values()).sort((a, b) => a.planDate - b.planDate);
  res.json({ meals });
});

householdRouter.post('/:familyId/meals', (req: Request, res: Response) => {
  const { familyId } = req.params;
  const { planDate, mealType, recipeId, customMealTitle, servings, notes, imageUri, attachments } = req.body;

  if (!planDate || !mealType) {
    return res.status(400).json({ error: 'MISSING_REQUIRED_FIELDS', message: 'Date and meal slot are required.' });
  }

  const store = getHouseholdStore(familyId);
  const newMeal: MealPlanEntry = {
    id: `meal-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    familyId,
    planDate: Number(planDate),
    mealType,
    recipeId: recipeId || undefined,
    customMealTitle: customMealTitle ? String(customMealTitle).trim() : undefined,
    servings: servings ? Math.max(1, Number(servings)) : 4,
    notes: notes ? String(notes).trim() : undefined,
    imageUri: imageUri || undefined,
    attachments: sanitizeAttachments(attachments),
    createdAt: Date.now(),
  };

  store.meals.set(newMeal.id, newMeal);
  if (isPostgresPersistenceActive()) {
    const pool = getPostgresPool();
    if (pool) {
      void updateMealPlanScoped(pool, familyId, {
        id: newMeal.id,
        planDate: newMeal.planDate,
        mealType: newMeal.mealType,
        recipeId: newMeal.recipeId,
        customMealName: newMeal.customMealTitle,
        servings: newMeal.servings,
      }).catch((err) => {
        console.error('Scoped Postgres meal write error:', err);
      });
    }
  }
  res.status(201).json({ meal: newMeal });
});

householdRouter.put('/:familyId/meals/:mealId', (req: Request, res: Response) => {
  const { familyId, mealId } = req.params;
  const store = getHouseholdStore(familyId);
  const meal = store.meals.get(mealId);
  if (!meal) {
    return res.status(404).json({ error: 'MEAL_NOT_FOUND' });
  }

  const { planDate, mealType, recipeId, customMealTitle, servings, notes, imageUri, attachments } = req.body;
  if (planDate !== undefined) meal.planDate = Number(planDate);
  if (mealType !== undefined) meal.mealType = mealType;
  if (recipeId !== undefined) meal.recipeId = recipeId || undefined;
  if (customMealTitle !== undefined) meal.customMealTitle = String(customMealTitle).trim() || undefined;
  if (servings !== undefined) meal.servings = Math.max(1, Number(servings));
  if (notes !== undefined) meal.notes = String(notes).trim() || undefined;
  if (imageUri !== undefined) meal.imageUri = imageUri || undefined;
  if (attachments !== undefined) meal.attachments = sanitizeAttachments(attachments);

  store.meals.set(mealId, meal);
  if (isPostgresPersistenceActive()) {
    const pool = getPostgresPool();
    if (pool) {
      void updateMealPlanScoped(pool, familyId, {
        id: meal.id,
        planDate: meal.planDate,
        mealType: meal.mealType,
        recipeId: meal.recipeId,
        customMealName: meal.customMealTitle,
        servings: meal.servings,
      }).catch((err) => {
        console.error('Scoped Postgres meal update error:', err);
      });
    }
  }
  res.json({ meal });
});

householdRouter.delete('/:familyId/meals/:mealId', (req: Request, res: Response) => {
  const { familyId, mealId } = req.params;
  const store = getHouseholdStore(familyId);
  const exists = store.meals.has(mealId);
  if (!exists) {
    return res.status(404).json({ error: 'MEAL_NOT_FOUND' });
  }

  store.meals.delete(mealId);
  if (isPostgresPersistenceActive()) {
    const pool = getPostgresPool();
    if (pool) {
      void softDeleteScopedEntity(pool, 'household_records', familyId, `MEAL:${mealId}`).catch((err) => {
        console.error('Scoped Postgres meal delete error:', err);
      });
    }
  }
  res.json({ success: true, deletedMealId: mealId });
});

// Batch Schedule or Auto-Fill 7-Day Meal Plan
householdRouter.post('/:familyId/meals/batch-schedule-week', (req: Request, res: Response) => {
  const { familyId } = req.params;
  const { startEpoch, mealsList } = req.body;
  const store = getHouseholdStore(familyId);
  const recipes = Array.from(store.recipes.values()).filter((r) => !r.isArchived);

  if (Array.isArray(mealsList) && mealsList.length > 0) {
    const created: MealPlanEntry[] = [];
    for (const m of mealsList) {
      const newMeal: MealPlanEntry = {
        id: `meal-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        familyId,
        planDate: Number(m.planDate),
        mealType: m.mealType || 'DINNER',
        recipeId: m.recipeId || undefined,
        customMealTitle: m.customMealTitle || undefined,
        servings: m.servings ? Number(m.servings) : 4,
        notes: m.notes || undefined,
        createdAt: Date.now(),
      };
      store.meals.set(newMeal.id, newMeal);
      created.push(newMeal);
    }
    return res.status(201).json({
      success: true,
      count: created.length,
      meals: Array.from(store.meals.values()),
    });
  }

  const start = startEpoch
    ? Number(startEpoch)
    : (() => {
        const d = new Date();
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
        d.setDate(diff);
        d.setHours(0, 0, 0, 0);
        return d.getTime();
      })();

  const dayMs = 24 * 60 * 60 * 1000;
  const defaults = [
    { dayOffset: 0, mealType: 'BREAKFAST', title: 'Avocado Toast & Poached Eggs', servings: 4 },
    {
      dayOffset: 0,
      mealType: 'DINNER',
      title: recipes[0]?.title || 'Hearty Chicken Vegetable Soup',
      recipeId: recipes[0]?.id,
      servings: 6,
    },
    { dayOffset: 1, mealType: 'LUNCH', title: 'Mediterranean Quinoa & Chickpea Bowl', servings: 3 },
    { dayOffset: 1, mealType: 'DINNER', title: 'Garlic Herb Baked Salmon & Asparagus', servings: 4 },
    { dayOffset: 2, mealType: 'DINNER', title: 'Family Taco Night with Fresh Guacamole', servings: 5 },
    { dayOffset: 3, mealType: 'DINNER', title: 'Slow Cooker Beef & Root Vegetable Stew', servings: 6 },
    { dayOffset: 4, mealType: 'DINNER', title: 'Homemade Sourdough Pizza & Caesar Salad', servings: 5 },
    { dayOffset: 5, mealType: 'BREAKFAST', title: 'Buttermilk Pancakes & Fresh Berries', servings: 4 },
    { dayOffset: 5, mealType: 'DINNER', title: 'Grilled Lemon Herb Chicken & Roasted Vegetables', servings: 4 },
    { dayOffset: 6, mealType: 'DINNER', title: 'Sunday Family Roast & Herb Potatoes', servings: 6 },
  ];

  const added: MealPlanEntry[] = [];
  for (const def of defaults) {
    const planDate = start + def.dayOffset * dayMs;
    const newMeal: MealPlanEntry = {
      id: `meal-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      familyId,
      planDate,
      mealType: def.mealType as any,
      recipeId: def.recipeId,
      customMealTitle: def.title,
      servings: def.servings,
      notes: 'Balanced weekly schedule',
      createdAt: Date.now(),
    };
    store.meals.set(newMeal.id, newMeal);
    added.push(newMeal);
  }

  res.status(201).json({
    success: true,
    addedCount: added.length,
    meals: Array.from(store.meals.values()).sort((a, b) => a.planDate - b.planDate),
  });
});

// ==========================================
// 2. RECIPES & INGREDIENTS
// ==========================================

householdRouter.get('/:familyId/recipes', (req: Request, res: Response) => {
  const { familyId } = req.params;
  const store = getHouseholdStore(familyId);
  const recipes = Array.from(store.recipes.values()).filter((r) => !r.isArchived);
  res.json({ recipes });
});

householdRouter.post('/:familyId/recipes', (req: Request, res: Response) => {
  const { familyId } = req.params;
  const {
    title,
    description,
    imageUri,
    attachments,
    prepTimeMinutes,
    cookTimeMinutes,
    servings,
    difficulty,
    category,
    dietaryNotes,
    familyRating,
    isFavorite,
    source,
    storageInstructions,
    ingredients,
    instructions,
  } = req.body;

  if (!title || !String(title).trim()) {
    return res.status(400).json({ error: 'TITLE_REQUIRED', message: 'Recipe title is required.' });
  }

  const store = getHouseholdStore(familyId);
  const now = Date.now();
  const recipeId = `rec-${now}-${Math.random().toString(36).substr(2, 5)}`;

  const formattedIngredients = (ingredients || []).map((ing: any, idx: number) => ({
    id: ing.id || `ing-${now}-${idx}`,
    recipeId,
    itemName: String(ing.itemName || 'Ingredient').trim(),
    quantity: Math.max(0.01, Number(ing.quantity) || 1),
    unit: String(ing.unit || 'item').trim(),
    notes: ing.notes ? String(ing.notes).trim() : undefined,
  }));

  const formattedInstructions = (instructions || []).map((ins: any, idx: number) => ({
    id: ins.id || `ins-${now}-${idx}`,
    recipeId,
    stepNumber: idx + 1,
    instructionText: String(ins.instructionText ?? ins ?? '').trim(),
  }));

  const newRecipe: Recipe = {
    id: recipeId,
    familyId,
    title: String(title).trim(),
    description: description ? String(description).trim() : undefined,
    imageUri: imageUri || undefined,
    attachments: sanitizeAttachments(attachments),
    prepTimeMinutes: prepTimeMinutes !== undefined ? Math.max(0, Number(prepTimeMinutes)) : 15,
    cookTimeMinutes: cookTimeMinutes !== undefined ? Math.max(0, Number(cookTimeMinutes)) : 30,
    servings: servings ? Math.max(1, Number(servings)) : 4,
    difficulty: ['EASY', 'MEDIUM', 'HARD'].includes(difficulty) ? difficulty : 'MEDIUM',
    category: category ? String(category).toUpperCase() : 'DINNER',
    dietaryNotes: dietaryNotes ? String(dietaryNotes).trim() : undefined,
    familyRating: familyRating !== undefined ? Math.min(5, Math.max(1, Number(familyRating))) : 5,
    isFavorite: Boolean(isFavorite),
    source: source ? String(source).trim() : undefined,
    storageInstructions: storageInstructions ? String(storageInstructions).trim() : undefined,
    ingredients: formattedIngredients,
    instructions: formattedInstructions,
    isArchived: false,
    createdAt: now,
    updatedAt: now,
  };

  store.recipes.set(newRecipe.id, newRecipe);
  res.status(201).json({ recipe: newRecipe });
});

householdRouter.put('/:familyId/recipes/:recipeId', (req: Request, res: Response) => {
  const { familyId, recipeId } = req.params;
  const store = getHouseholdStore(familyId);
  const recipe = store.recipes.get(recipeId);
  if (!recipe) {
    return res.status(404).json({ error: 'RECIPE_NOT_FOUND' });
  }

  const updates = req.body;
  if (updates.title !== undefined && String(updates.title).trim()) {
    recipe.title = String(updates.title).trim();
  }
  if (updates.description !== undefined) recipe.description = updates.description ? String(updates.description).trim() : undefined;
  if (updates.imageUri !== undefined) recipe.imageUri = updates.imageUri || undefined;
  if (updates.attachments !== undefined) recipe.attachments = sanitizeAttachments(updates.attachments);
  if (updates.prepTimeMinutes !== undefined) recipe.prepTimeMinutes = Math.max(0, Number(updates.prepTimeMinutes));
  if (updates.cookTimeMinutes !== undefined) recipe.cookTimeMinutes = Math.max(0, Number(updates.cookTimeMinutes));
  if (updates.servings !== undefined) recipe.servings = Math.max(1, Number(updates.servings));
  if (updates.difficulty !== undefined) recipe.difficulty = updates.difficulty;
  if (updates.category !== undefined) recipe.category = String(updates.category).toUpperCase();
  if (updates.dietaryNotes !== undefined) recipe.dietaryNotes = updates.dietaryNotes ? String(updates.dietaryNotes).trim() : undefined;
  if (updates.familyRating !== undefined) recipe.familyRating = Math.min(5, Math.max(1, Number(updates.familyRating)));
  if (updates.isFavorite !== undefined) recipe.isFavorite = Boolean(updates.isFavorite);
  if (updates.source !== undefined) recipe.source = updates.source ? String(updates.source).trim() : undefined;
  if (updates.storageInstructions !== undefined) recipe.storageInstructions = updates.storageInstructions ? String(updates.storageInstructions).trim() : undefined;
  if (Array.isArray(updates.ingredients)) {
    recipe.ingredients = updates.ingredients.map((ing: any, idx: number) => ({
      id: ing.id || `ing-${Date.now()}-${idx}`,
      recipeId,
      itemName: String(ing.itemName || 'Ingredient').trim(),
      quantity: Math.max(0.01, Number(ing.quantity) || 1),
      unit: String(ing.unit || 'item').trim(),
      notes: ing.notes ? String(ing.notes).trim() : undefined,
    }));
  }
  if (Array.isArray(updates.instructions)) {
    recipe.instructions = updates.instructions.map((ins: any, idx: number) => ({
      id: ins.id || `ins-${Date.now()}-${idx}`,
      recipeId,
      stepNumber: idx + 1,
      instructionText: String(ins.instructionText ?? ins ?? '').trim(),
    }));
  }
  recipe.updatedAt = Date.now();
  store.recipes.set(recipeId, recipe);

  res.json({ recipe });
});

householdRouter.delete('/:familyId/recipes/:recipeId', (req: Request, res: Response) => {
  const { familyId, recipeId } = req.params;
  const store = getHouseholdStore(familyId);
  const recipe = store.recipes.get(recipeId);
  if (!recipe) {
    return res.status(404).json({ error: 'RECIPE_NOT_FOUND' });
  }
  store.recipes.delete(recipeId);
  res.json({ success: true, archivedRecipeId: recipeId, deletedRecipeId: recipeId });
});

householdRouter.get('/:familyId/recipes/:recipeId/scale', (req: Request, res: Response) => {
  const { familyId, recipeId } = req.params;
  const { targetServings } = req.query;
  const store = getHouseholdStore(familyId);
  const recipe = store.recipes.get(recipeId);
  if (!recipe) {
    return res.status(404).json({ error: 'RECIPE_NOT_FOUND' });
  }

  const target = targetServings ? Number(targetServings) : recipe.servings;
  const scaleRatio = target / (recipe.servings || 1);

  const scaledIngredients = recipe.ingredients.map((ing) => ({
    ...ing,
    originalQuantity: ing.quantity,
    quantity: Math.round(ing.quantity * scaleRatio * 100) / 100,
  }));

  res.json({
    recipe: {
      ...recipe,
      servings: target,
      ingredients: scaledIngredients,
    },
    targetServings: target,
    scaleRatio,
  });
});

// ==========================================
// 3. CHORES & POINTS LEDGER
// ==========================================

householdRouter.get('/:familyId/chores', (req: Request, res: Response) => {
  const { familyId } = req.params;
  const store = getHouseholdStore(familyId);
  const chores = Array.from(store.chores.values()).filter((c) => !c.isArchived);
  res.json({ chores, history: store.choreHistory });
});

householdRouter.post('/:familyId/chores', (req: Request, res: Response) => {
  const { familyId } = req.params;
  const {
    title,
    description,
    assignedMemberId,
    assignedToMemberName,
    zone,
    location,
    frequency,
    rewardPoints,
    pointsValue,
    nextDueDate,
    dueDate,
    requiresVerification,
    checklist,
    imageUri,
    attachments,
  } = req.body;

  if (!title || !String(title).trim()) {
    return res.status(400).json({ error: 'CHORE_TITLE_REQUIRED', message: 'Chore title is required.' });
  }

  const store = getHouseholdStore(familyId);
  const now = Date.now();
  const formattedChecklist = Array.isArray(checklist)
    ? checklist
        .map((c: any, i: number) => ({
          id: c.id || `step-${now}-${i}`,
          text: String(typeof c === 'string' ? c : c.text || '').trim(),
          isDone: Boolean(c.isDone),
        }))
        .filter((c) => c.text.length > 0)
    : undefined;

  const resolvedPoints =
    rewardPoints !== undefined
      ? Math.max(0, Number(rewardPoints))
      : pointsValue !== undefined
        ? Math.max(0, Number(pointsValue))
        : 10;
  const resolvedDue = nextDueDate
    ? Number(nextDueDate)
    : dueDate
      ? Number(dueDate)
      : now + 24 * 60 * 60 * 1000;

  const newChore: Chore = {
    id: `chore-${now}-${Math.random().toString(36).substr(2, 5)}`,
    familyId,
    title: String(title).trim(),
    description:
      description !== undefined
        ? String(description).trim() || undefined
        : assignedToMemberName
          ? `Assigned to ${assignedToMemberName}`
          : undefined,
    assignedMemberId: assignedMemberId || undefined,
    zone: zone || 'GENERAL',
    location: location ? String(location).trim() : undefined,
    frequency: frequency || 'DAILY',
    rewardPoints: resolvedPoints,
    nextDueDate: resolvedDue,
    requiresVerification: Boolean(requiresVerification),
    isCompleted: false,
    checklist: formattedChecklist,
    imageUri: imageUri || undefined,
    attachments: sanitizeAttachments(attachments),
    isArchived: false,
    createdAt: now,
  };

  store.chores.set(newChore.id, newChore);
  res.status(201).json({ chore: newChore });
});

householdRouter.put('/:familyId/chores/:choreId', (req: Request, res: Response) => {
  const { familyId, choreId } = req.params;
  const store = getHouseholdStore(familyId);
  const chore = store.chores.get(choreId);
  if (!chore) {
    return res.status(404).json({ error: 'CHORE_NOT_FOUND' });
  }

  const {
    title,
    description,
    assignedMemberId,
    zone,
    location,
    frequency,
    rewardPoints,
    nextDueDate,
    requiresVerification,
    isCompleted,
    checklist,
    imageUri,
    attachments,
  } = req.body;

  if (title !== undefined && String(title).trim()) chore.title = String(title).trim();
  if (description !== undefined) chore.description = String(description).trim() || undefined;
  if (assignedMemberId !== undefined) chore.assignedMemberId = assignedMemberId || undefined;
  if (zone !== undefined) chore.zone = zone;
  if (location !== undefined) chore.location = String(location).trim() || undefined;
  if (frequency !== undefined) chore.frequency = frequency;
  if (rewardPoints !== undefined) chore.rewardPoints = Math.max(0, Number(rewardPoints));
  if (nextDueDate !== undefined) chore.nextDueDate = Number(nextDueDate);
  if (requiresVerification !== undefined) chore.requiresVerification = Boolean(requiresVerification);
  if (isCompleted !== undefined) chore.isCompleted = Boolean(isCompleted);
  if (Array.isArray(checklist)) {
    chore.checklist = checklist
      .map((c: any, i: number) => ({
        id: c.id || `step-${Date.now()}-${i}`,
        text: String(typeof c === 'string' ? c : c.text || '').trim(),
        isDone: Boolean(c.isDone),
      }))
      .filter((c) => c.text.length > 0);
  }
  if (imageUri !== undefined) chore.imageUri = imageUri || undefined;
  if (attachments !== undefined) chore.attachments = sanitizeAttachments(attachments);

  store.chores.set(choreId, chore);
  res.json({ chore });
});

householdRouter.delete('/:familyId/chores/:choreId', (req: Request, res: Response) => {
  const { familyId, choreId } = req.params;
  const store = getHouseholdStore(familyId);
  if (!store.chores.has(choreId)) {
    return res.status(404).json({ error: 'CHORE_NOT_FOUND' });
  }
  store.chores.delete(choreId);
  res.json({ success: true, deletedChoreId: choreId });
});

householdRouter.post('/:familyId/chores/:choreId/complete', (req: Request, res: Response) => {
  const { familyId, choreId } = req.params;
  const store = getHouseholdStore(familyId);
  const chore = store.chores.get(choreId);
  if (!chore) {
    return res.status(404).json({ error: 'CHORE_NOT_FOUND' });
  }

  const callerMemberId = (req as any).membership?.memberProfileId || 'mem-sarah';
  const memberId =
    req.body?.memberId ||
    req.body?.completedByMemberId ||
    chore.assignedMemberId ||
    callerMemberId;

  try {
    const result = recordChoreCompletion(familyId, choreId, memberId);
    if (isPostgresPersistenceActive()) {
      const pool = getPostgresPool();
      if (pool) {
        void updateChoreCompletionScoped(pool, familyId, choreId, {
          completedByMemberId: memberId,
          pointsAwarded: result.completionRecord.pointsEarned,
          completedAt: result.completionRecord.completedAt,
        }).catch((err) => {
          console.error('Scoped Postgres chore completion error:', err);
        });
      }
    }
    res.json({
      chore: result.chore,
      completionRecord: result.completionRecord,
      pointsAwarded: result.completionRecord.pointsEarned,
      pointsEarned: result.completionRecord.pointsEarned,
      alreadyCompleted: result.alreadyCompleted,
      assignedMemberId: memberId,
    });
  } catch (err: any) {
    res.status(404).json({ error: err.message || 'CHORE_COMPLETION_FAILED' });
  }
});

// ==========================================
// 4. HOME ASSETS & MAINTENANCE
// ==========================================

householdRouter.get('/:familyId/assets', (req: Request, res: Response) => {
  const { familyId } = req.params;
  const store = getHouseholdStore(familyId);
  const assets = Array.from(store.assets.values()).filter((a) => !a.isArchived);
  res.json({ assets, maintenance: store.assetMaintenance });
});

householdRouter.post('/:familyId/assets', (req: Request, res: Response) => {
  const { familyId } = req.params;
  const {
    name,
    category,
    description,
    purchaseDate,
    purchasePriceCents,
    modelNumber,
    serialNumber,
    location,
    warrantyExpiration,
    maintenanceFrequencyMonths,
    imageUri,
    attachments,
  } = req.body;

  if (!name || !String(name).trim()) {
    return res.status(400).json({ error: 'ASSET_NAME_REQUIRED', message: 'Asset name is required.' });
  }

  const parsedPriceCents =
    purchasePriceCents !== undefined && purchasePriceCents !== null ? Number(purchasePriceCents) : 0;
  if (!Number.isSafeInteger(parsedPriceCents) || parsedPriceCents < 0) {
    return res.status(400).json({
      error: 'INVALID_PURCHASE_PRICE_CENTS',
      message: 'purchasePriceCents must be a non-negative integer cents value.',
    });
  }

  const store = getHouseholdStore(familyId);
  const now = Date.now();
  const freqMonths = maintenanceFrequencyMonths ? Number(maintenanceFrequencyMonths) : 6;
  const nextMaintDate = (() => {
    const d = new Date(now);
    const targetMonthIndex = d.getUTCMonth() + freqMonths;
    const targetYear = d.getUTCFullYear() + Math.floor(targetMonthIndex / 12);
    const normMonth = ((targetMonthIndex % 12) + 12) % 12;
    const maxDay = new Date(Date.UTC(targetYear, normMonth + 1, 0)).getUTCDate();
    return Date.UTC(
      targetYear,
      normMonth,
      Math.min(d.getUTCDate(), maxDay),
      d.getUTCHours(),
      d.getUTCMinutes(),
      d.getUTCSeconds(),
      d.getUTCMilliseconds()
    );
  })();

  const newAsset: HomeAsset = {
    id: `asset-${now}-${Math.random().toString(36).substr(2, 5)}`,
    familyId,
    name: String(name).trim(),
    category: category || 'APPLIANCES',
    description: description ? String(description).trim() : undefined,
    purchaseDate: purchaseDate ? Number(purchaseDate) : now,
    purchasePriceCents: parsedPriceCents,
    modelNumber: modelNumber ? String(modelNumber).trim() : undefined,
    serialNumber: serialNumber ? String(serialNumber).trim() : undefined,
    location: location ? String(location).trim() : undefined,
    warrantyExpiration: warrantyExpiration ? Number(warrantyExpiration) : undefined,
    maintenanceFrequencyMonths: freqMonths,
    lastMaintenanceDate: now,
    nextMaintenanceDate: maintenanceFrequencyMonths ? nextMaintDate : undefined,
    imageUri: imageUri || undefined,
    attachments: sanitizeAttachments(attachments),
    isArchived: false,
    createdAt: now,
    updatedAt: now,
  };

  store.assets.set(newAsset.id, newAsset);
  res.status(201).json({ asset: newAsset });
});

householdRouter.put('/:familyId/assets/:assetId', (req: Request, res: Response) => {
  const { familyId, assetId } = req.params;
  const store = getHouseholdStore(familyId);
  const asset = store.assets.get(assetId);
  if (!asset) {
    return res.status(404).json({ error: 'ASSET_NOT_FOUND' });
  }

  const {
    name,
    category,
    description,
    purchaseDate,
    purchasePriceCents,
    modelNumber,
    serialNumber,
    location,
    warrantyExpiration,
    maintenanceFrequencyMonths,
    lastMaintenanceDate,
    nextMaintenanceDate,
    imageUri,
    attachments,
  } = req.body;

  if (name !== undefined && String(name).trim()) asset.name = String(name).trim();
  if (category !== undefined) asset.category = category;
  if (description !== undefined) asset.description = String(description).trim() || undefined;
  if (purchaseDate !== undefined) asset.purchaseDate = purchaseDate ? Number(purchaseDate) : undefined;
  if (purchasePriceCents !== undefined) {
    const parsedPrice = Number(purchasePriceCents);
    if (!Number.isSafeInteger(parsedPrice) || parsedPrice < 0) {
      return res.status(400).json({ error: 'INVALID_PURCHASE_PRICE_CENTS' });
    }
    asset.purchasePriceCents = parsedPrice;
  }
  if (modelNumber !== undefined) asset.modelNumber = String(modelNumber).trim() || undefined;
  if (serialNumber !== undefined) asset.serialNumber = String(serialNumber).trim() || undefined;
  if (location !== undefined) asset.location = String(location).trim() || undefined;
  if (warrantyExpiration !== undefined) {
    asset.warrantyExpiration = warrantyExpiration ? Number(warrantyExpiration) : undefined;
  }
  if (maintenanceFrequencyMonths !== undefined) {
    asset.maintenanceFrequencyMonths = Number(maintenanceFrequencyMonths);
  }
  if (lastMaintenanceDate !== undefined) asset.lastMaintenanceDate = Number(lastMaintenanceDate);
  if (nextMaintenanceDate !== undefined) asset.nextMaintenanceDate = Number(nextMaintenanceDate);
  if (imageUri !== undefined) asset.imageUri = imageUri || undefined;
  if (attachments !== undefined) asset.attachments = sanitizeAttachments(attachments);
  asset.updatedAt = Date.now();

  store.assets.set(assetId, asset);
  res.json({ asset });
});

householdRouter.delete('/:familyId/assets/:assetId', (req: Request, res: Response) => {
  const { familyId, assetId } = req.params;
  const store = getHouseholdStore(familyId);
  if (!store.assets.has(assetId)) {
    return res.status(404).json({ error: 'ASSET_NOT_FOUND' });
  }
  store.assets.delete(assetId);
  res.json({ success: true, deletedAssetId: assetId });
});

householdRouter.post('/:familyId/assets/:assetId/maintenance', (req: Request, res: Response) => {
  const { familyId, assetId } = req.params;
  const { performedBy, costCents, maintenanceDate, notes, nextDueDate, checklist, attachments } = req.body;

  const store = getHouseholdStore(familyId);
  const asset = store.assets.get(assetId);
  if (!asset) {
    return res.status(404).json({ error: 'ASSET_NOT_FOUND' });
  }

  const parsedCostCents = costCents !== undefined && costCents !== null ? Number(costCents) : 0;
  if (!Number.isSafeInteger(parsedCostCents) || parsedCostCents < 0) {
    return res.status(400).json({
      error: 'INVALID_COST_CENTS',
      message: 'costCents must be a non-negative integer cents value.',
    });
  }

  const now = Date.now();
  const formattedChecklist = Array.isArray(checklist)
    ? checklist
        .map((c: any, i: number) => ({
          id: c.id || `mstep-${now}-${i}`,
          text: String(typeof c === 'string' ? c : c.text || '').trim(),
          isDone: Boolean(c.isDone),
        }))
        .filter((c) => c.text.length > 0)
    : undefined;

  const record: AssetMaintenanceRecord = {
    id: `maint-${now}-${Math.random().toString(36).substr(2, 5)}`,
    assetId,
    familyId,
    maintenanceDate: maintenanceDate ? Number(maintenanceDate) : now,
    performedBy:
      (performedBy ? String(performedBy).trim() : '') ||
      (req as any).membership?.displayName ||
      'Household',
    costCents: parsedCostCents,
    notes: notes ? String(notes).trim() : undefined,
    nextDueDate: nextDueDate ? Number(nextDueDate) : undefined,
    checklist: formattedChecklist,
    attachments: sanitizeAttachments(attachments),
  };

  store.assetMaintenance.push(record);
  asset.lastMaintenanceDate = record.maintenanceDate;
  if (nextDueDate) {
    asset.nextMaintenanceDate = Number(nextDueDate);
  }
  asset.updatedAt = now;
  store.assets.set(assetId, asset);

  res.json({ asset, record, maintenance: store.assetMaintenance });
});

householdRouter.put('/:familyId/assets/:assetId/maintenance/:recordId', (req: Request, res: Response) => {
  const { familyId, assetId, recordId } = req.params;
  const store = getHouseholdStore(familyId);
  const idx = store.assetMaintenance.findIndex((m) => m.id === recordId && m.assetId === assetId);
  if (idx === -1) {
    return res.status(404).json({ error: 'MAINTENANCE_RECORD_NOT_FOUND' });
  }

  const record = store.assetMaintenance[idx];
  const { performedBy, costCents, maintenanceDate, notes, nextDueDate, checklist, attachments } = req.body;

  if (performedBy !== undefined && String(performedBy).trim()) {
    record.performedBy = String(performedBy).trim();
  }
  if (costCents !== undefined) {
    const parsedCostCents = Number(costCents);
    if (!Number.isSafeInteger(parsedCostCents) || parsedCostCents < 0) {
      return res.status(400).json({ error: 'INVALID_COST_CENTS' });
    }
    record.costCents = parsedCostCents;
  }
  if (maintenanceDate !== undefined) record.maintenanceDate = Number(maintenanceDate);
  if (notes !== undefined) record.notes = String(notes).trim() || undefined;
  if (nextDueDate !== undefined) record.nextDueDate = nextDueDate ? Number(nextDueDate) : undefined;
  if (Array.isArray(checklist)) {
    record.checklist = checklist
      .map((c: any, i: number) => ({
        id: c.id || `mstep-${Date.now()}-${i}`,
        text: String(typeof c === 'string' ? c : c.text || '').trim(),
        isDone: Boolean(c.isDone),
      }))
      .filter((c) => c.text.length > 0);
  }
  if (attachments !== undefined) record.attachments = sanitizeAttachments(attachments);

  store.assetMaintenance[idx] = { ...record };
  res.json({ record: store.assetMaintenance[idx], maintenance: store.assetMaintenance });
});

householdRouter.delete('/:familyId/assets/:assetId/maintenance/:recordId', (req: Request, res: Response) => {
  const { familyId, assetId, recordId } = req.params;
  const store = getHouseholdStore(familyId);
  const idx = store.assetMaintenance.findIndex((m) => m.id === recordId && m.assetId === assetId);
  if (idx === -1) {
    return res.status(404).json({ error: 'MAINTENANCE_RECORD_NOT_FOUND' });
  }
  store.assetMaintenance.splice(idx, 1);
  res.json({ success: true, deletedRecordId: recordId, maintenance: store.assetMaintenance });
});

// ==========================================
// 5. FOOD PANTRY & FRIDGE INVENTORY (HSE-04)
// ==========================================

householdRouter.get('/:familyId/pantry', (req: Request, res: Response) => {
  const { familyId } = req.params;
  const store = getHouseholdStore(familyId);
  const items = Array.from(store.pantry.values()).map((item) => ({
    ...item,
    expiryStatus: computeExpiryStatus(item.expiryDate),
  }));
  res.json({
    pantry: items,
    locations: Array.from(store.customLocations || []),
    categories: Array.from(store.customCategories || []),
  });
});

householdRouter.get('/:familyId/pantry/meta', (req: Request, res: Response) => {
  const { familyId } = req.params;
  const store = getHouseholdStore(familyId);
  res.json({
    locations: Array.from(store.customLocations || []),
    categories: Array.from(store.customCategories || []),
  });
});

householdRouter.post('/:familyId/pantry/locations', (req: Request, res: Response) => {
  const { familyId } = req.params;
  const { location } = req.body;
  if (!location || !String(location).trim()) {
    return res.status(400).json({ error: 'LOCATION_NAME_REQUIRED' });
  }
  const store = getHouseholdStore(familyId);
  const trimmed = String(location).trim();
  store.customLocations.add(trimmed);
  res.status(201).json({ success: true, location: trimmed, locations: Array.from(store.customLocations) });
});

householdRouter.delete('/:familyId/pantry/locations/:locationName', (req: Request, res: Response) => {
  const { familyId, locationName } = req.params;
  const store = getHouseholdStore(familyId);
  const decoded = decodeURIComponent(locationName);
  store.customLocations.delete(decoded);
  res.json({ success: true, deletedLocation: decoded, locations: Array.from(store.customLocations) });
});

householdRouter.post('/:familyId/pantry/categories', (req: Request, res: Response) => {
  const { familyId } = req.params;
  const { category } = req.body;
  if (!category || !String(category).trim()) {
    return res.status(400).json({ error: 'CATEGORY_NAME_REQUIRED' });
  }
  const store = getHouseholdStore(familyId);
  const trimmed = String(category).trim().toUpperCase();
  store.customCategories.add(trimmed);
  res.status(201).json({ success: true, category: trimmed, categories: Array.from(store.customCategories) });
});

householdRouter.delete('/:familyId/pantry/categories/:categoryName', (req: Request, res: Response) => {
  const { familyId, categoryName } = req.params;
  const store = getHouseholdStore(familyId);
  const decoded = decodeURIComponent(categoryName).toUpperCase();
  store.customCategories.delete(decoded);
  res.json({ success: true, deletedCategory: decoded, categories: Array.from(store.customCategories) });
});

householdRouter.post('/:familyId/pantry', (req: Request, res: Response) => {
  const { familyId } = req.params;
  const {
    itemName,
    category,
    quantity,
    unit,
    storageLocation,
    expiryDate,
    minThreshold,
    notes,
    imageUri,
    attachments,
  } = req.body;

  if (!itemName || !String(itemName).trim()) {
    return res.status(400).json({ error: 'ITEM_NAME_REQUIRED', message: 'Item name is required.' });
  }

  const store = getHouseholdStore(familyId);
  const now = Date.now();
  const q = quantity !== undefined ? Math.max(0, Number(quantity)) : 1;
  const thresh = minThreshold !== undefined ? Math.max(0, Number(minThreshold)) : 1;

  const newItem: PantryItem = {
    id: `pan-${now}-${Math.random().toString(36).substr(2, 5)}`,
    familyId,
    itemName: String(itemName).trim(),
    category: category || 'PANTRY',
    quantity: q,
    unit: unit ? String(unit).trim() : 'item',
    storageLocation: storageLocation ? String(storageLocation).trim() : undefined,
    expiryDate: expiryDate ? Number(expiryDate) : undefined,
    minThreshold: thresh,
    isLowStock: q <= thresh,
    notes: notes ? String(notes).trim() : undefined,
    imageUri: imageUri || undefined,
    attachments: sanitizeAttachments(attachments),
    createdAt: now,
    updatedAt: now,
  };

  store.pantry.set(newItem.id, newItem);
  if (isPostgresPersistenceActive()) {
    const pool = getPostgresPool();
    if (pool) {
      void updatePantryItemScoped(pool, familyId, {
        id: newItem.id,
        name: newItem.itemName,
        category: newItem.category,
        quantity: newItem.quantity,
        unit: newItem.unit,
        location: newItem.storageLocation,
        expiryDate: newItem.expiryDate,
        minimumQuantity: newItem.minThreshold,
      }).catch((err) => {
        console.error('Scoped Postgres pantry write error:', err);
      });
    }
  }
  res.status(201).json({
    pantryItem: {
      ...newItem,
      expiryStatus: computeExpiryStatus(newItem.expiryDate),
    },
  });
});

householdRouter.put('/:familyId/pantry/:itemId', (req: Request, res: Response) => {
  const { familyId, itemId } = req.params;
  const store = getHouseholdStore(familyId);
  const item = store.pantry.get(itemId);
  if (!item) {
    return res.status(404).json({ error: 'PANTRY_ITEM_NOT_FOUND' });
  }

  const updates = req.body;
  if (updates.itemName !== undefined && String(updates.itemName).trim()) {
    item.itemName = String(updates.itemName).trim();
  }
  if (updates.category !== undefined) item.category = updates.category;
  if (updates.quantity !== undefined) {
    item.quantity = Math.max(0, Number(updates.quantity));
    item.isLowStock = item.quantity <= item.minThreshold;
  }
  if (updates.unit !== undefined) item.unit = String(updates.unit).trim() || 'item';
  if (updates.storageLocation !== undefined) item.storageLocation = updates.storageLocation;
  if (updates.expiryDate !== undefined) {
    item.expiryDate = updates.expiryDate ? Number(updates.expiryDate) : undefined;
  }
  if (updates.minThreshold !== undefined) {
    item.minThreshold = Math.max(0, Number(updates.minThreshold));
    item.isLowStock = item.quantity <= item.minThreshold;
  }
  if (updates.notes !== undefined) item.notes = String(updates.notes).trim() || undefined;
  if (updates.imageUri !== undefined) item.imageUri = updates.imageUri || undefined;
  if (updates.attachments !== undefined) item.attachments = sanitizeAttachments(updates.attachments);
  item.updatedAt = Date.now();
  store.pantry.set(itemId, item);

  if (isPostgresPersistenceActive()) {
    const pool = getPostgresPool();
    if (pool) {
      void updatePantryItemScoped(pool, familyId, {
        id: item.id,
        name: item.itemName,
        category: item.category,
        quantity: item.quantity,
        unit: item.unit,
        location: item.storageLocation,
        expiryDate: item.expiryDate,
        minimumQuantity: item.minThreshold,
      }).catch((err) => {
        console.error('Scoped Postgres pantry update error:', err);
      });
    }
  }

  res.json({
    pantryItem: {
      ...item,
      expiryStatus: computeExpiryStatus(item.expiryDate),
    },
  });
});

householdRouter.post('/:familyId/pantry/:itemId/consume', (req: Request, res: Response) => {
  const { familyId, itemId } = req.params;
  const { amount } = req.body;
  const consumeAmount = amount ? Number(amount) : 1;

  const store = getHouseholdStore(familyId);
  const item = store.pantry.get(itemId);
  if (!item) {
    return res.status(404).json({ error: 'PANTRY_ITEM_NOT_FOUND' });
  }

  item.quantity = Math.max(0, Number((item.quantity - consumeAmount).toFixed(2)));
  item.isLowStock = item.quantity <= item.minThreshold;
  item.updatedAt = Date.now();
  store.pantry.set(itemId, item);

  if (isPostgresPersistenceActive()) {
    const pool = getPostgresPool();
    if (pool) {
      void updatePantryItemScoped(pool, familyId, {
        id: item.id,
        name: item.itemName,
        category: item.category,
        quantity: item.quantity,
        unit: item.unit,
        location: item.storageLocation,
        expiryDate: item.expiryDate,
        minimumQuantity: item.minThreshold,
      }).catch((err) => {
        console.error('Scoped Postgres pantry consume error:', err);
      });
    }
  }

  res.json({
    pantryItem: {
      ...item,
      expiryStatus: computeExpiryStatus(item.expiryDate),
    },
  });
});

householdRouter.post('/:familyId/pantry/:itemId/restock', (req: Request, res: Response) => {
  const { familyId, itemId } = req.params;
  const { amount } = req.body;
  const restockAmount = amount ? Number(amount) : 1;

  const store = getHouseholdStore(familyId);
  const item = store.pantry.get(itemId);
  if (!item) {
    return res.status(404).json({ error: 'PANTRY_ITEM_NOT_FOUND' });
  }

  item.quantity = Number((item.quantity + restockAmount).toFixed(2));
  item.isLowStock = item.quantity <= item.minThreshold;
  item.updatedAt = Date.now();
  store.pantry.set(itemId, item);

  if (isPostgresPersistenceActive()) {
    const pool = getPostgresPool();
    if (pool) {
      void updatePantryItemScoped(pool, familyId, {
        id: item.id,
        name: item.itemName,
        category: item.category,
        quantity: item.quantity,
        unit: item.unit,
        location: item.storageLocation,
        expiryDate: item.expiryDate,
        minimumQuantity: item.minThreshold,
      }).catch((err) => {
        console.error('Scoped Postgres pantry restock error:', err);
      });
    }
  }

  res.json({
    pantryItem: {
      ...item,
      expiryStatus: computeExpiryStatus(item.expiryDate),
    },
  });
});

householdRouter.delete('/:familyId/pantry/:itemId', (req: Request, res: Response) => {
  const { familyId, itemId } = req.params;
  const store = getHouseholdStore(familyId);
  if (!store.pantry.has(itemId)) {
    return res.status(404).json({ error: 'PANTRY_ITEM_NOT_FOUND' });
  }
  store.pantry.delete(itemId);
  if (isPostgresPersistenceActive()) {
    const pool = getPostgresPool();
    if (pool) {
      void softDeleteScopedEntity(pool, 'household_records', familyId, `PANTRY:${itemId}`).catch((err) => {
        console.error('Scoped Postgres pantry delete error:', err);
      });
    }
  }
  res.json({ success: true, deletedItemId: itemId });
});

// ==========================================
// 6. WARDROBE & OUTFIT PLANNER (HSE-07)
// ==========================================

householdRouter.get('/:familyId/wardrobe', (req: Request, res: Response) => {
  const { familyId } = req.params;
  const { memberId } = req.query;
  const store = getHouseholdStore(familyId);
  let items = Array.from(store.wardrobe.values());
  if (memberId) {
    items = items.filter((w) => w.memberId === String(memberId));
  }
  res.json({ wardrobe: items });
});

householdRouter.post('/:familyId/wardrobe', (req: Request, res: Response) => {
  const { familyId } = req.params;
  const { memberId, itemName, category, color, season, isClean, notes, imageUri, attachments } = req.body;

  if (!itemName || !String(itemName).trim() || !memberId) {
    return res.status(400).json({
      error: 'ITEM_NAME_AND_MEMBER_REQUIRED',
      message: 'Clothing item name and family member are required.',
    });
  }

  const store = getHouseholdStore(familyId);
  const now = Date.now();
  const newItem: WardrobeItem = {
    id: `ward-${now}-${Math.random().toString(36).substr(2, 5)}`,
    familyId,
    memberId,
    itemName: String(itemName).trim(),
    category: category || 'TOPS',
    color: color ? String(color).trim() : undefined,
    season: season || 'ALL_SEASON',
    isClean: isClean !== undefined ? Boolean(isClean) : true,
    imageUri: imageUri || undefined,
    attachments: sanitizeAttachments(attachments),
    notes: notes ? String(notes).trim() : undefined,
    createdAt: now,
    updatedAt: now,
  };

  store.wardrobe.set(newItem.id, newItem);
  res.status(201).json({ wardrobeItem: newItem });
});

householdRouter.put('/:familyId/wardrobe/:itemId', (req: Request, res: Response) => {
  const { familyId, itemId } = req.params;
  const store = getHouseholdStore(familyId);
  const item = store.wardrobe.get(itemId);
  if (!item) {
    return res.status(404).json({ error: 'WARDROBE_ITEM_NOT_FOUND' });
  }

  const updates = req.body;
  if (updates.itemName !== undefined && String(updates.itemName).trim()) {
    item.itemName = String(updates.itemName).trim();
  }
  if (updates.memberId !== undefined) item.memberId = updates.memberId;
  if (updates.category !== undefined) item.category = updates.category;
  if (updates.color !== undefined) item.color = String(updates.color).trim() || undefined;
  if (updates.season !== undefined) item.season = updates.season;
  if (updates.isClean !== undefined) item.isClean = Boolean(updates.isClean);
  if (updates.notes !== undefined) item.notes = String(updates.notes).trim() || undefined;
  if (updates.imageUri !== undefined) item.imageUri = updates.imageUri || undefined;
  if (updates.attachments !== undefined) item.attachments = sanitizeAttachments(updates.attachments);
  item.updatedAt = Date.now();
  store.wardrobe.set(itemId, item);

  res.json({ wardrobeItem: item });
});

householdRouter.put('/:familyId/wardrobe/:itemId/clean', (req: Request, res: Response) => {
  const { familyId, itemId } = req.params;
  const store = getHouseholdStore(familyId);
  const item = store.wardrobe.get(itemId);
  if (!item) {
    return res.status(404).json({ error: 'WARDROBE_ITEM_NOT_FOUND' });
  }

  const { isClean } = req.body;
  item.isClean = Boolean(isClean);
  item.updatedAt = Date.now();
  store.wardrobe.set(itemId, item);
  res.json({ wardrobeItem: item });
});

householdRouter.delete('/:familyId/wardrobe/:itemId', (req: Request, res: Response) => {
  const { familyId, itemId } = req.params;
  const store = getHouseholdStore(familyId);
  if (!store.wardrobe.has(itemId)) {
    return res.status(404).json({ error: 'WARDROBE_ITEM_NOT_FOUND' });
  }
  store.wardrobe.delete(itemId);
  res.json({ success: true, deletedItemId: itemId });
});

// 1-Click Laundry Cycle: washes all dirty clothing items for the family
householdRouter.post('/:familyId/wardrobe/laundry-cycle', (req: Request, res: Response) => {
  const { familyId } = req.params;
  const store = getHouseholdStore(familyId);
  let cleanedCount = 0;
  for (const item of store.wardrobe.values()) {
    if (!item.isClean) {
      item.isClean = true;
      item.updatedAt = Date.now();
      store.wardrobe.set(item.id, item);
      cleanedCount++;
    }
  }
  res.json({ success: true, cleanedCount, wardrobe: Array.from(store.wardrobe.values()) });
});

householdRouter.get('/:familyId/outfits', (req: Request, res: Response) => {
  const { familyId } = req.params;
  const { memberId } = req.query;
  const store = getHouseholdStore(familyId);
  let outfits = Array.from(store.outfits.values()).sort((a, b) => a.planDate.localeCompare(b.planDate));
  if (memberId) {
    outfits = outfits.filter((o) => o.memberId === String(memberId));
  }
  res.json({ outfits });
});

householdRouter.post('/:familyId/outfits', (req: Request, res: Response) => {
  const { familyId } = req.params;
  const { memberId, planDate, outfitName, itemIds, occasion, notes, imageUri, attachments } = req.body;

  if (!memberId || !planDate || !outfitName || !String(outfitName).trim()) {
    return res.status(400).json({
      error: 'MEMBER_DATE_AND_NAME_REQUIRED',
      message: 'Member, date, and outfit name are required.',
    });
  }

  const store = getHouseholdStore(familyId);
  const now = Date.now();
  const newOutfit: OutfitPlan = {
    id: `outfit-${now}-${Math.random().toString(36).substr(2, 5)}`,
    familyId,
    memberId,
    planDate,
    outfitName: String(outfitName).trim(),
    itemIds: Array.isArray(itemIds) ? itemIds : [],
    occasion: occasion || 'CASUAL',
    notes: notes ? String(notes).trim() : undefined,
    imageUri: imageUri || undefined,
    attachments: sanitizeAttachments(attachments),
    createdAt: now,
    updatedAt: now,
  };

  store.outfits.set(newOutfit.id, newOutfit);
  res.status(201).json({ outfitPlan: newOutfit });
});

householdRouter.put('/:familyId/outfits/:outfitId', (req: Request, res: Response) => {
  const { familyId, outfitId } = req.params;
  const store = getHouseholdStore(familyId);
  const outfit = store.outfits.get(outfitId);
  if (!outfit) {
    return res.status(404).json({ error: 'OUTFIT_NOT_FOUND' });
  }

  const { memberId, planDate, outfitName, itemIds, occasion, notes, imageUri, attachments } = req.body;
  if (memberId !== undefined) outfit.memberId = memberId;
  if (planDate !== undefined) outfit.planDate = planDate;
  if (outfitName !== undefined && String(outfitName).trim()) {
    outfit.outfitName = String(outfitName).trim();
  }
  if (Array.isArray(itemIds)) outfit.itemIds = itemIds;
  if (occasion !== undefined) outfit.occasion = occasion;
  if (notes !== undefined) outfit.notes = String(notes).trim() || undefined;
  if (imageUri !== undefined) outfit.imageUri = imageUri || undefined;
  if (attachments !== undefined) outfit.attachments = sanitizeAttachments(attachments);
  outfit.updatedAt = Date.now();

  store.outfits.set(outfitId, outfit);
  res.json({ outfitPlan: outfit });
});

householdRouter.delete('/:familyId/outfits/:outfitId', (req: Request, res: Response) => {
  const { familyId, outfitId } = req.params;
  const store = getHouseholdStore(familyId);
  if (!store.outfits.has(outfitId)) {
    return res.status(404).json({ error: 'OUTFIT_NOT_FOUND' });
  }
  store.outfits.delete(outfitId);
  res.json({ success: true, deletedOutfitId: outfitId });
});

// ==========================================
// 7. GROCERY LISTS & WORKFLOW INTEGRATION
// ==========================================

householdRouter.get('/:familyId/groceries', (req: Request, res: Response) => {
  const { familyId } = req.params;
  const store = getHouseholdStore(familyId);
  const groceries = Array.from(store.groceries.values());
  res.json({ groceries });
});

householdRouter.post('/:familyId/groceries', (req: Request, res: Response) => {
  const { familyId } = req.params;
  const { itemName, name, category, quantity, unit, notes } = req.body;
  const resolvedName = String(itemName || name || '').trim();

  if (!resolvedName) {
    return res.status(400).json({ error: 'ITEM_NAME_REQUIRED', message: 'Grocery item name is required.' });
  }

  const store = getHouseholdStore(familyId);
  const newGroc: GroceryListItem = {
    id: `groc-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    familyId,
    itemName: resolvedName,
    category: category ? (String(category).toUpperCase() as any) : 'PANTRY',
    quantity: quantity ? Math.max(0.1, Number(quantity)) : 1,
    unit: unit ? String(unit).trim() : 'item',
    notes: notes ? String(notes).trim() : undefined,
    isPurchased: false,
    createdAt: Date.now(),
  };

  store.groceries.set(newGroc.id, newGroc);
  res.status(201).json({ groceryItem: newGroc });
});

householdRouter.put('/:familyId/groceries/:itemId', (req: Request, res: Response) => {
  const { familyId, itemId } = req.params;
  const store = getHouseholdStore(familyId);
  const item = store.groceries.get(itemId);
  if (!item) {
    return res.status(404).json({ error: 'GROCERY_ITEM_NOT_FOUND' });
  }

  const { itemName, category, quantity, unit, notes, isPurchased } = req.body;
  if (itemName !== undefined && String(itemName).trim()) item.itemName = String(itemName).trim();
  if (category !== undefined) item.category = category;
  if (quantity !== undefined) item.quantity = Math.max(0.1, Number(quantity));
  if (unit !== undefined) item.unit = String(unit).trim() || 'item';
  if (notes !== undefined) item.notes = String(notes).trim() || undefined;
  if (isPurchased !== undefined) item.isPurchased = Boolean(isPurchased);

  store.groceries.set(itemId, item);
  res.json({ groceryItem: item });
});

householdRouter.delete('/:familyId/groceries/:itemId', (req: Request, res: Response) => {
  const { familyId, itemId } = req.params;
  const store = getHouseholdStore(familyId);
  if (!store.groceries.has(itemId)) {
    return res.status(404).json({ error: 'GROCERY_ITEM_NOT_FOUND' });
  }
  store.groceries.delete(itemId);
  res.json({ success: true, deletedItemId: itemId });
});

householdRouter.post('/:familyId/groceries/clear-purchased', (req: Request, res: Response) => {
  const { familyId } = req.params;
  const store = getHouseholdStore(familyId);
  let clearedCount = 0;
  for (const [id, item] of Array.from(store.groceries.entries())) {
    if (item.isPurchased) {
      store.groceries.delete(id);
      clearedCount++;
    }
  }
  res.json({ success: true, clearedCount, groceries: Array.from(store.groceries.values()) });
});

householdRouter.post('/:familyId/groceries/:itemId/purchase', (req: Request, res: Response) => {
  const { familyId, itemId } = req.params;
  try {
    const result = purchaseGroceryItem(familyId, itemId);
    res.json({
      ...result,
      restockedPantryItem: result.pantryItem,
    });
  } catch (err: any) {
    res.status(404).json({ error: err.message || 'PURCHASE_FAILED' });
  }
});

// Workflow: Compare Meal Plan Ingredients with Pantry Stock & Auto-Generate Groceries
householdRouter.post('/:familyId/workflow/sync-meals-to-groceries', (req: Request, res: Response) => {
  const { familyId } = req.params;
  const added = syncMealPlanToGroceryList(familyId);
  const store = getHouseholdStore(familyId);
  res.json({
    success: true,
    itemsAddedOrUpdated: added.length,
    allGroceries: Array.from(store.groceries.values()),
  });
});

// Workflow: Add all low-stock pantry items to grocery list
householdRouter.post(
  '/:familyId/workflow/sync-pantry-low-stock-to-groceries',
  (req: Request, res: Response) => {
    const { familyId } = req.params;
    const store = getHouseholdStore(familyId);
    const added: GroceryListItem[] = [];

    for (const item of store.pantry.values()) {
      if (item.isLowStock) {
        let existing: GroceryListItem | undefined;
        for (const g of store.groceries.values()) {
          if (!g.isPurchased && g.itemName.toLowerCase() === item.itemName.toLowerCase()) {
            existing = g;
            break;
          }
        }

        if (!existing) {
          const newG: GroceryListItem = {
            id: `groc-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            familyId,
            itemName: item.itemName,
            category: item.category === 'FRIDGE' || item.category === 'FREEZER' ? 'DAIRY' : 'PANTRY',
            quantity: Math.max(1, item.minThreshold * 2),
            unit: item.unit,
            isPurchased: false,
            sourcePantryItemId: item.id,
            createdAt: Date.now(),
          };
          store.groceries.set(newG.id, newG);
          added.push(newG);
        }
      }
    }

    res.json({
      success: true,
      addedLowStockCount: added.length,
      groceries: Array.from(store.groceries.values()),
    });
  }
);

// ==========================================
// 8. CONSOLIDATED HOUSEHOLD HUB SUMMARY
// ==========================================

householdRouter.get('/:familyId/summary', (req: Request, res: Response) => {
  const { familyId } = req.params;
  const store = getHouseholdStore(familyId);

  let expiredCount = 0;
  let expiringSoonCount = 0;
  let lowStockCount = 0;

  for (const item of store.pantry.values()) {
    if (item.isLowStock) lowStockCount++;
    const status = computeExpiryStatus(item.expiryDate);
    if (status === 'EXPIRED') expiredCount++;
    if (status === 'EXPIRING_SOON') expiringSoonCount++;
  }

  const choresList = Array.from(store.chores.values());
  const pendingChores = choresList.filter((c) => !c.isCompleted).length;
  const completedChores = choresList.filter((c) => c.isCompleted).length;

  const wardrobeList = Array.from(store.wardrobe.values());
  const laundryPendingCount = wardrobeList.filter((w) => !w.isClean).length;

  const groceriesList = Array.from(store.groceries.values());
  const groceriesRemaining = groceriesList.filter((g) => !g.isPurchased).length;

  res.json({
    success: true,
    summary: {
      familyId,
      mealCount: store.meals.size,
      recipeCount: store.recipes.size,
      pantryCount: store.pantry.size,
      lowStockCount,
      expiredCount,
      expiringSoonCount,
      groceriesRemaining,
      completedChoresToday: completedChores,
      pendingChores,
      wardrobeCount: store.wardrobe.size,
      laundryPendingCount,
      outfitPlansCount: store.outfits.size,
      assetsCount: store.assets.size,
      templatesCount: store.checklistTemplates.size,
    },
  });
});

householdRouter.get('/:familyId/overview', (req: Request, res: Response) => {
  const { familyId } = req.params;
  const store = getHouseholdStore(familyId);

  const pantryItems = Array.from(store.pantry.values()).map((item) => ({
    ...item,
    expiryStatus: computeExpiryStatus(item.expiryDate),
  }));

  res.json({
    data: {
      recipes: Array.from(store.recipes.values()).filter((r) => !r.isArchived),
      mealPlan: Array.from(store.meals.values()).sort((a, b) => a.planDate - b.planDate),
      pantry: pantryItems,
      groceries: Array.from(store.groceries.values()),
      chores: Array.from(store.chores.values()).filter((c) => !c.isArchived),
      choreHistory: store.choreHistory,
      wardrobe: Array.from(store.wardrobe.values()),
      outfits: Array.from(store.outfits.values()).sort((a, b) => a.planDate.localeCompare(b.planDate)),
      assets: Array.from(store.assets.values()).filter((a) => !a.isArchived),
      assetMaintenance: store.assetMaintenance,
      checklistTemplates: Array.from(store.checklistTemplates.values()).sort((a, b) => b.updatedAt - a.updatedAt),
      customPantryLocations: Array.from(store.customLocations || []),
      customPantryCategories: Array.from(store.customCategories || []),
    },
  });
});

