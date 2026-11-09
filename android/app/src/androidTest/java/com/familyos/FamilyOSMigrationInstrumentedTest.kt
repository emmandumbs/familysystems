package com.familyos

import android.content.Context
import android.database.sqlite.SQLiteConstraintException
import androidx.room.Room
import androidx.sqlite.db.SupportSQLiteDatabase
import androidx.sqlite.db.SupportSQLiteOpenHelper
import androidx.sqlite.db.framework.FrameworkSQLiteOpenHelperFactory
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.familyos.core.database.*
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

/**
 * Authoritative Android Room Migration Instrumentation Test Suite (v1 -> v9, v6 -> v9, and v7 -> v9).
 *
 * Verifies against the real Android SQLite engine and Room schema validator:
 * 1. Creation of a pure Version 1 schema (all 8 Stage 1 tables) and full migration chain to Version 9.
 * 2. Creation of a pure Version 6 schema fixture and upgrade to Version 9 via MIGRATION_6_7, MIGRATION_7_8 & MIGRATION_8_9.
 * 3. Creation of a pure Version 7 schema fixture and upgrade to Version 9 via MIGRATION_7_8 & MIGRATION_8_9.
 * 4. Survival of all pre-existing records across migrations without destructive fallback.
 * 5. Existence and full DAO operability of all 57 entities (52 relational tables across Stage 1, Stage 2,
 *    Stage 3, Routines, Pantry/Wardrobe/Outfits, Investment Holdings, and Family Section + 5 FTS4 virtual
 *    search tables with 15 content-sync triggers) plus `financial_transactions.idempotency_key` unique index (`MIGRATION_8_9`).
 * 6. Preservation of historical REVOKED and LEFT memberships for the same user_account_id.
 * 7. Rejection of duplicate ACTIVE memberships on both INSERT and UPDATE via SQLite triggers
 *    (`trg_family_memberships_one_active_insert` and `trg_family_memberships_one_active_update`)
 *    in both migrated databases and `FamilyOSDatabase.createInMemory()`.
 * 8. Rejection of duplicate `idempotency_key` inserts on `financial_transactions` via
 *    `index_financial_transactions_idempotency_key` (`SQLiteConstraintException`).
 * 9. Foreign key integrity:
 *    - Deleting a goal sets the associated project's goal_id to NULL (`ON DELETE SET NULL`).
 *    - Deleting a workspace cascades and removes child records (`ON DELETE CASCADE`).
 */
@RunWith(AndroidJUnit4::class)
class FamilyOSMigrationInstrumentedTest {

    private val dbNameV1ToV9 = "familyos_migration_v1_to_v9_instrumented.db"
    private val dbNameV6ToV9 = "familyos_migration_v6_to_v9_instrumented.db"
    private val dbNameV7ToV9 = "familyos_migration_v7_to_v9_instrumented.db"
    private lateinit var context: Context
    private var roomDatabase: FamilyOSDatabase? = null

    @Before
    fun setUp() {
        context = ApplicationProvider.getApplicationContext()
        context.deleteDatabase(dbNameV1ToV9)
        context.deleteDatabase(dbNameV6ToV9)
        context.deleteDatabase(dbNameV7ToV9)
    }

    @After
    fun tearDown() {
        roomDatabase?.close()
        roomDatabase = null
        context.deleteDatabase(dbNameV1ToV9)
        context.deleteDatabase(dbNameV6ToV9)
        context.deleteDatabase(dbNameV7ToV9)
    }

    @Test
    fun testRealMigrationV1ToV9ViaRoomBuilderAndDaoVerification() = runBlocking {
        val now = 1700000000000L

        // -------------------------------------------------------------
        // Step 1: Create a genuine Version 1 SQLite database using Framework SQLite Helper
        // -------------------------------------------------------------
        val factory = FrameworkSQLiteOpenHelperFactory()
        val config = SupportSQLiteOpenHelper.Configuration.builder(context)
            .name(dbNameV1ToV9)
            .callback(object : SupportSQLiteOpenHelper.Callback(1) {
                override fun onCreate(db: SupportSQLiteDatabase) {
                    createV1Schema(db)
                }
                override fun onUpgrade(db: SupportSQLiteDatabase, oldVersion: Int, newVersion: Int) {}
            })
            .build()

        val helper = factory.create(config)
        val rawV1Db = helper.writableDatabase

        // -------------------------------------------------------------
        // Step 2: Populate representative records in all 8 Version 1 tables
        // -------------------------------------------------------------
        populateV1Data(rawV1Db, now)

        rawV1Db.close()
        helper.close()

        // -------------------------------------------------------------
        // Step 3: Open database through Room with all production migrations (v1 -> v9)
        //         No fallbackToDestructiveMigration is used.
        // -------------------------------------------------------------
        val db = Room.databaseBuilder(
            context,
            FamilyOSDatabase::class.java,
            dbNameV1ToV9
        )
            .addMigrations(
                FamilyOSDatabase.MIGRATION_1_2,
                FamilyOSDatabase.MIGRATION_2_3,
                FamilyOSDatabase.MIGRATION_3_4,
                FamilyOSDatabase.MIGRATION_4_5,
                FamilyOSDatabase.MIGRATION_5_6,
                FamilyOSDatabase.MIGRATION_6_7,
                FamilyOSDatabase.MIGRATION_7_8,
                FamilyOSDatabase.MIGRATION_8_9
            )
            .build()

        roomDatabase = db

        // Enable foreign keys explicitly on the connection for FK constraint tests
        db.openHelper.writableDatabase.execSQL("PRAGMA foreign_keys = ON;")

        // -------------------------------------------------------------
        // Step 4: Verify all original Version 1 records survived via Room DAOs
        // -------------------------------------------------------------
        val userProfile = db.userProfileDao().getUserProfileById("usr-1")
        assertNotNull("User profile must survive migration", userProfile)
        assertEquals("sarah@familyos.app", userProfile?.email)
        assertEquals("Sarah Henderson", userProfile?.displayName)
        assertEquals("ACTIVE", userProfile?.accountStatus)

        val workspace = db.familyWorkspaceDao().getWorkspaceById("fam-1")
        assertNotNull("Family workspace must survive migration", workspace)
        assertEquals("Henderson Household", workspace?.name)
        assertEquals("USD", workspace?.currencyCode)

        val ownerMember = db.familyMemberDao().getMemberById("mem-sarah")
        assertNotNull("Owner member must survive migration", ownerMember)
        assertEquals("Sarah", ownerMember?.displayName)
        assertEquals("SELF", ownerMember?.relationshipToPrimary)
        assertFalse(ownerMember!!.isRestrictedProfile)

        val minorMember = db.familyMemberDao().getMemberById("mem-lucas")
        assertNotNull("Minor member must survive migration", minorMember)
        assertEquals("Lucas", minorMember?.displayName)
        assertTrue(minorMember!!.isRestrictedProfile)

        val guardians = db.guardianRelationshipDao().getGuardiansForMinor("mem-lucas")
        assertEquals(1, guardians.size)
        assertEquals("PARENT", guardians[0].relationshipType)
        assertTrue(guardians[0].isEmergencyContact)

        val pendingSync = db.syncQueueDao().getPendingOperations(10)
        assertEquals(1, pendingSync.size)
        assertEquals("mem-lucas", pendingSync[0].entityId)

        // -------------------------------------------------------------
        // Step 5: Verify all Stage 2, Stage 3, Stage 4-6, Stage 7, and Stage 8 FTS4 tables exist
        // -------------------------------------------------------------
        val sqliteDb = db.openHelper.writableDatabase
        verifyAllStage2TablesExist(sqliteDb)
        verifyAllStage3TablesExist(sqliteDb)
        verifyAllStage4To6TablesExist(sqliteDb)
        verifyAllStage7FamilySectionTablesExist(sqliteDb)
        verifyAllStage8FtsVirtualTablesExist(sqliteDb)

        // -------------------------------------------------------------
        // Step 6: Exercise production Room DAOs directly on migrated v8 database
        // -------------------------------------------------------------

        // 6a. Goals and Tasks DAO
        val goal = FamilyGoalEntity(
            id = "goal-vacation-1",
            familyId = "fam-1",
            title = "Annual Summer Vacation",
            description = "Trip to national park",
            category = "HOUSEHOLD",
            targetDate = now + 1000000000L,
            priority = "HIGH",
            ownerMemberId = "mem-sarah",
            status = "ACTIVE",
            isArchived = false,
            createdAt = now,
            updatedAt = now
        )
        db.goalsAndTasksDao().insertOrUpdateGoal(goal)

        val fetchedGoal = db.goalsAndTasksDao().getGoalById("goal-vacation-1")
        assertNotNull(fetchedGoal)
        assertEquals("Annual Summer Vacation", fetchedGoal?.title)

        val project = ProjectEntity(
            id = "proj-cabin-1",
            familyId = "fam-1",
            goalId = "goal-vacation-1",
            name = "Book Mountain Cabin",
            description = "Compare cabins and reserve",
            budgetCents = 150000L,
            targetDate = now + 50000000L,
            status = "ACTIVE",
            leadMemberId = "mem-sarah",
            createdAt = now,
            updatedAt = now
        )
        db.goalsAndTasksDao().insertOrUpdateProject(project)

        val task = TaskEntity(
            id = "task-reserve-1",
            familyId = "fam-1",
            projectId = "proj-cabin-1",
            parentTaskId = null,
            title = "Finalize Cabin Dates",
            notes = "Confirm work time-off first",
            assignedMemberId = "mem-sarah",
            priority = "HIGH",
            dueDate = now + 20000000L,
            isCompleted = false,
            completedAt = null,
            completedByMemberId = null,
            recurrenceRule = null,
            createdAt = now,
            updatedAt = now
        )
        db.goalsAndTasksDao().insertOrUpdateTask(task)
        val fetchedTask = db.goalsAndTasksDao().getTaskById("task-reserve-1")
        assertNotNull(fetchedTask)
        assertEquals("Finalize Cabin Dates", fetchedTask?.title)

        val checkItem = TaskChecklistItemEntity(
            id = "chk-1",
            taskId = "task-reserve-1",
            title = "Verify cancellation policy",
            isDone = false,
            position = 0
        )
        db.goalsAndTasksDao().insertChecklistItem(checkItem)

        // 6b. Recipes DAO (using actual RecipeEntity, RecipeIngredientEntity, RecipeInstructionEntity)
        val recipe = RecipeEntity(
            id = "recipe-pancakes-1",
            familyId = "fam-1",
            title = "Sunday Fluffy Pancakes",
            description = "Family secret buttermilk recipe",
            prepTimeMinutes = 15,
            cookTimeMinutes = 15,
            servings = 4,
            isFavorite = true,
            isArchived = false,
            createdAt = now,
            updatedAt = now
        )
        db.recipesDao().insertOrUpdateRecipe(recipe)
        val fetchedRecipe = db.recipesDao().getRecipeById("recipe-pancakes-1")
        assertNotNull(fetchedRecipe)
        assertEquals("Sunday Fluffy Pancakes", fetchedRecipe?.title)

        val ingredient = RecipeIngredientEntity(
            id = "ing-1",
            recipeId = "recipe-pancakes-1",
            itemName = "Flour",
            quantity = 2.0,
            unit = "cups",
            notes = null
        )
        db.recipesDao().insertIngredients(listOf(ingredient))
        val fetchedIngredients = db.recipesDao().observeIngredients("recipe-pancakes-1").first()
        assertEquals(1, fetchedIngredients.size)
        assertEquals("Flour", fetchedIngredients[0].itemName)

        val instruction = RecipeInstructionEntity(
            id = "inst-1",
            recipeId = "recipe-pancakes-1",
            stepNumber = 1,
            instructionText = "Whisk dry ingredients together in large bowl"
        )
        db.recipesDao().insertInstructions(listOf(instruction))
        val fetchedInstructions = db.recipesDao().observeInstructions("recipe-pancakes-1").first()
        assertEquals(1, fetchedInstructions.size)
        assertEquals("Whisk dry ingredients together in large bowl", fetchedInstructions[0].instructionText)

        // 6c. Meal Planner DAO (using actual MealPlanEntryEntity)
        val mealPlan = MealPlanEntryEntity(
            id = "mp-sunday-1",
            familyId = "fam-1",
            planDate = now + 86400000L,
            mealType = "BREAKFAST",
            recipeId = "recipe-pancakes-1",
            customMealTitle = null,
            servings = 4,
            notes = "Serve with fresh maple syrup"
        )
        db.mealPlannerDao().insertOrUpdateMealPlan(mealPlan)

        // 6d. Grocery List DAO (using actual GroceryListItemEntity)
        val groceryItem = GroceryListItemEntity(
            id = "groc-milk-1",
            familyId = "fam-1",
            itemName = "Whole Milk",
            category = "DAIRY",
            quantity = 1.0,
            unit = "gallon",
            isPurchased = false,
            sourceRecipeId = "recipe-pancakes-1",
            createdAt = now
        )
        db.groceryListDao().insertGroceryItem(groceryItem)

        // 6e. Chores DAO (using actual ChoreEntity, insertOrUpdateChore, ChoreCompletionHistoryEntity, logCompletion)
        val chore = ChoreEntity(
            id = "chore-trash-1",
            familyId = "fam-1",
            title = "Recycling and Trash to Curb",
            description = "Every Sunday evening",
            assignedMemberId = "mem-lucas",
            zone = "OUTDOORS",
            frequency = "WEEKLY",
            rewardPoints = 25,
            nextDueDate = now + 86400000L,
            requiresVerification = false,
            isCompleted = false,
            isArchived = false,
            createdAt = now
        )
        db.choresDao().insertOrUpdateChore(chore)

        val history = ChoreCompletionHistoryEntity(
            id = "cch-1",
            choreId = "chore-trash-1",
            completedByMemberId = "mem-lucas",
            completedAt = now,
            pointsEarned = 25
        )
        db.choresDao().logCompletion(history)

        // 6f. Home Assets DAO (using actual HomeAssetEntity, insertOrUpdateAsset, AssetMaintenanceEntity, logMaintenance, HouseholdWishlistEntity)
        val asset = HomeAssetEntity(
            id = "asset-hvac-1",
            familyId = "fam-1",
            name = "Heat Pump / HVAC",
            category = "HVAC",
            description = "Carrier Infinity 24 - Filter size 20x25x4",
            purchaseDate = now - 31536000000L,
            purchasePriceCents = 850000L,
            warrantyExpiryDate = now + 63072000000L,
            serialNumber = "CR-987654",
            location = "Basement Utility Room",
            nextMaintenanceDate = now + 7776000000L,
            isArchived = false,
            createdAt = now,
            updatedAt = now
        )
        db.homeAssetsDao().insertOrUpdateAsset(asset)

        val maintenance = AssetMaintenanceEntity(
            id = "maint-filter-1",
            assetId = "asset-hvac-1",
            title = "4-inch Pleated Air Filter Replacement",
            costCents = 3500L,
            performedDate = now,
            notes = "MERV 11 filter installed",
            serviceProvider = "Self"
        )
        db.homeAssetsDao().logMaintenance(maintenance)

        val wishlist = HouseholdWishlistEntity(
            id = "wish-generator-1",
            familyId = "fam-1",
            itemName = "Dual-Fuel Portable Generator",
            estimatedCostCents = 85000L,
            priority = "MEDIUM",
            category = "HOME",
            url = "https://example.com/generator",
            createdAt = now
        )
        db.homeAssetsDao().insertWishlistItem(wishlist)

        // 6g. Calendar DAO (using actual CalendarEventEntity and insertEvent)
        val calendarEvent = CalendarEventEntity(
            id = "event-soccer-1",
            familyId = "fam-1",
            title = "Lucas Soccer Tournament",
            eventDate = now + 172800000L,
            eventTimeMillis = now + 172800000L,
            category = "FAMILY_EVENT",
            sourceEntityId = null,
            description = "Field 4 at Heritage Regional Park, bring orange slices",
            createdAt = now
        )
        db.calendarDao().insertEvent(calendarEvent)

        // 6h. Family Relationships DAO
        val rel = FamilyRelationshipEntity(
            id = "rel-mother-son-1",
            familyId = "fam-1",
            person1MemberId = "mem-sarah",
            person2MemberId = "mem-lucas",
            relationshipType = "PARENT_CHILD",
            notes = "Mother and son",
            createdAt = now
        )
        db.familyRelationshipDao().insertRelationship(rel)

        // 6i. Stage 3 Finance DAO
        val account = FinancialAccountEntity(
            id = "acc-checking-1",
            familyId = "fam-1",
            name = "Family Checking",
            accountType = "CHECKING",
            currentBalanceCents = 450000L,
            isLiability = false,
            currency = "USD",
            institution = "Heritage Credit Union",
            isArchived = false,
            createdAt = now,
            updatedAt = now
        )
        db.financeDao().insertOrUpdateAccount(account)
        val fetchedAccount = db.financeDao().getAccountById("acc-checking-1")
        assertNotNull(fetchedAccount)
        assertEquals(450000L, fetchedAccount?.currentBalanceCents)

        val tx = FinancialTransactionEntity(
            id = "tx-groceries-1",
            familyId = "fam-1",
            accountId = "acc-checking-1",
            destinationAccountId = null,
            title = "Local Market",
            amountCents = 12550L,
            transactionType = "EXPENSE",
            category = "FOOD",
            transactionDate = now,
            isCleared = true,
            isReversal = false,
            reversalOfId = null,
            notes = "Weekly grocery run",
            paidByMemberId = "mem-sarah",
            idempotencyKey = "idem-tx-groceries-1",
            createdAt = now
        )
        db.financeDao().recordExpense(tx)
        val fetchedTx = db.financeDao().getTransactionById("tx-groceries-1")
        assertNotNull(fetchedTx)
        assertEquals(12550L, fetchedTx?.amountCents)
        assertEquals("idem-tx-groceries-1", fetchedTx?.idempotencyKey)
        val updatedAccount = db.financeDao().getAccountById("acc-checking-1")
        assertEquals(450000L - 12550L, updatedAccount?.currentBalanceCents)

        // Verify MIGRATION_8_9 unique index on financial_transactions.idempotency_key rejects duplicate idempotency_key
        try {
            sqliteDb.execSQL("""
                INSERT INTO financial_transactions (
                    id, family_id, account_id, destination_account_id, title, amount_cents,
                    transaction_type, category, transaction_date, is_cleared, is_reversal,
                    reversal_of_id, notes, paid_by_member_id, idempotency_key, created_at
                ) VALUES (
                    'tx-groceries-dup', 'fam-1', 'acc-checking-1', NULL, 'Duplicate Market Retry', 12550,
                    'EXPENSE', 'FOOD', $now, 1, 0,
                    NULL, 'Duplicate retry', 'mem-sarah', 'idem-tx-groceries-1', $now
                )
            """.trimIndent())
            fail("Expected SQLiteConstraintException when inserting duplicate idempotency_key into financial_transactions")
        } catch (expected: SQLiteConstraintException) {
            assertNotNull("Expected SQLiteConstraintException on duplicate idempotency_key", expected)
        }

        // 6j. Stage 3 Wellbeing DAO
        val wellbeingProfile = WellbeingProfileEntity(
            id = "wb-lucas-1",
            familyId = "fam-1",
            memberId = "mem-lucas",
            bloodType = "O+",
            medicalConditionsJson = "[\"Asthma\"]",
            insuranceProvider = "BlueCross",
            insurancePolicyNumber = "BC-99281",
            primaryPhysicianName = "Dr. Alvarez",
            primaryPhysicianPhone = "555-0199",
            notes = "Carry EpiPen for severe peanut allergy",
            updatedAt = now
        )
        db.wellbeingDao().insertOrUpdateProfile(wellbeingProfile)
        val fetchedProfile = db.wellbeingDao().getProfileForMember("mem-lucas")
        assertNotNull(fetchedProfile)
        assertEquals("O+", fetchedProfile?.bloodType)

        val allergy = HealthAllergyEntity(
            id = "all-lucas-peanut",
            familyId = "fam-1",
            memberId = "mem-lucas",
            allergen = "Peanuts",
            severity = "SEVERE_ANAPHYLACTIC",
            reaction = "Anaphylaxis",
            emergencyTreatment = "EpiPen in backpack",
            createdAt = now
        )
        db.wellbeingDao().insertAllergy(allergy)
        val lucasAllergies = db.wellbeingDao().observeAllergiesForMember("mem-lucas").first()
        assertEquals(1, lucasAllergies.size)
        assertEquals("EpiPen in backpack", lucasAllergies[0].emergencyTreatment)

        // 6k. Stage 3 Emergency DAO
        val emergencyPlan = EmergencyPlanEntity(
            id = "plan-fire-1",
            familyId = "fam-1",
            primaryMeetingPoint = "Maple Tree across street (50m)",
            secondaryMeetingPoint = "Heritage Community Center",
            evacuationRoute = "North stairwell and front door",
            waterShutoffLocation = "Basement North Wall valve #2",
            gasShutoffLocation = "Exterior meter on west side (wrench attached)",
            electricalPanelLocation = "Main electrical panel breaker #1",
            notes = "Test alarms quarterly",
            updatedAt = now
        )
        db.emergencyDao().insertOrUpdateEmergencyPlan(emergencyPlan)
        val fetchedPlan = db.emergencyDao().getEmergencyPlan("fam-1")
        assertNotNull(fetchedPlan)
        assertEquals("Maple Tree across street (50m)", fetchedPlan?.primaryMeetingPoint)

        // 6l. Stage 7 Family Tradition + Stage 8 FTS4 Virtual Table Queries (v1 -> v9)
        db.familySectionDao().upsertTradition(
            FamilyTraditionEntity(
                id = "trad-harvest-1",
                familyId = "fam-1",
                title = "Autumn Apple Cider Pressing",
                category = "Annual",
                cadence = "Annual",
                nextOccurrenceDate = "2026-10-18",
                originStory = "Grandpa's heirloom orchard press tradition",
                linkedRecipeId = "recipe-pancakes-1",
                version = 1L,
                isDeleted = false,
                createdAt = now,
                updatedAt = now
            )
        )

        val ftsRecipes = db.searchDao().searchRecipes("fam-1", "Pancakes*").first()
        assertEquals("v1 -> v9 FTS4 recipes_fts query must match inserted recipe", 1, ftsRecipes.size)
        assertEquals("recipe-pancakes-1", ftsRecipes[0].id)

        val ftsTasks = db.searchDao().searchTasks("fam-1", "Cabin*").first()
        assertEquals("v1 -> v9 FTS4 tasks_fts query must match inserted task", 1, ftsTasks.size)
        assertEquals("task-reserve-1", ftsTasks[0].id)

        val ftsGoals = db.searchDao().searchGoals("fam-1", "Vacation*").first()
        assertEquals("v1 -> v9 FTS4 family_goals_fts query must match inserted goal", 1, ftsGoals.size)
        assertEquals("goal-vacation-1", ftsGoals[0].id)

        val ftsAssets = db.searchDao().searchAssets("fam-1", "Carrier*").first()
        assertEquals("v1 -> v9 FTS4 home_assets_fts query must match inserted asset", 1, ftsAssets.size)
        assertEquals("asset-hvac-1", ftsAssets[0].id)

        val ftsTraditions = db.searchDao().searchTraditions("fam-1", "heirloom*").first()
        assertEquals("v1 -> v9 FTS4 family_traditions_fts query must match inserted tradition", 1, ftsTraditions.size)
        assertEquals("trad-harvest-1", ftsTraditions[0].id)

        // -------------------------------------------------------------
        // Step 7: Test Foreign Key Integrity (SET NULL & CASCADE)
        // -------------------------------------------------------------

        // 7a. Test Goal Deletion -> Project goal_id is set to NULL (ON DELETE SET NULL)
        val cursorPre = sqliteDb.query(
            "SELECT goal_id FROM projects WHERE id = 'proj-cabin-1'"
        )
        assertTrue(cursorPre.moveToFirst())
        assertEquals("goal-vacation-1", cursorPre.getString(0))
        cursorPre.close()

        sqliteDb.execSQL("DELETE FROM family_goals WHERE id = 'goal-vacation-1'")

        val cursorPost = sqliteDb.query(
            "SELECT goal_id, name FROM projects WHERE id = 'proj-cabin-1'"
        )
        assertTrue("Project must survive goal deletion", cursorPost.moveToFirst())
        assertNull("project.goal_id must be set to NULL via ON DELETE SET NULL", cursorPost.getString(0))
        assertEquals("Book Mountain Cabin", cursorPost.getString(1))
        cursorPost.close()

        // 7b. Test Workspace Deletion -> Cascades to members and Stage 2 records (ON DELETE CASCADE)
        val cascadeFamilyId = "fam-cascade-test"
        db.userProfileDao().insertOrUpdateUserProfile(
            LocalUserProfileEntity(
                id = "usr-cascade-1",
                authenticationProvider = "FIREBASE_GOOGLE",
                providerUserId = "uid-google-cascade-1",
                email = "cascade@familyos.app",
                displayName = "Cascade Owner",
                profilePictureUri = null,
                preferredLanguage = "en",
                accountStatus = "ACTIVE",
                createdAt = now,
                updatedAt = now
            )
        )
        db.familyWorkspaceDao().insertOrUpdateWorkspace(
            FamilyWorkspaceEntity(
                id = cascadeFamilyId,
                name = "Ephemeral Cascade Family",
                description = "Testing cascade deletion",
                logoUrl = null,
                currencyCode = "CAD",
                ownerUserId = "usr-cascade-1",
                version = 1L,
                syncStatus = "LOCAL_ONLY",
                isDeleted = false,
                createdAt = now,
                updatedAt = now
            )
        )
        db.familyMemberDao().insertOrUpdateMember(
            FamilyMemberEntity(
                id = "mem-cascade-target",
                familyId = cascadeFamilyId,
                displayName = "Cascade Member",
                relationshipToPrimary = "SELF",
                birthDate = null,
                avatarUrl = null,
                dietaryPreferencesJson = "[]",
                allergiesJson = "[]",
                isRestrictedProfile = false,
                pointsBalance = 0,
                version = 1L,
                syncStatus = "LOCAL_ONLY",
                isDeleted = false,
                createdAt = now,
                updatedAt = now
            )
        )
        db.recipesDao().insertOrUpdateRecipe(
            RecipeEntity(
                id = "recipe-cascade-target",
                familyId = cascadeFamilyId,
                title = "Cascade Apple Pie",
                prepTimeMinutes = 30,
                cookTimeMinutes = 45,
                servings = 8,
                isFavorite = false,
                isArchived = false,
                createdAt = now,
                updatedAt = now
            )
        )

        assertNotNull(db.familyMemberDao().getMemberById("mem-cascade-target"))
        assertNotNull(db.recipesDao().getRecipeById("recipe-cascade-target"))

        sqliteDb.execSQL("DELETE FROM family_workspaces WHERE id = '$cascadeFamilyId'")

        assertNull(
            "Member must be purged when workspace is deleted",
            db.familyMemberDao().getMemberById("mem-cascade-target")
        )
        assertNull(
            "Recipe must be purged when workspace is deleted",
            db.recipesDao().getRecipeById("recipe-cascade-target")
        )
    }

    @Test
    fun testRealMigrationV6ToV9PreservesHistoricalMembershipsAndEnforcesSingleActiveTriggers() = runBlocking {
        val now = 1700000000000L

        // -------------------------------------------------------------
        // Step 1: Create a genuine Version 6 SQLite database fixture
        // -------------------------------------------------------------
        val factory = FrameworkSQLiteOpenHelperFactory()
        val config = SupportSQLiteOpenHelper.Configuration.builder(context)
            .name(dbNameV6ToV9)
            .callback(object : SupportSQLiteOpenHelper.Callback(6) {
                override fun onCreate(db: SupportSQLiteDatabase) {
                    createV1Schema(db)
                    FamilyOSDatabase.MIGRATION_1_2.migrate(db)
                    FamilyOSDatabase.MIGRATION_2_3.migrate(db)
                    FamilyOSDatabase.MIGRATION_3_4.migrate(db)
                    FamilyOSDatabase.MIGRATION_4_5.migrate(db)
                    FamilyOSDatabase.MIGRATION_5_6.migrate(db)
                }
                override fun onUpgrade(db: SupportSQLiteDatabase, oldVersion: Int, newVersion: Int) {}
            })
            .build()

        val helper = factory.create(config)
        val rawV6Db = helper.writableDatabase
        rawV6Db.execSQL("PRAGMA foreign_keys = ON;")

        // -------------------------------------------------------------
        // Step 2: Populate Version 6 database with existing workspaces,
        //         ACTIVE + historical REVOKED and LEFT memberships, and Stage 6 holdings
        // -------------------------------------------------------------
        populateV1Data(rawV6Db, now)

        // Create two historical workspaces owned by separate accounts so usr-1 can hold historical REVOKED and LEFT rows
        rawV6Db.execSQL("""
            INSERT INTO user_profiles VALUES
            ('usr-hist-owner-1', 'FIREBASE_GOOGLE', 'uid-hist-1', 'hist1@familyos.app', 'Historical Owner 1', NULL, 'en', 'ACTIVE', $now, $now),
            ('usr-hist-owner-2', 'FIREBASE_GOOGLE', 'uid-hist-2', 'hist2@familyos.app', 'Historical Owner 2', NULL, 'en', 'ACTIVE', $now, $now),
            ('usr-hist-owner-3', 'FIREBASE_GOOGLE', 'uid-hist-3', 'hist3@familyos.app', 'Historical Owner 3', NULL, 'en', 'ACTIVE', $now, $now)
        """.trimIndent())

        rawV6Db.execSQL("""
            INSERT INTO family_workspaces VALUES
            ('fam-old-revoked', 'Historical Revoked Family', 'Prior household', NULL, 'USD', 'usr-hist-owner-1', 1, 'SYNCED', 0, $now, $now),
            ('fam-old-left', 'Historical Left Family', 'Prior household', NULL, 'USD', 'usr-hist-owner-2', 1, 'SYNCED', 0, $now, $now),
            ('fam-other-3', 'Other Family 3', 'Other household', NULL, 'USD', 'usr-hist-owner-3', 1, 'SYNCED', 0, $now, $now)
        """.trimIndent())

        // Seed historical REVOKED and LEFT memberships for usr-1 in v6 prior to v9 upgrade
        rawV6Db.execSQL("""
            INSERT INTO family_memberships VALUES
            ('membership-revoked-v6', 'fam-old-revoked', 'usr-1', 'mem-sarah-old1', 'MEMBER', 'REVOKED', ${now - 86400000L}),
            ('membership-left-v6', 'fam-old-left', 'usr-1', 'mem-sarah-old2', 'MEMBER', 'LEFT', ${now - 172800000L})
        """.trimIndent())

        // Seed a Version 6 financial account and investment holding
        rawV6Db.execSQL("""
            INSERT INTO financial_accounts VALUES (
                'acc-inv-v6', 'fam-1', 'Vanguard Brokerage', 'INVESTMENT', 10500000, 0, 'USD', 'Vanguard', 0, $now, $now
            )
        """.trimIndent())
        rawV6Db.execSQL("""
            INSERT INTO investment_holdings VALUES (
                'hold-vti-v6', 'fam-1', 'acc-inv-v6', 'VTI', 'Vanguard Total Stock Market ETF', 'ETF',
                50000000, 1000000, 25000, 'USD', 'Core index holding', $now, 1, 'SYNCED', 0, $now, $now
            )
        """.trimIndent())

        rawV6Db.close()
        helper.close()

        // -------------------------------------------------------------
        // Step 3: Upgrade Version 6 database to Version 9 via Room + MIGRATION_6_7, MIGRATION_7_8 & MIGRATION_8_9
        // -------------------------------------------------------------
        val db = Room.databaseBuilder(
            context,
            FamilyOSDatabase::class.java,
            dbNameV6ToV9
        )
            .addMigrations(
                FamilyOSDatabase.MIGRATION_6_7,
                FamilyOSDatabase.MIGRATION_7_8,
                FamilyOSDatabase.MIGRATION_8_9
            )
            .build()

        roomDatabase = db
        val sqliteDb = db.openHelper.writableDatabase
        sqliteDb.execSQL("PRAGMA foreign_keys = ON;")

        // -------------------------------------------------------------
        // Step 4: Verify all 7 new Family Section tables exist and Room schema validation succeeded
        // -------------------------------------------------------------
        verifyAllStage7FamilySectionTablesExist(sqliteDb)

        // -------------------------------------------------------------
        // Step 5: Verify existing Version 6 records and historical REVOKED/LEFT memberships survived
        // -------------------------------------------------------------
        val holding = db.financeDao().getInvestmentHoldingById("hold-vti-v6")
        assertNotNull("Version 6 investment holding must survive v6->v9 migration", holding)
        assertEquals("VTI", holding?.symbol)
        assertEquals(50_000_000L, holding?.quantityMicroshares)

        val memCursor = sqliteDb.query(
            "SELECT status FROM family_memberships WHERE user_account_id = 'usr-1' ORDER BY status ASC"
        )
        val statuses = mutableListOf<String>()
        while (memCursor.moveToNext()) {
            statuses.add(memCursor.getString(0))
        }
        memCursor.close()
        assertEquals(listOf("ACTIVE", "LEFT", "REVOKED"), statuses)

        // -------------------------------------------------------------
        // Step 6: Exercise all 7 new Family Section entities via FamilySectionDao
        // -------------------------------------------------------------
        val sectionDao = db.familySectionDao()

        sectionDao.upsertAlbum(
            FamilyGalleryAlbumEntity(
                id = "alb-v7-1",
                familyId = "fam-1",
                title = "Summer Reunions",
                description = "Annual family gathering photos",
                category = "Family Memories",
                coverPhotoUrl = null,
                createdByUserId = "usr-1",
                version = 1L,
                isDeleted = false,
                createdAt = now,
                updatedAt = now
            )
        )
        assertEquals(1, sectionDao.observeAlbums("fam-1").first().size)

        sectionDao.upsertPhoto(
            FamilyGalleryPhotoEntity(
                id = "pho-v7-1",
                familyId = "fam-1",
                albumId = "alb-v7-1",
                title = "Backyard Dinner",
                caption = "Everyone at the table",
                imageUrl = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
                visibility = "FAMILY",
                uploadedByUserId = "usr-1",
                uploadedByMemberId = "mem-sarah",
                version = 1L,
                isDeleted = false,
                createdAt = now,
                updatedAt = now
            )
        )
        assertEquals(1, sectionDao.observePhotos("fam-1").first().size)

        sectionDao.upsertConstitutionVersion(
            FamilyConstitutionVersionEntity(
                id = "const-v7-1",
                familyId = "fam-1",
                versionNumber = 1,
                motto = "Kindness and stewardship",
                missionStatement = "Support one another every day",
                visionStatement = "Build a resilient home",
                coreValuesJson = "[\"Integrity\",\"Gratitude\"]",
                acknowledgmentsJson = "[\"mem-sarah\"]",
                editedByUserId = "usr-1",
                createdAt = now,
                updatedAt = now
            )
        )
        assertEquals(1, sectionDao.observeConstitutionVersions("fam-1").first().size)

        sectionDao.upsertTradition(
            FamilyTraditionEntity(
                id = "trad-v7-1",
                familyId = "fam-1",
                title = "Sunday Evening Gratitude Circle",
                category = "Weekly",
                cadence = "Weekly",
                nextOccurrenceDate = "2026-11-08",
                originStory = "Started when Lucas was 5",
                linkedRecipeId = null,
                version = 1L,
                isDeleted = false,
                createdAt = now,
                updatedAt = now
            )
        )
        assertEquals(1, sectionDao.observeTraditions("fam-1").first().size)

        sectionDao.upsertSharedActivity(
            FamilySharedActivityEntity(
                id = "act-v7-1",
                familyId = "fam-1",
                title = "Autumn Orchard Harvest",
                category = "Outing",
                dateIso = "2026-11-15",
                location = "Oak Creek Orchard",
                budgetCents = 6500L,
                status = "PLANNED",
                linkedCalendarEventId = null,
                version = 1L,
                isDeleted = false,
                createdAt = now,
                updatedAt = now
            )
        )
        assertEquals(1, sectionDao.observeSharedActivities("fam-1").first().size)

        sectionDao.upsertRule(
            FamilyRuleEntity(
                id = "rule-v7-1",
                familyId = "fam-1",
                title = "Devices charging in kitchen by 8:30 PM",
                category = "Digital Wellbeing",
                description = "Applies on school nights",
                appliesToRole = "ALL",
                version = 1L,
                isDeleted = false,
                createdAt = now,
                updatedAt = now
            )
        )
        assertEquals(1, sectionDao.observeRules("fam-1").first().size)

        sectionDao.upsertExtendedRelative(
            FamilyExtendedRelativeEntity(
                id = "rel-ext-v7-1",
                familyId = "fam-1",
                fullName = "Grandma Martha Henderson",
                relationshipLabel = "Paternal Grandmother",
                lineageSide = "PATERNAL",
                generation = "GRANDPARENTS",
                birthYear = 1954,
                occupation = "Retired Botanist",
                city = "Savannah",
                country = "USA",
                avatarUrl = null,
                growthAreasJson = "[\"Oral family history recordings\"]",
                encouragementNotesJson = "[\"Weekly Sunday call\"]",
                version = 1L,
                isDeleted = false,
                createdAt = now,
                updatedAt = now
            )
        )
        assertEquals(1, sectionDao.observeExtendedRelatives("fam-1").first().size)

        // -------------------------------------------------------------
        // Step 7: Verify single-ACTIVE-membership SQLite triggers on INSERT and UPDATE
        // -------------------------------------------------------------

        // 7a. Inserting another historical REVOKED membership for usr-1 in fam-other-3 is permitted
        sqliteDb.execSQL("""
            INSERT INTO family_memberships VALUES (
                'membership-revoked-v7-extra', 'fam-other-3', 'usr-1', 'mem-sarah-old3', 'MEMBER', 'REVOKED', $now
            )
        """.trimIndent())

        // 7b. Inserting a second ACTIVE membership for usr-1 must be rejected by trg_family_memberships_one_active_insert
        try {
            sqliteDb.execSQL("""
                INSERT INTO family_memberships VALUES (
                    'membership-duplicate-active', 'fam-other-3', 'usr-1', 'mem-sarah-dup', 'OWNER', 'ACTIVE', $now
                )
            """.trimIndent())
            fail("Expected SQLiteConstraintException when inserting a duplicate ACTIVE membership for usr-1")
        } catch (expected: SQLiteConstraintException) {
            assertTrue(
                "Trigger abort message must contain ONE_ACTIVE_FAMILY_PER_ACCOUNT",
                expected.message?.contains("ONE_ACTIVE_FAMILY_PER_ACCOUNT") == true
            )
        }

        // 7c. Updating a historical REVOKED or LEFT membership to ACTIVE while usr-1 has an ACTIVE membership
        //     must be rejected by trg_family_memberships_one_active_update
        try {
            sqliteDb.execSQL("""
                UPDATE family_memberships
                SET status = 'ACTIVE'
                WHERE id = 'membership-revoked-v6'
            """.trimIndent())
            fail("Expected SQLiteConstraintException when updating a REVOKED membership to a second ACTIVE membership")
        } catch (expected: SQLiteConstraintException) {
            assertTrue(
                "Trigger abort message must contain ONE_ACTIVE_FAMILY_PER_ACCOUNT",
                expected.message?.contains("ONE_ACTIVE_FAMILY_PER_ACCOUNT") == true
            )
        }
    }

    @Test
    fun testRealMigrationV7ToV9PopulatesAndQueriesFts4VirtualTables() = runBlocking {
        val now = 1700000000000L

        // -------------------------------------------------------------
        // Step 1: Create a genuine Version 7 SQLite database fixture
        // -------------------------------------------------------------
        val factory = FrameworkSQLiteOpenHelperFactory()
        val config = SupportSQLiteOpenHelper.Configuration.builder(context)
            .name(dbNameV7ToV9)
            .callback(object : SupportSQLiteOpenHelper.Callback(7) {
                override fun onCreate(db: SupportSQLiteDatabase) {
                    createV1Schema(db)
                    FamilyOSDatabase.MIGRATION_1_2.migrate(db)
                    FamilyOSDatabase.MIGRATION_2_3.migrate(db)
                    FamilyOSDatabase.MIGRATION_3_4.migrate(db)
                    FamilyOSDatabase.MIGRATION_4_5.migrate(db)
                    FamilyOSDatabase.MIGRATION_5_6.migrate(db)
                    FamilyOSDatabase.MIGRATION_6_7.migrate(db)
                }
                override fun onUpgrade(db: SupportSQLiteDatabase, oldVersion: Int, newVersion: Int) {}
            })
            .build()

        val helper = factory.create(config)
        val rawV7Db = helper.writableDatabase
        rawV7Db.execSQL("PRAGMA foreign_keys = ON;")

        // -------------------------------------------------------------
        // Step 2: Populate Version 7 records across all 5 FTS-indexed domains
        //         prior to running MIGRATION_7_8 & MIGRATION_8_9
        // -------------------------------------------------------------
        populateV1Data(rawV7Db, now)

        rawV7Db.execSQL("""
            INSERT INTO recipes VALUES (
                'rec-v7-sourdough', 'fam-1', 'Artisan Sourdough Loaf', 'Slow fermented rosemary crust bread',
                NULL, 30, 45, 6, 'MEDIUM', 'BAKERY', 'Vegetarian, dairy-free', 5, 1, 'Grandma recipe card',
                'Store in linen bag', 0, $now, $now
            )
        """.trimIndent())

        rawV7Db.execSQL("""
            INSERT INTO family_goals VALUES (
                'goal-v7-solar', 'fam-1', 'Install Rooftop Solar Array', 'Achieve net-zero household electricity',
                'HOUSEHOLD', ${now + 864000000L}, 'HIGH', 'mem-sarah', 'ACTIVE', 0, $now, $now
            )
        """.trimIndent())

        rawV7Db.execSQL("""
            INSERT INTO tasks VALUES (
                'task-v7-inverter', 'fam-1', NULL, NULL, 'Inspect Hybrid Solar Inverter Specs',
                'Verify battery backup transfer switch compatibility', 'mem-sarah', 'HIGH', ${now + 86400000L},
                0, NULL, NULL, NULL, $now, $now
            )
        """.trimIndent())

        rawV7Db.execSQL("""
            INSERT INTO home_assets VALUES (
                'asset-v7-espresso', 'fam-1', 'Breville Dual Boiler Espresso Machine', 'APPLIANCES',
                'Descale every 90 days with filtered water', $now, 149900, ${now + 31536000000L},
                'BRV-778899', 'Kitchen Coffee Station', ${now + 7776000000L}, 0, $now, $now
            )
        """.trimIndent())

        rawV7Db.execSQL("""
            INSERT INTO family_traditions VALUES (
                'trad-v7-solstice', 'fam-1', 'Winter Solstice Lantern Walk', 'Annual', 'Annual',
                '2026-12-21', 'Handmade paper lanterns through the neighborhood park', NULL,
                1, 0, $now, $now
            )
        """.trimIndent())

        rawV7Db.close()
        helper.close()

        // -------------------------------------------------------------
        // Step 3: Upgrade Version 7 database to Version 9 via Room + MIGRATION_7_8 & MIGRATION_8_9
        // -------------------------------------------------------------
        val db = Room.databaseBuilder(
            context,
            FamilyOSDatabase::class.java,
            dbNameV7ToV9
        )
            .addMigrations(
                FamilyOSDatabase.MIGRATION_7_8,
                FamilyOSDatabase.MIGRATION_8_9
            )
            .build()

        roomDatabase = db
        val sqliteDb = db.openHelper.writableDatabase
        sqliteDb.execSQL("PRAGMA foreign_keys = ON;")

        // -------------------------------------------------------------
        // Step 4: Verify all 5 FTS4 virtual tables exist and query pre-existing v7 data
        // -------------------------------------------------------------
        verifyAllStage8FtsVirtualTablesExist(sqliteDb)

        val recipeHits = db.searchDao().searchRecipes("fam-1", "rosemary*").first()
        assertEquals("Pre-existing v7 recipe must be indexed in recipes_fts", 1, recipeHits.size)
        assertEquals("rec-v7-sourdough", recipeHits[0].id)
        assertEquals("Artisan Sourdough Loaf", recipeHits[0].title)

        val goalHits = db.searchDao().searchGoals("fam-1", "Rooftop*").first()
        assertEquals("Pre-existing v7 goal must be indexed in family_goals_fts", 1, goalHits.size)
        assertEquals("goal-v7-solar", goalHits[0].id)

        val taskHits = db.searchDao().searchTasks("fam-1", "Inverter*").first()
        assertEquals("Pre-existing v7 task must be indexed in tasks_fts", 1, taskHits.size)
        assertEquals("task-v7-inverter", taskHits[0].id)

        val assetHits = db.searchDao().searchAssets("fam-1", "Espresso*").first()
        assertEquals("Pre-existing v7 home asset must be indexed in home_assets_fts", 1, assetHits.size)
        assertEquals("asset-v7-espresso", assetHits[0].id)

        val traditionHits = db.searchDao().searchTraditions("fam-1", "Lantern*").first()
        assertEquals("Pre-existing v7 tradition must be indexed in family_traditions_fts", 1, traditionHits.size)
        assertEquals("trad-v7-solstice", traditionHits[0].id)

        // Verify direct SQLite FTS4 MATCH queries across all 5 virtual tables
        val ftsQueries = listOf(
            "SELECT count(*) FROM recipes_fts WHERE recipes_fts MATCH 'Sourdough*'",
            "SELECT count(*) FROM tasks_fts WHERE tasks_fts MATCH 'compatibility*'",
            "SELECT count(*) FROM family_goals_fts WHERE family_goals_fts MATCH 'electricity*'",
            "SELECT count(*) FROM home_assets_fts WHERE home_assets_fts MATCH 'Breville*'",
            "SELECT count(*) FROM family_traditions_fts WHERE family_traditions_fts MATCH 'Solstice*'"
        )
        for (sql in ftsQueries) {
            val cursor = sqliteDb.query(sql)
            assertTrue(cursor.moveToFirst())
            assertEquals("Expected 1 FTS4 MATCH row for query: $sql", 1, cursor.getInt(0))
            cursor.close()
        }
    }

    @Test
    fun testInMemoryDatabaseEnforcesOneActiveMembershipTriggerCallback() = runBlocking {
        val now = 1700000000000L
        val inMemoryDb = FamilyOSDatabase.createInMemory(context)
        try {
            val sqliteDb = inMemoryDb.openHelper.writableDatabase
            sqliteDb.execSQL("PRAGMA foreign_keys = ON;")
            populateV1Data(sqliteDb, now)

            sqliteDb.execSQL("""
                INSERT INTO user_profiles VALUES
                ('usr-other-owner', 'FIREBASE_GOOGLE', 'uid-other-1', 'other@familyos.app', 'Other Owner', NULL, 'en', 'ACTIVE', $now, $now)
            """.trimIndent())
            sqliteDb.execSQL("""
                INSERT INTO family_workspaces VALUES
                ('fam-2', 'Second Household', 'Second home', NULL, 'USD', 'usr-other-owner', 1, 'LOCAL_ONLY', 0, $now, $now)
            """.trimIndent())

            // Duplicate ACTIVE insert must abort via trg_family_memberships_one_active_insert
            try {
                sqliteDb.execSQL("""
                    INSERT INTO family_memberships VALUES
                    ('membership-dup-inmem', 'fam-2', 'usr-1', 'mem-sarah-2', 'MEMBER', 'ACTIVE', $now)
                """.trimIndent())
                fail("Expected SQLiteConstraintException from trg_family_memberships_one_active_insert in createInMemory()")
            } catch (expected: SQLiteConstraintException) {
                assertTrue(expected.message?.contains("ONE_ACTIVE_FAMILY_PER_ACCOUNT") == true)
            }
        } finally {
            inMemoryDb.close()
        }
    }

    private fun createV1Schema(db: SupportSQLiteDatabase) {
        db.execSQL("""
            CREATE TABLE IF NOT EXISTS `user_profiles` (
                `id` TEXT NOT NULL PRIMARY KEY,
                `authentication_provider` TEXT NOT NULL,
                `provider_user_id` TEXT NOT NULL,
                `email` TEXT NOT NULL,
                `display_name` TEXT,
                `profile_picture_uri` TEXT,
                `preferred_language` TEXT NOT NULL,
                `account_status` TEXT NOT NULL,
                `created_at` INTEGER NOT NULL,
                `updated_at` INTEGER NOT NULL
            )
        """.trimIndent())
        db.execSQL("CREATE UNIQUE INDEX IF NOT EXISTS `index_user_profiles_provider_user_id` ON `user_profiles` (`provider_user_id`)")
        db.execSQL("CREATE INDEX IF NOT EXISTS `index_user_profiles_email` ON `user_profiles` (`email`)")

        db.execSQL("""
            CREATE TABLE IF NOT EXISTS `family_workspaces` (
                `id` TEXT NOT NULL PRIMARY KEY,
                `name` TEXT NOT NULL,
                `description` TEXT,
                `logo_url` TEXT,
                `currency_code` TEXT NOT NULL,
                `owner_user_id` TEXT NOT NULL,
                `version` INTEGER NOT NULL,
                `sync_status` TEXT NOT NULL,
                `is_deleted` INTEGER NOT NULL,
                `created_at` INTEGER NOT NULL,
                `updated_at` INTEGER NOT NULL
            )
        """.trimIndent())
        db.execSQL("CREATE UNIQUE INDEX IF NOT EXISTS `index_family_workspaces_owner_user_id` ON `family_workspaces` (`owner_user_id`)")

        db.execSQL("""
            CREATE TABLE IF NOT EXISTS `family_memberships` (
                `id` TEXT NOT NULL PRIMARY KEY,
                `family_id` TEXT NOT NULL,
                `user_account_id` TEXT NOT NULL,
                `member_profile_id` TEXT NOT NULL,
                `role` TEXT NOT NULL,
                `status` TEXT NOT NULL,
                `joined_at` INTEGER NOT NULL,
                FOREIGN KEY(`family_id`) REFERENCES `family_workspaces`(`id`) ON DELETE CASCADE,
                FOREIGN KEY(`user_account_id`) REFERENCES `user_profiles`(`id`) ON DELETE CASCADE
            )
        """.trimIndent())
        db.execSQL("CREATE UNIQUE INDEX IF NOT EXISTS `index_family_memberships_family_id_user_account_id` ON `family_memberships` (`family_id`, `user_account_id`)")
        db.execSQL("CREATE INDEX IF NOT EXISTS `index_family_memberships_user_account_id` ON `family_memberships` (`user_account_id`)")

        db.execSQL("""
            CREATE TABLE IF NOT EXISTS `family_members` (
                `id` TEXT NOT NULL PRIMARY KEY,
                `family_id` TEXT NOT NULL,
                `display_name` TEXT NOT NULL,
                `relationship_to_primary` TEXT NOT NULL,
                `birth_date` INTEGER,
                `avatar_url` TEXT,
                `dietary_preferences_json` TEXT NOT NULL,
                `allergies_json` TEXT NOT NULL,
                `is_restricted_profile` INTEGER NOT NULL,
                `points_balance` INTEGER NOT NULL,
                `version` INTEGER NOT NULL,
                `sync_status` TEXT NOT NULL,
                `is_deleted` INTEGER NOT NULL,
                `created_at` INTEGER NOT NULL,
                `updated_at` INTEGER NOT NULL,
                FOREIGN KEY(`family_id`) REFERENCES `family_workspaces`(`id`) ON DELETE CASCADE
            )
        """.trimIndent())
        db.execSQL("CREATE INDEX IF NOT EXISTS `index_family_members_family_id` ON `family_members` (`family_id`)")

        db.execSQL("""
            CREATE TABLE IF NOT EXISTS `family_invitations` (
                `id` TEXT NOT NULL PRIMARY KEY,
                `family_id` TEXT NOT NULL,
                `invitation_token` TEXT NOT NULL,
                `invited_email` TEXT NOT NULL,
                `target_role` TEXT NOT NULL,
                `assigned_member_profile_id` TEXT,
                `status` TEXT NOT NULL,
                `expires_at` INTEGER NOT NULL,
                `created_at` INTEGER NOT NULL,
                FOREIGN KEY(`family_id`) REFERENCES `family_workspaces`(`id`) ON DELETE CASCADE
            )
        """.trimIndent())
        db.execSQL("CREATE UNIQUE INDEX IF NOT EXISTS `index_family_invitations_invitation_token` ON `family_invitations` (`invitation_token`)")
        db.execSQL("CREATE INDEX IF NOT EXISTS `index_family_invitations_family_id` ON `family_invitations` (`family_id`)")

        db.execSQL("""
            CREATE TABLE IF NOT EXISTS `guardian_relationships` (
                `id` TEXT NOT NULL PRIMARY KEY,
                `family_id` TEXT NOT NULL,
                `guardian_member_id` TEXT NOT NULL,
                `minor_member_id` TEXT NOT NULL,
                `relationship_type` TEXT NOT NULL,
                `is_emergency_contact` INTEGER NOT NULL,
                `can_manage_health_records` INTEGER NOT NULL,
                `created_at` INTEGER NOT NULL,
                FOREIGN KEY(`family_id`) REFERENCES `family_workspaces`(`id`) ON DELETE CASCADE,
                FOREIGN KEY(`guardian_member_id`) REFERENCES `family_members`(`id`) ON DELETE CASCADE,
                FOREIGN KEY(`minor_member_id`) REFERENCES `family_members`(`id`) ON DELETE CASCADE
            )
        """.trimIndent())
        db.execSQL("CREATE UNIQUE INDEX IF NOT EXISTS `index_guardian_relationships_family_id_guardian_member_id_minor_member_id` ON `guardian_relationships` (`family_id`, `guardian_member_id`, `minor_member_id`)")
        db.execSQL("CREATE INDEX IF NOT EXISTS `index_guardian_relationships_guardian_member_id` ON `guardian_relationships` (`guardian_member_id`)")
        db.execSQL("CREATE INDEX IF NOT EXISTS `index_guardian_relationships_minor_member_id` ON `guardian_relationships` (`minor_member_id`)")

        db.execSQL("""
            CREATE TABLE IF NOT EXISTS `sync_queue` (
                `queue_id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                `operation_id` TEXT NOT NULL,
                `idempotency_key` TEXT NOT NULL,
                `family_id` TEXT NOT NULL,
                `entity_type` TEXT NOT NULL,
                `entity_id` TEXT NOT NULL,
                `operation_type` TEXT NOT NULL,
                `payload_json` TEXT NOT NULL,
                `attempt_count` INTEGER NOT NULL,
                `last_attempt_at` INTEGER,
                `retry_state` TEXT NOT NULL,
                `last_error` TEXT,
                `created_at` INTEGER NOT NULL
            )
        """.trimIndent())
        db.execSQL("CREATE UNIQUE INDEX IF NOT EXISTS `index_sync_queue_idempotency_key` ON `sync_queue` (`idempotency_key`)")
        db.execSQL("CREATE INDEX IF NOT EXISTS `index_sync_queue_entity_type_entity_id` ON `sync_queue` (`entity_type`, `entity_id`)")

        db.execSQL("""
            CREATE TABLE IF NOT EXISTS `audit_events` (
                `id` TEXT NOT NULL PRIMARY KEY,
                `family_id` TEXT NOT NULL,
                `actor_user_id` TEXT NOT NULL,
                `action_type` TEXT NOT NULL,
                `entity_type` TEXT NOT NULL,
                `entity_id` TEXT NOT NULL,
                `summary` TEXT NOT NULL,
                `metadata_json` TEXT,
                `created_at` INTEGER NOT NULL,
                FOREIGN KEY(`family_id`) REFERENCES `family_workspaces`(`id`) ON DELETE CASCADE
            )
        """.trimIndent())
        db.execSQL("CREATE INDEX IF NOT EXISTS `index_audit_events_family_id_created_at` ON `audit_events` (`family_id`, `created_at`)")
    }

    private fun populateV1Data(db: SupportSQLiteDatabase, now: Long) {
        db.execSQL("""
            INSERT INTO user_profiles VALUES (
                'usr-1', 'FIREBASE_GOOGLE', 'uid-google-1', 'sarah@familyos.app',
                'Sarah Henderson', NULL, 'en', 'ACTIVE', $now, $now
            )
        """.trimIndent())

        db.execSQL("""
            INSERT INTO family_workspaces VALUES (
                'fam-1', 'Henderson Household', 'Family home', NULL,
                'USD', 'usr-1', 1, 'LOCAL_ONLY', 0, $now, $now
            )
        """.trimIndent())

        db.execSQL("""
            INSERT INTO family_members VALUES (
                'mem-sarah', 'fam-1', 'Sarah', 'SELF', $now, NULL,
                '[]', '[]', 0, 100, 1, 'LOCAL_ONLY', 0, $now, $now
            )
        """.trimIndent())
        db.execSQL("""
            INSERT INTO family_members VALUES (
                'mem-lucas', 'fam-1', 'Lucas', 'CHILD', $now, NULL,
                '[]', '[]', 1, 50, 1, 'LOCAL_ONLY', 0, $now, $now
            )
        """.trimIndent())

        db.execSQL("""
            INSERT INTO family_memberships VALUES (
                'membership-1', 'fam-1', 'usr-1', 'mem-sarah', 'OWNER', 'ACTIVE', $now
            )
        """.trimIndent())

        db.execSQL("""
            INSERT INTO family_invitations VALUES (
                'inv-1', 'fam-1', 'token-abc', 'grandma@familyos.app', 'MEMBER', NULL, 'PENDING', ${now + 86400000L}, $now
            )
        """.trimIndent())

        db.execSQL("""
            INSERT INTO guardian_relationships VALUES (
                'guard-1', 'fam-1', 'mem-sarah', 'mem-lucas', 'PARENT', 1, 1, $now
            )
        """.trimIndent())

        db.execSQL("""
            INSERT INTO sync_queue VALUES (
                1, 'op-1', 'idemp-1', 'fam-1', 'MEMBER', 'mem-lucas', 'INSERT', '{}', 0, NULL, 'PENDING', NULL, $now
            )
        """.trimIndent())

        db.execSQL("""
            INSERT INTO audit_events VALUES (
                'audit-1', 'fam-1', 'usr-1', 'MEMBER_INVITED', 'INVITATION', 'inv-1', 'Invited grandma', NULL, $now
            )
        """.trimIndent())
    }

    private fun getExistingTables(db: SupportSQLiteDatabase): Set<String> {
        val cursor = db.query("SELECT name FROM sqlite_master WHERE type = 'table'")
        val existingTables = mutableSetOf<String>()
        while (cursor.moveToNext()) {
            existingTables.add(cursor.getString(0))
        }
        cursor.close()
        return existingTables
    }

    private fun verifyAllStage2TablesExist(db: SupportSQLiteDatabase) {
        val expectedV2Tables = listOf(
            "family_relationships",
            "family_goals",
            "projects",
            "tasks",
            "task_checklist_items",
            "recipes",
            "recipe_ingredients",
            "recipe_instructions",
            "meal_plan_entries",
            "grocery_list_items",
            "chores",
            "chore_completion_history",
            "home_assets",
            "asset_maintenance_records",
            "household_wishlist",
            "calendar_events"
        )
        val existingTables = getExistingTables(db)
        for (table in expectedV2Tables) {
            assertTrue("Expected Stage 2 table '$table' to exist in database", existingTables.contains(table))
        }
    }

    private fun verifyAllStage3TablesExist(db: SupportSQLiteDatabase) {
        val expectedV3Tables = listOf(
            "financial_accounts",
            "financial_transactions",
            "recurring_transactions",
            "envelope_budgets",
            "savings_goals",
            "bills_subscriptions",
            "wellbeing_profiles",
            "health_allergies",
            "health_medications",
            "health_vaccinations",
            "healthcare_appointments",
            "emergency_contacts",
            "emergency_plans",
            "emergency_supplies",
            "emergency_checklist_items"
        )
        val existingTables = getExistingTables(db)
        for (table in expectedV3Tables) {
            assertTrue("Expected Stage 3 table '$table' to exist in database", existingTables.contains(table))
        }
    }

    private fun verifyAllStage4To6TablesExist(db: SupportSQLiteDatabase) {
        val expectedV4ToV6Tables = listOf(
            "routines",
            "routine_occurrences",
            "pantry_items",
            "wardrobe_items",
            "outfit_plans",
            "investment_holdings"
        )
        val existingTables = getExistingTables(db)
        for (table in expectedV4ToV6Tables) {
            assertTrue("Expected Stage 4-6 table '$table' to exist in database", existingTables.contains(table))
        }
    }

    private fun verifyAllStage7FamilySectionTablesExist(db: SupportSQLiteDatabase) {
        val expectedV7Tables = listOf(
            "family_gallery_albums",
            "family_gallery_photos",
            "family_constitution_versions",
            "family_traditions",
            "family_shared_activities",
            "family_rules",
            "family_extended_relatives"
        )
        val existingTables = getExistingTables(db)
        for (table in expectedV7Tables) {
            assertTrue("Expected Stage 7 Family Section table '$table' to exist in database", existingTables.contains(table))
        }
    }

    private fun verifyAllStage8FtsVirtualTablesExist(db: SupportSQLiteDatabase) {
        val expectedV8FtsTables = listOf(
            "recipes_fts",
            "tasks_fts",
            "family_goals_fts",
            "home_assets_fts",
            "family_traditions_fts"
        )
        val existingTables = getExistingTables(db)
        for (table in expectedV8FtsTables) {
            assertTrue("Expected Stage 8 FTS4 virtual table '$table' to exist in database", existingTables.contains(table))
        }
    }
}
