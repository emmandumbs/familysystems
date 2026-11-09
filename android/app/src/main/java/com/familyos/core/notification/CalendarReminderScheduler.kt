package com.familyos.core.notification

import android.Manifest
import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.content.ContextCompat
import com.familyos.core.domain.CalendarEvent
import com.familyos.core.domain.Routine
import java.time.LocalDate
import java.time.LocalTime
import java.time.ZoneId
import java.time.ZonedDateTime

/**
 * Production-grade notification and alarm scheduler for FamilyOS.
 * Uses Android AlarmManager with timezone-aware calculations, exact alarm permission checks,
 * Android 13+ (TIRAMISU) POST_NOTIFICATIONS runtime permission verification,
 * deterministic duplicate prevention, and clean lifecycle management.
 */
object CalendarReminderScheduler {

    const val ACTION_CALENDAR_REMINDER = "com.familyos.ACTION_CALENDAR_REMINDER"
    const val ACTION_ROUTINE_REMINDER = "com.familyos.ACTION_ROUTINE_REMINDER"

    const val EXTRA_EVENT_ID = "extra_event_id"
    const val EXTRA_EVENT_TITLE = "extra_event_title"
    const val EXTRA_EVENT_SCOPE = "extra_event_scope"
    const val EXTRA_OFFSET_MINUTES = "extra_offset_minutes"
    const val EXTRA_ROUTINE_ID = "extra_routine_id"
    const val EXTRA_ROUTINE_TITLE = "extra_routine_title"

    fun hasNotificationPermission(context: Context): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.POST_NOTIFICATIONS
            ) == PackageManager.PERMISSION_GRANTED
        } else {
            true
        }
    }

    /**
     * Schedules alarms for all reminder offsets configured for a calendar event.
     */
    fun scheduleEventReminder(context: Context, event: CalendarEvent) {
        if (!hasNotificationPermission(context)) return
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return
        val targetZone = try {
            ZoneId.of(event.timezone)
        } catch (_: Exception) {
            ZoneId.systemDefault()
        }

        // Base event epoch millis
        val eventTimeMillis = event.eventTimeMillis ?: event.eventDate
        val now = System.currentTimeMillis()

        val reminderOffsets = if (event.reminders.isNotEmpty()) event.reminders else listOf(15) // default 15m before

        for (offset in reminderOffsets) {
            val triggerEpochMillis = eventTimeMillis - (offset * 60 * 1000L)
            if (triggerEpochMillis <= now) {
                // Event or reminder is already in the past, skip scheduling
                continue
            }

            val requestCode = generateEventRequestCode(event.id, offset)
            val intent = Intent(context, CalendarReminderReceiver::class.java).apply {
                action = ACTION_CALENDAR_REMINDER
                putExtra(EXTRA_EVENT_ID, event.id)
                putExtra(EXTRA_EVENT_TITLE, event.title)
                putExtra(EXTRA_EVENT_SCOPE, event.scope)
                putExtra(EXTRA_OFFSET_MINUTES, offset)
            }

            val pendingIntent = PendingIntent.getBroadcast(
                context,
                requestCode,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            scheduleAlarmSafely(alarmManager, triggerEpochMillis, pendingIntent)
        }
    }

    /**
     * Reschedules event reminders by first cancelling existing alarms and then scheduling fresh ones.
     */
    fun rescheduleEventReminder(context: Context, event: CalendarEvent) {
        cancelEventReminder(context, event.id)
        scheduleEventReminder(context, event)
    }

    /**
     * Cancels scheduled alarms for a calendar event across common offsets (0, 15, 30, 60, 1440 mins).
     */
    fun cancelEventReminder(context: Context, eventId: String) {
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return
        val commonOffsets = listOf(0, 10, 15, 30, 60, 120, 1440)
        for (offset in commonOffsets) {
            val requestCode = generateEventRequestCode(eventId, offset)
            val intent = Intent(context, CalendarReminderReceiver::class.java).apply {
                action = ACTION_CALENDAR_REMINDER
            }
            val pendingIntent = PendingIntent.getBroadcast(
                context,
                requestCode,
                intent,
                PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE
            )
            if (pendingIntent != null) {
                alarmManager.cancel(pendingIntent)
                pendingIntent.cancel()
            }
        }
    }

    /**
     * Schedules a daily recurring alarm for an active routine.
     */
    fun scheduleRoutineReminder(context: Context, routine: Routine) {
        if (routine.isPaused) return
        if (!hasNotificationPermission(context)) return
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return

        val (hour, minute) = try {
            val parts = routine.targetTimeOfDay.split(":")
            parts[0].toInt() to parts[1].toInt()
        } catch (_: Exception) {
            8 to 0
        }

        val zone = ZoneId.systemDefault()
        var targetDateTime = ZonedDateTime.of(LocalDate.now(), LocalTime.of(hour, minute), zone)
        if (targetDateTime.toInstant().toEpochMilli() <= System.currentTimeMillis()) {
            targetDateTime = targetDateTime.plusDays(1)
        }

        val triggerMillis = targetDateTime.toInstant().toEpochMilli()
        val requestCode = ("routine_" + routine.id).hashCode()

        val intent = Intent(context, CalendarReminderReceiver::class.java).apply {
            action = ACTION_ROUTINE_REMINDER
            putExtra(EXTRA_ROUTINE_ID, routine.id)
            putExtra(EXTRA_ROUTINE_TITLE, routine.title)
        }

        val pendingIntent = PendingIntent.getBroadcast(
            context,
            requestCode,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        scheduleAlarmSafely(alarmManager, triggerMillis, pendingIntent)
    }

    fun cancelRoutineReminder(context: Context, routineId: String) {
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return
        val requestCode = ("routine_" + routineId).hashCode()
        val intent = Intent(context, CalendarReminderReceiver::class.java).apply {
            action = ACTION_ROUTINE_REMINDER
        }
        val pendingIntent = PendingIntent.getBroadcast(
            context,
            requestCode,
            intent,
            PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE
        )
        if (pendingIntent != null) {
            alarmManager.cancel(pendingIntent)
            pendingIntent.cancel()
        }
    }

    private fun scheduleAlarmSafely(
        alarmManager: AlarmManager,
        triggerMillis: Long,
        pendingIntent: PendingIntent
    ) {
        val canScheduleExact = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            alarmManager.canScheduleExactAlarms()
        } else {
            true
        }

        if (canScheduleExact) {
            try {
                alarmManager.setExactAndAllowWhileIdle(
                    AlarmManager.RTC_WAKEUP,
                    triggerMillis,
                    pendingIntent
                )
            } catch (_: SecurityException) {
                alarmManager.setAndAllowWhileIdle(
                    AlarmManager.RTC_WAKEUP,
                    triggerMillis,
                    pendingIntent
                )
            }
        } else {
            alarmManager.setAndAllowWhileIdle(
                AlarmManager.RTC_WAKEUP,
                triggerMillis,
                pendingIntent
            )
        }
    }

    private fun generateEventRequestCode(eventId: String, offsetMinutes: Int): Int {
        return (eventId.hashCode() * 31) + offsetMinutes
    }
}
