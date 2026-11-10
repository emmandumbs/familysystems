package com.familyos.core.security

import com.familyos.core.domain.*

/**
 * Core Role-Based Access Control (RBAC) and Security Policy for FamilyOS.
 * Enforces role boundaries, child safety, task assignment rules, and health record privacy.
 */
object FamilySecurityPolicy {

    enum class SecurityOperation {
        READ,
        CREATE,
        UPDATE,
        DELETE,
        EXPORT,
        BACKGROUND_SYNC
    }

    /**
     * Determines whether a member can access financial records and ledger.
     */
    fun canAccessFinancialLedger(role: FamilyRole): Boolean {
        return role == FamilyRole.OWNER || role == FamilyRole.ADMIN
    }

    /**
     * Checks authorization for financial operations.
     */
    fun isFinancialOperationAuthorized(
        role: FamilyRole,
        operation: SecurityOperation,
        hasAccount: Boolean
    ): Boolean {
        if (!hasAccount) return false
        val isPrivileged = role == FamilyRole.OWNER || role == FamilyRole.ADMIN
        return isPrivileged
    }

    /**
     * Checks whether an actor can access medical or health records for a child.
     */
    fun canAccessChildMedicalRecords(
        actorRole: FamilyRole,
        actorMemberId: String,
        childMemberId: String,
        isGuardian: Boolean
    ): Boolean {
        if (actorMemberId == childMemberId) return true
        if (actorRole == FamilyRole.OWNER || actorRole == FamilyRole.ADMIN) return true
        return isGuardian
    }

    /**
     * Checks authorization for sensitive data operations.
     */
    fun isSensitiveDataOperationAuthorized(
        actorRole: FamilyRole,
        actorMemberId: String,
        targetMemberId: String,
        isGuardian: Boolean,
        operation: SecurityOperation,
        hasAccount: Boolean
    ): Boolean {
        if (!hasAccount) return false
        if (actorRole == FamilyRole.GUEST) return false
        if (actorMemberId == targetMemberId) {
            return operation != SecurityOperation.DELETE
        }
        if (actorRole == FamilyRole.OWNER || actorRole == FamilyRole.ADMIN) return true
        return isGuardian
    }

    /**
     * Determines whether a caller can assign or reassign a task to another member.
     */
    fun canAssignTaskToMember(
        actorRole: FamilyRole,
        actorMemberId: String,
        targetMemberId: String
    ): Boolean {
        if (actorRole == FamilyRole.GUEST) return false
        if (actorRole == FamilyRole.OWNER || actorRole == FamilyRole.ADMIN) return true
        return actorMemberId == targetMemberId
    }

    /**
     * Overloaded task assignment check including restricted child status.
     */
    fun canAssignTaskToMember(
        actorRole: FamilyRole,
        actorMemberId: String,
        isRestrictedChild: Boolean,
        targetAssigneeMemberId: String?
    ): Boolean {
        if (actorRole == FamilyRole.GUEST) return false
        if (isRestrictedChild) {
            return targetAssigneeMemberId == null || targetAssigneeMemberId == actorMemberId
        }
        return true
    }

    /**
     * Determines whether a member can manage (create, edit, archive) family member profiles.
     */
    fun canManageFamilyMembers(role: FamilyRole): Boolean {
        return role == FamilyRole.OWNER || role == FamilyRole.ADMIN
    }

    /**
     * Enforces role assignment permission checks.
     */
    fun canAssignRole(
        actorRole: FamilyRole,
        actorMemberId: String,
        targetMemberId: String,
        proposedRole: FamilyRole
    ): Boolean {
        if (actorRole != FamilyRole.OWNER && actorRole != FamilyRole.ADMIN) return false
        if (proposedRole == FamilyRole.OWNER && actorRole != FamilyRole.OWNER) return false
        if (actorMemberId == targetMemberId && actorRole != FamilyRole.OWNER && proposedRole == FamilyRole.OWNER) return false
        return true
    }

    /**
     * Enforces one-family active membership rule.
     */
    fun canJoinOrCreateActiveFamily(existingActiveFamilyIds: List<String>, targetFamilyId: String): Boolean {
        return existingActiveFamilyIds.isEmpty() || existingActiveFamilyIds.all { it == targetFamilyId }
    }

    /**
     * Personal note privacy check.
     */
    fun canViewPersonalProfileNotes(
        actorMemberId: String,
        targetMemberId: String,
        isTargetRestrictedMinor: Boolean,
        isVerifiedGuardian: Boolean
    ): Boolean {
        if (actorMemberId == targetMemberId) return true
        if (isTargetRestrictedMinor && isVerifiedGuardian) return true
        return false
    }

    fun isMembershipActive(membershipStatus: String): Boolean {
        return membershipStatus == "ACTIVE"
    }

    fun canManageMinorProfile(
        actorRole: FamilyRole,
        actorMemberId: String,
        targetMemberId: String,
        isGuardian: Boolean
    ): Boolean {
        if (actorMemberId == targetMemberId) return true
        if (actorRole == FamilyRole.OWNER || actorRole == FamilyRole.ADMIN) return true
        return isGuardian
    }

    fun isRestrictedAccess(isRestrictedProfile: Boolean, role: FamilyRole): Boolean {
        if (isRestrictedProfile) return true
        return role == FamilyRole.GUEST
    }

    fun canManageGoalsAndProjects(role: FamilyRole): Boolean {
        return role == FamilyRole.OWNER || role == FamilyRole.ADMIN
    }

    fun canCompleteTask(
        actorRole: FamilyRole,
        actorMemberId: String,
        assignedMemberId: String?
    ): Boolean {
        if (actorRole == FamilyRole.OWNER || actorRole == FamilyRole.ADMIN) return true
        if (assignedMemberId != null && assignedMemberId == actorMemberId) return true
        return assignedMemberId == null
    }

    fun canCompleteChore(
        actorMemberId: String,
        assignedMemberId: String?
    ): Boolean {
        return assignedMemberId == null || assignedMemberId == actorMemberId
    }

    fun isWorkspaceAuthorized(callerFamilyId: String, resourceFamilyId: String): Boolean {
        return callerFamilyId.isNotBlank() && callerFamilyId == resourceFamilyId
    }

    fun canViewGoal(
        actorRole: FamilyRole,
        actorMemberId: String,
        isCoupleAdult: Boolean,
        goal: FamilyGoal
    ): Boolean {
        return when (goal.scope) {
            GoalScope.PERSONAL -> goal.ownerMemberId == actorMemberId
            GoalScope.COUPLE -> actorRole != FamilyRole.GUEST && (actorRole == FamilyRole.OWNER || actorRole == FamilyRole.ADMIN || isCoupleAdult)
            GoalScope.FAMILY -> true
        }
    }

    fun canViewTask(
        actorRole: FamilyRole,
        actorMemberId: String,
        isCoupleAdult: Boolean,
        task: Task
    ): Boolean {
        if (task.scope.equals("PERSONAL", ignoreCase = true)) {
            return task.creatorMemberId == actorMemberId || task.assignedMemberId == actorMemberId
        }
        if (task.sourceModule == CanonicalTaskSourceModule.MARRIAGE) {
            return actorRole != FamilyRole.GUEST && (actorRole == FamilyRole.OWNER || actorRole == FamilyRole.ADMIN || isCoupleAdult)
        }
        return true
    }

    fun canViewPersonalInfo(
        actorRole: FamilyRole,
        actorMemberId: String,
        targetMemberId: String
    ): Boolean {
        if (actorRole == FamilyRole.GUEST) return actorMemberId == targetMemberId
        if (actorRole == FamilyRole.OWNER || actorRole == FamilyRole.ADMIN) return true
        return actorMemberId == targetMemberId || actorRole == FamilyRole.MEMBER
    }

    fun canEditMemberProfile(
        actorRole: FamilyRole,
        actorMemberId: String,
        targetMemberId: String
    ): Boolean {
        if (actorRole == FamilyRole.GUEST) return false
        if (actorRole == FamilyRole.OWNER || actorRole == FamilyRole.ADMIN) return true
        return actorMemberId == targetMemberId
    }

    fun canConfigureRewards(actorRole: FamilyRole): Boolean {
        return actorRole == FamilyRole.OWNER || actorRole == FamilyRole.ADMIN
    }
}
