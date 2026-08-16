import { t, type MessageKey } from './i18n'

const API_BASE = '/api'

let refreshPromise: Promise<boolean> | null = null

async function tryRefresh(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    })
      .then((r) => r.ok)
      .catch(() => false)
      .finally(() => {
        refreshPromise = null
      })
  }
  return refreshPromise
}

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  retry = true
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  })

  if (res.status === 401 && retry) {
    const refreshed = await tryRefresh()
    if (refreshed) {
      return request<T>(path, options, false)
    }

    if (!path.includes('/auth/')) {
      window.dispatchEvent(new CustomEvent('auth:expired'))
    }
    throw new ApiError(t('api.unauthorized' as MessageKey), 401)
  }

  if (!res.ok) {
    let message = t('api.requestFailed' as MessageKey, { status: res.status })
    try {
      const data = await res.json()
      if (data.error) message = data.error
    } catch {}
    throw new ApiError(message, res.status)
  }

  if (res.status === 204) return null as T
  const contentType = res.headers.get('content-type')
  if (contentType?.includes('application/json')) {
    return res.json()
  }
  return res.text() as unknown as T
}

export const PAGE_SIZE = 200

const MAX_PAGES = 50

export async function fetchAllPages<T>(
  path: string,
  key: string,
  params?: URLSearchParams,
): Promise<T[]> {
  const all: T[] = []
  let offset: number | null = 0

  for (let page = 0; page < MAX_PAGES && offset !== null; page++) {
    const query = new URLSearchParams(params)
    query.set('limit', String(PAGE_SIZE))
    query.set('offset', String(offset))

    const data = await request<Record<string, unknown>>(`${path}?${query}`)
    const rows = data[key]
    if (Array.isArray(rows)) all.push(...(rows as T[]))

    const next = data.nextOffset
    offset = typeof next === 'number' ? next : null
  }

  return all
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PUT', body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'DELETE', body: body ? JSON.stringify(body) : undefined }),
}

export interface User {
  id: string
  email: string
  name: string
  avatar_url?: string | null
  pin_enabled?: boolean
}

export interface List {
  id: string
  owner_id: string
  name: string
  color?: string | null
  icon?: string | null
  position: number
  task_count?: number
  is_shared?: boolean
  my_role?: string
  created_at: string
}

export interface Member {
  id: string
  email: string
  name: string
  avatar_url?: string | null
  role: 'owner' | 'editor' | 'viewer'
  created_at: string
}

export interface Task {
  id: string
  list_id: string
  list_name?: string
  parent_id?: string | null
  created_by?: string
  assigned_to?: string | null
  assignee_name?: string | null
  assignee_avatar?: string | null
  title: string
  notes?: string | null
  priority: 'none' | 'low' | 'medium' | 'high'
  status: 'todo' | 'in_progress' | 'done'
  due_date?: string | null
  start_date?: string | null
  completed_at?: string | null
  position: number
  recurrence_rule?: string | null
  tag_names?: string[] | null
  tag_ids?: string[] | null
  subtask_count?: number
  created_at: string
  updated_at: string
}

export interface Tag {
  id: string
  owner_id: string
  name: string
  color?: string | null
}

export interface Webhook {
  id: string
  user_id: string
  name: string
  url?: string | null
  direction: 'outgoing' | 'incoming'
  secret?: string | null
  events?: string[] | null
  enabled: boolean
  incoming_token?: string | null
  created_at: string
}

export interface ApiKey {
  id: string
  name: string
  key_prefix: string
  last_used_at?: string | null
  created_at: string
}

export interface WebhookDelivery {
  id: string
  webhook_id: string
  event: string
  payload: unknown
  status_code?: number | null
  response_body?: string | null
  delivered_at?: string | null
  error?: string | null
  created_at: string
}

export type GithubItemKind = 'issue' | 'pull_request' | 'security'

export interface GithubItem {
  id: string
  task_id?: string | null
  kind: GithubItemKind
  external_key: string
  repo: string
  number?: number | null
  title: string
  url: string
  state?: string | null
  author?: string | null
  severity?: string | null
  labels?: string[] | null
  item_updated_at?: string | null
  synced_at?: string | null
}

export interface GithubConnection {
  github_login?: string | null
  scopes?: string | null
  sync_issues: boolean
  sync_pull_requests: boolean
  sync_security: boolean
  list_id?: string | null
  last_synced_at?: string | null
  last_error?: string | null
}

export interface GithubStatus {
  configured: boolean
  connection: GithubConnection | null
  counts: { issues: number; pull_requests: number; security: number }
}

export interface Scratchpad {
  id: string
  user_id: string
  title: string
  content: string
  position: number
  created_at: string
  updated_at: string
}

export interface Notification {
  id: string
  user_id: string
  type: string
  title: string
  body?: string | null
  read: boolean
  metadata?: Record<string, unknown> | null
  created_at: string
}
