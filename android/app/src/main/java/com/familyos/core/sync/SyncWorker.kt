package com.familyos.core.sync

import android.content.Context
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import com.familyos.FamilyOSApplication
import com.familyos.core.database.SyncQueueEntity
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.TimeUnit

/**
 * HTTP Remote Sync Gateway connecting Android Room offline queue to the shared FamilyOS backend (/api/v1/sync/push).
 */
class HttpRemoteSyncGateway(
    private val endpointUrlProvider: () -> String?,
    private val authTokenProvider: suspend () -> String? = { null }
) : RemoteSyncGateway {

    override suspend fun dispatch(
        operation: SyncQueueEntity,
        conflictPolicy: ConflictPolicy
    ): Result<RemoteSyncAck> = withContext(Dispatchers.IO) {
        val baseUrl = endpointUrlProvider()?.trimEnd('/')
        if (baseUrl.isNullOrBlank()) {
            return@withContext Result.failure(IllegalStateException("REMOTE_BACKEND_URL_NOT_CONFIGURED"))
        }

        val bearerToken = authTokenProvider()
        if (bearerToken.isNullOrBlank()) {
            return@withContext Result.failure(IllegalStateException("AUTH_BEARER_TOKEN_MISSING"))
        }

        var connection: HttpURLConnection? = null
        try {
            val url = URL("$baseUrl/api/v1/sync/push")
            connection = (url.openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
                connectTimeout = 10_000
                readTimeout = 10_000
                doOutput = true
                setRequestProperty("Content-Type", "application/json; charset=UTF-8")
                setRequestProperty("Authorization", "Bearer $bearerToken")
                setRequestProperty("X-Idempotency-Key", operation.idempotencyKey)
            }

            val bodyJson = """
                {
                  "operationId": "${escapeJson(operation.operationId)}",
                  "idempotencyKey": "${escapeJson(operation.idempotencyKey)}",
                  "familyId": "${escapeJson(operation.familyId)}",
                  "entityType": "${escapeJson(operation.entityType)}",
                  "entityId": "${escapeJson(operation.entityId)}",
                  "operationType": "${escapeJson(operation.operationType)}",
                  "conflictPolicy": "${conflictPolicy.name}",
                  "payloadJson": ${operation.payloadJson.ifBlank { "{}" }}
                }
            """.trimIndent()

            OutputStreamWriter(connection.outputStream, Charsets.UTF_8).use { writer ->
                writer.write(bodyJson)
                writer.flush()
            }

            val responseCode = connection.responseCode
            if (responseCode in 200..299) {
                Result.success(
                    RemoteSyncAck(
                        operationId = operation.operationId,
                        idempotencyKey = operation.idempotencyKey,
                        acknowledged = true,
                        serverTimestamp = System.currentTimeMillis()
                    )
                )
            } else if (responseCode == 403) {
                val errBody = connection.errorStream?.bufferedReader(Charsets.UTF_8)?.use { it.readText() } ?: ""
                val isRevoked = errBody.contains("MEMBERSHIP_REVOKED")
                Result.success(
                    RemoteSyncAck(
                        operationId = operation.operationId,
                        idempotencyKey = operation.idempotencyKey,
                        acknowledged = false,
                        errorCode = if (isRevoked) "MEMBERSHIP_REVOKED" else "PERMISSION_DENIED",
                        errorMessage = if (isRevoked) "MEMBERSHIP_REVOKED" else "HTTP_403_FORBIDDEN"
                    )
                )
            } else {
                Result.failure(IllegalStateException("HTTP_$responseCode"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        } finally {
            connection?.disconnect()
        }
    }

    suspend fun pullDeltaJson(familyId: String, sinceTimestamp: Long): Result<String> = withContext(Dispatchers.IO) {
        val baseUrl = endpointUrlProvider()?.trimEnd('/')
        if (baseUrl.isNullOrBlank()) {
            return@withContext Result.failure(IllegalStateException("REMOTE_BACKEND_URL_NOT_CONFIGURED"))
        }
        val bearerToken = authTokenProvider()
        if (bearerToken.isNullOrBlank()) {
            return@withContext Result.failure(IllegalStateException("AUTH_BEARER_TOKEN_MISSING"))
        }

        var connection: HttpURLConnection? = null
        try {
            val url = URL("$baseUrl/api/v1/sync/pull?familyId=${escapeJson(familyId)}&sinceTimestamp=$sinceTimestamp")
            connection = (url.openConnection() as HttpURLConnection).apply {
                requestMethod = "GET"
                connectTimeout = 10_000
                readTimeout = 10_000
                setRequestProperty("Authorization", "Bearer $bearerToken")
            }
            val responseCode = connection.responseCode
            if (responseCode in 200..299) {
                val body = connection.inputStream.bufferedReader(Charsets.UTF_8).use { it.readText() }
                Result.success(body)
            } else {
                Result.failure(IllegalStateException("HTTP_$responseCode"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        } finally {
            connection?.disconnect()
        }
    }

    private fun escapeJson(value: String): String {
        return value.replace("\\", "\\\\").replace("\"", "\\\"")
    }
}

/**
 * WorkManager background worker that drains the pending sync_queue with network constraints and exponential backoff.
 */
class SyncWorker(
    appContext: Context,
    workerParams: WorkerParameters
) : CoroutineWorker(appContext, workerParams) {

    override suspend fun doWork(): Result {
        val app = applicationContext as? FamilyOSApplication ?: return Result.failure()
        val syncResult = app.syncRepository.processPendingQueue()
        return syncResult.fold(
            onSuccess = { Result.success() },
            onFailure = { Result.retry() }
        )
    }

    companion object {
        private const val PERIODIC_WORK_NAME = "familyos_periodic_sync_worker"
        private const val IMMEDIATE_WORK_NAME = "familyos_immediate_sync_worker"

        fun schedulePeriodicSync(context: Context) {
            val constraints = Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build()

            val request = PeriodicWorkRequestBuilder<SyncWorker>(15, TimeUnit.MINUTES)
                .setConstraints(constraints)
                .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
                .build()

            WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                PERIODIC_WORK_NAME,
                ExistingPeriodicWorkPolicy.KEEP,
                request
            )
        }

        fun enqueueImmediateSync(context: Context) {
            val constraints = Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build()

            val request = OneTimeWorkRequestBuilder<SyncWorker>()
                .setConstraints(constraints)
                .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 15, TimeUnit.SECONDS)
                .build()

            WorkManager.getInstance(context).enqueueUniqueWork(
                IMMEDIATE_WORK_NAME,
                ExistingWorkPolicy.REPLACE,
                request
            )
        }
    }
}
