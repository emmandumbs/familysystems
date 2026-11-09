package com.familyos.core.notification

import android.app.AlarmManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.familyos.FamilyOSApplication
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch

/**
 * BroadcastReceiver triggered after device reboot (BOOT_COMPLETED) or system clock/timezone adjustments.
 * Re-queries the encrypted Room database to restore upcoming calendar reminders and daily routine alarms.
 */
class BootReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent?) {
        if (intent == null) return
        val action = intent.action
        if (action != Intent.ACTION_BOOT_COMPLETED &&
            action != Intent.ACTION_TIMEZONE_CHANGED &&
            action != Intent.ACTION_TIME_CHANGED &&
            action != AlarmManager.ACTION_SCHEDULE_EXACT_ALARM_PERMISSION_STATE_CHANGED
        ) {
            return
        }

        val appContext = context.applicationContext as? FamilyOSApplication ?: return
        val pendingResult = goAsync()

        CoroutineScope(Dispatchers.IO).launch {
            try {
                val now = System.currentTimeMillis()
                val sevenDaysAhead = now + (7 * 24 * 60 * 60 * 1000L)

                // Reschedule upcoming calendar events
                val upcomingEvents = appContext.database.calendarDao()
                    .observeEventsBetween("fam-1", now, sevenDaysAhead)
                    .first()

                for (eventEntity in upcomingEvents) {
                    val domainEvent = com.familyos.core.domain.CalendarEvent(
                        id = eventEntity.id,
                        familyId = eventEntity.familyId,
                        title = eventEntity.title,
                        eventDate = eventEntity.eventDate,
                        eventTimeMillis = eventEntity.eventTimeMillis,
                        category = try {
                            com.familyos.core.domain.CalendarEventCategory.valueOf(eventEntity.category)
                        } catch (_: Exception) {
                            com.familyos.core.domain.CalendarEventCategory.FAMILY_EVENT
                        },
                        sourceEntityId = eventEntity.sourceEntityId,
                        description = eventEntity.description
                    )
                    CalendarReminderScheduler.scheduleEventReminder(appContext, domainEvent)
                }

                // Reschedule active routines
                val activeRoutines = appContext.database.routineDao()
                    .observeRoutines("fam-1")
                    .first()

                for (routineEntity in activeRoutines) {
                    if (!routineEntity.isPaused) {
                        val domainRoutine = com.familyos.core.domain.Routine(
                            id = routineEntity.id,
                            familyId = routineEntity.familyId,
                            title = routineEntity.title,
                            description = routineEntity.description,
                            category = try {
                                com.familyos.core.domain.RoutineCategory.valueOf(routineEntity.category)
                            } catch (_: Exception) {
                                com.familyos.core.domain.RoutineCategory.HOUSEHOLD
                            },
                            frequency = try {
                                com.familyos.core.domain.RoutineFrequency.valueOf(routineEntity.frequency)
                            } catch (_: Exception) {
                                com.familyos.core.domain.RoutineFrequency.DAILY
                            },
                            targetTimeOfDay = routineEntity.targetTimeOfDay,
                            scope = routineEntity.scope,
                            ownerMemberId = routineEntity.ownerMemberId,
                            pointsReward = routineEntity.pointsReward,
                            isPaused = routineEntity.isPaused,
                            streakCount = routineEntity.streakCount,
                            bestStreakCount = routineEntity.bestStreakCount
                        )
                        CalendarReminderScheduler.scheduleRoutineReminder(appContext, domainRoutine)
                    }
                }
            } catch (_: Exception) {
                // Failsafe in case database is locked during boot
            } finally {
                pendingResult.finish()
            }
        }
    }
}
