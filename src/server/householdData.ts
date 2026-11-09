/**
 * FAMILYOS — Authoritative Household Data Engine (Master Stage 2)
 * Unifies Meals, Recipes, Chores, Home Assets, Food Pantry, Wardrobe, Checklist Templates, Attachments, and Workflows.
 */

export interface HouseholdAttachment {
  id: string;
  name: string;
  type: 'PHOTO' | 'DOCUMENT';
  mimeType: string;
  dataUrl: string;
  sizeBytes?: number;
  uploadedAt: number;
}

export interface ChecklistTemplate {
  id: string;
  familyId: string;
  name: string;
  domain: 'CHORE' | 'MAINTENANCE' | 'ROUTINE';
  category: string;
  items: string[];
  createdAt: number;
  updatedAt: number;
}

export interface RecipeIngredient {
  id: string;
  recipeId: string;
  itemName: string;
  quantity: number;
  unit: string;
  notes?: string;
}

export interface RecipeInstruction {
  id: string;
  recipeId: string;
  stepNumber: number;
  instructionText: string;
}

export interface Recipe {
  id: string;
  familyId: string;
  title: string;
  description?: string;
  imageUri?: string;
  attachments?: HouseholdAttachment[];
  prepTimeMinutes: number;
  cookTimeMinutes: number;
  servings: number;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  category: string;
  dietaryNotes?: string;
  familyRating: number;
  isFavorite: boolean;
  source?: string;
  storageInstructions?: string;
  ingredients: RecipeIngredient[];
  instructions: RecipeInstruction[];
  isArchived: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface MealPlanEntry {
  id: string;
  familyId: string;
  planDate: number; // Epoch millis start of day
  mealType: 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'SNACK';
  recipeId?: string;
  customMealTitle?: string;
  servings: number;
  notes?: string;
  imageUri?: string;
  attachments?: HouseholdAttachment[];
  createdAt: number;
}

export interface GroceryListItem {
  id: string;
  familyId: string;
  itemName: string;
  category: 'PRODUCE' | 'DAIRY' | 'MEAT' | 'PANTRY' | 'BAKERY' | 'FROZEN' | 'OTHER';
  quantity: number;
  unit: string;
  notes?: string;
  isPurchased: boolean;
  sourceRecipeId?: string;
  sourcePantryItemId?: string;
  createdAt: number;
}

export interface ChoreChecklistItem {
  id: string;
  text: string;
  isDone: boolean;
}

export interface Chore {
  id: string;
  familyId: string;
  title: string;
  description?: string;
  assignedMemberId?: string;
  zone: 'KITCHEN' | 'LIVING_ROOM' | 'BEDROOMS' | 'BATHROOMS' | 'OUTDOORS' | 'GENERAL' | string;
  location?: string;
  frequency: 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | 'CUSTOM' | string;
  rewardPoints: number;
  nextDueDate: number; // Epoch millis
  requiresVerification: boolean;
  isCompleted: boolean;
  checklist?: ChoreChecklistItem[];
  imageUri?: string;
  attachments?: HouseholdAttachment[];
  isArchived: boolean;
  createdAt: number;
}

export interface ChoreCompletionRecord {
  id: string;
  choreId: string;
  choreTitle?: string;
  familyId: string;
  completedByMemberId: string;
  completedAt: number;
  pointsEarned: number;
}

export interface AssetMaintenanceRecord {
  id: string;
  assetId: string;
  familyId: string;
  maintenanceDate: number;
  performedBy: string;
  costCents: number;
  notes?: string;
  nextDueDate?: number;
  checklist?: ChoreChecklistItem[];
  attachments?: HouseholdAttachment[];
}

export interface HomeAsset {
  id: string;
  familyId: string;
  name: string;
  category: 'APPLIANCES' | 'FURNITURE' | 'ELECTRONICS' | 'VEHICLES' | 'TOOLS' | 'HVAC' | 'PLUMBING' | 'ELECTRICAL' | 'OTHER';
  description?: string;
  purchaseDate?: number;
  purchasePriceCents: number;
  modelNumber?: string;
  serialNumber?: string;
  location?: string;
  warrantyExpiration?: number;
  maintenanceFrequencyMonths?: number;
  lastMaintenanceDate?: number;
  nextMaintenanceDate?: number;
  imageUri?: string;
  attachments?: HouseholdAttachment[];
  isArchived: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface PantryItem {
  id: string;
  familyId: string;
  itemName: string;
  category: 'PANTRY' | 'FRIDGE' | 'FREEZER' | 'SPICES' | 'SNACKS' | 'BEVERAGES' | 'OTHER' | string;
  quantity: number;
  unit: string;
  storageLocation?: string;
  expiryDate?: number; // Epoch millis
  minThreshold: number;
  isLowStock: boolean;
  notes?: string;
  imageUri?: string;
  attachments?: HouseholdAttachment[];
  createdAt: number;
  updatedAt: number;
}

export interface WardrobeItem {
  id: string;
  familyId: string;
  memberId: string;
  itemName: string;
  category: 'TOPS' | 'BOTTOMS' | 'DRESSES' | 'OUTERWEAR' | 'SHOES' | 'ACCESSORIES' | 'OTHER';
  color?: string;
  season: 'SPRING' | 'SUMMER' | 'FALL' | 'WINTER' | 'ALL_SEASON';
  isClean: boolean;
  imageUri?: string;
  attachments?: HouseholdAttachment[];
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

export interface OutfitPlan {
  id: string;
  familyId: string;
  memberId: string;
  planDate: string; // YYYY-MM-DD
  outfitName: string;
  itemIds: string[];
  occasion: 'SCHOOL' | 'WORK' | 'CHURCH' | 'CASUAL' | 'SPORTS' | 'FORMAL' | 'OTHER';
  notes?: string;
  imageUri?: string;
  attachments?: HouseholdAttachment[];
  createdAt: number;
  updatedAt: number;
}

import { loadStore, saveStoreAtomically } from '../../server.js';
import { addCalendarMonthsClamped } from './financeCalculations';

// Durable store keyed by familyId
export interface FamilyHouseholdStore {
  recipes: Map<string, Recipe>;
  meals: Map<string, MealPlanEntry>;
  groceries: Map<string, GroceryListItem>;
  chores: Map<string, Chore>;
  choreHistory: ChoreCompletionRecord[];
  assets: Map<string, HomeAsset>;
  assetMaintenance: AssetMaintenanceRecord[];
  pantry: Map<string, PantryItem>;
  wardrobe: Map<string, WardrobeItem>;
  outfits: Map<string, OutfitPlan>;
  checklistTemplates: Map<string, ChecklistTemplate>;
  customLocations: Set<string>;
  customCategories: Set<string>;
}

const DEFAULT_CUSTOM_LOCATIONS = [
  'Pantry Shelf 1',
  'Pantry Shelf 2',
  'Walk-in Pantry',
  'Main Fridge Door',
  'Main Fridge Top Shelf',
  'Main Fridge Crisper',
  'Deep Freezer',
  'Spice Rack',
  'Root Cellar',
  'Wine & Beverage Cellar',
  'Garage Utility Storage',
];

const DEFAULT_CUSTOM_CATEGORIES = [
  'PANTRY',
  'FRIDGE',
  'FREEZER',
  'SPICES',
  'BAKING',
  'SNACKS',
  'BEVERAGES',
  'PRODUCE',
  'DAIRY',
  'MEAT & SEAFOOD',
  'CANNED GOODS',
];

export function buildDefaultChecklistTemplates(familyId: string): ChecklistTemplate[] {
  const now = Date.now();
  return [
    {
      id: `tpl-${familyId}-kitchen-reset`,
      familyId,
      name: 'Kitchen Evening Reset',
      domain: 'CHORE',
      category: 'KITCHEN',
      items: [
        'Clear and sanitize all countertops and island',
        'Load dishwasher and start evening cycle',
        'Wipe down stovetop, microwave, and sink basin',
        'Sweep kitchen floor and high-traffic dining area',
        'Empty kitchen trash and recycling bins if full',
      ],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: `tpl-${familyId}-bathroom-sanitize`,
      familyId,
      name: 'Bathroom Deep Clean & Restock',
      domain: 'CHORE',
      category: 'BATHROOMS',
      items: [
        'Scrub and disinfect toilet bowl and exterior surfaces',
        'Clean mirror and glass shower enclosure',
        'Sanitize sink basin, faucet, and vanity countertop',
        'Replace hand towels and restock soap / tissue',
        'Mop tile floor with disinfectant solution',
      ],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: `tpl-${familyId}-bedroom-weekly`,
      familyId,
      name: 'Weekly Bedroom Refresh',
      domain: 'CHORE',
      category: 'BEDROOMS',
      items: [
        'Strip bed linens and put fresh sheets on bed',
        'Gather laundry and sort into hamper',
        'Dust nightstands, lamps, and window sills',
        'Vacuum bedroom carpet or sweep hardwood floor',
      ],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: `tpl-${familyId}-morning-routine`,
      familyId,
      name: 'Morning Household Launch Routine',
      domain: 'ROUTINE',
      category: 'GENERAL',
      items: [
        'Unload clean dishes from dishwasher',
        'Review today’s meal plan and pull freezer items to thaw',
        'Check school and work bags by the entryway',
        'Quick 5-minute living room cushion and surface tidy',
      ],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: `tpl-${familyId}-hvac-service`,
      familyId,
      name: 'HVAC Seasonal Filter & Safety Inspection',
      domain: 'MAINTENANCE',
      category: 'HVAC',
      items: [
        'Replace air return filter (check MERV rating and airflow arrow)',
        'Inspect thermostat schedule and backup battery',
        'Clear leaves and debris around exterior condenser unit',
        'Flush condensate drain line and inspect drip pan',
        'Verify balanced airflow across main supply registers',
      ],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: `tpl-${familyId}-appliance-care`,
      familyId,
      name: 'Major Kitchen Appliance Preventive Care',
      domain: 'MAINTENANCE',
      category: 'APPLIANCES',
      items: [
        'Vacuum refrigerator condenser coils and inspect door gaskets',
        'Replace refrigerator water and ice filter cartridge',
        'Remove and rinse dishwasher filter trap and spray arms',
        'Inspect braided water supply lines under sink for moisture',
      ],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: `tpl-${familyId}-vehicle-check`,
      familyId,
      name: 'Monthly Vehicle Safety & Fluid Check',
      domain: 'MAINTENANCE',
      category: 'VEHICLES',
      items: [
        'Check tire pressure on all four tires and spare',
        'Inspect engine oil level and top off windshield washer fluid',
        'Verify headlights, brake lights, and turn signals',
        'Confirm emergency roadside kit and registration in glovebox',
      ],
      createdAt: now,
      updatedAt: now,
    },
  ];
}

function wrapHouseholdEntityProxy<T extends object>(entity: T, onMutate: () => void): T {
  return new Proxy(entity, {
    set(target, prop, value, receiver) {
      const res = Reflect.set(target, prop, value, receiver);
      onMutate();
      return res;
    },
  });
}

class DurableHouseholdMap<K, V extends { id: string; familyId: string }> extends Map<K, V> {
  private onMutate?: () => void;

  constructor(entries: Array<[K, V]>, onMutate?: () => void) {
    super(entries.map(([k, v]) => [k, onMutate ? wrapHouseholdEntityProxy(v, onMutate) : v]));
    this.onMutate = onMutate;
  }

  override set(key: K, value: V): this {
    const wrapped = this.onMutate ? wrapHouseholdEntityProxy(value, this.onMutate) : value;
    super.set(key, wrapped);
    if (this.onMutate) this.onMutate();
    return this;
  }

  override delete(key: K): boolean {
    const res = super.delete(key);
    if (res && this.onMutate) this.onMutate();
    return res;
  }

  override clear(): void {
    super.clear();
    if (this.onMutate) this.onMutate();
  }
}

class DurableHouseholdSet<T> extends Set<T> {
  private onMutate?: () => void;

  constructor(values: Iterable<T>, onMutate?: () => void) {
    super(values);
    this.onMutate = onMutate;
  }

  override add(value: T): this {
    super.add(value);
    if (this.onMutate) this.onMutate();
    return this;
  }

  override delete(value: T): boolean {
    const res = super.delete(value);
    if (res && this.onMutate) this.onMutate();
    return res;
  }

  override clear(): void {
    super.clear();
    if (this.onMutate) this.onMutate();
  }
}

function createDurableArray<T extends object>(items: T[], onMutate: () => void): T[] {
  const wrappedItems = items.map((item) => wrapHouseholdEntityProxy({ ...item }, onMutate));
  return new Proxy(wrappedItems, {
    set(target, prop, value, receiver) {
      const wrappedVal =
        value && typeof value === 'object' ? wrapHouseholdEntityProxy(value, onMutate) : value;
      const res = Reflect.set(target, prop, wrappedVal, receiver);
      if (prop !== 'length') {
        onMutate();
      }
      return res;
    },
  });
}

function replaceFamilySlice<T extends { id: string; familyId: string }>(
  existing: T[] | undefined,
  familyId: string,
  map: Map<string, T>
): T[] {
  const others = (existing || []).filter((item) => item.familyId !== familyId);
  const current = Array.from(map.values()).map((item) => ({ ...item, familyId }));
  return [...others, ...current];
}

function replaceFamilyArraySlice<T extends { id: string; familyId: string }>(
  existing: T[] | undefined,
  familyId: string,
  arr: T[]
): T[] {
  const others = (existing || []).filter((item) => item.familyId !== familyId);
  const current = arr.map((item) => ({ ...item, familyId }));
  return [...others, ...current];
}

export function getHouseholdStore(familyId: string): FamilyHouseholdStore {
  const shared = loadStore();

  let storeRef: FamilyHouseholdStore | null = null;
  let syncing = false;

  const persist = () => {
    if (syncing || !storeRef) return;
    syncing = true;
    try {
      const currentShared = loadStore();
      currentShared.householdRecipes = replaceFamilySlice(
        currentShared.householdRecipes,
        familyId,
        storeRef.recipes
      );
      currentShared.householdMeals = replaceFamilySlice(
        currentShared.householdMeals,
        familyId,
        storeRef.meals
      );
      currentShared.householdGroceries = replaceFamilySlice(
        currentShared.householdGroceries,
        familyId,
        storeRef.groceries
      );
      currentShared.householdChores = replaceFamilySlice(
        currentShared.householdChores,
        familyId,
        storeRef.chores
      );
      currentShared.householdChoreHistory = replaceFamilyArraySlice(
        currentShared.householdChoreHistory,
        familyId,
        storeRef.choreHistory
      );
      currentShared.householdAssets = replaceFamilySlice(
        currentShared.householdAssets,
        familyId,
        storeRef.assets
      );
      currentShared.householdAssetMaintenance = replaceFamilyArraySlice(
        currentShared.householdAssetMaintenance,
        familyId,
        storeRef.assetMaintenance
      );
      currentShared.householdPantry = replaceFamilySlice(
        currentShared.householdPantry,
        familyId,
        storeRef.pantry
      );
      currentShared.householdWardrobe = replaceFamilySlice(
        currentShared.householdWardrobe,
        familyId,
        storeRef.wardrobe
      );
      currentShared.householdOutfits = replaceFamilySlice(
        currentShared.householdOutfits,
        familyId,
        storeRef.outfits
      );
      (currentShared as any).householdChecklistTemplates = replaceFamilySlice(
        (currentShared as any).householdChecklistTemplates,
        familyId,
        storeRef.checklistTemplates
      );
      currentShared.householdCustomTaxonomies = currentShared.householdCustomTaxonomies || {};
      currentShared.householdCustomTaxonomies[familyId] = {
        locations: Array.from(storeRef.customLocations),
        categories: Array.from(storeRef.customCategories),
      };
      saveStoreAtomically(currentShared);
    } finally {
      syncing = false;
    }
  };

  const recipesEntries: Array<[string, Recipe]> = (shared.householdRecipes || [])
    .filter((r: Recipe) => r.familyId === familyId)
    .map((r: Recipe) => [r.id, { ...r }]);

  const mealsEntries: Array<[string, MealPlanEntry]> = (shared.householdMeals || [])
    .filter((m: MealPlanEntry) => m.familyId === familyId)
    .map((m: MealPlanEntry) => [m.id, { ...m }]);

  const groceriesEntries: Array<[string, GroceryListItem]> = (shared.householdGroceries || [])
    .filter((g: GroceryListItem) => g.familyId === familyId)
    .map((g: GroceryListItem) => [g.id, { ...g }]);

  const choresEntries: Array<[string, Chore]> = (shared.householdChores || [])
    .filter((c: Chore) => c.familyId === familyId)
    .map((c: Chore) => [c.id, { ...c }]);

  const choreHistoryItems: ChoreCompletionRecord[] = (shared.householdChoreHistory || []).filter(
    (ch: ChoreCompletionRecord) => ch.familyId === familyId
  );

  const assetsEntries: Array<[string, HomeAsset]> = (shared.householdAssets || [])
    .filter((a: HomeAsset) => a.familyId === familyId)
    .map((a: HomeAsset) => [a.id, { ...a }]);

  const assetMaintenanceItems: AssetMaintenanceRecord[] = (
    shared.householdAssetMaintenance || []
  ).filter((m: AssetMaintenanceRecord) => m.familyId === familyId);

  const pantryEntries: Array<[string, PantryItem]> = (shared.householdPantry || [])
    .filter((p: PantryItem) => p.familyId === familyId)
    .map((p: PantryItem) => [p.id, { ...p }]);

  const wardrobeEntries: Array<[string, WardrobeItem]> = (shared.householdWardrobe || [])
    .filter((w: WardrobeItem) => w.familyId === familyId)
    .map((w: WardrobeItem) => [w.id, { ...w }]);

  const outfitsEntries: Array<[string, OutfitPlan]> = (shared.householdOutfits || [])
    .filter((o: OutfitPlan) => o.familyId === familyId)
    .map((o: OutfitPlan) => [o.id, { ...o }]);

  const rawTemplates: ChecklistTemplate[] = (
    (shared as any).householdChecklistTemplates || []
  ).filter((t: ChecklistTemplate) => t.familyId === familyId);

  const effectiveTemplates =
    rawTemplates.length > 0 ? rawTemplates : buildDefaultChecklistTemplates(familyId);

  const templatesEntries: Array<[string, ChecklistTemplate]> = effectiveTemplates.map(
    (t: ChecklistTemplate) => [t.id, { ...t }]
  );

  const tax = shared.householdCustomTaxonomies?.[familyId];
  const initialLocations = tax?.locations?.length ? tax.locations : DEFAULT_CUSTOM_LOCATIONS;
  const initialCategories = tax?.categories?.length ? tax.categories : DEFAULT_CUSTOM_CATEGORIES;

  storeRef = {
    recipes: new DurableHouseholdMap(recipesEntries, persist),
    meals: new DurableHouseholdMap(mealsEntries, persist),
    groceries: new DurableHouseholdMap(groceriesEntries, persist),
    chores: new DurableHouseholdMap(choresEntries, persist),
    choreHistory: createDurableArray(choreHistoryItems, persist),
    assets: new DurableHouseholdMap(assetsEntries, persist),
    assetMaintenance: createDurableArray(assetMaintenanceItems, persist),
    pantry: new DurableHouseholdMap(pantryEntries, persist),
    wardrobe: new DurableHouseholdMap(wardrobeEntries, persist),
    outfits: new DurableHouseholdMap(outfitsEntries, persist),
    checklistTemplates: new DurableHouseholdMap(templatesEntries, persist),
    customLocations: new DurableHouseholdSet(initialLocations, persist),
    customCategories: new DurableHouseholdSet(initialCategories, persist),
  };

  if (rawTemplates.length === 0) {
    persist();
  }

  return storeRef;
}

// ==========================================
// WORKFLOW LOGIC & CROSS-MODULE INTEGRATION
// ==========================================

export function computeExpiryStatus(
  expiryDate?: number,
  now: number = Date.now(),
  warningDays = 3
): 'EXPIRED' | 'EXPIRING_SOON' | 'SAFE' | 'UNKNOWN' {
  if (!expiryDate) return 'UNKNOWN';
  const dayMs = 24 * 60 * 60 * 1000;
  if (expiryDate < now) return 'EXPIRED';
  if (expiryDate <= now + warningDays * dayMs) return 'EXPIRING_SOON';
  return 'SAFE';
}

/**
 * Unit conversion helper for compatible household quantities (weight & volume).
 * Returns `null` if units are in different dimensions (e.g. `g` vs `L` or `can`).
 */
export function convertHouseholdQuantity(
  quantity: number,
  fromUnit: string,
  toUnit: string
): number | null {
  const normFrom = String(fromUnit || '').trim().toLowerCase();
  const normTo = String(toUnit || '').trim().toLowerCase();
  if (normFrom === normTo) return quantity;

  const weightToGrams: Record<string, number> = {
    g: 1,
    gram: 1,
    grams: 1,
    kg: 1000,
    kilogram: 1000,
    kilograms: 1000,
    oz: 28.3495,
    ounce: 28.3495,
    ounces: 28.3495,
    lb: 453.592,
    lbs: 453.592,
    pound: 453.592,
    pounds: 453.592,
  };

  if (weightToGrams[normFrom] !== undefined && weightToGrams[normTo] !== undefined) {
    const inGrams = quantity * weightToGrams[normFrom];
    return Number((inGrams / weightToGrams[normTo]).toFixed(4));
  }

  const volumeToMl: Record<string, number> = {
    ml: 1,
    milliliter: 1,
    milliliters: 1,
    l: 1000,
    liter: 1000,
    liters: 1000,
    tsp: 4.92892,
    teaspoon: 4.92892,
    tbsp: 14.7868,
    tablespoon: 14.7868,
    cup: 240,
    cups: 240,
    gal: 3785.41,
    gallon: 3785.41,
    gallons: 3785.41,
  };

  if (volumeToMl[normFrom] !== undefined && volumeToMl[normTo] !== undefined) {
    const inMl = quantity * volumeToMl[normFrom];
    return Number((inMl / volumeToMl[normTo]).toFixed(4));
  }

  return null;
}

/**
 * Calendar-aware chore recurrence calculator.
 * For `MONTHLY` chores, advances by 1 true calendar month (clamping month-end dates such as
 * Jan 31 -> Feb 28/29) instead of adding a naive `30 * 86400000` ms.
 */
export function computeNextChoreDueDate(currentDueDate: number, frequency: string): number {
  const dayMs = 24 * 60 * 60 * 1000;
  const freqUpper = String(frequency || '').toUpperCase();
  if (freqUpper === 'DAILY') {
    return currentDueDate + dayMs;
  }
  if (freqUpper === 'WEEKLY') {
    return currentDueDate + 7 * dayMs;
  }
  if (freqUpper === 'BIWEEKLY') {
    return currentDueDate + 14 * dayMs;
  }
  if (freqUpper === 'MONTHLY') {
    const d = new Date(currentDueDate);
    const next = addCalendarMonthsClamped(
      d.getUTCFullYear(),
      d.getUTCMonth() + 1,
      d.getUTCDate(),
      1
    );
    return Date.UTC(
      next.year,
      next.month - 1,
      next.day,
      d.getUTCHours(),
      d.getUTCMinutes(),
      d.getUTCSeconds(),
      d.getUTCMilliseconds()
    );
  }
  return currentDueDate;
}

/**
 * Workflow A: Inspects meal plan ingredients and compares with pantry inventory.
 * Automatically adds missing or insufficient ingredients to the grocery list (converting compatible units).
 */
export function syncMealPlanToGroceryList(familyId: string): GroceryListItem[] {
  const store = getHouseholdStore(familyId);
  const addedItems: GroceryListItem[] = [];

  for (const meal of store.meals.values()) {
    if (!meal.recipeId) continue;
    const recipe = store.recipes.get(meal.recipeId);
    if (!recipe) continue;

    for (const ingredient of recipe.ingredients) {
      let foundPantry: PantryItem | undefined;
      for (const item of store.pantry.values()) {
        if (item.itemName.toLowerCase() === ingredient.itemName.toLowerCase()) {
          foundPantry = item;
          break;
        }
      }

      let pantryQtyInRecipeUnit = 0;
      if (foundPantry) {
        const converted = convertHouseholdQuantity(
          foundPantry.quantity,
          foundPantry.unit,
          ingredient.unit
        );
        if (converted !== null) {
          pantryQtyInRecipeUnit = converted;
        }
      }

      const neededQty = ingredient.quantity;

      if (pantryQtyInRecipeUnit < neededQty) {
        const missingQty = Math.max(1, Number((neededQty - pantryQtyInRecipeUnit).toFixed(2)));

        let existingGrocery: GroceryListItem | undefined;
        for (const g of store.groceries.values()) {
          if (!g.isPurchased && g.itemName.toLowerCase() === ingredient.itemName.toLowerCase()) {
            existingGrocery = g;
            break;
          }
        }

        if (existingGrocery) {
          const convertedMissing = convertHouseholdQuantity(
            missingQty,
            ingredient.unit,
            existingGrocery.unit
          );
          const effectiveMissing = convertedMissing !== null ? convertedMissing : missingQty;
          existingGrocery.quantity = Math.max(existingGrocery.quantity, effectiveMissing);
          store.groceries.set(existingGrocery.id, existingGrocery);
          addedItems.push(existingGrocery);
        } else {
          const newGroc: GroceryListItem = {
            id: `groc-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            familyId,
            itemName: ingredient.itemName,
            category: 'PANTRY',
            quantity: missingQty,
            unit: ingredient.unit,
            isPurchased: false,
            sourceRecipeId: recipe.id,
            sourcePantryItemId: foundPantry?.id,
            createdAt: Date.now(),
          };
          store.groceries.set(newGroc.id, newGroc);
          addedItems.push(newGroc);
        }
      }
    }
  }

  return addedItems;
}

/**
 * Workflow B: Marks a grocery list item as purchased and auto-replenishes or creates pantry inventory.
 */
export function purchaseGroceryItem(
  familyId: string,
  groceryItemId: string
): { groceryItem: GroceryListItem; pantryItem: PantryItem; alreadyPurchased: boolean } {
  const store = getHouseholdStore(familyId);
  const grocery = store.groceries.get(groceryItemId);
  if (!grocery) {
    throw new Error('GROCERY_ITEM_NOT_FOUND');
  }

  if (grocery.isPurchased) {
    let matchedPantry = grocery.sourcePantryItemId
      ? store.pantry.get(grocery.sourcePantryItemId)
      : undefined;
    if (!matchedPantry) {
      for (const p of store.pantry.values()) {
        if (p.itemName.toLowerCase() === grocery.itemName.toLowerCase()) {
          matchedPantry = p;
          break;
        }
      }
    }
    return { groceryItem: grocery, pantryItem: matchedPantry!, alreadyPurchased: true };
  }

  grocery.isPurchased = true;
  store.groceries.set(grocery.id, grocery);

  let matchedPantry: PantryItem | undefined;
  if (grocery.sourcePantryItemId) {
    matchedPantry = store.pantry.get(grocery.sourcePantryItemId);
  }
  if (!matchedPantry) {
    for (const p of store.pantry.values()) {
      if (p.itemName.toLowerCase() === grocery.itemName.toLowerCase()) {
        matchedPantry = p;
        break;
      }
    }
  }

  const now = Date.now();
  if (matchedPantry) {
    const convertedQty = convertHouseholdQuantity(
      grocery.quantity,
      grocery.unit,
      matchedPantry.unit
    );
    matchedPantry.quantity += convertedQty !== null ? convertedQty : grocery.quantity;
    matchedPantry.isLowStock = matchedPantry.quantity <= matchedPantry.minThreshold;
    matchedPantry.updatedAt = now;
    store.pantry.set(matchedPantry.id, matchedPantry);
  } else {
    matchedPantry = {
      id: `pan-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      familyId,
      itemName: grocery.itemName,
      category:
        grocery.category === 'PRODUCE' ||
        grocery.category === 'DAIRY' ||
        grocery.category === 'MEAT'
          ? 'FRIDGE'
          : 'PANTRY',
      quantity: grocery.quantity,
      unit: grocery.unit,
      minThreshold: 1,
      isLowStock: false,
      createdAt: now,
      updatedAt: now,
    };
    store.pantry.set(matchedPantry.id, matchedPantry);
  }

  return { groceryItem: grocery, pantryItem: matchedPantry, alreadyPurchased: false };
}

/**
 * Workflow C: Records chore completion, awards points to member, and rolls next due date forward
 * using calendar-aware recurrence (`computeNextChoreDueDate`).
 */
export function recordChoreCompletion(
  familyId: string,
  choreId: string,
  memberId: string
): { chore: Chore; completionRecord: ChoreCompletionRecord; alreadyCompleted?: boolean } {
  const store = getHouseholdStore(familyId);
  const chore = store.chores.get(choreId);
  if (!chore) {
    throw new Error('CHORE_NOT_FOUND');
  }

  const now = Date.now();

  if (chore.isCompleted) {
    const dupRecord: ChoreCompletionRecord = {
      id: `c-comp-dup-${now}-${Math.random().toString(36).substr(2, 5)}`,
      choreId: chore.id,
      choreTitle: chore.title,
      familyId,
      completedByMemberId: memberId,
      completedAt: now,
      pointsEarned: 0,
    };
    return { chore, completionRecord: dupRecord, alreadyCompleted: true };
  }

  chore.isCompleted = true;
  chore.nextDueDate = computeNextChoreDueDate(chore.nextDueDate, chore.frequency);
  store.chores.set(chore.id, chore);

  const record: ChoreCompletionRecord = {
    id: `c-comp-${now}-${Math.random().toString(36).substr(2, 5)}`,
    choreId: chore.id,
    choreTitle: chore.title,
    familyId,
    completedByMemberId: memberId,
    completedAt: now,
    pointsEarned: chore.rewardPoints,
  };
  store.choreHistory.push(record);

  return { chore, completionRecord: record, alreadyCompleted: false };
}
