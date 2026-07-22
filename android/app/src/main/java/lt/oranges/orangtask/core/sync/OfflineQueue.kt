package lt.oranges.orangtask.core.sync

import android.content.Context
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import lt.oranges.orangtask.core.db.PendingOpDao
import lt.oranges.orangtask.core.db.PendingOpEntity
import lt.oranges.orangtask.core.db.TaskDao
import lt.oranges.orangtask.core.db.toEntity
import lt.oranges.orangtask.core.network.OrangApi
import lt.oranges.orangtask.core.network.TaskDto
import retrofit2.HttpException
import java.io.IOException
import java.util.concurrent.TimeUnit
import javax.inject.Inject
import javax.inject.Singleton

/** durable offline mutation queue frontend/src/stores/offline.ts, but backed by Room and replayed by */
@Singleton
class OfflineQueue @Inject constructor(
    private val dao: PendingOpDao,
    private val taskDao: TaskDao,
    private val api: OrangApi,
    private val json: Json,
    @ApplicationContext private val context: Context,
) {
    /** one replay at a time: the worker and the sync coordinator both call in */
    private val replayLock = Mutex()

    suspend fun enqueue(method: String, path: String, body: JsonObject? = null, tempId: String? = null) {
        dao.insert(
            PendingOpEntity(
                method = method,
                path = path,
                body = body?.toString(),
                tempId = tempId,
                createdAt = System.currentTimeMillis(),
            )
        )
        schedule()
    }

    suspend fun hasPending(): Boolean = dao.count() > 0

    /** hands the queue to WorkManager: runs when connected, retries with backoff */
    fun schedule() {
        val request = OneTimeWorkRequestBuilder<ReplayWorker>()
            .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 10, TimeUnit.SECONDS)
            .build()
        WorkManager.getInstance(context)
            .enqueueUniqueWork("offline-replay", ExistingWorkPolicy.KEEP, request)
    }

    /** replays every queued op in order */
    suspend fun replayAll(): Boolean = replayLock.withLock {
        var drained = true
        while (true) {
            val op = dao.oldest() ?: break
            try {
                val response = execute(op)
                if (op.tempId != null) adoptServerId(op.tempId, response)
                dao.delete(op.id)
            } catch (e: IOException) {
                drained = false
                break
            } catch (e: HttpException) {
                if (e.code() == 429 || e.code() >= 500) {
                    drained = false
                    break
                }
                dao.delete(op.id)
            }
        }
        drained
    }

    private suspend fun execute(op: PendingOpEntity): JsonObject {
        val body = op.body
            ?.let { runCatching { json.parseToJsonElement(it).jsonObject }.getOrNull() }
            ?: JsonObject(emptyMap())
        return when (op.method) {
            "POST" -> api.replayPost(op.path, body)
            "PATCH" -> api.replayPatch(op.path, body)
            "DELETE" -> api.replayDelete(op.path)
            else -> JsonObject(emptyMap())
        }
    }

    /** a queued create came back with the servers row: swap the local draft for it and rewrite any later */
    private suspend fun adoptServerId(tempId: String, response: JsonObject) {
        val task = response["task"] as? JsonObject ?: return
        val realId = task["id"]?.jsonPrimitive?.contentOrNull ?: return
        dao.replaceId(tempId, realId)
        taskDao.deleteById(tempId)
        taskDao.remapParent(tempId, realId)
        runCatching { json.decodeFromJsonElement(TaskDto.serializer(), task) }.getOrNull()
            ?.let { taskDao.upsert(it.toEntity()) }
    }
}
