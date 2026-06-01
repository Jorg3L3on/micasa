import { describe, expect, it } from 'vitest';
import { FortnightPeriod } from '@/generated/prisma/client';
import { parseFortnightPeriod } from '@/lib/finance/report-helpers';

describe('parseFortnightPeriod', () => {
  it('parses FIRST and SECOND', () => {
    expect(parseFortnightPeriod('FIRST')).toBe(FortnightPeriod.FIRST);
    expect(parseFortnightPeriod('SECOND')).toBe(FortnightPeriod.SECOND);
  });

  it('returns undefined for invalid values', () => {
    expect(parseFortnightPeriod('THIRD')).toBeUndefined();
    expect(parseFortnightPeriod(null)).toBeUndefined();
  });
});
