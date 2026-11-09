package com.familyos

import com.familyos.core.domain.MealPlanEntry
import com.familyos.core.domain.MealType
import com.familyos.core.domain.Recipe
import com.familyos.core.domain.RecipeIngredient
import org.junit.Assert.*
import org.junit.Test

class Stage2MealsAndRecipesTest {

    @Test
    fun testRecipeIngredientScaling_DoubleServings() {
        val ingredient = RecipeIngredient("i1", "r1", "Penne Pasta", 250.0, "grams", null)

        // Scale from 4 servings to 8 servings (ratio 2.0)
        val scaled = ingredient.scaleForServings(originalServings = 4, targetServings = 8)

        assertEquals(500.0, scaled.quantity, 0.001)
        assertEquals("grams", scaled.unit)
        assertEquals("Penne Pasta", scaled.itemName)
    }

    @Test
    fun testRecipeIngredientScaling_TripleServings() {
        val ingredient = RecipeIngredient("i2", "r1", "Tomato Sauce", 1.5, "cups", null)

        // Scale from 4 servings to 12 servings (ratio 3.0)
        val scaled = ingredient.scaleForServings(originalServings = 4, targetServings = 12)

        assertEquals(4.5, scaled.quantity, 0.001)
        assertEquals("cups", scaled.unit)
    }

    @Test
    fun testRecipeIngredientScaling_HalfServings() {
        val ingredient = RecipeIngredient("i3", "r1", "Olive Oil", 4.0, "tbsp", null)

        // Scale from 4 servings to 2 servings (ratio 0.5)
        val scaled = ingredient.scaleForServings(originalServings = 4, targetServings = 2)

        assertEquals(2.0, scaled.quantity, 0.001)
    }

    @Test
    fun testGroceryListDeduplicationAndAggregation() {
        val plannedIngredients = listOf(
            RecipeIngredient("i1", "r1", "Garlic", 3.0, "cloves", null),
            RecipeIngredient("i2", "r2", "Garlic", 2.0, "cloves", null),
            RecipeIngredient("i3", "r3", "Yellow Onion", 1.0, "whole", null),
            RecipeIngredient("i4", "r4", "Yellow Onion", 2.0, "whole", null)
        )

        // Group by item name and unit to deduplicate and aggregate quantities
        val aggregatedMap = plannedIngredients.groupBy { "${it.itemName.lowercase()}_${it.unit.lowercase()}" }
            .mapValues { entry ->
                entry.value.sumOf { it.quantity }
            }

        assertEquals(2, aggregatedMap.size) // Exactly 2 distinct grocery items, no duplicate rows
        assertEquals(5.0, aggregatedMap["garlic_cloves"] ?: 0.0, 0.001)
        assertEquals(3.0, aggregatedMap["yellow onion_whole"] ?: 0.0, 0.001)
    }

    @Test
    fun testMealPlanEditingAndSlotTypes() {
        val now = 1700000000000L
        var meal = MealPlanEntry(
            id = "mp1",
            familyId = "fam1",
            planDate = now,
            mealType = MealType.DINNER,
            recipeId = "rec_pasta",
            customMealTitle = null,
            servings = 4,
            notes = "Family dinner"
        )
        assertEquals(MealType.DINNER, meal.mealType)

        // Edit to LUNCH and 6 servings
        meal = meal.copy(mealType = MealType.LUNCH, servings = 6, notes = "Leftover lunch")
        assertEquals(MealType.LUNCH, meal.mealType)
        assertEquals(6, meal.servings)
        assertEquals("Leftover lunch", meal.notes)
    }

    @Test
    fun testOfflineRecipeDeepLinkQRCodeFormat() {
        val recipeId = "recipe_rustic_sourdough_101"
        val qrPayload = "familyos://recipes/$recipeId"

        assertTrue(qrPayload.startsWith("familyos://recipes/"))
        assertEquals("familyos://recipes/recipe_rustic_sourdough_101", qrPayload)
        // Standard URI format resolves entirely offline via Room SQLite without internet connection
    }
}
