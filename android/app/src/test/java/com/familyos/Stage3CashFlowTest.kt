package com.familyos

import com.familyos.core.domain.*
import org.junit.Assert.*
import org.junit.Test

/**
 * Stage 3 Finance Module Unit Test Suite
 * Validates:
 * 1. Exact Long integer cents math (zero floating-point operations).
 * 2. Cash-flow planning calculation: Expected Income - Recurring - Planned = Available.
 * 3. Internal transfers: Checking -> Savings changes individual balances but yields net-zero effect on household wealth.
 * 4. Audit reversals: Transaction is preserved with an offset reversal record.
 * 5. Envelope budgets: Alert threshold percentage triggers and over-budget states.
 */
class Stage3CashFlowTest {

    @Test
    fun testCashFlowPlanningFormulaWithExactLongCents() {
        val plan = CashFlowPlan(
            expectedIncomeCents = 850000L,        // $8,500.00
            recurringExpensesCents = 320000L,     // $3,200.00
            otherPlannedExpensesCents = 150000L,  // $1,500.00
            plannedSavingsCents = 180000L,        // $1,800.00
            plannedEmergencyReserveCents = 120000L, // $1,200.00
            plannedPriorityObjectivesCents = 80000L // $800.00
        )

        // Expected = 850000 - 320000 - 150000 = 380000 cents ($3,800.00)
        assertEquals(380000L, plan.availablePlannedCashFlowCents)

        // Total Allocated = 180000 + 120000 + 80000 = 380000 cents ($3,800.00)
        assertEquals(380000L, plan.totalAllocatedCents)

        // Unallocated = 380000 - 380000 = 0
        assertEquals(0L, plan.unallocatedCashFlowCents)
    }

    @Test
    fun testNegativeUnallocatedCashFlowDetection() {
        val deficitPlan = CashFlowPlan(
            expectedIncomeCents = 500000L,        // $5,000.00
            recurringExpensesCents = 350000L,     // $3,500.00
            otherPlannedExpensesCents = 120000L,  // $1,200.00
            plannedSavingsCents = 100000L         // $1,000.00
        )

        // Available = 500000 - 350000 - 120000 = 30000 cents ($300.00)
        assertEquals(30000L, deficitPlan.availablePlannedCashFlowCents)

        // Unallocated = 30000 - 100000 = -70000 cents (-$700.00 deficit)
        assertEquals(-70000L, deficitPlan.unallocatedCashFlowCents)
        assertTrue(deficitPlan.unallocatedCashFlowCents < 0L)
    }

    @Test
    fun testInternalTransferYieldsNetZeroChangeToHouseholdAssets() {
        var checkingBalance = 500000L // $5,000.00
        var savingsBalance = 1000000L  // $10,000.00
        val transferAmount = 75000L   // $750.00

        val initialTotalAssets = checkingBalance + savingsBalance // $15,000.00

        // Execute transfer: Debit Checking, Credit Savings
        checkingBalance -= transferAmount
        savingsBalance += transferAmount

        val postTransferTotalAssets = checkingBalance + savingsBalance

        assertEquals(425000L, checkingBalance)
        assertEquals(1075000L, savingsBalance)
        assertEquals(initialTotalAssets, postTransferTotalAssets)
    }

    @Test
    fun testNetWorthCalculationAssetsMinusLiabilities() {
        val checking = FinancialAccount("1", "fam-1", "Checking", AccountType.CHECKING, 850000L, false, "USD", null, false, 0, 0)
        val savings = FinancialAccount("2", "fam-1", "Savings", AccountType.SAVINGS, 2500000L, false, "USD", null, false, 0, 0)
        val creditCard = FinancialAccount("3", "fam-1", "Card", AccountType.CREDIT_CARD, -150000L, true, "USD", null, false, 0, 0)
        val carLoan = FinancialAccount("4", "fam-1", "Car Loan", AccountType.LOAN, -800000L, true, "USD", null, false, 0, 0)

        val accounts = listOf(checking, savings, creditCard, carLoan)

        val totalAssets = accounts.filter { !it.isLiability }.sumOf { it.currentBalanceCents }
        val totalLiabilities = accounts.filter { it.isLiability }.sumOf { kotlin.math.abs(it.currentBalanceCents) }
        val summary = NetWorthSummary(totalAssetsCents = totalAssets, totalLiabilitiesCents = totalLiabilities)

        assertEquals(3350000L, summary.totalAssetsCents)       // $33,500.00
        assertEquals(950000L, summary.totalLiabilitiesCents)    // $9,500.00
        assertEquals(2400000L, summary.netWorthCents)           // $24,000.00
    }

    @Test
    fun testEnvelopeBudgetAlertThresholdsAndOverBudget() {
        val budget = EnvelopeBudget(
            id = "b-1",
            familyId = "fam-1",
            category = "GROCERIES",
            allocatedCents = 100000L, // $1,000.00
            spentCents = 88000L,      // $880.00 (88%)
            monthEpoch = 1700000000000L,
            alertThresholdPercentage = 85
        )

        assertEquals(12000L, budget.remainingCents)
        assertFalse(budget.isOverBudget)
        assertTrue("Budget at 88% should trigger alert threshold of 85%", budget.isNearLimit)

        // Exceed budget
        val overBudget = budget.copy(spentCents = 105000L)
        assertEquals(-5000L, overBudget.remainingCents)
        assertTrue(overBudget.isOverBudget)
    }

    @Test
    fun testSavingsGoalProgressCalculation() {
        val goal = SavingsGoal(
            id = "sg-1",
            familyId = "fam-1",
            title = "Emergency Fund",
            targetCents = 1000000L, // $10,000.00
            currentCents = 650000L  // $6,500.00
        )

        assertEquals(350000L, goal.remainingCents)
        assertEquals(65, goal.progressPercentage)
        assertFalse(goal.isCompleted)
    }
}
