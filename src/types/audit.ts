/** Read-side shapes of the audit log (API ↔ Actividad UI). */

export type AuditSourceDto = 'WEB' | 'AGENT' | 'ADMIN' | 'SYSTEM';
export type AuditActionDto = 'CREATE' | 'UPDATE' | 'DELETE';

export type AuditActorDto = {
  userId: number | null;
  name: string | null;
  source: AuditSourceDto;
  /** Connection label for agent writes (API key name or OAuth client). */
  agent: string | null;
  tool: string | null;
  /** Written outside the app (console, MCP run_sql, script). */
  missingActor: boolean;
};

export type AuditChangeDto = {
  field: string;
  label: string;
  before: string | null;
  after: string | null;
};

export type AuditRowDto = {
  id: string;
  occurredAt: string;
  batchKey: string;
  label: string | null;
  sessionId: string | null;
  actor: AuditActorDto;
  action: AuditActionDto;
  entityType: string;
  entityTypeLabel: string;
  entityId: string;
  entityLabel: string | null;
  /** e.g. "editó Gasto: Luz CFE". */
  summary: string;
  changes: AuditChangeDto[];
};

export type AuditBatchDto = {
  batchKey: string;
  occurredAt: string;
  startedAt: string;
  label: string | null;
  sessionId: string | null;
  actor: AuditActorDto;
  counts: { total: number; create: number; update: number; delete: number };
  /** e.g. "editó Gasto: Luz CFE" or "Importación de estado de cuenta: Mercado Pago · 12 cambios". */
  summary: string;
};

export type AuditPage<T> = { items: T[]; nextCursor: string | null };

export type AuthEventDto = {
  id: string;
  occurredAt: string;
  kind: string;
  userId: number | null;
  userName: string | null;
  email: string | null;
  sessionId: string | null;
  source: AuditSourceDto;
  ip: string | null;
  device: string | null;
  reason: string | null;
  metadata: Record<string, unknown> | null;
  /** LOGIN only: audit rows written with this session in the current context. */
  changeCount: number | null;
  lastActivityAt: string | null;
};
