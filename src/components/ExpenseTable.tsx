'use client';

import { useState, useEffect, useMemo } from 'react';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  updateExpensePaidStatus,
  updateExpenseAmount,
  deleteTransaction,
} from '@/lib/api';
import { MoreVertical, Pencil, Trash2, CheckCircle2, Receipt } from 'lucide-react';
import EditExpenseAmountDialog from '@/components/EditExpenseAmountDialog';
import { ExpenseAmountFormValues } from '@/schemas/expense.schema';
import ConfirmDeleteDialog from '@/components/ConfirmDeleteDialog';
import { DataTableColumnHeader } from '@/components/ui/data-table';
import { cn } from '@/lib/utils';

import type { TransactionRow } from '@/types/catalog';

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
};

export default function ExpenseTable({
  date,
  expenses,
  onExpenseUpdate,
  fortnightLabel = '',
  totalIncome = 0,
  year,
  month,
  period,
  density = 'comfortable',
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
      // Unpaid first, then paid
      if (a.is_paid !== b.is_paid) {
        return a.is_paid ? 1 : -1;
      }
      // Within same status, sort by amount descending
      const amountA = toDisplayAmount(a.amount);
      const amountB = toDisplayAmount(b.amount);
      return amountB - amountA;
    });
    setLocalExpenses(sorted);
  }, [expenses]);

  const handlePaidToggle = async (expense: TransactionRow, newPaidStatus: boolean) => {
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
      console.error('Error updating expense paid status:', error);
      toast.error(
        'Error al actualizar el estado de pago. Por favor, intenta de nuevo.',
      );
    } finally {
      setUpdatingIds((prev) => {
        const next = new Set(prev);
        next.delete(expenseId);
        return next;
      });
    }
  };

  const handleEditAmount = (expense: TransactionRow) => {
    setEditingExpense(expense);
    setEditDialogOpen(true);
    setEditError(null);
  };

  const handleUpdateAmount = async (data: ExpenseAmountFormValues) => {
    if (!editingExpense) return;

    const expenseId = editingExpense.id;
    setUpdatingIds((prev) => {
      const next = new Set(prev);
      next.add(expenseId);
      return next;
    });

    const updatedExpenses = localExpenses.map((e) =>
      e.id === expenseId ? { ...e, amount: data.amount } : e,
    );
    setLocalExpenses(updatedExpenses);

    try {
      setEditError(null);
      await updateExpenseAmount(expenseId, data.amount, context);
      if (onExpenseUpdate) {
        onExpenseUpdate(expenseId, editingExpense.is_paid);
      }
      setEditDialogOpen(false);
      setEditingExpense(null);
      toast.success('Monto del gasto actualizado.');
    } catch (error) {
      setLocalExpenses(expenses);
      const message =
        error instanceof Error ? error.message : 'Error al actualizar el monto';
      setEditError(message);
      console.error('Error updating expense amount:', error);
      toast.error(message);
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
    if (!deletingExpense) return;

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
      console.error('Error deleting expense:', error);
      toast.error(
        'Error al eliminar el gasto. Por favor, intenta de nuevo.',
      );
    } finally {
      setUpdatingIds((prev) => {
        const next = new Set(prev);
        next.delete(expenseId);
        return next;
      });
    }
  };

  const getDueInfo = (expense: TransactionRow) => {
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

    // Decide countdown / overdue behavior based on the calendar month:
    // - Past months: always "Vencido"
    // - Current month: "Vence en X días" if future, "Vencido" if past
    // - Future months: neutral "Con fecha de pago"
    let daysRemaining: number | null = null;
    let showCountdown = false;
    let isFutureMonth = false;

    // Prefer explicit year/month props (from fortnight context); fall back to row date.
    let expenseYear: number | null = null;
    let expenseMonth: number | null = null;

    if (year != null && month != null) {
      expenseYear = year;
      expenseMonth = month - 1; // JS Date month is 0-based
    } else if (date) {
      const expenseDate = new Date(date);
      if (!Number.isNaN(expenseDate.getTime())) {
        expenseYear = expenseDate.getFullYear();
        expenseMonth = expenseDate.getMonth();
      }
    }

    if (expenseYear != null && expenseMonth != null) {
      const currentYear = today.getFullYear();
      const currentMonth = today.getMonth();

      if (
        expenseYear < currentYear ||
        (expenseYear === currentYear && expenseMonth < currentMonth)
      ) {
        // Any past month -> always overdue
        daysRemaining = -1;
        showCountdown = false;
      } else if (expenseYear === currentYear && expenseMonth === currentMonth) {
        // Current month -> countdown or overdue
        daysRemaining = dueDayValue - todayDay;
        showCountdown = daysRemaining >= 0;
      } else {
        // Future month -> no badge at all
        daysRemaining = null;
        showCountdown = false;
        isFutureMonth = true;
      }
    }

    // Standardized badge colors
    let badgeColor: 'default' | 'destructive' | 'secondary' = 'default';
    if (daysRemaining !== null && daysRemaining < 0) {
      badgeColor = 'destructive'; // Overdue - red
    } else if (daysRemaining !== null && daysRemaining <= 3) {
      badgeColor = 'destructive'; // Urgent - red
    } else if (daysRemaining !== null && daysRemaining <= 7) {
      badgeColor = 'secondary'; // Warning - yellow/orange
    }

    return {
      hasDue: !isFutureMonth,
      dueDay: dueDayValue,
      daysRemaining,
      showCountdown,
      badgeColor,
    };
  };

  const pendingExpenses = localExpenses.filter((e) => !e.is_paid);
  const paidExpenses = localExpenses.filter((e) => e.is_paid);

  // Calculate totals using safe amount coercion
  const totalPaid = paidExpenses.reduce(
    (sum, e) => sum + toDisplayAmount(e.amount),
    0,
  );
  const totalPending = pendingExpenses.reduce(
    (sum, e) => sum + toDisplayAmount(e.amount),
    0,
  );

  const total = totalPaid + totalPending;
  const paidPct = total > 0 ? (totalPaid / total) * 100 : 0;
  const pendingPct = total > 0 ? (totalPending / total) * 100 : 0;

  const columns = useMemo<ColumnDef<TransactionRow>[]>(
    () => [
      {
        accessorKey: 'is_paid',
        id: 'is_paid',
        header: () => (
          <span
            className={cn(
              'text-center font-medium',
              isCompact ? 'text-[10px]' : 'text-xs',
            )}
          >
            Estado
          </span>
        ),
        cell: ({ row }) => {
          const expense = row.original;
          const isUpdating = updatingIds.has(expense.id);
          if (expense.is_paid) {
            return (
              <div className="flex justify-center">
                <CheckCircle2
                  className={cn(
                    'text-green-600 dark:text-green-400',
                    isCompact ? 'h-4 w-4' : 'h-5 w-5',
                  )}
                />
              </div>
            );
          }
          return (
            <div className="flex justify-center">
              <Button
                variant="ghost"
                size="icon"
                className={cn(isCompact ? 'h-7 w-7' : 'h-8 w-8')}
                onClick={() => {
                  setPayingExpense(expense);
                  setPayDialogOpen(true);
                }}
                disabled={isUpdating}
                aria-label="Marcar como pagado"
              >
                <CheckCircle2
                  className={cn(
                    'text-muted-foreground',
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
          const { hasDue, daysRemaining, showCountdown, badgeColor } =
            getDueInfo(expense);
          return (
            <div
              className={cn(
                'flex flex-col gap-1',
                isCompact ? 'min-w-[160px]' : 'min-w-[200px]',
              )}
            >
              <span
                className={cn(
                  'font-medium',
                  isCompact ? 'text-xs' : 'text-sm',
                  expense.is_paid && 'text-muted-foreground line-through',
                )}
              >
                {expense.description}
              </span>
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={cn(
                    'text-muted-foreground',
                    isCompact ? 'text-[10px]' : 'text-xs',
                  )}
                >
                  {expense.category} • {expense.paymentMethod}
                </span>
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
                      ? 'Pagado'
                      : showCountdown && daysRemaining !== null && daysRemaining >= 0
                        ? `Vence en ${daysRemaining} día${
                            daysRemaining !== 1 ? 's' : ''
                          }`
                        : daysRemaining !== null && daysRemaining < 0
                          ? 'Vencido'
                          : 'Con fecha de pago'}
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
              'text-right min-w-[120px] font-medium',
              isCompact ? 'text-[10px]' : 'text-xs',
            )}
          />
        ),
        cell: ({ row }) => (
          <span
            className={cn(
              'text-right font-mono tabular-nums',
              isCompact ? 'text-xs' : 'text-sm',
              row.original.is_paid && 'text-muted-foreground line-through',
            )}
          >
            {formatCurrency(toDisplayAmount(row.original.amount))}
          </span>
        ),
        enableSorting: true,
      },
      {
        id: 'actions',
        header: () => (
          <span
            className={cn(
              'text-center font-medium',
              isCompact ? 'text-[10px]' : 'text-xs',
            )}
          >
            Acciones
          </span>
        ),
        cell: ({ row }) => {
          const expense = row.original;
          const isUpdating = updatingIds.has(expense.id);
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
                    Modificar monto
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
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <>
      <Card className="overflow-hidden border-border/60">
        <CardContent className="px-0 pb-3 pt-0 space-y-0">
          <div className="relative w-full">
            <Table className={isCompact ? 'text-xs' : undefined}>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead
                        key={header.id}
                        className={cn(
                          header.id === 'is_paid'
                            ? 'w-12 text-center'
                            : header.id === 'amount'
                              ? 'text-right min-w-[120px]'
                              : header.id === 'actions'
                                ? 'w-20 text-center'
                                : isCompact
                                  ? 'min-w-[160px]'
                                  : 'min-w-[200px]',
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
              isCompact ? 'max-h-[min(380px,55vh)]' : 'max-h-[380px]',
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
                        key={row.id}
                        className={cn(
                          'transition-colors',
                          row.original.is_paid
                            ? 'bg-muted/30 opacity-75 hover:bg-muted/40'
                            : 'hover:bg-muted/50',
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
                    <TableRow className="border-t-2 border-border/60 bg-muted/30">
                      <TableCell
                        colSpan={2}
                        className={cn(
                          'text-right',
                          isCompact ? 'py-2' : 'py-2.5',
                        )}
                      >
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          Total gastos
                        </span>
                      </TableCell>
                      <TableCell
                        className={cn(
                          'text-right',
                          isCompact ? 'py-2' : 'py-2.5',
                        )}
                      >
                        <span
                          className={cn(
                            'font-bold font-mono tabular-nums',
                            isCompact ? 'text-xs' : 'text-sm',
                          )}
                        >
                          {formatCurrency(total)}
                        </span>
                      </TableCell>
                      <TableCell className={isCompact ? 'py-2' : 'py-2.5'} />
                    </TableRow>
                  </>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Edit Expense Amount Dialog */}
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
          expenseDescription={editingExpense.description}
          expenseCategory={editingExpense.category ?? ''}
          fortnightLabel={fortnightLabel}
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
