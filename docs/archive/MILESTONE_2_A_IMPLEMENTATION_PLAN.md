# FAMILYOS — MILESTONE 2.A IMPLEMENTATION PLAN
**Scope**: Master Stage 2 — The Household Full Integration, Food Pantry & Wardrobe Engine  
**Authoritative Product Roadmap**: FamilyOS — Master Development Journey (Master Stage 2)  
**Date**: November 2026  
**Status**: APPROVED BY USER — READY FOR CONTROLLED EXECUTION  

---

## 1. Objective & Scope

Milestone 2.A brings **Master Stage 2 (Family Management & Everyday Life)** to 100% completion by:
1. Providing shared Express API endpoints and interactive React web interfaces for all existing household features (**Meals**, **Recipes**, **Chores**, **Home Assets**, **Grocery Lists**), establishing full parity with Android.
2. Building the **Food Pantry & Fridge Inventory Engine (`HSE-04`)** with item tracking, expiration alerts, and auto-shopping list generation.
3. Building the **Wardrobe & Weekly Outfit Planner (`HSE-07`)** with family member clothing catalogs and 7-day outfit calendars.
4. Implementing the **Integrated Household Workflow Engine**:
   - Meal plans -> Recipe ingredient requirements -> Pantry stock comparison -> Automated grocery list.
   - Purchased groceries -> Auto-replenishment of pantry stock.
   - Chores -> Recurrence schedules, member assignment, and non-punitive points awards.
   - Home Assets -> Maintenance log and automatic synchronization to Household Calendar reminders.

---

## 2. Controlled Sub-Milestones

```
+---------------------------------------------------------------------------------------------------------+
| SUB-MILESTONE 2.A.1: Shared Backend Household Engine & Express API Gateway                              |
| - src/server/householdData.ts (authoritative store, schemas, workflows, points, calendar integration)   |
| - src/server/householdRoutes.ts (full RESTful endpoints for meals, recipes, chores, assets, pantry,     |
|   wardrobe, outfits, groceries, and cross-module workflow sync)                                         |
| - Mounted in server.ts with RBAC & session verification                                                |
+---------------------------------------------------------------------------------------------------------+
                                                     |
                                                     v
+---------------------------------------------------------------------------------------------------------+
| SUB-MILESTONE 2.A.2: Interactive React Web Household Management Experience                               |
| - src/components/Stage2HouseholdExperience.tsx (Tabs: Meals, Recipes, Chores, Assets, Pantry, Wardrobe) |
| - Connected to Web Portal (src/App.tsx) with live API state and quick-action modals                     |
+---------------------------------------------------------------------------------------------------------+
                                                     |
                                                     v
+---------------------------------------------------------------------------------------------------------+
| SUB-MILESTONE 2.A.3: Android Room Database v5 & Offline Persistence                                     |
| - Room v5 bump with non-destructive MIGRATION_4_5 (preserving all 41 existing tables)                   |
| - Table #42: pantry_items                                                                               |
| - Table #43: wardrobe_items                                                                             |
| - Table #44: outfit_plans                                                                               |
| - PantryDao, WardrobeDao, and HouseholdRepositoryImpl in Kotlin                                         |
+---------------------------------------------------------------------------------------------------------+
                                                     |
                                                     v
+---------------------------------------------------------------------------------------------------------+
| SUB-MILESTONE 2.A.4: Android ViewModel & Compose UI Integration                                         |
| - FamilyOSViewModel: pantry and wardrobe StateFlows, expiry calculations, outfit planning               |
| - PantryScreen.kt & WardrobeScreen.kt added to Household Hub in MainActivity.kt                         |
+---------------------------------------------------------------------------------------------------------+
                                                     |
                                                     v
+---------------------------------------------------------------------------------------------------------+
| SUB-MILESTONE 2.A.5: Automated Verification & Regression Gating                                         |
| - scripts/verify-milestone-2-a.ts (25+ automated gates)                                                 |
| - Full regression run across 111 prior test gates (Stages 3.2, 3.3.1, 3.3.2, 3.3.3)                    |
| - Canonical documentation updates (FAMILYOS_MASTER_PROGRESS.md, FEATURE_REGISTER, SCHEMA, ARCHITECTURE) |
+---------------------------------------------------------------------------------------------------------+
```

---

## 3. Database Changes & Schema Architecture

### 3.1 Room v5 Migration (`MIGRATION_4_5`)
The Android SQLCipher-backed Room database will be incremented from `version = 4` to `version = 5`.
All 41 existing tables remain completely untouched. Three new tables are added:

#### Table #42: `pantry_items`
```sql
CREATE TABLE IF NOT EXISTS pantry_items (
    id TEXT PRIMARY KEY NOT NULL, -- UUID v4
    family_id TEXT NOT NULL,
    item_name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'PANTRY', -- 'PANTRY', 'FRIDGE', 'FREEZER', 'SPICES', 'SNACKS', 'BEVERAGES', 'OTHER'
    quantity REAL NOT NULL DEFAULT 1.0,
    unit TEXT NOT NULL DEFAULT 'item', -- 'item', 'g', 'kg', 'oz', 'lbs', 'ml', 'L', 'can', 'pack'
    storage_location TEXT, -- e.g. 'Top Shelf', 'Vegetable Crisper', 'Deep Freezer'
    expiry_date INTEGER, -- Epoch milliseconds timestamp
    min_threshold REAL NOT NULL DEFAULT 1.0,
    is_low_stock INTEGER NOT NULL DEFAULT 0,
    notes TEXT,
    version INTEGER NOT NULL DEFAULT 1,
    sync_status TEXT NOT NULL DEFAULT 'LOCAL_ONLY',
    is_deleted INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY(family_id) REFERENCES family_workspaces(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_pantry_family ON pantry_items(family_id);
CREATE INDEX IF NOT EXISTS idx_pantry_category ON pantry_items(category);
CREATE INDEX IF NOT EXISTS idx_pantry_expiry ON pantry_items(expiry_date);
```

#### Table #43: `wardrobe_items`
```sql
CREATE TABLE IF NOT EXISTS wardrobe_items (
    id TEXT PRIMARY KEY NOT NULL, -- UUID v4
    family_id TEXT NOT NULL,
    member_id TEXT NOT NULL,
    item_name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'TOPS', -- 'TOPS', 'BOTTOMS', 'DRESSES', 'OUTERWEAR', 'SHOES', 'ACCESSORIES', 'OTHER'
    color TEXT,
    season TEXT NOT NULL DEFAULT 'ALL_SEASON', -- 'SPRING', 'SUMMER', 'FALL', 'WINTER', 'ALL_SEASON'
    is_clean INTEGER NOT NULL DEFAULT 1, -- 1 = Clean, 0 = Laundry
    image_uri TEXT,
    notes TEXT,
    version INTEGER NOT NULL DEFAULT 1,
    sync_status TEXT NOT NULL DEFAULT 'LOCAL_ONLY',
    is_deleted INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY(family_id) REFERENCES family_workspaces(id) ON DELETE CASCADE,
    FOREIGN KEY(member_id) REFERENCES family_members(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_wardrobe_family ON wardrobe_items(family_id);
CREATE INDEX IF NOT EXISTS idx_wardrobe_member ON wardrobe_items(member_id);
CREATE INDEX IF NOT EXISTS idx_wardrobe_category ON wardrobe_items(category);
```

#### Table #44: `outfit_plans`
```sql
CREATE TABLE IF NOT EXISTS outfit_plans (
    id TEXT PRIMARY KEY NOT NULL, -- UUID v4
    family_id TEXT NOT NULL,
    member_id TEXT NOT NULL,
    plan_date TEXT NOT NULL, -- 'YYYY-MM-DD'
    outfit_name TEXT NOT NULL,
    item_ids_json TEXT NOT NULL DEFAULT '[]', -- JSON array of wardrobe_item IDs
    occasion TEXT NOT NULL DEFAULT 'CASUAL', -- 'SCHOOL', 'WORK', 'CHURCH', 'CASUAL', 'SPORTS', 'FORMAL', 'OTHER'
    notes TEXT,
    version INTEGER NOT NULL DEFAULT 1,
    sync_status TEXT NOT NULL DEFAULT 'LOCAL_ONLY',
    is_deleted INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY(family_id) REFERENCES family_workspaces(id) ON DELETE CASCADE,
    FOREIGN KEY(member_id) REFERENCES family_members(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_outfit_family ON outfit_plans(family_id);
CREATE INDEX IF NOT EXISTS idx_outfit_member_date ON outfit_plans(member_id, plan_date);
CREATE UNIQUE INDEX IF NOT EXISTS idx_outfit_unique ON outfit_plans(member_id, plan_date, occasion);
```

---

## 4. RESTful API Contracts (`householdRoutes.ts`)

All endpoints are authenticated with Firebase ID token or session bearer tokens, requiring active family membership:

### 4.1 Meals & 7-Day Planner
- `GET /api/v1/household/:familyId/meals` — Get all meal plan entries for family (with optional `startDate` and `endDate` query params).
- `POST /api/v1/household/:familyId/meals` — Schedule meal (`planDate`, `mealType`, `recipeId?`, `customMealTitle?`, `servings`).
- `DELETE /api/v1/household/:familyId/meals/:mealId` — Remove scheduled meal entry.

### 4.2 Recipes & Scaler
- `GET /api/v1/household/:familyId/recipes` — List family recipes with ingredients and instructions.
- `POST /api/v1/household/:familyId/recipes` — Create new recipe.
- `PUT /api/v1/household/:familyId/recipes/:recipeId` — Update recipe details, ingredients, or scaling.
- `DELETE /api/v1/household/:familyId/recipes/:recipeId` — Archive/delete recipe.

### 4.3 Chores & Points Ledger
- `GET /api/v1/household/:familyId/chores` — List all family chores with status and due dates.
- `POST /api/v1/household/:familyId/chores` — Create chore (`title`, `assignedMemberId`, `zone`, `frequency`, `rewardPoints`, `nextDueDate`).
- `PUT /api/v1/household/:familyId/chores/:choreId` — Update chore.
- `POST /api/v1/household/:familyId/chores/:choreId/complete` — Record chore completion, award points to member profile, and advance next due date according to frequency.

### 4.4 Home Assets & Maintenance
- `GET /api/v1/household/:familyId/assets` — List home assets and maintenance history.
- `POST /api/v1/household/:familyId/assets` — Add home asset (`name`, `category`, `purchasePriceCents`, `warrantyExpiration`, `maintenanceFrequencyMonths`).
- `POST /api/v1/household/:familyId/assets/:assetId/maintenance` — Record maintenance log and optionally schedule next maintenance event in Household Calendar.

### 4.5 Food Pantry & Fridge Inventory (`HSE-04`)
- `GET /api/v1/household/:familyId/pantry` — List pantry items with expiration badges (`EXPIRED`, `EXPIRING_SOON`, `SAFE`) and low-stock flags.
- `POST /api/v1/household/:familyId/pantry` — Add pantry item.
- `PUT /api/v1/household/:familyId/pantry/:itemId` — Update quantity, storage location, or expiry date.
- `POST /api/v1/household/:familyId/pantry/:itemId/consume` — Reduce quantity; automatically flags `isLowStock = true` if `quantity <= minThreshold`.
- `POST /api/v1/household/:familyId/pantry/sync-to-groceries` — Automatically adds all low-stock items to `grocery_list_items`.

### 4.6 Wardrobe & Weekly Outfit Planner (`HSE-07`)
- `GET /api/v1/household/:familyId/wardrobe` — List clothing items (filterable by `memberId`, `category`, `season`).
- `POST /api/v1/household/:familyId/wardrobe` — Add wardrobe item.
- `PUT /api/v1/household/:familyId/wardrobe/:itemId` — Update item details or laundry status (`isClean`).
- `GET /api/v1/household/:familyId/outfits` — List outfit plans by member and date range.
- `POST /api/v1/household/:familyId/outfits` — Plan outfit for day (`memberId`, `planDate`, `outfitName`, `itemIds`, `occasion`).

### 4.7 Cross-Module Household Workflow Sync
- `POST /api/v1/household/:familyId/workflow/meal-to-groceries` — Inspects upcoming 7-day meal plan, aggregates recipe ingredients, checks current pantry stock, and appends missing ingredients to `grocery_list_items`!
- `POST /api/v1/household/:familyId/workflow/grocery-purchased` — Marks grocery item purchased and increments corresponding pantry item quantity.

---

## 5. Affected Files & Artifacts

| Component | Target File | Action | Description |
|---|---|:---:|---|
| Backend Logic | `src/server/householdData.ts` | **NEW** | In-memory & Firestore authoritative household engine with cross-module workflows. |
| Backend Routes | `src/server/householdRoutes.ts` | **NEW** | Express REST endpoints for Meals, Recipes, Chores, Assets, Pantry, Wardrobe, Groceries. |
| Server Mounting | `server.ts` | **MODIFIED** | Mount `/api/v1/household` route handler with authentication middleware. |
| Web Component | `src/components/Stage2HouseholdExperience.tsx` | **NEW** | Complete tabbed UI for Meals, Recipes, Chores, Assets, Pantry, and Wardrobe. |
| Web Portal Shell | `src/App.tsx` | **MODIFIED** | Connect Household tab navigation to `Stage2HouseholdExperience`. |
| Android Entities | `android/app/src/main/java/com/familyos/core/database/PantryEntities.kt` | **NEW** | `PantryItemEntity`, `WardrobeItemEntity`, `OutfitPlanEntity`. |
| Android DAOs | `android/app/src/main/java/com/familyos/core/database/PantryDaos.kt` | **NEW** | Room DAOs with reactive queries for low stock, expiry, and outfits. |
| Android Database | `android/app/src/main/java/com/familyos/core/database/FamilyOSDatabase.kt` | **MODIFIED** | Bump to `version = 5`, register entities #42–44, add `MIGRATION_4_5`. |
| Android Repo | `android/app/src/main/java/com/familyos/core/domain/HouseholdRepository.kt` | **NEW** | Repository interface for Pantry, Wardrobe, and Workflows. |
| Android Repo Impl | `android/app/src/main/java/com/familyos/core/data/HouseholdRepositoryImpl.kt` | **NEW** | SQLite implementation with offline-first persistence. |
| Android ViewModel | `android/app/src/main/java/com/familyos/core/viewmodel/FamilyOSViewModel.kt` | **MODIFIED** | Expose reactive StateFlows for pantry, wardrobe, and outfit plans. |
| Verification Test | `scripts/verify-milestone-2-a.ts` | **NEW** | 25-gate automated verification suite testing all contracts and workflows. |

---

## 6. Testing & Verification Strategy

1. **Gate 1–5**: Populated SQLite Room v4 -> v5 migration and zero-data-loss verification across all 41 existing tables.
2. **Gate 6–10**: Pantry CRUD, quantity units, expiration status classification, and low-stock threshold triggering.
3. **Gate 11–14**: Wardrobe cataloging, categories, laundry tracking, and 7-day outfit plan persistence.
4. **Gate 15–18**: Shared Express API endpoints for Meals, Recipes (with scaling), Chores (with point awards), and Home Assets (with calendar sync).
5. **Gate 19–22**: Integrated Household Workflow: Meal -> Recipe -> Pantry comparison -> Grocery generation -> Grocery purchase -> Pantry replenishment.
6. **Gate 23–25**: Web UI rendering, TypeScript compile verification (`tsc --noEmit`), and full regression pass across all 111 prior test gates.
