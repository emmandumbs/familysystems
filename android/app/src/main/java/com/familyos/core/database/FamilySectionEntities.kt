package com.familyos.core.database

import androidx.room.*
import kotlinx.coroutines.flow.Flow

/**
 * Family Section & Extended Heritage Map Room Entities (Database v7)
 * Provides Android offline-first persistence parity with Web / Backend Family Section modules.
 */

@Entity(
    tableName = "family_gallery_albums",
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
data class FamilyGalleryAlbumEntity(
    @PrimaryKey
    val id: String,
    @ColumnInfo(name = "family_id")
    val familyId: String,
    val title: String,
    val description: String? = null,
    val category: String = "Family Memories",
    @ColumnInfo(name = "cover_photo_url")
    val coverPhotoUrl: String? = null,
    @ColumnInfo(name = "created_by_user_id")
    val createdByUserId: String,
    val version: Long = 1L,
    @ColumnInfo(name = "is_deleted")
    val isDeleted: Boolean = false,
    @ColumnInfo(name = "created_at")
    val createdAt: Long = System.currentTimeMillis(),
    @ColumnInfo(name = "updated_at")
    val updatedAt: Long = System.currentTimeMillis()
)

@Entity(
    tableName = "family_gallery_photos",
    foreignKeys = [
        ForeignKey(
            entity = FamilyWorkspaceEntity::class,
            parentColumns = ["id"],
            childColumns = ["family_id"],
            onDelete = ForeignKey.CASCADE
        )
    ],
    indices = [Index(value = ["family_id"]), Index(value = ["album_id"])]
)
data class FamilyGalleryPhotoEntity(
    @PrimaryKey
    val id: String,
    @ColumnInfo(name = "family_id")
    val familyId: String,
    @ColumnInfo(name = "album_id")
    val albumId: String? = null,
    val title: String,
    val caption: String? = null,
    @ColumnInfo(name = "image_url")
    val imageUrl: String,
    val visibility: String = "FAMILY", // "FAMILY", "PARENTS_ONLY", "PRIVATE"
    @ColumnInfo(name = "uploaded_by_user_id")
    val uploadedByUserId: String,
    @ColumnInfo(name = "uploaded_by_member_id")
    val uploadedByMemberId: String? = null,
    val version: Long = 1L,
    @ColumnInfo(name = "is_deleted")
    val isDeleted: Boolean = false,
    @ColumnInfo(name = "created_at")
    val createdAt: Long = System.currentTimeMillis(),
    @ColumnInfo(name = "updated_at")
    val updatedAt: Long = System.currentTimeMillis()
)

@Entity(
    tableName = "family_constitution_versions",
    foreignKeys = [
        ForeignKey(
            entity = FamilyWorkspaceEntity::class,
            parentColumns = ["id"],
            childColumns = ["family_id"],
            onDelete = ForeignKey.CASCADE
        )
    ],
    indices = [Index(value = ["family_id", "version_number"], unique = true)]
)
data class FamilyConstitutionVersionEntity(
    @PrimaryKey
    val id: String,
    @ColumnInfo(name = "family_id")
    val familyId: String,
    @ColumnInfo(name = "version_number")
    val versionNumber: Int,
    val motto: String = "",
    @ColumnInfo(name = "mission_statement")
    val missionStatement: String = "",
    @ColumnInfo(name = "vision_statement")
    val visionStatement: String = "",
    @ColumnInfo(name = "core_values_json")
    val coreValuesJson: String = "[]",
    @ColumnInfo(name = "acknowledgments_json")
    val acknowledgmentsJson: String = "[]",
    @ColumnInfo(name = "edited_by_user_id")
    val editedByUserId: String,
    @ColumnInfo(name = "created_at")
    val createdAt: Long = System.currentTimeMillis(),
    @ColumnInfo(name = "updated_at")
    val updatedAt: Long = System.currentTimeMillis()
)

@Entity(
    tableName = "family_traditions",
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
data class FamilyTraditionEntity(
    @PrimaryKey
    val id: String,
    @ColumnInfo(name = "family_id")
    val familyId: String,
    val title: String,
    val category: String = "Annual",
    val cadence: String = "Annual",
    @ColumnInfo(name = "next_occurrence_date")
    val nextOccurrenceDate: String? = null,
    @ColumnInfo(name = "origin_story")
    val originStory: String? = null,
    @ColumnInfo(name = "linked_recipe_id")
    val linkedRecipeId: String? = null,
    val version: Long = 1L,
    @ColumnInfo(name = "is_deleted")
    val isDeleted: Boolean = false,
    @ColumnInfo(name = "created_at")
    val createdAt: Long = System.currentTimeMillis(),
    @ColumnInfo(name = "updated_at")
    val updatedAt: Long = System.currentTimeMillis()
)

@Entity(
    tableName = "family_shared_activities",
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
data class FamilySharedActivityEntity(
    @PrimaryKey
    val id: String,
    @ColumnInfo(name = "family_id")
    val familyId: String,
    val title: String,
    val category: String = "Outing",
    @ColumnInfo(name = "date_iso")
    val dateIso: String,
    val location: String? = null,
    @ColumnInfo(name = "budget_cents")
    val budgetCents: Long = 0L,
    val status: String = "PLANNED",
    @ColumnInfo(name = "linked_calendar_event_id")
    val linkedCalendarEventId: String? = null,
    val version: Long = 1L,
    @ColumnInfo(name = "is_deleted")
    val isDeleted: Boolean = false,
    @ColumnInfo(name = "created_at")
    val createdAt: Long = System.currentTimeMillis(),
    @ColumnInfo(name = "updated_at")
    val updatedAt: Long = System.currentTimeMillis()
)

@Entity(
    tableName = "family_rules",
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
data class FamilyRuleEntity(
    @PrimaryKey
    val id: String,
    @ColumnInfo(name = "family_id")
    val familyId: String,
    val title: String,
    val category: String = "General",
    val description: String = "",
    @ColumnInfo(name = "applies_to_role")
    val appliesToRole: String = "ALL",
    val version: Long = 1L,
    @ColumnInfo(name = "is_deleted")
    val isDeleted: Boolean = false,
    @ColumnInfo(name = "created_at")
    val createdAt: Long = System.currentTimeMillis(),
    @ColumnInfo(name = "updated_at")
    val updatedAt: Long = System.currentTimeMillis()
)

@Entity(
    tableName = "family_extended_relatives",
    foreignKeys = [
        ForeignKey(
            entity = FamilyWorkspaceEntity::class,
            parentColumns = ["id"],
            childColumns = ["family_id"],
            onDelete = ForeignKey.CASCADE
        )
    ],
    indices = [Index(value = ["family_id"]), Index(value = ["lineage_side"])]
)
data class FamilyExtendedRelativeEntity(
    @PrimaryKey
    val id: String,
    @ColumnInfo(name = "family_id")
    val familyId: String,
    @ColumnInfo(name = "full_name")
    val fullName: String,
    @ColumnInfo(name = "relationship_label")
    val relationshipLabel: String,
    @ColumnInfo(name = "lineage_side")
    val lineageSide: String, // "PATERNAL", "MATERNAL", "SHARED"
    val generation: String = "PARENTS_SIBLINGS",
    @ColumnInfo(name = "birth_year")
    val birthYear: Int? = null,
    val occupation: String? = null,
    val city: String? = null,
    val country: String? = null,
    @ColumnInfo(name = "avatar_url")
    val avatarUrl: String? = null,
    @ColumnInfo(name = "growth_areas_json")
    val growthAreasJson: String = "[]",
    @ColumnInfo(name = "encouragement_notes_json")
    val encouragementNotesJson: String = "[]",
    val version: Long = 1L,
    @ColumnInfo(name = "is_deleted")
    val isDeleted: Boolean = false,
    @ColumnInfo(name = "created_at")
    val createdAt: Long = System.currentTimeMillis(),
    @ColumnInfo(name = "updated_at")
    val updatedAt: Long = System.currentTimeMillis()
)

@Dao
interface FamilySectionDao {
    @Query("SELECT * FROM family_gallery_albums WHERE family_id = :familyId AND is_deleted = 0 ORDER BY updated_at DESC")
    fun observeAlbums(familyId: String): Flow<List<FamilyGalleryAlbumEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertAlbum(album: FamilyGalleryAlbumEntity)

    @Query("SELECT * FROM family_gallery_photos WHERE family_id = :familyId AND is_deleted = 0 ORDER BY created_at DESC")
    fun observePhotos(familyId: String): Flow<List<FamilyGalleryPhotoEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertPhoto(photo: FamilyGalleryPhotoEntity)

    @Query("SELECT * FROM family_constitution_versions WHERE family_id = :familyId ORDER BY version_number DESC")
    fun observeConstitutionVersions(familyId: String): Flow<List<FamilyConstitutionVersionEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertConstitutionVersion(version: FamilyConstitutionVersionEntity)

    @Query("SELECT * FROM family_traditions WHERE family_id = :familyId AND is_deleted = 0 ORDER BY updated_at DESC")
    fun observeTraditions(familyId: String): Flow<List<FamilyTraditionEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertTradition(tradition: FamilyTraditionEntity)

    @Query("SELECT * FROM family_shared_activities WHERE family_id = :familyId AND is_deleted = 0 ORDER BY date_iso ASC")
    fun observeSharedActivities(familyId: String): Flow<List<FamilySharedActivityEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertSharedActivity(activity: FamilySharedActivityEntity)

    @Query("SELECT * FROM family_rules WHERE family_id = :familyId AND is_deleted = 0 ORDER BY updated_at DESC")
    fun observeRules(familyId: String): Flow<List<FamilyRuleEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertRule(rule: FamilyRuleEntity)

    @Query("SELECT * FROM family_extended_relatives WHERE family_id = :familyId AND is_deleted = 0 ORDER BY birth_year ASC")
    fun observeExtendedRelatives(familyId: String): Flow<List<FamilyExtendedRelativeEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertExtendedRelative(relative: FamilyExtendedRelativeEntity)

    @Query("UPDATE family_gallery_albums SET is_deleted = 1, version = version + 1, updated_at = :updatedAt WHERE id = :id AND family_id = :familyId")
    suspend fun softDeleteAlbum(familyId: String, id: String, updatedAt: Long = System.currentTimeMillis())

    @Query("UPDATE family_gallery_photos SET is_deleted = 1, version = version + 1, updated_at = :updatedAt WHERE id = :id AND family_id = :familyId")
    suspend fun softDeletePhoto(familyId: String, id: String, updatedAt: Long = System.currentTimeMillis())

    @Query("UPDATE family_traditions SET is_deleted = 1, version = version + 1, updated_at = :updatedAt WHERE id = :id AND family_id = :familyId")
    suspend fun softDeleteTradition(familyId: String, id: String, updatedAt: Long = System.currentTimeMillis())

    @Query("UPDATE family_shared_activities SET is_deleted = 1, version = version + 1, updated_at = :updatedAt WHERE id = :id AND family_id = :familyId")
    suspend fun softDeleteSharedActivity(familyId: String, id: String, updatedAt: Long = System.currentTimeMillis())

    @Query("UPDATE family_rules SET is_deleted = 1, version = version + 1, updated_at = :updatedAt WHERE id = :id AND family_id = :familyId")
    suspend fun softDeleteRule(familyId: String, id: String, updatedAt: Long = System.currentTimeMillis())

    @Query("UPDATE family_extended_relatives SET is_deleted = 1, version = version + 1, updated_at = :updatedAt WHERE id = :id AND family_id = :familyId")
    suspend fun softDeleteExtendedRelative(familyId: String, id: String, updatedAt: Long = System.currentTimeMillis())
}

interface FamilySectionRepository {
    fun observeAlbums(familyId: String): Flow<List<FamilyGalleryAlbumEntity>>
    suspend fun saveAlbum(album: FamilyGalleryAlbumEntity)
    suspend fun deleteAlbum(familyId: String, albumId: String)

    fun observePhotos(familyId: String): Flow<List<FamilyGalleryPhotoEntity>>
    suspend fun savePhoto(photo: FamilyGalleryPhotoEntity)
    suspend fun deletePhoto(familyId: String, photoId: String)

    fun observeConstitutionVersions(familyId: String): Flow<List<FamilyConstitutionVersionEntity>>
    suspend fun saveConstitutionVersion(version: FamilyConstitutionVersionEntity)

    fun observeTraditions(familyId: String): Flow<List<FamilyTraditionEntity>>
    suspend fun saveTradition(tradition: FamilyTraditionEntity)
    suspend fun deleteTradition(familyId: String, traditionId: String)

    fun observeSharedActivities(familyId: String): Flow<List<FamilySharedActivityEntity>>
    suspend fun saveSharedActivity(activity: FamilySharedActivityEntity)
    suspend fun deleteSharedActivity(familyId: String, activityId: String)

    fun observeRules(familyId: String): Flow<List<FamilyRuleEntity>>
    suspend fun saveRule(rule: FamilyRuleEntity)
    suspend fun deleteRule(familyId: String, ruleId: String)

    fun observeExtendedRelatives(familyId: String): Flow<List<FamilyExtendedRelativeEntity>>
    suspend fun saveExtendedRelative(relative: FamilyExtendedRelativeEntity)
    suspend fun deleteExtendedRelative(familyId: String, relativeId: String)
}

class FamilySectionRepositoryImpl(
    private val dao: FamilySectionDao
) : FamilySectionRepository {
    override fun observeAlbums(familyId: String): Flow<List<FamilyGalleryAlbumEntity>> =
        dao.observeAlbums(familyId)

    override suspend fun saveAlbum(album: FamilyGalleryAlbumEntity) =
        dao.upsertAlbum(album)

    override suspend fun deleteAlbum(familyId: String, albumId: String) =
        dao.softDeleteAlbum(familyId, albumId)

    override fun observePhotos(familyId: String): Flow<List<FamilyGalleryPhotoEntity>> =
        dao.observePhotos(familyId)

    override suspend fun savePhoto(photo: FamilyGalleryPhotoEntity) =
        dao.upsertPhoto(photo)

    override suspend fun deletePhoto(familyId: String, photoId: String) =
        dao.softDeletePhoto(familyId, photoId)

    override fun observeConstitutionVersions(familyId: String): Flow<List<FamilyConstitutionVersionEntity>> =
        dao.observeConstitutionVersions(familyId)

    override suspend fun saveConstitutionVersion(version: FamilyConstitutionVersionEntity) =
        dao.upsertConstitutionVersion(version)

    override fun observeTraditions(familyId: String): Flow<List<FamilyTraditionEntity>> =
        dao.observeTraditions(familyId)

    override suspend fun saveTradition(tradition: FamilyTraditionEntity) =
        dao.upsertTradition(tradition)

    override suspend fun deleteTradition(familyId: String, traditionId: String) =
        dao.softDeleteTradition(familyId, traditionId)

    override fun observeSharedActivities(familyId: String): Flow<List<FamilySharedActivityEntity>> =
        dao.observeSharedActivities(familyId)

    override suspend fun saveSharedActivity(activity: FamilySharedActivityEntity) =
        dao.upsertSharedActivity(activity)

    override suspend fun deleteSharedActivity(familyId: String, activityId: String) =
        dao.softDeleteSharedActivity(familyId, activityId)

    override fun observeRules(familyId: String): Flow<List<FamilyRuleEntity>> =
        dao.observeRules(familyId)

    override suspend fun saveRule(rule: FamilyRuleEntity) =
        dao.upsertRule(rule)

    override suspend fun deleteRule(familyId: String, ruleId: String) =
        dao.softDeleteRule(familyId, ruleId)

    override fun observeExtendedRelatives(familyId: String): Flow<List<FamilyExtendedRelativeEntity>> =
        dao.observeExtendedRelatives(familyId)

    override suspend fun saveExtendedRelative(relative: FamilyExtendedRelativeEntity) =
        dao.upsertExtendedRelative(relative)

    override suspend fun deleteExtendedRelative(familyId: String, relativeId: String) =
        dao.softDeleteExtendedRelative(familyId, relativeId)
}

