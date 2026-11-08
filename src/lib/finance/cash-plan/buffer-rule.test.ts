import { describe, expect, it } from 'vitest';
import { bufferAmountCents, buildCashPlan } from '@/lib/finance/cash-plan/build-cash-plan';
import type { PlanInput } from '@/lib/finance/cash-plan/types';

/** Synthetic surplus input: one card and one bill, all due this period. */
const surplus = (extra: number, cash: number): PlanInput => ({
  horizon: 'quincena',
  gapAmount: -extra,
  availableCash: cash,
  computedAt: '2026-01-01T00:00:00.000Z',
  obligations: [
    {
      id: 'card-a',
      kind: 'card_revolving',
      labelSynthetic: 'Tarjeta A',
      balanceTotal: 9000,
      statementDue: 2500,
      minimumDue: 400,
      aprAnnual: 0.6,
      dueInHorizon: true,
      consequenceTier: 3,
    },
    { id: 'rent', kind: 'bill', labelSynthetic: 'Renta', statementDue: 4000, dueInHorizon: true, consequenceTier: 1 },
  ],
});

const bufferSteps = (input: PlanInput) => {
  const result = buildCashPlan(input);
  return [result.primary, ...result.alternatives]
    .flatMap((plan) => plan.actions)
    .filter((step) => step.type === 'buffer_reserve' && step.amount != null);
};

describe('buffer rule', () => {
  it('a surplus of $2,602 with runway under one period never yields a buffer under $100', () => {
    // Need = $6,500. Every cash level below it is runway < 1.
    for (let cash = 0; cash < 6500; cash += 37) {
      for (const step of bufferSteps(surplus(2602, cash))) {
        expect(step.amount, `cash ${cash}`).toBeGreaterThanOrEqual(100);
        expect(Number.isInteger(step.amount), `cash ${cash}`).toBe(true);
      }
    }
  });

  it('keeps min(extra / 2, need − cash) rounded to pesos', () => {
    expect(bufferAmountCents(260_200, 300_000, 650_000)).toBe(130_100);
    expect(bufferAmountCents(260_200, 600_000, 650_000)).toBe(50_000);
    expect(bufferAmountCents(260_150, 640_000, 650_000)).toBe(10_000);
  });

  it('leaves the buffer route out when the rule yields under $100', () => {
    // Need − cash = $40: under $100 although the extra is well above $200.
    expect(bufferAmountCents(260_200, 646_000, 650_000)).toBe(0);
    expect(bufferSteps(surplus(2602, 6460))).toHaveLength(0);
    // Extra under $200: half of it is under $100.
    expect(bufferAmountCents(15_000, 0, 650_000)).toBe(0);
    // Nothing due: a period of payments is $0.01, never a cushion.
    expect(bufferAmountCents(50_000, 800_000, 1)).toBe(0);
  });
});
