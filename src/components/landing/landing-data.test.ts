import { describe, expect, it } from 'vitest';

import {
  EXPENSES,
  FREE_FIRST,
  FREE_MONTH,
  FREE_SECOND,
  MONTH_INCOME,
  MONTH_SPENT,
  PAYCHECK,
  SCENES,
  describeDay,
  expensesOfQuincena,
  formatPesos,
  halfOfDay,
  simulatePurchase,
  spentInQuincena,
} from '@/components/landing/landing-data';

/** Expected peso text from its digits. */
const pesos = (digits: string): string => `$${digits}`;

describe('landing example figures', () => {
  it('leaves 4,501 free in the first quincena and 9,810 in the second', () => {
    expect(PAYCHECK).toBe(18_000);
    expect(spentInQuincena(0)).toBe(13_499);
    expect(spentInQuincena(1)).toBe(8_190);
    expect(FREE_FIRST).toBe(4_501);
    expect(FREE_SECOND).toBe(9_810);
  });

  it('adds up to the month view', () => {
    expect(MONTH_INCOME).toBe(36_000);
    expect(MONTH_SPENT).toBe(21_689);
    expect(FREE_MONTH).toBe(14_311);
  });

  it('puts four expenses in each quincena, on days 1 to 29', () => {
    expect(EXPENSES).toHaveLength(8);
    expect(expensesOfQuincena(0).map((expense) => expense.day)).toEqual([1, 5, 10, 12]);
    expect(expensesOfQuincena(1).map((expense) => expense.day)).toEqual([18, 20, 25, 28]);
    expect(new Set(EXPENSES.map((expense) => expense.id)).size).toBe(8);
  });

  it('writes whole pesos', () => {
    expect(formatPesos(7500)).toBe(pesos('7,500'));
    expect(formatPesos(499)).toBe(pesos('499'));
    expect(formatPesos(14311)).toBe(pesos('14,311'));
  });
});

describe('simulatePurchase', () => {
  it('fits while the purchase is within the first quincena', () => {
    expect(simulatePurchase(0).verdict).toBe('fits');
    expect(simulatePurchase(4_500).verdict).toBe('fits');
    expect(simulatePurchase(4_501).verdict).toBe('fits');
    expect(simulatePurchase(4_500).text).toContain('$1 ');
  });

  it('needs the second quincena above 4,501 and up to 14,311', () => {
    expect(simulatePurchase(4_502).verdict).toBe('next-quincena');
    expect(simulatePurchase(5_000).verdict).toBe('next-quincena');
    expect(simulatePurchase(5_000).text).toContain(pesos('499'));
    expect(simulatePurchase(14_000).verdict).toBe('next-quincena');
    expect(simulatePurchase(14_311).verdict).toBe('next-quincena');
  });

  it('does not fit this month above 14,311', () => {
    expect(simulatePurchase(14_312).verdict).toBe('not-this-month');
    expect(simulatePurchase(14_500).verdict).toBe('not-this-month');
    expect(simulatePurchase(14_500).text).toContain(pesos('189'));
    expect(simulatePurchase(20_000).percent).toBe(100);
  });
});

describe('31-day grid', () => {
  it('puts days 1 to 14 in the first quincena and 15 to 30 in the second', () => {
    expect(halfOfDay(1)).toBe('first');
    expect(halfOfDay(14)).toBe('first');
    expect(halfOfDay(15)).toBe('second');
    expect(halfOfDay(30)).toBe('second');
  });

  it('gives the last day of the month to the first quincena of the next one', () => {
    expect(halfOfDay(31)).toBe('next-first');
    expect(describeDay(31).title).toBe('Primera quincena del mes que sigue');
  });

  it('says which paycheck covers a day', () => {
    expect(describeDay(10).title).toBe('Primera quincena');
    expect(describeDay(10).text).toContain('último día del mes anterior');
    expect(describeDay(20).title).toBe('Segunda quincena');
    expect(describeDay(20).text).toContain('cobro del 15');
  });
});

describe('hero scenes', () => {
  it('has six scenes with a headline and a subline each', () => {
    expect(SCENES).toHaveLength(6);
    expect(SCENES.map((scene) => scene.words.join(' '))).toEqual([
      'El dinero llega. Y se va.',
      'Un mes parece una sola cosa.',
      'El mes se parte en dos.',
      'Cada cobro llena su mitad.',
      'Cada pago cae en su día.',
      'Tu casa, en orden.',
    ]);
    for (const scene of SCENES) {
      expect(scene.subline.length).toBeGreaterThan(20);
      expect(scene.highlightFrom).toBeLessThan(scene.words.length);
    }
  });
});
