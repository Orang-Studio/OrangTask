import { Hono } from 'hono'
import sql from '../db/client.js'
import { authMiddleware } from '../middleware/auth.js'
import { MAX, firstError, pageParams, textField } from '../lib/validate.js'
import type { AppEnv } from '../types.js'

const app = new Hono<AppEnv>()
app.use('*', authMiddleware)

app.get('/', async (c) => {
  const userId = c.get('userId')
  const { limit, offset } = pageParams(c.req.query())
  const tags = await sql`
    SELECT * FROM tags WHERE owner_id = ${userId}
    ORDER BY name LIMIT ${limit} OFFSET ${offset}
  `
  return c.json({ tags, nextOffset: tags.length === limit ? offset + limit : null })
})

app.post('/', async (c) => {
  const userId = c.get('userId')
  const { name, color } = await c.req.json()

  const invalid = firstError(
    textField(name, 'name', MAX.tagName, { required: true }),
    textField(color, 'color', MAX.listColor),
  )
  if (invalid) return c.json({ error: invalid }, 400)

  const [tag] = await sql`
    INSERT INTO tags (owner_id, name, color)
    VALUES (${userId}, ${name}, ${color || null})
    ON CONFLICT (owner_id, name) DO UPDATE SET color = EXCLUDED.color
    RETURNING *
  `
  return c.json({ tag }, 201)
})

app.delete('/:id', async (c) => {
  const userId = c.get('userId')
  const id = c.req.param('id')

  await sql`DELETE FROM tags WHERE id = ${id} AND owner_id = ${userId}`
  return c.json({ ok: true })
})

export default app
