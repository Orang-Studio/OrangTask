import { createHmac, randomBytes, timingSafeEqual } from 'crypto'

export const NATIVE_GITHUB_STATE_PREFIX = 'int~android~'

const STATE_TTL_MS = 10 * 60 * 1000

function stateSecret(): string {
  return process.env.SESSION_SECRET
    || process.env.GITHUB_INTEGRATION_CLIENT_SECRET
    || process.env.GITHUB_CLIENT_SECRET
    || 'orangtask-dev-secret'
}

function signature(payload: string): string {
  return createHmac('sha256', stateSecret()).update(payload).digest('base64url')
}

export function createNativeGithubState(userId: string, now = Date.now()): string {
  const payload = Buffer.from(JSON.stringify({
    uid: userId,
    exp: now + STATE_TTL_MS,
    nonce: randomBytes(16).toString('hex'),
  })).toString('base64url')
  return `${NATIVE_GITHUB_STATE_PREFIX}${payload}.${signature(payload)}`
}

export function isNativeGithubState(state?: string): boolean {
  return state?.startsWith(NATIVE_GITHUB_STATE_PREFIX) === true
}

export function nativeGithubStateUserId(state: string | undefined, now = Date.now()): string | null {
  if (!isNativeGithubState(state)) return null

  const signed = state!.slice(NATIVE_GITHUB_STATE_PREFIX.length)
  const separator = signed.lastIndexOf('.')
  if (separator <= 0) return null

  const payload = signed.slice(0, separator)
  const received = Buffer.from(signed.slice(separator + 1))
  const expected = Buffer.from(signature(payload))
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) return null

  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString()) as {
      uid?: unknown
      exp?: unknown
    }
    return typeof decoded.uid === 'string'
      && decoded.uid.length > 0
      && typeof decoded.exp === 'number'
      && decoded.exp > now
      ? decoded.uid
      : null
  } catch {
    return null
  }
}
