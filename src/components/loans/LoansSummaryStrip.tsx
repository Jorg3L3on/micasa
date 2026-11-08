'use client';

import type { ReactNode } from 'react';
import { AuraRowBloom } from '@/components/aura/aura-surface';
import { MONTHLY_LIQUID_PANEL_CLASS } from '@/components/monthly/monthly-panel-shell';
import { formatDayMonth } from '@/lib/calendar-dates';
import {
  progressPct,
  type LoanGroupSummary,
} from '@/lib/finance/loan-list-summary';
import { AURA_TONE_HEX, getDueRowTone, type AuraTone } from '@/lib/ui/aura-palette';
import { cn, formatCurrency } from '@/lib/utils';
import { LoanProgressBar, ToneDot } from '@/components/loans/loan-list-ui';

type Props = {
  summary: LoanGroupSummary;
  lenderCount: number;
};

const Tile = ({
  label,
  tone,
  bloom,
  value,
  valueClassName,
  detail,
  className,
  children,
}: {
  label: string;
  tone: AuraTone | 'muted';
  bloom?: AuraTone | null;
  value: string;
  valueClassName?: string;
  detail: ReactNode;
  className?: string;
  children?: ReactNode;
}) => (
  <div
    className={cn(
      MONTHLY_LIQUID_PANEL_CLASS,
      'isolate flex min-w-0 flex-col gap-1 px-3.5 py-3',
      className,
    )}
  >
    {bloom ? <AuraRowBloom color={AURA_TONE_HEX[bloom]} /> : null}
    <p className="eyebrow flex items-center gap-1.5 text-muted-foreground">
      <ToneDot tone={tone} />
      {label}
    </p>
    <p
      className={cn(
        'whitespace-nowrap font-sans text-lg font-bold leading-tight tabular-nums text-foreground sm:text-xl',
        valueClassName,
      )}
    >
      {value}
    </p>
    {children}
    <p className="truncate text-caption text-muted-foreground">{detail}</p>
  </div>
);

const plural = (count: number, one: string, many: string) =>
  `${count} ${count === 1 ? one : many}`;

/**
 * Deuda total, Vencido, Próximo pago and Avance, like Balance / Liquidez on
 * the Panel. Below md: Deuda total full width with the bar; no Avance tile.
 */
export const LoansSummaryStrip = ({ summary, lenderCount }: Props) => {
  const overdueShare =
    summary.overdue && summary.pending > 0
      ? summary.overdue.amount / summary.pending
      : 0;
  const debtTone: AuraTone = overdueShare > 0.25 ? 'destructive' : 'emerald';
  const pct = progressPct(summary.paidInstallments, summary.totalInstallments);
  const installmentsLine = `${summary.paidInstallments} de ${summary.totalInstallments} cuotas`;
  const nextTone = summary.next
    ? getDueRowTone('pending', summary.next.daysLeft) ?? 'blue'
    : 'muted';

  return (
    <section
      aria-label="Resumen de préstamos"
      className="grid grid-cols-2 gap-3 md:grid-cols-[1.4fr_1fr_1fr_1fr]"
    >
      <Tile
        label="Deuda total"
        tone={debtTone}
        bloom={debtTone}
        value={formatCurrency(summary.pending)}
        valueClassName="text-xl sm:text-2xl"
        className="col-span-2 md:col-span-1"
        detail={
          <>
            <span className="md:hidden">
              {installmentsLine} · {plural(summary.activeCount, 'contrato', 'contratos')}
            </span>
            <span className="hidden md:inline">
              {plural(summary.activeCount, 'contrato activo', 'contratos activos')} ·{' '}
              {plural(lenderCount, 'prestamista', 'prestamistas')}
            </span>
          </>
        }
      >
        <LoanProgressBar
          pct={pct}
          size="sm"
          className="my-1 md:hidden"
          label={`Avance: ${installmentsLine}`}
        />
      </Tile>
      <Tile
        label="Vencido"
        tone={summary.overdue ? 'destructive' : 'muted'}
        bloom={summary.overdue ? 'destructive' : null}
        value={formatCurrency(summary.overdue?.amount ?? 0)}
        valueClassName={summary.overdue ? 'text-destructive' : undefined}
        detail={
          summary.overdue
            ? `${plural(summary.overdue.count, 'cuota', 'cuotas')} · desde ${formatDayMonth(summary.overdue.firstDate)}`
            : 'Sin cuotas vencidas'
        }
      />
      <Tile
        label="Próximo pago"
        tone={nextTone}
        bloom={nextTone === 'amber' ? 'amber' : null}
        value={summary.next ? formatCurrency(summary.next.amount) : '—'}
        detail={
          summary.next
            ? [formatDayMonth(summary.next.date), summary.next.source]
                .filter(Boolean)
                .join(' · ')
            : 'Sin pagos programados'
        }
      />
      <Tile
        label="Avance"
        tone="primary"
        value={`${Math.round(pct)}%`}
        className="hidden md:flex"
        detail={`${installmentsLine} cubiertas`}
      >
        <LoanProgressBar pct={pct} size="sm" className="my-1" label={`Avance: ${installmentsLine}`} />
      </Tile>
    </section>
  );
};
