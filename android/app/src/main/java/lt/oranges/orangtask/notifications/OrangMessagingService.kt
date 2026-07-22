package lt.oranges.orangtask.notifications

import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import dagger.hilt.android.AndroidEntryPoint
import javax.inject.Inject

/** receives FCM pushes The backend sends data-only messages so we build the notification here */
@AndroidEntryPoint
class OrangMessagingService : FirebaseMessagingService() {

    @Inject lateinit var pushRegistrar: PushRegistrar

    override fun onNewToken(token: String) {
        pushRegistrar.onNewToken(token)
    }

    override fun onMessageReceived(message: RemoteMessage) {
        val data = message.data
        AppNotifications.show(
            context = this,
            type = data["type"].orEmpty(),
            taskId = data["task_id"],
            title = data["title"] ?: message.notification?.title ?: "OrangTask",
            body = data["body"] ?: message.notification?.body.orEmpty(),
        )
    }
}
