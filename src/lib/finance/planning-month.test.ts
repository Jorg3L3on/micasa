import { describe, expect, it } from 'vitest';
import { planningMonthCreateError } from '@/lib/finance/planning-month';

const september2026 = new Date('2026-09-25T18:00:00.000Z');

describe('planningMonthCreateError', () => {
  it('allows the current month and later months in later years', () => {
    expect(planningMonthCreateError(2026, 9, september2026)).toBeNull();
    expect(planningMonthCreateError(2026, 12, september2026)).toBeNull();
    expect(planningMonthCreateError(2027, 1, september2026)).toBeNull();
    expect(planningMonthCreateError(2030, 6, september2026)).toBeNull();
  });

  it('blocks past months and years past the planning bound', () => {
    expect(planningMonthCreateError(2026, 8, september2026)).toMatch(/pasados/);
    expect(planningMonthCreateError(2025, 12, september2026)).toMatch(/pasados/);
    expect(planningMonthCreateError(2031, 1, september2026)).toMatch(/2030/);
  });
});
