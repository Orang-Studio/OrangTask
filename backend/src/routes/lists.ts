import { Hono } from 'hono'
import sql from '../db/client.js'
import { authMiddleware } from '../middleware/auth.js'
import { assignListIcon, suggestListIcon } from '../services/listIcon.js'
import { createNotification } from '../services/notifications.js'
import { fireWebhooks } from '../services/webhooks.js'
import { broadcastToListMembers, publishToUser } from '../ws/pubsub.js'
import { MAX, MEMBER_ROLES, enumField, firstError, pageParams, textField } from '../lib/validate.js'
import type { AppEnv } from '../types.js'

const app = new Hono<AppEnv>()
app.use('*', authMiddleware)

app.get('/', async (c) => {
  const userId = c.get('userId')
  const { limit, offset } = pageParams(c.req.query())

  const lists = await sql`
    SELECT l.*,
      (SELECT COUNT(*) FROM tasks t WHERE t.list_id = l.id AND t.status != 'done') as task_count,
      (EXISTS (SELECT 1 FROM list_members m WHERE m.list_id = l.id)) as is_shared,
      CASE WHEN l.owner_id = ${userId} THEN 'owner' ELSE lm.role END as my_role,
      -- Overrides l.position: a member sees their own order of shared lists.
      COALESCE(lm.position, l.position) as position
    FROM lists l
    LEFT JOIN list_members lm ON lm.list_id = l.id AND lm.user_id = ${userId}
    WHERE l.owner_id = ${userId} OR lm.user_id = ${userId}
    ORDER BY COALESCE(lm.position, l.position), l.created_at
    LIMIT ${limit} OFFSET ${offset}
  `

  return c.json({ lists, nextOffset: lists.length === limit ? offset + limit : null })
})

app.post('/', async (c) => {
  const userId = c.get('userId')
  const { name, color, icon } = await c.req.json()

  const invalid = firstError(
    textField(name, 'name', MAX.listName, { required: true }),
    textField(color, 'color', MAX.listColor),
    textField(icon, 'icon', MAX.listIcon),
  )
  if (invalid) return c.json({ error: invalid }, 400)

  const [maxPos] = await sql`SELECT COALESCE(MAX(position), -1) + 1 as pos FROM lists WHERE owner_id = ${userId}`

  const [list] = await sql`
    INSERT INTO lists (owner_id, name, color, icon, position)
    VALUES (${userId}, ${name}, ${color || null}, ${icon || null}, ${maxPos.pos})
    RETURNING *
  `

  publishToUser(userId, { type: 'list.updated', data: list }).catch(() => {})
  // no icon chosen Jev picks one from the name and it follows as a list updated
  if (!list.icon) assignListIcon(list.id, list.name)
  return c.json({ list }, 201)
})

// live preview while a new lists name is typed the dialog sends the pick back on create
app.post('/suggest-icon', async (c) => {
  const userId = c.get('userId')
  const { name } = await c.req.json()
  const invalid = textField(name, 'name', MAX.listName, { required: true })
  if (invalid) return c.json({ error: invalid }, 400)
  try {
    return c.json({ icon: await suggestListIcon(userId, name) })
  } catch (e) {
    console.error('suggest-icon: failed:', (e as Error).message)
    return c.json({ icon: null })
  }
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

  const ids = sql.array(items.map((i) => i.id as string))
  const positions = sql.array(items.map((i) => i.position as number))

  const owned = await sql`
    UPDATE lists SET position = v.position, updated_at = now()
    FROM unnest(${ids}::uuid[], ${positions}::int[]) AS v(id, position)
    WHERE lists.id = v.id AND lists.owner_id = ${userId}
      AND lists.position IS DISTINCT FROM v.position
    RETURNING lists.*
  `
  const shared = await sql`
    UPDATE list_members SET position = v.position
    FROM unnest(${ids}::uuid[], ${positions}::int[]) AS v(id, position)
    WHERE list_members.list_id = v.id AND list_members.user_id = ${userId}
      AND list_members.position IS DISTINCT FROM v.position
    RETURNING list_members.list_id, list_members.position
  `
  const sharedLists = shared.length
    ? await sql`SELECT * FROM lists WHERE id = ANY(${sql.array(shared.map((m) => m.list_id as string))}::uuid[])`
    : []
  const sharedPos = new Map(shared.map((m) => [m.list_id as string, m.position as number]))

  // only to the caller the order is theirs other members keep their own
  for (const list of owned) publishToUser(userId, { type: 'list.updated', data: list }).catch(() => {})
  for (const list of sharedLists) {
    publishToUser(userId, { type: 'list.updated', data: { ...list, position: sharedPos.get(list.id) } }).catch(() => {})
  }

  return c.json({ ok: true, updated: owned.length + shared.length })
})

app.patch('/:id', async (c) => {
  const userId = c.get('userId')
  const id = c.req.param('id')
  const updates = await c.req.json()

  const invalid = firstError(
    textField(updates.name, 'name', MAX.listName),
    textField(updates.color, 'color', MAX.listColor),
    textField(updates.icon, 'icon', MAX.listIcon),
  )
  if (invalid) return c.json({ error: invalid }, 400)

  const [list] = await sql`
    SELECT l.* FROM lists l
    LEFT JOIN list_members lm ON lm.list_id = l.id AND lm.user_id = ${userId}
    WHERE l.id = ${id} AND (l.owner_id = ${userId} OR lm.role = 'owner')
  `
  if (!list) return c.json({ error: 'Not found' }, 404)

  const allowed = ['name', 'color', 'icon', 'position']
  const fields: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in updates) fields[key] = updates[key]
  }

  if (Object.keys(fields).length === 0) return c.json({ list })

  const [updated] = await sql`
    UPDATE lists SET
      name = COALESCE(${fields.name as string || null}, name),
      color = COALESCE(${fields.color as string || null}, color),
      icon = COALESCE(${fields.icon as string || null}, icon),
      position = COALESCE(${fields.position as number ?? null}, position),
      updated_at = now()
    WHERE id = ${id}
    RETURNING *
  `

  broadcastToListMembers(id, { type: 'list.updated', data: updated }).catch(() => {})
  fireWebhooks(userId, 'list.updated', updated).catch(() => {})
  return c.json({ list: updated })
})

app.delete('/:id', async (c) => {
  const userId = c.get('userId')
  const id = c.req.param('id')

  const [list] = await sql`
    SELECT l.* FROM lists l
    LEFT JOIN list_members lm ON lm.list_id = l.id AND lm.user_id = ${userId}
    WHERE l.id = ${id} AND (l.owner_id = ${userId} OR lm.role = 'owner')
  `
  if (!list) return c.json({ error: 'Not found' }, 404)

  await broadcastToListMembers(id, { type: 'list.deleted', data: { id } }).catch(() => {})
  await sql`DELETE FROM lists WHERE id = ${id}`
  return c.json({ ok: true })
})

app.get('/:id/members', async (c) => {
  const userId = c.get('userId')
  const id = c.req.param('id')
  const { limit, offset } = pageParams(c.req.query())

  const [access] = await sql`
    SELECT 1 FROM lists WHERE id = ${id} AND owner_id = ${userId}
    UNION
    SELECT 1 FROM list_members WHERE list_id = ${id} AND user_id = ${userId}
  `
  if (!access) return c.json({ error: 'Not found' }, 404)

  const members = await sql`
    SELECT u.id, u.email, u.name, u.avatar_url, 'owner' as role, l.created_at
    FROM lists l
    JOIN users u ON u.id = l.owner_id
    WHERE l.id = ${id}
    UNION ALL
    SELECT u.id, u.email, u.name, u.avatar_url, lm.role, lm.created_at
    FROM list_members lm
    JOIN users u ON u.id = lm.user_id
    WHERE lm.list_id = ${id}
    ORDER BY created_at
    LIMIT ${limit} OFFSET ${offset}
  `

  return c.json({ members, nextOffset: members.length === limit ? offset + limit : null })
})

app.post('/:id/members', async (c) => {
  const userId = c.get('userId')
  const id = c.req.param('id')
  const { email, role = 'editor' } = await c.req.json()

  const invalid = firstError(
    textField(email, 'email', 320, { required: true }),
    enumField(role, 'role', MEMBER_ROLES),
  )
  if (invalid) return c.json({ error: invalid }, 400)

  const [list] = await sql`
    SELECT l.* FROM lists l
    LEFT JOIN list_members lm ON lm.list_id = l.id AND lm.user_id = ${userId}
    WHERE l.id = ${id} AND (l.owner_id = ${userId} OR lm.role = 'owner')
  `
  if (!list) return c.json({ error: 'Not found or not owner' }, 404)

  const [invitee] = await sql`SELECT * FROM users WHERE email = ${email.toLowerCase()}`
  if (!invitee) return c.json({ error: 'User not found' }, 404)

  if (invitee.id === userId) return c.json({ error: 'Cannot invite yourself' }, 400)
  if (invitee.id === list.owner_id) return c.json({ error: 'Already a member' }, 409)

  const [existing] = await sql`SELECT 1 FROM list_members WHERE list_id = ${id} AND user_id = ${invitee.id}`
  if (existing) return c.json({ error: 'Already a member' }, 409)

  const [member] = await sql`
    INSERT INTO list_members (list_id, user_id, role, invited_by)
    VALUES (${id}, ${invitee.id}, ${role}, ${userId})
    RETURNING *
  `

  await createNotification(
    invitee.id,
    'list_shared',
    `${c.get('user').name} shared "${list.name}" with you`,
    `You have been added as ${role}`,
    { list_id: id }
  )

  fireWebhooks(userId, 'list.shared', { list, member: invitee }).catch(() => {})
  return c.json({ member }, 201)
})

app.patch('/:id/members/:userId', async (c) => {
  const callerId = c.get('userId')
  const id = c.req.param('id')
  const memberId = c.req.param('userId')
  const { role } = await c.req.json()

  const invalid = firstError(
    role === undefined || role === null ? 'role is required' : null,
    enumField(role, 'role', MEMBER_ROLES),
  )
  if (invalid) return c.json({ error: invalid }, 400)

  const [list] = await sql`
    SELECT l.* FROM lists l
    LEFT JOIN list_members lm ON lm.list_id = l.id AND lm.user_id = ${callerId}
    WHERE l.id = ${id} AND (l.owner_id = ${callerId} OR lm.role = 'owner')
  `
  if (!list) return c.json({ error: 'Not found or not owner' }, 404)

  if (memberId === list.owner_id) {
    if (role === 'owner') return c.json({ ok: true })
    const [otherOwner] = await sql`
      SELECT user_id FROM list_members
      WHERE list_id = ${id} AND role = 'owner' AND user_id <> ${memberId}
      ORDER BY created_at LIMIT 1
    `
    if (!otherOwner) return c.json({ error: 'List must have at least one owner' }, 400)
    await sql.begin(async (tx) => {
      await tx`UPDATE lists SET owner_id = ${otherOwner.user_id}, updated_at = now() WHERE id = ${id}`
      await tx`DELETE FROM list_members WHERE list_id = ${id} AND user_id = ${otherOwner.user_id}`
      await tx`
        INSERT INTO list_members (list_id, user_id, role, invited_by)
        VALUES (${id}, ${memberId}, ${role}, ${callerId})
        ON CONFLICT (list_id, user_id) DO UPDATE SET role = EXCLUDED.role
      `
    })
    return c.json({ ok: true })
  }

  const [updated] = await sql`
    UPDATE list_members SET role = ${role}
    WHERE list_id = ${id} AND user_id = ${memberId}
    RETURNING *
  `
  if (!updated) return c.json({ error: 'Member not found' }, 404)

  return c.json({ ok: true })
})

app.delete('/:id/members/:userId', async (c) => {
  const callerId = c.get('userId')
  const id = c.req.param('id')
  const memberId = c.req.param('userId')

  const [list] = await sql`
    SELECT l.*, (l.owner_id = ${callerId} OR lm.role = 'owner') as caller_is_owner
    FROM lists l
    LEFT JOIN list_members lm ON lm.list_id = l.id AND lm.user_id = ${callerId}
    WHERE l.id = ${id}
  `
  if (!list) return c.json({ error: 'Not found' }, 404)

  if (!list.caller_is_owner && memberId !== callerId) {
    return c.json({ error: 'Forbidden' }, 403)
  }

  if (memberId === list.owner_id) {
    const [otherOwner] = await sql`
      SELECT user_id FROM list_members
      WHERE list_id = ${id} AND role = 'owner' AND user_id <> ${memberId}
      ORDER BY created_at LIMIT 1
    `
    if (!otherOwner) return c.json({ error: 'Cannot remove the last owner' }, 400)
    await sql.begin(async (tx) => {
      await tx`UPDATE lists SET owner_id = ${otherOwner.user_id}, updated_at = now() WHERE id = ${id}`
      await tx`DELETE FROM list_members WHERE list_id = ${id} AND user_id = ${otherOwner.user_id}`
    })
  } else {
    await sql`DELETE FROM list_members WHERE list_id = ${id} AND user_id = ${memberId}`
  }

  // a former member cant keep tasks in a list they can no longer see
  await sql`
    UPDATE tasks SET assignee_ids = array_remove(assignee_ids, ${memberId}::uuid),
      assigned_to = (array_remove(assignee_ids, ${memberId}::uuid))[1]
    WHERE list_id = ${id} AND ${memberId} = ANY(assignee_ids)
  `
  return c.json({ ok: true })
})

export default app