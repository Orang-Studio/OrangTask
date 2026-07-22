import { Hono } from 'hono'
import sql from '../db/client.js'
import { authMiddleware } from '../middleware/auth.js'
import { fireWebhooks } from '../services/webhooks.js'
import { broadcastToListMembers, publishToUser } from '../ws/pubsub.js'
import { createNotification } from '../services/notifications.js'
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

  let tasks

  if (smart === 'today') {
    tasks = await sql`
      SELECT t.*, au.name as assignee_name, au.avatar_url as assignee_avatar,
        ARRAY_AGG(DISTINCT tg.name) FILTER (WHERE tg.id IS NOT NULL) as tag_names,
        ARRAY_AGG(DISTINCT tg.id) FILTER (WHERE tg.id IS NOT NULL) as tag_ids
      FROM tasks t
      JOIN lists l ON l.id = t.list_id
      LEFT JOIN list_members lm ON lm.list_id = t.list_id AND lm.user_id = ${userId}
      LEFT JOIN users au ON au.id = t.assigned_to
      LEFT JOIN task_tags tt ON tt.task_id = t.id
      LEFT JOIN tags tg ON tg.id = tt.tag_id
      WHERE (l.owner_id = ${userId} OR lm.user_id = ${userId})
        AND t.status != 'done'
        AND (t.due_date::date = CURRENT_DATE OR t.start_date::date = CURRENT_DATE)
        AND t.parent_id IS NULL
      GROUP BY t.id, au.id
      ORDER BY t.position, t.due_date
    `
  } else if (smart === 'assigned') {
    tasks = await sql`
      SELECT t.*, au.name as assignee_name, au.avatar_url as assignee_avatar,
        l.name as list_name,
        ARRAY_AGG(DISTINCT tg.name) FILTER (WHERE tg.id IS NOT NULL) as tag_names,
        ARRAY_AGG(DISTINCT tg.id) FILTER (WHERE tg.id IS NOT NULL) as tag_ids
      FROM tasks t
      JOIN lists l ON l.id = t.list_id
      LEFT JOIN list_members lm ON lm.list_id = t.list_id AND lm.user_id = ${userId}
      LEFT JOIN users au ON au.id = t.assigned_to
      LEFT JOIN task_tags tt ON tt.task_id = t.id
      LEFT JOIN tags tg ON tg.id = tt.tag_id
      WHERE (l.owner_id = ${userId} OR lm.user_id = ${userId})
        AND t.assigned_to = ${userId}
        AND t.status != 'done'
      GROUP BY t.id, au.id, l.name
      ORDER BY t.due_date NULLS LAST, t.position
    `
  } else if (smart === 'week') {
    tasks = await sql`
      SELECT t.*, au.name as assignee_name, au.avatar_url as assignee_avatar,
        ARRAY_AGG(DISTINCT tg.name) FILTER (WHERE tg.id IS NOT NULL) as tag_names,
        ARRAY_AGG(DISTINCT tg.id) FILTER (WHERE tg.id IS NOT NULL) as tag_ids
      FROM tasks t
      JOIN lists l ON l.id = t.list_id
      LEFT JOIN list_members lm ON lm.list_id = t.list_id AND lm.user_id = ${userId}
      LEFT JOIN users au ON au.id = t.assigned_to
      LEFT JOIN task_tags tt ON tt.task_id = t.id
      LEFT JOIN tags tg ON tg.id = tt.tag_id
      WHERE (l.owner_id = ${userId} OR lm.user_id = ${userId})
        AND t.status != 'done'
        AND t.due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + interval '7 days'
        AND t.parent_id IS NULL
      GROUP BY t.id, au.id
      ORDER BY t.due_date, t.position
    `
  } else if (smart === 'overdue') {
    tasks = await sql`
      SELECT t.*, au.name as assignee_name, au.avatar_url as assignee_avatar,
        ARRAY_AGG(DISTINCT tg.name) FILTER (WHERE tg.id IS NOT NULL) as tag_names,
        ARRAY_AGG(DISTINCT tg.id) FILTER (WHERE tg.id IS NOT NULL) as tag_ids
      FROM tasks t
      JOIN lists l ON l.id = t.list_id
      LEFT JOIN list_members lm ON lm.list_id = t.list_id AND lm.user_id = ${userId}
      LEFT JOIN users au ON au.id = t.assigned_to
      LEFT JOIN task_tags tt ON tt.task_id = t.id
      LEFT JOIN tags tg ON tg.id = tt.tag_id
      WHERE (l.owner_id = ${userId} OR lm.user_id = ${userId})
        AND t.status != 'done'
        AND t.due_date < CURRENT_DATE
        AND t.parent_id IS NULL
      GROUP BY t.id, au.id
      ORDER BY t.due_date, t.position
    `
  } else if (smart === 'all') {
    tasks = await sql`
      SELECT t.*, au.name as assignee_name, au.avatar_url as assignee_avatar,
        ARRAY_AGG(DISTINCT tg.name) FILTER (WHERE tg.id IS NOT NULL) as tag_names,
        ARRAY_AGG(DISTINCT tg.id) FILTER (WHERE tg.id IS NOT NULL) as tag_ids
      FROM tasks t
      JOIN lists l ON l.id = t.list_id
      LEFT JOIN list_members lm ON lm.list_id = t.list_id AND lm.user_id = ${userId}
      LEFT JOIN users au ON au.id = t.assigned_to
      LEFT JOIN task_tags tt ON tt.task_id = t.id
      LEFT JOIN tags tg ON tg.id = tt.tag_id
      WHERE (l.owner_id = ${userId} OR lm.user_id = ${userId})
        AND t.parent_id IS NULL
      GROUP BY t.id, au.id
      ORDER BY t.position, t.created_at DESC
    `
  } else if (listId) {
    const hasAccess = await canAccessList(userId, listId)
    if (!hasAccess) return c.json({ error: 'Not found' }, 404)

    const query = parentId
      ? sql`t.list_id = ${listId} AND t.parent_id = ${parentId}`
      : sql`t.list_id = ${listId} AND t.parent_id IS NULL`

    tasks = await sql`
      SELECT t.*, au.name as assignee_name, au.avatar_url as assignee_avatar,
        ARRAY_AGG(DISTINCT tg.name) FILTER (WHERE tg.id IS NOT NULL) as tag_names,
        ARRAY_AGG(DISTINCT tg.id) FILTER (WHERE tg.id IS NOT NULL) as tag_ids,
        (SELECT COUNT(*) FROM tasks sub WHERE sub.parent_id = t.id) as subtask_count
      FROM tasks t
      LEFT JOIN users au ON au.id = t.assigned_to
      LEFT JOIN task_tags tt ON tt.task_id = t.id
      LEFT JOIN tags tg ON tg.id = tt.tag_id
      WHERE ${query}
      GROUP BY t.id, au.id
      ORDER BY t.position, t.created_at
    `
  } else {
    return c.json({ error: 'Provide listId or smart parameter' }, 400)
  }

  return c.json({ tasks })
})

app.post('/', async (c) => {
  const userId = c.get('userId')
  const body = await c.req.json()
  const { list_id, title, notes, priority, due_date, start_date, parent_id, assigned_to, recurrence_rule } = body

  if (!list_id || !title) return c.json({ error: 'list_id and title required' }, 400)

  const role = await getListRole(userId, list_id)
  if (!role) return c.json({ error: 'Not found' }, 404)
  if (role === 'viewer') return c.json({ error: 'Viewers cannot add tasks' }, 403)

  // assignee must have access to the list
  if (assigned_to && !(await getListRole(assigned_to, list_id))) {
    return c.json({ error: 'Assignee is not a member of this list' }, 400)
  }

  const [maxPos] = await sql`
    SELECT COALESCE(MAX(position), -1) + 1 as pos FROM tasks
    WHERE list_id = ${list_id} AND parent_id IS NOT DISTINCT FROM ${parent_id || null}
  `

  const [task] = await sql`
    INSERT INTO tasks (list_id, parent_id, created_by, assigned_to, title, notes, priority, due_date, start_date, position, recurrence_rule)
    VALUES (
      ${list_id}, ${parent_id || null}, ${userId}, ${assigned_to || null},
      ${title}, ${notes || null}, ${priority || 'none'},
      ${due_date || null}, ${start_date || null}, ${maxPos.pos},
      ${recurrence_rule || null}
    )
    RETURNING *
  `

  if (assigned_to && assigned_to !== userId) {
    const user = c.get('user')
    await createNotification(
      assigned_to,
      'task_assigned',
      `${user.name} assigned you a task: ${title}`,
      undefined,
      { task_id: task.id, list_id }
    )
  }

  broadcastToListMembers(list_id, { type: 'task.created', data: task }).catch(() => {})
  fireWebhooks(userId, 'task.created', task).catch(() => {})

  return c.json({ task }, 201)
})

// bulk reorder must be declared before PATCH /:id so "reorder" isnt treated as a task id
app.patch('/reorder', async (c) => {
  const userId = c.get('userId')
  const { items } = await c.req.json() // [{ id, position }]

  if (!Array.isArray(items)) return c.json({ error: 'items array required' }, 400)

  for (const { id, position } of items) {
    const task = await canAccessTask(userId, id)
    if (!task || task.my_role === 'viewer') continue
    await sql`UPDATE tasks SET position = ${position}, updated_at = now() WHERE id = ${id}`
  }

  return c.json({ ok: true })
})

app.patch('/:id', async (c) => {
  const userId = c.get('userId')
  const id = c.req.param('id')
  const body = await c.req.json()

  const task = await canAccessTask(userId, id)
  if (!task) return c.json({ error: 'Not found' }, 404)
  if (task.my_role === 'viewer') return c.json({ error: 'Viewers cannot edit tasks' }, 403)

  if (body.assigned_to && !(await getListRole(body.assigned_to, task.list_id))) {
    return c.json({ error: 'Assignee is not a member of this list' }, 400)
  }

  const allowed = ['title', 'notes', 'priority', 'status', 'due_date', 'start_date', 'assigned_to', 'position', 'recurrence_rule']

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

  if (values.length === 0) return c.json({ task })

  values.push(id)
  const [updated] = await sql.unsafe(
    `UPDATE tasks SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
    values as never[]
  )

  if (body.assigned_to && body.assigned_to !== task.assigned_to && body.assigned_to !== userId) {
    const user = c.get('user')
    await createNotification(
      body.assigned_to,
      'task_assigned',
      `${user.name} assigned you a task: ${updated.title}`,
      undefined,
      { task_id: id, list_id: task.list_id }
    )
  }

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

  // notify collaborators when a shared task is completed
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

// bulk reorder Add a tag to a task
app.post('/:id/tags/:tagId', async (c) => {
  const userId = c.get('userId')
  const taskId = c.req.param('id')
  const tagId = c.req.param('tagId')

  const task = await canAccessTask(userId, taskId)
  if (!task) return c.json({ error: 'Not found' }, 404)
  if (task.my_role === 'viewer') return c.json({ error: 'Viewers cannot edit tasks' }, 403)

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
