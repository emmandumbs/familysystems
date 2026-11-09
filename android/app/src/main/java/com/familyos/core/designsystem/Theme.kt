package com.familyos.core.designsystem

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val LightColorScheme = lightColorScheme(
    primary = FamilyOSColors.PrimaryForestGreen,
    onPrimary = FamilyOSColors.TextOnPrimary,
    primaryContainer = FamilyOSColors.SageLight,
    onPrimaryContainer = FamilyOSColors.PrimaryDark,

    secondary = FamilyOSColors.SecondarySage,
    onSecondary = Color.White,
    secondaryContainer = FamilyOSColors.SageLight,
    onSecondaryContainer = FamilyOSColors.PrimaryDark,

    tertiary = FamilyOSColors.SoftGold,
    onTertiary = FamilyOSColors.PrimaryDark,
    tertiaryContainer = FamilyOSColors.GoldContainer,
    onTertiaryContainer = Color(0xFF4A3414),

    background = FamilyOSColors.WarmIvory,
    onBackground = FamilyOSColors.TextPrimary,

    surface = FamilyOSColors.SurfaceCard,
    onSurface = FamilyOSColors.TextPrimary,
    surfaceVariant = FamilyOSColors.SurfaceCardMuted,
    onSurfaceVariant = FamilyOSColors.TextSecondary,

    outline = FamilyOSColors.BorderSubtle,
    outlineVariant = FamilyOSColors.BorderStrong,

    error = FamilyOSColors.Alert,
    onError = Color.White,
    errorContainer = FamilyOSColors.AlertContainer,
    onErrorContainer = Color(0xFF5A1416)
)

private val DarkColorScheme = darkColorScheme(
    primary = FamilyOSColors.SageGreen,
    onPrimary = FamilyOSColors.PrimaryDark,
    primaryContainer = FamilyOSColors.PrimaryDark,
    onPrimaryContainer = FamilyOSColors.SageLight,

    secondary = FamilyOSColors.SecondarySage,
    onSecondary = Color.White,

    tertiary = FamilyOSColors.LightGold,
    onTertiary = FamilyOSColors.PrimaryDark,

    background = Color(0xFF0F1A17),
    onBackground = Color(0xFFE5EDE8),

    surface = Color(0xFF142420),
    onSurface = Color(0xFFE5EDE8),
    surfaceVariant = Color(0xFF1B2E2A),
    onSurfaceVariant = Color(0xFFA5B8B0),

    outline = Color(0xFF2E453F),
    outlineVariant = Color(0xFF3F5D56)
)

@Composable
fun FamilyOSTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit
) {
    val colorScheme = if (darkTheme) DarkColorScheme else LightColorScheme

    MaterialTheme(
        colorScheme = colorScheme,
        typography = FamilyOSTypography,
        shapes = FamilyOSShapes,
        content = content
    )
}
