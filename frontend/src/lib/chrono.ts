import * as chrono from 'chrono-node'

export interface ParsedInput {
  title: string
  due_date: Date | null
  priority: 'none' | 'low' | 'medium' | 'high'
  recurrence_rule: string | null
}

const PRIORITY_WORDS: Record<string, ParsedInput['priority']> = {
  'high priority': 'high',
  'low priority': 'low',
  'medium priority': 'medium',
  urgent: 'high',
  '!high': 'high',
  '!medium': 'medium',
  '!low': 'low',
  p1: 'high',
  p2: 'medium',
  p3: 'low',
}

// detect simple recurrence and produce an RRULE
function detectRecurrence(text: string): { rule: string | null; matched: string | null } {
  const lower = text.toLowerCase()

  const patterns: Array<[RegExp, string]> = [
    [/\bevery day\b|\bdaily\b/, 'FREQ=DAILY'],
    [/\bevery week\b|\bweekly\b/, 'FREQ=WEEKLY'],
    [/\bevery month\b|\bmonthly\b/, 'FREQ=MONTHLY'],
    [/\bevery year\b|\byearly\b|\bannually\b/, 'FREQ=YEARLY'],
    [/\bevery monday\b/, 'FREQ=WEEKLY;BYDAY=MO'],
    [/\bevery tuesday\b/, 'FREQ=WEEKLY;BYDAY=TU'],
    [/\bevery wednesday\b/, 'FREQ=WEEKLY;BYDAY=WE'],
    [/\bevery thursday\b/, 'FREQ=WEEKLY;BYDAY=TH'],
    [/\bevery friday\b/, 'FREQ=WEEKLY;BYDAY=FR'],
    [/\bevery saturday\b/, 'FREQ=WEEKLY;BYDAY=SA'],
    [/\bevery sunday\b/, 'FREQ=WEEKLY;BYDAY=SU'],
    [/\bweekdays\b|\bevery weekday\b/, 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR'],
  ]

  for (const [regex, rule] of patterns) {
    const match = lower.match(regex)
    if (match) return { rule, matched: match[0] }
  }
  return { rule: null, matched: null }
}

export function parseQuickAdd(input: string): ParsedInput {
  let title = input
  let priority: ParsedInput['priority'] = 'none'

  // priority
  for (const [word, level] of Object.entries(PRIORITY_WORDS)) {
    const idx = title.toLowerCase().indexOf(word)
    if (idx !== -1) {
      priority = level
      title = (title.slice(0, idx) + title.slice(idx + word.length)).trim()
      break
    }
  }

  // recurrence
  const { rule, matched } = detectRecurrence(title)
  if (matched) {
    const idx = title.toLowerCase().indexOf(matched)
    title = (title.slice(0, idx) + title.slice(idx + matched.length)).trim()
  }

  // date parsing
  const results = chrono.parse(title, new Date(), { forwardDate: true })
  let due_date: Date | null = null

  if (results.length > 0) {
    const result = results[0]
    due_date = result.start.date()
    // remove the matched date text from the title
    title = (title.slice(0, result.index) + title.slice(result.index + result.text.length)).trim()
  }

  // cleanup leftover prepositions
  title = title.replace(/\s+(on|at|by|in|every)\s*$/i, '').trim()
  title = title.replace(/\s{2,}/g, ' ').trim()

  return { title, due_date, priority, recurrence_rule: rule }
}
