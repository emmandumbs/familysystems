package com.familyos.core.domain

/**
 * Pure Kotlin Domain Models
 * Completely decoupled from Android framework and Room annotations.
 */

enum class AuthProvider {
    FIREBASE_GOOGLE,
    FIREBASE_EMAIL,
    LOCAL_DEVICE_MEMBER
}

enum class FamilyRole {
    OWNER,
    ADMIN,
    MEMBER,
    GUEST
}

enum class AccountStatus {
    ACTIVE,
    SUSPENDED,
    PENDING_DELETION
}

data class UserAccount(
    val id: String,
    val authenticationProvider: AuthProvider,
    val providerUserId: String,
    val email: String,
    val displayName: String?,
    val profilePictureUri: String?,
    val preferredLanguage: String,
    val accountStatus: AccountStatus,
    val createdAt: Long,
    val updatedAt: Long,
    val isEmailVerified: Boolean = true
)

data class FamilyWorkspace(
    val id: String,
    val name: String,
    val description: String?,
    val logoUrl: String?,
    val currencyCode: String,
    val ownerUserId: String,
    val isDeleted: Boolean,
    val motto: String = "Stewardship, Kindness, and Calm Preparedness in Every Season.",
    val mission: String = "To cultivate a warm, resilient, and well-ordered home where every generation thrives.",
    val vision: String = "A multi-generational household operating with clarity, shared responsibility, and enduring traditions.",
    val values: List<String> = listOf("Intentional Stewardship", "Generational Connection", "Calm Preparedness"),
    val photoUrl: String? = null
)

data class FamilyMember(
    val id: String,
    val familyId: String,
    val displayName: String,
    val relationshipToPrimary: String,
    val birthDate: Long?,
    val avatarUrl: String?,
    val dietaryPreferences: List<String>,
    val allergies: List<String>,
    val isRestrictedProfile: Boolean,
    val pointsBalance: Int,
    val role: FamilyRole = if (isRestrictedProfile) FamilyRole.GUEST else FamilyRole.MEMBER,
    val membershipStatus: String = "ACTIVE",
    val responsibilities: List<String> = emptyList(),
    val emergencyContactName: String = "Primary Household Guardian",
    val emergencyContactPhone: String = "(555) 123-4567",
    val sharedBio: String = "",
    val personalBioNotes: String? = null,
    val importantDates: List<String> = emptyList(),
    val photoUrl: String? = null
)

data class FamilyMembership(
    val id: String,
    val familyId: String,
    val userAccountId: String,
    val memberProfileId: String,
    val role: FamilyRole,
    val status: String,
    val joinedAt: Long
)

data class GuardianRelationship(
    val id: String,
    val familyId: String,
    val guardianMemberId: String,
    val minorMemberId: String,
    val relationshipType: String,
    val isEmergencyContact: Boolean,
    val canManageHealthRecords: Boolean
)

data class FamilyInvitation(
    val id: String,
    val familyId: String,
    val invitationToken: String,
    val invitedEmail: String,
    val invitedDisplayName: String,
    val targetRole: FamilyRole,
    val status: String,
    val expiresAt: Long,
    val createdAt: Long
)

data class FamilyAnnouncement(
    val id: String,
    val title: String,
    val body: String,
    val authorName: String,
    val priority: String = "NORMAL",
    val pinned: Boolean = false,
    val createdAt: Long = System.currentTimeMillis()
)

data class HouseholdReminder(
    val id: String,
    val title: String,
    val dueLabel: String,
    val category: String = "HOUSEHOLD",
    val isCompleted: Boolean = false
)

data class ApprovedAiSuggestion(
    val id: String,
    val title: String,
    val summary: String,
    val category: String,
    val approvedBy: String
)

data class SyncOperation(
    val operationId: String,
    val idempotencyKey: String,
    val familyId: String,
    val entityType: String,
    val entityId: String,
    val operationType: String,
    val payloadJson: String
)
