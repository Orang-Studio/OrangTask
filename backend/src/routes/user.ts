import { Hono } from 'hono'
import sql from '../db/client.js'
import { authMiddleware } from '../middleware/auth.js'
import { resolvePrefs } from '../services/notificationPrefs.js'
import { importKeepNotes, type KeepNote } from '../services/keepImport.js'
import { publishToUser } from '../ws/pubsub.js'
import type { AppEnv } from '../types.js'

const app = new Hono<AppEnv>()
app.use('*', authMiddleware)

app.patch('/', async (c) => {
  const userId = c.get('userId')
  const { name, avatar_url } = await c.req.json()

  const [user] = await sql`
    UPDATE users SET
      name = COALESCE(${name ?? null}, name),
      avatar_url = COALESCE(${avatar_url ?? null}, avatar_url),
      updated_at = now()
    WHERE id = ${userId}
    RETURNING id, email, name, avatar_url, created_at
  `
  return c.json({ user })
})

app.delete('/', async (c) => {
  const userId = c.get('userId')
  const { email } = await c.req.json()

  const user = c.get('user')
  if (email.toLowerCase() !== user.email.toLowerCase()) {
    return c.json({ error: 'Email does not match' }, 400)
  }

  await sql`DELETE FROM users WHERE id = ${userId}`
  return c.json({ ok: true })
})

app.get('/export', async (c) => {
  const userId = c.get('userId')

  const [user] = await sql`SELECT id, email, name, avatar_url, created_at FROM users WHERE id = ${userId}`
  const lists = await sql`SELECT * FROM lists WHERE owner_id = ${userId}`
  const tasks = await sql`
    SELECT t.* FROM tasks t
    JOIN lists l ON l.id = t.list_id
    WHERE l.owner_id = ${userId}
  `
  const tags = await sql`SELECT * FROM tags WHERE owner_id = ${userId}`
  const webhooks = await sql`SELECT id, name, url, direction, events, enabled, created_at FROM webhooks WHERE user_id = ${userId}`

  c.header('Content-Disposition', 'attachment; filename="orangtask-export.json"')
  c.header('Content-Type', 'application/json')

  return c.body(JSON.stringify({ user, lists, tasks, tags, webhooks }, null, 2))
})

app.post('/pin', async (c) => {
  const userId = c.get('userId')
  const { pin } = await c.req.json()

  if (!pin || !/^\d{4,6}$/.test(pin)) {
    return c.json({ error: 'PIN must be 4-6 digits' }, 400)
  }

  const { scryptSync, randomBytes } = await import('crypto')
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(pin, salt, 64).toString('hex')
  const pin_hash = `${salt}:${hash}`

  await sql`UPDATE users SET pin_hash = ${pin_hash} WHERE id = ${userId}`
  return c.json({ ok: true })
})

app.delete('/pin', async (c) => {
  const userId = c.get('userId')
  await sql`UPDATE users SET pin_hash = null WHERE id = ${userId}`
  return c.json({ ok: true })
})

app.get('/pin/status', async (c) => {
  const userId = c.get('userId')
  const [user] = await sql`SELECT pin_hash IS NOT NULL as has_pin FROM users WHERE id = ${userId}`
  return c.json({ has_pin: user.has_pin })
})

// import notes from a Google Keep (Google Takeout) export
app.post('/import/google-keep', async (c) => {
  const userId = c.get('userId')
  const body = await c.req.json().catch(() => ({}))
  const notes: KeepNote[] = Array.isArray(body?.notes) ? body.notes : []

  if (notes.length === 0) return c.json({ error: 'No notes to import' }, 400)
  if (notes.length > 5000) return c.json({ error: 'Too many notes (max 5000 per import)' }, 400)

  const result = await importKeepNotes(userId, notes, {
    listName: body?.listName,
    includeArchived: body?.includeArchived,
    includeTrashed: body?.includeTrashed,
  })

  // nudge connected clients to refetch so the new list/tasks appear live
  publishToUser(userId, { type: 'list.updated', data: { id: result.list.id } }).catch(() => {})

  return c.json(result)
})

app.get('/notification-prefs', async (c) => {
  const userId = c.get('userId')
  const [user] = await sql`SELECT notification_prefs FROM users WHERE id = ${userId}`
  return c.json({ prefs: resolvePrefs(user?.notification_prefs) })
})

app.put('/notification-prefs', async (c) => {
  const userId = c.get('userId')
  const body = await c.req.json().catch(() => ({}))
  const clean = resolvePrefs(body?.prefs ?? body)
  await sql`UPDATE users SET notification_prefs = ${sql.json(clean as never)} WHERE id = ${userId}`
  return c.json({ prefs: clean })
})

export default app
