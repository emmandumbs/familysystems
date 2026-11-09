package com.familyos

import com.familyos.core.database.*
import com.familyos.core.data.FinanceRepositoryImpl
import com.familyos.core.domain.*
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.test.runTest
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test

/**
 * Stage 3.A.1 Phase 4: Finance Repository Unit Tests
 *
 * Verifies repository operations, ledger double-entry transfers, audit reversals, and investment holdings.
 */
class FinanceRepositoryTest {

    private lateinit var repository: FinanceRepository
    private val fakeAccounts = mutableListOf<FinancialAccountEntity>()
    private val fakeTransactions = mutableListOf<FinancialTransactionEntity>()
    private val fakeBudgets = mutableListOf<EnvelopeBudgetEntity>()
    private val fakeSavings = mutableListOf<SavingsGoalEntity>()
    private val fakeBills = mutableListOf<BillSubscriptionEntity>()
    private val fakeHoldings = mutableListOf<InvestmentHoldingEntity>()

    private val stubDao = object : FinanceDao {
        override fun observeAccounts(familyId: String) = flowOf(fakeAccounts.filter { it.familyId == familyId && !it.isArchived })
        override suspend fun getAccountsSync(familyId: String) = fakeAccounts.filter { it.familyId == familyId && !it.isArchived }
        override suspend fun getAccountById(accountId: String) = fakeAccounts.find { it.id == accountId }
        override suspend fun insertOrUpdateAccount(account: FinancialAccountEntity) {
            fakeAccounts.removeAll { it.id == account.id }
            fakeAccounts.add(account)
        }
        override suspend fun updateAccountBalance(accountId: String, deltaCents: Long, timestamp: Long) {
            val idx = fakeAccounts.indexOfFirst { it.id == accountId }
            if (idx != -1) {
                val acc = fakeAccounts[idx]
                fakeAccounts[idx] = acc.copy(currentBalanceCents = acc.currentBalanceCents + deltaCents)
            }
        }

        override fun observeTransactions(familyId: String) = flowOf(fakeTransactions.filter { it.familyId == familyId })
        override fun observeTransactionsForAccount(familyId: String, accountId: String) =
            flowOf(fakeTransactions.filter { it.familyId == familyId && it.accountId == accountId })
        override suspend fun getTransactionById(transactionId: String) = fakeTransactions.find { it.id == transactionId }
        override suspend fun getReversalForTransaction(originalTransactionId: String) =
            fakeTransactions.find { it.reversalOfId == originalTransactionId }
        override suspend fun insertTransaction(transaction: FinancialTransactionEntity) {
            fakeTransactions.add(transaction)
        }

        override fun observeRecurringTransactions(familyId: String) = flowOf(emptyList<RecurringTransactionEntity>())
        override suspend fun insertRecurringTransaction(recurring: RecurringTransactionEntity) {}

        override fun observeBudgets(familyId: String) = flowOf(fakeBudgets.filter { it.familyId == familyId })
        override suspend fun insertOrUpdateBudget(budget: EnvelopeBudgetEntity) {
            fakeBudgets.removeAll { it.id == budget.id }
            fakeBudgets.add(budget)
        }

        override fun observeSavingsGoals(familyId: String) = flowOf(fakeSavings.filter { it.familyId == familyId })
        override suspend fun insertOrUpdateSavingsGoal(goal: SavingsGoalEntity) {
            fakeSavings.removeAll { it.id == goal.id }
            fakeSavings.add(goal)
        }
        override suspend fun contributeToSavingsGoal(goalId: String, deltaCents: Long) {
            val idx = fakeSavings.indexOfFirst { it.id == goalId }
            if (idx != -1) {
                val current = fakeSavings[idx]
                fakeSavings[idx] = current.copy(currentCents = current.currentCents + deltaCents)
            }
        }

        override fun observeBills(familyId: String) = flowOf(fakeBills.filter { it.familyId == familyId })
        override suspend fun insertOrUpdateBill(bill: BillSubscriptionEntity) {
            fakeBills.removeAll { it.id == bill.id }
            fakeBills.add(bill)
        }

        override fun observeInvestmentHoldings(familyId: String) = flowOf(fakeHoldings.filter { it.familyId == familyId && !it.isDeleted })
        override suspend fun getInvestmentHoldingsSync(familyId: String) = fakeHoldings.filter { it.familyId == familyId && !it.isDeleted }
        override suspend fun getInvestmentHoldingById(holdingId: String) = fakeHoldings.find { it.id == holdingId }
        override suspend fun getHoldingsForAccount(familyId: String, accountId: String) =
            fakeHoldings.filter { it.familyId == familyId && it.accountId == accountId && !it.isDeleted }
        override suspend fun insertOrUpdateInvestmentHolding(holding: InvestmentHoldingEntity) {
            fakeHoldings.removeAll { it.id == holding.id }
            fakeHoldings.add(holding)
        }
        override suspend fun updateHoldingMarketPrice(holdingId: String, newPriceCents: Long, timestamp: Long) {
            val idx = fakeHoldings.indexOfFirst { it.id == holdingId }
            if (idx != -1) {
                fakeHoldings[idx] = fakeHoldings[idx].copy(currentPriceCents = newPriceCents, lastPriceUpdatedAt = timestamp)
            }
        }
        override suspend fun softDeleteInvestmentHolding(holdingId: String, timestamp: Long) {
            val idx = fakeHoldings.indexOfFirst { it.id == holdingId }
            if (idx != -1) {
                fakeHoldings[idx] = fakeHoldings[idx].copy(isDeleted = true, updatedAt = timestamp)
            }
        }
    }

    @Before
    fun setUp() {
        fakeAccounts.clear()
        fakeTransactions.clear()
        fakeBudgets.clear()
        fakeSavings.clear()
        fakeBills.clear()
        fakeHoldings.clear()

        repository = FinanceRepositoryImpl(stubDao)
    }

    @Test
    fun testAccountCreationAndObservation() = runTest {
        val account = FinancialAccount(
            id = "acc-chk-1",
            familyId = "fam-1",
            name = "Main Checking",
            accountType = AccountType.CHECKING,
            currentBalanceCents = 100000L, // $1,000.00
            isLiability = false,
            createdAt = System.currentTimeMillis(),
            updatedAt = System.currentTimeMillis()
        )

        repository.createAccount(account)

        val observed = repository.observeAccounts("fam-1").first()
        assertEquals(1, observed.size)
        assertEquals("Main Checking", observed[0].name)
        assertEquals(100000L, observed[0].currentBalanceCents)
    }

    @Test
    fun testInternalTransfer_DebitsSourceAndCreditsDestination() = runTest {
        // Source Account: Checking ($1,000.00)
        // Dest Account: Savings ($500.00)
        val source = FinancialAccount("acc-src", "fam-1", "Checking", AccountType.CHECKING, 100000L, false, createdAt = 0, updatedAt = 0)
        val dest = FinancialAccount("acc-dst", "fam-1", "Savings", AccountType.SAVINGS, 50000L, false, createdAt = 0, updatedAt = 0)

        repository.createAccount(source)
        repository.createAccount(dest)

        // Execute $200.00 transfer (20,000L cents)
        repository.recordInternalTransfer("fam-1", "acc-src", "acc-dst", 20000L, "Savings sweep", null)

        val updatedAccounts = repository.observeAccounts("fam-1").first()
        val updatedSrc = updatedAccounts.find { it.id == "acc-src" }!!
        val updatedDst = updatedAccounts.find { it.id == "acc-dst" }!!

        assertEquals(80000L, updatedSrc.currentBalanceCents) // $800.00
        assertEquals(70000L, updatedDst.currentBalanceCents) // $700.00
    }

    @Test
    fun testTransactionReversal_CreatesAuditTrailAndRestoresBalance() = runTest {
        val acc = FinancialAccount("acc-1", "fam-1", "Checking", AccountType.CHECKING, 100000L, false, createdAt = 0, updatedAt = 0)
        repository.createAccount(acc)

        val tx = FinancialTransaction(
            id = "tx-expense-1",
            familyId = "fam-1",
            accountId = "acc-1",
            title = "Hardware Repair",
            amountCents = 15000L, // $150.00
            transactionType = TransactionType.EXPENSE,
            category = "MAINTENANCE",
            transactionDate = System.currentTimeMillis(),
            createdAt = System.currentTimeMillis()
        )

        repository.recordExpense(tx)
        var accounts = repository.observeAccounts("fam-1").first()
        assertEquals(85000L, accounts[0].currentBalanceCents) // $850.00 after expense

        // Reverse transaction
        repository.reverseTransaction("tx-expense-1", "Duplicate charge refunded")

        accounts = repository.observeAccounts("fam-1").first()
        assertEquals(100000L, accounts[0].currentBalanceCents) // Restored back to $1,000.00

        val transactions = repository.observeTransactions("fam-1").first()
        assertEquals(2, transactions.size)
        assertTrue(transactions.any { it.isReversal })
    }

    @Test
    fun testInvestmentHolding_CRUDAndPriceUpdate() = runTest {
        val holding = InvestmentHolding(
            id = "hold-1",
            familyId = "fam-1",
            accountId = "acc-inv",
            symbol = "AAPL",
            assetName = "Apple Inc.",
            assetType = "STOCK",
            quantityMicroshares = 10_000_000L, // 10 whole shares
            costBasisCents = 180_000L, // $1,800.00
            currentPriceCents = 20_000L // $200.00 / share => Valuation $2,000.00
        )

        repository.saveInvestmentHolding(holding)

        var holdings = repository.observeInvestmentHoldings("fam-1").first()
        assertEquals(1, holdings.size)
        assertEquals(200_000L, holdings[0].currentValuationCents)

        // Update price to $225.00 (22,500L cents)
        repository.updateHoldingMarketPrice("hold-1", 22_500L)

        holdings = repository.observeInvestmentHoldings("fam-1").first()
        assertEquals(225_000L, holdings[0].currentValuationCents) // $2,250.00

        // Soft delete holding
        repository.deleteInvestmentHolding("hold-1")
        holdings = repository.observeInvestmentHoldings("fam-1").first()
        assertEquals(0, holdings.size)
    }
}
