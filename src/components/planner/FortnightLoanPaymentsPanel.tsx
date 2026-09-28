'use client';

import EmptyState from '@/components/EmptyState';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ArrowRight, HandCoins, Landmark } from 'lucide-react';
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
import { AuraRowBloom } from '@/components/aura/aura-surface';
import { MONTHLY_PANEL_SHELL_CLASS } from '@/components/monthly/monthly-panel-shell';
import {
  AURA_TONE_HEX,
  getDueRowTone,
  type DueRowStatus,
} from '@/lib/ui/aura-palette';

type FortnightLoanPaymentsPanelProps = {
  items: LoanDuePaymentItem[];
  fortnightLabel: string;
  isCompact?: boolean;
  sortMode?: PlannerListSortMode;
  sortDir?: PlannerListSortDir;
  onUpdated?: () => Promise<void> | void;
};

type VisualStatus = Exclude<DueRowStatus, 'missing'>;

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
      <EmptyState message="No hay pagos de préstamos en esta quincena." className="py-8" />
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
          const rowTone = getDueRowTone(visual, daysLeft);
          const scheduledItems = group.items.filter(
            (item) => item.status === 'SCHEDULED',
          );
          const canPay = scheduledItems.length > 0;
          const firstScheduled = scheduledItems[0] ?? group.items[0]!;
          const isPayLoading =
            group.lenderId != null && payLoadingLenderId === group.lenderId;

          return (
            <li
              key={group.key}
              className={cn(
                MONTHLY_PANEL_SHELL_CLASS,
                'group/row overflow-hidden rounded-xl px-3',
                isCompact ? 'py-2.5' : 'py-3',
                visual === 'muted' && 'opacity-80',
              )}
            >
              {rowTone ? (
                <AuraRowBloom
                  color={AURA_TONE_HEX[rowTone]}
                  subdued={visual === 'paid'}
                />
              ) : null}
              <div className="flex items-center gap-2.5">
                <span
                  className={cn(
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl shadow-sm ring-1',
                    visual === 'paid'
                      ? 'bg-gradient-to-br from-status-income/25 to-status-income/10 ring-status-income/30 dark:from-status-income/25 dark:to-status-income/10'
                      : visual === 'overdue'
                        ? 'bg-gradient-to-br from-destructive/25 to-destructive/10 ring-destructive/30'
                        : visual === 'muted'
                          ? 'bg-muted/40 ring-border/40'
                          : isDueSoon
                            ? 'bg-gradient-to-br from-status-pending/25 to-status-pending/10 ring-status-pending/30 dark:from-status-pending/25 dark:to-status-pending/10'
                            : 'bg-gradient-to-br from-status-info/25 to-status-info/10 ring-status-info/30 dark:from-status-info/25 dark:to-status-info/10',
                  )}
                >
                  <Icon
                    className={cn(
                      'h-4 w-4',
                      visual === 'paid'
                        ? 'text-status-income'
                        : visual === 'overdue'
                          ? 'text-destructive'
                          : visual === 'muted'
                            ? 'text-muted-foreground'
                            : isDueSoon
                              ? 'text-status-pending'
                              : 'text-status-info',
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
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-caption text-muted-foreground">
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
                  <span className="font-sans text-sm font-bold tabular-nums">
                    {formatCurrency(group.amount)}
                  </span>
                  {canPay ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 gap-1 px-2 text-caption"
                      onClick={() =>
                        isPayroll
                          ? handleOpenManageGroup(group.items)
                          : handleOpenPay(group)
                      }
                      disabled={isPayLoading || paySubmitting}
                      aria-label={
                        isPayroll
                          ? `Pagar nómina de ${group.lenderName}`
                          : `Pagar a ${group.lenderName}`
                      }
                    >
                      {isPayLoading ? null : (
                        <ArrowRight className="h-3 w-3" aria-hidden />
                      )}
                      {isPayLoading ? 'Guardando…' : 'Pagar'}
                    </Button>
                  ) : scheduledItems.length > 0 ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 gap-1 px-2 text-caption"
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
                      className="flex items-center justify-between gap-2 text-caption text-muted-foreground"
                    >
                      <button
                        type="button"
                        onClick={() => handleOpenManage(item)}
                        className="min-w-0 truncate text-left hover:underline"
                      >
                        {item.loanName}
                      </button>
                      <span className="flex shrink-0 items-center gap-2">
                        <span className="font-sans tabular-nums">
                          {formatCurrency(item.amount)}
                        </span>
                        {item.status === 'SCHEDULED' ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-6 px-1.5 text-caption"
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
