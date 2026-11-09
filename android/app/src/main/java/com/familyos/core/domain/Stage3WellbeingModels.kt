package com.familyos.core.domain

/**
 * Pure Kotlin Stage 3 Domain Models for Wellbeing & Emergency Preparedness Module
 *
 * Privacy Guarantees:
 * - Local-first data architecture.
 * - Strict guardian protection for minor health data.
 * - No medical diagnostic claims.
 * - Explicit disclaimer that reminders do NOT equal proof of consumption.
 */

object WellbeingDisclaimers {
    const val MEDICATION_REMINDER_DISCLAIMER =
        "Medication reminders and schedules are for personal household coordination only. A logged or scheduled reminder does not represent proof or medical verification that medication was administered or ingested."
    const val HEALTH_ADVICE_DISCLAIMER =
        "FamilyOS stores user-recorded health information for emergency reference. It does not provide medical diagnoses, clinical evaluations, or professional treatment advice."
}

data class MemberWellbeingProfile(
    val id: String,
    val familyId: String,
    val memberId: String,
    val bloodType: String?,
    val medicalConditions: List<String>,
    val insuranceProvider: String?,
    val insurancePolicyNumber: String?,
    val primaryPhysicianName: String?,
    val primaryPhysicianPhone: String?,
    val notes: String?,
    val updatedAt: Long
)

data class HealthAllergy(
    val id: String,
    val familyId: String,
    val memberId: String,
    val allergen: String,
    val severity: String, // "MILD", "MODERATE", "SEVERE_ANAPHYLACTIC"
    val reaction: String,
    val emergencyTreatment: String?
)

data class HealthMedication(
    val id: String,
    val familyId: String,
    val memberId: String,
    val medicationName: String,
    val dosage: String,
    val scheduleFrequency: String,
    val scheduleTimes: List<String>,
    val instructions: String?,
    val isActive: Boolean
)

data class HealthVaccination(
    val id: String,
    val familyId: String,
    val memberId: String,
    val vaccineName: String,
    val dateAdministered: Long,
    val nextBoosterDate: Long?,
    val provider: String?,
    val lotNumber: String?
)

data class HealthcareAppointment(
    val id: String,
    val familyId: String,
    val memberId: String,
    val providerName: String,
    val specialty: String,
    val appointmentTime: Long,
    val location: String?,
    val notes: String?
)

data class EmergencyContact(
    val id: String,
    val familyId: String,
    val name: String,
    val relationship: String,
    val phonePrimary: String,
    val phoneSecondary: String?,
    val isPrimary: Boolean,
    val notes: String?
)

data class EmergencyPlan(
    val id: String,
    val familyId: String,
    val primaryMeetingPoint: String,
    val secondaryMeetingPoint: String,
    val evacuationRoute: String?,
    val gasShutoffLocation: String?,
    val waterShutoffLocation: String?,
    val electricalPanelLocation: String?,
    val notes: String?
)

data class EmergencySupply(
    val id: String,
    val familyId: String,
    val itemName: String,
    val category: String, // "WATER", "FOOD", "FIRST_AID", "POWER_LIGHT", "TOOLS"
    val quantity: String,
    val storageLocation: String,
    val expiryDate: Long?,
    val isChecked: Boolean
)

data class EmergencyChecklistItem(
    val id: String,
    val familyId: String,
    val title: String,
    val category: String, // "EVACUATION", "STORM_PREP", "COMMUNICATION", "ANNUAL_REVIEW"
    val isCompleted: Boolean,
    val assignedMemberId: String?,
    val completedAt: Long?
)
