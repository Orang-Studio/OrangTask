package lt.oranges.orangtask.notifications

import android.util.Log
import com.google.firebase.messaging.FirebaseMessaging
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import lt.oranges.orangtask.core.network.DeviceTokenRequest
import lt.oranges.orangtask.core.network.OrangApi
import lt.oranges.orangtask.core.network.TokenStore
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class PushRegistrar @Inject constructor(
    private val api: OrangApi,
    private val tokenStore: TokenStore,
) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    fun register() {
        if (!tokenStore.hasSession) return
        runCatching {
            FirebaseMessaging.getInstance().token.addOnSuccessListener { token ->
                if (!token.isNullOrBlank()) send(token)
            }.addOnFailureListener { error ->
                Log.w("PushRegistrar", "Failed to obtain Firebase device token", error)
            }
        }.onFailure { error ->
            Log.w("PushRegistrar", "Firebase push initialization failed", error)
        }
    }

    fun onNewToken(token: String) {
        if (tokenStore.hasSession && token.isNotBlank()) send(token)
    }

    fun unregister() {
        runCatching {
            FirebaseMessaging.getInstance().token.addOnSuccessListener { token ->
                if (!token.isNullOrBlank()) {
                    scope.launch { runCatching { api.unregisterDevice(DeviceTokenRequest(token)) } }
                }
            }
        }
    }

    private fun send(token: String) {
        scope.launch {
            runCatching { api.registerDevice(DeviceTokenRequest(token)) }
                .onFailure { error -> Log.w("PushRegistrar", "Device token registration failed", error) }
        }
    }
}
