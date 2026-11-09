package com.familyos.core.database

import androidx.room.*

/**
 * Stage 2 Database Entities for FamilyOS
 * Covers Family Relationships, Goals/Projects/Tasks, Meals & Recipes,
 * Chores & Points, Home Assets & Maintenance, and Shared Calendar.
 */

// 1. Family Relationships
@Entity(
    tableName = "family_relationships",
    foreignKeys = [
        ForeignKey(
            entity = FamilyWorkspaceEntity::class,
            parentColumns = ["id"],
            childColumns = ["family_id"],
            onDelete = ForeignKey.CASCADE
        ),
        ForeignKey(
            entity = FamilyMemberEntity::class,
            parentColumns = ["id"],
            childColumns = ["person1_member_id"],
            onDelete = ForeignKey.CASCADE
        ),
        ForeignKey(
            entity = FamilyMemberEntity::class,
            parentColumns = ["id"],
            childColumns = ["person2_member_id"],
            onDelete = ForeignKey.CASCADE
        )
    ],
    indices = [
        Index(value = ["family_id"]),
        Index(value = ["person1_member_id", "person2_member_id"], unique = true),
        Index(value = ["person2_member_id"])
    ]
)
data class FamilyRelationshipEntity(
    @PrimaryKey
    val id: String,
    @ColumnInfo(name = "family_id")
    val familyId: String,
    @ColumnInfo(name = "person1_member_id")
    val person1MemberId: String,
    @ColumnInfo(name = "person2_member_id")
    val person2MemberId: String,
    @ColumnInfo(name = "relationship_type")
    val relationshipType: String, // "PARENT_CHILD", "SPOUSE_PARTNER", "SIBLING", "GRANDPARENT_GRANDCHILD", "OTHER"
    val notes: String? = null,
    @ColumnInfo(name = "created_at")
    val createdAt: Long = System.currentTimeMillis()
)

// 2. Family Goals
@Entity(
    tableName = "family_goals",
    foreignKeys = [
        ForeignKey(
            entity = FamilyWorkspaceEntity::class,
            parentColumns = ["id"],
            childColumns = ["family_id"],
            onDelete = ForeignKey.CASCADE
        )
    ],
    indices = [Index(value = ["family_id"])]
)
data class FamilyGoalEntity(
    @PrimaryKey
    val id: String,
    @ColumnInfo(name = "family_id")
    val familyId: String,
    val title: String,
    val description: String? = null,
    val category: String = "HOUSEHOLD", // "FINANCIAL", "HOUSEHOLD", "EDUCATION", "HEALTH", "LIFESTYLE", "OTHER"
    @ColumnInfo(name = "target_date")
    val targetDate: Long? = null,
    val priority: String = "MEDIUM", // "LOW", "MEDIUM", "HIGH", "URGENT"
    @ColumnInfo(name = "owner_member_id")
    val ownerMemberId: String? = null,
    val status: String = "ACTIVE", // "ACTIVE", "COMPLETED", "ON_HOLD", "ARCHIVED"
    @ColumnInfo(name = "is_archived")
    val isArchived: Boolean = false,
    @ColumnInfo(name = "created_at")
    val createdAt: Long = System.currentTimeMillis(),
    @ColumnInfo(name = "updated_at")
    val updatedAt: Long = System.currentTimeMillis()
)

// 3. Projects
@Entity(
    tableName = "projects",
    foreignKeys = [
        ForeignKey(
            entity = FamilyWorkspaceEntity::class,
            parentColumns = ["id"],
            childColumns = ["family_id"],
            onDelete = ForeignKey.CASCADE
        ),
        ForeignKey(
            entity = FamilyGoalEntity::class,
            parentColumns = ["id"],
            childColumns = ["goal_id"],
            onDelete = ForeignKey.SET_NULL
        )
    ],
    indices = [
        Index(value = ["family_id"]),
        Index(value = ["goal_id"])
    ]
)
data class ProjectEntity(
    @PrimaryKey
    val id: String,
    @ColumnInfo(name = "family_id")
    val familyId: String,
    @ColumnInfo(name = "goal_id")
    val goalId: String? = null,
    val name: String,
    val description: String? = null,
    @ColumnInfo(name = "budget_cents")
    val budgetCents: Long = 0L, // Exact 64-bit integer cents
    @ColumnInfo(name = "target_date")
    val targetDate: Long? = null,
    val status: String = "ACTIVE",
    @ColumnInfo(name = "lead_member_id")
    val leadMemberId: String? = null,
    @ColumnInfo(name = "created_at")
    val createdAt: Long = System.currentTimeMillis(),
    @ColumnInfo(name = "updated_at")
    val updatedAt: Long = System.currentTimeMillis()
)

// 4. Tasks & Subtasks
@Entity(
    tableName = "tasks",
    foreignKeys = [
        ForeignKey(
            entity = FamilyWorkspaceEntity::class,
            parentColumns = ["id"],
            childColumns = ["family_id"],
            onDelete = ForeignKey.CASCADE
        ),
        ForeignKey(
            entity = ProjectEntity::class,
            parentColumns = ["id"],
            childColumns = ["project_id"],
            onDelete = ForeignKey.SET_NULL
        ),
        ForeignKey(
            entity = TaskEntity::class,
            parentColumns = ["id"],
            childColumns = ["parent_task_id"],
            onDelete = ForeignKey.CASCADE
        )
    ],
    indices = [
        Index(value = ["family_id"]),
        Index(value = ["project_id"]),
        Index(value = ["parent_task_id"]),
        Index(value = ["assigned_member_id"])
    ]
)
data class TaskEntity(
    @PrimaryKey
    val id: String,
    @ColumnInfo(name = "family_id")
    val familyId: String,
    @ColumnInfo(name = "project_id")
    val projectId: String? = null,
    @ColumnInfo(name = "parent_task_id")
    val parentTaskId: String? = null, // Supports subtasks cleanly
    val title: String,
    val notes: String? = null,
    @ColumnInfo(name = "assigned_member_id")
    val assignedMemberId: String? = null,
    val priority: String = "MEDIUM",
    @ColumnInfo(name = "due_date")
    val dueDate: Long? = null,
    @ColumnInfo(name = "is_completed")
    val isCompleted: Boolean = false,
    @ColumnInfo(name = "completed_at")
    val completedAt: Long? = null,
    @ColumnInfo(name = "completed_by_member_id")
    val completedByMemberId: String? = null,
    @ColumnInfo(name = "recurrence_rule")
    val recurrenceRule: String? = null,
    @ColumnInfo(name = "created_at")
    val createdAt: Long = System.currentTimeMillis(),
    @ColumnInfo(name = "updated_at")
    val updatedAt: Long = System.currentTimeMillis()
)

// 5. Checklist Items
@Entity(
    tableName = "task_checklist_items",
    foreignKeys = [
        ForeignKey(
            entity = TaskEntity::class,
            parentColumns = ["id"],
            childColumns = ["task_id"],
            onDelete = ForeignKey.CASCADE
        )
    ],
    indices = [Index(value = ["task_id"])]
)
data class TaskChecklistItemEntity(
    @PrimaryKey
    val id: String,
    @ColumnInfo(name = "task_id")
    val taskId: String,
    val title: String,
    @ColumnInfo(name = "is_done")
    val isDone: Boolean = false,
    val position: Int = 0
)

// 6. Recipes
@Entity(
    tableName = "recipes",
    foreignKeys = [
        ForeignKey(
            entity = FamilyWorkspaceEntity::class,
            parentColumns = ["id"],
            childColumns = ["family_id"],
            onDelete = ForeignKey.CASCADE
        )
    ],
    indices = [Index(value = ["family_id"])]
)
data class RecipeEntity(
    @PrimaryKey
    val id: String,
    @ColumnInfo(name = "family_id")
    val familyId: String,
    val title: String,
    val description: String? = null,
    @ColumnInfo(name = "image_uri")
    val imageUri: String? = null,
    @ColumnInfo(name = "prep_time_minutes")
    val prepTimeMinutes: Int = 15,
    @ColumnInfo(name = "cook_time_minutes")
    val cookTimeMinutes: Int = 30,
    val servings: Int = 4,
    val difficulty: String = "MEDIUM", // "EASY", "MEDIUM", "HARD"
    val category: String = "DINNER",
    @ColumnInfo(name = "dietary_notes")
    val dietaryNotes: String? = null,
    @ColumnInfo(name = "family_rating")
    val familyRating: Int = 5,
    @ColumnInfo(name = "is_favorite")
    val isFavorite: Boolean = false,
    val source: String? = null,
    @ColumnInfo(name = "storage_instructions")
    val storageInstructions: String? = null,
    @ColumnInfo(name = "is_archived")
    val isArchived: Boolean = false,
    @ColumnInfo(name = "created_at")
    val createdAt: Long = System.currentTimeMillis(),
    @ColumnInfo(name = "updated_at")
    val updatedAt: Long = System.currentTimeMillis()
)

// 7. Recipe Ingredients
@Entity(
    tableName = "recipe_ingredients",
    foreignKeys = [
        ForeignKey(
            entity = RecipeEntity::class,
            parentColumns = ["id"],
            childColumns = ["recipe_id"],
            onDelete = ForeignKey.CASCADE
        )
    ],
    indices = [Index(value = ["recipe_id"])]
)
data class RecipeIngredientEntity(
    @PrimaryKey
    val id: String,
    @ColumnInfo(name = "recipe_id")
    val recipeId: String,
    @ColumnInfo(name = "item_name")
    val itemName: String,
    val quantity: Double,
    val unit: String,
    val notes: String? = null
)

// 8. Recipe Instructions
@Entity(
    tableName = "recipe_instructions",
    foreignKeys = [
        ForeignKey(
            entity = RecipeEntity::class,
            parentColumns = ["id"],
            childColumns = ["recipe_id"],
            onDelete = ForeignKey.CASCADE
        )
    ],
    indices = [Index(value = ["recipe_id"])]
)
data class RecipeInstructionEntity(
    @PrimaryKey
    val id: String,
    @ColumnInfo(name = "recipe_id")
    val recipeId: String,
    @ColumnInfo(name = "step_number")
    val stepNumber: Int,
    @ColumnInfo(name = "instruction_text")
    val instructionText: String
)

// 9. Meal Plan Entries
@Entity(
    tableName = "meal_plan_entries",
    foreignKeys = [
        ForeignKey(
            entity = FamilyWorkspaceEntity::class,
            parentColumns = ["id"],
            childColumns = ["family_id"],
            onDelete = ForeignKey.CASCADE
        ),
        ForeignKey(
            entity = RecipeEntity::class,
            parentColumns = ["id"],
            childColumns = ["recipe_id"],
            onDelete = ForeignKey.SET_NULL
        )
    ],
    indices = [
        Index(value = ["family_id", "plan_date"]),
        Index(value = ["recipe_id"])
    ]
)
data class MealPlanEntryEntity(
    @PrimaryKey
    val id: String,
    @ColumnInfo(name = "family_id")
    val familyId: String,
    @ColumnInfo(name = "plan_date")
    val planDate: Long, // Start of day epoch millis
    @ColumnInfo(name = "meal_type")
    val mealType: String, // "BREAKFAST", "LUNCH", "DINNER", "SNACK"
    @ColumnInfo(name = "recipe_id")
    val recipeId: String? = null,
    @ColumnInfo(name = "custom_meal_title")
    val customMealTitle: String? = null,
    val servings: Int = 4,
    val notes: String? = null
)

// 10. Grocery List Items
@Entity(
    tableName = "grocery_list_items",
    foreignKeys = [
        ForeignKey(
            entity = FamilyWorkspaceEntity::class,
            parentColumns = ["id"],
            childColumns = ["family_id"],
            onDelete = ForeignKey.CASCADE
        )
    ],
    indices = [Index(value = ["family_id"])]
)
data class GroceryListItemEntity(
    @PrimaryKey
    val id: String,
    @ColumnInfo(name = "family_id")
    val familyId: String,
    @ColumnInfo(name = "item_name")
    val itemName: String,
    val category: String = "PANTRY", // "PRODUCE", "DAIRY", "MEAT", "PANTRY", "BAKERY", "FROZEN", "OTHER"
    val quantity: Double = 1.0,
    val unit: String = "item",
    @ColumnInfo(name = "is_purchased")
    val isPurchased: Boolean = false,
    @ColumnInfo(name = "source_recipe_id")
    val sourceRecipeId: String? = null,
    @ColumnInfo(name = "created_at")
    val createdAt: Long = System.currentTimeMillis()
)

// 11. Chores
@Entity(
    tableName = "chores",
    foreignKeys = [
        ForeignKey(
            entity = FamilyWorkspaceEntity::class,
            parentColumns = ["id"],
            childColumns = ["family_id"],
            onDelete = ForeignKey.CASCADE
        ),
        ForeignKey(
            entity = FamilyMemberEntity::class,
            parentColumns = ["id"],
            childColumns = ["assigned_member_id"],
            onDelete = ForeignKey.SET_NULL
        )
    ],
    indices = [
        Index(value = ["family_id"]),
        Index(value = ["assigned_member_id"])
    ]
)
data class ChoreEntity(
    @PrimaryKey
    val id: String,
    @ColumnInfo(name = "family_id")
    val familyId: String,
    val title: String,
    val description: String? = null,
    @ColumnInfo(name = "assigned_member_id")
    val assignedMemberId: String? = null,
    val zone: String = "GENERAL", // "KITCHEN", "LIVING_ROOM", "BEDROOMS", "BATHROOMS", "OUTDOORS", "GENERAL"
    val frequency: String = "DAILY", // "DAILY", "WEEKLY", "MONTHLY", "CUSTOM"
    @ColumnInfo(name = "reward_points")
    val rewardPoints: Int = 10,
    @ColumnInfo(name = "next_due_date")
    val nextDueDate: Long,
    @ColumnInfo(name = "requires_verification")
    val requiresVerification: Boolean = false,
    @ColumnInfo(name = "is_completed")
    val isCompleted: Boolean = false,
    @ColumnInfo(name = "is_archived")
    val isArchived: Boolean = false,
    @ColumnInfo(name = "created_at")
    val createdAt: Long = System.currentTimeMillis()
)

// 12. Chore Completion History
@Entity(
    tableName = "chore_completion_history",
    foreignKeys = [
        ForeignKey(
            entity = ChoreEntity::class,
            parentColumns = ["id"],
            childColumns = ["chore_id"],
            onDelete = ForeignKey.CASCADE
        )
    ],
    indices = [Index(value = ["chore_id"])]
)
data class ChoreCompletionHistoryEntity(
    @PrimaryKey
    val id: String,
    @ColumnInfo(name = "chore_id")
    val choreId: String,
    @ColumnInfo(name = "completed_by_member_id")
    val completedByMemberId: String,
    @ColumnInfo(name = "completed_at")
    val completedAt: Long = System.currentTimeMillis(),
    @ColumnInfo(name = "points_earned")
    val pointsEarned: Int
)

// 13. Home Assets
@Entity(
    tableName = "home_assets",
    foreignKeys = [
        ForeignKey(
            entity = FamilyWorkspaceEntity::class,
            parentColumns = ["id"],
            childColumns = ["family_id"],
            onDelete = ForeignKey.CASCADE
        )
    ],
    indices = [Index(value = ["family_id"])]
)
data class HomeAssetEntity(
    @PrimaryKey
    val id: String,
    @ColumnInfo(name = "family_id")
    val familyId: String,
    val name: String,
    val category: String = "APPLIANCES", // "APPLIANCES", "FURNITURE", "ELECTRONICS", "VEHICLES", "TOOLS", "HVAC", "PLUMBING", "OTHER"
    val description: String? = null,
    @ColumnInfo(name = "purchase_date")
    val purchaseDate: Long? = null,
    @ColumnInfo(name = "purchase_price_cents")
    val purchasePriceCents: Long = 0L, // Exact 64-bit integer cents
    @ColumnInfo(name = "warranty_expiry_date")
    val warrantyExpiryDate: Long? = null,
    @ColumnInfo(name = "serial_number")
    val serialNumber: String? = null,
    val location: String? = null,
    @ColumnInfo(name = "next_maintenance_date")
    val nextMaintenanceDate: Long? = null,
    @ColumnInfo(name = "is_archived")
    val isArchived: Boolean = false,
    @ColumnInfo(name = "created_at")
    val createdAt: Long = System.currentTimeMillis(),
    @ColumnInfo(name = "updated_at")
    val updatedAt: Long = System.currentTimeMillis()
)

// 14. Asset Maintenance Records
@Entity(
    tableName = "asset_maintenance_records",
    foreignKeys = [
        ForeignKey(
            entity = HomeAssetEntity::class,
            parentColumns = ["id"],
            childColumns = ["asset_id"],
            onDelete = ForeignKey.CASCADE
        )
    ],
    indices = [Index(value = ["asset_id"])]
)
data class AssetMaintenanceEntity(
    @PrimaryKey
    val id: String,
    @ColumnInfo(name = "asset_id")
    val assetId: String,
    val title: String,
    @ColumnInfo(name = "cost_cents")
    val costCents: Long = 0L,
    @ColumnInfo(name = "performed_date")
    val performedDate: Long = System.currentTimeMillis(),
    val notes: String? = null,
    @ColumnInfo(name = "service_provider")
    val serviceProvider: String? = null
)

// 15. Household Wishlist
@Entity(
    tableName = "household_wishlist",
    foreignKeys = [
        ForeignKey(
            entity = FamilyWorkspaceEntity::class,
            parentColumns = ["id"],
            childColumns = ["family_id"],
            onDelete = ForeignKey.CASCADE
        )
    ],
    indices = [Index(value = ["family_id"])]
)
data class HouseholdWishlistEntity(
    @PrimaryKey
    val id: String,
    @ColumnInfo(name = "family_id")
    val familyId: String,
    @ColumnInfo(name = "item_name")
    val itemName: String,
    @ColumnInfo(name = "estimated_cost_cents")
    val estimatedCostCents: Long = 0L,
    val priority: String = "MEDIUM",
    val category: String = "HOME",
    val url: String? = null,
    @ColumnInfo(name = "created_at")
    val createdAt: Long = System.currentTimeMillis()
)

// 16. Shared Calendar Events
@Entity(
    tableName = "calendar_events",
    foreignKeys = [
        ForeignKey(
            entity = FamilyWorkspaceEntity::class,
            parentColumns = ["id"],
            childColumns = ["family_id"],
            onDelete = ForeignKey.CASCADE
        )
    ],
    indices = [
        Index(value = ["family_id", "event_date"]),
        Index(value = ["category"])
    ]
)
data class CalendarEventEntity(
    @PrimaryKey
    val id: String,
    @ColumnInfo(name = "family_id")
    val familyId: String,
    val title: String,
    @ColumnInfo(name = "event_date")
    val eventDate: Long, // Normalized start-of-day epoch millis
    @ColumnInfo(name = "event_time_millis")
    val eventTimeMillis: Long? = null,
    val category: String = "FAMILY_EVENT", // "BIRTHDAY", "ANNIVERSARY", "GOAL_DUE", "TASK_DUE", "MEAL", "CHORE", "MAINTENANCE", "FAMILY_EVENT"
    @ColumnInfo(name = "source_entity_id")
    val sourceEntityId: String? = null,
    val description: String? = null,
    @ColumnInfo(name = "created_at")
    val createdAt: Long = System.currentTimeMillis()
)
