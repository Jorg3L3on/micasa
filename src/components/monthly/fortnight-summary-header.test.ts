import { describe, expect, it } from 'vitest';
import { getFortnightSummaryHeader } from './fortnight-summary-header';

describe('getFortnightSummaryHeader', () => {
  it('formats first fortnight title and range', () => {
    expect(getFortnightSummaryHeader(2026, 6, 'FIRST')).toEqual({
      title: 'Resumen de la 1ª quincena',
      dateRange: '1 al 15 de junio',
    });
  });

  it('formats second fortnight with month end day', () => {
    expect(getFortnightSummaryHeader(2026, 6, 'SECOND')).toEqual({
      title: 'Resumen de la 2ª quincena',
      dateRange: '16 al 30 de junio',
    });
  });
});
