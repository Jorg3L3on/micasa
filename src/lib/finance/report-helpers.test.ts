import { describe, expect, it } from 'vitest';
import { FortnightPeriod } from '@/generated/prisma/client';
import { buildFortnightWhereForReport } from '@/lib/finance/planning-credit-card-payments';
import {
  fortnightPeriodParamError,
  parseFortnightPeriod,
  strictFortnightPeriodParamError,
} from '@/lib/finance/report-helpers';

describe('parseFortnightPeriod', () => {
  it('parses FIRST and SECOND', () => {
    expect(parseFortnightPeriod('FIRST')).toBe(FortnightPeriod.FIRST);
    expect(parseFortnightPeriod('SECOND')).toBe(FortnightPeriod.SECOND);
  });

  it('returns undefined for invalid values', () => {
    expect(parseFortnightPeriod('THIRD')).toBeUndefined();
    expect(parseFortnightPeriod(null)).toBeUndefined();
    expect(parseFortnightPeriod('')).toBeUndefined();
  });

  it('maps numeric quincena query values onto the enum', () => {
    expect(parseFortnightPeriod('1')).toBe(FortnightPeriod.FIRST);
    expect(parseFortnightPeriod('2')).toBe(FortnightPeriod.SECOND);
    expect(parseFortnightPeriod(' first ')).toBe(FortnightPeriod.FIRST);
    expect(fortnightPeriodParamError(null)).toBeNull();
    expect(fortnightPeriodParamError('FIRST')).toBeNull();
    expect(fortnightPeriodParamError('1')).toBeNull();
    expect(fortnightPeriodParamError('THIRD')).toBe(
      'period must be FIRST or SECOND',
    );
    expect(fortnightPeriodParamError('')).toBeNull();
    expect(fortnightPeriodParamError('  ')).toBeNull();
    expect(strictFortnightPeriodParamError(null)).toBeNull();
    expect(strictFortnightPeriodParamError('1')).toBeNull();
    expect(strictFortnightPeriodParamError('')).toBe(
      'period must be FIRST or SECOND',
    );
    expect(strictFortnightPeriodParamError('  ')).toBe(
      'period must be FIRST or SECOND',
    );
    expect(strictFortnightPeriodParamError('abc')).toBe(
      'period must be FIRST or SECOND',
    );
  });

  it('does not pass numeric period strings through to Prisma', () => {
    const owner = { user_id: 1, house_id: null };
    expect(buildFortnightWhereForReport(owner, '6', '2026', '1')).toMatchObject({
      period: FortnightPeriod.FIRST,
      month: 6,
      year: 2026,
    });
    expect(buildFortnightWhereForReport(owner, '6', '2026', '2')).toMatchObject({
      period: FortnightPeriod.SECOND,
    });
    expect(
      buildFortnightWhereForReport(owner, '6', '2026', 'nope'),
    ).not.toHaveProperty('period');
  });
});
