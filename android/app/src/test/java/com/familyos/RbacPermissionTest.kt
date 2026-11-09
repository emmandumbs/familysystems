package com.familyos

import com.familyos.core.domain.FamilyRole
import com.familyos.core.domain.FamilySecurityPolicy
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class RbacPermissionTest {

    @Test
    fun testRbacAccessBoundaries() {
        // Owner & Admin have financial access
        assertTrue(FamilySecurityPolicy.canAccessFinancialLedger(FamilyRole.OWNER))
        assertTrue(FamilySecurityPolicy.canAccessFinancialLedger(FamilyRole.ADMIN))

        // Regular members and guests are strictly blocked from financial ledger
        assertFalse(FamilySecurityPolicy.canAccessFinancialLedger(FamilyRole.MEMBER))
        assertFalse(FamilySecurityPolicy.canAccessFinancialLedger(FamilyRole.GUEST))

        // Member management restricted to Owner & Admin
        assertTrue(FamilySecurityPolicy.canManageFamilyMembers(FamilyRole.OWNER))
        assertTrue(FamilySecurityPolicy.canManageFamilyMembers(FamilyRole.ADMIN))
        assertFalse(FamilySecurityPolicy.canManageFamilyMembers(FamilyRole.MEMBER))
        assertFalse(FamilySecurityPolicy.canManageFamilyMembers(FamilyRole.GUEST))
    }

    @Test
    fun testGuardianAuthorizationForMinorProfiles() {
        // Sarah (Owner) can manage Lucas (Minor) even if not direct guardian
        assertTrue(
            FamilySecurityPolicy.canManageMinorProfile(
                actorRole = FamilyRole.OWNER,
                actorMemberId = "sarah-owner",
                targetMemberId = "lucas-minor",
                isGuardian = false
            )
        )

        // John (Member) who IS designated legal guardian can manage Lucas
        assertTrue(
            FamilySecurityPolicy.canManageMinorProfile(
                actorRole = FamilyRole.MEMBER,
                actorMemberId = "john-guardian",
                targetMemberId = "lucas-minor",
                isGuardian = true
            )
        )

        // Alex (Member) who is NOT designated legal guardian CANNOT manage Lucas
        assertFalse(
            FamilySecurityPolicy.canManageMinorProfile(
                actorRole = FamilyRole.MEMBER,
                actorMemberId = "alex-member",
                targetMemberId = "lucas-minor",
                isGuardian = false
            )
        )

        // Guest can NEVER manage a minor
        assertFalse(
            FamilySecurityPolicy.canManageMinorProfile(
                actorRole = FamilyRole.GUEST,
                actorMemberId = "guest-user",
                targetMemberId = "lucas-minor",
                isGuardian = false
            )
        )
    }

    @Test
    fun testChildRestrictedDataProtection() {
        // Minor child profile with isRestrictedProfile = true is restricted
        assertTrue(FamilySecurityPolicy.isRestrictedAccess(isRestrictedProfile = true, role = FamilyRole.MEMBER))

        // Guest role is always restricted
        assertTrue(FamilySecurityPolicy.isRestrictedAccess(isRestrictedProfile = false, role = FamilyRole.GUEST))

        // Regular adult member without restriction flag has standard access
        assertFalse(FamilySecurityPolicy.isRestrictedAccess(isRestrictedProfile = false, role = FamilyRole.MEMBER))
    }

    @Test
    fun testTaskAndChoreCompletionPermissions() {
        // Owner/Admin can complete any task
        assertTrue(FamilySecurityPolicy.canCompleteTask(FamilyRole.ADMIN, "admin-1", "member-2"))

        // Member can complete task assigned to them
        assertTrue(FamilySecurityPolicy.canCompleteTask(FamilyRole.MEMBER, "member-2", "member-2"))

        // Member cannot complete task assigned to someone else
        assertFalse(FamilySecurityPolicy.canCompleteTask(FamilyRole.MEMBER, "member-3", "member-2"))

        // Unassigned chore can be completed by any member
        assertTrue(FamilySecurityPolicy.canCompleteChore("member-1", null))

        // Assigned chore can be completed by assignee
        assertTrue(FamilySecurityPolicy.canCompleteChore("lucas-minor", "lucas-minor"))

        // Assigned chore cannot be hijacked by unassigned member
        assertFalse(FamilySecurityPolicy.canCompleteChore("other-member", "lucas-minor"))
    }

    @Test
    fun testWorkspaceBoundaryIsolation() {
        assertTrue(FamilySecurityPolicy.isWorkspaceAuthorized("workspace-123", "workspace-123"))
        assertFalse(FamilySecurityPolicy.isWorkspaceAuthorized("workspace-123", "workspace-other"))
        assertFalse(FamilySecurityPolicy.isWorkspaceAuthorized("", "workspace-123"))
    }

    @Test
    fun testFinancialOperationsCoverageForAllRolesAndOperations() {
        val allOperations = FamilySecurityPolicy.SecurityOperation.values()

        // 1. Privileged roles with active account: all operations granted
        for (op in allOperations) {
            assertTrue(
                "OWNER should be authorized for $op",
                FamilySecurityPolicy.isFinancialOperationAuthorized(FamilyRole.OWNER, op, hasAccount = true)
            )
            assertTrue(
                "ADMIN should be authorized for $op",
                FamilySecurityPolicy.isFinancialOperationAuthorized(FamilyRole.ADMIN, op, hasAccount = true)
            )
        }

        // 2. Non-owner / non-admin roles: all operations strictly blocked
        for (op in allOperations) {
            assertFalse(
                "MEMBER must be denied for $op",
                FamilySecurityPolicy.isFinancialOperationAuthorized(FamilyRole.MEMBER, op, hasAccount = true)
            )
            assertFalse(
                "GUEST must be denied for $op",
                FamilySecurityPolicy.isFinancialOperationAuthorized(FamilyRole.GUEST, op, hasAccount = true)
            )
        }

        // 3. Edge case: Members without authenticated login accounts (e.g. minors, placeholders)
        // Must be denied regardless of role
        for (role in FamilyRole.values()) {
            for (op in allOperations) {
                assertFalse(
                    "Unauthenticated member without account ($role) must be denied for $op",
                    FamilySecurityPolicy.isFinancialOperationAuthorized(role, op, hasAccount = false)
                )
            }
        }
    }

    @Test
    fun testSensitiveDataOperationsCRUDExportAndSync() {
        val allOperations = FamilySecurityPolicy.SecurityOperation.values()

        // 1. Verified legal guardian managing minor ward
        for (op in allOperations) {
            assertTrue(
                "Legal guardian should be authorized for $op on minor ward",
                FamilySecurityPolicy.isSensitiveDataOperationAuthorized(
                    actorRole = FamilyRole.MEMBER,
                    actorMemberId = "guardian-parent",
                    targetMemberId = "minor-child",
                    isGuardian = true,
                    operation = op,
                    hasAccount = true
                )
            )
        }

        // 2. Non-guardian MEMBER attempting to access minor ward
        for (op in allOperations) {
            assertFalse(
                "Non-guardian member must be denied for $op on minor ward",
                FamilySecurityPolicy.isSensitiveDataOperationAuthorized(
                    actorRole = FamilyRole.MEMBER,
                    actorMemberId = "unrelated-member",
                    targetMemberId = "minor-child",
                    isGuardian = false,
                    operation = op,
                    hasAccount = true
                )
            )
        }

        // 3. GUEST attempting sensitive operations
        for (op in allOperations) {
            assertFalse(
                "GUEST must be denied for $op on any sensitive record",
                FamilySecurityPolicy.isSensitiveDataOperationAuthorized(
                    actorRole = FamilyRole.GUEST,
                    actorMemberId = "guest-actor",
                    targetMemberId = "guest-actor",
                    isGuardian = false,
                    operation = op,
                    hasAccount = true
                )
            )
        }

        // 4. Self-access rules: Member can read, update, export own sensitive data, but cannot delete core health record
        assertTrue(
            FamilySecurityPolicy.isSensitiveDataOperationAuthorized(
                actorRole = FamilyRole.MEMBER,
                actorMemberId = "self-user",
                targetMemberId = "self-user",
                isGuardian = false,
                operation = FamilySecurityPolicy.SecurityOperation.READ,
                hasAccount = true
            )
        )
        assertTrue(
            FamilySecurityPolicy.isSensitiveDataOperationAuthorized(
                actorRole = FamilyRole.MEMBER,
                actorMemberId = "self-user",
                targetMemberId = "self-user",
                isGuardian = false,
                operation = FamilySecurityPolicy.SecurityOperation.EXPORT,
                hasAccount = true
            )
        )
        assertFalse(
            "Self-deletion of core health record is blocked without guardian/admin",
            FamilySecurityPolicy.isSensitiveDataOperationAuthorized(
                actorRole = FamilyRole.MEMBER,
                actorMemberId = "self-user",
                targetMemberId = "self-user",
                isGuardian = false,
                operation = FamilySecurityPolicy.SecurityOperation.DELETE,
                hasAccount = true
            )
        )

        // 5. Unlinked account edge case: Actor without account has no authorization
        for (op in allOperations) {
            assertFalse(
                "Actor without account must be denied for $op",
                FamilySecurityPolicy.isSensitiveDataOperationAuthorized(
                    actorRole = FamilyRole.OWNER,
                    actorMemberId = "unlinked-owner",
                    targetMemberId = "minor-child",
                    isGuardian = true,
                    operation = op,
                    hasAccount = false
                )
            )
        }
    }

    @Test
    fun testBackgroundSyncAuthorization() {
        // Authorized workspace sync for owner/admin/member
        assertTrue(FamilySecurityPolicy.canPerformBackgroundSync(FamilyRole.OWNER, "ws-1", "ws-1", hasAccount = true))
        assertTrue(FamilySecurityPolicy.canPerformBackgroundSync(FamilyRole.ADMIN, "ws-1", "ws-1", hasAccount = true))
        assertTrue(FamilySecurityPolicy.canPerformBackgroundSync(FamilyRole.MEMBER, "ws-1", "ws-1", hasAccount = true))

        // Mismatched workspace is denied
        assertFalse(FamilySecurityPolicy.canPerformBackgroundSync(FamilyRole.OWNER, "ws-1", "ws-2", hasAccount = true))

        // GUEST cannot initiate background sync
        assertFalse(FamilySecurityPolicy.canPerformBackgroundSync(FamilyRole.GUEST, "ws-1", "ws-1", hasAccount = true))

        // Unauthenticated member without account cannot initiate background sync
        assertFalse(FamilySecurityPolicy.canPerformBackgroundSync(FamilyRole.OWNER, "ws-1", "ws-1", hasAccount = false))
    }
}
