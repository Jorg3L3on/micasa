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

describe('Actividad in the settings nav', () => {
  it('sits under Cuenta right after Conexiones, in house and account context', async () => {
    const { SETTINGS_NAV_ITEMS, filterSettingsNavItems, isSettingsNavItemActive } = await import(
      '@/components/settings/settings-nav'
    );
    const cuenta = SETTINGS_NAV_ITEMS.filter((item) => item.section === 'cuenta').map((item) => item.label);
    expect(cuenta.indexOf('Actividad')).toBe(cuenta.indexOf('Conexiones') + 1);
    const activity = SETTINGS_NAV_ITEMS.find((item) => item.label === 'Actividad')!;
    expect(filterSettingsNavItems(SETTINGS_NAV_ITEMS, false)).toContain(activity);
    expect(isSettingsNavItemActive('/settings/activity', activity)).toBe(true);
  });
});
