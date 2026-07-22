import { Context, Next } from 'hono'
import redis from '../services/redis.js'

interface RateLimitOptions {
  windowMs: number
  max: number
  keyPrefix?: string
}

export function rateLimit({ windowMs, max, keyPrefix = 'rl' }: RateLimitOptions) {
  return async (c: Context, next: Next) => {
    const ip = c.req.header('x-forwarded-for')?.split(',')[0] || 'unknown'
    const key = `${keyPrefix}:${ip}`
    const windowSec = Math.floor(windowMs / 1000)

    const count = await redis.incr(key)
    if (count === 1) await redis.expire(key, windowSec)

    if (count > max) {
      return c.json({ error: 'Too many requests' }, 429)
    }

    await next()
  }
}
