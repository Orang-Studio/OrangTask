import { t, type MessageKey } from './i18n'

export function formatDueDate(dateStr: string | null | undefined): string {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  const now = new Date()
  const locale = typeof document !== 'undefined' && document.documentElement.lang
    ? document.documentElement.lang
    : 'en-US'
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const diffDays = Math.round((target.getTime() - today.getTime()) / 86400000)

  const hasTime = date.getHours() !== 0 || date.getMinutes() !== 0
  const timeStr = hasTime
    ? date.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' })
    : ''

  let dayStr: string
  if (diffDays === 0) dayStr = t('date.today' as MessageKey)
  else if (diffDays === 1) dayStr = t('date.tomorrow' as MessageKey)
  else if (diffDays === -1) dayStr = t('date.yesterday' as MessageKey)
  else if (diffDays > 1 && diffDays < 7) dayStr = date.toLocaleDateString(locale, { weekday: 'short' })
  else dayStr = date.toLocaleDateString(locale, { month: 'short', day: 'numeric' })

  return timeStr ? `${dayStr}, ${timeStr}` : dayStr
}

export function isOverdue(dateStr: string | null | undefined): boolean {
  if (!dateStr) return false
  return new Date(dateStr).getTime() < Date.now()
}

export function isToday(dateStr: string | null | undefined): boolean {
  if (!dateStr) return false
  const d = new Date(dateStr)
  const now = new Date()
  return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
}

export function toDateTimeLocal(dateStr: string | null | undefined): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const off = d.getTimezoneOffset()
  const local = new Date(d.getTime() - off * 60000)
  return local.toISOString().slice(0, 16)
}
