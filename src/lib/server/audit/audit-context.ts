/**
 * Who is writing: the actor scope that `src/lib/prisma.ts` turns into
 * `set_config('micasa.audit_actor', json, true)` at the start of every
 * transaction (read by the `audit.row_change()` trigger).
 *
 * Entry points open the scope; a value-returning helper cannot, because the
 * store would not reach its caller after an `await`:
 * - web routes: `withOwnerContext` / `withAdmin`
 * - MCP tools: `runAgentTool` / `runAgentUserTool`
 * - seed, cron and scripts: `runWithAuditActor({ source: 'SYSTEM', label })`
 */
import { AsyncLocalStorage } from 'node:async_hooks'
import { randomUUID } from 'node:crypto'

export type AuditSource = 'WEB' | 'AGENT' | 'ADMIN' | 'SYSTEM'

export type AuditMetadataValue = string | number | boolean | null

export type AuditActor = {
  source: AuditSource
  userId?: number | null
  actorName?: string | null
  /** JWT `sid` of the web session. */
  sessionId?: string | null
  apiKeyId?: number | null
  oauthGrantId?: number | null
  requestId?: string | null
  /** One per request / tool call; groups its rows in Actividad. */
  batchId: string
  /** Human label of the batch, e.g. "Importación de estado de cuenta: Mercado Pago". */
  label?: string | null
  /** Route, tool name… (never secrets). */
  metadata?: Record<string, AuditMetadataValue>
}

export type AuditActorInput = Omit<AuditActor, 'batchId'> & { batchId?: string }

/**
 * One store per process. Next.js instantiates server modules more than once
 * (route handlers, server components, HMR), while the Prisma client in
 * src/lib/prisma.ts is a `globalThis` singleton: a module-level store would
 * leave the client reading a different store than the entry point wrote.
 */
const STORAGE_KEY = Symbol.for('micasa.auditActorStorage')
const globalStore = globalThis as unknown as Record<symbol, AsyncLocalStorage<{ actor: AuditActor }> | undefined>
const storage = (globalStore[STORAGE_KEY] ??= new AsyncLocalStorage<{ actor: AuditActor }>())

export const runWithAuditActor = <T>(actor: AuditActorInput, fn: () => T): T =>
  storage.run({ actor: { ...actor, batchId: actor.batchId ?? randomUUID() } }, fn)

export const getAuditActor = (): AuditActor | null => storage.getStore()?.actor ?? null

type AuditScope = { actor: AuditActor }

/** The current scope, to re-enter later (e.g. when a lazy write is awaited outside it). */
export const captureAuditScope = (): AuditScope | undefined => storage.getStore()

export const runInAuditScope = <T>(scope: AuditScope | undefined, fn: () => T): T =>
  scope ? storage.run(scope, fn) : fn()

/** Labels the current batch (every later write in this scope carries it). */
export const setAuditLabel = (label: string) => {
  const store = storage.getStore()
  if (store) store.actor = { ...store.actor, label }
}

/** The JSON contract read by `audit.row_change()` (version 1). */
export const serializeAuditActor = (actor: AuditActor): string =>
  JSON.stringify({
    v: 1,
    source: actor.source,
    user_id: actor.userId ?? null,
    actor_name: actor.actorName ?? null,
    session_id: actor.sessionId ?? null,
    batch_id: actor.batchId,
    request_id: actor.requestId ?? null,
    api_key_id: actor.apiKeyId ?? null,
    oauth_grant_id: actor.oauthGrantId ?? null,
    label: actor.label ?? null,
    metadata: actor.metadata ?? {},
  })
