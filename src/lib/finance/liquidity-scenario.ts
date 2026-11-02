import { formatDisplayDate, parseCalendarDate, ymdForDayInMonth } from '@/lib/calendar-dates';
import { resolveCreditCardStatementWindow } from '@/lib/finance/card-statement-obligation';
import { monthKeyFromOffset } from '@/lib/finance/liquidity-projection-events';
import { compareUtcDateOnly, toUtcDateOnlyString } from '@/lib/finance/liquidity-projection';
import type { LiquidityObligationItem } from '@/lib/finance/liquidity-projection.service';
import { isFundingWalletType } from '@/lib/finance/wallet-accounting';
import { formatMoney } from '@/lib/money';
import type { LiquidityScenarioItem } from '@/schemas/liquidity-scenario.schema';
import type { PaymentMethodType } from '@/generated/prisma/client';

export type LiquidityScenarioWallet = {
  id: number;
  name: string;
  type: PaymentMethodType;
  cutoff_day: number | null;
  due_day: number | null;
};

/** One side of the baseline-vs-scenario comparison. */
export type LiquidityScenarioOutcome = {
  first_projected_shortfall_date: string | null;
  /** Lowest funding + income − cumulative obligations across milestones; null with no milestones. */
  min_projected_headroom: number | null;
  /** Funding + expected income − obligations through `until`. */
  end_liquidity: number;
};

export type LiquidityScenarioDelta = {
  baseline: LiquidityScenarioOutcome;
  scenario: LiquidityScenarioOutcome;
  first_projected_shortfall_changed: boolean;
  min_projected_headroom_change: number | null;
  end_liquidity_change: number;
};

export type LiquidityScenarioObligations = {
  byDueDate: Map<string, LiquidityObligationItem[]>;
  /** Card wallet id → amount the scenario adds to its used balance. */
  cardUsedIncrease: Map<number, number>;
  assumptions: string[];
};

const roundCents = (n: number) => Math.round(n * 100) / 100;

/** Same day of month `offset` months later, clamped to the month's last day. */
const addMonthsToYmd = (ymd: string, offset: number): string =>
  ymdForDayInMonth(monthKeyFromOffset(ymd.slice(0, 7), offset), Number(ymd.slice(8, 10)))!;

/**
 * Statement a charge on `chargeYmd` is billed on: a charge on the cutoff day
 * closes with that statement, a later one waits for the next cutoff.
 */
const cardStatementForCharge = (chargeYmd: string, cutoffDay: number, dueDay: number) => {
  const window = resolveCreditCardStatementWindow(
    parseCalendarDate(chargeYmd),
    cutoffDay,
    dueDay,
  );
  const billed =
    toUtcDateOnlyString(window.statementEnd) === chargeYmd
      ? window
      : resolveCreditCardStatementWindow(window.currentCycleEnd, cutoffDay, dueDay);
  return {
    statementStart: toUtcDateOnlyString(billed.statementStart),
    statementEnd: toUtcDateOnlyString(billed.statementEnd),
    dueDate: toUtcDateOnlyString(billed.statementDueDate),
  };
};

const pushByDate = (
  target: Map<string, LiquidityObligationItem[]>,
  dueDate: string,
  item: LiquidityObligationItem,
) => {
  const list = target.get(dueDate);
  if (list) list.push(item);
  else target.set(dueDate, [item]);
};

const describeScenario = (item: LiquidityScenarioItem, wallet: LiquidityScenarioWallet) =>
  item.kind === 'purchase'
    ? `Compra hipotética de ${formatMoney(item.amount)} el día ${formatDisplayDate(item.date)} con ${wallet.name}; no se guardó.`
    : `Pago mensual hipotético de ${formatMoney(item.amount)} durante ${item.months} ${item.months === 1 ? 'mes' : 'meses'} desde el día ${formatDisplayDate(item.firstDate)} con ${wallet.name}${isFundingWalletType(wallet.type) ? '' : ' (mensualidad en la tarjeta)'}; no se guardó.`;

/**
 * Synthetic obligations for the hypothetical items, never persisted.
 * Funding wallet: cash leaves that wallet on the date (one line per month for
 * an instalment). Card wallet: the charge raises the card's used balance and
 * reaches cash on the due date of the statement that bills it; an instalment
 * on a card is a cuota (one charge per month, flagged like a real cuota).
 * The card's own statement obligation comes from the ledger, which never sees
 * these charges, so each peso is counted once.
 */
export const buildScenarioObligations = (
  items: LiquidityScenarioItem[],
  walletsById: Map<number, LiquidityScenarioWallet>,
  untilStr: string,
): LiquidityScenarioObligations => {
  const byDueDate = new Map<string, LiquidityObligationItem[]>();
  const cardUsedIncrease = new Map<number, number>();
  const assumptions: string[] = [];

  for (const [index, item] of items.entries()) {
    const wallet = walletsById.get(item.wallet_id);
    if (!wallet) continue;
    assumptions.push(describeScenario(item, wallet));

    const charges =
      item.kind === 'purchase'
        ? [{ date: item.date, amount: item.amount }]
        : Array.from({ length: item.months }, (_, month) => ({
            date: addMonthsToYmd(item.firstDate, month),
            amount: item.amount,
          }));
    const funding = isFundingWalletType(wallet.type);
    const label = item.kind === 'purchase' ? 'Compra simulada' : 'Pago mensual simulado';

    for (const [month, charge] of charges.entries()) {
      const base = {
        source: 'scenario' as const,
        wallet_id: wallet.id,
        wallet_name: wallet.name,
        wallet_type: wallet.type,
        last_statement_balance: 0,
        payments_applied_to_statement: 0,
        next_due_payment: roundCents(charge.amount),
        expense_description: label,
        scenario_index: index,
        scenario_kind: item.kind,
        scenario_charge_date: charge.date,
        ...(item.kind === 'instalment'
          ? { scenario_instalment_number: month + 1, scenario_instalment_total: item.months }
          : {}),
      };

      if (funding) {
        if (compareUtcDateOnly(charge.date, untilStr) > 0) continue;
        pushByDate(byDueDate, charge.date, {
          ...base,
          statement_start: '',
          statement_end: '',
          statement_due_date: charge.date,
        });
        continue;
      }

      if (wallet.cutoff_day == null || wallet.due_day == null) continue;
      if (compareUtcDateOnly(charge.date, untilStr) > 0) continue;
      cardUsedIncrease.set(
        wallet.id,
        roundCents((cardUsedIncrease.get(wallet.id) ?? 0) + charge.amount),
      );
      const statement = cardStatementForCharge(charge.date, wallet.cutoff_day, wallet.due_day);
      if (compareUtcDateOnly(statement.dueDate, untilStr) > 0) continue;
      pushByDate(byDueDate, statement.dueDate, {
        ...base,
        statement_start: statement.statementStart,
        statement_end: statement.statementEnd,
        statement_due_date: statement.dueDate,
        ...(item.kind === 'instalment'
          ? {
              credit_installment_current: month + 1,
              credit_installment_total: item.months,
            }
          : {}),
      });
    }
  }

  return { byDueDate, cardUsedIncrease, assumptions };
};

export const compareScenarioOutcomes = (
  baseline: LiquidityScenarioOutcome,
  scenario: LiquidityScenarioOutcome,
): LiquidityScenarioDelta => ({
  baseline,
  scenario,
  first_projected_shortfall_changed:
    baseline.first_projected_shortfall_date !== scenario.first_projected_shortfall_date,
  min_projected_headroom_change:
    baseline.min_projected_headroom == null || scenario.min_projected_headroom == null
      ? null
      : roundCents(scenario.min_projected_headroom - baseline.min_projected_headroom),
  end_liquidity_change: roundCents(scenario.end_liquidity - baseline.end_liquidity),
});
