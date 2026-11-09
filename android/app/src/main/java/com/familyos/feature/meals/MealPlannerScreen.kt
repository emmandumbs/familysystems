package com.familyos.feature.meals

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
import androidx.compose.ui.unit.dp
import com.familyos.core.designsystem.*
import com.familyos.core.domain.GroceryListItem
import com.familyos.core.domain.MealPlanEntry
import com.familyos.core.domain.MealType

/**
 * Stage 2: Weekly Meal Planner & Grocery List Screen
 */
@Composable
fun MealPlannerScreen(
    mealPlans: List<MealPlanEntry> = sampleMeals,
    groceryItems: List<GroceryListItem> = sampleGroceries,
    onAddMeal: () -> Unit = {},
    onAddGroceryItem: () -> Unit = {},
    onGenerateGroceryList: () -> Unit = {},
    onToggleGroceryPurchased: (String, Boolean) -> Unit = { _, _ -> }
) {
    var activeTab by remember { mutableStateOf("MEALS") }
    var currentWeekOffset by remember { mutableStateOf(0) }

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
                    text = "Weekly Meal Planner",
                    style = MaterialTheme.typography.headlineLarge,
                    color = FamilyOSColors.TextPrimary
                )
                Text(
                    text = "Nutritious household meals & automated grocery lists",
                    style = MaterialTheme.typography.bodySmall,
                    color = FamilyOSColors.TextSecondary
                )
            }

            // Tab Switcher
            Row(
                modifier = Modifier
                    .background(FamilyOSColors.SageLight, FamilyOSShapes.medium)
                    .padding(4.dp)
            ) {
                FilterChip(
                    selected = activeTab == "MEALS",
                    onClick = { activeTab = "MEALS" },
                    label = { Text("Meal Plan") },
                    colors = FilterChipDefaults.filterChipColors(
                        selectedContainerColor = FamilyOSColors.PrimaryForestGreen,
                        selectedLabelColor = androidx.compose.ui.graphics.Color.White
                    )
                )
                Spacer(modifier = Modifier.width(4.dp))
                FilterChip(
                    selected = activeTab == "GROCERIES",
                    onClick = { activeTab = "GROCERIES" },
                    label = { Text("Grocery List (${groceryItems.count { !it.isPurchased }})") },
                    colors = FilterChipDefaults.filterChipColors(
                        selectedContainerColor = FamilyOSColors.PrimaryForestGreen,
                        selectedLabelColor = androidx.compose.ui.graphics.Color.White
                    )
                )
            }
        }

        Spacer(modifier = Modifier.height(FamilyOSSpacing.md))

        if (activeTab == "MEALS") {
            // Week Navigator
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = FamilyOSSpacing.xs),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                IconButton(onClick = { currentWeekOffset-- }) {
                    Icon(Icons.Default.ChevronLeft, contentDescription = "Previous Week")
                }
                Text(
                    text = if (currentWeekOffset == 0) "This Week (Oct 26 - Nov 01)" else "Week ${currentWeekOffset + 43}",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
                IconButton(onClick = { currentWeekOffset++ }) {
                    Icon(Icons.Default.ChevronRight, contentDescription = "Next Week")
                }
            }

            Spacer(modifier = Modifier.height(FamilyOSSpacing.xs))

            // 7 Days Meal Schedule + Scheduled Entries from Room
            LazyColumn(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(FamilyOSSpacing.sm)
            ) {
                if (mealPlans.isNotEmpty()) {
                    item {
                        FamilyOSCard {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    text = "Scheduled Household Meals (${mealPlans.size})",
                                    style = MaterialTheme.typography.titleMedium,
                                    fontWeight = FontWeight.Bold,
                                    color = FamilyOSColors.PrimaryForestGreen
                                )
                                FamilyOSStatusBadge(text = "LIVE SCHEDULE", color = FamilyOSColors.PrimaryForestGreen)
                            }
                            Divider(color = FamilyOSColors.BorderSubtle, modifier = Modifier.padding(vertical = FamilyOSSpacing.xs))
                            mealPlans.forEach { entry ->
                                val detailText = buildString {
                                    append(entry.customMealTitle ?: "Planned Recipe")
                                    append(" (${entry.servings} servings)")
                                    if (!entry.notes.isNullOrBlank()) {
                                        append(" • ${entry.notes}")
                                    }
                                }
                                MealSlotRow(entry.mealType.name, detailText)
                            }
                        }
                    }
                }

                val daysOfWeek = listOf("Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday")
                items(daysOfWeek) { day ->
                    FamilyOSCard {
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
                            FamilyOSStatusBadge(text = "4 Servings Planned", color = FamilyOSColors.SecondarySage)
                        }

                        Divider(color = FamilyOSColors.BorderSubtle, modifier = Modifier.padding(vertical = FamilyOSSpacing.xs))

                        // Meal slots
                        MealSlotRow("Breakfast", "Oatmeal with fresh blueberries & organic honey")
                        MealSlotRow("Lunch", "Mediterranean Quinoa Bowl with grilled chicken")
                        MealSlotRow("Dinner", "Tuscan Garlic Herb Pasta with roasted asparagus")
                    }
                }
            }

            Spacer(modifier = Modifier.height(FamilyOSSpacing.sm))

            // Footer Actions
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(FamilyOSSpacing.sm)
            ) {
                FamilyOSPrimaryButton(
                    text = "Generate Grocery List",
                    icon = Icons.Default.ShoppingCart,
                    onClick = onGenerateGroceryList,
                    modifier = Modifier.weight(1f)
                )
                FamilyOSSecondaryButton(
                    text = "Add Custom Meal",
                    onClick = onAddMeal,
                    modifier = Modifier.weight(1f)
                )
            }
        } else {
            // GROCERIES TAB
            LazyColumn(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(FamilyOSSpacing.xs)
            ) {
                items(groceryItems) { item ->
                    FamilyOSCard(
                        onClick = { onToggleGroceryPurchased(item.id, !item.isPurchased) }
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(
                                imageVector = if (item.isPurchased) Icons.Default.CheckCircle else Icons.Default.RadioButtonUnchecked,
                                contentDescription = if (item.isPurchased) "Mark ${item.itemName} unpurchased" else "Mark ${item.itemName} purchased",
                                tint = if (item.isPurchased) FamilyOSColors.Success else FamilyOSColors.BorderStrong,
                                modifier = Modifier.size(24.dp)
                            )
                            Spacer(modifier = Modifier.width(FamilyOSSpacing.md))
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    text = item.itemName,
                                    style = MaterialTheme.typography.bodyLarge,
                                    fontWeight = FontWeight.Medium,
                                    color = if (item.isPurchased) FamilyOSColors.TextTertiary else FamilyOSColors.TextPrimary
                                )
                                Text(
                                    text = "${item.quantity} ${item.unit} • Category: ${item.category}",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = FamilyOSColors.TextSecondary
                                )
                            }
                            FamilyOSStatusBadge(text = item.category, color = FamilyOSColors.SageGreen)
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(FamilyOSSpacing.sm))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(FamilyOSSpacing.sm)
            ) {
                FamilyOSPrimaryButton(
                    text = "Add Grocery Item",
                    icon = Icons.Default.AddShoppingCart,
                    onClick = onAddGroceryItem,
                    modifier = Modifier.weight(1f)
                )
                FamilyOSSecondaryButton(
                    text = "Sync from Meals",
                    onClick = onGenerateGroceryList,
                    modifier = Modifier.weight(1f)
                )
            }
        }
    }
}

@Composable
private fun MealSlotRow(slot: String, details: String) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp),
        verticalAlignment = Alignment.Top
    ) {
        Text(
            text = slot,
            style = MaterialTheme.typography.labelSmall,
            fontWeight = FontWeight.Bold,
            color = FamilyOSColors.SecondarySage,
            modifier = Modifier.width(80.dp)
        )
        Text(
            text = details,
            style = MaterialTheme.typography.bodyMedium,
            color = FamilyOSColors.TextPrimary,
            modifier = Modifier.weight(1f)
        )
    }
}

private val sampleMeals = listOf(
    MealPlanEntry("mp1", "fam1", System.currentTimeMillis(), MealType.DINNER, "r1", "Tuscan Pasta", 4, null)
)

private val sampleGroceries = listOf(
    GroceryListItem("g1", "fam1", "Organic Penne Pasta", "PANTRY", 2.0, "boxes", false, null),
    GroceryListItem("g2", "fam1", "Extra Virgin Olive Oil", "PANTRY", 1.0, "bottle", false, null),
    GroceryListItem("g3", "fam1", "Fresh Asparagus", "PRODUCE", 1.0, "bunch", true, null),
    GroceryListItem("g4", "fam1", "Parmesan Cheese", "DAIRY", 200.0, "grams", false, null),
    GroceryListItem("g5", "fam1", "Organic Blueberries", "PRODUCE", 2.0, "pints", false, null)
)
