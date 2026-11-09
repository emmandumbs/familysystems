package com.familyos.core.designsystem

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Shapes
import androidx.compose.ui.unit.dp

/**
 * FamilyOS Spacing Tokens based on an 8dp grid hierarchy.
 */
object FamilyOSSpacing {
    val xxs = 4.dp
    val xs = 8.dp
    val sm = 12.dp
    val md = 16.dp
    val lg = 20.dp
    val xl = 24.dp
    val xxl = 32.dp
    val xxxl = 48.dp
    
    // Interactive Touch Targets (Minimum 48dp for accessibility)
    val minTouchTarget = 48.dp
}

/**
 * Shape tokens:
 * Cards use 20dp squircle curvature.
 * Buttons use 12dp rounded rectangles (zero pill shapes).
 */
val FamilyOSShapes = Shapes(
    small = RoundedCornerShape(8.dp),
    medium = RoundedCornerShape(12.dp),
    large = RoundedCornerShape(20.dp),
    extraLarge = RoundedCornerShape(28.dp)
)
