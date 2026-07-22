package lt.oranges.orangtask.notifications

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.core.app.NotificationManagerCompat
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import lt.oranges.orangtask.tasks.TaskRepository
import java.time.Instant
import java.time.temporal.ChronoUnit
import javax.inject.Inject

/** runs the notification action buttons in the background */
@AndroidEntryPoint
class NotificationActionReceiver : BroadcastReceiver() {

    @Inject lateinit var taskRepo: TaskRepository

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    override fun onReceive(context: Context, intent: Intent) {
        val taskId = intent.getStringExtra(AppNotifications.EXTRA_TASK_ID) ?: return
        val notifId = intent.getIntExtra(AppNotifications.EXTRA_NOTIF_ID, 0)
        val action = intent.action
        val pending = goAsync()
        scope.launch {
            try {
                when (action) {
                    AppNotifications.ACTION_DONE -> taskRepo.setCompleted(taskId, true)
                    AppNotifications.ACTION_SNOOZE ->
                        taskRepo.setDueDate(taskId, Instant.now().plus(1, ChronoUnit.HOURS))
                }
            } catch (_: Exception) {
                // setCompleted/setDueDate already queue on network failure; a hard error here just means no local
            } finally {
                NotificationManagerCompat.from(context).cancel(notifId)
                pending.finish()
            }
        }
    }
}
