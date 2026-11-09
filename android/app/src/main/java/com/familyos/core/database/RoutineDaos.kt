package com.familyos.core.database

import androidx.room.*
import kotlinx.coroutines.flow.Flow

/**
 * Data Access Object for Routines and Routine Occurrences.
 * Provides reactive Room Flows for real-time offline-first UI updates.
 */
@Dao
interface RoutineDao {

    // --- Routine Definitions ---

    @Query("SELECT * FROM routines WHERE family_id = :familyId ORDER BY target_time_of_day ASC")
    fun observeRoutines(familyId: String): Flow<List<RoutineEntity>>

    @Query("SELECT * FROM routines WHERE id = :id LIMIT 1")
    suspend fun getRoutineById(id: String): RoutineEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertRoutine(routine: RoutineEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertRoutines(routines: List<RoutineEntity>)

    @Update
    suspend fun updateRoutine(routine: RoutineEntity)

    @Query("UPDATE routines SET is_paused = :isPaused, updated_at = :updatedAt WHERE id = :routineId")
    suspend fun setRoutinePaused(routineId: String, isPaused: Boolean, updatedAt: Long = System.currentTimeMillis())

    @Query("UPDATE routines SET streak_count = :streak, best_streak_count = :bestStreak, last_completed_date = :lastDate, updated_at = :updatedAt WHERE id = :routineId")
    suspend fun updateRoutineStreak(routineId: String, streak: Int, bestStreak: Int, lastDate: String, updatedAt: Long = System.currentTimeMillis())

    @Query("DELETE FROM routines WHERE id = :id")
    suspend fun deleteRoutine(id: String)

    // --- Routine Occurrences ---

    @Query("SELECT * FROM routine_occurrences WHERE family_id = :familyId AND target_date = :targetDate ORDER BY created_at ASC")
    fun observeOccurrencesForDate(familyId: String, targetDate: String): Flow<List<RoutineOccurrenceEntity>>

    @Query("SELECT * FROM routine_occurrences WHERE family_id = :familyId ORDER BY target_date DESC")
    fun observeAllOccurrences(familyId: String): Flow<List<RoutineOccurrenceEntity>>

    @Query("SELECT * FROM routine_occurrences WHERE id = :id LIMIT 1")
    suspend fun getOccurrenceById(id: String): RoutineOccurrenceEntity?

    @Query("SELECT * FROM routine_occurrences WHERE routine_id = :routineId AND target_date = :targetDate LIMIT 1")
    suspend fun getOccurrenceForRoutineDate(routineId: String, targetDate: String): RoutineOccurrenceEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertOccurrence(occurrence: RoutineOccurrenceEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertOccurrences(occurrences: List<RoutineOccurrenceEntity>)

    @Update
    suspend fun updateOccurrence(occurrence: RoutineOccurrenceEntity)

    @Query("UPDATE routine_occurrences SET status = :status, step_completions_json = :stepsJson, completed_at = :completedAt, completed_by_member_id = :memberId, points_awarded = :points, updated_at = :updatedAt WHERE id = :occurrenceId")
    suspend fun markOccurrenceCompleted(
        occurrenceId: String,
        status: String = "COMPLETED",
        stepsJson: String,
        completedAt: Long,
        memberId: String,
        points: Int,
        updatedAt: Long = System.currentTimeMillis()
    )

    @Query("UPDATE routine_occurrences SET status = 'SKIPPED', skipped_reason = :reason, updated_at = :updatedAt WHERE id = :occurrenceId")
    suspend fun markOccurrenceSkipped(occurrenceId: String, reason: String, updatedAt: Long = System.currentTimeMillis())

    @Query("UPDATE routine_occurrences SET linked_task_id = :taskId, updated_at = :updatedAt WHERE id = :occurrenceId")
    suspend fun setOccurrenceLinkedTaskId(occurrenceId: String, taskId: String, updatedAt: Long = System.currentTimeMillis())

    @Query("DELETE FROM routine_occurrences WHERE id = :id")
    suspend fun deleteOccurrence(id: String)
}
