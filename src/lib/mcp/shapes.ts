import { z } from 'zod';
import { formatCalendarDate } from '@/lib/calendar-dates';

/**
 * Response shape shared by every MCP tool: snake_case keys, Prisma `Decimal`
 * as `number`, `Date` as the civil day `YYYY-MM-DD` (Mexico City). Applied to
 * every result in `jsonResult`, so services can keep their own casing.
 */

const IDENTIFIER_KEY = /^[a-z][a-zA-Z0-9]*$/;

/** camelCase identifiers only; data keys (names, enum values) stay as they are. */
const toSnakeKey = (key: string): string =>
  IDENTIFIER_KEY.test(key) ? key.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase() : key;

const isDecimalLike = (value: object): value is { toNumber: () => number } =>
  typeof (value as { toNumber?: unknown }).toNumber === 'function' &&
  typeof (value as { toFixed?: unknown }).toFixed === 'function';

export function toMcpShape(value: unknown): unknown {
  if (value == null || typeof value !== 'object') return value;
  if (value instanceof Date) return formatCalendarDate(value);
  if (isDecimalLike(value)) return value.toNumber();
  if (Array.isArray(value)) return value.map(toMcpShape);
  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [toSnakeKey(key), toMcpShape(entry)]),
  );
}

export type Page = { limit: number; offset: number };

/** `{ [key]: page of items, total_count, limit, offset }` for list tools. */
export function paginate<K extends string, T>(key: K, items: T[], page: Page) {
  return {
    [key]: items.slice(page.offset, page.offset + page.limit),
    total_count: items.length,
    limit: page.limit,
    offset: page.offset,
  } as { [P in K]: T[] } & { total_count: number; limit: number; offset: number };
}

/** Totals keyed by a display name, as an array (names are data, not keys). */
export const namedTotals = (totals: Record<string, number>) =>
  Object.entries(totals).map(([name, amount]) => ({ name, amount }));

/** Output-schema building blocks (documentation for `tools/list`). */
export const out = {
  page: {
    total_count: z.number().int(),
    limit: z.number().int(),
    offset: z.number().int(),
  },
  row: <S extends z.ZodRawShape>(shape: S) => z.looseObject(shape),
  list: <S extends z.ZodRawShape>(shape: S) => z.array(z.looseObject(shape)),
  ymd: z.string(),
  money: z.number(),
  nullableMoney: z.number().nullable(),
};
