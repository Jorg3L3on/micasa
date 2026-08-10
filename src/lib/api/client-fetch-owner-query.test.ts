import { describe, expect, it } from 'vitest';
import { buildOwnerQuery, parseOwnerQuery } from './client-fetch';

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
