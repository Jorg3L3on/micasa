import { describe, expect, it } from 'vitest';
import { formatCardObligationAmountSourceHint } from '@/lib/finance/card-statement-obligation';

describe('formatCardObligationAmountSourceHint', () => {
  it('hides hint for import and none', () => {
    expect(formatCardObligationAmountSourceHint('import')).toBeNull();
    expect(formatCardObligationAmountSourceHint('none')).toBeNull();
    expect(formatCardObligationAmountSourceHint(undefined)).toBeNull();
  });

  it('shows ledger and estimate fallbacks', () => {
    expect(formatCardObligationAmountSourceHint('ledger')).toBe(
      'Según movimientos del corte',
    );
    expect(formatCardObligationAmountSourceHint('wallet_debt', true)).toBe(
      'Estimado · deuda en billetera',
    );
    expect(formatCardObligationAmountSourceHint('projection', true)).toBe(
      'Estimado · compras del ciclo abierto',
    );
  });
});
