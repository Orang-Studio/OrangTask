import { Hono } from 'hono'
import sql from '../db/client.js'
import { authMiddleware } from '../middleware/auth.js'
import { fireWebhooks } from '../services/webhooks.js'
import { broadcastManyToListMembers, broadcastToListMembers, publishToUser } from '../ws/pubsub.js'
import { createNotification } from '../services/notifications.js'
import {
  MAX,
  PRIORITIES,
  STATUSES,
  dateField,
  enumField,
  firstError,
  pageParams,
  textField,
  uuidField,
} from '../lib/validate.js'
import type { AppEnv } from '../types.js'

const app = new Hono<AppEnv>()
app.use('*', authMiddleware)

async function getListRole(userId: string, listId: string): Promise<string | null> {
  const [access] = await sql`
    SELECT CASE WHEN l.owner_id = ${userId} THEN 'owner' ELSE lm.role END as role
    FROM lists l
    LEFT JOIN list_members lm ON lm.list_id = l.id AND lm.user_id = ${userId}
    WHERE l.id = ${listId} AND (l.owner_id = ${userId} OR lm.user_id = ${userId})
  `
  return access?.role ?? null
}

async function canAccessList(userId: string, listId: string) {
  return (await getListRole(userId, listId)) !== null
}

async function parentError(listId: string, parentId: string): Promise<string | null> {
  const [parent] = await sql`SELECT list_id FROM tasks WHERE id = ${parentId}`
  if (!parent || parent.list_id !== listId) return 'Parent task must be another task in the same list'
  return null
}

async function canAccessTask(userId: string, taskId: string) {
  const [access] = await sql`
    SELECT t.*, CASE WHEN l.owner_id = ${userId} THEN 'owner' ELSE lm.role END as my_role
    FROM tasks t
    JOIN lists l ON l.id = t.list_id
    LEFT JOIN list_members lm ON lm.list_id = t.list_id AND lm.user_id = ${userId}
    WHERE t.id = ${taskId} AND (l.owner_id = ${userId} OR lm.user_id = ${userId})
  `
  return access || null
}

app.get('/', async (c) => {
  const userId = c.get('userId')
  const { listId, smart, parentId } = c.req.query()

  const { limit, offset } = pageParams(c.req.query())

  let tasks

  if (smart === 'today') {
    tasks = await sql`
      SELECT t.*, au.name as assignee_name, au.avatar_url as assignee_avatar,
        (SELECT ARRAY_AGG(tg.name ORDER BY tg.id) FROM task_tags tt JOIN tags tg ON tg.id = tt.tag_id WHERE tt.task_id = t.id) as tag_names,
        (SELECT ARRAY_AGG(tg.id ORDER BY tg.id) FROM task_tags tt JOIN tags tg ON tg.id = tt.tag_id WHERE tt.task_id = t.id) as tag_ids
      FROM tasks t
      JOIN lists l ON l.id = t.list_id
      LEFT JOIN list_members lm ON lm.list_id = t.list_id AND lm.user_id = ${userId}
      LEFT JOIN users au ON au.id = t.assigned_to
      WHERE (l.owner_id = ${userId} OR lm.user_id = ${userId})
        AND t.status != 'done'
        AND (t.due_date::date = CURRENT_DATE OR t.start_date::date = CURRENT_DATE)
        AND t.parent_id IS NULL
      GROUP BY t.id, au.id
      ORDER BY t.position, t.due_date
      LIMIT ${limit} OFFSET ${offset}
    `
  } else if (smart === 'assigned') {
    tasks = await sql`
      SELECT t.*, au.name as assignee_name, au.avatar_url as assignee_avatar,
        l.name as list_name,
        (SELECT ARRAY_AGG(tg.name ORDER BY tg.id) FROM task_tags tt JOIN tags tg ON tg.id = tt.tag_id WHERE tt.task_id = t.id) as tag_names,
        (SELECT ARRAY_AGG(tg.id ORDER BY tg.id) FROM task_tags tt JOIN tags tg ON tg.id = tt.tag_id WHERE tt.task_id = t.id) as tag_ids
      FROM tasks t
      JOIN lists l ON l.id = t.list_id
      LEFT JOIN list_members lm ON lm.list_id = t.list_id AND lm.user_id = ${userId}
      LEFT JOIN users au ON au.id = t.assigned_to
      WHERE (l.owner_id = ${userId} OR lm.user_id = ${userId})
        AND ${userId} = ANY(t.assignee_ids)
        AND t.status != 'done'
      GROUP BY t.id, au.id, l.name
      ORDER BY t.due_date NULLS LAST, t.position
      LIMIT ${limit} OFFSET ${offset}
    `
  } else if (smart === 'week') {
    tasks = await sql`
      SELECT t.*, au.name as assignee_name, au.avatar_url as assignee_avatar,
        (SELECT ARRAY_AGG(tg.name ORDER BY tg.id) FROM task_tags tt JOIN tags tg ON tg.id = tt.tag_id WHERE tt.task_id = t.id) as tag_names,
        (SELECT ARRAY_AGG(tg.id ORDER BY tg.id) FROM task_tags tt JOIN tags tg ON tg.id = tt.tag_id WHERE tt.task_id = t.id) as tag_ids
      FROM tasks t
      JOIN lists l ON l.id = t.list_id
      LEFT JOIN list_members lm ON lm.list_id = t.list_id AND lm.user_id = ${userId}
      LEFT JOIN users au ON au.id = t.assigned_to
      WHERE (l.owner_id = ${userId} OR lm.user_id = ${userId})
        AND t.status != 'done'
        AND t.due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + interval '7 days'
        AND t.parent_id IS NULL
      GROUP BY t.id, au.id
      ORDER BY t.due_date, t.position
      LIMIT ${limit} OFFSET ${offset}
    `
  } else if (smart === 'calendar') {
    // month grid of the Upcoming page every dated top level task in from to done ones too
    const { from, to } = c.req.query()
    const start = new Date(from ?? '')
    const end = new Date(to ?? '')
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) {
      return c.json({ error: 'from and to must be dates, with from before to' }, 400)
    }
    if (end.getTime() - start.getTime() > 62 * 86400000) {
      return c.json({ error: 'Range can be at most 62 days' }, 400)
    }
    tasks = await sql`
      SELECT t.*, au.name as assignee_name, au.avatar_url as assignee_avatar,
        l.name as list_name, l.color as list_color,
        (SELECT ARRAY_AGG(tg.name ORDER BY tg.id) FROM task_tags tt JOIN tags tg ON tg.id = tt.tag_id WHERE tt.task_id = t.id) as tag_names,
        (SELECT ARRAY_AGG(tg.id ORDER BY tg.id) FROM task_tags tt JOIN tags tg ON tg.id = tt.tag_id WHERE tt.task_id = t.id) as tag_ids
      FROM tasks t
      JOIN lists l ON l.id = t.list_id
      LEFT JOIN list_members lm ON lm.list_id = t.list_id AND lm.user_id = ${userId}
      LEFT JOIN users au ON au.id = t.assigned_to
      WHERE (l.owner_id = ${userId} OR lm.user_id = ${userId})
        AND t.due_date >= ${start} AND t.due_date < ${end}
        AND t.parent_id IS NULL
      GROUP BY t.id, au.id, l.id
      ORDER BY t.due_date, t.position
      LIMIT ${limit} OFFSET ${offset}
    `
  } else if (smart === 'overdue') {
    tasks = await sql`
      SELECT t.*, au.name as assignee_name, au.avatar_url as assignee_avatar,
        (SELECT ARRAY_AGG(tg.name ORDER BY tg.id) FROM task_tags tt JOIN tags tg ON tg.id = tt.tag_id WHERE tt.task_id = t.id) as tag_names,
        (SELECT ARRAY_AGG(tg.id ORDER BY tg.id) FROM task_tags tt JOIN tags tg ON tg.id = tt.tag_id WHERE tt.task_id = t.id) as tag_ids
      FROM tasks t
      JOIN lists l ON l.id = t.list_id
      LEFT JOIN list_members lm ON lm.list_id = t.list_id AND lm.user_id = ${userId}
      LEFT JOIN users au ON au.id = t.assigned_to
      WHERE (l.owner_id = ${userId} OR lm.user_id = ${userId})
        AND t.status != 'done'
        AND t.due_date < CURRENT_DATE
        AND t.parent_id IS NULL
      GROUP BY t.id, au.id
      ORDER BY t.due_date, t.position
      LIMIT ${limit} OFFSET ${offset}
    `
  } else if (smart === 'all') {
    tasks = await sql`
      SELECT t.*, au.name as assignee_name, au.avatar_url as assignee_avatar,
        (SELECT ARRAY_AGG(tg.name ORDER BY tg.id) FROM task_tags tt JOIN tags tg ON tg.id = tt.tag_id WHERE tt.task_id = t.id) as tag_names,
        (SELECT ARRAY_AGG(tg.id ORDER BY tg.id) FROM task_tags tt JOIN tags tg ON tg.id = tt.tag_id WHERE tt.task_id = t.id) as tag_ids
      FROM tasks t
      JOIN lists l ON l.id = t.list_id
      LEFT JOIN list_members lm ON lm.list_id = t.list_id AND lm.user_id = ${userId}
      LEFT JOIN users au ON au.id = t.assigned_to
      WHERE (l.owner_id = ${userId} OR lm.user_id = ${userId})
        AND t.parent_id IS NULL
      GROUP BY t.id, au.id
      ORDER BY t.position, t.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `
  } else if (listId) {
    const hasAccess = await canAccessList(userId, listId)
    if (!hasAccess) return c.json({ error: 'Not found' }, 404)

    const query = parentId
      ? sql`t.list_id = ${listId} AND t.parent_id = ${parentId}`
      : sql`t.list_id = ${listId} AND t.parent_id IS NULL`

    tasks = await sql`
      SELECT t.*, au.name as assignee_name, au.avatar_url as assignee_avatar,
        (SELECT ARRAY_AGG(tg.name ORDER BY tg.id) FROM task_tags tt JOIN tags tg ON tg.id = tt.tag_id WHERE tt.task_id = t.id) as tag_names,
        (SELECT ARRAY_AGG(tg.id ORDER BY tg.id) FROM task_tags tt JOIN tags tg ON tg.id = tt.tag_id WHERE tt.task_id = t.id) as tag_ids,
        (SELECT COUNT(*) FROM tasks sub WHERE sub.parent_id = t.id) as subtask_count
      FROM tasks t
      LEFT JOIN users au ON au.id = t.assigned_to
      WHERE ${query}
      GROUP BY t.id, au.id
      ORDER BY t.position, t.created_at
      LIMIT ${limit} OFFSET ${offset}
    `
  } else {
    return c.json({ error: 'Provide listId or smart parameter' }, 400)
  }

  const nextOffset = tasks.length === limit ? offset + limit : null
  return c.json({ tasks, nextOffset })
})

// assignee_ids wins a bare assigned_to older clients means just that one
function normalizeAssignees(body: Record<string, unknown>): string[] | null | undefined {
  if ('assignee_ids' in body) {
    const ids = body.assignee_ids ?? []
    if (!Array.isArray(ids) || ids.some((id) => typeof id !== 'string' || uuidField(id, 'id'))) return undefined
    return [...new Set(ids as string[])]
  }
  if ('assigned_to' in body) {
    if (uuidField(body.assigned_to, 'assigned_to')) return undefined
    return body.assigned_to ? [body.assigned_to as string] : []
  }
  return null
}

async function allMembers(ids: string[], listId: string): Promise<boolean> {
  for (const id of ids) if (!(await getListRole(id, listId))) return false
  return true
}

async function notifyAssignees(
  actor: { name: string },
  actorId: string,
  ids: (string | null | undefined)[],
  title: string,
  data: { task_id: string; list_id: string },
) {
  for (const id of new Set(ids)) {
    if (!id || id === actorId) continue
    await createNotification(id, 'task_assigned', `${actor.name} assigned you a task: ${title}`, undefined, data)
  }
}

app.post('/', async (c) => {
  const userId = c.get('userId')
  const body = await c.req.json()
  const { list_id, title, notes, priority, due_date, start_date, parent_id, recurrence_rule } = body
  const assignee_ids = normalizeAssignees(body)
  const assigned_to = assignee_ids?.[0] ?? null

  if (!list_id || !title) return c.json({ error: 'list_id and title required' }, 400)

  const invalid = firstError(
    textField(title, 'title', MAX.title, { required: true }),
    textField(notes, 'notes', MAX.notes),
    textField(recurrence_rule, 'recurrence_rule', MAX.recurrenceRule),
    enumField(priority, 'priority', PRIORITIES),
    dateField(due_date, 'due_date'),
    dateField(start_date, 'start_date'),
    uuidField(parent_id, 'parent_id'),
  )
  if (invalid) return c.json({ error: invalid }, 400)

  const role = await getListRole(userId, list_id)
  if (!role) return c.json({ error: 'Not found' }, 404)
  if (role === 'viewer') return c.json({ error: 'Viewers cannot add tasks' }, 403)

  if (parent_id) {
    const parentIssue = await parentError(list_id, parent_id)
    if (parentIssue) return c.json({ error: parentIssue }, 400)
  }

  if (assignee_ids === undefined) return c.json({ error: 'assignee_ids must be a list of user ids' }, 400)
  if (!(await allMembers(assignee_ids ?? [], list_id))) {
    return c.json({ error: 'Assignee is not a member of this list' }, 400)
  }

  const [maxPos] = await sql`
    SELECT COALESCE(MAX(position), -1) + 1 as pos FROM tasks
    WHERE list_id = ${list_id} AND parent_id IS NOT DISTINCT FROM ${parent_id || null}
  `

  const [task] = await sql`
    INSERT INTO tasks (list_id, parent_id, created_by, assigned_to, assignee_ids, title, notes, priority, due_date, start_date, position, recurrence_rule)
    VALUES (
      ${list_id}, ${parent_id || null}, ${userId}, ${assigned_to}, ${assignee_ids ?? []},
      ${title}, ${notes || null}, ${priority || 'none'},
      ${due_date || null}, ${start_date || null}, ${maxPos.pos},
      ${recurrence_rule || null}
    )
    RETURNING *
  `

  await notifyAssignees(c.get('user'), userId, assignee_ids ?? [], title, {
    task_id: task.id,
    list_id,
  })

  broadcastToListMembers(list_id, { type: 'task.created', data: task }).catch(() => {})
  fireWebhooks(userId, 'task.created', task).catch(() => {})

  return c.json({ task }, 201)
})

app.patch('/reorder', async (c) => {
  const userId = c.get('userId')
  const { items } = await c.req.json()

  if (!Array.isArray(items)) return c.json({ error: 'items array required' }, 400)

  if (items.length > MAX.reorderItems) {
    return c.json({ error: `At most ${MAX.reorderItems} items per reorder` }, 400)
  }
  if (items.some((i) => typeof i?.id !== 'string' || !Number.isInteger(i?.position))) {
    return c.json({ error: 'Each item needs an id and an integer position' }, 400)
  }
  if (items.length === 0) return c.json({ ok: true, updated: 0 })

  const ids: string[] = items.map((i) => i.id)

  const editable = await sql<{ id: string }[]>`
    SELECT t.id
    FROM tasks t
    JOIN lists l ON l.id = t.list_id
    LEFT JOIN list_members lm ON lm.list_id = t.list_id AND lm.user_id = ${userId}
    WHERE t.id = ANY(${sql.array(ids)}::uuid[])
      AND (l.owner_id = ${userId} OR lm.user_id = ${userId})
      AND COALESCE(CASE WHEN l.owner_id = ${userId} THEN 'owner' ELSE lm.role END, '') <> 'viewer'
  `

  const allowed = new Set(editable.map((r) => r.id))
  const moves = items.filter((i) => allowed.has(i.id))
  if (moves.length === 0) return c.json({ ok: true, updated: 0 })

  const updated = await sql`
    UPDATE tasks SET position = v.position, updated_at = now()
    FROM unnest(
      ${sql.array(moves.map((m) => m.id))}::uuid[],
      ${sql.array(moves.map((m) => m.position))}::int[]
    ) AS v(id, position)
    WHERE tasks.id = v.id AND tasks.position IS DISTINCT FROM v.position
    RETURNING tasks.*
  `

  // only rows that actually moved so other clients follow the new order
  const byList = new Map<string, unknown[]>()
  for (const task of updated) {
    byList.set(task.list_id, [...(byList.get(task.list_id) ?? []), { type: 'task.updated', data: task }])
  }
  for (const [listId, events] of byList) broadcastManyToListMembers(listId, events).catch(() => {})

  return c.json({ ok: true, updated: updated.length })
})

app.patch('/:id', async (c) => {
  const userId = c.get('userId')
  const id = c.req.param('id')
  const body = await c.req.json()

  const invalid = firstError(
    textField(body.title, 'title', MAX.title),
    textField(body.notes, 'notes', MAX.notes),
    textField(body.recurrence_rule, 'recurrence_rule', MAX.recurrenceRule),
    enumField(body.priority, 'priority', PRIORITIES),

    enumField(body.status, 'status', STATUSES),
    dateField(body.due_date, 'due_date'),
    dateField(body.start_date, 'start_date'),
    uuidField(body.parent_id, 'parent_id'),
  )
  if (invalid) return c.json({ error: invalid }, 400)

  const task = await canAccessTask(userId, id)
  if (!task) return c.json({ error: 'Not found' }, 404)
  if (task.my_role === 'viewer') return c.json({ error: 'Viewers cannot edit tasks' }, 403)

  const assignees = normalizeAssignees(body)
  if (assignees === undefined) return c.json({ error: 'assignee_ids must be a list of user ids' }, 400)
  if (assignees !== null) {
    if (!(await allMembers(assignees, task.list_id))) {
      return c.json({ error: 'Assignee is not a member of this list' }, 400)
    }
    body.assignee_ids = assignees
    body.assigned_to = assignees[0] ?? null
  }

  let movedPosition: number | null = null

  if ('parent_id' in body) {
    const nextParent: string | null = body.parent_id || null
    body.parent_id = nextParent

    if (nextParent) {
      if (nextParent === id) return c.json({ error: 'A task cannot be its own parent' }, 400)

      const parentIssue = await parentError(task.list_id, nextParent)
      if (parentIssue) return c.json({ error: parentIssue }, 400)

      const [cycle] = await sql`
        WITH RECURSIVE descendants AS (
          SELECT id FROM tasks WHERE parent_id = ${id}
          UNION
          SELECT t.id FROM tasks t JOIN descendants d ON t.parent_id = d.id
        )
        SELECT 1 FROM descendants WHERE id = ${nextParent}
      `
      if (cycle) return c.json({ error: 'Cannot move a task under one of its own subtasks' }, 400)
    }

    if ((task.parent_id ?? null) !== nextParent) {
      const [maxPos] = await sql`
        SELECT COALESCE(MAX(position), -1) + 1 as pos FROM tasks
        WHERE list_id = ${task.list_id} AND parent_id IS NOT DISTINCT FROM ${nextParent}
      `
      movedPosition = Number(maxPos.pos)
    }
  }

  const allowed = ['title', 'notes', 'priority', 'status', 'due_date', 'start_date', 'assigned_to', 'assignee_ids', 'position', 'parent_id', 'recurrence_rule']

  const sets: string[] = ['updated_at = now()']
  const values: unknown[] = []
  let idx = 1

  for (const key of allowed) {
    if (key in body) {
      sets.push(`${key} = $${idx}`)
      values.push(body[key] === undefined ? null : body[key])
      idx++
    }
  }

  if (movedPosition !== null && !('position' in body)) {
    sets.push(`position = $${idx}`)
    values.push(movedPosition)
    idx++
  }

  if (values.length === 0) return c.json({ task })

  values.push(id)
  const [updated] = await sql.unsafe(
    `UPDATE tasks SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
    values as never[]
  )

  const before = new Set<string>(task.assignee_ids ?? [])
  const newlyAssigned = (assignees ?? []).filter((a) => !before.has(a))
  await notifyAssignees(c.get('user'), userId, newlyAssigned, updated.title, { task_id: id, list_id: task.list_id })

  broadcastToListMembers(task.list_id, { type: 'task.updated', data: updated }).catch(() => {})
  fireWebhooks(userId, 'task.updated', updated).catch(() => {})

  return c.json({ task: updated })
})

app.delete('/:id', async (c) => {
  const userId = c.get('userId')
  const id = c.req.param('id')

  const task = await canAccessTask(userId, id)
  if (!task) return c.json({ error: 'Not found' }, 404)
  if (task.my_role === 'viewer') return c.json({ error: 'Viewers cannot delete tasks' }, 403)

  await sql`DELETE FROM tasks WHERE id = ${id}`

  broadcastToListMembers(task.list_id, { type: 'task.deleted', data: { id } }).catch(() => {})
  fireWebhooks(userId, 'task.deleted', task).catch(() => {})

  return c.json({ ok: true })
})

app.post('/:id/complete', async (c) => {
  const userId = c.get('userId')
  const id = c.req.param('id')

  const task = await canAccessTask(userId, id)
  if (!task) return c.json({ error: 'Not found' }, 404)
  if (task.my_role === 'viewer') return c.json({ error: 'Viewers cannot complete tasks' }, 403)

  const [updated] = await sql`
    UPDATE tasks SET status = 'done', completed_at = now(), updated_at = now()
    WHERE id = ${id}
    RETURNING *
  `

  const [list] = await sql`SELECT * FROM lists WHERE id = ${task.list_id}`
  if (list.owner_id !== userId) {
    await createNotification(
      list.owner_id,
      'task_completed_by',
      `${c.get('user').name} completed: ${task.title}`,
      undefined,
      { task_id: id, list_id: task.list_id }
    )
  }

  broadcastToListMembers(task.list_id, { type: 'task.updated', data: updated }).catch(() => {})
  fireWebhooks(userId, 'task.completed', updated).catch(() => {})

  return c.json({ task: updated })
})

app.post('/:id/uncomplete', async (c) => {
  const userId = c.get('userId')
  const id = c.req.param('id')

  const task = await canAccessTask(userId, id)
  if (!task) return c.json({ error: 'Not found' }, 404)
  if (task.my_role === 'viewer') return c.json({ error: 'Viewers cannot edit tasks' }, 403)

  const [updated] = await sql`
    UPDATE tasks SET status = 'todo', completed_at = null, updated_at = now()
    WHERE id = ${id}
    RETURNING *
  `

  broadcastToListMembers(task.list_id, { type: 'task.updated', data: updated }).catch(() => {})
  return c.json({ task: updated })
})

app.post('/:id/tags/:tagId', async (c) => {
  const userId = c.get('userId')
  const taskId = c.req.param('id')
  const tagId = c.req.param('tagId')

  const task = await canAccessTask(userId, taskId)
  if (!task) return c.json({ error: 'Not found' }, 404)
  if (task.my_role === 'viewer') return c.json({ error: 'Viewers cannot edit tasks' }, 403)

  // only your own tags or ones a member already uses in this list
  const [usable] = await sql`
    SELECT 1 FROM tags tg WHERE tg.id = ${tagId} AND (tg.owner_id = ${userId} OR EXISTS (
      SELECT 1 FROM task_tags tt JOIN tasks t ON t.id = tt.task_id
      WHERE tt.tag_id = tg.id AND t.list_id = ${task.list_id}
    ))
  `
  if (!usable) return c.json({ error: 'Tag not found' }, 404)

  await sql`
    INSERT INTO task_tags (task_id, tag_id) VALUES (${taskId}, ${tagId})
    ON CONFLICT DO NOTHING
  `
  broadcastToListMembers(task.list_id, { type: 'task.updated', data: { id: taskId } }).catch(() => {})
  return c.json({ ok: true })
})

app.delete('/:id/tags/:tagId', async (c) => {
  const userId = c.get('userId')
  const taskId = c.req.param('id')
  const tagId = c.req.param('tagId')

  const task = await canAccessTask(userId, taskId)
  if (!task) return c.json({ error: 'Not found' }, 404)
  if (task.my_role === 'viewer') return c.json({ error: 'Viewers cannot edit tasks' }, 403)

  await sql`DELETE FROM task_tags WHERE task_id = ${taskId} AND tag_id = ${tagId}`
  broadcastToListMembers(task.list_id, { type: 'task.updated', data: { id: taskId } }).catch(() => {})
  return c.json({ ok: true })
})

export default app