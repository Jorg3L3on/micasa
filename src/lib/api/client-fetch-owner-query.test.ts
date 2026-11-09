import { describe, expect, it } from 'vitest';
import {
  buildOwnerQuery,
  getFinanceOwnerKey,
  isOwnerContextPending,
  isPanelOwnerPending,
  parseOwnerQuery,
} from './client-fetch';

describe('parseOwnerQuery', () => {
  it('parses user and house owner queries with or without ?', () => {
    expect(parseOwnerQuery('?ownerType=user&ownerId=42')).toEqual({
      type: 'user',
      id: 42,
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
    const context = { type: 'house' as const, id: 42 };
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

describe('isPanelOwnerPending', () => {
  it('is true when the URL named no owner, even before the client syncs', () => {
    expect(isPanelOwnerPending({ type: 'user', id: 0 }, 'user-7', false)).toBe(
      true,
    );
    expect(isPanelOwnerPending({ type: 'house', id: 5 }, 'user-7', false)).toBe(
      true,
    );
  });

  it('is false when the URL owner matches the client', () => {
    expect(isPanelOwnerPending({ type: 'house', id: 5 }, 'house-5', true)).toBe(
      false,
    );
  });

  it('trusts the URL owner before the client context has synced', () => {
    expect(isPanelOwnerPending({ type: 'user', id: 0 }, 'house-5', true)).toBe(
      false,
    );
  });

  it('is true when the client switched owner ahead of the page', () => {
    expect(isPanelOwnerPending({ type: 'house', id: 5 }, 'house-3', true)).toBe(
      true,
    );
  });
});
