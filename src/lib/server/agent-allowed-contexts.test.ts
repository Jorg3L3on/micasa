import { describe, expect, it } from 'vitest';
import {
  assertOwnerOnAllowList,
  dedupeContexts,
  filterAllowedHouses,
  isPersonalContextAllowed,
  parseContextFieldsFromForm,
} from '@/lib/server/agent-allowed-contexts';
import { AgentAuthError } from '@/lib/server/agent-auth-error';

describe('agent-allowed-contexts helpers', () => {
  it('parseContextFieldsFromForm reads repeated fields', () => {
    const parsed = parseContextFieldsFromForm({
      context_owner_type: ['user', 'house'],
      context_owner_id: ['2', '10'],
    });
    expect(parsed).toEqual([
      { ownerType: 'user', ownerId: 2 },
      { ownerType: 'house', ownerId: 10 },
    ]);
  });

  it('dedupeContexts removes duplicates', () => {
    expect(
      dedupeContexts([
        { ownerType: 'user', ownerId: 2 },
        { ownerType: 'user', ownerId: 2 },
        { ownerType: 'house', ownerId: 10 },
      ]),
    ).toHaveLength(2);
  });

  it('assertOwnerOnAllowList fail closed on empty list', () => {
    expect(() => assertOwnerOnAllowList([], 'user', 2)).toThrow(AgentAuthError);
  });

  it('filterAllowedHouses and personal flag respect allow-list', () => {
    const allowed = [
      { ownerType: 'house' as const, ownerId: 10 },
      { ownerType: 'user' as const, ownerId: 2 },
    ];
    const houses = [
      { id: 10, name: 'A' },
      { id: 20, name: 'B' },
    ];
    expect(filterAllowedHouses(houses, allowed)).toEqual([{ id: 10, name: 'A' }]);
    expect(isPersonalContextAllowed(2, allowed)).toBe(true);
    expect(isPersonalContextAllowed(3, allowed)).toBe(false);
  });
});
