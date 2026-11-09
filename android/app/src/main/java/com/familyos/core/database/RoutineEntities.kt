package com.familyos.core.database

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.PrimaryKey

/**
 * 40. Canonical Routine Definition Entity
 * Durably stored in encrypted Room database (v4+).
 * Represents household and personal recurring rhythms.
 */
@Entity(
    tableName = "routines",
    foreignKeys = [
        ForeignKey(
            entity = FamilyWorkspaceEntity::class,
            parentColumns = ["id"],
            childColumns = ["family_id"],
            onDelete = ForeignKey.CASCADE
        )
    ],
    indices = [
        Index(value = ["family_id"]),
        Index(value = ["category"]),
        Index(value = ["is_paused"])
    ]
)
data class RoutineEntity(
    @PrimaryKey
    val id: String,
    @ColumnInfo(name = "family_id")
    val familyId: String,
    val title: String,
    val description: String? = null,
    val category: String = "HOUSEHOLD", // MORNING, EVENING, HOUSEHOLD, MARRIAGE, PARENTING, SPIRITUAL, PERSONAL, WORK
    val frequency: String = "DAILY", // DAILY, WEEKDAYS, WEEKENDS, WEEKLY, BIWEEKLY, MONTHLY, CUSTOM
    @ColumnInfo(name = "target_time_of_day")
    val targetTimeOfDay: String = "08:00",
    val scope: String = "FAMILY", // FAMILY, COUPLE, PERSONAL
    @ColumnInfo(name = "owner_member_id")
    val ownerMemberId: String = "",
    @ColumnInfo(name = "assigned_member_ids_json")
    val assignedMemberIdsJson: String = "[]",
    @ColumnInfo(name = "steps_json")
    val stepsJson: String = "[]",
    @ColumnInfo(name = "points_reward")
    val pointsReward: Int = 15,
    @ColumnInfo(name = "is_paused")
    val isPaused: Boolean = false,
    @ColumnInfo(name = "streak_count")
    val streakCount: Int = 0,
    @ColumnInfo(name = "best_streak_count")
    val bestStreakCount: Int = 0,
    @ColumnInfo(name = "last_completed_date")
    val lastCompletedDate: String? = null,
    @ColumnInfo(name = "created_at")
    val createdAt: Long = System.currentTimeMillis(),
    @ColumnInfo(name = "updated_at")
    val updatedAt: Long = System.currentTimeMillis()
)

/**
 * 41. Decoupled Routine Occurrence Entity
 * Durably stored in encrypted Room database (v4+).
 * Tracks individual daily/instance executions independently of the routine definition.
 */
@Entity(
    tableName = "routine_occurrences",
    foreignKeys = [
        ForeignKey(
            entity = FamilyWorkspaceEntity::class,
            parentColumns = ["id"],
            childColumns = ["family_id"],
            onDelete = ForeignKey.CASCADE
        ),
        ForeignKey(
            entity = RoutineEntity::class,
            parentColumns = ["id"],
            childColumns = ["routine_id"],
            onDelete = ForeignKey.CASCADE
        )
    ],
    indices = [
        Index(value = ["family_id"]),
        Index(value = ["routine_id", "target_date"], unique = true),
        Index(value = ["target_date"]),
        Index(value = ["status"])
    ]
)
data class RoutineOccurrenceEntity(
    @PrimaryKey
    val id: String, // e.g. "occ-{routineId}-{targetDate}"
    @ColumnInfo(name = "family_id")
    val familyId: String,
    @ColumnInfo(name = "routine_id")
    val routineId: String,
    @ColumnInfo(name = "target_date")
    val targetDate: String, // "YYYY-MM-DD"
    val status: String = "PENDING", // PENDING, IN_PROGRESS, COMPLETED, SKIPPED
    @ColumnInfo(name = "step_completions_json")
    val stepCompletionsJson: String = "{}", // JSON map: {"stepId": true}
    @ColumnInfo(name = "completed_at")
    val completedAt: Long? = null,
    @ColumnInfo(name = "completed_by_member_id")
    val completedByMemberId: String? = null,
    @ColumnInfo(name = "skipped_reason")
    val skippedReason: String? = null,
    @ColumnInfo(name = "points_awarded")
    val pointsAwarded: Int = 0,
    @ColumnInfo(name = "linked_task_id")
    val linkedTaskId: String? = null,
    @ColumnInfo(name = "created_at")
    val createdAt: Long = System.currentTimeMillis(),
    @ColumnInfo(name = "updated_at")
    val updatedAt: Long = System.currentTimeMillis()
)
