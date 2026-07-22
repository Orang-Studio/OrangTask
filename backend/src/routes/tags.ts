import { Hono } from 'hono'
import sql from '../db/client.js'
import { authMiddleware } from '../middleware/auth.js'
import type { AppEnv } from '../types.js'

const app = new Hono<AppEnv>()
app.use('*', authMiddleware)

app.get('/', async (c) => {
  const userId = c.get('userId')
  const tags = await sql`SELECT * FROM tags WHERE owner_id = ${userId} ORDER BY name`
  return c.json({ tags })
})

app.post('/', async (c) => {
  const userId = c.get('userId')
  const { name, color } = await c.req.json()
  if (!name) return c.json({ error: 'Name required' }, 400)

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
