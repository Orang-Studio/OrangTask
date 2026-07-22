import { Context, Next } from 'hono'
import { getCookie } from 'hono/cookie'
import sql from '../db/client.js'
import { API_KEY_PREFIX, hashApiKey } from '../services/apiKeys.js'
import type { AppEnv } from '../types.js'

async function authenticateApiKey(c: Context<AppEnv>, token: string): Promise<boolean> {
  const keyHash = hashApiKey(token)
  const [row] = await sql`
    SELECT k.id as key_id, u.id as uid, u.email, u.name, u.avatar_url
    FROM api_keys k
    JOIN users u ON u.id = k.user_id
    WHERE k.key_hash = ${keyHash}
  `
  if (!row) return false

  // best-effort a slow write here shouldnt hold up the request
  sql`UPDATE api_keys SET last_used_at = now() WHERE id = ${row.key_id}`.catch(() => {})

  c.set('userId', row.uid)
  c.set('user', { id: row.uid, email: row.email, name: row.name, avatar_url: row.avatar_url })
  return true
}

export async function authMiddleware(c: Context<AppEnv>, next: Next) {
  const token = getCookie(c, 'session') || c.req.header('Authorization')?.replace('Bearer ', '')

  if (!token) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  // API keys (otk_...) are long-lived, unattended-integration credentials distinct from short-lived
  if (token.startsWith(API_KEY_PREFIX)) {
    if (await authenticateApiKey(c, token)) return next()
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const [session] = await sql`
    SELECT s.*, u.id as uid, u.email, u.name, u.avatar_url
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token = ${token}
      AND s.expires_at > now()
  `

  if (!session) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  c.set('userId', session.uid)
  c.set('user', {
    id: session.uid,
    email: session.email,
    name: session.name,
    avatar_url: session.avatar_url,
  })

  await next()
}

export function optionalAuth(c: Context<AppEnv>, next: Next) {
  const token = getCookie(c, 'session') || c.req.header('Authorization')?.replace('Bearer ', '')
  if (!token) return next()
  return authMiddleware(c, next)
}
