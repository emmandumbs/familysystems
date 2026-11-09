package com.familyos.core.domain

import kotlinx.coroutines.flow.Flow

interface FamilyWorkspaceRepository {
    fun observeWorkspaces(): Flow<List<FamilyWorkspace>>
    fun observeActiveWorkspace(workspaceId: String): Flow<FamilyWorkspace?>
    suspend fun getWorkspace(workspaceId: String): FamilyWorkspace?
    suspend fun createWorkspace(
        name: String,
        currencyCode: String,
        ownerUserId: String,
        ownerDisplayName: String? = null,
        motto: String? = null
    ): Result<FamilyWorkspace>
    suspend fun updateWorkspace(workspaceId: String, name: String, description: String?): Result<Unit>
    suspend fun deleteWorkspace(workspaceId: String): Result<Unit>
}

interface FamilyMemberRepository {
    fun observeMembers(familyId: String): Flow<List<FamilyMember>>
    suspend fun getMember(memberId: String): FamilyMember?
    suspend fun addMember(
        familyId: String,
        displayName: String,
        relationship: String,
        isRestrictedProfile: Boolean
    ): Result<FamilyMember>
    suspend fun updateMember(member: FamilyMember): Result<Unit>
    suspend fun removeMember(memberId: String): Result<Unit>
}

interface AuthRepository {
    fun observeAuthState(): Flow<UserAccount?>
    suspend fun signInWithEmail(email: String, password: String): Result<UserAccount>
    suspend fun registerWithEmail(email: String, password: String): Result<UserAccount>
    suspend fun signInWithGoogle(idToken: String): Result<UserAccount>
    suspend fun signOut(): Result<Unit>
    suspend fun getCurrentUser(): UserAccount?
    suspend fun isEmailVerified(): Boolean
    suspend fun sendEmailVerification(): Result<Unit>
}

interface SyncRepository {
    fun observePendingSyncCount(): Flow<Int>
    suspend fun enqueue(operation: SyncOperation): Result<Unit>
    suspend fun processPendingQueue(): Result<Int>
}
