# FAMILYOS — STAGE 3.A.1 AUDIT & TECHNICAL IMPLEMENTATION PLAN
**Sub-Milestone 3.A.1: Finance & Financial Intelligence (`FIN-01` to `FIN-08`, `INV-01`)**

**Document Version:** 1.0.0  
**Date:** November 2, 2026  
**Authoritative Reference:** `FAMILYOS_MASTER_PLAN.md` & Master Development Journey — Stage 3  
**Verified Preceding Commit SHA:** `a1e78f92d4b8e234091c6e1893c5d67e5a8820c4` (short: `a1e78f9`)  
**Workspace Tracking Identifier:** `8f842ec0-cec0-443c-b279-e4955acacfaf`  
**Prerequisites:** Master Stage 2 Permanently Closed & Verified (146/146 Gates Passed)

---

## 1. Executive Summary & Audit of Existing Finance Code

Prior to drafting new code, a full codebase audit was conducted across the Android Kotlin persistence layer, Jetpack Compose UI, Express REST gateway, in-memory stores, and React Web components.

### 1.1 Existing Finance Components Inventory

| Area | Component / Source File | Existing Capabilities | Gaps / Defects Identified | Status |
| :--- | :--- | :--- | :--- | :---: |
| **Android Room Entities** | `android/.../Stage3Entities.kt` (lines 1–295) | `financial_accounts` (#20), `financial_transactions` (#21), `recurring_transactions` (#22), `envelope_budgets` (#23), `savings_goals` (#24), `bills_subscriptions` (#25). All amounts strictly `Long` integer cents. | Missing `investment_holdings` entity for `INV-01` (stocks, index funds, retirement, cost basis, fixed-precision fractional shares). | **PARTIAL** |
| **Android Room DAOs** | `android/.../Stage3Daos.kt` (lines 1–123) | `FinanceDao` defines queries, Flow observables, and atomic `@Transaction` methods for `recordIncome()`, `recordExpense()`, `recordTransfer()`, and `reverseTransaction()`. | Missing investment holdings CRUD, portfolio valuation aggregation, and reconciliation queries. | **PARTIAL** |
| **Android Compose UI** | `android/.../FinanceScreen.kt` (632 lines) | High-fidelity UI composables for Cash Flow, Accounts & Net Worth, Budgets, Ledger, and Bills & Subscriptions. Long cents formatting. | Relies on static sample default parameters; lacks connection to live `FinanceViewModel` and Room `FinanceRepository`. Missing Investment Portfolio tab. | **PARTIAL** |
| **Express Backend** | `server.ts` (lines 2228–2540) | `POST /api/v1/finance/transaction` with integer-cents validation, idempotency caching, transfer handling, and budget rollup; `POST /api/v1/finance/reverse` with duplicate reversal guard. | Missing REST endpoints for accounts, budgets, savings goals, recurring templates, investments, and dashboard summary. Endpoints not mounted under dedicated family router with Zero-Trust membership check. | **PARTIAL** |
| **React Web UI** | `src/App.tsx` (lines 1395–1490) | Interactive cash-flow calculator simulator illustrating exact integer-cents formulas. | Lacks full multi-account balance table, real-time transaction history, envelope progress bars, savings milestones, and investment holdings manager. | **PARTIAL** |
| **Database Version** | `FamilyOSDatabase.kt` | Room database upgraded to v5 (`MIGRATION_4_5`) for household entities. | Version 5 does not contain `investment_holdings`. Requires `MIGRATION_5_6` to reach v6 without data loss. | **UPGRADE REQUIRED** |

---

## 2. Feature-by-Feature Classification

| Code | Feature Specification | Existing Impl | Classification | Remediation Plan |
| :--- | :--- | :--- | :---: | :--- |
| **FIN-01** | Integer-Cents Financial Accounts | Room #20 & `server.ts` | **COMPLETE (HOST-VERIFIED)** | Maintain signed `Long` cents; expand account types to include Investment, Loan, Cash. |
| **FIN-02** | Income Tracking (Recurring & Irregular) | `FinanceDao` & `server.ts` | **COMPLETE (HOST-VERIFIED)** | Add recurring schedule generation engine with idempotency keys. |
| **FIN-03** | Expense Management & Envelope Budgets | `FinanceDao` & `server.ts` | **COMPLETE (HOST-VERIFIED)** | Add monthly rollover rules and real-time category spending aggregation. |
| **FIN-04** | Cash-Flow Allocator (Planned Cash Flow) | `FinanceScreen.kt` & Web | **COMPLETE (VERIFIED)** | Add dedicated API endpoint `GET /api/v1/finance/:familyId/cashflow`. |
| **FIN-05** | Multiple Savings Goals & Milestone Cards | Room #24 & DAOs | **PARTIAL** | Add monthly contribution suggestion calculator and API endpoints. |
| **FIN-06** | Category Envelope Budgets & Alerts | Room #23 & DAOs | **COMPLETE (HOST-VERIFIED)** | Add warning badges at 80% and over-budget alerts at 100%. |
| **FIN-07** | Net Worth Calculator (Assets vs Liabilities) | `server.ts` netWorth | **COMPLETE (HOST-VERIFIED)** | Include investment market valuations in net worth equation. |
| **FIN-08** | Internal Transfers & Audit Reversals | `FinanceDao` & `server.ts` | **COMPLETE (HOST-VERIFIED)** | Ensure transfers never inflate income/expense totals; retain compensating reversals. |
| **INV-01** | Investment Portfolio & Cost Basis Engine | None in Room schema | **MISSING** | Define `investment_holdings` (Table #45), Room `MIGRATION_5_6`, fixed-precision share counts, and valuation APIs. |

---

## 3. Explicit Behavioral Specifications (Mandatory Prior to Implementation)

### 3.1 Strict Separation: Actual Recorded Money vs Projected Allocations
To maintain ledger integrity and prevent accounting errors, the system maintains strict mathematical boundaries between:
1. **Actual Recorded Money (Authoritative Ledger):**
   - Represents physical or settled funds in financial institutions.
   - Reflected strictly in `financial_accounts.current_balance_cents`.
   - Mutated **only** by executed, cleared `financial_transactions` (`INCOME`, `EXPENSE`, `TRANSFER`, `REVERSAL`).
2. **Projected Recurring Transactions (Future Cash Flow Expectations):**
   - Stored in `recurring_transactions` and `bills_subscriptions`.
   - Never alters `financial_accounts.current_balance_cents` until an occurrence is posted as a concrete transaction.
   - Used exclusively for future cash-flow forecasting and upcoming liability warnings.
3. **Suggested Allocations (Virtual Envelopes & Goals):**
   - Envelope budgets (`allocated_cents`) and savings goals (`planned_monthly_contribution_cents`) are virtual targets.
   - They **never** duplicate, move, or inflate ledger cash. Contributing to a savings goal via an internal transfer adjusts account balances once; virtual progress bars mirror this without double-counting.

---

### 3.2 Recurring Income & Expense Schedules
- **Frequencies Supported:** `DAILY`, `WEEKLY`, `BIWEEKLY`, `MONTHLY`, `QUARTERLY`, `ANNUAL`.
- **Next Due Date Calculation:**
  - `DAILY`: `nextDueDate += 24 * 3600 * 1000`
  - `WEEKLY`: `nextDueDate += 7 * 24 * 3600 * 1000`
  - `BIWEEKLY`: `nextDueDate += 14 * 24 * 3600 * 1000`
  - `MONTHLY / QUARTERLY / ANNUAL`: Calendar month advancement preserving day of month.
- **Month-End & Leap Year Clamping Rules:**
  - If recurring day is 31st and next month has 30 days (April, June, Sept, Nov), due date clamps to 30th.
  - In February, 29th/30th/31st clamps to February 28th (or February 29th in leap years).
- **Missed Occurrence / Catch-Up Rule:**
  - If the application was offline past one or more intervals, the engine detects overdue occurrences and generates single catch-up prompts with distinct idempotency keys, avoiding runaway cascades.
- **Idempotency Guarantee:**
  - Each recurring generation creates a transaction with:
    `idempotencyKey = "REC_GEN:<recurring_id>:<due_date_epoch_day>"`
  - Even if triggered concurrently or repeated, duplicate postings are blocked at the database and API layer.

---

### 3.3 Monthly Cash-Flow Formula & Equations
The Cash-Flow Allocator adheres to deterministic 64-bit signed integer cents calculations:

$$\text{Available Before Savings} = \text{Expected Income Cents} - \text{Fixed Recurring Expenses Cents} - \text{Planned Variable Expenses Cents}$$

$$\text{Available For Allocation} = \text{Available Before Savings} - \text{Other Planned Commitments Cents}$$

$$\text{Planned Allocations Rollup} = \text{Emergency Reserve Cents} + \text{Planned Savings Cents} + \text{Home Priorities Cents}$$

$$\text{Net Monthly Discretionary Margin} = \text{Available For Allocation} - \text{Planned Allocations Rollup}$$

*Rule: If $\text{Net Monthly Discretionary Margin} < 0$, the UI flags a deficit warning in amber/red.*

---

### 3.4 Budget Allocation, Alert Thresholds & Rollover Rules
- **Category Spending Calculation:**
  $$\text{Spent Cents}(\text{cat}) = \sum_{\substack{t \in \text{Transactions} \\ t.\text{category} = \text{cat} \\ t.\text{type} = \text{EXPENSE} \\ \neg t.\text{isReversal}}} t.\text{amountCents} - \sum_{\substack{r \in \text{Reversals} \\ r.\text{category} = \text{cat}}} r.\text{amountCents}$$
- **Alert Thresholds:**
  - `NORMAL`: $\text{Spent Cents} < 80\% \times \text{Allocated Cents}$
  - `WARNING` (Amber): $80\% \le \frac{\text{Spent Cents}}{\text{Allocated Cents}} < 100\%$
  - `OVER_BUDGET` (Red): $\text{Spent Cents} \ge \text{Allocated Cents}$
- **Monthly Rollover Rules:**
  - Default: Budgets reset each calendar month.
  - Rollover Envelope Policy (Optional): Unspent surplus ($\text{Allocated} - \text{Spent}$) can optionally roll over as an addition to next month's allocated cap. Deficits never roll over as negative money into future income.

---

### 3.5 Savings Goals & Suggested Contribution Mathematics
- **Suggested Monthly Contribution Formula:**
  Given target amount $T$, current accumulated amount $C$, current timestamp $now$, and target deadline $D$:
  $$\Delta t_{\text{months}} = \max\left(1, \left\lceil \frac{D - now}{30.4375 \times 24 \times 3600 \times 1000} \right\rceil\right)$$
  $$\text{Suggested Monthly Contribution Cents} = \left\lceil \frac{\max(0, T - C)}{\Delta t_{\text{months}}} \right\rceil$$
  *All math evaluated using integer division with ceiling adjustment.*
- **Zero Double-Counting:**
  - Contributions are made either via internal transfer to a linked savings account or by earmarking funds.
  - Linked account balance represents the physical asset; `savings_goals.current_cents` represents the allocated goal progress.

---

### 3.6 Account Balance Reconciliation
- Allows users to compare settled bank statement balances against FamilyOS local ledger.
- Reconciliation records statement date, statement ending balance in cents, and computes:
  $$\text{Discrepancy Cents} = \text{Statement Balance Cents} - \text{Ledger Balance Cents}$$
- If discrepancy $\ne 0$, user is prompted to identify uncleared transactions or record an explicit adjustment transaction with category `ADJUSTMENT`. Silent balance tampering is prohibited.

---

### 3.7 Internal Transfers & Audit Reversals
- **Internal Transfers:**
  - Debit source account: $\text{Balance}_{\text{src}} \leftarrow \text{Balance}_{\text{src}} - \text{Amount}$
  - Credit destination account: $\text{Balance}_{\text{dest}} \leftarrow \text{Balance}_{\text{dest}} + \text{Amount}$
  - Net Household Impact = $0$ cents.
  - Transfers are excluded from Income and Expense totals.
- **Audit Reversals:**
  - When reversing transaction $T$, a new transaction $R$ is created:
    - $R.\text{isReversal} = \text{true}$
    - $R.\text{reversalOfId} = T.\text{id}$
    - $R.\text{amountCents} = T.\text{amountCents}$
    - $R.\text{transactionType} = T.\text{transactionType}$
  - Account balances and category budget expenditures are restored.
  - Original transaction $T$ remains permanently in the ledger for compliance. Re-reversing $T$ or reversing $R$ is blocked.

---

### 3.8 Investment Portfolio, Cost Basis & Valuation (`INV-01`)
- **Fixed-Precision Share Counts (Microshares):**
  - To bar floating-point drift on fractional shares, quantities are stored as signed 64-bit integers in **microshares**:
    $$1.000000 \text{ shares} = 1,000,000 \text{ microshares}$$
    $$0.500000 \text{ shares} = 500,000 \text{ microshares}$$
    $$0.000125 \text{ shares} = 125 \text{ microshares}$$
- **Pricing & Cost Basis in Cents:**
  - `cost_basis_cents`: Total integer cents paid for the holding.
  - `current_price_cents`: Market price in integer cents per **1.0 full share** (e.g., $\$185.50 = 18,550$ cents).
- **Current Valuation Formula (Exact Integer Math):**
  $$\text{Current Valuation Cents} = \left\lfloor \frac{\text{quantity\_microshares} \times \text{current\_price\_cents}}{1,000,000} \right\rfloor$$
- **Unrealized Gain / Loss:**
  $$\text{Unrealized Gain/Loss Cents} = \text{Current Valuation Cents} - \text{cost\_basis\_cents}$$
  $$\text{Gain/Loss Percentage Basis Points} = \begin{cases} 
  \left\lfloor \frac{\text{Unrealized Gain/Loss Cents} \times 10,000}{\text{cost\_basis\_cents}} \right\rfloor & \text{if } \text{cost\_basis\_cents} > 0 \\ 
  0 & \text{otherwise} 
  \end{cases}$$
  *(100 basis points = 1.00%)*

---

### 3.9 Subscription Detection & Duplicate Prevention
- Identifies potential duplicate bills or forgotten subscriptions:
  - If two transactions or bills share the same `payee` or title and identical `amount_cents` within $\pm 4$ days of an expected billing cycle, a duplicate alert is raised.
  - Auto-pay status indicator alerts 3 days prior to scheduled execution.

---

## 4. Database Schema Expansion & Room MIGRATION_5_6

### 4.1 Table #45: `investment_holdings`
```sql
CREATE TABLE IF NOT EXISTS `investment_holdings` (
    `id` TEXT NOT NULL PRIMARY KEY,
    `family_id` TEXT NOT NULL,
    `account_id` TEXT NOT NULL,
    `symbol` TEXT NOT NULL,
    `asset_name` TEXT NOT NULL,
    `asset_type` TEXT NOT NULL, -- 'STOCK', 'ETF', 'CRYPTO', 'MUTUAL_FUND', 'BOND', 'RETIREMENT'
    `quantity_microshares` INTEGER NOT NULL, -- 1.0 share = 1,000,000 microshares
    `cost_basis_cents` INTEGER NOT NULL, -- Total purchase cost in integer cents
    `current_price_cents` INTEGER NOT NULL, -- Price per 1.0 share in cents
    `currency` TEXT NOT NULL DEFAULT 'USD',
    `notes` TEXT,
    `last_price_updated_at` INTEGER NOT NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `sync_status` TEXT NOT NULL DEFAULT 'LOCAL_ONLY',
    `is_deleted` INTEGER NOT NULL DEFAULT 0,
    `created_at` INTEGER NOT NULL,
    `updated_at` INTEGER NOT NULL,
    FOREIGN KEY(`family_id`) REFERENCES `family_workspaces`(`id`) ON DELETE CASCADE,
    FOREIGN KEY(`account_id`) REFERENCES `financial_accounts`(`id`) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS `index_investment_holdings_family_id` ON `investment_holdings` (`family_id`);
CREATE INDEX IF NOT EXISTS `index_investment_holdings_account_id` ON `investment_holdings` (`account_id`);
CREATE INDEX IF NOT EXISTS `index_investment_holdings_symbol` ON `investment_holdings` (`symbol`);
```

### 4.2 Room Migration `MIGRATION_5_6`
```kotlin
val MIGRATION_5_6 = object : Migration(5, 6) {
    override fun migrate(db: SupportSQLiteDatabase) {
        db.execSQL("""
            CREATE TABLE IF NOT EXISTS `investment_holdings` (
                `id` TEXT NOT NULL PRIMARY KEY,
                `family_id` TEXT NOT NULL,
                `account_id` TEXT NOT NULL,
                `symbol` TEXT NOT NULL,
                `asset_name` TEXT NOT NULL,
                `asset_type` TEXT NOT NULL,
                `quantity_microshares` INTEGER NOT NULL,
                `cost_basis_cents` INTEGER NOT NULL,
                `current_price_cents` INTEGER NOT NULL,
                `currency` TEXT NOT NULL DEFAULT 'USD',
                `notes` TEXT,
                `last_price_updated_at` INTEGER NOT NULL,
                `version` INTEGER NOT NULL DEFAULT 1,
                `sync_status` TEXT NOT NULL DEFAULT 'LOCAL_ONLY',
                `is_deleted` INTEGER NOT NULL DEFAULT 0,
                `created_at` INTEGER NOT NULL,
                `updated_at` INTEGER NOT NULL,
                FOREIGN KEY(`family_id`) REFERENCES `family_workspaces`(`id`) ON DELETE CASCADE,
                FOREIGN KEY(`account_id`) REFERENCES `financial_accounts`(`id`) ON DELETE CASCADE
            )
        """.trimIndent())

        db.execSQL("CREATE INDEX IF NOT EXISTS `index_investment_holdings_family_id` ON `investment_holdings` (`family_id`)")
        db.execSQL("CREATE INDEX IF NOT EXISTS `index_investment_holdings_account_id` ON `investment_holdings` (`account_id`)")
        db.execSQL("CREATE INDEX IF NOT EXISTS `index_investment_holdings_symbol` ON `investment_holdings` (`symbol`)")
    }
}
```

---

## 5. API Contracts & Zero-Trust Authorization

All endpoints are mounted under `financeRouter` with strict Zero-Trust tenant validation:
```typescript
financeRouter.param('familyId', (req, res, next, familyId) => {
  const actor = (req as any).actor;
  if (!actor?.userAccountId) return res.status(401).json({ error: 'UNAUTHORIZED' });
  const access = resolveServerMembership(loadStore(), actor.userAccountId, familyId);
  if (!access.allowed || !access.membership) {
    return res.status(access.httpStatus).json({
      error: access.errorCode || 'WORKSPACE_ISOLATION_VIOLATION',
      message: access.errorMessage || 'Access denied for family finance workspace.'
    });
  }
  // Child accounts are barred from family financial ledgers (COPPA / FamilyOS Rule)
  if (access.membership.role === 'CHILD' || access.membership.role === 'GUEST') {
    return res.status(403).json({
      error: 'FINANCE_ACCESS_RESTRICTED',
      message: 'Financial ledgers require adult member or guardian privileges.'
    });
  }
  (req as any).membership = access.membership;
  next();
});
```

### 5.1 Endpoint Specifications

1. `GET /api/v1/finance/:familyId/summary`
   - **Response:**
     - `netWorthCents`: Total asset accounts + total investment valuations - total liabilities.
     - `totalAssetsCents`: Checking + Savings + Cash + Investments.
     - `totalLiabilitiesCents`: Credit Card balances + Loan balances.
     - `monthlyCashFlow`: `{ expectedIncomeCents, recurringExpensesCents, plannedVariableExpensesCents, availablePlannedCashFlowCents, discretionaryMarginCents }`.
     - `accountsSummary`: List of accounts with current balance and type.
     - `recentTransactions`: 10 latest transactions.

2. `GET /api/v1/finance/:familyId/accounts` & `POST /api/v1/finance/:familyId/accounts`
   - Create or retrieve financial accounts (`CHECKING`, `SAVINGS`, `CREDIT_CARD`, `INVESTMENT`, `CASH`, `LOAN`).

3. `GET /api/v1/finance/:familyId/transactions`
   - Query filters: `accountId`, `category`, `startDate`, `endDate`, `limit`, `offset`.

4. `POST /api/v1/finance/:familyId/transaction`
   - Requires `idempotencyKey`, `title`, `amountCents` (positive safe integer), `transactionType` (`INCOME`, `EXPENSE`, `TRANSFER`), `accountId`.
   - Atomic update of account balances and envelope budget spent amounts.

5. `POST /api/v1/finance/:familyId/transactions/:id/reverse`
   - Creates compensating reversal record. Restores balances. Re-reversals blocked.

6. `GET /api/v1/finance/:familyId/budgets` & `POST /api/v1/finance/:familyId/budgets`
   - Category budget caps, allocated cents, spent cents, alert status (`NORMAL`, `WARNING`, `OVER_BUDGET`).

7. `GET /api/v1/finance/:familyId/savings` & `POST /api/v1/finance/:familyId/savings`
   - Savings goals with progress, target date, and dynamically suggested monthly contribution.

8. `GET /api/v1/finance/:familyId/recurring` & `POST /api/v1/finance/:familyId/recurring`
   - Recurring income/expense rules with auto-generation and next due date tracking.

9. `GET /api/v1/finance/:familyId/investments` & `POST /api/v1/finance/:familyId/investments`
   - Holdings, symbol, microshares, cost basis, current price per share, current valuation, unrealized gain/loss.

10. `POST /api/v1/finance/:familyId/reconcile`
    - Statement balance comparison and discrepancy reporting.

---

## 6. Implementation Phasing Strategy

```
  ┌──────────────────────────────────────────────────────────────┐
  │ PHASE 1: Room Database v5 -> v6 & Schema Expansion           │
  │ • Define InvestmentHoldingEntity, Dao, MIGRATION_5_6         │
  │ • Add Room migration tests on genuine v5 SQLite db           │
  └──────────────────────────────┬───────────────────────────────┘
                                 │
  ┌──────────────────────────────▼───────────────────────────────┐
  │ PHASE 2: Express Financial Engine & REST API Gateway         │
  │ • Implement financeRoutes.ts with Zero-Trust RBAC & child-block│
  │ • Exact integer-cents arithmetic, microshares valuation      │
  │ • Idempotent recurring generator, reversals, reconciliation  │
  └──────────────────────────────┬───────────────────────────────┘
                                 │
  ┌──────────────────────────────▼───────────────────────────────┐
  │ PHASE 3: React Web Interactive Finance Hub                   │
  │ • Accounts & Net worth cards, transaction ledger with reversal│
  │ • Budget progress with 80%/100% badges, savings goals cards  │
  │ • Investment portfolio table with microshare valuation       │
  └──────────────────────────────┬───────────────────────────────┘
                                 │
  ┌──────────────────────────────▼───────────────────────────────┐
  │ PHASE 4: Android Kotlin Repositories & ViewModel             │
  │ • FinanceRepositoryImpl, FinanceViewModel StateFlows         │
  │ • Bind FinanceScreen.kt to live reactive state               │
  │ • Add Investment Portfolio composable tab                    │
  └──────────────────────────────┬───────────────────────────────┘
                                 │
  ┌──────────────────────────────▼───────────────────────────────┐
  │ PHASE 5: Automated Testing, Multi-Platform Verification      │
  │ • 13 verification categories, 30 automated gates             │
  │ • Regression suites (Milestones 2.A, 3.2, 3.3)               │
  │ • Physical Windows device installation confirmation          │
  └──────────────────────────────────────────────────────────────┘
```

---

## 7. The 13 Required Verification Categories (Automated Gates)

1. **Integer-Cent Calculations & Validation:** Zero float drift; rejection of floating-point amounts.
2. **Income & Expense Aggregation:** Correct monthly totals from non-reversal transactions.
3. **Transfer Accounting:** Net household impact = 0 cents; debits source, credits destination; never counted as income/expense.
4. **Atomic Balance Updates:** Account balance changes atomically committed with ledger insert.
5. **Transaction Reversals:** Compensating reversal ledger entry; original transaction preserved; balance restored; duplicate reversals blocked.
6. **Recurring Transaction Idempotency:** Duplicate generation requests produce zero duplicate transactions.
7. **Budget Thresholds & Rollover:** Normal (<80%), Warning (80–99%), and Over-Budget (100%+) thresholds.
8. **Savings-Goal Calculations:** Suggested monthly contribution formula with ceiling division; zero double counting.
9. **Investment Cost Basis & Valuation Precision:** Microshares fixed-precision ($10^6$), cost basis, market valuation, and unrealized gain/loss calculation.
10. **Account Reconciliation:** Statement vs ledger balance comparison and discrepancy calculation.
11. **Migration Data Preservation:** `MIGRATION_5_6` applied on live SQLite v5 db; user_version = 6; 100% data intact across all 44 prior tables; Table #45 verified.
12. **Family Membership Authorization & Child Privacy:** Non-members receive HTTP 403 `WORKSPACE_ISOLATION_VIOLATION`; child accounts receive HTTP 403 `FINANCE_ACCESS_RESTRICTED`.
13. **Cross-Platform Consistency:** Consistent financial state across Express REST API, React Web, and Android Room.
