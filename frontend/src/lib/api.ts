// API client with automatic token refresh on 401

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
    // genuine auth failure
    if (!path.includes('/auth/')) {
      window.dispatchEvent(new CustomEvent('auth:expired'))
    }
    throw new ApiError('Unauthorized', 401)
  }

  if (!res.ok) {
    let message = `Request failed (${res.status})`
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
