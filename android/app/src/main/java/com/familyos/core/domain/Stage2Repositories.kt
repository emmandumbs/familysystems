package com.familyos.core.domain

import kotlinx.coroutines.flow.Flow

interface FamilyRelationshipRepository {
    fun observeRelationships(familyId: String): Flow<List<FamilyRelationship>>
    suspend fun addRelationship(
        familyId: String,
        person1Id: String,
        person2Id: String,
        type: RelationshipType,
        notes: String? = null
    ): Result<FamilyRelationship>
    suspend fun removeRelationship(id: String): Result<Unit>
}

interface GoalsAndTasksRepository {
    fun observeGoals(familyId: String): Flow<List<FamilyGoal>>
    suspend fun createGoal(
        familyId: String,
        title: String,
        description: String?,
        category: GoalCategory,
        targetDate: Long?,
        priority: Priority,
        ownerMemberId: String?
    ): Result<FamilyGoal>

    fun observeProjects(familyId: String): Flow<List<Project>>
    suspend fun createProject(
        familyId: String,
        goalId: String?,
        name: String,
        budgetCents: Long,
        targetDate: Long?
    ): Result<Project>

    fun observeTasks(familyId: String): Flow<List<Task>>
    suspend fun createTask(
        familyId: String,
        projectId: String?,
        parentTaskId: String?,
        title: String,
        assignedMemberId: String?,
        priority: Priority,
        dueDate: Long?
    ): Result<Task>
    suspend fun setTaskCompleted(taskId: String, isCompleted: Boolean, memberId: String? = null): Result<Unit>
    suspend fun addChecklistItem(taskId: String, title: String): Result<TaskChecklistItem>
    suspend fun setChecklistItemDone(itemId: String, isDone: Boolean): Result<Unit>
}

interface RecipeRepository {
    fun observeRecipes(familyId: String): Flow<List<Recipe>>
    suspend fun getRecipe(recipeId: String): Recipe?
    suspend fun createRecipe(recipe: Recipe): Result<Recipe>
    suspend fun setFavorite(recipeId: String, isFavorite: Boolean): Result<Unit>
}

interface MealPlannerRepository {
    fun observeWeekMealPlans(familyId: String, startDate: Long, endDate: Long): Flow<List<MealPlanEntry>>
    suspend fun addMealPlan(entry: MealPlanEntry): Result<MealPlanEntry>
    suspend fun deleteMealPlan(id: String): Result<Unit>
    suspend fun generateGroceryListFromWeek(familyId: String, startDate: Long, endDate: Long): Result<Int>
}

interface GroceryListRepository {
    fun observeGroceryItems(familyId: String): Flow<List<GroceryListItem>>
    suspend fun addGroceryItem(
        familyId: String,
        itemName: String,
        category: String,
        quantity: Double,
        unit: String,
        sourceRecipeId: String? = null
    ): Result<GroceryListItem>
    suspend fun setPurchased(id: String, isPurchased: Boolean): Result<Unit>
    suspend fun clearPurchased(familyId: String): Result<Unit>
}

interface ChoresRepository {
    fun observeChores(familyId: String): Flow<List<Chore>>
    suspend fun createChore(chore: Chore): Result<Chore>
    suspend fun completeChore(choreId: String, memberId: String): Result<Unit>
}

interface HomeAssetsRepository {
    fun observeAssets(familyId: String): Flow<List<HomeAsset>>
    suspend fun addAsset(asset: HomeAsset): Result<HomeAsset>
    suspend fun logMaintenance(maintenance: AssetMaintenance): Result<Unit>
    fun observeWishlist(familyId: String): Flow<List<HouseholdWishlist>>
    suspend fun addWishlistItem(item: HouseholdWishlist): Result<HouseholdWishlist>
}

interface CalendarRepository {
    fun observeEvents(familyId: String, startDate: Long, endDate: Long): Flow<List<CalendarEvent>>
    fun observeAllEvents(familyId: String): Flow<List<CalendarEvent>>
    suspend fun getEventById(id: String): Result<CalendarEvent?>
    suspend fun addEvent(event: CalendarEvent): Result<CalendarEvent>
    suspend fun updateEvent(event: CalendarEvent): Result<CalendarEvent>
    suspend fun deleteEvent(id: String): Result<Unit>
}

interface RoutineRepository {
    fun observeRoutines(familyId: String): Flow<List<Routine>>
    fun observeOccurrencesForDate(familyId: String, targetDate: String): Flow<List<RoutineOccurrence>>
    fun observeAllOccurrences(familyId: String): Flow<List<RoutineOccurrence>>
    suspend fun getRoutineById(id: String): Result<Routine?>
    suspend fun saveRoutine(routine: Routine): Result<Routine>
    suspend fun setRoutinePaused(routineId: String, isPaused: Boolean): Result<Unit>
    suspend fun deleteRoutine(id: String): Result<Unit>

    suspend fun getOrCreateOccurrence(routineId: String, targetDate: String, familyId: String): Result<RoutineOccurrence>
    suspend fun toggleStep(routineId: String, occurrenceId: String, stepId: String, isDone: Boolean): Result<RoutineOccurrence>
    suspend fun completeOccurrence(routineId: String, occurrenceId: String, memberId: String): Result<RoutineOccurrence>
    suspend fun skipOccurrence(routineId: String, occurrenceId: String, reason: String): Result<RoutineOccurrence>
    suspend fun convertOccurrenceToTask(routineId: String, occurrenceId: String, taskId: String): Result<Unit>
    suspend fun seedDefaultRoutinesIfEmpty(familyId: String): Result<Unit>
}

