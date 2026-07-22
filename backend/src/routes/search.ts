import { Hono } from 'hono'
import sql from '../db/client.js'
import { authMiddleware } from '../middleware/auth.js'
import type { AppEnv } from '../types.js'

const app = new Hono<AppEnv>()
app.use('*', authMiddleware)

app.get('/', async (c) => {
  const userId = c.get('userId')
  const q = c.req.query('q')?.trim()
  if (!q || q.length < 2) return c.json({ results: [] })

  // substring match (so "stu" finds "stuff") plus full-text for word relevance
  const pattern = '%' + q.replace(/[\\%_]/g, (ch) => '\\' + ch) + '%'

  const results = await sql`
    SELECT t.id, t.title, t.status, t.priority, t.due_date, t.list_id, l.name as list_name
    FROM tasks t
    JOIN lists l ON l.id = t.list_id
    LEFT JOIN list_members lm ON lm.list_id = t.list_id AND lm.user_id = ${userId}
    WHERE (l.owner_id = ${userId} OR lm.user_id = ${userId})
      AND (
        t.title ILIKE ${pattern}
        OR t.notes ILIKE ${pattern}
        OR t.search_vector @@ plainto_tsquery('english', ${q})
      )
    ORDER BY
      (t.title ILIKE ${pattern}) DESC,
      ts_rank(t.search_vector, plainto_tsquery('english', ${q})) DESC,
      t.updated_at DESC
    LIMIT 20
  `

  return c.json({ results })
})

export default app
