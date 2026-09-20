import { describe, expect, it } from 'vitest';
import { lenderNameKey, normalizeLenderName } from '@/lib/finance/lender-name';

describe('lender-name', () => {
  it('trims and collapses inner spaces', () => {
    expect(normalizeLenderName('  Mercado   Libre  ')).toBe('Mercado Libre');
  });

  it('compares names case-insensitively in es-MX', () => {
    expect(lenderNameKey('FONACOT')).toBe(lenderNameKey('fonacot'));
    expect(lenderNameKey('Mercado Libre')).toBe(lenderNameKey('mercado  libre'));
  });
});
