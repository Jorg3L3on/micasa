import { z } from 'zod';
import { dateStringSchema } from '@/schemas/common.schema';

const flag = z.enum(['true', 'false']).transform((v) => v === 'true');

export const AUDIT_SOURCES = ['WEB', 'AGENT', 'ADMIN', 'SYSTEM'] as const;
export const AUDIT_ACTIONS = ['CREATE', 'UPDATE', 'DELETE'] as const;
export const AUTH_EVENT_KINDS = [
  'LOGIN',
  'LOGIN_FAILED',
  'LOGOUT',
  'REGISTER',
  'PASSWORD_CHANGED',
  'PASSWORD_OVERRIDDEN',
  'API_KEY_CREATED',
  'API_KEY_REVOKED',
  'OAUTH_GRANT_ISSUED',
  'OAUTH_GRANT_REVOKED',
  'AGENT_AUTH_FAILED',
] as const;

/** Kinds every member of a house sees for every other member (Sesiones, house context). */
export const HOUSE_SESSION_KINDS = ['LOGIN', 'LOGOUT', 'LOGIN_FAILED'] as const;

const pagination = {
  cursor: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
};

/** GET /api/audit and /api/audit/export query string. */
export const auditQuerySchema = z.object({
  groupBy: z.enum(['batch']).optional(),
  /** A batch_id, or `tx:<txid>` for rows written without one. */
  batchId: z.string().max(80).optional(),
  entityType: z.string().max(60).optional(),
  entityId: z.string().max(40).optional(),
  actorUserId: z.coerce.number().int().positive().optional(),
  sessionId: z.string().max(80).optional(),
  source: z.enum(AUDIT_SOURCES).optional(),
  action: z.enum(AUDIT_ACTIONS).optional(),
  from: dateStringSchema.optional(),
  to: dateStringSchema.optional(),
  /** Fortnights created on demand are hidden unless asked for. */
  includeFortnights: flag.optional(),
  ...pagination,
});

export type AuditQuery = z.infer<typeof auditQuerySchema>;

/** GET /api/audit/sessions query string. */
export const auditSessionsQuerySchema = z.object({
  kind: z.enum(AUTH_EVENT_KINDS).optional(),
  userId: z.coerce.number().int().positive().optional(),
  from: dateStringSchema.optional(),
  to: dateStringSchema.optional(),
  ...pagination,
});

export type AuditSessionsQuery = z.infer<typeof auditSessionsQuerySchema>;

/** Plain object from URLSearchParams (empty values dropped). */
export const searchParamsObject = (params: URLSearchParams): Record<string, string> =>
  Object.fromEntries([...params.entries()].filter(([, v]) => v !== ''));
