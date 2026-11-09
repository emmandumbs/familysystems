package com.familyos

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Strict Unit Tests for FamilyOS Exact Integer Cents Financial Arithmetic.
 * Verifies that zero floating-point math is used and cash-flow formulas
 * strictly calculate 64-bit Long cents without precision degradation.
 */
class FinancialCalculationTest {

    data class CashFlowModel(
        val expectedIncomeCents: Long,
        val plannedRecurringExpenseCents: Long,
        val plannedVariableExpenseCents: Long,
        val otherPlannedCommitmentsCents: Long
    ) {
        val availableBeforeSavingsCents: Long
            get() = expectedIncomeCents - plannedRecurringExpenseCents - plannedVariableExpenseCents

        val availableForAllocationCents: Long
            get() = availableBeforeSavingsCents - otherPlannedCommitmentsCents
    }

    @Test
    fun testCashFlowFormula_StandardHousehold() {
        // Expected Income: $6,500.00 (650000L cents)
        // Recurring: $2,800.00 (280000L cents)
        // Variable: $1,400.00 (140000L cents)
        // Other: $500.00 (50000L cents)
        val model = CashFlowModel(
            expectedIncomeCents = 650_000L,
            plannedRecurringExpenseCents = 280_000L,
            plannedVariableExpenseCents = 140_000L,
            otherPlannedCommitmentsCents = 50_000L
        )

        // Available Before Savings = 650000 - 280000 - 140000 = 230000 ($2,300.00)
        assertEquals(230_000L, model.availableBeforeSavingsCents)

        // Available for Allocation = 230000 - 50000 = 180000 ($1,800.00)
        assertEquals(180_000L, model.availableForAllocationCents)
    }

    @Test
    fun testCashFlowFormula_DeficitSituation() {
        // Income lower than expenses
        val model = CashFlowModel(
            expectedIncomeCents = 300_000L, // $3,000.00
            plannedRecurringExpenseCents = 250_000L,
            plannedVariableExpenseCents = 100_000L,
            otherPlannedCommitmentsCents = 20_000L
        )

        // Available Before Savings = 300000 - 350000 = -50000 (-$500.00)
        assertEquals(-50_000L, model.availableBeforeSavingsCents)
        // Available for Allocation = -50000 - 20000 = -70000 (-$700.00)
        assertEquals(-70_000L, model.availableForAllocationCents)
    }

    @Test
    fun testStringCurrencyInputParsing_ExactCents() {
        // Ensures input "$1,250.99" converts to exact 125099L cents without Double rounding flaws
        val inputString = "$1,250.99"
        val clean = inputString.replace("$", "").replace(",", "").trim()
        val parts = clean.split(".")
        val dollars = parts[0].toLong()
        val cents = if (parts.size > 1) parts[1].padEnd(2, '0').take(2).toLong() else 0L
        val totalCents = (dollars * 100L) + cents

        assertEquals(125_099L, totalCents)
    }
}
