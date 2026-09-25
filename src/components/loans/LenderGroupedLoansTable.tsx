'use client';

import { useState, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react';
import { ChevronDown, HandCoins, Landmark, MoreHorizontal } from 'lucide-react';
import { LenderIdentity } from '@/components/loans/LenderIdentity';
import { MONTHLY_PANEL_SHELL_CLASS } from '@/components/monthly/monthly-panel-shell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { METRIC_STRIP_CLASS } from '@/components/ui/metric-strip';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  summarizeInstallmentCues,
  type InstallmentCue,
  type InstallmentCueSummary,
} from '@/lib/finance/loan-installment-cues';
import { todayCalendarDate } from '@/lib/calendar-dates';
import {
  PAYROLL_DEDUCTION_COPY,
  payrollCommitmentHint,
} from '@/lib/finance/lender-payroll';
import { cn, formatCurrency, formatDate } from '@/lib/utils';
import type { LenderListItem, LenderPaymentListItem } from '@/types/lenders';
import type { LoanListItem } from '@/types/loans';

type LenderGroupedLoansTableProps = {
  lenders: LenderListItem[];
  loans: LoanListItem[];
  onOpenLoan: (loanId: number) => void;
  onPayLender: (lenderId: number) => void;
  onUndoLastPayment: (lenderId: number, paymentId: number) => void;
  onMergeLender: (lenderId: number) => void;
  onSplitLender: (lenderId: number) => void;
};

const statusLabel = (status: LoanListItem['status']) => {
  if (status === 'PAID_OFF') return 'Pagado';
  if (status === 'PAUSED') return 'Pausado';
  if (status === 'CANCELLED') return 'Cancelado';
  return 'Activo';
};

const loanOriginShort = (loan: LoanListItem) => {
  if (loan.paymentSource === 'PAYROLL_DEDUCTION') {
    return loan.incomeTemplateName ?? 'Nómina';
  }
  return loan.sourceWalletName ?? 'Billetera';
};

const loanProgressPct = (loan: LoanListItem) => {
  if (loan.paymentCount <= 0) return 0;
  return Math.min(100, Math.max(0, (loan.paidPayments / loan.paymentCount) * 100));
};

const roundMoney = (value: number) => Math.round(value * 100) / 100;

const cueHint = (cue: InstallmentCue): string =>
  cue.isRange
    ? `${formatDate(cue.date)} – ${formatDate(cue.dateEnd)}`
    : formatDate(cue.date);

const loanDueCueLabel = (loan: LoanListItem): string => {
  const parts: string[] = [];
  if (loan.overduePayment) {
    parts.push(`Vencida ${formatDate(loan.overduePayment.dueDate)}`);
  }
  if (loan.nextPayment) {
    parts.push(formatDate(loan.nextPayment.dueDate));
  }
  return parts.length > 0 ? parts.join(' · ') : '—';
};

const cuesForLoans = (groupLoans: LoanListItem[]): InstallmentCueSummary => {
  const todayYmd = todayCalendarDate();
  const payments = groupLoans
    .filter((loan) => loan.status === 'ACTIVE')
    .flatMap((loan) =>
      (loan.payments ?? []).map((payment) => ({ ...payment, loanId: loan.id })),
    );
  if (payments.length > 0) {
    return summarizeInstallmentCues(payments, todayYmd, { perLoanNext: true });
  }
  const fallback = groupLoans
    .filter((loan) => loan.status === 'ACTIVE')
    .flatMap((loan) => {
      const rows = [];
      if (loan.overduePayment) rows.push({ ...loan.overduePayment, loanId: loan.id });
      if (loan.nextPayment) rows.push({ ...loan.nextPayment, loanId: loan.id });
      return rows;
    });
  return summarizeInstallmentCues(fallback, todayYmd, { perLoanNext: true });
};

const nextLine = (cues: InstallmentCueSummary, payroll: boolean): string => {
  const parts: string[] = [];
  if (cues.overdue) {
    parts.push(`Vencida ${formatCurrency(cues.overdue.amount)} · ${cueHint(cues.overdue)}`);
  }
  if (cues.next) {
    const hint = payroll
      ? payrollCommitmentHint(formatDate(cues.next.date))
      : cueHint(cues.next);
    parts.push(`Próx. ${formatCurrency(cues.next.amount)} · ${hint}`);
  }
  return parts.length > 0 ? parts.join(' · ') : 'Sin próximo pago';
};

const HeaderMetric = ({
  label,
  amount,
  hint,
  accentClassName,
}: {
  label: string;
  amount: string;
  hint?: string;
  accentClassName: string;
}) => (
  <div
    className={cn(
      METRIC_STRIP_CLASS,
      'flex h-full min-w-0 flex-col justify-between border-l-[3px] px-2.5 py-2',
      accentClassName,
    )}
  >
    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
      {label}
    </p>
    <p className="mt-1 font-mono text-sm font-bold tabular-nums leading-none text-foreground">
      {amount}
    </p>
    <p className="mt-1 min-h-[1rem] truncate text-[10px] leading-tight text-muted-foreground">
      {hint || '\u00a0'}
    </p>
  </div>
);

const loanIconClass = (isPayroll: boolean) =>
  cn(
    'flex h-5 w-5 shrink-0 items-center justify-center rounded-md ring-1',
    isPayroll
      ? 'bg-blue-500/15 text-blue-700 ring-blue-500/25 dark:text-blue-300'
      : 'bg-violet-500/15 text-violet-700 ring-violet-500/25 dark:text-violet-300',
  );

const InstitutionActions = ({
  name,
  canPay,
  onPay,
  onMerge,
  onSplit,
  compact,
}: {
  name: string;
  canPay: boolean;
  onPay?: () => void;
  onMerge?: () => void;
  onSplit?: () => void;
  compact?: boolean;
}) => (
  <div className="flex shrink-0 items-center gap-1">
    {canPay && onPay ? (
      <Button
        type="button"
        size="sm"
        className={cn('rounded-xl', compact ? 'h-10 px-3' : 'h-8')}
        onClick={onPay}
      >
        Pagar
      </Button>
    ) : null}
    {onMerge && onSplit ? (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn(compact ? 'h-10 w-10' : 'h-8 w-8')}
            aria-label={`Más acciones de ${name}`}
          >
            <MoreHorizontal className="h-4 w-4" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem onClick={onMerge}>
            Fusionar con otro
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onSplit}>
            Separar contratos
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ) : null}
    <Tooltip>
      <TooltipTrigger asChild>
        <CollapsibleTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn(
              'text-muted-foreground',
              compact ? 'h-10 w-10' : 'h-8 w-8',
            )}
            aria-label={`Mostrar u ocultar contratos de ${name}`}
          >
            <ChevronDown
              className="h-4 w-4 shrink-0 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-180"
              aria-hidden
            />
          </Button>
        </CollapsibleTrigger>
      </TooltipTrigger>
      <TooltipContent>Ver contratos</TooltipContent>
    </Tooltip>
  </div>
);

const InstitutionCard = ({
  name,
  providerIconKey,
  subtitle,
  remaining,
  cues,
  payroll,
  canPay,
  onPay,
  onMerge,
  onSplit,
  children,
}: {
  name: string;
  providerIconKey?: string | null;
  subtitle: string;
  remaining: number;
  cues: InstallmentCueSummary;
  payroll: boolean;
  canPay: boolean;
  onPay?: () => void;
  onMerge?: () => void;
  onSplit?: () => void;
  children: ReactNode;
}) => {
  const [open, setOpen] = useState(false);

  return (
    <article
      className={cn(
        MONTHLY_PANEL_SHELL_CLASS,
        'overflow-hidden px-4 py-3 sm:px-5 sm:py-3.5',
      )}
      aria-label={name}
    >
      <Collapsible
        open={open}
        onOpenChange={setOpen}
        className="group/collapsible"
      >
        <div className="md:hidden">
          <div className="flex items-start gap-2">
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="flex min-w-0 flex-1 items-start gap-2.5 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                aria-label={`${open ? 'Ocultar' : 'Mostrar'} contratos de ${name}`}
              >
                <LenderIdentity
                  name={name}
                  providerIconKey={providerIconKey}
                  subtitle={subtitle}
                  className="min-w-0 flex-1"
                  nameClassName="font-[family-name:var(--font-display)] text-sm"
                  iconClassName="h-9 w-9 rounded-xl"
                  iconInnerClassName="h-4 w-4"
                />
                <span className="shrink-0 pt-1 font-mono text-sm font-bold tabular-nums leading-none">
                  {formatCurrency(remaining)}
                </span>
              </button>
            </CollapsibleTrigger>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="min-w-0 flex-1 truncate text-left text-[11px] leading-tight text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                {nextLine(cues, payroll)}
              </button>
            </CollapsibleTrigger>
            <InstitutionActions
              name={name}
              canPay={canPay}
              onPay={onPay}
              onMerge={onMerge}
              onSplit={onSplit}
              compact
            />
          </div>
        </div>

        <div className="hidden grid-cols-[auto_minmax(0,1fr)_auto] items-stretch gap-x-4 md:grid">
          <LenderIdentity
            name={name}
            providerIconKey={providerIconKey}
            subtitle={subtitle}
            className="min-w-0 max-w-[16rem] self-center"
            nameClassName="font-[family-name:var(--font-display)] text-sm"
            iconClassName="h-9 w-9 rounded-xl"
            iconInnerClassName="h-4 w-4"
          />
          <div className="grid min-w-0 grid-cols-2 gap-2">
            <HeaderMetric
              label="Pendiente"
              amount={formatCurrency(remaining)}
              accentClassName="border-l-emerald-500/50"
            />
            <div className="flex min-w-0 flex-col gap-2">
              {cues.overdue ? (
                <HeaderMetric
                  label="Vencida"
                  amount={formatCurrency(cues.overdue.amount)}
                  hint={cueHint(cues.overdue)}
                  accentClassName="border-l-destructive/70"
                />
              ) : null}
              {cues.next ? (
                <HeaderMetric
                  label="Próximo"
                  amount={formatCurrency(cues.next.amount)}
                  hint={
                    payroll
                      ? payrollCommitmentHint(formatDate(cues.next.date))
                      : cueHint(cues.next)
                  }
                  accentClassName="border-l-amber-500/50"
                />
              ) : null}
              {!cues.overdue && !cues.next ? (
                <HeaderMetric
                  label="Próximo"
                  amount="—"
                  accentClassName="border-l-amber-500/50"
                />
              ) : null}
            </div>
          </div>
          <div className="flex items-center self-center">
            <InstitutionActions
              name={name}
              canPay={canPay}
              onPay={onPay}
              onMerge={onMerge}
              onSplit={onSplit}
            />
          </div>
        </div>

        <CollapsibleContent className="-mx-4 mt-3 border-t border-border/60 dark:border-white/[0.08] sm:-mx-5">
          <div className="px-4 py-3 sm:px-5">{children}</div>
        </CollapsibleContent>
      </Collapsible>
    </article>
  );
};

export const LenderGroupedLoansTable = ({
  lenders,
  loans,
  onOpenLoan,
  onPayLender,
  onUndoLastPayment,
  onMergeLender,
  onSplitLender,
}: LenderGroupedLoansTableProps) => {
  const unassignedLoans = loans.filter((loan) => loan.lenderId == null);

  const handleOpenLoanFromRow = (
    event: MouseEvent<HTMLElement>,
    loanId: number,
  ) => {
    if (event.target instanceof Element && event.target.closest('button, a')) {
      return;
    }
    onOpenLoan(loanId);
  };

  const handleOpenLoanFromKey = (
    event: KeyboardEvent<HTMLElement>,
    loanId: number,
  ) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    onOpenLoan(loanId);
  };

  const renderMobileLoanRows = (groupLoans: LoanListItem[]) => (
    <ul className="divide-y divide-border/60 md:hidden" role="list">
      {groupLoans.map((loan) => {
        const isPayroll = loan.type === 'PAYROLL';
        const Icon = isPayroll ? Landmark : HandCoins;
        return (
          <li key={loan.id}>
            <div
              role="button"
              tabIndex={0}
              className={cn(
                'flex cursor-pointer items-start gap-2.5 py-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
                loan.status === 'PAUSED' && 'opacity-80',
                loan.status === 'CANCELLED' && 'opacity-70',
              )}
              onClick={(event) => handleOpenLoanFromRow(event, loan.id)}
              onKeyDown={(event) => handleOpenLoanFromKey(event, loan.id)}
              aria-label={`Ver detalle de ${loan.name}`}
            >
              <span className={cn('mt-0.5', loanIconClass(isPayroll))}>
                <Icon className="h-3 w-3" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="line-clamp-2 block text-sm font-medium leading-snug text-foreground">
                  {loan.name}
                </span>
                <span className="mt-0.5 block text-[11px] text-muted-foreground">
                  {loanOriginShort(loan)} · {loan.paidPayments}/{loan.paymentCount}
                </span>
              </span>
              <span className="shrink-0 text-right">
                <span className="block font-mono text-sm font-semibold tabular-nums">
                  {formatCurrency(loan.remainingAmount)}
                </span>
                <span className="mt-0.5 block text-[11px] text-muted-foreground">
                  {loanDueCueLabel(loan)}
                </span>
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );

  const renderLoanRows = (groupLoans: LoanListItem[]) =>
    groupLoans.map((loan) => {
      const isPayroll = loan.type === 'PAYROLL';
      const Icon = isPayroll ? Landmark : HandCoins;
      const progressPct = loanProgressPct(loan);
      return (
        <TableRow
          key={loan.id}
          className={cn(
            'cursor-pointer hover:bg-muted/40',
            loan.status === 'PAUSED' && 'bg-muted/30',
            loan.status === 'CANCELLED' && 'bg-muted/40 opacity-80',
          )}
          onClick={(event) => handleOpenLoanFromRow(event, loan.id)}
        >
          <TableCell className="min-w-[12rem] whitespace-normal">
            <span className="flex items-start gap-2">
              <span className={cn('mt-0.5', loanIconClass(isPayroll))}>
                <Icon className="h-3 w-3" aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="line-clamp-2 block font-medium leading-snug text-foreground">
                  {loan.name}
                </span>
                <span className="mt-0.5 block text-[11px] text-muted-foreground">
                  {loanOriginShort(loan)}
                </span>
              </span>
            </span>
          </TableCell>
          <TableCell>
            <Badge
              variant={loan.status === 'ACTIVE' ? 'default' : 'secondary'}
              className="h-5 text-[10px]"
            >
              {statusLabel(loan.status)}
            </Badge>
          </TableCell>
          <TableCell>
            <div className="w-[4.75rem]">
              <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-muted/50">
                <div
                  className="h-full rounded-full bg-emerald-500 dark:bg-emerald-400"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <p className="mt-1 font-mono text-[10px] tabular-nums text-muted-foreground">
                {loan.paidPayments}/{loan.paymentCount}
              </p>
            </div>
          </TableCell>
          <TableCell className="text-right">
            <span className="font-mono text-sm font-semibold tabular-nums">
              {formatCurrency(loan.remainingAmount)}
            </span>
          </TableCell>
          <TableCell className="whitespace-normal text-xs">
            {loanDueCueLabel(loan)}
          </TableCell>
          <TableCell className="text-right">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-[11px]"
              onClick={() => onOpenLoan(loan.id)}
              aria-label={`Ver detalle de ${loan.name}`}
            >
              Detalle
            </Button>
          </TableCell>
        </TableRow>
      );
    });

  const renderContracts = (
    groupLoans: LoanListItem[],
    lastPayment?: LenderPaymentListItem,
    onUndo?: () => void,
  ) => (
    <>
      {groupLoans.length > 0 ? (
        <>
          {renderMobileLoanRows(groupLoans)}
          <div className="hidden md:block">
            <ContractTable>{renderLoanRows(groupLoans)}</ContractTable>
          </div>
        </>
      ) : (
        <p className="text-xs text-muted-foreground">
          Sin contratos en este filtro.
        </p>
      )}
      {lastPayment && onUndo ? (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[10px] text-muted-foreground">
          <span>
            Último {formatDate(lastPayment.paidAt)} ·{' '}
            {formatCurrency(lastPayment.amount)}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-[11px]"
            onClick={onUndo}
          >
            Deshacer
          </Button>
        </div>
      ) : null}
    </>
  );

  return (
    <div className="space-y-3 md:space-y-4">
      {unassignedLoans.length > 0 ? (
        <InstitutionCard
          name="Sin prestamista"
          subtitle={`${unassignedLoans.length} contrato${
            unassignedLoans.length === 1 ? '' : 's'
          }`}
          remaining={roundMoney(
            unassignedLoans.reduce((sum, loan) => sum + loan.remainingAmount, 0),
          )}
          cues={cuesForLoans(unassignedLoans)}
          payroll={false}
          canPay={false}
        >
          {renderContracts(unassignedLoans)}
        </InstitutionCard>
      ) : null}

      {lenders.map((lender) => {
        const lenderLoans = loans.filter((loan) => loan.lenderId === lender.id);
        const remaining = roundMoney(
          lenderLoans.reduce((sum, loan) => sum + loan.remainingAmount, 0),
        );
        const cues = cuesForLoans(lenderLoans);
        const payrollOnly =
          lender.payrollOnly ||
          (lenderLoans.length > 0 &&
            lenderLoans.every((loan) => loan.paymentSource === 'PAYROLL_DEDUCTION'));
        const canPay = lender.payWindow.canPay && !lender.payrollOnly;
        const lastPayment = lender.recentPayments?.[0];
        const contractLabel = `${lenderLoans.length} contrato${
          lenderLoans.length === 1 ? '' : 's'
        }`;
        const subtitle = payrollOnly
          ? `${contractLabel} · ${PAYROLL_DEDUCTION_COPY}`
          : contractLabel;

        return (
          <InstitutionCard
            key={lender.id}
            name={lender.name}
            providerIconKey={lender.providerIconKey}
            subtitle={subtitle}
            remaining={remaining}
            cues={cues}
            payroll={payrollOnly}
            canPay={canPay}
            onPay={() => onPayLender(lender.id)}
            onMerge={() => onMergeLender(lender.id)}
            onSplit={() => onSplitLender(lender.id)}
          >
            {renderContracts(
              lenderLoans,
              lastPayment,
              lastPayment
                ? () => onUndoLastPayment(lender.id, lastPayment.id)
                : undefined,
            )}
          </InstitutionCard>
        );
      })}
    </div>
  );
};

const ContractTable = ({ children }: { children: ReactNode }) => (
  <Table className="min-w-[38rem]">
    <TableHeader>
      <TableRow className="hover:bg-transparent">
        <TableHead>Contrato</TableHead>
        <TableHead>Estado</TableHead>
        <TableHead>Progreso</TableHead>
        <TableHead className="text-right">Pendiente</TableHead>
        <TableHead>Vence</TableHead>
        <TableHead className="text-right">
          <span className="sr-only">Acciones</span>
        </TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>{children}</TableBody>
  </Table>
);
