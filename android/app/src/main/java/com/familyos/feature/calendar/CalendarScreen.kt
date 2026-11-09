package com.familyos.feature.calendar

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
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
import com.familyos.core.domain.CalendarEvent
import com.familyos.core.domain.CalendarEventCategory
import com.familyos.core.domain.Routine
import com.familyos.core.domain.RoutineCategory
import com.familyos.core.domain.RoutineFrequency
import com.familyos.core.domain.RoutineOccurrence
import java.text.SimpleDateFormat
import java.util.*

/**
 * Stage 3.3.3: Production Household Calendar & Routines Screen
 * Unifies Day/Week/Month/Agenda schedule, Category & Scope filters,
 * Interactive Routines check-off, streak tracking, and Add Event / Add Routine modals.
 */
@Composable
fun CalendarScreen(
    events: List<CalendarEvent> = emptyList(),
    routines: List<Routine> = emptyList(),
    occurrences: List<RoutineOccurrence> = emptyList(),
    onAddEvent: (title: String, dateMillis: Long, category: CalendarEventCategory, scope: String, isAllDay: Boolean) -> Unit = { _, _, _, _, _ -> },
    onUpdateEvent: (
        eventId: String,
        title: String,
        dateMillis: Long,
        category: CalendarEventCategory,
        scope: String,
        isAllDay: Boolean,
        timezone: String,
        description: String?,
        location: String?,
        recurrenceRule: String?,
        recurrenceExceptions: List<String>
    ) -> Unit = { _, _, _, _, _, _, _, _, _, _, _ -> },
    onDeleteEvent: (String) -> Unit = {},
    onAddRoutine: (
        title: String,
        category: RoutineCategory,
        frequency: RoutineFrequency,
        targetTimeOfDay: String,
        scope: String,
        steps: List<String>,
        pointsReward: Int
    ) -> Unit = { _, _, _, _, _, _, _ -> },
    onCompleteRoutineOccurrence: (routineId: String, occurrenceId: String) -> Unit = { _, _ -> },
    onSkipRoutineOccurrence: (routineId: String, occurrenceId: String) -> Unit = { _, _ -> },
    onToggleRoutineStep: (routineId: String, occurrenceId: String, stepId: String, isDone: Boolean) -> Unit = { _, _, _, _ -> },
    onPauseResumeRoutine: (routineId: String, isPaused: Boolean) -> Unit = { _, _ -> },
    onConvertRoutineToTask: (routineId: String, occurrenceId: String) -> Unit = { _, _ -> }
) {
    var activeTab by remember { mutableStateOf("CALENDAR") } // CALENDAR or ROUTINES
    var selectedCategory by remember { mutableStateOf("ALL") }
    var selectedScope by remember { mutableStateOf("ALL") }
    var selectedViewMode by remember { mutableStateOf("AGENDA") } // DAY, WEEK, MONTH, AGENDA
    var showAddEventDialog by remember { mutableStateOf(false) }
    var showAddRoutineDialog by remember { mutableStateOf(false) }
    var editingEvent by remember { mutableStateOf<CalendarEvent?>(null) }


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
                    text = "Calendar & Routines",
                    style = MaterialTheme.typography.headlineLarge,
                    color = FamilyOSColors.TextPrimary
                )
                Text(
                    text = "Unified household schedule, recurring rhythms & streak tracker",
                    style = MaterialTheme.typography.bodySmall,
                    color = FamilyOSColors.TextSecondary
                )
            }

            if (activeTab == "CALENDAR") {
                FamilyOSPrimaryButton(
                    text = "Add Event",
                    icon = Icons.Default.Event,
                    onClick = { showAddEventDialog = true }
                )
            } else {
                FamilyOSPrimaryButton(
                    text = "Add Routine",
                    icon = Icons.Default.AddTask,
                    onClick = { showAddRoutineDialog = true }
                )
            }
        }

        Spacer(modifier = Modifier.height(FamilyOSSpacing.sm))

        // Main Tab Switcher: Calendar vs Routines
        TabRow(
            selectedTabIndex = if (activeTab == "CALENDAR") 0 else 1,
            containerColor = Color.Transparent,
            contentColor = FamilyOSColors.PrimaryForestGreen
        ) {
            Tab(
                selected = activeTab == "CALENDAR",
                onClick = { activeTab = "CALENDAR" },
                text = { Text("Household Calendar (${events.size})", fontWeight = FontWeight.Bold) },
                icon = { Icon(Icons.Default.CalendarToday, contentDescription = null) }
            )
            Tab(
                selected = activeTab == "ROUTINES",
                onClick = { activeTab = "ROUTINES" },
                text = { Text("Daily Routines (${routines.size})", fontWeight = FontWeight.Bold) },
                icon = { Icon(Icons.Default.Repeat, contentDescription = null) }
            )
        }

        Spacer(modifier = Modifier.height(FamilyOSSpacing.sm))

        if (activeTab == "CALENDAR") {
            // View Mode Selector (Day, Week, Month, Agenda)
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(FamilyOSColors.SageLight, FamilyOSShapes.medium)
                    .padding(4.dp),
                horizontalArrangement = Arrangement.Center
            ) {
                listOf("DAY", "WEEK", "MONTH", "AGENDA").forEach { mode ->
                    val isSelected = selectedViewMode == mode
                    TextButton(
                        onClick = { selectedViewMode = mode },
                        shape = FamilyOSShapes.small,
                        colors = ButtonDefaults.textButtonColors(
                            containerColor = if (isSelected) Color.White else Color.Transparent,
                            contentColor = if (isSelected) FamilyOSColors.PrimaryForestGreen else FamilyOSColors.TextSecondary
                        ),
                        modifier = Modifier.weight(1f)
                    ) {
                        Text(text = mode, fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal)
                    }
                }
            }

            Spacer(modifier = Modifier.height(FamilyOSSpacing.xs))

            // Category & Scope Filter Row
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(FamilyOSSpacing.xs)
            ) {
                listOf("ALL", "FAMILY_EVENT", "TASK_DUE", "APPOINTMENT", "ANNIVERSARY", "BIRTHDAY", "MEAL").forEach { cat ->
                    val isSelected = selectedCategory == cat
                    FilterChip(
                        selected = isSelected,
                        onClick = { selectedCategory = cat },
                        label = { Text(cat.replace("_", " "), style = MaterialTheme.typography.labelSmall) },
                        colors = FilterChipDefaults.filterChipColors(
                            selectedContainerColor = FamilyOSColors.SageLight,
                            selectedLabelColor = FamilyOSColors.PrimaryForestGreen
                        )
                    )
                }
            }

            Spacer(modifier = Modifier.height(FamilyOSSpacing.sm))

            // Filtered Calendar Events Stream
            val filteredEvents = events.filter { event ->
                val matchesCat = selectedCategory == "ALL" || event.category.name == selectedCategory
                val matchesScope = selectedScope == "ALL" || event.scope.equals(selectedScope, ignoreCase = true)
                matchesCat && matchesScope
            }

            if (filteredEvents.isEmpty()) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .weight(1f),
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Icon(Icons.Default.CalendarToday, contentDescription = null, tint = FamilyOSColors.TextSecondary, modifier = Modifier.size(48.dp))
                        Spacer(modifier = Modifier.height(FamilyOSSpacing.sm))
                        Text("No calendar events scheduled in this range.", color = FamilyOSColors.TextSecondary)
                    }
                }
            } else {
                LazyColumn(
                    modifier = Modifier.weight(1f),
                    verticalArrangement = Arrangement.spacedBy(FamilyOSSpacing.sm)
                ) {
                    items(filteredEvents) { event ->
                        val badgeColor = when (event.category) {
                            CalendarEventCategory.BIRTHDAY -> FamilyOSColors.SoftGold
                            CalendarEventCategory.ANNIVERSARY -> FamilyOSColors.SoftGold
                            CalendarEventCategory.MEAL -> FamilyOSColors.SecondarySage
                            CalendarEventCategory.CHORE -> FamilyOSColors.SageGreen
                            CalendarEventCategory.MAINTENANCE -> FamilyOSColors.Warning
                            CalendarEventCategory.TASK_DUE -> FamilyOSColors.PrimaryForestGreen
                            CalendarEventCategory.APPOINTMENT -> Color(0xFF3B82F6)
                            else -> FamilyOSColors.PrimaryForestGreen
                        }

                        val date = Date(event.eventDate)
                        val monthFmt = SimpleDateFormat("MMM", Locale.US).format(date).uppercase()
                        val dayFmt = SimpleDateFormat("dd", Locale.US).format(date)

                        FamilyOSCard {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Column(
                                    modifier = Modifier.width(56.dp),
                                    horizontalAlignment = Alignment.CenterHorizontally
                                ) {
                                    Text(
                                        text = monthFmt,
                                        style = MaterialTheme.typography.labelSmall,
                                        fontWeight = FontWeight.Bold,
                                        color = FamilyOSColors.SecondarySage
                                    )
                                    Text(
                                        text = dayFmt,
                                        style = MaterialTheme.typography.titleLarge,
                                        fontWeight = FontWeight.Bold,
                                        color = FamilyOSColors.TextPrimary
                                    )
                                }

                                Spacer(modifier = Modifier.width(FamilyOSSpacing.sm))

                                Column(modifier = Modifier.weight(1f)) {
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        Text(
                                            text = event.title,
                                            style = MaterialTheme.typography.titleMedium,
                                            fontWeight = FontWeight.Bold
                                        )
                                        Spacer(modifier = Modifier.width(FamilyOSSpacing.xs))
                                        FamilyOSStatusBadge(text = event.category.name.replace("_", " "), color = badgeColor)
                                        if (event.scope != "FAMILY") {
                                            Spacer(modifier = Modifier.width(4.dp))
                                            FamilyOSStatusBadge(text = event.scope, color = FamilyOSColors.SageGreen)
                                        }
                                    }
                                    if (event.description != null) {
                                        Text(
                                            text = event.description,
                                            style = MaterialTheme.typography.bodySmall,
                                            color = FamilyOSColors.TextSecondary
                                        )
                                    }
                                    if (event.location != null) {
                                        Text(
                                            text = "📍 ${event.location}",
                                            style = MaterialTheme.typography.labelSmall,
                                            color = FamilyOSColors.TextSecondary
                                        )
                                    }
                                }

                                Row {
                                    IconButton(onClick = { editingEvent = event }) {
                                        Icon(Icons.Default.Edit, contentDescription = "Edit Event", tint = FamilyOSColors.PrimaryForestGreen)
                                    }
                                    IconButton(onClick = { onDeleteEvent(event.id) }) {
                                        Icon(Icons.Default.DeleteOutline, contentDescription = "Delete", tint = Color.Gray)
                                    }
                                }
                            }
                        }
                    }
                }
            }
        } else {
            // ROUTINES TAB
            LazyColumn(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(FamilyOSSpacing.md)
            ) {
                items(routines) { routine ->
                    val matchingOccurrences = occurrences.filter { it.routineId == routine.id }
                    val todayOccurrence = matchingOccurrences.firstOrNull()

                    FamilyOSCard {
                        Column(modifier = Modifier.fillMaxWidth().padding(FamilyOSSpacing.xs)) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Column(modifier = Modifier.weight(1f)) {
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        Text(
                                            text = routine.title,
                                            style = MaterialTheme.typography.titleMedium,
                                            fontWeight = FontWeight.Bold
                                        )
                                        Spacer(modifier = Modifier.width(8.dp))
                                        FamilyOSStatusBadge(
                                            text = "${routine.streakCount} Day Streak 🔥",
                                            color = FamilyOSColors.SoftGold
                                        )
                                        if (routine.isPaused) {
                                            Spacer(modifier = Modifier.width(4.dp))
                                            FamilyOSStatusBadge(text = "PAUSED", color = Color.Gray)
                                        }
                                    }
                                    Text(
                                        text = "${routine.frequency.name} • ${routine.targetTimeOfDay} • +${routine.pointsReward} pts",
                                        style = MaterialTheme.typography.bodySmall,
                                        color = FamilyOSColors.TextSecondary
                                    )
                                }

                                TextButton(onClick = { onPauseResumeRoutine(routine.id, !routine.isPaused) }) {
                                    Text(if (routine.isPaused) "Resume" else "Pause", color = FamilyOSColors.PrimaryForestGreen)
                                }
                            }

                            if (routine.description != null) {
                                Spacer(modifier = Modifier.height(4.dp))
                                Text(
                                    text = routine.description,
                                    style = MaterialTheme.typography.bodySmall,
                                    color = FamilyOSColors.TextSecondary
                                )
                            }

                            Spacer(modifier = Modifier.height(8.dp))

                            // Steps Checklist
                            Text("Checklist Steps:", fontWeight = FontWeight.Bold, style = MaterialTheme.typography.labelSmall)
                            routine.steps.forEach { step ->
                                val isDone = todayOccurrence?.stepCompletions?.get(step.id) == true
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .clickable {
                                            if (todayOccurrence != null) {
                                                onToggleRoutineStep(routine.id, todayOccurrence.id, step.id, !isDone)
                                            }
                                        }
                                        .padding(vertical = 2.dp)
                                ) {
                                    Checkbox(
                                        checked = isDone,
                                        onCheckedChange = { checked ->
                                            if (todayOccurrence != null) {
                                                onToggleRoutineStep(routine.id, todayOccurrence.id, step.id, checked)
                                            }
                                        }
                                    )
                                    Text(
                                        text = step.title,
                                        style = MaterialTheme.typography.bodyMedium,
                                        color = if (isDone) Color.Gray else FamilyOSColors.TextPrimary
                                    )
                                }
                            }

                            Spacer(modifier = Modifier.height(8.dp))

                            // Occurrence Actions
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                Button(
                                    onClick = {
                                        val occId = todayOccurrence?.id ?: "occ-${routine.id}-${System.currentTimeMillis()}"
                                        onCompleteRoutineOccurrence(routine.id, occId)
                                    },
                                    colors = ButtonDefaults.buttonColors(containerColor = FamilyOSColors.PrimaryForestGreen),
                                    modifier = Modifier.weight(1f)
                                ) {
                                    Icon(Icons.Default.CheckCircle, contentDescription = null, modifier = Modifier.size(16.dp))
                                    Spacer(modifier = Modifier.width(4.dp))
                                    Text("Complete Today (+${routine.pointsReward} pts)")
                                }

                                OutlinedButton(
                                    onClick = {
                                        if (todayOccurrence != null) {
                                            onConvertRoutineToTask(routine.id, todayOccurrence.id)
                                        }
                                    }
                                ) {
                                    Icon(Icons.Default.TaskAlt, contentDescription = null, modifier = Modifier.size(16.dp))
                                    Spacer(modifier = Modifier.width(4.dp))
                                    Text("Convert to Task")
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // Add Event Dialog
    if (showAddEventDialog) {
        var newTitle by remember { mutableStateOf("") }
        var newCategory by remember { mutableStateOf(CalendarEventCategory.FAMILY_EVENT) }
        var newScope by remember { mutableStateOf("FAMILY") }

        AlertDialog(
            onDismissRequest = { showAddEventDialog = false },
            title = { Text("Add Household Calendar Event", fontWeight = FontWeight.Bold) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(
                        value = newTitle,
                        onValueChange = { newTitle = it },
                        label = { Text("Event Title") },
                        modifier = Modifier.fillMaxWidth()
                    )
                    Text("Category: ${newCategory.name.replace("_", " ")}", style = MaterialTheme.typography.labelSmall)
                    Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                        listOf(CalendarEventCategory.FAMILY_EVENT, CalendarEventCategory.APPOINTMENT, CalendarEventCategory.ANNIVERSARY).forEach { cat ->
                            FilterChip(
                                selected = newCategory == cat,
                                onClick = { newCategory = cat },
                                label = { Text(cat.name.replace("_", " "), style = MaterialTheme.typography.labelSmall) }
                            )
                        }
                    }
                    Text("Privacy Scope: $newScope", style = MaterialTheme.typography.labelSmall)
                    Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                        listOf("FAMILY", "COUPLE", "PERSONAL").forEach { sc ->
                            FilterChip(
                                selected = newScope == sc,
                                onClick = { newScope = sc },
                                label = { Text(sc, style = MaterialTheme.typography.labelSmall) }
                            )
                        }
                    }
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        if (newTitle.isNotBlank()) {
                            onAddEvent(newTitle, System.currentTimeMillis() + 86400000L, newCategory, newScope, false)
                            showAddEventDialog = false
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = FamilyOSColors.PrimaryForestGreen)
                ) {
                    Text("Save Event")
                }
            },
            dismissButton = {
                TextButton(onClick = { showAddEventDialog = false }) {
                    Text("Cancel")
                }
            }
        )
    }

    // Edit Event Dialog
    editingEvent?.let { currentEvent ->
        var editTitle by remember { mutableStateOf(currentEvent.title) }
        var editCategory by remember { mutableStateOf(currentEvent.category) }
        var editScope by remember { mutableStateOf(currentEvent.scope) }
        var editTimezone by remember { mutableStateOf(currentEvent.timezone) }
        var editIsAllDay by remember { mutableStateOf(currentEvent.isAllDay) }
        var editLocation by remember { mutableStateOf(currentEvent.location ?: "") }
        var editDescription by remember { mutableStateOf(currentEvent.description ?: "") }
        var excludeThisOccurrence by remember { mutableStateOf(false) }

        val isTaskLinked = currentEvent.id.startsWith("cal-task-") || currentEvent.sourceEntityId != null
        val isRecurring = currentEvent.recurrenceRule != null
        val eventDateStr = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date(currentEvent.eventDate))

        AlertDialog(
            onDismissRequest = { editingEvent = null },
            title = { Text("Edit Calendar Event", fontWeight = FontWeight.Bold) },
            text = {
                LazyColumn(
                    modifier = Modifier.fillMaxWidth(),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    item {
                        if (isTaskLinked) {
                            Text(
                                text = "🔗 Task-Linked Event: Updating title, date, or timezone will sync with the underlying task in lockstep.",
                                style = MaterialTheme.typography.bodySmall,
                                color = FamilyOSColors.PrimaryForestGreen,
                                fontWeight = FontWeight.SemiBold
                            )
                        }
                    }

                    item {
                        OutlinedTextField(
                            value = editTitle,
                            onValueChange = { editTitle = it },
                            label = { Text("Event Title") },
                            modifier = Modifier.fillMaxWidth()
                        )
                    }

                    item {
                        OutlinedTextField(
                            value = editLocation,
                            onValueChange = { editLocation = it },
                            label = { Text("Location (Optional)") },
                            modifier = Modifier.fillMaxWidth()
                        )
                    }

                    item {
                        OutlinedTextField(
                            value = editDescription,
                            onValueChange = { editDescription = it },
                            label = { Text("Description") },
                            modifier = Modifier.fillMaxWidth()
                        )
                    }

                    item {
                        Text("Category: ${editCategory.name.replace("_", " ")}", style = MaterialTheme.typography.labelSmall)
                        Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                            listOf(
                                CalendarEventCategory.FAMILY_EVENT,
                                CalendarEventCategory.APPOINTMENT,
                                CalendarEventCategory.ANNIVERSARY,
                                CalendarEventCategory.TASK_DUE,
                                CalendarEventCategory.BIRTHDAY
                            ).forEach { cat ->
                                FilterChip(
                                    selected = editCategory == cat,
                                    onClick = { editCategory = cat },
                                    label = { Text(cat.name.replace("_", " "), style = MaterialTheme.typography.labelSmall) }
                                )
                            }
                        }
                    }

                    item {
                        Text("Privacy Scope: $editScope", style = MaterialTheme.typography.labelSmall)
                        Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                            listOf("FAMILY", "COUPLE", "PERSONAL").forEach { sc ->
                                FilterChip(
                                    selected = editScope == sc,
                                    onClick = { editScope = sc },
                                    label = { Text(sc, style = MaterialTheme.typography.labelSmall) }
                                )
                            }
                        }
                    }

                    item {
                        Text("IANA Timezone: $editTimezone", style = MaterialTheme.typography.labelSmall)
                        Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                            listOf("America/Los_Angeles", "America/New_York", "America/Chicago", "UTC", "Europe/London").forEach { tz ->
                                FilterChip(
                                    selected = editTimezone == tz,
                                    onClick = { editTimezone = tz },
                                    label = { Text(tz.substringAfter("/"), style = MaterialTheme.typography.labelSmall) }
                                )
                            }
                        }
                    }

                    if (isRecurring) {
                        item {
                            Spacer(modifier = Modifier.height(4.dp))
                            Text("Recurrence Scope:", fontWeight = FontWeight.Bold, style = MaterialTheme.typography.labelSmall)
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                FilterChip(
                                    selected = !excludeThisOccurrence,
                                    onClick = { excludeThisOccurrence = false },
                                    label = { Text("Edit All in Series", style = MaterialTheme.typography.labelSmall) }
                                )
                                Spacer(modifier = Modifier.width(4.dp))
                                FilterChip(
                                    selected = excludeThisOccurrence,
                                    onClick = { excludeThisOccurrence = true },
                                    label = { Text("Exclude This Day ($eventDateStr)", style = MaterialTheme.typography.labelSmall) }
                                )
                            }
                        }
                    }
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        if (editTitle.isNotBlank()) {
                            val updatedExceptions = if (excludeThisOccurrence) {
                                currentEvent.recurrenceExceptions + eventDateStr
                            } else {
                                currentEvent.recurrenceExceptions
                            }

                            onUpdateEvent(
                                currentEvent.id,
                                editTitle,
                                currentEvent.eventDate,
                                editCategory,
                                editScope,
                                editIsAllDay,
                                editTimezone,
                                editDescription.ifBlank { null },
                                editLocation.ifBlank { null },
                                currentEvent.recurrenceRule,
                                updatedExceptions
                            )
                            editingEvent = null
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = FamilyOSColors.PrimaryForestGreen)
                ) {
                    Text("Save Changes")
                }
            },
            dismissButton = {
                TextButton(onClick = { editingEvent = null }) {
                    Text("Cancel")
                }
            }
        )
    }

    // Add Routine Dialog (Schema-accurate for routines table)
    if (showAddRoutineDialog) {
        var rTitle by remember { mutableStateOf("") }
        var rCategory by remember { mutableStateOf(RoutineCategory.HOUSEHOLD) }
        var rFrequency by remember { mutableStateOf(RoutineFrequency.DAILY) }
        var rTimeOfDay by remember { mutableStateOf("08:00") }
        var rScope by remember { mutableStateOf("FAMILY") }
        var rPointsStr by remember { mutableStateOf("15") }
        var rStepsText by remember { mutableStateOf("Prepare checklist\nComplete routine tasks") }

        AlertDialog(
            onDismissRequest = { showAddRoutineDialog = false },
            title = { Text("Create Household Routine", fontWeight = FontWeight.Bold) },
            text = {
                LazyColumn(
                    modifier = Modifier.fillMaxWidth(),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    item {
                        OutlinedTextField(
                            value = rTitle,
                            onValueChange = { rTitle = it },
                            label = { Text("Routine Title") },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth()
                        )
                    }
                    item {
                        Text("Category: ${rCategory.name}", style = MaterialTheme.typography.labelSmall)
                        Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                            listOf(
                                RoutineCategory.MORNING,
                                RoutineCategory.EVENING,
                                RoutineCategory.HOUSEHOLD,
                                RoutineCategory.SPIRITUAL
                            ).forEach { cat ->
                                FilterChip(
                                    selected = rCategory == cat,
                                    onClick = { rCategory = cat },
                                    label = { Text(cat.name, style = MaterialTheme.typography.labelSmall) }
                                )
                            }
                        }
                    }
                    item {
                        Text("Frequency: ${rFrequency.name}", style = MaterialTheme.typography.labelSmall)
                        Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                            listOf(
                                RoutineFrequency.DAILY,
                                RoutineFrequency.WEEKDAYS,
                                RoutineFrequency.WEEKLY,
                                RoutineFrequency.MONTHLY
                            ).forEach { freq ->
                                FilterChip(
                                    selected = rFrequency == freq,
                                    onClick = { rFrequency = freq },
                                    label = { Text(freq.name, style = MaterialTheme.typography.labelSmall) }
                                )
                            }
                        }
                    }
                    item {
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            OutlinedTextField(
                                value = rTimeOfDay,
                                onValueChange = { rTimeOfDay = it },
                                label = { Text("Target Time (HH:mm)") },
                                singleLine = true,
                                modifier = Modifier.weight(1f)
                            )
                            OutlinedTextField(
                                value = rPointsStr,
                                onValueChange = { rPointsStr = it.filter { ch -> ch.isDigit() } },
                                label = { Text("Reward Points") },
                                singleLine = true,
                                modifier = Modifier.weight(1f)
                            )
                        }
                    }
                    item {
                        Text("Privacy Scope: $rScope", style = MaterialTheme.typography.labelSmall)
                        Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                            listOf("FAMILY", "COUPLE", "PERSONAL").forEach { sc ->
                                FilterChip(
                                    selected = rScope == sc,
                                    onClick = { rScope = sc },
                                    label = { Text(sc, style = MaterialTheme.typography.labelSmall) }
                                )
                            }
                        }
                    }
                    item {
                        OutlinedTextField(
                            value = rStepsText,
                            onValueChange = { rStepsText = it },
                            label = { Text("Checklist Steps (steps_json — one step per line)") },
                            modifier = Modifier.fillMaxWidth()
                        )
                    }
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        if (rTitle.isNotBlank()) {
                            val stepsList = rStepsText.lines().map { it.trim() }.filter { it.isNotBlank() }
                            val pts = rPointsStr.toIntOrNull() ?: 15
                            onAddRoutine(
                                rTitle.trim(),
                                rCategory,
                                rFrequency,
                                rTimeOfDay.ifBlank { "08:00" },
                                rScope,
                                stepsList,
                                pts
                            )
                            showAddRoutineDialog = false
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = FamilyOSColors.PrimaryForestGreen)
                ) {
                    Text("Save Routine")
                }
            },
            dismissButton = {
                TextButton(onClick = { showAddRoutineDialog = false }) {
                    Text("Cancel")
                }
            }
        )
    }
}

