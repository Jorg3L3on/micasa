/** @vitest-environment jsdom */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { PlanHero } from '@/components/wallets/liquidity/plan/PlanHero';
import { PlanFlowPanel } from '@/components/wallets/liquidity/plan/PlanFlowPanel';
import { buildPlanFlow } from '@/components/wallets/liquidity/plan/plan-flow';
import { planPeriodLabel, planTodayLabel } from '@/components/wallets/liquidity/plan/plan-period';
import { buildCashPlan } from '@/lib/finance/cash-plan/build-cash-plan';
import { fromCents, toCents } from '@/lib/finance/cash-plan/money';
import type { DataGap, GapBreakdownLine, PlanInput } from '@/lib/finance/cash-plan/types';
import { formatCurrency } from '@/lib/utils';

afterEach(cleanup);

beforeAll(() => {
  for (const name of ['IntersectionObserver', 'ResizeObserver'] as const) {
    if (name in window) continue;
    Object.defineProperty(window, name, {
      configurable: true,
      value: class {
        observe() {}
        unobserve() {}
        disconnect() {}
        takeRecords() {
          return [];
        }
      },
    });
  }
});

type GoldenCase = { id: string; input: PlanInput };

const goldenCases = JSON.parse(
  readFileSync(path.join(process.cwd(), 'src/lib/finance/cash-plan/golden/cases.json'), 'utf8'),
) as GoldenCase[];

/**
 * The golden fixtures carry obligations and gapAmount but no gap lines. Build
 * the lines the way `planInputFromLiquidity` does: one positive line per
 * obligation, cash as a negative line, and income as the negative rest.
 */
const withGapLines = (input: PlanInput): PlanInput => {
  const lines: GapBreakdownLine[] = input.obligations
    .filter((obligation) => obligation.dueInHorizon)
    .map((obligation) => ({
      id: obligation.kind === 'loan' ? `loan-${obligation.id}` : obligation.kind === 'bill' ? `bill-${obligation.id}` : `card-${obligation.id}`,
      label: obligation.labelSynthetic,
      amount: obligation.kind === 'card_msi' ? obligation.msiInstallment ?? 0 : obligation.statementDue ?? 0,
    }));
  const outCents = lines.reduce((sum, line) => sum + toCents(line.amount), 0);
  const cashCents = toCents(input.availableCash);
  const incomeCents = outCents - cashCents - toCents(input.gapAmount);
  lines.push({ id: 'cash', label: 'Efectivo disponible', amount: fromCents(-cashCents) });
  if (incomeCents !== 0) lines.push({ id: 'month-income', label: 'Ingreso del mes', amount: fromCents(-incomeCents) });
  return { ...input, gapLines: lines };
};

const heroProps = {
  horizon: 'quincena' as const,
  periodLabel: 'Quincena 31 oct–14 nov',
  todayLabel: 'Hoy 7 nov',
  confidence: 'high' as const,
  gapCount: 0,
};

describe('PlanHero sentence', () => {
  it('surplus reads "Te sobran $X esta quincena"', () => {
    render(<PlanHero {...heroProps} mode="surplus" gapAmount={-2602} />);
    expect(screen.getByRole('heading', { name: `Te sobran ${formatCurrency(2602)} esta quincena` })).toBeTruthy();
    expect(screen.getByText('Plan · Quincena 31 oct–14 nov · Hoy 7 nov')).toBeTruthy();
  });

  it('shortfall reads "Te faltan $X esta quincena"', () => {
    render(<PlanHero {...heroProps} mode="shortfall" gapAmount={3150} />);
    expect(screen.getByRole('heading', { name: `Te faltan ${formatCurrency(3150)} esta quincena` })).toBeTruthy();
  });

  it('balanced reads "Este periodo cuadra"', () => {
    render(<PlanHero {...heroProps} mode="balanced" gapAmount={0} />);
    expect(screen.getByRole('heading', { name: 'Este periodo cuadra' })).toBeTruthy();
  });

  it('month horizon says "este mes"', () => {
    render(<PlanHero {...heroProps} horizon="mes" mode="surplus" gapAmount={-500} />);
    expect(screen.getByRole('heading', { name: `Te sobran ${formatCurrency(500)} este mes` })).toBeTruthy();
  });

  it('keeps the simulation before → after', () => {
    render(
      <PlanHero
        {...heroProps}
        mode="shortfall"
        gapAmount={1500}
        scenario={{ kind: 'changed', previousGapAmount: 1000, previousMode: 'shortfall', deltaNote: 'El hueco crece $500.00' }}
      />,
    );
    expect(screen.getByText(formatCurrency(1000))).toBeTruthy();
    expect(screen.getByText('El hueco crece $500.00')).toBeTruthy();
  });
});

describe('confidence chip', () => {
  it.each([
    ['high', 0, 'Confianza alta · datos completos'],
    ['medium', 1, 'Confianza media · 1 dato por completar'],
    ['medium', 2, 'Confianza media · 2 datos por completar'],
    ['low', 3, 'Confianza baja · 3 datos por completar'],
  ] as const)('%s with %i gaps reads "%s"', (confidence, gapCount, text) => {
    render(<PlanHero {...heroProps} confidence={confidence} gapCount={gapCount} mode="surplus" gapAmount={-100} />);
    expect(screen.getByTestId('plan-confidence').textContent).toBe(text);
  });

  it('reads the engine result: confidence and dataGaps.length', () => {
    const golden = goldenCases.find((item) => item.id === 'SF-06-missing-apr');
    expect(golden).toBeDefined();
    const plan = buildCashPlan(golden!.input);
    render(<PlanHero {...heroProps} confidence={plan.confidence} gapCount={plan.dataGaps.length} mode={plan.mode} gapAmount={golden!.input.gapAmount} />);
    const chip = screen.getByTestId('plan-confidence');
    expect(chip.dataset.confidence).toBe(plan.confidence);
    expect(chip.textContent).toContain(`${plan.dataGaps.length} dato`);
  });
});

describe('De dónde sale', () => {
  it.each(goldenCases.map((item) => [item.id, item] as const))('%s: Entra − Sale equals Queda or Falta', (_id, golden) => {
    const input = withGapLines(golden.input);
    const flow = buildPlanFlow(input, []);
    expect(toCents(flow.inflow.total) - toCents(flow.outflow.total)).toBe(toCents(flow.net));
    expect(toCents(flow.net) + 0).toBe(-toCents(golden.input.gapAmount) + 0);

    const plan = buildCashPlan(input);
    render(<PlanFlowPanel mode={plan.mode} input={input} dataGaps={[]} />);
    const rest = flow.net < 0 ? 'falta' : 'queda';
    expect(screen.getByTestId('flow-entra').textContent).toBe(formatCurrency(flow.inflow.total));
    expect(screen.getByTestId('flow-sale').textContent).toBe(formatCurrency(flow.outflow.total));
    expect(screen.getByTestId(`flow-${rest}`).textContent).toBe(formatCurrency(Math.abs(golden.input.gapAmount)));
    cleanup();
  });

  const quincenaInput: PlanInput = {
    horizon: 'quincena',
    gapAmount: -2000,
    availableCash: 9000,
    gapLines: [
      { id: 'bill-1', label: 'Renta', amount: 4000 },
      { id: 'card-12', label: 'Tarjeta A', amount: 2000, detail: 'Corte pendiente' },
      { id: 'loan-3', label: 'Préstamo A', amount: 500, group: { id: 'Prestamista A', label: 'Prestamista A' } },
      { id: 'loan-4', label: 'Préstamo B', amount: 500, group: { id: 'Prestamista A', label: 'Prestamista A' } },
      { id: 'cash', label: 'Efectivo disponible', amount: -9000 },
    ],
    obligations: [
      { id: 'bill-1', kind: 'bill', labelSynthetic: 'Renta', statementDue: 4000, dueInHorizon: true, consequenceTier: 1 },
    ],
  };

  it('draws the four-segment bar and lists every line, lender groups open', () => {
    render(<PlanFlowPanel mode="surplus" input={quincenaInput} dataGaps={[]} />);
    const sale = screen.getByRole('region', { name: 'Sale' });
    expect(within(sale).getByText('Fijos')).toBeTruthy();
    expect(within(sale).getByText('Tarjetas')).toBeTruthy();
    expect(within(sale).getByText('Préstamos')).toBeTruthy();
    expect(within(sale).getByText('Préstamo A')).toBeTruthy();
    expect(within(sale).getByText('Préstamo B')).toBeTruthy();
    expect(screen.getByTestId('flow-queda').textContent).toBe(formatCurrency(2000));
  });

  it('a missing_statement gap renders the amber row on its line with a link to /credit-cards/[id]', () => {
    const gaps: DataGap[] = [
      { code: 'missing_statement', obligationId: 'card-12', message: 'Falta el pago del corte de Tarjeta A.' },
      { code: 'missing_statement', obligationId: 'card-77', message: 'Falta el pago del corte de Tarjeta B.' },
      { code: 'income_monthly_only', message: 'El ingreso está por mes.' },
    ];
    const { container } = render(<PlanFlowPanel mode="surplus" input={quincenaInput} dataGaps={gaps} />);
    const sale = screen.getByRole('region', { name: 'Sale' });
    const rows = within(sale).getAllByText(/Falta el pago del corte/).map((node) => node.closest('li')!);
    expect(rows).toHaveLength(2);
    // On its own line: the row carries the card's label and amount.
    expect(within(rows[0]!).getByText('Tarjeta A')).toBeTruthy();
    expect(within(rows[0]!).getByText(formatCurrency(2000))).toBeTruthy();
    expect(rows[0]!.dataset.gapCode).toBe('missing_statement');
    expect(within(rows[0]!).getByRole('link', { name: 'Agregar' }).getAttribute('href')).toBe('/credit-cards/12');
    // A card left out of the sum still gets its row and link.
    expect(within(rows[1]!).getByRole('link', { name: 'Agregar' }).getAttribute('href')).toBe('/credit-cards/77');
    // Gaps without a line stay listed under the panel.
    expect(screen.getByText('El ingreso está por mes.')).toBeTruthy();
    // Always open: no disclosure anywhere in the flow block.
    expect(container.querySelector('[aria-expanded]')).toBeNull();
  });

  it('shortfall shows Falta in the third inset', () => {
    render(<PlanFlowPanel mode="shortfall" input={{ ...quincenaInput, gapLines: quincenaInput.gapLines.map((line) => (line.id === 'cash' ? { ...line, amount: -6000 } : line)) }} dataGaps={[]} />);
    expect(screen.getByTestId('flow-falta').textContent).toBe(formatCurrency(1000));
  });
});

describe('plan period labels', () => {
  it('quincena of today in the current month, first of another month', () => {
    expect(planPeriodLabel('quincena', '2026-11', '2026-11-07')).toBe('Quincena 31 oct–14 nov');
    expect(planPeriodLabel('quincena', '2026-12', '2026-11-07')).toMatch(/^Quincena 30 nov/);
    expect(planPeriodLabel('mes', '2026-11', '2026-11-07')).toBe('Mes · Noviembre 2026');
    expect(planTodayLabel('2026-11-07')).toBe('Hoy 7 nov');
  });
});

describe('copy policy', () => {
  it('Plan copy, hero and flow carry no advice words', () => {
    const dir = path.join(process.cwd(), 'src/components/wallets/liquidity/plan');
    for (const file of ['copy.ts', 'PlanHero.tsx', 'PlanFlowPanel.tsx']) {
      const text = readFileSync(path.join(dir, file), 'utf8').toLowerCase();
      for (const word of ['recomendamos', 'te conviene', 'deberías', 'prioriza']) {
        expect(text, `${file} contains "${word}"`).not.toContain(word);
      }
    }
  });
});
