package com.familyos.core.database

import androidx.room.*
import kotlinx.coroutines.flow.Flow

/**
 * Stage 3 DAOs for FamilyOS:
 * 1. FinanceDao (Accounts, Transactions, Transfers, Recurring, Budgets, Savings, Bills)
 * 2. WellbeingDao (Profiles, Allergies, Medications, Vaccinations, Appointments)
 * 3. EmergencyDao (Contacts, Plan, Supplies, Readiness Checklist)
 */

@Dao
interface FinanceDao {

    // --- Accounts ---
    @Query("SELECT * FROM financial_accounts WHERE family_id = :familyId AND is_archived = 0 ORDER BY name ASC")
    fun observeAccounts(familyId: String): Flow<List<FinancialAccountEntity>>

    @Query("SELECT * FROM financial_accounts WHERE family_id = :familyId AND is_archived = 0")
    suspend fun getAccountsSync(familyId: String): List<FinancialAccountEntity>

    @Query("SELECT * FROM financial_accounts WHERE id = :accountId LIMIT 1")
    suspend fun getAccountById(accountId: String): FinancialAccountEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertOrUpdateAccount(account: FinancialAccountEntity)

    @Query("UPDATE financial_accounts SET current_balance_cents = current_balance_cents + :deltaCents, updated_at = :timestamp WHERE id = :accountId")
    suspend fun updateAccountBalance(accountId: String, deltaCents: Long, timestamp: Long = System.currentTimeMillis())

    // --- Transactions ---
    @Query("SELECT * FROM financial_transactions WHERE family_id = :familyId ORDER BY transaction_date DESC, created_at DESC")
    fun observeTransactions(familyId: String): Flow<List<FinancialTransactionEntity>>

    @Query("SELECT * FROM financial_transactions WHERE family_id = :familyId AND account_id = :accountId ORDER BY transaction_date DESC")
    fun observeTransactionsForAccount(familyId: String, accountId: String): Flow<List<FinancialTransactionEntity>>

    @Query("SELECT * FROM financial_transactions WHERE id = :transactionId LIMIT 1")
    suspend fun getTransactionById(transactionId: String): FinancialTransactionEntity?

    @Query("SELECT * FROM financial_transactions WHERE reversal_of_id = :originalTransactionId LIMIT 1")
    suspend fun getReversalForTransaction(originalTransactionId: String): FinancialTransactionEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertTransaction(transaction: FinancialTransactionEntity)

    // Transaction execution with balance update
    @Transaction
    suspend fun recordIncome(transaction: FinancialTransactionEntity) {
        insertTransaction(transaction)
        updateAccountBalance(transaction.accountId, transaction.amountCents)
    }

    @Transaction
    suspend fun recordExpense(transaction: FinancialTransactionEntity) {
        insertTransaction(transaction)
        updateAccountBalance(transaction.accountId, -transaction.amountCents)
    }

    // Atomic Internal Transfer: Debits source, credits destination. Net household impact is 0.
    @Transaction
    suspend fun recordTransfer(
        sourceAccountId: String,
        destinationAccountId: String,
        transferTransaction: FinancialTransactionEntity
    ) {
        insertTransaction(transferTransaction)
        updateAccountBalance(sourceAccountId, -transferTransaction.amountCents)
        updateAccountBalance(destinationAccountId, transferTransaction.amountCents)
    }

    // Reversal / Audit Trail: Preserves original record and posts an offset transaction
    @Transaction
    suspend fun reverseTransaction(
        originalTransaction: FinancialTransactionEntity,
        reversalTransaction: FinancialTransactionEntity
    ) {
        insertTransaction(reversalTransaction)
        when (originalTransaction.transactionType) {
            "INCOME" -> updateAccountBalance(originalTransaction.accountId, -originalTransaction.amountCents)
            "EXPENSE" -> updateAccountBalance(originalTransaction.accountId, originalTransaction.amountCents)
            "TRANSFER" -> {
                originalTransaction.destinationAccountId?.let { destId ->
                    updateAccountBalance(originalTransaction.accountId, originalTransaction.amountCents)
                    updateAccountBalance(destId, -originalTransaction.amountCents)
                }
            }
        }
    }

    // --- Recurring Transactions ---
    @Query("SELECT * FROM recurring_transactions WHERE family_id = :familyId AND is_active = 1 ORDER BY next_due_date ASC")
    fun observeRecurringTransactions(familyId: String): Flow<List<RecurringTransactionEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertRecurringTransaction(recurring: RecurringTransactionEntity)

    // --- Envelope Budgets ---
    @Query("SELECT * FROM envelope_budgets WHERE family_id = :familyId ORDER BY category ASC")
    fun observeBudgets(familyId: String): Flow<List<EnvelopeBudgetEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertOrUpdateBudget(budget: EnvelopeBudgetEntity)

    // --- Savings Goals ---
    @Query("SELECT * FROM savings_goals WHERE family_id = :familyId ORDER BY is_completed ASC, target_date ASC")
    fun observeSavingsGoals(familyId: String): Flow<List<SavingsGoalEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertOrUpdateSavingsGoal(goal: SavingsGoalEntity)

    @Query("UPDATE savings_goals SET current_cents = current_cents + :deltaCents WHERE id = :goalId")
    suspend fun contributeToSavingsGoal(goalId: String, deltaCents: Long)

    // --- Bills & Subscriptions ---
    @Query("SELECT * FROM bills_subscriptions WHERE family_id = :familyId ORDER BY due_date ASC")
    fun observeBills(familyId: String): Flow<List<BillSubscriptionEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertOrUpdateBill(bill: BillSubscriptionEntity)

    // --- Investment Holdings (INV-01) ---
    @Query("SELECT * FROM investment_holdings WHERE family_id = :familyId AND is_deleted = 0 ORDER BY symbol ASC")
    fun observeInvestmentHoldings(familyId: String): Flow<List<InvestmentHoldingEntity>>

    @Query("SELECT * FROM investment_holdings WHERE family_id = :familyId AND is_deleted = 0")
    suspend fun getInvestmentHoldingsSync(familyId: String): List<InvestmentHoldingEntity>

    @Query("SELECT * FROM investment_holdings WHERE id = :holdingId LIMIT 1")
    suspend fun getInvestmentHoldingById(holdingId: String): InvestmentHoldingEntity?

    @Query("SELECT * FROM investment_holdings WHERE family_id = :familyId AND account_id = :accountId AND is_deleted = 0")
    suspend fun getHoldingsForAccount(familyId: String, accountId: String): List<InvestmentHoldingEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertOrUpdateInvestmentHolding(holding: InvestmentHoldingEntity)

    @Query("UPDATE investment_holdings SET current_price_cents = :newPriceCents, last_price_updated_at = :timestamp, updated_at = :timestamp WHERE id = :holdingId")
    suspend fun updateHoldingMarketPrice(holdingId: String, newPriceCents: Long, timestamp: Long = System.currentTimeMillis())

    @Query("UPDATE investment_holdings SET is_deleted = 1, updated_at = :timestamp WHERE id = :holdingId")
    suspend fun softDeleteInvestmentHolding(holdingId: String, timestamp: Long = System.currentTimeMillis())

    /**
     * Records an investment purchase: Inserts or updates the holding, debits cash/checking account,
     * and logs the transaction atomically.
     */
    @Transaction
    suspend fun recordInvestmentPurchase(
        holding: InvestmentHoldingEntity,
        purchaseTransaction: FinancialTransactionEntity
    ) {
        insertOrUpdateInvestmentHolding(holding)
        insertTransaction(purchaseTransaction)
        updateAccountBalance(purchaseTransaction.accountId, -purchaseTransaction.amountCents)
    }
}

@Dao
interface WellbeingDao {

    // --- Wellbeing Profile ---
    @Query("SELECT * FROM wellbeing_profiles WHERE family_id = :familyId")
    fun observeAllProfiles(familyId: String): Flow<List<WellbeingProfileEntity>>

    @Query("SELECT * FROM wellbeing_profiles WHERE member_id = :memberId LIMIT 1")
    suspend fun getProfileForMember(memberId: String): WellbeingProfileEntity?

    @Query("SELECT * FROM wellbeing_profiles WHERE member_id = :memberId LIMIT 1")
    fun observeProfileForMember(memberId: String): Flow<WellbeingProfileEntity?>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertOrUpdateProfile(profile: WellbeingProfileEntity)

    // --- Allergies ---
    @Query("SELECT * FROM health_allergies WHERE family_id = :familyId")
    fun observeAllergies(familyId: String): Flow<List<HealthAllergyEntity>>

    @Query("SELECT * FROM health_allergies WHERE member_id = :memberId")
    fun observeAllergiesForMember(memberId: String): Flow<List<HealthAllergyEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAllergy(allergy: HealthAllergyEntity)

    // --- Medications ---
    @Query("SELECT * FROM health_medications WHERE family_id = :familyId AND is_active = 1")
    fun observeActiveMedications(familyId: String): Flow<List<HealthMedicationEntity>>

    @Query("SELECT * FROM health_medications WHERE member_id = :memberId")
    fun observeMedicationsForMember(memberId: String): Flow<List<HealthMedicationEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertOrUpdateMedication(medication: HealthMedicationEntity)

    // --- Vaccinations ---
    @Query("SELECT * FROM health_vaccinations WHERE member_id = :memberId ORDER BY date_administered DESC")
    fun observeVaccinationsForMember(memberId: String): Flow<List<HealthVaccinationEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertVaccination(vaccination: HealthVaccinationEntity)

    // --- Healthcare Appointments ---
    @Query("SELECT * FROM healthcare_appointments WHERE family_id = :familyId ORDER BY appointment_time ASC")
    fun observeAppointments(familyId: String): Flow<List<HealthcareAppointmentEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertOrUpdateAppointment(appointment: HealthcareAppointmentEntity)
}

@Dao
interface EmergencyDao {

    // --- Emergency Contacts ---
    @Query("SELECT * FROM emergency_contacts WHERE family_id = :familyId ORDER BY is_primary DESC, name ASC")
    fun observeContacts(familyId: String): Flow<List<EmergencyContactEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertOrUpdateContact(contact: EmergencyContactEntity)

    @Query("DELETE FROM emergency_contacts WHERE id = :id")
    suspend fun deleteContact(id: String)

    // --- Emergency Plan ---
    @Query("SELECT * FROM emergency_plans WHERE family_id = :familyId LIMIT 1")
    fun observeEmergencyPlan(familyId: String): Flow<EmergencyPlanEntity?>

    @Query("SELECT * FROM emergency_plans WHERE family_id = :familyId LIMIT 1")
    suspend fun getEmergencyPlan(familyId: String): EmergencyPlanEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertOrUpdateEmergencyPlan(plan: EmergencyPlanEntity)

    // --- Emergency Supplies ---
    @Query("SELECT * FROM emergency_supplies WHERE family_id = :familyId ORDER BY category ASC, item_name ASC")
    fun observeSupplies(familyId: String): Flow<List<EmergencySupplyEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertSupply(supply: EmergencySupplyEntity)

    @Query("UPDATE emergency_supplies SET is_checked = :isChecked WHERE id = :id")
    suspend fun setSupplyChecked(id: String, isChecked: Boolean)

    // --- Readiness Checklist ---
    @Query("SELECT * FROM emergency_checklist_items WHERE family_id = :familyId ORDER BY category ASC, created_at ASC")
    fun observeChecklistItems(familyId: String): Flow<List<EmergencyChecklistItemEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertChecklistItem(item: EmergencyChecklistItemEntity)

    @Query("UPDATE emergency_checklist_items SET is_completed = :isCompleted, completed_at = :completedAt WHERE id = :id")
    suspend fun setChecklistItemCompleted(id: String, isCompleted: Boolean, completedAt: Long?)
}
