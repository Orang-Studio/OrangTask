import { Hono } from 'hono'
import { randomBytes } from 'crypto'
import sql from '../db/client.js'
import { authMiddleware } from '../middleware/auth.js'
import { API_KEY_PREFIX, hashApiKey } from '../services/apiKeys.js'
import type { AppEnv } from '../types.js'

const app = new Hono<AppEnv>()
app.use('*', authMiddleware)

app.get('/', async (c) => {
  const userId = c.get('userId')
  const keys = await sql`
    SELECT id, name, key_prefix, last_used_at, created_at
    FROM api_keys WHERE user_id = ${userId} ORDER BY created_at DESC
  `
  return c.json({ keys })
})

app.post('/', async (c) => {
  const userId = c.get('userId')
  const { name } = await c.req.json()
  if (!name || typeof name !== 'string' || !name.trim()) {
    return c.json({ error: 'name required' }, 400)
  }

  const secret = randomBytes(24).toString('hex')
  const key = `${API_KEY_PREFIX}${secret}`
  const keyHash = hashApiKey(key)
  const keyPrefix = key.slice(0, 12)

  const [row] = await sql`
    INSERT INTO api_keys (user_id, name, key_hash, key_prefix)
    VALUES (${userId}, ${name.trim()}, ${keyHash}, ${keyPrefix})
    RETURNING id, name, key_prefix, last_used_at, created_at
  `

  // the raw key is only ever shown here the server keeps just its hash
  return c.json({ key: { ...row, raw_key: key } }, 201)
})

app.delete('/:id', async (c) => {
  const userId = c.get('userId')
  const id = c.req.param('id')
  await sql`DELETE FROM api_keys WHERE id = ${id} AND user_id = ${userId}`
  return c.json({ ok: true })
})

export default app
