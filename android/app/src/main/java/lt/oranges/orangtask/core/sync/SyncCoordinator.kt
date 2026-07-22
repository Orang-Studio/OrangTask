package lt.oranges.orangtask.core.sync

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonPrimitive
import lt.oranges.orangtask.auth.AuthRepository
import lt.oranges.orangtask.core.network.TaskDto
import lt.oranges.orangtask.core.ws.RealtimeClient
import lt.oranges.orangtask.core.ws.RealtimeSignal
import lt.oranges.orangtask.lists.ListRepository
import lt.oranges.orangtask.tasks.TaskRepository
import javax.inject.Inject
import javax.inject.Singleton

/** keeps Room in step with the server while the app is in the foreground: a full refresh on every */
@Singleton
class SyncCoordinator @Inject constructor(
    private val taskRepository: TaskRepository,
    private val listRepository: ListRepository,
    private val realtime: RealtimeClient,
    private val authRepository: AuthRepository,
    private val offlineQueue: OfflineQueue,
    private val json: Json,
) {
    private var scope: CoroutineScope? = null
    private var refreshJob: Job? = null

    fun start() {
        if (scope != null) return
        val s = CoroutineScope(SupervisorJob() + Dispatchers.IO)
        scope = s

        s.launch {
            realtime.signals.collect { signal ->
                when (signal) {
                    is RealtimeSignal.Connected -> runCatching { fullRefresh() }
                    is RealtimeSignal.Event -> handleEvent(signal.message)
                    is RealtimeSignal.Unauthorized -> {
                        // force a token refresh through the authenticator, then retry
                        runCatching { authRepository.me() }
                        realtime.reconnectNow()
                    }
                }
            }
        }

        // refresh immediately even if the socket takes a while (or fails) to open
        s.launch { runCatching { fullRefresh() } }
        realtime.start(s)
    }

    fun stop() {
        realtime.stop()
        refreshJob = null
        scope?.cancel()
        scope = null
    }

    suspend fun fullRefresh() {
        // unsent offline mutations go out first, otherwise the refresh would overwrite their optimistic Room
        if (offlineQueue.hasPending() && !offlineQueue.replayAll()) {
            // still offline: leave Room as-is, WorkManager retries the queue
            return
        }
        coroutineScope {
            launch { listRepository.refreshLists() }
            launch { listRepository.refreshTags() }
            launch { taskRepository.refreshAllTasks() }
        }
    }

    private suspend fun handleEvent(message: JsonObject) {
        val type = message["type"]?.jsonPrimitive?.contentOrNull ?: return
        val data = message["data"] as? JsonObject

        when (type) {
            "task.deleted" -> {
                data?.get("id")?.jsonPrimitive?.contentOrNull
                    ?.let { runCatching { taskRepository.deleteLocal(it) } }
                scheduleRefresh()
            }
            "task.created", "task.updated" -> {
                // tag-change broadcasts only carry {id}; those fall through to the debounced refresh
                val dto = data?.let {
                    runCatching { json.decodeFromJsonElement(TaskDto.serializer(), it) }.getOrNull()
                }
                if (dto != null) runCatching { taskRepository.upsertFromServer(dto) }
                scheduleRefresh()
            }
            "list.updated", "list.deleted" -> scheduleRefresh()
            // "connected", "pong", "notification.new" (Phase 3) nothing to do
        }
    }

    private fun scheduleRefresh() {
        val s = scope ?: return
        refreshJob?.cancel()
        refreshJob = s.launch {
            delay(500)
            runCatching { fullRefresh() }
        }
    }
}
