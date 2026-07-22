import { Hono } from 'hono'
import { randomBytes, createHmac } from 'crypto'
import sql from '../db/client.js'
import { authMiddleware } from '../middleware/auth.js'
import * as chrono from 'chrono-node'
import type { AppEnv } from '../types.js'

const app = new Hono<AppEnv>()

// public incoming webhook endpoint
app.post('/hooks/:token', async (c) => {
  const token = c.req.param('token')
  const [webhook] = await sql`
    SELECT * FROM webhooks WHERE incoming_token = ${token} AND direction = 'incoming' AND enabled = true
  `
  if (!webhook) return c.json({ error: 'Not found' }, 404)

  const body = await c.req.json()
  const { title, notes, due, list: listName, priority, tags } = body

  if (!title) return c.json({ error: 'title required' }, 400)

  // parse due date
  let due_date: Date | null = null
  if (due) {
    const parsed = chrono.parseDate(due)
    if (parsed) due_date = parsed
  }

  // find or create list
  let [list] = await sql`
    SELECT * FROM lists WHERE owner_id = ${webhook.user_id} AND name ILIKE ${listName || 'Incoming'}
  `
  if (!list) {
    ;[list] = await sql`
      INSERT INTO lists (owner_id, name, color, icon, position)
      VALUES (${webhook.user_id}, ${listName || 'Incoming'}, '#6366f1', 'webhook', 999)
      RETURNING *
    `
  }

  const [task] = await sql`
    INSERT INTO tasks (list_id, created_by, title, notes, priority, due_date, position)
    VALUES (
      ${list.id}, ${webhook.user_id},
      ${title}, ${notes || null},
      ${['none','low','medium','high'].includes(priority) ? priority : 'none'},
      ${due_date}, 0
    )
    RETURNING *
  `

  // handle tags
  if (tags && Array.isArray(tags)) {
    for (const tagName of tags) {
      const [tag] = await sql`
        INSERT INTO tags (owner_id, name) VALUES (${webhook.user_id}, ${tagName})
        ON CONFLICT (owner_id, name) DO UPDATE SET name = EXCLUDED.name
        RETURNING *
      `
      await sql`INSERT INTO task_tags (task_id, tag_id) VALUES (${task.id}, ${tag.id}) ON CONFLICT DO NOTHING`
    }
  }

  return c.json({ task }, 201)
})

// protected webhook CRUD lives on this router, mounted at /api/webhooks in index.ts
const webhooks = new Hono<AppEnv>()
webhooks.use('*', authMiddleware)

webhooks.get('/', async (c) => {
  const userId = c.get('userId')
  const items = await sql`SELECT * FROM webhooks WHERE user_id = ${userId} ORDER BY created_at DESC`
  return c.json({ webhooks: items })
})

webhooks.post('/', async (c) => {
  const userId = c.get('userId')
  const { name, url, direction, events } = await c.req.json()

  if (!name || !direction) return c.json({ error: 'name and direction required' }, 400)
  if (direction === 'outgoing' && !url) return c.json({ error: 'url required for outgoing' }, 400)

  const secret = randomBytes(32).toString('hex')
  const incoming_token = direction === 'incoming' ? randomBytes(24).toString('hex') : null

  const [webhook] = await sql`
    INSERT INTO webhooks (user_id, name, url, direction, secret, events, incoming_token)
    VALUES (${userId}, ${name}, ${url || null}, ${direction}, ${secret}, ${events ? sql.array(events) : null}, ${incoming_token})
    RETURNING *
  `
  return c.json({ webhook }, 201)
})

webhooks.patch('/:id', async (c) => {
  const userId = c.get('userId')
  const id = c.req.param('id')
  const { name, url, events, enabled } = await c.req.json()

  const [updated] = await sql`
    UPDATE webhooks SET
      name = COALESCE(${name ?? null}, name),
      url = COALESCE(${url ?? null}, url),
      events = COALESCE(${events ? sql.array(events) : null}, events),
      enabled = COALESCE(${enabled ?? null}, enabled)
    WHERE id = ${id} AND user_id = ${userId}
    RETURNING *
  `
  if (!updated) return c.json({ error: 'Not found' }, 404)
  return c.json({ webhook: updated })
})

webhooks.delete('/:id', async (c) => {
  const userId = c.get('userId')
  const id = c.req.param('id')
  await sql`DELETE FROM webhooks WHERE id = ${id} AND user_id = ${userId}`
  return c.json({ ok: true })
})

webhooks.get('/:id/deliveries', async (c) => {
  const userId = c.get('userId')
  const id = c.req.param('id')

  const [webhook] = await sql`SELECT 1 FROM webhooks WHERE id = ${id} AND user_id = ${userId}`
  if (!webhook) return c.json({ error: 'Not found' }, 404)

  const deliveries = await sql`
    SELECT * FROM webhook_deliveries WHERE webhook_id = ${id}
    ORDER BY created_at DESC LIMIT 50
  `
  return c.json({ deliveries })
})

webhooks.post('/:id/test', async (c) => {
  const userId = c.get('userId')
  const id = c.req.param('id')

  const [webhook] = await sql`SELECT * FROM webhooks WHERE id = ${id} AND user_id = ${userId}`
  if (!webhook) return c.json({ error: 'Not found' }, 404)

  const payload = {
    event: 'test',
    timestamp: new Date().toISOString(),
    data: { message: 'OrangTask webhook test' },
  }

  const body = JSON.stringify(payload)
  const signature = webhook.secret
    ? `sha256=${createHmac('sha256', webhook.secret).update(body).digest('hex')}`
    : undefined

  let statusCode = 0
  let responseBody = ''
  let error = ''

  try {
    const res = await fetch(webhook.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(signature ? { 'X-OrangTask-Signature': signature } : {}),
      },
      body,
      signal: AbortSignal.timeout(10000),
    })
    statusCode = res.status
    responseBody = await res.text()
  } catch (err: unknown) {
    error = err instanceof Error ? err.message : String(err)
  }

  await sql`
    INSERT INTO webhook_deliveries (webhook_id, event, payload, status_code, response_body, delivered_at, error)
    VALUES (${id}, 'test', ${sql.json(payload)}, ${statusCode || null}, ${responseBody || null}, ${statusCode ? new Date() : null}, ${error || null})
  `

  return c.json({ statusCode, responseBody, error })
})

export { webhooks }
export default app
