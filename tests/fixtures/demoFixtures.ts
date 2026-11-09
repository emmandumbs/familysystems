import type {
  SavingsGoal,
  RecurringRule,
  InvestmentHolding,
  AccountReconciliation,
} from '../../src/server/financeData';
import {
  computeInvestmentValuation,
  computeUnrealizedGainLoss,
  computeGainLossBasisPoints,
  computeSuggestedMonthlyContribution,
} from '../../src/server/financeData';
import type {
  Recipe,
  MealPlanEntry,
  GroceryListItem,
  Chore,
  HomeAsset,
  PantryItem,
  WardrobeItem,
  OutfitPlan,
} from '../../src/server/householdData';

/**
 * NON-PRODUCTION DEMO & TEST FIXTURES
 * ===================================
 * These fixtures exist solely for non-production test suites (`fam-1`) and are strictly
 * blocked when `process.env.NODE_ENV === 'production'`. Real or newly created family
 * accounts never invoke these builders.
 */
export function assertNonProductionFixtureAllowed(): void {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Demo fixtures are strictly prohibited in production mode.');
  }
}

export function buildFam1DemoFinanceData(familyId = 'fam-1'): {
  savingsGoals: SavingsGoal[];
  reconciliations: AccountReconciliation[];
  recurringRules: RecurringRule[];
  investmentHoldings: InvestmentHolding[];
} {
  assertNonProductionFixtureAllowed();
  const now = Date.now();
  const dayMs = 24 * 3600 * 1000;

  const g1: SavingsGoal = {
    id: 'goal-emergency-fund',
    familyId,
    linkedAccountId: 'acc-2',
    title: '6-Month Emergency Reserve',
    targetCents: 3000000,
    currentCents: 2450000,
    plannedMonthlyContributionCents: 50000,
    targetDate: now + 120 * dayMs,
    isCompleted: false,
    suggestedMonthlyContributionCents: computeSuggestedMonthlyContribution(3000000, 2450000, now + 120 * dayMs),
    contributions: [
      {
        id: 'contrib-em-1',
        goalId: 'goal-emergency-fund',
        amountCents: 150000,
        fundingAccountId: 'acc-1',
        notes: 'Quarterly household reserve allocation',
        contributedBy: 'Sarah Henderson',
        contributedAt: now - 30 * dayMs,
      },
      {
        id: 'contrib-em-2',
        goalId: 'goal-emergency-fund',
        amountCents: 50000,
        fundingAccountId: 'acc-1',
        notes: 'Monthly reserve deposit',
        contributedBy: 'David Henderson',
        contributedAt: now - 10 * dayMs,
      },
    ],
    createdAt: now - 90 * dayMs,
    updatedAt: now,
  };

  const g2: SavingsGoal = {
    id: 'goal-college-fund',
    familyId,
    linkedAccountId: 'acc-2',
    title: 'Children College Tuition Reserve',
    targetCents: 5000000,
    currentCents: 1850000,
    plannedMonthlyContributionCents: 35000,
    targetDate: now + 365 * dayMs,
    isCompleted: false,
    suggestedMonthlyContributionCents: computeSuggestedMonthlyContribution(5000000, 1850000, now + 365 * dayMs),
    contributions: [
      {
        id: 'contrib-col-1',
        goalId: 'goal-college-fund',
        amountCents: 100000,
        fundingAccountId: 'acc-1',
        notes: 'Annual 529 tuition contribution',
        contributedBy: 'Sarah Henderson',
        contributedAt: now - 45 * dayMs,
      },
    ],
    createdAt: now - 60 * dayMs,
    updatedAt: now,
  };

  const rec1: AccountReconciliation = {
    id: 'rec-init-acc-1',
    familyId,
    accountId: 'acc-1',
    statementDate: now - 7 * dayMs,
    statementEndingBalanceCents: 845250,
    ledgerBalanceCents: 845250,
    discrepancyCents: 0,
    isReconciled: true,
    reconciledBy: 'Sarah Henderson',
    reconciledAt: now - 7 * dayMs,
  };

  const r1: RecurringRule = {
    id: 'rec-salary-david',
    familyId,
    accountId: 'acc-1',
    title: 'Primary Tech Salary Deposit',
    amountCents: 425000,
    transactionType: 'INCOME',
    category: 'SALARY',
    recurrenceInterval: 'BIWEEKLY',
    nextDueDate: now + 6 * dayMs,
    isActive: true,
    isAutoPay: false,
    createdAt: now - 30 * dayMs,
    updatedAt: now,
  };

  const r2: RecurringRule = {
    id: 'rec-mortgage-housing',
    familyId,
    accountId: 'acc-1',
    title: 'Residential Mortgage Payment',
    amountCents: 215000,
    transactionType: 'EXPENSE',
    category: 'HOUSING',
    recurrenceInterval: 'MONTHLY',
    nextDueDate: now + 12 * dayMs,
    isActive: true,
    isAutoPay: true,
    createdAt: now - 30 * dayMs,
    updatedAt: now,
  };

  const r3: RecurringRule = {
    id: 'rec-fiber-internet',
    familyId,
    accountId: 'acc-1',
    title: 'High-Speed Fiber Internet',
    amountCents: 8500,
    transactionType: 'EXPENSE',
    category: 'UTILITIES',
    recurrenceInterval: 'MONTHLY',
    nextDueDate: now + 18 * dayMs,
    isActive: true,
    isAutoPay: true,
    createdAt: now - 30 * dayMs,
    updatedAt: now,
  };

  const inv1Val = computeInvestmentValuation(1500000, 22500);
  const inv1Gain = computeUnrealizedGainLoss(inv1Val, 30000);
  const inv1: InvestmentHolding = {
    id: 'inv-aapl',
    familyId,
    accountId: 'acc-3',
    symbol: 'AAPL',
    assetName: 'Apple Inc.',
    assetType: 'STOCK',
    quantityMicroshares: 1500000,
    costBasisCents: 30000,
    currentPriceCents: 22500,
    currency: 'USD',
    notes: 'Long-term family tech holding',
    lastPriceUpdatedAt: now,
    currentValuationCents: inv1Val,
    unrealizedGainLossCents: inv1Gain,
    gainLossBasisPoints: computeGainLossBasisPoints(inv1Gain, 30000),
    version: 1,
    isDeleted: false,
    createdAt: now - 90 * dayMs,
    updatedAt: now,
  };

  const inv2Val = computeInvestmentValuation(50250000, 24000);
  const inv2Gain = computeUnrealizedGainLoss(inv2Val, 1100000);
  const inv2: InvestmentHolding = {
    id: 'inv-vti',
    familyId,
    accountId: 'acc-3',
    symbol: 'VTI',
    assetName: 'Vanguard Total Stock Market ETF',
    assetType: 'ETF',
    quantityMicroshares: 50250000,
    costBasisCents: 1100000,
    currentPriceCents: 24000,
    currency: 'USD',
    notes: 'Core broad-market index position',
    lastPriceUpdatedAt: now,
    currentValuationCents: inv2Val,
    unrealizedGainLossCents: inv2Gain,
    gainLossBasisPoints: computeGainLossBasisPoints(inv2Gain, 1100000),
    version: 1,
    isDeleted: false,
    createdAt: now - 180 * dayMs,
    updatedAt: now,
  };

  const inv3Val = computeInvestmentValuation(52000, 6500000);
  const inv3Gain = computeUnrealizedGainLoss(inv3Val, 300000);
  const inv3: InvestmentHolding = {
    id: 'inv-btc',
    familyId,
    accountId: 'acc-3',
    symbol: 'BTC',
    assetName: 'Bitcoin',
    assetType: 'CRYPTO',
    quantityMicroshares: 52000,
    costBasisCents: 300000,
    currentPriceCents: 6500000,
    currency: 'USD',
    notes: 'Sovereign digital reserve allocation',
    lastPriceUpdatedAt: now,
    currentValuationCents: inv3Val,
    unrealizedGainLossCents: inv3Gain,
    gainLossBasisPoints: computeGainLossBasisPoints(inv3Gain, 300000),
    version: 1,
    isDeleted: false,
    createdAt: now - 45 * dayMs,
    updatedAt: now,
  };

  return {
    savingsGoals: [g1, g2],
    reconciliations: [rec1],
    recurringRules: [r1, r2, r3],
    investmentHoldings: [inv1, inv2, inv3],
  };
}

export function buildFam1DemoHouseholdData(familyId = 'fam-1'): {
  recipes: Recipe[];
  pantry: PantryItem[];
  meals: MealPlanEntry[];
  chores: Chore[];
  assets: HomeAsset[];
  wardrobe: WardrobeItem[];
  outfits: OutfitPlan[];
  groceries: GroceryListItem[];
} {
  assertNonProductionFixtureAllowed();
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const todayStart = new Date().setHours(0, 0, 0, 0);

  const r1: Recipe = {
    id: 'rec-1',
    familyId,
    title: 'Hearty Chicken Vegetable Soup',
    description: 'Nourishing homemade vegetable and chicken soup with fresh herbs.',
    prepTimeMinutes: 20,
    cookTimeMinutes: 40,
    servings: 6,
    difficulty: 'EASY',
    category: 'DINNER',
    dietaryNotes: 'Gluten-Free, Dairy-Free',
    familyRating: 5,
    isFavorite: true,
    isArchived: false,
    ingredients: [
      { id: 'ing-1', recipeId: 'rec-1', itemName: 'Chicken Breast', quantity: 2, unit: 'lbs' },
      { id: 'ing-2', recipeId: 'rec-1', itemName: 'Carrots', quantity: 4, unit: 'item' },
      { id: 'ing-3', recipeId: 'rec-1', itemName: 'Celery Ribs', quantity: 3, unit: 'item' },
      { id: 'ing-4', recipeId: 'rec-1', itemName: 'Chicken Broth', quantity: 4, unit: 'can' },
      { id: 'ing-5', recipeId: 'rec-1', itemName: 'Fresh Thyme', quantity: 1, unit: 'pack' },
    ],
    instructions: [
      { id: 'ins-1', recipeId: 'rec-1', stepNumber: 1, instructionText: 'Chop carrots, celery, and chicken breast into bite-sized cubes.' },
      { id: 'ins-2', recipeId: 'rec-1', stepNumber: 2, instructionText: 'Simmer chicken broth with vegetables and herbs for 35 minutes until tender.' },
    ],
    createdAt: now - 5 * dayMs,
    updatedAt: now - 5 * dayMs,
  };

  const p1: PantryItem = {
    id: 'pan-1',
    familyId,
    itemName: 'Chicken Broth',
    category: 'PANTRY',
    quantity: 1,
    unit: 'can',
    storageLocation: 'Pantry Shelf 2',
    expiryDate: now + 60 * dayMs,
    minThreshold: 2,
    isLowStock: true,
    notes: 'Low sodium preferred',
    createdAt: now - 10 * dayMs,
    updatedAt: now,
  };
  const p2: PantryItem = {
    id: 'pan-2',
    familyId,
    itemName: 'Organic Whole Milk',
    category: 'FRIDGE',
    quantity: 2,
    unit: 'L',
    storageLocation: 'Main Fridge Door',
    expiryDate: now + 2 * dayMs,
    minThreshold: 1,
    isLowStock: false,
    createdAt: now - 3 * dayMs,
    updatedAt: now,
  };
  const p3: PantryItem = {
    id: 'pan-3',
    familyId,
    itemName: 'Rolled Oats',
    category: 'PANTRY',
    quantity: 3,
    unit: 'lbs',
    storageLocation: 'Cereal Bin',
    expiryDate: now + 180 * dayMs,
    minThreshold: 1,
    isLowStock: false,
    createdAt: now - 20 * dayMs,
    updatedAt: now,
  };

  const m1: MealPlanEntry = {
    id: 'meal-1',
    familyId,
    planDate: todayStart,
    mealType: 'DINNER',
    recipeId: 'rec-1',
    customMealTitle: 'Hearty Chicken Vegetable Soup',
    servings: 6,
    notes: 'Serve with warm sourdough',
    createdAt: now - 2 * dayMs,
  };

  const c1: Chore = {
    id: 'chore-1',
    familyId,
    title: 'Dishes & Kitchen Reset',
    description: 'Empty dishwasher, wipe countertops, and clean sink.',
    assignedMemberId: 'mem-leo-teen',
    zone: 'KITCHEN',
    location: 'Kitchen & Dining Room',
    frequency: 'DAILY',
    rewardPoints: 15,
    nextDueDate: todayStart + 20 * 60 * 60 * 1000,
    requiresVerification: false,
    isCompleted: false,
    checklist: [
      { id: 'step-1', text: 'Empty clean dishes from dishwasher', isDone: true },
      { id: 'step-2', text: 'Wipe down dining table and kitchen island', isDone: false },
      { id: 'step-3', text: 'Scrub sink and replace sponge', isDone: false },
    ],
    isArchived: false,
    createdAt: now - 7 * dayMs,
  };
  const c2: Chore = {
    id: 'chore-2',
    familyId,
    title: 'Living Room Tidy & Vacuum',
    description: 'Put away toys, fluff pillows, and vacuum carpet.',
    assignedMemberId: 'mem-maya-child',
    zone: 'LIVING_ROOM',
    location: 'Main Living Room',
    frequency: 'WEEKLY',
    rewardPoints: 25,
    nextDueDate: todayStart + 2 * dayMs,
    requiresVerification: true,
    isCompleted: false,
    checklist: [
      { id: 'step-2-1', text: 'Put away board games and books', isDone: true },
      { id: 'step-2-2', text: 'Fluff couch cushions and fold throw blankets', isDone: true },
      { id: 'step-2-3', text: 'Vacuum central rug and corners', isDone: false },
    ],
    isArchived: false,
    createdAt: now - 7 * dayMs,
  };

  const a1: HomeAsset = {
    id: 'asset-1',
    familyId,
    name: 'HVAC Heating & Cooling Unit',
    category: 'HVAC',
    description: 'Trane XR14 High Efficiency Heat Pump',
    purchasePriceCents: 450000,
    location: 'Basement / Exterior',
    warrantyExpiration: now + 730 * dayMs,
    maintenanceFrequencyMonths: 6,
    lastMaintenanceDate: now - 90 * dayMs,
    nextMaintenanceDate: now + 90 * dayMs,
    isArchived: false,
    createdAt: now - 90 * dayMs,
    updatedAt: now - 90 * dayMs,
  };

  const w1: WardrobeItem = {
    id: 'ward-1',
    familyId,
    memberId: 'mem-maya-child',
    itemName: 'Navy Blue School Cardigan',
    category: 'OUTERWEAR',
    color: 'Navy Blue',
    season: 'ALL_SEASON',
    isClean: true,
    createdAt: now - 30 * dayMs,
    updatedAt: now,
  };
  const w2: WardrobeItem = {
    id: 'ward-2',
    familyId,
    memberId: 'mem-maya-child',
    itemName: 'Pleated School Skirt',
    category: 'BOTTOMS',
    color: 'Plaid Grey',
    season: 'ALL_SEASON',
    isClean: true,
    createdAt: now - 30 * dayMs,
    updatedAt: now,
  };

  const o1: OutfitPlan = {
    id: 'outfit-1',
    familyId,
    memberId: 'mem-maya-child',
    planDate: new Date().toISOString().split('T')[0],
    outfitName: 'Monday School Uniform',
    itemIds: ['ward-1', 'ward-2'],
    occasion: 'SCHOOL',
    notes: 'School photo day',
    createdAt: now,
    updatedAt: now,
  };

  const g1: GroceryListItem = {
    id: 'groc-1',
    familyId,
    itemName: 'Chicken Broth',
    category: 'PANTRY',
    quantity: 3,
    unit: 'can',
    isPurchased: false,
    sourcePantryItemId: 'pan-1',
    createdAt: now - 1 * dayMs,
  };

  return {
    recipes: [r1],
    pantry: [p1, p2, p3],
    meals: [m1],
    chores: [c1, c2],
    assets: [a1],
    wardrobe: [w1, w2],
    outfits: [o1],
    groceries: [g1],
  };
}
