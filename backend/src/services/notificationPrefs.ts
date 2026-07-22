// per-user notification channel preferences
export const NOTIFICATION_TYPES = [
  'task_due_soon',
  'task_assigned',
  'list_shared',
  'task_completed_by',
] as const

export type NotifType = (typeof NOTIFICATION_TYPES)[number]
export type ChannelPrefs = Record<string, { push: boolean; email: boolean }>

// sensible defaults when a user hasnt customised anything
export const DEFAULT_PREFS: ChannelPrefs = {
  task_due_soon: { push: true, email: true },
  task_assigned: { push: true, email: false },
  list_shared: { push: true, email: false },
  task_completed_by: { push: true, email: false },
}

// merge stored prefs with defaults and sanitise to known types/booleans
export function resolvePrefs(stored: unknown): ChannelPrefs {
  const s = stored && typeof stored === 'object' ? (stored as Record<string, any>) : {}
  const out: ChannelPrefs = {}
  for (const t of NOTIFICATION_TYPES) {
    const d = DEFAULT_PREFS[t]
    const v = s[t] && typeof s[t] === 'object' ? s[t] : {}
    out[t] = {
      push: typeof v.push === 'boolean' ? v.push : d.push,
      email: typeof v.email === 'boolean' ? v.email : d.email,
    }
  }
  return out
}
