package com.familyos.core.sync

import com.familyos.core.database.SyncQueueDao
import com.familyos.core.database.SyncQueueEntity
import com.familyos.core.domain.SyncOperation
import com.familyos.core.domain.SyncRepository
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.withContext

/**
 * Domain-specific Conflict Resolution Policy
 */
enum class ConflictPolicy {
    EVENT_BASED_MERGE,    // Tasks, checklists: Merge checked items additively
    APPEND_ONLY_LEDGER,   // Financial transactions: Never overwrite; adjustments only
    SERVER_AUTHORITATIVE, // Membership & roles: Server rules decide
    TOMBSTONE_SOFT_DELETE // Deletions: Flag is_deleted=1 and propagate
}

/**
 * Explicit server acknowledgement required before any queued operation can be removed from local storage.
 */
data class RemoteSyncAck(
    val operationId: String,
    val idempotencyKey: String,
    val acknowledged: Boolean,
    val serverTimestamp: Long = System.currentTimeMillis(),
    val errorCode: String? = null,
    val errorMessage: String? = null
)

data class RemoteSyncDeltaEntity(
    val id: String,
    val familyId: String,
    val entityType: String,
    val version: Int,
    val isDeleted: Boolean,
    val updatedAt: Long,
    val payloadJson: String
)

/**
 * Contract for dispatching queued offline mutations to the authoritative remote backend.
 */
fun interface RemoteSyncGateway {
    suspend fun dispatch(operation: SyncQueueEntity, conflictPolicy: ConflictPolicy): Result<RemoteSyncAck>
}

class SyncRepositoryImpl(
    private val syncQueueDao: SyncQueueDao,
    private val remoteGateway: RemoteSyncGateway? = null,
    private val ioDispatcher: CoroutineDispatcher = Dispatchers.IO
) : SyncRepository {

    override fun observePendingSyncCount(): Flow<Int> {
        return syncQueueDao.observePendingCount()
    }

    override suspend fun enqueue(operation: SyncOperation): Result<Unit> = withContext(ioDispatcher) {
        try {
            val entity = SyncQueueEntity(
                operationId = operation.operationId,
                idempotencyKey = operation.idempotencyKey,
                familyId = operation.familyId,
                entityType = operation.entityType,
                entityId = operation.entityId,
                operationType = operation.operationType,
                payloadJson = operation.payloadJson,
                retryState = "PENDING"
            )
            val rowId = syncQueueDao.enqueueOperation(entity)
            if (rowId == -1L) {
                // Idempotency check: Already enqueued with this idempotency key
                Result.success(Unit)
            } else {
                Result.success(Unit)
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Drains pending operations FIFO ONLY when verified remote acknowledgement is received.
     * CRITICAL SAFETY INVARIANT: Never dequeue an operation without a verified server acknowledgement.
     * If server reports MEMBERSHIP_REVOKED, marks the operation as QUARANTINED_REVOKED so background
     * workers stop retrying unauthorized mutations.
     */
    override suspend fun processPendingQueue(): Result<Int> = withContext(ioDispatcher) {
        try {
            val pending = syncQueueDao.getPendingOperations(batchSize = 25)
                .filter { it.retryState != "QUARANTINED_REVOKED" }
            if (pending.isEmpty()) {
                return@withContext Result.success(0)
            }

            val gateway = remoteGateway
            if (gateway == null) {
                for (op in pending) {
                    syncQueueDao.updateOperationAttempt(
                        queueId = op.queueId,
                        state = "FAILED",
                        error = "REMOTE_GATEWAY_NOT_CONFIGURED"
                    )
                }
                return@withContext Result.success(0)
            }

            var processed = 0
            for (op in pending) {
                val policy = resolveConflictPolicy(op.entityType)
                val dispatchResult = gateway.dispatch(op, policy)

                dispatchResult.fold(
                    onSuccess = { ack ->
                        if (ack.acknowledged && ack.idempotencyKey == op.idempotencyKey) {
                            syncQueueDao.dequeueOperation(op.queueId)
                            processed++
                        } else if (ack.errorCode == "MEMBERSHIP_REVOKED") {
                            syncQueueDao.updateOperationAttempt(
                                queueId = op.queueId,
                                state = "QUARANTINED_REVOKED",
                                error = ack.errorMessage ?: "MEMBERSHIP_REVOKED"
                            )
                        } else {
                            syncQueueDao.updateOperationAttempt(
                                queueId = op.queueId,
                                state = "FAILED",
                                error = ack.errorMessage ?: "UNACKNOWLEDGED_BY_SERVER"
                            )
                        }
                    },
                    onFailure = { error ->
                        val msg = error.message ?: "NETWORK_DISPATCH_ERROR"
                        val nextState = if (msg.contains("MEMBERSHIP_REVOKED")) "QUARANTINED_REVOKED" else "FAILED"
                        syncQueueDao.updateOperationAttempt(
                            queueId = op.queueId,
                            state = nextState,
                            error = msg
                        )
                    }
                )
            }

            Result.success(processed)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    companion object {
        fun resolveConflictPolicy(entityType: String): ConflictPolicy {
            return when (entityType.uppercase()) {
                "TASK", "CHECKLIST_ITEM", "CHORE" -> ConflictPolicy.EVENT_BASED_MERGE
                "INCOME", "EXPENSE", "FINANCIAL_ACCOUNT", "TRANSFER", "REVERSAL", "ENVELOPE_BUDGET" -> ConflictPolicy.APPEND_ONLY_LEDGER
                "FAMILY_MEMBERSHIP", "INVITATION", "GUARDIAN_RELATIONSHIP" -> ConflictPolicy.SERVER_AUTHORITATIVE
                else -> ConflictPolicy.TOMBSTONE_SOFT_DELETE
            }
        }
    }
}
