package com.familyos.core.navigation

import com.familyos.core.domain.Recipe
import com.familyos.core.domain.RecipeRepository
import java.net.URI

/**
 * Result of parsing a FamilyOS incoming deep link URI.
 */
sealed class DeepLinkResult {
    data class RecipeDetail(val recipeId: String) : DeepLinkResult()
    data object Invalid : DeepLinkResult()
}

/**
 * Validates and safely parses incoming deep links into strongly typed results.
 * Scheme format: familyos://recipe/{id} or familyos://recipes/{id}
 */
object RecipeDeepLinkParser {
    private const val EXPECTED_SCHEME = "familyos"
    private val EXPECTED_HOSTS = setOf("recipe", "recipes")
    private val VALID_ID_REGEX = Regex("^[a-zA-Z0-9_-]{1,128}$")

    fun parse(uriString: String?): DeepLinkResult {
        if (uriString.isNullOrBlank()) return DeepLinkResult.Invalid

        return try {
            val uri = URI.create(uriString)
            val scheme = uri.scheme?.lowercase()
            val host = uri.host?.lowercase()

            if (scheme != EXPECTED_SCHEME) return DeepLinkResult.Invalid
            if (host == null || host !in EXPECTED_HOSTS) return DeepLinkResult.Invalid

            // Extract path segment (e.g., "/recipe-123" -> "recipe-123")
            val rawPath = uri.path ?: ""
            val segments = rawPath.split("/").filter { it.isNotBlank() }

            if (segments.size != 1) {
                // Must have exactly one path segment representing the recipe ID
                return DeepLinkResult.Invalid
            }

            val recipeId = segments.first()
            if (!VALID_ID_REGEX.matches(recipeId)) {
                return DeepLinkResult.Invalid
            }

            DeepLinkResult.RecipeDetail(recipeId)
        } catch (e: Exception) {
            DeepLinkResult.Invalid
        }
    }
}

/**
 * Resolution outcome when fetching and authorizing a deep-linked recipe.
 */
sealed class RecipeResolutionResult {
    data class Success(val recipe: Recipe) : RecipeResolutionResult()
    data class NotFound(val recipeId: String) : RecipeResolutionResult()
    data class Unauthorized(val recipeId: String, val activeFamilyId: String) : RecipeResolutionResult()
    data class Error(val message: String) : RecipeResolutionResult()
}

/**
 * Resolves recipe from local offline-first Room cache and enforces family boundary authorization.
 */
class RecipeDeepLinkResolver(
    private val recipeRepository: RecipeRepository
) {
    suspend fun resolveRecipe(
        recipeId: String,
        activeFamilyId: String
    ): RecipeResolutionResult {
        return try {
            val recipe = recipeRepository.getRecipe(recipeId)
                ?: return RecipeResolutionResult.NotFound(recipeId)

            if (recipe.familyId != activeFamilyId) {
                return RecipeResolutionResult.Unauthorized(recipeId, activeFamilyId)
            }

            RecipeResolutionResult.Success(recipe)
        } catch (e: Exception) {
            RecipeResolutionResult.Error(e.message ?: "Failed to resolve recipe from database")
        }
    }
}
