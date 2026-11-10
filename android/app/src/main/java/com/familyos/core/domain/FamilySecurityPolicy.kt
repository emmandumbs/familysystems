package com.familyos.core.domain

import com.familyos.core.security.FamilySecurityPolicy as SecurityPolicy

/**
 * Domain-level delegate/alias for FamilySecurityPolicy in com.familyos.core.security.
 */
object FamilySecurityPolicy {

    typealias SecurityOperation = SecurityPolicy.SecurityOperation

    fun canAccessFinancialLedger(role: FamilyRole): Boolean = SecurityPolicy.canAccessFinancialLedger(role)

    fun isFinancialOperationAuthorized(role: FamilyRole, operation: SecurityPolicy.SecurityOperation, hasAccount: Boolean): Boolean =
        SecurityPolicy.isFinancialOperationAuthorized(role, operation, hasAccount)

    fun canAccessChildMedicalRecords(actorRole: FamilyRole, actorMemberId: String, childMemberId: String, isGuardian: Boolean): Boolean =
        SecurityPolicy.canAccessChildMedicalRecords(actorRole, actorMemberId, childMemberId, isGuardian)

    fun canAccessChildMedicalRecords(actorRole: FamilyRole, isGuardian: Boolean): Boolean =
        SecurityPolicy.canAccessChildMedicalRecords(actorRole, isGuardian)

    fun isSensitiveDataOperationAuthorized(
        actorRole: FamilyRole,
        actorMemberId: String,
        targetMemberId: String,
        isGuardian: Boolean,
        operation: SecurityPolicy.SecurityOperation,
        hasAccount: Boolean
    ): Boolean = SecurityPolicy.isSensitiveDataOperationAuthorized(actorRole, actorMemberId, targetMemberId, isGuardian, operation, hasAccount)

    fun canAssignTaskToMember(actorRole: FamilyRole, actorMemberId: String, targetMemberId: String): Boolean =
        SecurityPolicy.canAssignTaskToMember(actorRole, actorMemberId, targetMemberId)

    fun canAssignTaskToMember(actorRole: FamilyRole, actorMemberId: String, isRestrictedChild: Boolean, targetAssigneeMemberId: String?): Boolean =
        SecurityPolicy.canAssignTaskToMember(actorRole, actorMemberId, isRestrictedChild, targetAssigneeMemberId)

    fun canManageFamilyMembers(role: FamilyRole): Boolean = SecurityPolicy.canManageFamilyMembers(role)

    fun canAssignRole(actorRole: FamilyRole, actorMemberId: String, targetMemberId: String, proposedRole: FamilyRole): Boolean =
        SecurityPolicy.canAssignRole(actorRole, actorMemberId, targetMemberId, proposedRole)

    fun canJoinOrCreateActiveFamily(existingActiveFamilyIds: List<String>, targetFamilyId: String): Boolean =
        SecurityPolicy.canJoinOrCreateActiveFamily(existingActiveFamilyIds, targetFamilyId)

    fun canViewPersonalProfileNotes(actorMemberId: String, targetMemberId: String, isTargetRestrictedMinor: Boolean, isVerifiedGuardian: Boolean): Boolean =
        SecurityPolicy.canViewPersonalProfileNotes(actorMemberId, targetMemberId, isTargetRestrictedMinor, isVerifiedGuardian)

    fun isMembershipActive(membershipStatus: String): Boolean = SecurityPolicy.isMembershipActive(membershipStatus)

    fun canManageMinorProfile(actorRole: FamilyRole, actorMemberId: String, targetMemberId: String, isGuardian: Boolean): Boolean =
        SecurityPolicy.canManageMinorProfile(actorRole, actorMemberId, targetMemberId, isGuardian)

    fun isRestrictedAccess(isRestrictedProfile: Boolean, role: FamilyRole): Boolean = SecurityPolicy.isRestrictedAccess(isRestrictedProfile, role)

    fun canManageGoalsAndProjects(role: FamilyRole): Boolean = SecurityPolicy.canManageGoalsAndProjects(role)

    fun canCompleteTask(actorRole: FamilyRole, actorMemberId: String, assignedMemberId: String?): Boolean =
        SecurityPolicy.canCompleteTask(actorRole, actorMemberId, assignedMemberId)

    fun canCompleteChore(actorMemberId: String, assignedMemberId: String?): Boolean = SecurityPolicy.canCompleteChore(actorMemberId, assignedMemberId)

    fun isWorkspaceAuthorized(callerFamilyId: String, resourceFamilyId: String): Boolean = SecurityPolicy.isWorkspaceAuthorized(callerFamilyId, resourceFamilyId)

    fun canViewGoal(actorRole: FamilyRole, actorMemberId: String, isCoupleAdult: Boolean, goal: FamilyGoal): Boolean =
        SecurityPolicy.canViewGoal(actorRole, actorMemberId, isCoupleAdult, goal)

    fun canViewTask(actorRole: FamilyRole, actorMemberId: String, isCoupleAdult: Boolean, task: Task): Boolean =
        SecurityPolicy.canViewTask(actorRole, actorMemberId, isCoupleAdult, task)

    fun canViewPersonalInfo(actorRole: FamilyRole, actorMemberId: String, targetMemberId: String): Boolean =
        SecurityPolicy.canViewPersonalInfo(actorRole, actorMemberId, targetMemberId)

    fun canEditMemberProfile(actorRole: FamilyRole, actorMemberId: String, targetMemberId: String): Boolean =
        SecurityPolicy.canEditMemberProfile(actorRole, actorMemberId, targetMemberId)

    fun canConfigureRewards(actorRole: FamilyRole): Boolean = SecurityPolicy.canConfigureRewards(actorRole)
}
