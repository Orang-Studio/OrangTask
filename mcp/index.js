#!/usr/bin/env node
// mcp server exposing OrangTask over the personal API key (otk_) REST surface

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'

const BASE = (process.env.ORANGTASK_API_URL || 'https://task.oranges.lt').replace(/\/+$/, '')
const KEY = process.env.ORANGTASK_API_KEY

if (!KEY) {
  console.error('ORANGTASK_API_KEY is not set, generate one in Settings > Integrations')
  process.exit(1)
}

async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${KEY}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let data
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = { raw: text }
  }
  if (!res.ok) {
    const msg = data?.error || res.statusText
    throw new Error(`${method} ${path} failed (${res.status}): ${msg}`)
  }
  return data
}

const ok = (v) => ({ content: [{ type: 'text', text: JSON.stringify(v, null, 2) }] })
const fail = (e) => ({ content: [{ type: 'text', text: `error: ${e.message}` }], isError: true })
const wrap = (fn) => async (args) => {
  try {
    return ok(await fn(args))
  } catch (e) {
    return fail(e)
  }
}

// keep responses small so a big list does not flood the context
const slimTask = (t) => ({
  id: t.id,
  title: t.title,
  status: t.status,
  priority: t.priority,
  due_date: t.due_date,
  list_id: t.list_id,
  list_name: t.list_name,
  assignee: t.assignee_name,
  tags: t.tag_names?.filter(Boolean) ?? [],
  notes: t.notes ? String(t.notes).slice(0, 300) : undefined,
})

const server = new McpServer({ name: 'orangtask', version: '0.1.0' })

server.registerTool(
  'list_tasks',
  {
    title: 'List tasks',
    description:
      'Read tasks from a smart view (today, week, overdue, assigned, all) or from one list by id. ' +
      'Defaults to the today view.',
    inputSchema: {
      view: z.enum(['today', 'week', 'overdue', 'assigned', 'all']).optional(),
      list_id: z.string().optional(),
    },
  },
  wrap(async ({ view, list_id }) => {
    const q = list_id ? `?listId=${encodeURIComponent(list_id)}` : `?smart=${view || 'today'}`
    const { tasks } = await api(`/tasks${q}`)
    return (tasks || []).map(slimTask)
  })
)

server.registerTool(
  'search_tasks',
  {
    title: 'Search tasks',
    description: 'Full text and substring search across task titles and notes, needs at least 2 characters.',
    inputSchema: { query: z.string().min(2) },
  },
  wrap(async ({ query }) => {
    const { results } = await api(`/search?q=${encodeURIComponent(query)}`)
    return (results || []).map(slimTask)
  })
)

server.registerTool(
  'create_task',
  {
    title: 'Create task',
    description: 'Add a task to a list. list_id is required, get one from list_lists.',
    inputSchema: {
      list_id: z.string(),
      title: z.string(),
      notes: z.string().optional(),
      priority: z.enum(['none', 'low', 'medium', 'high']).optional(),
      due_date: z.string().optional().describe('ISO 8601 timestamp'),
      start_date: z.string().optional().describe('ISO 8601 timestamp'),
      assigned_to: z.string().optional().describe('user id, must be a member of the list'),
      recurrence_rule: z.string().optional().describe('RRULE string'),
    },
  },
  wrap(async (args) => slimTask((await api('/tasks', { method: 'POST', body: args })).task))
)

server.registerTool(
  'update_task',
  {
    title: 'Update task',
    description: 'Change fields on an existing task, only the fields you pass are touched.',
    inputSchema: {
      id: z.string(),
      title: z.string().optional(),
      notes: z.string().optional(),
      priority: z.enum(['none', 'low', 'medium', 'high']).optional(),
      status: z.enum(['todo', 'doing', 'done']).optional(),
      due_date: z.string().nullable().optional(),
      start_date: z.string().nullable().optional(),
      assigned_to: z.string().nullable().optional(),
      recurrence_rule: z.string().nullable().optional(),
    },
  },
  wrap(async ({ id, ...body }) => {
    if (!Object.keys(body).length) throw new Error('pass at least one field to change')
    return slimTask((await api(`/tasks/${id}`, { method: 'PATCH', body })).task)
  })
)

server.registerTool(
  'complete_task',
  {
    title: 'Complete task',
    description: 'Mark a task done. A recurring task rolls forward to its next occurrence.',
    inputSchema: { id: z.string() },
  },
  wrap(async ({ id }) => api(`/tasks/${id}/complete`, { method: 'POST' }))
)

server.registerTool(
  'uncomplete_task',
  {
    title: 'Uncomplete task',
    description: 'Move a done task back to todo.',
    inputSchema: { id: z.string() },
  },
  wrap(async ({ id }) => api(`/tasks/${id}/uncomplete`, { method: 'POST' }))
)

server.registerTool(
  'delete_task',
  {
    title: 'Delete task',
    description: 'Permanently delete a task. This cannot be undone.',
    inputSchema: { id: z.string() },
  },
  wrap(async ({ id }) => api(`/tasks/${id}`, { method: 'DELETE' }))
)

server.registerTool(
  'list_lists',
  {
    title: 'List lists',
    description: 'Every list the user owns or has been shared into, with ids for the task tools.',
    inputSchema: {},
  },
  wrap(async () => {
    const { lists } = await api('/lists')
    return (lists || []).map((l) => ({
      id: l.id,
      name: l.name,
      icon: l.icon,
      color: l.color,
      is_shared: l.is_shared,
      role: l.my_role,
    }))
  })
)

server.registerTool(
  'create_list',
  {
    title: 'Create list',
    description: 'Create a new list owned by the user.',
    inputSchema: {
      name: z.string(),
      color: z.string().optional(),
      icon: z.string().optional(),
    },
  },
  wrap(async (args) => (await api('/lists', { method: 'POST', body: args })).list)
)

server.registerTool(
  'list_tags',
  { title: 'List tags', description: 'All tags defined by the user.', inputSchema: {} },
  wrap(async () => (await api('/tags')).tags)
)

await server.connect(new StdioServerTransport())
