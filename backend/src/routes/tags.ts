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
  const raw = c.req.query('listId')
  const listId = raw && /^[0-9a-f-]{36}$/i.test(raw) ? raw : undefined
  // with listId own tags plus tags other members already use in that list own names win on a clash
  const tags = listId
    ? await sql`
      SELECT * FROM (
        SELECT * FROM tags WHERE owner_id = ${userId}
        UNION
        SELECT tg.* FROM tags tg
        WHERE EXISTS (
          SELECT 1 FROM task_tags tt
          JOIN tasks t ON t.id = tt.task_id
          JOIN lists l ON l.id = t.list_id
          LEFT JOIN list_members lm ON lm.list_id = l.id AND lm.user_id = ${userId}
          WHERE tt.tag_id = tg.id AND t.list_id = ${listId} AND (l.owner_id = ${userId} OR lm.user_id = ${userId})
        )
        AND NOT EXISTS (SELECT 1 FROM tags own WHERE own.owner_id = ${userId} AND lower(own.name) = lower(tg.name))
      ) shared
      ORDER BY name LIMIT ${limit} OFFSET ${offset}
    `
    : await sql`
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