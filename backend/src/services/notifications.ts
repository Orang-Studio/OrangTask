import sql from '../db/client.js'
import { publishToUser } from '../ws/pubsub.js'
import { sendNotificationEmail } from './email.js'
import { sendWebPush } from './push.js'
import { sendFcm } from './fcm.js'
import { resolvePrefs } from './notificationPrefs.js'

export async function createNotification(
  userId: string,
  type: string,
  title: string,
  body?: string,
  metadata?: Record<string, unknown>
) {
  const [notif] = await sql`
    INSERT INTO notifications (user_id, type, title, body, metadata)
    VALUES (${userId}, ${type}, ${title}, ${body ?? null}, ${metadata ? sql.json(metadata as never) : null})
    RETURNING *
  `

  // in-app / real-time is always delivered; push + email follow the users prefs
  publishToUser(userId, { type: 'notification.new', data: notif }).catch(() => {})

  try {
    const [u] = await sql`SELECT email, notification_prefs FROM users WHERE id = ${userId}`
    const pref = resolvePrefs(u?.notification_prefs)[type] || { push: true, email: false }
    const url = metadata?.task_id ? '/today' : '/'
    const taskId = metadata?.task_id ? String(metadata.task_id) : undefined
    if (pref.push) {
      sendWebPush(userId, { title, body, url, type }).catch(() => {})
      sendFcm(userId, { title, body, url, type, taskId, notificationId: notif.id }).catch(() => {})
    }
    if (pref.email && u?.email) sendNotificationEmail(u.email, title, body).catch(() => {})
  } catch (err) {
    console.error('Notification channel dispatch error:', err)
  }

  return notif
}

export async function startDueSoonJob() {
  const check = async () => {
    try {
      const tasks = await sql`
        SELECT t.*, u.email, u.id as user_id_field
        FROM tasks t
        JOIN users u ON u.id = t.assigned_to OR u.id = t.created_by
        WHERE t.due_date BETWEEN now() AND now() + interval '1 hour 5 minutes'
          AND t.status != 'done'
          AND NOT EXISTS (
            SELECT 1 FROM notifications n
            WHERE n.user_id = u.id
              AND n.type = 'task_due_soon'
              AND (n.metadata->>'task_id')::text = t.id::text
              AND n.created_at > now() - interval '2 hours'
          )
      `

      for (const task of tasks) {
        // createNotification now handles email + push per the users prefs
        await createNotification(
          task.user_id_field,
          'task_due_soon',
          `Task due soon: ${task.title}`,
          `Due at ${new Date(task.due_date).toLocaleTimeString()}`,
          { task_id: task.id }
        )
      }
    } catch (err) {
      console.error('Due-soon job error:', err)
    }
  }

  await check()
  setInterval(check, 5 * 60 * 1000)
}
