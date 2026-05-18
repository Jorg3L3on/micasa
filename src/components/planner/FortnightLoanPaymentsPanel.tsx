'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { HandCoins, Landmark, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import type { LoanDuePaymentItem } from '@/types/loans';
import { cn, formatCurrency, formatDate } from '@/lib/utils';
import { updateLoanPaymentStatus } from '@/lib/api/loans';
import { useFinanceContext } from '@/context/finance-context';
import { useHydrationSafeTodayYmd } from '@/hooks/use-hydration-safe-today-ymd';

type FortnightLoanPaymentsPanelProps = {
  items: LoanDuePaymentItem[];
  ownerQueryString: string;
  fortnightLabel: string;
  isCompact?: boolean;
  onPaymentUpdated?: () => void;
};

const getStatusLabel = (status: LoanDuePaymentItem['status']) => {
  if (status === 'PAID') return 'Pagado';
  if (status === 'SKIPPED') return 'Omitido';
  if (status === 'CANCELLED') return 'Cancelado';
  return 'Por pagar';
};

const getVisualStatus = (item: LoanDuePaymentItem, todayYmd: string) => {
  if (item.status === 'PAID') return 'paid';
  if (item.status === 'CANCELLED' || item.status === 'SKIPPED') return 'muted';
  if (item.dueDate < todayYmd) return 'overdue';
  return 'pending';
};

export default function FortnightLoanPaymentsPanel({
  items,
  ownerQueryString,
  fortnightLabel,
  isCompact = false,
  onPaymentUpdated,
}: FortnightLoanPaymentsPanelProps) {
  const { context } = useFinanceContext();
  const todayYmd = useHydrationSafeTodayYmd();
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const rows = useMemo(
    () =>
      [...items].sort((a, b) => {
        const statusOrder = (item: LoanDuePaymentItem) => {
          const visual = getVisualStatus(item, todayYmd);
          if (visual === 'overdue') return 0;
          if (visual === 'pending') return 1;
          if (visual === 'paid') return 2;
          return 3;
        };
        const byStatus = statusOrder(a) - statusOrder(b);
        if (byStatus !== 0) return byStatus;
        return a.dueDate.localeCompare(b.dueDate);
      }),
    [items, todayYmd],
  );

  const handleMarkPaid = async (item: LoanDuePaymentItem) => {
    setUpdatingId(item.id);
    try {
      await updateLoanPaymentStatus(
        item.id,
        {
          status: 'PAID',
          paidAt: item.dueDate,
          sourceWalletId: item.sourceWalletId,
        },
        context,
      );
      toast.success('Pago de prestamo marcado como pagado');
      onPaymentUpdated?.();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'No se pudo actualizar el pago',
      );
    } finally {
      setUpdatingId(null);
    }
  };

  if (rows.length === 0) {
    return (
      <div
        className={cn(
          'rounded-xl border border-border/40 bg-card px-4 py-8 text-center shadow-sm',
          isCompact ? 'text-xs' : 'text-sm',
        )}
        role="region"
        aria-label={`Prestamos: ${fortnightLabel}`}
      >
        <p className="text-muted-foreground">
          No hay pagos de prestamos en esta quincena.
        </p>
      </div>
    );
  }

  return (
    <div
      role="region"
      aria-label={`Prestamos: ${fortnightLabel}`}
      className="px-1 pb-1"
    >
      <ul role="list" className="flex flex-col gap-1.5">
        {rows.map((item) => {
          const visual = getVisualStatus(item, todayYmd);
          const Icon =
            item.paymentSource === 'PAYROLL_DEDUCTION' ? Landmark : HandCoins;
          return (
            <li
              key={item.id}
              className={cn(
                'group/row relative flex items-center gap-2.5 overflow-hidden rounded-xl border border-l-[3px] px-3 transition-all',
                isCompact ? 'py-2.5' : 'py-3',
                visual === 'overdue' &&
                  'border-destructive/25 border-l-destructive bg-gradient-to-br from-destructive/10 via-card to-destructive/3',
                visual === 'pending' &&
                  'border-amber-500/25 border-l-amber-500/70 bg-gradient-to-br from-amber-500/8 via-card to-amber-500/2',
                visual === 'paid' &&
                  'border-emerald-500/20 border-l-emerald-500/60 bg-gradient-to-br from-emerald-500/6 via-card to-emerald-500/2',
                visual === 'muted' &&
                  'border-border/50 border-l-muted-foreground/40 bg-card',
              )}
            >
              <span
                className={cn(
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl shadow-sm ring-1',
                  visual === 'paid'
                    ? 'bg-emerald-500/10 text-emerald-600 ring-emerald-500/30 dark:text-emerald-300'
                    : visual === 'overdue'
                      ? 'bg-destructive/10 text-destructive ring-destructive/30'
                      : 'bg-sky-500/10 text-sky-600 ring-sky-500/30 dark:text-sky-300',
                )}
              >
                <Icon className="h-4 w-4" aria-hidden />
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-1.5">
                  <Link
                    href={`/loans${ownerQueryString}`}
                    className={cn(
                      'truncate font-semibold hover:underline',
                      isCompact ? 'text-xs' : 'text-sm',
                    )}
                  >
                    {item.loanName}
                  </Link>
                  <span
                    className={cn(
                      'inline-flex h-4 shrink-0 items-center rounded-full border px-1.5 text-[9px] font-bold uppercase tracking-wider',
                      visual === 'paid' &&
                        'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
                      visual === 'overdue' &&
                        'border-destructive/40 bg-destructive/10 text-destructive',
                      visual === 'pending' &&
                        'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300',
                      visual === 'muted' &&
                        'border-border/60 bg-muted/40 text-muted-foreground',
                    )}
                  >
                    {visual === 'overdue'
                      ? 'Vencido'
                      : getStatusLabel(item.status)}
                  </span>
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10px] text-muted-foreground">
                  <span>{item.lender}</span>
                  <span className="text-muted-foreground/30">·</span>
                  <span>{formatDate(item.dueDate)}</span>
                  <span className="text-muted-foreground/30">·</span>
                  <span>
                    {item.paymentSource === 'PAYROLL_DEDUCTION'
                      ? `Nomina${item.incomeTemplateName ? `: ${item.incomeTemplateName}` : ''}`
                      : item.sourceWalletName ?? 'Billetera'}
                  </span>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <span className="font-mono text-sm font-bold tabular-nums">
                  {formatCurrency(item.amount)}
                </span>
                {item.status === 'SCHEDULED' ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-[10px]"
                    disabled={updatingId === item.id}
                    onClick={() => void handleMarkPaid(item)}
                  >
                    {updatingId === item.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                    ) : (
                      'Pagar'
                    )}
                  </Button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
