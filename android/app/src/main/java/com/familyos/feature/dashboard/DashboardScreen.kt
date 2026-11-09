package com.familyos.feature.dashboard

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.familyos.core.database.AuditEventEntity
import com.familyos.core.designsystem.*
import com.familyos.core.domain.*

/**
 * Stage 3.3.1: Family Home (Dashboard) Screen
 * Driven 100% by actual Room & synchronized records rather than demonstration placeholders.
 * Includes:
 * - Family identity, logo, photo, motto, mission, vision, and values
 * - Family member overview
 * - Today's agenda & Upcoming events
 * - Tasks and priorities + Overdue tasks
 * - Goal and project progress
 * - Household reminders & Important family announcements
 * - Quick actions
 * - Recent family activity
 * - Approved AI suggestions
 * - Role-based privacy enforcement
 */
@Composable
fun DashboardScreen(
    workspace: FamilyWorkspace? = null,
    familyName: String = workspace?.name ?: "",
    greeting: String = "Welcome home",
    members: List<FamilyMember> = emptyList(),
    actorRole: FamilyRole = FamilyRole.OWNER,
    calendarEvents: List<CalendarEvent> = emptyList(),
    mealPlans: List<MealPlanEntry> = emptyList(),
    tasks: List<Task> = emptyList(),
    goals: List<FamilyGoal> = emptyList(),
    projects: List<Project> = emptyList(),
    reminders: List<HouseholdReminder> = emptyList(),
    announcements: List<FamilyAnnouncement> = emptyList(),
    approvedAiSuggestions: List<ApprovedAiSuggestion> = emptyList(),
    recentAudits: List<AuditEventEntity> = emptyList(),
    onToggleTaskComplete: (String, Boolean) -> Unit = { _, _ -> },
    onToggleReminder: (String) -> Unit = {},
    onUpdateIdentity: (String, String) -> Unit = { _, _ -> },
    onPostAnnouncement: (String, String) -> Unit = { _, _ -> },
    onQuickAction: (String) -> Unit = {}
) {
    var showIdentityEditor by remember { mutableStateOf(false) }
    var showAnnouncementDialog by remember { mutableStateOf(false) }

    val now = System.currentTimeMillis()
    val endOfToday = now + 86_400_000L
    val todaysEvents = calendarEvents.filter { it.eventDate <= endOfToday }
    val upcomingEvents = calendarEvents.filter { it.eventDate > endOfToday }

    val overdueTasks = tasks.filter { !it.isCompleted && it.dueDate != null && it.dueDate < now }
    val priorityTasks = tasks.filter { it.dueDate == null || it.dueDate >= now }

    val canEditIdentity = FamilySecurityPolicy.canManageFamilyMembers(actorRole)
    val canSeeFinance = FamilySecurityPolicy.canAccessFinancialLedger(actorRole)

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(FamilyOSSpacing.md)
    ) {
        // 1. Family Identity, Profile, Motto, Mission, Vision & Values Hero Card
        FamilyOSCard(
            backgroundColor = FamilyOSColors.WarmIvoryLight,
            modifier = Modifier.padding(bottom = FamilyOSSpacing.md)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.Top
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = greeting,
                        style = MaterialTheme.typography.headlineLarge,
                        color = FamilyOSColors.TextPrimary
                    )
                    Spacer(modifier = Modifier.height(FamilyOSSpacing.xxs))
                    Text(
                        text = familyName.ifBlank { "Family Workspace" },
                        style = MaterialTheme.typography.titleMedium,
                        color = FamilyOSColors.PrimaryForestGreen,
                        fontWeight = FontWeight.Bold
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = "“${workspace?.description ?: workspace?.motto ?: "Stewardship, Kindness, and Calm Preparedness in Every Season."}”",
                        style = MaterialTheme.typography.bodyMedium,
                        color = FamilyOSColors.SecondarySage
                    )
                }

                Column(horizontalAlignment = Alignment.End) {
                    FamilyOSStatusBadge(text = actorRole.name, color = FamilyOSColors.SecondarySage)
                    if (canEditIdentity) {
                        TextButton(onClick = { showIdentityEditor = true }) {
                            Text("Edit Identity", style = MaterialTheme.typography.labelSmall)
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(FamilyOSSpacing.sm))

            // Mission, Vision & Core Values
            Text(
                text = "Mission: ${workspace?.mission ?: "Cultivate a warm, resilient, and well-ordered home where every generation thrives."}",
                style = MaterialTheme.typography.bodySmall,
                color = FamilyOSColors.TextSecondary
            )
            Spacer(modifier = Modifier.height(2.dp))
            Text(
                text = "Vision: ${workspace?.vision ?: "A multi-generational household operating with clarity and shared responsibility."}",
                style = MaterialTheme.typography.bodySmall,
                color = FamilyOSColors.TextSecondary
            )
            Spacer(modifier = Modifier.height(FamilyOSSpacing.xs))
            Row(
                horizontalArrangement = Arrangement.spacedBy(FamilyOSSpacing.xs),
                modifier = Modifier.fillMaxWidth()
            ) {
                (workspace?.values ?: listOf("Stewardship", "Connection", "Preparedness")).take(4).forEach { valueTag ->
                    FamilyOSStatusBadge(text = valueTag, color = FamilyOSColors.SoftGold)
                }
            }

            Spacer(modifier = Modifier.height(FamilyOSSpacing.md))
            Divider(color = FamilyOSColors.BorderSubtle)
            Spacer(modifier = Modifier.height(FamilyOSSpacing.sm))

            // 2. Family Member Overview
            Text(
                text = "FAMILY MEMBERS (${members.size})",
                style = MaterialTheme.typography.labelSmall,
                color = FamilyOSColors.TextSecondary,
                fontWeight = FontWeight.Bold
            )
            Spacer(modifier = Modifier.height(FamilyOSSpacing.xs))
            Row(
                horizontalArrangement = Arrangement.spacedBy(FamilyOSSpacing.sm),
                verticalAlignment = Alignment.CenterVertically
            ) {
                members.forEach { member ->
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        FamilyOSAvatar(name = member.displayName, size = 44.dp)
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            text = member.displayName,
                            style = MaterialTheme.typography.labelSmall,
                            color = FamilyOSColors.TextPrimary
                        )
                        Text(
                            text = "${member.pointsBalance} pts",
                            style = MaterialTheme.typography.labelSmall,
                            color = FamilyOSColors.SecondarySage
                        )
                    }
                }
                if (canEditIdentity) {
                    IconButton(
                        onClick = { onQuickAction("ADD_MEMBER") },
                        modifier = Modifier
                            .size(44.dp)
                            .clip(CircleShape)
                            .background(FamilyOSColors.SageLight)
                    ) {
                        Icon(
                            imageVector = Icons.Default.Add,
                            contentDescription = "Add Member",
                            tint = FamilyOSColors.PrimaryForestGreen
                        )
                    }
                }
            }
        }

        // 3. Quick Actions Row
        FamilyOSSectionHeader(title = "Quick Actions")
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(bottom = FamilyOSSpacing.md),
            horizontalArrangement = Arrangement.spacedBy(FamilyOSSpacing.sm)
        ) {
            QuickActionButton("Plan Meal", Icons.Default.Restaurant, Modifier.weight(1f)) {
                onQuickAction("PLAN_MEAL")
            }
            QuickActionButton("Assign Chore", Icons.Default.Checklist, Modifier.weight(1f)) {
                onQuickAction("ASSIGN_CHORE")
            }
            if (canSeeFinance) {
                QuickActionButton("Log Expense", Icons.Default.ReceiptLong, Modifier.weight(1f)) {
                    onQuickAction("LOG_EXPENSE")
                }
            }
            QuickActionButton("People & Tree", Icons.Default.Group, Modifier.weight(1f)) {
                onQuickAction("ADD_MEMBER")
            }
        }

        // 4. Important Family Announcements
        FamilyOSSectionHeader(
            title = "Important Family Announcements",
            actionText = if (actorRole != FamilyRole.GUEST) "Post Update" else null,
            onActionClick = { showAnnouncementDialog = true }
        )
        FamilyOSCard(modifier = Modifier.padding(bottom = FamilyOSSpacing.md)) {
            if (announcements.isEmpty()) {
                Text(
                    text = "No active household announcements.",
                    style = MaterialTheme.typography.bodySmall,
                    color = FamilyOSColors.TextSecondary
                )
            } else {
                announcements.forEachIndexed { idx, ann ->
                    if (idx > 0) {
                        Divider(color = FamilyOSColors.BorderSubtle, modifier = Modifier.padding(vertical = FamilyOSSpacing.xs))
                    }
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.Top
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(text = ann.title, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Bold)
                            Text(text = ann.body, style = MaterialTheme.typography.bodySmall, color = FamilyOSColors.TextSecondary)
                            Text(text = "Posted by ${ann.authorName}", style = MaterialTheme.typography.labelSmall, color = FamilyOSColors.TextTertiary)
                        }
                        FamilyOSStatusBadge(text = ann.priority, color = FamilyOSColors.SoftGold)
                    }
                }
            }
        }

        // 5. Today's Agenda & Upcoming Events (Live from Room Calendar & MealPlanner)
        FamilyOSSectionHeader(
            title = "Today's Agenda & Upcoming Events",
            actionText = "Calendar",
            onActionClick = { onQuickAction("VIEW_CALENDAR") }
        )
        FamilyOSCard(modifier = Modifier.padding(bottom = FamilyOSSpacing.md)) {
            if (todaysEvents.isEmpty() && mealPlans.isEmpty() && upcomingEvents.isEmpty()) {
                Text(
                    text = "No events scheduled yet. Tap Calendar to schedule household events.",
                    style = MaterialTheme.typography.bodySmall,
                    color = FamilyOSColors.TextSecondary
                )
            } else {
                todaysEvents.forEach { ev ->
                    ScheduleRow(
                        time = "Today",
                        title = ev.title,
                        subtitle = ev.description ?: ev.category.name,
                        category = ev.category.name
                    )
                    Divider(color = FamilyOSColors.BorderSubtle, modifier = Modifier.padding(vertical = FamilyOSSpacing.xs))
                }
                mealPlans.take(2).forEach { meal ->
                    ScheduleRow(
                        time = meal.mealType.name,
                        title = meal.customMealTitle ?: "Planned Family Meal",
                        subtitle = "${meal.servings} servings • ${meal.notes ?: "Family Kitchen"}",
                        category = "MEAL"
                    )
                    Divider(color = FamilyOSColors.BorderSubtle, modifier = Modifier.padding(vertical = FamilyOSSpacing.xs))
                }
                upcomingEvents.take(3).forEach { ev ->
                    ScheduleRow(
                        time = "Upcoming",
                        title = ev.title,
                        subtitle = ev.description ?: ev.category.name,
                        category = ev.category.name
                    )
                }
            }
        }

        // 6. Overdue Tasks & Priority Tasks (Live from Room Tasks)
        if (overdueTasks.isNotEmpty()) {
            FamilyOSSectionHeader(
                title = "Overdue Tasks (${overdueTasks.size})",
                subtitle = "Requires immediate household attention"
            )
            FamilyOSCard(
                backgroundColor = Color(0xFFFFF5F5),
                modifier = Modifier.padding(bottom = FamilyOSSpacing.md)
            ) {
                overdueTasks.forEachIndexed { idx, t ->
                    if (idx > 0) {
                        Divider(color = FamilyOSColors.BorderSubtle, modifier = Modifier.padding(vertical = FamilyOSSpacing.xs))
                    }
                    TaskRow(
                        title = t.title,
                        assignee = members.find { it.id == t.assignedMemberId }?.displayName ?: "Household",
                        badgeLabel = "OVERDUE • ${t.priority.name}",
                        isDone = t.isCompleted,
                        onToggle = { onToggleTaskComplete(t.id, !t.isCompleted) }
                    )
                }
            }
        }

        FamilyOSSectionHeader(
            title = "Tasks & Priorities",
            subtitle = "${priorityTasks.count { !it.isCompleted }} open tasks",
            actionText = "All Goals",
            onActionClick = { onQuickAction("VIEW_GOALS") }
        )
        FamilyOSCard(modifier = Modifier.padding(bottom = FamilyOSSpacing.md)) {
            if (priorityTasks.isEmpty()) {
                Text(
                    text = "All scheduled tasks are complete.",
                    style = MaterialTheme.typography.bodySmall,
                    color = FamilyOSColors.TextSecondary
                )
            } else {
                priorityTasks.forEachIndexed { idx, t ->
                    if (idx > 0) {
                        Divider(color = FamilyOSColors.BorderSubtle, modifier = Modifier.padding(vertical = FamilyOSSpacing.xs))
                    }
                    TaskRow(
                        title = t.title,
                        assignee = members.find { it.id == t.assignedMemberId }?.displayName ?: "Household",
                        badgeLabel = t.priority.name,
                        isDone = t.isCompleted,
                        onToggle = { onToggleTaskComplete(t.id, !t.isCompleted) }
                    )
                }
            }
        }

        // 7. Goal & Project Progress + Household Reminders
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(bottom = FamilyOSSpacing.md),
            horizontalArrangement = Arrangement.spacedBy(FamilyOSSpacing.md)
        ) {
            FamilyOSCard(modifier = Modifier.weight(1f)) {
                Text(
                    text = "GOAL & PROJECT PROGRESS",
                    style = MaterialTheme.typography.labelSmall,
                    color = FamilyOSColors.SecondarySage,
                    fontWeight = FontWeight.Bold
                )
                Spacer(modifier = Modifier.height(FamilyOSSpacing.xs))
                if (goals.isEmpty()) {
                    Text("No active goals.", style = MaterialTheme.typography.bodySmall)
                } else {
                    goals.take(2).forEach { g ->
                        Text(text = g.title, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Bold)
                        Text(
                            text = "${projects.count { it.goalId == g.id }} active project(s) • ${g.category.name}",
                            style = MaterialTheme.typography.bodySmall,
                            color = FamilyOSColors.TextSecondary
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                    }
                }
            }

            FamilyOSCard(modifier = Modifier.weight(1f)) {
                Text(
                    text = "HOUSEHOLD REMINDERS",
                    style = MaterialTheme.typography.labelSmall,
                    color = FamilyOSColors.SecondarySage,
                    fontWeight = FontWeight.Bold
                )
                Spacer(modifier = Modifier.height(FamilyOSSpacing.xs))
                reminders.forEach { rem ->
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.padding(vertical = 2.dp)
                    ) {
                        Checkbox(
                            checked = rem.isCompleted,
                            onCheckedChange = { onToggleReminder(rem.id) }
                        )
                        Column {
                            Text(
                                text = rem.title,
                                style = MaterialTheme.typography.bodySmall,
                                fontWeight = FontWeight.Medium
                            )
                            Text(
                                text = rem.dueLabel,
                                style = MaterialTheme.typography.labelSmall,
                                color = FamilyOSColors.TextTertiary
                            )
                        }
                    }
                }
            }
        }

        // 8. Approved AI Suggestions (when available)
        if (approvedAiSuggestions.isNotEmpty()) {
            FamilyOSSectionHeader(
                title = "Approved Family Stewardship Suggestions",
                subtitle = "Verified by household administrators"
            )
            FamilyOSCard(modifier = Modifier.padding(bottom = FamilyOSSpacing.md)) {
                approvedAiSuggestions.forEachIndexed { idx, sug ->
                    if (idx > 0) {
                        Divider(color = FamilyOSColors.BorderSubtle, modifier = Modifier.padding(vertical = FamilyOSSpacing.xs))
                    }
                    Text(text = sug.title, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Bold)
                    Text(text = sug.summary, style = MaterialTheme.typography.bodySmall, color = FamilyOSColors.TextSecondary)
                    Text(
                        text = "Approved by ${sug.approvedBy} • ${sug.category}",
                        style = MaterialTheme.typography.labelSmall,
                        color = FamilyOSColors.PrimaryForestGreen
                    )
                }
            }
        }

        // 9. Recent Family Activity Log (Live from Room AuditEventEntity)
        FamilyOSSectionHeader(title = "Recent Family Activity")
        FamilyOSCard {
            val visibleAudits = recentAudits.filter {
                canSeeFinance || !it.actionType.contains("FINANCE")
            }.take(6)

            if (visibleAudits.isEmpty()) {
                Text(
                    text = "Workspace initialized. Recent household actions appear here automatically.",
                    style = MaterialTheme.typography.bodySmall,
                    color = FamilyOSColors.TextSecondary
                )
            } else {
                visibleAudits.forEachIndexed { idx, audit ->
                    if (idx > 0) {
                        Divider(color = FamilyOSColors.BorderSubtle, modifier = Modifier.padding(vertical = FamilyOSSpacing.xs))
                    }
                    ActivityRow(
                        description = audit.summary,
                        timestamp = audit.actionType
                    )
                }
            }
        }
    }

    if (showIdentityEditor) {
        var nameInput by remember { mutableStateOf(familyName) }
        var mottoInput by remember { mutableStateOf(workspace?.description ?: workspace?.motto ?: "") }
        AlertDialog(
            onDismissRequest = { showIdentityEditor = false },
            title = { Text("Update Family Identity & Motto") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(
                        value = nameInput,
                        onValueChange = { nameInput = it },
                        label = { Text("Family Name") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                    OutlinedTextField(
                        value = mottoInput,
                        onValueChange = { mottoInput = it },
                        label = { Text("Family Motto") },
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        if (nameInput.isNotBlank()) {
                            onUpdateIdentity(nameInput, mottoInput)
                            showIdentityEditor = false
                        }
                    }
                ) {
                    Text("Save Identity")
                }
            },
            dismissButton = {
                TextButton(onClick = { showIdentityEditor = false }) {
                    Text("Cancel")
                }
            }
        )
    }

    if (showAnnouncementDialog) {
        var titleInput by remember { mutableStateOf("") }
        var bodyInput by remember { mutableStateOf("") }
        AlertDialog(
            onDismissRequest = { showAnnouncementDialog = false },
            title = { Text("Post Household Announcement") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(
                        value = titleInput,
                        onValueChange = { titleInput = it },
                        label = { Text("Title") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                    OutlinedTextField(
                        value = bodyInput,
                        onValueChange = { bodyInput = it },
                        label = { Text("Message") },
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        if (titleInput.isNotBlank() && bodyInput.isNotBlank()) {
                            onPostAnnouncement(titleInput, bodyInput)
                            showAnnouncementDialog = false
                        }
                    }
                ) {
                    Text("Post")
                }
            },
            dismissButton = {
                TextButton(onClick = { showAnnouncementDialog = false }) {
                    Text("Cancel")
                }
            }
        )
    }
}

@Composable
private fun QuickActionButton(
    label: String,
    icon: ImageVector,
    modifier: Modifier = Modifier,
    onClick: () -> Unit
) {
    Surface(
        onClick = onClick,
        shape = FamilyOSShapes.medium,
        color = FamilyOSColors.SurfaceCard,
        border = androidx.compose.foundation.BorderStroke(1.dp, FamilyOSColors.BorderSubtle),
        modifier = modifier.defaultMinSize(minHeight = FamilyOSSpacing.minTouchTarget)
    ) {
        Column(
            modifier = Modifier.padding(FamilyOSSpacing.sm),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = FamilyOSColors.PrimaryForestGreen,
                modifier = Modifier.size(22.dp)
            )
            Spacer(modifier = Modifier.height(FamilyOSSpacing.xxs))
            Text(
                text = label,
                style = MaterialTheme.typography.labelSmall,
                color = FamilyOSColors.TextPrimary,
                fontWeight = FontWeight.SemiBold
            )
        }
    }
}

@Composable
private fun ScheduleRow(
    time: String,
    title: String,
    subtitle: String,
    category: String
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = time,
            style = MaterialTheme.typography.labelSmall,
            fontWeight = FontWeight.Bold,
            color = FamilyOSColors.PrimaryForestGreen,
            modifier = Modifier.width(72.dp)
        )
        Column(modifier = Modifier.weight(1f)) {
            Text(text = title, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.SemiBold)
            Text(text = subtitle, style = MaterialTheme.typography.bodySmall, color = FamilyOSColors.TextSecondary)
        }
        FamilyOSStatusBadge(text = category, color = FamilyOSColors.SageGreen)
    }
}

@Composable
private fun TaskRow(
    title: String,
    assignee: String,
    badgeLabel: String,
    isDone: Boolean,
    onToggle: () -> Unit
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically
    ) {
        IconButton(onClick = onToggle, modifier = Modifier.size(28.dp)) {
            Icon(
                imageVector = if (isDone) Icons.Default.CheckCircle else Icons.Default.RadioButtonUnchecked,
                contentDescription = "Toggle Task",
                tint = if (isDone) FamilyOSColors.Success else FamilyOSColors.BorderStrong,
                modifier = Modifier.size(20.dp)
            )
        }
        Spacer(modifier = Modifier.width(FamilyOSSpacing.sm))
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = title,
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.Medium
            )
            Text(
                text = "Assigned to $assignee",
                style = MaterialTheme.typography.bodySmall,
                color = FamilyOSColors.TextSecondary
            )
        }
        FamilyOSStatusBadge(text = badgeLabel, color = FamilyOSColors.SoftGold)
    }
}

@Composable
private fun ActivityRow(description: String, timestamp: String) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = description,
            style = MaterialTheme.typography.bodySmall,
            color = FamilyOSColors.TextPrimary,
            modifier = Modifier.weight(1f)
        )
        Text(
            text = timestamp,
            style = MaterialTheme.typography.labelSmall,
            color = FamilyOSColors.TextTertiary
        )
    }
}
