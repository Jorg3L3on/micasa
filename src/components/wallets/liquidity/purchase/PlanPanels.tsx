'use client';

import { useState } from 'react';
import { CalendarDays, ChevronDown, Info } from 'lucide-react';
import { MONTHLY_LIQUID_PANEL_CLASS } from '@/components/monthly/monthly-panel-shell';
import { SectionHeader } from '@/components/section-header';
import { formatDisplayDate } from '@/lib/calendar-dates';
import type { PurchaseSimulationResult } from '@/lib/finance/purchase-simulation/simulate';
import { getCalendarFortnightRefForYmd } from '@/lib/fortnight-calendar';
import { formatMoney } from '@/lib/money';
import { cn } from '@/lib/utils';
import { PURCHASE_COPY as C } from '@/components/wallets/liquidity/purchase/copy';
import { quincenaShort } from '@/components/wallets/liquidity/purchase/format';

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
      {showAll ? (
        <div id="sc-cal-list" className="overflow-hidden rounded-xl border border-border/50">
          {all.map((p, i) => (
            <div key={i} className="flex min-h-11 items-center justify-between gap-3 border-b border-border/30 px-3 py-1.5 last:border-b-0">
              <div className="min-w-0">
                <p className="text-caption font-medium">{p.label}</p>
                <p className="text-caption text-muted-foreground">{formatDisplayDate(p.date)} · {qShort(p.date)}</p>
              </div>
              <span className="shrink-0 text-sm font-semibold tabular-nums">{formatMoney(p.amount)}</span>
            </div>
          ))}
        </div>
      ) : null}
      {all.length > 1 ? (
        <button type="button" aria-expanded={showAll} aria-controls="sc-cal-list" onClick={() => setShowAll((v) => !v)} className="min-h-10 rounded-xl border border-border/60 text-sm font-semibold hover:bg-white/[0.03]">
          {showAll ? C.seeLess : `Ver los ${all.length} pagos`}
        </button>
      ) : null}
      <p className="text-sm font-semibold">En total pagas {formatMoney(paid)}{plan.interest > 0 ? ` · ${formatMoney(plan.interest)} son intereses` : ' · sin intereses'}</p>
    </section>
  );
};

/** Folded by default: one row that opens to a short list. */
export const AssumptionsPanel = ({ result }: { result: PurchaseSimulationResult }) => {
  const [open, setOpen] = useState(false);
  const consumption = result.card_consumption.map((c) => `${c.name} ${formatMoney(c.amount)}`).join(' · ');
  return (
    <section aria-labelledby="sc-how" className={cn(MONTHLY_LIQUID_PANEL_CLASS, 'px-3 py-1 sm:px-4')}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls="sc-how-list"
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-10 w-full items-center gap-2 text-left text-caption text-muted-foreground hover:text-foreground"
      >
        <Info className="size-3.5 shrink-0" aria-hidden />
        <span id="sc-how" className="flex-1 font-medium">{C.howTitle}</span>
        <ChevronDown className={cn('size-4 shrink-0 transition-transform', open && 'rotate-180')} aria-hidden />
      </button>
      {open ? (
        <ul id="sc-how-list" className="flex list-disc flex-col gap-0.5 pb-2.5 pl-5 text-caption text-muted-foreground">
          {result.assumptions.map((a) => <li key={a}>{a}</li>)}
          {consumption ? <li>Consumo habitual por estado de cuenta: {consumption}.</li> : null}
        </ul>
      ) : null}
    </section>
  );
};
