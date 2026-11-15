'use client';

import { useMemo, useState } from 'react';
import { BarChart3, Info, List } from 'lucide-react';
import { MONTHLY_LIQUID_PANEL_CLASS, PANEL_INSET_CLASS } from '@/components/monthly/monthly-panel-shell';
import { SectionHeader } from '@/components/section-header';
import { Toggle } from '@/components/ui/toggle';
import { formatDisplayDate } from '@/lib/calendar-dates';
import type { PurchaseSimulationResult } from '@/lib/finance/purchase-simulation/simulate';
import type { QuincenaRow } from '@/lib/finance/purchase-simulation/series';
import { formatAxisMoney, formatMoney } from '@/lib/money';
import { cn } from '@/lib/utils';
import { PURCHASE_COPY as C } from '@/components/wallets/liquidity/purchase/copy';
import {
  granularityFor,
  niceTicks,
  groupUnits,
  quincenaMid,
  quincenaRange,
  quincenaTitle,
  type ChartUnit,
} from '@/components/wallets/liquidity/purchase/format';

const CHART_H = 200;
const DETAIL_LIMIT = 8;
const STRIPES = 'repeating-linear-gradient(135deg, color-mix(in oklch, var(--chart-2) 85%, transparent) 0 3px, color-mix(in oklch, var(--chart-2) 25%, transparent) 3px 6px)';

type Props = {
  result: PurchaseSimulationResult;
  selectedKey: string | null;
  onSelect: (key: string) => void;
  dimmed?: boolean;
};

/** First quincena without a Fortnight row (estimated from here on). */
const firstMissing = (rows: QuincenaRow[]) => rows.find((r) => r.estimated) ?? null;

export const lastCreatedLabel = (key: string | null) => {
  if (!key) return null;
  const [y, m, p] = key.split('-').map(Number);
  return quincenaMid({ year: y, month: m, period: p === 1 ? 'FIRST' : 'SECOND' });
};

export const QuincenaChart = ({
  units,
  showBase,
  selectedKeys,
  onSelect,
}: {
  units: ChartUnit[];
  showBase: boolean;
  selectedKeys: Set<string>;
  onSelect: (key: string) => void;
}) => {
  let maxP = 0;
  let maxN = 0;
  for (const u of units) {
    for (const v of showBase ? [u.queda, u.sinCompra] : [u.queda]) {
      maxP = Math.max(maxP, v);
      maxN = Math.max(maxN, -v);
    }
  }
  const axis = niceTicks(maxP, maxN);
  // Headroom above the top tick for the selected bar's value label.
  const HEAD = 22;
  const scale = (CHART_H - HEAD) / (axis.top + axis.bottom);
  const y0 = HEAD + axis.top * scale;
  const Y = (v: number) => y0 - v * scale;
  const estIndex = units.findIndex((u) => u.estimated);
  const gap = units.length > 60 ? 1 : units.length > 30 ? 2 : 4;
  return (
    <div className="flex gap-2">
      <div aria-hidden className="relative w-11 shrink-0 text-caption text-muted-foreground tabular-nums" style={{ height: CHART_H }}>
        {axis.ticks.map((t) => (
          <span key={t} className="absolute right-0 -translate-y-1/2" style={{ top: Y(t) }}>{formatAxisMoney(t)}</span>
        ))}
      </div>
      <div className="min-w-0 flex-1 overflow-x-auto pb-1">
        <div className="relative" style={{ height: CHART_H + 26, minWidth: units.length * 10 }}>
          {estIndex >= 0 ? (
            <div
              aria-hidden
              className="absolute right-0 top-0 border-l border-dashed border-foreground/30"
              style={{ left: `${(estIndex / units.length) * 100}%`, height: CHART_H, background: 'repeating-linear-gradient(135deg, rgb(255 255 255 / 0.035) 0 6px, transparent 6px 12px)' }}
            >
              <span className="absolute left-1.5 top-1 text-caption text-muted-foreground">{C.estimated}</span>
            </div>
          ) : null}
          {axis.ticks.map((t) => (
            <div key={t} aria-hidden className={cn('absolute inset-x-0 h-px', t === 0 ? 'bg-foreground/30' : 'bg-foreground/[0.07]')} style={{ top: Y(t) }} />
          ))}
          <div className="absolute inset-x-0 top-0 flex" style={{ height: CHART_H, gap }}>
            {units.map((u, i) => {
              const lo = Math.min(u.queda, u.sinCompra);
              const hi = Math.max(u.queda, u.sinCompra);
              const sel = u.keys.some((k) => selectedKeys.has(k));
              const title = `${u.label}: te ${u.queda < 0 ? 'faltarían' : 'quedarían'} ${formatMoney(u.queda)}${u.compra > 0 ? ` (sin la compra ${formatMoney(u.sinCompra)})` : ''}${u.estimated ? ' · estimado' : ''}`;
              return (
                <button
                  key={u.key}
                  type="button"
                  title={title}
                  aria-label={title}
                  aria-pressed={sel}
                  onClick={() => onSelect(u.selectKey)}
                  className={cn('relative min-w-0 flex-1 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60', sel ? 'bg-foreground/[0.08] ring-1 ring-foreground/30' : 'hover:bg-foreground/[0.04]')}
                >
                  <span
                    className={cn(
                      'absolute inset-x-[14%] rounded-sm',
                      // Estimated quincenas are drawn hollow: they miss the expenses you have not registered yet.
                      u.estimated
                        ? cn('border border-dashed', u.queda < 0 ? 'border-status-overdue bg-status-overdue/15' : 'border-primary/70 bg-primary/15')
                        : u.queda < 0 ? 'bg-status-overdue' : 'bg-gradient-to-b from-[color-mix(in_oklch,var(--primary)_70%,white)] to-primary',
                    )}
                    style={{ top: u.queda >= 0 ? Y(u.queda) : y0, height: Math.max(2, Math.abs(u.queda) * scale) }}
                  />
                  {showBase && u.compra > 0 ? (
                    <>
                      <span className={cn('absolute inset-x-[14%] rounded-sm border border-chart-2', u.estimated && 'opacity-50')} style={{ top: Y(hi), height: Math.max(2, (hi - lo) * scale), background: STRIPES }} />
                      <span className="absolute inset-x-[2%] h-0.5 rounded-full bg-foreground" style={{ top: Y(u.sinCompra) - 1 }} />
                    </>
                  ) : null}
                  {u.keys.length > 1 && u.redCount > 0 ? <span className="absolute left-1/2 top-0.5 size-1.5 -translate-x-1/2 rounded-full bg-status-overdue" /> : null}
                  {sel ? (
                    <span
                      aria-hidden
                      className={cn(
                        'absolute z-10 whitespace-nowrap rounded-md border border-border bg-popover px-1.5 py-0.5 text-caption font-semibold tabular-nums shadow-panel',
                        u.queda < 0 ? 'text-status-overdue' : 'text-foreground',
                        i < 2 ? 'left-0' : i > units.length - 3 ? 'right-0' : 'left-1/2 -translate-x-1/2',
                      )}
                      style={{ top: Math.max(0, Y(Math.max(u.queda, showBase && u.compra > 0 ? u.sinCompra : u.queda, 0)) - 22) }}
                    >
                      {formatMoney(u.queda)}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
          <div aria-hidden className="absolute inset-x-0 flex" style={{ top: CHART_H + 6, gap }}>
            {units.map((u, i) => {
              // Phones: every third label so they do not collide.
              const ordinal = units.slice(0, i).filter((x) => x.axisLabel).length;
              return (
                <span key={u.key} className="min-w-0 flex-1 overflow-visible whitespace-nowrap text-caption text-muted-foreground">
                  <span className={cn(ordinal % 3 !== 0 && 'hidden sm:inline')}>{u.axisLabel}</span>
                </span>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

const LineRow = ({ name, meta, amount, tone }: { name: string; meta: string; amount: number; tone: 'income' | 'expense' }) => (
  <div className="flex justify-between gap-3 border-b border-border/40 py-2 last:border-b-0">
    <div className="min-w-0">
      <p className="truncate text-sm font-medium" title={name}>{name}</p>
      <p className="text-caption text-muted-foreground">{meta}</p>
    </div>
    <span className={cn('shrink-0 text-sm font-semibold tabular-nums', tone === 'income' ? 'text-status-income' : 'text-status-expense')}>{formatMoney(amount)}</span>
  </div>
);

const QuincenaDetail = ({ row, showBase }: { row: QuincenaRow; showBase: boolean }) => {
  const [showAllLines, setShowAllLines] = useState(false);
  const status =
    row.queda < 0
      ? row.sinCompra >= 0 ? 'queda en rojo por la compra' : 'ya estaba en rojo sin la compra'
      : row.compra > 0 ? 'la compra cabe aquí' : 'esta compra no tiene pagos aquí';
  return (
    <div className={cn(PANEL_INSET_CLASS, 'p-3.5')}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1.5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-section first-letter:uppercase">{quincenaTitle(row)}</h3>
            {row.estimated ? <span className="rounded-full border border-dashed border-foreground/35 px-2 text-caption">{C.estimated}</span> : null}
          </div>
          <p className="mt-0.5 text-caption text-muted-foreground">{quincenaRange(row)} · {status}</p>
        </div>
        <div className="text-right">
          <p className="text-caption text-muted-foreground">{row.queda < 0 ? 'Te faltarían' : 'Te quedarían'}</p>
          <p className={cn('text-2xl font-bold tabular-nums', row.queda < 0 ? 'text-status-overdue' : 'text-status-success')}>{formatMoney(row.queda)}</p>
          {showBase ? <p className="text-caption text-muted-foreground">{C.colSin}: {formatMoney(row.sinCompra)}</p> : null}
        </div>
      </div>
      <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
        <div>
          <p className="flex justify-between border-b border-border/60 pb-1.5 text-caption font-semibold text-muted-foreground"><span>{C.detailIncome}</span><span className="tabular-nums">{formatMoney(row.entra)}</span></p>
          {row.incomes.length === 0 ? <p className="py-2 text-caption text-muted-foreground">Sin ingresos esta quincena.</p> : null}
          {row.incomes.map((l, i) => <LineRow key={i} name={l.name} meta={`${formatDisplayDate(l.date)}${l.estimated ? ' · programado' : ''}`} amount={l.amount} tone="income" />)}
        </div>
        <div>
          <p className="flex justify-between border-b border-border/60 pb-1.5 text-caption font-semibold text-muted-foreground"><span>{C.detailOut}</span><span className="tabular-nums">{formatMoney(row.comprometido + row.compra)}</span></p>
          {row.purchase.map((l, i) => (
            <div key={i} className="my-1.5 flex justify-between gap-3 rounded-lg border border-chart-2/45 bg-chart-2/10 px-2 py-1.5">
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-sm font-semibold"><span className="rounded-md bg-chart-2/25 px-1.5 text-[0.65rem] font-bold uppercase">{C.simulated}</span><span className="truncate" title={l.name}>{l.name}</span></p>
                <p className="text-caption text-muted-foreground">{l.walletName} · {formatDisplayDate(l.date)}{l.onCard ? ' · se suma a tu pago de la tarjeta' : ''}</p>
              </div>
              <span className="shrink-0 text-sm font-bold tabular-nums">{formatMoney(l.amount)}</span>
            </div>
          ))}
          {row.outflows.length === 0 && row.purchase.length === 0 ? <p className="py-2 text-caption text-muted-foreground">Nada que pagar esta quincena.</p> : null}
          {(showAllLines ? row.outflows : row.outflows.slice(0, DETAIL_LIMIT)).map((l, i) => <LineRow key={i} name={l.name} meta={l.kind === 'budget' ? 'Presupuesto de la quincena' : `${l.walletName} · ${formatDisplayDate(l.date)}${l.estimated ? ' · estimado' : ''}`} amount={l.amount} tone="expense" />)}
        </div>
      </div>
      {row.outflows.length > DETAIL_LIMIT ? (
        <button type="button" onClick={() => setShowAllLines((v) => !v)} className="mt-2 min-h-10 w-full rounded-xl border border-border/60 text-sm font-semibold hover:bg-white/[0.03]">
          {showAllLines ? C.seeLess : `Ver ${row.outflows.length - DETAIL_LIMIT} pagos más`}
        </button>
      ) : null}
    </div>
  );
};

export const QuincenaPanel = ({ result, selectedKey, onSelect, dimmed }: Props) => {
  const [showBase, setShowBase] = useState(true);
  const [showDetail, setShowDetail] = useState(false);
  const rows = result.series;
  const g = granularityFor(rows.length);
  const units = useMemo(() => groupUnits(rows, g), [rows, g]);
  const key = selectedKey && rows.some((r) => r.key === selectedKey) ? selectedKey : result.verdict.tightestKey;
  const row = rows.find((r) => r.key === key)!;
  const missing = firstMissing(rows);
  const title = g === 'quincena' ? C.quincenaTitle : g === 'mes' ? C.monthTitle : C.yearTitle;
  const subtitle = g === 'quincena' ? C.quincenaSubtitle : g === 'mes' ? C.monthSubtitle : C.yearSubtitle;

  return (
    <section aria-labelledby="sc-q" className={cn(MONTHLY_LIQUID_PANEL_CLASS, 'flex flex-col gap-3.5 p-3 sm:p-4', dimmed && 'opacity-50')}>
      <SectionHeader
        id="sc-q"
        icon={BarChart3}
        title={title}
        subtitle={subtitle}
        actions={
          <span className="flex items-center gap-2">
            <span id="sc-base-label" className="hidden text-caption text-muted-foreground sm:inline">{C.showBaseline}</span>
            <Toggle checked={showBase} onCheckedChange={setShowBase} aria-label={C.showBaseline} />
          </span>
        }
      />

      {missing ? (
        <p role="status" className="flex items-center gap-1.5 text-caption text-muted-foreground">
          <Info className="size-3.5 shrink-0" aria-hidden />
          <span>Estimado desde la {quincenaMid(missing)}: con tus ingresos y gastos programados.</span>
        </p>
      ) : null}
      {result.plan.purchaseDate > result.as_of ? (
        <p role="status" className="rounded-xl border border-primary/30 bg-primary/10 px-3 py-2.5 text-sm">
          Simulas la compra el {formatDisplayDate(result.plan.purchaseDate)}. Antes de esa fecha tus quincenas no cambian.
        </p>
      ) : null}

      <p className="text-sm text-foreground/90">{g === 'quincena' ? C.chartCaption : g === 'mes' ? C.chartCaptionMonth : C.chartCaptionYear}</p>
      <div className="flex flex-wrap gap-x-3.5 gap-y-1 text-caption text-muted-foreground">
        <span className="inline-flex items-center gap-1.5"><span aria-hidden className="size-2.5 rounded-sm bg-primary" />{C.legendLeft}</span>
        <span className="inline-flex items-center gap-1.5"><span aria-hidden className="size-2.5 rounded-sm bg-status-overdue" />{C.legendShort}</span>
        {showBase ? <span className="inline-flex items-center gap-1.5"><span aria-hidden className="size-2.5 rounded-sm" style={{ background: STRIPES }} />{C.legendWeight}</span> : null}
        {showBase ? <span className="inline-flex items-center gap-1.5"><span aria-hidden className="h-0.5 w-3.5 bg-foreground" />{C.legendBaseline}</span> : null}
        {missing ? <span className="inline-flex items-center gap-1.5"><span aria-hidden className="size-2.5 rounded-sm border border-dashed border-primary/70 bg-primary/15" />{C.estimated}</span> : null}
      </div>

      <QuincenaChart units={units} showBase={showBase} selectedKeys={new Set([key])} onSelect={onSelect} />
      {showDetail ? <QuincenaDetail row={row} showBase={showBase} /> : null}
      <button
        type="button"
        aria-expanded={showDetail}
        onClick={() => setShowDetail((v) => !v)}
        className="min-h-10 w-full rounded-xl border border-border/60 text-sm font-semibold hover:bg-white/[0.03]"
      >
        {showDetail ? C.hideDetail : C.showDetail}
      </button>
    </section>
  );
};

const TABLE_LIMIT = 6;

export const QuincenaTable = ({ result, selectedKey, onSelect, dimmed }: Props) => {
  const [showAll, setShowAll] = useState(false);
  const g = granularityFor(result.series.length);
  const units = useMemo(() => groupUnits(result.series, g), [result.series, g]);
  const key = selectedKey ?? result.verdict.tightestKey;
  const shown = showAll ? units : units.slice(0, TABLE_LIMIT);
  const noun = g === 'quincena' ? 'quincenas' : g === 'mes' ? 'meses' : 'años';
  return (
    <section aria-labelledby="sc-t" className={cn(MONTHLY_LIQUID_PANEL_CLASS, 'p-3 sm:p-4', dimmed && 'opacity-50')}>
      <SectionHeader id="sc-t" icon={List} title={C.tableTitle[g]} subtitle={C.tableHint} className="mb-3" />
      <div className="hidden overflow-x-auto md:block">
        <div className="min-w-[40rem]">
          <div className="grid grid-cols-[minmax(9rem,1.6fr)_repeat(5,minmax(0,1fr))] gap-2 border-b border-border/60 px-2.5 pb-2 eyebrow text-muted-foreground">
            <span>{g === 'quincena' ? 'Quincena' : g === 'mes' ? 'Mes' : 'Año'}</span>
            <span className="text-right">{C.colEntra}</span><span className="text-right">{C.colComprometido}</span><span className="text-right">{C.colCompra}</span><span className="text-right">{C.colQueda}</span><span className="text-right">{C.colSin}</span>
          </div>
          {shown.map((u) => {
            const sel = u.keys.includes(key);
            const red = u.redCount > 0;
            return (
              <button
                key={u.key}
                type="button"
                onClick={() => onSelect(u.selectKey)}
                aria-pressed={sel}
                className={cn('grid min-h-11 w-full grid-cols-[minmax(9rem,1.6fr)_repeat(5,minmax(0,1fr))] items-center gap-2 border-b border-border/30 px-2.5 py-1.5 text-left text-sm', sel ? 'bg-primary/15' : red ? 'bg-status-overdue-soft/50' : 'hover:bg-white/[0.03]')}
              >
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5 font-semibold">{u.label}{u.estimated ? <span className="rounded-full border border-dashed border-foreground/35 px-1.5 text-[0.65rem] font-medium">{C.estimated}</span> : null}</span>
                  <span className="block text-caption text-muted-foreground">{u.sub}</span>
                </span>
                <span className="text-right tabular-nums text-status-income">{formatMoney(u.entra)}</span>
                <span className="text-right tabular-nums text-muted-foreground">{formatMoney(u.comprometido)}</span>
                <span className={cn('text-right tabular-nums', u.compra > 0 ? 'text-chart-2' : 'text-muted-foreground/60')}>{u.compra > 0 ? formatMoney(u.compra) : '—'}</span>
                <span className={cn('text-right font-bold tabular-nums', u.queda < 0 ? 'text-status-overdue' : 'text-foreground')}>{formatMoney(u.queda)}</span>
                <span className="text-right tabular-nums text-muted-foreground">{formatMoney(u.sinCompra)}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex flex-col gap-1.5 md:hidden">
        {shown.map((u) => (
          <button
            key={u.key}
            type="button"
            onClick={() => onSelect(u.selectKey)}
            aria-pressed={u.keys.includes(key)}
            className={cn('flex min-h-14 items-center justify-between gap-3 rounded-xl border border-border/40 px-3 py-2 text-left', u.keys.includes(key) ? 'bg-primary/15' : u.redCount > 0 ? 'bg-status-overdue-soft/50' : 'bg-white/[0.02]')}
          >
            <span className="min-w-0">
              <span className="flex items-center gap-1.5 text-sm font-semibold">{u.label}{u.estimated ? <span className="rounded-full border border-dashed border-foreground/35 px-1.5 text-[0.65rem] font-medium">{C.estimated}</span> : null}</span>
              <span className="block text-caption text-muted-foreground">{u.compra > 0 ? `Esta compra ${formatMoney(u.compra)} · sin ella ${formatMoney(u.sinCompra)}` : C.noPaymentsHere}</span>
            </span>
            <span className={cn('shrink-0 text-base font-bold tabular-nums', u.queda < 0 ? 'text-status-overdue' : 'text-foreground')}>{formatMoney(u.queda)}</span>
          </button>
        ))}
      </div>
      {units.length > TABLE_LIMIT ? (
        <button type="button" onClick={() => setShowAll((v) => !v)} className="mt-2.5 min-h-10 w-full rounded-xl border border-border/60 text-sm font-semibold hover:bg-white/[0.03]">
          {showAll ? C.seeLess : `Ver ${g === 'quincena' ? 'las' : 'los'} ${units.length} ${noun}`}
        </button>
      ) : null}
    </section>
  );
};

