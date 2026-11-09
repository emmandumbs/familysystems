package com.familyos

import androidx.sqlite.db.SupportSQLiteDatabase
import com.familyos.core.database.FamilyOSDatabase
import io.mockk.*
import org.junit.Assert.*
import org.junit.Test

/**
 * Master Stage 5 Room Migration 7 -> 8 Unit Test Suite
 *
 * Validates:
 * 1. MIGRATION_7_8 definition: startVersion (7) -> endVersion (8).
 * 2. Execution of DDL creating all 5 FTS4 virtual tables.
 * 3. Data population from base tables (recipes, tasks, family_goals, home_assets, family_traditions).
 * 4. Zero drop or alter commands affecting pre-existing v1–v7 tables.
 */
class Migration7To8Test {

    private val expectedFtsTables = listOf(
        "recipes_fts",
        "tasks_fts",
        "family_goals_fts",
        "home_assets_fts",
        "family_traditions_fts"
    )

    @Test
    fun testMigration7To8DefinitionAndVersions() {
        val migration = FamilyOSDatabase.MIGRATION_7_8
        assertNotNull("MIGRATION_7_8 must be defined", migration)
        assertEquals("startVersion must be 7", 7, migration.startVersion)
        assertEquals("endVersion must be 8", 8, migration.endVersion)
    }

    @Test
    fun testMigration7To8CreatesAllFtsTablesAndPopulatesRows() {
        val executedSqlStatements = mutableListOf<String>()
        val mockDb = mockk<SupportSQLiteDatabase>(relaxed = true)

        every { mockDb.execSQL(capture(executedSqlStatements)) } just Runs

        // Execute MIGRATION_7_8
        FamilyOSDatabase.MIGRATION_7_8.migrate(mockDb)

        assertTrue("MIGRATION_7_8 must execute SQL statements", executedSqlStatements.isNotEmpty())

        val fullSqlScript = executedSqlStatements.joinToString("\n")

        // 1. Verify FTS4 virtual table creation for all 5 domains
        for (ftsTable in expectedFtsTables) {
            assertTrue(
                "MIGRATION_7_8 must create FTS4 virtual table '$ftsTable'",
                fullSqlScript.contains("CREATE VIRTUAL TABLE IF NOT EXISTS `$ftsTable` USING FTS4")
            )
        }

        // 2. Verify data population from base tables
        assertTrue("Must populate recipes_fts from recipes", fullSqlScript.contains("INSERT INTO `recipes_fts`"))
        assertTrue("Must populate tasks_fts from tasks", fullSqlScript.contains("INSERT INTO `tasks_fts`"))
        assertTrue("Must populate family_goals_fts from family_goals", fullSqlScript.contains("INSERT INTO `family_goals_fts`"))
        assertTrue("Must populate home_assets_fts from home_assets", fullSqlScript.contains("INSERT INTO `home_assets_fts`"))
        assertTrue("Must populate family_traditions_fts from family_traditions", fullSqlScript.contains("INSERT INTO `family_traditions_fts`"))

        // 3. Verify FTS4 content-sync triggers for all 5 domains
        for (ftsTable in expectedFtsTables) {
            for (suffix in listOf("BEFORE_UPDATE", "BEFORE_DELETE", "AFTER_UPDATE", "AFTER_INSERT")) {
                assertTrue(
                    "MIGRATION_7_8 must create trigger 'room_fts_content_sync_${ftsTable}_$suffix'",
                    fullSqlScript.contains("CREATE TRIGGER IF NOT EXISTS room_fts_content_sync_${ftsTable}_$suffix")
                )
            }
        }

        // 4. Confirm zero destructive DROP TABLE commands exist
        assertFalse(
            "MIGRATION_7_8 must never drop base tables",
            fullSqlScript.uppercase().contains("DROP TABLE")
        )
    }

    @Test
    fun testMigration8To9AddsIdempotencyKeyAndUniqueIndex() {
        val migration = FamilyOSDatabase.MIGRATION_8_9
        assertNotNull("MIGRATION_8_9 must be defined", migration)
        assertEquals("startVersion must be 8", 8, migration.startVersion)
        assertEquals("endVersion must be 9", 9, migration.endVersion)

        val executedSqlStatements = mutableListOf<String>()
        val mockDb = mockk<SupportSQLiteDatabase>(relaxed = true)
        every { mockDb.execSQL(capture(executedSqlStatements)) } just Runs

        migration.migrate(mockDb)

        val fullSql = executedSqlStatements.joinToString("\n")
        assertTrue(
            "MIGRATION_8_9 must add idempotency_key TEXT column to financial_transactions",
            fullSql.contains("ALTER TABLE `financial_transactions` ADD COLUMN `idempotency_key` TEXT")
        )
        assertTrue(
            "MIGRATION_8_9 must create unique index index_financial_transactions_idempotency_key",
            fullSql.contains("CREATE UNIQUE INDEX IF NOT EXISTS `index_financial_transactions_idempotency_key` ON `financial_transactions` (`idempotency_key`)")
        )
        assertFalse(
            "MIGRATION_8_9 must never drop base tables",
            fullSql.uppercase().contains("DROP TABLE")
        )
    }
}

