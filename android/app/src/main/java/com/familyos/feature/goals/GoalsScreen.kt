package com.familyos.feature.goals

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.familyos.core.designsystem.*
import com.familyos.core.domain.*

/**
 * Stage 3.3.2: Unified 7-Tier Planning & Execution System
 * Family Mission -> Family Vision -> Goals -> Projects -> Milestones -> Tasks -> Checklists
 *
 * Enforces PERSONAL and COUPLE privacy scopes via FamilySecurityPolicy, calculates live
 * deterministic progress rollups (zero hardcoded progress indicators), provides the
 * canonical Task Center across all FamilyOS modules, and keeps Optional Family Rewards
 * disabled by default.
 */
@Composable
fun GoalsScreen(
    workspace: FamilyWorkspace? = null,
    actorMemberId: String = "mem-sarah",
    actorRole: FamilyRole = FamilyRole.OWNER,
    goals: List<FamilyGoal> = emptyList(),
    projects: List<Project> = emptyList(),
    milestones: List<ProjectMilestone> = emptyList(),
    tasks: List<Task> = emptyList(),
    checklistItems: List<TaskChecklistItem> = emptyList(),
    checklistTemplates: List<ChecklistTemplate> = emptyList(),
    rewardConfig: FamilyRewardConfig = FamilyRewardConfig(familyId = "fam-1", enabled = false),
    onAddGoal: () -> Unit = {},
    onAddTask: () -> Unit = {},
    onToggleTaskComplete: (String, Boolean) -> Unit = { _, _ -> },
    onToggleMilestoneComplete: (String, Boolean) -> Unit = { _, _ -> },
    onAddChecklistItem: (taskId: String, title: String) -> Unit = { _, _ -> },
    onToggleChecklistItem: (itemId: String, isDone: Boolean) -> Unit = { _, _ -> },
    onConfigureRewards: (Boolean) -> Unit = {}
) {
    var activeSection by remember { mutableStateOf("HIERARCHY") } // HIERARCHY, PROJECTS, TASK_CENTER, REWARDS
    var selectedTaskView by remember { mutableStateOf("ALL") } // ALL, MY_TASKS, FAMILY_TASKS, KANBAN, OVERDUE, UPCOMING, COMPLETED
    var selectedScopeFilter by remember { mutableStateOf("ALL") } // ALL, FAMILY, COUPLE, PERSONAL
    var checklistTargetTask by remember { mutableStateOf<Task?>(null) }

    val now = System.currentTimeMillis()
    val canMutate = actorRole != FamilyRole.GUEST

    // Enforce zero-trust privacy filtering on client state
    val visibleGoals = remember(goals, actorRole, actorMemberId, selectedScopeFilter) {
        goals.filter { goal ->
            FamilySecurityPolicy.canViewGoal(
                actorRole = actorRole,
                actorMemberId = actorMemberId,
                goalScope = goal.scope,
                ownerMemberId = goal.ownerMemberId
            ) && (selectedScopeFilter == "ALL" || goal.scope.name == selectedScopeFilter)
        }
    }

    val visibleTasks = remember(tasks, actorRole, actorMemberId) {
        tasks.filter { task ->
            FamilySecurityPolicy.canViewTask(
                actorRole = actorRole,
                actorMemberId = actorMemberId,
                taskScope = task.scope,
                ownerMemberId = task.ownerMemberId,
                assignedMemberId = task.assignedMemberId
            )
        }
    }

    val filteredTaskCenterItems = remember(visibleTasks, selectedTaskView, actorMemberId, now) {
        when (selectedTaskView) {
            "MY_TASKS" -> visibleTasks.filter { !it.isArchived && (it.assignedMemberId == actorMemberId || it.ownerMemberId == actorMemberId) }
            "FAMILY_TASKS" -> visibleTasks.filter { !it.isArchived && it.scope == GoalScope.FAMILY }
            "OVERDUE" -> visibleTasks.filter { !it.isArchived && !it.isCompleted && it.dueDate != null && it.dueDate < now }
            "UPCOMING" -> visibleTasks.filter { !it.isArchived && !it.isCompleted && it.dueDate != null && it.dueDate >= now }
            "COMPLETED" -> visibleTasks.filter { !it.isArchived && it.isCompleted }
            else -> visibleTasks.filter { !it.isArchived }
        }
    }

    BoxWithConstraints(
        modifier = Modifier
            .fillMaxSize()
            .padding(FamilyOSSpacing.md)
    ) {
        val isExpandedLayout = maxWidth >= 840.dp

        Column(modifier = Modifier.fillMaxSize()) {
            // Header + Action Buttons
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = "Goals, Projects & Task Center",
                        style = MaterialTheme.typography.headlineLarge,
                        color = FamilyOSColors.TextPrimary
                    )
                    Text(
                        text = "Mission → Vision → Goals → Projects → Milestones → Tasks → Checklists",
                        style = MaterialTheme.typography.bodySmall,
                        color = FamilyOSColors.TextSecondary
                    )
                }

                if (canMutate) {
                    Row(horizontalArrangement = Arrangement.spacedBy(FamilyOSSpacing.xs)) {
                        FamilyOSPrimaryButton(
                            text = "New Goal",
                            icon = Icons.Default.Flag,
                            onClick = onAddGoal
                        )
                        FamilyOSPrimaryButton(
                            text = "New Task",
                            icon = Icons.Default.AddTask,
                            onClick = onAddTask
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(FamilyOSSpacing.sm))

            // Tier 1 & Tier 2: Family Mission & Vision Alignment Banner
            Surface(
                shape = FamilyOSShapes.medium,
                color = FamilyOSColors.SageLight,
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(FamilyOSSpacing.sm)) {
                    Text(
                        text = "TIER 1 & 2 • FAMILY MISSION & VISION ALIGNMENT",
                        style = MaterialTheme.typography.labelSmall,
                        color = FamilyOSColors.PrimaryForestGreen,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = workspace?.description?.ifBlank {
                            "Build a resilient, loving, debt-free household anchored in stewardship, kindness, and calm preparedness."
                        } ?: "Build a resilient, loving, debt-free household anchored in stewardship, kindness, and calm preparedness.",
                        style = MaterialTheme.typography.bodySmall,
                        color = FamilyOSColors.TextPrimary
                    )
                }
            }

            Spacer(modifier = Modifier.height(FamilyOSSpacing.sm))

            // Primary Section Navigation (Hierarchy, Projects & Milestones, Universal Task Center, Optional Rewards)
            LazyRow(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(FamilyOSSpacing.xs)
            ) {
                val tabs = listOf(
                    "HIERARCHY" to "7-Tier Goals (${visibleGoals.size})",
                    "PROJECTS" to "Projects & Milestones (${projects.size})",
                    "TASK_CENTER" to "Universal Task Center (${visibleTasks.size})",
                    "REWARDS" to "Optional Rewards (${if (rewardConfig.enabled) "ON" else "OFF"})"
                )
                items(tabs) { (key, label) ->
                    FilterChip(
                        selected = activeSection == key,
                        onClick = { activeSection = key },
                        label = { Text(label) },
                        colors = FilterChipDefaults.filterChipColors(
                            selectedContainerColor = FamilyOSColors.PrimaryForestGreen,
                            selectedLabelColor = Color.White
                        )
                    )
                }
            }

            Spacer(modifier = Modifier.height(FamilyOSSpacing.sm))

            when (activeSection) {
                "HIERARCHY" -> {
                    // Scope Filter Chips
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(FamilyOSSpacing.xs)
                    ) {
                        listOf("ALL", "FAMILY", "COUPLE", "PERSONAL").forEach { scope ->
                            FilterChip(
                                selected = selectedScopeFilter == scope,
                                onClick = { selectedScopeFilter = scope },
                                label = { Text("$scope Scope") },
                                colors = FilterChipDefaults.filterChipColors(
                                    selectedContainerColor = FamilyOSColors.SageLight,
                                    selectedLabelColor = FamilyOSColors.PrimaryForestGreen
                                )
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(FamilyOSSpacing.sm))

                    if (visibleGoals.isEmpty()) {
                        FamilyOSEmptyState(
                            title = "No Goals in Selected Scope",
                            description = "Create a Family, Couple, or Personal goal aligned with your Family Mission & Vision.",
                            actionText = if (canMutate) "Create Goal" else "View All Scopes",
                            onActionClick = { if (canMutate) onAddGoal() else selectedScopeFilter = "ALL" },
                            icon = Icons.Default.Flag
                        )
                    } else {
                        LazyColumn(
                            modifier = Modifier.weight(1f),
                            verticalArrangement = Arrangement.spacedBy(FamilyOSSpacing.md)
                        ) {
                            items(visibleGoals, key = { it.id }) { goal ->
                                val linkedProjects = projects.filter { it.goalId == goal.id }
                                val linkedProjectIds = linkedProjects.map { it.id }.toSet()
                                val goalTasks = visibleTasks.filter { it.goalId == goal.id || (it.projectId != null && it.projectId in linkedProjectIds) }
                                val computedGoalProgress = when {
                                    goalTasks.isNotEmpty() -> goalTasks.count { it.isCompleted }.toFloat() / goalTasks.size.toFloat()
                                    goal.progressPercent > 0 -> (goal.progressPercent / 100f).coerceIn(0f, 1f)
                                    else -> 0f
                                }

                                FamilyOSCard {
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Column(modifier = Modifier.weight(1f)) {
                                            Row(
                                                verticalAlignment = Alignment.CenterVertically,
                                                horizontalArrangement = Arrangement.spacedBy(FamilyOSSpacing.xs)
                                            ) {
                                                FamilyOSStatusBadge(text = goal.scope.name, color = FamilyOSColors.PrimaryForestGreen)
                                                FamilyOSStatusBadge(text = goal.horizon.name.replace("_", " "), color = FamilyOSColors.SecondarySage)
                                                FamilyOSStatusBadge(text = goal.category.name, color = FamilyOSColors.SecondarySage)
                                                FamilyOSStatusBadge(text = goal.priority.name, color = FamilyOSColors.SoftGold)
                                            }
                                            Spacer(modifier = Modifier.height(FamilyOSSpacing.xs))
                                            Text(
                                                text = goal.title,
                                                style = MaterialTheme.typography.titleLarge,
                                                fontWeight = FontWeight.Bold
                                            )
                                            if (!goal.description.isNullOrBlank()) {
                                                Text(
                                                    text = goal.description,
                                                    style = MaterialTheme.typography.bodySmall,
                                                    color = FamilyOSColors.TextSecondary
                                                )
                                            }
                                        }
                                        Text(
                                            text = "${(computedGoalProgress * 100).toInt()}%",
                                            style = MaterialTheme.typography.titleMedium,
                                            fontWeight = FontWeight.Bold,
                                            color = FamilyOSColors.PrimaryForestGreen
                                        )
                                    }

                                    Spacer(modifier = Modifier.height(FamilyOSSpacing.sm))
                                    FamilyOSProgressIndicator(progress = computedGoalProgress)
                                    Spacer(modifier = Modifier.height(FamilyOSSpacing.sm))

                                    if (linkedProjects.isNotEmpty()) {
                                        Text(
                                            text = "PROJECTS, MILESTONES & TASKS IN THIS GOAL",
                                            style = MaterialTheme.typography.labelSmall,
                                            color = FamilyOSColors.SecondarySage,
                                            fontWeight = FontWeight.Bold
                                        )
                                        Spacer(modifier = Modifier.height(FamilyOSSpacing.xs))
                                        linkedProjects.forEach { project ->
                                            val projectMilestones = milestones.filter { it.projectId == project.id }
                                            val projectTasks = visibleTasks.filter { it.projectId == project.id }
                                            Surface(
                                                shape = FamilyOSShapes.small,
                                                color = FamilyOSColors.WarmIvoryLight,
                                                modifier = Modifier
                                                    .fillMaxWidth()
                                                    .padding(vertical = 4.dp)
                                            ) {
                                                Column(modifier = Modifier.padding(FamilyOSSpacing.sm)) {
                                                    Row(
                                                        modifier = Modifier.fillMaxWidth(),
                                                        horizontalArrangement = Arrangement.SpaceBetween
                                                    ) {
                                                        Text(
                                                            text = "Project: ${project.name}",
                                                            style = MaterialTheme.typography.bodyMedium,
                                                            fontWeight = FontWeight.Bold
                                                        )
                                                        Text(
                                                            text = "${projectTasks.count { it.isCompleted }}/${projectTasks.size} tasks • ${projectMilestones.count { it.isCompleted }}/${projectMilestones.size} milestones",
                                                            style = MaterialTheme.typography.labelSmall,
                                                            color = FamilyOSColors.TextSecondary
                                                        )
                                                    }

                                                    projectMilestones.forEach { ms ->
                                                        Row(
                                                            modifier = Modifier
                                                                .fillMaxWidth()
                                                                .padding(top = 4.dp),
                                                            verticalAlignment = Alignment.CenterVertically
                                                        ) {
                                                            Checkbox(
                                                                checked = ms.isCompleted,
                                                                onCheckedChange = { checked ->
                                                                    if (canMutate) onToggleMilestoneComplete(ms.id, checked)
                                                                },
                                                                modifier = Modifier.size(20.dp)
                                                            )
                                                            Spacer(modifier = Modifier.width(6.dp))
                                                            Text(
                                                                text = "Milestone: ${ms.title} (${ms.progressPercent}%)",
                                                                style = MaterialTheme.typography.labelMedium,
                                                                color = FamilyOSColors.PrimaryForestGreen
                                                            )
                                                        }
                                                    }

                                                    projectTasks.forEach { task ->
                                                        Row(
                                                            modifier = Modifier
                                                                .fillMaxWidth()
                                                                .padding(top = 6.dp),
                                                            verticalAlignment = Alignment.CenterVertically
                                                        ) {
                                                            IconButton(
                                                                onClick = {
                                                                    if (canMutate) onToggleTaskComplete(task.id, !task.isCompleted)
                                                                },
                                                                modifier = Modifier.size(48.dp)
                                                            ) {
                                                                Icon(
                                                                    imageVector = if (task.isCompleted) Icons.Default.CheckCircle else Icons.Default.RadioButtonUnchecked,
                                                                    contentDescription = "Toggle task ${task.title}",
                                                                    tint = if (task.isCompleted) FamilyOSColors.Success else FamilyOSColors.BorderStrong,
                                                                    modifier = Modifier.size(20.dp)
                                                                )
                                                            }
                                                            Spacer(modifier = Modifier.width(FamilyOSSpacing.xs))
                                                            Text(
                                                                text = task.title,
                                                                style = MaterialTheme.typography.bodyMedium,
                                                                color = if (task.isCompleted) FamilyOSColors.TextTertiary else FamilyOSColors.TextPrimary,
                                                                modifier = Modifier.weight(1f)
                                                            )
                                                            FamilyOSStatusBadge(
                                                                text = task.sourceModule.name.replace("_", " "),
                                                                color = FamilyOSColors.SecondarySage
                                                            )
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                "PROJECTS" -> {
                    LazyColumn(
                        modifier = Modifier.weight(1f),
                        verticalArrangement = Arrangement.spacedBy(FamilyOSSpacing.md)
                    ) {
                        items(projects, key = { it.id }) { project ->
                            val projectMilestones = milestones.filter { it.projectId == project.id }
                            val projectTasks = visibleTasks.filter { it.projectId == project.id }
                            val progress = if (projectTasks.isNotEmpty()) {
                                projectTasks.count { it.isCompleted }.toFloat() / projectTasks.size.toFloat()
                            } else {
                                (project.progressPercent / 100f).coerceIn(0f, 1f)
                            }

                            FamilyOSCard {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text(
                                            text = project.name,
                                            style = MaterialTheme.typography.titleMedium,
                                            fontWeight = FontWeight.Bold
                                        )
                                        Text(
                                            text = "Status: ${project.status} • Budget: $${project.budgetCents / 100}",
                                            style = MaterialTheme.typography.bodySmall,
                                            color = FamilyOSColors.TextSecondary
                                        )
                                    }
                                    FamilyOSStatusBadge(
                                        text = "${(progress * 100).toInt()}% Complete",
                                        color = FamilyOSColors.PrimaryForestGreen
                                    )
                                }
                                Spacer(modifier = Modifier.height(FamilyOSSpacing.xs))
                                FamilyOSProgressIndicator(progress = progress)
                            }
                        }
                    }
                }

                "TASK_CENTER" -> {
                    // Canonical Task Center Filter Views (Section 6 & 9)
                    LazyRow(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(FamilyOSSpacing.xs)
                    ) {
                        val views = listOf(
                            "ALL" to "All Tasks",
                            "MY_TASKS" to "My Tasks",
                            "FAMILY_TASKS" to "Family Tasks",
                            "OVERDUE" to "Overdue",
                            "UPCOMING" to "Upcoming",
                            "COMPLETED" to "Completed"
                        )
                        items(views) { (viewKey, label) ->
                            FilterChip(
                                selected = selectedTaskView == viewKey,
                                onClick = { selectedTaskView = viewKey },
                                label = { Text(label) },
                                colors = FilterChipDefaults.filterChipColors(
                                    selectedContainerColor = FamilyOSColors.SageLight,
                                    selectedLabelColor = FamilyOSColors.PrimaryForestGreen
                                )
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(FamilyOSSpacing.sm))

                    if (checklistTemplates.isNotEmpty()) {
                        Surface(
                            shape = FamilyOSShapes.small,
                            color = FamilyOSColors.WarmIvoryLight,
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Row(
                                modifier = Modifier.padding(FamilyOSSpacing.sm),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    text = "Reusable Checklist Templates: ${checklistTemplates.joinToString { it.name }}",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = FamilyOSColors.TextSecondary
                                )
                            }
                        }
                        Spacer(modifier = Modifier.height(FamilyOSSpacing.xs))
                    }

                    LazyColumn(
                        modifier = Modifier.weight(1f),
                        verticalArrangement = Arrangement.spacedBy(FamilyOSSpacing.sm)
                    ) {
                        items(filteredTaskCenterItems, key = { it.id }) { task ->
                            val isOverdue = !task.isCompleted && task.dueDate != null && task.dueDate < now
                            val subChecklist = remember(checklistItems, task) {
                                val dbItems = checklistItems.filter { it.taskId == task.id }
                                if (dbItems.isNotEmpty()) dbItems else task.checklistItems
                            }
                            FamilyOSCard {
                                Column(verticalArrangement = Arrangement.spacedBy(FamilyOSSpacing.xs)) {
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Checkbox(
                                            checked = task.isCompleted,
                                            onCheckedChange = { checked ->
                                                if (canMutate) onToggleTaskComplete(task.id, checked)
                                            }
                                        )
                                        Column(modifier = Modifier.weight(1f)) {
                                            Text(
                                                text = task.title,
                                                style = MaterialTheme.typography.bodyLarge,
                                                fontWeight = FontWeight.SemiBold,
                                                color = if (task.isCompleted) FamilyOSColors.TextTertiary else FamilyOSColors.TextPrimary
                                            )
                                            Row(horizontalArrangement = Arrangement.spacedBy(FamilyOSSpacing.xs)) {
                                                FamilyOSStatusBadge(
                                                    text = task.sourceModule.name.replace("_", " "),
                                                    color = FamilyOSColors.SecondarySage
                                                )
                                                FamilyOSStatusBadge(
                                                    text = task.priority.name,
                                                    color = if (isOverdue) FamilyOSColors.Danger else FamilyOSColors.SoftGold
                                                )
                                                if (isOverdue) {
                                                    FamilyOSStatusBadge(
                                                        text = "OVERDUE",
                                                        color = FamilyOSColors.Danger
                                                    )
                                                }
                                            }
                                        }
                                        if (canMutate) {
                                            TextButton(
                                                onClick = { checklistTargetTask = task },
                                                modifier = Modifier.defaultMinSize(minHeight = 48.dp)
                                            ) {
                                                Icon(
                                                    imageVector = Icons.Default.PlaylistAdd,
                                                    contentDescription = "Add checklist item to ${task.title}",
                                                    modifier = Modifier.size(18.dp)
                                                )
                                                Spacer(modifier = Modifier.width(4.dp))
                                                Text("+ Step")
                                            }
                                        }
                                    }

                                    if (subChecklist.isNotEmpty()) {
                                        Divider(color = FamilyOSColors.BorderSubtle)
                                        Column(
                                            modifier = Modifier.padding(start = 12.dp),
                                            verticalArrangement = Arrangement.spacedBy(2.dp)
                                        ) {
                                            subChecklist.forEach { item ->
                                                Row(
                                                    verticalAlignment = Alignment.CenterVertically,
                                                    modifier = Modifier.fillMaxWidth()
                                                ) {
                                                    Checkbox(
                                                        checked = item.isDone,
                                                        onCheckedChange = { checked ->
                                                            if (canMutate) onToggleChecklistItem(item.id, checked)
                                                        }
                                                    )
                                                    Text(
                                                        text = item.title,
                                                        style = MaterialTheme.typography.bodySmall,
                                                        color = if (item.isDone) FamilyOSColors.TextTertiary else FamilyOSColors.TextPrimary
                                                    )
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                "REWARDS" -> {
                    // Section 10: Optional Family Reward System (Disabled by Default & Non-Punitive)
                    FamilyOSCard {
                        Column(verticalArrangement = Arrangement.spacedBy(FamilyOSSpacing.sm)) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(
                                        text = "Optional Family Reward System (${rewardConfig.currencyName})",
                                        style = MaterialTheme.typography.titleMedium,
                                        fontWeight = FontWeight.Bold
                                    )
                                    Text(
                                        text = "Disabled by default. Positive reinforcement only — punitive deductions are strictly prohibited.",
                                        style = MaterialTheme.typography.bodySmall,
                                        color = FamilyOSColors.TextSecondary
                                    )
                                }
                                if (FamilySecurityPolicy.canConfigureRewards(actorRole)) {
                                    Switch(
                                        checked = rewardConfig.enabled,
                                        onCheckedChange = { enabled -> onConfigureRewards(enabled) }
                                    )
                                }
                            }
                            FamilyOSStatusBadge(
                                text = if (rewardConfig.enabled) "ENABLED BY FAMILY ADMIN" else "DISABLED BY DEFAULT",
                                color = if (rewardConfig.enabled) FamilyOSColors.Success else FamilyOSColors.SecondarySage
                            )
                        }
                    }
                }
            }
        }
    }

    checklistTargetTask?.let { targetTask ->
        var stepTitle by remember { mutableStateOf("") }
        AlertDialog(
            onDismissRequest = { checklistTargetTask = null },
            title = { Text("Add Task Checklist Item", fontWeight = FontWeight.Bold) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(
                        text = "Task: ${targetTask.title}",
                        style = MaterialTheme.typography.bodySmall,
                        color = FamilyOSColors.TextSecondary
                    )
                    OutlinedTextField(
                        value = stepTitle,
                        onValueChange = { stepTitle = it },
                        label = { Text("Checklist Step Title") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        if (stepTitle.isNotBlank()) {
                            onAddChecklistItem(targetTask.id, stepTitle.trim())
                            checklistTargetTask = null
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = FamilyOSColors.PrimaryForestGreen)
                ) {
                    Text("Add Step")
                }
            },
            dismissButton = {
                TextButton(onClick = { checklistTargetTask = null }) {
                    Text("Cancel")
                }
            }
        )
    }
}

