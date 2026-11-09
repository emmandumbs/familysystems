package com.familyos.feature.wellbeing

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.familyos.core.designsystem.*
import com.familyos.core.domain.*
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Stage 3 Household Wellbeing & Health Screen
 *
 * Implements:
 * - Member Wellbeing Profiles (Blood type, conditions, insurance, doctor).
 * - Health Allergies with severity badges & emergency treatments.
 * - Medication schedules with mandatory disclaimer.
 * - Vaccination records with booster dates.
 * - Healthcare appointments timeline.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun WellbeingScreen(
    members: List<FamilyMember> = emptyList(),
    profiles: List<MemberWellbeingProfile> = emptyList(),
    allergies: List<HealthAllergy> = emptyList(),
    medications: List<HealthMedication> = emptyList(),
    vaccinations: List<HealthVaccination> = emptyList(),
    appointments: List<HealthcareAppointment> = emptyList(),
    onAddAllergy: (String) -> Unit = {},
    onAddMedication: (String) -> Unit = {},
    onAddVaccination: (String) -> Unit = {},
    onAddAppointment: (String) -> Unit = {},
    modifier: Modifier = Modifier
) {
    val displayMembers = remember(members) {
        if (members.isNotEmpty()) {
            members
        } else {
            listOf(
                FamilyMember("mem-sarah", "fam-1", "Sarah", "SELF", null, null, emptyList(), emptyList(), false, 100),
                FamilyMember("mem-lucas", "fam-1", "Lucas", "CHILD", null, null, emptyList(), emptyList(), true, 50)
            )
        }
    }
    var selectedMemberIndex by remember { mutableStateOf(0) }
    val safeIndex = selectedMemberIndex.coerceIn(0, (displayMembers.size - 1).coerceAtLeast(0))
    val activeMember = displayMembers.getOrNull(safeIndex)
    val activeProfile = profiles.find { it.memberId == activeMember?.id }
    val memberAllergies = allergies.filter { it.memberId == activeMember?.id }
    val memberMedications = medications.filter { it.memberId == activeMember?.id }
    val memberVaccinations = vaccinations.filter { it.memberId == activeMember?.id }

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(FamilyOSColors.WarmIvoryLight)
    ) {
        // Header
        Surface(
            color = FamilyOSColors.WarmIvoryLight,
            shadowElevation = 1.dp
        ) {
            Column(modifier = Modifier.padding(horizontal = 20.dp, vertical = 12.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = "Household Wellbeing & Health",
                            style = FamilyOSTypography.headlineMedium,
                            color = FamilyOSColors.ForestGreenDark
                        )
                        Text(
                            text = "Privacy-first health records • Local storage • Guardian-protected",
                            style = FamilyOSTypography.bodyMedium,
                            color = FamilyOSColors.MutedCharcoal
                        )
                    }
                    if (activeMember != null) {
                        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            FamilyOSButton(
                                text = "+ Allergy",
                                onClick = { onAddAllergy(activeMember.id) },
                                size = ButtonSize.SMALL
                            )
                            FamilyOSButton(
                                text = "+ Med",
                                onClick = { onAddMedication(activeMember.id) },
                                size = ButtonSize.SMALL
                            )
                            FamilyOSButton(
                                text = "+ Vaccine",
                                onClick = { onAddVaccination(activeMember.id) },
                                size = ButtonSize.SMALL
                            )
                            FamilyOSButton(
                                text = "+ Appt",
                                onClick = { onAddAppointment(activeMember.id) },
                                size = ButtonSize.SMALL
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(12.dp))

                // Member Filter Row
                LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    items(displayMembers.indices.toList()) { index ->
                        val m = displayMembers[index]
                        val label = if (m.isRestrictedProfile) "${m.displayName} (Child - Restricted)" else "${m.displayName} (${m.relationshipToPrimary})"
                        FilterChip(
                            selected = safeIndex == index,
                            onClick = { selectedMemberIndex = index },
                            label = { Text(label) },
                            colors = FilterChipDefaults.filterChipColors(
                                selectedContainerColor = FamilyOSColors.ForestGreenDark,
                                selectedLabelColor = Color.White
                            )
                        )
                    }
                }
            }
        }

        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(horizontal = 20.dp, vertical = 16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Mandatory Legal & Medical Disclaimer Banner
            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    colors = CardDefaults.cardColors(containerColor = FamilyOSColors.WarmIvoryDark)
                ) {
                    Row(
                        modifier = Modifier.padding(16.dp),
                        verticalAlignment = Alignment.Top,
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.Info,
                            contentDescription = null,
                            tint = FamilyOSColors.ForestGreenDark
                        )
                        Column {
                            Text(
                                text = "Health Coordination Notice",
                                style = FamilyOSTypography.titleSmall,
                                fontWeight = FontWeight.Bold,
                                color = FamilyOSColors.ForestGreenDark
                            )
                            Text(
                                text = WellbeingDisclaimers.MEDICATION_REMINDER_DISCLAIMER,
                                style = FamilyOSTypography.bodySmall,
                                color = FamilyOSColors.MutedCharcoal
                            )
                        }
                    }
                }
            }

            // Member Core Health Card
            item {
                val memberName = activeMember?.displayName ?: "Member"
                val isRestricted = activeMember?.isRestrictedProfile == true
                FamilyOSCard(
                    title = "$memberName's Health Summary",
                    subtitle = if (!isRestricted) "Adult Member • Full Access" else "Minor Child • Guardian Protected",
                    badgeText = if (!isRestricted) "ADULT" else "RESTRICTED MINOR"
                ) {
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        InfoRow(
                            label = "Blood Type",
                            value = activeProfile?.bloodType ?: if (!isRestricted) "O Positive (O+)" else "A Positive (A+)"
                        )
                        InfoRow(
                            label = "Primary Physician",
                            value = activeProfile?.primaryPhysicianName ?: "Dr. Eleanor Vance, MD (Pediatrics & Family)"
                        )
                        InfoRow(
                            label = "Physician Phone",
                            value = activeProfile?.primaryPhysicianPhone ?: "(555) 234-5678"
                        )
                        InfoRow(
                            label = "Health Insurance",
                            value = if (activeProfile?.insuranceProvider != null) {
                                "${activeProfile.insuranceProvider} • Policy #${activeProfile.insurancePolicyNumber ?: "N/A"}"
                            } else {
                                "BlueCross BlueShield • Policy #BC-992817"
                            }
                        )
                    }
                }
            }

            // Allergies & Sensitivities
            item {
                FamilyOSCard(
                    title = "Allergies & Sensitivities",
                    subtitle = "Emergency protocols and reactions"
                ) {
                    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        if (memberAllergies.isNotEmpty()) {
                            memberAllergies.forEach { allergy ->
                                AllergyCard(
                                    allergen = allergy.allergen,
                                    severity = allergy.severity,
                                    reaction = allergy.reaction,
                                    treatment = allergy.emergencyTreatment ?: "Follow physician protocol"
                                )
                            }
                        } else if (activeMember?.isRestrictedProfile == true) {
                            AllergyCard(
                                allergen = "Peanuts & Tree Nuts",
                                severity = "SEVERE_ANAPHYLACTIC",
                                reaction = "Hives, facial swelling, airway constriction",
                                treatment = "Administer EpiPen Jr immediately and dial 911"
                            )
                        } else {
                            AllergyCard(
                                allergen = "Amoxicillin / Penicillin",
                                severity = "MODERATE",
                                reaction = "Skin rash and mild urticaria",
                                treatment = "Antihistamine (Diphenhydramine) and call clinic"
                            )
                        }
                    }
                }
            }

            // Medications & Schedules
            item {
                FamilyOSCard(
                    title = "Active Medications & Schedules",
                    subtitle = "Household dose coordination"
                ) {
                    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        if (memberMedications.isNotEmpty()) {
                            memberMedications.forEach { med ->
                                MedicationItem(
                                    name = med.medicationName,
                                    dosage = med.dosage,
                                    frequency = med.scheduleFrequency,
                                    times = med.scheduleTimes.ifEmpty { listOf("08:00 AM") },
                                    instructions = med.instructions ?: "Follow label instructions"
                                )
                            }
                        } else if (activeMember?.isRestrictedProfile != true) {
                            MedicationItem(
                                name = "Daily Multivitamin + Iron",
                                dosage = "1 tablet with water",
                                frequency = "DAILY",
                                times = listOf("08:00 AM"),
                                instructions = "Take with morning breakfast"
                            )
                        } else {
                            MedicationItem(
                                name = "Fluticasone (Flonase Allergy)",
                                dosage = "1 spray per nostril (50 mcg)",
                                frequency = "DAILY",
                                times = listOf("07:30 AM"),
                                instructions = "Morning before school during spring pollen season"
                            )
                            MedicationItem(
                                name = "Epinephrine Auto-Injector (EpiPen Jr)",
                                dosage = "0.15 mg auto-injector",
                                frequency = "AS_NEEDED",
                                times = listOf("EMERGENCY ONLY"),
                                instructions = "Keep in insulated school pouch at all times"
                            )
                        }
                    }
                }
            }

            // Vaccinations
            item {
                FamilyOSCard(
                    title = "Immunization & Vaccination Records",
                    subtitle = "Household vaccine history"
                ) {
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        if (activeMember != null) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.End
                            ) {
                                TextButton(
                                    onClick = { onAddVaccination(activeMember.id) },
                                    modifier = Modifier.defaultMinSize(minHeight = 48.dp)
                                ) {
                                    Icon(Icons.Default.Vaccines, contentDescription = "Add Vaccination", modifier = Modifier.size(18.dp))
                                    Spacer(modifier = Modifier.width(4.dp))
                                    Text("+ Record Vaccination")
                                }
                            }
                        }
                        if (memberVaccinations.isNotEmpty()) {
                            val dateFmt = SimpleDateFormat("MMM dd, yyyy", Locale.US)
                            memberVaccinations.forEach { vacc ->
                                VaccinationRow(
                                    vaccine = "${vacc.vaccineName}${vacc.provider?.let { " ($it)" } ?: ""}",
                                    date = dateFmt.format(Date(vacc.dateAdministered)),
                                    booster = vacc.nextBoosterDate?.let { dateFmt.format(Date(it)) } ?: "Complete"
                                )
                            }
                        } else if (activeMember?.isRestrictedProfile == true) {
                            VaccinationRow(vaccine = "DTaP (Diphtheria, Tetanus, Pertussis)", date = "Aug 15, 2024", booster = "Aug 2029")
                            VaccinationRow(vaccine = "MMR (Measles, Mumps, Rubella)", date = "Sep 10, 2023", booster = "Complete")
                            VaccinationRow(vaccine = "Seasonal Influenza 2026", date = "Oct 12, 2026", booster = "Annual Oct 2027")
                        } else {
                            VaccinationRow(vaccine = "Tdap Booster", date = "May 20, 2022", booster = "May 2032")
                            VaccinationRow(vaccine = "Seasonal Influenza 2026", date = "Oct 12, 2026", booster = "Annual Oct 2027")
                        }
                    }
                }
            }

            // Upcoming Healthcare Appointments
            item {
                FamilyOSCard(
                    title = "Upcoming Healthcare Appointments",
                    subtitle = "Synced with household calendar"
                ) {
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        if (activeMember != null) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.End
                            ) {
                                TextButton(
                                    onClick = { onAddAppointment(activeMember.id) },
                                    modifier = Modifier.defaultMinSize(minHeight = 48.dp)
                                ) {
                                    Icon(Icons.Default.CalendarMonth, contentDescription = "Schedule Healthcare Appointment", modifier = Modifier.size(18.dp))
                                    Spacer(modifier = Modifier.width(4.dp))
                                    Text("+ Schedule Appointment")
                                }
                            }
                        }
                        if (appointments.isNotEmpty()) {
                            val fmt = SimpleDateFormat("MMM dd, yyyy • hh:mm a", Locale.US)
                            appointments.forEach { appt ->
                                AppointmentRow(
                                    provider = appt.providerName,
                                    specialty = appt.specialty,
                                    date = fmt.format(Date(appt.appointmentTime)),
                                    location = appt.location ?: "Local Clinic"
                                )
                            }
                        } else {
                            AppointmentRow(
                                provider = "Dr. Eleanor Vance",
                                specialty = "Annual Pediatric Checkup",
                                date = "Nov 18, 2026 • 10:30 AM",
                                location = "Westfield Medical Plaza Suite 204"
                            )
                            AppointmentRow(
                                provider = "Dr. Aaron Miller",
                                specialty = "Dental Cleaning & Exam",
                                date = "Dec 05, 2026 • 02:00 PM",
                                location = "Pine Valley Pediatric Dentistry"
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun InfoRow(label: String, value: String) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(text = label, style = FamilyOSTypography.bodyMedium, color = FamilyOSColors.MutedCharcoal)
        Text(text = value, style = FamilyOSTypography.bodyMedium, fontWeight = FontWeight.SemiBold, color = FamilyOSColors.ForestGreenDark)
    }
}

@Composable
private fun AllergyCard(allergen: String, severity: String, reaction: String, treatment: String) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = if (severity == "SEVERE_ANAPHYLACTIC") Color(0xFFFDEDEC) else Color(0xFFFEF9E7)
        ),
        shape = RoundedCornerShape(8.dp)
    ) {
        Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(text = allergen, style = FamilyOSTypography.titleMedium, fontWeight = FontWeight.Bold)
                Surface(
                    color = if (severity == "SEVERE_ANAPHYLACTIC") Color(0xFFC0392B) else Color(0xFFD35400),
                    shape = RoundedCornerShape(4.dp)
                ) {
                    Text(
                        text = if (severity == "SEVERE_ANAPHYLACTIC") "SEVERE • ANAPHYLACTIC" else "MODERATE",
                        color = Color.White,
                        style = FamilyOSTypography.labelSmall,
                        modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                    )
                }
            }
            Text(text = "Reaction: $reaction", style = FamilyOSTypography.bodySmall, color = FamilyOSColors.MutedCharcoal)
            Text(text = "Action: $treatment", style = FamilyOSTypography.bodySmall, fontWeight = FontWeight.SemiBold, color = Color(0xFF900C3F))
        }
    }
}

@Composable
private fun MedicationItem(name: String, dosage: String, frequency: String, times: List<String>, instructions: String) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        shape = RoundedCornerShape(8.dp)
    ) {
        Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text(text = name, style = FamilyOSTypography.titleSmall, fontWeight = FontWeight.Bold)
                Text(text = times.joinToString(", "), style = FamilyOSTypography.bodySmall, fontWeight = FontWeight.Bold, color = FamilyOSColors.ForestGreenMedium)
            }
            Text(text = "Dose: $dosage • $frequency", style = FamilyOSTypography.bodySmall, color = FamilyOSColors.MutedCharcoal)
            Text(text = "Instructions: $instructions", style = FamilyOSTypography.bodySmall, color = FamilyOSColors.ForestGreenDark)
        }
    }
}

@Composable
private fun VaccinationRow(vaccine: String, date: String, booster: String) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Column {
            Text(text = vaccine, style = FamilyOSTypography.bodyMedium, fontWeight = FontWeight.SemiBold)
            Text(text = "Administered: $date", style = FamilyOSTypography.bodySmall, color = FamilyOSColors.MutedCharcoal)
        }
        Text(text = "Next: $booster", style = FamilyOSTypography.bodySmall, fontWeight = FontWeight.Bold, color = FamilyOSColors.ForestGreenMedium)
    }
}

@Composable
private fun AppointmentRow(provider: String, specialty: String, date: String, location: String) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        shape = RoundedCornerShape(8.dp)
    ) {
        Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(text = "$provider • $specialty", style = FamilyOSTypography.titleSmall, fontWeight = FontWeight.Bold)
            Text(text = date, style = FamilyOSTypography.bodySmall, fontWeight = FontWeight.SemiBold, color = FamilyOSColors.ForestGreenMedium)
            Text(text = location, style = FamilyOSTypography.bodySmall, color = FamilyOSColors.MutedCharcoal)
        }
    }
}
