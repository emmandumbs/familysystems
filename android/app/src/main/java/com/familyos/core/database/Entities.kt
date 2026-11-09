package com.familyos.core.database

import androidx.room.*

/**
 * 1. LocalUserProfileEntity
 * Local representation of authenticated account profile.
 * Stores NO passwords or password hashes.
 */
@Entity(
    tableName = "user_profiles",
    indices = [Index(value = ["provider_user_id"], unique = true), Index(value = ["email"])]
)
data class LocalUserProfileEntity(
    @PrimaryKey
    val id: String, // Internal UUID
    @ColumnInfo(name = "authentication_provider")
    val authenticationProvider: String, // "FIREBASE_GOOGLE", "FIREBASE_EMAIL"
    @ColumnInfo(name = "provider_user_id")
    val providerUserId: String, // Stable Auth UID from Identity Provider
    val email: String,
    @ColumnInfo(name = "display_name")
    val displayName: String?,
    @ColumnInfo(name = "profile_picture_uri")
    val profilePictureUri: String?,
    @ColumnInfo(name = "preferred_language")
    val preferredLanguage: String = "en",
    @ColumnInfo(name = "account_status")
    val accountStatus: String = "ACTIVE",
    @ColumnInfo(name = "created_at")
    val createdAt: Long = System.currentTimeMillis(),
    @ColumnInfo(name = "updated_at")
    val updatedAt: Long = System.currentTimeMillis()
)

/**
 * 2. FamilyWorkspaceEntity
 * Household workspace boundary container.
 */
@Entity(
    tableName = "family_workspaces",
    indices = [Index(value = ["owner_user_id"], unique = true)]
)
data class FamilyWorkspaceEntity(
    @PrimaryKey
    val id: String, // UUID
    val name: String,
    val description: String? = null,
    @ColumnInfo(name = "logo_url")
    val logoUrl: String? = null,
    @ColumnInfo(name = "currency_code")
    val currencyCode: String = "USD",
    @ColumnInfo(name = "owner_user_id")
    val ownerUserId: String,
    val version: Long = 1L,
    @ColumnInfo(name = "sync_status")
    val syncStatus: String = "LOCAL_ONLY", // "LOCAL_ONLY", "PENDING_SYNC", "SYNCED", "SYNC_FAILED"
    @ColumnInfo(name = "is_deleted")
    val isDeleted: Boolean = false,
    @ColumnInfo(name = "created_at")
    val createdAt: Long = System.currentTimeMillis(),
    @ColumnInfo(name = "updated_at")
    val updatedAt: Long = System.currentTimeMillis()
)

/**
 * 3. FamilyMembershipEntity
 * Connects an authenticated user account to their single canonical family workspace with a verified role.
 */
@Entity(
    tableName = "family_memberships",
    foreignKeys = [
        ForeignKey(
            entity = FamilyWorkspaceEntity::class,
            parentColumns = ["id"],
            childColumns = ["family_id"],
            onDelete = ForeignKey.CASCADE
        ),
        ForeignKey(
            entity = LocalUserProfileEntity::class,
            parentColumns = ["id"],
            childColumns = ["user_account_id"],
            onDelete = ForeignKey.CASCADE
        )
    ],
    indices = [
        Index(value = ["family_id", "user_account_id"], unique = true),
        Index(value = ["user_account_id", "status"])
    ]
)
data class FamilyMembershipEntity(
    @PrimaryKey
    val id: String, // UUID
    @ColumnInfo(name = "family_id")
    val familyId: String,
    @ColumnInfo(name = "user_account_id")
    val userAccountId: String,
    @ColumnInfo(name = "member_profile_id")
    val memberProfileId: String, // Link to FamilyMember profile
    val role: String = "MEMBER", // "OWNER", "ADMIN", "MEMBER", "GUEST"
    val status: String = "ACTIVE", // "ACTIVE", "INVITED", "REVOKED"
    @ColumnInfo(name = "joined_at")
    val joinedAt: Long = System.currentTimeMillis()
)

/**
 * 4. FamilyMemberEntity
 * Human profile in the household.
 * Can exist completely independently of an account (children/dependents).
 */
@Entity(
    tableName = "family_members",
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
data class FamilyMemberEntity(
    @PrimaryKey
    val id: String, // UUID
    @ColumnInfo(name = "family_id")
    val familyId: String,
    @ColumnInfo(name = "display_name")
    val displayName: String,
    @ColumnInfo(name = "relationship_to_primary")
    val relationshipToPrimary: String = "MEMBER", // "SELF", "SPOUSE", "CHILD", "PARENT", "OTHER"
    @ColumnInfo(name = "birth_date")
    val birthDate: Long? = null,
    @ColumnInfo(name = "avatar_url")
    val avatarUrl: String? = null,
    @ColumnInfo(name = "dietary_preferences_json")
    val dietaryPreferencesJson: String = "[]",
    @ColumnInfo(name = "allergies_json")
    val allergiesJson: String = "[]",
    @ColumnInfo(name = "is_restricted_profile")
    val isRestrictedProfile: Boolean = false,
    @ColumnInfo(name = "points_balance")
    val pointsBalance: Int = 0,
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

/**
 * 5. FamilyInvitationEntity
 * Secure invitation token for onboarding members.
 */
@Entity(
    tableName = "family_invitations",
    foreignKeys = [
        ForeignKey(
            entity = FamilyWorkspaceEntity::class,
            parentColumns = ["id"],
            childColumns = ["family_id"],
            onDelete = ForeignKey.CASCADE
        )
    ],
    indices = [
        Index(value = ["invitation_token"], unique = true),
        Index(value = ["family_id"])
    ]
)
data class FamilyInvitationEntity(
    @PrimaryKey
    val id: String, // UUID
    @ColumnInfo(name = "family_id")
    val familyId: String,
    @ColumnInfo(name = "invitation_token")
    val invitationToken: String,
    @ColumnInfo(name = "invited_email")
    val invitedEmail: String,
    @ColumnInfo(name = "target_role")
    val targetRole: String = "MEMBER",
    @ColumnInfo(name = "assigned_member_profile_id")
    val assignedMemberProfileId: String? = null,
    val status: String = "PENDING", // "PENDING", "ACCEPTED", "EXPIRED", "REVOKED"
    @ColumnInfo(name = "expires_at")
    val expiresAt: Long,
    @ColumnInfo(name = "created_at")
    val createdAt: Long = System.currentTimeMillis()
)

/**
 * 6. GuardianRelationshipEntity
 * Explicit legal/guardian stewardship mapping adults to minor profiles.
 */
@Entity(
    tableName = "guardian_relationships",
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
            childColumns = ["guardian_member_id"],
            onDelete = ForeignKey.CASCADE
        ),
        ForeignKey(
            entity = FamilyMemberEntity::class,
            parentColumns = ["id"],
            childColumns = ["minor_member_id"],
            onDelete = ForeignKey.CASCADE
        )
    ],
    indices = [
        Index(value = ["family_id", "guardian_member_id", "minor_member_id"], unique = true),
        Index(value = ["guardian_member_id"]),
        Index(value = ["minor_member_id"])
    ]
)
data class GuardianRelationshipEntity(
    @PrimaryKey
    val id: String, // UUID
    @ColumnInfo(name = "family_id")
    val familyId: String,
    @ColumnInfo(name = "guardian_member_id")
    val guardianMemberId: String,
    @ColumnInfo(name = "minor_member_id")
    val minorMemberId: String,
    @ColumnInfo(name = "relationship_type")
    val relationshipType: String = "PARENT", // "PARENT", "LEGAL_GUARDIAN"
    @ColumnInfo(name = "is_emergency_contact")
    val isEmergencyContact: Boolean = true,
    @ColumnInfo(name = "can_manage_health_records")
    val canManageHealthRecords: Boolean = true,
    @ColumnInfo(name = "created_at")
    val createdAt: Long = System.currentTimeMillis()
)

/**
 * 7. SyncQueueEntity
 * Controlled offline queue with idempotency keys and retry counts.
 */
@Entity(
    tableName = "sync_queue",
    indices = [
        Index(value = ["idempotency_key"], unique = true),
        Index(value = ["entity_type", "entity_id"])
    ]
)
data class SyncQueueEntity(
    @PrimaryKey(autoGenerate = true)
    @ColumnInfo(name = "queue_id")
    val queueId: Long = 0L,
    @ColumnInfo(name = "operation_id")
    val operationId: String, // UUID
    @ColumnInfo(name = "idempotency_key")
    val idempotencyKey: String, // Stable deduplication key
    @ColumnInfo(name = "family_id")
    val familyId: String,
    @ColumnInfo(name = "entity_type")
    val entityType: String, // e.g. "FAMILY_MEMBER", "TASK", "EXPENSE"
    @ColumnInfo(name = "entity_id")
    val entityId: String,
    @ColumnInfo(name = "operation_type")
    val operationType: String, // "INSERT", "UPDATE", "DELETE"
    @ColumnInfo(name = "payload_json")
    val payloadJson: String,
    @ColumnInfo(name = "attempt_count")
    val attemptCount: Int = 0,
    @ColumnInfo(name = "last_attempt_at")
    val lastAttemptAt: Long? = null,
    @ColumnInfo(name = "retry_state")
    val retryState: String = "PENDING", // "PENDING", "PROCESSING", "FAILED"
    @ColumnInfo(name = "last_error")
    val lastError: String? = null,
    @ColumnInfo(name = "created_at")
    val createdAt: Long = System.currentTimeMillis()
)

/**
 * 8. AuditEventEntity
 * Immutable audit log for sensitive family actions.
 */
@Entity(
    tableName = "audit_events",
    foreignKeys = [
        ForeignKey(
            entity = FamilyWorkspaceEntity::class,
            parentColumns = ["id"],
            childColumns = ["family_id"],
            onDelete = ForeignKey.CASCADE
        )
    ],
    indices = [Index(value = ["family_id", "created_at"])]
)
data class AuditEventEntity(
    @PrimaryKey
    val id: String, // UUID
    @ColumnInfo(name = "family_id")
    val familyId: String,
    @ColumnInfo(name = "actor_user_id")
    val actorUserId: String,
    @ColumnInfo(name = "action_type")
    val actionType: String, // e.g. "MEMBER_ROLE_CHANGED", "EXPENSE_REVERSED"
    @ColumnInfo(name = "entity_type")
    val entityType: String,
    @ColumnInfo(name = "entity_id")
    val entityId: String,
    val summary: String,
    @ColumnInfo(name = "metadata_json")
    val metadataJson: String? = null,
    @ColumnInfo(name = "created_at")
    val createdAt: Long = System.currentTimeMillis()
)
