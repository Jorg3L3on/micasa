import { describe, expect, it } from 'vitest';
import { ownerQueryFromHint, parseOwnerHint, serializeOwnerHint } from '@/lib/owner-hint';

describe('owner hint', () => {
  it('round-trips a house context for its user', () => {
    const value = serializeOwnerHint(42, { type: 'house', id: 7 });
    expect(parseOwnerHint(value, 42)).toEqual({ type: 'house', id: 7 });
  });

  it('rejects a hint from another user or a user context that is not theirs', () => {
    expect(parseOwnerHint('9:house:7', 42)).toBeNull();
    expect(parseOwnerHint('42:user:9', 42)).toBeNull();
  });

  it('rejects malformed values', () => {
    for (const value of ['', 'house:7', '42:house:0', '42:team:7', '42:house:7;x=1', undefined]) {
      expect(parseOwnerHint(value, 42)).toBeNull();
    }
  });

  it('falls back to the user context', () => {
    expect(ownerQueryFromHint(null, 42).toString()).toBe('ownerType=user&ownerId=42');
  });
});
