'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatCurrency, toDisplayAmount, cn } from '@/lib/utils';
import { useFinanceContext } from '@/context/finance-context';
import {
  deleteTransaction,
  updateExpenseAmount,
  updateExpensePaidStatus,
} from '@/lib/api/transactions';
import { MoreVertical, Pencil, Trash2, CheckCircle2 } from 'lucide-react';
import EditExpenseAmountDialog from '@/components/EditExpenseAmountDialog';
import { ExpenseAmountFormValues } from '@/schemas/expense.schema';
import ConfirmDeleteDialog from '@/components/ConfirmDeleteDialog';
import { CategoryIcon } from '@/components/categories/CategoryIcon';
import { WalletProviderIcon } from '@/components/wallets/WalletProviderIcon';

import type { TransactionRow, WalletListItem } from '@/types/catalog';
import { isCreditOrStoreCardWalletType } from '@/domain/payment-method';

/** Rows from combined transaction feeds use income ids that are not expense ids. */
const isExpenseTransactionRow = (row: TransactionRow) => row.type !== 'income';

const isCardChargeExpenseRow = (row: TransactionRow): boolean => {
  if (!isExpenseTransactionRow(row)) return false;
  return isCreditOrStoreCardWalletType(row.wallet_type);
};

const isPlanningCardPaymentRow = (row: TransactionRow): boolean =>
  row.planning_row_kind === 'card_payment';

const isPlanningLoanPaymentRow = (row: TransactionRow): boolean =>
  row.planning_row_kind === 'loan_payment';

const planningLoanPaymentBadgeLabel = (row: TransactionRow): string =>
  row.loan_payment_source === 'PAYROLL_DEDUCTION'
    ? 'Deducción nómina'
    : 'Préstamo billetera';

const isPlanningDerivedExpenseRow = (row: TransactionRow): boolean =>
  isPlanningCardPaymentRow(row) || isPlanningLoanPaymentRow(row);

/**
 * Outer shell shared with Pagos tarjeta / Préstamos panels
 * (`FortnightCardPaymentsPanel`, `FortnightLoanPaymentsPanel`).
 */
const expenseCardShellClass = ({
  isPaid,
  isCardCharge,
  daysRemaining,
  hasDue,
}: {
  isPaid: boolean;
  isCardCharge: boolean;
  daysRemaining: number | null;
  hasDue: boolean;
}): string => {
  if (isPaid) {
    return 'border-emerald-500/20 bg-gradient-to-br from-emerald-500/6 via-card to-emerald-500/2 dark:from-emerald-500/12 dark:via-card/60 dark:to-emerald-500/3';
  }
  if (isCardCharge) {
    return 'border-violet-500/25 bg-gradient-to-br from-violet-500/8 via-card to-violet-500/3 dark:from-violet-500/14 dark:via-card/60 dark:to-violet-500/5';
  }
  if (hasDue && daysRemaining != null && daysRemaining < 0) {
    return 'border-destructive/25 bg-gradient-to-br from-destructive/10 via-card to-destructive/3 dark:from-destructive/18 dark:via-card/60 dark:to-destructive/5';
  }
  if (hasDue && daysRemaining != null && daysRemaining <= 7) {
    return 'border-amber-500/25 bg-gradient-to-br from-amber-500/8 via-card to-amber-500/2 hover:from-amber-500/12 dark:from-amber-500/14 dark:via-card/60 dark:to-amber-500/4';
  }
  return 'border-blue-500/25 bg-gradient-to-br from-blue-500/8 via-card to-blue-500/2 hover:from-blue-500/12 dark:from-blue-500/14 dark:via-card/60 dark:to-blue-500/4';
};

type ExpenseWalletLabelProps = {
  expense: TransactionRow;
  walletsById: Map<number, WalletListItem>;
  isCompact: boolean;
};

const ExpenseWalletLabel = ({
  expense,
  walletsById,
  isCompact,
}: ExpenseWalletLabelProps) => {
  const wallet =
    expense.wallet_id != null ? walletsById.get(expense.wallet_id) : null;
  const walletLabel =
    wallet?.name || expense.paymentMethod?.trim() || 'Billetera no definida';
  const providerIconKey = wallet?.provider_icon_key ?? null;

  return (
    <span
      className="inline-flex min-w-0 items-center gap-1.5"
      aria-label={walletLabel}
      title={walletLabel}
    >
      {providerIconKey ? (
        <WalletProviderIcon
          providerIconKey={providerIconKey}
          className={cn(
            'border-0 bg-transparent p-0 text-muted-foreground/70',
            isCompact ? 'h-3 w-3' : 'h-3.5 w-3.5',
          )}
          iconClassName={isCompact ? 'h-3 w-3' : 'h-3.5 w-3.5'}
          showTooltipLabel={false} data-icon="inline-start" />
      ) : null}
      <span className="truncate text-muted-foreground/65">{walletLabel}</span>
    </span>
  );
};

type ThrownApiError = Error & { status?: number };

/** Map `clientFetchFromApi` errors to user copy; avoid console noise for expected 4xx (e.g. saldo). */
const getApiErrorFeedback = (
  error: unknown,
  fallback: string,
): { userMessage: string; logToConsole: boolean } => {
  const err = error as ThrownApiError;
  if (!(err instanceof Error)) {
    return { userMessage: fallback, logToConsole: true };
  }
  const status = err.status;
  const is4xx =
    typeof status === 'number' && status >= 400 && status < 500;
  if (is4xx && err.message.trim()) {
    return { userMessage: err.message, logToConsole: false };
  }
  if (typeof status === 'number' && status >= 500) {
    return { userMessage: fallback, logToConsole: true };
  }
  return {
    userMessage: err.message.trim() ? err.message : fallback,
    logToConsole: true,
  };
};

export type ExpenseTableDensity = 'comfortable' | 'compact';

type ExpenseTableProps = {
  date?: string;
  expenses: TransactionRow[];
  onExpenseUpdate?: (expenseId: number, isPaid: boolean) => void;
  totalIncome?: number;
  year?: number;
  month?: number;
  period?: 'FIRST' | 'SECOND';
  density?: ExpenseTableDensity;
  wallets?: WalletListItem[];
  /** When true (planificación por quincena), totals stay fixed under the list scroll area */
  pinTotalsToBottom?: boolean;
};

export default function ExpenseTable({
  date,
  expenses,
  onExpenseUpdate,
  year,
  month,
  period,
  density = 'comfortable',
  wallets = [],
  pinTotalsToBottom = false,
}: ExpenseTableProps) {
  const isCompact = density === 'compact';
  const { context } = useFinanceContext();
  const [dropdownMounted, setDropdownMounted] = useState(false);
  const [updatingIds, setUpdatingIds] = useState<Set<number>>(new Set());

  // Defer DropdownMenu render until after hydration to avoid Radix useId mismatch
  useEffect(() => setDropdownMounted(true), []);
  const [localExpenses, setLocalExpenses] = useState<TransactionRow[]>(expenses);
  const [editingExpense, setEditingExpense] = useState<TransactionRow | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [deletingExpense, setDeletingExpense] = useState<TransactionRow | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [payingExpense, setPayingExpense] = useState<TransactionRow | null>(null);
  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const walletsById = useMemo(
    () => new Map(wallets.map((wallet) => [wallet.id, wallet])),
    [wallets],
  );

  // Sync local state with props when expenses change
  useEffect(() => {
    const sorted = [...expenses].sort((a, b) => {
      if (a.is_paid !== b.is_paid) {
        return a.is_paid ? 1 : -1;
      }
      const amountA = toDisplayAmount(a.amount);
      const amountB = toDisplayAmount(b.amount);
      return amountB - amountA;
    });
    setLocalExpenses(sorted);
  }, [expenses]);

  const handlePaidToggle = useCallback(async (expense: TransactionRow, newPaidStatus: boolean) => {
    if (isPlanningDerivedExpenseRow(expense)) {
      return;
    }
    if (!isExpenseTransactionRow(expense)) {
      toast.error(
        'Los ingresos no se marcan como pagado desde la tabla de gastos.',
      );
      return;
    }

    const expenseId = expense.id;
    setUpdatingIds((prev) => {
      const next = new Set(prev);
      next.add(expenseId);
      return next;
    });

    const updatedExpenses = localExpenses.map((e) =>
      e.id === expenseId ? { ...e, is_paid: newPaidStatus } : e,
    );
    setLocalExpenses(updatedExpenses);

    try {
      await updateExpensePaidStatus(expenseId, newPaidStatus, context);
      if (onExpenseUpdate) {
        onExpenseUpdate(expenseId, newPaidStatus);
      }
      toast.success(
        newPaidStatus
          ? 'Gasto marcado como pagado.'
          : 'Gasto marcado como no pagado.',
      );
    } catch (error) {
      setLocalExpenses(expenses);
      const { userMessage, logToConsole } = getApiErrorFeedback(
        error,
        'Error al actualizar el estado de pago. Por favor, intenta de nuevo.',
      );
      if (logToConsole) {
        console.error('Error updating expense paid status:', error);
      }
      toast.error(userMessage);
    } finally {
      setUpdatingIds((prev) => {
        const next = new Set(prev);
        next.delete(expenseId);
        return next;
      });
    }
  }, [context, expenses, localExpenses, onExpenseUpdate]);

  const handleEditAmount = useCallback((expense: TransactionRow) => {
    if (isPlanningDerivedExpenseRow(expense)) return;
    if (!isExpenseTransactionRow(expense)) return;
    setEditingExpense(expense);
    setEditDialogOpen(true);
    setEditError(null);
  }, []);

  const handleUpdateAmount = async (data: ExpenseAmountFormValues) => {
    if (!editingExpense || !isExpenseTransactionRow(editingExpense)) return;

    const expenseId = editingExpense.id;
    setUpdatingIds((prev) => {
      const next = new Set(prev);
      next.add(expenseId);
      return next;
    });

    const walletChanged = data.wallet_id !== undefined && data.wallet_id !== (editingExpense.wallet_id ?? null);
    const walletName = data.wallet_id != null
      ? (wallets.find((w) => w.id === data.wallet_id)?.name ?? editingExpense.paymentMethod)
      : 'Efectivo';

    const updatedExpenses = localExpenses.map((e) =>
      e.id === expenseId
        ? {
            ...e,
            amount: data.amount,
            ...(walletChanged ? { wallet_id: data.wallet_id ?? null, paymentMethod: walletName } : {}),
          }
        : e,
    );
    setLocalExpenses(updatedExpenses);

    try {
      setEditError(null);
      await updateExpenseAmount(expenseId, data.amount, context, data.wallet_id);
      if (onExpenseUpdate) {
        onExpenseUpdate(expenseId, editingExpense.is_paid);
      }
      setEditDialogOpen(false);
      setEditingExpense(null);
      toast.success('Gasto actualizado.');
    } catch (error) {
      setLocalExpenses(expenses);
      const { userMessage, logToConsole } = getApiErrorFeedback(
        error,
        'Error al actualizar el monto',
      );
      setEditError(userMessage);
      if (logToConsole) {
        console.error('Error updating expense amount:', error);
      }
      toast.error(userMessage);
      throw error;
    } finally {
      setUpdatingIds((prev) => {
        const next = new Set(prev);
        next.delete(expenseId);
        return next;
      });
    }
  };

  const handleDeleteExpense = async () => {
    if (
      !deletingExpense ||
      isPlanningDerivedExpenseRow(deletingExpense) ||
      !isExpenseTransactionRow(deletingExpense)
    ) {
      return;
    }

    const expenseId = deletingExpense.id;
    setUpdatingIds((prev) => {
      const next = new Set(prev);
      next.add(expenseId);
      return next;
    });

    const updatedExpenses = localExpenses.filter((e) => e.id !== expenseId);
    setLocalExpenses(updatedExpenses);

    try {
      await deleteTransaction(expenseId, context);
      if (onExpenseUpdate) {
        onExpenseUpdate(expenseId, deletingExpense.is_paid);
      }
      setDeleteDialogOpen(false);
      setDeletingExpense(null);
      toast.success('Gasto eliminado.');
    } catch (error) {
      setLocalExpenses(expenses);
      const { userMessage, logToConsole } = getApiErrorFeedback(
        error,
        'Error al eliminar el gasto. Por favor, intenta de nuevo.',
      );
      if (logToConsole) {
        console.error('Error deleting expense:', error);
      }
      toast.error(userMessage);
    } finally {
      setUpdatingIds((prev) => {
        const next = new Set(prev);
        next.delete(expenseId);
        return next;
      });
    }
  };

  const getDueInfo = useCallback((expense: TransactionRow) => {
    const dueDayValue = expense.due_day;
    if (!dueDayValue || Number.isNaN(dueDayValue)) {
      return {
        hasDue: false,
        dueDay: null as number | null,
        daysRemaining: null as number | null,
        showCountdown: false,
        badgeColor: 'default' as const,
      };
    }

    const today = new Date();
    const todayDay = today.getDate();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth(); // 0-based
    const currentPeriod: 'FIRST' | 'SECOND' = todayDay <= 15 ? 'FIRST' : 'SECOND';

    // Only show for the current fortnight (current year + month + matching period).
    // When year/month/period are known, require an exact match. Fall back to date-only
    // when props aren't available (e.g. standalone usage without fortnight context).
    if (year != null && month != null && period != null) {
      const isCurrentFortnight =
        year === currentYear &&
        month - 1 === currentMonth &&
        period === currentPeriod;
      if (!isCurrentFortnight) {
        return {
          hasDue: false,
          dueDay: null as number | null,
          daysRemaining: null as number | null,
          showCountdown: false,
          badgeColor: 'default' as const,
        };
      }
    } else if (date) {
      const expenseDate = new Date(date);
      if (!Number.isNaN(expenseDate.getTime())) {
        const isCurrentMonth =
          expenseDate.getFullYear() === currentYear &&
          expenseDate.getMonth() === currentMonth;
        if (!isCurrentMonth) {
          return {
            hasDue: false,
            dueDay: null as number | null,
            daysRemaining: null as number | null,
            showCountdown: false,
            badgeColor: 'default' as const,
          };
        }
      }
    }

    const daysRemaining = dueDayValue - todayDay;
    const showCountdown = daysRemaining >= 0;

    let badgeColor: 'default' | 'destructive' | 'secondary' = 'default';
    if (daysRemaining < 0) {
      badgeColor = 'destructive';
    } else if (daysRemaining <= 3) {
      badgeColor = 'destructive';
    } else if (daysRemaining <= 7) {
      badgeColor = 'secondary';
    }

    return {
      hasDue: true,
      dueDay: dueDayValue,
      daysRemaining,
      showCountdown,
      badgeColor,
    };
  }, [date, month, period, year]);

  const pendingExpenses = localExpenses.filter((e) => !e.is_paid);
  const paidExpenses = localExpenses.filter((e) => e.is_paid);

  const cashFlowPaid = paidExpenses.filter((e) => !isCardChargeExpenseRow(e));
  const cashFlowPending = pendingExpenses.filter((e) => !isCardChargeExpenseRow(e));
  const cardPaid = paidExpenses.filter((e) => isCardChargeExpenseRow(e));
  const cardPending = pendingExpenses.filter((e) => isCardChargeExpenseRow(e));

  const totalPaid = cashFlowPaid.reduce(
    (sum, e) => sum + toDisplayAmount(e.amount),
    0,
  );
  const totalPending = cashFlowPending.reduce(
    (sum, e) => sum + toDisplayAmount(e.amount),
    0,
  );

  const total = totalPaid + totalPending;
  const cardTotalPaid = cardPaid.reduce(
    (sum, e) => sum + toDisplayAmount(e.amount),
    0,
  );
  const cardTotalPending = cardPending.reduce(
    (sum, e) => sum + toDisplayAmount(e.amount),
    0,
  );
  const cardGrandTotal = cardTotalPaid + cardTotalPending;

  const totalsPinned =
    pinTotalsToBottom && localExpenses.length > 0 ? (
      <div
        className="shrink-0 border-t border-border/50 bg-background/95 px-1 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-8px_24px_-12px_rgba(0,0,0,0.35)] backdrop-blur-md supports-[backdrop-filter]:bg-background/85 dark:shadow-[0_-8px_28px_-14px_rgba(0,0,0,0.65)]"
        role="region"
        aria-label="Totales de efectivo y débito"
      >
        <div className="flex items-center justify-between gap-2 rounded-xl border border-border/30 bg-gradient-to-r from-muted/60 via-muted/30 to-muted/10 px-3 py-2 shadow-sm dark:from-muted/40 dark:via-muted/20 dark:to-muted/5">
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">
            Total efectivo/débito
          </span>
          <span
            className={cn(
              'font-mono font-black tabular-nums text-foreground',
              isCompact ? 'text-sm' : 'text-base',
            )}
          >
            {formatCurrency(total)}
          </span>
        </div>
        {cardGrandTotal > 0 ? (
          <div className="mt-1.5 flex items-center justify-between gap-2 rounded-xl border border-violet-500/20 bg-gradient-to-r from-violet-500/8 via-violet-500/3 to-transparent px-3 py-2 dark:from-violet-500/14 dark:via-violet-500/5">
            <div className="flex min-w-0 flex-col">
              <span className="text-[10px] font-bold uppercase tracking-widest text-violet-600/80 dark:text-violet-400/80">
                Cargos a tarjeta
              </span>
              <span className="text-[10px] text-muted-foreground/60">
                No suman hasta pagar el estado de cuenta
              </span>
            </div>
            <span
              className={cn(
                'font-mono font-bold tabular-nums text-violet-700 dark:text-violet-300',
                isCompact ? 'text-xs' : 'text-sm',
              )}
            >
              {formatCurrency(cardGrandTotal)}
            </span>
          </div>
        ) : null}
      </div>
    ) : null;

  return (
    <>
      <div
        className={cn(
          'px-1 pb-1',
          pinTotalsToBottom && 'flex h-full min-h-0 flex-col',
        )}
        role="region"
        aria-label="Gastos de la quincena"
      >
        <ul
          role="list"
          className={cn(
            'flex flex-col gap-1.5 [&>li]:shrink-0',
            pinTotalsToBottom
              ? 'min-h-0 flex-1 overflow-y-auto overscroll-contain pb-2 scrollbar-hide'
              : isCompact
                ? 'max-h-[min(380px,55vh)] overflow-y-auto pb-2'
                : 'max-h-[380px] overflow-y-auto pb-2',
          )}
        >
          {localExpenses.length === 0 ? (
            <li className="rounded-xl border border-dashed border-border/40 px-3 py-8 text-center text-xs text-muted-foreground">
              Sin gastos
            </li>
          ) : (
            <>
              {localExpenses.map((e) => {
                const isUpdating = updatingIds.has(e.id);
                const isCardPay = isPlanningCardPaymentRow(e);
                const isLoanPay = isPlanningLoanPaymentRow(e);
                const isCardCharge = isCardChargeExpenseRow(e);
                const isIncomeRow = !isExpenseTransactionRow(e);
                const {
                  hasDue,
                  dueDay,
                  daysRemaining,
                  showCountdown,
                  badgeColor,
                } = getDueInfo(e);
                return (
                  <li
                    key={`${e.planning_row_kind ?? 'expense'}-${e.id}`}
                    className={cn(
                      'group/row relative flex items-center gap-2.5 overflow-hidden rounded-xl border px-3 transition-all',
                      'before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent dark:before:via-white/5',
                      isCompact ? 'py-2.5' : 'py-3',
                      expenseCardShellClass({
                        isPaid: e.is_paid,
                        isCardCharge,
                        daysRemaining,
                        hasDue,
                      }),
                    )}
                  >
                    {/* Status / pay toggle */}
                    <div className="shrink-0">
                      {e.is_paid ? (
                        <span
                          className={cn(
                            'inline-flex h-8 w-8 items-center justify-center rounded-full ring-1 shadow-sm',
                            isCardPay
                              ? 'bg-green-500/15 ring-green-500/30 text-green-600 dark:text-green-400'
                              : 'bg-emerald-500/15 ring-emerald-500/30 text-emerald-600 dark:text-emerald-400',
                          )}
                          aria-label="Pagado"
                        >
                          <CheckCircle2 className="h-5 w-5" data-icon="inline-start" />
                        </span>
                      ) : isIncomeRow || isCardPay || isLoanPay ? (
                        <span
                          className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-muted/30 text-[11px] text-muted-foreground/50 ring-1 ring-border/40"
                          aria-hidden
                        >
                          —
                        </span>
                      ) : (
                        <Button
                          variant="ghost"
                          size="icon"
                          className={cn(
                            'h-8 w-8 rounded-full border border-dashed bg-transparent text-muted-foreground/40 transition-colors',
                            'border-border/60 hover:border-emerald-500/60 hover:bg-emerald-500/10 hover:text-emerald-600 dark:hover:text-emerald-400',
                          )}
                          onClick={() => {
                            setPayingExpense(e);
                            setPayDialogOpen(true);
                          }}
                          disabled={isUpdating}
                          aria-label={`Marcar ${e.description} como pagado`}
                        >
                          <CheckCircle2 className="h-4 w-4" data-icon="inline-start" />
                        </Button>
                      )}
                    </div>

                    {/* Body */}
                    <div className="min-w-0 flex-1">
                      <span
                        className={cn(
                          'inline-flex min-w-0 items-center gap-1.5 leading-tight',
                          isCompact ? 'text-xs' : 'text-sm',
                        )}
                      >
                        <CategoryIcon
                          icon={e.categoryIcon}
                          className={cn(
                            e.is_paid
                              ? 'text-muted-foreground/70'
                              : 'text-foreground/70',
                          )}
                          iconClassName={isCompact ? 'h-3.5 w-3.5' : 'h-4 w-4'}
                          data-icon="inline-start"
                        />
                        <span
                          className={cn(
                            'min-w-0 truncate',
                            e.is_paid
                              ? 'font-medium text-muted-foreground/80 line-through'
                              : 'font-semibold text-foreground',
                          )}
                        >
                          {e.description}
                        </span>
                      </span>
                      <p className="mt-1 flex min-w-0 flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                        <ExpenseWalletLabel
                          expense={e}
                          walletsById={walletsById}
                          isCompact={isCompact}
                        />
                        {hasDue && (
                          <Badge
                            variant={e.is_paid ? 'secondary' : badgeColor}
                            className={cn(
                              'h-4 rounded-full px-1.5 text-[10px] font-medium',
                              e.is_paid && 'opacity-60',
                            )}
                          >
                            {e.is_paid
                              ? `Día ${dueDay}`
                              : showCountdown &&
                                  daysRemaining !== null &&
                                  daysRemaining >= 0
                                ? `Día ${dueDay} · en ${daysRemaining}d`
                                : `Día ${dueDay}`}
                          </Badge>
                        )}
                      </p>
                      {(isCardPay || isLoanPay || isCardCharge) && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {isCardPay && (
                            <span className="inline-flex h-4 items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-1.5 text-[10px] font-medium text-emerald-700 dark:border-emerald-400/40 dark:bg-emerald-500/15 dark:text-emerald-300">
                              <span className="h-1 w-1 rounded-full bg-emerald-500 dark:bg-emerald-400" aria-hidden />
                              Pago TC
                            </span>
                          )}
                          {isLoanPay && (
                            <span
                              className={cn(
                                'inline-flex h-4 items-center gap-1 rounded-full border px-1.5 text-[10px] font-medium',
                                e.loan_payment_source === 'PAYROLL_DEDUCTION'
                                  ? 'border-violet-500/40 bg-violet-500/10 text-violet-700 dark:border-violet-400/40 dark:bg-violet-500/15 dark:text-violet-300'
                                  : 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:border-amber-400/40 dark:bg-amber-500/15 dark:text-amber-300',
                              )}
                            >
                              <span
                                className={cn(
                                  'h-1 w-1 rounded-full',
                                  e.loan_payment_source === 'PAYROLL_DEDUCTION'
                                    ? 'bg-violet-500 dark:bg-violet-400'
                                    : 'bg-amber-500 dark:bg-amber-400',
                                )}
                                aria-hidden
                              />
                              {planningLoanPaymentBadgeLabel(e)}
                            </span>
                          )}
                          {isCardCharge && (
                            <span className="inline-flex h-4 items-center gap-1 rounded-full border border-violet-500/40 bg-violet-500/10 px-1.5 text-[10px] font-medium text-violet-700 dark:border-violet-400/40 dark:bg-violet-500/15 dark:text-violet-300">
                              <span className="h-1 w-1 rounded-full bg-violet-500 dark:bg-violet-400" aria-hidden />
                              Tarjeta
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Amount — vertically centered with the card */}
                    <span
                      className={cn(
                        'shrink-0 font-mono tabular-nums leading-tight',
                        isCompact ? 'text-xs' : 'text-sm',
                        e.is_paid
                          ? 'text-muted-foreground/60 line-through'
                          : isCardCharge
                            ? 'font-bold text-violet-700 dark:text-violet-300'
                            : 'font-bold text-foreground',
                      )}
                    >
                      {formatCurrency(toDisplayAmount(e.amount))}
                    </span>

                    {/* Actions menu */}
                    <div className="-mr-1 shrink-0">
                      {isIncomeRow || isCardPay || isLoanPay ? (
                        <span
                          className="inline-flex h-8 w-8 items-center justify-center text-xs text-muted-foreground/30"
                          aria-hidden
                        >
                          —
                        </span>
                      ) : !dropdownMounted ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          disabled
                          aria-label="Más acciones"
                        >
                          <MoreVertical className="h-4 w-4" aria-hidden data-icon="inline-start" />
                        </Button>
                      ) : (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground/60 hover:text-foreground"
                              disabled={isUpdating}
                              aria-label={`Más acciones para ${e.description}`}
                            >
                              <MoreVertical className="h-4 w-4" data-icon="inline-start" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => handleEditAmount(e)}
                              disabled={isUpdating}
                            >
                              <Pencil className="mr-2 h-4 w-4" data-icon="inline-start" />
                              Modificar gasto
                            </DropdownMenuItem>
                            {e.is_paid ? (
                              <DropdownMenuItem
                                onClick={() => handlePaidToggle(e, false)}
                                disabled={isUpdating}
                              >
                                <CheckCircle2 className="mr-2 h-4 w-4" data-icon="inline-start" />
                                Deshacer pago
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem
                                onClick={() => {
                                  setDeletingExpense(e);
                                  setDeleteDialogOpen(true);
                                }}
                                disabled={isUpdating}
                                className="text-destructive"
                              >
                                <Trash2 className="mr-2 h-4 w-4" data-icon="inline-start" />
                                Eliminar
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </li>
                );
              })}
              {!pinTotalsToBottom ? (
                <>
                  <li className="mt-1 flex items-center justify-between gap-2 rounded-xl border border-border/30 bg-gradient-to-r from-muted/60 via-muted/30 to-muted/10 px-3 py-2.5 shadow-sm dark:from-muted/40 dark:via-muted/20 dark:to-muted/5">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">
                      Total efectivo/débito
                    </span>
                    <span className="font-mono text-base font-black tabular-nums text-foreground">
                      {formatCurrency(total)}
                    </span>
                  </li>
                  {cardGrandTotal > 0 ? (
                    <li className="flex items-center justify-between gap-2 rounded-xl border border-violet-500/20 bg-gradient-to-r from-violet-500/8 via-violet-500/3 to-transparent px-3 py-2 dark:from-violet-500/14 dark:via-violet-500/5">
                      <div className="flex min-w-0 flex-col">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-violet-600/80 dark:text-violet-400/80">
                          Cargos a tarjeta
                        </span>
                        <span className="text-[10px] text-muted-foreground/60">
                          No suman hasta pagar el estado de cuenta
                        </span>
                      </div>
                      <span className="font-mono text-sm font-bold tabular-nums text-violet-700 dark:text-violet-300">
                        {formatCurrency(cardGrandTotal)}
                      </span>
                    </li>
                  ) : null}
                </>
              ) : null}
            </>
          )}
        </ul>
        {totalsPinned}
      </div>

      {/* Edit Expense Dialog */}
      {editingExpense && (
        <EditExpenseAmountDialog
          open={editDialogOpen}
          onOpenChange={(open) => {
            setEditDialogOpen(open);
            if (!open) {
              setEditError(null);
              setEditingExpense(null);
            }
          }}
          onSave={handleUpdateAmount}
          defaultAmount={toDisplayAmount(editingExpense.amount)}
          defaultWalletId={editingExpense.wallet_id ?? null}
          wallets={wallets}
          isPaid={editingExpense.is_paid}
          error={editError && editDialogOpen ? editError : null}
        />
      )}

      {/* Delete Expense Confirmation Dialog */}
      {deletingExpense && (
        <ConfirmDeleteDialog
          open={deleteDialogOpen}
          onOpenChange={(open) => {
            setDeleteDialogOpen(open);
            if (!open) {
              setDeletingExpense(null);
            }
          }}
          onConfirm={handleDeleteExpense}
          title="Eliminar gasto"
          description="¿Estás seguro de que deseas eliminar este gasto? Esta acción solo eliminará el gasto de esta quincena."
          itemName={deletingExpense.description}
        />
      )}

      {/* Pay Expense Confirmation Dialog */}
      {payingExpense && (
        <AlertDialog
          open={payDialogOpen}
          onOpenChange={(open) => {
            setPayDialogOpen(open);
            if (!open) {
              setPayingExpense(null);
            }
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Pagar gasto</AlertDialogTitle>
              <AlertDialogDescription>
                ¿Quieres marcar este gasto como pagado? Esta acción actualizará
                tus totales de la quincena.
                <span className="mt-2 block font-semibold text-foreground">
                  {payingExpense.description}
                </span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  {formatCurrency(toDisplayAmount(payingExpense.amount))}
                </span>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={async () => {
                  await handlePaidToggle(payingExpense, true);
                  setPayDialogOpen(false);
                  setPayingExpense(null);
                }}
                className="bg-emerald-600 text-emerald-50 hover:bg-emerald-700"
              >
                Confirmar pago
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

    </>
  );
}
