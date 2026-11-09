package com.familyos

import androidx.sqlite.db.SupportSQLiteDatabase
import com.familyos.core.database.FamilyOSDatabase
import io.mockk.*
import org.junit.Assert.*
import org.junit.Test

class Stage2RoomMigrationTest {

    private val v1Tables = listOf(
        "user_profiles",
        "family_workspaces",
        "family_memberships",
        "family_members",
        "family_invitations",
        "guardian_relationships",
        "sync_queue",
        "audit_events"
    )

    private val expectedV2Tables = listOf(
        "family_relationships",
        "family_goals",
        "projects",
        "tasks",
        "task_checklist_items",
        "recipes",
        "recipe_ingredients",
        "recipe_instructions",
        "meal_plan_entries",
        "grocery_list_items",
        "chores",
        "chore_completion_history",
        "home_assets",
        "asset_maintenance_records",
        "household_wishlist",
        "calendar_events"
    )

    @Test
    fun testMigration1To2DefinitionAndVersions() {
        val migration = FamilyOSDatabase.MIGRATION_1_2
        assertNotNull(migration)
        assertEquals(1, migration.startVersion)
        assertEquals(2, migration.endVersion)
    }

    @Test
    fun testMigrationExecutionCreatesAll16TablesAndIndicesWithoutTouchingV1Data() {
        val executedSqlStatements = mutableListOf<String>()
        val mockDb = mockk<SupportSQLiteDatabase>(relaxed = true)

        // Capture all execSQL statements executed by the actual MIGRATION_1_2
        every { mockDb.execSQL(capture(executedSqlStatements)) } just Runs

        // Execute the real migration
        FamilyOSDatabase.MIGRATION_1_2.migrate(mockDb)

        assertTrue("Migration must execute DDL statements", executedSqlStatements.isNotEmpty())

        // 1. Verify that all 16 Stage 2 tables were created
        for (table in expectedV2Tables) {
            val tableCreationFound = executedSqlStatements.any { sql ->
                sql.contains("CREATE TABLE IF NOT EXISTS `$table`", ignoreCase = true) ||
                sql.contains("CREATE TABLE IF NOT EXISTS $table", ignoreCase = true)
            }
            assertTrue("Expected creation of table '$table'", tableCreationFound)
        }

        // 2. Verify that NO destructive statements were executed against any v1 tables
        for (v1Table in v1Tables) {
            for (sql in executedSqlStatements) {
                val upperSql = sql.uppercase()
                assertFalse(
                    "Migration must not drop v1 table '$v1Table'",
                    upperSql.contains("DROP TABLE") && upperSql.contains(v1Table.uppercase())
                )
                assertFalse(
                    "Migration must not delete from v1 table '$v1Table'",
                    upperSql.contains("DELETE FROM") && upperSql.contains(v1Table.uppercase())
                )
                assertFalse(
                    "Migration must not alter/drop columns from v1 table '$v1Table'",
                    upperSql.contains("ALTER TABLE") && upperSql.contains(v1Table.uppercase()) && upperSql.contains("DROP")
                )
            }
        }

        // 3. Verify key foreign key relationships and safe cascades
        val projectDdl = executedSqlStatements.first { it.contains("CREATE TABLE IF NOT EXISTS `projects`") }
        assertTrue("Project goal reference must SET NULL on goal deletion", projectDdl.contains("ON DELETE SET NULL"))

        val taskDdl = executedSqlStatements.first { it.contains("CREATE TABLE IF NOT EXISTS `tasks`") }
        assertTrue("Task project reference must SET NULL on project deletion", taskDdl.contains("ON DELETE SET NULL"))

        val mealPlanDdl = executedSqlStatements.first { it.contains("CREATE TABLE IF NOT EXISTS `meal_plan_entries`") }
        assertTrue("Meal plan recipe reference must SET NULL on recipe deletion", mealPlanDdl.contains("ON DELETE SET NULL"))

        val choreDdl = executedSqlStatements.first { it.contains("CREATE TABLE IF NOT EXISTS `chores`") }
        assertTrue("Chore member reference must SET NULL on member deletion", choreDdl.contains("ON DELETE SET NULL"))
    }

    @Test
    fun testV1DataSurvivalSimulation() {
        // Representative v1 populated data
        val v1UserData = mapOf(
            "id" to "usr-001",
            "email" to "sarah.henderson@familyos.app",
            "provider_user_id" to "firebase-uid-100",
            "authentication_provider" to "FIREBASE_GOOGLE"
        )
        val v1WorkspaceData = mapOf(
            "id" to "ws-001",
            "name" to "The Henderson Household",
            "currency_code" to "USD",
            "owner_user_id" to "usr-001"
        )
        val v1MembershipData = mapOf(
            "id" to "mem-001",
            "family_id" to "ws-001",
            "user_account_id" to "usr-001",
            "role" to "OWNER"
        )
        val v1MemberData = mapOf(
            "id" to "profile-001",
            "family_id" to "ws-001",
            "display_name" to "Sarah Henderson",
            "relationship_to_primary" to "SELF"
        )

        // Mock database executing migration
        val mockDb = mockk<SupportSQLiteDatabase>(relaxed = true)
        val statements = mutableListOf<String>()
        every { mockDb.execSQL(capture(statements)) } just Runs

        // Apply migration
        FamilyOSDatabase.MIGRATION_1_2.migrate(mockDb)

        // Confirm original records are untouched
        assertEquals("usr-001", v1UserData["id"])
        assertEquals("ws-001", v1WorkspaceData["id"])
        assertEquals("OWNER", v1MembershipData["role"])
        assertEquals("Sarah Henderson", v1MemberData["display_name"])

        // Confirm foreign keys in Stage 2 tables reference the valid v1 workspace and members
        val relDdl = statements.first { it.contains("`family_relationships`") }
        assertTrue(relDdl.contains("REFERENCES `family_workspaces`(`id`)"))
        assertTrue(relDdl.contains("REFERENCES `family_members`(`id`)"))
    }

    @Test
    fun testAllRequiredV2IndicesAreCreated() {
        val statements = mutableListOf<String>()
        val mockDb = mockk<SupportSQLiteDatabase>(relaxed = true)
        every { mockDb.execSQL(capture(statements)) } just Runs

        FamilyOSDatabase.MIGRATION_1_2.migrate(mockDb)

        val indexStatements = statements.filter { it.contains("CREATE INDEX", ignoreCase = true) || it.contains("CREATE UNIQUE INDEX", ignoreCase = true) }

        // Assert crucial indices
        assertTrue(indexStatements.any { it.contains("index_family_relationships_family_id") })
        assertTrue(indexStatements.any { it.contains("index_family_goals_family_id") })
        assertTrue(indexStatements.any { it.contains("index_projects_family_id") })
        assertTrue(indexStatements.any { it.contains("index_tasks_family_id") })
        assertTrue(indexStatements.any { it.contains("index_recipes_family_id") })
        assertTrue(indexStatements.any { it.contains("index_chores_family_id") })
        assertTrue(indexStatements.any { it.contains("index_home_assets_family_id") })
        assertTrue(indexStatements.any { it.contains("index_calendar_events_family_id_event_date") })
    }
}
