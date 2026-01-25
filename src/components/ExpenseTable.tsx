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
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
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
  CheckCircle,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import EditExpenseAmountDialog, {
  ExpenseAmountFormValues,
} from '@/components/EditExpenseAmountDialog';
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
};

export default function ExpenseTable({
  date,
  expenses,
  onExpenseUpdate,
  fortnightLabel = '',
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

  // Sync local state with props when expenses change and sort them
  useEffect(() => {
    // Sort expenses: unpaid first (by amount descending), then paid (by amount descending)
    const sorted = [...expenses].sort((a, b) => {
      // First, separate paid and unpaid
      if (a.is_paid !== b.is_paid) {
        // Unpaid (false) comes before paid (true)
        return a.is_paid ? 1 : -1;
      }
      // Within the same paid status, sort by amount descending
      const amountA = Number(a.amount);
      const amountB = Number(b.amount);
      return amountB - amountA;
    });
    setLocalExpenses(sorted);
  }, [expenses]);

  const handlePaidToggle = async (expense: Expense, newPaidStatus: boolean) => {
    const expenseId = expense.id;
    setUpdatingIds((prev) => new Set(prev).add(expenseId));

    // Optimistic update
    const updatedExpenses = localExpenses.map((e) =>
      e.id === expenseId ? { ...e, is_paid: newPaidStatus } : e,
    );
    setLocalExpenses(updatedExpenses);

    try {
      await updateExpensePaidStatus(expenseId, newPaidStatus);
      // Notify parent to refresh summary
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
      // Revert on error
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
    setUpdatingIds((prev) => new Set(prev).add(expenseId));

    // Optimistic update
    const updatedExpenses = localExpenses.map((e) =>
      e.id === expenseId ? { ...e, amount: data.amount } : e,
    );
    setLocalExpenses(updatedExpenses);

    try {
      setEditError(null);
      await updateExpenseAmount(expenseId, data.amount);
      // Notify parent to refresh summary
      if (onExpenseUpdate) {
        // Trigger a refresh by calling with the same paid status
        onExpenseUpdate(expenseId, editingExpense.is_paid);
      }
      setEditDialogOpen(false);
      setEditingExpense(null);
      showToast('Monto del gasto actualizado.', 'success');
    } catch (error) {
      // Revert on error
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
    setUpdatingIds((prev) => new Set(prev).add(expenseId));

    // Optimistic update - remove from local state
    const updatedExpenses = localExpenses.filter((e) => e.id !== expenseId);
    setLocalExpenses(updatedExpenses);

    try {
      await deleteTransaction(expenseId);
      // Notify parent to refresh summary
      if (onExpenseUpdate) {
        // Trigger a refresh by calling with the same paid status
        onExpenseUpdate(expenseId, deletingExpense.is_paid);
      }
      setDeleteDialogOpen(false);
      setDeletingExpense(null);
      showToast('Gasto eliminado.', 'success');
    } catch (error) {
      // Revert on error
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

  const total = localExpenses.reduce((sum, expense) => {
    return sum + Number(expense.amount);
  }, 0);

  const getDueInfo = (expense: Expense) => {
    const dueDayValue = expense.due_day;

    if (!dueDayValue || Number.isNaN(dueDayValue)) {
      return {
        hasDue: false,
        dueDay: null as number | null,
        daysRemaining: null as number | null,
        badgeVariant: 'default' as const,
      };
    }

    const today = new Date();
    const todayDay = today.getDate();
    const daysRemaining = dueDayValue - todayDay;

    // For now we only change badge color based on paid/unpaid.
    const badgeVariant = expense.is_paid
      ? ('success' as const)
      : ('warning' as const);

    return {
      hasDue: true,
      dueDay: dueDayValue,
      daysRemaining,
      badgeVariant,
    };
  };

  return (
    <Card className="shadow-sm rounded-lg border border-border/60 overflow-hidden">
      <CardContent className="pt-2 px-0 pb-0">
        <div className="relative w-full overflow-x-auto text-xs sm:text-sm">
          <Table className="min-w-[520px]">
            <TableHeader className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80">
              <TableRow>
                <TableHead className="w-10 text-center text-[11px] font-medium">
                  Estado
                </TableHead>
                <TableHead className="min-w-[180px] text-[11px] font-medium">
                  Concepto
                </TableHead>
                <TableHead className="text-right min-w-[140px] text-[11px] font-medium">
                  Monto
                </TableHead>
                <TableHead className="w-10 text-center text-[11px] font-medium">
                  Acciones
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {localExpenses.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="py-6 text-center text-xs text-muted-foreground"
                  >
                    Sin gastos
                  </TableCell>
                </TableRow>
              ) : (
                <>
                  {localExpenses.map((expense) => {
                    const { hasDue, daysRemaining, badgeVariant } =
                      getDueInfo(expense);
                    const isUpdating = updatingIds.has(expense.id);

                    const baseRowClasses =
                      'transition-colors duration-200 border-b last:border-b-0';
                    const hoverClasses = 'hover:bg-muted/60 cursor-default';
                    const paidAccent =
                      expense.is_paid &&
                      'bg-emerald-50/70 dark:bg-emerald-900/20';

                    return (
                      <TableRow
                        key={expense.id}
                        className={`${baseRowClasses} ${hoverClasses} ${paidAccent}`}
                      >
                        <TableCell className="align-middle text-center px-2">
                          {expense.is_paid ? (
                            <div className="flex items-center justify-center">
                              <CheckCircle
                                className="h-5 w-5 text-emerald-500"
                                aria-label="Pagado"
                              />
                            </div>
                          ) : (
                            <div className="flex items-center justify-center">
                              <Checkbox
                                checked={false}
                                disabled={isUpdating}
                                onCheckedChange={() => {
                                  setPayingExpense(expense);
                                  setPayDialogOpen(true);
                                }}
                                className="data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500 transition-colors"
                              />
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-xs sm:text-sm max-w-xs">
                          <div className="flex flex-col gap-0.5">
                            <span className="font-medium text-foreground truncate sm:whitespace-normal sm:line-clamp-2">
                              {expense.description}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {expense.category} • {expense.paymentMethod}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right text-xs sm:text-sm align-middle">
                          <div className="flex flex-col items-end gap-1">
                            <span
                              className={`font-mono tabular-nums ${
                                expense.is_paid
                                  ? 'text-muted-foreground line-through'
                                  : 'font-semibold text-foreground'
                              }`}
                            >
                              {formatCurrency(Number(expense.amount))}
                            </span>
                            {hasDue && (
                              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                                <Badge
                                  variant={badgeVariant}
                                  size="sm"
                                  className="uppercase tracking-wide"
                                >
                                  {daysRemaining !== null &&
                                  daysRemaining >= 0
                                    ? `Faltan ${daysRemaining} días`
                                    : 'Vencido'}
                                </Badge>
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-center px-1">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 sm:h-9 sm:w-9 rounded-full hover:bg-accent/70"
                                disabled={isUpdating}
                                aria-label="Más acciones"
                              >
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-40">
                              {expense.is_paid ? (
                                <DropdownMenuItem
                                  onClick={() => handlePaidToggle(expense, false)}
                                  disabled={isUpdating}
                                >
                                  <CheckCircle2 className="mr-2" />
                                  <span>Deshacer pago</span>
                                </DropdownMenuItem>
                              ) : (
                                <>
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setPayingExpense(expense);
                                      setPayDialogOpen(true);
                                    }}
                                    disabled={isUpdating}
                                  >
                                    <CheckCircle2 className="mr-2" />
                                    <span>Pagar gasto</span>
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => handleEditAmount(expense)}
                                    disabled={isUpdating}
                                  >
                                    <Pencil className="mr-2" />
                                    <span>Modificar monto</span>
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setDeletingExpense(expense);
                                      setDeleteDialogOpen(true);
                                    }}
                                    disabled={isUpdating}
                                    className="text-destructive focus:text-destructive"
                                  >
                                    <Trash2 className="mr-2" />
                                    <span>Eliminar</span>
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  <TableRow className="bg-muted/70 font-semibold">
                    <TableCell colSpan={2} className="text-right text-sm">
                      Total:
                    </TableCell>
                    <TableCell className="text-right text-sm">
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

      {/* Local toast feedback */}
      {toast && (
        <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4 sm:justify-end sm:px-6">
          <div
            className={`pointer-events-auto flex items-center gap-2 rounded-md border px-3 py-2 text-sm shadow-lg bg-background/95 backdrop-blur ${
              toast.type === 'success'
                ? 'border-emerald-300 text-emerald-900 dark:border-emerald-800 dark:text-emerald-50'
                : 'border-destructive/70 text-destructive dark:border-destructive'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle className="h-4 w-4" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
            <span>{toast.message}</span>
          </div>
        </div>
      )}
    </Card>
  );
}
