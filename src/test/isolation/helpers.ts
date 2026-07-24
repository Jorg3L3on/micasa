import { expect } from 'vitest';
import type { OwnerContextSuccess, OwnerFilter } from '@/lib/server/get-owner-context';

/** User A owns resources under test; User B is the attacker session. */
export const USER_A = 1;
export const USER_B = 2;
export const HOUSE_A = 10;
export const RESOURCE_ID = 100;

export const ownerFilterA: OwnerFilter = { user_id: USER_A, house_id: null };
export const ownerFilterB: OwnerFilter = { user_id: USER_B, house_id: null };
export const houseFilterA: OwnerFilter = { user_id: null, house_id: HOUSE_A };

export const contextUserA: OwnerContextSuccess = {
  userId: USER_A,
  ownerType: 'user',
  ownerId: USER_A,
  ownerFilter: ownerFilterA,
  role: 'owner',
};

export const contextUserB: OwnerContextSuccess = {
  userId: USER_B,
  ownerType: 'user',
  ownerId: USER_B,
  ownerFilter: ownerFilterB,
  role: 'owner',
};

export const forbiddenHouseContext = {
  error: new Response(JSON.stringify({ error: 'Forbidden' }), {
    status: 403,
    headers: { 'Content-Type': 'application/json' },
  }),
};

export const ownerContextFor = (
  opts:
    | { kind: 'user'; userId: number }
    | {
        kind: 'house';
        userId: number;
        houseId: number;
        role?: OwnerContextSuccess['role'];
      },
): OwnerContextSuccess => {
  if (opts.kind === 'house') {
    return {
      userId: opts.userId,
      ownerType: 'house',
      ownerId: opts.houseId,
      ownerFilter: { user_id: null, house_id: opts.houseId },
      role: opts.role ?? 'member',
    };
  }
  return {
    userId: opts.userId,
    ownerType: 'user',
    ownerId: opts.userId,
    ownerFilter: { user_id: opts.userId, house_id: null },
    role: 'owner',
  };
};

type RequestForOptions = {
  method?: string;
  ownerType?: 'user' | 'house';
  ownerId?: number;
  body?: unknown;
  searchParams?: Record<string, string>;
};

export const requestFor = (
  path: string,
  options: RequestForOptions = {},
): Request => {
  const url = new URL(path, 'http://localhost');
  const ownerType = options.ownerType ?? 'user';
  const ownerId = options.ownerId ?? USER_B;
  url.searchParams.set('ownerType', ownerType);
  url.searchParams.set('ownerId', String(ownerId));
  if (options.searchParams) {
    for (const [key, value] of Object.entries(options.searchParams)) {
      url.searchParams.set(key, value);
    }
  }

  const init: RequestInit = {
    method: options.method ?? 'GET',
  };
  if (options.body !== undefined) {
    init.headers = { 'Content-Type': 'application/json' };
    init.body = JSON.stringify(options.body);
  }
  return new Request(url, init);
};

export const paramsOf = (id: number | string) =>
  Promise.resolve({ id: String(id) });

export const paramsOfMany = (record: Record<string, string | number>) =>
  Promise.resolve(
    Object.fromEntries(
      Object.entries(record).map(([k, v]) => [k, String(v)]),
    ),
  );

type OwnedResource = {
  id: number;
  user_id: number | null;
  house_id: number | null;
  [key: string]: unknown;
};

/**
 * Prisma findFirst mock: returns `resource` only when `where` includes matching
 * owner fields. Missing ownerFilter returns the resource so a buggy route leaks
 * data and fails isolation assertions (expect 404).
 */
export const ownerScopedFindFirst = <T extends OwnedResource>(resource: T) => {
  return async (args?: { where?: Record<string, unknown> }) => {
    const where = args?.where ?? {};
    if (where.id != null && where.id !== resource.id) {
      return null;
    }

    const hasUser = Object.prototype.hasOwnProperty.call(where, 'user_id');
    const hasHouse = Object.prototype.hasOwnProperty.call(where, 'house_id');
    if (!hasUser || !hasHouse) {
      return resource;
    }

    if (
      where.user_id !== resource.user_id ||
      where.house_id !== resource.house_id
    ) {
      return null;
    }

    return resource;
  };
};

export const assertIsolationDenied = async (
  response: Response,
  foreignMarker: string | number,
) => {
  const text = await response.text();
  expect([403, 404]).toContain(response.status);
  expect(text).not.toContain(String(foreignMarker));
};
