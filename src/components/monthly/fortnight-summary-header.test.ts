import { describe, expect, it } from 'vitest';
import {
  getDueToPayComposition,
  getFortnightRemainderCopy,
  getFortnightStatusPill,
  getFortnightSummaryHeader,
} from './fortnight-summary-header';

describe('getFortnightSummaryHeader', () => {
  it('formats first fortnight title', () => {
    expect(getFortnightSummaryHeader('FIRST')).toEqual({
      title: 'Resumen de la 1ª quincena',
    });
  });

  it('formats second fortnight title', () => {
    expect(getFortnightSummaryHeader('SECOND')).toEqual({
      title: 'Resumen de la 2ª quincena',
    });
  });
});

describe('getFortnightRemainderCopy', () => {
  it('uses Queda when income covers toca pagar', () => {
    expect(getFortnightRemainderCopy(2150)).toEqual({
      tone: 'surplus',
      rowLabel: 'Queda',
    });
  });

  it('uses Falta when toca pagar exceeds income', () => {
    expect(getFortnightRemainderCopy(-4800)).toEqual({
      tone: 'shortfall',
      rowLabel: 'Falta',
    });
  });

  it('uses Queda when remainder is zero', () => {
    expect(getFortnightRemainderCopy(0)).toEqual({
      tone: 'even',
      rowLabel: 'Queda',
    });
  });
});

describe('getFortnightStatusPill', () => {
  it('labels a shortfall as Te falta', () => {
    expect(getFortnightStatusPill(-12_708)).toEqual({
      tone: 'shortfall',
      label: 'Te falta',
    });
  });

  it('labels a surplus as Alcanza', () => {
    expect(getFortnightStatusPill(2_150)).toEqual({
      tone: 'surplus',
      label: 'Alcanza',
    });
  });

  it('labels a zero remainder as Justo', () => {
    expect(getFortnightStatusPill(0)).toEqual({
      tone: 'even',
      label: 'Justo',
    });
  });
});

describe('getDueToPayComposition', () => {
  it('omits zero rows and keeps planner order', () => {
    expect(
      getDueToPayComposition({
        pagado: 0,
        pendiente: 25_671.62,
        statementDue: 850,
        walletLoanDue: 1_800,
        payrollDeduction: 4_036.41,
        budgetRemaining: 3_500,
      }),
    ).toEqual([
      { label: 'Pendiente de gastos', amount: 25_671.62 },
      { label: 'De eso, estado de cuenta', amount: 850 },
      { label: 'De eso, cuotas de préstamo', amount: 1_800 },
      { label: 'Deducciones de nómina', amount: 4_036.41 },
      { label: 'Presupuesto restante', amount: 3_500 },
    ]);
  });

  it('includes Ya pagado when there are paid expenses', () => {
    expect(
      getDueToPayComposition({
        pagado: 1_200,
        pendiente: 800,
      }),
    ).toEqual([
      { label: 'Ya pagado', amount: 1_200 },
      { label: 'Pendiente de gastos', amount: 800 },
    ]);
  });

  it('returns an empty list when nothing is committed', () => {
    expect(
      getDueToPayComposition({
        pagado: 0,
        pendiente: 0,
      }),
    ).toEqual([]);
  });
});
