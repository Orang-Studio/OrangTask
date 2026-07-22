import { createSign } from 'crypto'
import sql from '../db/client.js'
import type { PushPayload } from './push.js'

// firebase Cloud Messaging (HTTP v1) for native Android push
const PROJECT_ID = process.env.FCM_PROJECT_ID || ''
const CLIENT_EMAIL = process.env.FCM_CLIENT_EMAIL || ''
const PRIVATE_KEY = (process.env.FCM_PRIVATE_KEY || '').replace(/\\n/g, '\n')

export const fcmConfigured = !!(PROJECT_ID && CLIENT_EMAIL && PRIVATE_KEY)

export async function saveDeviceToken(userId: string, token: string, platform = 'android') {
  await sql`
    INSERT INTO device_tokens (user_id, token, platform)
    VALUES (${userId}, ${token}, ${platform})
    ON CONFLICT (token)
    DO UPDATE SET user_id = ${userId}, platform = ${platform}, last_seen_at = now()
  `
}

export async function removeDeviceToken(token: string) {
  await sql`DELETE FROM device_tokens WHERE token = ${token}`
}

export async function deviceTokenCount(userId: string): Promise<number> {
  const [row] = await sql`SELECT count(*)::int AS n FROM device_tokens WHERE user_id = ${userId}`
  return row?.n ?? 0
}

// --- OAuth2 access token minted from the service account, cached ~55 min ---
let cachedToken: { value: string; expiresAt: number } | null = null

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
}

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value

  const now = Math.floor(Date.now() / 1000)
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claim = base64url(JSON.stringify({
    iss: CLIENT_EMAIL,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }))
  const unsigned = `${header}.${claim}`
  const signature = base64url(createSign('RSA-SHA256').update(unsigned).sign(PRIVATE_KEY))
  const jwt = `${unsigned}.${signature}`

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  })
  const data = await res.json() as { access_token?: string; expires_in?: number }
  if (!data.access_token) throw new Error('FCM token exchange failed')
  cachedToken = { value: data.access_token, expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000 }
  return data.access_token
}

export async function sendFcm(userId: string, payload: PushPayload) {
  if (!fcmConfigured) return
  const tokens = await sql`SELECT token FROM device_tokens WHERE user_id = ${userId}`
  if (tokens.length === 0) return

  let accessToken: string
  try {
    accessToken = await getAccessToken()
  } catch (err) {
    console.error('FCM auth error:', err)
    return
  }

  // data-only message: the app builds the notification (with Mark done / Snooze action buttons) in
  const data: Record<string, string> = {
    title: payload.title,
    body: payload.body ?? '',
    type: payload.type ?? '',
    url: payload.url ?? '',
  }
  if (payload.taskId) data.task_id = payload.taskId
  if (payload.notificationId) data.notification_id = payload.notificationId

  const url = `https://fcm.googleapis.com/v1/projects/${PROJECT_ID}/messages:send`
  await Promise.all(tokens.map(async (t) => {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: { token: t.token, data, android: { priority: 'high' } } }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as any
        const code = body?.error?.details?.[0]?.errorCode || body?.error?.status
        // stale/invalid registration token drop it so we stop trying
        if (res.status === 404 || code === 'UNREGISTERED' || code === 'INVALID_ARGUMENT') {
          await sql`DELETE FROM device_tokens WHERE token = ${t.token}`.catch(() => {})
        } else {
          console.error('FCM send failed:', res.status, JSON.stringify(body))
        }
      }
    } catch (err) {
      console.error('FCM send error:', err)
    }
  }))
}
