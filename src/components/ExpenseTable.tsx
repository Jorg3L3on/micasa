'use client';

import { useState, useEffect, useRef } from 'react';
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
import { Separator } from '@/components/ui/separator';
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
import { formatCurrency } from '@/lib/utils';
import {
  updateExpensePaidStatus,
  updateExpenseAmount,
  deleteTransaction,
} from '@/lib/api';
import {
  MoreVertical,
  Pencil,
  Trash2,
  CheckCircle2,
  AlertCircle,
  CheckCircle,
  Filter,
} from 'lucide-react';
import EditExpenseAmountDialog from '@/components/EditExpenseAmountDialog';
import { ExpenseAmountFormValues } from '@/schemas/expense.schema';
import ConfirmDeleteDialog from '@/components/ConfirmDeleteDialog';

type Expense = {
  id: number;
  date: string;
  description: string;
  amount: number | string;
  category: string;
  paymentMethod: string;
  is_paid: boolean;
  due_day?: number | null;
};

type ExpenseTableProps = {
  date?: string;
  expenses: Expense[];
  onExpenseUpdate?: (expenseId: number, isPaid: boolean) => void;
  fortnightLabel?: string;
  totalIncome?: number;
};

export default function ExpenseTable({
  date,
  expenses,
  onExpenseUpdate,
  fortnightLabel = '',
  totalIncome = 0,
}: ExpenseTableProps) {
  const [updatingIds, setUpdatingIds] = useState<Set<number>>(new Set());
  const [localExpenses, setLocalExpenses] = useState<Expense[]>(expenses);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [deletingExpense, setDeletingExpense] = useState<Expense | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [payingExpense, setPayingExpense] = useState<Expense | null>(null);
  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [showOnlyPending, setShowOnlyPending] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error';
  } | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showToast = (
    message: string,
    type: 'success' | 'error' = 'success',
  ) => {
    setToast({ message, type });

    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }

    toastTimeoutRef.current = setTimeout(() => {
      setToast(null);
    }, 3500);
  };

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

  // Sync local state with props when expenses change
  useEffect(() => {
    const sorted = [...expenses].sort((a, b) => {
      // Unpaid first, then paid
      if (a.is_paid !== b.is_paid) {
        return a.is_paid ? 1 : -1;
      }
      // Within same status, sort by amount descending
      const amountA = Number(a.amount);
      const amountB = Number(b.amount);
      return amountB - amountA;
    });
    setLocalExpenses(sorted);
  }, [expenses]);

  const handlePaidToggle = async (expense: Expense, newPaidStatus: boolean) => {
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
      await updateExpensePaidStatus(expenseId, newPaidStatus);
      if (onExpenseUpdate) {
        onExpenseUpdate(expenseId, newPaidStatus);
      }
      showToast(
        newPaidStatus
          ? 'Gasto marcado como pagado.'
          : 'Gasto marcado como no pagado.',
        'success',
      );
    } catch (error) {
      setLocalExpenses(expenses);
      console.error('Error updating expense paid status:', error);
      showToast(
        'Error al actualizar el estado de pago. Por favor, intenta de nuevo.',
        'error',
      );
    } finally {
      setUpdatingIds((prev) => {
        const next = new Set(prev);
        next.delete(expenseId);
        return next;
      });
    }
  };

  const handleEditAmount = (expense: Expense) => {
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
      await updateExpenseAmount(expenseId, data.amount);
      if (onExpenseUpdate) {
        onExpenseUpdate(expenseId, editingExpense.is_paid);
      }
      setEditDialogOpen(false);
      setEditingExpense(null);
      showToast('Monto del gasto actualizado.', 'success');
    } catch (error) {
      setLocalExpenses(expenses);
      const message =
        error instanceof Error ? error.message : 'Error al actualizar el monto';
      setEditError(message);
      console.error('Error updating expense amount:', error);
      showToast(message, 'error');
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
      await deleteTransaction(expenseId);
      if (onExpenseUpdate) {
        onExpenseUpdate(expenseId, deletingExpense.is_paid);
      }
      setDeleteDialogOpen(false);
      setDeletingExpense(null);
      showToast('Gasto eliminado.', 'success');
    } catch (error) {
      setLocalExpenses(expenses);
      console.error('Error deleting expense:', error);
      showToast(
        'Error al eliminar el gasto. Por favor, intenta de nuevo.',
        'error',
      );
    } finally {
      setUpdatingIds((prev) => {
        const next = new Set(prev);
        next.delete(expenseId);
        return next;
      });
    }
  };

  const getDueInfo = (expense: Expense) => {
    const dueDayValue = expense.due_day;
    if (!dueDayValue || Number.isNaN(dueDayValue)) {
      return {
        hasDue: false,
        dueDay: null as number | null,
        daysRemaining: null as number | null,
        badgeColor: 'default' as const,
      };
    }

    const today = new Date();
    const todayDay = today.getDate();
    const daysRemaining = dueDayValue - todayDay;

    // Standardized badge colors
    let badgeColor: 'default' | 'destructive' | 'secondary' = 'default';
    if (daysRemaining < 0) {
      badgeColor = 'destructive'; // Overdue - red
    } else if (daysRemaining <= 3) {
      badgeColor = 'destructive'; // Urgent - red
    } else if (daysRemaining <= 7) {
      badgeColor = 'secondary'; // Warning - yellow/orange
    }

    return {
      hasDue: true,
      dueDay: dueDayValue,
      daysRemaining,
      badgeColor,
    };
  };

  // Filter expenses
  const displayedExpenses = showOnlyPending
    ? localExpenses.filter((e) => !e.is_paid)
    : localExpenses;

  const pendingExpenses = localExpenses.filter((e) => !e.is_paid);
  const paidExpenses = localExpenses.filter((e) => e.is_paid);

  const totalPaid = paidExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const totalPending = pendingExpenses.reduce(
    (sum, e) => sum + Number(e.amount),
    0,
  );
  const total = localExpenses.reduce((sum, e) => sum + Number(e.amount), 0);

  // Calculate progress percentage
  const progressPercentage =
    totalIncome > 0 ? Math.min((totalPaid / totalIncome) * 100, 100) : 0;

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold">
              {date ? new Date(date).toLocaleDateString('es-MX') : 'Gastos'}
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowOnlyPending(!showOnlyPending)}
              className="h-8 gap-2"
            >
              <Filter className="h-3.5 w-3.5" />
              {showOnlyPending ? 'Mostrar todos' : 'Solo pendientes'}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Progress Bar */}
          {totalIncome > 0 && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Progreso de pago</span>
                <span>{Math.round(progressPercentage)}%</span>
              </div>
              <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${progressPercentage}%` }}
                />
              </div>
            </div>
          )}

          {/* Expenses Table */}
          <div className="relative w-full overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12 text-center text-xs font-medium">
                    Estado
                  </TableHead>
                  <TableHead className="min-w-[200px] text-xs font-medium">
                    Categoría
                  </TableHead>
                  <TableHead className="text-right min-w-[120px] text-xs font-medium">
                    Monto
                  </TableHead>
                  <TableHead className="w-20 text-center text-xs font-medium">
                    Acciones
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayedExpenses.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="py-8 text-center text-sm text-muted-foreground"
                    >
                      {showOnlyPending
                        ? 'No hay gastos pendientes'
                        : 'Sin gastos'}
                    </TableCell>
                  </TableRow>
                ) : (
                  <>
                    {/* Pending Expenses Section */}
                    {!showOnlyPending && pendingExpenses.length > 0 && (
                      <>
                        {pendingExpenses.map((expense) => {
                          const { hasDue, daysRemaining, badgeColor } =
                            getDueInfo(expense);
                          const isUpdating = updatingIds.has(expense.id);

                          return (
                            <TableRow
                              key={expense.id}
                              className="hover:bg-muted/50 transition-colors"
                            >
                              <TableCell className="text-center">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => {
                                    setPayingExpense(expense);
                                    setPayDialogOpen(true);
                                  }}
                                  disabled={isUpdating}
                                  aria-label="Marcar como pagado"
                                >
                                  <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                                </Button>
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-col gap-1">
                                  <span className="font-medium text-sm">
                                    {expense.description}
                                  </span>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-xs text-muted-foreground">
                                      {expense.category} •{' '}
                                      {expense.paymentMethod}
                                    </span>
                                    {hasDue && (
                                      <Badge
                                        variant={badgeColor}
                                        className="text-[10px] h-5"
                                      >
                                        {daysRemaining !== null &&
                                        daysRemaining >= 0
                                          ? `Vence en ${daysRemaining} día${
                                              daysRemaining !== 1 ? 's' : ''
                                            }`
                                          : 'Vencido'}
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="text-right">
                                <span className="font-semibold font-mono tabular-nums text-sm">
                                  {formatCurrency(Number(expense.amount))}
                                </span>
                              </TableCell>
                              <TableCell className="text-center">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8"
                                      disabled={isUpdating}
                                    >
                                      <MoreVertical className="h-4 w-4" />
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
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                        {paidExpenses.length > 0 && (
                          <TableRow>
                            <TableCell colSpan={4} className="py-2 bg-muted/30">
                              <Separator />
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    )}

                    {/* Paid Expenses Section */}
                    {!showOnlyPending &&
                      paidExpenses.map((expense) => {
                        const { hasDue, daysRemaining, badgeColor } =
                          getDueInfo(expense);
                        const isUpdating = updatingIds.has(expense.id);

                        return (
                          <TableRow
                            key={expense.id}
                            className="bg-muted/30 opacity-75 hover:bg-muted/40"
                          >
                            <TableCell className="text-center">
                              <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 mx-auto" />
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col gap-1">
                                <span className="font-medium text-sm text-muted-foreground line-through">
                                  {expense.description}
                                </span>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-xs text-muted-foreground">
                                    {expense.category} • {expense.paymentMethod}
                                  </span>
                                  {hasDue && (
                                    <Badge
                                      variant="secondary"
                                      className="text-[10px] h-5 opacity-60"
                                    >
                                      Pagado
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <span className="font-mono tabular-nums text-sm text-muted-foreground line-through">
                                {formatCurrency(Number(expense.amount))}
                              </span>
                            </TableCell>
                            <TableCell className="text-center">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    disabled={isUpdating}
                                  >
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    onClick={() =>
                                      handlePaidToggle(expense, false)
                                    }
                                    disabled={isUpdating}
                                  >
                                    <CheckCircle2 className="mr-2 h-4 w-4" />
                                    Deshacer pago
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        );
                      })}

                    {/* Show only pending when filtered */}
                    {showOnlyPending &&
                      pendingExpenses.map((expense) => {
                        const { hasDue, daysRemaining, badgeColor } =
                          getDueInfo(expense);
                        const isUpdating = updatingIds.has(expense.id);

                        return (
                          <TableRow
                            key={expense.id}
                            className="hover:bg-muted/50 transition-colors"
                          >
                            <TableCell className="text-center">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => {
                                  setPayingExpense(expense);
                                  setPayDialogOpen(true);
                                }}
                                disabled={isUpdating}
                                aria-label="Marcar como pagado"
                              >
                                <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                              </Button>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col gap-1">
                                <span className="font-medium text-sm">
                                  {expense.description}
                                </span>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-xs text-muted-foreground">
                                    {expense.category} • {expense.paymentMethod}
                                  </span>
                                  {hasDue && (
                                    <Badge
                                      variant={badgeColor}
                                      className="text-[10px] h-5"
                                    >
                                      {daysRemaining !== null &&
                                      daysRemaining >= 0
                                        ? `Vence en ${daysRemaining} día${
                                            daysRemaining !== 1 ? 's' : ''
                                          }`
                                        : 'Vencido'}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <span className="font-semibold font-mono tabular-nums text-sm">
                                {formatCurrency(Number(expense.amount))}
                              </span>
                            </TableCell>
                            <TableCell className="text-center">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    disabled={isUpdating}
                                  >
                                    <MoreVertical className="h-4 w-4" />
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
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        );
                      })}

                    {/* Totals Row */}
                    <TableRow className="bg-muted/50 font-semibold">
                      <TableCell colSpan={2} className="text-right text-sm">
                        Total:
                      </TableCell>
                      <TableCell className="text-right text-sm font-mono">
                        {formatCurrency(total)}
                      </TableCell>
                      <TableCell />
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
          defaultAmount={Number(editingExpense.amount)}
          expenseDescription={editingExpense.description}
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
                  {formatCurrency(Number(payingExpense.amount))}
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

      {/* Toast feedback */}
      {toast && (
        <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4 sm:justify-end sm:px-6">
          <div
            className={`pointer-events-auto flex items-center gap-2 rounded-md border px-3 py-2 text-sm shadow-lg backdrop-blur ${
              toast.type === 'success'
                ? 'bg-emerald-50 border-emerald-300 text-emerald-900 dark:bg-emerald-900/90 dark:border-emerald-800 dark:text-emerald-50'
                : 'bg-destructive/10 border-destructive/70 text-destructive dark:bg-destructive/20 dark:border-destructive dark:text-destructive'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle className="h-4 w-4" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
            <span className="font-medium">{toast.message}</span>
          </div>
        </div>
      )}
    </>
  );
}
