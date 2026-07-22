import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { secureHeaders } from 'hono/secure-headers'
import { logger } from 'hono/logger'
import { createBunWebSocket, serveStatic } from 'hono/bun'
import type { ServerWebSocket } from 'bun'
import { getCookie } from 'hono/cookie'
import { runMigrations } from './db/client.js'
import type { AppEnv } from './types.js'
import sql from './db/client.js'
import { addClient, removeClient } from './ws/pubsub.js'
import { startDueSoonJob } from './services/notifications.js'

import authRoutes from './routes/auth.js'
import listsRoutes from './routes/lists.js'
import tasksRoutes from './routes/tasks.js'
import tagsRoutes from './routes/tags.js'
import notificationsRoutes from './routes/notifications.js'
import searchRoutes from './routes/search.js'
import userRoutes from './routes/user.js'
import pushRoutes from './routes/push.js'
import apiKeysRoutes from './routes/apiKeys.js'
import { webhooks as webhookRoutes } from './routes/webhooks.js'
import webhookIncoming from './routes/webhooks.js'

const app = new Hono<AppEnv>()

const { upgradeWebSocket, websocket } = createBunWebSocket<ServerWebSocket>()

const APP_URL = process.env.APP_URL || 'http://localhost:5173'

app.use('*', cors({
  origin: [APP_URL, 'http://localhost:5173', 'http://localhost:3000'],
  credentials: true,
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}))

app.use('*', secureHeaders())
app.use('*', logger())

app.route('/api/auth', authRoutes)
app.route('/api/lists', listsRoutes)
app.route('/api/tasks', tasksRoutes)
app.route('/api/tags', tagsRoutes)
app.route('/api/notifications', notificationsRoutes)
app.route('/api/search', searchRoutes)
app.route('/api/user', userRoutes)
app.route('/api/push', pushRoutes)
app.route('/api/webhooks', webhookRoutes)
app.route('/api/api-keys', apiKeysRoutes)

// incoming webhook (public) provides POST /api/hooks/:token
app.route('/api', webhookIncoming)

app.get('/ws', upgradeWebSocket(async (c) => {
  const token = getCookie(c, 'session') || c.req.query('token')

  let userId: string | null = null

  if (token) {
    const [session] = await sql`
      SELECT user_id FROM sessions WHERE token = ${token} AND expires_at > now()
    `
    if (session) userId = session.user_id
  }

  const client: { userId: string; send: (data: string) => void } | null = userId
    ? { userId, send: () => {} }
    : null

  return {
    onOpen(_evt: Event, ws: { send: (d: string) => void; close: (code?: number, reason?: string) => void }) {
      if (!client) {
        ws.close(1008, 'Unauthorized')
        return
      }
      client.send = (data: string) => ws.send(data)
      addClient(client)
      ws.send(JSON.stringify({ type: 'connected', userId }))
    },
    onMessage(evt: MessageEvent, ws: { send: (d: string) => void }) {
      try {
        const msg = JSON.parse(evt.data as string)
        if (msg.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong' }))
        }
      } catch {}
    },
    onClose() {
      if (client) removeClient(client)
    },
    onError() {
      if (client) removeClient(client)
    },
  }
}))

app.get('/health', (c) => c.json({ ok: true, ts: new Date().toISOString() }))

// serve the built frontend (production)
if (process.env.NODE_ENV === 'production') {
  app.use('/assets/*', serveStatic({ root: './public' }))
  app.use('/icons/*', serveStatic({ root: './public' }))
  app.get('/favicon.ico', serveStatic({ path: './public/favicon.ico' }))
  app.get('/manifest.webmanifest', serveStatic({ path: './public/manifest.webmanifest' }))
  app.get('/sw.js', serveStatic({ path: './public/sw.js' }))
  app.get('/registerSW.js', serveStatic({ path: './public/registerSW.js' }))
  app.get('*', serveStatic({ path: './public/index.html' }))
}

const PORT = parseInt(process.env.PORT || '3001')

await runMigrations()
console.log('Migrations complete')

startDueSoonJob()

console.log(`OrangTask backend running on http://localhost:${PORT}`)

export default {
  port: PORT,
  fetch: app.fetch,
  websocket,
}
