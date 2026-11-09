package com.familyos.core.domain

import java.time.Instant
import java.time.LocalDate
import java.time.YearMonth
import java.time.ZoneId
import java.time.ZonedDateTime

/**
 * Calendar-aware recurrence calculation engine for FamilyOS.
 *
 * Recurrence Semantics:
 * 1. Timezone Authority: All dates are calculated with respect to a designated household ZoneId
 *    (defaults to ZoneId.systemDefault() or ZoneId.of("UTC")). This preserves the family's
 *    wall-clock hour across Daylight Saving Time (DST) transitions (e.g. 09:00 AM remains 09:00 AM).
 * 2. Recurrence Anchor Preservation: When a monthly recurrence begins on day 29, 30, or 31,
 *    subsequent shorter months (like February or 30-day months) clip to the last valid day of that month.
 *    However, the anchor day is PRESERVED so that the schedule does not permanently drift to day 28/30.
 *    Example with anchor day 31:
 *      Jan 31 -> Feb 28 (or 29) -> Mar 31 -> Apr 30 -> May 31 -> Jun 30 -> Jul 31 -> Aug 31 -> Sep 30 -> Oct 31 -> Nov 30 -> Dec 31.
 * 3. Leap Year Accuracy: February in leap years (e.g., 2024, 2028) evaluates to 29 days; non-leap years (2025, 2026) evaluate to 28 days.
 */
object ChoreRecurrenceCalculator {

    /**
     * Computes the next due date based on the chore's current due date, frequency, and timezone.
     *
     * @param currentDueDateMillis The current due date timestamp in epoch milliseconds.
     * @param frequency The ChoreFrequency (DAILY, WEEKLY, MONTHLY, CUSTOM).
     * @param zoneId The household's active timezone.
     * @param anchorDayOfMonth Optional original day of the month (1..31) that anchored the recurrence schedule.
     *                          If null, the day of month from currentDueDateMillis is used as the anchor.
     * @return The next due date timestamp in epoch milliseconds.
     */
    fun computeNextDueDate(
        currentDueDateMillis: Long,
        frequency: ChoreFrequency,
        zoneId: ZoneId = ZoneId.of("UTC"),
        anchorDayOfMonth: Int? = null
    ): Long {
        val currentDateTime = Instant.ofEpochMilli(currentDueDateMillis).atZone(zoneId)
        val localTime = currentDateTime.toLocalTime()
        val localDate = currentDateTime.toLocalDate()

        val nextZonedDateTime: ZonedDateTime = when (frequency) {
            ChoreFrequency.DAILY -> {
                currentDateTime.plusDays(1)
            }
            ChoreFrequency.WEEKLY -> {
                currentDateTime.plusWeeks(1)
            }
            ChoreFrequency.BIWEEKLY -> {
                currentDateTime.plusWeeks(2)
            }
            ChoreFrequency.MONTHLY -> {
                // Determine target anchor day
                val anchor = anchorDayOfMonth ?: localDate.dayOfMonth
                val targetYearMonth = YearMonth.from(localDate).plusMonths(1)
                val daysInTargetMonth = targetYearMonth.lengthOfMonth()
                val targetDay = minOf(anchor, daysInTargetMonth)

                val targetLocalDate = targetYearMonth.atDay(targetDay)
                targetLocalDate.atTime(localTime).atZone(zoneId)
            }
            ChoreFrequency.CUSTOM -> {
                currentDateTime.plusDays(1)
            }
        }

        return nextZonedDateTime.toInstant().toEpochMilli()
    }

    /**
     * Simulates repeated monthly recurrences starting from a base date over a specified number of cycles,
     * preserving the anchor day of month throughout the entire series.
     */
    fun computeMonthlyRecurrenceSequence(
        startDueDateMillis: Long,
        cycles: Int,
        zoneId: ZoneId = ZoneId.of("UTC"),
        anchorDayOfMonth: Int? = null
    ): List<Long> {
        val initialDateTime = Instant.ofEpochMilli(startDueDateMillis).atZone(zoneId)
        val anchor = anchorDayOfMonth ?: initialDateTime.dayOfMonth
        val sequence = mutableListOf<Long>()

        var currentMillis = startDueDateMillis
        for (i in 1..cycles) {
            currentMillis = computeNextDueDate(
                currentDueDateMillis = currentMillis,
                frequency = ChoreFrequency.MONTHLY,
                zoneId = zoneId,
                anchorDayOfMonth = anchor
            )
            sequence.add(currentMillis)
        }
        return sequence
    }
}
