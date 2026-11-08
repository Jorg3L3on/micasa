/** @vitest-environment jsdom */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { useState } from 'react';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { PlanRoutesSection } from '@/components/wallets/liquidity/plan/PlanRoutesSection';
import {
  pickTiePlan,
  rankedRoutes,
  resolveFeaturedPlan,
  type TiePreference,
} from '@/components/wallets/liquidity/plan/route-selection';
import { buildCashPlan } from '@/lib/finance/cash-plan/build-cash-plan';
import type { PlanInput, PlanResult } from '@/lib/finance/cash-plan/types';

afterEach(cleanup);

type GoldenCase = { id: string; input: PlanInput };

const goldenCases = JSON.parse(
  readFileSync(path.join(process.cwd(), 'src/lib/finance/cash-plan/golden/cases.json'), 'utf8'),
) as GoldenCase[];

const goldenInput = (id: string): PlanInput => {
  const found = goldenCases.find((item) => item.id === id);
  if (!found) throw new Error(`missing golden case ${id}`);
  return found.input;
};

/** Holds the route choice the way CashPlanTab does, and shows which route is featured. */
const Harness = ({ plan }: { plan: PlanResult }) => {
  const [selected, setSelected] = useState<string | null>(null);
  const [tie, setTie] = useState<TiePreference | null>(null);
  const featured = resolveFeaturedPlan(plan, selected, tie);
  return (
    <>
      <output data-testid="featured">{featured.id}</output>
      <PlanRoutesSection
        plan={plan}
        selectedPlanId={selected}
        tiePreference={tie}
        onChoose={setSelected}
        onPreferTie={(preference) => {
          setTie(preference);
          setSelected(null);
        }}
      />
    </>
  );
};

const cards = () => screen.getAllByRole('article');
const routeIds = () => cards().map((card) => card.dataset.routeId);
const row = (id: string) => document.querySelector(`tr[data-route-id="${id}"]`) as HTMLElement;

describe('route cards', () => {
  it('surplus renders three cards in rank order; choosing one presses it, tints its row and features it', async () => {
    const plan = buildCashPlan(goldenInput('SF-12-surplus-buffer'));
    expect(plan.mode).toBe('surplus');
    expect(plan.tie).toBe(false);
    const { container } = render(<Harness plan={plan} />);

    expect(routeIds()).toEqual(rankedRoutes(plan).map((route) => route.id));
    expect(cards()).toHaveLength(3);
    expect(within(cards()[0]!).getByTestId('route-badge').textContent).toBe('Menor costo y riesgo');
    expect(within(cards()[1]!).getByTestId('route-badge').textContent).toBe('Alternativa');
    expect(within(cards()[0]!).getByRole('button', { name: /Elegida/ }).getAttribute('aria-pressed')).toBe('true');
    expect(row(plan.primary.id).dataset.chosen).toBe('true');

    const second = plan.alternatives[0]!;
    await userEvent.click(within(cards()[1]!).getByRole('button', { name: 'Elegir esta ruta' }));

    expect(screen.getByTestId('featured').textContent).toBe(second.id);
    expect(within(cards()[1]!).getByRole('button', { name: /Elegida/ }).getAttribute('aria-pressed')).toBe('true');
    expect(within(cards()[0]!).getByRole('button', { name: 'Elegir esta ruta' }).getAttribute('aria-pressed')).toBe('false');
    expect(row(second.id).dataset.chosen).toBe('true');
    expect(row(plan.primary.id).dataset.chosen).toBe('false');

    // The reasons are open: visible text, no disclosure control.
    expect(screen.getByTestId('why-panel').textContent).toContain(plan.explainability.scoreSummary);
    expect(container.querySelector('[aria-expanded]')).toBeNull();
  });

  it('shortfall shows the bridge card only when bridgeSim is set', () => {
    const withBridge = buildCashPlan(goldenInput('SF-02-large-gap-bridge'));
    render(<Harness plan={withBridge} />);
    const bridgeCard = cards().find((card) => card.dataset.routeId === 'bridge');
    expect(bridgeCard).toBeDefined();
    expect(within(bridgeCard!).getByText('Préstamo')).toBeTruthy();
    cleanup();

    const withoutBridge = buildCashPlan({ ...goldenInput('SF-02-large-gap-bridge'), bridgeSim: null });
    render(<Harness plan={withoutBridge} />);
    expect(routeIds()).not.toContain('bridge');
  });

  it('a simulated route that is not primary is badged "Simulación"', () => {
    const plan = buildCashPlan(goldenInput('SF-13-consolidate-worse-rate'));
    render(<Harness plan={plan} />);
    const card = cards().find((item) => item.dataset.routeId === 'consolidate');
    expect(within(card!).getByTestId('route-badge').textContent).toBe('Simulación');
  });
});

describe('tie', () => {
  it.each([['SF-09-tie'], ['SF-04-surplus-avalanche']])(
    '%s: chip pair instead of the badge; each chip re-ranks as pickTiePlan',
    async (id) => {
      const plan = buildCashPlan(goldenInput(id));
      expect(plan.tie).toBe(true);
      render(<Harness plan={plan} />);

      const primaryCard = cards()[0]!;
      expect(within(primaryCard).queryByTestId('route-badge')).toBeNull();
      expect(screen.queryByText('Menor costo y riesgo')).toBeNull();
      const pair = within(primaryCard).getByRole('group');
      const tieOther = rankedRoutes(plan).find((route) => route.id === plan.tiePlanId);

      for (const [label, preference] of [['Menor costo', 'cost'], ['Menor riesgo', 'risk']] as const) {
        await userEvent.click(within(pair).getByRole('button', { name: label }));
        expect(within(pair).getByRole('button', { name: label }).getAttribute('aria-pressed')).toBe('true');
        const expected = pickTiePlan(plan.primary, tieOther, preference);
        expect(screen.getByTestId('featured').textContent).toBe(expected.id);
        expect(row(expected.id).dataset.chosen).toBe('true');
      }
    },
  );
});

describe('copy policy', () => {
  it('copy.ts and the route card carry no advice words', () => {
    const dir = path.join(process.cwd(), 'src/components/wallets/liquidity/plan');
    for (const file of ['copy.ts', 'PlanRouteCard.tsx', 'PlanCompareTable.tsx', 'WhyPanel.tsx', 'PlanRoutesSection.tsx']) {
      const text = readFileSync(path.join(dir, file), 'utf8').toLowerCase();
      for (const word of ['recomendamos', 'te conviene', 'deberías', 'prioriza']) {
        expect(text, `${file} contains "${word}"`).not.toContain(word);
      }
    }
  });
});
