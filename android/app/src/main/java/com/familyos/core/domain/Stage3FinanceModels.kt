package com.familyos.core.domain

/**
 * Pure Kotlin Stage 3 Domain Models for FamilyOS Finance Module
 *
 * CRITICAL RULE: All monetary values are strictly Long integer cents ($1.00 = 100L).
 * Floating-point types (Double, Float) are strictly forbidden in calculations.
 */

enum class AccountType {
    CHECKING,
    SAVINGS,
    CREDIT_CARD,
    INVESTMENT,
    CASH,
    LOAN
}

enum class TransactionType {
    INCOME,
    EXPENSE,
    TRANSFER
}

enum class RecurrenceInterval {
    WEEKLY,
    BIWEEKLY,
    MONTHLY,
    YEARLY
}

data class FinancialAccount(
    val id: String,
    val familyId: String,
    val name: String,
    val accountType: AccountType,
    val currentBalanceCents: Long, // Signed Long cents (liabilities are negative)
    val isLiability: Boolean,
    val currency: String = "USD",
    val institution: String? = null,
    val isArchived: Boolean = false,
    val createdAt: Long,
    val updatedAt: Long
)

data class FinancialTransaction(
    val id: String,
    val familyId: String,
    val accountId: String,
    val destinationAccountId: String? = null, // Set on internal transfer
    val title: String,
    val amountCents: Long, // Positive Long cents
    val transactionType: TransactionType,
    val category: String,
    val transactionDate: Long,
    val isCleared: Boolean = true,
    val isReversal: Boolean = false,
    val reversalOfId: String? = null,
    val notes: String? = null,
    val paidByMemberId: String? = null,
    val idempotencyKey: String? = null,
    val createdAt: Long
)

data class RecurringTransactionTemplate(
    val id: String,
    val familyId: String,
    val accountId: String,
    val title: String,
    val amountCents: Long,
    val transactionType: TransactionType,
    val category: String,
    val recurrenceInterval: RecurrenceInterval,
    val nextDueDate: Long,
    val isActive: Boolean = true,
    val createdAt: Long
)

data class EnvelopeBudget(
    val id: String,
    val familyId: String,
    val category: String,
    val allocatedCents: Long,
    val spentCents: Long = 0L,
    val monthEpoch: Long,
    val alertThresholdPercentage: Int = 85
) {
    val remainingCents: Long
        get() = allocatedCents - spentCents

    val isOverBudget: Boolean
        get() = spentCents > allocatedCents

    val isNearLimit: Boolean
        get() = allocatedCents > 0L && ((spentCents * 100L) / allocatedCents) >= alertThresholdPercentage
}

data class SavingsGoal(
    val id: String,
    val familyId: String,
    val linkedAccountId: String? = null,
    val title: String,
    val targetCents: Long,
    val currentCents: Long = 0L,
    val plannedMonthlyContributionCents: Long = 0L,
    val targetDate: Long? = null,
    val isCompleted: Boolean = false
) {
    val remainingCents: Long
        get() = (targetCents - currentCents).coerceAtLeast(0L)

    val progressPercentage: Int
        get() = if (targetCents <= 0L) 100 else (((currentCents * 100L) / targetCents).coerceIn(0L, 100L)).toInt()
}

data class BillSubscription(
    val id: String,
    val familyId: String,
    val preferredAccountId: String? = null,
    val payee: String,
    val amountCents: Long,
    val billingCycle: String,
    val dueDate: Long,
    val isSubscription: Boolean = false,
    val isAutoPay: Boolean = false,
    val reminderDaysBefore: Int = 3
)

/**
 * Strict Household Cash-Flow Planning Model
 *
 * Formula:
 * Expected Income
 * − Recurring Expenses
 * − Other Planned Expenses
 * = Available Planned Cash Flow
 */
data class CashFlowPlan(
    val expectedIncomeCents: Long,
    val recurringExpensesCents: Long,
    val otherPlannedExpensesCents: Long,
    // Planned allocations (does not trigger real fund transfer)
    val plannedSavingsCents: Long = 0L,
    val plannedEmergencyReserveCents: Long = 0L,
    val plannedPriorityObjectivesCents: Long = 0L
) {
    val availablePlannedCashFlowCents: Long
        get() = expectedIncomeCents - recurringExpensesCents - otherPlannedExpensesCents

    val totalAllocatedCents: Long
        get() = plannedSavingsCents + plannedEmergencyReserveCents + plannedPriorityObjectivesCents

    val unallocatedCashFlowCents: Long
        get() = availablePlannedCashFlowCents - totalAllocatedCents
}

data class NetWorthSummary(
    val totalAssetsCents: Long,
    val totalLiabilitiesCents: Long // Positive magnitude of debt
) {
    val netWorthCents: Long
        get() = totalAssetsCents - totalLiabilitiesCents
}

/**
 * Investment Holding Domain Model (INV-01)
 * Uses fixed-precision microshares (1.000000 share = 1,000,000L microshares).
 * Cost basis & current price in Long integer cents. Zero floating point drift.
 */
data class InvestmentHolding(
    val id: String,
    val familyId: String,
    val accountId: String,
    val symbol: String, // e.g. "VTI", "AAPL", "BTC"
    val assetName: String,
    val assetType: String, // "STOCK", "ETF", "CRYPTO", "MUTUAL_FUND", "BOND", "RETIREMENT"
    val quantityMicroshares: Long, // 1.000000 share = 1,000,000L microshares
    val costBasisCents: Long, // Total cost in Long integer cents
    val currentPriceCents: Long, // Market price per 1.0 whole share in Long integer cents
    val currency: String = "USD",
    val notes: String? = null,
    val lastPriceUpdatedAt: Long = System.currentTimeMillis(),
    val syncStatus: String = "LOCAL_ONLY",
    val isDeleted: Boolean = false,
    val createdAt: Long = System.currentTimeMillis(),
    val updatedAt: Long = System.currentTimeMillis()
) {
    val currentValuationCents: Long
        get() = (quantityMicroshares * currentPriceCents) / 1_000_000L

    val unrealizedGainLossCents: Long
        get() = currentValuationCents - costBasisCents

    val gainLossBasisPoints: Long
        get() = if (costBasisCents <= 0L) 0L else (unrealizedGainLossCents * 10_000L) / costBasisCents
}

/**
 * Strict Financial Precision Utilities for 64-bit Long Integer Math.
 * Guaranteed zero floating-point operations.
 */
object FinancialPrecisionUtils {
    fun formatCents(cents: Long): String {
        val isNegative = cents < 0
        val absCents = kotlin.math.abs(cents)
        val dollars = absCents / 100
        val remainder = absCents % 100
        val formattedDollars = java.text.NumberFormat.getIntegerInstance().format(dollars)
        val formattedCents = String.format("%02d", remainder)
        return "${if (isNegative) "-" else ""}\$$formattedDollars.$formattedCents"
    }

    fun parseDollarsToCents(input: String): Long? {
        val clean = input.replace("$", "").replace(",", "").trim()
        if (clean.isBlank()) return null
        val isNegative = clean.startsWith("-")
        val numericStr = if (isNegative) clean.substring(1) else clean
        val parts = numericStr.split(".")
        val dollars = parts[0].toLongOrNull() ?: return null
        val cents = if (parts.size > 1) {
            val decimal = parts[1].padEnd(2, '0').take(2)
            decimal.toLongOrNull() ?: return null
        } else 0L
        val total = (dollars * 100L) + cents
        return if (isNegative) -total else total
    }

    fun formatMicroshares(microshares: Long): String {
        val isNegative = microshares < 0
        val absMicro = kotlin.math.abs(microshares)
        val whole = absMicro / 1_000_000L
        val fraction = absMicro % 1_000_000L
        val formattedWhole = java.text.NumberFormat.getIntegerInstance().format(whole)
        val formattedFraction = String.format("%06d", fraction)
        return "${if (isNegative) "-" else ""}$formattedWhole.$formattedFraction"
    }

    fun parseSharesToMicroshares(input: String): Long? {
        val clean = input.replace(",", "").trim()
        if (clean.isBlank()) return null
        val isNegative = clean.startsWith("-")
        val numericStr = if (isNegative) clean.substring(1) else clean
        val parts = numericStr.split(".")
        val whole = parts[0].toLongOrNull() ?: return null
        val fraction = if (parts.size > 1) {
            val decimal = parts[1].padEnd(6, '0').take(6)
            decimal.toLongOrNull() ?: return null
        } else 0L
        val total = (whole * 1_000_000L) + fraction
        return if (isNegative) -total else total
    }

    fun formatBasisPoints(basisPoints: Long): String {
        val isNegative = basisPoints < 0
        val absBp = kotlin.math.abs(basisPoints)
        val percent = absBp / 100
        val decimal = absBp % 100
        val formattedPercent = java.text.NumberFormat.getIntegerInstance().format(percent)
        val formattedDecimal = String.format("%02d", decimal)
        return "${if (isNegative) "-" else "+"}$formattedPercent.$formattedDecimal%"
    }

    /**
     * Dynamically computes RGB color values transitioning smoothly from
     * Green (RGB 21, 128, 61) -> Gold (RGB 202, 138, 4) -> Alert Red (RGB 220, 38, 38) -> Crimson (RGB 185, 28, 28)
     * as spending approaches and exceeds defined envelope budget allocations.
     */
    fun getDynamicBudgetRgb(spentCents: Long, allocatedCents: Long): Triple<Int, Int, Int> {
        if (allocatedCents <= 0L) return Triple(21, 128, 61)
        val ratio = (spentCents.toDouble() / allocatedCents.toDouble()).coerceIn(0.0, 1.2)
        return when {
            ratio <= 0.50 -> Triple(21, 128, 61) // Healthy Green
            ratio <= 0.75 -> { // Green -> Gold
                val t = ((ratio - 0.50) / 0.25).toFloat()
                val r = (21 + (202 - 21) * t).toInt()
                val g = (128 + (138 - 128) * t).toInt()
                val b = (61 + (4 - 61) * t).toInt()
                Triple(r, g, b)
            }
            ratio <= 1.00 -> { // Gold -> Alert Red
                val t = ((ratio - 0.75) / 0.25).toFloat()
                val r = (202 + (220 - 202) * t).toInt()
                val g = (138 + (38 - 138) * t).toInt()
                val b = (4 + (38 - 4) * t).toInt()
                Triple(r, g, b)
            }
            else -> Triple(185, 28, 28) // Crimson Red (>100%)
        }
    }

    /**
     * Returns dynamic budget color hex string (e.g. "#15803D", "#CA8A04", "#DC2626").
     */
    fun getDynamicBudgetHex(spentCents: Long, allocatedCents: Long): String {
        val (r, g, b) = getDynamicBudgetRgb(spentCents, allocatedCents)
        return String.format("#%02X%02X%02X", r, g, b)
    }
}

