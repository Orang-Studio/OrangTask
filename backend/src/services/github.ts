import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto'
import sql from '../db/client.js'
import { publishToUser } from '../ws/pubsub.js'

const API = 'https://api.github.com'
const MAX_REPOS = 100
const MAX_REPO_PAGES = 2
const PER_PAGE = 100
const GITHUB_LIST_NAME = 'GitHub'
const GITHUB_LIST_ICON = 'github'
const GITHUB_LIST_COLOR = '#f97316'

export type GithubKind = 'issue' | 'pull_request' | 'security'

export interface GithubConnection {
  user_id: string
  github_login: string | null
  scopes: string | null
  sync_issues: boolean
  sync_pull_requests: boolean
  sync_security: boolean
  list_id: string | null
  last_synced_at: string | null
  last_error: string | null
}

interface SyncedItem {
  kind: GithubKind
  external_key: string
  repo: string
  number: number | null
  title: string
  url: string
  state: string | null
  author: string | null
  severity: string | null
  labels: string[]
  item_updated_at: string | null
}

function encryptionKey(): Buffer {
  const secret = process.env.SESSION_SECRET || process.env.GITHUB_CLIENT_SECRET || 'orangtask-dev-secret'
  return createHash('sha256').update(secret).digest()
}

export function encryptToken(token: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv)
  const enc = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()])
  return [iv.toString('base64'), cipher.getAuthTag().toString('base64'), enc.toString('base64')].join('.')
}

export function decryptToken(stored: string): string | null {
  const parts = stored.split('.')
  if (parts.length !== 3) return null
  try {
    const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(parts[0], 'base64'))
    decipher.setAuthTag(Buffer.from(parts[1], 'base64'))
    return Buffer.concat([decipher.update(Buffer.from(parts[2], 'base64')), decipher.final()]).toString('utf8')
  } catch {
    return null
  }
}

export const GITHUB_SCOPES = 'repo read:org security_events'

export function githubOAuthClient(): { id: string; secret: string } | null {
  const id = process.env.GITHUB_INTEGRATION_CLIENT_ID || process.env.GITHUB_CLIENT_ID
  const secret = process.env.GITHUB_INTEGRATION_CLIENT_SECRET || process.env.GITHUB_CLIENT_SECRET
  if (!id || !secret) return null
  return { id, secret }
}

async function gh<T>(token: string, path: string): Promise<T | null> {
  const res = await fetch(`${API}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'OrangTask',
    },
  })
  if (!res.ok) return null
  return res.json() as Promise<T>
}

export async function fetchViewer(token: string): Promise<{ login: string } | null> {
  const user = await gh<{ login?: string }>(token, '/user')
  return user?.login ? { login: user.login } : null
}

interface Repo {
  full_name: string
  archived?: boolean
  has_issues?: boolean
  permissions?: { admin?: boolean }
}

async function fetchRepos(token: string): Promise<Repo[]> {
  const repos: Repo[] = []
  for (let page = 1; page <= MAX_REPO_PAGES; page++) {
    const batch = await gh<Repo[]>(
      token,
      `/user/repos?affiliation=owner,collaborator,organization_member&sort=updated&per_page=${PER_PAGE}&page=${page}`,
    )
    if (!batch || batch.length === 0) break
    repos.push(...batch.filter((r) => !r.archived))
    if (batch.length < PER_PAGE) break
  }
  return repos.slice(0, MAX_REPOS)
}

interface IssuePayload {
  number: number
  title: string
  html_url: string
  state: string
  user?: { login?: string }
  labels?: Array<{ name?: string }>
  updated_at?: string
  pull_request?: unknown
  draft?: boolean
}

interface AlertPayload {
  number: number
  html_url?: string
  state?: string
  updated_at?: string
  security_advisory?: { summary?: string; severity?: string }
  security_vulnerability?: { severity?: string }
  rule?: { description?: string; security_severity_level?: string; severity?: string }
  most_recent_instance?: { message?: { text?: string } }
  dependency?: { package?: { name?: string } }
}

function labelNames(issue: IssuePayload): string[] {
  return (issue.labels ?? []).map((l) => l.name).filter((n): n is string => !!n)
}

async function collectRepoItems(
  token: string,
  repo: Repo,
  wants: { issues: boolean; pulls: boolean; security: boolean },
): Promise<SyncedItem[]> {
  const items: SyncedItem[] = []

  if (wants.issues || wants.pulls) {
    const issues = await gh<IssuePayload[]>(token, `/repos/${repo.full_name}/issues?state=open&per_page=${PER_PAGE}`)
    for (const issue of issues ?? []) {
      const isPull = !!issue.pull_request
      if (isPull && !wants.pulls) continue
      if (!isPull && !wants.issues) continue
      items.push({
        kind: isPull ? 'pull_request' : 'issue',
        external_key: `${isPull ? 'pull_request' : 'issue'}:${repo.full_name}#${issue.number}`,
        repo: repo.full_name,
        number: issue.number,
        title: issue.title,
        url: issue.html_url,
        state: issue.draft ? 'draft' : issue.state,
        author: issue.user?.login ?? null,
        severity: null,
        labels: labelNames(issue),
        item_updated_at: issue.updated_at ?? null,
      })
    }
  }

  if (wants.security) {
    const dependabot = await gh<AlertPayload[]>(
      token,
      `/repos/${repo.full_name}/dependabot/alerts?state=open&per_page=${PER_PAGE}`,
    )
    for (const alert of dependabot ?? []) {
      const pkg = alert.dependency?.package?.name
      items.push({
        kind: 'security',
        external_key: `security:dependabot:${repo.full_name}#${alert.number}`,
        repo: repo.full_name,
        number: alert.number,
        title: alert.security_advisory?.summary || (pkg ? `Vulnerable dependency ${pkg}` : `Dependabot alert #${alert.number}`),
        url: alert.html_url || `https://github.com/${repo.full_name}/security/dependabot/${alert.number}`,
        state: alert.state ?? 'open',
        author: null,
        severity: alert.security_vulnerability?.severity || alert.security_advisory?.severity || null,
        labels: pkg ? [pkg] : [],
        item_updated_at: alert.updated_at ?? null,
      })
    }

    const codeScanning = await gh<AlertPayload[]>(
      token,
      `/repos/${repo.full_name}/code-scanning/alerts?state=open&per_page=${PER_PAGE}`,
    )
    for (const alert of codeScanning ?? []) {
      items.push({
        kind: 'security',
        external_key: `security:code-scanning:${repo.full_name}#${alert.number}`,
        repo: repo.full_name,
        number: alert.number,
        title: alert.rule?.description || alert.most_recent_instance?.message?.text || `Code scanning alert #${alert.number}`,
        url: alert.html_url || `https://github.com/${repo.full_name}/security/code-scanning/${alert.number}`,
        state: alert.state ?? 'open',
        author: null,
        severity: alert.rule?.security_severity_level || alert.rule?.severity || null,
        labels: [],
        item_updated_at: alert.updated_at ?? null,
      })
    }
  }

  return items
}

async function ensureGithubList(userId: string, listId: string | null): Promise<string> {
  if (listId) {
    const [existing] = await sql`SELECT id FROM lists WHERE id = ${listId} AND owner_id = ${userId}`
    if (existing) return existing.id
  }

  const [byName] = await sql`
    SELECT id FROM lists WHERE owner_id = ${userId} AND name = ${GITHUB_LIST_NAME} ORDER BY created_at LIMIT 1
  `
  if (byName) return byName.id

  const [maxPos] = await sql`SELECT COALESCE(MAX(position), -1) + 1 as pos FROM lists WHERE owner_id = ${userId}`
  const [list] = await sql`
    INSERT INTO lists (owner_id, name, color, icon, position)
    VALUES (${userId}, ${GITHUB_LIST_NAME}, ${GITHUB_LIST_COLOR}, ${GITHUB_LIST_ICON}, ${maxPos.pos})
    RETURNING id
  `
  return list.id
}

function taskTitle(item: SyncedItem): string {
  const ref = item.number ? `${item.repo}#${item.number}` : item.repo
  return `${ref} ${item.title}`.slice(0, 500)
}

function taskNotes(item: SyncedItem): string {
  const lines = [item.url, `Repository: ${item.repo}`]
  if (item.author) lines.push(`Author: ${item.author}`)
  if (item.state) lines.push(`State: ${item.state}`)
  if (item.severity) lines.push(`Severity: ${item.severity}`)
  if (item.labels.length > 0) lines.push(`Labels: ${item.labels.join(', ')}`)
  if (item.item_updated_at) lines.push(`Updated: ${item.item_updated_at}`)
  return lines.join('\n')
}

function priorityFor(item: SyncedItem): 'none' | 'low' | 'medium' | 'high' {
  if (item.kind !== 'security') return 'none'
  const severity = (item.severity || '').toLowerCase()
  if (severity === 'critical' || severity === 'high') return 'high'
  if (severity === 'medium' || severity === 'moderate') return 'medium'
  return 'low'
}

export async function syncGithub(userId: string): Promise<{ items: number; list_id: string }> {
  const [row] = await sql`SELECT * FROM github_connections WHERE user_id = ${userId}`
  if (!row) throw new Error('GitHub is not connected')

  const token = decryptToken(row.access_token)
  if (!token) throw new Error('Stored GitHub token could not be read, reconnect GitHub')

  const wants = {
    issues: row.sync_issues,
    pulls: row.sync_pull_requests,
    security: row.sync_security,
  }

  const listId = await ensureGithubList(userId, row.list_id)

  const collected: SyncedItem[] = []
  if (wants.issues || wants.pulls || wants.security) {
    const repos = await fetchRepos(token)
    for (const repo of repos) {
      collected.push(...(await collectRepoItems(token, repo, wants)))
    }
  }

  const keys = collected.map((i) => i.external_key)

  const stale = keys.length > 0
    ? await sql`SELECT task_id FROM github_items WHERE user_id = ${userId} AND external_key <> ALL(${keys})`
    : await sql`SELECT task_id FROM github_items WHERE user_id = ${userId}`

  const staleTaskIds = stale.map((s: { task_id: string | null }) => s.task_id).filter(Boolean)
  if (staleTaskIds.length > 0) await sql`DELETE FROM tasks WHERE id = ANY(${staleTaskIds})`

  if (keys.length > 0) {
    await sql`DELETE FROM github_items WHERE user_id = ${userId} AND external_key <> ALL(${keys})`
  } else {
    await sql`DELETE FROM github_items WHERE user_id = ${userId}`
  }

  for (const item of collected) {
    const [existing] = await sql`
      SELECT id, task_id FROM github_items WHERE user_id = ${userId} AND external_key = ${item.external_key}
    `

    let taskId: string | null = existing?.task_id ?? null
    const title = taskTitle(item)
    const notes = taskNotes(item)
    const priority = priorityFor(item)

    if (taskId) {
      const [updated] = await sql`
        UPDATE tasks SET title = ${title}, notes = ${notes}, priority = ${priority}, list_id = ${listId}, updated_at = now()
        WHERE id = ${taskId}
        RETURNING id
      `
      if (!updated) taskId = null
    }

    if (!taskId) {
      const [maxPos] = await sql`SELECT COALESCE(MAX(position), -1) + 1 as pos FROM tasks WHERE list_id = ${listId}`
      const [task] = await sql`
        INSERT INTO tasks (list_id, created_by, title, notes, priority, position)
        VALUES (${listId}, ${userId}, ${title}, ${notes}, ${priority}, ${maxPos.pos})
        RETURNING id
      `
      taskId = task.id
    }

    await sql`
      INSERT INTO github_items (
        user_id, task_id, kind, external_key, repo, number, title, url, state, author, severity, labels, item_updated_at, synced_at
      ) VALUES (
        ${userId}, ${taskId}, ${item.kind}, ${item.external_key}, ${item.repo}, ${item.number},
        ${item.title}, ${item.url}, ${item.state}, ${item.author}, ${item.severity}, ${item.labels}, ${item.item_updated_at}, now()
      )
      ON CONFLICT (user_id, external_key) DO UPDATE SET
        task_id = EXCLUDED.task_id,
        title = EXCLUDED.title,
        url = EXCLUDED.url,
        state = EXCLUDED.state,
        author = EXCLUDED.author,
        severity = EXCLUDED.severity,
        labels = EXCLUDED.labels,
        item_updated_at = EXCLUDED.item_updated_at,
        synced_at = now()
    `
  }

  await sql`
    UPDATE github_connections
    SET list_id = ${listId}, last_synced_at = now(), last_error = NULL, updated_at = now()
    WHERE user_id = ${userId}
  `

  publishToUser(userId, { type: 'list.updated', data: { id: listId } }).catch(() => {})

  return { items: collected.length, list_id: listId }
}