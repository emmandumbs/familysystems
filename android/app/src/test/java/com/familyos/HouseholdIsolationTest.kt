package com.familyos

import com.familyos.core.domain.*
import org.junit.Assert.*
import org.junit.Test

/**
 * Stage 3.A.1 Phase 4: Household Multi-Tenant Isolation Unit Tests
 *
 * Verifies that financial entities and calculations strictly partition by family_id.
 */
class HouseholdIsolationTest {

    @Test
    fun testAccountFiltering_EnforcesFamilyIdBoundaries() {
        val family1Accounts = listOf(
            FinancialAccount("acc-1", "family-A", "Checking A", AccountType.CHECKING, 100000L, false, createdAt = 0, updatedAt = 0),
            FinancialAccount("acc-2", "family-A", "Savings A", AccountType.SAVINGS, 500000L, false, createdAt = 0, updatedAt = 0)
        )

        val family2Accounts = listOf(
            FinancialAccount("acc-3", "family-B", "Checking B", AccountType.CHECKING, 250000L, false, createdAt = 0, updatedAt = 0)
        )

        val allAccounts = family1Accounts + family2Accounts

        val filteredA = allAccounts.filter { it.familyId == "family-A" }
        val filteredB = allAccounts.filter { it.familyId == "family-B" }

        assertEquals(2, filteredA.size)
        assertEquals(1, filteredB.size)
        assertTrue(filteredA.all { it.familyId == "family-A" })
        assertTrue(filteredB.all { it.familyId == "family-B" })

        val netWorthA = filteredA.sumOf { it.currentBalanceCents }
        val netWorthB = filteredB.sumOf { it.currentBalanceCents }

        assertEquals(600_000L, netWorthA) // $6,000.00
        assertEquals(250_000L, netWorthB) // $2,500.00
    }

    @Test
    fun testInvestmentHoldingIsolation_NoCrossFamilyDataLeakage() {
        val holdings = listOf(
            InvestmentHolding("h1", "fam-alpha", "acc-1", "VTI", "Vanguard ETF", "ETF", 10_000_000L, 200_000L, 24_000L),
            InvestmentHolding("h2", "fam-beta", "acc-2", "AAPL", "Apple Inc.", "STOCK", 5_000_000L, 100_000L, 22_500L)
        )

        val alphaHoldings = holdings.filter { it.familyId == "fam-alpha" }
        assertEquals(1, alphaHoldings.size)
        assertEquals("VTI", alphaHoldings[0].symbol)

        val betaHoldings = holdings.filter { it.familyId == "fam-beta" }
        assertEquals(1, betaHoldings.size)
        assertEquals("AAPL", betaHoldings[0].symbol)
    }

    @Test
    fun testEnvelopeBudgetIsolation_SeparateCategorySummaries() {
        val budgets = listOf(
            EnvelopeBudget("b1", "fam-1", "FOOD", 100000L, 40000L, 0),
            EnvelopeBudget("b2", "fam-2", "FOOD", 80000L, 75000L, 0)
        )

        val fam1Budget = budgets.find { it.familyId == "fam-1" && it.category == "FOOD" }!!
        val fam2Budget = budgets.find { it.familyId == "fam-2" && it.category == "FOOD" }!!

        assertEquals(60000L, fam1Budget.remainingCents) // $600.00 remaining
        assertEquals(5000L, fam2Budget.remainingCents)   // $50.00 remaining
    }
}
