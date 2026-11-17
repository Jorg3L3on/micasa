/**
 * Append-only auth trail (`AuthEvent`): logins, failed logins, logouts,
 * registration, password changes and agent token lifecycle.
 *
 * `recordAuthEvent` never throws: a failed write is logged as
 * `auth_event.write_failed` and the user action carries on (a login must not
 * break because the audit insert did). It never stores a password, a hash, a
 * raw user agent or an email that does not belong to an existing user.
 */
import type { AuthEventKind, Prisma } from '@/generated/prisma/client'
import { logFinanceEvent } from '@/lib/observability/finance-log'
import prisma from '@/lib/prisma'
import { getAuditActor, type AuditSource } from './audit-context'
import { auditRequestId } from './route-actor'
import { clientIp, describeUserAgent } from './user-agent'

export type { AuthEventKind }

export type AuthEventInput = {
  userId?: number | null
  /** Only for an existing user's address; never for unknown emails. */
  email?: string | null
  sessionId?: string | null
  source?: AuditSource
  /** The request (or its headers) the event came from: IP, device, request id. */
  request?: Pick<Request, 'headers'> | null
  apiKeyId?: number | null
  oauthGrantId?: number | null
  /** The admin, for PASSWORD_OVERRIDDEN. */
  actorUserId?: number | null
  metadata?: Record<string, string | number | boolean | null>
}

/** Metadata keys that must never reach an auth event, whatever the caller passes. */
const FORBIDDEN_METADATA = /password|hash|secret|token|user_?agent/i

export const authEventData = (kind: AuthEventKind, input: AuthEventInput): Prisma.AuthEventCreateInput => {
  const headers = input.request?.headers ?? null
  const metadata = Object.fromEntries(
    Object.entries(input.metadata ?? {}).filter(([key]) => !FORBIDDEN_METADATA.test(key)),
  )
  return {
    kind,
    user: input.userId ? { connect: { id: input.userId } } : undefined,
    email: input.email?.trim().toLowerCase() || null,
    session_id: input.sessionId ?? getAuditActor()?.sessionId ?? null,
    source: input.source ?? 'WEB',
    ip: clientIp(headers),
    user_agent: describeUserAgent(headers?.get('user-agent')),
    request_id: headers ? auditRequestId(input.request as Request) : null,
    api_key_id: input.apiKeyId ?? null,
    oauth_grant_id: input.oauthGrantId ?? null,
    actor: input.actorUserId ? { connect: { id: input.actorUserId } } : undefined,
    metadata: Object.keys(metadata).length ? metadata : undefined,
  }
}

/**
 * Writes one auth event, outside any caller transaction on purpose: a failed
 * insert inside one would roll back the user action it describes.
 */
export const recordAuthEvent = async (kind: AuthEventKind, input: AuthEventInput): Promise<void> => {
  try {
    await prisma.authEvent.create({ data: authEventData(kind, input) })
  } catch (error) {
    logFinanceEvent('warn', 'auth_event.write_failed', {
      kind,
      user_id: input.userId ?? null,
      error: error instanceof Error ? error.message.slice(0, 200) : String(error),
    })
  }
}
