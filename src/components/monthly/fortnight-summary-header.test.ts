import { describe, expect, it } from 'vitest';
import {
  getFortnightRemainderCopy,
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
