package com.familyos.core.database

import androidx.room.*
import kotlinx.coroutines.flow.Flow

// 1. Family Relationships DAO
@Dao
interface FamilyRelationshipDao {
    @Query("SELECT * FROM family_relationships WHERE family_id = :familyId")
    fun observeRelationships(familyId: String): Flow<List<FamilyRelationshipEntity>>

    @Query("SELECT * FROM family_relationships WHERE family_id = :familyId AND (person1_member_id = :memberId OR person2_member_id = :memberId)")
    fun observeRelationshipsForMember(familyId: String, memberId: String): Flow<List<FamilyRelationshipEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertRelationship(relationship: FamilyRelationshipEntity)

    @Query("DELETE FROM family_relationships WHERE id = :id")
    suspend fun deleteRelationship(id: String)
}

// 2. Goals, Projects & Tasks DAO
@Dao
interface GoalsAndTasksDao {
    // Goals
    @Query("SELECT * FROM family_goals WHERE family_id = :familyId AND is_archived = 0 ORDER BY target_date ASC")
    fun observeGoals(familyId: String): Flow<List<FamilyGoalEntity>>

    @Query("SELECT * FROM family_goals WHERE id = :goalId LIMIT 1")
    suspend fun getGoalById(goalId: String): FamilyGoalEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertOrUpdateGoal(goal: FamilyGoalEntity)

    // Projects
    @Query("SELECT * FROM projects WHERE family_id = :familyId ORDER BY target_date ASC")
    fun observeProjects(familyId: String): Flow<List<ProjectEntity>>

    @Query("SELECT * FROM projects WHERE goal_id = :goalId")
    fun observeProjectsForGoal(goalId: String): Flow<List<ProjectEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertOrUpdateProject(project: ProjectEntity)

    // Tasks & Subtasks
    @Query("SELECT * FROM tasks WHERE family_id = :familyId ORDER BY due_date ASC")
    fun observeTasks(familyId: String): Flow<List<TaskEntity>>

    @Query("SELECT * FROM tasks WHERE project_id = :projectId ORDER BY due_date ASC")
    fun observeTasksForProject(projectId: String): Flow<List<TaskEntity>>

    @Query("SELECT * FROM tasks WHERE parent_task_id = :parentTaskId")
    fun observeSubtasks(parentTaskId: String): Flow<List<TaskEntity>>

    @Query("SELECT * FROM tasks WHERE id = :taskId LIMIT 1")
    suspend fun getTaskById(taskId: String): TaskEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertOrUpdateTask(task: TaskEntity)

    @Query("UPDATE tasks SET is_completed = :isCompleted, completed_at = :completedAt WHERE id = :taskId")
    suspend fun setTaskCompleted(taskId: String, isCompleted: Boolean, completedAt: Long?)

    // Checklist Items
    @Query("SELECT * FROM task_checklist_items WHERE task_id = :taskId ORDER BY position ASC")
    fun observeChecklistItems(taskId: String): Flow<List<TaskChecklistItemEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertChecklistItem(item: TaskChecklistItemEntity)

    @Query("UPDATE task_checklist_items SET is_done = :isDone WHERE id = :itemId")
    suspend fun setChecklistItemDone(itemId: String, isDone: Boolean)
}

// 3. Recipes DAO
@Dao
interface RecipesDao {
    @Query("SELECT * FROM recipes WHERE family_id = :familyId AND is_archived = 0 ORDER BY title ASC")
    fun observeRecipes(familyId: String): Flow<List<RecipeEntity>>

    @Query("SELECT * FROM recipes WHERE id = :recipeId LIMIT 1")
    suspend fun getRecipeById(recipeId: String): RecipeEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertOrUpdateRecipe(recipe: RecipeEntity)

    @Query("UPDATE recipes SET is_favorite = :isFavorite WHERE id = :recipeId")
    suspend fun setFavorite(recipeId: String, isFavorite: Boolean)

    // Ingredients
    @Query("SELECT * FROM recipe_ingredients WHERE recipe_id = :recipeId")
    fun observeIngredients(recipeId: String): Flow<List<RecipeIngredientEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertIngredients(ingredients: List<RecipeIngredientEntity>)

    // Instructions
    @Query("SELECT * FROM recipe_instructions WHERE recipe_id = :recipeId ORDER BY step_number ASC")
    fun observeInstructions(recipeId: String): Flow<List<RecipeInstructionEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertInstructions(instructions: List<RecipeInstructionEntity>)
}

// 4. Meal Planner DAO
@Dao
interface MealPlannerDao {
    @Query("SELECT * FROM meal_plan_entries WHERE family_id = :familyId AND plan_date >= :startDate AND plan_date <= :endDate ORDER BY plan_date ASC, meal_type ASC")
    fun observeWeekMealPlans(familyId: String, startDate: Long, endDate: Long): Flow<List<MealPlanEntryEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertOrUpdateMealPlan(entry: MealPlanEntryEntity)

    @Query("DELETE FROM meal_plan_entries WHERE id = :id")
    suspend fun deleteMealPlan(id: String)
}

// 5. Grocery List DAO
@Dao
interface GroceryListDao {
    @Query("SELECT * FROM grocery_list_items WHERE family_id = :familyId ORDER BY is_purchased ASC, category ASC, item_name ASC")
    fun observeGroceryItems(familyId: String): Flow<List<GroceryListItemEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertGroceryItem(item: GroceryListItemEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertGroceryItems(items: List<GroceryListItemEntity>)

    @Query("UPDATE grocery_list_items SET is_purchased = :isPurchased WHERE id = :id")
    suspend fun setPurchased(id: String, isPurchased: Boolean)

    @Query("DELETE FROM grocery_list_items WHERE id = :id")
    suspend fun deleteGroceryItem(id: String)

    @Query("DELETE FROM grocery_list_items WHERE family_id = :familyId AND is_purchased = 1")
    suspend fun clearPurchasedItems(familyId: String)
}

// 6. Chores DAO
@Dao
interface ChoresDao {
    @Query("SELECT * FROM chores WHERE family_id = :familyId AND is_archived = 0 ORDER BY next_due_date ASC")
    fun observeChores(familyId: String): Flow<List<ChoreEntity>>

    @Query("SELECT * FROM chores WHERE family_id = :familyId AND assigned_member_id = :memberId AND is_archived = 0")
    fun observeChoresForMember(familyId: String, memberId: String): Flow<List<ChoreEntity>>

    @Query("SELECT * FROM chores WHERE id = :choreId LIMIT 1")
    suspend fun getChoreById(choreId: String): ChoreEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertOrUpdateChore(chore: ChoreEntity)

    @Query("UPDATE chores SET is_completed = :isCompleted, next_due_date = :nextDueDate WHERE id = :choreId")
    suspend fun completeChore(choreId: String, isCompleted: Boolean, nextDueDate: Long)

    @Insert
    suspend fun logCompletion(history: ChoreCompletionHistoryEntity)

    @Query("SELECT * FROM chore_completion_history WHERE chore_id = :choreId ORDER BY completed_at DESC")
    fun observeChoreHistory(choreId: String): Flow<List<ChoreCompletionHistoryEntity>>
}

// 7. Home Assets DAO
@Dao
interface HomeAssetsDao {
    @Query("SELECT * FROM home_assets WHERE family_id = :familyId AND is_archived = 0 ORDER BY category ASC, name ASC")
    fun observeAssets(familyId: String): Flow<List<HomeAssetEntity>>

    @Query("SELECT * FROM home_assets WHERE id = :assetId LIMIT 1")
    suspend fun getAssetById(assetId: String): HomeAssetEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertOrUpdateAsset(asset: HomeAssetEntity)

    @Query("SELECT * FROM asset_maintenance_records WHERE asset_id = :assetId ORDER BY performed_date DESC")
    fun observeMaintenanceRecords(assetId: String): Flow<List<AssetMaintenanceEntity>>

    @Insert
    suspend fun logMaintenance(maintenance: AssetMaintenanceEntity)

    @Query("SELECT * FROM household_wishlist WHERE family_id = :familyId ORDER BY priority DESC")
    fun observeWishlist(familyId: String): Flow<List<HouseholdWishlistEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertWishlistItem(item: HouseholdWishlistEntity)
}

// 8. Calendar DAO
@Dao
interface CalendarDao {
    @Query("SELECT * FROM calendar_events WHERE family_id = :familyId AND event_date >= :startDate AND event_date <= :endDate ORDER BY event_date ASC")
    fun observeEventsBetween(familyId: String, startDate: Long, endDate: Long): Flow<List<CalendarEventEntity>>

    @Query("SELECT * FROM calendar_events WHERE family_id = :familyId ORDER BY event_date ASC")
    fun observeAllEvents(familyId: String): Flow<List<CalendarEventEntity>>

    @Query("SELECT * FROM calendar_events WHERE id = :id LIMIT 1")
    suspend fun getEventById(id: String): CalendarEventEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertEvent(event: CalendarEventEntity)

    @Update
    suspend fun updateEvent(event: CalendarEventEntity)

    @Query("DELETE FROM calendar_events WHERE id = :id")
    suspend fun deleteEvent(id: String)
}

