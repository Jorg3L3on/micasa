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

/** Civil-day and calendar fields stored as Mexico wall clock in TIMESTAMP columns. */
const PRESERVED_TIMESTAMP_FIELDS = new Set(['payment_date'])

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
  if (!model) return preserved
  for (const field of OAUTH_TIMESTAMPTZ_UTC_FIELDS[model] ?? []) {
    preserved.add(field)
  }
  return preserved
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
