import { describe, expect, it } from 'vitest';
import { getFortnightSummaryHeader } from './fortnight-summary-header';

describe('getFortnightSummaryHeader', () => {
  it('formats first fortnight title and payday-aligned range', () => {
    expect(getFortnightSummaryHeader(2026, 6, 'FIRST')).toEqual({
      title: 'Resumen de la 1ª quincena',
      dateRange: '31 de mayo al 14 de junio',
    });
  });

  it('formats second fortnight through the penultimate day', () => {
    expect(getFortnightSummaryHeader(2026, 6, 'SECOND')).toEqual({
      title: 'Resumen de la 2ª quincena',
      dateRange: '15 de junio al 29 de junio',
    });
  });
});
