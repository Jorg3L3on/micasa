'use client';

import type { MouseEvent, ReactNode } from 'react';
import { ChevronDown, HandCoins, Landmark } from 'lucide-react';
import { LenderIdentity } from '@/components/loans/LenderIdentity';
import { MONTHLY_PANEL_SHELL_CLASS } from '@/components/monthly/monthly-panel-shell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { lenderNextCommitment } from '@/lib/finance/lender-next-commitment';
import { cn, formatCurrency, formatDate } from '@/lib/utils';
import type { LenderListItem } from '@/types/lenders';
import type { LoanListItem } from '@/types/loans';

type LenderGroupedLoansTableProps = {
  lenders: LenderListItem[];
  loans: LoanListItem[];
  onOpenLoan: (loanId: number) => void;
  onPayLender: (lenderId: number) => void;
  onUndoLastPayment: (lenderId: number, paymentId: number) => void;
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

const nextHint = (next: ReturnType<typeof lenderNextCommitment>): string => {
  if (next.kind === 'none') return '';
  if (next.kind === 'payroll') {
    return next.date
      ? `Nómina · ${formatDate(next.date)}`
      : 'Se descuenta del ingreso';
  }
  if (next.isRange) return 'Varios vencimientos';
  return next.date ? formatDate(next.date) : '';
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

const InstitutionActions = ({
  name,
  canPay,
  onPay,
}: {
  name: string;
  canPay: boolean;
  onPay?: () => void;
}) => (
  <div className="flex shrink-0 items-center gap-1.5">
    {canPay && onPay ? (
      <Button
        type="button"
        size="sm"
        className="h-8 rounded-xl"
        onClick={onPay}
      >
        Pagar
      </Button>
    ) : null}
    <Tooltip>
      <TooltipTrigger asChild>
        <CollapsibleTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground"
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
  next,
  canPay,
  onPay,
  children,
}: {
  name: string;
  providerIconKey?: string | null;
  subtitle: string;
  remaining: number;
  next: ReturnType<typeof lenderNextCommitment>;
  canPay: boolean;
  onPay?: () => void;
  children: ReactNode;
}) => (
  <article
    className={cn(
      MONTHLY_PANEL_SHELL_CLASS,
      'overflow-hidden px-4 py-3 sm:px-5 sm:py-3.5',
    )}
    aria-label={name}
  >
    <Collapsible defaultOpen={false} className="group/collapsible">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-3 lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:items-stretch lg:gap-x-4">
        <LenderIdentity
          name={name}
          providerIconKey={providerIconKey}
          subtitle={subtitle}
          className="min-w-0 max-w-[16rem] self-center"
          nameClassName="font-[family-name:var(--font-display)] text-sm"
          iconClassName="h-9 w-9 rounded-xl"
          iconInnerClassName="h-4 w-4"
        />
        <div className="col-span-2 grid grid-cols-2 gap-2 lg:col-span-1 lg:col-start-2 lg:row-start-1">
          <HeaderMetric
            label="Pendiente"
            amount={formatCurrency(remaining)}
            accentClassName="border-l-emerald-500/50"
          />
          <HeaderMetric
            label="Próximo"
            amount={next.kind === 'none' ? '—' : formatCurrency(next.amount)}
            hint={nextHint(next)}
            accentClassName="border-l-amber-500/50"
          />
        </div>
        <div className="col-start-2 row-start-1 flex items-center self-center lg:col-start-3">
          <InstitutionActions name={name} canPay={canPay} onPay={onPay} />
        </div>
      </div>
      <CollapsibleContent className="-mx-4 mt-3 border-t border-border/60 dark:border-white/[0.08] sm:-mx-5">
        <div className="px-4 py-3 sm:px-5">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  </article>
);

export const LenderGroupedLoansTable = ({
  lenders,
  loans,
  onOpenLoan,
  onPayLender,
  onUndoLastPayment,
}: LenderGroupedLoansTableProps) => {
  const unassignedLoans = loans.filter((loan) => loan.lenderId == null);

  const handleOpenLoanFromRow = (
    event: MouseEvent<HTMLTableRowElement>,
    loanId: number,
  ) => {
    if (event.target instanceof Element && event.target.closest('button, a')) {
      return;
    }
    onOpenLoan(loanId);
  };

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
              <span
                className={cn(
                  'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md ring-1',
                  isPayroll
                    ? 'bg-blue-500/15 text-blue-700 ring-blue-500/25 dark:text-blue-300'
                    : 'bg-violet-500/15 text-violet-700 ring-violet-500/25 dark:text-violet-300',
                )}
              >
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
          <TableCell>
            {loan.nextPayment ? formatDate(loan.nextPayment.dueDate) : '—'}
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

  return (
    <div className="space-y-4">
      {unassignedLoans.length > 0 ? (
        <InstitutionCard
          name="Sin prestamista"
          subtitle={`${unassignedLoans.length} contrato${
            unassignedLoans.length === 1 ? '' : 's'
          }`}
          remaining={roundMoney(
            unassignedLoans.reduce((sum, loan) => sum + loan.remainingAmount, 0),
          )}
          next={lenderNextCommitment(
            {
              amount: 0,
              commitmentDate: null,
              commitmentDateEnd: null,
              isRange: false,
              canPay: false,
            },
            unassignedLoans,
          )}
          canPay={false}
        >
          <ContractTable>{renderLoanRows(unassignedLoans)}</ContractTable>
        </InstitutionCard>
      ) : null}

      {lenders.map((lender) => {
        const lenderLoans = loans.filter((loan) => loan.lenderId === lender.id);
        const remaining = roundMoney(
          lenderLoans.reduce((sum, loan) => sum + loan.remainingAmount, 0),
        );
        const next = lenderNextCommitment(lender.payWindow, lenderLoans);
        const payrollOnly =
          lenderLoans.length > 0 &&
          lenderLoans.every(
            (loan) => loan.paymentSource === 'PAYROLL_DEDUCTION',
          );
        const canPay =
          lender.payWindow.canPay &&
          lenderLoans.some((loan) => loan.status === 'ACTIVE');
        const lastPayment = lender.recentPayments?.[0];
        const subtitle = `${lenderLoans.length} contrato${
          lenderLoans.length === 1 ? '' : 's'
        }${payrollOnly ? ' · Nómina' : ''}`;

        return (
          <InstitutionCard
            key={lender.id}
            name={lender.name}
            providerIconKey={lender.providerIconKey}
            subtitle={subtitle}
            remaining={remaining}
            next={next}
            canPay={canPay}
            onPay={() => onPayLender(lender.id)}
          >
            {lenderLoans.length > 0 ? (
              <ContractTable>{renderLoanRows(lenderLoans)}</ContractTable>
            ) : (
              <p className="text-xs text-muted-foreground">
                Sin contratos en este filtro.
              </p>
            )}
            {lastPayment ? (
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[10px] text-muted-foreground">
                <span>
                  Último pago {formatDate(lastPayment.paidAt)} ·{' '}
                  {formatCurrency(lastPayment.amount)}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-[10px]"
                  onClick={() => onUndoLastPayment(lender.id, lastPayment.id)}
                >
                  Deshacer último pago
                </Button>
              </div>
            ) : null}
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
        <TableHead>Próximo</TableHead>
        <TableHead className="text-right">
          <span className="sr-only">Acciones</span>
        </TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>{children}</TableBody>
  </Table>
);
