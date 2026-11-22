import { t, tCount, type MessageKey } from './i18n'

export const MAX_INTERVAL = 999
export const MAX_COUNT = 999

export const LAST_WEEK_ORDINAL = -1

export type RecurrenceFreq = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY'
export type MonthlyMode = 'dayOfMonth' | 'dayOfWeek'
export type RecurrenceEnd = 'never' | 'onDate' | 'afterCount'

export const FREQUENCIES: RecurrenceFreq[] = ['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY']

export interface Recurrence {
  freq: RecurrenceFreq
  interval: number
  byDay: number[]
  monthlyMode: MonthlyMode
  monthDay: number
  weekOrdinal: number
  monthWeekday: number
  count: number | null
  until: string | null
}

const DAY_CODES = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA']

const KNOWN_PARTS = new Set(['FREQ', 'INTERVAL', 'BYDAY', 'BYMONTHDAY', 'BYSETPOS', 'COUNT', 'UNTIL', 'WKST'])

const BYDAY_ENTRY = /^([+-]?\d+)?([A-Z]{2})$/

export function emptyRecurrence(freq: RecurrenceFreq = 'WEEKLY'): Recurrence {
  return {
    freq,
    interval: 1,
    byDay: [],
    monthlyMode: 'dayOfMonth',
    monthDay: 1,
    weekOrdinal: 1,
    monthWeekday: 1,
    count: null,
    until: null,
  }
}

export function recurrenceEnd(recurrence: Recurrence): RecurrenceEnd {
  if (recurrence.count !== null) return 'afterCount'
  if (recurrence.until !== null) return 'onDate'
  return 'never'
}

export function toRrule(recurrence: Recurrence): string {
  let out = `FREQ=${recurrence.freq}`
  if (recurrence.interval > 1) out += `;INTERVAL=${recurrence.interval}`
  if (recurrence.freq === 'WEEKLY') {
    if (recurrence.byDay.length > 0) {
      // monday first matching the order the Android client emits
      const isoOrder = (d: number) => (d + 6) % 7
      const days = [...recurrence.byDay].sort((a, b) => isoOrder(a) - isoOrder(b)).map((d) => DAY_CODES[d])
      out += `;BYDAY=${days.join(',')}`
    }
  } else if (recurrence.freq === 'MONTHLY') {
    if (recurrence.monthlyMode === 'dayOfMonth') out += `;BYMONTHDAY=${recurrence.monthDay}`
    else out += `;BYDAY=${recurrence.weekOrdinal}${DAY_CODES[recurrence.monthWeekday]}`
  }
  if (recurrence.count !== null) out += `;COUNT=${recurrence.count}`
  if (recurrence.until !== null) out += `;UNTIL=${recurrence.until.replace(/-/g, '')}T000000Z`
  return out
}

function parseInteger(raw: string, min: number, max: number): number | null {
  if (!/^\d+$/.test(raw)) return null
  const value = Number(raw)
  return value >= min && value <= max ? value : null
}

export function parseRecurrence(rule: string | null | undefined): Recurrence | null {
  const body = (rule ?? '').trim().replace(/^RRULE:/i, '').trim().toUpperCase()
  if (!body) return null

  const parts = new Map<string, string>()
  for (const chunk of body.split(';')) {
    if (!chunk.trim()) continue
    const eq = chunk.indexOf('=')
    if (eq <= 0) return null
    const key = chunk.slice(0, eq)
    const value = chunk.slice(eq + 1)
    if (!value || !KNOWN_PARTS.has(key)) return null
    parts.set(key, value)
  }

  const freq = FREQUENCIES.find((f) => f === parts.get('FREQ'))
  if (!freq) return null

  let interval = 1
  if (parts.has('INTERVAL')) {
    const parsed = parseInteger(parts.get('INTERVAL')!, 1, MAX_INTERVAL)
    if (parsed === null) return null
    interval = parsed
  }

  const byDayEntries: Array<{ ordinal: number | null; day: number }> = []
  for (const entry of (parts.get('BYDAY') ?? '').split(',').map((e) => e.trim()).filter(Boolean)) {
    const match = BYDAY_ENTRY.exec(entry)
    if (!match) return null
    const day = DAY_CODES.indexOf(match[2])
    if (day < 0) return null
    byDayEntries.push({ ordinal: match[1] ? Number(match[1]) : null, day })
  }

  let count: number | null = null
  if (parts.has('COUNT')) {
    count = parseInteger(parts.get('COUNT')!, 1, MAX_COUNT)
    if (count === null) return null
  }

  let until: string | null = null
  if (parts.has('UNTIL')) {
    const datePart = parts.get('UNTIL')!.split('T')[0]
    if (!/^\d{8}$/.test(datePart)) return null
    const iso = `${datePart.slice(0, 4)}-${datePart.slice(4, 6)}-${datePart.slice(6, 8)}`
    const probe = new Date(`${iso}T00:00:00Z`)
    if (Number.isNaN(probe.getTime()) || probe.toISOString().slice(0, 10) !== iso) return null
    until = iso
  }
  if (count !== null && until !== null) return null

  const result: Recurrence = { ...emptyRecurrence(freq), interval, count, until }

  if (freq === 'WEEKLY') {
    if (byDayEntries.some((e) => e.ordinal !== null)) return null
    if (parts.has('BYMONTHDAY') || parts.has('BYSETPOS')) return null
    result.byDay = [...new Set(byDayEntries.map((e) => e.day))].sort((a, b) => a - b)
  } else if (freq === 'MONTHLY') {
    let monthDay: number | null = null
    if (parts.has('BYMONTHDAY')) {
      monthDay = parseInteger(parts.get('BYMONTHDAY')!, 1, 31)
      if (monthDay === null) return null
    }
    let setPos: number | null = null
    if (parts.has('BYSETPOS')) {
      const raw = parts.get('BYSETPOS')!
      setPos = raw === String(LAST_WEEK_ORDINAL) ? LAST_WEEK_ORDINAL : parseInteger(raw, 1, 4)
      if (setPos === null) return null
    }

    if (monthDay !== null && byDayEntries.length === 0 && setPos === null) {
      result.monthlyMode = 'dayOfMonth'
      result.monthDay = monthDay
    } else if (monthDay === null && byDayEntries.length === 1) {
      // either BYDAY 2TU or the equivalent BYDAY TU BYSETPOS 2
      const { ordinal, day } = byDayEntries[0]
      const effective = ordinal ?? setPos
      if (effective === null) return null
      if (ordinal !== null && setPos !== null && ordinal !== setPos) return null
      if (!(effective >= 1 && effective <= 4) && effective !== LAST_WEEK_ORDINAL) return null
      result.monthlyMode = 'dayOfWeek'
      result.weekOrdinal = effective
      result.monthWeekday = day
    } else if (monthDay === null && byDayEntries.length === 0 && setPos === null) {
      result.monthlyMode = 'dayOfMonth'
      result.monthDay = 1
    } else {
      return null
    }
  } else {
    if (byDayEntries.length > 0) return null
    if (parts.has('BYMONTHDAY') || parts.has('BYSETPOS')) return null
  }

  return result
}

export function defaultRecurrence(
  freq: RecurrenceFreq,
  anchor: Date,
  previous: Recurrence | null,
): Recurrence {
  const base: Recurrence = { ...(previous ?? emptyRecurrence(freq)), freq }
  if (freq === 'WEEKLY') {
    return { ...base, byDay: base.byDay.length > 0 ? base.byDay : [anchor.getDay()] }
  }
  if (freq === 'MONTHLY') {
    if (previous?.freq === 'MONTHLY') return base
    return {
      ...base,
      monthlyMode: 'dayOfMonth',
      monthDay: anchor.getDate(),
      weekOrdinal: Math.min(Math.floor((anchor.getDate() - 1) / 7) + 1, 4),
      monthWeekday: anchor.getDay(),
    }
  }
  return base
}

export function currentLocale(): string {
  if (typeof document !== 'undefined' && document.documentElement.lang) {
    return document.documentElement.lang
  }
  return 'en-US'
}

// 2024 01 07 is a Sunday so day 0 6 lands on the matching weekday
export function weekdayName(day: number, style: 'narrow' | 'short' | 'long'): string {
  const date = new Date(Date.UTC(2024, 0, 7 + day))
  return new Intl.DateTimeFormat(currentLocale(), { weekday: style, timeZone: 'UTC' }).format(date)
}

export function firstDayOfWeek(): number {
  try {
    const locale = new Intl.Locale(currentLocale()) as Intl.Locale & {
      getWeekInfo?: () => { firstDay: number }
      weekInfo?: { firstDay: number }
    }
    const first = locale.getWeekInfo?.().firstDay ?? locale.weekInfo?.firstDay
    // intl reports 1 Monday 7 Sunday JavaScript wants 0 Sunday
    if (first) return first % 7
  } catch {
    // older engines have no week info Monday is the better default for our locales
  }
  return 1
}

export function weekdayOrder(): number[] {
  const first = firstDayOfWeek()
  return Array.from({ length: 7 }, (_, i) => (first + i) % 7)
}

const WEEKDAYS_MON_TO_FRI = [1, 2, 3, 4, 5]

const ORDINAL_KEYS: Record<number, MessageKey> = {
  1: 'repeat.ordinalFirst' as MessageKey,
  2: 'repeat.ordinalSecond' as MessageKey,
  3: 'repeat.ordinalThird' as MessageKey,
  4: 'repeat.ordinalFourth' as MessageKey,
  [LAST_WEEK_ORDINAL]: 'repeat.ordinalLast' as MessageKey,
}

export function ordinalLabel(ordinal: number): string {
  return t(ORDINAL_KEYS[ordinal] ?? ORDINAL_KEYS[1])
}

export function unitKey(freq: RecurrenceFreq): string {
  switch (freq) {
    case 'DAILY':
      return 'repeat.unitDays'
    case 'WEEKLY':
      return 'repeat.unitWeeks'
    case 'MONTHLY':
      return 'repeat.unitMonths'
    case 'YEARLY':
      return 'repeat.unitYears'
  }
}

export function freqLabel(freq: RecurrenceFreq): string {
  switch (freq) {
    case 'DAILY':
      return t('repeat.freqDay' as MessageKey)
    case 'WEEKLY':
      return t('repeat.freqWeek' as MessageKey)
    case 'MONTHLY':
      return t('repeat.freqMonth' as MessageKey)
    case 'YEARLY':
      return t('repeat.freqYear' as MessageKey)
  }
}

function formatUntil(iso: string): string {
  const date = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleDateString(currentLocale(), { year: 'numeric', month: 'short', day: 'numeric' })
}

function monthlyLabel(recurrence: Recurrence): string {
  if (recurrence.monthlyMode === 'dayOfMonth') {
    return t('repeat.monthlyDayOption' as MessageKey, { day: recurrence.monthDay })
  }
  return t('repeat.monthlyNth' as MessageKey, {
    ordinal: ordinalLabel(recurrence.weekOrdinal),
    weekday: weekdayName(recurrence.monthWeekday, 'long'),
  })
}

export function describeRecurrence(rule: string | null | undefined): string {
  if (!rule || !rule.trim()) return t('repeat.never' as MessageKey)
  const recurrence = parseRecurrence(rule)
  if (!recurrence) return t('repeat.customRule' as MessageKey)

  const parts: string[] = []
  if (recurrence.interval === 1) {
    parts.push(
      t(
        {
          DAILY: 'repeat.daily',
          WEEKLY: 'repeat.weekly',
          MONTHLY: 'repeat.monthly',
          YEARLY: 'repeat.yearly',
        }[recurrence.freq] as MessageKey,
      ),
    )
  } else {
    parts.push(
      t('repeat.summaryEvery' as MessageKey, {
        interval: recurrence.interval,
        unit: tCount(unitKey(recurrence.freq), recurrence.interval),
      }),
    )
  }

  if (recurrence.freq === 'WEEKLY' && recurrence.byDay.length > 0) {
    const days = [...recurrence.byDay].sort((a, b) => a - b)
    if (days.length === 5 && WEEKDAYS_MON_TO_FRI.every((d) => days.includes(d))) {
      parts.push(t('repeat.weekdays' as MessageKey))
    } else {
      const ordered = weekdayOrder().filter((d) => days.includes(d))
      parts.push(ordered.map((d) => weekdayName(d, 'short')).join(', '))
    }
  } else if (recurrence.freq === 'MONTHLY') {
    parts.push(monthlyLabel(recurrence))
  }

  if (recurrence.count !== null) {
    parts.push(`${recurrence.count} ${tCount('repeat.occurrences', recurrence.count)}`)
  } else if (recurrence.until !== null) {
    parts.push(t('repeat.summaryUntil' as MessageKey, { date: formatUntil(recurrence.until) }))
  }

  return parts.join(' · ')
}
