import redis from '../services/redis.js'
import Redis from 'ioredis'
import sql from '../db/client.js'

type WSClient = {
  userId: string
  send: (data: string) => void
}

const clients = new Map<string, Set<WSClient>>()

const subscriber = new Redis(process.env.REDIS_URL || 'redis://localhost:6379')
subscriber.subscribe('orangtask:events', (err) => {
  if (err) console.error('Redis subscribe error:', err)
})

subscriber.on('message', (_channel, message) => {
  try {
    const { userId, payload } = JSON.parse(message)
    const userClients = clients.get(userId)
    if (userClients) {
      const msg = JSON.stringify(payload)
      for (const client of userClients) {
        try { client.send(msg) } catch {}
      }
    }
  } catch {}
})

export function addClient(client: WSClient) {
  if (!clients.has(client.userId)) clients.set(client.userId, new Set())
  clients.get(client.userId)!.add(client)
}

export function removeClient(client: WSClient) {
  const userClients = clients.get(client.userId)
  if (userClients) {
    userClients.delete(client)
    if (userClients.size === 0) clients.delete(client.userId)
  }
}

export async function publishToUser(userId: string, payload: unknown) {
  await redis.publish('orangtask:events', JSON.stringify({ userId, payload }))
}

export async function broadcastToListMembers(listId: string, payload: unknown) {
  const members = await sql`
    SELECT DISTINCT user_id FROM list_members WHERE list_id = ${listId}
    UNION
    SELECT owner_id as user_id FROM lists WHERE id = ${listId}
  `

  for (const m of members) {
    publishToUser(m.user_id, payload).catch(() => {})
  }
}
