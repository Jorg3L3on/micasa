'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ArrowRight, HandCoins, Landmark, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { LoanDuePaymentItem } from '@/types/loans';
import type { LenderListItem } from '@/types/lenders';
import type { PaymentMethodOption } from '@/types/catalog';
import type { PayLenderInput } from '@/schemas/lender.schema';
import { groupDuePaymentsByLender } from '@/lib/finance/lender-payment-window';
import { cn, formatCurrency, formatDate } from '@/lib/utils';
import { useHydrationSafeTodayYmd } from '@/hooks/use-hydration-safe-today-ymd';
import {
  sortLoanDuePaymentRows,
  type PlannerListSortDir,
  type PlannerListSortMode,
} from '@/lib/finance/planner-list-sort';
import LenderPayDialog from '@/components/loans/LenderPayDialog';
import { LoanPaymentManageOverlay } from '@/components/loans/LoanPaymentManageOverlay';
import { useFinanceContext } from '@/context/finance-context';
import { getLender, payLender } from '@/lib/api/lenders';
import { getPaymentMethodOptions } from '@/lib/api/wallets';

type FortnightLoanPaymentsPanelProps = {
  items: LoanDuePaymentItem[];
  fortnightLabel: string;
  isCompact?: boolean;
  sortMode?: PlannerListSortMode;
  sortDir?: PlannerListSortDir;
  onUpdated?: () => Promise<void> | void;
};

type VisualStatus = 'paid' | 'overdue' | 'pending' | 'muted';

const getDaysLeft = (dueDateYmd: string, todayYmd: string): number => {
  const [dy, dm, dd] = dueDateYmd.split('-').map((n) => parseInt(n, 10));
  const [ty, tm, td] = todayYmd.split('-').map((n) => parseInt(n, 10));
  if ([dy, dm, dd, ty, tm, td].some((n) => Number.isNaN(n))) return 0;
  const due = Date.UTC(dy, dm - 1, dd);
  const today = Date.UTC(ty, tm - 1, td);
  return Math.round((due - today) / 86_400_000);
};

const getVisualStatus = (
  item: LoanDuePaymentItem,
  todayYmd: string,
): VisualStatus => {
  if (item.status === 'PAID') return 'paid';
  if (item.status === 'CANCELLED' || item.status === 'SKIPPED') return 'muted';
  if (item.dueDate < todayYmd) return 'overdue';
  return 'pending';
};

export default function FortnightLoanPaymentsPanel({
  items,
  fortnightLabel,
  isCompact = false,
  sortMode = 'amount',
  sortDir = 'desc',
  onUpdated,
}: FortnightLoanPaymentsPanelProps) {
  const todayYmd = useHydrationSafeTodayYmd();
  const { context } = useFinanceContext();
  const [managingItems, setManagingItems] = useState<LoanDuePaymentItem[]>(
    [],
  );
  const [manageOpen, setManageOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [payingLender, setPayingLender] = useState<LenderListItem | null>(null);
  const [fundingWallets, setFundingWallets] = useState<PaymentMethodOption[]>(
    [],
  );
  const [payLoadingLenderId, setPayLoadingLenderId] = useState<number | null>(
    null,
  );
  const [paySubmitting, setPaySubmitting] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

  const rows = useMemo(
    () => sortLoanDuePaymentRows(items, sortMode, sortDir, todayYmd),
    [items, sortMode, sortDir, todayYmd],
  );

  const groups = useMemo(() => groupDuePaymentsByLender(rows), [rows]);

  const handleOpenManage = (next: LoanDuePaymentItem | LoanDuePaymentItem[]) => {
    setManagingItems(Array.isArray(next) ? next : [next]);
    setManageOpen(true);
  };

  const handleOpenManageGroup = (groupItems: LoanDuePaymentItem[]) => {
    const scheduled = groupItems.filter((item) => item.status === 'SCHEDULED');
    handleOpenManage(scheduled.length > 0 ? scheduled : groupItems);
  };

  const handleOpenPay = (
    group: ReturnType<typeof groupDuePaymentsByLender<LoanDuePaymentItem>>[number],
  ) => {
    if (group.lenderId == null) {
      handleOpenManageGroup(group.items);
      return;
    }

    const scheduled = group.items.filter((item) => item.status === 'SCHEDULED');
    setPayingLender({
      id: group.lenderId,
      name: group.lenderName,
      providerIconKey: null,
      notes: null,
      active: true,
      remainingPrincipal: 0,
      activeContractCount: group.items.length,
      payrollOnly: false,
      payWindow: {
        amount: scheduled.reduce((sum, item) => sum + item.amount, 0),
        commitmentDate: group.dueDate,
        commitmentDateEnd: group.dueDateEnd,
        isRange: group.isRange,
        canPay: scheduled.length > 0,
        included: scheduled.map((item) => ({
          id: item.id,
          loanId: item.loanId,
          loanName: item.loanName,
          sequence: item.sequence,
          dueDate: item.dueDate,
          amount: item.amount,
        })),
      },
      loans: [],
    });
    setPayError(null);
    setPayOpen(true);
    setPayLoadingLenderId(group.lenderId);

    void Promise.all([
      getLender(group.lenderId, context),
      getPaymentMethodOptions(context),
    ])
      .then(([lender, wallets]) => {
        setPayingLender(lender);
        setFundingWallets(
          wallets.filter(
            (wallet) => wallet.type === 'CASH' || wallet.type === 'DEBIT_CARD',
          ),
        );
      })
      .catch((error) => {
        toast.error(
          error instanceof Error
            ? error.message
            : 'No se pudieron cargar las billeteras',
        );
      })
      .finally(() => {
        setPayLoadingLenderId(null);
      });
  };

  const handlePayLender = async (data: PayLenderInput) => {
    if (!payingLender) return;
    setPaySubmitting(true);
    setPayError(null);
    try {
      await payLender(payingLender.id, data, context);
      toast.success(
        data.mode === 'EXTERNAL'
          ? `Registraste el pago a ${payingLender.name}`
          : `Pagaste a ${payingLender.name}`,
      );
      setPayOpen(false);
      if (onUpdated) await onUpdated();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'No se pudo registrar el pago';
      setPayError(message);
    } finally {
      setPaySubmitting(false);
    }
  };

  if (groups.length === 0) {
    return (
      <div
        className={cn(
          'rounded-xl border border-border/40 bg-card px-4 py-8 text-center shadow-sm',
          isCompact ? 'text-xs' : 'text-sm',
        )}
        role="region"
        aria-label={`Préstamos: ${fortnightLabel}`}
      >
        <p className="text-muted-foreground">
          No hay pagos de préstamos en esta quincena.
        </p>
      </div>
    );
  }

  return (
    <div
      role="region"
      aria-label={`Préstamos: ${fortnightLabel}`}
      className="px-1 pb-1"
    >
      <ul role="list" className="flex flex-col gap-1.5">
        {groups.map((group) => {
          const visual = group.items.reduce<VisualStatus>((current, item) => {
            const next = getVisualStatus(item, todayYmd);
            if (next === 'overdue' || current === 'overdue') return 'overdue';
            if (next === 'pending' || current === 'pending') return 'pending';
            if (next === 'paid') return current === 'muted' ? 'paid' : next;
            return current;
          }, 'muted');
          const daysLeft = getDaysLeft(group.dueDate, todayYmd);
          const isPayroll = group.paymentSource === 'PAYROLL_DEDUCTION';
          const Icon = isPayroll ? Landmark : HandCoins;
          const isDueSoon = visual === 'pending' && daysLeft <= 7;
          const isDueLater = visual === 'pending' && daysLeft > 7;
          const canPay =
            !isPayroll &&
            group.items.some((item) => item.status === 'SCHEDULED');
          const scheduledItems = group.items.filter(
            (item) => item.status === 'SCHEDULED',
          );
          const firstScheduled = scheduledItems[0] ?? group.items[0]!;
          const isPayLoading =
            group.lenderId != null && payLoadingLenderId === group.lenderId;

          return (
            <li
              key={group.key}
              className={cn(
                'group/row relative overflow-hidden rounded-xl border px-3 transition-all',
                'before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent dark:before:via-white/5',
                isCompact ? 'py-2.5' : 'py-3',
                visual === 'overdue' &&
                  'border-destructive/25 bg-gradient-to-br from-destructive/10 via-card to-destructive/3 dark:from-destructive/18 dark:via-card/60 dark:to-destructive/5',
                isDueSoon &&
                  'border-amber-500/25 bg-gradient-to-br from-amber-500/8 via-card to-amber-500/2 hover:from-amber-500/12 dark:from-amber-500/14 dark:via-card/60 dark:to-amber-500/4',
                isDueLater &&
                  'border-blue-500/25 bg-gradient-to-br from-blue-500/8 via-card to-blue-500/2 hover:from-blue-500/12 dark:from-blue-500/14 dark:via-card/60 dark:to-blue-500/4',
                visual === 'paid' &&
                  'border-emerald-500/20 bg-gradient-to-br from-emerald-500/6 via-card to-emerald-500/2 dark:from-emerald-500/12 dark:via-card/60 dark:to-emerald-500/3',
                visual === 'muted' && 'border-border/50 bg-muted/20 opacity-80',
              )}
            >
              <div className="flex items-center gap-2.5">
                <span
                  className={cn(
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl shadow-sm ring-1',
                    visual === 'paid'
                      ? 'bg-gradient-to-br from-emerald-500/25 to-emerald-600/10 ring-emerald-500/30 dark:from-emerald-400/25 dark:to-emerald-500/10'
                      : visual === 'overdue'
                        ? 'bg-gradient-to-br from-destructive/25 to-destructive/10 ring-destructive/30'
                        : visual === 'muted'
                          ? 'bg-muted/40 ring-border/40'
                          : isDueSoon
                            ? 'bg-gradient-to-br from-amber-500/25 to-amber-600/10 ring-amber-500/30 dark:from-amber-400/25 dark:to-amber-500/10'
                            : 'bg-gradient-to-br from-blue-500/25 to-blue-600/10 ring-blue-500/30 dark:from-blue-400/25 dark:to-blue-500/10',
                  )}
                >
                  <Icon
                    className={cn(
                      'h-4 w-4',
                      visual === 'paid'
                        ? 'text-emerald-600 dark:text-emerald-300'
                        : visual === 'overdue'
                          ? 'text-destructive'
                          : visual === 'muted'
                            ? 'text-muted-foreground'
                            : isDueSoon
                              ? 'text-amber-600 dark:text-amber-300'
                              : 'text-blue-600 dark:text-blue-300',
                    )}
                    aria-hidden
                  />
                </span>

                <div className="min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={() => handleOpenManageGroup(group.items)}
                    className={cn(
                      'block min-w-0 truncate text-left font-semibold hover:underline',
                      isCompact ? 'text-xs' : 'text-sm',
                      visual === 'paid' || visual === 'muted'
                        ? 'text-muted-foreground'
                        : 'text-foreground',
                    )}
                  >
                    {isPayroll
                      ? `Nómina · ${group.lenderName}`
                      : `Pagar a ${group.lenderName}`}
                  </button>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10px] text-muted-foreground">
                    <span>
                      {group.items.length} contrato
                      {group.items.length === 1 ? '' : 's'}
                    </span>
                    <span className="text-muted-foreground/30">·</span>
                    <span>
                      {group.isRange
                        ? `${formatDate(group.dueDate)} – ${formatDate(group.dueDateEnd)}`
                        : formatDate(group.dueDate)}
                    </span>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <span className="font-mono text-sm font-bold tabular-nums">
                    {formatCurrency(group.amount)}
                  </span>
                  {canPay ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 gap-1 px-2 text-[10px]"
                      onClick={() => handleOpenPay(group)}
                      disabled={isPayLoading || paySubmitting}
                      aria-label={`Pagar a ${group.lenderName}`}
                    >
                      {isPayLoading ? (
                        <Loader2
                          className="h-3 w-3 animate-spin"
                          aria-hidden
                          data-icon="inline-start"
                        />
                      ) : (
                        <ArrowRight className="h-3 w-3" aria-hidden />
                      )}
                      Pagar
                    </Button>
                  ) : scheduledItems.length > 0 ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 gap-1 px-2 text-[10px]"
                      onClick={() => handleOpenManage(scheduledItems)}
                      aria-label={
                        scheduledItems.length > 1
                          ? `Gestionar ${group.lenderName}`
                          : `Gestionar ${firstScheduled.loanName}`
                      }
                    >
                      <ArrowRight className="h-3 w-3" aria-hidden />
                      Gestionar
                    </Button>
                  ) : null}
                </div>
              </div>

              {group.items.length > 1 ? (
                <ul className="mt-2 space-y-1 border-t border-border/40 pt-2">
                  {group.items.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground"
                    >
                      <button
                        type="button"
                        onClick={() => handleOpenManage(item)}
                        className="min-w-0 truncate text-left hover:underline"
                      >
                        {item.loanName}
                      </button>
                      <span className="flex shrink-0 items-center gap-2">
                        <span className="font-mono tabular-nums">
                          {formatCurrency(item.amount)}
                        </span>
                        {item.status === 'SCHEDULED' ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-6 px-1.5 text-[10px]"
                            onClick={() => handleOpenManage(item)}
                            aria-label={`Gestionar ${item.loanName}`}
                          >
                            Gestionar
                          </Button>
                        ) : null}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ul>
      <LoanPaymentManageOverlay
        open={manageOpen}
        onOpenChange={setManageOpen}
        items={managingItems}
        onSuccess={onUpdated}
      />
      <LenderPayDialog
        open={payOpen}
        onOpenChange={(open) => {
          setPayOpen(open);
          if (!open) setPayError(null);
        }}
        lender={payingLender}
        fundingWalletOptions={fundingWallets}
        submitting={paySubmitting}
        error={payError}
        onConfirm={handlePayLender}
      />
    </div>
  );
}
