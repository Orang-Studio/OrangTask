package lt.oranges.orangtask.notifications

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

/** registers this devices FCM token with the backend so it can receive push */
@Singleton
class PushRegistrar @Inject constructor(
    private val api: OrangApi,
    private val tokenStore: TokenStore,
) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    /** fetch the current token and register it call once the user is signed in */
    fun register() {
        if (!tokenStore.hasSession) return
        runCatching {
            FirebaseMessaging.getInstance().token.addOnSuccessListener { token ->
                if (!token.isNullOrBlank()) send(token)
            }
        }
    }

    /** FCM rotated the token (OrangMessagingService.onNewToken) */
    fun onNewToken(token: String) {
        if (tokenStore.hasSession && token.isNotBlank()) send(token)
    }

    /** best-effort removal on sign-out so a shared device stops getting pushes */
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
        scope.launch { runCatching { api.registerDevice(DeviceTokenRequest(token)) } }
    }
}
