import { describe, expect, it } from 'vitest';
import {
  getMonthlyPreferenceScope,
  parseMonthlyRouteParams,
} from '@/lib/planner/monthly-page';

describe('parseMonthlyRouteParams', () => {
  it('accepts valid one- and two-digit months', () => {
    expect(parseMonthlyRouteParams('2026', '5')).toEqual({
      ok: true,
      value: { year: 2026, month: 5 },
    });
    expect(parseMonthlyRouteParams('2026', '05')).toEqual({
      ok: true,
      value: { year: 2026, month: 5 },
    });
  });

  it('rejects invalid years and months before date math runs', () => {
    expect(parseMonthlyRouteParams('abc', '05')).toEqual({
      ok: false,
      reason: 'invalid-year',
    });
    expect(parseMonthlyRouteParams('2026', '13')).toEqual({
      ok: false,
      reason: 'invalid-month',
    });
    expect(parseMonthlyRouteParams('1999', '12')).toEqual({
      ok: false,
      reason: 'invalid-year',
    });
  });
});

describe('getMonthlyPreferenceScope', () => {
  it('scopes saved preferences by owner and normalized month', () => {
    expect(getMonthlyPreferenceScope('house-3', 2026, 5)).toBe('house-3:2026-05');
    expect(getMonthlyPreferenceScope('user-4', 2026, 11)).toBe('user-4:2026-11');
  });
});
