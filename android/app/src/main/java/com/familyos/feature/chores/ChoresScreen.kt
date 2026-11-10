package com.familyos.feature.chores

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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.graphics.Color
import com.familyos.core.designsystem.*
import com.familyos.core.domain.Chore
import com.familyos.core.domain.ChoreFrequency

/**
 * Stage 2: Chores & Household Routines Screen
 * Positive motivation, reward points, recurrence advancement without data loss.
 */
@Composable
fun ChoresScreen(
    chores: List<Chore> = sampleChores,
    onAddChore: () -> Unit = {},
    onCompleteChore: (String) -> Unit = {}
) {
    var selectedZone by remember { mutableStateOf("ALL") }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(FamilyOSSpacing.md)
    ) {
        // Header
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column {
                Text(
                    text = "Chores & Responsibilities",
                    style = MaterialTheme.typography.headlineLarge,
                    color = FamilyOSColors.TextPrimary
                )
                Text(
                    text = "Positive household teamwork & recognition",
                    style = MaterialTheme.typography.bodySmall,
                    color = FamilyOSColors.TextSecondary
                )
            }

            FamilyOSPrimaryButton(
                text = "New Chore",
                icon = Icons.Default.Add,
                onClick = onAddChore
            )
        }

        Spacer(modifier = Modifier.height(FamilyOSSpacing.md))

        // Motivation & Progress Hero Card
        FamilyOSCard(backgroundColor = FamilyOSColors.GoldContainer) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text(
                        text = "Household Chore Progress",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        color = Color(0xFF4A3414)
                    )
                    Text(
                        text = "Lucas earned 85 pts this week • Maya earned 60 pts",
                        style = MaterialTheme.typography.bodySmall,
                        color = Color(0xFF7A5826)
                    )
                }
                FamilyOSStatusBadge(text = "+145 Total Pts", color = FamilyOSColors.SoftGold)
            }

            Spacer(modifier = Modifier.height(FamilyOSSpacing.sm))
            FamilyOSProgressIndicator(progress = 0.75f, color = FamilyOSColors.SoftGold)
        }

        Spacer(modifier = Modifier.height(FamilyOSSpacing.md))

        // Zone Filter Chips
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(FamilyOSSpacing.xs)
        ) {
            listOf("ALL", "KITCHEN", "LIVING_ROOM", "BEDROOMS", "OUTDOORS").forEach { zone ->
                val isSelected = selectedZone == zone
                FilterChip(
                    selected = isSelected,
                    onClick = { selectedZone = zone },
                    label = { Text(zone.replace("_", " ")) },
                    colors = FilterChipDefaults.filterChipColors(
                        selectedContainerColor = FamilyOSColors.SageLight,
                        selectedLabelColor = FamilyOSColors.PrimaryForestGreen
                    )
                )
            }
        }

        Spacer(modifier = Modifier.height(FamilyOSSpacing.md))

        // Chores List
        val filteredChores = if (selectedZone == "ALL") chores else chores.filter { it.zone == selectedZone }

        LazyColumn(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(FamilyOSSpacing.sm)
        ) {
            items(filteredChores) { chore ->
                FamilyOSCard {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        IconButton(
                            onClick = { onCompleteChore(chore.id) },
                            modifier = Modifier.size(48.dp)
                        ) {
                            Icon(
                                imageVector = if (chore.isCompleted) Icons.Default.CheckCircle else Icons.Default.RadioButtonUnchecked,
                                contentDescription = "Complete chore ${chore.title}",
                                tint = if (chore.isCompleted) FamilyOSColors.Success else FamilyOSColors.BorderStrong,
                                modifier = Modifier.size(24.dp)
                            )
                        }

                        Spacer(modifier = Modifier.width(FamilyOSSpacing.sm))

                        Column(modifier = Modifier.weight(1f)) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text(
                                    text = chore.title,
                                    style = MaterialTheme.typography.titleMedium,
                                    fontWeight = FontWeight.Bold,
                                    color = if (chore.isCompleted) FamilyOSColors.TextTertiary else FamilyOSColors.TextPrimary
                                )
                                Spacer(modifier = Modifier.width(FamilyOSSpacing.xs))
                                FamilyOSStatusBadge(text = "+${chore.rewardPoints} pts", color = FamilyOSColors.SoftGold)
                            }

                            Text(
                                text = "Zone: ${chore.zone} • Frequency: ${chore.frequency.name}",
                                style = MaterialTheme.typography.bodySmall,
                                color = FamilyOSColors.TextSecondary
                            )
                        }

                        if (chore.requiresVerification) {
                            FamilyOSStatusBadge(text = "Verify", color = FamilyOSColors.SecondarySage)
                        }
                    }
                }
            }
        }
    }
}

private val sampleChores = listOf(
    Chore("c1", "fam1", "Unload dishwasher & arrange plates", null, "m3", "KITCHEN", ChoreFrequency.DAILY, 10, System.currentTimeMillis() + 3600000L, false, false),
    Chore("c2", "fam1", "Vacuum living room area rug", null, "m4", "LIVING_ROOM", ChoreFrequency.WEEKLY, 15, System.currentTimeMillis() + 86400000L, false, false),
    Chore("c3", "fam1", "Take out recyclable cardboard", null, "m1", "OUTDOORS", ChoreFrequency.WEEKLY, 10, System.currentTimeMillis() + 2 * 86400000L, false, true),
    Chore("c4", "fam1", "Tidy toys into storage chests", null, "m3", "BEDROOMS", ChoreFrequency.DAILY, 10, System.currentTimeMillis() + 7200000L, false, false)
)
