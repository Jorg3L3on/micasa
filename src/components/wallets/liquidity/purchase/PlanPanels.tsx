'use client';

import { useState } from 'react';
import { ArrowLeftRight, CalendarDays, Info } from 'lucide-react';
import { MONTHLY_LIQUID_PANEL_CLASS } from '@/components/monthly/monthly-panel-shell';
import { SectionHeader } from '@/components/section-header';
import { formatDisplayDate } from '@/lib/calendar-dates';
import type { PurchaseSimulationResult, SimulationAlternative } from '@/lib/finance/purchase-simulation/purchase-simulation.service';
import { getCalendarFortnightRefForYmd } from '@/lib/fortnight-calendar';
import { formatMoney } from '@/lib/money';
import { cn } from '@/lib/utils';
import { PURCHASE_COPY as C } from '@/components/wallets/liquidity/purchase/copy';
import { levelTone, quincenaShort } from '@/components/wallets/liquidity/purchase/format';
import { StatusChip } from '@/components/wallets/liquidity/purchase/VerdictPanel';

const qShort = (ymd: string) => quincenaShort(getCalendarFortnightRefForYmd(ymd));

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
