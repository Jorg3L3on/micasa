'use client';

import { useState } from 'react';
import { ArrowLeftRight, CalendarDays, CreditCard, HandCoins, Info } from 'lucide-react';
import { MONTHLY_LIQUID_PANEL_CLASS, PANEL_INSET_CLASS } from '@/components/monthly/monthly-panel-shell';
import { SectionHeader } from '@/components/section-header';
import { WalletProviderIcon } from '@/components/wallets/WalletProviderIcon';
import { formatDisplayDate, formatMonthShort } from '@/lib/calendar-dates';
import type { PurchaseSimulationResult, SimulationAlternative } from '@/lib/finance/purchase-simulation/purchase-simulation.service';
import { getCalendarFortnightRefForYmd } from '@/lib/fortnight-calendar';
import { formatMoney } from '@/lib/money';
import { cn } from '@/lib/utils';
import { PURCHASE_COPY as C } from '@/components/wallets/liquidity/purchase/copy';
import { levelTone, quincenaShort } from '@/components/wallets/liquidity/purchase/format';
import { StatusChip } from '@/components/wallets/liquidity/purchase/VerdictPanel';

const STRIPES = 'repeating-linear-gradient(135deg, color-mix(in oklch, var(--chart-2) 85%, transparent) 0 3px, color-mix(in oklch, var(--chart-2) 25%, transparent) 3px 6px)';
const SERIES = ['var(--chart-1)', 'var(--chart-4)', 'var(--chart-3)', 'var(--chart-5)', 'var(--status-info)'];

const pointLabel = (points: string[], i: number, short = false) => {
  if (i === 0) return 'hoy';
  const [y, m] = points[i].split('-').map(Number);
  return short ? `${formatMonthShort(m)}${m === 1 ? ` ${String(y).slice(2)}` : ''}` : `${formatMonthShort(m)} ${y}`;
};

const qShort = (ymd: string) => quincenaShort(getCalendarFortnightRefForYmd(ymd));

const DEBT_LIMIT = 4;

export const DebtPanel = ({ result, dimmed }: { result: PurchaseSimulationResult; dimmed?: boolean }) => {
  const [showAll, setShowAll] = useState(false);
  const { debt } = result;
  // The wallet with the purchase first, then the largest debts.
  const ordered = debt.wallets
    .map((w, wi) => ({ w, wi, peak: Math.max(...w.values) }))
    .sort((a, b) => Number(b.w.includesPurchase) - Number(a.w.includesPurchase) || b.peak - a.peak);
  const n = debt.points.length;
  if (debt.wallets.length === 0) return null;
  const maxT = Math.max(1, ...debt.totals);
  const maxI = debt.totals.indexOf(Math.max(...debt.totals));
  const step = n <= 15 ? 1 : n <= 37 ? 3 : n <= 73 ? 6 : 12;
  const subtitle = `Hoy debes ${formatMoney(debt.totals[0])}. Con la compra llegarías a ${formatMoney(debt.totals[maxI])} (${pointLabel(debt.points, maxI)}) y al final del periodo deberías ${formatMoney(debt.totals[n - 1])}; sin ella, ${formatMoney(debt.totalsSinCompra[n - 1])}.`;
  return (
    <section aria-labelledby="sc-debt" className={cn(MONTHLY_LIQUID_PANEL_CLASS, 'flex flex-col gap-3.5 p-3 sm:p-4', dimmed && 'opacity-50')}>
      <SectionHeader id="sc-debt" icon={CreditCard} title={C.debtTitle} subtitle={subtitle} />
      <div className="flex flex-wrap gap-x-3.5 gap-y-1 text-caption text-muted-foreground">
        {debt.wallets.filter((w) => w.kind !== 'new').map((w, i) => (
          <span key={w.id} className="inline-flex items-center gap-1.5"><span aria-hidden className="size-2.5 rounded-sm" style={{ background: SERIES[i % SERIES.length] }} />{w.name}</span>
        ))}
        <span className="inline-flex items-center gap-1.5"><span aria-hidden className="size-2.5 rounded-sm" style={{ background: STRIPES }} />Esta compra</span>
      </div>
      <div className="overflow-x-auto">
        <div className="relative" style={{ height: 164, minWidth: n * 10 }}>
          <div className="absolute inset-x-0 top-0 flex items-end border-b border-foreground/20" style={{ height: 140, gap: n > 60 ? 1 : n > 30 ? 2 : 4 }}>
            {debt.points.map((p, i) => (
              <div key={p} title={`${i === 0 ? 'Hoy' : `Fin de ${pointLabel(debt.points, i)}`}: debes ${formatMoney(debt.totals[i])}`} className="flex h-full min-w-0 flex-1 flex-col-reverse">
                {debt.wallets.map((w, wi) => {
                  const base = w.kind === 'new' ? 0 : w.valuesSinCompra[i];
                  const sim = w.values[i] - base;
                  return (
                    <span key={w.id} className="contents">
                      {base > 0 ? <span className="mx-[12%] rounded-[2px]" style={{ height: (base / maxT) * 136, background: SERIES[wi % SERIES.length] }} /> : null}
                      {sim > 0 ? <span className="mx-[12%] rounded-[2px]" style={{ height: (sim / maxT) * 136, background: STRIPES }} /> : null}
                    </span>
                  );
                })}
              </div>
            ))}
          </div>
          <div aria-hidden className="absolute inset-x-0 flex" style={{ top: 146, gap: n > 60 ? 1 : n > 30 ? 2 : 4 }}>
            {debt.points.map((p, i) => {
              const m = Number(p.slice(5, 7));
              return <span key={p} className="min-w-0 flex-1 whitespace-nowrap text-caption text-muted-foreground">{i === 0 ? 'Hoy' : (m - 1) % step === 0 ? pointLabel(debt.points, i, true) : ''}</span>;
            })}
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        {ordered.slice(0, showAll ? ordered.length : DEBT_LIMIT).map(({ w, wi }) => {
          const vals = w.values;
          const mx = Math.max(...vals);
          const mxi = vals.indexOf(mx);
          const scale = w.limit ? Math.max(w.limit, mx) : Math.max(mx, 1);
          const sx = (i: number) => (n > 1 ? (i / (n - 1)) * 240 : 0);
          const sy = (v: number) => 46 - (v / scale) * 42;
          const pts = (list: number[]) => list.map((v, i) => `${sx(i).toFixed(1)},${sy(v).toFixed(1)}`).join(' ');
          const uh = w.limit ? vals[0] / w.limit : 0;
          const um = w.limit ? mx / w.limit : 0;
          const color = w.includesPurchase ? 'var(--chart-2)' : SERIES[wi % SERIES.length];
          const aria = `${w.name}: hoy ${formatMoney(vals[0])}, máximo ${formatMoney(mx)}, al final ${formatMoney(vals[n - 1])}`;
          return (
            <div key={w.id} className={cn(PANEL_INSET_CLASS, 'flex flex-wrap items-center gap-x-4 gap-y-2.5 p-3', w.includesPurchase && 'border-chart-2/40 dark:border-chart-2/40')}>
              <div className="flex min-w-0 flex-[1_1_12rem] items-center gap-2.5">
                {w.kind === 'card' ? <WalletProviderIcon providerIconKey={w.providerIconKey} /> : <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted"><HandCoins className="size-3.5" aria-hidden /></span>}
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-1.5 text-sm font-semibold"><span className="truncate" title={w.name}>{w.name}</span>{w.includesPurchase ? <span className="rounded-full border border-chart-2/50 bg-chart-2/15 px-2 text-[0.65rem] font-bold">{C.includesPurchase}</span> : null}</p>
                  <p className="text-caption text-muted-foreground">{w.kind === 'card' ? `Tarjeta${w.limit ? ` · límite ${formatMoney(w.limit)}` : ''}` : w.kind === 'loan' ? 'Préstamo' : 'Crédito simulado'}</p>
                </div>
              </div>
              <svg viewBox="0 0 240 48" preserveAspectRatio="none" role="img" aria-label={aria} className="h-11 min-w-[7.5rem] flex-[1_1_10rem]">
                {w.limit ? <line x1="0" x2="240" y1={sy(w.limit)} y2={sy(w.limit)} stroke="currentColor" strokeOpacity="0.25" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" /> : null}
                {w.includesPurchase ? <polyline points={pts(w.valuesSinCompra)} fill="none" stroke="currentColor" strokeOpacity="0.5" strokeWidth="1.5" strokeDasharray="4 3" vectorEffect="non-scaling-stroke" /> : null}
                <polyline points={pts(vals)} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" />
              </svg>
              <dl className="grid grid-cols-3 gap-x-4 gap-y-0.5 tabular-nums">
                <div><dt className="text-caption text-muted-foreground">Hoy</dt><dd className="text-sm font-semibold">{formatMoney(vals[0])}</dd></div>
                <div><dt className="text-caption text-muted-foreground">Máximo · {pointLabel(debt.points, mxi)}</dt><dd className={cn('text-sm font-semibold', um > 0.8 && 'text-status-overdue')}>{formatMoney(mx)}</dd></div>
                <div><dt className="text-caption text-muted-foreground">Al final</dt><dd className="text-sm font-semibold">{formatMoney(vals[n - 1])}</dd></div>
              </dl>
              {w.limit ? (
                <div className="flex w-full flex-wrap items-center gap-x-3 gap-y-1">
                  <div aria-hidden className="relative h-1.5 flex-[1_1_12rem] rounded-full bg-foreground/10">
                    <div className={cn('absolute inset-y-0 left-0 rounded-full opacity-50', um > 0.8 ? 'bg-status-overdue' : um > 0.5 ? 'bg-status-pending' : 'bg-primary')} style={{ width: `${Math.min(100, um * 100)}%` }} />
                    <div className={cn('absolute inset-y-0 left-0 rounded-full', um > 0.8 ? 'bg-status-overdue' : um > 0.5 ? 'bg-status-pending' : 'bg-primary')} style={{ width: `${Math.min(100, uh * 100)}%` }} />
                  </div>
                  <span className="text-caption text-muted-foreground">Uso del límite: hoy {Math.round(uh * 100)}% · máximo {Math.round(um * 100)}%{um > 1 ? ' (rebasa el límite)' : ''}</span>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
      {ordered.length > DEBT_LIMIT ? (
        <button type="button" onClick={() => setShowAll((v) => !v)} className="min-h-10 rounded-xl border border-border/60 text-sm font-semibold hover:bg-white/[0.03]">
          {showAll ? C.seeLess : `Ver las ${ordered.length} billeteras`}
        </button>
      ) : null}
    </section>
  );
};

export const PaymentCalendar = ({ result, dimmed }: { result: PurchaseSimulationResult; dimmed?: boolean }) => {
  const [showAll, setShowAll] = useState(false);
  const { plan } = result;
  const card = typeof plan.debtWalletId === 'number' ? result.wallets.find((w) => w.id === plan.debtWalletId) : null;
  const steps: { t: string; d: string; sub: string; dot: string }[] = [];
  if (plan.mode === 'contado' && !plan.cutoffDate) {
    steps.push({ t: 'Compras y pagas', d: plan.purchaseDate, sub: `Sale de tu billetera en tu ${qShort(plan.purchaseDate)}`, dot: 'bg-status-success' });
  } else if (plan.debtWalletId === 'new') {
    if (plan.downPayment > 0) steps.push({ t: 'Enganche', d: plan.purchaseDate, sub: `${formatMoney(plan.downPayment)} · ${qShort(plan.purchaseDate)}`, dot: 'bg-primary' });
    steps.push({ t: 'Primera mensualidad', d: plan.firstDueDate, sub: `${formatMoney(plan.regularPayment)} · ${qShort(plan.firstDueDate)}`, dot: 'bg-chart-2' });
    steps.push({ t: 'Última mensualidad', d: plan.lastDueDate, sub: `Liquidas el crédito · ${qShort(plan.lastDueDate)}`, dot: 'bg-status-success' });
  } else {
    steps.push({ t: 'Compras', d: plan.purchaseDate, sub: card ? `Con ${card.name}` : '', dot: 'bg-primary' });
    if (plan.cutoffDate) steps.push({ t: 'Corte', d: plan.cutoffDate, sub: 'La compra entra a tu estado de cuenta', dot: 'bg-muted-foreground' });
    if (plan.count === 1) {
      steps.push({ t: 'Pagas el total', d: plan.firstDueDate, sub: `${formatMoney(plan.total)} en tu ${qShort(plan.firstDueDate)}`, dot: 'bg-status-success' });
    } else {
      const sameHalf = plan.payments.every((p) => (Number(p.date.slice(8, 10)) <= 14) === (Number(plan.firstDueDate.slice(8, 10)) <= 14));
      steps.push({ t: 'Primer pago', d: plan.firstDueDate, sub: `${formatMoney(plan.regularPayment)} en tu ${qShort(plan.firstDueDate)}${sameHalf ? ` · todas caen en la ${Number(plan.firstDueDate.slice(8, 10)) <= 14 ? '1ª' : '2ª'} quincena` : ''}`, dot: 'bg-chart-2' });
      steps.push({ t: 'Último pago', d: plan.lastDueDate, sub: `Terminas en tu ${qShort(plan.lastDueDate)}`, dot: 'bg-status-success' });
    }
  }
  const all = plan.payments;
  const list = showAll || all.length <= 6 ? all : [...all.slice(0, 4), null, all[all.length - 1]];
  const paid = all.reduce((s, p) => s + p.amount, 0);
  return (
    <section aria-labelledby="sc-cal" className={cn(MONTHLY_LIQUID_PANEL_CLASS, 'flex flex-col gap-3 p-3 sm:p-4', dimmed && 'opacity-50')}>
      <SectionHeader id="sc-cal" icon={CalendarDays} title={C.calendarTitle} subtitle={card ? `Las fechas salen del corte y el día de pago de ${card.name}.` : plan.debtWalletId === 'new' ? 'Mensualidades fijas cada mes.' : 'Un solo movimiento de tu billetera.'} />
      <ol className="flex flex-col">
        {steps.map((s) => (
          <li key={s.t} className="flex gap-3 pb-3 last:pb-0">
            <span aria-hidden className={cn('mt-1.5 size-2.5 shrink-0 rounded-full ring-4 ring-foreground/5', s.dot)} />
            <div className="min-w-0">
              <p className="text-sm font-semibold">{s.t} · <span className="text-primary-text">{formatDisplayDate(s.d)}</span></p>
              <p className="text-caption text-muted-foreground">{s.sub}</p>
            </div>
          </li>
        ))}
      </ol>
      <div className="overflow-hidden rounded-xl border border-border/50">
        {list.map((p, i) =>
          p ? (
            <div key={i} className="flex min-h-10 items-center justify-between gap-3 border-b border-border/30 px-3 py-1.5 last:border-b-0">
              <span className="min-w-0 text-caption">{p.label}</span>
              <span className="whitespace-nowrap text-caption text-muted-foreground">{formatDisplayDate(p.date)} · {qShort(p.date)}</span>
              <span className="whitespace-nowrap text-sm font-semibold tabular-nums">{formatMoney(p.amount)}</span>
            </div>
          ) : (
            <div key={i} className="border-b border-border/30 bg-white/[0.02] px-3 py-1.5 text-caption text-muted-foreground">… {all.length - 5} pagos más</div>
          ),
        )}
      </div>
      {all.length > 6 ? (
        <button type="button" onClick={() => setShowAll((v) => !v)} className="min-h-10 rounded-xl border border-border/60 text-sm font-semibold hover:bg-white/[0.03]">
          {showAll ? C.seeLess : `Ver los ${all.length} pagos`}
        </button>
      ) : null}
      <p className="text-sm font-semibold">En total pagas {formatMoney(paid)}{plan.interest > 0 ? ` · ${formatMoney(plan.interest)} son intereses` : ' · sin intereses'}</p>
    </section>
  );
};

const RANK = { green: 0, amber: 1, red: 2 } as const;

export const pickBetterAlternative = (current: PurchaseSimulationResult['verdict'], alts: SimulationAlternative[]) => {
  let best: SimulationAlternative | null = null;
  for (const a of alts) {
    if (!best || RANK[a.level] < RANK[best.level] || (RANK[a.level] === RANK[best.level] && (a.redCount < best.redCount || (a.redCount === best.redCount && a.tightestQueda > best.tightestQueda)))) best = a;
  }
  return best && !best.current && RANK[best.level] < RANK[current.level] ? best : null;
};

export const AlternativesPanel = ({
  result,
  onApply,
  dimmed,
}: {
  result: PurchaseSimulationResult;
  onApply: (alt: SimulationAlternative) => void;
  dimmed?: boolean;
}) => {
  if (result.alternatives.length === 0) return null;
  const best = pickBetterAlternative(result.verdict, result.alternatives);
  return (
    <section aria-labelledby="sc-alt" className={cn(MONTHLY_LIQUID_PANEL_CLASS, 'flex flex-col gap-3 p-3 sm:p-4', dimmed && 'opacity-50')}>
      <SectionHeader id="sc-alt" icon={ArrowLeftRight} title={C.altTitle} subtitle={C.altSubtitle} />
      {best ? (
        <p className="rounded-xl border border-status-success-border bg-status-success-soft px-3 py-2.5 text-sm text-foreground">
          Si eliges “{best.label}”, el veredicto sería “{C.chip[best.level]}”: {best.redCount} en rojo, la más justa con {formatMoney(best.tightestQueda)}.
        </p>
      ) : null}
      <div className="flex flex-col gap-1.5">
        {result.alternatives.map((a) => (
          <button
            key={a.id}
            type="button"
            aria-pressed={a.current}
            onClick={() => onApply(a)}
            className={cn('flex min-h-13 flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border px-3 py-2 text-left', a.current ? 'border-primary/60 bg-primary/15' : 'border-border/50 bg-white/[0.02] hover:bg-white/[0.05]')}
          >
            <span className="min-w-0 flex-[1_1_10rem]">
              <span className="flex items-center gap-1.5 text-sm font-semibold">{a.label}{a.current ? <span className="rounded-full bg-primary/40 px-1.5 text-[0.65rem] font-bold">{C.current}</span> : null}</span>
              <span className="block text-caption text-muted-foreground">
                {a.count === 1 ? `${formatMoney(a.regularPayment)} una vez` : `${formatMoney(a.regularPayment)} × ${a.count}${a.interest > 0 ? ` · ${formatMoney(a.interest)} de intereses` : ' · sin intereses'}`} · terminas {formatDisplayDate(a.lastDueDate)}
              </span>
            </span>
            <span className="whitespace-nowrap text-caption text-muted-foreground">{a.redCount} en rojo</span>
            <span className={cn('whitespace-nowrap text-caption tabular-nums', a.tightestQueda < 0 ? 'text-status-overdue' : 'text-muted-foreground')}>más justa {formatMoney(a.tightestQueda)}</span>
            <StatusChip tone={levelTone(a.level)}>{C.chip[a.level]}</StatusChip>
          </button>
        ))}
      </div>
    </section>
  );
};

export const AssumptionsPanel = ({ result }: { result: PurchaseSimulationResult }) => (
  <section aria-labelledby="sc-how" className={cn(MONTHLY_LIQUID_PANEL_CLASS, 'p-3 sm:p-4')}>
    <SectionHeader id="sc-how" icon={Info} title={C.howTitle} className="mb-3" />
    <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-muted-foreground">
      <li>Empiezas con {formatMoney(result.starting_liquidity)} en efectivo y débito (lo que cuenta en tu liquidez).</li>
      {result.assumptions.map((a) => <li key={a}>{a}</li>)}
      {result.card_consumption.map((c) => <li key={c.walletId}>Consumo habitual estimado de {c.name}: {formatMoney(c.amount)} por estado de cuenta.</li>)}
    </ul>
  </section>
);
