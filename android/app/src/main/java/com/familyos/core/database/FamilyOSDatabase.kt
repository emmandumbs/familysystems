package com.familyos.core.database

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase

/**
 * FamilyOS Core Room Database (Version 10)
 * Contains 58 entities across Stage 1–5 (53 relational `@Entity` tables + 5 `@Fts4` full-text search virtual tables).
 */
@Database(
    entities = [
        // Stage 1 Core Entities
        LocalUserProfileEntity::class,
        FamilyWorkspaceEntity::class,
        FamilyMembershipEntity::class,
        FamilyMemberEntity::class,
        FamilyInvitationEntity::class,
        GuardianRelationshipEntity::class,
        SyncQueueEntity::class,
        AuditEventEntity::class,
        AuthSessionEntity::class,
        
        // Stage 2 Family & Household Entities
        FamilyRelationshipEntity::class,
        FamilyGoalEntity::class,
        ProjectEntity::class,
        TaskEntity::class,
        TaskChecklistItemEntity::class,
        RecipeEntity::class,
        RecipeIngredientEntity::class,
        RecipeInstructionEntity::class,
        MealPlanEntryEntity::class,
        GroceryListItemEntity::class,
        ChoreEntity::class,
        ChoreCompletionHistoryEntity::class,
        HomeAssetEntity::class,
        AssetMaintenanceEntity::class,
        HouseholdWishlistEntity::class,
        CalendarEventEntity::class,

        // Stage 3 Finance & Wellbeing Entities
        FinancialAccountEntity::class,
        FinancialTransactionEntity::class,
        RecurringTransactionEntity::class,
        EnvelopeBudgetEntity::class,
        SavingsGoalEntity::class,
        BillSubscriptionEntity::class,
        WellbeingProfileEntity::class,
        HealthAllergyEntity::class,
        HealthMedicationEntity::class,
        HealthVaccinationEntity::class,
        HealthcareAppointmentEntity::class,
        EmergencyContactEntity::class,
        EmergencyPlanEntity::class,
        EmergencySupplyEntity::class,
        EmergencyChecklistItemEntity::class,

        // Stage 3.3.3 Canonical Routine & Occurrence Entities (v4)
        RoutineEntity::class,
        RoutineOccurrenceEntity::class,

        // Master Stage 2 Milestone 2.A: Food Pantry, Wardrobe & Outfits (v5)
        PantryItemEntity::class,
        WardrobeItemEntity::class,
        OutfitPlanEntity::class,

        // Master Stage 3.A.1: Investment Holdings (INV-01) (v6)
        InvestmentHoldingEntity::class,

        // Stage 3.4 Family Section & Extended Heritage Map Entities (v7)
        FamilyGalleryAlbumEntity::class,
        FamilyGalleryPhotoEntity::class,
        FamilyConstitutionVersionEntity::class,
        FamilyTraditionEntity::class,
        FamilySharedActivityEntity::class,
        FamilyRuleEntity::class,
        FamilyExtendedRelativeEntity::class,

        // Master Stage 4/5: FTS4 Full-Text Search Virtual Entities (v8)
        RecipeFtsEntity::class,
        TaskFtsEntity::class,
        FamilyGoalFtsEntity::class,
        HomeAssetFtsEntity::class,
        FamilyTraditionFtsEntity::class
    ],
    version = 10,
    exportSchema = true
)
abstract class FamilyOSDatabase : RoomDatabase() {
    // Stage 1 DAOs
    abstract fun userProfileDao(): UserProfileDao
    abstract fun familyWorkspaceDao(): FamilyWorkspaceDao
    abstract fun familyMemberDao(): FamilyMemberDao
    abstract fun guardianRelationshipDao(): GuardianRelationshipDao
    abstract fun syncQueueDao(): SyncQueueDao
    abstract fun auditEventDao(): AuditEventDao
    abstract fun authSessionDao(): AuthSessionDao

    // Stage 2 DAOs
    abstract fun familyRelationshipDao(): FamilyRelationshipDao
    abstract fun goalsAndTasksDao(): GoalsAndTasksDao
    abstract fun recipesDao(): RecipesDao
    abstract fun mealPlannerDao(): MealPlannerDao
    abstract fun groceryListDao(): GroceryListDao
    abstract fun choresDao(): ChoresDao
    abstract fun homeAssetsDao(): HomeAssetsDao
    abstract fun calendarDao(): CalendarDao

    // Stage 3 DAOs
    abstract fun financeDao(): FinanceDao
    abstract fun wellbeingDao(): WellbeingDao
    abstract fun emergencyDao(): EmergencyDao

    // Stage 3.3.3 Routine DAO
    abstract fun routineDao(): RoutineDao

    // Master Stage 2 Milestone 2.A DAOs (Pantry, Wardrobe, Outfits)
    abstract fun pantryDao(): PantryDao
    abstract fun wardrobeDao(): WardrobeDao
    abstract fun outfitDao(): OutfitDao

    // Stage 3.4 Family Section & Heritage Map DAO
    abstract fun familySectionDao(): FamilySectionDao

    // Master Stage 4/5 FTS4 Full-Text Search DAO (v8)
    abstract fun searchDao(): SearchDao

    companion object {
        private const val DATABASE_NAME = "familyos_core.db"

        @Volatile
        private var INSTANCE: FamilyOSDatabase? = null

        /**
         * Safe migration from v1 to v2:
         * Creates all Stage 2 tables and indices without dropping or altering existing v1 data.
         */
        val MIGRATION_1_2 = object : Migration(1, 2) {
            override fun migrate(db: SupportSQLiteDatabase) {
                // 1. family_relationships
                db.execSQL("""
                    CREATE TABLE IF NOT EXISTS `family_relationships` (
                        `id` TEXT NOT NULL PRIMARY KEY,
                        `family_id` TEXT NOT NULL,
                        `person1_member_id` TEXT NOT NULL,
                        `person2_member_id` TEXT NOT NULL,
                        `relationship_type` TEXT NOT NULL,
                        `notes` TEXT,
                        `created_at` INTEGER NOT NULL,
                        FOREIGN KEY(`family_id`) REFERENCES `family_workspaces`(`id`) ON DELETE CASCADE,
                        FOREIGN KEY(`person1_member_id`) REFERENCES `family_members`(`id`) ON DELETE CASCADE,
                        FOREIGN KEY(`person2_member_id`) REFERENCES `family_members`(`id`) ON DELETE CASCADE
                    )
                """.trimIndent())
                db.execSQL("CREATE INDEX IF NOT EXISTS `index_family_relationships_family_id` ON `family_relationships` (`family_id`)")
                db.execSQL("CREATE UNIQUE INDEX IF NOT EXISTS `index_family_relationships_person1_member_id_person2_member_id` ON `family_relationships` (`person1_member_id`, `person2_member_id`)")
                db.execSQL("CREATE INDEX IF NOT EXISTS `index_family_relationships_person2_member_id` ON `family_relationships` (`person2_member_id`)")

                // 2. family_goals
                db.execSQL("""
                    CREATE TABLE IF NOT EXISTS `family_goals` (
                        `id` TEXT NOT NULL PRIMARY KEY,
                        `family_id` TEXT NOT NULL,
                        `title` TEXT NOT NULL,
                        `description` TEXT,
                        `category` TEXT NOT NULL,
                        `target_date` INTEGER,
                        `priority` TEXT NOT NULL,
                        `owner_member_id` TEXT,
                        `status` TEXT NOT NULL,
                        `is_archived` INTEGER NOT NULL,
                        `created_at` INTEGER NOT NULL,
                        `updated_at` INTEGER NOT NULL,
                        FOREIGN KEY(`family_id`) REFERENCES `family_workspaces`(`id`) ON DELETE CASCADE
                    )
                """.trimIndent())
                db.execSQL("CREATE INDEX IF NOT EXISTS `index_family_goals_family_id` ON `family_goals` (`family_id`)")

                // 3. projects
                db.execSQL("""
                    CREATE TABLE IF NOT EXISTS `projects` (
                        `id` TEXT NOT NULL PRIMARY KEY,
                        `family_id` TEXT NOT NULL,
                        `goal_id` TEXT,
                        `name` TEXT NOT NULL,
                        `description` TEXT,
                        `budget_cents` INTEGER NOT NULL,
                        `target_date` INTEGER,
                        `status` TEXT NOT NULL,
                        `lead_member_id` TEXT,
                        `created_at` INTEGER NOT NULL,
                        `updated_at` INTEGER NOT NULL,
                        FOREIGN KEY(`family_id`) REFERENCES `family_workspaces`(`id`) ON DELETE CASCADE,
                        FOREIGN KEY(`goal_id`) REFERENCES `family_goals`(`id`) ON DELETE SET NULL
                    )
                """.trimIndent())
                db.execSQL("CREATE INDEX IF NOT EXISTS `index_projects_family_id` ON `projects` (`family_id`)")
                db.execSQL("CREATE INDEX IF NOT EXISTS `index_projects_goal_id` ON `projects` (`goal_id`)")

                // 4. tasks
                db.execSQL("""
                    CREATE TABLE IF NOT EXISTS `tasks` (
                        `id` TEXT NOT NULL PRIMARY KEY,
                        `family_id` TEXT NOT NULL,
                        `project_id` TEXT,
                        `parent_task_id` TEXT,
                        `title` TEXT NOT NULL,
                        `notes` TEXT,
                        `assigned_member_id` TEXT,
                        `priority` TEXT NOT NULL,
                        `due_date` INTEGER,
                        `is_completed` INTEGER NOT NULL,
                        `completed_at` INTEGER,
                        `completed_by_member_id` TEXT,
                        `recurrence_rule` TEXT,
                        `created_at` INTEGER NOT NULL,
                        `updated_at` INTEGER NOT NULL,
                        FOREIGN KEY(`family_id`) REFERENCES `family_workspaces`(`id`) ON DELETE CASCADE,
                        FOREIGN KEY(`project_id`) REFERENCES `projects`(`id`) ON DELETE SET NULL,
                        FOREIGN KEY(`parent_task_id`) REFERENCES `tasks`(`id`) ON DELETE CASCADE
                    )
                """.trimIndent())
                db.execSQL("CREATE INDEX IF NOT EXISTS `index_tasks_family_id` ON `tasks` (`family_id`)")
                db.execSQL("CREATE INDEX IF NOT EXISTS `index_tasks_project_id` ON `tasks` (`project_id`)")
                db.execSQL("CREATE INDEX IF NOT EXISTS `index_tasks_parent_task_id` ON `tasks` (`parent_task_id`)")
                db.execSQL("CREATE INDEX IF NOT EXISTS `index_tasks_assigned_member_id` ON `tasks` (`assigned_member_id`)")

                // 5. task_checklist_items
                db.execSQL("""
                    CREATE TABLE IF NOT EXISTS `task_checklist_items` (
                        `id` TEXT NOT NULL PRIMARY KEY,
                        `task_id` TEXT NOT NULL,
                        `title` TEXT NOT NULL,
                        `is_done` INTEGER NOT NULL,
                        `position` INTEGER NOT NULL,
                        FOREIGN KEY(`task_id`) REFERENCES `tasks`(`id`) ON DELETE CASCADE
                    )
                """.trimIndent())
                db.execSQL("CREATE INDEX IF NOT EXISTS `index_task_checklist_items_task_id` ON `task_checklist_items` (`task_id`)")

                // 6. recipes
                db.execSQL("""
                    CREATE TABLE IF NOT EXISTS `recipes` (
                        `id` TEXT NOT NULL PRIMARY KEY,
                        `family_id` TEXT NOT NULL,
                        `title` TEXT NOT NULL,
                        `description` TEXT,
                        `image_uri` TEXT,
                        `prep_time_minutes` INTEGER NOT NULL,
                        `cook_time_minutes` INTEGER NOT NULL,
                        `servings` INTEGER NOT NULL,
                        `difficulty` TEXT NOT NULL,
                        `category` TEXT NOT NULL,
                        `dietary_notes` TEXT,
                        `family_rating` INTEGER NOT NULL,
                        `is_favorite` INTEGER NOT NULL,
                        `source` TEXT,
                        `storage_instructions` TEXT,
                        `is_archived` INTEGER NOT NULL,
                        `created_at` INTEGER NOT NULL,
                        `updated_at` INTEGER NOT NULL,
                        FOREIGN KEY(`family_id`) REFERENCES `family_workspaces`(`id`) ON DELETE CASCADE
                    )
                """.trimIndent())
                db.execSQL("CREATE INDEX IF NOT EXISTS `index_recipes_family_id` ON `recipes` (`family_id`)")

                // 7. recipe_ingredients
                db.execSQL("""
                    CREATE TABLE IF NOT EXISTS `recipe_ingredients` (
                        `id` TEXT NOT NULL PRIMARY KEY,
                        `recipe_id` TEXT NOT NULL,
                        `item_name` TEXT NOT NULL,
                        `quantity` REAL NOT NULL,
                        `unit` TEXT NOT NULL,
                        `notes` TEXT,
                        FOREIGN KEY(`recipe_id`) REFERENCES `recipes`(`id`) ON DELETE CASCADE
                    )
                """.trimIndent())
                db.execSQL("CREATE INDEX IF NOT EXISTS `index_recipe_ingredients_recipe_id` ON `recipe_ingredients` (`recipe_id`)")

                // 8. recipe_instructions
                db.execSQL("""
                    CREATE TABLE IF NOT EXISTS `recipe_instructions` (
                        `id` TEXT NOT NULL PRIMARY KEY,
                        `recipe_id` TEXT NOT NULL,
                        `step_number` INTEGER NOT NULL,
                        `instruction_text` TEXT NOT NULL,
                        FOREIGN KEY(`recipe_id`) REFERENCES `recipes`(`id`) ON DELETE CASCADE
                    )
                """.trimIndent())
                db.execSQL("CREATE INDEX IF NOT EXISTS `index_recipe_instructions_recipe_id` ON `recipe_instructions` (`recipe_id`)")

                // 9. meal_plan_entries
                db.execSQL("""
                    CREATE TABLE IF NOT EXISTS `meal_plan_entries` (
                        `id` TEXT NOT NULL PRIMARY KEY,
                        `family_id` TEXT NOT NULL,
                        `plan_date` INTEGER NOT NULL,
                        `meal_type` TEXT NOT NULL,
                        `recipe_id` TEXT,
                        `custom_meal_title` TEXT,
                        `servings` INTEGER NOT NULL,
                        `notes` TEXT,
                        FOREIGN KEY(`family_id`) REFERENCES `family_workspaces`(`id`) ON DELETE CASCADE,
                        FOREIGN KEY(`recipe_id`) REFERENCES `recipes`(`id`) ON DELETE SET NULL
                    )
                """.trimIndent())
                db.execSQL("CREATE INDEX IF NOT EXISTS `index_meal_plan_entries_family_id_plan_date` ON `meal_plan_entries` (`family_id`, `plan_date`)")
                db.execSQL("CREATE INDEX IF NOT EXISTS `index_meal_plan_entries_recipe_id` ON `meal_plan_entries` (`recipe_id`)")

                // 10. grocery_list_items
                db.execSQL("""
                    CREATE TABLE IF NOT EXISTS `grocery_list_items` (
                        `id` TEXT NOT NULL PRIMARY KEY,
                        `family_id` TEXT NOT NULL,
                        `item_name` TEXT NOT NULL,
                        `category` TEXT NOT NULL,
                        `quantity` REAL NOT NULL,
                        `unit` TEXT NOT NULL,
                        `is_purchased` INTEGER NOT NULL,
                        `source_recipe_id` TEXT,
                        `created_at` INTEGER NOT NULL,
                        FOREIGN KEY(`family_id`) REFERENCES `family_workspaces`(`id`) ON DELETE CASCADE
                    )
                """.trimIndent())
                db.execSQL("CREATE INDEX IF NOT EXISTS `index_grocery_list_items_family_id` ON `grocery_list_items` (`family_id`)")

                // 11. chores
                db.execSQL("""
                    CREATE TABLE IF NOT EXISTS `chores` (
                        `id` TEXT NOT NULL PRIMARY KEY,
                        `family_id` TEXT NOT NULL,
                        `title` TEXT NOT NULL,
                        `description` TEXT,
                        `assigned_member_id` TEXT,
                        `zone` TEXT NOT NULL,
                        `frequency` TEXT NOT NULL,
                        `reward_points` INTEGER NOT NULL,
                        `next_due_date` INTEGER NOT NULL,
                        `requires_verification` INTEGER NOT NULL,
                        `is_completed` INTEGER NOT NULL,
                        `is_archived` INTEGER NOT NULL,
                        `created_at` INTEGER NOT NULL,
                        FOREIGN KEY(`family_id`) REFERENCES `family_workspaces`(`id`) ON DELETE CASCADE,
                        FOREIGN KEY(`assigned_member_id`) REFERENCES `family_members`(`id`) ON DELETE SET NULL
                    )
                """.trimIndent())
                db.execSQL("CREATE INDEX IF NOT EXISTS `index_chores_family_id` ON `chores` (`family_id`)")
                db.execSQL("CREATE INDEX IF NOT EXISTS `index_chores_assigned_member_id` ON `chores` (`assigned_member_id`)")

                // 12. chore_completion_history
                db.execSQL("""
                    CREATE TABLE IF NOT EXISTS `chore_completion_history` (
                        `id` TEXT NOT NULL PRIMARY KEY,
                        `chore_id` TEXT NOT NULL,
                        `completed_by_member_id` TEXT NOT NULL,
                        `completed_at` INTEGER NOT NULL,
                        `points_earned` INTEGER NOT NULL,
                        FOREIGN KEY(`chore_id`) REFERENCES `chores`(`id`) ON DELETE CASCADE
                    )
                """.trimIndent())
                db.execSQL("CREATE INDEX IF NOT EXISTS `index_chore_completion_history_chore_id` ON `chore_completion_history` (`chore_id`)")

                // 13. home_assets
                db.execSQL("""
                    CREATE TABLE IF NOT EXISTS `home_assets` (
                        `id` TEXT NOT NULL PRIMARY KEY,
                        `family_id` TEXT NOT NULL,
                        `name` TEXT NOT NULL,
                        `category` TEXT NOT NULL,
                        `description` TEXT,
                        `purchase_date` INTEGER,
                        `purchase_price_cents` INTEGER NOT NULL,
                        `warranty_expiry_date` INTEGER,
                        `serial_number` TEXT,
                        `location` TEXT,
                        `next_maintenance_date` INTEGER,
                        `is_archived` INTEGER NOT NULL,
                        `created_at` INTEGER NOT NULL,
                        `updated_at` INTEGER NOT NULL,
                        FOREIGN KEY(`family_id`) REFERENCES `family_workspaces`(`id`) ON DELETE CASCADE
                    )
                """.trimIndent())
                db.execSQL("CREATE INDEX IF NOT EXISTS `index_home_assets_family_id` ON `home_assets` (`family_id`)")

                // 14. asset_maintenance_records
                db.execSQL("""
                    CREATE TABLE IF NOT EXISTS `asset_maintenance_records` (
                        `id` TEXT NOT NULL PRIMARY KEY,
                        `asset_id` TEXT NOT NULL,
                        `title` TEXT NOT NULL,
                        `cost_cents` INTEGER NOT NULL,
                        `performed_date` INTEGER NOT NULL,
                        `notes` TEXT,
                        `service_provider` TEXT,
                        FOREIGN KEY(`asset_id`) REFERENCES `home_assets`(`id`) ON DELETE CASCADE
                    )
                """.trimIndent())
                db.execSQL("CREATE INDEX IF NOT EXISTS `index_asset_maintenance_records_asset_id` ON `asset_maintenance_records` (`asset_id`)")

                // 15. household_wishlist
                db.execSQL("""
                    CREATE TABLE IF NOT EXISTS `household_wishlist` (
                        `id` TEXT NOT NULL PRIMARY KEY,
                        `family_id` TEXT NOT NULL,
                        `item_name` TEXT NOT NULL,
                        `estimated_cost_cents` INTEGER NOT NULL,
                        `priority` TEXT NOT NULL,
                        `category` TEXT NOT NULL,
                        `url` TEXT,
                        `created_at` INTEGER NOT NULL,
                        FOREIGN KEY(`family_id`) REFERENCES `family_workspaces`(`id`) ON DELETE CASCADE
                    )
                """.trimIndent())
                db.execSQL("CREATE INDEX IF NOT EXISTS `index_household_wishlist_family_id` ON `household_wishlist` (`family_id`)")

                // 16. calendar_events
                db.execSQL("""
                    CREATE TABLE IF NOT EXISTS `calendar_events` (
                        `id` TEXT NOT NULL PRIMARY KEY,
                        `family_id` TEXT NOT NULL,
                        `title` TEXT NOT NULL,
                        `event_date` INTEGER NOT NULL,
                        `event_time_millis` INTEGER,
                        `category` TEXT NOT NULL,
                        `source_entity_id` TEXT,
                        `description` TEXT,
                        `created_at` INTEGER NOT NULL,
                        FOREIGN KEY(`family_id`) REFERENCES `family_workspaces`(`id`) ON DELETE CASCADE
                    )
                """.trimIndent())
                db.execSQL("CREATE INDEX IF NOT EXISTS `index_calendar_events_family_id_event_date` ON `calendar_events` (`family_id`, `event_date`)")
                db.execSQL("CREATE INDEX IF NOT EXISTS `index_calendar_events_category` ON `calendar_events` (`category`)")
            }
        }

        /**
         * Safe migration from v2 to v3:
         * Creates all Stage 3 Finance, Wellbeing, and Emergency Preparedness tables and indices.
         */
        val MIGRATION_2_3 = object : Migration(2, 3) {
            override fun migrate(db: SupportSQLiteDatabase) {
                // 1. financial_accounts
                db.execSQL("""
                    CREATE TABLE IF NOT EXISTS `financial_accounts` (
                        `id` TEXT NOT NULL PRIMARY KEY,
                        `family_id` TEXT NOT NULL,
                        `name` TEXT NOT NULL,
                        `account_type` TEXT NOT NULL,
                        `current_balance_cents` INTEGER NOT NULL,
                        `is_liability` INTEGER NOT NULL,
                        `currency` TEXT NOT NULL,
                        `institution` TEXT,
                        `is_archived` INTEGER NOT NULL,
                        `created_at` INTEGER NOT NULL,
                        `updated_at` INTEGER NOT NULL,
                        FOREIGN KEY(`family_id`) REFERENCES `family_workspaces`(`id`) ON DELETE CASCADE
                    )
                """.trimIndent())
                db.execSQL("CREATE INDEX IF NOT EXISTS `index_financial_accounts_family_id` ON `financial_accounts` (`family_id`)")
                db.execSQL("CREATE INDEX IF NOT EXISTS `index_financial_accounts_account_type` ON `financial_accounts` (`account_type`)")

                // 2. financial_transactions
                db.execSQL("""
                    CREATE TABLE IF NOT EXISTS `financial_transactions` (
                        `id` TEXT NOT NULL PRIMARY KEY,
                        `family_id` TEXT NOT NULL,
                        `account_id` TEXT NOT NULL,
                        `destination_account_id` TEXT,
                        `title` TEXT NOT NULL,
                        `amount_cents` INTEGER NOT NULL,
                        `transaction_type` TEXT NOT NULL,
                        `category` TEXT NOT NULL,
                        `transaction_date` INTEGER NOT NULL,
                        `is_cleared` INTEGER NOT NULL,
                        `is_reversal` INTEGER NOT NULL,
                        `reversal_of_id` TEXT,
                        `notes` TEXT,
                        `paid_by_member_id` TEXT,
                        `created_at` INTEGER NOT NULL,
                        FOREIGN KEY(`family_id`) REFERENCES `family_workspaces`(`id`) ON DELETE CASCADE,
                        FOREIGN KEY(`account_id`) REFERENCES `financial_accounts`(`id`) ON DELETE RESTRICT,
                        FOREIGN KEY(`destination_account_id`) REFERENCES `financial_accounts`(`id`) ON DELETE SET NULL
                    )
                """.trimIndent())
                db.execSQL("CREATE INDEX IF NOT EXISTS `index_financial_transactions_family_id` ON `financial_transactions` (`family_id`)")
                db.execSQL("CREATE INDEX IF NOT EXISTS `index_financial_transactions_account_id` ON `financial_transactions` (`account_id`)")
                db.execSQL("CREATE INDEX IF NOT EXISTS `index_financial_transactions_destination_account_id` ON `financial_transactions` (`destination_account_id`)")
                db.execSQL("CREATE INDEX IF NOT EXISTS `index_financial_transactions_transaction_date` ON `financial_transactions` (`transaction_date`)")
                db.execSQL("CREATE INDEX IF NOT EXISTS `index_financial_transactions_category` ON `financial_transactions` (`category`)")

                // 3. recurring_transactions
                db.execSQL("""
                    CREATE TABLE IF NOT EXISTS `recurring_transactions` (
                        `id` TEXT NOT NULL PRIMARY KEY,
                        `family_id` TEXT NOT NULL,
                        `account_id` TEXT NOT NULL,
                        `title` TEXT NOT NULL,
                        `amount_cents` INTEGER NOT NULL,
                        `transaction_type` TEXT NOT NULL,
                        `category` TEXT NOT NULL,
                        `recurrence_interval` TEXT NOT NULL,
                        `next_due_date` INTEGER NOT NULL,
                        `is_active` INTEGER NOT NULL,
                        `created_at` INTEGER NOT NULL,
                        FOREIGN KEY(`family_id`) REFERENCES `family_workspaces`(`id`) ON DELETE CASCADE,
                        FOREIGN KEY(`account_id`) REFERENCES `financial_accounts`(`id`) ON DELETE CASCADE
                    )
                """.trimIndent())
                db.execSQL("CREATE INDEX IF NOT EXISTS `index_recurring_transactions_family_id` ON `recurring_transactions` (`family_id`)")
                db.execSQL("CREATE INDEX IF NOT EXISTS `index_recurring_transactions_account_id` ON `recurring_transactions` (`account_id`)")

                // 4. envelope_budgets
                db.execSQL("""
                    CREATE TABLE IF NOT EXISTS `envelope_budgets` (
                        `id` TEXT NOT NULL PRIMARY KEY,
                        `family_id` TEXT NOT NULL,
                        `category` TEXT NOT NULL,
                        `allocated_cents` INTEGER NOT NULL,
                        `month_epoch` INTEGER NOT NULL,
                        `alert_threshold_percentage` INTEGER NOT NULL,
                        `created_at` INTEGER NOT NULL,
                        FOREIGN KEY(`family_id`) REFERENCES `family_workspaces`(`id`) ON DELETE CASCADE
                    )
                """.trimIndent())
                db.execSQL("CREATE INDEX IF NOT EXISTS `index_envelope_budgets_family_id` ON `envelope_budgets` (`family_id`)")
                db.execSQL("CREATE UNIQUE INDEX IF NOT EXISTS `index_envelope_budgets_family_id_category_month_epoch` ON `envelope_budgets` (`family_id`, `category`, `month_epoch`)")

                // 5. savings_goals
                db.execSQL("""
                    CREATE TABLE IF NOT EXISTS `savings_goals` (
                        `id` TEXT NOT NULL PRIMARY KEY,
                        `family_id` TEXT NOT NULL,
                        `linked_account_id` TEXT,
                        `title` TEXT NOT NULL,
                        `target_cents` INTEGER NOT NULL,
                        `current_cents` INTEGER NOT NULL,
                        `planned_monthly_contribution_cents` INTEGER NOT NULL,
                        `target_date` INTEGER,
                        `is_completed` INTEGER NOT NULL,
                        `created_at` INTEGER NOT NULL,
                        FOREIGN KEY(`family_id`) REFERENCES `family_workspaces`(`id`) ON DELETE CASCADE,
                        FOREIGN KEY(`linked_account_id`) REFERENCES `financial_accounts`(`id`) ON DELETE SET NULL
                    )
                """.trimIndent())
                db.execSQL("CREATE INDEX IF NOT EXISTS `index_savings_goals_family_id` ON `savings_goals` (`family_id`)")
                db.execSQL("CREATE INDEX IF NOT EXISTS `index_savings_goals_linked_account_id` ON `savings_goals` (`linked_account_id`)")

                // 6. bills_subscriptions
                db.execSQL("""
                    CREATE TABLE IF NOT EXISTS `bills_subscriptions` (
                        `id` TEXT NOT NULL PRIMARY KEY,
                        `family_id` TEXT NOT NULL,
                        `preferred_account_id` TEXT,
                        `payee` TEXT NOT NULL,
                        `amount_cents` INTEGER NOT NULL,
                        `billing_cycle` TEXT NOT NULL,
                        `due_date` INTEGER NOT NULL,
                        `is_subscription` INTEGER NOT NULL,
                        `is_auto_pay` INTEGER NOT NULL,
                        `reminder_days_before` INTEGER NOT NULL,
                        `created_at` INTEGER NOT NULL,
                        FOREIGN KEY(`family_id`) REFERENCES `family_workspaces`(`id`) ON DELETE CASCADE,
                        FOREIGN KEY(`preferred_account_id`) REFERENCES `financial_accounts`(`id`) ON DELETE SET NULL
                    )
                """.trimIndent())
                db.execSQL("CREATE INDEX IF NOT EXISTS `index_bills_subscriptions_family_id` ON `bills_subscriptions` (`family_id`)")
                db.execSQL("CREATE INDEX IF NOT EXISTS `index_bills_subscriptions_preferred_account_id` ON `bills_subscriptions` (`preferred_account_id`)")
                db.execSQL("CREATE INDEX IF NOT EXISTS `index_bills_subscriptions_due_date` ON `bills_subscriptions` (`due_date`)")

                // 7. wellbeing_profiles
                db.execSQL("""
                    CREATE TABLE IF NOT EXISTS `wellbeing_profiles` (
                        `id` TEXT NOT NULL PRIMARY KEY,
                        `family_id` TEXT NOT NULL,
                        `member_id` TEXT NOT NULL,
                        `blood_type` TEXT,
                        `medical_conditions_json` TEXT NOT NULL,
                        `insurance_provider` TEXT,
                        `insurance_policy_number` TEXT,
                        `primary_physician_name` TEXT,
                        `primary_physician_phone` TEXT,
                        `notes` TEXT,
                        `updated_at` INTEGER NOT NULL,
                        FOREIGN KEY(`family_id`) REFERENCES `family_workspaces`(`id`) ON DELETE CASCADE,
                        FOREIGN KEY(`member_id`) REFERENCES `family_members`(`id`) ON DELETE CASCADE
                    )
                """.trimIndent())
                db.execSQL("CREATE INDEX IF NOT EXISTS `index_wellbeing_profiles_family_id` ON `wellbeing_profiles` (`family_id`)")
                db.execSQL("CREATE UNIQUE INDEX IF NOT EXISTS `index_wellbeing_profiles_member_id` ON `wellbeing_profiles` (`member_id`)")

                // 8. health_allergies
                db.execSQL("""
                    CREATE TABLE IF NOT EXISTS `health_allergies` (
                        `id` TEXT NOT NULL PRIMARY KEY,
                        `family_id` TEXT NOT NULL,
                        `member_id` TEXT NOT NULL,
                        `allergen` TEXT NOT NULL,
                        `severity` TEXT NOT NULL,
                        `reaction` TEXT NOT NULL,
                        `emergency_treatment` TEXT,
                        `created_at` INTEGER NOT NULL,
                        FOREIGN KEY(`family_id`) REFERENCES `family_workspaces`(`id`) ON DELETE CASCADE,
                        FOREIGN KEY(`member_id`) REFERENCES `family_members`(`id`) ON DELETE CASCADE
                    )
                """.trimIndent())
                db.execSQL("CREATE INDEX IF NOT EXISTS `index_health_allergies_family_id` ON `health_allergies` (`family_id`)")
                db.execSQL("CREATE INDEX IF NOT EXISTS `index_health_allergies_member_id` ON `health_allergies` (`member_id`)")

                // 9. health_medications
                db.execSQL("""
                    CREATE TABLE IF NOT EXISTS `health_medications` (
                        `id` TEXT NOT NULL PRIMARY KEY,
                        `family_id` TEXT NOT NULL,
                        `member_id` TEXT NOT NULL,
                        `medication_name` TEXT NOT NULL,
                        `dosage` TEXT NOT NULL,
                        `schedule_frequency` TEXT NOT NULL,
                        `schedule_times_json` TEXT NOT NULL,
                        `instructions` TEXT,
                        `is_active` INTEGER NOT NULL,
                        `created_at` INTEGER NOT NULL,
                        FOREIGN KEY(`family_id`) REFERENCES `family_workspaces`(`id`) ON DELETE CASCADE,
                        FOREIGN KEY(`member_id`) REFERENCES `family_members`(`id`) ON DELETE CASCADE
                    )
                """.trimIndent())
                db.execSQL("CREATE INDEX IF NOT EXISTS `index_health_medications_family_id` ON `health_medications` (`family_id`)")
                db.execSQL("CREATE INDEX IF NOT EXISTS `index_health_medications_member_id` ON `health_medications` (`member_id`)")

                // 10. health_vaccinations
                db.execSQL("""
                    CREATE TABLE IF NOT EXISTS `health_vaccinations` (
                        `id` TEXT NOT NULL PRIMARY KEY,
                        `family_id` TEXT NOT NULL,
                        `member_id` TEXT NOT NULL,
                        `vaccine_name` TEXT NOT NULL,
                        `date_administered` INTEGER NOT NULL,
                        `next_booster_date` INTEGER,
                        `provider` TEXT,
                        `lot_number` TEXT,
                        `created_at` INTEGER NOT NULL,
                        FOREIGN KEY(`family_id`) REFERENCES `family_workspaces`(`id`) ON DELETE CASCADE,
                        FOREIGN KEY(`member_id`) REFERENCES `family_members`(`id`) ON DELETE CASCADE
                    )
                """.trimIndent())
                db.execSQL("CREATE INDEX IF NOT EXISTS `index_health_vaccinations_family_id` ON `health_vaccinations` (`family_id`)")
                db.execSQL("CREATE INDEX IF NOT EXISTS `index_health_vaccinations_member_id` ON `health_vaccinations` (`member_id`)")

                // 11. healthcare_appointments
                db.execSQL("""
                    CREATE TABLE IF NOT EXISTS `healthcare_appointments` (
                        `id` TEXT NOT NULL PRIMARY KEY,
                        `family_id` TEXT NOT NULL,
                        `member_id` TEXT NOT NULL,
                        `provider_name` TEXT NOT NULL,
                        `specialty` TEXT NOT NULL,
                        `appointment_time` INTEGER NOT NULL,
                        `location` TEXT,
                        `notes` TEXT,
                        `created_at` INTEGER NOT NULL,
                        FOREIGN KEY(`family_id`) REFERENCES `family_workspaces`(`id`) ON DELETE CASCADE,
                        FOREIGN KEY(`member_id`) REFERENCES `family_members`(`id`) ON DELETE CASCADE
                    )
                """.trimIndent())
                db.execSQL("CREATE INDEX IF NOT EXISTS `index_healthcare_appointments_family_id` ON `healthcare_appointments` (`family_id`)")
                db.execSQL("CREATE INDEX IF NOT EXISTS `index_healthcare_appointments_member_id` ON `healthcare_appointments` (`member_id`)")
                db.execSQL("CREATE INDEX IF NOT EXISTS `index_healthcare_appointments_appointment_time` ON `healthcare_appointments` (`appointment_time`)")

                // 12. emergency_contacts
                db.execSQL("""
                    CREATE TABLE IF NOT EXISTS `emergency_contacts` (
                        `id` TEXT NOT NULL PRIMARY KEY,
                        `family_id` TEXT NOT NULL,
                        `name` TEXT NOT NULL,
                        `relationship` TEXT NOT NULL,
                        `phone_primary` TEXT NOT NULL,
                        `phone_secondary` TEXT,
                        `is_primary` INTEGER NOT NULL,
                        `notes` TEXT,
                        `created_at` INTEGER NOT NULL,
                        FOREIGN KEY(`family_id`) REFERENCES `family_workspaces`(`id`) ON DELETE CASCADE
                    )
                """.trimIndent())
                db.execSQL("CREATE INDEX IF NOT EXISTS `index_emergency_contacts_family_id` ON `emergency_contacts` (`family_id`)")

                // 13. emergency_plans
                db.execSQL("""
                    CREATE TABLE IF NOT EXISTS `emergency_plans` (
                        `id` TEXT NOT NULL PRIMARY KEY,
                        `family_id` TEXT NOT NULL,
                        `primary_meeting_point` TEXT NOT NULL,
                        `secondary_meeting_point` TEXT NOT NULL,
                        `evacuation_route` TEXT,
                        `gas_shutoff_location` TEXT,
                        `water_shutoff_location` TEXT,
                        `electrical_panel_location` TEXT,
                        `notes` TEXT,
                        `updated_at` INTEGER NOT NULL,
                        FOREIGN KEY(`family_id`) REFERENCES `family_workspaces`(`id`) ON DELETE CASCADE
                    )
                """.trimIndent())
                db.execSQL("CREATE UNIQUE INDEX IF NOT EXISTS `index_emergency_plans_family_id` ON `emergency_plans` (`family_id`)")

                // 14. emergency_supplies
                db.execSQL("""
                    CREATE TABLE IF NOT EXISTS `emergency_supplies` (
                        `id` TEXT NOT NULL PRIMARY KEY,
                        `family_id` TEXT NOT NULL,
                        `item_name` TEXT NOT NULL,
                        `category` TEXT NOT NULL,
                        `quantity` TEXT NOT NULL,
                        `storage_location` TEXT NOT NULL,
                        `expiry_date` INTEGER,
                        `is_checked` INTEGER NOT NULL,
                        `created_at` INTEGER NOT NULL,
                        FOREIGN KEY(`family_id`) REFERENCES `family_workspaces`(`id`) ON DELETE CASCADE
                    )
                """.trimIndent())
                db.execSQL("CREATE INDEX IF NOT EXISTS `index_emergency_supplies_family_id` ON `emergency_supplies` (`family_id`)")

                // 15. emergency_checklist_items
                db.execSQL("""
                    CREATE TABLE IF NOT EXISTS `emergency_checklist_items` (
                        `id` TEXT NOT NULL PRIMARY KEY,
                        `family_id` TEXT NOT NULL,
                        `title` TEXT NOT NULL,
                        `category` TEXT NOT NULL,
                        `is_completed` INTEGER NOT NULL,
                        `assigned_member_id` TEXT,
                        `completed_at` INTEGER,
                        `created_at` INTEGER NOT NULL,
                        FOREIGN KEY(`family_id`) REFERENCES `family_workspaces`(`id`) ON DELETE CASCADE,
                        FOREIGN KEY(`assigned_member_id`) REFERENCES `family_members`(`id`) ON DELETE SET NULL
                    )
                """.trimIndent())
                db.execSQL("CREATE INDEX IF NOT EXISTS `index_emergency_checklist_items_family_id` ON `emergency_checklist_items` (`family_id`)")
                db.execSQL("CREATE INDEX IF NOT EXISTS `index_emergency_checklist_items_assigned_member_id` ON `emergency_checklist_items` (`assigned_member_id`)")
            }
        }

        /**
         * Safe, non-destructive migration from v3 to v4:
         * 1. Creates `routines` table for durable recurring household/personal rhythms.
         * 2. Creates `routine_occurrences` table for decoupled daily execution tracking.
         * All existing records across all 39 prior entities are strictly preserved.
         */
        val MIGRATION_3_4 = object : Migration(3, 4) {
            override fun migrate(db: SupportSQLiteDatabase) {
                // 1. routines table
                db.execSQL("""
                    CREATE TABLE IF NOT EXISTS `routines` (
                        `id` TEXT NOT NULL PRIMARY KEY,
                        `family_id` TEXT NOT NULL,
                        `title` TEXT NOT NULL,
                        `description` TEXT,
                        `category` TEXT NOT NULL,
                        `frequency` TEXT NOT NULL,
                        `target_time_of_day` TEXT NOT NULL,
                        `scope` TEXT NOT NULL,
                        `owner_member_id` TEXT NOT NULL,
                        `assigned_member_ids_json` TEXT NOT NULL,
                        `steps_json` TEXT NOT NULL,
                        `points_reward` INTEGER NOT NULL,
                        `is_paused` INTEGER NOT NULL,
                        `streak_count` INTEGER NOT NULL,
                        `best_streak_count` INTEGER NOT NULL,
                        `last_completed_date` TEXT,
                        `created_at` INTEGER NOT NULL,
                        `updated_at` INTEGER NOT NULL,
                        FOREIGN KEY(`family_id`) REFERENCES `family_workspaces`(`id`) ON DELETE CASCADE
                    )
                """.trimIndent())
                db.execSQL("CREATE INDEX IF NOT EXISTS `index_routines_family_id` ON `routines` (`family_id`)")
                db.execSQL("CREATE INDEX IF NOT EXISTS `index_routines_category` ON `routines` (`category`)")
                db.execSQL("CREATE INDEX IF NOT EXISTS `index_routines_is_paused` ON `routines` (`is_paused`)")

                // 2. routine_occurrences table
                db.execSQL("""
                    CREATE TABLE IF NOT EXISTS `routine_occurrences` (
                        `id` TEXT NOT NULL PRIMARY KEY,
                        `family_id` TEXT NOT NULL,
                        `routine_id` TEXT NOT NULL,
                        `target_date` TEXT NOT NULL,
                        `status` TEXT NOT NULL,
                        `step_completions_json` TEXT NOT NULL,
                        `completed_at` INTEGER,
                        `completed_by_member_id` TEXT,
                        `skipped_reason` TEXT,
                        `points_awarded` INTEGER NOT NULL,
                        `linked_task_id` TEXT,
                        `created_at` INTEGER NOT NULL,
                        `updated_at` INTEGER NOT NULL,
                        FOREIGN KEY(`family_id`) REFERENCES `family_workspaces`(`id`) ON DELETE CASCADE,
                        FOREIGN KEY(`routine_id`) REFERENCES `routines`(`id`) ON DELETE CASCADE
                    )
                """.trimIndent())
                db.execSQL("CREATE INDEX IF NOT EXISTS `index_routine_occurrences_family_id` ON `routine_occurrences` (`family_id`)")
                db.execSQL("CREATE UNIQUE INDEX IF NOT EXISTS `index_routine_occurrences_routine_id_target_date` ON `routine_occurrences` (`routine_id`, `target_date`)")
                db.execSQL("CREATE INDEX IF NOT EXISTS `index_routine_occurrences_target_date` ON `routine_occurrences` (`target_date`)")
                db.execSQL("CREATE INDEX IF NOT EXISTS `index_routine_occurrences_status` ON `routine_occurrences` (`status`)")
            }
        }

        /**
         * Safe migration from v4 to v5:
         * Creates Stage 2.A tables (pantry_items, wardrobe_items, outfit_plans) non-destructively.
         */
        val MIGRATION_4_5 = object : Migration(4, 5) {
            override fun migrate(db: SupportSQLiteDatabase) {
                // 1. pantry_items (Table #42)
                db.execSQL("""
                    CREATE TABLE IF NOT EXISTS `pantry_items` (
                        `id` TEXT NOT NULL PRIMARY KEY,
                        `family_id` TEXT NOT NULL,
                        `item_name` TEXT NOT NULL,
                        `category` TEXT NOT NULL,
                        `quantity` REAL NOT NULL,
                        `unit` TEXT NOT NULL,
                        `storage_location` TEXT,
                        `expiry_date` INTEGER,
                        `min_threshold` REAL NOT NULL,
                        `is_low_stock` INTEGER NOT NULL,
                        `notes` TEXT,
                        `version` INTEGER NOT NULL,
                        `sync_status` TEXT NOT NULL,
                        `is_deleted` INTEGER NOT NULL,
                        `created_at` INTEGER NOT NULL,
                        `updated_at` INTEGER NOT NULL,
                        FOREIGN KEY(`family_id`) REFERENCES `family_workspaces`(`id`) ON DELETE CASCADE
                    )
                """.trimIndent())
                db.execSQL("CREATE INDEX IF NOT EXISTS `index_pantry_items_family_id` ON `pantry_items` (`family_id`)")
                db.execSQL("CREATE INDEX IF NOT EXISTS `index_pantry_items_category` ON `pantry_items` (`category`)")
                db.execSQL("CREATE INDEX IF NOT EXISTS `index_pantry_items_expiry_date` ON `pantry_items` (`expiry_date`)")

                // 2. wardrobe_items (Table #43)
                db.execSQL("""
                    CREATE TABLE IF NOT EXISTS `wardrobe_items` (
                        `id` TEXT NOT NULL PRIMARY KEY,
                        `family_id` TEXT NOT NULL,
                        `member_id` TEXT NOT NULL,
                        `item_name` TEXT NOT NULL,
                        `category` TEXT NOT NULL,
                        `color` TEXT,
                        `season` TEXT NOT NULL,
                        `is_clean` INTEGER NOT NULL,
                        `image_uri` TEXT,
                        `notes` TEXT,
                        `version` INTEGER NOT NULL,
                        `sync_status` TEXT NOT NULL,
                        `is_deleted` INTEGER NOT NULL,
                        `created_at` INTEGER NOT NULL,
                        `updated_at` INTEGER NOT NULL,
                        FOREIGN KEY(`family_id`) REFERENCES `family_workspaces`(`id`) ON DELETE CASCADE,
                        FOREIGN KEY(`member_id`) REFERENCES `family_members`(`id`) ON DELETE CASCADE
                    )
                """.trimIndent())
                db.execSQL("CREATE INDEX IF NOT EXISTS `index_wardrobe_items_family_id` ON `wardrobe_items` (`family_id`)")
                db.execSQL("CREATE INDEX IF NOT EXISTS `index_wardrobe_items_member_id` ON `wardrobe_items` (`member_id`)")
                db.execSQL("CREATE INDEX IF NOT EXISTS `index_wardrobe_items_category` ON `wardrobe_items` (`category`)")

                // 3. outfit_plans (Table #44)
                db.execSQL("""
                    CREATE TABLE IF NOT EXISTS `outfit_plans` (
                        `id` TEXT NOT NULL PRIMARY KEY,
                        `family_id` TEXT NOT NULL,
                        `member_id` TEXT NOT NULL,
                        `plan_date` TEXT NOT NULL,
                        `outfit_name` TEXT NOT NULL,
                        `item_ids_json` TEXT NOT NULL,
                        `occasion` TEXT NOT NULL,
                        `notes` TEXT,
                        `version` INTEGER NOT NULL,
                        `sync_status` TEXT NOT NULL,
                        `is_deleted` INTEGER NOT NULL,
                        `created_at` INTEGER NOT NULL,
                        `updated_at` INTEGER NOT NULL,
                        FOREIGN KEY(`family_id`) REFERENCES `family_workspaces`(`id`) ON DELETE CASCADE,
                        FOREIGN KEY(`member_id`) REFERENCES `family_members`(`id`) ON DELETE CASCADE
                    )
                """.trimIndent())
                db.execSQL("CREATE INDEX IF NOT EXISTS `index_outfit_plans_family_id` ON `outfit_plans` (`family_id`)")
                db.execSQL("CREATE INDEX IF NOT EXISTS `index_outfit_plans_member_id_plan_date` ON `outfit_plans` (`member_id`, `plan_date`)")
                db.execSQL("CREATE UNIQUE INDEX IF NOT EXISTS `index_outfit_plans_member_id_plan_date_occasion` ON `outfit_plans` (`member_id`, `plan_date`, `occasion`)")
            }
        }

        val MIGRATION_5_6 = object : Migration(5, 6) {
            override fun migrate(db: SupportSQLiteDatabase) {
                // Table #45: investment_holdings (INV-01)
                db.execSQL("""
                    CREATE TABLE IF NOT EXISTS `investment_holdings` (
                        `id` TEXT NOT NULL PRIMARY KEY,
                        `family_id` TEXT NOT NULL,
                        `account_id` TEXT NOT NULL,
                        `symbol` TEXT NOT NULL,
                        `asset_name` TEXT NOT NULL,
                        `asset_type` TEXT NOT NULL,
                        `quantity_microshares` INTEGER NOT NULL,
                        `cost_basis_cents` INTEGER NOT NULL,
                        `current_price_cents` INTEGER NOT NULL,
                        `currency` TEXT NOT NULL,
                        `notes` TEXT,
                        `last_price_updated_at` INTEGER NOT NULL,
                        `version` INTEGER NOT NULL,
                        `sync_status` TEXT NOT NULL,
                        `is_deleted` INTEGER NOT NULL,
                        `created_at` INTEGER NOT NULL,
                        `updated_at` INTEGER NOT NULL,
                        FOREIGN KEY(`family_id`) REFERENCES `family_workspaces`(`id`) ON DELETE CASCADE,
                        FOREIGN KEY(`account_id`) REFERENCES `financial_accounts`(`id`) ON DELETE CASCADE
                    )
                """.trimIndent())

                db.execSQL("CREATE INDEX IF NOT EXISTS `index_investment_holdings_family_id` ON `investment_holdings` (`family_id`)")
                db.execSQL("CREATE INDEX IF NOT EXISTS `index_investment_holdings_account_id` ON `investment_holdings` (`account_id`)")
                db.execSQL("CREATE INDEX IF NOT EXISTS `index_investment_holdings_symbol` ON `investment_holdings` (`symbol`)")
            }
        }

        val MIGRATION_6_7 = object : Migration(6, 7) {
            override fun migrate(db: SupportSQLiteDatabase) {
                // 1. Replace unconditional unique index on family_memberships(user_account_id) with status-scoped index
                //    so historical REVOKED/LEFT memberships are preserved, and enforce single ACTIVE membership via SQLite triggers
                //    (keeping PRAGMA index_list 100% matched to @Entity indices for Room TableInfo validation).
                db.execSQL("DROP INDEX IF EXISTS `index_family_memberships_user_account_id`")
                db.execSQL("DROP INDEX IF EXISTS `index_family_memberships_one_active_per_user`")
                db.execSQL("CREATE INDEX IF NOT EXISTS `index_family_memberships_user_account_id_status` ON `family_memberships` (`user_account_id`, `status`)")
                db.execSQL("""
                    CREATE TRIGGER IF NOT EXISTS `trg_family_memberships_one_active_insert`
                    BEFORE INSERT ON `family_memberships`
                    WHEN NEW.`status` = 'ACTIVE'
                    BEGIN
                        SELECT RAISE(ABORT, 'ONE_ACTIVE_FAMILY_PER_ACCOUNT: Account already has an active family membership')
                        WHERE EXISTS (
                            SELECT 1 FROM `family_memberships`
                            WHERE `user_account_id` = NEW.`user_account_id`
                              AND `status` = 'ACTIVE'
                              AND `id` != NEW.`id`
                        );
                    END
                """.trimIndent())
                db.execSQL("""
                    CREATE TRIGGER IF NOT EXISTS `trg_family_memberships_one_active_update`
                    BEFORE UPDATE OF `status`, `user_account_id` ON `family_memberships`
                    WHEN NEW.`status` = 'ACTIVE'
                    BEGIN
                        SELECT RAISE(ABORT, 'ONE_ACTIVE_FAMILY_PER_ACCOUNT: Account already has an active family membership')
                        WHERE EXISTS (
                            SELECT 1 FROM `family_memberships`
                            WHERE `user_account_id` = NEW.`user_account_id`
                              AND `status` = 'ACTIVE'
                              AND `id` != NEW.`id`
                        );
                    END
                """.trimIndent())

                // 2. Create Family Section & Extended Heritage Map tables (matching FamilySectionEntities.kt @Entity definitions)
                db.execSQL("""
                    CREATE TABLE IF NOT EXISTS `family_gallery_albums` (
                        `id` TEXT NOT NULL PRIMARY KEY,
                        `family_id` TEXT NOT NULL,
                        `title` TEXT NOT NULL,
                        `description` TEXT,
                        `category` TEXT NOT NULL,
                        `cover_photo_url` TEXT,
                        `created_by_user_id` TEXT NOT NULL,
                        `version` INTEGER NOT NULL,
                        `is_deleted` INTEGER NOT NULL,
                        `created_at` INTEGER NOT NULL,
                        `updated_at` INTEGER NOT NULL,
                        FOREIGN KEY(`family_id`) REFERENCES `family_workspaces`(`id`) ON DELETE CASCADE
                    )
                """.trimIndent())
                db.execSQL("CREATE INDEX IF NOT EXISTS `index_family_gallery_albums_family_id` ON `family_gallery_albums` (`family_id`)")

                db.execSQL("""
                    CREATE TABLE IF NOT EXISTS `family_gallery_photos` (
                        `id` TEXT NOT NULL PRIMARY KEY,
                        `family_id` TEXT NOT NULL,
                        `album_id` TEXT,
                        `title` TEXT NOT NULL,
                        `caption` TEXT,
                        `image_url` TEXT NOT NULL,
                        `visibility` TEXT NOT NULL,
                        `uploaded_by_user_id` TEXT NOT NULL,
                        `uploaded_by_member_id` TEXT,
                        `version` INTEGER NOT NULL,
                        `is_deleted` INTEGER NOT NULL,
                        `created_at` INTEGER NOT NULL,
                        `updated_at` INTEGER NOT NULL,
                        FOREIGN KEY(`family_id`) REFERENCES `family_workspaces`(`id`) ON DELETE CASCADE
                    )
                """.trimIndent())
                db.execSQL("CREATE INDEX IF NOT EXISTS `index_family_gallery_photos_family_id` ON `family_gallery_photos` (`family_id`)")
                db.execSQL("CREATE INDEX IF NOT EXISTS `index_family_gallery_photos_album_id` ON `family_gallery_photos` (`album_id`)")

                db.execSQL("""
                    CREATE TABLE IF NOT EXISTS `family_constitution_versions` (
                        `id` TEXT NOT NULL PRIMARY KEY,
                        `family_id` TEXT NOT NULL,
                        `version_number` INTEGER NOT NULL,
                        `motto` TEXT NOT NULL,
                        `mission_statement` TEXT NOT NULL,
                        `vision_statement` TEXT NOT NULL,
                        `core_values_json` TEXT NOT NULL,
                        `acknowledgments_json` TEXT NOT NULL,
                        `edited_by_user_id` TEXT NOT NULL,
                        `created_at` INTEGER NOT NULL,
                        `updated_at` INTEGER NOT NULL,
                        FOREIGN KEY(`family_id`) REFERENCES `family_workspaces`(`id`) ON DELETE CASCADE
                    )
                """.trimIndent())
                db.execSQL("CREATE UNIQUE INDEX IF NOT EXISTS `index_family_constitution_versions_family_id_version_number` ON `family_constitution_versions` (`family_id`, `version_number`)")

                db.execSQL("""
                    CREATE TABLE IF NOT EXISTS `family_traditions` (
                        `id` TEXT NOT NULL PRIMARY KEY,
                        `family_id` TEXT NOT NULL,
                        `title` TEXT NOT NULL,
                        `category` TEXT NOT NULL,
                        `cadence` TEXT NOT NULL,
                        `next_occurrence_date` TEXT,
                        `origin_story` TEXT,
                        `linked_recipe_id` TEXT,
                        `version` INTEGER NOT NULL,
                        `is_deleted` INTEGER NOT NULL,
                        `created_at` INTEGER NOT NULL,
                        `updated_at` INTEGER NOT NULL,
                        FOREIGN KEY(`family_id`) REFERENCES `family_workspaces`(`id`) ON DELETE CASCADE
                    )
                """.trimIndent())
                db.execSQL("CREATE INDEX IF NOT EXISTS `index_family_traditions_family_id` ON `family_traditions` (`family_id`)")

                db.execSQL("""
                    CREATE TABLE IF NOT EXISTS `family_shared_activities` (
                        `id` TEXT NOT NULL PRIMARY KEY,
                        `family_id` TEXT NOT NULL,
                        `title` TEXT NOT NULL,
                        `category` TEXT NOT NULL,
                        `date_iso` TEXT NOT NULL,
                        `location` TEXT,
                        `budget_cents` INTEGER NOT NULL,
                        `status` TEXT NOT NULL,
                        `linked_calendar_event_id` TEXT,
                        `version` INTEGER NOT NULL,
                        `is_deleted` INTEGER NOT NULL,
                        `created_at` INTEGER NOT NULL,
                        `updated_at` INTEGER NOT NULL,
                        FOREIGN KEY(`family_id`) REFERENCES `family_workspaces`(`id`) ON DELETE CASCADE
                    )
                """.trimIndent())
                db.execSQL("CREATE INDEX IF NOT EXISTS `index_family_shared_activities_family_id` ON `family_shared_activities` (`family_id`)")

                db.execSQL("""
                    CREATE TABLE IF NOT EXISTS `family_rules` (
                        `id` TEXT NOT NULL PRIMARY KEY,
                        `family_id` TEXT NOT NULL,
                        `title` TEXT NOT NULL,
                        `category` TEXT NOT NULL,
                        `description` TEXT NOT NULL,
                        `applies_to_role` TEXT NOT NULL,
                        `version` INTEGER NOT NULL,
                        `is_deleted` INTEGER NOT NULL,
                        `created_at` INTEGER NOT NULL,
                        `updated_at` INTEGER NOT NULL,
                        FOREIGN KEY(`family_id`) REFERENCES `family_workspaces`(`id`) ON DELETE CASCADE
                    )
                """.trimIndent())
                db.execSQL("CREATE INDEX IF NOT EXISTS `index_family_rules_family_id` ON `family_rules` (`family_id`)")

                db.execSQL("""
                    CREATE TABLE IF NOT EXISTS `family_extended_relatives` (
                        `id` TEXT NOT NULL PRIMARY KEY,
                        `family_id` TEXT NOT NULL,
                        `full_name` TEXT NOT NULL,
                        `relationship_label` TEXT NOT NULL,
                        `lineage_side` TEXT NOT NULL,
                        `generation` TEXT NOT NULL,
                        `birth_year` INTEGER,
                        `occupation` TEXT,
                        `city` TEXT,
                        `country` TEXT,
                        `avatar_url` TEXT,
                        `growth_areas_json` TEXT NOT NULL,
                        `encouragement_notes_json` TEXT NOT NULL,
                        `version` INTEGER NOT NULL,
                        `is_deleted` INTEGER NOT NULL,
                        `created_at` INTEGER NOT NULL,
                        `updated_at` INTEGER NOT NULL,
                        FOREIGN KEY(`family_id`) REFERENCES `family_workspaces`(`id`) ON DELETE CASCADE
                    )
                """.trimIndent())
                db.execSQL("CREATE INDEX IF NOT EXISTS `index_family_extended_relatives_family_id` ON `family_extended_relatives` (`family_id`)")
                db.execSQL("CREATE INDEX IF NOT EXISTS `index_family_extended_relatives_lineage_side` ON `family_extended_relatives` (`lineage_side`)")
            }
        }

        /**
         * Safe, non-destructive migration from v7 to v8:
         * Creates FTS4 virtual tables and Room content-sync triggers for recipes, tasks,
         * family_goals, home_assets, and family_traditions, and populates them from existing rows
         * without altering base tables.
         */
        val MIGRATION_7_8 = object : Migration(7, 8) {
            override fun migrate(db: SupportSQLiteDatabase) {
                // 1. recipes_fts
                db.execSQL("CREATE VIRTUAL TABLE IF NOT EXISTS `recipes_fts` USING FTS4(`title`, `description`, `category`, `dietary_notes`, content=`recipes`)")
                db.execSQL("""
                    INSERT INTO `recipes_fts` (`docid`, `title`, `description`, `category`, `dietary_notes`)
                    SELECT `rowid`, `title`, `description`, `category`, `dietary_notes` FROM `recipes`
                """.trimIndent())
                db.execSQL("CREATE TRIGGER IF NOT EXISTS room_fts_content_sync_recipes_fts_BEFORE_UPDATE BEFORE UPDATE ON `recipes` BEGIN DELETE FROM `recipes_fts` WHERE `docid`=OLD.`rowid`; END")
                db.execSQL("CREATE TRIGGER IF NOT EXISTS room_fts_content_sync_recipes_fts_BEFORE_DELETE BEFORE DELETE ON `recipes` BEGIN DELETE FROM `recipes_fts` WHERE `docid`=OLD.`rowid`; END")
                db.execSQL("CREATE TRIGGER IF NOT EXISTS room_fts_content_sync_recipes_fts_AFTER_UPDATE AFTER UPDATE ON `recipes` BEGIN INSERT INTO `recipes_fts`(`docid`, `title`, `description`, `category`, `dietary_notes`) VALUES (NEW.`rowid`, NEW.`title`, NEW.`description`, NEW.`category`, NEW.`dietary_notes`); END")
                db.execSQL("CREATE TRIGGER IF NOT EXISTS room_fts_content_sync_recipes_fts_AFTER_INSERT AFTER INSERT ON `recipes` BEGIN INSERT INTO `recipes_fts`(`docid`, `title`, `description`, `category`, `dietary_notes`) VALUES (NEW.`rowid`, NEW.`title`, NEW.`description`, NEW.`category`, NEW.`dietary_notes`); END")

                // 2. tasks_fts
                db.execSQL("CREATE VIRTUAL TABLE IF NOT EXISTS `tasks_fts` USING FTS4(`title`, `notes`, content=`tasks`)")
                db.execSQL("""
                    INSERT INTO `tasks_fts` (`docid`, `title`, `notes`)
                    SELECT `rowid`, `title`, `notes` FROM `tasks`
                """.trimIndent())
                db.execSQL("CREATE TRIGGER IF NOT EXISTS room_fts_content_sync_tasks_fts_BEFORE_UPDATE BEFORE UPDATE ON `tasks` BEGIN DELETE FROM `tasks_fts` WHERE `docid`=OLD.`rowid`; END")
                db.execSQL("CREATE TRIGGER IF NOT EXISTS room_fts_content_sync_tasks_fts_BEFORE_DELETE BEFORE DELETE ON `tasks` BEGIN DELETE FROM `tasks_fts` WHERE `docid`=OLD.`rowid`; END")
                db.execSQL("CREATE TRIGGER IF NOT EXISTS room_fts_content_sync_tasks_fts_AFTER_UPDATE AFTER UPDATE ON `tasks` BEGIN INSERT INTO `tasks_fts`(`docid`, `title`, `notes`) VALUES (NEW.`rowid`, NEW.`title`, NEW.`notes`); END")
                db.execSQL("CREATE TRIGGER IF NOT EXISTS room_fts_content_sync_tasks_fts_AFTER_INSERT AFTER INSERT ON `tasks` BEGIN INSERT INTO `tasks_fts`(`docid`, `title`, `notes`) VALUES (NEW.`rowid`, NEW.`title`, NEW.`notes`); END")

                // 3. family_goals_fts
                db.execSQL("CREATE VIRTUAL TABLE IF NOT EXISTS `family_goals_fts` USING FTS4(`title`, `description`, `category`, content=`family_goals`)")
                db.execSQL("""
                    INSERT INTO `family_goals_fts` (`docid`, `title`, `description`, `category`)
                    SELECT `rowid`, `title`, `description`, `category` FROM `family_goals`
                """.trimIndent())
                db.execSQL("CREATE TRIGGER IF NOT EXISTS room_fts_content_sync_family_goals_fts_BEFORE_UPDATE BEFORE UPDATE ON `family_goals` BEGIN DELETE FROM `family_goals_fts` WHERE `docid`=OLD.`rowid`; END")
                db.execSQL("CREATE TRIGGER IF NOT EXISTS room_fts_content_sync_family_goals_fts_BEFORE_DELETE BEFORE DELETE ON `family_goals` BEGIN DELETE FROM `family_goals_fts` WHERE `docid`=OLD.`rowid`; END")
                db.execSQL("CREATE TRIGGER IF NOT EXISTS room_fts_content_sync_family_goals_fts_AFTER_UPDATE AFTER UPDATE ON `family_goals` BEGIN INSERT INTO `family_goals_fts`(`docid`, `title`, `description`, `category`) VALUES (NEW.`rowid`, NEW.`title`, NEW.`description`, NEW.`category`); END")
                db.execSQL("CREATE TRIGGER IF NOT EXISTS room_fts_content_sync_family_goals_fts_AFTER_INSERT AFTER INSERT ON `family_goals` BEGIN INSERT INTO `family_goals_fts`(`docid`, `title`, `description`, `category`) VALUES (NEW.`rowid`, NEW.`title`, NEW.`description`, NEW.`category`); END")

                // 4. home_assets_fts
                db.execSQL("CREATE VIRTUAL TABLE IF NOT EXISTS `home_assets_fts` USING FTS4(`name`, `category`, `description`, `location`, content=`home_assets`)")
                db.execSQL("""
                    INSERT INTO `home_assets_fts` (`docid`, `name`, `category`, `description`, `location`)
                    SELECT `rowid`, `name`, `category`, `description`, `location` FROM `home_assets`
                """.trimIndent())
                db.execSQL("CREATE TRIGGER IF NOT EXISTS room_fts_content_sync_home_assets_fts_BEFORE_UPDATE BEFORE UPDATE ON `home_assets` BEGIN DELETE FROM `home_assets_fts` WHERE `docid`=OLD.`rowid`; END")
                db.execSQL("CREATE TRIGGER IF NOT EXISTS room_fts_content_sync_home_assets_fts_BEFORE_DELETE BEFORE DELETE ON `home_assets` BEGIN DELETE FROM `home_assets_fts` WHERE `docid`=OLD.`rowid`; END")
                db.execSQL("CREATE TRIGGER IF NOT EXISTS room_fts_content_sync_home_assets_fts_AFTER_UPDATE AFTER UPDATE ON `home_assets` BEGIN INSERT INTO `home_assets_fts`(`docid`, `name`, `category`, `description`, `location`) VALUES (NEW.`rowid`, NEW.`name`, NEW.`category`, NEW.`description`, NEW.`location`); END")
                db.execSQL("CREATE TRIGGER IF NOT EXISTS room_fts_content_sync_home_assets_fts_AFTER_INSERT AFTER INSERT ON `home_assets` BEGIN INSERT INTO `home_assets_fts`(`docid`, `name`, `category`, `description`, `location`) VALUES (NEW.`rowid`, NEW.`name`, NEW.`category`, NEW.`description`, NEW.`location`); END")

                // 5. family_traditions_fts
                db.execSQL("CREATE VIRTUAL TABLE IF NOT EXISTS `family_traditions_fts` USING FTS4(`title`, `category`, `origin_story`, content=`family_traditions`)")
                db.execSQL("""
                    INSERT INTO `family_traditions_fts` (`docid`, `title`, `category`, `origin_story`)
                    SELECT `rowid`, `title`, `category`, `origin_story` FROM `family_traditions`
                """.trimIndent())
                db.execSQL("CREATE TRIGGER IF NOT EXISTS room_fts_content_sync_family_traditions_fts_BEFORE_UPDATE BEFORE UPDATE ON `family_traditions` BEGIN DELETE FROM `family_traditions_fts` WHERE `docid`=OLD.`rowid`; END")
                db.execSQL("CREATE TRIGGER IF NOT EXISTS room_fts_content_sync_family_traditions_fts_BEFORE_DELETE BEFORE DELETE ON `family_traditions` BEGIN DELETE FROM `family_traditions_fts` WHERE `docid`=OLD.`rowid`; END")
                db.execSQL("CREATE TRIGGER IF NOT EXISTS room_fts_content_sync_family_traditions_fts_AFTER_UPDATE AFTER UPDATE ON `family_traditions` BEGIN INSERT INTO `family_traditions_fts`(`docid`, `title`, `category`, `origin_story`) VALUES (NEW.`rowid`, NEW.`title`, NEW.`category`, NEW.`origin_story`); END")
                db.execSQL("CREATE TRIGGER IF NOT EXISTS room_fts_content_sync_family_traditions_fts_AFTER_INSERT AFTER INSERT ON `family_traditions` BEGIN INSERT INTO `family_traditions_fts`(`docid`, `title`, `category`, `origin_story`) VALUES (NEW.`rowid`, NEW.`title`, NEW.`category`, NEW.`origin_story`); END")

                // 6. Defensive family_invitations indices
                db.execSQL("CREATE UNIQUE INDEX IF NOT EXISTS `index_family_invitations_invitation_token` ON `family_invitations` (`invitation_token`)")
                db.execSQL("CREATE INDEX IF NOT EXISTS `index_family_invitations_family_id` ON `family_invitations` (`family_id`)")
            }
        }

        /**
         * Safe, non-destructive migration from v8 to v9:
         * Adds `idempotency_key TEXT` with a unique index on `financial_transactions`
         * to guarantee ledger transaction idempotency across retries and offline sync.
         */
        val MIGRATION_8_9 = object : Migration(8, 9) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL("ALTER TABLE `financial_transactions` ADD COLUMN `idempotency_key` TEXT")
                db.execSQL("CREATE UNIQUE INDEX IF NOT EXISTS `index_financial_transactions_idempotency_key` ON `financial_transactions` (`idempotency_key`)")
            }
        }

        /**
         * Safe, non-destructive migration from v9 to v10:
         * Adds `auth_sessions` table with indexes on (user_account_id, is_revoked) and (firebase_uid)
         * for offline session caching, remote revocation enforcement, and device tracking.
         */
        val MIGRATION_9_10 = object : Migration(9, 10) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL("""
                    CREATE TABLE IF NOT EXISTS `auth_sessions` (
                        `id` TEXT NOT NULL,
                        `user_account_id` TEXT NOT NULL,
                        `firebase_uid` TEXT,
                        `family_id` TEXT,
                        `device_name` TEXT,
                        `platform` TEXT,
                        `user_agent_hash` TEXT,
                        `token_issued_at` INTEGER,
                        `expires_at` INTEGER NOT NULL,
                        `last_active_at` INTEGER,
                        `is_revoked` INTEGER NOT NULL,
                        `revoked_at` INTEGER,
                        `created_at` INTEGER NOT NULL,
                        PRIMARY KEY(`id`)
                    )
                """.trimIndent())
                db.execSQL("CREATE INDEX IF NOT EXISTS `index_auth_sessions_user_account_id_is_revoked` ON `auth_sessions` (`user_account_id`, `is_revoked`)")
                db.execSQL("CREATE INDEX IF NOT EXISTS `index_auth_sessions_firebase_uid` ON `auth_sessions` (`firebase_uid`)")
            }
        }

        /**
         * Shared RoomDatabase.Callback enforcing the one-active-family-per-account invariant
         * via SQLite triggers across both production (`getInstance`) and test (`createInMemory`) databases.
         */
        val ONE_ACTIVE_FAMILY_TRIGGER_CALLBACK: Callback = object : Callback() {
            override fun onCreate(db: SupportSQLiteDatabase) {
                super.onCreate(db)
                db.execSQL("""
                    CREATE TRIGGER IF NOT EXISTS `trg_family_memberships_one_active_insert`
                    BEFORE INSERT ON `family_memberships`
                    WHEN NEW.`status` = 'ACTIVE'
                    BEGIN
                        SELECT RAISE(ABORT, 'ONE_ACTIVE_FAMILY_PER_ACCOUNT: Account already has an active family membership')
                        WHERE EXISTS (
                            SELECT 1 FROM `family_memberships`
                            WHERE `user_account_id` = NEW.`user_account_id`
                              AND `status` = 'ACTIVE'
                              AND `id` != NEW.`id`
                        );
                    END
                """.trimIndent())
                db.execSQL("""
                    CREATE TRIGGER IF NOT EXISTS `trg_family_memberships_one_active_update`
                    BEFORE UPDATE OF `status`, `user_account_id` ON `family_memberships`
                    WHEN NEW.`status` = 'ACTIVE'
                    BEGIN
                        SELECT RAISE(ABORT, 'ONE_ACTIVE_FAMILY_PER_ACCOUNT: Account already has an active family membership')
                        WHERE EXISTS (
                            SELECT 1 FROM `family_memberships`
                            WHERE `user_account_id` = NEW.`user_account_id`
                              AND `status` = 'ACTIVE'
                              AND `id` != NEW.`id`
                        );
                    END
                """.trimIndent())
            }
        }

        fun getInstance(context: Context, useEncryption: Boolean = true): FamilyOSDatabase {
            return INSTANCE ?: synchronized(this) {
                val builder = Room.databaseBuilder(
                    context.applicationContext,
                    FamilyOSDatabase::class.java,
                    DATABASE_NAME
                )
                    .addMigrations(
                        MIGRATION_1_2,
                        MIGRATION_2_3,
                        MIGRATION_3_4,
                        MIGRATION_4_5,
                        MIGRATION_5_6,
                        MIGRATION_6_7,
                        MIGRATION_7_8,
                        MIGRATION_8_9,
                        MIGRATION_9_10
                    )
                    .addCallback(ONE_ACTIVE_FAMILY_TRIGGER_CALLBACK)

                if (useEncryption) {
                    val factory = DatabaseKeyManager.createEncryptedOpenHelperFactory(
                        context.applicationContext,
                        useEncryption = true
                    ) ?: throw IllegalStateException(
                        "CRITICAL_SECURITY_FAILURE: Encrypted OpenHelperFactory returned null while useEncryption=true."
                    )
                    builder.openHelperFactory(factory)
                }

                val instance = builder.build()
                INSTANCE = instance
                instance
            }
        }

        fun createInMemory(context: Context): FamilyOSDatabase {
            return Room.inMemoryDatabaseBuilder(
                context.applicationContext,
                FamilyOSDatabase::class.java
            )
                .addCallback(ONE_ACTIVE_FAMILY_TRIGGER_CALLBACK)
                .allowMainThreadQueries()
                .build()
        }
    }
}
