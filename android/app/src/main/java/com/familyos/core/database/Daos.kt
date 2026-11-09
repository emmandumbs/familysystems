package com.familyos.core.database

import androidx.room.*
import kotlinx.coroutines.flow.Flow

@Dao
interface UserProfileDao {
    @Query("SELECT * FROM user_profiles WHERE id = :userId LIMIT 1")
    suspend fun getUserProfileById(userId: String): LocalUserProfileEntity?

    @Query("SELECT * FROM user_profiles WHERE provider_user_id = :providerUserId LIMIT 1")
    fun observeUserProfile(providerUserId: String): Flow<LocalUserProfileEntity?>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertOrUpdateUserProfile(profile: LocalUserProfileEntity)

    @Query("DELETE FROM user_profiles WHERE id = :userId")
    suspend fun deleteUserProfile(userId: String)
}

@Dao
interface FamilyWorkspaceDao {
    @Query("SELECT * FROM family_workspaces WHERE is_deleted = 0 ORDER BY created_at ASC")
    fun observeAllWorkspaces(): Flow<List<FamilyWorkspaceEntity>>

    @Query("SELECT * FROM family_workspaces WHERE id = :workspaceId AND is_deleted = 0 LIMIT 1")
    fun observeWorkspaceById(workspaceId: String): Flow<FamilyWorkspaceEntity?>

    @Query("SELECT * FROM family_workspaces WHERE id = :workspaceId LIMIT 1")
    suspend fun getWorkspaceById(workspaceId: String): FamilyWorkspaceEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertOrUpdateWorkspace(workspace: FamilyWorkspaceEntity)

    @Query("UPDATE family_workspaces SET is_deleted = 1, updated_at = :timestamp WHERE id = :workspaceId")
    suspend fun softDeleteWorkspace(workspaceId: String, timestamp: Long = System.currentTimeMillis())

    // Transaction for creating workspace with initial owner membership
    @Transaction
    suspend fun createWorkspaceWithOwner(
        workspace: FamilyWorkspaceEntity,
        ownerProfile: FamilyMemberEntity,
        membership: FamilyMembershipEntity
    ) {
        insertOrUpdateWorkspace(workspace)
        insertMemberInternal(ownerProfile)
        insertMembershipInternal(membership)
    }

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertMemberInternal(member: FamilyMemberEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertMembershipInternal(membership: FamilyMembershipEntity)
}

@Dao
interface FamilyMemberDao {
    @Query("SELECT * FROM family_members WHERE family_id = :familyId AND is_deleted = 0 ORDER BY display_name ASC")
    fun observeMembersByFamily(familyId: String): Flow<List<FamilyMemberEntity>>

    @Query("SELECT * FROM family_members WHERE id = :memberId AND is_deleted = 0 LIMIT 1")
    suspend fun getMemberById(memberId: String): FamilyMemberEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertOrUpdateMember(member: FamilyMemberEntity)

    @Query("UPDATE family_members SET is_deleted = 1, updated_at = :timestamp WHERE id = :memberId")
    suspend fun softDeleteMember(memberId: String, timestamp: Long = System.currentTimeMillis())

    @Query("SELECT * FROM family_memberships WHERE family_id = :familyId")
    fun observeMembershipsByFamily(familyId: String): Flow<List<FamilyMembershipEntity>>
}

@Dao
interface GuardianRelationshipDao {
    @Query("SELECT * FROM guardian_relationships WHERE family_id = :familyId")
    fun observeGuardiansByFamily(familyId: String): Flow<List<GuardianRelationshipEntity>>

    @Query("SELECT * FROM guardian_relationships WHERE minor_member_id = :minorId")
    suspend fun getGuardiansForMinor(minorId: String): List<GuardianRelationshipEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertOrUpdateRelationship(relationship: GuardianRelationshipEntity)
}

@Dao
interface SyncQueueDao {
    @Query("SELECT * FROM sync_queue WHERE retry_state != 'SUCCESS' ORDER BY created_at ASC LIMIT :batchSize")
    suspend fun getPendingOperations(batchSize: Int = 50): List<SyncQueueEntity>

    @Insert(onConflict = OnConflictStrategy.IGNORE)
    suspend fun enqueueOperation(operation: SyncQueueEntity): Long

    @Query("UPDATE sync_queue SET attempt_count = attempt_count + 1, last_attempt_at = :timestamp, retry_state = :state, last_error = :error WHERE queue_id = :queueId")
    suspend fun updateOperationAttempt(queueId: Long, state: String, error: String?, timestamp: Long = System.currentTimeMillis())

    @Query("DELETE FROM sync_queue WHERE queue_id = :queueId")
    suspend fun dequeueOperation(queueId: Long)

    @Query("SELECT COUNT(*) FROM sync_queue WHERE retry_state != 'SUCCESS'")
    fun observePendingCount(): Flow<Int>
}

@Dao
interface AuditEventDao {
    @Query("SELECT * FROM audit_events WHERE family_id = :familyId ORDER BY created_at DESC LIMIT 100")
    fun observeRecentAudits(familyId: String): Flow<List<AuditEventEntity>>

    @Insert
    suspend fun logEvent(event: AuditEventEntity)
}
