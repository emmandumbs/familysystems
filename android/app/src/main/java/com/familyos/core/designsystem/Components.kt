package com.familyos.core.designsystem

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Clear
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/**
 * 1. FamilyOSPrimaryButton
 * High-emphasis brand action button with minimum 48dp touch target.
 */
@Composable
fun FamilyOSPrimaryButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    icon: ImageVector? = null
) {
    Button(
        onClick = onClick,
        enabled = enabled,
        shape = FamilyOSShapes.medium,
        colors = ButtonDefaults.buttonColors(
            containerColor = FamilyOSColors.PrimaryForestGreen,
            contentColor = Color.White,
            disabledContainerColor = FamilyOSColors.SecondarySage.copy(alpha = 0.4f),
            disabledContentColor = Color.White.copy(alpha = 0.7f)
        ),
        modifier = modifier
            .defaultMinSize(minHeight = FamilyOSSpacing.minTouchTarget)
    ) {
        if (icon != null) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                modifier = Modifier.size(18.dp)
            )
            Spacer(modifier = Modifier.width(FamilyOSSpacing.xs))
        }
        Text(
            text = text,
            style = MaterialTheme.typography.labelLarge
        )
    }
}

/**
 * 2. FamilyOSSecondaryButton
 * Balanced secondary action button.
 */
@Composable
fun FamilyOSSecondaryButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true
) {
    Button(
        onClick = onClick,
        enabled = enabled,
        shape = FamilyOSShapes.medium,
        colors = ButtonDefaults.buttonColors(
            containerColor = FamilyOSColors.SageLight,
            contentColor = FamilyOSColors.PrimaryForestGreen
        ),
        modifier = modifier.defaultMinSize(minHeight = FamilyOSSpacing.minTouchTarget)
    ) {
        Text(text = text, style = MaterialTheme.typography.labelLarge)
    }
}

/**
 * 3. FamilyOSOutlinedButton
 * Subtle framed action button.
 */
@Composable
fun FamilyOSOutlinedButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true
) {
    OutlinedButton(
        onClick = onClick,
        enabled = enabled,
        shape = FamilyOSShapes.medium,
        border = BorderStroke(1.dp, FamilyOSColors.BorderStrong),
        colors = ButtonDefaults.outlinedButtonColors(
            contentColor = FamilyOSColors.TextPrimary
        ),
        modifier = modifier.defaultMinSize(minHeight = FamilyOSSpacing.minTouchTarget)
    ) {
        Text(text = text, style = MaterialTheme.typography.labelLarge)
    }
}

/**
 * 4. FamilyOSCard
 * Core elevated content container with 20dp rounded corners and warm subtle border.
 */
@Composable
fun FamilyOSCard(
    modifier: Modifier = Modifier,
    onClick: (() -> Unit)? = null,
    backgroundColor: Color = FamilyOSColors.SurfaceCard,
    content: @Composable ColumnScope.() -> Unit
) {
    Surface(
        modifier = modifier
            .fillMaxWidth()
            .then(if (onClick != null) Modifier.clickable { onClick() } else Modifier),
        shape = FamilyOSShapes.large,
        color = backgroundColor,
        border = BorderStroke(1.dp, FamilyOSColors.BorderSubtle),
        shadowElevation = 1.dp
    ) {
        Column(
            modifier = Modifier.padding(FamilyOSSpacing.md),
            content = content
        )
    }
}

/**
 * 5. FamilyOSSectionHeader
 * Editorial headline pairing with optional action.
 */
@Composable
fun FamilyOSSectionHeader(
    title: String,
    subtitle: String? = null,
    actionText: String? = null,
    onActionClick: (() -> Unit)? = null,
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .padding(vertical = FamilyOSSpacing.xs),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = title,
                style = MaterialTheme.typography.headlineMedium
            )
            if (subtitle != null) {
                Text(
                    text = subtitle,
                    style = MaterialTheme.typography.bodySmall,
                    color = FamilyOSColors.TextSecondary
                )
            }
        }
        if (actionText != null && onActionClick != null) {
            TextButton(onClick = onActionClick) {
                Text(
                    text = actionText,
                    style = MaterialTheme.typography.labelLarge,
                    color = FamilyOSColors.SecondarySage
                )
            }
        }
    }
}

/**
 * 6. FamilyOSTextField
 * High-legibility form input with accessible focus and error states.
 */
@Composable
fun FamilyOSTextField(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    modifier: Modifier = Modifier,
    placeholder: String? = null,
    isError: Boolean = false,
    errorMessage: String? = null,
    singleLine: Boolean = true
) {
    Column(modifier = modifier) {
        OutlinedTextField(
            value = value,
            onValueChange = onValueChange,
            label = { Text(label) },
            placeholder = placeholder?.let { { Text(it) } },
            isError = isError,
            singleLine = singleLine,
            shape = FamilyOSShapes.medium,
            colors = OutlinedTextFieldDefaults.colors(
                focusedBorderColor = FamilyOSColors.PrimaryForestGreen,
                unfocusedBorderColor = FamilyOSColors.BorderStrong,
                focusedLabelColor = FamilyOSColors.PrimaryForestGreen,
                errorBorderColor = FamilyOSColors.Alert
            ),
            modifier = Modifier.fillMaxWidth()
        )
        if (isError && errorMessage != null) {
            Text(
                text = errorMessage,
                style = MaterialTheme.typography.bodySmall,
                color = FamilyOSColors.Alert,
                modifier = Modifier.padding(start = FamilyOSSpacing.sm, top = FamilyOSSpacing.xxs)
            )
        }
    }
}

/**
 * 7. FamilyOSSearchField
 * Clean search input with quick clear and icon.
 */
@Composable
fun FamilyOSSearchField(
    query: String,
    onQueryChange: (String) -> Unit,
    placeholder: String = "Search family records...",
    modifier: Modifier = Modifier
) {
    OutlinedTextField(
        value = query,
        onValueChange = onQueryChange,
        placeholder = { Text(placeholder, style = MaterialTheme.typography.bodyMedium) },
        leadingIcon = {
            Icon(Icons.Default.Search, contentDescription = "Search", tint = FamilyOSColors.TextSecondary)
        },
        trailingIcon = {
            if (query.isNotEmpty()) {
                IconButton(onClick = { onQueryChange("") }) {
                    Icon(Icons.Default.Clear, contentDescription = "Clear", tint = FamilyOSColors.TextSecondary)
                }
            }
        },
        singleLine = true,
        shape = FamilyOSShapes.medium,
        colors = OutlinedTextFieldDefaults.colors(
            unfocusedBorderColor = FamilyOSColors.BorderSubtle,
            focusedBorderColor = FamilyOSColors.PrimaryForestGreen
        ),
        modifier = modifier.fillMaxWidth()
    )
}

/**
 * 8. FamilyOSAvatar
 * Monogram or profile photo representation.
 */
@Composable
fun FamilyOSAvatar(
    name: String,
    modifier: Modifier = Modifier,
    size: Dp = 40.dp,
    backgroundColor: Color = FamilyOSColors.SageLight,
    textColor: Color = FamilyOSColors.PrimaryForestGreen
) {
    val initials = name.split(" ")
        .mapNotNull { it.firstOrNull()?.toString() }
        .take(2)
        .joinToString("")
        .ifEmpty { "F" }

    Box(
        modifier = modifier
            .size(size)
            .clip(CircleShape)
            .background(backgroundColor),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = initials,
            fontWeight = FontWeight.Bold,
            fontSize = (size.value * 0.4).sp,
            color = textColor
        )
    }
}

/**
 * 9. FamilyOSProfileHeader
 * Household or member banner presentation.
 */
@Composable
fun FamilyOSProfileHeader(
    title: String,
    subtitle: String,
    roleBadge: String? = null,
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically
    ) {
        FamilyOSAvatar(name = title, size = 56.dp)
        Spacer(modifier = Modifier.width(FamilyOSSpacing.md))
        Column(modifier = Modifier.weight(1f)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = title,
                    style = MaterialTheme.typography.titleLarge
                )
                if (roleBadge != null) {
                    Spacer(modifier = Modifier.width(FamilyOSSpacing.xs))
                    FamilyOSStatusBadge(text = roleBadge, color = FamilyOSColors.SoftGold)
                }
            }
            Text(
                text = subtitle,
                style = MaterialTheme.typography.bodySmall,
                color = FamilyOSColors.TextSecondary
            )
        }
    }
}

/**
 * 10. FamilyOSEmptyState
 * Informative, calm explanation when a collection has no records yet.
 */
@Composable
fun FamilyOSEmptyState(
    title: String,
    description: String,
    actionText: String? = null,
    onActionClick: (() -> Unit)? = null,
    icon: ImageVector? = null,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .padding(FamilyOSSpacing.xl),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        if (icon != null) {
            Box(
                modifier = Modifier
                    .size(56.dp)
                    .clip(CircleShape)
                    .background(FamilyOSColors.SageLight),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = icon,
                    contentDescription = null,
                    tint = FamilyOSColors.PrimaryForestGreen,
                    modifier = Modifier.size(28.dp)
                )
            }
            Spacer(modifier = Modifier.height(FamilyOSSpacing.md))
        }
        Text(
            text = title,
            style = MaterialTheme.typography.titleLarge,
            textAlign = TextAlign.Center
        )
        Spacer(modifier = Modifier.height(FamilyOSSpacing.xs))
        Text(
            text = description,
            style = MaterialTheme.typography.bodyMedium,
            color = FamilyOSColors.TextSecondary,
            textAlign = TextAlign.Center
        )
        if (actionText != null && onActionClick != null) {
            Spacer(modifier = Modifier.height(FamilyOSSpacing.md))
            FamilyOSSecondaryButton(text = actionText, onClick = onActionClick)
        }
    }
}

/**
 * 11. FamilyOSLoadingState
 */
@Composable
fun FamilyOSLoadingState(
    message: String = "Loading family data...",
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .padding(FamilyOSSpacing.xl),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        CircularProgressIndicator(
            color = FamilyOSColors.PrimaryForestGreen,
            strokeWidth = 3.dp
        )
        Spacer(modifier = Modifier.height(FamilyOSSpacing.md))
        Text(
            text = message,
            style = MaterialTheme.typography.bodyMedium,
            color = FamilyOSColors.TextSecondary
        )
    }
}

/**
 * 12. FamilyOSErrorState
 */
@Composable
fun FamilyOSErrorState(
    title: String = "Something went wrong",
    errorMessage: String,
    retryText: String = "Try again",
    onRetry: () -> Unit,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .padding(FamilyOSSpacing.xl),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text(
            text = title,
            style = MaterialTheme.typography.titleLarge,
            color = FamilyOSColors.Alert
        )
        Spacer(modifier = Modifier.height(FamilyOSSpacing.xs))
        Text(
            text = errorMessage,
            style = MaterialTheme.typography.bodyMedium,
            color = FamilyOSColors.TextSecondary,
            textAlign = TextAlign.Center
        )
        Spacer(modifier = Modifier.height(FamilyOSSpacing.md))
        FamilyOSPrimaryButton(text = retryText, onClick = onRetry)
    }
}

/**
 * 13. FamilyOSConfirmationDialog
 */
@Composable
fun FamilyOSConfirmationDialog(
    title: String,
    message: String,
    confirmText: String = "Confirm",
    dismissText: String = "Cancel",
    onConfirm: () -> Unit,
    onDismiss: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        shape = FamilyOSShapes.large,
        containerColor = FamilyOSColors.SurfaceCard,
        title = {
            Text(text = title, style = MaterialTheme.typography.headlineMedium)
        },
        text = {
            Text(text = message, style = MaterialTheme.typography.bodyMedium)
        },
        confirmButton = {
            FamilyOSPrimaryButton(text = confirmText, onClick = onConfirm)
        },
        dismissButton = {
            FamilyOSOutlinedButton(text = dismissText, onClick = onDismiss)
        }
    )
}

/**
 * 14. FamilyOSBottomSheet
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FamilyOSBottomSheet(
    onDismissRequest: () -> Unit,
    sheetState: SheetState = rememberModalBottomSheetState(),
    content: @Composable ColumnScope.() -> Unit
) {
    ModalBottomSheet(
        onDismissRequest = onDismissRequest,
        sheetState = sheetState,
        shape = RoundedCornerShape(topStart = 24.dp, topEnd = 24.dp),
        containerColor = FamilyOSColors.SurfaceCard,
        content = content
    )
}

/**
 * 15. FamilyOSProgressIndicator
 */
@Composable
fun FamilyOSProgressIndicator(
    progress: Float,
    modifier: Modifier = Modifier,
    color: Color = FamilyOSColors.SecondarySage,
    trackColor: Color = FamilyOSColors.SageLight
) {
    LinearProgressIndicator(
        progress = { progress.coerceIn(0f, 1f) },
        color = color,
        trackColor = trackColor,
        modifier = modifier
            .fillMaxWidth()
            .height(8.dp)
            .clip(RoundedCornerShape(4.dp))
    )
}

/**
 * 16. FamilyOSStatusBadge
 */
@Composable
fun FamilyOSStatusBadge(
    text: String,
    modifier: Modifier = Modifier,
    color: Color = FamilyOSColors.SageGreen
) {
    Surface(
        shape = RoundedCornerShape(6.dp),
        color = color.copy(alpha = 0.15f),
        border = BorderStroke(1.dp, color.copy(alpha = 0.35f)),
        modifier = modifier
    ) {
        Text(
            text = text,
            style = MaterialTheme.typography.labelSmall,
            fontWeight = FontWeight.SemiBold,
            color = FamilyOSColors.TextPrimary,
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp)
        )
    }
}
