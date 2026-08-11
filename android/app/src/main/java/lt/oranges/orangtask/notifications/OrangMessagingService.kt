package lt.oranges.orangtask.notifications

import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import dagger.hilt.android.AndroidEntryPoint
import lt.oranges.orangtask.R
import javax.inject.Inject

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
            title = data["title"] ?: message.notification?.title ?: getString(R.string.app_name),
            body = data["body"] ?: message.notification?.body.orEmpty(),
        )
    }
}
