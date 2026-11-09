package com.familyos.feature.wardrobe

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.familyos.core.database.OutfitPlanEntity
import com.familyos.core.database.WardrobeItemEntity
import com.familyos.core.designsystem.*
import com.familyos.core.domain.FamilyMember

/**
 * Stage 2.A: Wardrobe & Weekly Outfit Planner Screen (HSE-07)
 * Wardrobe cataloging, laundry status, and 7-day outfit coordination per member.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun WardrobeScreen(
    wardrobeItems: List<WardrobeItemEntity> = emptyList(),
    outfitPlans: List<OutfitPlanEntity> = emptyList(),
    members: List<FamilyMember> = emptyList(),
    onAddWardrobeItem: () -> Unit = {},
    onToggleCleanStatus: (String, Boolean) -> Unit = { _, _ -> },
    onSaveOutfitPlan: (
        memberId: String,
        dayOfWeek: String,
        outfitName: String,
        itemIds: List<String>,
        occasion: String,
        notes: String?
    ) -> Unit = { _, _, _, _, _, _ -> }
) {
    var activeSubTab by remember { mutableStateOf("CLOSET") }
    var selectedMemberId by remember(members) { mutableStateOf(members.firstOrNull()?.id ?: "") }
    var selectedCategory by remember { mutableStateOf("ALL") }
    var schedulingDay by remember { mutableStateOf<String?>(null) }

    val daysOfWeek = listOf("MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY")
    val categories = listOf("ALL", "TOPS", "BOTTOMS", "DRESSES", "OUTERWEAR", "SHOES", "ACCESSORIES", "OTHER")
    val occasionOptions = listOf("DAILY", "WORK_SCHOOL", "FORMAL", "ATHLETIC", "SPECIAL")

    val memberWardrobeItems = remember(wardrobeItems, selectedMemberId) {
        wardrobeItems.filter { item ->
            if (selectedMemberId.isBlank()) true else item.memberId == selectedMemberId
        }
    }

    // Filtered items
    val filteredItems = remember(memberWardrobeItems, selectedCategory) {
        memberWardrobeItems.filter { item ->
            if (selectedCategory == "ALL") true else item.category.equals(selectedCategory, ignoreCase = true)
        }
    }

    val memberOutfits = remember(outfitPlans, selectedMemberId) {
        outfitPlans.filter { it.memberId == selectedMemberId }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(FamilyOSSpacing.md)
    ) {
        // Top Header
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column {
                Text(
                    text = "Wardrobe & Outfit Planner",
                    style = MaterialTheme.typography.headlineLarge,
                    color = FamilyOSColors.TextPrimary
                )
                Text(
                    text = "Smart capsule closet, laundry status & 7-day coordination",
                    style = MaterialTheme.typography.bodySmall,
                    color = FamilyOSColors.TextSecondary
                )
            }
            if (activeSubTab == "CLOSET") {
                Button(
                    onClick = onAddWardrobeItem,
                    colors = ButtonDefaults.buttonColors(containerColor = FamilyOSColors.PrimaryForestGreen)
                ) {
                    Icon(Icons.Default.Add, contentDescription = null, modifier = Modifier.size(18.dp))
                    Spacer(modifier = Modifier.width(FamilyOSSpacing.xs))
                    Text("Add Item")
                }
            }
        }

        Spacer(modifier = Modifier.height(FamilyOSSpacing.sm))

        // Tab Navigation
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Row(
                modifier = Modifier
                    .background(FamilyOSColors.WarmIvoryDark, FamilyOSShapes.medium)
                    .padding(4.dp)
            ) {
                FilterChip(
                    selected = activeSubTab == "CLOSET",
                    onClick = { activeSubTab = "CLOSET" },
                    label = { Text("Wardrobe Closet") },
                    colors = FilterChipDefaults.filterChipColors(
                        selectedContainerColor = FamilyOSColors.PrimaryForestGreen,
                        selectedLabelColor = Color.White
                    )
                )
                Spacer(modifier = Modifier.width(4.dp))
                FilterChip(
                    selected = activeSubTab == "PLANNER",
                    onClick = { activeSubTab = "PLANNER" },
                    label = { Text("7-Day Outfit Plan") },
                    colors = FilterChipDefaults.filterChipColors(
                        selectedContainerColor = FamilyOSColors.PrimaryForestGreen,
                        selectedLabelColor = Color.White
                    )
                )
            }

            // Member Selector Chips
            if (members.isNotEmpty()) {
                Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    members.take(4).forEach { member ->
                        FilterChip(
                            selected = selectedMemberId == member.id,
                            onClick = { selectedMemberId = member.id },
                            label = { Text(member.displayName.split(" ").first()) },
                            colors = FilterChipDefaults.filterChipColors(
                                selectedContainerColor = FamilyOSColors.SecondarySage,
                                selectedLabelColor = Color.White
                            )
                        )
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(FamilyOSSpacing.sm))

        if (activeSubTab == "CLOSET") {
            // Category filter chips
            FlowRow(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(FamilyOSSpacing.xs)
            ) {
                categories.forEach { cat ->
                    FilterChip(
                        selected = selectedCategory == cat,
                        onClick = { selectedCategory = cat },
                        label = { Text(cat) },
                        colors = FilterChipDefaults.filterChipColors(
                            selectedContainerColor = FamilyOSColors.PrimaryForestGreen,
                            selectedLabelColor = Color.White
                        )
                    )
                }
            }

            Spacer(modifier = Modifier.height(FamilyOSSpacing.sm))

            if (filteredItems.isEmpty()) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(FamilyOSSpacing.lg),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = "No wardrobe items found for this selection.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = FamilyOSColors.TextSecondary
                    )
                }
            } else {
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    verticalArrangement = Arrangement.spacedBy(FamilyOSSpacing.xs)
                ) {
                    items(filteredItems, key = { it.id }) { item ->
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            colors = CardDefaults.cardColors(containerColor = FamilyOSColors.SurfaceCard),
                            shape = FamilyOSShapes.medium
                        ) {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(FamilyOSSpacing.sm),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Column(modifier = Modifier.weight(1f)) {
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        Text(
                                            text = item.itemName,
                                            style = MaterialTheme.typography.titleMedium,
                                            fontWeight = FontWeight.SemiBold,
                                            color = FamilyOSColors.TextPrimary
                                        )
                                        Spacer(modifier = Modifier.width(FamilyOSSpacing.xs))
                                        Surface(
                                            shape = FamilyOSShapes.small,
                                            color = FamilyOSColors.WarmIvoryDark
                                        ) {
                                            Text(
                                                text = item.category,
                                                style = MaterialTheme.typography.labelSmall,
                                                modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
                                                color = FamilyOSColors.TextSecondary
                                            )
                                        }
                                    }

                                    Row(
                                        modifier = Modifier.padding(top = 2.dp),
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        if (item.color != null) {
                                            Text(
                                                text = "Color: ${item.color}",
                                                style = MaterialTheme.typography.bodySmall,
                                                color = FamilyOSColors.TextSecondary
                                            )
                                        }
                                        Text(
                                            text = " • Season: ${item.season}",
                                            style = MaterialTheme.typography.bodySmall,
                                            color = FamilyOSColors.TextSecondary
                                        )
                                    }
                                }

                                // Laundry Toggle Button
                                FilterChip(
                                    selected = item.isClean,
                                    onClick = { onToggleCleanStatus(item.id, !item.isClean) },
                                    label = { Text(if (item.isClean) "Clean" else "In Laundry") },
                                    leadingIcon = {
                                        Icon(
                                            if (item.isClean) Icons.Default.CheckCircle else Icons.Default.LocalLaundryService,
                                            contentDescription = null,
                                            modifier = Modifier.size(16.dp)
                                        )
                                    },
                                    colors = FilterChipDefaults.filterChipColors(
                                        selectedContainerColor = FamilyOSColors.SageLight,
                                        selectedLabelColor = FamilyOSColors.PrimaryForestGreen
                                    )
                                )
                            }
                        }
                    }
                }
            }
        } else {
            // Weekly Outfit Planner
            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                verticalArrangement = Arrangement.spacedBy(FamilyOSSpacing.sm)
            ) {
                items(daysOfWeek) { day ->
                    val plansForDay = memberOutfits.filter { it.planDate.equals(day, ignoreCase = true) }
                    val planForDay = plansForDay.firstOrNull()

                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        colors = CardDefaults.cardColors(containerColor = FamilyOSColors.SurfaceCard),
                        shape = FamilyOSShapes.medium,
                        onClick = { schedulingDay = day }
                    ) {
                        Column(modifier = Modifier.padding(FamilyOSSpacing.sm)) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    text = day,
                                    style = MaterialTheme.typography.titleMedium,
                                    fontWeight = FontWeight.Bold,
                                    color = FamilyOSColors.PrimaryForestGreen
                                )
                                if (planForDay != null) {
                                    Surface(
                                        shape = FamilyOSShapes.small,
                                        color = FamilyOSColors.SageLight
                                    ) {
                                        Text(
                                            text = "Planned • ${planForDay.occasion}",
                                            style = MaterialTheme.typography.labelSmall,
                                            color = FamilyOSColors.PrimaryForestGreen,
                                            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                        )
                                    }
                                } else {
                                    TextButton(onClick = { schedulingDay = day }) {
                                        Text("+ Plan Outfit", style = MaterialTheme.typography.labelSmall)
                                    }
                                }
                            }

                            Spacer(modifier = Modifier.height(4.dp))

                            if (plansForDay.isNotEmpty()) {
                                plansForDay.forEach { planned ->
                                    val resolvedNames = remember(planned.itemIdsJson, wardrobeItems) {
                                        wardrobeItems.filter { item -> planned.itemIdsJson.contains(item.id) }
                                            .map { it.itemName }
                                    }
                                    Text(
                                        text = "${planned.outfitName} (${planned.occasion})",
                                        style = MaterialTheme.typography.bodyLarge,
                                        fontWeight = FontWeight.Medium,
                                        color = FamilyOSColors.TextPrimary
                                    )
                                    if (resolvedNames.isNotEmpty()) {
                                        Text(
                                            text = "Items: ${resolvedNames.joinToString(", ")}",
                                            style = MaterialTheme.typography.bodySmall,
                                            color = FamilyOSColors.PrimaryForestGreen
                                        )
                                    }
                                    if (!planned.notes.isNullOrBlank()) {
                                        Text(
                                            text = planned.notes,
                                            style = MaterialTheme.typography.bodySmall,
                                            color = FamilyOSColors.TextSecondary
                                        )
                                    }
                                }
                            } else {
                                Text(
                                    text = "No outfit scheduled. Tap to assign clothes for $day.",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = FamilyOSColors.TextSecondary
                                )
                            }
                        }
                    }
                }
            }
        }
    }

    schedulingDay?.let { targetDay ->
        var outfitName by remember(targetDay) { mutableStateOf("") }
        var occasion by remember(targetDay) { mutableStateOf("DAILY") }
        var outfitNotes by remember(targetDay) { mutableStateOf("") }
        var selectedItemIds by remember(targetDay) { mutableStateOf(setOf<String>()) }

        AlertDialog(
            onDismissRequest = { schedulingDay = null },
            title = { Text("Plan Outfit for $targetDay", fontWeight = FontWeight.Bold) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(
                        value = outfitName,
                        onValueChange = { outfitName = it },
                        label = { Text("Outfit Name / Combination") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                    Text("Occasion (`outfit_plans.occasion`)", style = MaterialTheme.typography.labelSmall)
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                        occasionOptions.forEach { occ ->
                            FilterChip(
                                selected = occasion == occ,
                                onClick = { occasion = occ },
                                label = { Text(occ, style = MaterialTheme.typography.labelSmall) }
                            )
                        }
                    }
                    Text(
                        text = "Select Wardrobe Items (${selectedItemIds.size} selected)",
                        style = MaterialTheme.typography.labelSmall
                    )
                    if (memberWardrobeItems.isEmpty()) {
                        Text(
                            text = "No wardrobe items yet for this member — add items in Wardrobe Closet to link them.",
                            style = MaterialTheme.typography.bodySmall,
                            color = FamilyOSColors.TextSecondary
                        )
                    } else {
                        FlowRow(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                            memberWardrobeItems.forEach { wItem ->
                                val isSelected = wItem.id in selectedItemIds
                                FilterChip(
                                    selected = isSelected,
                                    onClick = {
                                        selectedItemIds = if (isSelected) {
                                            selectedItemIds - wItem.id
                                        } else {
                                            selectedItemIds + wItem.id
                                        }
                                    },
                                    label = {
                                        Text(
                                            text = "${wItem.itemName} (${wItem.category})",
                                            style = MaterialTheme.typography.labelSmall
                                        )
                                    }
                                )
                            }
                        }
                    }
                    OutlinedTextField(
                        value = outfitNotes,
                        onValueChange = { outfitNotes = it },
                        label = { Text("Notes (Optional)") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        if (outfitName.isNotBlank()) {
                            onSaveOutfitPlan(
                                selectedMemberId.ifBlank { members.firstOrNull()?.id ?: "mem-sarah" },
                                targetDay,
                                outfitName.trim(),
                                selectedItemIds.toList(),
                                occasion,
                                outfitNotes.trim().ifBlank { null }
                            )
                            schedulingDay = null
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = FamilyOSColors.PrimaryForestGreen)
                ) {
                    Text("Save Outfit Plan")
                }
            },
            dismissButton = {
                TextButton(onClick = { schedulingDay = null }) {
                    Text("Cancel")
                }
            }
        )
    }
}

