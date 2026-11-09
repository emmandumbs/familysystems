package com.familyos

import com.familyos.core.domain.FinancialPrecisionUtils
import com.familyos.core.domain.InvestmentHolding
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/**
 * Stage 3.A.1 Phase 4: Financial Precision & Arithmetic Unit Tests
 *
 * Enforces zero floating-point drift across currency, microshares, and basis points calculations.
 */
class FinancePrecisionTest {

    @Test
    fun testFormatCents_PositiveAndNegative() {
        assertEquals("$12.34", FinancialPrecisionUtils.formatCents(1234L))
        assertEquals("$0.00", FinancialPrecisionUtils.formatCents(0L))
        assertEquals("-$150.75", FinancialPrecisionUtils.formatCents(-15075L))
        assertEquals("$1,250,000.00", FinancialPrecisionUtils.formatCents(125000000L))
    }

    @Test
    fun testParseDollarsToCents_ValidAndInvalidInputs() {
        assertEquals(1234L, FinancialPrecisionUtils.parseDollarsToCents("12.34"))
        assertEquals(1234L, FinancialPrecisionUtils.parseDollarsToCents("$12.34"))
        assertEquals(125099L, FinancialPrecisionUtils.parseDollarsToCents("$1,250.99"))
        assertEquals(50000L, FinancialPrecisionUtils.parseDollarsToCents("500"))
        assertEquals(-15075L, FinancialPrecisionUtils.parseDollarsToCents("-$150.75"))
        assertNull(FinancialPrecisionUtils.parseDollarsToCents("invalid"))
    }

    @Test
    fun testFormatMicroshares_FixedPrecision() {
        // 1.000000 share = 1,000,000L microshares
        assertEquals("1.000000", FinancialPrecisionUtils.formatMicroshares(1_000_000L))
        assertEquals("25.500000", FinancialPrecisionUtils.formatMicroshares(25_500_000L))
        assertEquals("0.125000", FinancialPrecisionUtils.formatMicroshares(125_000L))
        assertEquals("0.000001", FinancialPrecisionUtils.formatMicroshares(1L))
    }

    @Test
    fun testParseSharesToMicroshares_ValidAndInvalidInputs() {
        assertEquals(1_000_000L, FinancialPrecisionUtils.parseSharesToMicroshares("1.0"))
        assertEquals(25_500_000L, FinancialPrecisionUtils.parseSharesToMicroshares("25.500000"))
        assertEquals(125_000L, FinancialPrecisionUtils.parseSharesToMicroshares("0.125"))
        assertNull(FinancialPrecisionUtils.parseSharesToMicroshares("abc"))
    }

    @Test
    fun testFormatBasisPoints_PositiveAndNegative() {
        // 100 basis points = 1.00%
        assertEquals("+1.00%", FinancialPrecisionUtils.formatBasisPoints(100L))
        assertEquals("+11.27%", FinancialPrecisionUtils.formatBasisPoints(1127L))
        assertEquals("-5.50%", FinancialPrecisionUtils.formatBasisPoints(-550L))
        assertEquals("+0.00%", FinancialPrecisionUtils.formatBasisPoints(0L))
    }

    @Test
    fun testInvestmentValuationAndGainLoss_ExactCents() {
        // VTI Example: 25.500000 shares (25_500_000L microshares) @ $240.00 (24,000L cents)
        // Cost Basis: $5,500.00 (550,000L cents)
        val vtiHolding = InvestmentHolding(
            id = "hold-vti",
            familyId = "fam-1",
            accountId = "acc-inv",
            symbol = "VTI",
            assetName = "Vanguard Total Stock Market Index ETF",
            assetType = "ETF",
            quantityMicroshares = 25_500_000L,
            costBasisCents = 550_000L,
            currentPriceCents = 24_000L
        )

        // Expected Valuation = (25,500,000 * 24,000) / 1,000,000 = 612,000L cents ($6,120.00)
        assertEquals(612_000L, vtiHolding.currentValuationCents)

        // Expected Gain/Loss = 612,000 - 550,000 = 62,000L cents ($620.00)
        assertEquals(62_000L, vtiHolding.unrealizedGainLossCents)

        // Gain/Loss Basis Points = (62,000 * 10,000) / 550,000 = 1127 bp (11.27%)
        assertEquals(1127L, vtiHolding.gainLossBasisPoints)
    }

    @Test
    fun testBtcInvestmentValuation_FractionalShares() {
        // BTC Example: 0.125000 BTC (125,000L microshares) @ $65,000.00 (6,500,000L cents)
        // Cost Basis: $6,000.00 (600,000L cents)
        val btcHolding = InvestmentHolding(
            id = "hold-btc",
            familyId = "fam-1",
            accountId = "acc-inv",
            symbol = "BTC",
            assetName = "Bitcoin",
            assetType = "CRYPTO",
            quantityMicroshares = 125_000L,
            costBasisCents = 600_000L,
            currentPriceCents = 6_500_000L
        )

        // Expected Valuation = (125,000 * 6,500,000) / 1,000,000 = 812,500L cents ($8,125.00)
        assertEquals(812_500L, btcHolding.currentValuationCents)

        // Expected Gain/Loss = 812,500 - 600,000 = 212,500L cents ($2,125.00)
        assertEquals(212_500L, btcHolding.unrealizedGainLossCents)

        // Gain/Loss Basis Points = (212,500 * 10,000) / 600,000 = 3541 bp (35.41%)
        assertEquals(3541L, btcHolding.gainLossBasisPoints)
    }

    @Test
    fun testDynamicBudgetColorTransitions() {
        // 0% - 50% spent: Healthy Green (#15803D -> RGB 21, 128, 61)
        val greenRgb = FinancialPrecisionUtils.getDynamicBudgetRgb(spentCents = 200_00L, allocatedCents = 1000_00L) // 20%
        assertEquals(Triple(21, 128, 61), greenRgb)
        assertEquals("#15803D", FinancialPrecisionUtils.getDynamicBudgetHex(200_00L, 1000_00L))

        // 62.5% spent: Halfway between Green and Gold
        val midYellowRgb = FinancialPrecisionUtils.getDynamicBudgetRgb(spentCents = 625_00L, allocatedCents = 1000_00L)
        assertEquals(111, midYellowRgb.first)

        // 87.5% spent: Halfway between Gold and Alert Red
        val midOrangeRgb = FinancialPrecisionUtils.getDynamicBudgetRgb(spentCents = 875_00L, allocatedCents = 1000_00L)
        assertEquals(211, midOrangeRgb.first)

        // 100%+ spent: Crimson Red (#B91C1C -> RGB 185, 28, 28)
        val crimsonRgb = FinancialPrecisionUtils.getDynamicBudgetRgb(spentCents = 1200_00L, allocatedCents = 1000_00L) // 120%
        assertEquals(Triple(185, 28, 28), crimsonRgb)
        assertEquals("#B91C1C", FinancialPrecisionUtils.getDynamicBudgetHex(1200_00L, 1000_00L))
    }
}
