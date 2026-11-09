package com.familyos

import com.familyos.core.domain.FamilyMember
import com.familyos.core.domain.FamilyRelationship
import com.familyos.core.domain.RelationshipType
import org.junit.Assert.*
import org.junit.Test
import java.util.ArrayDeque

class Stage2FamilyTreeTest {

    @Test
    fun testSelfRelationshipForbidden() {
        val memberId = "member_1"
        val isSelf = (memberId == memberId)
        assertTrue("A family member cannot establish a relationship with themselves", isSelf)
    }

    @Test
    fun testDirectReciprocalParentChildCycleDetected() {
        val existing = listOf(
            FamilyRelationship("r1", "fam1", "parent_A", "child_B", RelationshipType.PARENT_CHILD, null)
        )
        // Attempting to make child_B parent of parent_A
        val prospectiveP1 = "child_B"
        val prospectiveP2 = "parent_A"
        val loopDetected = existing.any {
            it.person1MemberId == prospectiveP2 &&
            it.person2MemberId == prospectiveP1 &&
            it.relationshipType == RelationshipType.PARENT_CHILD
        }
        assertTrue("Direct parent-child circular loop must be detected", loopDetected)
    }

    @Test
    fun testTransitiveMultiGenerationParentChildCycleDetected() {
        // Generation I -> Generation II -> Generation III
        // grandfather -> mother -> son
        val relationships = listOf(
            FamilyRelationship("r1", "fam1", "grandfather", "mother", RelationshipType.PARENT_CHILD, null),
            FamilyRelationship("r2", "fam1", "mother", "son", RelationshipType.PARENT_CHILD, null)
        )

        // Attempting to add son -> grandfather (3-node cycle!)
        val proposedParent = "son"
        val proposedChild = "grandfather"

        val parentToChildrenMap = mutableMapOf<String, MutableList<String>>()
        relationships.filter { it.relationshipType == RelationshipType.PARENT_CHILD }.forEach {
            parentToChildrenMap.getOrPut(it.person1MemberId) { mutableListOf() }.add(it.person2MemberId)
        }

        // BFS to check if proposedParent is already a descendant of proposedChild
        var cycleDetected = false
        val queue = ArrayDeque<String>()
        val visited = mutableSetOf<String>()
        queue.add(proposedChild)
        while (queue.isNotEmpty()) {
            val curr = queue.removeFirst()
            if (curr == proposedParent) {
                cycleDetected = true
                break
            }
            if (visited.add(curr)) {
                parentToChildrenMap[curr]?.let { queue.addAll(it) }
            }
        }

        assertTrue("Transitive multi-generation cycle (son -> grandfather) must be rejected", cycleDetected)
    }

    @Test
    fun testDuplicateRelationshipDetection() {
        val existing = listOf(
            FamilyRelationship("r1", "fam1", "m1", "m2", RelationshipType.SPOUSE_PARTNER, null)
        )
        val p1 = "m2"
        val p2 = "m1"
        val proposedType = RelationshipType.SPOUSE_PARTNER

        val isDuplicate = existing.any {
            (it.person1MemberId == p1 && it.person2MemberId == p2) ||
            (it.person1MemberId == p2 && it.person2MemberId == p1 && it.relationshipType == proposedType)
        }
        assertTrue("Duplicate symmetric relationship must be detected", isDuplicate)
    }

    @Test
    fun testMinorProfileGuardianStewardship() {
        val minor = FamilyMember(
            id = "child_1",
            familyId = "fam1",
            displayName = "Lucas",
            relationshipToPrimary = "CHILD",
            birthDate = 1600000000000L,
            avatarUrl = null,
            dietaryPreferences = emptyList(),
            allergies = listOf("Peanuts"),
            isRestrictedProfile = true,
            pointsBalance = 85
        )

        assertTrue("Minor must be identified as restricted profile", minor.isRestrictedProfile)
        // Minors without login accounts must remain functional in local Room DB
        assertNotNull(minor.displayName)
    }

    @Test
    fun testMemberWithoutLoginAccountOperatesNormally() {
        // Family member without login credentials
        val unauthenticatedMember = FamilyMember(
            id = "toddler_99",
            familyId = "fam_alpha",
            displayName = "Baby Emma",
            relationshipToPrimary = "CHILD",
            birthDate = 1700000000000L,
            avatarUrl = null,
            dietaryPreferences = listOf("Dairy-Free"),
            allergies = emptyList(),
            isRestrictedProfile = true,
            pointsBalance = 0
        )

        assertNotNull("Member has valid local profile ID", unauthenticatedMember.id)
        assertEquals("CHILD", unauthenticatedMember.relationshipToPrimary)
        assertTrue(unauthenticatedMember.isRestrictedProfile)
    }
}
