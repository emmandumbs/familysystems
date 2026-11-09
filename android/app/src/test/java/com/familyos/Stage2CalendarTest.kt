package com.familyos

import com.familyos.core.domain.CalendarEvent
import com.familyos.core.domain.CalendarEventCategory
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class Stage2CalendarTest {

    @Test
    fun testEventChronologicalOrdering() {
        val events = listOf(
            CalendarEvent("e3", "fam1", "Event Day 3", 3000L, null, CalendarEventCategory.MEAL, null, null),
            CalendarEvent("e1", "fam1", "Event Day 1", 1000L, null, CalendarEventCategory.BIRTHDAY, null, null),
            CalendarEvent("e2", "fam1", "Event Day 2", 2000L, null, CalendarEventCategory.MAINTENANCE, null, null)
        )

        val sorted = events.sortedBy { it.eventDate }
        assertEquals("e1", sorted[0].id)
        assertEquals("e2", sorted[1].id)
        assertEquals("e3", sorted[2].id)
    }

    @Test
    fun testCategoryFiltering() {
        val events = listOf(
            CalendarEvent("e1", "fam1", "Mom's Birthday", 1000L, null, CalendarEventCategory.BIRTHDAY, null, null),
            CalendarEvent("e2", "fam1", "Pasta Dinner", 2000L, null, CalendarEventCategory.MEAL, null, null),
            CalendarEvent("e3", "fam1", "HVAC Filter Wash", 3000L, null, CalendarEventCategory.MAINTENANCE, null, null),
            CalendarEvent("e4", "fam1", "Dad's Birthday", 4000L, null, CalendarEventCategory.BIRTHDAY, null, null)
        )

        val birthdays = events.filter { it.category == CalendarEventCategory.BIRTHDAY }
        assertEquals(2, birthdays.size)
        assertTrue(birthdays.all { it.category == CalendarEventCategory.BIRTHDAY })
    }
}
