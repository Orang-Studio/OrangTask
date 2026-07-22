import { createHmac } from 'crypto'
import sql from '../db/client.js'

export async function fireWebhooks(userId: string, event: string, data: unknown) {
  const webhooks = await sql`
    SELECT * FROM webhooks
    WHERE user_id = ${userId}
      AND direction = 'outgoing'
      AND enabled = true
      AND (events IS NULL OR ${event} = ANY(events))
  `

  for (const webhook of webhooks) {
    deliverWebhook(webhook, event, data).catch(() => {})
  }
}

async function deliverWebhook(webhook: Record<string, unknown>, event: string, data: unknown, attempt = 1) {
  const payload = {
    event,
    timestamp: new Date().toISOString(),
    data,
  }

  const body = JSON.stringify(payload)
  const signature = webhook.secret
    ? createHmac('sha256', webhook.secret as string).update(body).digest('hex')
    : undefined

  let statusCode: number | undefined
  let responseBody: string | undefined
  let error: string | undefined

  try {
    const res = await fetch(webhook.url as string, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(signature ? { 'X-OrangTask-Signature': `sha256=${signature}` } : {}),
      },
      body,
      signal: AbortSignal.timeout(10000),
    })

    statusCode = res.status
    responseBody = await res.text()
  } catch (err: unknown) {
    error = err instanceof Error ? err.message : String(err)

    if (attempt < 3) {
      const delay = Math.pow(2, attempt) * 1000
      setTimeout(() => deliverWebhook(webhook, event, data, attempt + 1), delay)
    }
  }

  await sql`
    INSERT INTO webhook_deliveries (webhook_id, event, payload, status_code, response_body, delivered_at, error)
    VALUES (
      ${webhook.id as string},
      ${event},
      ${sql.json(payload as never)},
      ${statusCode ?? null},
      ${responseBody ?? null},
      ${statusCode ? new Date() : null},
      ${error ?? null}
    )
  `
}

export async function fireWebhooksForList(listId: string, event: string, data: unknown) {
  const members = await sql`
    SELECT DISTINCT user_id FROM list_members WHERE list_id = ${listId}
    UNION
    SELECT owner_id FROM lists WHERE id = ${listId}
  `

  for (const member of members) {
    fireWebhooks(member.user_id, event, data).catch(() => {})
  }
}
