'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import ExpenseTable from '@/components/ExpenseTable';
import SummaryBlock from '@/components/SummaryBlock';
import EmptyState from '@/components/EmptyState';
import EditFortnightAmountDialog from '@/components/EditFortnightAmountDialog';
import AddExpenseDialog from '@/components/AddExpenseDialog';
import { OverrideAmountFormValues } from '@/schemas/fortnight.schema';
import { AddExpenseFormValues } from '@/schemas/transaction.schema';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import FortnightCardPaymentsPanel from '@/components/planner/FortnightCardPaymentsPanel';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { BarChart3, Loader2, MoreVertical, Plus, RefreshCw } from 'lucide-react';
import { useFinanceContext } from '@/context/finance-context';
import {
  buildOwnerQuery,
  clientFetchFromApi,
  updateFortnightOverrideAmount,
  updateIncomeAmount,
  createExpenseTransaction,
  createExpenseTemplate,
} from '@/lib/api';
import type { DuePaymentItem, TransactionRow } from '@/types/catalog';
import type { ExpenseTableDensity } from '@/components/ExpenseTable';

const fortnightTabStorageKey = (p: 'FIRST' | 'SECOND') =>
  `micasa.planificacion.fortnightTab.${p}`;

type IncomeItemBySource = {
  fortnightId: number;
  id: number;
  amount: number;
  source: string | null;
  userName: string | null;
  templateName: string | null;
};

type Summary = {
  totalIncome: number;
  totalExpense: number;
  totalPaid: number;
  totalUnpaid: number;
  balance: number;
  userIncome?: Array<{
    fortnightId: number;
    userIncome: Array<{ userId: number; userName: string; income: number }>;
  }>;
  incomeItems?: IncomeItemBySource[];
};

type FortnightColumnProps = {
  label: string;
  transactions: TransactionRow[];
  summary: Summary;
  fortnightId: number;
  year: number;
  month: number;
  period: 'FIRST' | 'SECOND';
  showSummaryCard?: boolean;
  onShowSummaryCard?: () => void;
  tableDensity?: ExpenseTableDensity;
  cardDueItems?: DuePaymentItem[];
};

export default function FortnightColumn({
  label,
  transactions: initialTransactions,
  summary: initialSummary,
  fortnightId,
  year,
  month,
  period,
  showSummaryCard = true,
  onShowSummaryCard,
  tableDensity = 'comfortable',
  cardDueItems = [],
}: FortnightColumnProps) {
  const { context } = useFinanceContext();
  const ownerQueryString = useMemo(() => {
    const q = buildOwnerQuery(context);
    const s = q.toString();
    return s ? `?${s}` : '';
  }, [context]);
  const router = useRouter();
  const [transactions, setTransactions] =
    useState<TransactionRow[]>(initialTransactions);
  const [summary, setSummary] = useState<Summary>(initialSummary);
  const [overrideDialogOpen, setOverrideDialogOpen] = useState(false);
  const [overrideError, setOverrideError] = useState<string | null>(null);
  const [editingIncomeId, setEditingIncomeId] = useState<number | null>(null);
  const [editingIncomeAmount, setEditingIncomeAmount] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [addExpenseDialogOpen, setAddExpenseDialogOpen] = useState(false);
  const [addExpenseError, setAddExpenseError] = useState<string | null>(null);
  const [columnTab, setColumnTab] = useState<'expenses' | 'cards'>('expenses');

  useEffect(() => {
    try {
      const raw = localStorage.getItem(fortnightTabStorageKey(period));
      if (raw === 'cards' || raw === 'expenses') {
        setColumnTab(raw);
      } else {
        setColumnTab('expenses');
      }
    } catch {
      setColumnTab('expenses');
    }
  }, [period]);

  const handleColumnTabChange = useCallback((value: string) => {
    if (value !== 'expenses' && value !== 'cards') return;
    setColumnTab(value);
    try {
      localStorage.setItem(fortnightTabStorageKey(period), value);
    } catch {
      /* ignore */
    }
  }, [period]);

  // Atajo: tecla "A" abre agregar gasto (solo pestaña Gastos); ignorar si hay diálogo abierto o el foco está en un campo editable.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (columnTab !== 'expenses') return;
      if (e.defaultPrevented) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key !== 'a' && e.key !== 'A') return;
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const tag = target.tagName;
      if (
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        target.isContentEditable
      ) {
        return;
      }
      if (overrideDialogOpen || addExpenseDialogOpen) return;
      if (!fortnightId || fortnightId <= 0) return;
      e.preventDefault();
      setAddExpenseDialogOpen(true);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [columnTab, overrideDialogOpen, addExpenseDialogOpen, fortnightId]);

  const refreshData = useCallback(async () => {
    try {
      setIsRefreshing(true);
      const [transactionsData, summaryData] = await Promise.all([
        clientFetchFromApi<TransactionRow[]>(
          `/api/transactions?year=${year}&month=${String(month).padStart(2, '0')}&period=${period}&type=expense`,
          undefined,
          context,
        ),
        clientFetchFromApi<Summary>(
          `/api/reports?type=summary&year=${year}&month=${String(month).padStart(2, '0')}&period=${period}`,
          undefined,
          context,
        ),
      ]);
      setTransactions(transactionsData);
      setSummary(summaryData);
      // Also refresh the page to update server-rendered data like wallet balances
      router.refresh();
    } catch (error) {
      console.error('Error refreshing data:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, [year, month, period, context, router]);

  const handleExpenseUpdate = useCallback(
    async (expenseId: number, isPaid: boolean) => {
      // Update local state optimistically
      setTransactions((prev) =>
        prev.map((t) => (t.id === expenseId ? { ...t, is_paid: isPaid } : t)),
      );

      // Refresh summary to recalculate totals
      await refreshData();
    },
    [refreshData],
  );

  const handleOverrideAmount = async (data: OverrideAmountFormValues) => {
    try {
      setOverrideError(null);
      if (editingIncomeId != null) {
        await updateIncomeAmount(editingIncomeId, data.amount, context);
        await refreshData();
        setOverrideDialogOpen(false);
        setEditingIncomeId(null);
        toast.success('Monto del ingreso actualizado.');
      } else {
        await updateFortnightOverrideAmount(
          fortnightId,
          {
            amount: data.amount,
            year,
            month,
          },
          context,
        );
        await refreshData();
        setOverrideDialogOpen(false);
        toast.success('Ingresos actualizados para esta quincena.');
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Error al guardar el monto';
      setOverrideError(message);
      toast.error(message);
      throw err;
    }
  };

  const handleOpenOverrideDialog = () => {
    setEditingIncomeId(null);
    setOverrideError(null);
    setOverrideDialogOpen(true);
  };

  const handleOpenEditIncomeSource = (id: number, amount: number) => {
    setEditingIncomeId(id);
    setEditingIncomeAmount(amount);
    setOverrideError(null);
    setOverrideDialogOpen(true);
  };

  const handleAddExpense = async (data: AddExpenseFormValues) => {
    try {
      setAddExpenseError(null);

      if (!fortnightId || fortnightId <= 0) {
        setAddExpenseError(
          'No se pudo cargar la quincena. Recarga la página o vuelve al plan mensual.',
        );
        throw new Error('Quincena no disponible');
      }
      if (!data.amount || data.amount <= 0) {
        setAddExpenseError('El monto debe ser mayor a 0.');
        throw new Error('El monto debe ser mayor a 0.');
      }
      if (!data.categoryId || data.categoryId <= 0) {
        setAddExpenseError('Selecciona una categoría.');
        throw new Error('Selecciona una categoría.');
      }
      if (!data.paymentMethodId || data.paymentMethodId <= 0) {
        setAddExpenseError('Selecciona un método de pago.');
        throw new Error('Selecciona un método de pago.');
      }

      const fromTemplateId =
        (data as AddExpenseFormValues & { expenseTemplateId?: number | null })
          .expenseTemplateId ?? null;

      // Helper to get the other fortnight ID
      const getOtherFortnightId = async (): Promise<number | null> => {
        const otherPeriod = period === 'FIRST' ? 'SECOND' : 'FIRST';
        try {
          const response = await clientFetchFromApi<{
            id: number;
            label: string;
            year: number;
            month: number;
            period: string;
          }>(
            `/api/fortnights?year=${year}&month=${String(month).padStart(2, '0')}&period=${otherPeriod}`,
            undefined,
            context,
          );
          return response.id;
        } catch (error) {
          console.error('Error fetching other fortnight:', error);
          return null;
        }
      };

      // Helper to get default date for a fortnight
      const getDateForFortnight = (
        targetPeriod: 'FIRST' | 'SECOND',
      ): string => {
        const day = targetPeriod === 'FIRST' ? 1 : 16;
        const date = new Date(year, month - 1, day);
        return date.toISOString().split('T')[0];
      };

      if (fromTemplateId) {
        await createExpenseTransaction(
          {
            fortnight_id: fortnightId,
            category_id: data.categoryId,
            description: data.name,
            amount: data.amount,
            payment_method_id: data.paymentMethodId,
            is_paid: data.isPaid,
            payment_date: data.date ? `${data.date}T00:00:00.000Z` : null,
            expense_template_id: fromTemplateId,
          },
          context,
        );
      } else if (!data.isRecurring) {
        // Case 1: Non-recurring expense - create only one expense
        await createExpenseTransaction(
          {
            fortnight_id: fortnightId,
            category_id: data.categoryId,
            description: data.name,
            amount: data.amount,
            payment_method_id: data.paymentMethodId,
            is_paid: data.isPaid,
            payment_date: data.date ? `${data.date}T00:00:00.000Z` : null,
          },
          context,
        );
      } else if (data.isRecurring && !data.applyToBothFortnights) {
        // Case 2: Recurring, single fortnight - create expense + template
        // Extract day from date for per-quincena due
        const dateObj = data.date
          ? new Date(data.date)
          : new Date(year, month - 1, period === 'FIRST' ? 1 : 16);
        const dueFromDate = dateObj.getDate();
        const dueDayFirst =
          period === 'FIRST' ? dueFromDate : null;
        const dueDaySecond =
          period === 'SECOND' ? dueFromDate : null;
        // First create the template
        const templateResponse = await createExpenseTemplate(
          {
            name: data.name,
            categoryId: data.categoryId,
            defaultAmount: data.amount,
            paymentMethodId: data.paymentMethodId,
            active: true,
            dueDayFirst,
            dueDaySecond,
            cutoffDay: null,
            isRecurring: true,
            appliesFirstFortnight: period === 'FIRST',
            appliesSecondFortnight: period === 'SECOND',
            isSubscription: false,
          },
          context,
        );
        const template = templateResponse as { id: number };

        // Then create the expense linked to the template
        await createExpenseTransaction(
          {
            fortnight_id: fortnightId,
            category_id: data.categoryId,
            description: data.name,
            amount: data.amount,
            payment_method_id: data.paymentMethodId,
            is_paid: data.isPaid,
            payment_date: data.date ? `${data.date}T00:00:00.000Z` : null,
            expense_template_id: template.id,
          },
          context,
        );
      } else {
        // Case 3: Recurring, both fortnights - create two expenses + one template
        const otherFortnightId = await getOtherFortnightId();
        if (!otherFortnightId) {
          throw new Error(
            'No se pudo obtener la información de la otra quincena',
          );
        }

        const otherPeriod = period === 'FIRST' ? 'SECOND' : 'FIRST';
        const dateObj = data.date
          ? new Date(data.date)
          : new Date(year, month - 1, period === 'FIRST' ? 1 : 16);
        const currentDue = dateObj.getDate();
        const otherDue = new Date(getDateForFortnight(otherPeriod)).getDate();
        const dueDayFirst =
          period === 'FIRST' ? currentDue : otherDue;
        const dueDaySecond =
          period === 'FIRST' ? otherDue : currentDue;
        // First create the template
        const templateResponse = await createExpenseTemplate(
          {
            name: data.name,
            categoryId: data.categoryId,
            defaultAmount: data.amount,
            paymentMethodId: data.paymentMethodId,
            active: true,
            dueDayFirst,
            dueDaySecond,
            cutoffDay: null,
            isRecurring: true,
            appliesFirstFortnight: true,
            appliesSecondFortnight: true,
            isSubscription: false,
          },
          context,
        );
        const template = templateResponse as { id: number };

        // Create expense for current fortnight
        await createExpenseTransaction(
          {
            fortnight_id: fortnightId,
            category_id: data.categoryId,
            description: data.name,
            amount: data.amount,
            payment_method_id: data.paymentMethodId,
            is_paid: data.isPaid,
            payment_date: data.date ? `${data.date}T00:00:00.000Z` : null,
            expense_template_id: template.id,
          },
          context,
        );

        // Create expense for the other fortnight
        const otherDate = getDateForFortnight(otherPeriod);
        await createExpenseTransaction(
          {
            fortnight_id: otherFortnightId,
            category_id: data.categoryId,
            description: data.name,
            amount: data.amount,
            payment_method_id: data.paymentMethodId,
            is_paid: data.isPaid,
            payment_date: otherDate ? new Date(otherDate).toISOString() : null,
            expense_template_id: template.id,
          },
          context,
        );
      }

      // Refresh data
      await refreshData();

      // If applied to both fortnights, refresh the server-side data to update both columns
      if (data.isRecurring && data.applyToBothFortnights) {
        router.refresh();
      }

      setAddExpenseDialogOpen(false);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Error al crear el gasto';
      setAddExpenseError(message);
      throw err;
    }
  };

  const handleRegenerateFromTemplates = async () => {
    try {
      setAddExpenseError(null);

      if (!fortnightId || fortnightId <= 0) {
        toast.error(
          'No se pudo regenerar la quincena. Recarga la página o vuelve al plan mensual.',
        );
        return;
      }

      await clientFetchFromApi(
        `/api/fortnights/${fortnightId}/regenerate-from-templates`,
        {
          method: 'POST',
        },
        context,
      );

      await refreshData();
      router.refresh();
      toast.success('Quincena regenerada desde plantillas.');
    } catch (error) {
      console.error('Error regenerating fortnight from templates:', error);
      const message =
        error instanceof Error
          ? error.message
          : 'Error al regenerar la quincena desde plantillas';
      setAddExpenseError(message);
      toast.error(message);
    }
  };

  const tenemos = summary.totalIncome;
  const libre = summary.balance;
  const pagado = summary.totalPaid;
  const pendiente = summary.totalUnpaid;

  // Filter user income for this specific fortnight
  const currentFortnightUserIncome =
    summary.userIncome && summary.userIncome.length > 0
      ? summary.userIncome.filter((ui) => ui.fortnightId === fortnightId)
      : undefined;

  const sortedTransactions = useMemo(
    () =>
      [...transactions].sort((a, b) => {
        if (a.is_paid !== b.is_paid) {
          return a.is_paid ? 1 : -1;
        }
        const amountA = Number(a.amount);
        const amountB = Number(b.amount);
        return amountB - amountA;
      }),
    [transactions],
  );

  return (
    <>
      <div className="flex flex-col space-y-4">
        {/* Summary card (toggle desde la barra de planificación) */}
        {showSummaryCard ? (
          <div className="sticky top-16 z-10">
            <SummaryBlock
              tenemos={tenemos}
              libre={libre}
              pagado={pagado}
              pendiente={pendiente}
              userIncome={currentFortnightUserIncome}
              incomeItems={
                summary.incomeItems?.filter((i) => i.fortnightId === fortnightId) ??
                []
              }
              year={year}
              month={month}
              period={period}
              expenseCount={transactions.length}
              paidExpenseCount={transactions.filter((t) => t.is_paid).length}
              unpaidExpenseCount={transactions.filter((t) => !t.is_paid).length}
              onEditIncome={handleOpenOverrideDialog}
              onEditIncomeSource={handleOpenEditIncomeSource}
            />
          </div>
        ) : (
          <div className="sticky top-16 z-10">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5 border-dashed"
              onClick={onShowSummaryCard}
              aria-label={`Mostrar resumen de la quincena: ${label}`}
            >
              <BarChart3 className="h-3.5 w-3.5 shrink-0" />
              Mostrar resumen
            </Button>
          </div>
        )}

        {/* Primary actions: junto al resumen, antes de la tabla */}
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAddExpenseDialogOpen(true)}
                disabled={!fortnightId || fortnightId <= 0}
                className="gap-1.5"
                aria-label="Agregar gasto a esta quincena"
                title={
                  !fortnightId || fortnightId <= 0
                    ? 'La quincena no está disponible. Recarga la página.'
                    : undefined
                }
              >
                <Plus className="h-3.5 w-3.5" />
                Agregar gasto
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={4}>
              Atajo: tecla A
            </TooltipContent>
          </Tooltip>
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    disabled={!fortnightId || fortnightId <= 0}
                    aria-label="Más acciones de esta quincena"
                  >
                    <MoreVertical className="h-4 w-4" aria-hidden />
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={4}>
                Más acciones
              </TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="end" className="min-w-48">
              <DropdownMenuItem
                disabled={
                  !fortnightId || fortnightId <= 0 || isRefreshing
                }
                onSelect={() => {
                  void handleRegenerateFromTemplates();
                }}
              >
                {isRefreshing ? (
                  <Loader2
                    className="h-4 w-4 shrink-0 animate-spin"
                    aria-hidden
                  />
                ) : (
                  <RefreshCw className="h-4 w-4 shrink-0" aria-hidden />
                )}
                Regenerar desde plantillas
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <Tabs
          value={columnTab}
          onValueChange={handleColumnTabChange}
          className="w-full min-w-0"
        >
          <TabsList
            variant="line"
            className="mb-2 h-auto w-full justify-start gap-1 rounded-none border-b border-border/60 bg-transparent p-0 sm:max-w-md"
          >
            <TabsTrigger
              value="expenses"
              className="rounded-none border-b-2 border-transparent px-3 py-2 text-xs font-medium data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none sm:text-sm"
            >
              Gastos
            </TabsTrigger>
            <TabsTrigger
              value="cards"
              className="rounded-none border-b-2 border-transparent px-3 py-2 text-xs font-medium data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none sm:text-sm"
            >
              Pagos tarjeta
            </TabsTrigger>
          </TabsList>

          <TabsContent value="expenses" className="mt-0 outline-none">
            <div className="max-h-[min(52vh,28rem)] overflow-y-auto scrollbar-hide sm:max-h-[min(58vh,36rem)] lg:max-h-[min(72vh,56rem)]">
              {sortedTransactions.length === 0 ? (
                <EmptyState
                  message="Sin gastos en esta quincena"
                  description="Empieza con un gasto para ver totales y el estado del mes."
                  action={{
                    label: 'Agregar primer gasto',
                    onClick: () => setAddExpenseDialogOpen(true),
                    variant: 'default',
                  }}
                />
              ) : (
                <ExpenseTable
                  expenses={sortedTransactions}
                  onExpenseUpdate={handleExpenseUpdate}
                  fortnightLabel={label}
                  totalIncome={tenemos}
                  year={year}
                  month={month}
                  period={period}
                  density={tableDensity}
                />
              )}
            </div>
          </TabsContent>

          <TabsContent value="cards" className="mt-0 outline-none">
            <div className="max-h-[min(52vh,28rem)] overflow-y-auto scrollbar-hide sm:max-h-[min(58vh,36rem)] lg:max-h-[min(72vh,56rem)]">
              <FortnightCardPaymentsPanel
                items={cardDueItems}
                ownerQueryString={ownerQueryString}
                fortnightLabel={label}
                isCompact={tableDensity === 'compact'}
              />
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Override Amount Dialog */}
      <EditFortnightAmountDialog
        open={overrideDialogOpen}
        onOpenChange={(open) => {
          setOverrideDialogOpen(open);
          if (!open) setEditingIncomeId(null);
          setOverrideError(null);
        }}
        onSubmit={handleOverrideAmount}
        defaultAmount={
          editingIncomeId != null ? editingIncomeAmount : tenemos
        }
        fortnightLabel={label}
        error={overrideError && overrideDialogOpen ? overrideError : null}
      />

      {/* Add Expense Dialog */}
      <AddExpenseDialog
        open={addExpenseDialogOpen}
        onOpenChange={(open) => {
          setAddExpenseDialogOpen(open);
          setAddExpenseError(null);
        }}
        onSubmit={handleAddExpense}
        fortnightLabel={label}
        fortnightId={fortnightId}
        year={year}
        month={month}
        period={period}
        error={addExpenseError && addExpenseDialogOpen ? addExpenseError : null}
      />
    </>
  );
}
