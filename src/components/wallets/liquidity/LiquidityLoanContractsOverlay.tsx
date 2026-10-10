'use client';

import Link from 'next/link';
import { Briefcase, ChevronRight, FileText } from 'lucide-react';
import { ResponsiveOverlay } from '@/components/overlay/responsive-overlay';
import {
  AmountDisplayRow,
  GroupedRow,
  OVERLAY_GROUPED_CARD_CLASS,
  OVERLAY_PRIMARY_BUTTON_CLASS,
  OverlayHint,
  OverlaySectionLabel,
} from '@/components/overlay/overlay-form';
import { Button } from '@/components/ui/button';
import { formatDisplayDate, formatMonthPhrase } from '@/lib/calendar-dates';
import { formatShortMonthLabel } from '@/components/wallets/liquidity/liquidity-personalization';
import { formatCurrency } from '@/lib/utils';
import type { MonthDebtContract, MonthDebtItem } from '@/lib/finance/liquidity-month-debt-items';

type LiquidityLoanContractsOverlayProps = {
  /** Lender row whose contracts to show; null closes the overlay. */
  item: MonthDebtItem | null;
  /** Month the figures are computed for (YYYY-MM). */
  monthKey: string;
  onOpenChange: (open: boolean) => void;
};

const plural = (count: number, one: string, many: string): string =>
  `${count} ${count === 1 ? one : many}`;

const monthPhraseFromKey = (monthKey: string): string =>
  formatMonthPhrase(Number(monthKey.split('-')[1] ?? 1));

const contractDetail = (contract: MonthDebtContract): string =>
  [contract.is_payroll ? 'Nómina' : null, plural(contract.remaining_payments, 'pago', 'pagos')]
    .filter(Boolean)
    .join(' · ');

/** "$5,585.46 el 16 nov" when due this month, otherwise "siguiente 16 dic". */
const contractDue = (contract: MonthDebtContract): string | null => {
  const date = contract.next_due_date ? formatDisplayDate(contract.next_due_date) : null;
  if (contract.payment_amount > 0) {
    return date
      ? `${formatCurrency(contract.payment_amount)} el ${date}`
      : formatCurrency(contract.payment_amount);
  }
  return date ? `siguiente ${date}` : null;
};

/** Two-line row: name and balance on top, details and this month's payment below. */
const ContractRow = ({ contract }: { contract: MonthDebtContract }) => {
  const Icon = contract.is_payroll ? Briefcase : FileText;
  const due = contractDue(contract);
  return (
    <div className="flex min-h-11 items-center gap-3 px-3 py-2.5">
      <span
        className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"
        aria-hidden
      >
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="min-w-0 truncate text-sm font-medium text-foreground">{contract.name}</p>
          <p className="shrink-0 font-sans text-sm font-semibold tabular-nums text-foreground">
            {formatCurrency(contract.remaining)}
          </p>
        </div>
        <div className="mt-0.5 flex items-baseline justify-between gap-2 text-xs text-muted-foreground">
          <p className="min-w-0 truncate">{contractDetail(contract)}</p>
          {due ? <p className="shrink-0 font-sans tabular-nums">{due}</p> : null}
        </div>
      </div>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
    </div>
  );
};

/**
 * The contracts behind a lender row in Proyección. Dialog on desktop, sheet on
 * phones (`ResponsiveOverlay`); each contract opens in Préstamos.
 */
export const LiquidityLoanContractsOverlay = ({
  item,
  monthKey,
  onOpenChange,
}: LiquidityLoanContractsOverlayProps) => {
  const contracts = item?.contracts ?? [];
  const monthPhrase = monthPhraseFromKey(monthKey);
  const lender = item?.lender_name ?? item?.title ?? '';

  return (
    <ResponsiveOverlay
      open={item != null}
      onOpenChange={onOpenChange}
      title={item?.title ?? ''}
      description={`Contratos con ${lender} al cierre de ${monthPhrase}`}
      dismissLabel="Cerrar"
    >
      {item ? (
        <div className="flex flex-col gap-3">
          <OverlayHint role="status">
            {plural(contracts.length, 'contrato', 'contratos')} con {lender}. Cifras de{' '}
            {monthPhrase}.
          </OverlayHint>

          <div className={OVERLAY_GROUPED_CARD_CLASS}>
            <AmountDisplayRow label="Te falta pagar" value={item.amount} />
            <GroupedRow label={`En ${formatShortMonthLabel(monthKey)}`}>
              <p className="text-right font-sans text-sm font-semibold tabular-nums text-foreground">
                {formatCurrency(item.payment_amount ?? 0)}
              </p>
            </GroupedRow>
          </div>

          <OverlaySectionLabel>Contratos</OverlaySectionLabel>
          <ul className={OVERLAY_GROUPED_CARD_CLASS} role="list">
            {contracts.map((contract) => (
              <li key={contract.loan_id}>
                <Link
                  href={`/loans?loanId=${contract.loan_id}`}
                  className="block transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none"
                  aria-label={`Abrir ${contract.name} en Préstamos`}
                >
                  <ContractRow contract={contract} />
                </Link>
              </li>
            ))}
          </ul>
          <OverlayHint>Toca un contrato para abrirlo en Préstamos.</OverlayHint>

          <Button asChild variant="outline" className={OVERLAY_PRIMARY_BUTTON_CLASS}>
            <Link href="/loans">Ver todos en Préstamos</Link>
          </Button>
        </div>
      ) : null}
    </ResponsiveOverlay>
  );
};
