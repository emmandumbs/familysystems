package com.familyos

import com.familyos.core.domain.*
import com.familyos.core.navigation.*
import io.mockk.coEvery
import io.mockk.mockk
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.test.runTest
import org.junit.Assert.*
import org.junit.Test

class RecipeDeepLinkTest {

    @Test
    fun testValidDeepLinkParsing() {
        val result = RecipeDeepLinkParser.parse("familyos://recipes/classic-lasagna")
        assertTrue(result is DeepLinkResult.RecipeDetail)
        assertEquals("classic-lasagna", (result as DeepLinkResult.RecipeDetail).recipeId)

        val singularResult = RecipeDeepLinkParser.parse("familyos://recipe/classic-lasagna")
        assertTrue(singularResult is DeepLinkResult.RecipeDetail)
        assertEquals("classic-lasagna", (singularResult as DeepLinkResult.RecipeDetail).recipeId)

        val uuidResult = RecipeDeepLinkParser.parse("familyos://recipes/550e8400-e29b-41d4-a716-446655440000")
        assertTrue(uuidResult is DeepLinkResult.RecipeDetail)
        assertEquals("550e8400-e29b-41d4-a716-446655440000", (uuidResult as DeepLinkResult.RecipeDetail).recipeId)
    }

    @Test
    fun testInvalidSchemeAndHostRejected() {
        // HTTP instead of familyos scheme
        val httpResult = RecipeDeepLinkParser.parse("https://recipes/classic-lasagna")
        assertEquals(DeepLinkResult.Invalid, httpResult)

        // Wrong host
        val wrongHost = RecipeDeepLinkParser.parse("familyos://chores/123")
        assertEquals(DeepLinkResult.Invalid, wrongHost)

        // Null or blank
        assertEquals(DeepLinkResult.Invalid, RecipeDeepLinkParser.parse(null))
        assertEquals(DeepLinkResult.Invalid, RecipeDeepLinkParser.parse(""))
        assertEquals(DeepLinkResult.Invalid, RecipeDeepLinkParser.parse("   "))
    }

    @Test
    fun testPathTraversalAndMalformedUrisRejected() {
        // Path traversal attempts
        assertEquals(DeepLinkResult.Invalid, RecipeDeepLinkParser.parse("familyos://recipes/../secret"))
        assertEquals(DeepLinkResult.Invalid, RecipeDeepLinkParser.parse("familyos://recipes/123/subtask"))
        assertEquals(DeepLinkResult.Invalid, RecipeDeepLinkParser.parse("familyos://recipes/"))
        assertEquals(DeepLinkResult.Invalid, RecipeDeepLinkParser.parse("familyos://recipes/invalid characters with spaces"))
        assertEquals(DeepLinkResult.Invalid, RecipeDeepLinkParser.parse("familyos://recipes/hack<script>"))
    }

    @Test
    fun testRecipeResolutionSuccessForActiveFamilyWorkspace() = runTest {
        val mockRepo = mockk<RecipeRepository>()
        val testRecipe = Recipe(
            id = "recipe-lasagna",
            familyId = "henderson-family-1",
            title = "Grandma's Classic Lasagna",
            description = "Rich layered beef & ricotta lasagna",
            imageUri = null,
            prepTimeMinutes = 30,
            cookTimeMinutes = 60,
            servings = 6,
            difficulty = RecipeDifficulty.MEDIUM,
            category = "DINNER",
            dietaryNotes = null,
            familyRating = 5,
            isFavorite = true,
            source = "Grandma Henderson",
            storageInstructions = "Refrigerate up to 4 days"
        )

        coEvery { mockRepo.getRecipe("recipe-lasagna") } returns testRecipe

        val resolver = RecipeDeepLinkResolver(mockRepo)
        val result = resolver.resolveRecipe(
            recipeId = "recipe-lasagna",
            activeFamilyId = "henderson-family-1"
        )

        assertTrue(result is RecipeResolutionResult.Success)
        val successResult = result as RecipeResolutionResult.Success
        assertEquals("Grandma's Classic Lasagna", successResult.recipe.title)
        assertEquals(6, successResult.recipe.servings)
    }

    @Test
    fun testRecipeResolutionNotFoundHandledGracefully() = runTest {
        val mockRepo = mockk<RecipeRepository>()
        coEvery { mockRepo.getRecipe("missing-recipe") } returns null

        val resolver = RecipeDeepLinkResolver(mockRepo)
        val result = resolver.resolveRecipe(
            recipeId = "missing-recipe",
            activeFamilyId = "henderson-family-1"
        )

        assertTrue(result is RecipeResolutionResult.NotFound)
        assertEquals("missing-recipe", (result as RecipeResolutionResult.NotFound).recipeId)
    }

    @Test
    fun testRecipeResolutionUnauthorizedWhenBelongingToDifferentFamily() = runTest {
        val mockRepo = mockk<RecipeRepository>()
        val otherFamilyRecipe = Recipe(
            id = "recipe-secret",
            familyId = "foreign-family-workspace-999",
            title = "Secret Family Stew",
            description = "Confidential",
            imageUri = null,
            prepTimeMinutes = 15,
            cookTimeMinutes = 45,
            servings = 4,
            difficulty = RecipeDifficulty.EASY,
            category = "DINNER",
            dietaryNotes = null,
            familyRating = 4,
            isFavorite = false,
            source = null,
            storageInstructions = null
        )

        coEvery { mockRepo.getRecipe("recipe-secret") } returns otherFamilyRecipe

        val resolver = RecipeDeepLinkResolver(mockRepo)
        val result = resolver.resolveRecipe(
            recipeId = "recipe-secret",
            activeFamilyId = "henderson-family-1"
        )

        assertTrue(result is RecipeResolutionResult.Unauthorized)
        val unauth = result as RecipeResolutionResult.Unauthorized
        assertEquals("recipe-secret", unauth.recipeId)
        assertEquals("henderson-family-1", unauth.activeFamilyId)
    }

    @Test
    fun testColdStartDeepLinkSimulation() {
        // Cold-start intent with deep-link URI
        val coldStartUri = "familyos://recipes/lasagna-sunday"
        val parsed = RecipeDeepLinkParser.parse(coldStartUri)

        assertTrue(parsed is DeepLinkResult.RecipeDetail)
        assertEquals("lasagna-sunday", (parsed as DeepLinkResult.RecipeDetail).recipeId)

        // Route selection simulates MainActivity onCreate initial destination logic:
        val initialDestination = if (parsed is DeepLinkResult.RecipeDetail) {
            FamilyOSDestination.HOUSEHOLD
        } else {
            FamilyOSDestination.OVERVIEW
        }
        assertEquals(FamilyOSDestination.HOUSEHOLD, initialDestination)
    }

    @Test
    fun testWarmStartDeepLinkSimulation() {
        // Warm-start intent incoming via onNewIntent
        val warmStartUri = "familyos://recipes/apple-pie"
        val warmParsed = RecipeDeepLinkParser.parse(warmStartUri)

        assertTrue(warmParsed is DeepLinkResult.RecipeDetail)
        assertEquals("apple-pie", (warmParsed as DeepLinkResult.RecipeDetail).recipeId)

        // When receiving invalid URI on warm start, state is preserved without disruption
        val invalidWarmUri = "familyos://invalid/test"
        val invalidParsed = RecipeDeepLinkParser.parse(invalidWarmUri)
        assertEquals(DeepLinkResult.Invalid, invalidParsed)
    }
}

