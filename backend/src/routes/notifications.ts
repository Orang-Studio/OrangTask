import { Hono } from 'hono'
import sql from '../db/client.js'
import { authMiddleware } from '../middleware/auth.js'
import type { AppEnv } from '../types.js'

const app = new Hono<AppEnv>()
app.use('*', authMiddleware)

app.get('/', async (c) => {
  const userId = c.get('userId')
  const notifications = await sql`
    SELECT * FROM notifications WHERE user_id = ${userId}
    ORDER BY created_at DESC LIMIT 50
  `
  return c.json({ notifications })
})

app.post('/read-all', async (c) => {
  const userId = c.get('userId')
  await sql`UPDATE notifications SET read = true WHERE user_id = ${userId}`
  return c.json({ ok: true })
})

app.patch('/:id/read', async (c) => {
  const userId = c.get('userId')
  const id = c.req.param('id')
  await sql`UPDATE notifications SET read = true WHERE id = ${id} AND user_id = ${userId}`
  return c.json({ ok: true })
})

export default app
