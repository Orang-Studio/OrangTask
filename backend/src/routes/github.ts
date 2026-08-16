import { Hono } from 'hono'
import { setCookie, getCookie, deleteCookie } from 'hono/cookie'
import { randomBytes } from 'crypto'
import sql from '../db/client.js'
import { authMiddleware } from '../middleware/auth.js'
import { pageParams } from '../lib/validate.js'
import {
  GITHUB_SCOPES,
  encryptToken,
  fetchViewer,
  githubOAuthClient,
  syncGithub,
} from '../services/github.js'
import type { AppEnv } from '../types.js'

const app = new Hono<AppEnv>()

const APP_URL = process.env.APP_URL || 'http://localhost:5173'
const API_URL = process.env.API_URL || 'http://localhost:3001'
const REDIRECT_URI = `${API_URL}/api/github/callback`

function settingsRedirect(params: Record<string, string>) {
  const query = new URLSearchParams(params)
  return `${APP_URL}/settings?section=github&${query}`
}

app.get('/connect', authMiddleware, async (c) => {
  const client = githubOAuthClient()
  if (!client) return c.json({ error: 'GitHub OAuth not configured' }, 400)

  const state = randomBytes(24).toString('hex')
  setCookie(c, 'github_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Lax',
    maxAge: 600,
    path: '/',
  })

  const params = new URLSearchParams({
    client_id: client.id,
    redirect_uri: REDIRECT_URI,
    scope: GITHUB_SCOPES,
    state,
  })
  return c.json({ url: `https://github.com/login/oauth/authorize?${params}` })
})

app.get('/callback', authMiddleware, async (c) => {
  const userId = c.get('userId')
  const { code, state } = c.req.query()
  const stored = getCookie(c, 'github_state')
  deleteCookie(c, 'github_state')

  if (!code || !state || !stored || state !== stored) {
    return c.redirect(settingsRedirect({ github_error: 'state' }))
  }

  const client = githubOAuthClient()
  if (!client) return c.redirect(settingsRedirect({ github_error: 'not_configured' }))

  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      client_id: client.id,
      client_secret: client.secret,
      code,
      redirect_uri: REDIRECT_URI,
    }),
  })
  const tokenData = await tokenRes.json() as { access_token?: string; scope?: string }
  if (!tokenData.access_token) return c.redirect(settingsRedirect({ github_error: 'token' }))

  const viewer = await fetchViewer(tokenData.access_token)
  if (!viewer) return c.redirect(settingsRedirect({ github_error: 'token' }))

  await sql`
    INSERT INTO github_connections (user_id, github_login, access_token, scopes)
    VALUES (${userId}, ${viewer.login}, ${encryptToken(tokenData.access_token)}, ${tokenData.scope ?? null})
    ON CONFLICT (user_id) DO UPDATE SET
      github_login = EXCLUDED.github_login,
      access_token = EXCLUDED.access_token,
      scopes = EXCLUDED.scopes,
      last_error = NULL,
      updated_at = now()
  `

  syncGithub(userId).catch(async (err: unknown) => {
    const message = err instanceof Error ? err.message : 'Sync failed'
    await sql`UPDATE github_connections SET last_error = ${message} WHERE user_id = ${userId}`.catch(() => {})
  })

  return c.redirect(settingsRedirect({ github_connected: '1' }))
})

app.use('*', authMiddleware)

app.get('/status', async (c) => {
  const userId = c.get('userId')
  const [connection] = await sql`
    SELECT github_login, scopes, sync_issues, sync_pull_requests, sync_security, list_id, last_synced_at, last_error
    FROM github_connections WHERE user_id = ${userId}
  `
  const [counts] = await sql`
    SELECT
      COUNT(*) FILTER (WHERE kind = 'issue') AS issues,
      COUNT(*) FILTER (WHERE kind = 'pull_request') AS pull_requests,
      COUNT(*) FILTER (WHERE kind = 'security') AS security
    FROM github_items WHERE user_id = ${userId}
  `

  return c.json({
    configured: !!githubOAuthClient(),
    connection: connection ?? null,
    counts: {
      issues: Number(counts?.issues ?? 0),
      pull_requests: Number(counts?.pull_requests ?? 0),
      security: Number(counts?.security ?? 0),
    },
  })
})

app.patch('/settings', async (c) => {
  const userId = c.get('userId')
  const body = await c.req.json().catch(() => ({}))

  const fields = ['sync_issues', 'sync_pull_requests', 'sync_security'] as const
  for (const field of fields) {
    if (field in body && typeof body[field] !== 'boolean') {
      return c.json({ error: `${field} must be a boolean` }, 400)
    }
  }

  const [connection] = await sql`
    UPDATE github_connections SET
      sync_issues = COALESCE(${body.sync_issues ?? null}, sync_issues),
      sync_pull_requests = COALESCE(${body.sync_pull_requests ?? null}, sync_pull_requests),
      sync_security = COALESCE(${body.sync_security ?? null}, sync_security),
      updated_at = now()
    WHERE user_id = ${userId}
    RETURNING github_login, scopes, sync_issues, sync_pull_requests, sync_security, list_id, last_synced_at, last_error
  `
  if (!connection) return c.json({ error: 'GitHub is not connected' }, 404)

  return c.json({ connection })
})

app.post('/sync', async (c) => {
  const userId = c.get('userId')
  try {
    const result = await syncGithub(userId)
    return c.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Sync failed'
    await sql`UPDATE github_connections SET last_error = ${message} WHERE user_id = ${userId}`.catch(() => {})
    return c.json({ error: message }, 400)
  }
})

app.get('/items', async (c) => {
  const userId = c.get('userId')
  const { limit, offset } = pageParams(c.req.query())
  const kind = c.req.query('kind')

  const rows = kind
    ? await sql`
        SELECT * FROM github_items WHERE user_id = ${userId} AND kind = ${kind}
        ORDER BY item_updated_at DESC NULLS LAST LIMIT ${limit} OFFSET ${offset}
      `
    : await sql`
        SELECT * FROM github_items WHERE user_id = ${userId}
        ORDER BY item_updated_at DESC NULLS LAST LIMIT ${limit} OFFSET ${offset}
      `

  return c.json({ items: rows, nextOffset: rows.length === limit ? offset + limit : null })
})

app.post('/disconnect', async (c) => {
  const userId = c.get('userId')
  const { deleteTasks } = await c.req.json().catch(() => ({}))

  if (deleteTasks) {
    const rows = await sql`SELECT task_id FROM github_items WHERE user_id = ${userId} AND task_id IS NOT NULL`
    const taskIds = rows.map((r: { task_id: string }) => r.task_id)
    if (taskIds.length > 0) await sql`DELETE FROM tasks WHERE id = ANY(${taskIds})`
  }

  await sql`DELETE FROM github_items WHERE user_id = ${userId}`
  await sql`DELETE FROM github_connections WHERE user_id = ${userId}`
  return c.json({ ok: true })
})

export default app