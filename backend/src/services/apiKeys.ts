import { createHash, scryptSync } from 'crypto'

export const API_KEY_PREFIX = 'otk_'

export function hashApiKey(key: string): string {
  const salt = Buffer.from(key)
  return scryptSync(key, salt, 64).toString('hex')
}

export function legacyHashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex')
}
