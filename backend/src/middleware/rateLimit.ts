import { Context, Next } from 'hono'
import redis from '../services/redis.js'

interface RateLimitOptions {
  windowMs: number
  max: number
  keyPrefix?: string
}

export function clientIp(c: Context): string {
  const real = c.req.header('x-real-ip')?.trim()
  if (real) return real

  const forwarded = c.req.header('x-forwarded-for')
  if (forwarded) {
    const hops = forwarded.split(',').map((h) => h.trim()).filter(Boolean)
    if (hops.length > 0) return hops[hops.length - 1]
  }

  return 'unknown'
}

const INCR_WITH_TTL = `
local c = redis.call('INCR', KEYS[1])
if redis.call('TTL', KEYS[1]) < 0 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
end
return c
`

export function rateLimit({ windowMs, max, keyPrefix = 'rl' }: RateLimitOptions) {
  const windowSec = Math.max(1, Math.floor(windowMs / 1000))

  return async (c: Context, next: Next) => {
    const key = `${keyPrefix}:${clientIp(c)}`

    let count: number
    try {
      count = (await redis.eval(INCR_WITH_TTL, 1, key, String(windowSec))) as number
    } catch (err) {

      console.error('Rate limiter unavailable, allowing request:', err)
      return next()
    }

    if (count > max) {
      c.header('Retry-After', String(windowSec))
      return c.json({ error: 'Too many requests' }, 429)
    }

    await next()
  }
}
