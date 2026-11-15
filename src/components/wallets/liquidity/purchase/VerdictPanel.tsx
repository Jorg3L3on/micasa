'use client';

import { CircleCheck, CircleX, TriangleAlert } from 'lucide-react';
import { MONTHLY_LIQUID_PANEL_CLASS } from '@/components/monthly/monthly-panel-shell';
import { formatDisplayDate } from '@/lib/calendar-dates';
import type { PurchaseSimulationResult } from '@/lib/finance/purchase-simulation/purchase-simulation.service';
import { formatMoney } from '@/lib/money';
import { STATUS_BADGE_CLASS, STATUS_TEXT_CLASS } from '@/lib/status-tone';
import { cn } from '@/lib/utils';
import { PURCHASE_COPY as C } from '@/components/wallets/liquidity/purchase/copy';
import { levelTone, quincenaShort, verdictCopy } from '@/components/wallets/liquidity/purchase/format';

const ICON = { green: CircleCheck, amber: TriangleAlert, red: CircleX } as const;
const BLOOM = {
  green: 'radial-gradient(120% 160% at 0% 0%, color-mix(in oklch, var(--status-success) 22%, transparent) 0%, transparent 55%)',
  amber: 'radial-gradient(120% 160% at 0% 0%, color-mix(in oklch, var(--status-pending) 22%, transparent) 0%, transparent 55%)',
  red: 'radial-gradient(120% 160% at 0% 0%, color-mix(in oklch, var(--status-overdue) 22%, transparent) 0%, transparent 55%)',
} as const;

export const VerdictPanel = ({ result, dimmed }: { result: PurchaseSimulationResult; dimmed?: boolean }) => {
  const debtCard = typeof result.plan.debtWalletId === 'number' ? result.wallets.find((w) => w.id === result.plan.debtWalletId) : null;
  const copy = verdictCopy(result.verdict, result.series, result.plan, debtCard?.name ?? null);
  const tone = levelTone(copy.level);
  const Icon = ICON[copy.level];
  return (
    <section
      aria-labelledby="sc-verdict"
      aria-live="polite"
      className={cn(MONTHLY_LIQUID_PANEL_CLASS, 'overflow-hidden p-4 sm:p-5', dimmed && 'opacity-50')}
      style={{ backgroundImage: BLOOM[copy.level] }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="eyebrow text-muted-foreground">{C.verdictEyebrow}</span>
        <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold', STATUS_BADGE_CLASS[tone])}>
          <Icon className="size-3.5" aria-hidden />
          {copy.chip}
        </span>
        <span className="text-caption text-muted-foreground">{copy.scope}</span>
      </div>
      <h2 id="sc-verdict" className={cn('mt-2.5 text-2xl font-extrabold leading-tight tracking-tight sm:text-3xl', STATUS_TEXT_CLASS[tone])}>
        {copy.headline}
      </h2>
      <p className="mt-2 max-w-3xl text-body text-foreground/90">{copy.sentence}</p>
      {copy.justa ? <p className="mt-1.5 max-w-3xl text-sm text-status-pending">{copy.justa}</p> : null}
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-caption text-muted-foreground">
        <span>{copy.compare}</span>
        <span>{C.disclaimer}</span>
      </div>
    </section>
  );
};

type Tile = { label: string; value: string; sub: string; tone: 'neutral' | 'success' | 'overdue' | 'pending' };

export function kpiTiles(result: PurchaseSimulationResult): Tile[] {
  const { plan, verdict, series } = result;
  const byKey = new Map(series.map((r) => [r.key, r]));
  const tight = byKey.get(verdict.tightestKey)!;
  const low = byKey.get(verdict.lowestAcumuladoKey)!;
  const monthsToEnd = (() => {
    const [y, m] = plan.lastDueDate.split('-').map(Number);
    const [ty, tm] = result.as_of.split('-').map(Number);
    return (y - ty) * 12 + (m - tm);
  })();
  const pay: Tile =
    plan.count === 1
      ? {
          label: 'Pagas',
          value: formatMoney(plan.total),
          sub: plan.cutoffDate ? `Un solo pago el ${formatDisplayDate(plan.firstDueDate)}, sin intereses` : `Sale el ${formatDisplayDate(plan.purchaseDate)}`,
          tone: 'neutral',
        }
      : {
          label: 'Pagas cada mes',
          value: formatMoney(plan.regularPayment),
          sub:
            plan.mode === 'msi'
              ? `${plan.count} pagos · total ${formatMoney(plan.total)} · sin intereses`
              : `${plan.count} pagos · pagas ${formatMoney(plan.interest)} de más${plan.downPayment > 0 ? ` · enganche ${formatMoney(plan.downPayment)}` : ''}`,
          tone: 'neutral',
        };
  const red = verdict.redKeys.length;
  return [
    pay,
    { label: 'Quincenas en rojo', value: `${red} de ${verdict.quincenas}`, sub: `Sin la compra: ${verdict.baselineRedCount}`, tone: red > 0 ? 'overdue' : 'success' },
    { label: 'La quincena más justa', value: formatMoney(verdict.tightestQueda), sub: `${quincenaShort(tight)} · sin la compra ${formatMoney(tight.sinCompra)}`, tone: verdict.tightestQueda < 0 ? 'overdue' : 'pending' },
    { label: 'Tu colchón más bajo', value: formatMoney(verdict.lowestAcumulado), sub: `Dinero acumulado · ${quincenaShort(low)}`, tone: verdict.lowestAcumulado < 0 ? 'overdue' : 'neutral' },
    { label: 'Terminas de pagar', value: formatDisplayDate(plan.lastDueDate), sub: monthsToEnd <= 0 ? 'Este mes' : `En ${monthsToEnd} ${monthsToEnd === 1 ? 'mes' : 'meses'}`, tone: 'neutral' },
  ];
}

const VALUE = { neutral: 'text-foreground', success: 'text-status-success', overdue: 'text-status-overdue', pending: 'text-foreground' } as const;

export const KpiTiles = ({ result, dimmed }: { result: PurchaseSimulationResult; dimmed?: boolean }) => (
  <div className={cn('grid grid-cols-2 gap-2.5 lg:grid-cols-5', dimmed && 'opacity-50')}>
    {kpiTiles(result).map((t, i) => (
      <div key={t.label} className={cn('card-surface min-w-0 rounded-xl border border-border/60 px-3.5 py-3', i === 0 && 'col-span-2 lg:col-span-1')}>
        <p className="text-caption text-muted-foreground">{t.label}</p>
        <p className={cn('mt-1 text-lg font-bold tabular-nums', VALUE[t.tone])}>{t.value}</p>
        <p className="mt-0.5 text-caption text-muted-foreground">{t.sub}</p>
      </div>
    ))}
  </div>
);
