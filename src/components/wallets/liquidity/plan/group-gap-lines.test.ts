import { describe, expect, it } from 'vitest';
import { groupGapBreakdownLines } from '@/components/wallets/liquidity/plan/group-gap-lines';
import type { GapBreakdownLine } from '@/lib/finance/cash-plan/types';

const loan = (id: string, label: string, amount: number, lender: string): GapBreakdownLine => ({
  id,
  label,
  amount,
  detail: 'Pago de préstamo',
  group: { id: lender, label: lender },
});

describe('groupGapBreakdownLines', () => {
  it('folds préstamos of the same prestamista and leaves other lines in place', () => {
    const rows = groupGapBreakdownLines([
      loan('a', 'Meses sin Tarjeta', 420.79, 'Mercado Libre'),
      loan('b', 'Préstamo ML ago', 746.82, 'Mercado Libre'),
      { id: 'spotify', label: 'Spotify', amount: 189, detail: 'Gasto sin pagar' },
      loan('c', 'FONACOT Jorge', 100, 'Fonacot'),
    ]);

    expect(rows).toEqual([
      {
        kind: 'lender',
        id: 'Mercado Libre',
        label: 'Mercado Libre',
        total: 420.79 + 746.82,
        lines: [
          loan('a', 'Meses sin Tarjeta', 420.79, 'Mercado Libre'),
          loan('b', 'Préstamo ML ago', 746.82, 'Mercado Libre'),
        ],
      },
      { kind: 'line', line: { id: 'spotify', label: 'Spotify', amount: 189, detail: 'Gasto sin pagar' } },
      {
        kind: 'lender',
        id: 'Fonacot',
        label: 'Fonacot',
        total: 100,
        lines: [loan('c', 'FONACOT Jorge', 100, 'Fonacot')],
      },
    ]);
  });
});
