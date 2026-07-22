import { Hono } from 'hono'
import sql from '../db/client.js'
import { authMiddleware } from '../middleware/auth.js'
import { createNotification } from '../services/notifications.js'
import { fireWebhooks } from '../services/webhooks.js'
import { broadcastToListMembers, publishToUser } from '../ws/pubsub.js'
import type { AppEnv } from '../types.js'

const app = new Hono<AppEnv>()
app.use('*', authMiddleware)

// get all lists for current user
app.get('/', async (c) => {
  const userId = c.get('userId')

  const lists = await sql`
    SELECT l.*,
      (SELECT COUNT(*) FROM tasks t WHERE t.list_id = l.id AND t.status != 'done') as task_count,
      (EXISTS (SELECT 1 FROM list_members m WHERE m.list_id = l.id)) as is_shared,
      CASE WHEN l.owner_id = ${userId} THEN 'owner' ELSE lm.role END as my_role
    FROM lists l
    LEFT JOIN list_members lm ON lm.list_id = l.id AND lm.user_id = ${userId}
    WHERE l.owner_id = ${userId} OR lm.user_id = ${userId}
    ORDER BY l.position, l.created_at
  `

  return c.json({ lists })
})

// create list
app.post('/', async (c) => {
  const userId = c.get('userId')
  const { name, color, icon } = await c.req.json()
  if (!name) return c.json({ error: 'Name required' }, 400)

  const [maxPos] = await sql`SELECT COALESCE(MAX(position), -1) + 1 as pos FROM lists WHERE owner_id = ${userId}`

  const [list] = await sql`
    INSERT INTO lists (owner_id, name, color, icon, position)
    VALUES (${userId}, ${name}, ${color || null}, ${icon || null}, ${maxPos.pos})
    RETURNING *
  `

  publishToUser(userId, { type: 'list.updated', data: list }).catch(() => {})
  return c.json({ list }, 201)
})

// update list
app.patch('/:id', async (c) => {
  const userId = c.get('userId')
  const id = c.req.param('id')
  const updates = await c.req.json()

  const [list] = await sql`SELECT * FROM lists WHERE id = ${id} AND owner_id = ${userId}`
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
    WHERE id = ${id} AND owner_id = ${userId}
    RETURNING *
  `

  broadcastToListMembers(id, { type: 'list.updated', data: updated }).catch(() => {})
  fireWebhooks(userId, 'list.updated', updated).catch(() => {})
  return c.json({ list: updated })
})

// delete list
app.delete('/:id', async (c) => {
  const userId = c.get('userId')
  const id = c.req.param('id')

  const [list] = await sql`SELECT * FROM lists WHERE id = ${id} AND owner_id = ${userId}`
  if (!list) return c.json({ error: 'Not found' }, 404)

  await sql`DELETE FROM lists WHERE id = ${id}`
  publishToUser(userId, { type: 'list.deleted', data: { id } }).catch(() => {})
  return c.json({ ok: true })
})

// get members
app.get('/:id/members', async (c) => {
  const userId = c.get('userId')
  const id = c.req.param('id')

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
  `

  return c.json({ members })
})

// invite member by email
app.post('/:id/members', async (c) => {
  const userId = c.get('userId')
  const id = c.req.param('id')
  const { email, role = 'editor' } = await c.req.json()

  const [list] = await sql`SELECT * FROM lists WHERE id = ${id} AND owner_id = ${userId}`
  if (!list) return c.json({ error: 'Not found or not owner' }, 404)

  const [invitee] = await sql`SELECT * FROM users WHERE email = ${email.toLowerCase()}`
  if (!invitee) return c.json({ error: 'User not found' }, 404)

  if (invitee.id === userId) return c.json({ error: 'Cannot invite yourself' }, 400)

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

// update member role
app.patch('/:id/members/:userId', async (c) => {
  const ownerId = c.get('userId')
  const id = c.req.param('id')
  const memberId = c.req.param('userId')
  const { role } = await c.req.json()

  const [list] = await sql`SELECT * FROM lists WHERE id = ${id} AND owner_id = ${ownerId}`
  if (!list) return c.json({ error: 'Not found or not owner' }, 404)

  const [updated] = await sql`
    UPDATE list_members SET role = ${role}
    WHERE list_id = ${id} AND user_id = ${memberId}
    RETURNING *
  `
  if (!updated) return c.json({ error: 'Member not found' }, 404)

  return c.json({ ok: true })
})

// remove member
app.delete('/:id/members/:userId', async (c) => {
  const ownerId = c.get('userId')
  const id = c.req.param('id')
  const memberId = c.req.param('userId')

  // owner can remove anyone, members can remove themselves
  const [list] = await sql`SELECT * FROM lists WHERE id = ${id}`
  if (!list) return c.json({ error: 'Not found' }, 404)

  if (list.owner_id !== ownerId && memberId !== ownerId) {
    return c.json({ error: 'Forbidden' }, 403)
  }

  await sql`DELETE FROM list_members WHERE list_id = ${id} AND user_id = ${memberId}`
  return c.json({ ok: true })
})

export default app
