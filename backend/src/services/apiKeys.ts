import { createHash } from 'crypto'

export const API_KEY_PREFIX = 'otk_'

export function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex')
}
