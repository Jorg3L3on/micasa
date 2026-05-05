import { describe, expect, it } from 'vitest';
import { buildCategoryReportApiPath } from './build-category-report-query';

describe('buildCategoryReportApiPath', () => {
  it('omits period for month view (both quincenas)', () => {
    const path = buildCategoryReportApiPath({
      view: 'month',
      year: 2026,
      month: 5,
      period: 'FIRST',
    });
    expect(path).toContain('month=5');
    expect(path).toContain('year=2026');
    expect(path).toContain('planningCashFlow=true');
    expect(path).not.toContain('period=');
  });

  it('includes period for biweekly view', () => {
    const path = buildCategoryReportApiPath({
      view: 'biweekly',
      year: 2026,
      month: 5,
      period: 'SECOND',
    });
    expect(path).toContain('period=SECOND');
  });
});
