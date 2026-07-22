import { Hono, type Context } from 'hono'
import { setCookie, getCookie, deleteCookie } from 'hono/cookie'
import { randomBytes, scryptSync, timingSafeEqual, createHmac, randomInt } from 'crypto'
import sql from '../db/client.js'
import { sendMagicLink, sendPasswordResetCode, sendPinResetCode } from '../services/email.js'
import { rateLimit } from '../middleware/rateLimit.js'
import { authMiddleware } from '../middleware/auth.js'
import type { AppEnv } from '../types.js'

const app = new Hono<AppEnv>()
const APP_URL = process.env.APP_URL || 'http://localhost:5173'

function generateToken(bytes = 32) {
  return randomBytes(bytes).toString('hex')
}

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':')
  const hashBuf = Buffer.from(hash, 'hex')
  const testBuf = scryptSync(password, salt, 64)
  return timingSafeEqual(hashBuf, testBuf)
}

// access token: 1 hour Refresh token: 1 year, stored in httpOnly cookie On every API request that
async function createTokenPair(userId: string) {
  const accessToken = generateToken(32)
  const refreshToken = generateToken(48)

  const accessExpiry = new Date(Date.now() + 60 * 60 * 1000) // 1 hour
  const refreshExpiry = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year

  await sql`
    INSERT INTO sessions (user_id, token, expires_at)
    VALUES (${userId}, ${accessToken}, ${accessExpiry})
  `
  await sql`
    INSERT INTO refresh_tokens (user_id, token, expires_at)
    VALUES (${userId}, ${refreshToken}, ${refreshExpiry})
  `

  return { accessToken, refreshToken }
}

// native clients (Android app) cant use httpOnly cookies
function isNative(c: Context<AppEnv>): boolean {
  return !!c.req.header('x-platform')
}

function nativeTokens(c: Context<AppEnv>, accessToken: string, refreshToken: string) {
  return isNative(c) ? { access_token: accessToken, refresh_token: refreshToken } : {}
}

// the Android app cant receive an OAuth callback as a cookie-bearing web redirect
const NATIVE_AUTH_REDIRECT = 'orangtask://auth-callback'

// the platform is carried *inside* the OAuth `state` param (`<token>.android`) so it survives the
function buildOAuthState(native: boolean): { token: string; state: string } {
  const token = generateToken()
  return { token, state: native ? `${token}.android` : token }
}

function parseOAuthState(raw?: string): { token: string; native: boolean } {
  const [token = '', platform] = (raw ?? '').split('.')
  return { token, native: platform === 'android' }
}

function nativeAuthRedirect(c: Context<AppEnv>, params: Record<string, string>) {
  return c.redirect(`${NATIVE_AUTH_REDIRECT}?${new URLSearchParams(params)}`)
}

// an OAuth failure: deep-link the native app back with ?error=…, else the web login
function oauthError(c: Context<AppEnv>, native: boolean, code: string) {
  return native ? nativeAuthRedirect(c, { error: code }) : c.redirect(`${APP_URL}/login?error=${code}`)
}

function bearerToken(c: Context<AppEnv>): string | undefined {
  return c.req.header('Authorization')?.replace('Bearer ', '')
}

function setAuthCookies(c: Parameters<typeof setCookie>[0], accessToken: string, refreshToken: string) {
  const isProd = process.env.NODE_ENV === 'production'

  // short-lived access token in memory-readable cookie (JS reads it to set Auth header)
  setCookie(c, 'session', accessToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'Lax',
    maxAge: 60 * 60, // 1 hour
    path: '/',
  })

  // long-lived refresh token - httpOnly, not readable by JS
  setCookie(c, 'refresh_token', refreshToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'Lax',
    maxAge: 365 * 24 * 60 * 60, // 1 year
    path: '/api/auth',
  })
}

// ---- PIN unlock cookie (server-side "unlocked for this session") ---- HMAC-signed so it cant be
const PIN_TTL_MS = 7 * 24 * 60 * 60 * 1000
const pinSecret = () => process.env.SESSION_SECRET || 'change-me'

function signPinToken(uid: string): string {
  const payload = Buffer.from(JSON.stringify({ uid, exp: Date.now() + PIN_TTL_MS })).toString('base64url')
  const mac = createHmac('sha256', pinSecret()).update(payload).digest('base64url')
  return `${payload}.${mac}`
}

function pinTokenValid(token: string | undefined, uid: string): boolean {
  if (!token || !token.includes('.')) return false
  const [payload, mac] = token.split('.')
  const expected = createHmac('sha256', pinSecret()).update(payload).digest('base64url')
  const a = Buffer.from(mac)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false
  try {
    const d = JSON.parse(Buffer.from(payload, 'base64url').toString())
    return d.uid === uid && typeof d.exp === 'number' && d.exp > Date.now()
  } catch {
    return false
  }
}

function setPinCookie(c: Parameters<typeof setCookie>[0], uid: string) {
  setCookie(c, 'pin_ok', signPinToken(uid), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Lax',
    path: '/',
    // no maxAge session cookie (persists across reloads, clears with the session)
  })
}

// refresh access token using refresh token
app.post('/refresh', async (c) => {
  const refreshToken = getCookie(c, 'refresh_token') || bearerToken(c)
  if (!refreshToken) return c.json({ error: 'No refresh token' }, 401)

  const [rt] = await sql`
    SELECT * FROM refresh_tokens WHERE token = ${refreshToken} AND expires_at > now()
  `
  if (!rt) return c.json({ error: 'Invalid or expired refresh token' }, 401)

  // clean up expired access tokens and issue a new one
  const accessToken = generateToken(32)
  const accessExpiry = new Date(Date.now() + 60 * 60 * 1000)

  await sql`DELETE FROM sessions WHERE user_id = ${rt.user_id} AND expires_at <= now()`
  await sql`
    INSERT INTO sessions (user_id, token, expires_at)
    VALUES (${rt.user_id}, ${accessToken}, ${accessExpiry})
  `

  // slide the refresh token expiry (keeps renewing as long as user is active)
  const newRefreshExpiry = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
  await sql`UPDATE refresh_tokens SET expires_at = ${newRefreshExpiry} WHERE id = ${rt.id}`

  const isProd = process.env.NODE_ENV === 'production'
  setCookie(c, 'session', accessToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'Lax',
    maxAge: 60 * 60,
    path: '/',
  })

  return c.json({ ok: true, ...(isNative(c) ? { access_token: accessToken } : {}) })
})

// magic link
app.post('/magic-link', rateLimit({ windowMs: 60000, max: 5, keyPrefix: 'ml' }), async (c) => {
  const { email } = await c.req.json()
  if (!email || !email.includes('@')) return c.json({ error: 'Invalid email' }, 400)

  const token = generateToken()
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000)

  await sql`
    INSERT INTO magic_links (email, token, expires_at)
    VALUES (${email.toLowerCase()}, ${token}, ${expiresAt})
  `

  await sendMagicLink(email.toLowerCase(), token)
  return c.json({ ok: true })
})

app.get('/magic-link/verify', async (c) => {
  const native = isNative(c)
  const token = c.req.query('token')
  if (!token) return native ? c.json({ error: 'Invalid link' }, 400) : c.redirect(`${APP_URL}/login?error=invalid`)

  const [link] = await sql`
    SELECT * FROM magic_links
    WHERE token = ${token} AND expires_at > now() AND used = false
  `
  if (!link) return native ? c.json({ error: 'Expired or already used link' }, 400) : c.redirect(`${APP_URL}/login?error=expired`)

  await sql`UPDATE magic_links SET used = true WHERE id = ${link.id}`

  let [user] = await sql`SELECT * FROM users WHERE email = ${link.email}`
  if (!user) {
    const name = link.email.split('@')[0]
    ;[user] = await sql`
      INSERT INTO users (email, name)
      VALUES (${link.email}, ${name})
      RETURNING *
    `
    await sql`
      INSERT INTO lists (owner_id, name, color, icon, position)
      VALUES (${user.id}, 'Personal', '#f97316', 'inbox', 0)
    `
  }

  const { accessToken, refreshToken } = await createTokenPair(user.id)
  setAuthCookies(c, accessToken, refreshToken)

  if (native) {
    return c.json({
      user: { id: user.id, email: user.email, name: user.name, avatar_url: user.avatar_url },
      requires_pin: !!user.pin_hash,
      access_token: accessToken,
      refresh_token: refreshToken,
    })
  }

  // check if PIN is set - redirect to PIN entry if so
  if (user.pin_hash) {
    return c.redirect(`${APP_URL}/pin?next=/today`)
  }
  return c.redirect(`${APP_URL}/today`)
})

// ---- OAuth helpers (shared by GitHub + Google) ----

// read the currently logged-in user id straight from the session cookie
async function getSessionUserId(c: Parameters<typeof getCookie>[0]): Promise<string | null> {
  const token = getCookie(c, 'session') || c.req.header('Authorization')?.replace('Bearer ', '')
  if (!token) return null
  const [session] = await sql`SELECT user_id FROM sessions WHERE token = ${token} AND expires_at > now()`
  return session?.user_id ?? null
}

async function upsertOAuthAccount(userId: string, provider: string, providerUserId: string, email?: string | null) {
  await sql`
    INSERT INTO oauth_accounts (user_id, provider, provider_user_id, provider_email)
    VALUES (${userId}, ${provider}, ${providerUserId}, ${email ?? null})
    ON CONFLICT (provider, provider_user_id)
    DO UPDATE SET user_id = EXCLUDED.user_id, provider_email = EXCLUDED.provider_email
  `
}

// when starting an OAuth flow to *link* (?link=1) while signed in, we drop a short-lived flag cookie
function setLinkCookie(c: Parameters<typeof setCookie>[0]) {
  setCookie(c, 'oauth_link', '1', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Lax',
    maxAge: 600,
    path: '/',
  })
}

// decide what an OAuth callback means: link to the current account, log into the already-linked
async function finishOAuth(
  c: Context<AppEnv>,
  provider: 'github' | 'google',
  providerUserId: string,
  email: string | undefined,
  create: { name: string; avatar_url?: string | null },
  native: boolean
) {
  const linkMode = getCookie(c, 'oauth_link') === '1'
  deleteCookie(c, 'oauth_link')
  const currentUserId = await getSessionUserId(c)
  const normalizedEmail = email?.toLowerCase()

  const [existingLink] = await sql`
    SELECT user_id FROM oauth_accounts WHERE provider = ${provider} AND provider_user_id = ${providerUserId}
  `

  // explicit "connect this provider to my account" flow
  if (linkMode && currentUserId) {
    if (existingLink && existingLink.user_id !== currentUserId) {
      return native ? nativeAuthRedirect(c, { error: 'link_in_use' }) : c.redirect(`${APP_URL}/settings?link_error=in_use`)
    }
    await upsertOAuthAccount(currentUserId, provider, providerUserId, normalizedEmail)
    return native ? nativeAuthRedirect(c, { linked: provider }) : c.redirect(`${APP_URL}/settings?linked=${provider}`)
  }

  // login / registration flow
  let userId: string
  let pinHash: string | null = null

  if (existingLink) {
    userId = existingLink.user_id
    const [u] = await sql`SELECT pin_hash FROM users WHERE id = ${userId}`
    pinHash = u?.pin_hash ?? null
  } else {
    // fall back to email so accounts created before linking still match
    let user: any = normalizedEmail
      ? (await sql`SELECT * FROM users WHERE email = ${normalizedEmail}`)[0]
      : null
    if (!user) {
      if (!normalizedEmail) return oauthError(c, native, 'no_email')
      ;[user] = await sql`
        INSERT INTO users (email, name, avatar_url)
        VALUES (${normalizedEmail}, ${create.name}, ${create.avatar_url || null})
        RETURNING *
      `
      await sql`
        INSERT INTO lists (owner_id, name, color, icon, position)
        VALUES (${user.id}, 'Personal', '#f97316', 'inbox', 0)
      `
    }
    userId = user.id
    pinHash = user.pin_hash ?? null
    await upsertOAuthAccount(userId, provider, providerUserId, normalizedEmail)
  }

  const { accessToken, refreshToken } = await createTokenPair(userId)
  // native: hand the tokens to the app; it applies its own local PIN gate
  if (native) return nativeAuthRedirect(c, { access: accessToken, refresh: refreshToken })
  setAuthCookies(c, accessToken, refreshToken)
  if (pinHash) return c.redirect(`${APP_URL}/pin?next=/today`)
  return c.redirect(`${APP_URL}/today`)
}

// which providers are configured lets the UI hide/disable unavailable buttons
app.get('/providers', (c) =>
  c.json({
    github: !!process.env.GITHUB_CLIENT_ID,
    google: !!process.env.GOOGLE_CLIENT_ID,
  })
)

// list the current accounts linked providers (+ whether a password is set)
app.get('/linked', authMiddleware, async (c) => {
  const userId = c.get('userId')
  const accounts = await sql`
    SELECT provider, provider_email, created_at FROM oauth_accounts WHERE user_id = ${userId} ORDER BY created_at
  `
  const [u] = await sql`SELECT password_hash IS NOT NULL AS has_password FROM users WHERE id = ${userId}`
  return c.json({ accounts, has_password: !!u?.has_password })
})

// disconnect a provider Always safe: a magic link to the account email remains
app.post('/unlink', authMiddleware, async (c) => {
  const userId = c.get('userId')
  const { provider } = await c.req.json().catch(() => ({}))
  if (provider !== 'github' && provider !== 'google') return c.json({ error: 'Invalid provider' }, 400)
  await sql`DELETE FROM oauth_accounts WHERE user_id = ${userId} AND provider = ${provider}`
  return c.json({ ok: true })
})

// GitHub OAuth
app.get('/github', async (c) => {
  const clientId = process.env.GITHUB_CLIENT_ID
  if (!clientId) return c.json({ error: 'GitHub OAuth not configured' }, 400)

  if (c.req.query('link') === '1') {
    const uid = await getSessionUserId(c)
    if (!uid) return c.redirect(`${APP_URL}/login`)
    setLinkCookie(c)
  }

  const { token, state } = buildOAuthState(c.req.query('platform') === 'android')
  setCookie(c, 'oauth_state', token, { httpOnly: true, maxAge: 600, path: '/' })
  const url = `https://github.com/login/oauth/authorize?client_id=${clientId}&scope=user:email&state=${state}`
  return c.redirect(url)
})

app.get('/github/callback', async (c) => {
  const { code, state } = c.req.query()
  const { token: stateToken, native } = parseOAuthState(state)
  const storedState = getCookie(c, 'oauth_state')
  if (!stateToken || stateToken !== storedState) return oauthError(c, native, 'state')

  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code,
    }),
  })
  const tokenData = await tokenRes.json() as { access_token?: string }
  if (!tokenData.access_token) return oauthError(c, native, 'github')

  const userRes = await fetch('https://api.github.com/user', {
    headers: { Authorization: `Bearer ${tokenData.access_token}`, 'User-Agent': 'OrangTask' },
  })
  const ghUser = await userRes.json() as { id?: number; email?: string; name?: string; login?: string; avatar_url?: string }
  if (!ghUser.id) return oauthError(c, native, 'github')

  let email = ghUser.email
  if (!email) {
    const emailsRes = await fetch('https://api.github.com/user/emails', {
      headers: { Authorization: `Bearer ${tokenData.access_token}`, 'User-Agent': 'OrangTask' },
    })
    const emails = await emailsRes.json() as Array<{ email: string; primary: boolean; verified: boolean }>
    email = emails.find((e) => e.primary && e.verified)?.email
  }

  return finishOAuth(c, 'github', String(ghUser.id), email, {
    name: ghUser.name || ghUser.login || (email ? email.split('@')[0] : 'GitHub user'),
    avatar_url: ghUser.avatar_url,
  }, native)
})

// google OAuth
app.get('/google', async (c) => {
  const clientId = process.env.GOOGLE_CLIENT_ID
  if (!clientId) return c.json({ error: 'Google OAuth not configured' }, 400)

  if (c.req.query('link') === '1') {
    const uid = await getSessionUserId(c)
    if (!uid) return c.redirect(`${APP_URL}/login`)
    setLinkCookie(c)
  }

  const { token, state } = buildOAuthState(c.req.query('platform') === 'android')
  setCookie(c, 'oauth_state', token, { httpOnly: true, maxAge: 600, path: '/' })

  const apiUrl = process.env.API_URL || 'http://localhost:3001'
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${apiUrl}/api/auth/google/callback`,
    response_type: 'code',
    scope: 'openid email profile',
    state,
  })
  return c.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`)
})

app.get('/google/callback', async (c) => {
  const { code, state } = c.req.query()
  const { token: stateToken, native } = parseOAuthState(state)
  const storedState = getCookie(c, 'oauth_state')
  if (!stateToken || stateToken !== storedState) return oauthError(c, native, 'state')

  const apiUrl = process.env.API_URL || 'http://localhost:3001'
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: `${apiUrl}/api/auth/google/callback`,
      grant_type: 'authorization_code',
    }),
  })
  const tokenData = await tokenRes.json() as { access_token?: string }
  if (!tokenData.access_token) return oauthError(c, native, 'google')

  const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  })
  const gUser = await userRes.json() as { id?: string; email?: string; name?: string; picture?: string }
  if (!gUser.id) return oauthError(c, native, 'google')

  return finishOAuth(c, 'google', gUser.id, gUser.email, {
    name: gUser.name || (gUser.email ? gUser.email.split('@')[0] : 'Google user'),
    avatar_url: gUser.picture,
  }, native)
})

// email/password register
app.post('/register', rateLimit({ windowMs: 60000, max: 10, keyPrefix: 'reg' }), async (c) => {
  const { email, password, name } = await c.req.json()
  if (!email || !password || !name) return c.json({ error: 'Missing fields' }, 400)
  if (password.length < 8) return c.json({ error: 'Password too short' }, 400)

  const [existing] = await sql`SELECT id FROM users WHERE email = ${email.toLowerCase()}`
  if (existing) return c.json({ error: 'Email already registered' }, 409)

  const hash = hashPassword(password)
  const [user] = await sql`
    INSERT INTO users (email, password_hash, name)
    VALUES (${email.toLowerCase()}, ${hash}, ${name})
    RETURNING *
  `
  await sql`
    INSERT INTO lists (owner_id, name, color, icon, position)
    VALUES (${user.id}, 'Personal', '#f97316', 'inbox', 0)
  `

  const { accessToken, refreshToken } = await createTokenPair(user.id)
  setAuthCookies(c, accessToken, refreshToken)
  return c.json({
    user: { id: user.id, email: user.email, name: user.name },
    ...nativeTokens(c, accessToken, refreshToken),
  })
})

// email/password login
app.post('/login', rateLimit({ windowMs: 60000, max: 10, keyPrefix: 'login' }), async (c) => {
  const { email, password } = await c.req.json()
  if (!email || !password) return c.json({ error: 'Missing fields' }, 400)

  const [user] = await sql`SELECT * FROM users WHERE email = ${email.toLowerCase()}`
  if (!user || !user.password_hash) return c.json({ error: 'Invalid credentials' }, 401)

  const valid = verifyPassword(password, user.password_hash)
  if (!valid) return c.json({ error: 'Invalid credentials' }, 401)

  const { accessToken, refreshToken } = await createTokenPair(user.id)
  setAuthCookies(c, accessToken, refreshToken)

  if (user.pin_hash) {
    return c.json({ requires_pin: true, ...nativeTokens(c, accessToken, refreshToken) })
  }

  return c.json({
    user: { id: user.id, email: user.email, name: user.name, avatar_url: user.avatar_url },
    ...nativeTokens(c, accessToken, refreshToken),
  })
})

// ---- Password reset via emailed PIN code ---- 1

function generateResetCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, '0')
}

app.post('/forgot-password', rateLimit({ windowMs: 60000, max: 3, keyPrefix: 'pwreset' }), async (c) => {
  const { email } = await c.req.json().catch(() => ({}))
  if (!email || !email.includes('@')) return c.json({ error: 'Invalid email' }, 400)

  const normalized = email.toLowerCase()
  const [user] = await sql`SELECT id FROM users WHERE email = ${normalized}`

  // only generate/send when the account exists but the response is identical either way to avoid
  if (user) {
    // invalidate any previously issued codes so only the newest one works
    await sql`UPDATE password_resets SET used = true WHERE email = ${normalized} AND used = false`

    const code = generateResetCode()
    const codeHash = hashPassword(code)
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000)

    await sql`
      INSERT INTO password_resets (email, code_hash, expires_at)
      VALUES (${normalized}, ${codeHash}, ${expiresAt})
    `
    await sendPasswordResetCode(normalized, code)
  }

  return c.json({ ok: true })
})

app.post('/reset-password', rateLimit({ windowMs: 60000, max: 10, keyPrefix: 'pwreset' }), async (c) => {
  const { email, code, password } = await c.req.json().catch(() => ({}))
  if (!email || !code || !password) return c.json({ error: 'Missing fields' }, 400)
  if (password.length < 8) return c.json({ error: 'Password too short' }, 400)

  const normalized = email.toLowerCase()
  const [reset] = await sql`
    SELECT * FROM password_resets
    WHERE email = ${normalized} AND used = false AND expires_at > now()
    ORDER BY created_at DESC
    LIMIT 1
  `
  if (!reset) return c.json({ error: 'Invalid or expired code' }, 400)

  // cap guesses so a 6-digit code cant be brute-forced
  if (reset.attempts >= 5) {
    await sql`UPDATE password_resets SET used = true WHERE id = ${reset.id}`
    return c.json({ error: 'Too many attempts, request a new code' }, 429)
  }

  if (!verifyPassword(code, reset.code_hash)) {
    await sql`UPDATE password_resets SET attempts = attempts + 1 WHERE id = ${reset.id}`
    return c.json({ error: 'Invalid or expired code' }, 400)
  }

  const [user] = await sql`SELECT id FROM users WHERE email = ${normalized}`
  if (!user) return c.json({ error: 'Invalid or expired code' }, 400)

  const hash = hashPassword(password)
  await sql`UPDATE users SET password_hash = ${hash}, updated_at = now() WHERE id = ${user.id}`
  await sql`UPDATE password_resets SET used = true WHERE id = ${reset.id}`

  // revoke existing logins so a stolen session cant outlive the reset
  await sql`DELETE FROM sessions WHERE user_id = ${user.id}`
  await sql`DELETE FROM refresh_tokens WHERE user_id = ${user.id}`

  return c.json({ ok: true })
})

// verify PIN (called after login if user has PIN set)
app.post('/pin/verify', authMiddleware, async (c) => {
  const userId = c.get('userId')
  const { pin } = await c.req.json()

  const [user] = await sql`SELECT pin_hash FROM users WHERE id = ${userId}`
  if (!user?.pin_hash) return c.json({ ok: true }) // no PIN set, just pass through

  const [salt, hash] = user.pin_hash.split(':')
  const hashBuf = Buffer.from(hash, 'hex')
  const testBuf = scryptSync(pin, salt, 64)

  if (!timingSafeEqual(hashBuf, testBuf)) {
    return c.json({ error: 'Wrong PIN' }, 401)
  }

  // mark this device/session as unlocked so reloads dont re-prompt
  setPinCookie(c, userId)
  return c.json({ ok: true })
})

// ---- Forgot PIN recovery ---- The PIN is a soft lock on an already-authenticated session, so the

app.post('/pin/forgot', authMiddleware, rateLimit({ windowMs: 60000, max: 3, keyPrefix: 'pinreset' }), async (c) => {
  const userId = c.get('userId')
  const [user] = await sql`SELECT email, pin_hash FROM users WHERE id = ${userId}`
  if (!user?.pin_hash) return c.json({ ok: true }) // nothing to reset

  await sql`UPDATE password_resets SET used = true WHERE email = ${user.email} AND used = false`

  const code = generateResetCode()
  const codeHash = hashPassword(code)
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000)
  await sql`
    INSERT INTO password_resets (email, code_hash, expires_at)
    VALUES (${user.email}, ${codeHash}, ${expiresAt})
  `
  await sendPinResetCode(user.email, code)
  return c.json({ ok: true })
})

app.post('/pin/reset', authMiddleware, rateLimit({ windowMs: 60000, max: 10, keyPrefix: 'pinreset' }), async (c) => {
  const userId = c.get('userId')
  const { code } = await c.req.json().catch(() => ({}))
  if (!code) return c.json({ error: 'Missing code' }, 400)

  const [user] = await sql`SELECT email FROM users WHERE id = ${userId}`
  const [reset] = await sql`
    SELECT * FROM password_resets
    WHERE email = ${user.email} AND used = false AND expires_at > now()
    ORDER BY created_at DESC
    LIMIT 1
  `
  if (!reset) return c.json({ error: 'Invalid or expired code' }, 400)

  if (reset.attempts >= 5) {
    await sql`UPDATE password_resets SET used = true WHERE id = ${reset.id}`
    return c.json({ error: 'Too many attempts, request a new code' }, 429)
  }

  if (!verifyPassword(code, reset.code_hash)) {
    await sql`UPDATE password_resets SET attempts = attempts + 1 WHERE id = ${reset.id}`
    return c.json({ error: 'Invalid or expired code' }, 400)
  }

  await sql`UPDATE users SET pin_hash = null WHERE id = ${userId}`
  await sql`UPDATE password_resets SET used = true WHERE id = ${reset.id}`
  setPinCookie(c, userId) // unlock this session so the app opens immediately
  return c.json({ ok: true })
})

// logout - clear both tokens
app.post('/logout', async (c) => {
  const body = await c.req.json().catch(() => ({} as Record<string, string>))
  const accessToken = getCookie(c, 'session') || bearerToken(c)
  const refreshToken = getCookie(c, 'refresh_token') || body.refresh_token

  if (accessToken) await sql`DELETE FROM sessions WHERE token = ${accessToken}`
  if (refreshToken) await sql`DELETE FROM refresh_tokens WHERE token = ${refreshToken}`

  deleteCookie(c, 'session')
  deleteCookie(c, 'refresh_token')
  deleteCookie(c, 'pin_ok')
  return c.json({ ok: true })
})

// me reports requires_pin so the client gates on startup
app.get('/me', authMiddleware, async (c) => {
  const user = c.get('user')
  const [row] = await sql`SELECT pin_hash IS NOT NULL AS pin_enabled FROM users WHERE id = ${user.id}`
  const pinEnabled = !!row?.pin_enabled
  const requires_pin = pinEnabled && !pinTokenValid(getCookie(c, 'pin_ok'), user.id)
  return c.json({ user: { ...user, pin_enabled: pinEnabled }, requires_pin })
})

export default app
