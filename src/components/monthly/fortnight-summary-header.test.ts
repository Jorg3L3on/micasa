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
  it('uses surplus copy when income covers toca pagar', () => {
    expect(getFortnightRemainderCopy(2150)).toEqual({
      tone: 'surplus',
      headline: 'Te sobran',
      rowLabel: 'Queda',
    });
  });

  it('uses shortfall copy when toca pagar exceeds income', () => {
    expect(getFortnightRemainderCopy(-4800)).toEqual({
      tone: 'shortfall',
      headline: 'Te faltan',
      rowLabel: 'Falta',
    });
  });

  it('uses even copy when remainder is zero', () => {
    expect(getFortnightRemainderCopy(0)).toEqual({
      tone: 'even',
      headline: 'Quedas a mano',
      rowLabel: 'Queda',
    });
  });
});
