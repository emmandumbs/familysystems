package com.familyos

import com.familyos.core.database.SyncQueueDao
import com.familyos.core.database.SyncQueueEntity
import com.familyos.core.domain.SyncOperation
import com.familyos.core.sync.ConflictPolicy
import com.familyos.core.sync.RemoteSyncAck
import com.familyos.core.sync.RemoteSyncGateway
import com.familyos.core.sync.SyncRepositoryImpl
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.util.UUID

class SyncPolicyAndIdempotencyTest {

    private class FakeSyncQueueDao : SyncQueueDao {
        private val items = mutableListOf<SyncQueueEntity>()
        private var nextQueueId = 1L
        private val stateFlow = MutableStateFlow<List<SyncQueueEntity>>(emptyList())

        fun allItems(): List<SyncQueueEntity> = items.toList()

        override suspend fun getPendingOperations(batchSize: Int): List<SyncQueueEntity> {
            return items.filter { it.retryState != "SUCCESS" }
                .sortedBy { it.createdAt }
                .take(batchSize)
        }

        override suspend fun enqueueOperation(operation: SyncQueueEntity): Long {
            if (items.any { it.idempotencyKey == operation.idempotencyKey }) {
                return -1L
            }
            val assigned = operation.copy(queueId = nextQueueId++)
            items.add(assigned)
            stateFlow.value = items.toList()
            return assigned.queueId
        }

        override suspend fun updateOperationAttempt(
            queueId: Long,
            state: String,
            error: String?,
            timestamp: Long
        ) {
            val index = items.indexOfFirst { it.queueId == queueId }
            if (index >= 0) {
                val current = items[index]
                items[index] = current.copy(
                    attemptCount = current.attemptCount + 1,
                    lastAttemptAt = timestamp,
                    retryState = state,
                    lastError = error
                )
                stateFlow.value = items.toList()
            }
        }

        override suspend fun dequeueOperation(queueId: Long) {
            items.removeAll { it.queueId == queueId }
            stateFlow.value = items.toList()
        }

        override fun observePendingCount(): Flow<Int> {
            return stateFlow.map { list -> list.count { it.retryState != "SUCCESS" } }
        }
    }

    @Test
    fun testConflictPolicyResolution() {
        assertEquals(ConflictPolicy.EVENT_BASED_MERGE, SyncRepositoryImpl.resolveConflictPolicy("TASK"))
        assertEquals(ConflictPolicy.EVENT_BASED_MERGE, SyncRepositoryImpl.resolveConflictPolicy("CHECKLIST_ITEM"))

        assertEquals(ConflictPolicy.APPEND_ONLY_LEDGER, SyncRepositoryImpl.resolveConflictPolicy("INCOME"))
        assertEquals(ConflictPolicy.APPEND_ONLY_LEDGER, SyncRepositoryImpl.resolveConflictPolicy("EXPENSE"))
        assertEquals(ConflictPolicy.APPEND_ONLY_LEDGER, SyncRepositoryImpl.resolveConflictPolicy("FINANCIAL_ACCOUNT"))

        assertEquals(ConflictPolicy.SERVER_AUTHORITATIVE, SyncRepositoryImpl.resolveConflictPolicy("FAMILY_MEMBERSHIP"))
        assertEquals(ConflictPolicy.TOMBSTONE_SOFT_DELETE, SyncRepositoryImpl.resolveConflictPolicy("RECIPE"))
    }

    @Test
    fun testIdempotencyDeduplicationInSyncQueue() = runTest {
        val dao = FakeSyncQueueDao()
        val repository = SyncRepositoryImpl(syncQueueDao = dao, remoteGateway = null)

        val op = SyncOperation(
            operationId = "op-1",
            idempotencyKey = "EXPENSE:tx-100:INSERT",
            familyId = "fam-1",
            entityType = "EXPENSE",
            entityId = "tx-100",
            operationType = "INSERT",
            payloadJson = """{"amountCents":4500}"""
        )

        repository.enqueue(op)
        repository.enqueue(op.copy(operationId = "op-2")) // Duplicate idempotencyKey

        assertEquals(1, dao.allItems().size)
    }

    @Test
    fun testUnacknowledgedOperationsAreNeverDeletedFromQueue() = runTest {
        val dao = FakeSyncQueueDao()
        val repositoryWithoutGateway = SyncRepositoryImpl(syncQueueDao = dao, remoteGateway = null)

        val op = SyncOperation(
            operationId = "op-unacked",
            idempotencyKey = "GOAL:goal-1:INSERT",
            familyId = "fam-1",
            entityType = "GOAL",
            entityId = "goal-1",
            operationType = "INSERT",
            payloadJson = """{"title":"Emergency Fund"}"""
        )
        repositoryWithoutGateway.enqueue(op)

        val processedCount = repositoryWithoutGateway.processPendingQueue().getOrThrow()
        assertEquals(0, processedCount)

        val remaining = dao.allItems()
        assertEquals("Operation must NOT be dequeued without server ack", 1, remaining.size)
        assertEquals(1, remaining[0].attemptCount)
        assertEquals("FAILED", remaining[0].retryState)
        assertEquals("REMOTE_GATEWAY_NOT_CONFIGURED", remaining[0].lastError)
    }

    @Test
    fun testVerifiedRemoteAcknowledgementDequeuesOperation() = runTest {
        val dao = FakeSyncQueueDao()
        val gateway = RemoteSyncGateway { queuedOp, _ ->
            Result.success(
                RemoteSyncAck(
                    operationId = queuedOp.operationId,
                    idempotencyKey = queuedOp.idempotencyKey,
                    acknowledged = true
                )
            )
        }
        val repository = SyncRepositoryImpl(syncQueueDao = dao, remoteGateway = gateway)

        val op = SyncOperation(
            operationId = "op-acked",
            idempotencyKey = "CHORE:chore-1:UPDATE",
            familyId = "fam-1",
            entityType = "CHORE",
            entityId = "chore-1",
            operationType = "UPDATE",
            payloadJson = """{"completed":true}"""
        )
        repository.enqueue(op)

        val processedCount = repository.processPendingQueue().getOrThrow()
        assertEquals(1, processedCount)
        assertTrue("Queue must be empty after verified server ack", dao.allItems().isEmpty())
    }

    @Test
    fun testMembershipRevocationQuarantinesPendingOperation() = runTest {
        val dao = FakeSyncQueueDao()
        val gateway = RemoteSyncGateway { queuedOp, _ ->
            Result.success(
                RemoteSyncAck(
                    operationId = queuedOp.operationId,
                    idempotencyKey = queuedOp.idempotencyKey,
                    acknowledged = false,
                    errorCode = "MEMBERSHIP_REVOKED",
                    errorMessage = "MEMBERSHIP_REVOKED"
                )
            )
        }
        val repository = SyncRepositoryImpl(syncQueueDao = dao, remoteGateway = gateway)

        val op = SyncOperation(
            operationId = "op-revoked",
            idempotencyKey = "TASK:task-99:UPDATE",
            familyId = "fam-1",
            entityType = "TASK",
            entityId = "task-99",
            operationType = "UPDATE",
            payloadJson = """{"isCompleted":true}"""
        )
        repository.enqueue(op)

        val processedCount = repository.processPendingQueue().getOrThrow()
        assertEquals(0, processedCount)
        val items = dao.allItems()
        assertEquals(1, items.size)
        assertEquals("QUARANTINED_REVOKED", items[0].retryState)
    }
}
