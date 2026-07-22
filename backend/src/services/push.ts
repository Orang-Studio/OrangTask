import webpush from 'web-push'
import sql from '../db/client.js'

const PUBLIC = process.env.VAPID_PUBLIC_KEY || ''
const PRIVATE = process.env.VAPID_PRIVATE_KEY || ''
const SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@oranges.lt'

export const pushConfigured = !!(PUBLIC && PRIVATE)
if (pushConfigured) {
  webpush.setVapidDetails(SUBJECT, PUBLIC, PRIVATE)
}

export const vapidPublicKey = PUBLIC

interface BrowserSubscription {
  endpoint: string
  keys: { p256dh: string; auth: string }
}

export async function saveSubscription(userId: string, sub: BrowserSubscription) {
  await sql`
    INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
    VALUES (${userId}, ${sub.endpoint}, ${sub.keys.p256dh}, ${sub.keys.auth})
    ON CONFLICT (endpoint)
    DO UPDATE SET user_id = ${userId}, p256dh = ${sub.keys.p256dh}, auth = ${sub.keys.auth}
  `
}

export async function removeSubscription(endpoint: string) {
  await sql`DELETE FROM push_subscriptions WHERE endpoint = ${endpoint}`
}

export interface PushPayload {
  title: string
  body?: string
  url?: string
  type?: string
  // native (FCM) extras so the app can build action buttons and deep-link
  taskId?: string
  notificationId?: string
}

export async function sendWebPush(userId: string, payload: PushPayload) {
  if (!pushConfigured) return
  const subs = await sql`SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ${userId}`
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(payload)
        )
      } catch (err: any) {
        // subscription expired/gone clean it up
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          await sql`DELETE FROM push_subscriptions WHERE endpoint = ${s.endpoint}`.catch(() => {})
        } else {
          console.error('web-push send failed:', err?.statusCode, err?.body || err?.message)
        }
      }
    })
  )
}
