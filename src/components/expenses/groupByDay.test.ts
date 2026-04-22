import { describe, it, expect } from 'vitest';
import { groupByDay, formatDayLabel } from './groupByDay';
import type { ExpenseFeedItem } from '@/types/expenses-feed';

function mk(id: number, date: string, description = `e${id}`): ExpenseFeedItem {
  return {
    id,
    description,
    amount: 10,
    date,
    category: null,
    paymentMethod: null,
    walletType: null,
    isRecurring: false,
    creditInstallmentCurrent: null,
    creditInstallmentTotal: null,
  };
}

describe('groupByDay', () => {
  it('returns an empty array for no items', () => {
    expect(groupByDay([])).toEqual([]);
  });

  it('groups items by date descending', () => {
    const now = new Date(2026, 3, 22); // Apr 22 2026
    const items = [
      mk(1, '2026-04-22'),
      mk(2, '2026-04-21'),
      mk(3, '2026-04-22'),
      mk(4, '2026-04-20'),
    ];
    const groups = groupByDay(items, now);
    expect(groups.map((g) => g.key)).toEqual([
      '2026-04-22',
      '2026-04-21',
      '2026-04-20',
    ]);
    expect(groups[0].items.map((i) => i.id)).toEqual([1, 3]);
    expect(groups[0].label).toBe('Hoy');
    expect(groups[1].label).toBe('Ayer');
  });

  it('falls back to weekday + day + month label for older dates', () => {
    const now = new Date(2026, 3, 22);
    expect(formatDayLabel('2026-04-20', now)).toBe('Lunes 20 de abril');
  });

  it('includes the year when it differs from the reference year', () => {
    const now = new Date(2026, 3, 22);
    expect(formatDayLabel('2025-12-31', now)).toBe(
      'Miércoles 31 de diciembre de 2025',
    );
  });
});
