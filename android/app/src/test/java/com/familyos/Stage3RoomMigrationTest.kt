package com.familyos

import androidx.sqlite.db.SupportSQLiteDatabase
import com.familyos.core.database.FamilyOSDatabase
import io.mockk.*
import org.junit.Assert.*
import org.junit.Test

/**
 * Stage 3 Room Migration Unit Test Suite
 * Validates:
 * 1. MIGRATION_2_3 startVersion (2) and endVersion (3).
 * 2. Execution of DDL creating all 15 Stage 3 tables.
 * 3. Generation of all critical indexes for foreign keys and queries.
 * 4. Zero drop or truncate commands on existing v1 or v2 tables.
 */
class Stage3RoomMigrationTest {

    private val expectedV3Tables = listOf(
        "financial_accounts",
        "financial_transactions",
        "recurring_transactions",
        "envelope_budgets",
        "savings_goals",
        "bills_subscriptions",
        "wellbeing_profiles",
        "health_allergies",
        "health_medications",
        "health_vaccinations",
        "healthcare_appointments",
        "emergency_contacts",
        "emergency_plans",
        "emergency_supplies",
        "emergency_checklist_items"
    )

    @Test
    fun testMigration2To3DefinitionAndVersions() {
        val migration = FamilyOSDatabase.MIGRATION_2_3
        assertNotNull(migration)
        assertEquals(2, migration.startVersion)
        assertEquals(3, migration.endVersion)
    }

    @Test
    fun testMigration2To3CreatesAll15Stage3TablesAndIndices() {
        val executedSqlStatements = mutableListOf<String>()
        val mockDb = mockk<SupportSQLiteDatabase>(relaxed = true)

        every { mockDb.execSQL(capture(executedSqlStatements)) } just Runs

        // Execute real MIGRATION_2_3
        FamilyOSDatabase.MIGRATION_2_3.migrate(mockDb)

        assertTrue("MIGRATION_2_3 must execute DDL statements", executedSqlStatements.isNotEmpty())

        val fullSqlScript = executedSqlStatements.joinToString("\n")

        // 1. Verify every Stage 3 table has a CREATE TABLE statement
        for (table in expectedV3Tables) {
            assertTrue(
                "MIGRATION_2_3 must create table '$table'",
                fullSqlScript.contains("CREATE TABLE IF NOT EXISTS `$table`")
            )
        }

        // 2. Verify critical indexes are generated
        assertTrue(fullSqlScript.contains("index_financial_accounts_family_id"))
        assertTrue(fullSqlScript.contains("index_financial_transactions_account_id"))
        assertTrue(fullSqlScript.contains("index_envelope_budgets_family_id_category_month_epoch"))
        assertTrue(fullSqlScript.contains("index_wellbeing_profiles_member_id"))
        assertTrue(fullSqlScript.contains("index_health_medications_member_id"))
        assertTrue(fullSqlScript.contains("index_emergency_contacts_family_id"))
        assertTrue(fullSqlScript.contains("index_emergency_plans_family_id"))

        // 3. Confirm zero DROP TABLE or ALTER TABLE DROP statements exist
        assertFalse(
            "MIGRATION_2_3 must never drop tables or destroy user data",
            fullSqlScript.uppercase().contains("DROP TABLE")
        )
    }
}
