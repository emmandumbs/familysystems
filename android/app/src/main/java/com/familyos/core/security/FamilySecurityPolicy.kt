package com.familyos.core.security

import com.familyos.core.domain.FamilyRole

/**
 * Client-side role checks used to shape the Android UI. These checks are a convenience
 * only; the server remains the authorization authority for protected operations.
 */
object FamilySecurityPolicy {
    fun canManageFamilyMembers(role: FamilyRole): Boolean =
        role == FamilyRole.OWNER || role == FamilyRole.ADMIN

    fun canAccessFinancialLedger(role: FamilyRole): Boolean =
        role == FamilyRole.OWNER || role == FamilyRole.ADMIN

    /**
     * A MEMBER may only assign work to themselves. OWNER and ADMIN may assign to others;
     * GUEST is read-only. Restricted-child target restrictions are enforced by the
     * overload below when that profile information is available.
     */
    fun canAssignTaskToMember(
        actorRole: FamilyRole,
        actorMemberId: String,
        targetMemberId: String
    ): Boolean = when (actorRole) {
        FamilyRole.OWNER, FamilyRole.ADMIN -> true
        FamilyRole.MEMBER -> actorMemberId.isNotBlank() && actorMemberId == targetMemberId
        FamilyRole.GUEST -> false
    }

    fun canAssignTaskToMember(
        actorRole: FamilyRole,
        actorMemberId: String,
        targetMemberId: String,
        targetIsRestrictedChild: Boolean
    ): Boolean {
        if (actorRole == FamilyRole.GUEST) return false
        if (!targetIsRestrictedChild) return true
        return actorRole == FamilyRole.OWNER || actorRole == FamilyRole.ADMIN || actorMemberId == targetMemberId
    }

    /** Child health records are available to their verified guardian and workspace admins. */
    fun canAccessChildMedicalRecords(
        actorRole: FamilyRole,
        actorMemberId: String,
        childMemberId: String,
        isVerifiedGuardian: Boolean
    ): Boolean {
        if (actorRole == FamilyRole.GUEST) return false
        if (actorMemberId == childMemberId) return false
        return actorRole == FamilyRole.OWNER || actorRole == FamilyRole.ADMIN || isVerifiedGuardian
    }

    fun canAccessChildMedicalRecords(
        actorRole: FamilyRole,
        isVerifiedGuardian: Boolean
    ): Boolean = actorRole != FamilyRole.GUEST &&
        (actorRole == FamilyRole.OWNER || actorRole == FamilyRole.ADMIN || isVerifiedGuardian)
}
