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
 * `Prisma.dmmf`, so the parser below is the source of truth for tests.
 * The runtime set is a static constant: the Next server bundle does not ship
 * `prisma/schema.prisma`, and a missing file must not become an empty set
 * (that re-shifts DATE columns a day early).
 *
 * `database-timestamps.test.ts` asserts this set equals
 * `dateOnlyFieldNamesFromSchema(schema)`. Add the new column here in the same
 * change that adds `@db.Date`.
 */
export const DATE_ONLY_FIELDS = new Set([
  'valid_until',
  'anchor_statement_end',
  'due_date',
])

/**
 * `due_date` is `@db.Date` only on LoanPayment. Credit-card calendars keep a
 * timestamp with the same field name, so the shim must not treat every
 * `due_date` as a civil date.
 */
const LOAN_PAYMENT_DATE_MODEL = 'LoanPayment'

export const dateOnlyFieldNamesFromSchema = (schema: string): Set<string> => {
  const names = new Set<string>()
  for (const match of schema.matchAll(DATE_COLUMN_RE)) {
    names.add(match[1]!)
  }
  return names
}

export const dateOnlyFieldNames = (): Set<string> => DATE_ONLY_FIELDS

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

const dateOnlyFieldsForModel = (model?: string): Set<string> => {
  const fields = new Set(dateOnlyFieldNames())
  if (model !== LOAN_PAYMENT_DATE_MODEL) fields.delete('due_date')
  return fields
}

export const preservedTimestampFieldsForModel = (model?: string): Set<string> => {
  const preserved = new Set(PRESERVED_TIMESTAMP_FIELDS)
  for (const field of dateOnlyFieldsForModel(model)) preserved.add(field)
  if (!model) return preserved
  for (const field of OAUTH_TIMESTAMPTZ_UTC_FIELDS[model] ?? []) {
    preserved.add(field)
  }
  return preserved
}

const childWriteModel = (model: string | undefined, key: string): string | undefined => {
  if (model === 'Loan' && key === 'payments') return LOAN_PAYMENT_DATE_MODEL
  return undefined
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
  model?: string,
): unknown {
  if (value instanceof Date) return toDatabaseTimestamp(value)
  if (Array.isArray(value)) {
    return value.map((entry) => transformWriteDates(entry, preservedFields, model))
  }
  if (!isPlainObject(value)) return value

  return Object.fromEntries(
    Object.entries(value).map(([key, nested]) => {
      const nextModel = childWriteModel(model, key)
      const nextPreserved = nextModel
        ? preservedTimestampFieldsForModel(nextModel)
        : preservedFields
      return [
        key,
        key === 'where' || preservedFields.has(key)
          ? nested
          : transformWriteDates(nested, nextPreserved, nextModel ?? model),
      ]
    }),
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
    transformed.data = transformWriteDates(transformed.data, preservedFields, model)
  }
  if ('create' in transformed) {
    transformed.create = transformWriteDates(transformed.create, preservedFields, model)
  }
  if ('update' in transformed) {
    transformed.update = transformWriteDates(transformed.update, preservedFields, model)
  }

  return transformed
}

/**
 * Read path: DATE columns stay on the UTC civil day. Timestamp columns are
 * left untouched (the write shim is what encodes Mexico wall time).
 */
const childReadModel = (model: string | undefined, key: string): string | undefined => {
  if (model === 'Loan' && key === 'payments') return LOAN_PAYMENT_DATE_MODEL
  return undefined
}

export function transformReadDates(value: unknown, model?: string): unknown {
  const dateFields = dateOnlyFieldsForModel(model)
  if (Array.isArray(value)) {
    return value.map((entry) => transformReadDates(entry, model))
  }
  if (!isPlainObject(value)) return value

  return Object.fromEntries(
    Object.entries(value).map(([key, nested]) => {
      const nextModel = childReadModel(model, key)
      return [
        key,
        nested instanceof Date && dateFields.has(key)
          ? normalizeDateOnlyInstant(nested)
          : transformReadDates(nested, nextModel),
      ]
    }),
  )
}

export function transformPrismaReadResult(
  result: unknown,
  operation: string,
  model?: string,
): unknown {
  if (!READ_OPERATIONS.has(operation)) return result
  return transformReadDates(result, model)
}
