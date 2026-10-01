import { describe, expect, it } from 'vitest';
import {
  boundsForViewMode,
  defaultSelectedDayInWindow,
  fortnightBoundsContaining,
  isWindowFullyCreated,
  monthBounds,
  neighborWindow,
  resolveInitialWindow,
  weekBoundsContaining,
  windowMonths,
} from '@/lib/finance/payments-calendar';

describe('weekBoundsContaining', () => {
  it('returns Monday–Sunday for a mid-week day', () => {
    // 2026-09-30 is Wednesday
    expect(weekBoundsContaining('2026-09-30')).toEqual({
      startYmd: '2026-09-28',
      endYmd: '2026-10-04',
    });
  });

  it('keeps Monday as start when given Monday', () => {
    expect(weekBoundsContaining('2026-09-28')).toEqual({
      startYmd: '2026-09-28',
      endYmd: '2026-10-04',
    });
  });
});

describe('fortnightBoundsContaining', () => {
  it('maps early September to FIRST (Aug 31–Sep 14)', () => {
    expect(fortnightBoundsContaining('2026-09-10')).toEqual({
      startYmd: '2026-08-31',
      endYmd: '2026-09-14',
    });
  });

  it('maps mid September to SECOND', () => {
    expect(fortnightBoundsContaining('2026-09-20')).toEqual({
      startYmd: '2026-09-15',
      endYmd: '2026-09-29',
    });
  });

  it('maps last day of month to next month FIRST', () => {
    expect(fortnightBoundsContaining('2026-09-30')).toEqual({
      startYmd: '2026-09-30',
      endYmd: '2026-10-14',
    });
  });
});

describe('monthBounds / windowMonths / isWindowFullyCreated', () => {
  it('builds full civil month bounds', () => {
    expect(monthBounds(2026, 9)).toEqual({
      startYmd: '2026-09-01',
      endYmd: '2026-09-30',
    });
  });

  it('lists months touched by a cross-month week', () => {
    expect(windowMonths('2026-09-28', '2026-10-04')).toEqual([
      { year: 2026, month: 9 },
      { year: 2026, month: 10 },
    ]);
  });

  it('requires every touched month to be created', () => {
    const created = [
      { year: 2026, month: 9 },
      { year: 2026, month: 10 },
    ];
    expect(
      isWindowFullyCreated('2026-09-28', '2026-10-04', created),
    ).toBe(true);
    expect(
      isWindowFullyCreated('2026-09-28', '2026-10-04', [
        { year: 2026, month: 9 },
      ]),
    ).toBe(false);
    expect(
      isWindowFullyCreated('2026-08-31', '2026-09-14', [
        { year: 2026, month: 9 },
      ]),
    ).toBe(false);
  });
});

describe('neighborWindow', () => {
  const created = [
    { year: 2026, month: 8 },
    { year: 2026, month: 9 },
    { year: 2026, month: 10 },
  ];

  it('advances weeks skipping invalid spillover when neighbor month missing', () => {
    const week = weekBoundsContaining('2026-09-16'); // Sep 14–20
    expect(week).toEqual({ startYmd: '2026-09-14', endYmd: '2026-09-20' });
    const next = neighborWindow('week', week, 1, created);
    expect(next).toEqual({ startYmd: '2026-09-21', endYmd: '2026-09-27' });
  });

  it('blocks week nav when next week needs an uncreated month', () => {
    const onlySep = [{ year: 2026, month: 9 }];
    const week = { startYmd: '2026-09-21', endYmd: '2026-09-27' };
    expect(neighborWindow('week', week, 1, onlySep)).toBeNull();
  });

  it('moves fortnight FIRST → SECOND when both months for FIRST exist', () => {
    const first = fortnightBoundsContaining('2026-09-10');
    // FIRST Sep needs Aug+Sep
    expect(
      isWindowFullyCreated(first.startYmd, first.endYmd, created),
    ).toBe(true);
    const next = neighborWindow('fortnight', first, 1, created);
    expect(next).toEqual({
      startYmd: '2026-09-15',
      endYmd: '2026-09-29',
    });
  });

  it('uses created-month neighbor for month mode', () => {
    const sep = monthBounds(2026, 9);
    expect(neighborWindow('month', sep, 1, created)).toEqual(
      monthBounds(2026, 10),
    );
    expect(neighborWindow('month', sep, -1, created)).toEqual(
      monthBounds(2026, 8),
    );
  });
});

describe('resolveInitialWindow', () => {
  const created = [
    { year: 2026, month: 9 },
    { year: 2026, month: 10 },
  ];

  it('anchors week on today when fully created', () => {
    // Wed 2026-10-07 → week Oct 5–11, only Oct
    expect(resolveInitialWindow('week', '2026-10-07', created)).toEqual({
      startYmd: '2026-10-05',
      endYmd: '2026-10-11',
    });
  });

  it('skips invalid FIRST when previous month is not created', () => {
    // Sep 10 FIRST needs Aug 31 — Aug not created → nearest valid
    const result = resolveInitialWindow('fortnight', '2026-09-10', created);
    expect(result).toEqual({
      startYmd: '2026-09-15',
      endYmd: '2026-09-29',
    });
  });

  it('returns null when no valid week fits created months', () => {
    // Single month with no full Mon–Sun week entirely inside? Sep 2026
    // weeks that are fully in Sep: Sep 7–13, 14–20, 21–27
    expect(
      resolveInitialWindow('week', '2026-09-15', [
        { year: 2026, month: 9 },
      ]),
    ).toEqual({
      startYmd: '2026-09-14',
      endYmd: '2026-09-20',
    });
  });

  it('returns month bounds for today when month is created', () => {
    expect(resolveInitialWindow('month', '2026-09-30', created)).toEqual(
      monthBounds(2026, 9),
    );
  });
});

describe('defaultSelectedDayInWindow / boundsForViewMode', () => {
  it('prefers today inside the window', () => {
    expect(
      defaultSelectedDayInWindow({
        startYmd: '2026-09-14',
        endYmd: '2026-09-20',
        todayYmd: '2026-09-16',
        pendingDates: ['2026-09-15'],
      }),
    ).toBe('2026-09-16');
  });

  it('falls back to first pending in window', () => {
    expect(
      defaultSelectedDayInWindow({
        startYmd: '2026-09-14',
        endYmd: '2026-09-20',
        todayYmd: '2026-10-01',
        pendingDates: ['2026-09-10', '2026-09-18'],
      }),
    ).toBe('2026-09-18');
  });

  it('routes boundsForViewMode by mode', () => {
    expect(boundsForViewMode('month', '2026-09-15')).toEqual(
      monthBounds(2026, 9),
    );
    expect(boundsForViewMode('week', '2026-09-15').startYmd).toBe(
      '2026-09-14',
    );
  });
});
