import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { formatZonedParts } from '@/lib/calendar-dates'

const WRITE_OPERATIONS = new Set([
  'create',
  'createMany',
  'createManyAndReturn',
  'update',
  'updateMany',
  'updateManyAndReturn',
  'upsert',
])

const READ_OPERATIONS = new Set([
  'findUnique',
  'findUniqueOrThrow',
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'create',
  'createManyAndReturn',
  'update',
  'updateManyAndReturn',
  'upsert',
])

/** Civil-day and calendar fields stored as Mexico wall clock in TIMESTAMP columns. */
const PRESERVED_TIMESTAMP_FIELDS = new Set(['payment_date'])

const DATE_COLUMN_RE = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s+DateTime\??\s[^\n]*@db\.Date\b/gm

/**
 * Every `@db.Date` column in `prisma/schema.prisma`. Prisma 7 does not expose
 * `Prisma.dmmf`; the schema (also inlined in the generated client) is the
 * metadata. A hand list would miss the next DATE column.
 */
export const dateOnlyFieldNamesFromSchema = (schema: string): Set<string> => {
  const names = new Set<string>()
  for (const match of schema.matchAll(DATE_COLUMN_RE)) {
    names.add(match[1]!)
  }
  return names
}

const loadDateOnlyFieldNames = (): Set<string> => {
  try {
    const schema = readFileSync(join(process.cwd(), 'prisma/schema.prisma'), 'utf8')
    return dateOnlyFieldNamesFromSchema(schema)
  } catch {
    return new Set()
  }
}

let dateOnlyFieldsCache: Set<string> | null = null

export const dateOnlyFieldNames = (): Set<string> => {
  if (!dateOnlyFieldsCache) dateOnlyFieldsCache = loadDateOnlyFieldNames()
  return dateOnlyFieldsCache
}

/**
 * TIMESTAMPTZ OAuth fields must keep real UTC instants through the Prisma
 * write shim (see toDatabaseTimestamp). ApiKey expiry stays on TIMESTAMP and
 * continues to use wall-clock encoding.
 */
const OAUTH_TIMESTAMPTZ_UTC_FIELDS: Record<string, readonly string[]> = {
  McpOAuthAuthorizationCode: ['expires_at', 'used_at'],
  McpOAuthGrant: ['expires_at', 'last_used_at', 'revoked_at'],
}

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (value === null || typeof value !== 'object') return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

export const preservedTimestampFieldsForModel = (model?: string): Set<string> => {
  const preserved = new Set(PRESERVED_TIMESTAMP_FIELDS)
  for (const field of dateOnlyFieldNames()) preserved.add(field)
  if (!model) return preserved
  for (const field of OAUTH_TIMESTAMPTZ_UTC_FIELDS[model] ?? []) {
    preserved.add(field)
  }
  return preserved
}

/**
 * `@db.Date` values are civil days, not Mexico wall-clock instants.
 * Keep the UTC calendar day. Do not run them through `toDatabaseTimestamp`.
 */
export function normalizeDateOnlyInstant(date: Date): Date {
  if (Number.isNaN(date.getTime())) return date
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

/**
 * Prisma serializes DateTime parameters as UTC instants. The schema stores
 * PostgreSQL `timestamp without time zone` values that should match Mexico City
 * wall time, so encode the zoned wall-clock parts back into a Date before write.
 */
export function toDatabaseTimestamp(date: Date): Date {
  if (Number.isNaN(date.getTime())) return date

  const zoned = formatZonedParts(date)
  return new Date(
    Date.UTC(
      zoned.year,
      zoned.month - 1,
      zoned.day,
      zoned.hour,
      zoned.minute,
      zoned.second,
      date.getUTCMilliseconds(),
    ),
  )
}

export function transformWriteDates(
  value: unknown,
  preservedFields: Set<string> = PRESERVED_TIMESTAMP_FIELDS,
): unknown {
  if (value instanceof Date) return toDatabaseTimestamp(value)
  if (Array.isArray(value)) return value.map((entry) => transformWriteDates(entry, preservedFields))
  if (!isPlainObject(value)) return value

  return Object.fromEntries(
    Object.entries(value).map(([key, nested]) => [
      key,
      key === 'where' || preservedFields.has(key)
        ? nested
        : transformWriteDates(nested, preservedFields),
    ]),
  )
}

export function transformPrismaWriteArgs(
  args: unknown,
  operation: string,
  model?: string,
): unknown {
  if (!WRITE_OPERATIONS.has(operation) || !isPlainObject(args)) return args

  const preservedFields = preservedTimestampFieldsForModel(model)
  const transformed = { ...args }

  if ('data' in transformed) {
    transformed.data = transformWriteDates(transformed.data, preservedFields)
  }
  if ('create' in transformed) {
    transformed.create = transformWriteDates(transformed.create, preservedFields)
  }
  if ('update' in transformed) {
    transformed.update = transformWriteDates(transformed.update, preservedFields)
  }

  return transformed
}

/**
 * Read path: DATE columns stay on the UTC civil day. Timestamp columns are
 * left untouched (the write shim is what encodes Mexico wall time).
 */
export function transformReadDates(
  value: unknown,
  dateFields: Set<string> = dateOnlyFieldNames(),
): unknown {
  if (Array.isArray(value)) return value.map((entry) => transformReadDates(entry, dateFields))
  if (!isPlainObject(value)) return value

  return Object.fromEntries(
    Object.entries(value).map(([key, nested]) => [
      key,
      nested instanceof Date && dateFields.has(key)
        ? normalizeDateOnlyInstant(nested)
        : transformReadDates(nested, dateFields),
    ]),
  )
}

export function transformPrismaReadResult(result: unknown, operation: string): unknown {
  if (!READ_OPERATIONS.has(operation)) return result
  return transformReadDates(result)
}
