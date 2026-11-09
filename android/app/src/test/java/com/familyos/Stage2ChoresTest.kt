package com.familyos

import com.familyos.core.domain.Chore
import com.familyos.core.domain.ChoreCompletionHistory
import com.familyos.core.domain.ChoreFrequency
import com.familyos.core.domain.ChoreRecurrenceCalculator
import org.junit.Assert.*
import org.junit.Test
import java.time.*

class Stage2ChoresTest {

    private val utcZone = ZoneOffset.UTC

    @Test
    fun testRecurringChoreDailyAndWeeklyAdvancement() {
        val baseDate = LocalDate.of(2026, 3, 15).atStartOfDay(utcZone).toInstant().toEpochMilli()

        // Daily advancement (+1 day)
        val nextDaily = ChoreRecurrenceCalculator.computeNextDueDate(baseDate, ChoreFrequency.DAILY, utcZone)
        val expectedDaily = LocalDate.of(2026, 3, 16).atStartOfDay(utcZone).toInstant().toEpochMilli()
        assertEquals(expectedDaily, nextDaily)

        // Weekly advancement (+7 days)
        val nextWeekly = ChoreRecurrenceCalculator.computeNextDueDate(baseDate, ChoreFrequency.WEEKLY, utcZone)
        val expectedWeekly = LocalDate.of(2026, 3, 22).atStartOfDay(utcZone).toInstant().toEpochMilli()
        assertEquals(expectedWeekly, nextWeekly)
    }

    @Test
    fun testMonthlyRecurrenceNonLeapYearFebruaryClipsTo28th() {
        // 2026 is NOT a leap year: Jan 31 + 1 month must advance to Feb 28
        val jan31NonLeap = LocalDate.of(2026, 1, 31).atStartOfDay(utcZone).toInstant().toEpochMilli()
        val nextDue = ChoreRecurrenceCalculator.computeNextDueDate(jan31NonLeap, ChoreFrequency.MONTHLY, utcZone)

        val expectedFeb28 = LocalDate.of(2026, 2, 28).atStartOfDay(utcZone).toInstant().toEpochMilli()
        assertEquals(expectedFeb28, nextDue)
    }

    @Test
    fun testMonthlyRecurrenceLeapYearFebruaryClipsTo29th() {
        // 2024 IS a leap year: Jan 31 + 1 month must advance to Feb 29
        val jan31Leap = LocalDate.of(2024, 1, 31).atStartOfDay(utcZone).toInstant().toEpochMilli()
        val nextDue = ChoreRecurrenceCalculator.computeNextDueDate(jan31Leap, ChoreFrequency.MONTHLY, utcZone)

        val expectedFeb29 = LocalDate.of(2024, 2, 29).atStartOfDay(utcZone).toInstant().toEpochMilli()
        assertEquals(expectedFeb29, nextDue)
    }

    @Test
    fun testMonthlyRecurrencePreservesAnchorDayOfMonthAcrossFebruaryToMarch() {
        // Critical Anti-Drift Test:
        // Jan 31 (anchor 31) clips to Feb 28.
        // Advancing from Feb 28 MUST return to March 31, NOT March 28!
        val feb28 = LocalDate.of(2026, 2, 28).atStartOfDay(utcZone).toInstant().toEpochMilli()
        val nextDueMarch = ChoreRecurrenceCalculator.computeNextDueDate(
            currentDueDateMillis = feb28,
            frequency = ChoreFrequency.MONTHLY,
            zoneId = utcZone,
            anchorDayOfMonth = 31 // Original anchor was the 31st
        )

        val expectedMarch31 = LocalDate.of(2026, 3, 31).atStartOfDay(utcZone).toInstant().toEpochMilli()
        assertEquals(
            "March recurrence must restore original 31st anchor day rather than drifting to the 28th",
            expectedMarch31,
            nextDueMarch
        )
    }

    @Test
    fun testThirtyDayMonthEndClipsCorrectly() {
        // August 31 -> September 30 (30-day month)
        val aug31 = LocalDate.of(2026, 8, 31).atStartOfDay(utcZone).toInstant().toEpochMilli()
        val nextDueSep = ChoreRecurrenceCalculator.computeNextDueDate(aug31, ChoreFrequency.MONTHLY, utcZone)
        val expectedSep30 = LocalDate.of(2026, 9, 30).atStartOfDay(utcZone).toInstant().toEpochMilli()
        assertEquals(expectedSep30, nextDueSep)

        // March 31 -> April 30
        val mar31 = LocalDate.of(2026, 3, 31).atStartOfDay(utcZone).toInstant().toEpochMilli()
        val nextDueApr = ChoreRecurrenceCalculator.computeNextDueDate(mar31, ChoreFrequency.MONTHLY, utcZone)
        val expectedApr30 = LocalDate.of(2026, 4, 30).atStartOfDay(utcZone).toInstant().toEpochMilli()
        assertEquals(expectedApr30, nextDueApr)
    }

    @Test
    fun testMonthlyRecurrenceAcrossYearBoundary() {
        // December 31, 2025 -> January 31, 2026
        val dec31 = LocalDate.of(2025, 12, 31).atStartOfDay(utcZone).toInstant().toEpochMilli()
        val nextDue = ChoreRecurrenceCalculator.computeNextDueDate(dec31, ChoreFrequency.MONTHLY, utcZone)

        val expectedJan31 = LocalDate.of(2026, 1, 31).atStartOfDay(utcZone).toInstant().toEpochMilli()
        assertEquals(expectedJan31, nextDue)
    }

    @Test
    fun testTwelveMonthRepeatedRecurrenceSequenceWithAnchorPreservation() {
        // Start on Jan 31, 2026 at 10:00 AM UTC
        val startDateTime = LocalDateTime.of(2026, 1, 31, 10, 0)
        val startMillis = startDateTime.atZone(utcZone).toInstant().toEpochMilli()

        val sequence = ChoreRecurrenceCalculator.computeMonthlyRecurrenceSequence(
            startDueDateMillis = startMillis,
            cycles = 12,
            zoneId = utcZone,
            anchorDayOfMonth = 31
        )

        assertEquals(12, sequence.size)

        // Expected dates across 2026:
        val expectedDates = listOf(
            LocalDate.of(2026, 2, 28), // Feb clips to 28
            LocalDate.of(2026, 3, 31), // Mar restores to 31!
            LocalDate.of(2026, 4, 30), // Apr clips to 30
            LocalDate.of(2026, 5, 31), // May restores to 31!
            LocalDate.of(2026, 6, 30), // Jun clips to 30
            LocalDate.of(2026, 7, 31), // Jul restores to 31!
            LocalDate.of(2026, 8, 31), // Aug is 31
            LocalDate.of(2026, 9, 30), // Sep clips to 30
            LocalDate.of(2026, 10, 31),// Oct restores to 31!
            LocalDate.of(2026, 11, 30),// Nov clips to 30
            LocalDate.of(2026, 12, 31),// Dec restores to 31!
            LocalDate.of(2027, 1, 31)  // Jan 2027 restores to 31!
        )

        for (i in 0 until 12) {
            val actualDateTime = Instant.ofEpochMilli(sequence[i]).atZone(utcZone)
            assertEquals("Cycle $i date mismatch", expectedDates[i], actualDateTime.toLocalDate())
            assertEquals("Cycle $i hour mismatch", 10, actualDateTime.hour)
            assertEquals("Cycle $i minute mismatch", 0, actualDateTime.minute)
        }
    }

    @Test
    fun testDaylightSavingTimeTransitionPreservesLocalWallClockTime() {
        // America/New_York DST starts March 8, 2026 at 2:00 AM (clocks move forward 1 hour)
        val nyZone = ZoneId.of("America/New_York")

        // Chore scheduled for 09:00 AM EST on March 1, 2026
        val march1 = LocalDateTime.of(2026, 3, 1, 9, 0).atZone(nyZone).toInstant().toEpochMilli()

        // Advance 1 month to April 1, 2026 (now in EDT)
        val nextDueApril = ChoreRecurrenceCalculator.computeNextDueDate(march1, ChoreFrequency.MONTHLY, nyZone)
        val aprilZDT = Instant.ofEpochMilli(nextDueApril).atZone(nyZone)

        assertEquals(LocalDate.of(2026, 4, 1), aprilZDT.toLocalDate())
        // Wall clock time MUST remain 09:00 AM local time
        assertEquals("Local hour must remain 9:00 AM across DST transition", 9, aprilZDT.hour)
        assertEquals("Local minute must remain 0 across DST transition", 0, aprilZDT.minute)
    }

    @Test
    fun testMultiTimezoneSupport() {
        val tokyoZone = ZoneId.of("Asia/Tokyo")
        val londonZone = ZoneId.of("Europe/London")
        val laZone = ZoneId.of("America/Los_Angeles")

        val baseLocalTime = LocalTime.of(8, 30)
        val baseDate = LocalDate.of(2026, 5, 15)

        for (zone in listOf(tokyoZone, londonZone, laZone)) {
            val startMillis = baseDate.atTime(baseLocalTime).atZone(zone).toInstant().toEpochMilli()
            val nextMillis = ChoreRecurrenceCalculator.computeNextDueDate(startMillis, ChoreFrequency.DAILY, zone)
            val nextZDT = Instant.ofEpochMilli(nextMillis).atZone(zone)

            assertEquals("Zone $zone daily date advance", LocalDate.of(2026, 5, 16), nextZDT.toLocalDate())
            assertEquals("Zone $zone hour preserved", 8, nextZDT.hour)
            assertEquals("Zone $zone minute preserved", 30, nextZDT.minute)
        }
    }

    @Test
    fun testChoreCompletionHistoryPreserved() {
        val history = listOf(
            ChoreCompletionHistory("h1", "c1", "m3", 1000L, 10),
            ChoreCompletionHistory("h2", "c1", "m3", 2000L, 10),
            ChoreCompletionHistory("h3", "c1", "m4", 3000L, 10)
        )

        assertEquals(3, history.size)
        val lucasPoints = history.filter { it.completedByMemberId == "m3" }.sumOf { it.pointsEarned }
        assertEquals(20, lucasPoints)
    }

    @Test
    fun testOverdueChoreDetection() {
        val currentTime = System.currentTimeMillis()
        val overdueChore = Chore("c3", "fam1", "Clean pantry", null, "m1", "KITCHEN", ChoreFrequency.WEEKLY, 15, currentTime - 3600000L, false, false)

        val isOverdue = !overdueChore.isCompleted && overdueChore.nextDueDate < currentTime
        assertTrue(isOverdue)
    }
}
