package com.familyos.feature.finance

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.familyos.core.designsystem.*
import com.familyos.core.domain.*

/**
 * Stage 3.A.1 Phase 4: Native Android Finance Integration Hub
 *
 * Implements 7 Production-Grade Financial Stewardship Sections:
 * 1. Overview (Net worth, monthly income/expenses, surplus/deficit, remaining budget, cash flow)
 * 2. Accounts (Checking, Savings, Credit, Investment, Cash, Loan + Reconciliation & Add/Transfer)
 * 3. Transactions (Income/Expense ledger, category search, internal transfers, audit reversals)
 * 4. Budgets (Envelope budgets, spent vs allocated in Long cents, threshold alert indicators)
 * 5. Savings (Savings goals, progress %, planned monthly contributions, contribution actions)
 * 6. Recurring (Bills & Subscriptions, cycle, auto-pay status, due date tracking)
 * 7. Investments (Fixed microshares portfolio, cost basis, price/share, valuation, gain/loss, basis points)
 *
 * STRICT PRECISION RULE: All monetary values use 64-bit Long integer cents. Microshares use fixed Longs.
 * Floating-point types (Float, Double) are strictly forbidden for financial calculations.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FinanceScreen(
    accounts: List<FinancialAccount> = defaultSampleAccounts,
    budgets: List<EnvelopeBudget> = defaultSampleBudgets,
    transactions: List<FinancialTransaction> = defaultSampleTransactions,
    bills: List<BillSubscription> = defaultSampleBills,
    savingsGoals: List<SavingsGoal> = defaultSampleSavingsGoals,
    investmentHoldings: List<InvestmentHolding> = defaultSampleInvestmentHoldings,
    members: List<FamilyMember> = emptyList(),
    cashFlowPlan: CashFlowPlan = defaultSampleCashFlowPlan,
    currentRole: FamilyRole = FamilyRole.OWNER,
    onAddAccount: (name: String, institution: String, balanceCents: Long, type: AccountType) -> Unit = { _, _, _, _ -> },
    onAddTransaction: (title: String, amountCents: Long, category: String, type: TransactionType, accountId: String?, paidByMemberId: String?) -> Unit = { _, _, _, _, _, _ -> },
    onTransfer: (amountCents: Long, title: String, sourceAccountId: String?, destinationAccountId: String?) -> Unit = { _, _, _, _ -> },
    onReverseTransaction: (String, String) -> Unit = { _, _ -> },
    onAddBudget: (category: String, allocatedCents: Long, threshold: Int) -> Unit = { _, _, _ -> },
    onAddSavingsGoal: (title: String, targetCents: Long, monthlyCents: Long, linkedAccountId: String?) -> Unit = { _, _, _, _ -> },
    onContributeSavings: (goalId: String, amountCents: Long) -> Unit = { _, _ -> },
    onAddBill: (payee: String, amountCents: Long, cycle: String, isAutoPay: Boolean) -> Unit = { _, _, _, _ -> },
    onAddInvestmentHolding: (symbol: String, name: String, type: String, microshares: Long, costCents: Long, priceCents: Long) -> Unit = { _, _, _, _, _, _ -> },
    onUpdateInvestmentPrice: (holdingId: String, newPriceCents: Long) -> Unit = { _, _ -> },
    onDeleteInvestmentHolding: (holdingId: String) -> Unit = {},
    modifier: Modifier = Modifier
) {
    // Role Security Check
    if (currentRole == FamilyRole.GUEST) {
        RestrictedFinanceView(modifier = modifier)
        return
    }

    var selectedTab by remember { mutableStateOf(0) }
    val tabTitles = listOf(
        "Overview",
        "Accounts",
        "Transactions",
        "Budgets",
        "Savings",
        "Recurring",
        "Investments"
    )

    // Dialog state management
    var showAddAccountDialog by remember { mutableStateOf(false) }
    var showAddTxDialog by remember { mutableStateOf(false) }
    var txDialogType by remember { mutableStateOf(TransactionType.EXPENSE) }
    var showTransferDialog by remember { mutableStateOf(false) }
    var showAddBudgetDialog by remember { mutableStateOf(false) }
    var showAddSavingsDialog by remember { mutableStateOf(false) }
    var showContributeDialog by remember { mutableStateOf<SavingsGoal?>(null) }
    var showAddBillDialog by remember { mutableStateOf(false) }
    var showAddHoldingDialog by remember { mutableStateOf(false) }
    var showUpdatePriceDialog by remember { mutableStateOf<InvestmentHolding?>(null) }
    var showReversalConfirmDialog by remember { mutableStateOf<FinancialTransaction?>(null) }

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(FamilyOSColors.WarmIvoryLight)
    ) {
        // Module Top Header
        Surface(
            color = FamilyOSColors.WarmIvoryLight,
            shadowElevation = 1.dp
        ) {
            Column(modifier = Modifier.padding(horizontal = 20.dp, vertical = 12.dp)) {
                Text(
                    text = "Family Financial Stewardship",
                    style = FamilyOSTypography.headlineMedium,
                    color = FamilyOSColors.ForestGreenDark
                )
                Text(
                    text = "Exact integer-cent accounting • Microshares engine • Role-authorized",
                    style = FamilyOSTypography.bodyMedium,
                    color = FamilyOSColors.MutedCharcoal
                )

                Spacer(modifier = Modifier.height(12.dp))

                ScrollableTabRow(
                    selectedTabIndex = selectedTab,
                    containerColor = Color.Transparent,
                    contentColor = FamilyOSColors.ForestGreenDark,
                    edgePadding = 0.dp
                ) {
                    tabTitles.forEachIndexed { index, title ->
                        Tab(
                            selected = selectedTab == index,
                            onClick = { selectedTab = index },
                            text = {
                                Text(
                                    text = title,
                                    style = FamilyOSTypography.labelLarge,
                                    fontWeight = if (selectedTab == index) FontWeight.Bold else FontWeight.Normal
                                )
                            }
                        )
                    }
                }
            }
        }

        // Tab Content Router
        val dynamicBudgets = remember(budgets, transactions) {
            budgets.map { b ->
                val txSpent = transactions
                    .filter { it.transactionType == TransactionType.EXPENSE && !it.isReversal && it.category.equals(b.category, ignoreCase = true) }
                    .sumOf { it.amountCents }
                b.copy(spentCents = if (txSpent > 0L || transactions.isNotEmpty()) txSpent else b.spentCents)
            }
        }

        Box(modifier = Modifier.fillMaxSize().padding(horizontal = 20.dp, vertical = 16.dp)) {
            when (selectedTab) {
                0 -> FinanceOverviewSection(
                    accounts = accounts,
                    transactions = transactions,
                    budgets = dynamicBudgets,
                    plan = cashFlowPlan
                )
                1 -> FinanceAccountsSection(
                    accounts = accounts,
                    onAddAccountClick = { showAddAccountDialog = true },
                    onTransferClick = { showTransferDialog = true }
                )
                2 -> FinanceTransactionsSection(
                    transactions = transactions,
                    onRecordIncomeClick = {
                        txDialogType = TransactionType.INCOME
                        showAddTxDialog = true
                    },
                    onRecordExpenseClick = {
                        txDialogType = TransactionType.EXPENSE
                        showAddTxDialog = true
                    },
                    onReverseClick = { showReversalConfirmDialog = it }
                )
                3 -> FinanceBudgetsSection(
                    budgets = dynamicBudgets,
                    onAddBudgetClick = { showAddBudgetDialog = true }
                )
                4 -> FinanceSavingsSection(
                    savingsGoals = savingsGoals,
                    onAddGoalClick = { showAddSavingsDialog = true },
                    onContributeClick = { showContributeDialog = it }
                )
                5 -> FinanceRecurringSection(
                    bills = bills,
                    onAddBillClick = { showAddBillDialog = true }
                )
                6 -> FinanceInvestmentsSection(
                    holdings = investmentHoldings,
                    onAddHoldingClick = { showAddHoldingDialog = true },
                    onUpdatePriceClick = { showUpdatePriceDialog = it },
                    onDeleteHolding = onDeleteInvestmentHolding
                )
            }
        }
    }

    // --- DIALOGS ---

    // 1. Add Account Dialog
    if (showAddAccountDialog) {
        AddAccountDialog(
            onDismiss = { showAddAccountDialog = false },
            onConfirm = { name, inst, balanceCents, type ->
                onAddAccount(name, inst, balanceCents, type)
                showAddAccountDialog = false
            }
        )
    }

    // 2. Add Transaction Dialog
    if (showAddTxDialog) {
        AddTransactionDialog(
            type = txDialogType,
            accounts = accounts,
            members = members,
            onDismiss = { showAddTxDialog = false },
            onConfirm = { title, amountCents, category, accountId, paidByMemberId ->
                onAddTransaction(title, amountCents, category, txDialogType, accountId, paidByMemberId)
                showAddTxDialog = false
            }
        )
    }

    // 3. Internal Transfer Dialog
    if (showTransferDialog) {
        InternalTransferDialog(
            accounts = accounts,
            onDismiss = { showTransferDialog = false },
            onConfirm = { amountCents, title, sourceAccountId, destinationAccountId ->
                onTransfer(amountCents, title, sourceAccountId, destinationAccountId)
                showTransferDialog = false
            }
        )
    }

    // 4. Add Budget Dialog
    if (showAddBudgetDialog) {
        AddBudgetDialog(
            onDismiss = { showAddBudgetDialog = false },
            onConfirm = { category, allocatedCents, threshold ->
                onAddBudget(category, allocatedCents, threshold)
                showAddBudgetDialog = false
            }
        )
    }

    // 5. Add Savings Goal Dialog
    if (showAddSavingsDialog) {
        AddSavingsGoalDialog(
            accounts = accounts,
            onDismiss = { showAddSavingsDialog = false },
            onConfirm = { title, targetCents, monthlyCents, linkedAccountId ->
                onAddSavingsGoal(title, targetCents, monthlyCents, linkedAccountId)
                showAddSavingsDialog = false
            }
        )
    }

    // 6. Contribute to Savings Dialog
    showContributeDialog?.let { goal ->
        ContributeSavingsDialog(
            goal = goal,
            onDismiss = { showContributeDialog = null },
            onConfirm = { amountCents ->
                onContributeSavings(goal.id, amountCents)
                showContributeDialog = null
            }
        )
    }

    // 7. Add Bill Dialog
    if (showAddBillDialog) {
        AddBillDialog(
            onDismiss = { showAddBillDialog = false },
            onConfirm = { payee, amountCents, cycle, isAutoPay ->
                onAddBill(payee, amountCents, cycle, isAutoPay)
                showAddBillDialog = false
            }
        )
    }

    // 8. Add Investment Holding Dialog
    if (showAddHoldingDialog) {
        AddInvestmentHoldingDialog(
            onDismiss = { showAddHoldingDialog = false },
            onConfirm = { symbol, name, type, microshares, costCents, priceCents ->
                onAddInvestmentHolding(symbol, name, type, microshares, costCents, priceCents)
                showAddHoldingDialog = false
            }
        )
    }

    // 9. Update Holding Price Dialog
    showUpdatePriceDialog?.let { holding ->
        UpdateHoldingPriceDialog(
            holding = holding,
            onDismiss = { showUpdatePriceDialog = null },
            onConfirm = { newPriceCents ->
                onUpdateInvestmentPrice(holding.id, newPriceCents)
                showUpdatePriceDialog = null
            }
        )
    }

    // 10. Confirm Transaction Reversal Dialog
    showReversalConfirmDialog?.let { tx ->
        AlertDialog(
            onDismissRequest = { showReversalConfirmDialog = null },
            title = { Text("Confirm Audit Reversal", fontWeight = FontWeight.Bold) },
            text = {
                Text("Are you sure you want to reverse '${tx.title}' for ${FinancialPrecisionUtils.formatCents(tx.amountCents)}? This action posts a compensating audit entry and cannot be undone.")
            },
            confirmButton = {
                Button(
                    onClick = {
                        onReverseTransaction(tx.id, "User requested manual reversal")
                        showReversalConfirmDialog = null
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = FamilyOSColors.Alert)
                ) {
                    Text("Post Reversal")
                }
            },
            dismissButton = {
                TextButton(onClick = { showReversalConfirmDialog = null }) {
                    Text("Cancel")
                }
            }
        )
    }
}

// ============================================================================
// SECTION 1: OVERVIEW
// ============================================================================
@Composable
private fun FinanceOverviewSection(
    accounts: List<FinancialAccount>,
    transactions: List<FinancialTransaction>,
    budgets: List<EnvelopeBudget>,
    plan: CashFlowPlan
) {
    val totalAssets = accounts.filter { !it.isLiability }.sumOf { it.currentBalanceCents }
    val totalLiabilities = accounts.filter { it.isLiability }.sumOf { kotlin.math.abs(it.currentBalanceCents) }
    val netWorth = totalAssets - totalLiabilities

    val recordedIncome = transactions.filter { it.transactionType == TransactionType.INCOME && !it.isReversal }.sumOf { it.amountCents }
    val recordedExpenses = transactions.filter { it.transactionType == TransactionType.EXPENSE && !it.isReversal }.sumOf { it.amountCents }
    val netSurplus = recordedIncome - recordedExpenses

    val totalBudgetAllocated = budgets.sumOf { it.allocatedCents }
    val totalBudgetSpent = budgets.sumOf { it.spentCents }
    val remainingBudget = totalBudgetAllocated - totalBudgetSpent

    LazyColumn(verticalArrangement = Arrangement.spacedBy(16.dp)) {
        // Net Worth Card
        item {
            FamilyOSCard(
                title = "Household Net Worth",
                subtitle = "Liquid Assets − Total Household Liabilities",
                badgeText = "AUDITED"
            ) {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(
                        text = FinancialPrecisionUtils.formatCents(netWorth),
                        style = FamilyOSTypography.displayLarge,
                        color = FamilyOSColors.ForestGreenDark,
                        fontWeight = FontWeight.Bold
                    )
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text(
                            text = "Total Assets: ${FinancialPrecisionUtils.formatCents(totalAssets)}",
                            style = FamilyOSTypography.bodyMedium,
                            color = FamilyOSColors.ForestGreenMedium
                        )
                        Text(
                            text = "Total Liabilities: ${FinancialPrecisionUtils.formatCents(totalLiabilities)}",
                            style = FamilyOSTypography.bodyMedium,
                            color = FamilyOSColors.Alert
                        )
                    }
                }
            }
        }

        // Monthly Income vs Expense Grid
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Card(
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(12.dp),
                    colors = CardDefaults.cardColors(containerColor = Color.White),
                    elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
                ) {
                    Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Text("Recorded Income", style = FamilyOSTypography.bodySmall, color = FamilyOSColors.MutedCharcoal)
                        Text(
                            text = FinancialPrecisionUtils.formatCents(recordedIncome),
                            style = FamilyOSTypography.titleLarge,
                            fontWeight = FontWeight.Bold,
                            color = FamilyOSColors.ForestGreenDark
                        )
                    }
                }
                Card(
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(12.dp),
                    colors = CardDefaults.cardColors(containerColor = Color.White),
                    elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
                ) {
                    Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Text("Recorded Expenses", style = FamilyOSTypography.bodySmall, color = FamilyOSColors.MutedCharcoal)
                        Text(
                            text = FinancialPrecisionUtils.formatCents(recordedExpenses),
                            style = FamilyOSTypography.titleLarge,
                            fontWeight = FontWeight.Bold,
                            color = FamilyOSColors.Alert
                        )
                    }
                }
            }
        }

        // Monthly Surplus / Remaining Budget Card
        item {
            FamilyOSCard(
                title = "Monthly Cash Surplus & Envelope Balance",
                subtitle = "Actual Surplus: ${FinancialPrecisionUtils.formatCents(netSurplus)}"
            ) {
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text("Remaining Envelope Budget", style = FamilyOSTypography.bodyMedium, fontWeight = FontWeight.SemiBold)
                        Text(
                            text = FinancialPrecisionUtils.formatCents(remainingBudget),
                            style = FamilyOSTypography.titleMedium,
                            fontWeight = FontWeight.Bold,
                            color = if (remainingBudget >= 0) FamilyOSColors.ForestGreenDark else FamilyOSColors.Alert
                        )
                    }
                    val overviewProgressColor = remember(totalBudgetSpent, totalBudgetAllocated) {
                        val (r, g, b) = FinancialPrecisionUtils.getDynamicBudgetRgb(totalBudgetSpent, totalBudgetAllocated)
                        Color(r, g, b)
                    }
                    LinearProgressIndicator(
                        progress = { if (totalBudgetAllocated > 0) (totalBudgetSpent.toFloat() / totalBudgetAllocated.toFloat()).coerceIn(0f, 1f) else 0f },
                        modifier = Modifier.fillMaxWidth().height(8.dp).clip(RoundedCornerShape(4.dp)),
                        color = overviewProgressColor,
                        trackColor = FamilyOSColors.WarmIvoryDark
                    )
                }
            }
        }

        // Cash-Flow Planner Summary
        item {
            FamilyOSCard(
                title = "Monthly Cash-Flow Summary",
                subtitle = "Planned household allocations for current cycle"
            ) {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    CashFlowRow("1. Expected Monthly Income", plan.expectedIncomeCents, FamilyOSColors.ForestGreenDark, true)
                    CashFlowRow("2. Fixed Recurring Expenses", -plan.recurringExpensesCents, FamilyOSColors.Alert, false)
                    CashFlowRow("3. Variable Planned Expenses", -plan.otherPlannedExpensesCents, Color(0xFFD35400), false)
                    HorizontalDivider(color = FamilyOSColors.SageMedium.copy(alpha = 0.3f))
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text("= Available Planned Cash Flow", style = FamilyOSTypography.titleMedium, fontWeight = FontWeight.Bold)
                        Text(
                            text = FinancialPrecisionUtils.formatCents(plan.availablePlannedCashFlowCents),
                            style = FamilyOSTypography.titleMedium,
                            fontWeight = FontWeight.Bold,
                            color = FamilyOSColors.ForestGreenDark
                        )
                    }
                }
            }
        }
    }
}

// ============================================================================
// SECTION 2: ACCOUNTS
// ============================================================================
@Composable
private fun FinanceAccountsSection(
    accounts: List<FinancialAccount>,
    onAddAccountClick: () -> Unit,
    onTransferClick: () -> Unit
) {
    LazyColumn(verticalArrangement = Arrangement.spacedBy(14.dp)) {
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text("Financial Accounts", style = FamilyOSTypography.titleLarge, fontWeight = FontWeight.Bold)
                    Text("Checking, Savings, Credit Cards, Investments & Loans", style = FamilyOSTypography.bodySmall, color = FamilyOSColors.MutedCharcoal)
                }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    FamilyOSPrimaryButton(text = "+ Account", onClick = onAddAccountClick)
                    Button(
                        onClick = onTransferClick,
                        colors = ButtonDefaults.buttonColors(containerColor = FamilyOSColors.SoftGoldDark)
                    ) {
                        Text("Transfer")
                    }
                }
            }
        }

        items(accounts) { acc ->
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp),
                colors = CardDefaults.cardColors(containerColor = Color.White),
                elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth().padding(16.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(text = acc.name, style = FamilyOSTypography.titleMedium, fontWeight = FontWeight.Bold)
                        Text(
                            text = "${acc.accountType.name} • ${acc.institution ?: "Local Institution"}",
                            style = FamilyOSTypography.bodySmall,
                            color = FamilyOSColors.MutedCharcoal
                        )
                    }
                    Text(
                        text = FinancialPrecisionUtils.formatCents(acc.currentBalanceCents),
                        style = FamilyOSTypography.titleLarge,
                        fontWeight = FontWeight.Bold,
                        color = if (acc.isLiability) FamilyOSColors.Alert else FamilyOSColors.ForestGreenDark
                    )
                }
            }
        }
    }
}

// ============================================================================
// SECTION 3: TRANSACTIONS
// ============================================================================
@Composable
private fun FinanceTransactionsSection(
    transactions: List<FinancialTransaction>,
    onRecordIncomeClick: () -> Unit,
    onRecordExpenseClick: () -> Unit,
    onReverseClick: (FinancialTransaction) -> Unit
) {
    var filterCategory by remember { mutableStateOf("ALL") }

    val filteredTransactions = remember(transactions, filterCategory) {
        if (filterCategory == "ALL") transactions
        else transactions.filter { it.category.equals(filterCategory, ignoreCase = true) }
    }

    LazyColumn(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text("Transaction Ledger", style = FamilyOSTypography.titleLarge, fontWeight = FontWeight.Bold)
                    Text("Manual recording with audit trail reversals", style = FamilyOSTypography.bodySmall, color = FamilyOSColors.MutedCharcoal)
                }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Button(
                        onClick = onRecordIncomeClick,
                        colors = ButtonDefaults.buttonColors(containerColor = FamilyOSColors.ForestGreenDark)
                    ) {
                        Text("+ Income")
                    }
                    Button(
                        onClick = onRecordExpenseClick,
                        colors = ButtonDefaults.buttonColors(containerColor = FamilyOSColors.Alert)
                    ) {
                        Text("- Expense")
                    }
                }
            }
        }

        items(filteredTransactions) { tx ->
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp),
                colors = CardDefaults.cardColors(containerColor = Color.White),
                elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth().padding(16.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(
                        modifier = Modifier.weight(1f),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        Icon(
                            imageVector = when (tx.transactionType) {
                                TransactionType.INCOME -> Icons.Default.ArrowDownward
                                TransactionType.EXPENSE -> Icons.Default.ArrowUpward
                                TransactionType.TRANSFER -> Icons.Default.SwapHoriz
                            },
                            contentDescription = null,
                            tint = when (tx.transactionType) {
                                TransactionType.INCOME -> FamilyOSColors.ForestGreenMedium
                                TransactionType.EXPENSE -> if (tx.isReversal) Color(0xFF2980B9) else FamilyOSColors.Alert
                                TransactionType.TRANSFER -> FamilyOSColors.SoftGoldDark
                            }
                        )
                        Column {
                            Text(text = tx.title, style = FamilyOSTypography.bodyLarge, fontWeight = FontWeight.SemiBold)
                            Text(
                                text = "${tx.category} • ${if (tx.isReversal) "AUDIT REVERSAL" else "Posted"}",
                                style = FamilyOSTypography.bodySmall,
                                color = if (tx.isReversal) Color(0xFF2980B9) else FamilyOSColors.MutedCharcoal
                            )
                        }
                    }

                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text(
                            text = "${if (tx.transactionType == TransactionType.INCOME) "+" else "-"}${FinancialPrecisionUtils.formatCents(tx.amountCents)}",
                            style = FamilyOSTypography.titleMedium,
                            fontWeight = FontWeight.Bold,
                            color = when (tx.transactionType) {
                                TransactionType.INCOME -> FamilyOSColors.ForestGreenDark
                                TransactionType.EXPENSE -> if (tx.isReversal) Color(0xFF2980B9) else FamilyOSColors.Alert
                                TransactionType.TRANSFER -> FamilyOSColors.ForestGreenDark
                            }
                        )
                        if (!tx.isReversal) {
                            IconButton(onClick = { onReverseClick(tx) }) {
                                Icon(
                                    imageVector = Icons.Default.Undo,
                                    contentDescription = "Reverse",
                                    tint = FamilyOSColors.MutedCharcoal
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

// ============================================================================
// SECTION 4: BUDGETS
// ============================================================================
@Composable
private fun FinanceBudgetsSection(
    budgets: List<EnvelopeBudget>,
    onAddBudgetClick: () -> Unit
) {
    LazyColumn(verticalArrangement = Arrangement.spacedBy(14.dp)) {
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text("Envelope Budgets", style = FamilyOSTypography.titleLarge, fontWeight = FontWeight.Bold)
                    Text("Category spending caps & threshold alerts", style = FamilyOSTypography.bodySmall, color = FamilyOSColors.MutedCharcoal)
                }
                FamilyOSPrimaryButton(text = "+ Envelope", onClick = onAddBudgetClick)
            }
        }

        items(budgets) { budget ->
            val progress = (if (budget.allocatedCents > 0) (budget.spentCents.toFloat() / budget.allocatedCents.toFloat()) else 0f).coerceIn(0f, 1f)
            val isOver = budget.isOverBudget
            val isNear = budget.isNearLimit
            val dynamicProgressColor = remember(budget.spentCents, budget.allocatedCents) {
                val (r, g, b) = FinancialPrecisionUtils.getDynamicBudgetRgb(budget.spentCents, budget.allocatedCents)
                Color(r, g, b)
            }

            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp),
                colors = CardDefaults.cardColors(containerColor = Color.White),
                elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
            ) {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(10.dp)
                                    .clip(CircleShape)
                                    .background(dynamicProgressColor)
                            )
                            Text(text = budget.category, style = FamilyOSTypography.titleMedium, fontWeight = FontWeight.Bold)
                        }
                        Text(
                            text = "${FinancialPrecisionUtils.formatCents(budget.spentCents)} of ${FinancialPrecisionUtils.formatCents(budget.allocatedCents)}",
                            style = FamilyOSTypography.bodyMedium,
                            fontWeight = FontWeight.SemiBold
                        )
                    }

                    LinearProgressIndicator(
                        progress = { progress },
                        modifier = Modifier.fillMaxWidth().height(8.dp).clip(RoundedCornerShape(4.dp)),
                        color = dynamicProgressColor,
                        trackColor = FamilyOSColors.WarmIvoryDark
                    )

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text(
                            text = if (isOver) "Over budget by ${FinancialPrecisionUtils.formatCents(budget.spentCents - budget.allocatedCents)}"
                            else "Remaining: ${FinancialPrecisionUtils.formatCents(budget.remainingCents)}",
                            style = FamilyOSTypography.bodySmall,
                            color = if (isOver) FamilyOSColors.Alert else dynamicProgressColor,
                            fontWeight = FontWeight.SemiBold
                        )
                        if (isOver) {
                            Text(
                                text = "OVER BUDGET (≥100%)",
                                style = FamilyOSTypography.bodySmall,
                                color = FamilyOSColors.Alert,
                                fontWeight = FontWeight.Bold
                            )
                        } else if (isNear) {
                            Text(
                                text = "Near alert limit (${budget.alertThresholdPercentage}%)",
                                style = FamilyOSTypography.bodySmall,
                                color = dynamicProgressColor,
                                fontWeight = FontWeight.Bold
                            )
                        } else {
                            Text(
                                text = "Within Envelope Limit",
                                style = FamilyOSTypography.bodySmall,
                                color = FamilyOSColors.MutedCharcoal
                            )
                        }
                    }
                }
            }
        }
    }
}

// ============================================================================
// SECTION 5: SAVINGS
// ============================================================================
@Composable
private fun FinanceSavingsSection(
    savingsGoals: List<SavingsGoal>,
    onAddGoalClick: () -> Unit,
    onContributeClick: (SavingsGoal) -> Unit
) {
    LazyColumn(verticalArrangement = Arrangement.spacedBy(14.dp)) {
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text("Savings & Priority Goals", style = FamilyOSTypography.titleLarge, fontWeight = FontWeight.Bold)
                    Text("Long-term education, reserves & family targets", style = FamilyOSTypography.bodySmall, color = FamilyOSColors.MutedCharcoal)
                }
                FamilyOSPrimaryButton(text = "+ Savings Goal", onClick = onAddGoalClick)
            }
        }

        items(savingsGoals) { goal ->
            val progressPercent = goal.progressPercentage

            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp),
                colors = CardDefaults.cardColors(containerColor = Color.White),
                elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
            ) {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(text = goal.title, style = FamilyOSTypography.titleMedium, fontWeight = FontWeight.Bold)
                            Text(
                                text = "Planned monthly: ${FinancialPrecisionUtils.formatCents(goal.plannedMonthlyContributionCents)}/mo",
                                style = FamilyOSTypography.bodySmall,
                                color = FamilyOSColors.MutedCharcoal
                            )
                        }
                        Button(
                            onClick = { onContributeClick(goal) },
                            colors = ButtonDefaults.buttonColors(containerColor = FamilyOSColors.ForestGreenDark)
                        ) {
                            Text("Contribute")
                        }
                    }

                    LinearProgressIndicator(
                        progress = { progressPercent / 100f },
                        modifier = Modifier.fillMaxWidth().height(8.dp).clip(RoundedCornerShape(4.dp)),
                        color = FamilyOSColors.SoftGoldDark,
                        trackColor = FamilyOSColors.WarmIvoryDark
                    )

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text(
                            text = "${FinancialPrecisionUtils.formatCents(goal.currentCents)} of ${FinancialPrecisionUtils.formatCents(goal.targetCents)}",
                            style = FamilyOSTypography.bodySmall,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            text = "$progressPercent% Completed",
                            style = FamilyOSTypography.bodySmall,
                            color = FamilyOSColors.ForestGreenDark,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            }
        }
    }
}

// ============================================================================
// SECTION 6: RECURRING
// ============================================================================
@Composable
private fun FinanceRecurringSection(
    bills: List<BillSubscription>,
    onAddBillClick: () -> Unit
) {
    LazyColumn(verticalArrangement = Arrangement.spacedBy(14.dp)) {
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text("Recurring Bills & Subscriptions", style = FamilyOSTypography.titleLarge, fontWeight = FontWeight.Bold)
                    Text("Separated from posted ledger until paid", style = FamilyOSTypography.bodySmall, color = FamilyOSColors.MutedCharcoal)
                }
                FamilyOSPrimaryButton(text = "+ Bill / Sub", onClick = onAddBillClick)
            }
        }

        items(bills) { bill ->
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp),
                colors = CardDefaults.cardColors(containerColor = Color.White),
                elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth().padding(16.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(text = bill.payee, style = FamilyOSTypography.titleMedium, fontWeight = FontWeight.Bold)
                        Text(
                            text = "${bill.billingCycle} • ${if (bill.isAutoPay) "Auto-Pay Active" else "Manual Payment"}",
                            style = FamilyOSTypography.bodySmall,
                            color = FamilyOSColors.MutedCharcoal
                        )
                    }
                    Text(
                        text = FinancialPrecisionUtils.formatCents(bill.amountCents),
                        style = FamilyOSTypography.titleLarge,
                        fontWeight = FontWeight.Bold,
                        color = FamilyOSColors.ForestGreenDark
                    )
                }
            }
        }
    }
}

// ============================================================================
// SECTION 7: INVESTMENTS (INV-01)
// ============================================================================
@Composable
private fun FinanceInvestmentsSection(
    holdings: List<InvestmentHolding>,
    onAddHoldingClick: () -> Unit,
    onUpdatePriceClick: (InvestmentHolding) -> Unit,
    onDeleteHolding: (String) -> Unit
) {
    val totalCostBasis = holdings.sumOf { it.costBasisCents }
    val totalValuation = holdings.sumOf { it.currentValuationCents }
    val totalGainLoss = totalValuation - totalCostBasis
    val totalReturnBasisPoints = if (totalCostBasis > 0) (totalGainLoss * 10_000L) / totalCostBasis else 0L

    LazyColumn(verticalArrangement = Arrangement.spacedBy(14.dp)) {
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text("Investment Portfolio", style = FamilyOSTypography.titleLarge, fontWeight = FontWeight.Bold)
                    Text("Microshares fixed-precision asset engine", style = FamilyOSTypography.bodySmall, color = FamilyOSColors.MutedCharcoal)
                }
                FamilyOSPrimaryButton(text = "+ Holding", onClick = onAddHoldingClick)
            }
        }

        // Portfolio Total Valuation Card
        item {
            FamilyOSCard(
                title = "Total Portfolio Valuation",
                subtitle = "Sum of Microshares × Current Market Price Cents",
                badgeText = "EXACT CENTS"
            ) {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(
                        text = FinancialPrecisionUtils.formatCents(totalValuation),
                        style = FamilyOSTypography.displayLarge,
                        color = FamilyOSColors.ForestGreenDark,
                        fontWeight = FontWeight.Bold
                    )
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text(
                            text = "Cost Basis: ${FinancialPrecisionUtils.formatCents(totalCostBasis)}",
                            style = FamilyOSTypography.bodyMedium,
                            color = FamilyOSColors.MutedCharcoal
                        )
                        Text(
                            text = "Gain/Loss: ${FinancialPrecisionUtils.formatCents(totalGainLoss)} (${FinancialPrecisionUtils.formatBasisPoints(totalReturnBasisPoints)})",
                            style = FamilyOSTypography.bodyMedium,
                            fontWeight = FontWeight.Bold,
                            color = if (totalGainLoss >= 0) FamilyOSColors.ForestGreenDark else FamilyOSColors.Alert
                        )
                    }
                }
            }
        }

        items(holdings) { holding ->
            val valCents = holding.currentValuationCents
            val gainLossCents = holding.unrealizedGainLossCents
            val bp = holding.gainLossBasisPoints

            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp),
                colors = CardDefaults.cardColors(containerColor = Color.White),
                elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
            ) {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            Surface(
                                color = FamilyOSColors.ForestGreenDark,
                                shape = RoundedCornerShape(6.dp)
                            ) {
                                Text(
                                    text = holding.symbol,
                                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                                    style = FamilyOSTypography.labelLarge,
                                    color = Color.White,
                                    fontWeight = FontWeight.Bold
                                )
                            }
                            Column {
                                Text(text = holding.assetName, style = FamilyOSTypography.titleMedium, fontWeight = FontWeight.Bold)
                                Text(text = "${holding.assetType} • ${FinancialPrecisionUtils.formatMicroshares(holding.quantityMicroshares)} shares", style = FamilyOSTypography.bodySmall, color = FamilyOSColors.MutedCharcoal)
                            }
                        }

                        Text(
                            text = FinancialPrecisionUtils.formatCents(valCents),
                            style = FamilyOSTypography.titleLarge,
                            fontWeight = FontWeight.Bold,
                            color = FamilyOSColors.ForestGreenDark
                        )
                    }

                    HorizontalDivider(color = FamilyOSColors.WarmIvoryDark)

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column {
                            Text(
                                text = "Market Price: ${FinancialPrecisionUtils.formatCents(holding.currentPriceCents)}/share",
                                style = FamilyOSTypography.bodySmall,
                                color = FamilyOSColors.MutedCharcoal
                            )
                            Text(
                                text = "Gain/Loss: ${FinancialPrecisionUtils.formatCents(gainLossCents)} (${FinancialPrecisionUtils.formatBasisPoints(bp)})",
                                style = FamilyOSTypography.bodySmall,
                                fontWeight = FontWeight.Bold,
                                color = if (gainLossCents >= 0) FamilyOSColors.ForestGreenDark else FamilyOSColors.Alert
                            )
                        }

                        Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                            IconButton(onClick = { onUpdatePriceClick(holding) }) {
                                Icon(imageVector = Icons.Default.Edit, contentDescription = "Update Price", tint = FamilyOSColors.ForestGreenDark)
                            }
                            IconButton(onClick = { onDeleteHolding(holding.id) }) {
                                Icon(imageVector = Icons.Default.Delete, contentDescription = "Delete Holding", tint = FamilyOSColors.Alert)
                            }
                        }
                    }
                }
            }
        }
    }
}

// ============================================================================
// RESTRICTED ACCESS VIEW (RBAC)
// ============================================================================
@Composable
private fun RestrictedFinanceView(modifier: Modifier = Modifier) {
    Box(
        modifier = modifier.fillMaxSize().background(FamilyOSColors.WarmIvoryLight),
        contentAlignment = Alignment.Center
    ) {
        Card(
            modifier = Modifier.padding(24.dp).fillMaxWidth(),
            shape = RoundedCornerShape(16.dp),
            colors = CardDefaults.cardColors(containerColor = Color.White),
            elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
        ) {
            Column(
                modifier = Modifier.padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Icon(
                    imageVector = Icons.Default.Lock,
                    contentDescription = "Restricted Access",
                    tint = FamilyOSColors.Alert,
                    modifier = Modifier.size(48.dp)
                )
                Text(
                    text = "Restricted Financial Access",
                    style = FamilyOSTypography.titleLarge,
                    fontWeight = FontWeight.Bold,
                    color = FamilyOSColors.ForestGreenDark
                )
                Text(
                    text = "Household financial statements, budgets, and investment portfolios are restricted to adult Family Members and Owners. Please switch your active profile to access financial stewardship.",
                    style = FamilyOSTypography.bodyMedium,
                    color = FamilyOSColors.MutedCharcoal
                )
            }
        }
    }
}

// ============================================================================
// DIALOG COMPOSABLES
// ============================================================================

@Composable
private fun AddAccountDialog(
    onDismiss: () -> Unit,
    onConfirm: (name: String, institution: String, balanceCents: Long, type: AccountType) -> Unit
) {
    var name by remember { mutableStateOf("") }
    var institution by remember { mutableStateOf("") }
    var balanceStr by remember { mutableStateOf("") }
    var selectedType by remember { mutableStateOf(AccountType.CHECKING) }
    val isLiability = selectedType == AccountType.CREDIT_CARD || selectedType == AccountType.LOAN

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Add Financial Account", fontWeight = FontWeight.Bold) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text("Account Name") },
                    modifier = Modifier.fillMaxWidth()
                )
                Text("Account Type (${if (isLiability) "Liability • Auto-set is_liability=true" else "Asset"}):", style = FamilyOSTypography.labelSmall)
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    listOf(
                        AccountType.CHECKING,
                        AccountType.SAVINGS,
                        AccountType.CREDIT_CARD,
                        AccountType.INVESTMENT,
                        AccountType.LOAN
                    ).forEach { accType ->
                        FilterChip(
                            selected = selectedType == accType,
                            onClick = { selectedType = accType },
                            label = { Text(accType.name.replace("_", " "), style = FamilyOSTypography.labelSmall) }
                        )
                    }
                }
                OutlinedTextField(
                    value = institution,
                    onValueChange = { institution = it },
                    label = { Text("Institution (e.g., Chase, Ally)") },
                    modifier = Modifier.fillMaxWidth()
                )
                OutlinedTextField(
                    value = balanceStr,
                    onValueChange = { balanceStr = it },
                    label = { Text("Initial Balance (Integer Cents or $)") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    modifier = Modifier.fillMaxWidth()
                )
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    val cents = FinancialPrecisionUtils.parseDollarsToCents(balanceStr)
                        ?: balanceStr.trim().toLongOrNull()
                        ?: 0L
                    onConfirm(name.ifBlank { "New Account" }, institution.ifBlank { "Local" }, cents, selectedType)
                },
                colors = ButtonDefaults.buttonColors(containerColor = FamilyOSColors.ForestGreenDark)
            ) {
                Text("Add Account")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Cancel") }
        }
    )
}

@Composable
private fun AddTransactionDialog(
    type: TransactionType,
    accounts: List<FinancialAccount>,
    members: List<FamilyMember>,
    onDismiss: () -> Unit,
    onConfirm: (title: String, amountCents: Long, category: String, accountId: String?, paidByMemberId: String?) -> Unit
) {
    var title by remember { mutableStateOf("") }
    var amountStr by remember { mutableStateOf("") }
    var category by remember { mutableStateOf(if (type == TransactionType.INCOME) "SALARY" else "FOOD") }
    var selectedAccountId by remember(accounts) { mutableStateOf(accounts.firstOrNull()?.id) }
    var selectedMemberId by remember(members) { mutableStateOf(members.firstOrNull()?.id) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Record ${type.name.lowercase().replaceFirstChar { it.uppercase() }}", fontWeight = FontWeight.Bold) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                OutlinedTextField(
                    value = title,
                    onValueChange = { title = it },
                    label = { Text("Title / Merchant") },
                    modifier = Modifier.fillMaxWidth()
                )
                if (accounts.isNotEmpty()) {
                    Text("Account (account_id):", style = FamilyOSTypography.labelSmall)
                    Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                        accounts.take(4).forEach { acc ->
                            FilterChip(
                                selected = selectedAccountId == acc.id,
                                onClick = { selectedAccountId = acc.id },
                                label = { Text(acc.name.take(12), style = FamilyOSTypography.labelSmall) }
                            )
                        }
                    }
                }
                OutlinedTextField(
                    value = amountStr,
                    onValueChange = { amountStr = it },
                    label = { Text("Amount ($ or integer cents)") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    modifier = Modifier.fillMaxWidth()
                )
                OutlinedTextField(
                    value = category,
                    onValueChange = { category = it },
                    label = { Text("Category (e.g. FOOD, UTILITIES, SALARY)") },
                    modifier = Modifier.fillMaxWidth()
                )
                if (members.isNotEmpty()) {
                    Text("Paid By Member (paid_by_member_id):", style = FamilyOSTypography.labelSmall)
                    Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                        members.take(4).forEach { mem ->
                            FilterChip(
                                selected = selectedMemberId == mem.id,
                                onClick = { selectedMemberId = mem.id },
                                label = { Text(mem.displayName.substringBefore(" "), style = FamilyOSTypography.labelSmall) }
                            )
                        }
                    }
                }
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    val cents = FinancialPrecisionUtils.parseDollarsToCents(amountStr)
                        ?: amountStr.trim().toLongOrNull()
                        ?: 0L
                    if (cents > 0L) {
                        onConfirm(
                            title.ifBlank { "Transaction" },
                            cents,
                            category.ifBlank { "OTHER" },
                            selectedAccountId,
                            selectedMemberId
                        )
                    }
                },
                colors = ButtonDefaults.buttonColors(containerColor = if (type == TransactionType.INCOME) FamilyOSColors.ForestGreenDark else FamilyOSColors.Alert)
            ) {
                Text("Record ${type.name}")
            }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } }
    )
}

@Composable
private fun InternalTransferDialog(
    accounts: List<FinancialAccount>,
    onDismiss: () -> Unit,
    onConfirm: (amountCents: Long, title: String, sourceAccountId: String?, destinationAccountId: String?) -> Unit
) {
    var title by remember { mutableStateOf("Internal Transfer") }
    var amountStr by remember { mutableStateOf("") }
    var sourceAccountId by remember(accounts) { mutableStateOf(accounts.firstOrNull()?.id) }
    var destinationAccountId by remember(accounts) { mutableStateOf(accounts.getOrNull(1)?.id ?: accounts.firstOrNull()?.id) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Record Internal Transfer", fontWeight = FontWeight.Bold) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text("Debits Source Account and credits Destination Account with zero net household impact.", style = FamilyOSTypography.bodySmall)
                if (accounts.isNotEmpty()) {
                    Text("From Source Account (account_id):", style = FamilyOSTypography.labelSmall)
                    Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                        accounts.take(4).forEach { acc ->
                            FilterChip(
                                selected = sourceAccountId == acc.id,
                                onClick = { sourceAccountId = acc.id },
                                label = { Text(acc.name.take(12), style = FamilyOSTypography.labelSmall) }
                            )
                        }
                    }
                    Text("To Destination Account (destination_account_id):", style = FamilyOSTypography.labelSmall)
                    Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                        accounts.take(4).forEach { acc ->
                            FilterChip(
                                selected = destinationAccountId == acc.id,
                                onClick = { destinationAccountId = acc.id },
                                label = { Text(acc.name.take(12), style = FamilyOSTypography.labelSmall) }
                            )
                        }
                    }
                }
                OutlinedTextField(
                    value = title,
                    onValueChange = { title = it },
                    label = { Text("Transfer Title") },
                    modifier = Modifier.fillMaxWidth()
                )
                OutlinedTextField(
                    value = amountStr,
                    onValueChange = { amountStr = it },
                    label = { Text("Transfer Amount ($ or integer cents)") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    modifier = Modifier.fillMaxWidth()
                )
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    val cents = FinancialPrecisionUtils.parseDollarsToCents(amountStr)
                        ?: amountStr.trim().toLongOrNull()
                        ?: 0L
                    if (cents > 0L) onConfirm(cents, title, sourceAccountId, destinationAccountId)
                },
                colors = ButtonDefaults.buttonColors(containerColor = FamilyOSColors.SoftGoldDark)
            ) {
                Text("Execute Transfer")
            }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } }
    )
}

@Composable
private fun AddBudgetDialog(
    onDismiss: () -> Unit,
    onConfirm: (category: String, allocatedCents: Long, threshold: Int) -> Unit
) {
    var category by remember { mutableStateOf("FOOD") }
    var amountStr by remember { mutableStateOf("") }
    var thresholdStr by remember { mutableStateOf("85") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Set Envelope Budget", fontWeight = FontWeight.Bold) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                OutlinedTextField(
                    value = category,
                    onValueChange = { category = it },
                    label = { Text("Category (e.g. FOOD, HOUSING, TRANSPORT, DINING)") },
                    modifier = Modifier.fillMaxWidth()
                )
                OutlinedTextField(
                    value = amountStr,
                    onValueChange = { amountStr = it },
                    label = { Text("Monthly Allocated Limit ($ or cents)") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    modifier = Modifier.fillMaxWidth()
                )
                OutlinedTextField(
                    value = thresholdStr,
                    onValueChange = { thresholdStr = it.filter { ch -> ch.isDigit() } },
                    label = { Text("Alert Threshold Percentage (1-100%)") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    modifier = Modifier.fillMaxWidth()
                )
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    val cents = FinancialPrecisionUtils.parseDollarsToCents(amountStr)
                        ?: amountStr.trim().toLongOrNull()
                        ?: 0L
                    val threshold = (thresholdStr.toIntOrNull() ?: 85).coerceIn(1, 100)
                    if (cents > 0L) onConfirm(category.ifBlank { "GENERAL" }, cents, threshold)
                },
                colors = ButtonDefaults.buttonColors(containerColor = FamilyOSColors.ForestGreenDark)
            ) { Text("Save Envelope") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } }
    )
}

@Composable
private fun AddSavingsGoalDialog(
    accounts: List<FinancialAccount>,
    onDismiss: () -> Unit,
    onConfirm: (title: String, targetCents: Long, monthlyCents: Long, linkedAccountId: String?) -> Unit
) {
    var title by remember { mutableStateOf("") }
    var targetStr by remember { mutableStateOf("") }
    var monthlyStr by remember { mutableStateOf("") }
    var linkedAccountId by remember(accounts) {
        mutableStateOf(accounts.firstOrNull { it.accountType == AccountType.SAVINGS }?.id ?: accounts.firstOrNull()?.id)
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Create Savings Goal", fontWeight = FontWeight.Bold) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                OutlinedTextField(
                    value = title,
                    onValueChange = { title = it },
                    label = { Text("Goal Title") },
                    modifier = Modifier.fillMaxWidth()
                )
                OutlinedTextField(
                    value = targetStr,
                    onValueChange = { targetStr = it },
                    label = { Text("Target Amount ($ or integer cents)") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    modifier = Modifier.fillMaxWidth()
                )
                OutlinedTextField(
                    value = monthlyStr,
                    onValueChange = { monthlyStr = it },
                    label = { Text("Planned Monthly Contribution ($ or cents)") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    modifier = Modifier.fillMaxWidth()
                )
                if (accounts.isNotEmpty()) {
                    Text("Linked Account (linked_account_id):", style = FamilyOSTypography.labelSmall)
                    Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                        accounts.take(4).forEach { acc ->
                            FilterChip(
                                selected = linkedAccountId == acc.id,
                                onClick = { linkedAccountId = acc.id },
                                label = { Text(acc.name.take(12), style = FamilyOSTypography.labelSmall) }
                            )
                        }
                    }
                }
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    val targetCents = FinancialPrecisionUtils.parseDollarsToCents(targetStr)
                        ?: targetStr.trim().toLongOrNull()
                        ?: 0L
                    val monthlyCents = FinancialPrecisionUtils.parseDollarsToCents(monthlyStr)
                        ?: monthlyStr.trim().toLongOrNull()
                        ?: 0L
                    if (targetCents > 0L) onConfirm(title.ifBlank { "Savings Goal" }, targetCents, monthlyCents, linkedAccountId)
                },
                colors = ButtonDefaults.buttonColors(containerColor = FamilyOSColors.ForestGreenDark)
            ) { Text("Save Goal") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } }
    )
}

@Composable
private fun ContributeSavingsDialog(
    goal: SavingsGoal,
    onDismiss: () -> Unit,
    onConfirm: (amountCents: Long) -> Unit
) {
    var amountStr by remember { mutableStateOf("") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Contribute to ${goal.title}", fontWeight = FontWeight.Bold) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text("Current progress: ${FinancialPrecisionUtils.formatCents(goal.currentCents)} of ${FinancialPrecisionUtils.formatCents(goal.targetCents)}")
                OutlinedTextField(
                    value = amountStr,
                    onValueChange = { amountStr = it },
                    label = { Text("Contribution Amount ($)") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    modifier = Modifier.fillMaxWidth()
                )
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    val cents = FinancialPrecisionUtils.parseDollarsToCents(amountStr) ?: 0L
                    if (cents > 0) onConfirm(cents)
                },
                colors = ButtonDefaults.buttonColors(containerColor = FamilyOSColors.ForestGreenDark)
            ) { Text("Confirm Contribution") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } }
    )
}

@Composable
private fun AddBillDialog(
    onDismiss: () -> Unit,
    onConfirm: (payee: String, amountCents: Long, cycle: String, isAutoPay: Boolean) -> Unit
) {
    var payee by remember { mutableStateOf("") }
    var amountStr by remember { mutableStateOf("") }
    var isAutoPay by remember { mutableStateOf(false) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Add Recurring Bill / Sub", fontWeight = FontWeight.Bold) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                OutlinedTextField(
                    value = payee,
                    onValueChange = { payee = it },
                    label = { Text("Payee / Service") },
                    modifier = Modifier.fillMaxWidth()
                )
                OutlinedTextField(
                    value = amountStr,
                    onValueChange = { amountStr = it },
                    label = { Text("Billing Amount ($)") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    modifier = Modifier.fillMaxWidth()
                )
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text("Enable Auto-Pay", style = FamilyOSTypography.bodyMedium)
                    Switch(checked = isAutoPay, onCheckedChange = { isAutoPay = it })
                }
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    val cents = FinancialPrecisionUtils.parseDollarsToCents(amountStr) ?: 0L
                    if (cents > 0) onConfirm(payee.ifBlank { "Bill" }, cents, "MONTHLY", isAutoPay)
                },
                colors = ButtonDefaults.buttonColors(containerColor = FamilyOSColors.ForestGreenDark)
            ) { Text("Save Bill") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } }
    )
}

@Composable
private fun AddInvestmentHoldingDialog(
    onDismiss: () -> Unit,
    onConfirm: (symbol: String, name: String, type: String, microshares: Long, costCents: Long, priceCents: Long) -> Unit
) {
    var symbol by remember { mutableStateOf("") }
    var name by remember { mutableStateOf("") }
    var type by remember { mutableStateOf("ETF") }
    var sharesStr by remember { mutableStateOf("") }
    var costStr by remember { mutableStateOf("") }
    var priceStr by remember { mutableStateOf("") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Add Investment Holding", fontWeight = FontWeight.Bold) },
        text = {
            LazyColumn(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                item {
                    OutlinedTextField(
                        value = symbol,
                        onValueChange = { symbol = it },
                        label = { Text("Symbol (e.g. VTI, AAPL)") },
                        modifier = Modifier.fillMaxWidth()
                    )
                }
                item {
                    OutlinedTextField(
                        value = name,
                        onValueChange = { name = it },
                        label = { Text("Asset Name") },
                        modifier = Modifier.fillMaxWidth()
                    )
                }
                item {
                    OutlinedTextField(
                        value = sharesStr,
                        onValueChange = { sharesStr = it },
                        label = { Text("Shares (e.g. 10.500000)") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        modifier = Modifier.fillMaxWidth()
                    )
                }
                item {
                    OutlinedTextField(
                        value = costStr,
                        onValueChange = { costStr = it },
                        label = { Text("Total Cost Basis ($)") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        modifier = Modifier.fillMaxWidth()
                    )
                }
                item {
                    OutlinedTextField(
                        value = priceStr,
                        onValueChange = { priceStr = it },
                        label = { Text("Current Market Price ($/share)") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    val microshares = FinancialPrecisionUtils.parseSharesToMicroshares(sharesStr) ?: 0L
                    val costCents = FinancialPrecisionUtils.parseDollarsToCents(costStr) ?: 0L
                    val priceCents = FinancialPrecisionUtils.parseDollarsToCents(priceStr) ?: 0L
                    if (microshares > 0 && priceCents > 0) {
                        onConfirm(symbol.ifBlank { "ASSET" }, name.ifBlank { symbol }, type, microshares, costCents, priceCents)
                    }
                },
                colors = ButtonDefaults.buttonColors(containerColor = FamilyOSColors.ForestGreenDark)
            ) { Text("Add Holding") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } }
    )
}

@Composable
private fun UpdateHoldingPriceDialog(
    holding: InvestmentHolding,
    onDismiss: () -> Unit,
    onConfirm: (newPriceCents: Long) -> Unit
) {
    var priceStr by remember { mutableStateOf("") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Update Price: ${holding.symbol}", fontWeight = FontWeight.Bold) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text("Current market price: ${FinancialPrecisionUtils.formatCents(holding.currentPriceCents)}/share")
                OutlinedTextField(
                    value = priceStr,
                    onValueChange = { priceStr = it },
                    label = { Text("New Market Price ($/share)") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    modifier = Modifier.fillMaxWidth()
                )
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    val cents = FinancialPrecisionUtils.parseDollarsToCents(priceStr) ?: 0L
                    if (cents > 0) onConfirm(cents)
                },
                colors = ButtonDefaults.buttonColors(containerColor = FamilyOSColors.ForestGreenDark)
            ) { Text("Update Price") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } }
    )
}

@Composable
private fun CashFlowRow(label: String, amountCents: Long, color: Color, isPositive: Boolean) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(text = label, style = FamilyOSTypography.bodyMedium, color = FamilyOSColors.MutedCharcoal)
        Text(
            text = "${if (isPositive) "+" else ""}${FinancialPrecisionUtils.formatCents(amountCents)}",
            style = FamilyOSTypography.bodyLarge,
            fontWeight = FontWeight.SemiBold,
            color = color
        )
    }
}

// Sample Fallback Data Fixtures
internal val defaultSampleCashFlowPlan = CashFlowPlan(
    expectedIncomeCents = 850000L,
    recurringExpensesCents = 320000L,
    otherPlannedExpensesCents = 150000L,
    plannedSavingsCents = 180000L,
    plannedEmergencyReserveCents = 120000L,
    plannedPriorityObjectivesCents = 80000L
)

internal val defaultSampleAccounts = listOf(
    FinancialAccount("acc-1", "fam-1", "Household Main Checking", AccountType.CHECKING, 845250L, false, "USD", "Chase", false, 0, 0),
    FinancialAccount("acc-2", "fam-1", "High-Yield Family Savings", AccountType.SAVINGS, 3420000L, false, "USD", "Marcus", false, 0, 0),
    FinancialAccount("acc-3", "fam-1", "Family Investment Portfolio", AccountType.INVESTMENT, 8560000L, false, "USD", "Vanguard", false, 0, 0),
    FinancialAccount("acc-4", "fam-1", "Emergency Cash Reserve", AccountType.CASH, 125000L, false, "USD", "Safe", false, 0, 0),
    FinancialAccount("acc-5", "fam-1", "Household Rewards Card", AccountType.CREDIT_CARD, -184200L, true, "USD", "Amex", false, 0, 0),
    FinancialAccount("acc-6", "fam-1", "Family Auto Loan", AccountType.LOAN, -1250000L, true, "USD", "Credit Union", false, 0, 0)
)

internal val defaultSampleBudgets = listOf(
    EnvelopeBudget("b-1", "fam-1", "FOOD", 120000L, 84500L, 0),
    EnvelopeBudget("b-2", "fam-1", "HOUSING", 240000L, 235000L, 0),
    EnvelopeBudget("b-3", "fam-1", "TRANSPORT", 45000L, 31000L, 0),
    EnvelopeBudget("b-4", "fam-1", "DINING", 35000L, 38500L, 0),
    EnvelopeBudget("b-5", "fam-1", "EDUCATION", 40000L, 20000L, 0)
)

internal val defaultSampleTransactions = listOf(
    FinancialTransaction("tx-1", "fam-1", "acc-1", null, "Organic Valley Grocery", 14250L, TransactionType.EXPENSE, "FOOD", 1700000000000L, true, false, null, null, "Sarah", 0),
    FinancialTransaction("tx-2", "fam-1", "acc-1", null, "Acme Corp Monthly Salary", 425000L, TransactionType.INCOME, "SALARY", 1699900000000L, true, false, null, null, "Sarah", 0),
    FinancialTransaction("tx-3", "fam-1", "acc-1", "acc-2", "Savings Contribution Transfer", 100000L, TransactionType.TRANSFER, "TRANSFER", 1699800000000L, true, false, null, "Auto-sweep", "Sarah", 0),
    FinancialTransaction("tx-4", "fam-1", "acc-1", null, "Reversal: Duplicate Utility Charge", 12500L, TransactionType.EXPENSE, "UTILITIES", 1699700000000L, true, true, "tx-orig", "Reversal credited back", "Sarah", 0)
)

internal val defaultSampleBills = listOf(
    BillSubscription("bill-1", "fam-1", "acc-1", "City Electric Power", 18500L, "MONTHLY", 1700500000000L, isSubscription = false, isAutoPay = true, 3),
    BillSubscription("bill-2", "fam-1", "acc-1", "Metro Water & Sewer", 9500L, "MONTHLY", 1700700000000L, isSubscription = false, isAutoPay = true, 3),
    BillSubscription("bill-3", "fam-1", "acc-5", "Cloud Family Storage", 1999L, "MONTHLY", 1700800000000L, isSubscription = true, isAutoPay = true, 2),
    BillSubscription("bill-4", "fam-1", "acc-1", "Fiber Internet 1Gbps", 7000L, "MONTHLY", 1701000000000L, isSubscription = true, isAutoPay = false, 5)
)

internal val defaultSampleSavingsGoals = listOf(
    SavingsGoal("goal-1", "fam-1", "acc-2", "Lucas College Fund (529 Plan)", 5000000L, 1850000L, 50000L, System.currentTimeMillis() + 315360000000L),
    SavingsGoal("goal-2", "fam-1", "acc-2", "Summer Family Trip to National Parks", 600000L, 420000L, 30000L, System.currentTimeMillis() + 15552000000L)
)

internal val defaultSampleInvestmentHoldings = listOf(
    InvestmentHolding("hold-1", "fam-1", "acc-3", "VTI", "Vanguard Total Stock Market Index ETF", "ETF", 25500000L, 550000L, 24000L, "USD"),
    InvestmentHolding("hold-2", "fam-1", "acc-3", "AAPL", "Apple Inc.", "STOCK", 10000000L, 180000L, 22500L, "USD"),
    InvestmentHolding("hold-3", "fam-1", "acc-3", "BTC", "Bitcoin", "CRYPTO", 125000L, 600000L, 6500000L, "USD")
)
