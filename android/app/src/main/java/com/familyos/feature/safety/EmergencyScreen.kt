package com.familyos.feature.safety

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
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

/**
 * Stage 3 Household Emergency Preparedness & Safety Screen
 *
 * Implements:
 * - Emergency Contacts with 1-tap call/share action and primary designations.
 * - Family Emergency Plan: Primary & Secondary meeting points, utility shutoff locations.
 * - Emergency Supplies Inventory with expiry alerts.
 * - Household Readiness Checklist with responsible member assignments.
 */
import android.content.Intent
import android.net.Uri
import androidx.compose.ui.platform.LocalContext

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun EmergencyScreen(
    contacts: List<EmergencyContact> = defaultSampleEmergencyContacts,
    emergencyPlan: EmergencyPlan? = null,
    supplies: List<EmergencySupply> = defaultSampleSupplies,
    checklistItems: List<EmergencyChecklistItem> = defaultSampleChecklistItems,
    onAddContact: () -> Unit = {},
    onAddEmergencySupply: () -> Unit = {},
    onAddEmergencyChecklistItem: () -> Unit = {},
    onToggleSupplyChecked: (String, Boolean) -> Unit = { _, _ -> },
    onToggleChecklistCompleted: (String, Boolean) -> Unit = { _, _ -> },
    modifier: Modifier = Modifier
) {
    var selectedTab by remember { mutableStateOf(0) }
    val tabs = listOf("Contacts", "Meeting Plan", "Supplies", "Readiness Checklist")

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(FamilyOSColors.WarmIvoryLight)
    ) {
        // Top Header
        Surface(
            color = FamilyOSColors.WarmIvoryLight,
            shadowElevation = 1.dp
        ) {
            Column(modifier = Modifier.padding(horizontal = 20.dp, vertical = 12.dp)) {
                Text(
                    text = "Emergency Preparedness",
                    style = FamilyOSTypography.headlineMedium,
                    color = FamilyOSColors.ForestGreenDark
                )
                Text(
                    text = "Household crisis readiness • Offline-accessible contacts • Zero tracking",
                    style = FamilyOSTypography.bodyMedium,
                    color = FamilyOSColors.MutedCharcoal
                )

                Spacer(modifier = Modifier.height(12.dp))

                ScrollableTabRow(
                    selectedTabIndex = selectedTab,
                    containerColor = Color.Transparent,
                    contentColor = FamilyOSColors.ForestGreenDark,
                    edgePadding = 0.dp
                ) {
                    tabs.forEachIndexed { index, title ->
                        Tab(
                            selected = selectedTab == index,
                            onClick = { selectedTab = index },
                            text = {
                                Text(
                                    text = title,
                                    style = FamilyOSTypography.labelLarge,
                                    fontWeight = if (selectedTab == index) FontWeight.Bold else FontWeight.Normal
                                )
                            }
                        )
                    }
                }
            }
        }

        Box(modifier = Modifier.fillMaxSize().padding(horizontal = 20.dp, vertical = 16.dp)) {
            when (selectedTab) {
                0 -> EmergencyContactsView(contacts = contacts, onAddContact = onAddContact)
                1 -> EmergencyPlanView(plan = emergencyPlan)
                2 -> EmergencySuppliesView(
                    supplies = supplies,
                    onAddSupply = onAddEmergencySupply,
                    onToggleSupplyChecked = onToggleSupplyChecked
                )
                3 -> ReadinessChecklistView(
                    items = checklistItems,
                    onAddChecklistItem = onAddEmergencyChecklistItem,
                    onToggleChecklistCompleted = onToggleChecklistCompleted
                )
            }
        }
    }
}

@Composable
private fun EmergencyContactsView(
    contacts: List<EmergencyContact>,
    onAddContact: () -> Unit
) {
    val context = LocalContext.current

    LazyColumn(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item {
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp),
                colors = CardDefaults.cardColors(containerColor = Color(0xFFFDEDEC))
            ) {
                Row(modifier = Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    Icon(imageVector = Icons.Default.PhoneInTalk, contentDescription = null, tint = Color(0xFFC0392B))
                    Column(modifier = Modifier.weight(1f)) {
                        Text(text = "Police / Fire / Medical Emergency: Dial 911", style = FamilyOSTypography.titleMedium, fontWeight = FontWeight.Bold, color = Color(0xFFC0392B))
                        Text(text = "Offline contacts below are stored locally on-device and require no cellular internet", style = FamilyOSTypography.bodySmall, color = FamilyOSColors.MutedCharcoal)
                    }
                    FamilyOSButton(text = "+ Contact", onClick = onAddContact, size = ButtonSize.SMALL)
                }
            }
        }

        items(contacts) { contact ->
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp),
                colors = CardDefaults.cardColors(containerColor = Color.White),
                elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth().padding(16.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            Text(text = contact.name, style = FamilyOSTypography.titleMedium, fontWeight = FontWeight.Bold)
                            if (contact.isPrimary) {
                                Surface(color = FamilyOSColors.ForestGreenDark, shape = RoundedCornerShape(4.dp)) {
                                    Text(text = "PRIMARY", color = Color.White, style = FamilyOSTypography.labelSmall, modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp))
                                }
                            }
                        }
                        Text(text = contact.relationship, style = FamilyOSTypography.bodySmall, color = FamilyOSColors.MutedCharcoal)
                        Text(text = contact.phonePrimary, style = FamilyOSTypography.bodyLarge, fontWeight = FontWeight.Bold, color = FamilyOSColors.ForestGreenMedium)
                        contact.notes?.let { Text(text = it, style = FamilyOSTypography.bodySmall, color = FamilyOSColors.MutedCharcoal) }
                    }

                    IconButton(onClick = {
                        try {
                            val dialIntent = Intent(Intent.ACTION_DIAL, Uri.parse("tel:${contact.phonePrimary}"))
                            context.startActivity(dialIntent)
                        } catch (_: Exception) {}
                    }) {
                        Icon(imageVector = Icons.Default.Call, contentDescription = "Call ${contact.name}", tint = FamilyOSColors.ForestGreenDark)
                    }
                }
            }
        }
    }
}

@Composable
private fun EmergencyPlanView(plan: EmergencyPlan?) {
    FamilyOSCard(
        title = "Household Evacuation & Meeting Plan",
        subtitle = "Pre-arranged rally points for family accountability",
        badgeText = "ACTIONABLE"
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
            PlanPointItem(
                title = "Primary Meeting Point (Immediate Neighborhood)",
                location = plan?.primaryMeetingPoint ?: "Front lawn beneath large oak tree by sidewalk",
                instruction = "Gather here immediately if exiting the home due to fire or gas odor."
            )
            PlanPointItem(
                title = "Secondary Meeting Point (Out of Neighborhood)",
                location = plan?.secondaryMeetingPoint ?: "Community Park East Gazebo (Corner of 5th & Pine)",
                instruction = "Meet here if neighborhood is closed or blocked."
            )

            HorizontalDivider(color = FamilyOSColors.SageMedium.copy(alpha = 0.3f))

            Text(text = "Home Critical Utility Shutoffs", style = FamilyOSTypography.titleMedium, fontWeight = FontWeight.Bold)
            UtilityShutoffRow(label = "Main Water Valve", location = plan?.waterShutoffLocation ?: "Basement north wall by street meter (Quarter-turn ball valve)")
            UtilityShutoffRow(label = "Main Natural Gas Shutoff", location = plan?.gasShutoffLocation ?: "Outside meter on east exterior wall (Wrench required)")
            UtilityShutoffRow(label = "Electrical Main Breaker Panel", location = plan?.electricalPanelLocation ?: "Garage west wall next to entry door (200A main toggle)")
        }
    }
}

@Composable
private fun EmergencySuppliesView(
    supplies: List<EmergencySupply>,
    onAddSupply: () -> Unit,
    onToggleSupplyChecked: (String, Boolean) -> Unit
) {
    LazyColumn(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(text = "Essential Emergency Supplies", style = FamilyOSTypography.titleLarge, fontWeight = FontWeight.Bold)
                    Text(text = "Household survival reserves and expiration tracking (Tap badge to toggle verification)", style = FamilyOSTypography.bodySmall, color = FamilyOSColors.MutedCharcoal)
                }
                FamilyOSButton(text = "+ Supply", onClick = onAddSupply, size = ButtonSize.SMALL)
            }
        }

        items(supplies) { supply ->
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp),
                colors = CardDefaults.cardColors(containerColor = Color.White),
                elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
                onClick = { onToggleSupplyChecked(supply.id, !supply.isChecked) }
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth().padding(16.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column {
                        Text(text = supply.itemName, style = FamilyOSTypography.titleSmall, fontWeight = FontWeight.Bold)
                        Text(text = "Category: ${supply.category} • Quantity: ${supply.quantity}", style = FamilyOSTypography.bodyMedium, color = FamilyOSColors.MutedCharcoal)
                        Text(text = "Location: ${supply.storageLocation}", style = FamilyOSTypography.bodySmall, color = FamilyOSColors.ForestGreenMedium)
                    }
                    Surface(
                        color = if (supply.isChecked) FamilyOSColors.ForestGreenDark else Color(0xFFD35400),
                        shape = RoundedCornerShape(4.dp)
                    ) {
                        Text(
                            text = if (supply.isChecked) "VERIFIED" else "CHECK NEEDED",
                            color = Color.White,
                            style = FamilyOSTypography.labelSmall,
                            modifier = Modifier.padding(horizontal = 6.dp, vertical = 3.dp)
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun ReadinessChecklistView(
    items: List<EmergencyChecklistItem>,
    onAddChecklistItem: () -> Unit,
    onToggleChecklistCompleted: (String, Boolean) -> Unit
) {
    LazyColumn(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(text = "Readiness Action Checklist", style = FamilyOSTypography.titleLarge, fontWeight = FontWeight.Bold)
                    Text(text = "Regular household safety maintenance with assigned family owners", style = FamilyOSTypography.bodySmall, color = FamilyOSColors.MutedCharcoal)
                }
                FamilyOSButton(text = "+ Checklist", onClick = onAddChecklistItem, size = ButtonSize.SMALL)
            }
        }

        items(items) { item ->
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp),
                colors = CardDefaults.cardColors(containerColor = Color.White),
                elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
                onClick = { onToggleChecklistCompleted(item.id, !item.isCompleted) }
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth().padding(16.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Icon(
                        imageVector = if (item.isCompleted) Icons.Default.CheckCircle else Icons.Default.RadioButtonUnchecked,
                        contentDescription = null,
                        tint = if (item.isCompleted) FamilyOSColors.ForestGreenMedium else FamilyOSColors.SageMedium
                    )
                    Column(modifier = Modifier.weight(1f)) {
                        Text(text = item.title, style = FamilyOSTypography.bodyLarge, fontWeight = FontWeight.SemiBold)
                        Text(
                            text = "${item.category} • Assigned: ${item.assignedMemberId ?: "Household"}",
                            style = FamilyOSTypography.bodySmall,
                            color = FamilyOSColors.MutedCharcoal
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun PlanPointItem(title: String, location: String, instruction: String) {
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text(text = title, style = FamilyOSTypography.titleSmall, fontWeight = FontWeight.Bold, color = FamilyOSColors.ForestGreenDark)
        Text(text = "Location: $location", style = FamilyOSTypography.bodyMedium, fontWeight = FontWeight.SemiBold)
        Text(text = instruction, style = FamilyOSTypography.bodySmall, color = FamilyOSColors.MutedCharcoal)
    }
}

@Composable
private fun UtilityShutoffRow(label: String, location: String) {
    Column {
        Text(text = label, style = FamilyOSTypography.bodyMedium, fontWeight = FontWeight.Bold)
        Text(text = location, style = FamilyOSTypography.bodySmall, color = FamilyOSColors.MutedCharcoal)
    }
}

internal val defaultSampleEmergencyContacts = listOf(
    EmergencyContact("c-1", "fam-1", "Sarah Henderson", "Mother / Primary Guardian", "(555) 123-4567", "(555) 987-6543", true, "Work direct line"),
    EmergencyContact("c-2", "fam-1", "David Henderson", "Father / Guardian", "(555) 234-5678", null, false, "Mobile phone"),
    EmergencyContact("c-3", "fam-1", "Grandma Martha", "Grandmother (Local)", "(555) 345-6789", null, false, "Has spare house key"),
    EmergencyContact("c-4", "fam-1", "Dr. Eleanor Vance", "Family Pediatrician", "(555) 234-5678", null, false, "Westfield Medical Clinic"),
    EmergencyContact("c-5", "fam-1", "Poison Control Center", "Emergency Hotline", "1-800-222-1222", null, false, "24/7 National Emergency Hotline")
)

internal val defaultSampleSupplies = listOf(
    EmergencySupply("s-1", "fam-1", "Drinking Water (1 gal/person/day)", "WATER", "12 gallons (4-day supply)", "Basement pantry", 1735689600000L, true),
    EmergencySupply("s-2", "fam-1", "First Aid Trauma Kit", "FIRST_AID", "2 kits with tourniquet & gauze", "Kitchen tall cupboard", 1767225600000L, true),
    EmergencySupply("s-3", "fam-1", "Hand-Crank NOAA Weather Radio", "POWER_LIGHT", "1 unit with USB phone charging", "Living room emergency bin", null, true),
    EmergencySupply("s-4", "fam-1", "LED Flashlights & Extra D Batteries", "POWER_LIGHT", "4 flashlights + 16 D batteries", "Master bedroom & Hallway", 1751328000000L, true),
    EmergencySupply("s-5", "fam-1", "Non-Perishable Food & Manual Opener", "FOOD", "7-day supply canned goods/bars", "Basement storage shelf 2", 1740787200000L, false)
)

internal val defaultSampleChecklistItems = listOf(
    EmergencyChecklistItem("chk-1", "fam-1", "Test smoke and CO detectors on all floors", "ANNUAL_REVIEW", true, "Sarah", 1698000000000L),
    EmergencyChecklistItem("chk-2", "fam-1", "Walk through two escape routes per bedroom with Lucas", "EVACUATION", true, "Sarah", 1698100000000L),
    EmergencyChecklistItem("chk-3", "fam-1", "Inspect emergency food and water expiration dates", "ANNUAL_REVIEW", true, "David", 1698200000000L),
    EmergencyChecklistItem("chk-4", "fam-1", "Verify backup generator fuel and oil level", "STORM_PREP", false, "David", null),
    EmergencyChecklistItem("chk-5", "fam-1", "Ensure family emergency contacts card is in school backpack", "COMMUNICATION", true, "Sarah", 1698300000000L)
)
