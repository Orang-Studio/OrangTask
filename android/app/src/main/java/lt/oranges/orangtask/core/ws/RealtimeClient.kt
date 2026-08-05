package lt.oranges.orangtask.core.ws

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.launch
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import lt.oranges.orangtask.BuildConfig
import lt.oranges.orangtask.core.network.TokenStore
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import java.util.concurrent.TimeUnit
import javax.inject.Inject
import javax.inject.Singleton
import kotlin.math.min
import kotlin.math.pow

sealed interface RealtimeSignal {

    data class Event(val message: JsonObject) : RealtimeSignal

    data object Connected : RealtimeSignal

    data object Unauthorized : RealtimeSignal
}

@Singleton
class RealtimeClient @Inject constructor(
    private val tokenStore: TokenStore,
) {

    private val client = OkHttpClient.Builder()
        .pingInterval(25, TimeUnit.SECONDS)
        .build()

    private val json = Json { ignoreUnknownKeys = true }

    private val _signals = MutableSharedFlow<RealtimeSignal>(extraBufferCapacity = 64)
    val signals: SharedFlow<RealtimeSignal> = _signals

    private var scope: CoroutineScope? = null
    private var socket: WebSocket? = null
    private var reconnectJob: Job? = null
    private var attempts = 0

    fun start(scope: CoroutineScope) {
        this.scope = scope
        attempts = 0
        connect()
    }

    fun stop() {
        scope = null
        reconnectJob?.cancel()
        reconnectJob = null
        socket?.close(1000, null)
        socket = null
    }

    fun reconnectNow() {
        if (scope == null) return
        attempts = 0
        socket?.close(1000, null)
        socket = null
        connect()
    }

    private fun connect() {
        val activeScope = scope ?: return
        val token = tokenStore.accessToken ?: return

        val base = BuildConfig.API_BASE_URL.trimEnd('/')

        val request = Request.Builder()
            .url("$base/ws")
            .header("Authorization", "Bearer $token")
            .build()

        socket = client.newWebSocket(request, object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                attempts = 0
                _signals.tryEmit(RealtimeSignal.Connected)
            }

            override fun onMessage(webSocket: WebSocket, text: String) {
                val message = runCatching {
                    json.parseToJsonElement(text) as? JsonObject
                }.getOrNull() ?: return
                _signals.tryEmit(RealtimeSignal.Event(message))
            }

            override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                if (webSocket !== socket) return
                if (code == 1008) {
                    _signals.tryEmit(RealtimeSignal.Unauthorized)
                } else {
                    scheduleReconnect(activeScope)
                }
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                if (webSocket !== socket) return
                if (response?.code == 401) {
                    _signals.tryEmit(RealtimeSignal.Unauthorized)
                } else {
                    scheduleReconnect(activeScope)
                }
            }
        })
    }

    private fun scheduleReconnect(activeScope: CoroutineScope) {
        if (scope !== activeScope) return
        val delayMs = min(1000.0 * 2.0.pow(attempts), 30_000.0).toLong()
        attempts++
        reconnectJob?.cancel()
        reconnectJob = activeScope.launch {
            delay(delayMs)
            if (scope === activeScope) connect()
        }
    }
}
