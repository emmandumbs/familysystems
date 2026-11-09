package com.familyos.core.database

import androidx.room.*

/**
 * Stage 2.A Database Entities for FamilyOS
 * Covers Food Pantry & Fridge Inventory (HSE-04) and Wardrobe & Outfit Planner (HSE-07).
 */

// Table #42: pantry_items
@Entity(
    tableName = "pantry_items",
    foreignKeys = [
        ForeignKey(
            entity = FamilyWorkspaceEntity::class,
            parentColumns = ["id"],
            childColumns = ["family_id"],
            onDelete = ForeignKey.CASCADE
        )
    ],
    indices = [
        Index(value = ["family_id"]),
        Index(value = ["category"]),
        Index(value = ["expiry_date"])
    ]
)
data class PantryItemEntity(
    @PrimaryKey
    val id: String,
    @ColumnInfo(name = "family_id")
    val familyId: String,
    @ColumnInfo(name = "item_name")
    val itemName: String,
    val category: String = "PANTRY", // "PANTRY", "FRIDGE", "FREEZER", "SPICES", "SNACKS", "BEVERAGES", "OTHER"
    val quantity: Double = 1.0,
    val unit: String = "item",
    @ColumnInfo(name = "storage_location")
    val storageLocation: String? = null,
    @ColumnInfo(name = "expiry_date")
    val expiryDate: Long? = null, // Epoch millis
    @ColumnInfo(name = "min_threshold")
    val minThreshold: Double = 1.0,
    @ColumnInfo(name = "is_low_stock")
    val isLowStock: Boolean = false,
    val notes: String? = null,
    val version: Long = 1L,
    @ColumnInfo(name = "sync_status")
    val syncStatus: String = "LOCAL_ONLY",
    @ColumnInfo(name = "is_deleted")
    val isDeleted: Boolean = false,
    @ColumnInfo(name = "created_at")
    val createdAt: Long = System.currentTimeMillis(),
    @ColumnInfo(name = "updated_at")
    val updatedAt: Long = System.currentTimeMillis()
)

// Table #43: wardrobe_items
@Entity(
    tableName = "wardrobe_items",
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
            childColumns = ["member_id"],
            onDelete = ForeignKey.CASCADE
        )
    ],
    indices = [
        Index(value = ["family_id"]),
        Index(value = ["member_id"]),
        Index(value = ["category"])
    ]
)
data class WardrobeItemEntity(
    @PrimaryKey
    val id: String,
    @ColumnInfo(name = "family_id")
    val familyId: String,
    @ColumnInfo(name = "member_id")
    val memberId: String,
    @ColumnInfo(name = "item_name")
    val itemName: String,
    val category: String = "TOPS", // "TOPS", "BOTTOMS", "DRESSES", "OUTERWEAR", "SHOES", "ACCESSORIES", "OTHER"
    val color: String? = null,
    val season: String = "ALL_SEASON", // "SPRING", "SUMMER", "FALL", "WINTER", "ALL_SEASON"
    @ColumnInfo(name = "is_clean")
    val isClean: Boolean = true,
    @ColumnInfo(name = "image_uri")
    val imageUri: String? = null,
    val notes: String? = null,
    val version: Long = 1L,
    @ColumnInfo(name = "sync_status")
    val syncStatus: String = "LOCAL_ONLY",
    @ColumnInfo(name = "is_deleted")
    val isDeleted: Boolean = false,
    @ColumnInfo(name = "created_at")
    val createdAt: Long = System.currentTimeMillis(),
    @ColumnInfo(name = "updated_at")
    val updatedAt: Long = System.currentTimeMillis()
)

// Table #44: outfit_plans
@Entity(
    tableName = "outfit_plans",
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
            childColumns = ["member_id"],
            onDelete = ForeignKey.CASCADE
        )
    ],
    indices = [
        Index(value = ["family_id"]),
        Index(value = ["member_id", "plan_date"]),
        Index(value = ["member_id", "plan_date", "occasion"], unique = true)
    ]
)
data class OutfitPlanEntity(
    @PrimaryKey
    val id: String,
    @ColumnInfo(name = "family_id")
    val familyId: String,
    @ColumnInfo(name = "member_id")
    val memberId: String,
    @ColumnInfo(name = "plan_date")
    val planDate: String, // "YYYY-MM-DD"
    @ColumnInfo(name = "outfit_name")
    val outfitName: String,
    @ColumnInfo(name = "item_ids_json")
    val itemIdsJson: String = "[]", // JSON array of wardrobe item IDs
    val occasion: String = "CASUAL", // "SCHOOL", "WORK", "CHURCH", "CASUAL", "SPORTS", "FORMAL", "OTHER"
    val notes: String? = null,
    val version: Long = 1L,
    @ColumnInfo(name = "sync_status")
    val syncStatus: String = "LOCAL_ONLY",
    @ColumnInfo(name = "is_deleted")
    val isDeleted: Boolean = false,
    @ColumnInfo(name = "created_at")
    val createdAt: Long = System.currentTimeMillis(),
    @ColumnInfo(name = "updated_at")
    val updatedAt: Long = System.currentTimeMillis()
)
