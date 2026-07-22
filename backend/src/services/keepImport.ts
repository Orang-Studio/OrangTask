// google Keep import Google Takeout exports Keep as a folder of one .json file per note

import sql from '../db/client.js'

export interface KeepNote {
  title?: string
  textContent?: string
  listContent?: { text?: string; isChecked?: boolean }[]
  labels?: { name?: string }[]
  attachments?: { filePath?: string; mimetype?: string }[]
  isArchived?: boolean
  isTrashed?: boolean
  isPinned?: boolean
  color?: string
  createdTimestampUsec?: number
  userEditedTimestampUsec?: number
}

export interface NormalizedNote {
  title: string
  notes: string | null
  priority: 'none' | 'high'
  tagNames: string[]
  created: Date
  edited: Date
  subtasks: { title: string; done: boolean }[]
}

export interface KeepImportOptions {
  listName?: string
  includeArchived?: boolean
  includeTrashed?: boolean
}

export interface KeepImportResult {
  list: { id: string; name: string }
  imported: number
  subtasks: number
  skipped: number
}

// keep timestamps are microseconds since the epoch
function usecToDate(usec?: number): Date | null {
  if (typeof usec !== 'number' || !isFinite(usec) || usec <= 0) return null
  return new Date(Math.round(usec / 1000))
}

// notes without an explicit title use their first non-empty line as the title and the remainder as the
function deriveTitleAndNotes(n: KeepNote): { title: string; notes: string | null } {
  const rawTitle = n.title?.trim()
  const text = (n.textContent ?? '').replace(/\r\n/g, '\n')

  if (rawTitle) {
    return { title: rawTitle.slice(0, 500), notes: text.trim() || null }
  }

  const lines = text.split('\n')
  const firstIdx = lines.findIndex((l) => l.trim() !== '')
  if (firstIdx === -1) {
    return { title: n.listContent?.length ? 'Checklist' : 'Untitled note', notes: null }
  }

  const title = lines[firstIdx].trim().slice(0, 500)
  const rest = lines.slice(firstIdx + 1).join('\n').trim()
  return { title, notes: rest || null }
}

// pure mapping of one Keep note to OrangTask shape (no DB), so it can be unit-tested against real
export function normalizeKeepNote(n: KeepNote): NormalizedNote {
  // attachments (images, drawings) are dropped we import the text content only
  const { title, notes } = deriveTitleAndNotes(n)

  const created = usecToDate(n.createdTimestampUsec) ?? new Date()
  const edited = usecToDate(n.userEditedTimestampUsec) ?? created

  const tagNames: string[] = []
  for (const l of n.labels ?? []) {
    const name = l?.name?.trim()
    if (name) tagNames.push(name)
  }

  const subtasks: { title: string; done: boolean }[] = []
  for (const item of n.listContent ?? []) {
    const itemText = item?.text?.trim()
    if (!itemText) continue
    subtasks.push({ title: itemText.slice(0, 2000), done: !!item.isChecked })
  }

  return { title, notes, priority: n.isPinned ? 'high' : 'none', tagNames, created, edited, subtasks }
}

export async function importKeepNotes(
  userId: string,
  notes: KeepNote[],
  opts: KeepImportOptions = {}
): Promise<KeepImportResult> {
  const listName = (typeof opts.listName === 'string' && opts.listName.trim()) || 'Google Keep'
  const includeArchived = opts.includeArchived !== false // default: include
  const includeTrashed = opts.includeTrashed === true // default: skip

  const kept = notes.filter((n) => {
    if (n?.isTrashed && !includeTrashed) return false
    if (n?.isArchived && !includeArchived) return false
    return true
  })
  const skipped = notes.length - kept.length

  return await sql.begin(async (sql) => {
    // reuse an existing list with the same name, otherwise create one
    let [list] = await sql`
      SELECT id, name FROM lists WHERE owner_id = ${userId} AND name = ${listName} LIMIT 1
    `
    if (!list) {
      const [maxPos] = await sql`SELECT COALESCE(MAX(position), -1) + 1 as pos FROM lists WHERE owner_id = ${userId}`
      ;[list] = await sql`
        INSERT INTO lists (owner_id, name, color, icon, position)
        VALUES (${userId}, ${listName}, '#fbbc04', 'inbox', ${maxPos.pos})
        RETURNING id, name
      `
    }

    const normalized = kept.map(normalizeKeepNote)

    // upsert every distinct label once, then reuse the ids per task
    const labelNames = new Set<string>()
    for (const n of normalized) for (const name of n.tagNames) labelNames.add(name)
    const tagIds = new Map<string, string>()
    for (const name of labelNames) {
      const [tag] = await sql`
        INSERT INTO tags (owner_id, name)
        VALUES (${userId}, ${name})
        ON CONFLICT (owner_id, name) DO UPDATE SET name = EXCLUDED.name
        RETURNING id
      `
      tagIds.set(name, tag.id)
    }

    const [posRow] = await sql`
      SELECT COALESCE(MAX(position), -1) + 1 as pos FROM tasks
      WHERE list_id = ${list.id} AND parent_id IS NULL
    `
    let position = posRow.pos
    let imported = 0
    let subtasks = 0

    for (const n of normalized) {
      const [task] = await sql`
        INSERT INTO tasks (list_id, created_by, title, notes, priority, position, created_at, updated_at)
        VALUES (${list.id}, ${userId}, ${n.title}, ${n.notes}, ${n.priority}, ${position++}, ${n.created}, ${n.edited})
        RETURNING id
      `

      for (const name of n.tagNames) {
        const tagId = tagIds.get(name)
        if (tagId) {
          await sql`INSERT INTO task_tags (task_id, tag_id) VALUES (${task.id}, ${tagId}) ON CONFLICT DO NOTHING`
        }
      }

      let subPos = 0
      for (const item of n.subtasks) {
        await sql`
          INSERT INTO tasks (list_id, parent_id, created_by, title, status, completed_at, position, created_at, updated_at)
          VALUES (
            ${list.id}, ${task.id}, ${userId}, ${item.title},
            ${item.done ? 'done' : 'todo'}, ${item.done ? n.edited : null}, ${subPos++}, ${n.created}, ${n.edited}
          )
        `
        subtasks++
      }

      imported++
    }

    return { list: { id: list.id, name: list.name }, imported, subtasks, skipped }
  })
}
