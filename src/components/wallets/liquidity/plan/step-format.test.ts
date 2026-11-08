import { describe, expect, it } from 'vitest';
import { stepDateLabel } from '@/components/wallets/liquidity/plan/step-format';
import { planPeriodBounds } from '@/components/wallets/liquidity/plan/plan-period';

const incomes = [
  { date: '2026-11-14', title: 'Nómina quincenal' },
  { date: '2026-11-30', title: 'Honorarios' },
];

describe('stepDateLabel', () => {
  it('names the payday when an income lands on the step date', () => {
    expect(stepDateLabel('2026-11-14', '2026-11-07', incomes)).toBe('14 nov · al caer la nómina');
    expect(stepDateLabel('2026-11-30', '2026-11-07', incomes)).toBe('30 nov · al caer tu ingreso');
  });

  it('a step without a bill date waits for the next payday', () => {
    expect(stepDateLabel(undefined, '2026-11-07', incomes, 'buffer_reserve')).toBe('14 nov · al caer la nómina');
    expect(stepDateLabel(undefined, '2026-11-20', incomes, 'extra_to_debt_avalanche')).toBe('30 nov · al caer tu ingreso');
    // A deferral has nothing to wait for.
    expect(stepDateLabel(undefined, '2026-11-07', incomes, 'defer_nonessential')).toBeNull();
    expect(stepDateLabel(undefined, '2026-11-07', [], 'buffer_reserve')).toBeNull();
  });

  it('otherwise "Hoy" or "Antes del N"', () => {
    expect(stepDateLabel('2026-11-07', '2026-11-07', incomes)).toBe('Hoy');
    expect(stepDateLabel('2026-11-09', '2026-11-07', incomes)).toBe('Antes del 9 nov');
  });
});

describe('planPeriodBounds', () => {
  it('matches the quincena or the month the plan covers', () => {
    expect(planPeriodBounds('quincena', '2026-11', '2026-11-07')).toEqual({ startYmd: '2026-10-31', endYmd: '2026-11-14' });
    expect(planPeriodBounds('quincena', '2026-11', '2026-11-20')).toEqual({ startYmd: '2026-11-15', endYmd: '2026-11-29' });
    expect(planPeriodBounds('mes', '2026-11', '2026-11-07')).toEqual({ startYmd: '2026-11-01', endYmd: '2026-11-30' });
  });
});

describe('activation preview', () => {
  it('lists a loan abono as a planned expense and keeps installments as they are', async () => {
    const { planWritePreview } = await import('@/components/wallets/liquidity/plan/ActivatePlanSheet');
    const base = { riskTags: [], warnings: [] };
    const preview = planWritePreview(
      [
        { ...base, type: 'extra_to_debt_avalanche', label: 'Extra', obligationId: 'loan-4', amount: 1500, dueDate: '2026-11-14' },
        { ...base, type: 'pay_minimum', label: 'Cuota', obligationId: 'loan-4', amount: 1000 },
        { ...base, type: 'buffer_reserve', label: 'Colchón', amount: 300 },
      ],
      [{ id: 'loan-4', kind: 'loan', labelSynthetic: 'Préstamo A', dueInHorizon: true, consequenceTier: 3 }],
      '2026-11-07',
      incomes,
    );
    expect(preview.writes).toEqual([
      expect.objectContaining({ title: 'Agendar abono de $1,500.00 a Préstamo A', subtitle: '14 nov · al caer la nómina · gasto planeado sin pagar' }),
    ]);
    expect(preview.unchanged.map((item) => item.title)).toEqual(['Cuota', 'Colchón']);
  });
});
