export const PRIORITIES = ['none', 'low', 'medium', 'high'] as const
export const STATUSES = ['todo', 'doing', 'done'] as const

export const MEMBER_ROLES = ['editor', 'viewer'] as const

export const MAX = {
  title: 500,
  notes: 20_000,
  listName: 100,
  listColor: 32,
  listIcon: 64,
  tagName: 50,
  webhookName: 100,
  webhookUrl: 2000,
  recurrenceRule: 500,

  reorderItems: 500,
} as const

export const MAX_PAGE = 200

export interface PageParams {

  limit: number | null
  offset: number
}

export function pageParams(query: Record<string, string | undefined>): PageParams {
  const rawLimit = Number(query.limit)
  const rawOffset = Number(query.offset)

  const limit = Number.isFinite(rawLimit) && rawLimit > 0
    ? Math.min(Math.floor(rawLimit), MAX_PAGE)
    : null

  const offset = Number.isFinite(rawOffset) && rawOffset > 0
    ? Math.floor(rawOffset)
    : 0

  return { limit, offset }
}

export function textField(
  value: unknown,
  field: string,
  max: number,
  { required = false } = {},
): string | null {
  if (value === undefined || value === null || value === '') {
    return required ? `${field} is required` : null
  }
  if (typeof value !== 'string') return `${field} must be a string`
  if (value.length > max) return `${field} must be at most ${max} characters`
  return null
}

export function enumField(
  value: unknown,
  field: string,
  allowed: readonly string[],
): string | null {
  if (value === undefined || value === null) return null
  if (typeof value !== 'string' || !allowed.includes(value)) {
    return `${field} must be one of: ${allowed.join(', ')}`
  }
  return null
}

export function urlField(value: unknown, field: string, max = 2000): string | null {
  if (value === undefined || value === null || value === '') return null
  if (typeof value !== 'string') return `${field} must be a string`
  if (value.length > max) return `${field} must be at most ${max} characters`

  let url: URL
  try {
    url = new URL(value)
  } catch {
    return `${field} must be an absolute URL`
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return `${field} must be an http or https URL`
  }
  return null
}

export function dateField(value: unknown, field: string): string | null {
  if (value === undefined || value === null || value === '') return null
  if (typeof value !== 'string' && !(value instanceof Date)) {
    return `${field} must be a date string`
  }
  if (Number.isNaN(new Date(value as string).getTime())) {
    return `${field} is not a valid date`
  }
  return null
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function uuidField(value: unknown, field: string): string | null {
  if (value === undefined || value === null || value === '') return null
  if (typeof value !== 'string' || !UUID_RE.test(value)) return `${field} must be a valid id`
  return null
}

export function firstError(...checks: (string | null)[]): string | null {
  return checks.find((c) => c !== null) ?? null
}
