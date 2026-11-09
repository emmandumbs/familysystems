package com.familyos.core.designsystem

import androidx.compose.ui.graphics.Color

/**
 * FamilyOS Brand Color Palette
 * Designed for warmth, trust, calm stewardship and high-contrast readability.
 */
object FamilyOSColors {
    // Brand Core
    val PrimaryForestGreen = Color(0xFF173D35)
    val PrimaryDark = Color(0xFF0F2923)
    val WarmIvory = Color(0xFFF7F4EC)
    val WarmIvoryLight = Color(0xFFFAF8F3)

    // Botanical Accents
    val SageGreen = Color(0xFFA8BDAA)
    val SecondarySage = Color(0xFF6B8A6E)
    val SageLight = Color(0xFFE4EDE5)

    // Heritage Accents
    val SoftGold = Color(0xFFC39A60)
    val LightGold = Color(0xFFE7D1AA)
    val GoldContainer = Color(0xFFFBF4E8)

    // Surface & Cards
    val SurfaceCard = Color(0xFFFFFFFF)
    val SurfaceCardMuted = Color(0xFFF3EFE6)
    val BorderSubtle = Color(0xFFE4DECFA)
    val BorderStrong = Color(0xFFC9BFAD)

    // Typography
    val TextPrimary = Color(0xFF11231E)
    val TextSecondary = Color(0xFF4F635D)
    val TextTertiary = Color(0xFF7E918B)
    val TextOnPrimary = Color(0xFFFFFFFF)

    // Semantic States
    val Success = Color(0xFF2D6A4F)
    val SuccessContainer = Color(0xFFD8F3DC)
    val Alert = Color(0xFFBC4749)
    val AlertContainer = Color(0xFFFFE5D9)
    val Warning = Color(0xFFD4A373)
}

// Convenience Extensions for backward compatibility across modules
val FamilyOSColors.ForestGreenDark: Color get() = PrimaryForestGreen
val FamilyOSColors.ForestGreenMedium: Color get() = SecondarySage
val FamilyOSColors.SageMedium: Color get() = SageGreen
val FamilyOSColors.SoftGoldDark: Color get() = SoftGold
val FamilyOSColors.MutedCharcoal: Color get() = TextSecondary
val FamilyOSColors.WarmIvoryDark: Color get() = SurfaceCardMuted

