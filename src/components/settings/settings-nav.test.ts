import { describe, expect, it } from 'vitest';
import { withSettingsOwnerQuery } from '@/components/settings/settings-nav';

describe('withSettingsOwnerQuery', () => {
  it('keeps the house on settings links', () => {
    expect(
      withSettingsOwnerQuery('/settings/expense-templates', {
        type: 'house',
        id: 1,
      }),
    ).toBe('/settings/expense-templates?ownerType=house&ownerId=1');
  });

  it('keeps the personal account on settings links', () => {
    expect(
      withSettingsOwnerQuery('/settings/account', {
        type: 'user',
        id: 2,
      }),
    ).toBe('/settings/account?ownerType=user&ownerId=2');
  });
});
