import { randomBytes } from 'crypto'
import type { Sql, TransactionSql } from 'postgres'
import type { AppUser } from '../types.js'

const ACCESS_TTL_MS = 60 * 60 * 1000
const REFRESH_TTL_MS = 365 * 24 * 60 * 60 * 1000

export class InvalidSessionError extends Error {
  constructor() {
    super('Invalid or expired session')
  }
}

export function validCompanionDeviceId(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9._:-]{1,128}$/.test(value)
}

type TokenPair = { accessToken: string; refreshToken: string }
type CompanionTokens = TokenPair & { user: AppUser & { pin_enabled: boolean } }

async function createAccessToken(tx: TransactionSql, userId: string, refreshId: string) {
  const token = randomBytes(32).toString('hex')
  await tx`DELETE FROM sessions WHERE refresh_token_id = ${refreshId} AND expires_at <= now()`
  await tx`
    INSERT INTO sessions (user_id, token, expires_at, refresh_token_id)
    VALUES (${userId}, ${token}, ${new Date(Date.now() + ACCESS_TTL_MS)}, ${refreshId})
  `
  return token
}

export function createSessionTokens(sql: Sql) {
  return {
    async createTokenPair(userId: string): Promise<TokenPair> {
      return sql.begin(async (tx) => {
        const refreshToken = randomBytes(48).toString('hex')
        const [refresh] = await tx`
          INSERT INTO refresh_tokens (user_id, token, expires_at)
          VALUES (${userId}, ${refreshToken}, ${new Date(Date.now() + REFRESH_TTL_MS)})
          RETURNING id
        `
        const accessToken = await createAccessToken(tx, userId, refresh.id)
        return { accessToken, refreshToken }
      })
    },

    async refresh(refreshToken: string): Promise<string> {
      return sql.begin(async (tx) => {
        // serialize renewal with logout a deleted parent can never be used to create a fresh access session after its watches have been revoked
        const [refresh] = await tx`
          SELECT rt.id, rt.user_id FROM refresh_tokens rt
          JOIN users u ON u.id = rt.user_id
          WHERE rt.token = ${refreshToken} AND rt.expires_at > now()
          FOR UPDATE OF rt
        `
        if (!refresh) throw new InvalidSessionError()

        const accessToken = await createAccessToken(tx, refresh.user_id, refresh.id)
        await tx`
          UPDATE refresh_tokens SET expires_at = ${new Date(Date.now() + REFRESH_TTL_MS)}
          WHERE id = ${refresh.id}
        `
        return accessToken
      })
    },

    async companion(
      userId: string,
      phoneAccessToken: string,
      phoneRefreshToken: string,
      deviceId: string,
    ): Promise<CompanionTokens> {
      return sql.begin(async (tx) => {
        // the parent lock also serializes repeated connection requests from one watch so retries reuse its stable refresh token
        const [phone] = await tx`
          SELECT rt.id, u.id AS user_id, u.email, u.name, u.avatar_url,
                 u.pin_hash IS NOT NULL AS pin_enabled
          FROM refresh_tokens rt JOIN users u ON u.id = rt.user_id
          WHERE rt.token = ${phoneRefreshToken} AND rt.user_id = ${userId}
            AND rt.expires_at > now() AND rt.parent_refresh_token_id IS NULL
          FOR UPDATE OF rt
        `
        if (!phone) throw new InvalidSessionError()

        // aPI keys and watch sessions cannot mint watch sessions
        const [session] = await tx`
          SELECT id FROM sessions
          WHERE token = ${phoneAccessToken} AND user_id = ${userId} AND expires_at > now()
            AND (refresh_token_id IS NULL OR refresh_token_id = ${phone.id})
        `
        if (!session) throw new InvalidSessionError()

        let [watch] = await tx`
          SELECT id, token FROM refresh_tokens
          WHERE parent_refresh_token_id = ${phone.id} AND companion_device_id = ${deviceId}
          FOR UPDATE
        `
        const refreshExpiry = new Date(Date.now() + REFRESH_TTL_MS)
        if (watch) {
          await tx`UPDATE refresh_tokens SET expires_at = ${refreshExpiry} WHERE id = ${watch.id}`
        } else {
          const token = randomBytes(48).toString('hex')
          ;[watch] = await tx`
            INSERT INTO refresh_tokens (user_id, token, expires_at, parent_refresh_token_id, companion_device_id)
            VALUES (${userId}, ${token}, ${refreshExpiry}, ${phone.id}, ${deviceId})
            RETURNING id, token
          `
        }
        const accessToken = await createAccessToken(tx, userId, watch.id)
        return {
          accessToken,
          refreshToken: watch.token,
          user: {
            id: phone.user_id,
            email: phone.email,
            name: phone.name,
            avatar_url: phone.avatar_url,
            pin_enabled: phone.pin_enabled,
          },
        }
      })
    },
  }
}
