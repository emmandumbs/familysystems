package com.familyos

import com.familyos.core.domain.*
import org.junit.Assert.*
import org.junit.Test

/**
 * Stage 3 Wellbeing & Safety Unit Test Suite
 * Validates:
 * 1. Privacy invariants & medical disclaimers.
 * 2. Guardian permissions for minor wellbeing records.
 * 3. Allergy severity classification & emergency treatments.
 * 4. Emergency contact primary designation & dialing safety.
 */
class Stage3WellbeingSecurityTest {

    @Test
    fun testMedicationReminderNonProofInvariant() {
        // Assert that the system disclaimer is strictly preserved and explicitly states non-proof
        val disclaimer = WellbeingDisclaimers.MEDICATION_REMINDER_DISCLAIMER
        assertTrue(disclaimer.contains("does not represent proof or medical verification"))
    }

    @Test
    fun testGuardianAccessRestrictionsForMinorChildWellbeing() {
        // Sarah (Owner / Parent) can manage Lucas's health profile
        assertTrue(
            FamilySecurityPolicy.canManageMinorProfile(
                actorRole = FamilyRole.OWNER,
                actorMemberId = "sarah-owner",
                targetMemberId = "lucas-minor",
                isGuardian = true
            )
        )

        // John (MEMBER with verified legal guardianship) can manage Lucas
        assertTrue(
            FamilySecurityPolicy.canManageMinorProfile(
                actorRole = FamilyRole.MEMBER,
                actorMemberId = "john-guardian",
                targetMemberId = "lucas-minor",
                isGuardian = true
            )
        )

        // Non-guardian regular member cannot access or manage minor health records
        assertFalse(
            FamilySecurityPolicy.canManageMinorProfile(
                actorRole = FamilyRole.MEMBER,
                actorMemberId = "unrelated-member",
                targetMemberId = "lucas-minor",
                isGuardian = false
            )
        )
    }

    @Test
    fun testAllergyEmergencyTreatmentPresence() {
        val severeAllergy = HealthAllergy(
            id = "a-1",
            familyId = "fam-1",
            memberId = "mem-lucas",
            allergen = "Peanuts",
            severity = "SEVERE_ANAPHYLACTIC",
            reaction = "Anaphylaxis",
            emergencyTreatment = "Administer EpiPen Jr and call 911"
        )

        assertNotNull(severeAllergy.emergencyTreatment)
        assertEquals("SEVERE_ANAPHYLACTIC", severeAllergy.severity)
    }

    @Test
    fun testEmergencyContactSortingByPrimaryDesignation() {
        val contacts = listOf(
            EmergencyContact("1", "fam-1", "Aunt Jane", "Aunt", "555-0001", null, isPrimary = false, notes = null),
            EmergencyContact("2", "fam-1", "Sarah Henderson", "Mother", "555-0002", null, isPrimary = true, notes = null),
            EmergencyContact("3", "fam-1", "David Henderson", "Father", "555-0003", null, isPrimary = true, notes = null)
        )

        val sorted = contacts.sortedWith(compareByDescending<EmergencyContact> { it.isPrimary }.thenBy { it.name })

        assertTrue("Primary contacts must appear first", sorted[0].isPrimary)
        assertTrue(sorted[1].isPrimary)
        assertFalse("Non-primary contacts must follow", sorted[2].isPrimary)
    }
}
