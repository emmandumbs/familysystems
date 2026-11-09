package com.familyos.core.domain

import kotlinx.coroutines.flow.Flow

/**
 * Stage 3 Domain Repository Interfaces
 */

interface FinanceRepository {
    fun observeAccounts(familyId: String): Flow<List<FinancialAccount>>
    suspend fun createAccount(account: FinancialAccount)
    fun observeTransactions(familyId: String): Flow<List<FinancialTransaction>>
    suspend fun recordIncome(transaction: FinancialTransaction)
    suspend fun recordExpense(transaction: FinancialTransaction)
    suspend fun recordInternalTransfer(
        familyId: String,
        sourceAccountId: String,
        destinationAccountId: String,
        amountCents: Long,
        title: String,
        notes: String?
    )
    suspend fun reverseTransaction(transactionId: String, reason: String)
    fun observeBudgets(familyId: String): Flow<List<EnvelopeBudget>>
    suspend fun setBudget(budget: EnvelopeBudget)
    fun observeSavingsGoals(familyId: String): Flow<List<SavingsGoal>>
    suspend fun saveSavingsGoal(goal: SavingsGoal)
    suspend fun contributeToSavingsGoal(goalId: String, amountCents: Long)
    fun observeBills(familyId: String): Flow<List<BillSubscription>>
    suspend fun saveBill(bill: BillSubscription)
    fun observeInvestmentHoldings(familyId: String): Flow<List<InvestmentHolding>>
    suspend fun saveInvestmentHolding(holding: InvestmentHolding)
    suspend fun updateHoldingMarketPrice(holdingId: String, newPriceCents: Long)
    suspend fun deleteInvestmentHolding(holdingId: String)
    suspend fun recordInvestmentPurchase(holding: InvestmentHolding, purchaseTransaction: FinancialTransaction)
    suspend fun calculateCashFlow(familyId: String): CashFlowPlan
    suspend fun calculateNetWorth(familyId: String): NetWorthSummary
}

interface WellbeingRepository {
    fun observeProfiles(familyId: String): Flow<List<MemberWellbeingProfile>>
    fun observeProfileForMember(memberId: String): Flow<MemberWellbeingProfile?>
    suspend fun saveProfile(profile: MemberWellbeingProfile)
    fun observeAllergiesForMember(memberId: String): Flow<List<HealthAllergy>>
    suspend fun addAllergy(allergy: HealthAllergy)
    fun observeMedicationsForMember(memberId: String): Flow<List<HealthMedication>>
    suspend fun saveMedication(medication: HealthMedication)
    fun observeVaccinationsForMember(memberId: String): Flow<List<HealthVaccination>>
    suspend fun recordVaccination(vaccination: HealthVaccination)
    fun observeAppointments(familyId: String): Flow<List<HealthcareAppointment>>
    suspend fun scheduleAppointment(appointment: HealthcareAppointment)
}

interface EmergencyRepository {
    fun observeContacts(familyId: String): Flow<List<EmergencyContact>>
    suspend fun saveContact(contact: EmergencyContact)
    suspend fun deleteContact(id: String)
    fun observePlan(familyId: String): Flow<EmergencyPlan?>
    suspend fun savePlan(plan: EmergencyPlan)
    fun observeSupplies(familyId: String): Flow<List<EmergencySupply>>
    suspend fun saveSupply(supply: EmergencySupply)
    suspend fun toggleSupplyChecked(id: String, isChecked: Boolean)
    fun observeChecklist(familyId: String): Flow<List<EmergencyChecklistItem>>
    suspend fun saveChecklistItem(item: EmergencyChecklistItem)
    suspend fun toggleChecklistItem(id: String, isCompleted: Boolean)
}
