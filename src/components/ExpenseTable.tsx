'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { toast } from 'sonner';
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
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
import { formatCurrency, toDisplayAmount } from '@/lib/utils';
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
import { DataTableColumnHeader } from '@/components/ui/data-table';
import { cn } from '@/lib/utils';
import { CategoryLabel } from '@/components/categories/CategoryLabel';

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
  fortnightLabel?: string;
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
  fortnightLabel = '',
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
    if (isPlanningCardPaymentRow(expense)) {
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
    if (isPlanningCardPaymentRow(expense)) return;
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
      isPlanningCardPaymentRow(deletingExpense) ||
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

  const columns = useMemo<ColumnDef<TransactionRow>[]>(
    () => [
      {
        accessorKey: 'is_paid',
        id: 'is_paid',
        header: () => <span className="sr-only">Estado</span>,
        cell: ({ row }) => {
          const expense = row.original;
          const isUpdating = updatingIds.has(expense.id);
          if (expense.is_paid) {
            return (
              <div className="flex justify-center">
                <CheckCircle2
                  className={cn(
                    'text-emerald-500 dark:text-emerald-400',
                    isCompact ? 'h-4 w-4' : 'h-5 w-5',
                  )}
                />
              </div>
            );
          }
          if (!isExpenseTransactionRow(expense)) {
            return (
              <div className="flex justify-center text-muted-foreground">
                <span className={isCompact ? 'text-[10px]' : 'text-xs'}>—</span>
              </div>
            );
          }
          if (isPlanningCardPaymentRow(expense)) {
            return (
              <div className="flex justify-center">
                <CheckCircle2
                  className={cn(
                    'text-green-600 dark:text-green-400',
                    isCompact ? 'h-4 w-4' : 'h-5 w-5',
                  )}
                  aria-hidden
                />
              </div>
            );
          }
          return (
            <div className="flex justify-center">
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  isCompact ? 'h-7 w-7' : 'h-8 w-8',
                  'text-muted-foreground/40 transition-colors hover:text-emerald-500 hover:bg-emerald-500/10',
                )}
                onClick={() => {
                  setPayingExpense(expense);
                  setPayDialogOpen(true);
                }}
                disabled={isUpdating}
                aria-label="Marcar como pagado"
              >
                <CheckCircle2
                  className={cn(
                    isCompact ? 'h-3.5 w-3.5' : 'h-4 w-4',
                  )}
                />
              </Button>
            </div>
          );
        },
        enableSorting: true,
      },
      {
        accessorKey: 'description',
        header: () => (
          <span className={cn('font-medium', isCompact ? 'text-[10px]' : 'text-xs')}>
            Gasto
          </span>
        ),
        cell: ({ row }) => {
          const expense = row.original;
          const { hasDue, dueDay, daysRemaining, showCountdown, badgeColor } =
            getDueInfo(expense);
          return (
            <div
              className={cn(
                'flex flex-col gap-1',
                isCompact ? 'min-w-[130px] sm:min-w-[160px]' : 'min-w-[150px] sm:min-w-[200px]',
              )}
            >
              <span
                className={cn(
                  isCompact ? 'text-xs' : 'text-sm',
                  expense.is_paid
                    ? 'font-medium text-muted-foreground line-through'
                    : 'font-semibold text-foreground',
                )}
              >
                {expense.description}
              </span>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1">
                  <span
                    className={cn(
                      'text-muted-foreground',
                      isCompact ? 'text-[10px]' : 'text-[11px]',
                    )}
                  >
                    <CategoryLabel
                      name={expense.category}
                      icon={expense.categoryIcon}
                    />
                  </span>
                  <span className={cn('text-muted-foreground/30', isCompact ? 'text-[10px]' : 'text-[11px]')}>·</span>
                  <span
                    className={cn(
                      'text-muted-foreground/70',
                      isCompact ? 'text-[10px]' : 'text-[11px]',
                    )}
                  >
                    {expense.paymentMethod}
                  </span>
                </div>
                {isPlanningCardPaymentRow(expense) ? (
                  <Badge
                    variant="outline"
                    className={cn(
                      'border-emerald-500/40 text-emerald-800 dark:text-emerald-300',
                      'text-[10px]',
                      isCompact ? 'h-4 px-1.5' : 'h-5',
                    )}
                  >
                    Pago TC
                  </Badge>
                ) : null}
                {isCardChargeExpenseRow(expense) ? (
                  <Badge
                    variant="outline"
                    className={cn(
                      'border-violet-500/40 text-violet-700 dark:text-violet-300',
                      'text-[10px]',
                      isCompact ? 'h-4 px-1.5' : 'h-5',
                    )}
                  >
                    Tarjeta
                  </Badge>
                ) : null}
                {hasDue && (
                  <Badge
                    variant={expense.is_paid ? 'secondary' : badgeColor}
                    className={cn(
                      'text-[10px]',
                      isCompact ? 'h-4 px-1.5' : 'h-5',
                      expense.is_paid && 'opacity-60',
                    )}
                  >
                    {expense.is_paid
                      ? `Pagado · día ${dueDay}`
                      : showCountdown && daysRemaining !== null && daysRemaining >= 0
                        ? `Día ${dueDay} · en ${daysRemaining} día${daysRemaining !== 1 ? 's' : ''}`
                        : `Día ${dueDay} · vencido`}
                  </Badge>
                )}
              </div>
            </div>
          );
        },
        enableSorting: true,
      },
      {
        id: 'amount',
        accessorFn: (row) => toDisplayAmount(row.amount),
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="Monto"
            className={cn(
              'text-right min-w-[90px] sm:min-w-[120px] font-medium',
              isCompact ? 'text-[10px]' : 'text-xs',
            )}
          />
        ),
        cell: ({ row }) => (
          <span
            className={cn(
              'text-right font-mono tabular-nums',
              row.original.is_paid
                ? cn('text-muted-foreground/60 line-through', isCompact ? 'text-xs' : 'text-sm')
                : cn('font-bold text-foreground', isCompact ? 'text-xs' : 'text-sm'),
            )}
          >
            {formatCurrency(toDisplayAmount(row.original.amount))}
          </span>
        ),
        enableSorting: true,
      },
      {
        id: 'actions',
        header: () => <span className="sr-only">Acciones</span>,
        cell: ({ row }) => {
          const expense = row.original;
          const isUpdating = updatingIds.has(expense.id);
          if (!isExpenseTransactionRow(expense)) {
            return (
              <div className="flex justify-center text-muted-foreground">
                <span className={isCompact ? 'text-[10px]' : 'text-xs'} aria-hidden>
                  —
                </span>
              </div>
            );
          }
          if (isPlanningCardPaymentRow(expense)) {
            return (
              <div className="flex justify-center text-muted-foreground">
                <span
                  className={isCompact ? 'text-[10px]' : 'text-xs'}
                  title="Registrado desde pagos de tarjeta"
                >
                  —
                </span>
              </div>
            );
          }
          if (!dropdownMounted) {
            return (
              <div className="flex justify-center">
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(isCompact ? 'h-7 w-7' : 'h-8 w-8')}
                  disabled={isUpdating}
                  aria-hidden
                >
                  <MoreVertical
                    className={cn(isCompact ? 'h-3.5 w-3.5' : 'h-4 w-4')}
                  />
                </Button>
              </div>
            );
          }
          return (
            <div className="flex justify-center">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(isCompact ? 'h-7 w-7' : 'h-8 w-8')}
                    disabled={isUpdating}
                  >
                    <MoreVertical
                      className={cn(isCompact ? 'h-3.5 w-3.5' : 'h-4 w-4')}
                    />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() => handleEditAmount(expense)}
                    disabled={isUpdating}
                  >
                    <Pencil className="mr-2 h-4 w-4" />
                    Modificar gasto
                  </DropdownMenuItem>
                  {expense.is_paid ? (
                    <DropdownMenuItem
                      onClick={() => handlePaidToggle(expense, false)}
                      disabled={isUpdating}
                    >
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Deshacer pago
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem
                      onClick={() => {
                        setDeletingExpense(expense);
                        setDeleteDialogOpen(true);
                      }}
                      disabled={isUpdating}
                      className="text-destructive"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Eliminar
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
        enableSorting: false,
      },
    ],
    [
      dropdownMounted,
      updatingIds,
      handleEditAmount,
      handlePaidToggle,
      getDueInfo,
      setDeletingExpense,
      setDeleteDialogOpen,
      setPayingExpense,
      setPayDialogOpen,
      isCompact,
    ]
  );

  const [sorting, setSorting] = useState<SortingState>([
    { id: 'is_paid', desc: false },
    { id: 'amount', desc: true },
  ]);

  const table = useReactTable({
    data: localExpenses,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getRowId: (row) =>
      `${row.planning_row_kind ?? 'expense'}-${row.id}`,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const sortedRows = table.getRowModel().rows;

  const mobileTotalsPinned =
    pinTotalsToBottom && sortedRows.length > 0 ? (
      <div
        className="shrink-0 border-t border-border/50 bg-background/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-8px_24px_-12px_rgba(0,0,0,0.35)] backdrop-blur-md supports-[backdrop-filter]:bg-background/85 dark:shadow-[0_-8px_28px_-14px_rgba(0,0,0,0.65)]"
        role="region"
        aria-label="Totales de efectivo y débito"
      >
        <div className="flex items-center justify-between gap-2 rounded-xl border border-border/30 bg-gradient-to-r from-muted/60 via-muted/30 to-muted/10 px-3 py-2 shadow-sm dark:from-muted/40 dark:via-muted/20 dark:to-muted/5">
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">
            Total efectivo/débito
          </span>
          <span className="font-mono text-base font-black tabular-nums text-foreground">
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
            <span className="font-mono text-sm font-bold tabular-nums text-violet-700 dark:text-violet-300">
              {formatCurrency(cardGrandTotal)}
            </span>
          </div>
        ) : null}
      </div>
    ) : null;

  const desktopTotalsPinned =
    pinTotalsToBottom && sortedRows.length > 0 ? (
      <div
        className="shrink-0 border-t border-border/50 bg-background/95 px-0 pt-2 backdrop-blur-md supports-[backdrop-filter]:bg-background/85 sm:rounded-b-xl"
        role="region"
        aria-label="Totales de efectivo y débito"
      >
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border/30 bg-gradient-to-r from-muted/50 to-muted/30 px-3 py-2 dark:from-muted/30 dark:to-muted/10">
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">
            Total efectivo/débito
          </span>
          <span
            className={cn(
              'font-black font-mono tabular-nums',
              isCompact ? 'text-sm' : 'text-base',
            )}
          >
            {formatCurrency(total)}
          </span>
        </div>
        {cardGrandTotal > 0 ? (
          <div className="mt-1.5 flex items-center justify-between gap-3 rounded-lg border border-violet-500/20 bg-violet-50/20 px-3 py-2 dark:bg-violet-950/10">
            <div className="min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-widest text-violet-600/70 dark:text-violet-400/70">
                Cargos a tarjeta
              </span>
              <span className="mt-0.5 block text-[10px] font-normal text-muted-foreground/60">
                No suman al efectivo hasta pagar el estado de cuenta
              </span>
            </div>
            <span
              className={cn(
                'font-bold font-mono tabular-nums text-violet-700 dark:text-violet-300',
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
      <Card
        className={cn(
          'overflow-hidden rounded-xl border-0 bg-transparent shadow-none sm:border sm:border-border/40 sm:bg-card sm:shadow-md',
          pinTotalsToBottom && 'flex h-full min-h-0 flex-col',
        )}
      >
        <CardContent
          className={cn(
            'space-y-0 px-0 pb-0 pt-0 sm:pb-3',
            pinTotalsToBottom && 'flex min-h-0 flex-1 flex-col pb-0 sm:pb-0',
          )}
        >
          {/* Mobile list (hidden on sm+) */}
          <div
            className={cn(
              'sm:hidden',
              pinTotalsToBottom && 'flex min-h-0 flex-1 flex-col',
            )}
          >
          <ul
            role="list"
            className={cn(
              // [&>li]:shrink-0 — rows must not flex-shrink inside the scroll region or they collapse when pinTotalsToBottom constrains height
              'flex flex-col gap-1.5 px-2 pt-1 [&>li]:shrink-0',
              pinTotalsToBottom
                ? 'min-h-0 flex-1 overflow-y-auto overscroll-contain pb-2 scrollbar-hide'
                : 'pb-2',
            )}
            aria-label="Gastos de la quincena"
          >
            {sortedRows.length === 0 ? (
              <li className="rounded-xl border border-dashed border-border/40 px-3 py-8 text-center text-xs text-muted-foreground">
                Sin gastos
              </li>
            ) : (
              <>
                {sortedRows.map((row) => {
                  const e = row.original;
                  const isUpdating = updatingIds.has(e.id);
                  const isCardPay = isPlanningCardPaymentRow(e);
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
                      key={`m-${e.planning_row_kind ?? 'expense'}-${e.id}`}
                      className={cn(
                        'group/row relative flex items-start gap-2.5 overflow-hidden rounded-xl border px-2.5 py-2.5 transition-all',
                        // left accent stripe via border-l width
                        'border-l-[3px]',
                        // subtle top gloss
                        'before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent dark:before:via-white/5',
                        isCardCharge
                          ? 'border-violet-500/15 border-l-violet-500/70 bg-gradient-to-br from-violet-500/8 via-card to-violet-500/3 dark:from-violet-500/14 dark:via-card/60 dark:to-violet-500/5'
                          : e.is_paid
                            ? 'border-emerald-500/15 border-l-emerald-500/60 bg-gradient-to-br from-emerald-500/6 via-card to-emerald-500/2 dark:from-emerald-500/12 dark:via-card/60 dark:to-emerald-500/4'
                            : 'border-border/40 border-l-primary/45 bg-card/60 active:scale-[0.995] active:border-primary/40',
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
                            <CheckCircle2 className="h-5 w-5" />
                          </span>
                        ) : isIncomeRow || isCardPay ? (
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
                            <CheckCircle2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>

                      {/* Body */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <span
                            className={cn(
                              'min-w-0 truncate text-sm leading-tight',
                              e.is_paid
                                ? 'font-medium text-muted-foreground/80 line-through'
                                : 'font-semibold text-foreground',
                            )}
                          >
                            {e.description}
                          </span>
                          <span
                            className={cn(
                              'shrink-0 font-mono tabular-nums text-sm leading-tight',
                              e.is_paid
                                ? 'text-muted-foreground/60 line-through'
                                : isCardCharge
                                  ? 'font-bold text-violet-700 dark:text-violet-300'
                                  : 'font-bold text-foreground',
                            )}
                          >
                            {formatCurrency(toDisplayAmount(e.amount))}
                          </span>
                        </div>
                        <p className="mt-1 flex min-w-0 items-center gap-1 text-[11px] text-muted-foreground">
                          {e.category ? (
                            <>
                              <CategoryLabel
                                name={e.category}
                                icon={e.categoryIcon}
                              />
                              <span className="text-muted-foreground/30">·</span>
                            </>
                          ) : null}
                          <span className="truncate text-muted-foreground/70">
                            {e.paymentMethod}
                          </span>
                        </p>
                        {(isCardPay || isCardCharge || hasDue) && (
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {isCardPay && (
                              <span className="inline-flex h-4 items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-1.5 text-[10px] font-medium text-emerald-700 dark:border-emerald-400/40 dark:bg-emerald-500/15 dark:text-emerald-300">
                                <span className="h-1 w-1 rounded-full bg-emerald-500 dark:bg-emerald-400" aria-hidden />
                                Pago TC
                              </span>
                            )}
                            {isCardCharge && (
                              <span className="inline-flex h-4 items-center gap-1 rounded-full border border-violet-500/40 bg-violet-500/10 px-1.5 text-[10px] font-medium text-violet-700 dark:border-violet-400/40 dark:bg-violet-500/15 dark:text-violet-300">
                                <span className="h-1 w-1 rounded-full bg-violet-500 dark:bg-violet-400" aria-hidden />
                                Tarjeta
                              </span>
                            )}
                            {hasDue && (
                              <Badge
                                variant={
                                  e.is_paid ? 'secondary' : badgeColor
                                }
                                className={cn(
                                  'h-4 rounded-full px-1.5 text-[10px] font-medium',
                                  e.is_paid && 'opacity-60',
                                )}
                              >
                                {e.is_paid
                                  ? `Pagado · día ${dueDay}`
                                  : showCountdown &&
                                      daysRemaining !== null &&
                                      daysRemaining >= 0
                                    ? `Día ${dueDay} · en ${daysRemaining}d`
                                    : `Día ${dueDay} · vencido`}
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Actions menu */}
                      <div className="-mr-1 shrink-0">
                        {isIncomeRow || isCardPay ? (
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
                            aria-hidden
                          >
                            <MoreVertical className="h-4 w-4" />
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
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => handleEditAmount(e)}
                                disabled={isUpdating}
                              >
                                <Pencil className="mr-2 h-4 w-4" />
                                Modificar gasto
                              </DropdownMenuItem>
                              {e.is_paid ? (
                                <DropdownMenuItem
                                  onClick={() => handlePaidToggle(e, false)}
                                  disabled={isUpdating}
                                >
                                  <CheckCircle2 className="mr-2 h-4 w-4" />
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
                                  <Trash2 className="mr-2 h-4 w-4" />
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
          {mobileTotalsPinned}
          </div>

          {/* Desktop table (hidden below sm) */}
          <div
            className={cn(
              'hidden sm:flex sm:min-h-0 sm:flex-col',
              pinTotalsToBottom && 'min-h-0 flex-1',
            )}
          >
          <div className="relative w-full shrink-0">
            <Table className={isCompact ? 'text-xs' : undefined}>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id} className="bg-muted/70 dark:bg-muted/45 hover:bg-muted/70">
                    {headerGroup.headers.map((header) => (
                      <TableHead
                        key={header.id}
                        className={cn(
                          'text-[10px] font-bold uppercase tracking-wider text-foreground/75',
                          header.id === 'is_paid'
                            ? 'w-9 text-center sm:w-12'
                            : header.id === 'amount'
                              ? 'text-right min-w-[90px] sm:min-w-[120px]'
                              : header.id === 'actions'
                                ? 'w-12 text-center sm:w-20'
                                : isCompact
                                  ? 'min-w-[130px] sm:min-w-[160px]'
                                  : 'min-w-[150px] sm:min-w-[200px]',
                          isCompact && 'h-8! py-1.5 px-1.5!',
                        )}
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
            </Table>
          </div>
          <div
            className={cn(
              'relative w-full overflow-y-auto',
              pinTotalsToBottom
                ? 'min-h-0 flex-1'
                : isCompact
                  ? 'max-h-[min(380px,55vh)]'
                  : 'max-h-[380px]',
            )}
          >
            <Table className={isCompact ? 'text-xs' : undefined}>
              <TableBody>
                {table.getRowModel().rows?.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={columns.length}
                      className={cn(
                        'text-center text-muted-foreground',
                        isCompact ? 'py-6 text-xs' : 'py-8 text-sm',
                      )}
                    >
                      Sin gastos
                    </TableCell>
                  </TableRow>
                ) : (
                  <>
                    {table.getRowModel().rows.map((row) => (
                      <TableRow
                        key={`${row.original.planning_row_kind ?? 'expense'}-${row.original.id}`}
                        className={cn(
                          'transition-colors group/row',
                          isCardChargeExpenseRow(row.original)
                            ? 'border-l-[3px] border-l-violet-500/60'
                            : row.original.is_paid
                              ? 'border-l-[3px] border-l-emerald-500/40'
                              : 'border-l-[3px] border-l-primary/25 hover:border-l-primary/50',
                          row.original.is_paid
                            ? 'bg-emerald-50/25 dark:bg-emerald-950/15 opacity-75 hover:opacity-90 hover:bg-emerald-50/35 dark:hover:bg-emerald-950/25'
                            : 'hover:bg-primary/5 dark:hover:bg-primary/8',
                        )}
                      >
                        {row.getVisibleCells().map((cell) => (
                          <TableCell
                            key={cell.id}
                            className={cn(
                              cell.column.id === 'is_paid' ||
                                cell.column.id === 'actions'
                                ? 'text-center'
                                : cell.column.id === 'amount'
                                  ? 'text-right'
                                  : undefined,
                              isCompact && 'p-1',
                            )}
                          >
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext()
                            )}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                    {!pinTotalsToBottom ? (
                      <>
                        <TableRow className="border-t-2 border-border/40 bg-gradient-to-r from-muted/50 to-muted/30 dark:from-muted/30 dark:to-muted/10">
                          <TableCell
                            colSpan={2}
                            className={cn(
                              'text-right',
                              isCompact ? 'py-2' : 'py-3',
                            )}
                          >
                            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">
                              Total efectivo/débito
                            </span>
                          </TableCell>
                          <TableCell
                            className={cn(
                              'text-right',
                              isCompact ? 'py-2' : 'py-3',
                            )}
                          >
                            <span
                              className={cn(
                                'font-black font-mono tabular-nums',
                                isCompact ? 'text-sm' : 'text-base',
                              )}
                            >
                              {formatCurrency(total)}
                            </span>
                          </TableCell>
                          <TableCell className={isCompact ? 'py-2' : 'py-3'} />
                        </TableRow>
                        {cardGrandTotal > 0 ? (
                          <TableRow className="border-border/30 bg-violet-50/20 dark:bg-violet-950/10">
                            <TableCell
                              colSpan={2}
                              className={cn(
                                'text-right',
                                isCompact ? 'py-1.5' : 'py-2',
                              )}
                            >
                              <span className="text-[10px] font-bold uppercase tracking-widest text-violet-600/70 dark:text-violet-400/70">
                                Cargos a tarjeta
                              </span>
                              <span className="mt-0.5 block text-[10px] font-normal text-muted-foreground/60">
                                No suman al efectivo hasta pagar el estado de cuenta
                              </span>
                            </TableCell>
                            <TableCell
                              className={cn(
                                'text-right',
                                isCompact ? 'py-1.5' : 'py-2',
                              )}
                            >
                              <span
                                className={cn(
                                  'font-bold font-mono tabular-nums text-violet-700 dark:text-violet-300',
                                  isCompact ? 'text-xs' : 'text-sm',
                                )}
                              >
                                {formatCurrency(cardGrandTotal)}
                              </span>
                            </TableCell>
                            <TableCell className={isCompact ? 'py-1.5' : 'py-2'} />
                          </TableRow>
                        ) : null}
                      </>
                    ) : null}
                  </>
                )}
              </TableBody>
            </Table>
          </div>
          {desktopTotalsPinned}
          </div>
        </CardContent>
      </Card>

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
          onSubmit={handleUpdateAmount}
          defaultAmount={toDisplayAmount(editingExpense.amount)}
          defaultWalletId={editingExpense.wallet_id ?? null}
          expenseDescription={editingExpense.description}
          expenseCategory={editingExpense.category ?? ''}
          fortnightLabel={fortnightLabel}
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
