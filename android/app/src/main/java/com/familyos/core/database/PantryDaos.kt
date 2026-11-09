package com.familyos.core.database

import androidx.room.*
import kotlinx.coroutines.flow.Flow

@Dao
interface PantryDao {
    @Query("SELECT * FROM pantry_items WHERE family_id = :familyId AND is_deleted = 0 ORDER BY item_name ASC")
    fun observeAll(familyId: String): Flow<List<PantryItemEntity>>

    @Query("SELECT * FROM pantry_items WHERE family_id = :familyId AND is_low_stock = 1 AND is_deleted = 0")
    fun observeLowStock(familyId: String): Flow<List<PantryItemEntity>>

    @Query("SELECT * FROM pantry_items WHERE family_id = :familyId AND expiry_date IS NOT NULL AND expiry_date <= :cutoffTime AND is_deleted = 0 ORDER BY expiry_date ASC")
    fun observeExpiring(familyId: String, cutoffTime: Long): Flow<List<PantryItemEntity>>

    @Query("SELECT * FROM pantry_items WHERE id = :id AND is_deleted = 0")
    suspend fun getById(id: String): PantryItemEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(item: PantryItemEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertAll(items: List<PantryItemEntity>)

    @Query("UPDATE pantry_items SET quantity = :newQuantity, is_low_stock = :isLowStock, updated_at = :timestamp WHERE id = :id")
    suspend fun updateQuantity(id: String, newQuantity: Double, isLowStock: Boolean, timestamp: Long = System.currentTimeMillis())

    @Query("UPDATE pantry_items SET is_deleted = 1, updated_at = :timestamp WHERE id = :id")
    suspend fun softDelete(id: String, timestamp: Long = System.currentTimeMillis())
}

@Dao
interface WardrobeDao {
    @Query("SELECT * FROM wardrobe_items WHERE family_id = :familyId AND is_deleted = 0 ORDER BY item_name ASC")
    fun observeAll(familyId: String): Flow<List<WardrobeItemEntity>>

    @Query("SELECT * FROM wardrobe_items WHERE family_id = :familyId AND member_id = :memberId AND is_deleted = 0 ORDER BY category ASC")
    fun observeByMember(familyId: String, memberId: String): Flow<List<WardrobeItemEntity>>

    @Query("SELECT * FROM wardrobe_items WHERE id = :id AND is_deleted = 0")
    suspend fun getById(id: String): WardrobeItemEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(item: WardrobeItemEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertAll(items: List<WardrobeItemEntity>)

    @Query("UPDATE wardrobe_items SET is_clean = :isClean, updated_at = :timestamp WHERE id = :id")
    suspend fun setCleanStatus(id: String, isClean: Boolean, timestamp: Long = System.currentTimeMillis())

    @Query("UPDATE wardrobe_items SET is_deleted = 1, updated_at = :timestamp WHERE id = :id")
    suspend fun softDelete(id: String, timestamp: Long = System.currentTimeMillis())
}

@Dao
interface OutfitDao {
    @Query("SELECT * FROM outfit_plans WHERE family_id = :familyId AND is_deleted = 0 ORDER BY plan_date ASC")
    fun observeAll(familyId: String): Flow<List<OutfitPlanEntity>>

    @Query("SELECT * FROM outfit_plans WHERE family_id = :familyId AND member_id = :memberId AND is_deleted = 0 ORDER BY plan_date ASC")
    fun observeByMember(familyId: String, memberId: String): Flow<List<OutfitPlanEntity>>

    @Query("SELECT * FROM outfit_plans WHERE family_id = :familyId AND plan_date = :planDate AND is_deleted = 0")
    fun observeByDate(familyId: String, planDate: String): Flow<List<OutfitPlanEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(outfit: OutfitPlanEntity)

    @Query("UPDATE outfit_plans SET is_deleted = 1, updated_at = :timestamp WHERE id = :id")
    suspend fun softDelete(id: String, timestamp: Long = System.currentTimeMillis())
}
