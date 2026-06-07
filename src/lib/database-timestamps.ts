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

const PRESERVED_TIMESTAMP_FIELDS = new Set(['payment_date'])

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (value === null || typeof value !== 'object') return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
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

export function transformWriteDates(value: unknown): unknown {
  if (value instanceof Date) return toDatabaseTimestamp(value)
  if (Array.isArray(value)) return value.map(transformWriteDates)
  if (!isPlainObject(value)) return value

  return Object.fromEntries(
    Object.entries(value).map(([key, nested]) => [
      key,
      key === 'where' || PRESERVED_TIMESTAMP_FIELDS.has(key)
        ? nested
        : transformWriteDates(nested),
    ]),
  )
}

export function transformPrismaWriteArgs(args: unknown, operation: string): unknown {
  if (!WRITE_OPERATIONS.has(operation) || !isPlainObject(args)) return args

  const transformed = { ...args }

  if ('data' in transformed) {
    transformed.data = transformWriteDates(transformed.data)
  }
  if ('create' in transformed) {
    transformed.create = transformWriteDates(transformed.create)
  }
  if ('update' in transformed) {
    transformed.update = transformWriteDates(transformed.update)
  }

  return transformed
}
