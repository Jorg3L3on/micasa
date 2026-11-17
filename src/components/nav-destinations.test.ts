import { describe, expect, it } from 'vitest';

import {
  NAV_DESTINATIONS,
  getDockDestinations,
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
    for (const item of getOverflowDestinations()) {
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
  it('puts Panel, Billeteras and Análisis around the + button', () => {
    expect(
      getDockDestinations().map((item) => item.dockTitle ?? item.title),
    ).toEqual(['Panel', 'Billeteras', 'Análisis']);
  });

  it('has no Tarjetas or Presupuestos dock tab', () => {
    const ids = getDockDestinations().map((item) => item.id);
    expect(ids).not.toContain('credit-cards');
    expect(ids).not.toContain('budgets');
  });

  it('keeps Billeteras highlighted on a credit card', () => {
    const wallets = getDockDestinations().find((item) => item.id === 'wallets');
    expect(wallets?.isActive('/credit-cards/3')).toBe(true);
  });

  it('sends Préstamos, Operaciones and Presupuestos to the Más sheet', () => {
    expect(getOverflowDestinations().map((item) => item.title)).toEqual([
      'Préstamos',
      'Operaciones',
      'Presupuestos',
    ]);
  });

  it('links Presupuestos to its settings page and highlights it only there', () => {
    const budgets = getOverflowDestinations().find(
      (item) => item.id === 'budgets',
    );
    expect(budgets?.getHref()).toBe('/settings/budgets');
    expect(budgets?.isActive('/settings/budgets')).toBe(true);
    expect(budgets?.isActive('/settings/categories')).toBe(false);
  });
});
