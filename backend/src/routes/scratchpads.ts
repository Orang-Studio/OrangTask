import { Hono } from 'hono'
import sql from '../db/client.js'
import { authMiddleware } from '../middleware/auth.js'
import { MAX, firstError, pageParams, textField } from '../lib/validate.js'
import type { AppEnv } from '../types.js'

const app = new Hono<AppEnv>()
app.use('*', authMiddleware)

const MAX_TITLE = 200
const MAX_CONTENT = MAX.notes

app.get('/', async (c) => {
  const userId = c.get('userId')
  const { limit, offset } = pageParams(c.req.query())

  const scratchpads = await sql`
    SELECT * FROM scratchpads WHERE user_id = ${userId}
    ORDER BY position, created_at
    LIMIT ${limit} OFFSET ${offset}
  `

  return c.json({ scratchpads, nextOffset: scratchpads.length === limit ? offset + limit : null })
})

app.post('/', async (c) => {
  const userId = c.get('userId')
  const { title = '', content = '' } = await c.req.json().catch(() => ({}))

  const invalid = firstError(
    textField(title, 'title', MAX_TITLE),
    textField(content, 'content', MAX_CONTENT),
  )
  if (invalid) return c.json({ error: invalid }, 400)

  const [maxPos] = await sql`SELECT COALESCE(MAX(position), -1) + 1 as pos FROM scratchpads WHERE user_id = ${userId}`

  const [scratchpad] = await sql`
    INSERT INTO scratchpads (user_id, title, content, position)
    VALUES (${userId}, ${title}, ${content}, ${maxPos.pos})
    RETURNING *
  `

  return c.json({ scratchpad }, 201)
})

app.patch('/:id', async (c) => {
  const userId = c.get('userId')
  const id = c.req.param('id')
  const updates = await c.req.json().catch(() => ({}))

  const invalid = firstError(
    textField(updates.title, 'title', MAX_TITLE),
    textField(updates.content, 'content', MAX_CONTENT),
  )
  if (invalid) return c.json({ error: invalid }, 400)

  const [scratchpad] = await sql`
    UPDATE scratchpads SET
      title = COALESCE(${updates.title ?? null}, title),
      content = COALESCE(${updates.content ?? null}, content),
      position = COALESCE(${typeof updates.position === 'number' ? updates.position : null}, position),
      updated_at = now()
    WHERE id = ${id} AND user_id = ${userId}
    RETURNING *
  `
  if (!scratchpad) return c.json({ error: 'Not found' }, 404)

  return c.json({ scratchpad })
})

app.delete('/:id', async (c) => {
  const userId = c.get('userId')
  const id = c.req.param('id')

  const [deleted] = await sql`
    DELETE FROM scratchpads WHERE id = ${id} AND user_id = ${userId} RETURNING id
  `
  if (!deleted) return c.json({ error: 'Not found' }, 404)

  return c.json({ ok: true })
})

export default app