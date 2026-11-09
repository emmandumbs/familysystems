package com.familyos.core.domain

import com.familyos.core.database.PantryItemEntity
import com.familyos.core.database.WardrobeItemEntity
import com.familyos.core.database.OutfitPlanEntity
import kotlinx.coroutines.flow.Flow

interface HouseholdRepository {
    // Pantry & Fridge Inventory (HSE-04)
    fun observePantryItems(familyId: String): Flow<List<PantryItemEntity>>
    fun observeLowStockItems(familyId: String): Flow<List<PantryItemEntity>>
    fun observeExpiringItems(familyId: String, cutoffTime: Long): Flow<List<PantryItemEntity>>
    suspend fun addPantryItem(item: PantryItemEntity)
    suspend fun consumePantryItem(id: String, amount: Double)
    suspend fun deletePantryItem(id: String)

    // Wardrobe & Outfits (HSE-07)
    fun observeWardrobeItems(familyId: String, memberId: String? = null): Flow<List<WardrobeItemEntity>>
    suspend fun addWardrobeItem(item: WardrobeItemEntity)
    suspend fun toggleWardrobeCleanStatus(id: String, isClean: Boolean)
    fun observeOutfitPlans(familyId: String, memberId: String? = null): Flow<List<OutfitPlanEntity>>
    suspend fun saveOutfitPlan(plan: OutfitPlanEntity)
}
