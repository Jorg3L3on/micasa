import { describe, expect, it } from 'vitest';

import {
  NAV_DESTINATIONS,
  getMobileDockItems,
  getNavDestination,
  getOverflowDestinations,
} from '@/components/nav-destinations';

describe('NAV_DESTINATIONS', () => {
  it('lists the six sidebar destinations in canonical order', () => {
    expect(NAV_DESTINATIONS.map((item) => item.title)).toEqual([
      'Panel financiero',
      'Billeteras',
      'Préstamos',
      'Análisis',
      'Operaciones',
    ]);
  });

  it('never links to the quincena view', () => {
    for (const item of NAV_DESTINATIONS) {
      expect(item.getHref().startsWith('/fortnight')).toBe(false);
    }
    for (const item of getMobileDockItems()) {
      expect(item.getHref().startsWith('/fortnight')).toBe(false);
    }
  });

  it('marks Análisis active on /wallets/liquidity but not Billeteras', () => {
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

  it('does not list a stale top-level Presupuestos or Liquidez y análisis item', () => {
    const titles = NAV_DESTINATIONS.map((item) => item.title);
    expect(titles).not.toContain('Presupuestos');
    expect(titles).not.toContain('Liquidez y análisis');
    expect(titles).toContain('Análisis');
  });
});

describe('mobile dock', () => {
  it('keeps the six primaries in the pill', () => {
    expect(getMobileDockItems().map((item) => item.title)).toEqual([
      'Panel financiero',
      'Billeteras',
      'Tarjetas',
      'Préstamos',
      'Presupuestos',
    ]);
  });

  it('sends Análisis and Operaciones to the overflow sheet', () => {
    expect(getOverflowDestinations().map((item) => item.title)).toEqual([
      'Análisis',
      'Operaciones',
    ]);
  });

  it('maps Tarjetas and Presupuestos onto existing pages', () => {
    const dock = Object.fromEntries(
      getMobileDockItems().map((item) => [item.id, item]),
    );
    expect(dock['credit-cards'].getHref()).toBe('/wallets');
    expect(dock.budgets.getHref()).toBe('/settings/budgets');
  });

  it('highlights Tarjetas on a card without clearing the desktop Billeteras rule', () => {
    const dock = Object.fromEntries(
      getMobileDockItems().map((item) => [item.id, item]),
    );
    expect(getNavDestination('wallets').isActive('/credit-cards/3')).toBe(true);
    expect(dock.wallets.isActive('/credit-cards/3')).toBe(false);
    expect(dock['credit-cards'].isActive('/credit-cards/3')).toBe(true);
    expect(dock.wallets.isActive('/wallets')).toBe(true);
    expect(dock['credit-cards'].isActive('/wallets')).toBe(false);
  });

  it('highlights Presupuestos without clearing the desktop Configuración rule', () => {
    const dock = Object.fromEntries(
      getMobileDockItems().map((item) => [item.id, item]),
    );
  });
});
