package com.familyos.core.domain

/**
 * Domain-level Role-Based Access Control (RBAC) and Family Guardian Security Policy.
 * Enforces role boundaries, minor child protection, one-family membership rule,
 * and personal record privacy across all repositories and domain services.
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
     * Determines whether the given role can access the household financial ledger,
     * budgets, bank connections, and expense records.
     */
    fun canAccessFinancialLedger(role: FamilyRole): Boolean {
        return role == FamilyRole.OWNER || role == FamilyRole.ADMIN
    }

    /**
     * Granular authorization check for financial operations (Read, Create, Update, Delete, Export, Sync).
     * Enforces:
     * - Only OWNER and ADMIN roles are authorized.
     * - An authenticated account (hasAccount = true) is strictly required; unlinked or placeholder profiles cannot act.
     * - MEMBER and GUEST roles are rejected across all financial operations.
     */
    fun isFinancialOperationAuthorized(
        role: FamilyRole,
        operation: SecurityOperation,
        hasAccount: Boolean
    ): Boolean {
        if (!hasAccount) return false
        val isPrivileged = role == FamilyRole.OWNER || role == FamilyRole.ADMIN
        return when (operation) {
            SecurityOperation.READ,
            SecurityOperation.CREATE,
            SecurityOperation.UPDATE,
            SecurityOperation.DELETE,
            SecurityOperation.EXPORT,
            SecurityOperation.BACKGROUND_SYNC -> isPrivileged
        }
    }

    /**
     * Granular authorization check for sensitive minor and health profile data.
     * Enforces:
     * - Authenticated account requirement.
     * - Guardian authorization for minor wards.
     * - Strict isolation from non-guardian MEMBERs and GUESTs.
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

        // Self-access
        if (actorMemberId == targetMemberId) {
            return when (operation) {
                SecurityOperation.READ,
                SecurityOperation.CREATE,
                SecurityOperation.UPDATE,
                SecurityOperation.EXPORT,
                SecurityOperation.BACKGROUND_SYNC -> true
                SecurityOperation.DELETE -> false // Sensitive health/minor records cannot be self-deleted
            }
        }

        // Administrative authority (OWNER / ADMIN)
        if (actorRole == FamilyRole.OWNER || actorRole == FamilyRole.ADMIN) {
            return true
        }

        // Verified legal guardian
        if (isGuardian) {
            return true
        }

        return false
    }

    /**
     * Authorizes background synchronization for a workspace.
     */
    fun canPerformBackgroundSync(
        role: FamilyRole,
        callerFamilyId: String,
        resourceFamilyId: String,
        hasAccount: Boolean
    ): Boolean {
        if (!hasAccount) return false
        if (role == FamilyRole.GUEST) return false
        return isWorkspaceAuthorized(callerFamilyId, resourceFamilyId)
    }

    /**
     * Determines whether the given role can manage (create, edit, archive) family member profiles.
     */
    fun canManageFamilyMembers(role: FamilyRole): Boolean {
        return role == FamilyRole.OWNER || role == FamilyRole.ADMIN
    }

    /**
     * Stage 3.3.1: Enforces that clients cannot self-assign administrative roles (OWNER/ADMIN).
     * Only an existing OWNER or ADMIN can assign roles, and only OWNER can assign OWNER.
     */
    fun canAssignRole(
        actorRole: FamilyRole,
        actorMemberId: String,
        targetMemberId: String,
        proposedRole: FamilyRole
    ): Boolean {
        if (actorRole != FamilyRole.OWNER && actorRole != FamilyRole.ADMIN) {
            return false
        }
        if (proposedRole == FamilyRole.OWNER && actorRole != FamilyRole.OWNER) {
            return false
        }
        if (actorMemberId == targetMemberId && actorRole != FamilyRole.OWNER && proposedRole == FamilyRole.OWNER) {
            return false
        }
        return true
    }

    /**
     * Stage 3.3.1: Enforces the one-family membership rule.
     * An account that already holds an ACTIVE membership in one family cannot join or create a second active family.
     */
    fun canJoinOrCreateActiveFamily(existingActiveFamilyIds: List<String>, targetFamilyId: String): Boolean {
        return existingActiveFamilyIds.isEmpty() || existingActiveFamilyIds.all { it == targetFamilyId }
    }

    /**
     * Stage 3.3.1: Enforces personal profile note privacy vs shared profile fields.
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

    /**
     * Stage 3.3.1: Revoked or suspended members cannot retrieve or sync family records.
     */
    fun isMembershipActive(membershipStatus: String): Boolean {
        return membershipStatus == "ACTIVE"
    }

    /**
     * Determines whether an actor can view or edit sensitive details of a restricted minor profile.
     * Requires the actor to be an OWNER/ADMIN, or a verified legal guardian/parent.
     */
    fun canManageMinorProfile(
        actorRole: FamilyRole,
        actorMemberId: String,
        targetMemberId: String,
        isGuardian: Boolean
    ): Boolean {
        // Own profile self-inspection if not restricted
        if (actorMemberId == targetMemberId) return true

        // Workspace OWNER or ADMIN have administrative stewardship
        if (actorRole == FamilyRole.OWNER || actorRole == FamilyRole.ADMIN) return true

        // Verified legal guardian / parent has access
        return isGuardian
    }

    /**
     * Determines whether a profile has restricted child access (blocks finances, settings, full member audit).
     */
    fun isRestrictedAccess(isRestrictedProfile: Boolean, role: FamilyRole): Boolean {
        if (isRestrictedProfile) return true
        return role == FamilyRole.GUEST
    }

    /**
     * Determines whether a member can create or modify family goals and projects.
     */
    fun canManageGoalsAndProjects(role: FamilyRole): Boolean {
        return role == FamilyRole.OWNER || role == FamilyRole.ADMIN
    }

    /**
     * Determines whether a member can complete a specific task.
     * Allowed if the task is assigned to the member, or if the actor is OWNER/ADMIN.
     */
    fun canCompleteTask(
        actorRole: FamilyRole,
        actorMemberId: String,
        assignedMemberId: String?
    ): Boolean {
        if (actorRole == FamilyRole.OWNER || actorRole == FamilyRole.ADMIN) return true
        if (assignedMemberId != null && assignedMemberId == actorMemberId) return true
        return assignedMemberId == null // Unassigned tasks can be completed by any household member
    }

    /**
     * Determines whether a member can complete an assigned chore.
     * All household members (including children) can complete chores assigned to them or unassigned chores.
     */
    fun canCompleteChore(
        actorMemberId: String,
        assignedMemberId: String?
    ): Boolean {
        return assignedMemberId == null || assignedMemberId == actorMemberId
    }

    /**
     * Validates that an operation within a family workspace matches the caller's active familyId.
     */
    fun isWorkspaceAuthorized(callerFamilyId: String, resourceFamilyId: String): Boolean {
        return callerFamilyId.isNotBlank() && callerFamilyId == resourceFamilyId
    }

    /**
     * Stage 3.3.2: Enforces PERSONAL, COUPLE, and FAMILY goal visibility.
     */
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

    /**
     * Stage 3.3.2: Enforces PERSONAL and SHARED canonical task visibility.
     */
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

    /**
     * Stage 3.3.2: Enforces whether a caller can assign or reassign a task to another member.
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
     * Stage 3.3.2: Only OWNER and ADMIN can configure or approve the optional Family Reward System.
     */
    fun canConfigureRewards(actorRole: FamilyRole): Boolean {
        return actorRole == FamilyRole.OWNER || actorRole == FamilyRole.ADMIN
    }
}
