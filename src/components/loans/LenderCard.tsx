'use client';

import { useState } from 'react';
import { ChevronDown, HandCoins, Landmark, MoreHorizontal } from 'lucide-react';
import { LenderIcon } from '@/components/loans/LenderIdentity';
import {
  LoanHealthBadge,
  LoanProgressBar,
  TONE_TEXT_CLASS,
  ToneDot,
  formatYmdRange,
} from '@/components/loans/loan-list-ui';
import {
  MONTHLY_LIQUID_PANEL_CLASS,
  PANEL_INSET_CLASS,
} from '@/components/monthly/monthly-panel-shell';
import { AuraRowBloom } from '@/components/aura/aura-surface';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatDayMonth, formatMonthYear } from '@/lib/calendar-dates';
import { PAYROLL_DEDUCTION_COPY } from '@/lib/finance/lender-payroll';
import { getLoanSourceLabel } from '@/lib/finance/loan-labels';
import {
  daysBetweenYmd,
  getLoanEndYmd,
  getLoanHealth,
  progressPct,
  summarizeLoanGroup,
  type LoanHealth,
} from '@/lib/finance/loan-list-summary';
import { formatInstallmentLabel } from '@/lib/finance/loan-schedule';
import { AURA_TONE_HEX, getDueRowTone, type AuraTone } from '@/lib/ui/aura-palette';
import { cn, formatCurrency } from '@/lib/utils';
import type { LenderPaymentListItem } from '@/types/lenders';
import type { LoanListItem } from '@/types/loans';

type LenderCardProps = {
  name: string;
  providerIconKey?: string | null;
  /** Contracts in the selected tab. */
  loans: LoanListItem[];
  /** Paid-off contracts folded under "Mostrar n liquidados". */
  foldedLoans?: LoanListItem[];
  todayYmd: string;
  canPay: boolean;
  onPay?: () => void;
  onOpenLoan: (loanId: number) => void;
  onMerge?: () => void;
  onSplit?: () => void;
  onHistory?: () => void;
  lastPayment?: LenderPaymentListItem;
  onUndoLastPayment?: () => void;
};

const plural = (count: number, one: string, many: string) =>
  `${count} ${count === 1 ? one : many}`;

const FREQUENCY_LABEL: Record<LoanListItem['frequency'], string> = {
  WEEKLY: 'semanal',
  FORTNIGHTLY: 'quincenal',
  MONTHLY: 'mensual',
};

const uniqueValue = <T,>(values: T[]): T | null => {
  const set = new Set(values);
  return set.size === 1 ? values[0]! : null;
};

/** "2 contratos · Se descuenta del ingreso · quincenal" (desktop) / "· nómina ·" (mobile). */
const subtitleParts = (loans: LoanListItem[], compact: boolean): string => {
  const parts = [plural(loans.length, 'contrato', 'contratos')];
  if (loans.length > 0) {
    if (loans.every((loan) => loan.paymentSource === 'PAYROLL_DEDUCTION')) {
      parts.push(compact ? 'nómina' : PAYROLL_DEDUCTION_COPY);
    } else {
      const wallet = uniqueValue(
        loans.map((loan) =>
          loan.paymentSource === 'WALLET' ? loan.sourceWalletName : null,
        ),
      );
      if (wallet) parts.push(compact ? wallet : `Se paga desde ${wallet}`);
    }
    const frequency = uniqueValue(loans.map((loan) => loan.frequency));
    if (frequency) parts.push(FREQUENCY_LABEL[frequency]);
  }
  return parts.join(' · ');
};

const healthLabel = (
  health: LoanHealth,
  overdueCount: number,
  daysLeft: number | null,
): string | undefined => {
  if (health === 'overdue') {
    return plural(overdueCount, 'cuota vencida', 'cuotas vencidas');
  }
  if (health === 'soon' && daysLeft != null) {
    if (daysLeft <= 0) return 'Vence hoy';
    return `Vence en ${plural(daysLeft, 'día', 'días')}`;
  }
  return undefined;
};

const StatCell = ({
  label,
  tone,
  value,
  valueClassName,
  detail,
  className,
}: {
  label: string;
  tone: AuraTone | 'muted';
  value: string;
  valueClassName?: string;
  detail: string;
  className?: string;
}) => (
  <div className={cn(PANEL_INSET_CLASS, 'flex min-w-0 flex-col gap-0.5 px-3 py-2.5', className)}>
    <p className="eyebrow flex items-center gap-1.5 whitespace-nowrap text-muted-foreground">
      <ToneDot tone={tone} />
      {label}
    </p>
    <p
      className={cn(
        'whitespace-nowrap font-sans text-lg font-bold leading-tight tabular-nums text-foreground',
        valueClassName,
      )}
    >
      {value}
    </p>
    <p className="truncate text-caption text-muted-foreground" title={detail}>
      {detail}
    </p>
  </div>
);

/** Due line on a contract row, coloured like the Panel rows (getDueRowTone). */
const loanDueCue = (
  loan: LoanListItem,
  todayYmd: string,
): { text: string; extra?: string; tone: AuraTone | null } => {
  const health = getLoanHealth(loan, todayYmd);
  if (health === 'paid') return { text: 'Liquidado', tone: 'emerald' };
  if (health === 'paused') return { text: 'Pausado', tone: null };
  if (health === 'cancelled') return { text: 'Cancelado', tone: null };
  const summary = summarizeLoanGroup([loan], todayYmd);
  if (summary.overdue) {
    return {
      text: `Vencida ${formatDayMonth(summary.overdue.firstDate)}`,
      extra: summary.next ? ` · próx. ${formatDayMonth(summary.next.date)}` : undefined,
      tone: 'destructive',
    };
  }
  if (summary.next) {
    return {
      text: `Vence ${formatDayMonth(summary.next.date)}`,
      tone: getDueRowTone('pending', summary.next.daysLeft),
    };
  }
  return { text: 'Sin cuotas por pagar', tone: null };
};

const LoanRow = ({
  loan,
  todayYmd,
  onOpen,
  dimmed = false,
}: {
  loan: LoanListItem;
  todayYmd: string;
  onOpen: () => void;
  dimmed?: boolean;
}) => {
  const isPayroll = loan.type === 'PAYROLL';
  const Icon = isPayroll ? Landmark : HandCoins;
  const source = getLoanSourceLabel(loan);
  const endYmd = getLoanEndYmd(loan);
  const pct = progressPct(loan.paidPayments, loan.paymentCount);
  const due = loanDueCue(loan, todayYmd);
  const installment =
    loan.paidPayments > 0
      ? formatInstallmentLabel(loan.paidPayments, loan.paymentCount, { lowercase: true })
      : `0 de ${loan.paymentCount} cuotas`;
  // Mobile (Marco 02): one compact line, no sub-bar.
  const compactLine = [
    source,
    `${loan.paidPayments} de ${loan.paymentCount}`,
    endYmd ? formatMonthYear(endYmd) : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <li className="border-t border-border/60 first:border-t-0 dark:border-white/[0.06]">
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Ver detalle de ${loan.name}`}
        className={cn(
          'group/row grid min-h-11 w-full grid-cols-[1.875rem_minmax(0,1fr)_auto] items-center gap-x-3 rounded-lg px-0.5 py-3 text-left transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 dark:hover:bg-white/[0.03]',
          dimmed && 'opacity-60',
          (loan.status === 'PAUSED' || loan.status === 'CANCELLED') && 'opacity-75',
        )}
      >
        <span
          aria-hidden
          className={cn(
            PANEL_INSET_CLASS,
            'flex size-[1.875rem] items-center justify-center rounded-lg text-muted-foreground',
          )}
        >
          <Icon className="size-3.5" />
        </span>
        <span className="min-w-0">
          <span className="block break-words text-sm font-semibold leading-snug text-foreground">
            {loan.name}
          </span>
          <span className="mt-0.5 block text-caption text-muted-foreground md:hidden">
            {compactLine}
          </span>
          <span className="mt-0.5 hidden flex-wrap items-center gap-x-1.5 gap-y-1 text-caption text-muted-foreground md:flex">
            <span>{[source, installment].filter(Boolean).join(' · ')}</span>
            <LoanProgressBar
              pct={pct}
              size="sm"
              paid={loan.status === 'PAID_OFF'}
              className="w-14 sm:w-16"
              label={`${loan.paidPayments} de ${loan.paymentCount} cuotas`}
            />
            {endYmd ? (
              <span className="whitespace-nowrap">termina {formatMonthYear(endYmd)}</span>
            ) : null}
          </span>
        </span>
        <span className="flex items-center gap-2">
          <span className="flex flex-col items-end gap-0.5 text-right">
            <span className="whitespace-nowrap font-sans text-sm font-semibold tabular-nums text-foreground">
              {formatCurrency(loan.status === 'PAID_OFF' ? loan.totalPayable : loan.remainingAmount)}
            </span>
            <span
              className={cn(
                'text-caption font-medium',
                due.tone ? TONE_TEXT_CLASS[due.tone] : 'text-muted-foreground',
              )}
            >
              {due.text}
              {due.extra ? <span className="hidden md:inline">{due.extra}</span> : null}
            </span>
          </span>
          <span
            aria-hidden
            className="hidden h-8 items-center rounded-lg px-2.5 text-xs font-semibold text-muted-foreground transition-colors group-hover/row:bg-muted/50 group-hover/row:text-foreground md:inline-flex dark:group-hover/row:bg-white/[0.06]"
          >
            Detalle
          </span>
        </span>
      </button>
    </li>
  );
};

/**
 * One glass card per lender, on the Panel card kit: SectionHeader-style
 * header with health badge and actions, three inset stats, the lender bar and
 * hairline contract rows. Mobile stacks the same pieces.
 */
export const LenderCard = ({
  name,
  providerIconKey,
  loans,
  foldedLoans = [],
  todayYmd,
  canPay,
  onPay,
  onOpenLoan,
  onMerge,
  onSplit,
  onHistory,
  lastPayment,
  onUndoLastPayment,
}: LenderCardProps) => {
  const [showFolded, setShowFolded] = useState(false);
  const summary = summarizeLoanGroup(loans, todayYmd);
  const hasActive = summary.activeCount > 0;
  const health: LoanHealth | null =
    summary.health ?? (foldedLoans.length > 0 ? 'paid' : null);
  const isUrgent = health === 'overdue' || health === 'soon';
  const subtitleLoans = loans.length > 0 ? loans : foldedLoans;
  const pct = progressPct(summary.paidInstallments, summary.totalInstallments);
  const installmentsLine = `${summary.paidInstallments} de ${summary.totalInstallments}`;
  const singleActive = summary.activeCount === 1;
  const nextMonthHint =
    singleActive && summary.next
      ? ` · cuota ${summary.next.sequence} en ${formatMonthYear(summary.next.date)}`
      : '';
  const endLabel = summary.endYmd ? formatMonthYear(summary.endYmd) : null;
  const mobilePayAll = canPay && Boolean(onPay) && health === 'overdue' && summary.overdue;
  const nextTone: AuraTone | 'muted' = summary.next
    ? getDueRowTone('pending', summary.next.daysLeft) ?? 'blue'
    : 'muted';
  const nextDaysLeft = summary.next
    ? daysBetweenYmd(todayYmd, summary.next.date)
    : null;
  const hasMenu = Boolean(onMerge || onSplit || onHistory || (lastPayment && onUndoLastPayment));

  return (
    <article
      aria-label={name}
      className={cn(MONTHLY_LIQUID_PANEL_CLASS, 'isolate space-y-3 p-3 sm:space-y-4 sm:p-4')}
    >
      {health === 'overdue' ? (
        <AuraRowBloom color={AURA_TONE_HEX.destructive} subdued />
      ) : null}

      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <LenderIcon
            name={name}
            providerIconKey={providerIconKey}
            className="size-8 rounded-xl"
            iconClassName="size-4"
          />
          <div className="min-w-0 pt-0.5">
            <h2 className="text-section break-words text-foreground">{name}</h2>
            <p className="mt-1 text-caption leading-snug text-muted-foreground">
              <span className="sm:hidden">{subtitleParts(subtitleLoans, true)}</span>
              <span className="hidden sm:inline">{subtitleParts(subtitleLoans, false)}</span>
            </p>
            {health && !mobilePayAll ? (
              <LoanHealthBadge
                health={health}
                label={healthLabel(health, summary.overdue?.count ?? 0, nextDaysLeft)}
                className="mt-1.5 sm:hidden"
              />
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {health ? (
            <LoanHealthBadge
              health={health}
              label={healthLabel(health, summary.overdue?.count ?? 0, nextDaysLeft)}
              className="hidden sm:inline-flex"
            />
          ) : null}
          {canPay && onPay ? (
            <Button
              type="button"
              size="sm"
              variant={isUrgent ? 'default' : 'outline'}
              className="hidden h-8 rounded-xl md:inline-flex"
              onClick={onPay}
              aria-label={`Pagar a ${name}`}
            >
              Pagar
            </Button>
          ) : null}
          {hasMenu || (canPay && onPay) ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-11 rounded-xl md:size-8"
                  aria-label={`Más acciones de ${name}`}
                >
                  <MoreHorizontal className="size-4" aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {canPay && onPay && !mobilePayAll ? (
                  <DropdownMenuItem className="md:hidden" onClick={onPay}>
                    Pagar a {name}
                  </DropdownMenuItem>
                ) : null}
                {onMerge || onSplit ? (
                  <>
                    <DropdownMenuLabel className="eyebrow text-muted-foreground">
                      Organizar
                    </DropdownMenuLabel>
                    {onMerge ? (
                      <DropdownMenuItem onClick={onMerge}>Fusionar con otro</DropdownMenuItem>
                    ) : null}
                    {onSplit ? (
                      <DropdownMenuItem onClick={onSplit}>Separar contratos</DropdownMenuItem>
                    ) : null}
                  </>
                ) : null}
                {onHistory || (lastPayment && onUndoLastPayment) ? (
                  <DropdownMenuSeparator />
                ) : null}
                {onHistory ? (
                  <DropdownMenuItem onClick={onHistory}>Historial</DropdownMenuItem>
                ) : null}
                {lastPayment && onUndoLastPayment ? (
                  <DropdownMenuItem onClick={onUndoLastPayment}>
                    Deshacer pago del {formatDayMonth(lastPayment.paidAt)} ·{' '}
                    {formatCurrency(lastPayment.amount)}
                  </DropdownMenuItem>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      </div>

      {hasActive ? (
        <>
          <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3">
            <StatCell
              label="Pendiente"
              tone="primary"
              value={formatCurrency(summary.pending)}
              className="col-span-2 md:col-span-1"
              detail={`de ${formatCurrency(summary.total)} total`}
            />
            <StatCell
              label="Vencido"
              tone={summary.overdue ? 'destructive' : 'muted'}
              value={formatCurrency(summary.overdue?.amount ?? 0)}
              valueClassName={summary.overdue ? 'text-destructive' : undefined}
              detail={
                summary.overdue
                  ? formatYmdRange(summary.overdue.firstDate, summary.overdue.lastDate)
                  : 'Sin cuotas vencidas'
              }
            />
            <StatCell
              label="Próximo"
              tone={nextTone}
              value={summary.next ? formatCurrency(summary.next.amount) : '—'}
              detail={
                summary.next
                  ? [formatDayMonth(summary.next.date), summary.next.source]
                      .filter(Boolean)
                      .join(' · ')
                  : 'Sin pagos programados'
              }
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-caption text-muted-foreground">
              <span>
                <b className="font-semibold text-foreground">{installmentsLine}</b> cuotas
                cubiertas{nextMonthHint}
              </span>
              {endLabel ? (
                <span className="whitespace-nowrap">
                  Termina <b className="font-semibold text-foreground">{endLabel}</b>
                </span>
              ) : null}
            </div>
            <LoanProgressBar
              pct={pct}
              expectedPct={summary.expectedPct}
              label={`${installmentsLine} cuotas cubiertas`}
            />
          </div>

          {mobilePayAll && summary.overdue ? (
            <Button
              type="button"
              className="h-11 w-full rounded-xl md:hidden"
              onClick={onPay}
            >
              <span className="truncate">
                Pagar cuotas vencidas · {formatCurrency(summary.overdue.amount)}
              </span>
            </Button>
          ) : null}
        </>
      ) : null}

      {loans.length > 0 || foldedLoans.length > 0 ? (
        <div>
          <ul role="list" className={cn(hasActive && 'border-t border-border/60 dark:border-white/[0.06]')}>
            {loans.map((loan) => (
              <LoanRow
                key={loan.id}
                loan={loan}
                todayYmd={todayYmd}
                onOpen={() => onOpenLoan(loan.id)}
              />
            ))}
            {showFolded
              ? foldedLoans.map((loan) => (
                  <LoanRow
                    key={loan.id}
                    loan={loan}
                    todayYmd={todayYmd}
                    onOpen={() => onOpenLoan(loan.id)}
                    dimmed
                  />
                ))
              : null}
          </ul>
          {foldedLoans.length > 0 ? (
            <button
              type="button"
              onClick={() => setShowFolded((open) => !open)}
              aria-expanded={showFolded}
              className="flex min-h-11 w-full items-center justify-between border-t border-border/60 px-0.5 pt-2 text-xs font-medium text-muted-foreground hover:text-foreground dark:border-white/[0.06]"
            >
              <span>
                {showFolded ? 'Ocultar' : 'Mostrar'}{' '}
                {plural(foldedLoans.length, 'liquidado', 'liquidados')}
              </span>
              <ChevronDown
                aria-hidden
                className={cn('size-4 transition-transform', showFolded && 'rotate-180')}
              />
            </button>
          ) : null}
        </div>
      ) : (
        <p className="text-caption text-muted-foreground">Sin contratos en este filtro.</p>
      )}
    </article>
  );
};
