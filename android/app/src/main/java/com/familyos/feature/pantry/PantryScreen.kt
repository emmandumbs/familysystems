package com.familyos.feature.pantry

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
import com.familyos.core.database.PantryItemEntity
import com.familyos.core.designsystem.*
import java.text.SimpleDateFormat
import java.util.*

/**
 * Stage 2.A: Food Pantry & Fridge Inventory Screen (HSE-04)
 * Tracks quantities, expiry alerts, low-stock warnings, and direct consumption.
 */
@Composable
fun PantryScreen(
    pantryItems: List<PantryItemEntity> = emptyList(),
    onAddItem: () -> Unit = {},
    onConsumeItem: (String, Double) -> Unit = { _, _ -> },
    onDeleteItem: (String) -> Unit = {}
) {
    var selectedCategory by remember { mutableStateOf("ALL") }
    var searchQuery by remember { mutableStateOf("") }

    val categories = listOf("ALL", "FRIDGE", "PANTRY", "FREEZER", "SPICES", "SNACKS")
    val now = System.currentTimeMillis()
    val threeDaysMillis = 3L * 24 * 60 * 60 * 1000

    val filteredItems = remember(pantryItems, selectedCategory, searchQuery) {
        pantryItems.filter { item ->
            val matchesCategory = if (selectedCategory == "ALL") true else item.category.equals(selectedCategory, ignoreCase = true)
            val matchesSearch = if (searchQuery.isBlank()) true else item.itemName.contains(searchQuery, ignoreCase = true) || (item.storageLocation?.contains(searchQuery, ignoreCase = true) == true)
            matchesCategory && matchesSearch
        }
    }

    val expiredCount = remember(pantryItems) {
        pantryItems.count { it.expiryDate != null && it.expiryDate < now }
    }
    val expiringSoonCount = remember(pantryItems) {
        pantryItems.count { it.expiryDate != null && it.expiryDate >= now && it.expiryDate <= (now + threeDaysMillis) }
    }
    val lowStockCount = remember(pantryItems) {
        pantryItems.count { it.quantity <= it.minThreshold }
    }

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
                    text = "Pantry & Fridge Inventory",
                    style = MaterialTheme.typography.headlineLarge,
                    color = FamilyOSColors.TextPrimary
                )
                Text(
                    text = "Real-time stock, expiry tracking & smart restock triggers",
                    style = MaterialTheme.typography.bodySmall,
                    color = FamilyOSColors.TextSecondary
                )
            }
            Button(
                onClick = onAddItem,
                colors = ButtonDefaults.buttonColors(containerColor = FamilyOSColors.PrimaryForestGreen)
            ) {
                Icon(Icons.Default.Add, contentDescription = null, modifier = Modifier.size(18.dp))
                Spacer(modifier = Modifier.width(FamilyOSSpacing.xs))
                Text("Add Item")
            }
        }

        Spacer(modifier = Modifier.height(FamilyOSSpacing.sm))

        // Status Summary Cards
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(FamilyOSSpacing.sm)
        ) {
            Surface(
                modifier = Modifier.weight(1f),
                shape = FamilyOSShapes.medium,
                color = if (expiredCount > 0) FamilyOSColors.AlertContainer else FamilyOSColors.WarmIvoryDark
            ) {
                Column(modifier = Modifier.padding(FamilyOSSpacing.sm), horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        text = "$expiredCount",
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Bold,
                        color = if (expiredCount > 0) FamilyOSColors.Alert else FamilyOSColors.TextPrimary
                    )
                    Text("Expired", style = MaterialTheme.typography.labelSmall, color = FamilyOSColors.TextSecondary)
                }
            }
            Surface(
                modifier = Modifier.weight(1f),
                shape = FamilyOSShapes.medium,
                color = if (expiringSoonCount > 0) FamilyOSColors.GoldContainer else FamilyOSColors.WarmIvoryDark
            ) {
                Column(modifier = Modifier.padding(FamilyOSSpacing.sm), horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        text = "$expiringSoonCount",
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Bold,
                        color = if (expiringSoonCount > 0) Color(0xFFB45309) else FamilyOSColors.TextPrimary
                    )
                    Text("Expiring Soon", style = MaterialTheme.typography.labelSmall, color = FamilyOSColors.TextSecondary)
                }
            }
            Surface(
                modifier = Modifier.weight(1f),
                shape = FamilyOSShapes.medium,
                color = if (lowStockCount > 0) FamilyOSColors.SageLight else FamilyOSColors.WarmIvoryDark
            ) {
                Column(modifier = Modifier.padding(FamilyOSSpacing.sm), horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        text = "$lowStockCount",
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Bold,
                        color = FamilyOSColors.PrimaryForestGreen
                    )
                    Text("Low Stock", style = MaterialTheme.typography.labelSmall, color = FamilyOSColors.TextSecondary)
                }
            }
        }

        Spacer(modifier = Modifier.height(FamilyOSSpacing.sm))

        // Search Bar & Filter Chips
        OutlinedTextField(
            value = searchQuery,
            onValueChange = { searchQuery = it },
            modifier = Modifier.fillMaxWidth(),
            placeholder = { Text("Search ingredients, snacks, dairy...") },
            leadingIcon = { Icon(Icons.Default.Search, contentDescription = null) },
            singleLine = true
        )

        Spacer(modifier = Modifier.height(FamilyOSSpacing.xs))

        Row(
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

        // Inventory List
        if (filteredItems.isEmpty()) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(FamilyOSSpacing.lg),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = if (searchQuery.isNotBlank()) "No items match '$searchQuery'" else "No inventory items in $selectedCategory. Tap 'Add Item' to record ingredients.",
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
                    val isExpired = item.expiryDate != null && item.expiryDate < now
                    val isExpiringSoon = item.expiryDate != null && item.expiryDate >= now && item.expiryDate <= (now + threeDaysMillis)
                    val isLow = item.quantity <= item.minThreshold

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
                                    Text(
                                        text = "Qty: ${item.quantity} ${item.unit}",
                                        style = MaterialTheme.typography.bodySmall,
                                        fontWeight = FontWeight.Medium,
                                        color = if (isLow) FamilyOSColors.Alert else FamilyOSColors.TextPrimary
                                    )
                                    if (item.storageLocation != null) {
                                        Text(
                                            text = " • ${item.storageLocation}",
                                            style = MaterialTheme.typography.bodySmall,
                                            color = FamilyOSColors.TextSecondary
                                        )
                                    }
                                    if (item.expiryDate != null) {
                                        val dateStr = SimpleDateFormat("MMM dd", Locale.getDefault()).format(Date(item.expiryDate))
                                        val badgeColor = when {
                                            isExpired -> FamilyOSColors.Alert
                                            isExpiringSoon -> Color(0xFFB45309)
                                            else -> FamilyOSColors.TextSecondary
                                        }
                                        Text(
                                            text = " • Exp: $dateStr",
                                            style = MaterialTheme.typography.bodySmall,
                                            fontWeight = if (isExpired || isExpiringSoon) FontWeight.Bold else FontWeight.Normal,
                                            color = badgeColor
                                        )
                                    }
                                }
                            }

                            // Quick Actions: Consume 1 unit & Delete
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                OutlinedButton(
                                    onClick = { onConsumeItem(item.id, 1.0) },
                                    contentPadding = PaddingValues(horizontal = 8.dp, vertical = 4.dp),
                                    enabled = item.quantity > 0
                                ) {
                                    Text("Use 1")
                                }
                                IconButton(onClick = { onDeleteItem(item.id) }) {
                                    Icon(
                                        Icons.Default.DeleteOutline,
                                        contentDescription = "Delete",
                                        tint = FamilyOSColors.TextSecondary
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
