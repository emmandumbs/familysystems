package com.familyos.core.database

import androidx.room.*

/**
 * Stage 3 Database Entities for FamilyOS
 * Covers Finance (Accounts, Transactions, Transfers, Recurring, Budgets, Savings, Bills)
 * and Wellbeing & Emergency Safety (Profiles, Allergies, Medications, Vaccinations, Appointments, Contacts, Plans, Supplies, Checklists).
 *
 * CRITICAL RULE: All monetary amounts are strictly 64-bit integer cents (Long). Floating-point is forbidden.
 */

// ============================================================================
// 1. FINANCE MODULE ENTITIES
// ============================================================================

/**
 * 1. Financial Accounts (Checking, Savings, Credit Card, Investment, Cash, Loan)
 */
@Entity(
    tableName = "financial_accounts",
    foreignKeys = [
        ForeignKey(
            entity = FamilyWorkspaceEntity::class,
            parentColumns = ["id"],
            childColumns = ["family_id"],
            onDelete = ForeignKey.CASCADE
        )
    ],
    indices = [
        Index(value = ["family_id"]),
        Index(value = ["account_type"])
    ]
)
data class FinancialAccountEntity(
    @PrimaryKey
    val id: String,
    @ColumnInfo(name = "family_id")
    val familyId: String,
    val name: String,
    @ColumnInfo(name = "account_type")
    val accountType: String, // "CHECKING", "SAVINGS", "CREDIT_CARD", "INVESTMENT", "CASH", "LOAN"
    @ColumnInfo(name = "current_balance_cents")
    val currentBalanceCents: Long, // Signed Long integer cents (liabilities are negative)
    @ColumnInfo(name = "is_liability")
    val isLiability: Boolean = false,
    val currency: String = "USD",
    val institution: String? = null,
    @ColumnInfo(name = "is_archived")
    val isArchived: Boolean = false,
    @ColumnInfo(name = "created_at")
    val createdAt: Long = System.currentTimeMillis(),
    @ColumnInfo(name = "updated_at")
    val updatedAt: Long = System.currentTimeMillis()
)

/**
 * 2. Financial Transactions (Income, Expense, Internal Transfer, Reversal)
 */
@Entity(
    tableName = "financial_transactions",
    foreignKeys = [
        ForeignKey(
            entity = FamilyWorkspaceEntity::class,
            parentColumns = ["id"],
            childColumns = ["family_id"],
            onDelete = ForeignKey.CASCADE
        ),
        ForeignKey(
            entity = FinancialAccountEntity::class,
            parentColumns = ["id"],
            childColumns = ["account_id"],
            onDelete = ForeignKey.RESTRICT
        ),
        ForeignKey(
            entity = FinancialAccountEntity::class,
            parentColumns = ["id"],
            childColumns = ["destination_account_id"],
            onDelete = ForeignKey.SET_NULL
        )
    ],
    indices = [
        Index(value = ["family_id"]),
        Index(value = ["account_id"]),
        Index(value = ["destination_account_id"]),
        Index(value = ["transaction_date"]),
        Index(value = ["category"]),
        Index(value = ["idempotency_key"], unique = true)
    ]
)
data class FinancialTransactionEntity(
    @PrimaryKey
    val id: String,
    @ColumnInfo(name = "family_id")
    val familyId: String,
    @ColumnInfo(name = "account_id")
    val accountId: String,
    @ColumnInfo(name = "destination_account_id")
    val destinationAccountId: String? = null, // Used for internal transfers
    val title: String,
    @ColumnInfo(name = "amount_cents")
    val amountCents: Long, // Positive Long integer cents
    @ColumnInfo(name = "transaction_type")
    val transactionType: String, // "INCOME", "EXPENSE", "TRANSFER"
    val category: String, // "HOUSING", "FOOD", "TRANSPORT", "UTILITIES", "SALARY", "HEALTH", "EDUCATION", "TRANSFER", "OTHER"
    @ColumnInfo(name = "transaction_date")
    val transactionDate: Long, // Epoch ms
    @ColumnInfo(name = "is_cleared")
    val isCleared: Boolean = true,
    @ColumnInfo(name = "is_reversal")
    val isReversal: Boolean = false, // Audit trail: true if this reverses another transaction
    @ColumnInfo(name = "reversal_of_id")
    val reversalOfId: String? = null,
    val notes: String? = null,
    @ColumnInfo(name = "paid_by_member_id")
    val paidByMemberId: String? = null,
    @ColumnInfo(name = "idempotency_key")
    val idempotencyKey: String? = null,
    @ColumnInfo(name = "created_at")
    val createdAt: Long = System.currentTimeMillis()
)

/**
 * 3. Recurring Transaction Templates (Separate from posted transactions)
 */
@Entity(
    tableName = "recurring_transactions",
    foreignKeys = [
        ForeignKey(
            entity = FamilyWorkspaceEntity::class,
            parentColumns = ["id"],
            childColumns = ["family_id"],
            onDelete = ForeignKey.CASCADE
        ),
        ForeignKey(
            entity = FinancialAccountEntity::class,
            parentColumns = ["id"],
            childColumns = ["account_id"],
            onDelete = ForeignKey.CASCADE
        )
    ],
    indices = [
        Index(value = ["family_id"]),
        Index(value = ["account_id"])
    ]
)
data class RecurringTransactionEntity(
    @PrimaryKey
    val id: String,
    @ColumnInfo(name = "family_id")
    val familyId: String,
    @ColumnInfo(name = "account_id")
    val accountId: String,
    val title: String,
    @ColumnInfo(name = "amount_cents")
    val amountCents: Long,
    @ColumnInfo(name = "transaction_type")
    val transactionType: String, // "INCOME", "EXPENSE"
    val category: String,
    @ColumnInfo(name = "recurrence_interval")
    val recurrenceInterval: String, // "WEEKLY", "BIWEEKLY", "MONTHLY", "YEARLY"
    @ColumnInfo(name = "next_due_date")
    val nextDueDate: Long,
    @ColumnInfo(name = "is_active")
    val isActive: Boolean = true,
    @ColumnInfo(name = "created_at")
    val createdAt: Long = System.currentTimeMillis()
)

/**
 * 4. Monthly Envelope Budgets
 */
@Entity(
    tableName = "envelope_budgets",
    foreignKeys = [
        ForeignKey(
            entity = FamilyWorkspaceEntity::class,
            parentColumns = ["id"],
            childColumns = ["family_id"],
            onDelete = ForeignKey.CASCADE
        )
    ],
    indices = [
        Index(value = ["family_id"]),
        Index(value = ["family_id", "category", "month_epoch"], unique = true)
    ]
)
data class EnvelopeBudgetEntity(
    @PrimaryKey
    val id: String,
    @ColumnInfo(name = "family_id")
    val familyId: String,
    val category: String, // e.g. "GROCERIES", "UTILITIES", "DINING"
    @ColumnInfo(name = "allocated_cents")
    val allocatedCents: Long, // Planned budget in Long cents
    @ColumnInfo(name = "month_epoch")
    val monthEpoch: Long, // Start of month in epoch ms
    @ColumnInfo(name = "alert_threshold_percentage")
    val alertThresholdPercentage: Int = 85,
    @ColumnInfo(name = "created_at")
    val createdAt: Long = System.currentTimeMillis()
)

/**
 * 5. Savings Goals
 */
@Entity(
    tableName = "savings_goals",
    foreignKeys = [
        ForeignKey(
            entity = FamilyWorkspaceEntity::class,
            parentColumns = ["id"],
            childColumns = ["family_id"],
            onDelete = ForeignKey.CASCADE
        ),
        ForeignKey(
            entity = FinancialAccountEntity::class,
            parentColumns = ["id"],
            childColumns = ["linked_account_id"],
            onDelete = ForeignKey.SET_NULL
        )
    ],
    indices = [
        Index(value = ["family_id"]),
        Index(value = ["linked_account_id"])
    ]
)
data class SavingsGoalEntity(
    @PrimaryKey
    val id: String,
    @ColumnInfo(name = "family_id")
    val familyId: String,
    @ColumnInfo(name = "linked_account_id")
    val linkedAccountId: String? = null,
    val title: String,
    @ColumnInfo(name = "target_cents")
    val targetCents: Long,
    @ColumnInfo(name = "current_cents")
    val currentCents: Long = 0L,
    @ColumnInfo(name = "planned_monthly_contribution_cents")
    val plannedMonthlyContributionCents: Long = 0L,
    @ColumnInfo(name = "target_date")
    val targetDate: Long? = null,
    @ColumnInfo(name = "is_completed")
    val isCompleted: Boolean = false,
    @ColumnInfo(name = "created_at")
    val createdAt: Long = System.currentTimeMillis()
)

/**
 * 6. Bills & Subscriptions
 */
@Entity(
    tableName = "bills_subscriptions",
    foreignKeys = [
        ForeignKey(
            entity = FamilyWorkspaceEntity::class,
            parentColumns = ["id"],
            childColumns = ["family_id"],
            onDelete = ForeignKey.CASCADE
        ),
        ForeignKey(
            entity = FinancialAccountEntity::class,
            parentColumns = ["id"],
            childColumns = ["preferred_account_id"],
            onDelete = ForeignKey.SET_NULL
        )
    ],
    indices = [
        Index(value = ["family_id"]),
        Index(value = ["preferred_account_id"]),
        Index(value = ["due_date"])
    ]
)
data class BillSubscriptionEntity(
    @PrimaryKey
    val id: String,
    @ColumnInfo(name = "family_id")
    val familyId: String,
    @ColumnInfo(name = "preferred_account_id")
    val preferredAccountId: String? = null,
    val payee: String,
    @ColumnInfo(name = "amount_cents")
    val amountCents: Long,
    @ColumnInfo(name = "billing_cycle")
    val billingCycle: String, // "MONTHLY", "ANNUAL", "QUARTERLY"
    @ColumnInfo(name = "due_date")
    val dueDate: Long,
    @ColumnInfo(name = "is_subscription")
    val isSubscription: Boolean = false,
    @ColumnInfo(name = "is_auto_pay")
    val isAutoPay: Boolean = false,
    @ColumnInfo(name = "reminder_days_before")
    val reminderDaysBefore: Int = 3,
    @ColumnInfo(name = "created_at")
    val createdAt: Long = System.currentTimeMillis()
)

/**
 * 6B. Investment Holdings (INV-01)
 * Fixed-precision microshares (1.000000 share = 1,000,000 microshares).
 * Cost basis in Long integer cents. Price per 1.0 whole share in Long integer cents.
 */
@Entity(
    tableName = "investment_holdings",
    foreignKeys = [
        ForeignKey(
            entity = FamilyWorkspaceEntity::class,
            parentColumns = ["id"],
            childColumns = ["family_id"],
            onDelete = ForeignKey.CASCADE
        ),
        ForeignKey(
            entity = FinancialAccountEntity::class,
            parentColumns = ["id"],
            childColumns = ["account_id"],
            onDelete = ForeignKey.CASCADE
        )
    ],
    indices = [
        Index(value = ["family_id"]),
        Index(value = ["account_id"]),
        Index(value = ["symbol"])
    ]
)
data class InvestmentHoldingEntity(
    @PrimaryKey
    val id: String,
    @ColumnInfo(name = "family_id")
    val familyId: String,
    @ColumnInfo(name = "account_id")
    val accountId: String,
    val symbol: String, // e.g. "VTI", "AAPL", "FXAIX"
    @ColumnInfo(name = "asset_name")
    val assetName: String,
    @ColumnInfo(name = "asset_type")
    val assetType: String, // "STOCK", "ETF", "CRYPTO", "MUTUAL_FUND", "BOND", "RETIREMENT"
    @ColumnInfo(name = "quantity_microshares")
    val quantityMicroshares: Long, // 1.0 share = 1,000,000L microshares. No floating point!
    @ColumnInfo(name = "cost_basis_cents")
    val costBasisCents: Long, // Total integer cents paid for the holding
    @ColumnInfo(name = "current_price_cents")
    val currentPriceCents: Long, // Market price per 1.0 whole share in integer cents
    val currency: String = "USD",
    val notes: String? = null,
    @ColumnInfo(name = "last_price_updated_at")
    val lastPriceUpdatedAt: Long = System.currentTimeMillis(),
    val version: Int = 1,
    @ColumnInfo(name = "sync_status")
    val syncStatus: String = "LOCAL_ONLY",
    @ColumnInfo(name = "is_deleted")
    val isDeleted: Boolean = false,
    @ColumnInfo(name = "created_at")
    val createdAt: Long = System.currentTimeMillis(),
    @ColumnInfo(name = "updated_at")
    val updatedAt: Long = System.currentTimeMillis()
) {
    /**
     * Exact integer cents current market valuation:
     * (quantityMicroshares * currentPriceCents) / 1,000,000L
     */
    fun computeCurrentValuationCents(): Long {
        return (quantityMicroshares * currentPriceCents) / 1_000_000L
    }

    /**
     * Exact integer cents unrealized gain or loss:
     * computeCurrentValuationCents() - costBasisCents
     */
    fun computeUnrealizedGainLossCents(): Long {
        return computeCurrentValuationCents() - costBasisCents
    }

    /**
     * Gain/Loss percentage in Basis Points (100 basis points = 1.00%):
     * (unrealizedGainLossCents * 10,000L) / costBasisCents
     */
    fun computeGainLossBasisPoints(): Long {
        if (costBasisCents <= 0L) return 0L
        return (computeUnrealizedGainLossCents() * 10_000L) / costBasisCents
    }
}

// ============================================================================
// 2. WELLBEING & HEALTH MODULE ENTITIES
// ============================================================================

/**
 * 7. Individual Wellbeing Profiles
 */
@Entity(
    tableName = "wellbeing_profiles",
    foreignKeys = [
        ForeignKey(
            entity = FamilyWorkspaceEntity::class,
            parentColumns = ["id"],
            childColumns = ["family_id"],
            onDelete = ForeignKey.CASCADE
        ),
        ForeignKey(
            entity = FamilyMemberEntity::class,
            parentColumns = ["id"],
            childColumns = ["member_id"],
            onDelete = ForeignKey.CASCADE
        )
    ],
    indices = [
        Index(value = ["family_id"]),
        Index(value = ["member_id"], unique = true)
    ]
)
data class WellbeingProfileEntity(
    @PrimaryKey
    val id: String,
    @ColumnInfo(name = "family_id")
    val familyId: String,
    @ColumnInfo(name = "member_id")
    val memberId: String,
    @ColumnInfo(name = "blood_type")
    val bloodType: String? = null, // "A+", "O-", etc.
    @ColumnInfo(name = "medical_conditions_json")
    val medicalConditionsJson: String = "[]",
    @ColumnInfo(name = "insurance_provider")
    val insuranceProvider: String? = null,
    @ColumnInfo(name = "insurance_policy_number")
    val insurancePolicyNumber: String? = null,
    @ColumnInfo(name = "primary_physician_name")
    val primaryPhysicianName: String? = null,
    @ColumnInfo(name = "primary_physician_phone")
    val primaryPhysicianPhone: String? = null,
    @ColumnInfo(name = "notes")
    val notes: String? = null,
    @ColumnInfo(name = "updated_at")
    val updatedAt: Long = System.currentTimeMillis()
)

/**
 * 8. Health Allergies
 */
@Entity(
    tableName = "health_allergies",
    foreignKeys = [
        ForeignKey(
            entity = FamilyWorkspaceEntity::class,
            parentColumns = ["id"],
            childColumns = ["family_id"],
            onDelete = ForeignKey.CASCADE
        ),
        ForeignKey(
            entity = FamilyMemberEntity::class,
            parentColumns = ["id"],
            childColumns = ["member_id"],
            onDelete = ForeignKey.CASCADE
        )
    ],
    indices = [
        Index(value = ["family_id"]),
        Index(value = ["member_id"])
    ]
)
data class HealthAllergyEntity(
    @PrimaryKey
    val id: String,
    @ColumnInfo(name = "family_id")
    val familyId: String,
    @ColumnInfo(name = "member_id")
    val memberId: String,
    val allergen: String,
    val severity: String, // "MILD", "MODERATE", "SEVERE_ANAPHYLACTIC"
    val reaction: String,
    @ColumnInfo(name = "emergency_treatment")
    val emergencyTreatment: String? = null, // e.g. "EpiPen in backpack"
    @ColumnInfo(name = "created_at")
    val createdAt: Long = System.currentTimeMillis()
)

/**
 * 9. Health Medications & Schedules
 */
@Entity(
    tableName = "health_medications",
    foreignKeys = [
        ForeignKey(
            entity = FamilyWorkspaceEntity::class,
            parentColumns = ["id"],
            childColumns = ["family_id"],
            onDelete = ForeignKey.CASCADE
        ),
        ForeignKey(
            entity = FamilyMemberEntity::class,
            parentColumns = ["id"],
            childColumns = ["member_id"],
            onDelete = ForeignKey.CASCADE
        )
    ],
    indices = [
        Index(value = ["family_id"]),
        Index(value = ["member_id"])
    ]
)
data class HealthMedicationEntity(
    @PrimaryKey
    val id: String,
    @ColumnInfo(name = "family_id")
    val familyId: String,
    @ColumnInfo(name = "member_id")
    val memberId: String,
    @ColumnInfo(name = "medication_name")
    val medicationName: String,
    val dosage: String,
    @ColumnInfo(name = "schedule_frequency")
    val scheduleFrequency: String, // "DAILY", "TWICE_DAILY", "AS_NEEDED"
    @ColumnInfo(name = "schedule_times_json")
    val scheduleTimesJson: String, // e.g. ["08:00", "20:00"]
    val instructions: String? = null,
    @ColumnInfo(name = "is_active")
    val isActive: Boolean = true,
    @ColumnInfo(name = "created_at")
    val createdAt: Long = System.currentTimeMillis()
)

/**
 * 10. Health Vaccinations
 */
@Entity(
    tableName = "health_vaccinations",
    foreignKeys = [
        ForeignKey(
            entity = FamilyWorkspaceEntity::class,
            parentColumns = ["id"],
            childColumns = ["family_id"],
            onDelete = ForeignKey.CASCADE
        ),
        ForeignKey(
            entity = FamilyMemberEntity::class,
            parentColumns = ["id"],
            childColumns = ["member_id"],
            onDelete = ForeignKey.CASCADE
        )
    ],
    indices = [
        Index(value = ["family_id"]),
        Index(value = ["member_id"])
    ]
)
data class HealthVaccinationEntity(
    @PrimaryKey
    val id: String,
    @ColumnInfo(name = "family_id")
    val familyId: String,
    @ColumnInfo(name = "member_id")
    val memberId: String,
    @ColumnInfo(name = "vaccine_name")
    val vaccineName: String,
    @ColumnInfo(name = "date_administered")
    val dateAdministered: Long,
    @ColumnInfo(name = "next_booster_date")
    val nextBoosterDate: Long? = null,
    val provider: String? = null,
    @ColumnInfo(name = "lot_number")
    val lotNumber: String? = null,
    @ColumnInfo(name = "created_at")
    val createdAt: Long = System.currentTimeMillis()
)

/**
 * 11. Healthcare Appointments
 */
@Entity(
    tableName = "healthcare_appointments",
    foreignKeys = [
        ForeignKey(
            entity = FamilyWorkspaceEntity::class,
            parentColumns = ["id"],
            childColumns = ["family_id"],
            onDelete = ForeignKey.CASCADE
        ),
        ForeignKey(
            entity = FamilyMemberEntity::class,
            parentColumns = ["id"],
            childColumns = ["member_id"],
            onDelete = ForeignKey.CASCADE
        )
    ],
    indices = [
        Index(value = ["family_id"]),
        Index(value = ["member_id"]),
        Index(value = ["appointment_time"])
    ]
)
data class HealthcareAppointmentEntity(
    @PrimaryKey
    val id: String,
    @ColumnInfo(name = "family_id")
    val familyId: String,
    @ColumnInfo(name = "member_id")
    val memberId: String,
    @ColumnInfo(name = "provider_name")
    val providerName: String,
    val specialty: String, // "PEDIATRICIAN", "DENTIST", "OPTOMETRIST", "GENERAL", "SPECIALIST"
    @ColumnInfo(name = "appointment_time")
    val appointmentTime: Long,
    val location: String? = null,
    val notes: String? = null,
    @ColumnInfo(name = "created_at")
    val createdAt: Long = System.currentTimeMillis()
)

// ============================================================================
// 3. EMERGENCY PREPAREDNESS ENTITIES
// ============================================================================

/**
 * 12. Household Emergency Contacts
 */
@Entity(
    tableName = "emergency_contacts",
    foreignKeys = [
        ForeignKey(
            entity = FamilyWorkspaceEntity::class,
            parentColumns = ["id"],
            childColumns = ["family_id"],
            onDelete = ForeignKey.CASCADE
        )
    ],
    indices = [Index(value = ["family_id"])]
)
data class EmergencyContactEntity(
    @PrimaryKey
    val id: String,
    @ColumnInfo(name = "family_id")
    val familyId: String,
    val name: String,
    val relationship: String,
    @ColumnInfo(name = "phone_primary")
    val phonePrimary: String,
    @ColumnInfo(name = "phone_secondary")
    val phoneSecondary: String? = null,
    @ColumnInfo(name = "is_primary")
    val isPrimary: Boolean = false,
    val notes: String? = null,
    @ColumnInfo(name = "created_at")
    val createdAt: Long = System.currentTimeMillis()
)

/**
 * 13. Household Emergency Plans & Meeting Points
 */
@Entity(
    tableName = "emergency_plans",
    foreignKeys = [
        ForeignKey(
            entity = FamilyWorkspaceEntity::class,
            parentColumns = ["id"],
            childColumns = ["family_id"],
            onDelete = ForeignKey.CASCADE
        )
    ],
    indices = [Index(value = ["family_id"], unique = true)]
)
data class EmergencyPlanEntity(
    @PrimaryKey
    val id: String,
    @ColumnInfo(name = "family_id")
    val familyId: String,
    @ColumnInfo(name = "primary_meeting_point")
    val primaryMeetingPoint: String, // e.g. "Front yard oak tree"
    @ColumnInfo(name = "secondary_meeting_point")
    val secondaryMeetingPoint: String, // e.g. "Community Center parking lot"
    @ColumnInfo(name = "evacuation_route")
    val evacuationRoute: String? = null,
    @ColumnInfo(name = "gas_shutoff_location")
    val gasShutoffLocation: String? = null,
    @ColumnInfo(name = "water_shutoff_location")
    val waterShutoffLocation: String? = null,
    @ColumnInfo(name = "electrical_panel_location")
    val electricalPanelLocation: String? = null,
    val notes: String? = null,
    @ColumnInfo(name = "updated_at")
    val updatedAt: Long = System.currentTimeMillis()
)

/**
 * 14. Emergency Supplies Inventory
 */
@Entity(
    tableName = "emergency_supplies",
    foreignKeys = [
        ForeignKey(
            entity = FamilyWorkspaceEntity::class,
            parentColumns = ["id"],
            childColumns = ["family_id"],
            onDelete = ForeignKey.CASCADE
        )
    ],
    indices = [Index(value = ["family_id"])]
)
data class EmergencySupplyEntity(
    @PrimaryKey
    val id: String,
    @ColumnInfo(name = "family_id")
    val familyId: String,
    @ColumnInfo(name = "item_name")
    val itemName: String,
    val category: String, // "WATER", "FOOD", "FIRST_AID", "POWER_LIGHT", "TOOLS"
    val quantity: String,
    @ColumnInfo(name = "storage_location")
    val storageLocation: String,
    @ColumnInfo(name = "expiry_date")
    val expiryDate: Long? = null,
    @ColumnInfo(name = "is_checked")
    val isChecked: Boolean = false,
    @ColumnInfo(name = "created_at")
    val createdAt: Long = System.currentTimeMillis()
)

/**
 * 15. Emergency Readiness Checklist Items
 */
@Entity(
    tableName = "emergency_checklist_items",
    foreignKeys = [
        ForeignKey(
            entity = FamilyWorkspaceEntity::class,
            parentColumns = ["id"],
            childColumns = ["family_id"],
            onDelete = ForeignKey.CASCADE
        ),
        ForeignKey(
            entity = FamilyMemberEntity::class,
            parentColumns = ["id"],
            childColumns = ["assigned_member_id"],
            onDelete = ForeignKey.SET_NULL
        )
    ],
    indices = [
        Index(value = ["family_id"]),
        Index(value = ["assigned_member_id"])
    ]
)
data class EmergencyChecklistItemEntity(
    @PrimaryKey
    val id: String,
    @ColumnInfo(name = "family_id")
    val familyId: String,
    val title: String,
    val category: String, // "EVACUATION", "STORM_PREP", "COMMUNICATION", "ANNUAL_REVIEW"
    @ColumnInfo(name = "is_completed")
    val isCompleted: Boolean = false,
    @ColumnInfo(name = "assigned_member_id")
    val assignedMemberId: String? = null,
    @ColumnInfo(name = "completed_at")
    val completedAt: Long? = null,
    @ColumnInfo(name = "created_at")
    val createdAt: Long = System.currentTimeMillis()
)
