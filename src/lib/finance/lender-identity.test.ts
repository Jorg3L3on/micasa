import { describe, expect, it } from 'vitest';
import {
  inferLenderProviderIconKey,
  isFonacotLenderName,
} from '@/lib/finance/lender-identity';

describe('lender-identity', () => {
  it('detects Fonacot without mapping it to a wallet provider', () => {
    expect(isFonacotLenderName('Fonacot')).toBe(true);
    expect(isFonacotLenderName('FONACOT Carmen')).toBe(true);
    expect(inferLenderProviderIconKey('Fonacot', null)).toBeNull();
  });

  it('prefers a stored catalog key', () => {
    expect(inferLenderProviderIconKey('Otro', 'MERCADO_LIBRE')).toBe('MERCADO_LIBRE');
    expect(inferLenderProviderIconKey('Mercado Libre', 'UNKNOWN_KEY')).toBe(
      'MERCADO_LIBRE',
    );
  });

  it('infers brand icons from the prestamista name', () => {
    expect(inferLenderProviderIconKey('Mercado Libre')).toBe('MERCADO_LIBRE');
    expect(inferLenderProviderIconKey('  mercado   pago ')).toBe('MERCADO_PAGO');
    expect(inferLenderProviderIconKey('Banco')).toBe('GENERIC_BANK');
    expect(inferLenderProviderIconKey('Santander')).toBe('SANTANDER');
  });
});
