package com.familyos.core.navigation

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Sync
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.familyos.core.designsystem.*
import kotlinx.coroutines.launch

/**
 * Adaptive Application Shell for FamilyOS
 * Supports Phones (<600dp), Tablets (600-839dp), and Expanded Displays (>=840dp).
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FamilyOSAppShell(
    currentDestination: FamilyOSDestination,
    onNavigate: (FamilyOSDestination) -> Unit,
    activeFamilyName: String = "The Henderson Household",
    syncStatusLabel: String = "All records synced",
    onOpenSearch: () -> Unit = {},
    onLockSession: (() -> Unit)? = null,
    content: @Composable () -> Unit
) {
    val configuration = LocalConfiguration.current
    val screenWidth = configuration.screenWidthDp.dp
    val isTablet = screenWidth in 600.dp..839.dp
    val isExpanded = screenWidth >= 840.dp
    val drawerState = rememberDrawerState(initialValue = DrawerValue.Closed)
    val coroutineScope = rememberCoroutineScope()

    ModalNavigationDrawer(
        drawerState = drawerState,
        gesturesEnabled = !isExpanded,
        drawerContent = {
            ModalDrawerSheet(
                drawerContainerColor = FamilyOSColors.WarmIvoryLight,
                modifier = Modifier.width(300.dp)
            ) {
                DrawerNavigationContent(
                    selectedDestination = currentDestination,
                    onDestinationClick = {
                        onNavigate(it)
                        coroutineScope.launch { drawerState.close() }
                    }
                )
            }
        }
    ) {
        Scaffold(
            topBar = {
                CenterAlignedTopAppBar(
                    title = {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text(
                                text = activeFamilyName,
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Bold
                            )
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(
                                    imageVector = Icons.Default.Sync,
                                    contentDescription = null,
                                    tint = FamilyOSColors.SecondarySage,
                                    modifier = Modifier.size(12.dp)
                                )
                                Spacer(modifier = Modifier.width(4.dp))
                                Text(
                                    text = syncStatusLabel,
                                    style = MaterialTheme.typography.bodySmall,
                                    color = FamilyOSColors.SecondarySage
                                )
                            }
                        }
                    },
                    navigationIcon = {
                        IconButton(
                            onClick = { coroutineScope.launch { drawerState.open() } },
                            modifier = Modifier.size(48.dp)
                        ) {
                            Icon(Icons.Default.Menu, contentDescription = "Open navigation menu")
                        }
                    },
                    actions = {
                        IconButton(
                            onClick = onOpenSearch,
                            modifier = Modifier.size(48.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Default.Search,
                                contentDescription = "Global Full-Text Search (FTS4)",
                                tint = FamilyOSColors.PrimaryForestGreen
                            )
                        }
                        if (onLockSession != null) {
                            IconButton(
                                onClick = onLockSession,
                                modifier = Modifier.size(48.dp)
                            ) {
                                Icon(
                                    imageVector = Icons.Default.Lock,
                                    contentDescription = "Lock session with biometrics",
                                    tint = FamilyOSColors.PrimaryForestGreen
                                )
                            }
                        }
                    },
                    colors = TopAppBarDefaults.centerAlignedTopAppBarColors(
                        containerColor = FamilyOSColors.WarmIvory,
                        titleContentColor = FamilyOSColors.TextPrimary
                    )
                )
            },
            bottomBar = {
                if (!isTablet && !isExpanded) {
                    NavigationBar(
                        containerColor = FamilyOSColors.SurfaceCard,
                        contentColor = FamilyOSColors.PrimaryForestGreen
                    ) {
                        FamilyOSDestination.entries.filter { it.isCoreTab }.forEach { destination ->
                            NavigationBarItem(
                                selected = currentDestination == destination,
                                onClick = { onNavigate(destination) },
                                icon = { Icon(destination.icon, contentDescription = destination.title) },
                                label = { Text(destination.title) },
                                colors = NavigationBarItemDefaults.colors(
                                    selectedIconColor = FamilyOSColors.PrimaryForestGreen,
                                    indicatorColor = FamilyOSColors.SageLight
                                )
                            )
                        }
                    }
                }
            },
            containerColor = FamilyOSColors.WarmIvory
        ) { innerPadding ->
            Row(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(innerPadding)
            ) {
                // Tablet NavigationRail
                if (isTablet) {
                    NavigationRail(
                        containerColor = FamilyOSColors.SurfaceCard,
                        modifier = Modifier.width(80.dp)
                    ) {
                        Spacer(modifier = Modifier.height(FamilyOSSpacing.sm))
                        FamilyOSDestination.entries.filter { it.isCoreTab }.forEach { destination ->
                            NavigationRailItem(
                                selected = currentDestination == destination,
                                onClick = { onNavigate(destination) },
                                icon = { Icon(destination.icon, contentDescription = destination.title) },
                                label = { Text(destination.title, style = MaterialTheme.typography.labelSmall) }
                            )
                        }
                    }
                }

                // Desktop / Large Screen Permanent Left Navigation
                if (isExpanded) {
                    Surface(
                        modifier = Modifier
                            .width(260.dp)
                            .fillMaxHeight(),
                        color = FamilyOSColors.SurfaceCard,
                        border = androidx.compose.foundation.BorderStroke(1.dp, FamilyOSColors.BorderSubtle)
                    ) {
                        DrawerNavigationContent(
                            selectedDestination = currentDestination,
                            onDestinationClick = onNavigate
                        )
                    }
                }

                // Main Content Viewport
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .fillMaxHeight()
                ) {
                    content()
                }
            }
        }
    }
}

@Composable
private fun DrawerNavigationContent(
    selectedDestination: FamilyOSDestination,
    onDestinationClick: (FamilyOSDestination) -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(FamilyOSSpacing.md)
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.padding(bottom = FamilyOSSpacing.lg, top = FamilyOSSpacing.xs)
        ) {
            FamilyOSAvatar(name = "FamilyOS", size = 36.dp)
            Spacer(modifier = Modifier.width(FamilyOSSpacing.sm))
            Column {
                Text(
                    text = "FamilyOS",
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = "Family Management",
                    style = MaterialTheme.typography.bodySmall,
                    color = FamilyOSColors.TextSecondary
                )
            }
        }

        Divider(color = FamilyOSColors.BorderSubtle)
        Spacer(modifier = Modifier.height(FamilyOSSpacing.sm))

        Text(
            text = "CORE MODULES",
            style = MaterialTheme.typography.labelSmall,
            color = FamilyOSColors.SecondarySage,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.padding(vertical = FamilyOSSpacing.xs)
        )

        FamilyOSDestination.entries.take(5).forEach { dest ->
            DrawerItem(dest, selectedDestination == dest) { onDestinationClick(dest) }
        }

        Spacer(modifier = Modifier.height(FamilyOSSpacing.sm))
        Text(
            text = "WELLBEING & FAMILY LIFE",
            style = MaterialTheme.typography.labelSmall,
            color = FamilyOSColors.SecondarySage,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.padding(vertical = FamilyOSSpacing.xs)
        )

        FamilyOSDestination.entries.drop(5).take(7).forEach { dest ->
            DrawerItem(dest, selectedDestination == dest) { onDestinationClick(dest) }
        }

        Spacer(modifier = Modifier.height(FamilyOSSpacing.sm))
        Text(
            text = "SYSTEM & TOOLS",
            style = MaterialTheme.typography.labelSmall,
            color = FamilyOSColors.SecondarySage,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.padding(vertical = FamilyOSSpacing.xs)
        )

        FamilyOSDestination.entries.drop(12).forEach { dest ->
            DrawerItem(dest, selectedDestination == dest) { onDestinationClick(dest) }
        }
    }
}

@Composable
private fun DrawerItem(
    destination: FamilyOSDestination,
    isSelected: Boolean,
    onClick: () -> Unit
) {
    val bgColor = if (isSelected) FamilyOSColors.SageLight else Color.Transparent
    val contentColor = if (isSelected) FamilyOSColors.PrimaryForestGreen else FamilyOSColors.TextPrimary

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onClick() }
            .background(bgColor, shape = FamilyOSShapes.medium)
            .padding(horizontal = FamilyOSSpacing.md, vertical = FamilyOSSpacing.sm),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(
            imageVector = destination.icon,
            contentDescription = null,
            tint = contentColor,
            modifier = Modifier.size(20.dp)
        )
        Spacer(modifier = Modifier.width(FamilyOSSpacing.md))
        Text(
            text = destination.title,
            style = MaterialTheme.typography.bodyMedium,
            fontWeight = if (isSelected) FontWeight.SemiBold else FontWeight.Normal,
            color = contentColor
        )
    }
}
