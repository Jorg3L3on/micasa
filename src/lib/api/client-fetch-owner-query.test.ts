import { describe, expect, it } from 'vitest';
import {
  buildOwnerQuery,
  getFinanceOwnerKey,
  isOwnerContextPending,
  parseOwnerQuery,
} from './client-fetch';

describe('parseOwnerQuery', () => {
  it('parses user and house owner queries with or without ?', () => {
    expect(parseOwnerQuery('?ownerType=user&ownerId=3')).toEqual({
      type: 'user',
      id: 3,
    });
    expect(parseOwnerQuery('ownerType=house&ownerId=9')).toEqual({
      type: 'house',
      id: 9,
    });
  });

  it('returns undefined for empty or invalid input', () => {
    expect(parseOwnerQuery('')).toBeUndefined();
    expect(parseOwnerQuery(null)).toBeUndefined();
    expect(parseOwnerQuery('ownerType=user&ownerId=0')).toBeUndefined();
    expect(parseOwnerQuery('ownerType=pet&ownerId=1')).toBeUndefined();
  });

  it('round-trips with buildOwnerQuery', () => {
    const context = { type: 'house' as const, id: 3 };
    expect(parseOwnerQuery(`?${buildOwnerQuery(context).toString()}`)).toEqual(
      context,
    );
  });
});

describe('isOwnerContextPending', () => {
  it('is false before the client context has synced', () => {
    expect(isOwnerContextPending({ type: 'user', id: 0 }, 'house-5')).toBe(
      false,
    );
  });

  it('is false when the client already matches the server owner', () => {
    expect(isOwnerContextPending({ type: 'house', id: 5 }, 'house-5')).toBe(
      false,
    );
  });

  it('is true while the sidebar switched house ahead of the page', () => {
    expect(isOwnerContextPending({ type: 'house', id: 5 }, 'house-3')).toBe(
      true,
    );
    expect(getFinanceOwnerKey({ type: 'house', id: 5 })).toBe('house-5');
  });
});
