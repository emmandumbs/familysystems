package com.familyos.core.domain

/**
 * Stage 2 Pure Kotlin Domain Models
 * Completely decoupled from Android and Room framework types.
 */

// 1. Relationships
enum class RelationshipType {
    PARENT_CHILD,
    SPOUSE_PARTNER,
    SIBLING,
    GRANDPARENT_GRANDCHILD,
    OTHER
}

data class FamilyRelationship(
    val id: String,
    val familyId: String,
    val person1MemberId: String,
    val person2MemberId: String,
    val relationshipType: RelationshipType,
    val notes: String?
)

// 2. Goals, Projects, Milestones, Universal Tasks & Checklists (Stage 2 + Stage 3.3.2)
enum class GoalCategory {
    FINANCIAL,
    HOUSEHOLD,
    EDUCATION,
    HEALTH,
    SPIRITUAL,
    MARRIAGE,
    PARENTING,
    LIFESTYLE,
    OTHER
}

enum class GoalScope {
    PERSONAL,
    COUPLE,
    FAMILY
}

enum class GoalHorizon {
    SHORT_TERM,
    LONG_TERM
}

enum class CanonicalTaskSourceModule {
    GOALS_PROJECTS,
    HOME_MANAGEMENT,
    MARRIAGE,
    PARENTING,
    SPIRITUAL_GROWTH,
    FAMILY_GOVERNANCE,
    PERSONAL_PLANNING
}

enum class Priority {
    LOW,
    MEDIUM,
    HIGH,
    URGENT
}

data class GoalReview(
    val id: String,
    val reviewerMemberId: String,
    val reviewerName: String,
    val notes: String,
    val progressSnapshot: Int,
    val rating: Int = 5,
    val createdAt: Long = System.currentTimeMillis()
)

data class FamilyGoal(
    val id: String,
    val familyId: String,
    val title: String,
    val description: String?,
    val category: GoalCategory,
    val targetDate: Long?,
    val priority: Priority,
    val ownerMemberId: String?,
    val status: String,
    val progressPercentage: Int = 0,
    val scope: GoalScope = GoalScope.FAMILY,
    val horizon: GoalHorizon = GoalHorizon.LONG_TERM,
    val isMeasurable: Boolean = false,
    val metricUnit: String? = null,
    val targetValue: Double? = null,
    val currentValue: Double? = null,
    val startDate: Long? = null,
    val linkedMission: String? = null,
    val linkedVision: String? = null,
    val reviews: List<GoalReview> = emptyList(),
    val isArchived: Boolean = false
)

data class ProjectMilestone(
    val id: String,
    val familyId: String,
    val projectId: String,
    val goalId: String? = null,
    val title: String,
    val description: String? = null,
    val ownerMemberId: String? = null,
    val dueDate: Long? = null,
    val status: String = "PENDING", // PENDING, IN_PROGRESS, COMPLETED, ARCHIVED
    val orderIndex: Int = 1,
    val progressPercentage: Int = 0,
    val completedAt: Long? = null
)

data class Project(
    val id: String,
    val familyId: String,
    val goalId: String?,
    val name: String,
    val description: String?,
    val budgetCents: Long, // Exact Long integer cents
    val targetDate: Long?,
    val status: String,
    val leadMemberId: String?,
    val scope: String = "SHARED", // PERSONAL, SHARED
    val priority: Priority = Priority.MEDIUM,
    val startDate: Long? = null,
    val assignedMemberIds: List<String> = emptyList(),
    val dependencies: List<String> = emptyList(),
    val progressPercentage: Int = 0,
    val comments: List<String> = emptyList(),
    val attachments: List<String> = emptyList(),
    val isArchived: Boolean = false
)

data class Task(
    val id: String,
    val familyId: String,
    val projectId: String?,
    val parentTaskId: String?,
    val title: String,
    val notes: String?,
    val assignedMemberId: String?,
    val priority: Priority,
    val dueDate: Long?,
    val isCompleted: Boolean,
    val completedAt: Long?,
    val completedByMemberId: String?,
    val recurrenceRule: String?,
    val checklistItems: List<TaskChecklistItem> = emptyList(),
    val creatorMemberId: String? = assignedMemberId,
    val scope: String = "SHARED", // PERSONAL, SHARED
    val status: String = if (isCompleted) "COMPLETED" else "TODO", // TODO, IN_PROGRESS, REVIEW, BLOCKED, COMPLETED, ARCHIVED
    val startDate: Long? = null,
    val timezone: String = "America/Los_Angeles",
    val estimatedDurationMinutes: Int? = null,
    val actualDurationMinutes: Int? = null,
    val goalId: String? = null,
    val milestoneId: String? = null,
    val dependencyTaskIds: List<String> = emptyList(),
    val sourceModule: CanonicalTaskSourceModule = CanonicalTaskSourceModule.GOALS_PROJECTS,
    val progressPercentage: Int = if (isCompleted) 100 else 0,
    val rewardPoints: Int = 0,
    val isArchived: Boolean = false
)

data class TaskChecklistItem(
    val id: String,
    val taskId: String,
    val title: String,
    val isDone: Boolean,
    val position: Int,
    val assignedMemberId: String? = null
)

data class ChecklistTemplate(
    val id: String,
    val familyId: String,
    val title: String,
    val description: String = "",
    val sourceModule: CanonicalTaskSourceModule = CanonicalTaskSourceModule.GOALS_PROJECTS,
    val scope: String = "SHARED",
    val items: List<String> = emptyList()
)

data class FamilyRewardConfig(
    val familyId: String,
    val enabled: Boolean = false, // Disabled by default per Section 9
    val currencyName: String = "Family Coins",
    val defaultTaskPoints: Int = 15,
    val requiresApproval: Boolean = true
)

// 3. Recipes & Ingredients
enum class RecipeDifficulty {
    EASY,
    MEDIUM,
    HARD
}

data class Recipe(
    val id: String,
    val familyId: String,
    val title: String,
    val description: String?,
    val imageUri: String?,
    val prepTimeMinutes: Int,
    val cookTimeMinutes: Int,
    val servings: Int,
    val difficulty: RecipeDifficulty,
    val category: String,
    val dietaryNotes: String?,
    val familyRating: Int,
    val isFavorite: Boolean,
    val source: String?,
    val storageInstructions: String?,
    val ingredients: List<RecipeIngredient> = emptyList(),
    val instructions: List<RecipeInstruction> = emptyList()
)

data class RecipeIngredient(
    val id: String,
    val recipeId: String,
    val itemName: String,
    val quantity: Double,
    val unit: String,
    val notes: String?
) {
    /**
     * Scale ingredient quantity based on target servings vs original servings.
     */
    fun scaleForServings(originalServings: Int, targetServings: Int): RecipeIngredient {
        if (originalServings <= 0 || targetServings <= 0) return this
        val ratio = targetServings.toDouble() / originalServings.toDouble()
        return copy(quantity = (quantity * ratio * 100.0).toLong() / 100.0) // 2 decimal precision
    }
}

data class RecipeInstruction(
    val id: String,
    val recipeId: String,
    val stepNumber: Int,
    val instructionText: String
)

// 4. Meal Planner & Groceries
enum class MealType {
    BREAKFAST,
    LUNCH,
    DINNER,
    SNACK
}

data class MealPlanEntry(
    val id: String,
    val familyId: String,
    val planDate: Long,
    val mealType: MealType,
    val recipeId: String?,
    val customMealTitle: String?,
    val servings: Int,
    val notes: String?
)

data class GroceryListItem(
    val id: String,
    val familyId: String,
    val itemName: String,
    val category: String,
    val quantity: Double,
    val unit: String,
    val isPurchased: Boolean,
    val sourceRecipeId: String?
)

// 5. Chores & Routines
enum class ChoreFrequency {
    DAILY,
    WEEKLY,
    BIWEEKLY,
    MONTHLY,
    CUSTOM
}

data class Chore(
    val id: String,
    val familyId: String,
    val title: String,
    val description: String?,
    val assignedMemberId: String?,
    val zone: String,
    val frequency: ChoreFrequency,
    val rewardPoints: Int,
    val nextDueDate: Long,
    val requiresVerification: Boolean,
    val isCompleted: Boolean
)

data class ChoreCompletionHistory(
    val id: String,
    val choreId: String,
    val completedByMemberId: String,
    val completedAt: Long,
    val pointsEarned: Int
)

// 6. Home Assets & Maintenance
enum class AssetCategory {
    APPLIANCES,
    FURNITURE,
    ELECTRONICS,
    VEHICLES,
    TOOLS,
    HVAC,
    PLUMBING,
    OTHER
}

data class HomeAsset(
    val id: String,
    val familyId: String,
    val name: String,
    val category: AssetCategory,
    val description: String?,
    val purchaseDate: Long?,
    val purchasePriceCents: Long, // Exact Long integer cents ($1.00 = 100L)
    val warrantyExpiryDate: Long?,
    val serialNumber: String?,
    val location: String?,
    val nextMaintenanceDate: Long?
)

data class AssetMaintenance(
    val id: String,
    val assetId: String,
    val title: String,
    val costCents: Long,
    val performedDate: Long,
    val notes: String?,
    val serviceProvider: String?
)

data class HouseholdWishlist(
    val id: String,
    val familyId: String,
    val itemName: String,
    val estimatedCostCents: Long,
    val priority: Priority,
    val category: String,
    val url: String?
)

// 7. Shared Calendar & Routines
enum class CalendarEventCategory {
    BIRTHDAY,
    ANNIVERSARY,
    GOAL_DUE,
    TASK_DUE,
    MEAL,
    CHORE,
    MAINTENANCE,
    FAMILY_EVENT,
    APPOINTMENT,
    ROUTINE,
    SPECIAL_OCCASION
}

enum class RoutineCategory {
    MORNING,
    EVENING,
    HOUSEHOLD,
    MARRIAGE,
    PARENTING,
    SPIRITUAL,
    PERSONAL,
    WORK
}

enum class RoutineFrequency {
    DAILY,
    WEEKDAYS,
    WEEKENDS,
    WEEKLY,
    BIWEEKLY,
    MONTHLY,
    CUSTOM
}

data class CalendarEvent(
    val id: String,
    val familyId: String,
    val title: String,
    val eventDate: Long,
    val eventTimeMillis: Long? = null,
    val category: CalendarEventCategory = CalendarEventCategory.FAMILY_EVENT,
    val sourceEntityId: String? = null,
    val description: String? = null,
    val scope: String = "FAMILY", // PERSONAL, COUPLE, FAMILY
    val isAllDay: Boolean = false,
    val location: String? = null,
    val timezone: String = "America/Los_Angeles",
    val assignedMemberId: String? = null,
    val isCompleted: Boolean = false,
    val recurrenceRule: String? = null,
    val recurrenceExceptions: List<String> = emptyList(),
    val reminders: List<Int> = emptyList()
)

data class RoutineStep(
    val id: String,
    val title: String,
    val orderIndex: Int = 0,
    val estimatedMinutes: Int? = null
)

data class Routine(
    val id: String,
    val familyId: String,
    val title: String,
    val description: String? = null,
    val category: RoutineCategory = RoutineCategory.HOUSEHOLD,
    val frequency: RoutineFrequency = RoutineFrequency.DAILY,
    val targetTimeOfDay: String = "08:00",
    val scope: String = "FAMILY",
    val ownerMemberId: String = "",
    val assignedMemberIds: List<String> = emptyList(),
    val steps: List<RoutineStep> = emptyList(),
    val pointsReward: Int = 15,
    val isPaused: Boolean = false,
    val streakCount: Int = 0,
    val bestStreakCount: Int = 0,
    val lastCompletedDate: String? = null
)

data class RoutineOccurrence(
    val id: String,
    val familyId: String,
    val routineId: String,
    val targetDate: String,
    val status: String = "PENDING", // PENDING, IN_PROGRESS, COMPLETED, SKIPPED
    val stepCompletions: Map<String, Boolean> = emptyMap(),
    val completedAt: Long? = null,
    val completedByMemberId: String? = null,
    val skippedReason: String? = null,
    val linkedTaskId: String? = null
)

