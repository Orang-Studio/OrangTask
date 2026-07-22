import { Hono } from 'hono'
import sql from '../db/client.js'
import { authMiddleware } from '../middleware/auth.js'
import { vapidPublicKey, saveSubscription, removeSubscription, sendWebPush, pushConfigured } from '../services/push.js'
import { fcmConfigured, saveDeviceToken, removeDeviceToken, deviceTokenCount, sendFcm } from '../services/fcm.js'
import type { AppEnv } from '../types.js'

const app = new Hono<AppEnv>()

// public the client needs this to subscribe
app.get('/public-key', (c) => c.json({ key: vapidPublicKey }))

app.post('/subscribe', authMiddleware, async (c) => {
  const userId = c.get('userId')
  const sub = await c.req.json()
  if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) {
    return c.json({ error: 'Invalid subscription' }, 400)
  }
  await saveSubscription(userId, sub)
  return c.json({ ok: true })
})

app.post('/unsubscribe', authMiddleware, async (c) => {
  const { endpoint } = await c.req.json().catch(() => ({}))
  if (endpoint) await removeSubscription(endpoint)
  return c.json({ ok: true })
})

// native (Android/FCM) registration token the app posts its token here
app.post('/device', authMiddleware, async (c) => {
  const userId = c.get('userId')
  const { token, platform } = await c.req.json().catch(() => ({}))
  if (!token) return c.json({ error: 'Missing token' }, 400)
  await saveDeviceToken(userId, token, platform || 'android')
  return c.json({ ok: true })
})

app.delete('/device', authMiddleware, async (c) => {
  const { token } = await c.req.json().catch(() => ({}))
  if (token) await removeDeviceToken(token)
  return c.json({ ok: true })
})

// send a test push to all of this users subscribed devices (web + native)
app.post('/test', authMiddleware, async (c) => {
  const userId = c.get('userId')
  const [row] = await sql`SELECT count(*)::int AS n FROM push_subscriptions WHERE user_id = ${userId}`
  const subscriptions = row?.n ?? 0
  const devices = await deviceTokenCount(userId)
  const payload = {
    title: 'OrangTask',
    body: 'Test notification, push is working.',
    url: '/today',
    type: 'test',
  }
  if (pushConfigured && subscriptions > 0) await sendWebPush(userId, payload)
  if (fcmConfigured && devices > 0) await sendFcm(userId, payload)
  return c.json({
    ok: true,
    configured: pushConfigured,
    fcmConfigured,
    subscriptions,
    devices,
  })
})

export default app
