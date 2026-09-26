import { describe, expect, it } from 'vitest';

import {
  NAV_DESTINATIONS,
  getDockDestinations,
  getNavDestination,
} from '@/components/nav-destinations';

describe('NAV_DESTINATIONS', () => {
  it('lists the eight sidebar destinations in canonical order', () => {
    expect(NAV_DESTINATIONS.map((item) => item.title)).toEqual([
      'Panel financiero',
      'Billeteras',
      'Liquidez y análisis',
      'Metas',
      'Préstamos',
      'Operaciones',
      'Presupuestos',
      'Configuración',
    ]);
  });

  it('never links to the quincena view', () => {
    for (const item of NAV_DESTINATIONS) {
      expect(item.getHref().startsWith('/fortnight')).toBe(false);
    }
  });

  it('marks Liquidez active on /wallets/liquidity but not Billeteras', () => {
    const pathname = '/wallets/liquidity';
    expect(getNavDestination('liquidity').isActive(pathname)).toBe(true);
    expect(getNavDestination('wallets').isActive(pathname)).toBe(false);
  });

  it('keeps Billeteras active for wallet detail and credit cards', () => {
    const wallets = getNavDestination('wallets');
    expect(wallets.isActive('/wallets')).toBe(true);
    expect(wallets.isActive('/wallets/12')).toBe(true);
    expect(wallets.isActive('/credit-cards/3')).toBe(true);
  });

  it('marks Configuración active on settings sub-pages', () => {
    const settings = getNavDestination('settings');
    expect(settings.getHref()).toBe('/settings');
    expect(settings.isActive('/settings/account')).toBe(true);
    expect(settings.isActive('/settingsx')).toBe(false);
  });
});

describe('getDockDestinations', () => {
  it('uses Panel, Billeteras and Liquidez as the dock link tabs', () => {
    const tabs = getDockDestinations();
    expect(tabs.map((item) => item.dockTitle ?? item.title)).toEqual([
      'Panel',
      'Billeteras',
      'Liquidez',
    ]);
    expect(tabs[2].getHref()).toBe(getNavDestination('liquidity').getHref());
  });
});
