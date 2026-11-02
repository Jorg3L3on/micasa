/**
 * Helpers for the DATABASE_URL-gated Vitest project (`npm run test:db`).
 *
 * These tests write to a real Postgres with every migration applied. They run
 * only when DATABASE_URL points at a local server (CI's Postgres service, or a
 * local throwaway database); a remote URL such as the Neon one in `.env` makes
 * them skip, so they can never touch production.
 *
 *   createdb micasa_test && DATABASE_URL=postgresql://localhost:5432/micasa_test npx prisma migrate deploy
 *   DATABASE_URL=postgresql://localhost:5432/micasa_test npm run test:db
 */
import { Pool, type PoolClient } from 'pg'

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]'])

export const localDatabaseUrl = (): string | null => {
  const raw = process.env.DATABASE_URL
  if (!raw) return null
  try {
    const url = new URL(raw)
    if (!LOCAL_HOSTS.has(url.hostname)) return null
    if (url.username === 'prisma' && url.password === 'prisma') return null // prisma.config.ts placeholder
    return raw
  } catch {
    return null
  }
}

export const DB_URL = localDatabaseUrl()

let pool: Pool | null = null
export const testPool = (): Pool => {
  if (!DB_URL) throw new Error('DB tests need a local DATABASE_URL')
  pool ??= new Pool({ connectionString: DB_URL, max: 4 })
  return pool
}

export const closeTestPool = async () => {
  await pool?.end()
  pool = null
}

export type Actor = {
  v: 1
  source: 'WEB' | 'AGENT' | 'ADMIN' | 'SYSTEM'
  user_id?: number | null
  actor_name?: string | null
  session_id?: string | null
  batch_id?: string | null
  request_id?: string | null
  api_key_id?: number | null
  oauth_grant_id?: number | null
  label?: string | null
  metadata?: Record<string, unknown>
}

/** Runs `fn` in a transaction that is always rolled back. */
export const inRollback = async <T>(fn: (c: PoolClient) => Promise<T>): Promise<T> => {
  const client = await testPool().connect()
  try {
    await client.query('BEGIN')
    return await fn(client)
  } finally {
    await client.query('ROLLBACK').catch(() => undefined)
    client.release()
  }
}

export const setActor = (c: PoolClient, actor: Actor | string | null) =>
  c.query(`SELECT set_config('micasa.audit_actor', $1, true)`, [
    actor === null ? '' : typeof actor === 'string' ? actor : JSON.stringify(actor),
  ])

export type AuditRow = {
  id: string
  txid: string
  batch_id: string | null
  label: string | null
  request_id: string | null
  session_id: string | null
  source: string
  actor_user_id: number | null
  actor_name: string | null
  api_key_id: number | null
  oauth_grant_id: number | null
  owner_type: 'USER' | 'HOUSE' | null
  owner_id: number | null
  entity_type: string
  entity_id: string
  entity_label: string | null
  action: 'CREATE' | 'UPDATE' | 'DELETE'
  changed_fields: string[]
  before: Record<string, unknown> | null
  after: Record<string, unknown> | null
  metadata: Record<string, unknown> | null
}

export const maxAuditId = async (c: PoolClient): Promise<string> => {
  const { rows } = await c.query<{ id: string | null }>(`SELECT max(id)::text AS id FROM "AuditLog"`)
  return rows[0]?.id ?? '0'
}

export const auditRowsSince = async (c: PoolClient, sinceId: string): Promise<AuditRow[]> => {
  const { rows } = await c.query<AuditRow>(
    `SELECT id::text, txid::text, batch_id, label, request_id, session_id, source::text,
            actor_user_id, actor_name, api_key_id, oauth_grant_id, owner_type::text, owner_id,
            entity_type, entity_id, entity_label, action::text, changed_fields, before, after, metadata
       FROM "AuditLog" a WHERE a.id > $1::bigint ORDER BY a.id`,
    [sinceId],
  )
  return rows
}

export const insertReturningId = async (c: PoolClient, sql: string, params: unknown[] = []): Promise<number> => {
  const { rows } = await c.query<{ id: number }>(`${sql} RETURNING id`, params)
  return rows[0]!.id
}
