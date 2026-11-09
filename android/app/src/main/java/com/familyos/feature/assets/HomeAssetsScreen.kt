package com.familyos.feature.assets

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
import com.familyos.core.domain.*

/**
 * Stage 2: Home Assets, Maintenance & Wishlist Screen
 * Tracks household equipment, warranty expirations, maintenance logs, and exact integer cents costs.
 */
@Composable
fun HomeAssetsScreen(
    assets: List<HomeAsset> = sampleAssets,
    wishlist: List<HouseholdWishlist> = sampleWishlist,
    onAddAsset: () -> Unit = {},
    onAddWishlistItem: () -> Unit = {}
) {
    var activeTab by remember { mutableStateOf("ASSETS") }

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
                    text = "Home Assets & Maintenance",
                    style = MaterialTheme.typography.headlineLarge,
                    color = FamilyOSColors.TextPrimary
                )
                Text(
                    text = "Equipment warranties, maintenance logs & household wishlist",
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
                    selected = activeTab == "ASSETS",
                    onClick = { activeTab = "ASSETS" },
                    label = { Text("Inventory (${assets.size})") },
                    colors = FilterChipDefaults.filterChipColors(
                        selectedContainerColor = FamilyOSColors.PrimaryForestGreen,
                        selectedLabelColor = androidx.compose.ui.graphics.Color.White
                    )
                )
                Spacer(modifier = Modifier.width(4.dp))
                FilterChip(
                    selected = activeTab == "WISHLIST",
                    onClick = { activeTab = "WISHLIST" },
                    label = { Text("Wishlist (${wishlist.size})") },
                    colors = FilterChipDefaults.filterChipColors(
                        selectedContainerColor = FamilyOSColors.PrimaryForestGreen,
                        selectedLabelColor = androidx.compose.ui.graphics.Color.White
                    )
                )
            }
        }

        Spacer(modifier = Modifier.height(FamilyOSSpacing.md))

        if (activeTab == "ASSETS") {
            // Assets List
            LazyColumn(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(FamilyOSSpacing.md)
            ) {
                items(assets) { asset ->
                    val dollars = asset.purchasePriceCents / 100
                    val cents = asset.purchasePriceCents % 100
                    val formattedPrice = "$${dollars}.${cents.toString().padStart(2, '0')}"

                    FamilyOSCard {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    FamilyOSStatusBadge(text = asset.category.name, color = FamilyOSColors.SecondarySage)
                                    if (asset.location != null) {
                                        Spacer(modifier = Modifier.width(FamilyOSSpacing.xs))
                                        FamilyOSStatusBadge(text = asset.location, color = FamilyOSColors.SageLight)
                                    }
                                }
                                Spacer(modifier = Modifier.height(FamilyOSSpacing.xs))
                                Text(
                                    text = asset.name,
                                    style = MaterialTheme.typography.titleLarge,
                                    fontWeight = FontWeight.Bold
                                )
                                if (asset.description != null) {
                                    Text(
                                        text = asset.description,
                                        style = MaterialTheme.typography.bodySmall,
                                        color = FamilyOSColors.TextSecondary
                                    )
                                }
                            }

                            Text(
                                text = formattedPrice,
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Bold,
                                color = FamilyOSColors.PrimaryForestGreen
                            )
                        }

                        Divider(color = FamilyOSColors.BorderSubtle, modifier = Modifier.padding(vertical = FamilyOSSpacing.sm))

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text(
                                text = "🛡️ Warranty active (expires 2028)",
                                style = MaterialTheme.typography.bodySmall,
                                color = FamilyOSColors.Success
                            )
                            Text(
                                text = "Service due: Nov 15",
                                style = MaterialTheme.typography.bodySmall,
                                fontWeight = FontWeight.Bold,
                                color = FamilyOSColors.SoftGold
                            )
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(FamilyOSSpacing.sm))
            FamilyOSPrimaryButton(
                text = "Add Home Asset",
                icon = Icons.Default.Add,
                onClick = onAddAsset,
                modifier = Modifier.fillMaxWidth()
            )
        } else {
            // WISHLIST TAB
            LazyColumn(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(FamilyOSSpacing.sm)
            ) {
                items(wishlist) { item ->
                    val dollars = item.estimatedCostCents / 100
                    val cents = item.estimatedCostCents % 100
                    val formattedPrice = "$${dollars}.${cents.toString().padStart(2, '0')}"

                    FamilyOSCard {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    text = item.itemName,
                                    style = MaterialTheme.typography.titleMedium,
                                    fontWeight = FontWeight.Bold
                                )
                                Text(
                                    text = "Category: ${item.category} • Priority: ${item.priority.name}",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = FamilyOSColors.TextSecondary
                                )
                            }
                            Text(
                                text = formattedPrice,
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Bold,
                                color = FamilyOSColors.SecondarySage
                            )
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(FamilyOSSpacing.sm))
            FamilyOSPrimaryButton(
                text = "Add Wishlist Item",
                icon = Icons.Default.Add,
                onClick = onAddWishlistItem,
                modifier = Modifier.fillMaxWidth()
            )
        }
    }
}

private val sampleAssets = listOf(
    HomeAsset(
        id = "a1",
        familyId = "fam1",
        name = "Bosch 800 Series Dishwasher",
        category = AssetCategory.APPLIANCES,
        description = "Stainless steel quiet cycle dishwasher",
        purchaseDate = System.currentTimeMillis() - 180L * 86_400_000L,
        purchasePriceCents = 129900L, // $1,299.00 exact cents
        warrantyExpiryDate = System.currentTimeMillis() + 500L * 86_400_000L,
        serialNumber = "SHPM78Z55N",
        location = "Kitchen",
        nextMaintenanceDate = System.currentTimeMillis() + 15L * 86_400_000L
    ),
    HomeAsset(
        id = "a2",
        familyId = "fam1",
        name = "Trane High-Efficiency Heat Pump",
        category = AssetCategory.HVAC,
        description = "Variable speed central heating & cooling system",
        purchaseDate = System.currentTimeMillis() - 365L * 86_400_000L,
        purchasePriceCents = 840000L, // $8,400.00 exact cents
        warrantyExpiryDate = System.currentTimeMillis() + 1800L * 86_400_000L,
        serialNumber = "XV20i-4TWR0",
        location = "Exterior Basement",
        nextMaintenanceDate = System.currentTimeMillis() + 45L * 86_400_000L
    )
)

private val sampleWishlist = listOf(
    HouseholdWishlist("w1", "fam1", "Cordless Robotic Pool Cleaner", 69900L, Priority.MEDIUM, "OUTDOORS", null),
    HouseholdWishlist("w2", "fam1", "Ergonomic Adjustable Standing Desk", 45000L, Priority.HIGH, "OFFICE", null)
)
