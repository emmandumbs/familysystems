package com.familyos

import com.familyos.core.domain.AssetCategory
import com.familyos.core.domain.AssetMaintenance
import com.familyos.core.domain.HomeAsset
import org.junit.Assert.*
import org.junit.Test

class Stage2HomeAssetsTest {

    @Test
    fun testAssetPurchasePriceExactCents_ZeroFloatingPoint() {
        // Dishwasher: $1,299.99 = 129999L
        val asset = HomeAsset(
            id = "a1",
            familyId = "fam1",
            name = "Dishwasher",
            category = AssetCategory.APPLIANCES,
            description = null,
            purchaseDate = 1700000000000L,
            purchasePriceCents = 129_999L,
            warrantyExpiryDate = 1800000000000L,
            serialNumber = "XYZ-123",
            location = "Kitchen",
            nextMaintenanceDate = null
        )

        assertEquals(129_999L, asset.purchasePriceCents)

        // Dollars and cents extraction
        val dollars = asset.purchasePriceCents / 100L
        val cents = asset.purchasePriceCents % 100L
        assertEquals(1299L, dollars)
        assertEquals(99L, cents)
    }

    @Test
    fun testMaintenanceCumulativeCostExactCents() {
        val records = listOf(
            AssetMaintenance("m1", "a1", "Filter replacement", 4500L, 1000L, null, null), // $45.00
            AssetMaintenance("m2", "a1", "Motor service", 12000L, 2000L, null, null),      // $120.00
            AssetMaintenance("m3", "a1", "Hose replacement", 1550L, 3000L, null, null)     // $15.50
        )

        val totalCostCents = records.sumOf { it.costCents }
        assertEquals(18_050L, totalCostCents) // $180.50 exact cents
    }

    @Test
    fun testWarrantyExpirationStatus() {
        val now = System.currentTimeMillis()
        val expiredAsset = HomeAsset("a1", "fam1", "Old Toaster", AssetCategory.APPLIANCES, null, null, 4000L, now - 100000L, null, null, null)
        val activeAsset = HomeAsset("a2", "fam1", "New Fridge", AssetCategory.APPLIANCES, null, null, 150000L, now + 100000L, null, null, null)

        assertTrue(expiredAsset.warrantyExpiryDate != null && expiredAsset.warrantyExpiryDate < now)
        assertFalse(activeAsset.warrantyExpiryDate != null && activeAsset.warrantyExpiryDate < now)
    }
}
