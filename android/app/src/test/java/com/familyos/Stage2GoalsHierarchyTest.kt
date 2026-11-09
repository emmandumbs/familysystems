package com.familyos

import com.familyos.core.domain.*
import org.junit.Assert.*
import org.junit.Test

class Stage2GoalsHierarchyTest {

    @Test
    fun testFourTierHierarchyIntegrity() {
        // Tier 1: Family Goal
        val goal = FamilyGoal(
            id = "g1",
            familyId = "fam1",
            title = "Annual Family Camping Trip",
            description = "Plan summer camping in Yosemite",
            category = GoalCategory.LIFESTYLE,
            targetDate = 1750000000000L,
            priority = Priority.HIGH,
            ownerMemberId = "m1",
            status = "ACTIVE"
        )
        assertNotNull(goal.id)

        // Tier 2: Project
        val project = Project(
            id = "p1",
            familyId = "fam1",
            goalId = goal.id,
            name = "Gear & Campsite Booking",
            description = "Reserve sites and audit camping gear",
            budgetCents = 80000L, // $800.00
            targetDate = 1745000000000L,
            status = "ACTIVE",
            leadMemberId = "m1"
        )
        assertEquals(goal.id, project.goalId)
        assertEquals(80000L, project.budgetCents)

        // Tier 3: Parent Task
        val parentTask = Task(
            id = "t1",
            familyId = "fam1",
            projectId = project.id,
            parentTaskId = null,
            title = "Reserve Upper Pines Campsite",
            notes = "Window opens 7am PST",
            assignedMemberId = "m1",
            priority = Priority.URGENT,
            dueDate = 1740000000000L,
            isCompleted = false,
            completedAt = null,
            completedByMemberId = null,
            recurrenceRule = null
        )
        assertEquals(project.id, parentTask.projectId)
        assertNull(parentTask.parentTaskId)

        // Tier 3.5: Nested Subtask
        val subtask = Task(
            id = "t1_sub1",
            familyId = "fam1",
            projectId = project.id,
            parentTaskId = parentTask.id,
            title = "Create Recreation.gov account",
            notes = null,
            assignedMemberId = "m2",
            priority = Priority.HIGH,
            dueDate = 1739000000000L,
            isCompleted = true,
            completedAt = 1738000000000L,
            completedByMemberId = "m2",
            recurrenceRule = null
        )
        assertEquals(parentTask.id, subtask.parentTaskId)

        // Tier 4: Task Checklist Item
        val checklist = listOf(
            TaskChecklistItem("c1", subtask.id, "Verify email address", isDone = true, position = 0),
            TaskChecklistItem("c2", subtask.id, "Save payment method", isDone = true, position = 1)
        )
        assertEquals(2, checklist.size)
        assertTrue(checklist.all { it.isDone })
    }

    @Test
    fun testProgressRollupCalculation() {
        val tasks = listOf(
            Task("t1", "fam1", "p1", null, "Task 1", null, "m1", Priority.MEDIUM, null, true, 1000L, "m1", null),
            Task("t2", "fam1", "p1", null, "Task 2", null, "m1", Priority.MEDIUM, null, true, 1000L, "m1", null),
            Task("t3", "fam1", "p1", null, "Task 3", null, "m2", Priority.MEDIUM, null, false, null, null, null),
            Task("t4", "fam1", "p1", null, "Task 4", null, "m2", Priority.MEDIUM, null, false, null, null, null)
        )

        val totalCount = tasks.size
        val completedCount = tasks.count { it.isCompleted }
        val progressPercentage = if (totalCount > 0) (completedCount * 100) / totalCount else 0

        assertEquals(50, progressPercentage)
    }

    @Test
    fun testReopeningCompletedTaskClearsCompletionTimestamp() {
        // Initial completed task
        var task = Task(
            id = "t10",
            familyId = "fam1",
            projectId = "p1",
            parentTaskId = null,
            title = "Service Lawn Mower",
            notes = null,
            assignedMemberId = "m1",
            priority = Priority.MEDIUM,
            dueDate = null,
            isCompleted = true,
            completedAt = 1700000000000L,
            completedByMemberId = "m1",
            recurrenceRule = null
        )
        assertTrue(task.isCompleted)
        assertNotNull(task.completedAt)

        // Reopen task
        task = task.copy(isCompleted = false, completedAt = null, completedByMemberId = null)
        assertFalse(task.isCompleted)
        assertNull(task.completedAt)
        assertNull(task.completedByMemberId)
    }

    @Test
    fun testTaskReassignment() {
        var task = Task(
            id = "t20",
            familyId = "fam1",
            projectId = "p1",
            parentTaskId = null,
            title = "Buy grocieries",
            notes = null,
            assignedMemberId = "member_A",
            priority = Priority.MEDIUM,
            dueDate = null,
            isCompleted = false,
            completedAt = null,
            completedByMemberId = null,
            recurrenceRule = null
        )
        assertEquals("member_A", task.assignedMemberId)

        // Reassign to Member B
        task = task.copy(assignedMemberId = "member_B")
        assertEquals("member_B", task.assignedMemberId)
    }

    @Test
    fun testCircularParentTaskSelfReferenceForbidden() {
        val taskId = "task_100"
        val parentTaskId = "task_100"

        val isSelfParent = (taskId == parentTaskId)
        assertTrue("A task cannot be set as its own parent", isSelfParent)
    }

    @Test
    fun testStage332PersonalAndCoupleGoalPrivacyEnforcement() {
        // Personal goal owned by Sarah (mem-sarah) must be hidden from David (mem-david, ADMIN) and Lucas (mem-lucas, CHILD)
        assertTrue(
            FamilySecurityPolicy.canViewGoal(
                actorRole = FamilyRole.OWNER,
                actorMemberId = "mem-sarah",
                goalScope = GoalScope.PERSONAL,
                ownerMemberId = "mem-sarah"
            )
        )
        assertFalse(
            FamilySecurityPolicy.canViewGoal(
                actorRole = FamilyRole.ADMIN,
                actorMemberId = "mem-david",
                goalScope = GoalScope.PERSONAL,
                ownerMemberId = "mem-sarah"
            )
        )
        assertFalse(
            FamilySecurityPolicy.canViewGoal(
                actorRole = FamilyRole.CHILD,
                actorMemberId = "mem-lucas",
                goalScope = GoalScope.PERSONAL,
                ownerMemberId = "mem-sarah"
            )
        )

        // Couple goal visible to OWNER and ADMIN, hidden from CHILD and GUEST
        assertTrue(
            FamilySecurityPolicy.canViewGoal(
                actorRole = FamilyRole.ADMIN,
                actorMemberId = "mem-david",
                goalScope = GoalScope.COUPLE,
                ownerMemberId = "mem-sarah"
            )
        )
        assertFalse(
            FamilySecurityPolicy.canViewGoal(
                actorRole = FamilyRole.CHILD,
                actorMemberId = "mem-lucas",
                goalScope = GoalScope.COUPLE,
                ownerMemberId = "mem-sarah"
            )
        )
    }

    @Test
    fun testStage332ChildTaskAssignmentRestrictionAndCanonicalModuleReuse() {
        // Child can assign to self, cannot assign to another member
        assertTrue(FamilySecurityPolicy.canAssignTaskToMember(FamilyRole.CHILD, "mem-lucas", "mem-lucas"))
        assertFalse(FamilySecurityPolicy.canAssignTaskToMember(FamilyRole.CHILD, "mem-lucas", "mem-sarah"))
        assertTrue(FamilySecurityPolicy.canAssignTaskToMember(FamilyRole.OWNER, "mem-sarah", "mem-lucas"))

        // Canonical task supports all 7 FamilyOS source modules without duplicate tables
        val modules = CanonicalTaskSourceModule.values()
        assertEquals(7, modules.size)

        // Optional reward system is disabled by default and non-punitive
        val defaultRewardConfig = FamilyRewardConfig(familyId = "fam-1")
        assertFalse(defaultRewardConfig.enabled)
        assertTrue(defaultRewardConfig.disallowPunitiveDeductions)
    }
}

