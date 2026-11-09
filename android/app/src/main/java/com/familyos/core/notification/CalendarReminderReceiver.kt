package com.familyos.core.notification

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.familyos.MainActivity

/**
 * BroadcastReceiver responsible for delivering system status-bar notifications
 * when AlarmManager triggers for calendar events and daily routines.
 * Enforces zero-trust privacy rules: conceals sensitive titles on shared devices when configured.
 */
class CalendarReminderReceiver : BroadcastReceiver() {

    companion object {
        const val CHANNEL_ID = "familyos_reminders_channel"
        const val CHANNEL_NAME = "Household Calendar & Routines"
        const val CHANNEL_DESC = "Notifications for upcoming family calendar events, appointments, and daily routines."
    }

    override fun onReceive(context: Context, intent: Intent?) {
        if (intent == null) return

        ensureNotificationChannel(context)

        when (intent.action) {
            CalendarReminderScheduler.ACTION_CALENDAR_REMINDER -> {
                val eventId = intent.getStringExtra(CalendarReminderScheduler.EXTRA_EVENT_ID) ?: return
                val title = intent.getStringExtra(CalendarReminderScheduler.EXTRA_EVENT_TITLE) ?: "Upcoming Event"
                val scope = intent.getStringExtra(CalendarReminderScheduler.EXTRA_EVENT_SCOPE) ?: "FAMILY"
                val offsetMinutes = intent.getIntExtra(CalendarReminderScheduler.EXTRA_OFFSET_MINUTES, 15)

                // Privacy Shielding: If COUPLE or PERSONAL, conceal sensitive titles on lockscreen/shared notifications
                val displayTitle = if (scope == "COUPLE" || scope == "PERSONAL") {
                    "FamilyOS Reminder ($scope)"
                } else {
                    title
                }

                val bodyText = if (offsetMinutes == 0) {
                    "Event starting now: $title"
                } else {
                    "Starting in $offsetMinutes minutes"
                }

                val notificationId = (eventId.hashCode() * 31) + offsetMinutes
                showNotification(context, notificationId, displayTitle, bodyText)
            }

            CalendarReminderScheduler.ACTION_ROUTINE_REMINDER -> {
                val routineId = intent.getStringExtra(CalendarReminderScheduler.EXTRA_ROUTINE_ID) ?: return
                val title = intent.getStringExtra(CalendarReminderScheduler.EXTRA_ROUTINE_TITLE) ?: "Daily Routine"

                val notificationId = ("routine_" + routineId).hashCode()
                showNotification(context, notificationId, "Routine Ready: $title", "Time for your household daily rhythm!")
            }
        }
    }

    private fun ensureNotificationChannel(context: Context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager ?: return
            val existing = notificationManager.getNotificationChannel(CHANNEL_ID)
            if (existing == null) {
                val channel = NotificationChannel(
                    CHANNEL_ID,
                    CHANNEL_NAME,
                    NotificationManager.IMPORTANCE_HIGH
                ).apply {
                    description = CHANNEL_DESC
                    enableVibration(true)
                    setShowBadge(true)
                }
                notificationManager.createNotificationChannel(channel)
            }
        }
    }

    private fun showNotification(context: Context, notificationId: Int, title: String, content: String) {
        val openIntent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }

        val pendingIntent = PendingIntent.getActivity(
            context,
            notificationId,
            openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val builder = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle(title)
            .setContentText(content)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)

        try {
            val notificationManager = NotificationManagerCompat.from(context)
            notificationManager.notify(notificationId, builder.build())
        } catch (_: SecurityException) {
            // Android 13+ POST_NOTIFICATIONS permission might have been denied by user
        }
    }
}
