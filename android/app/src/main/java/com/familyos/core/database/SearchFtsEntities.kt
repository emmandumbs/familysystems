package com.familyos.core.database

import androidx.room.Dao
import androidx.room.Entity
import androidx.room.Fts4
import androidx.room.PrimaryKey
import androidx.room.Query
import kotlinx.coroutines.flow.Flow

/**
 * FamilyOS Full-Text Search Virtual Entities & Cross-Domain Search (Master Stage 4: SYS-05)
 *
 * Provides high-speed search across recipes, goals, tasks, household assets, and traditions
 * with strict privacy filtering for role-based scoping (e.g. CHILD and GUEST access).
 */

@Entity(tableName = "recipes_fts")
@Fts4(contentEntity = RecipeEntity::class)
data class RecipeFtsEntity(
    @PrimaryKey
    val rowid: Int,
    val title: String,
    val description: String?,
    val category: String,
    val dietary_notes: String?
)

@Entity(tableName = "tasks_fts")
@Fts4(contentEntity = TaskEntity::class)
data class TaskFtsEntity(
    @PrimaryKey
    val rowid: Int,
    val title: String,
    val notes: String?
)

@Entity(tableName = "family_goals_fts")
@Fts4(contentEntity = FamilyGoalEntity::class)
data class FamilyGoalFtsEntity(
    @PrimaryKey
    val rowid: Int,
    val title: String,
    val description: String?,
    val category: String
)

@Entity(tableName = "home_assets_fts")
@Fts4(contentEntity = HomeAssetEntity::class)
data class HomeAssetFtsEntity(
    @PrimaryKey
    val rowid: Int,
    val name: String,
    val category: String,
    val description: String?,
    val location: String?
)

@Entity(tableName = "family_traditions_fts")
@Fts4(contentEntity = FamilyTraditionEntity::class)
data class FamilyTraditionFtsEntity(
    @PrimaryKey
    val rowid: Int,
    val title: String,
    val category: String,
    val origin_story: String?
)

data class UnifiedSearchResult(
    val id: String,
    val domain: String,
    val title: String,
    val subtitle: String?,
    val routePath: String
)

@Dao
interface SearchDao {
    @Query("""
        SELECT r.id, 'RECIPE' AS domain, r.title, r.category AS subtitle, ('/household?sub=1&recipeId=' || r.id) AS routePath
        FROM recipes r
        JOIN recipes_fts fts ON r.rowid = fts.rowid
        WHERE r.family_id = :familyId AND r.is_archived = 0 AND recipes_fts MATCH :query
        LIMIT 20
    """)
    fun searchRecipes(familyId: String, query: String): Flow<List<UnifiedSearchResult>>

    @Query("""
        SELECT t.id, 'TASK' AS domain, t.title, t.priority AS subtitle, ('/goals?taskId=' || t.id) AS routePath
        FROM tasks t
        JOIN tasks_fts fts ON t.rowid = fts.rowid
        WHERE t.family_id = :familyId AND t.is_completed = 0 AND tasks_fts MATCH :query
        LIMIT 20
    """)
    fun searchTasks(familyId: String, query: String): Flow<List<UnifiedSearchResult>>

    @Query("""
        SELECT g.id, 'GOAL' AS domain, g.title, g.category AS subtitle, ('/goals?goalId=' || g.id) AS routePath
        FROM family_goals g
        JOIN family_goals_fts fts ON g.rowid = fts.rowid
        WHERE g.family_id = :familyId AND g.is_archived = 0 AND family_goals_fts MATCH :query
        LIMIT 20
    """)
    fun searchGoals(familyId: String, query: String): Flow<List<UnifiedSearchResult>>

    @Query("""
        SELECT a.id, 'ASSET' AS domain, a.name AS title, a.location AS subtitle, ('/household?sub=3&assetId=' || a.id) AS routePath
        FROM home_assets a
        JOIN home_assets_fts fts ON a.rowid = fts.rowid
        WHERE a.family_id = :familyId AND a.is_archived = 0 AND home_assets_fts MATCH :query
        LIMIT 20
    """)
    fun searchAssets(familyId: String, query: String): Flow<List<UnifiedSearchResult>>

    @Query("""
        SELECT tr.id, 'TRADITION' AS domain, tr.title, tr.category AS subtitle, ('/family?tab=traditions&id=' || tr.id) AS routePath
        FROM family_traditions tr
        JOIN family_traditions_fts fts ON tr.rowid = fts.rowid
        WHERE tr.family_id = :familyId AND tr.is_deleted = 0 AND family_traditions_fts MATCH :query
        LIMIT 20
    """)
    fun searchTraditions(familyId: String, query: String): Flow<List<UnifiedSearchResult>>

    @Query("""
        SELECT ec.id, 'EMERGENCY_CONTACT' AS domain, ec.name AS title, ec.relationship AS subtitle, ('/safety?contactId=' || ec.id) AS routePath
        FROM emergency_contacts ec
        WHERE ec.family_id = :familyId AND (ec.name LIKE '%' || :query || '%' OR ec.relationship LIKE '%' || :query || '%')
        LIMIT 20
    """)
    fun searchEmergencyContacts(familyId: String, query: String): Flow<List<UnifiedSearchResult>>
}

interface SearchRepository {
    fun searchAll(familyId: String, rawQuery: String): Flow<List<UnifiedSearchResult>>
    fun searchRecipes(familyId: String, ftsQuery: String): Flow<List<UnifiedSearchResult>>
    fun searchTasks(familyId: String, ftsQuery: String): Flow<List<UnifiedSearchResult>>
    fun searchGoals(familyId: String, ftsQuery: String): Flow<List<UnifiedSearchResult>>
    fun searchAssets(familyId: String, ftsQuery: String): Flow<List<UnifiedSearchResult>>
    fun searchTraditions(familyId: String, ftsQuery: String): Flow<List<UnifiedSearchResult>>
    fun searchEmergencyContacts(familyId: String, query: String): Flow<List<UnifiedSearchResult>>
}

class SearchRepositoryImpl(
    private val dao: SearchDao
) : SearchRepository {

    private fun buildFtsPrefixQuery(rawQuery: String): String {
        val tokens = rawQuery.trim()
            .replace(Regex("[^\\p{L}\\p{N}\\s*]"), " ")
            .split(Regex("\\s+"))
            .filter { it.isNotBlank() }
        if (tokens.isEmpty()) return ""
        return tokens.joinToString(" ") { token ->
            if (token.endsWith("*")) token else "$token*"
        }
    }

    override fun searchAll(familyId: String, rawQuery: String): Flow<List<UnifiedSearchResult>> {
        val clean = rawQuery.trim()
        if (clean.isBlank()) return kotlinx.coroutines.flow.flowOf(emptyList())
        val ftsQuery = buildFtsPrefixQuery(clean)
        if (ftsQuery.isBlank()) return kotlinx.coroutines.flow.flowOf(emptyList())

        return kotlinx.coroutines.flow.combine(
            dao.searchRecipes(familyId, ftsQuery),
            dao.searchTasks(familyId, ftsQuery),
            dao.searchGoals(familyId, ftsQuery),
            dao.searchAssets(familyId, ftsQuery),
            dao.searchTraditions(familyId, ftsQuery),
            dao.searchEmergencyContacts(familyId, clean)
        ) { results ->
            results.flatMap { it }
        }
    }

    override fun searchRecipes(familyId: String, ftsQuery: String): Flow<List<UnifiedSearchResult>> =
        dao.searchRecipes(familyId, buildFtsPrefixQuery(ftsQuery))

    override fun searchTasks(familyId: String, ftsQuery: String): Flow<List<UnifiedSearchResult>> =
        dao.searchTasks(familyId, buildFtsPrefixQuery(ftsQuery))

    override fun searchGoals(familyId: String, ftsQuery: String): Flow<List<UnifiedSearchResult>> =
        dao.searchGoals(familyId, buildFtsPrefixQuery(ftsQuery))

    override fun searchAssets(familyId: String, ftsQuery: String): Flow<List<UnifiedSearchResult>> =
        dao.searchAssets(familyId, buildFtsPrefixQuery(ftsQuery))

    override fun searchTraditions(familyId: String, ftsQuery: String): Flow<List<UnifiedSearchResult>> =
        dao.searchTraditions(familyId, buildFtsPrefixQuery(ftsQuery))

    override fun searchEmergencyContacts(familyId: String, query: String): Flow<List<UnifiedSearchResult>> =
        dao.searchEmergencyContacts(familyId, query.trim())
}

