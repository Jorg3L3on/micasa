/**
 * Read side of the audit log: owner-scoped rows, batch summaries, sessions and
 * CSV. Filters are built once as SQL so the list, the batch view and the export
 * always agree.
 */
import { Prisma } from '@/generated/prisma/client';
import prisma from '@/lib/prisma';
import { fromDatabaseTimestamp } from '@/lib/calendar-dates';
import {
  ACTION_LABELS,
  ENTITY_LABELS,
  entityLabel,
  fieldSpec,
  formatAuditValue,
  isVisibleField,
} from '@/lib/audit/labels';
import { HOUSE_SESSION_KINDS, type AuditQuery, type AuditSessionsQuery } from '@/schemas/audit.schema';
import type {
  AuditActionDto,
  AuditActorDto,
  AuditBatchDto,
  AuditChangeDto,
  AuditPage,
  AuditRowDto,
  AuditSourceDto,
  AuthEventDto,
} from '@/types/audit';

/** Whose log: a house, or one user's personal context. */
export type AuditScope =
  | { ownerType: 'HOUSE'; ownerId: number }
  | { ownerType: 'USER'; ownerId: number };

export const auditScopeFromOwner = (ownerType: 'user' | 'house', ownerId: number): AuditScope =>
  ownerType === 'house' ? { ownerType: 'HOUSE', ownerId } : { ownerType: 'USER', ownerId };

/**
 * /admin/audit: every tenant, optionally narrowed to one owner or to writes
 * made outside the app. Includes the older AdminAuditLog rows as ADMIN changes.
 */
export type AdminAuditScope = { kind: 'admin'; owner?: AuditScope; missingActor?: boolean };

type AnyScope = AuditScope | AdminAuditScope;

const isAdminScope = (scope: AnyScope): scope is AdminAuditScope => 'kind' in scope;

export const EXPORT_ROW_LIMIT = 5000;

// --- cursors -------------------------------------------------------------------

/** `(occurred_at, id)` of the last item, as stored (wall clock), base64url. */
const encodeCursor = (occurredAt: Date, id: bigint | string) =>
  Buffer.from(`${occurredAt.toISOString().replace('Z', '')}|${id}`).toString('base64url');

const decodeCursor = (cursor: string | undefined): { at: string; id: string } | null => {
  if (!cursor) return null;
  try {
    const [at, id] = Buffer.from(cursor, 'base64url').toString('utf8').split('|');
    // Ids are negative for merged AdminAuditLog rows (admin view).
    if (!at || !id || !/^-?\d+$/.test(id) || Number.isNaN(Date.parse(`${at}Z`))) return null;
    return { at, id };
  } catch {
    return null;
  }
};

// --- filters -------------------------------------------------------------------

const dayStart = (ymd: string) => `${ymd} 00:00:00`;
const nextDayStart = (ymd: string) => {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return `${d.toISOString().slice(0, 10)} 00:00:00`;
};

const batchKeySql = Prisma.sql`coalesce(a.batch_id, 'tx:' || a.txid::text)`;

/**
 * Rows to read (alias `a`). The admin view merges the older AdminAuditLog as
 * ADMIN changes to the target user (negative ids, batch `admin:<id>`).
 */
const auditSourceSql = (scope: AnyScope): Prisma.Sql =>
  isAdminScope(scope)
    ? Prisma.sql`(
        SELECT id, occurred_at, txid, batch_id, label, request_id, session_id, source, actor_user_id,
               actor_name, api_key_id, oauth_grant_id, owner_type, owner_id, entity_type, entity_id,
               entity_label, action, changed_fields, before, after, metadata
          FROM "AuditLog"
        UNION ALL
        SELECT -l.id, l.created_at, 0, 'admin:' || l.id,
               CASE l.action WHEN 'admin.password_override' THEN 'Soporte asignó una contraseña temporal' ELSE l.action END,
               NULL, NULL, 'ADMIN'::"AuditSource", l.actor_user_id, actor.name, NULL, NULL,
               CASE WHEN l.target_user_id IS NULL THEN NULL ELSE 'USER'::"AuditOwnerType" END, l.target_user_id,
               'User', coalesce(l.target_user_id::text, ''), target.name, 'UPDATE'::"AuditAction",
               ARRAY[]::text[], NULL, NULL,
               coalesce(l.metadata, '{}'::jsonb) - 'target_email' || '{"legacy_admin_log": true}'::jsonb
          FROM "AdminAuditLog" l
          LEFT JOIN "User" actor ON actor.id = l.actor_user_id
          LEFT JOIN "User" target ON target.id = l.target_user_id
      )`
    : Prisma.sql`"AuditLog"`;

/** WHERE clause for audit rows of one scope (alias `a`). */
const auditFilterSql = (scope: AnyScope, q: Partial<AuditQuery>): Prisma.Sql => {
  const owner = isAdminScope(scope) ? scope.owner : scope;
  const parts: Prisma.Sql[] = [Prisma.sql`TRUE`];
  if (owner) {
    parts.push(Prisma.sql`a.owner_type = ${owner.ownerType}::"AuditOwnerType"`, Prisma.sql`a.owner_id = ${owner.ownerId}`);
  }
  if (isAdminScope(scope) && scope.missingActor) {
    parts.push(Prisma.sql`coalesce(a.metadata->>'missing_actor', 'false') = 'true'`);
  }
  if (q.batchId) {
    parts.push(
      q.batchId.startsWith('tx:') && /^tx:\d+$/.test(q.batchId)
        ? Prisma.sql`a.batch_id IS NULL AND a.txid = ${BigInt(q.batchId.slice(3))}`
        : Prisma.sql`a.batch_id = ${q.batchId}`,
    );
  }
  if (q.entityType) parts.push(Prisma.sql`a.entity_type = ${q.entityType}`);
  if (q.entityId) parts.push(Prisma.sql`a.entity_id = ${q.entityId}`);
  if (q.actorUserId) parts.push(Prisma.sql`a.actor_user_id = ${q.actorUserId}`);
  if (q.sessionId) parts.push(Prisma.sql`a.session_id = ${q.sessionId}`);
  if (q.source) parts.push(Prisma.sql`a.source = ${q.source}::"AuditSource"`);
  if (q.action) parts.push(Prisma.sql`a.action = ${q.action}::"AuditAction"`);
  if (q.from) parts.push(Prisma.sql`a.occurred_at >= ${dayStart(q.from)}::timestamp`);
  if (q.to) parts.push(Prisma.sql`a.occurred_at < ${nextDayStart(q.to)}::timestamp`);
  // A fortnight's own history (entity filter) always shows its creation.
  if (!q.includeFortnights && !q.entityType) {
    parts.push(Prisma.sql`NOT (a.entity_type = 'Fortnight' AND a.action = 'CREATE')`);
  }
  return Prisma.join(parts, ' AND ');
};

// --- mapping -------------------------------------------------------------------

type AuditLogRow = {
  id: bigint;
  occurred_at: Date;
  batch_key: string;
  label: string | null;
  session_id: string | null;
  source: AuditSourceDto;
  actor_user_id: number | null;
  actor_name: string | null;
  action: AuditActionDto;
  entity_type: string;
  entity_id: string;
  entity_label: string | null;
  changed_fields: string[] | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
};

const metaString = (metadata: Record<string, unknown> | null, key: string): string | null => {
  const value = metadata?.[key];
  return typeof value === 'string' && value ? value : null;
};

const actorDto = (row: {
  actor_user_id: number | null;
  actor_name: string | null;
  source: AuditSourceDto;
  metadata?: Record<string, unknown> | null;
  missing_actor?: boolean | null;
  agent?: string | null;
  tool?: string | null;
}): AuditActorDto => ({
  userId: row.actor_user_id,
  name: row.actor_name,
  source: row.source,
  agent: row.agent ?? metaString(row.metadata ?? null, 'agent'),
  tool: row.tool ?? metaString(row.metadata ?? null, 'tool'),
  missingActor: row.missing_actor ?? row.metadata?.missing_actor === true,
});

/** Reference columns shown by name instead of `#id`, and where the name lives. */
const REF_TARGETS: Readonly<Record<string, { table: string; column: string }>> = {
  wallet_id: { table: 'Wallet', column: 'name' },
  source_wallet_id: { table: 'Wallet', column: 'name' },
  credit_card_wallet_id: { table: 'Wallet', column: 'name' },
  from_wallet_id: { table: 'Wallet', column: 'name' },
  to_wallet_id: { table: 'Wallet', column: 'name' },
  linked_wallet_id: { table: 'Wallet', column: 'name' },
  category_id: { table: 'Category', column: 'name' },
  parent_id: { table: 'Category', column: 'name' },
  fortnight_id: { table: 'Fortnight', column: 'label' },
  house_id: { table: 'House', column: 'name' },
  user_id: { table: 'User', column: 'name' },
  assignee_user_id: { table: 'User', column: 'name' },
  owner_id: { table: 'User', column: 'name' },
  created_by_user_id: { table: 'User', column: 'name' },
  budget_id: { table: 'Budget', column: 'name' },
  loan_id: { table: 'Loan', column: 'name' },
  lender_id: { table: 'Lender', column: 'name' },
  plan_id: { table: 'CreditCardInstallmentPlan', column: 'name' },
  expense_template_id: { table: 'ExpenseTemplate', column: 'name' },
  income_template_id: { table: 'IncomeTemplate', column: 'name' },
};

/** `table → id → name` for every reference on a page of rows (one query per table). */
type RefNames = Map<string, Map<number, string>>;

const resolveRefNames = async (rows: AuditLogRow[]): Promise<RefNames> => {
  const wanted = new Map<string, Set<number>>();
  for (const row of rows) {
    for (const blob of [row.before, row.after]) {
      for (const [field, value] of Object.entries(blob ?? {})) {
        const target = REF_TARGETS[field];
        if (!target || typeof value !== 'number') continue;
        if (!wanted.has(target.table)) wanted.set(target.table, new Set());
        wanted.get(target.table)!.add(value);
      }
    }
  }
  const names: RefNames = new Map();
  await Promise.all(
    [...wanted].map(async ([table, ids]) => {
      const column = Object.values(REF_TARGETS).find((t) => t.table === table)!.column;
      const found = await prisma.$queryRaw<{ id: number; name: string | null }[]>`
        SELECT id, ${Prisma.raw(`"${column}"`)} AS name
          FROM ${Prisma.raw(`"${table}"`)}
         WHERE id IN (${Prisma.join([...ids])})`;
      names.set(table, new Map(found.filter((r) => r.name).map((r) => [r.id, r.name!])));
    }),
  );
  return names;
};

const displayValue = (model: string, field: string, value: unknown, refs: RefNames): string => {
  const target = REF_TARGETS[field];
  if (target && typeof value === 'number') {
    const name = refs.get(target.table)?.get(value);
    if (name) return name;
  }
  return formatAuditValue(model, field, value);
};

/** Name-like fields first, then the amount, then the rest by label. */
const FIELD_PRIORITY = ['name', 'description', 'label', 'source', 'amount', 'total_amount'];
const byPriorityThenLabel = (model: string) => (a: string, b: string) => {
  const pa = FIELD_PRIORITY.indexOf(a);
  const pb = FIELD_PRIORITY.indexOf(b);
  if (pa !== pb) return (pa === -1 ? 99 : pa) - (pb === -1 ? 99 : pb);
  return fieldSpec(model, a).label.localeCompare(fieldSpec(model, b).label, 'es');
};

const changesOf = (row: AuditLogRow, refs: RefNames): AuditChangeDto[] => {
  const model = row.entity_type;
  const snapshot = row.action === 'CREATE' ? row.after : row.before;
  const fields =
    row.action === 'UPDATE'
      ? (row.changed_fields ?? [])
      : Object.keys(snapshot ?? {}).filter((field) => {
          const value = snapshot?.[field];
          return value !== null && value !== '' && !(Array.isArray(value) && value.length === 0);
        });
  return fields
    .filter(isVisibleField)
    .sort(byPriorityThenLabel(model))
    .map((field) => ({
      field,
      label: fieldSpec(model, field).label,
      before: row.action === 'CREATE' ? null : displayValue(model, field, row.before?.[field], refs),
      after: row.action === 'DELETE' ? null : displayValue(model, field, row.after?.[field], refs),
    }))
    // e.g. a civil date whose stored time moved: nothing a person would see changed.
    .filter((change) => row.action !== 'UPDATE' || change.before !== change.after);
};

const rowSummary = (action: AuditActionDto, entityType: string, label: string | null) =>
  `${ACTION_LABELS[action].verb} ${entityLabel(entityType)}${label ? `: ${label}` : ''}`;

const rowDto = (row: AuditLogRow, refs: RefNames): AuditRowDto => ({
  id: row.id.toString(),
  occurredAt: fromDatabaseTimestamp(row.occurred_at).toISOString(),
  batchKey: row.batch_key,
  label: row.label,
  sessionId: row.session_id,
  actor: actorDto(row),
  action: row.action,
  entityType: row.entity_type,
  entityTypeLabel: entityLabel(row.entity_type),
  entityId: row.entity_id,
  entityLabel: row.entity_label,
  summary: rowSummary(row.action, row.entity_type, row.entity_label),
  changes: changesOf(row, refs),
});

const ROW_COLUMNS = Prisma.sql`
  a.id, a.occurred_at, ${batchKeySql} AS batch_key, a.label, a.session_id, a.source::text AS source,
  a.actor_user_id, a.actor_name, a.action::text AS action, a.entity_type, a.entity_id, a.entity_label,
  a.changed_fields, a.before, a.after, a.metadata`;

// --- rows ------------------------------------------------------------------------

export const listAuditRows = async (
  scope: AnyScope,
  q: Partial<AuditQuery> & { limit: number },
): Promise<AuditPage<AuditRowDto>> => {
  const cursor = decodeCursor(q.cursor);
  const where = cursor
    ? Prisma.sql`${auditFilterSql(scope, q)} AND (a.occurred_at, a.id) < (${cursor.at}::timestamp, ${BigInt(cursor.id)})`
    : auditFilterSql(scope, q);
  const rows = await prisma.$queryRaw<AuditLogRow[]>`
    SELECT ${ROW_COLUMNS}
      FROM ${auditSourceSql(scope)} a
     WHERE ${where}
     ORDER BY a.occurred_at DESC, a.id DESC
     LIMIT ${q.limit + 1}`;
  const page = rows.slice(0, q.limit);
  const last = page[page.length - 1];
  const refs = await resolveRefNames(page);
  return {
    items: page.map((row) => rowDto(row, refs)),
    nextCursor: rows.length > q.limit && last ? encodeCursor(last.occurred_at, last.id) : null,
  };
};

// --- batches --------------------------------------------------------------------

type BatchRow = {
  batch_key: string;
  occurred_at: Date;
  started_at: Date;
  last_id: bigint;
  total: number;
  creates: number;
  updates: number;
  deletes: number;
  source: AuditSourceDto;
  actor_user_id: number | null;
  actor_name: string | null;
  label: string | null;
  session_id: string | null;
  first_entity_type: string;
  first_entity_label: string | null;
  first_action: AuditActionDto;
  entity_types: number;
  missing_actor: boolean;
  agent: string | null;
  tool: string | null;
};

const pluralEntity = (model: string) => ENTITY_LABELS[model]?.plural ?? model;

export const batchSummary = (b: Pick<
  BatchRow,
  'total' | 'creates' | 'updates' | 'deletes' | 'label' | 'first_entity_type' | 'first_entity_label' | 'first_action' | 'entity_types'
>): string => {
  if (b.total === 1) return rowSummary(b.first_action, b.first_entity_type, b.first_entity_label);
  const counts = `${b.total} cambios`;
  if (b.label) return `${b.label} · ${counts}`;
  if (b.entity_types === 1) {
    const only =
      b.creates === b.total ? 'CREATE' : b.updates === b.total ? 'UPDATE' : b.deletes === b.total ? 'DELETE' : null;
    if (only) return `${ACTION_LABELS[only].verb} ${b.total} ${pluralEntity(b.first_entity_type)}`;
  }
  return `${rowSummary(b.first_action, b.first_entity_type, b.first_entity_label)} y ${b.total - 1} cambios más`;
};

export const listAuditBatches = async (
  scope: AnyScope,
  q: Partial<AuditQuery> & { limit: number },
): Promise<AuditPage<AuditBatchDto>> => {
  const cursor = decodeCursor(q.cursor);
  const having = cursor
    ? Prisma.sql`HAVING (max(a.occurred_at), max(a.id)) < (${cursor.at}::timestamp, ${BigInt(cursor.id)})`
    : Prisma.empty;
  const rows = await prisma.$queryRaw<BatchRow[]>`
    SELECT ${batchKeySql} AS batch_key,
           max(a.occurred_at) AS occurred_at,
           min(a.occurred_at) AS started_at,
           max(a.id) AS last_id,
           count(*)::int AS total,
           (count(*) FILTER (WHERE a.action = 'CREATE'))::int AS creates,
           (count(*) FILTER (WHERE a.action = 'UPDATE'))::int AS updates,
           (count(*) FILTER (WHERE a.action = 'DELETE'))::int AS deletes,
           (array_agg(a.source::text ORDER BY a.id))[1] AS source,
           (array_agg(a.actor_user_id ORDER BY a.id))[1] AS actor_user_id,
           (array_agg(a.actor_name ORDER BY a.id))[1] AS actor_name,
           max(a.label) AS label,
           (array_agg(a.session_id ORDER BY a.id))[1] AS session_id,
           (array_agg(a.entity_type ORDER BY a.id))[1] AS first_entity_type,
           (array_agg(a.entity_label ORDER BY a.id))[1] AS first_entity_label,
           (array_agg(a.action::text ORDER BY a.id))[1] AS first_action,
           count(DISTINCT a.entity_type)::int AS entity_types,
           bool_or(coalesce(a.metadata->>'missing_actor', 'false') = 'true') AS missing_actor,
           max(a.metadata->>'agent') AS agent,
           max(a.metadata->>'tool') AS tool
      FROM ${auditSourceSql(scope)} a
     WHERE ${auditFilterSql(scope, q)}
     GROUP BY 1
     ${having}
     ORDER BY max(a.occurred_at) DESC, max(a.id) DESC
     LIMIT ${q.limit + 1}`;
  const page = rows.slice(0, q.limit);
  const last = page[page.length - 1];
  return {
    items: page.map((b) => ({
      batchKey: b.batch_key,
      occurredAt: fromDatabaseTimestamp(b.occurred_at).toISOString(),
      startedAt: fromDatabaseTimestamp(b.started_at).toISOString(),
      label: b.label,
      sessionId: b.session_id,
      actor: actorDto(b),
      counts: { total: b.total, create: b.creates, update: b.updates, delete: b.deletes },
      summary: batchSummary(b),
    })),
    nextCursor: rows.length > q.limit && last ? encodeCursor(last.occurred_at, last.last_id) : null,
  };
};

// --- CSV ---------------------------------------------------------------------------

const csvEscape = (value: string | number | null | undefined) => {
  const s = value == null ? '' : String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const CSV_HEADER = [
  'fecha',
  'origen',
  'actor',
  'accion',
  'tipo',
  'id',
  'nombre',
  'campo',
  'antes',
  'despues',
  'etiqueta',
  'lote',
  'sesion',
];

/** One line per changed field (a row with no visible field still gets one line). */
export const auditRowsToCsv = (rows: AuditRowDto[]): string => {
  const lines = [CSV_HEADER.join(',')];
  for (const row of rows) {
    const actor = row.actor.missingActor ? 'Fuera de la app' : (row.actor.name ?? '');
    const base = [
      row.occurredAt,
      row.actor.source,
      actor,
      ACTION_LABELS[row.action].label,
      row.entityTypeLabel,
      row.entityId,
      row.entityLabel,
    ];
    const tail = [row.label, row.batchKey, row.sessionId];
    const changes = row.changes.length ? row.changes : [{ label: '', before: null, after: null }];
    for (const change of changes) {
      lines.push([...base, change.label, change.before, change.after, ...tail].map(csvEscape).join(','));
    }
  }
  return `${lines.join('\n')}\n`;
};

export const exportAuditRows = async (scope: AnyScope, q: Partial<AuditQuery>): Promise<AuditRowDto[]> => {
  const { items } = await listAuditRows(scope, { ...q, cursor: undefined, limit: EXPORT_ROW_LIMIT });
  return items;
};

// --- sessions -------------------------------------------------------------------

type AuthEventRow = {
  id: bigint;
  occurred_at: Date;
  kind: string;
  user_id: number | null;
  user_name: string | null;
  email: string | null;
  session_id: string | null;
  source: AuditSourceDto;
  ip: string | null;
  user_agent: string | null;
  metadata: Record<string, unknown> | null;
};

/**
 * Account context: the caller's own events, every kind. House context: LOGIN,
 * LOGOUT and LOGIN_FAILED of the house's current members only. Events with no
 * user (unknown emails) never appear here.
 */
export const listAuditSessions = async (
  scope: AuditScope,
  callerUserId: number,
  q: Partial<AuditSessionsQuery> & { limit: number },
): Promise<AuditPage<AuthEventDto>> => {
  let userIds: number[];
  let kinds: readonly string[] | null = null;
  if (scope.ownerType === 'USER') {
    userIds = [callerUserId];
  } else {
    const members = await prisma.houseMember.findMany({
      where: { house_id: scope.ownerId },
      select: { user_id: true },
    });
    userIds = members.map((m) => m.user_id);
    kinds = HOUSE_SESSION_KINDS;
  }
  if (q.userId) userIds = userIds.filter((id) => id === q.userId);
  if (q.kind) {
    if (kinds && !kinds.includes(q.kind)) return { items: [], nextCursor: null };
    kinds = [q.kind];
  }
  if (userIds.length === 0) return { items: [], nextCursor: null };

  const parts: Prisma.Sql[] = [Prisma.sql`e.user_id IN (${Prisma.join(userIds)})`];
  if (kinds) parts.push(Prisma.sql`e.kind::text IN (${Prisma.join([...kinds])})`);
  return querySessions(parts, scope, q);
};

/**
 * /admin/audit → Sesiones: every event, including failed logins on unknown
 * emails (no user), filterable by user, kind, IP and date.
 */
export const listAdminSessions = async (
  q: Partial<AuditSessionsQuery> & { limit: number; ip?: string; unknownOnly?: boolean },
): Promise<AuditPage<AuthEventDto>> => {
  const parts: Prisma.Sql[] = [Prisma.sql`TRUE`];
  if (q.userId) parts.push(Prisma.sql`e.user_id = ${q.userId}`);
  if (q.unknownOnly) parts.push(Prisma.sql`e.user_id IS NULL`);
  if (q.kind) parts.push(Prisma.sql`e.kind::text = ${q.kind}`);
  if (q.ip) parts.push(Prisma.sql`e.ip = ${q.ip}`);
  return querySessions(parts, null, q);
};

/** Shared tail: date / cursor filters, the page, and each login's change count. */
const querySessions = async (
  parts: Prisma.Sql[],
  countScope: AuditScope | null,
  q: Partial<AuditSessionsQuery> & { limit: number },
): Promise<AuditPage<AuthEventDto>> => {
  if (q.from) parts.push(Prisma.sql`e.occurred_at >= ${dayStart(q.from)}::timestamp`);
  if (q.to) parts.push(Prisma.sql`e.occurred_at < ${nextDayStart(q.to)}::timestamp`);
  const cursor = decodeCursor(q.cursor);
  if (cursor) parts.push(Prisma.sql`(e.occurred_at, e.id) < (${cursor.at}::timestamp, ${BigInt(cursor.id)})`);

  const rows = await prisma.$queryRaw<AuthEventRow[]>`
    SELECT e.id, e.occurred_at, e.kind::text AS kind, e.user_id, u.name AS user_name, e.email,
           e.session_id, e.source::text AS source, e.ip, e.user_agent, e.metadata
      FROM "AuthEvent" e
      LEFT JOIN "User" u ON u.id = e.user_id
     WHERE ${Prisma.join(parts, ' AND ')}
     ORDER BY e.occurred_at DESC, e.id DESC
     LIMIT ${q.limit + 1}`;
  const page = rows.slice(0, q.limit);

  // Changes made with each login's session (in this context, or anywhere for admins).
  const sessionIds = [...new Set(page.filter((r) => r.kind === 'LOGIN' && r.session_id).map((r) => r.session_id!))];
  const activity = new Map<string, { count: number; last: Date }>();
  if (sessionIds.length) {
    const ownerSql = countScope
      ? Prisma.sql`AND a.owner_type = ${countScope.ownerType}::"AuditOwnerType" AND a.owner_id = ${countScope.ownerId}`
      : Prisma.empty;
    const counts = await prisma.$queryRaw<{ session_id: string; count: number; last: Date }[]>`
      SELECT a.session_id, count(*)::int AS count, max(a.occurred_at) AS last
        FROM "AuditLog" a
       WHERE a.session_id IN (${Prisma.join(sessionIds)}) ${ownerSql}
       GROUP BY a.session_id`;
    for (const c of counts) activity.set(c.session_id, { count: c.count, last: c.last });
  }

  const last = page[page.length - 1];
  return {
    items: page.map((r) => {
      const seen = r.session_id ? activity.get(r.session_id) : undefined;
      return {
        id: r.id.toString(),
        occurredAt: fromDatabaseTimestamp(r.occurred_at).toISOString(),
        kind: r.kind,
        userId: r.user_id,
        userName: r.user_name,
        email: r.email,
        sessionId: r.session_id,
        source: r.source,
        ip: r.ip,
        device: r.user_agent,
        reason: metaString(r.metadata, 'reason'),
        metadata: r.metadata,
        changeCount: r.kind === 'LOGIN' ? (seen?.count ?? 0) : null,
        lastActivityAt: seen ? fromDatabaseTimestamp(seen.last).toISOString() : null,
      };
    }),
    nextCursor: rows.length > q.limit && last ? encodeCursor(last.occurred_at, last.id) : null,
  };
};
