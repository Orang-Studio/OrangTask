package lt.oranges.orangtask.notifications

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import lt.oranges.orangtask.MainActivity
import lt.oranges.orangtask.R

/** builds the system notifications shown for FCM pushes */
object AppNotifications {
    const val CHANNEL_ID = "orangtask_reminders"

    const val ACTION_DONE = "lt.oranges.orangtask.action.MARK_DONE"
    const val ACTION_SNOOZE = "lt.oranges.orangtask.action.SNOOZE"
    const val EXTRA_TASK_ID = "task_id"
    const val EXTRA_NOTIF_ID = "notif_id"

    // backend notification types that carry a task and therefore get buttons
    private val TASK_TYPES = setOf("task_due_soon", "task_assigned", "task_completed_by", "task_reminder")

    fun ensureChannel(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val mgr = context.getSystemService(NotificationManager::class.java) ?: return
        if (mgr.getNotificationChannel(CHANNEL_ID) != null) return
        mgr.createNotificationChannel(
            NotificationChannel(CHANNEL_ID, "Reminders", NotificationManager.IMPORTANCE_HIGH).apply {
                description = "Task reminders and updates"
            }
        )
    }

    fun show(context: Context, type: String, taskId: String?, title: String, body: String) {
        ensureChannel(context)
        val notifId = (taskId ?: title).hashCode()

        val builder = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setContentIntent(openIntent(context, taskId))

        if (taskId != null && type in TASK_TYPES) {
            builder.addAction(0, "Mark done", actionIntent(context, ACTION_DONE, taskId, notifId))
            builder.addAction(0, "Snooze 1h", actionIntent(context, ACTION_SNOOZE, taskId, notifId))
        }

        if (canPost(context)) {
            NotificationManagerCompat.from(context).notify(notifId, builder.build())
        }
    }

    private fun canPost(context: Context): Boolean =
        Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) ==
            PackageManager.PERMISSION_GRANTED

    private fun openIntent(context: Context, taskId: String?): PendingIntent {
        val intent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
            if (taskId != null) putExtra(EXTRA_TASK_ID, taskId)
        }
        return PendingIntent.getActivity(
            context, taskId.hashCode(), intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
    }

    private fun actionIntent(context: Context, action: String, taskId: String, notifId: Int): PendingIntent {
        val intent = Intent(context, NotificationActionReceiver::class.java).apply {
            this.action = action
            putExtra(EXTRA_TASK_ID, taskId)
            putExtra(EXTRA_NOTIF_ID, notifId)
        }
        // distinct request code per (action, task) so extras arent collapsed
        return PendingIntent.getBroadcast(
            context, (action + taskId).hashCode(), intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
    }
}
