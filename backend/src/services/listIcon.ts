import { choice, TypeSafeClient } from '@typesafe-ai/sdk'
import sql from '../db/client.js'
import { broadcastToListMembers } from '../ws/pubsub.js'

// icon keys match frontend android and desktop icon sets
const ICONS = {
  hash: 'Generic topic or channel, numbered things',
  inbox: 'Inbox, incoming items, things to triage',
  briefcase: 'Work, job, office, business, clients',
  home: 'Home, household chores, family, apartment, cleaning',
  star: 'Favourites, important, highlights, goals',
  heart: 'Love, relationship, partner, health, wellbeing, self-care',
  cart: 'Shopping, groceries, things to buy, store',
  list: 'General to-dos, miscellaneous, nothing more specific fits',
  checks: 'Checklists, routines, habits, packing lists',
  calendar: 'Events, schedule, appointments, plans by date, weekly plan',
  book: 'Books, reading list, study notes, learning',
  code: 'Programming, software development, coding projects, bugs',
  music: 'Music, songs, playlists, concerts, instruments',
  camera: 'Photography, photos, video, filming',
  coffee: 'Cafés, breaks, morning routine, social meetups',
  zap: 'Quick tasks, urgent, energy, electricity, ideas to act on fast',
  flag: 'Milestones, priorities, deadlines, important flags',
  bell: 'Reminders, alerts, notifications',
  bookmark: 'Saved for later, links, articles to read, watch later',
  folder: 'Projects, archive, documents, organizing',
  file: 'Paperwork, documents, forms, writing, reports',
  tag: 'Labels, categories, sales, deals, items to sell',
  dollar: 'Money, finances, bills, budget, taxes, payments, investments',
  gift: 'Gifts, birthdays, presents, wishlist, holidays',
  plane: 'Travel, trips, vacation, flights, packing for a trip',
  car: 'Car, vehicle maintenance, driving, commute',
  dumbbell: 'Fitness, gym, workouts, sport, exercise, running',
  graduation: 'School, university, homework, exams, courses, education',
  lightbulb: 'Ideas, brainstorming, inventions, inspiration',
  leaf: 'Garden, plants, nature, environment, eco, recycling',
  sun: 'Summer, outdoors, daytime, today, weather',
  moon: 'Night, evening routine, sleep, dreams',
  cloud: 'Cloud services, servers, hosting, weather, someday/maybe',
  pizza: 'Food, recipes, cooking, meal plans, restaurants',
  game: 'Video games, gaming, board games, fun, hobbies',
  wrench: 'Repairs, fixes, maintenance, DIY, tools, renovation',
  palette: 'Art, design, drawing, painting, creative projects',
  target: 'Goals, objectives, focus, resolutions, OKRs',
  trophy: 'Achievements, competitions, wins, challenges',
  users: 'Team, group, people, meetings, community, friends',
  phone: 'Calls to make, contacts, phone, mobile',
  mail: 'Email, letters, messages to send, correspondence',
  map: 'Places, locations, errands around town, places to visit',
  shield: 'Security, safety, insurance, privacy, passwords',
  smile: 'Personal, fun, happiness, mood, kids',
  paw: 'Pets, dog, cat, animals, vet',
  rocket: 'Launches, startup, side projects, ambitious goals',
  webhook: 'Webhooks, automations, integrations, APIs',
  github: 'GitHub, repositories, pull requests, open source issues',
} as const satisfies Record<string, string>

type IconKey = keyof typeof ICONS

// jev latest follows TypeSafes newest release pin it with JEV_MODEL
const MODEL = process.env.JEV_MODEL || 'jev-latest'
// below this the name says too little Stuff Misc and the default is the honest answer
const MIN_CONFIDENCE = 0.3
// calls to TypeSafe per minute for the whole API so one crowd cannot spend the key
const UPSTREAM_PER_MIN = 240
// previews per user and minute the dialogs debounce typing so a person stays well under it
const PER_USER = 40
let upstream = { n: 0, until: 0 }
const users = new Map<string, { n: number; until: number }>()

function allowUpstream(now = Date.now()): boolean {
  if (upstream.until < now) upstream = { n: 0, until: now + 60_000 }
  return ++upstream.n <= UPSTREAM_PER_MIN
}

function allowUser(userId: string, now = Date.now()): boolean {
  if (users.size > 5000) for (const [k, v] of users) if (v.until < now) users.delete(k)
  const r = users.get(userId)
  if (!r || r.until < now) {
    users.set(userId, { n: 1, until: now + 60_000 })
    return true
  }
  return ++r.n <= PER_USER
}

// names repeat Work Pirkiniai and a preview is asked again on every pause keep recent answers
const CACHE_MAX = 5000
const cache = new Map<string, IconKey | null>()

function normalizeName(name: string): string {
  return name.normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 120)
}

// the SDK drains a clone of each response while also holding a reader on the original which Bun refuses Body already used
const bunSafeFetch = (async (input, init) => {
  const res = await fetch(input, init)
  const out = new Response(await res.arrayBuffer(), {
    status: res.status,
    statusText: res.statusText,
    headers: res.headers,
  })
  Object.defineProperty(out, 'body', { get: () => null })
  return out
}) as typeof fetch

let client: TypeSafeClient | null = null
function jev(): TypeSafeClient | null {
  if (!process.env.TYPESAFE_API_KEY) return null
  return (client ??= new TypeSafeClient({
    defaultModel: MODEL,
    timeout: 10_000,
    retry: { maxRetries: 1 },
    fetch: bunSafeFetch as never,
  }))
}

export async function pickListIcon(name: string): Promise<IconKey | null> {
  const q = normalizeName(name)
  if (!q) return null
  if (cache.has(q)) return cache.get(q)!
  const c = jev()
  if (!c || !allowUpstream()) return null
  const res = await c.systemOne({
    state: `Name of a new to-do list (may be in any language, often Lithuanian or English): ${q}`,
    questions: {
      icon: choice('Which icon best represents what this to-do list is about?', ICONS),
    },
  })
  const a = res.answers.icon
  const icon = a.confidence >= MIN_CONFIDENCE ? (a.choice as IconKey) : null
  // oldest first in a Map so dropping the first key keeps the newest answers
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value!)
  cache.set(q, icon)
  return icon
}

export async function suggestListIcon(userId: string, name: string): Promise<IconKey | null> {
  const q = normalizeName(name)
  if (!q) return null
  if (cache.has(q)) return cache.get(q)!
  if (!allowUser(userId)) return null
  return pickListIcon(q)
}

export function assignListIcon(listId: string, name: string): void {
  pickListIcon(name)
    .then(async (icon) => {
      if (!icon) return
      const [updated] = await sql`
        UPDATE lists SET icon = ${icon}, updated_at = now()
        WHERE id = ${listId} AND icon IS NULL
        RETURNING *
      `
      if (updated) await broadcastToListMembers(listId, { type: 'list.updated', data: updated })
    })
    .catch((e) => console.error('listIcon: failed:', (e as Error).message))
}
