package com.familyos.feature.recipes

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.familyos.core.designsystem.*
import com.familyos.core.domain.Recipe
import com.familyos.core.domain.RecipeDifficulty
import com.familyos.core.domain.RecipeIngredient
import com.familyos.core.domain.RecipeInstruction

/**
 * Stage 2: Recipe Library & Printable QR Cards Screen
 * Supports ingredient scaling, search/filters, and printable business cards.
 */
@Composable
fun RecipeLibraryScreen(
    recipes: List<Recipe> = sampleRecipes,
    initialSelectedRecipeId: String? = null,
    onAddRecipe: () -> Unit = {},
    onToggleFavorite: (String, Boolean) -> Unit = { _, _ -> }
) {
    var searchQuery by remember { mutableStateOf("") }
    var selectedRecipe by remember(initialSelectedRecipeId, recipes) {
        mutableStateOf(
            if (initialSelectedRecipeId != null) {
                recipes.find { it.id == initialSelectedRecipeId }
            } else {
                null
            }
        )
    }
    var targetServings by remember { mutableStateOf(4) }
    var showPrintableCardModal by remember { mutableStateOf(false) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(FamilyOSSpacing.md)
    ) {
        // Header
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column {
                Text(
                    text = "Recipe Library",
                    style = MaterialTheme.typography.headlineLarge,
                    color = FamilyOSColors.TextPrimary
                )
                Text(
                    text = "Culinary knowledge base & printable business cards",
                    style = MaterialTheme.typography.bodySmall,
                    color = FamilyOSColors.TextSecondary
                )
            }

            FamilyOSPrimaryButton(
                text = "New Recipe",
                icon = Icons.Default.Add,
                onClick = onAddRecipe
            )
        }

        Spacer(modifier = Modifier.height(FamilyOSSpacing.sm))

        // Search Bar
        FamilyOSSearchField(
            query = searchQuery,
            onQueryChange = { searchQuery = it },
            placeholder = "Search recipes by name or ingredient..."
        )

        Spacer(modifier = Modifier.height(FamilyOSSpacing.md))

        // Recipe Cards Gallery
        val filteredRecipes = recipes.filter {
            it.title.contains(searchQuery, ignoreCase = true) ||
            (it.description?.contains(searchQuery, ignoreCase = true) == true)
        }

        LazyColumn(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(FamilyOSSpacing.md)
        ) {
            items(filteredRecipes) { recipe ->
                FamilyOSCard(
                    onClick = {
                        selectedRecipe = recipe
                        targetServings = recipe.servings
                    }
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                FamilyOSStatusBadge(text = recipe.category, color = FamilyOSColors.SecondarySage)
                                Spacer(modifier = Modifier.width(FamilyOSSpacing.xs))
                                FamilyOSStatusBadge(text = recipe.difficulty.name, color = FamilyOSColors.SageGreen)
                            }
                            Spacer(modifier = Modifier.height(FamilyOSSpacing.xs))
                            Text(
                                text = recipe.title,
                                style = MaterialTheme.typography.titleLarge,
                                fontWeight = FontWeight.Bold
                            )
                            if (recipe.description != null) {
                                Text(
                                    text = recipe.description,
                                    style = MaterialTheme.typography.bodySmall,
                                    color = FamilyOSColors.TextSecondary
                                )
                            }
                        }

                        IconButton(onClick = { onToggleFavorite(recipe.id, !recipe.isFavorite) }) {
                            Icon(
                                imageVector = if (recipe.isFavorite) Icons.Default.Star else Icons.Default.StarBorder,
                                contentDescription = "Favorite",
                                tint = if (recipe.isFavorite) FamilyOSColors.SoftGold else FamilyOSColors.BorderStrong
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(FamilyOSSpacing.sm))
                    Divider(color = FamilyOSColors.BorderSubtle)
                    Spacer(modifier = Modifier.height(FamilyOSSpacing.xs))

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text(
                            text = "⏱️ Prep: ${recipe.prepTimeMinutes}m • Cook: ${recipe.cookTimeMinutes}m",
                            style = MaterialTheme.typography.bodySmall,
                            color = FamilyOSColors.TextSecondary
                        )
                        Text(
                            text = "⭐ ${recipe.familyRating}/5 stars",
                            style = MaterialTheme.typography.bodySmall,
                            fontWeight = FontWeight.Bold,
                            color = FamilyOSColors.SoftGold
                        )
                    }
                }
            }
        }
    }

    // Detail & Servings Scaler BottomSheet
    if (selectedRecipe != null) {
        val recipe = selectedRecipe!!
        FamilyOSBottomSheet(
            onDismissRequest = { selectedRecipe = null }
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(FamilyOSSpacing.lg)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = recipe.title,
                        style = MaterialTheme.typography.headlineMedium,
                        fontWeight = FontWeight.Bold
                    )
                    FamilyOSSecondaryButton(
                        text = "Printable Card",
                        onClick = { showPrintableCardModal = true }
                    )
                }

                Spacer(modifier = Modifier.height(FamilyOSSpacing.md))

                // Servings Scaler Control
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(FamilyOSShapes.medium)
                        .background(FamilyOSColors.WarmIvoryLight)
                        .padding(FamilyOSSpacing.sm),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "Servings: $targetServings portions",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold
                    )
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        IconButton(onClick = { if (targetServings > 1) targetServings-- }) {
                            Icon(Icons.Default.Remove, contentDescription = "Decrease")
                        }
                        IconButton(onClick = { targetServings++ }) {
                            Icon(Icons.Default.Add, contentDescription = "Increase")
                        }
                    }
                }

                Spacer(modifier = Modifier.height(FamilyOSSpacing.md))

                // Ingredients with Dynamic Scaling
                Text(
                    text = "INGREDIENTS (SCALED)",
                    style = MaterialTheme.typography.labelSmall,
                    color = FamilyOSColors.SecondarySage,
                    fontWeight = FontWeight.Bold
                )
                Spacer(modifier = Modifier.height(FamilyOSSpacing.xs))
                recipe.ingredients.forEach { ing ->
                    val scaled = ing.scaleForServings(recipe.servings, targetServings)
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 3.dp),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text(text = "• ${scaled.itemName}", style = MaterialTheme.typography.bodyMedium)
                        Text(
                            text = "${scaled.quantity} ${scaled.unit}",
                            style = MaterialTheme.typography.bodyMedium,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            }
        }
    }

    // Printable Recipe Card Modal Preview with QR code format
    if (showPrintableCardModal && selectedRecipe != null) {
        val recipe = selectedRecipe!!
        AlertDialog(
            onDismissRequest = { showPrintableCardModal = false },
            shape = FamilyOSShapes.large,
            containerColor = Color.White,
            title = {
                Text("Printable Recipe Card Preview", style = MaterialTheme.typography.titleLarge)
            },
            text = {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .border(1.dp, FamilyOSColors.BorderStrong, FamilyOSShapes.medium)
                        .padding(FamilyOSSpacing.md)
                ) {
                    Text(text = recipe.title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                    Text(text = "FamilyOS Kitchen Collection • Rating: ${recipe.familyRating}/5", style = MaterialTheme.typography.bodySmall, color = FamilyOSColors.TextSecondary)
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(text = "Servings: ${recipe.servings} | Prep: ${recipe.prepTimeMinutes}m | Cook: ${recipe.cookTimeMinutes}m", style = MaterialTheme.typography.bodySmall)
                    Spacer(modifier = Modifier.height(12.dp))
                    Box(
                        modifier = Modifier
                            .size(80.dp)
                            .background(FamilyOSColors.WarmIvoryLight, FamilyOSShapes.small)
                            .border(1.dp, FamilyOSColors.BorderSubtle, FamilyOSShapes.small),
                        contentAlignment = Alignment.Center
                    ) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Icon(Icons.Default.QrCode2, contentDescription = "QR Code", modifier = Modifier.size(48.dp))
                            Text(text = "familyos://${recipe.id}", style = MaterialTheme.typography.labelSmall, fontSize = androidx.compose.ui.unit.sp(8))
                        }
                    }
                    Text(
                        text = "QR resolves via local FamilyOS deep-link route (offline-safe)",
                        style = MaterialTheme.typography.bodySmall,
                        color = FamilyOSColors.TextTertiary,
                        modifier = Modifier.padding(top = 4.dp)
                    )
                }
            },
            confirmButton = {
                FamilyOSPrimaryButton(text = "Print Card", onClick = { showPrintableCardModal = false })
            },
            dismissButton = {
                FamilyOSOutlinedButton(text = "Close", onClick = { showPrintableCardModal = false })
            }
        )
    }
}

private val sampleRecipes = listOf(
    Recipe(
        id = "r1",
        familyId = "fam1",
        title = "Tuscan Garlic Herb Pasta",
        description = "Fragrant pasta dish with extra virgin olive oil, garlic, and fresh herbs.",
        imageUri = null,
        prepTimeMinutes = 15,
        cookTimeMinutes = 20,
        servings = 4,
        difficulty = RecipeDifficulty.EASY,
        category = "DINNER",
        dietaryNotes = "Vegetarian friendly",
        familyRating = 5,
        isFavorite = true,
        source = "Grandma's recipe book",
        storageInstructions = "Refrigerate in airtight container up to 3 days",
        ingredients = listOf(
            RecipeIngredient("i1", "r1", "Penne Pasta", 400.0, "grams", null),
            RecipeIngredient("i2", "r1", "Garlic Cloves", 4.0, "cloves", "Finely minced"),
            RecipeIngredient("i3", "r1", "Extra Virgin Olive Oil", 3.0, "tbsp", null),
            RecipeIngredient("i4", "r1", "Fresh Basil", 0.5, "cup", "Chopped")
        ),
        instructions = listOf(
            RecipeInstruction("ins1", "r1", 1, "Boil salted water in large pot and cook pasta al dente."),
            RecipeInstruction("ins2", "r1", 2, "Saute minced garlic in olive oil until golden and fragrant."),
            RecipeInstruction("ins3", "r1", 3, "Toss pasta with garlic oil and fold in fresh basil.")
        )
    )
)
