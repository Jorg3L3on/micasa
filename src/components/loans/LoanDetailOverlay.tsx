'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ChevronDown,
  CircleSlash,
  History,
  MoreHorizontal,
  Pause,
  Pencil,
  Play,
  Trash2,
} from 'lucide-react';
import { ErrorBanner } from '@/components/error-banner';
import { LenderIcon } from '@/components/loans/LenderIdentity';
import { LoanHealthBadge, TONE_TEXT_CLASS } from '@/components/loans/loan-list-ui';
import {
  AURA_TAB_INDICATOR_CLASS,
  GLASS_TAB_ACTIVE_LABEL_CLASS,
  PANEL_INSET_CLASS,
} from '@/components/monthly/monthly-panel-shell';
import { ResponsiveOverlay } from '@/components/overlay/responsive-overlay';
import { SegmentedControl } from '@/components/segmented-control';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  currentCalendarYear,
  formatDayMonth,
  formatMonthShort,
  formatMonthYear,
} from '@/lib/calendar-dates';
import { PAYROLL_DEDUCTION_COPY } from '@/lib/finance/lender-payroll';
import { getLoanSourceLabel } from '@/lib/finance/loan-labels';
import {
  daysBetweenYmd,
  getLoanEndYmd,
  getLoanHealth,
  progressPct,
} from '@/lib/finance/loan-list-summary';
import { formatInstallmentLabel } from '@/lib/finance/loan-schedule';
import { AURA_TONE_HEX, getDueRowTone, type AuraTone } from '@/lib/ui/aura-palette';
import { cn, formatCurrency } from '@/lib/utils';
import type { LoanListItem, LoanPaymentListItem } from '@/types/loans';

export type LoanLifecycleTarget = Extract<
  LoanListItem['status'],
  'ACTIVE' | 'PAUSED' | 'CANCELLED'
>;

type CalendarTab = 'SCHEDULED' | 'PAID' | 'SKIPPED' | 'CANCELLED';

type LoanDetailOverlayProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loan: LoanListItem | null;
  lenderProviderIconKey?: string | null;
  todayYmd: string;
  busy: boolean;
  onEdit: () => void;
  onHistory: () => void;
  onLifecycle: (target: LoanLifecycleTarget) => void;
  onDelete: () => void;
  /** Row tap: opens LoanCalendarPaymentOverlay for that installment. */
  onOpenPayment: (payment: LoanPaymentListItem) => void;
  /** Atraso card: LoanPaymentManageOverlay with these installments. */
  onRegisterOverdue: (payments: LoanPaymentListItem[]) => void;
  lifecycleDraft: LoanLifecycleTarget | null;
  lifecycleError?: string;
  lifecycleSubmitting: boolean;
  onLifecycleCancel: () => void;
  onLifecycleConfirm: () => void;
};

const TYPE_LABEL: Record<LoanListItem['type'], string> = {
  PAYROLL: 'Nómina',
  PERSONAL: 'Personal',
};

const FREQUENCY_LABEL: Record<LoanListItem['frequency'], string> = {
  WEEKLY: 'Semanal',
  FORTNIGHTLY: 'Quincenal',
  MONTHLY: 'Mensual',
};

const STATUS_HEALTH: Record<LoanListItem['status'], 'ok' | 'paused' | 'paid' | 'cancelled'> = {
  ACTIVE: 'ok',
  PAUSED: 'paused',
  PAID_OFF: 'paid',
  CANCELLED: 'cancelled',
};

const STATUS_LABEL: Record<LoanListItem['status'], string> = {
  ACTIVE: 'Activo',
  PAUSED: 'Pausado',
  PAID_OFF: 'Liquidado',
  CANCELLED: 'Cancelado',
};

export const lifecycleLabel = (status: LoanLifecycleTarget) => {
  if (status === 'PAUSED') return 'Pausar préstamo';
  if (status === 'CANCELLED') return 'Cancelar préstamo';
  return 'Reanudar préstamo';
};

const lifecycleDescription = (status: LoanLifecycleTarget) => {
  if (status === 'PAUSED') {
    return 'El préstamo saldrá de las obligaciones activas mientras esté pausado, sin borrar su historial.';
  }
  if (status === 'CANCELLED') {
    return 'El préstamo se cancelará sin eliminar pagos históricos ni gastos generados. Sus pagos pendientes dejarán de planificarse como activos.';
  }
  return 'El préstamo volverá al seguimiento activo y sus pagos pendientes aparecerán de nuevo en la planeación.';
};

const plural = (count: number, one: string, many: string) =>
  `${count} ${count === 1 ? one : many}`;

const byDue = (a: LoanPaymentListItem, b: LoanPaymentListItem) =>
  a.dueDate.localeCompare(b.dueDate) || a.sequence - b.sequence;

const PAID_VISIBLE_IN_PENDING = 1;

/** Conic ring: electric blue over muted, percent and "x de n" in the middle. */
const ProgressRing = ({ pct, label }: { pct: number; label: string }) => (
  <div
    role="img"
    aria-label={`${Math.round(pct)}% cubierto, ${label} cuotas`}
    className="relative grid size-[5.25rem] shrink-0 place-items-center rounded-full"
    style={{
      background: `conic-gradient(${AURA_TONE_HEX.primary} 0 ${pct}%, color-mix(in oklab, var(--color-muted-foreground) 22%, transparent) ${pct}% 100%)`,
    }}
  >
    <span className="absolute inset-[7px] rounded-full bg-card" aria-hidden />
    <span className="relative text-center leading-none">
      <span className="block font-[family-name:var(--font-display)] text-base font-extrabold tabular-nums text-foreground">
        {Math.round(pct)}%
      </span>
      <span className="mt-1 block whitespace-nowrap text-[0.625rem] font-semibold tracking-wide text-muted-foreground">
        {label}
      </span>
    </span>
  </div>
);

const InsetFigure = ({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) => (
  <div className={cn(PANEL_INSET_CLASS, 'min-w-0 px-3 py-2.5')}>
    <p className="eyebrow whitespace-nowrap text-muted-foreground">{label}</p>
    <p className="mt-0.5 whitespace-nowrap font-sans text-lg font-bold leading-tight tabular-nums text-foreground">
      {value}
    </p>
    <p className="mt-0.5 truncate text-caption text-muted-foreground" title={detail}>
      {detail}
    </p>
  </div>
);

type RowCue = { status: string; tone: AuraTone | null; line: string };

const DateTile = ({ ymd, todayYmd }: { ymd: string; todayYmd: string }) => {
  const [year, month, day] = ymd.split('-').map(Number);
  const showYear = year !== currentCalendarYear(new Date(`${todayYmd}T12:00:00.000Z`));
  return (
    <span className="flex w-11 shrink-0 flex-col items-center text-center leading-tight">
      <b className="font-[family-name:var(--font-display)] text-[0.9375rem] font-bold tabular-nums text-foreground">
        {day}
      </b>
      <span className="text-caption font-semibold text-muted-foreground">
        {formatMonthShort(month!)}
      </span>
      {showYear ? (
        <span className="text-[0.625rem] font-medium tabular-nums text-muted-foreground">
          {year}
        </span>
      ) : null}
    </span>
  );
};

/**
 * Contract detail on the Panel card kit (Marco 04): one header, ring + two
 * figures, atraso card, calendar as rows. Row taps open the payment overlay;
 * there are no per-row buttons.
 */
export const LoanDetailOverlay = ({
  open,
  onOpenChange,
  loan,
  lenderProviderIconKey,
  todayYmd,
  busy,
  onEdit,
  onHistory,
  onLifecycle,
  onDelete,
  onOpenPayment,
  onRegisterOverdue,
  lifecycleDraft,
  lifecycleError,
  lifecycleSubmitting,
  onLifecycleCancel,
  onLifecycleConfirm,
}: LoanDetailOverlayProps) => {
  const payments = useMemo(
    () => [...(loan?.payments ?? [])].sort(byDue),
    [loan?.payments],
  );
  const counts = useMemo(
    () =>
      payments.reduce(
        (acc, payment) => {
          acc[payment.status] += 1;
          return acc;
        },
        { SCHEDULED: 0, PAID: 0, SKIPPED: 0, CANCELLED: 0 } as Record<CalendarTab, number>,
      ),
    [payments],
  );
  const [tab, setTab] = useState<CalendarTab>('SCHEDULED');
  const [showAllPaid, setShowAllPaid] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTab(counts.SCHEDULED > 0 || counts.PAID === 0 ? 'SCHEDULED' : 'PAID');
    setShowAllPaid(false);
    // Reset when another contract opens, not on every refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, loan?.id]);

  const overdue = payments.filter(
    (payment) => payment.status === 'SCHEDULED' && payment.dueDate < todayYmd,
  );
  const overdueTotal = overdue.reduce((sum, payment) => sum + payment.amount, 0);
  const nextUpcoming = payments.find(
    (payment) => payment.status === 'SCHEDULED' && payment.dueDate >= todayYmd,
  );
  const lastSequence = payments.reduce((max, payment) => Math.max(max, payment.sequence), 0);
  const paidDesc = payments.filter((payment) => payment.status === 'PAID').reverse();

  const rowCue = (payment: LoanPaymentListItem): RowCue => {
    const source = loan ? getLoanSourceLabel(loan) : null;
    if (payment.status === 'PAID') {
      const paidSource = payment.sourceWalletName ?? source;
      return {
        status: 'Pagada',
        tone: 'emerald',
        line: ['Pagada', paidSource, payment.paidAt ? formatDayMonth(payment.paidAt, { yearIfNotCurrent: true }) : null]
          .filter(Boolean)
          .join(' · '),
      };
    }
    if (payment.status === 'SKIPPED') {
      return { status: 'Omitida', tone: 'amber', line: 'Omitida · sigue pendiente' };
    }
    if (payment.status === 'CANCELLED') {
      return { status: 'Cancelada', tone: null, line: 'Cancelada · fuera del calendario' };
    }
    const days = daysBetweenYmd(todayYmd, payment.dueDate);
    if (days < 0) {
      return {
        status: 'Vencida',
        tone: 'destructive',
        line:
          loan?.paymentSource === 'PAYROLL_DEDUCTION'
            ? 'Vencida · sin descuento'
            : `Vencida · ${plural(-days, 'día', 'días')}`,
      };
    }
    const isLast = payment.sequence === lastSequence;
    const isNext = payment.id === nextUpcoming?.id;
    const status = days === 0 ? 'Hoy' : days <= 7 ? `En ${plural(days, 'día', 'días')}` : 'Programada';
    const line = isLast
      ? `Última · ${formatMonthYear(payment.dueDate)}`
      : isNext
        ? ['Próxima', source].filter(Boolean).join(' · ')
        : 'Programada';
    return { status, tone: getDueRowTone('pending', days), line };
  };

  const renderRow = (payment: LoanPaymentListItem, dimmed = false) => {
    const cue = rowCue(payment);
    const actionable = payment.status === 'SCHEDULED' || payment.status === 'PAID';
    const content = (
      <>
        <DateTile ymd={payment.dueDate} todayYmd={todayYmd} />
        <span className="min-w-0">
          <span className="block text-sm font-semibold leading-snug text-foreground">
            {formatInstallmentLabel(payment.sequence, loan?.paymentCount ?? lastSequence)}
          </span>
          <span className="mt-0.5 block break-words text-caption text-muted-foreground">
            {cue.line}
            {payment.note ? ` · ${payment.note}` : ''}
          </span>
        </span>
        <span className="flex flex-col items-end gap-0.5 text-right">
          <span className="whitespace-nowrap font-sans text-sm font-semibold tabular-nums text-foreground">
            {formatCurrency(payment.amount)}
          </span>
          <span
            className={cn(
              'whitespace-nowrap text-caption font-medium',
              cue.tone ? TONE_TEXT_CLASS[cue.tone] : 'text-muted-foreground',
            )}
          >
            {cue.status}
          </span>
        </span>
      </>
    );
    const rowClass = cn(
      'grid min-h-11 w-full grid-cols-[2.75rem_minmax(0,1fr)_auto] items-center gap-x-3 px-0.5 py-2.5 text-left',
      dimmed && 'opacity-60',
      payment.status === 'CANCELLED' && 'opacity-60',
    );
    return (
      <li
        key={payment.id}
        className="border-t border-border/60 first:border-t-0 dark:border-white/[0.06]"
      >
        {actionable ? (
          <button
            type="button"
            onClick={() => onOpenPayment(payment)}
            disabled={busy}
            aria-label={`${formatInstallmentLabel(payment.sequence, loan?.paymentCount ?? lastSequence)}, ${cue.status}. Abrir acciones`}
            className={cn(
              rowClass,
              'rounded-lg transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 dark:hover:bg-white/[0.03]',
            )}
          >
            {content}
          </button>
        ) : (
          <div className={rowClass}>{content}</div>
        )}
      </li>
    );
  };

  const tabOptions = (
    [
      { value: 'SCHEDULED', label: 'Por pagar' },
      { value: 'PAID', label: 'Pagadas' },
      { value: 'SKIPPED', label: 'Omitidas' },
      { value: 'CANCELLED', label: 'Canceladas' },
    ] satisfies Array<{ value: CalendarTab; label: string }>
  ).filter((option) => option.value !== 'CANCELLED' || counts.CANCELLED > 0);

  const pendingRows = payments.filter((payment) => payment.status === 'SCHEDULED');
  const paidPreview = paidDesc.slice(0, PAID_VISIBLE_IN_PENDING);
  const paidRest = paidDesc.slice(PAID_VISIBLE_IN_PENDING);

  return (
    <ResponsiveOverlay
      open={open}
      onOpenChange={onOpenChange}
      title="Detalle del préstamo"
      description={
        loan
          ? `${loan.name}: ${loan.lender}, ${TYPE_LABEL[loan.type]}, ${FREQUENCY_LABEL[loan.frequency]}`
          : 'Detalle del préstamo'
      }
      dismissLabel="Cerrar"
      busy={busy}
      contentClassName="sm:max-w-xl sm:max-h-[min(92dvh,46rem)] sm:overflow-y-auto"
    >
      {() => {
        if (!loan) return null;
        const pct = progressPct(loan.paidPayments, loan.paymentCount);
        const firstDue = payments[0]?.dueDate ?? loan.startDate;
        const endYmd = getLoanEndYmd(loan);
        const isPayroll = loan.paymentSource === 'PAYROLL_DEDUCTION';
        const health = loan.status === 'ACTIVE' ? getLoanHealth(loan, todayYmd) : STATUS_HEALTH[loan.status];
        const sourceLine = isPayroll
          ? loan.incomeTemplateName
            ? `${PAYROLL_DEDUCTION_COPY} · ${loan.incomeTemplateName}`
            : PAYROLL_DEDUCTION_COPY
          : loan.sourceWalletName
            ? `desde ${loan.sourceWalletName}`
            : 'desde una billetera';
        const canLifecycle = loan.status === 'ACTIVE' || loan.status === 'PAUSED';

        return (
          <div className="space-y-4 pb-2">
            {/* Header: one SectionHeader-style block; Editar visible, the rest in ⋯ */}
            <div className="flex min-w-0 items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-2.5">
                <LenderIcon
                  name={loan.lender}
                  providerIconKey={lenderProviderIconKey}
                  className="size-9 rounded-xl"
                  iconClassName="size-4"
                />
                <div className="min-w-0">
                  <h3 className="text-section break-words text-foreground">{loan.name}</h3>
                  <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-caption text-muted-foreground">
                    <span>
                      {loan.lender} · {TYPE_LABEL[loan.type]} · {FREQUENCY_LABEL[loan.frequency]}
                    </span>
                    <LoanHealthBadge
                      health={health}
                      label={
                        loan.status === 'ACTIVE' && health !== 'overdue' && health !== 'soon'
                          ? STATUS_LABEL[loan.status]
                          : health === 'overdue'
                            ? 'Con atraso'
                            : undefined
                      }
                      className="h-5 px-1.5"
                    />
                  </p>
                  <p className="mt-1 text-caption text-muted-foreground">
                    Inició{' '}
                    <b className="font-semibold text-foreground">{formatMonthYear(firstDue)}</b>
                    {endYmd ? (
                      <>
                        {' '}· termina{' '}
                        <b className="font-semibold text-foreground">{formatMonthYear(endYmd)}</b>
                      </>
                    ) : null}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="size-11 rounded-xl p-0 sm:h-8 sm:w-auto sm:px-3"
                      onClick={onEdit}
                      disabled={busy}
                      aria-label="Editar préstamo"
                    >
                      <Pencil className="size-3.5" aria-hidden />
                      <span className="hidden sm:inline">Editar</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className="sm:hidden">Editar</TooltipContent>
                </Tooltip>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-11 rounded-xl sm:size-8"
                      aria-label="Más acciones del préstamo"
                      disabled={busy}
                    >
                      <MoreHorizontal className="size-4" aria-hidden />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem onClick={onHistory}>
                      <History className="size-4" aria-hidden />
                      Historial
                    </DropdownMenuItem>
                    {loan.status === 'ACTIVE' ? (
                      <DropdownMenuItem onClick={() => onLifecycle('PAUSED')}>
                        <Pause className="size-4" aria-hidden />
                        Pausar
                      </DropdownMenuItem>
                    ) : null}
                    {loan.status === 'PAUSED' ? (
                      <DropdownMenuItem onClick={() => onLifecycle('ACTIVE')}>
                        <Play className="size-4" aria-hidden />
                        Reanudar
                      </DropdownMenuItem>
                    ) : null}
                    {canLifecycle ? (
                      <DropdownMenuItem onClick={() => onLifecycle('CANCELLED')}>
                        <CircleSlash className="size-4" aria-hidden />
                        Cancelar préstamo
                      </DropdownMenuItem>
                    ) : null}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" onClick={onDelete}>
                      <Trash2 className="size-4" aria-hidden />
                      Eliminar
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {lifecycleDraft ? (
              <section
                className={cn(PANEL_INSET_CLASS, 'space-y-3 p-3')}
                aria-label={lifecycleLabel(lifecycleDraft)}
              >
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {lifecycleLabel(lifecycleDraft)}
                  </p>
                  <p className="mt-1 text-caption text-muted-foreground">
                    {lifecycleDescription(lifecycleDraft)}
                  </p>
                </div>
                {lifecycleError ? <ErrorBanner>{lifecycleError}</ErrorBanner> : null}
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 sm:h-9"
                    onClick={onLifecycleCancel}
                    disabled={lifecycleSubmitting}
                  >
                    Volver
                  </Button>
                  <Button
                    type="button"
                    variant={lifecycleDraft === 'CANCELLED' ? 'destructive' : 'default'}
                    className="h-11 sm:h-9"
                    onClick={onLifecycleConfirm}
                    disabled={lifecycleSubmitting}
                  >
                    {lifecycleSubmitting ? 'Aplicando…' : 'Aplicar'}
                  </Button>
                </div>
              </section>
            ) : null}

            {/* Summary: ring + Saldo pendiente / Cuota */}
            <div className="flex items-center gap-4">
              <ProgressRing pct={pct} label={`${loan.paidPayments} de ${loan.paymentCount}`} />
              <div className="grid min-w-0 flex-1 grid-cols-1 gap-2.5 min-[30rem]:grid-cols-2">
                <InsetFigure
                  label="Saldo pendiente"
                  value={formatCurrency(loan.remainingAmount)}
                  detail={`de ${formatCurrency(loan.totalPayable)}`}
                />
                <InsetFigure
                  label="Cuota"
                  value={formatCurrency(loan.paymentAmount)}
                  detail={isPayroll ? 'se descuenta del ingreso' : sourceLine}
                />
              </div>
            </div>
            <p className="text-caption text-muted-foreground">
              Origen de pago:{' '}
              <span className="text-foreground">
                {isPayroll ? getLoanSourceLabel(loan) : loan.sourceWalletName ?? 'Billetera'}
              </span>
              {' · '}Billetera relacionada:{' '}
              <span className="text-foreground">
                {loan.linkedWalletName ?? 'sin cuenta vinculada'}
              </span>
              {loan.notes ? (
                <>
                  {' · '}
                  <span className="text-foreground/85">{loan.notes}</span>
                </>
              ) : null}
            </p>

            {overdue.length > 0 ? (
              <section
                aria-label="Cuotas vencidas"
                className={cn(
                  PANEL_INSET_CLASS,
                  'flex flex-col gap-3 border-destructive/40 p-3 sm:flex-row sm:items-center sm:justify-between dark:border-destructive/40',
                )}
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-destructive">
                    {plural(overdue.length, 'cuota vencida', 'cuotas vencidas')} ·{' '}
                    <span className="whitespace-nowrap tabular-nums">
                      {formatCurrency(overdueTotal)}
                    </span>
                  </p>
                  <p className="mt-0.5 text-caption text-muted-foreground">
                    {overdue
                      .slice(0, 3)
                      .map((payment) => formatDayMonth(payment.dueDate))
                      .join(' · ')}
                    {overdue.length > 3 ? '…' : ''}
                    {isPayroll ? ' · la nómina no las descontó' : ''}
                  </p>
                </div>
                <Button
                  type="button"
                  className="h-11 shrink-0 rounded-xl sm:h-9"
                  onClick={() => onRegisterOverdue(overdue)}
                  disabled={busy}
                >
                  Registrar pago
                </Button>
              </section>
            ) : null}

            {/* Calendar as rows */}
            <section aria-labelledby="loan-calendar-title" className="space-y-2">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                <h4
                  id="loan-calendar-title"
                  className="font-[family-name:var(--font-display)] text-sm font-bold text-foreground"
                >
                  Calendario de pagos
                </h4>
                <p className="text-caption text-muted-foreground">
                  <b className="font-semibold text-foreground">
                    {loan.paidPayments} de {loan.paymentCount}
                  </b>{' '}
                  cubiertas
                  {endYmd ? (
                    <span className="whitespace-nowrap">
                      {' '}· {formatMonthYear(firstDue)} → {formatMonthYear(endYmd)}
                    </span>
                  ) : null}
                </p>
              </div>

              {payments.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Este préstamo todavía no tiene pagos programados.
                </p>
              ) : (
                <>
                  <SegmentedControl
                    value={tab}
                    onValueChange={(value) => setTab(value as CalendarTab)}
                    ariaLabel="Cuotas por estado"
                    className="w-full min-w-0"
                    stretch
                    frameClassName="flex min-w-0 items-center"
                    wrapperClassName="min-w-0 w-full flex-1"
                    listClassName="min-w-full"
                    triggerClassName="px-2 sm:px-3"
                    indicatorClassName={AURA_TAB_INDICATOR_CLASS}
                    activeLabelClassName={GLASS_TAB_ACTIVE_LABEL_CLASS}
                    overflowControls="fade"
                    options={tabOptions.map((option) => ({
                      value: option.value,
                      ariaLabel: `${option.label}, ${counts[option.value]}`,
                      label: (
                        <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                          {option.label}
                          <Badge
                            variant={tab === option.value ? 'default' : 'secondary'}
                            className="pointer-events-none h-4 min-w-4 justify-center rounded-full border-0 px-1 font-sans text-xs font-semibold tabular-nums shadow-none"
                            aria-hidden
                          >
                            {counts[option.value]}
                          </Badge>
                        </span>
                      ),
                    }))}
                  />
                  {tab === 'SCHEDULED' ? (
                    <div>
                      <ul role="list">
                        {pendingRows.map((payment) => renderRow(payment))}
                        {paidPreview.map((payment) => renderRow(payment, true))}
                        {showAllPaid ? paidRest.map((payment) => renderRow(payment, true)) : null}
                      </ul>
                      {pendingRows.length === 0 && paidPreview.length === 0 ? (
                        <p className="py-4 text-center text-caption text-muted-foreground">
                          Sin cuotas por pagar.
                        </p>
                      ) : null}
                      {paidRest.length > 0 ? (
                        <button
                          type="button"
                          onClick={() => setShowAllPaid((value) => !value)}
                          aria-expanded={showAllPaid}
                          className="flex min-h-11 w-full items-center justify-between border-t border-border/60 px-0.5 text-xs font-medium text-muted-foreground hover:text-foreground dark:border-white/[0.06]"
                        >
                          <span>
                            {showAllPaid
                              ? 'Ocultar pagadas'
                              : `Mostrar ${plural(paidRest.length, 'pagada más', 'pagadas más')}`}
                          </span>
                          <ChevronDown
                            aria-hidden
                            className={cn('size-4 transition-transform', showAllPaid && 'rotate-180')}
                          />
                        </button>
                      ) : null}
                    </div>
                  ) : (
                    <ul role="list">
                      {(tab === 'PAID'
                        ? paidDesc
                        : payments.filter((payment) => payment.status === tab)
                      ).map((payment) => renderRow(payment))}
                      {counts[tab] === 0 ? (
                        <li className="py-4 text-center text-caption text-muted-foreground">
                          Sin cuotas en este estado.
                        </li>
                      ) : null}
                    </ul>
                  )}
                </>
              )}
            </section>
          </div>
        );
      }}
    </ResponsiveOverlay>
  );
};
