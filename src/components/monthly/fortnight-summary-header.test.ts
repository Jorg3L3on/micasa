import { describe, expect, it } from 'vitest';
import { getFortnightSummaryHeader } from './fortnight-summary-header';

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
