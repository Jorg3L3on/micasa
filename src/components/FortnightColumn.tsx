'use client';

import { todayCalendarDate } from '@/lib/calendar-dates';
import { getDefaultDateForFortnight } from '@/lib/fortnight-calendar';
import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { toast } from 'sonner';
import ExpenseTable from '@/components/ExpenseTable';
import SummaryBlock from '@/components/SummaryBlock';
import EditFortnightAmountDialog from '@/components/EditFortnightAmountDialog';
import AddTransactionDialog from '@/components/transactions/AddTransactionDialog';
import { OverrideAmountFormValues } from '@/schemas/fortnight.schema';
import { AddExpenseFormValues, AddIncomeFormValues } from '@/schemas/transaction.schema';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TabsContent } from '@/components/motion/tabs';
import { SegmentedControl } from '@/components/segmented-control';
import CreditCardPaymentDialog from '@/components/credit-cards/CreditCardPaymentDialog';
import type { CreditCardPaymentSubmitPayload } from '@/components/credit-cards/CreditCardPaymentDialog';
import FortnightCardPaymentsPanel from '@/components/planner/FortnightCardPaymentsPanel';
import { periodObligationPrefillAmount } from '@/lib/finance/card-period-obligation';
import { panelSnapshotFromDueItem } from '@/lib/finance/card-period-surfaces';
import FortnightLoanPaymentsPanel from '@/components/planner/FortnightLoanPaymentsPanel';
import {
  GLASS_TAB_ACTIVE_LABEL_CLASS,
  AURA_TAB_INDICATOR_CLASS,
  MONTHLY_LIQUID_PANEL_CLASS,
} from '@/components/monthly/monthly-panel-shell';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Banknote,
  CreditCard,
  HandCoins,
  Receipt,
  RefreshCw,
} from 'lucide-react';
import {
  PLANNER_LIST_SORT_FIELD_LABELS,
  nextPlannerListSortPreference,
  plannerListSortDisplayLabel,
  readPlannerListSortPreference,
  sortExpenseListRows,
  writePlannerListSortPreference,
  type PlannerListSortDir,
  type PlannerListSortMode,
} from '@/lib/finance/planner-list-sort';
import { presentFortnightExpenseTab } from '@/lib/finance/fortnight-expense-tab';
import { useFinanceContext } from '@/context/finance-context';
import { useRegisterToolbarOverflow } from '@/context/toolbar-actions-context';
import {
  buildOwnerQuery,
  clientFetchFromApi,
  type ClientApiError,
} from '@/lib/api/client-fetch';
import { createCreditCardPayment } from '@/lib/api/credit-cards';
import { createExpenseTemplate } from '@/lib/api/expense-templates';
import { createWalletIncome, updateIncomeAmount } from '@/lib/api/incomes';
import {
  createExpenseTransaction,
  updateFortnightOverrideAmount,
} from '@/lib/api/transactions';
import { getPaymentMethodOptions } from '@/lib/api/wallets';
import { ReceivePayrollButton } from '@/components/ReceivePayrollButton';
import type {
  DuePaymentItem,
  PaymentMethodOption,
  PlannerCardChargesSummary,
  PlannerCardStatementDueSummary,
  PlannerOrphanCardPaymentsSummary,
  PlannerPayrollLoanDeductionSummary,
  PlannerWalletLoanDueSummary,
  ReportsSummaryFundingFields,
  TransactionRow,
} from '@/types/catalog';
import type { ExpenseTableDensity } from '@/components/ExpenseTable';
import type { WalletListItem } from '@/types/catalog';
import type { LoanDuePaymentItem } from '@/types/loans';
import type { MonthlyBudgetPanelResult } from '@/types/monthly-budget-panel';
import { cn } from '@/lib/utils';
import { getPendingLiquidityLineItems } from '@/lib/finance/pending-liquidity-items';

const fortnightTabStorageKey = (p: 'FIRST' | 'SECOND') =>
  `micasa.planificacion.fortnightTab.${p}`;

const scopedFortnightTabStorageKey = (scope: string, p: 'FIRST' | 'SECOND') =>
  `${fortnightTabStorageKey(p)}:${scope}`;

type IncomeItemBySource = {
  fortnightId: number;
  id: number;
  amount: number;
  source: string | null;
  userName: string | null;
  templateName: string | null;
  categoryId: number | null;
  incomeTemplateId: number | null;
  templateSuggestedAmount: number | null;
  templateCategoryId: number | null;
  templateWalletId: number | null;
  walletId: number | null;
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
  planningExpenseCount?: number;
  planningPaidExpenseCount?: number;
  planningUnpaidExpenseCount?: number;
  cardCharges?: PlannerCardChargesSummary | null;
  planningOrphanCardPayments?: PlannerOrphanCardPaymentsSummary | null;
  planningCardStatementDue?: PlannerCardStatementDueSummary | null;
  planningWalletLoanDue?: PlannerWalletLoanDueSummary | null;
  planningPayrollLoanDeduction?: PlannerPayrollLoanDeductionSummary | null;
} & ReportsSummaryFundingFields;

type FortnightColumnProps = {
  label: string;
  transactions: TransactionRow[];
  summary: Summary;
  fortnightId: number;
  year: number;
  month: number;
  period: 'FIRST' | 'SECOND';
  tableDensity?: ExpenseTableDensity;
  cardDueItems?: DuePaymentItem[];
  loanDueItems?: LoanDuePaymentItem[];
  wallets?: WalletListItem[];
  /** Bump from parent after external saldo changes so resumen refreshes funding vs pendiente. */
  summaryFundingRefreshNonce?: number;
  preferenceScope?: string;
  /** Narrow column when both fortnights are shown side by side. */
  dualColumnLayout?: boolean;
  budgetPanel?: MonthlyBudgetPanelResult | null;
  budgetOwnerQuery?: string;
  /** Refetch panel data in place. Avoids router.refresh(), which remounts the page. */
  onPanelRefresh: () => Promise<void>;
};

export default function FortnightColumn({
  label,
  transactions: initialTransactions,
  summary: initialSummary,
  fortnightId,
  year,
  month,
  period,
  tableDensity = 'comfortable',
  cardDueItems: initialCardDueItems = [],
  loanDueItems = [],
  wallets = [],
  summaryFundingRefreshNonce,
  preferenceScope = 'default',
  dualColumnLayout = false,
  budgetPanel = null,
  budgetOwnerQuery = '',
  onPanelRefresh,
}: FortnightColumnProps) {
  const { context } = useFinanceContext();
  const ownerQueryString = useMemo(() => {
    const q = buildOwnerQuery(context);
    const s = q.toString();
    return s ? `?${s}` : '';
  }, [context]);
  const lastAppliedFundingNonceRef = useRef(0);
  const [transactions, setTransactions] =
    useState<TransactionRow[]>(initialTransactions);
  const [summary, setSummary] = useState<Summary>(initialSummary);
  const [cardDueItems, setCardDueItems] =
    useState<DuePaymentItem[]>(initialCardDueItems);
  const [overrideDialogOpen, setOverrideDialogOpen] = useState(false);
  const [overrideError, setOverrideError] = useState<string | null>(null);
  const [editingIncome, setEditingIncome] = useState<{
    id: number;
    amount: number;
    label: string;
  } | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [addExpenseDialogOpen, setAddExpenseDialogOpen] = useState(false);
  const [addExpenseError, setAddExpenseError] = useState<string | null>(null);
  const [addIncomeError, setAddIncomeError] = useState<string | null>(null);
  const [columnTab, setColumnTab] = useState<'expenses' | 'cards' | 'loans'>(
    'expenses',
  );
  const [listSortMode, setListSortMode] =
    useState<PlannerListSortMode>('amount');
  const [listSortDir, setListSortDir] = useState<PlannerListSortDir>('desc');

  const [plannerPaymentDialogOpen, setPlannerPaymentDialogOpen] =
    useState(false);
  const [plannerPaymentCard, setPlannerPaymentCard] =
    useState<DuePaymentItem | null>(null);
  const [plannerPaymentFunding, setPlannerPaymentFunding] = useState<
    PaymentMethodOption[]
  >([]);
  const [plannerPayCardLoadingId, setPlannerPayCardLoadingId] = useState<
    number | null
  >(null);
  const [plannerPaymentSubmitting, setPlannerPaymentSubmitting] =
    useState(false);
  const [plannerPaymentError, setPlannerPaymentError] = useState<string | null>(
    null,
  );
  const [payrollDialogOpen, setPayrollDialogOpen] = useState(false);

  const plannerFundingWalletOptions = useMemo(
    () =>
      plannerPaymentFunding.filter(
        (w) => w.type === 'CASH' || w.type === 'DEBIT_CARD',
      ),
    [plannerPaymentFunding],
  );

  const handlePlannerOpenPayCard = useCallback(
    async (item: DuePaymentItem) => {
      if (context.id === 0) return;
      setPlannerPayCardLoadingId(item.walletId);
      setPlannerPaymentError(null);
      try {
        const methods = await getPaymentMethodOptions(context);
        setPlannerPaymentFunding(methods);
        setPlannerPaymentCard(item);
        setPlannerPaymentDialogOpen(true);
      } catch (err) {
        toast.error(
          err instanceof Error
            ? err.message
            : 'No se pudieron cargar datos para el pago',
        );
      } finally {
        setPlannerPayCardLoadingId(null);
      }
    },
    [context],
  );

  useEffect(() => {
    setTransactions(initialTransactions);
    setSummary(initialSummary);
  }, [initialTransactions, initialSummary]);

  useEffect(() => {
    setCardDueItems(initialCardDueItems);
  }, [initialCardDueItems]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(scopedFortnightTabStorageKey(preferenceScope, period));
      if (raw === 'cards' || raw === 'expenses' || raw === 'loans') {
        setColumnTab(raw);
      } else {
        setColumnTab('expenses');
      }
    } catch {
      setColumnTab('expenses');
    }
  }, [period, preferenceScope]);

  useEffect(() => {
    const preference = readPlannerListSortPreference();
    setListSortMode(preference.mode);
    setListSortDir(preference.dir);
  }, []);

  const handleColumnTabChange = useCallback((value: string) => {
    if (value !== 'expenses' && value !== 'cards' && value !== 'loans') return;
    setColumnTab(value);
    try {
      localStorage.setItem(scopedFortnightTabStorageKey(preferenceScope, period), value);
    } catch {
      /* ignore */
    }
  }, [period, preferenceScope]);

  const handleListSortClick = useCallback(
    (nextMode: PlannerListSortMode) => {
      const next = nextPlannerListSortPreference(
        { mode: listSortMode, dir: listSortDir },
        nextMode,
      );
      setListSortMode(next.mode);
      setListSortDir(next.dir);
      writePlannerListSortPreference(next);
    },
    [listSortDir, listSortMode],
  );

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
      await onPanelRefresh();
    } catch (error) {
      console.error('Error refreshing data:', error);
      toast.error(
        'No se pudo refrescar el panel. Recarga si los montos no cambiaron.',
      );
    } finally {
      setIsRefreshing(false);
    }
  }, [onPanelRefresh]);

  const handleRegenerateFromTemplates = useCallback(async () => {
    const loadingToastId = 'fortnight-regenerating';
    try {
      setIsRegenerating(true);
      setAddExpenseError(null);
      toast.loading('Regenerando quincena desde plantillas…', {
        id: loadingToastId,
      });

      if (!fortnightId || fortnightId <= 0) {
        toast.error(
          'No se pudo regenerar la quincena. Recarga la página o vuelve al plan mensual.',
        );
        return;
      }

      const result = await clientFetchFromApi<{
        expensesCreated: { count: number; names: string[] };
        incomeCreated: { count: number; names: string[] };
      }>(
        `/api/fortnights/${fortnightId}/regenerate-from-templates`,
        {
          method: 'POST',
        },
        context,
      );

      await refreshData();
      const createdExpenses = result.expensesCreated.count;
      const createdIncomes = result.incomeCreated.count;
      if (createdExpenses === 0 && createdIncomes === 0) {
        toast('Regeneración completada: no se encontraron plantillas aplicables.', {
          id: loadingToastId,
        });
      } else {
        toast.success(
          `Quincena regenerada: ${createdExpenses} gasto(s) y ${createdIncomes} ingreso(s).`,
          { id: loadingToastId },
        );
      }
    } catch (error) {
      console.error('Error regenerating fortnight from templates:', error);
      const message =
        error instanceof Error
          ? error.message
          : 'Error al regenerar la quincena desde plantillas';
      setAddExpenseError(message);
      toast.error(message, { id: loadingToastId });
    } finally {
      setIsRegenerating(false);
    }
  }, [fortnightId, context, refreshData]);

  const payrollOverflowIcon = useMemo(
    () => <Banknote className="h-4 w-4 shrink-0" aria-hidden />,
    [],
  );
  const regenerateOverflowIcon = useMemo(
    () => <RefreshCw className="h-4 w-4 shrink-0" aria-hidden />,
    [],
  );
  const handleOpenPayroll = useCallback(() => {
    setPayrollDialogOpen(true);
  }, []);
  const fortnightOverflowItems = useMemo(() => {
    const canAct = Boolean(fortnightId && fortnightId > 0);
    return [
      {
        key: 'receive-payroll',
        label: 'Recibir quincena',
        onClick: handleOpenPayroll,
        icon: payrollOverflowIcon,
        disabled: !canAct,
      },
      {
        key: 'regenerate-templates',
        label: 'Regenerar desde plantillas',
        onClick: () => {
          void handleRegenerateFromTemplates();
        },
        icon: regenerateOverflowIcon,
        disabled: !canAct || isRefreshing || isRegenerating,
      },
    ];
  }, [
    fortnightId,
    handleOpenPayroll,
    handleRegenerateFromTemplates,
    payrollOverflowIcon,
    regenerateOverflowIcon,
    isRefreshing,
    isRegenerating,
  ]);
  useRegisterToolbarOverflow(fortnightOverflowItems);

  useEffect(() => {
    if (summaryFundingRefreshNonce == null) return;
    if (summaryFundingRefreshNonce < 1) return;
    if (summaryFundingRefreshNonce === lastAppliedFundingNonceRef.current) return;
    lastAppliedFundingNonceRef.current = summaryFundingRefreshNonce;
    void refreshData();
  }, [summaryFundingRefreshNonce, refreshData]);

  const handlePlannerCardPaymentSubmit = useCallback(
    async (data: CreditCardPaymentSubmitPayload) => {
      if (!plannerPaymentCard) return;
      try {
        setPlannerPaymentSubmitting(true);
        setPlannerPaymentError(null);
        await createCreditCardPayment(
          plannerPaymentCard.walletId,
          {
            ...data,
            create_fortnight_expense: true,
            fortnight_id: fortnightId,
          },
          context,
        );
        // Keep the plan after paying: clearing it reopens the full statement
        // suggested amount and makes a covered plan look "por pagar" again.
        toast.success('Pago registrado');
        setPlannerPaymentDialogOpen(false);
        setPlannerPaymentCard(null);
        await refreshData();
      } catch (err) {
        setPlannerPaymentError(
          err instanceof Error ? err.message : 'Error al registrar el pago',
        );
      } finally {
        setPlannerPaymentSubmitting(false);
      }
    },
    [plannerPaymentCard, context, refreshData, fortnightId],
  );

  const handleExpenseUpdate = useCallback(
    async (expenseId: number, isPaid: boolean) => {
      // Update local state optimistically
      setTransactions((prev) =>
        prev.map((t) =>
          t.id === expenseId
            ? {
                ...t,
                is_paid: isPaid,
                paid_at: isPaid ? todayCalendarDate() : null,
              }
            : t,
        ),
      );

      // Refresh summary to recalculate totals
      await refreshData();
    },
    [refreshData],
  );

  const handleOverrideAmount = async (data: OverrideAmountFormValues) => {
    try {
      setOverrideError(null);
      if (editingIncome != null) {
        await updateIncomeAmount(editingIncome.id, data.amount, context, {
          planned: true,
        });
        await refreshData();
        setOverrideDialogOpen(false);
        toast.success(`${editingIncome.label} actualizado solo para esta quincena.`);
        setEditingIncome(null);
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
      throw err;
    }
  };

  const handleOpenOverrideDialog = () => {
    setEditingIncome(null);
    setOverrideError(null);
    setOverrideDialogOpen(true);
  };

  const handleOpenEditIncomeSource = (
    incomeId: number,
    amount: number,
    label: string,
  ) => {
    setEditingIncome({ id: incomeId, amount, label });
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
        return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      };

      const civilDayFromYmd = (ymd: string): number => Number(ymd.slice(8, 10));

      if (fromTemplateId) {
        await createExpenseTransaction(
          {
            fortnight_id: fortnightId,
            category_id: data.categoryId,
            description: data.name,
            amount: data.amount,
            payment_method_id: data.paymentMethodId,
            is_paid: data.isPaid,
            payment_date: data.date ?? null,
            expense_template_id: fromTemplateId,
            ...(data.applyWalletDelta === false
              ? { apply_wallet_delta: false }
              : {}),
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
            payment_date: data.date ?? null,
            ...(data.applyWalletDelta === false
              ? { apply_wallet_delta: false }
              : {}),
          },
          context,
        );
      } else if (data.isRecurring && !data.applyToBothFortnights) {
        // Case 2: Recurring, single fortnight - create expense + template
        const dueFromDate = civilDayFromYmd(data.date);
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
            payment_date: data.date ?? null,
            expense_template_id: template.id,
            ...(data.applyWalletDelta === false
              ? { apply_wallet_delta: false }
              : {}),
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
        const currentDue = civilDayFromYmd(data.date);
        const otherDue = civilDayFromYmd(getDateForFortnight(otherPeriod));
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
            payment_date: data.date ?? null,
            expense_template_id: template.id,
            ...(data.applyWalletDelta === false
              ? { apply_wallet_delta: false }
              : {}),
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
            payment_date: otherDate ?? null,
            expense_template_id: template.id,
            ...(data.applyWalletDelta === false
              ? { apply_wallet_delta: false }
              : {}),
          },
          context,
        );
      }

      toast.success(data.isPaid ? 'Gasto registrado' : 'Gasto planificado');
      setAddExpenseDialogOpen(false);
      await refreshData();
    } catch (err) {
      const base =
        err instanceof Error ? err.message : 'Error al crear el gasto';
      const code =
        err && typeof err === 'object' && 'code' in err
          ? (err as ClientApiError).code
          : undefined;
      const message =
        code === 'INSUFFICIENT_WALLET_BALANCE'
          ? `${base} Puedes quitar «Pagado» para guardarlo como pendiente, elegir otra billetera con saldo o registrar fondos en Billeteras.`
          : base;
      setAddExpenseError(message);
    }
  };

  const handleAddIncome = async (data: AddIncomeFormValues) => {
    try {
      setAddIncomeError(null);
      await createWalletIncome(
        data.walletId,
        {
          date: data.date,
          amount: data.amount,
          source: data.name,
          category_id: data.categoryId,
        },
        context,
      );
      toast.success('Ingreso registrado');
      await refreshData();
      setAddExpenseDialogOpen(false);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Error al registrar el ingreso';
      setAddIncomeError(message);
    }
  };

  const tenemos = summary.totalIncome;
  const libre = summary.balance;
  const pagado = summary.totalPaid;
  const pendiente = summary.totalUnpaid;
  const pendingExpenseItems = useMemo(
    () =>
      getPendingLiquidityLineItems({
        transactions,
        cardDueItems,
        loanDueItems,
      }),
    [cardDueItems, loanDueItems, transactions],
  );

  const currentFortnightUserIncome =
    summary.userIncome && summary.userIncome.length > 0
      ? summary.userIncome.filter((ui) => ui.fortnightId === fortnightId)
      : undefined;

  const expenseTab = useMemo(
    () =>
      presentFortnightExpenseTab({
        rows: transactions,
        totals: {
          pagado: summary.totalPaid,
          pendiente: summary.totalUnpaid,
          presupuesto: summary.planningBudgetRemaining ?? 0,
          liquidez: summary.fundingNetVsPendingExpense ?? 0,
        },
      }),
    [
      transactions,
      summary.totalPaid,
      summary.totalUnpaid,
      summary.planningBudgetRemaining,
      summary.fundingNetVsPendingExpense,
    ],
  );

  const sortedTransactions = useMemo(
    () => sortExpenseListRows(expenseTab.rows, listSortMode, listSortDir),
    [expenseTab.rows, listSortMode, listSortDir],
  );

  const unpaidExpenseCount = expenseTab.unpaidCount;

  const summaryExpenseCount =
    summary.planningExpenseCount ?? transactions.length;
  const summaryPaidExpenseCount =
    summary.planningPaidExpenseCount ??
    transactions.filter((t) => t.is_paid).length;
  const summaryUnpaidExpenseCount =
    summary.planningUnpaidExpenseCount ??
    transactions.filter((t) => !t.is_paid).length;

  const pendingCardPaymentsCount = useMemo(
    () =>
      cardDueItems.filter((item) => panelSnapshotFromDueItem(item).countsAsPending)
        .length,
    [cardDueItems],
  );
  const pendingLoanPaymentsCount = useMemo(
    () => loanDueItems.filter((item) => item.status === 'SCHEDULED').length,
    [loanDueItems],
  );

  const compactTabs = dualColumnLayout;
  const plannerTabLabelClass = cn(
    'inline-flex min-w-0 items-center justify-center gap-1 sm:gap-1.5',
    compactTabs && 'gap-1',
  );
  const plannerTabIconClass = 'h-3.5 w-3.5 shrink-0';
  const plannerTabBadgeClass = cn(
    'pointer-events-none h-4 min-w-4 shrink-0 justify-center rounded-full border-0 px-1 text-xs font-sans font-semibold tabular-nums shadow-none xl:h-5 xl:min-w-5.5 xl:px-1.5',
    compactTabs && 'h-4 min-w-4 px-1 xl:h-4 xl:min-w-4 xl:px-1',
  );

  return (
    <>
      <div className="flex flex-col space-y-3 sm:space-y-4">
        <SummaryBlock
          tenemos={tenemos}
          libre={libre}
          pagado={pagado}
          pendiente={pendiente}
          pendingExpenseItems={pendingExpenseItems}
          userIncome={currentFortnightUserIncome}
          incomeItems={
            summary.incomeItems?.filter((i) => i.fortnightId === fortnightId) ??
            []
          }
          year={year}
          month={month}
          period={period}
          expenseCount={summaryExpenseCount}
          paidExpenseCount={summaryPaidExpenseCount}
          unpaidExpenseCount={summaryUnpaidExpenseCount}
          planningOrphanCardPayments={
            summary.planningOrphanCardPayments ?? null
          }
          planningCardStatementDue={
            summary.planningCardStatementDue ?? null
          }
          planningWalletLoanDue={summary.planningWalletLoanDue ?? null}
          planningPayrollLoanDeduction={
            summary.planningPayrollLoanDeduction ?? null
          }
          planningBudgetRemaining={summary.planningBudgetRemaining ?? 0}
          fundingWalletBalanceTotal={
            summary.fundingWalletBalanceTotal ?? 0
          }
          fundingNetVsPendingExpense={
            summary.fundingNetVsPendingExpense ?? 0
          }
          fundingWalletBreakdown={(summary.fundingWalletBreakdown ?? []).map(
            (item) => {
              const wallet = wallets.find((w) => w.id === item.id);
              return {
                ...item,
                provider_icon_key:
                  item.provider_icon_key ?? wallet?.provider_icon_key ?? null,
                assignee: item.assignee ?? wallet?.assignee ?? null,
              };
            },
          )}
          onEditIncome={handleOpenOverrideDialog}
          onEditIncomeSource={handleOpenEditIncomeSource}
          budgetPanel={budgetPanel}
          budgetOwnerQuery={budgetOwnerQuery || ownerQueryString}
        />

        <SegmentedControl
          value={columnTab}
          onValueChange={handleColumnTabChange}
          ariaLabel="Secciones de la quincena"
          className="w-full min-w-0"
          stretch
          frameClassName={cn(
            MONTHLY_LIQUID_PANEL_CLASS,
            'mb-1.5 flex min-w-0 flex-wrap items-center gap-1 p-1 sm:mb-3.5 sm:flex-nowrap sm:gap-1.5 sm:p-1.5',
          )}
          wrapperClassName="min-w-0 w-full flex-1 sm:w-auto"
          indicatorClassName={AURA_TAB_INDICATOR_CLASS}
          activeLabelClassName={GLASS_TAB_ACTIVE_LABEL_CLASS}
          options={[
            {
              value: 'expenses',
              ariaLabel: `Gastos, ${unpaidExpenseCount} sin pagar`,
              label: (
                <span className={plannerTabLabelClass}>
                  <Receipt className={plannerTabIconClass} aria-hidden />
                  Gastos
                  <Badge variant={unpaidExpenseCount > 0 ? 'default' : 'secondary'} className={plannerTabBadgeClass} aria-hidden>
                    {unpaidExpenseCount}
                  </Badge>
                </span>
              ),
            },
            {
              value: 'cards',
              ariaLabel: `Pagos tarjeta, ${pendingCardPaymentsCount} pendientes`,
              label: (
                <span className={plannerTabLabelClass}>
                  <CreditCard className={plannerTabIconClass} aria-hidden />
                  Tarjetas
                  <Badge variant={pendingCardPaymentsCount > 0 ? 'default' : 'secondary'} className={plannerTabBadgeClass} aria-hidden>
                    {pendingCardPaymentsCount}
                  </Badge>
                </span>
              ),
            },
            {
              value: 'loans',
              ariaLabel: `Préstamos, ${pendingLoanPaymentsCount} pendientes`,
              label: (
                <span className={plannerTabLabelClass}>
                  <HandCoins className={plannerTabIconClass} aria-hidden />
                  <span className="@min-[6.25rem]:hidden">Prest.</span>
                  <span className="hidden @min-[6.25rem]:inline">Préstamos</span>
                  <Badge variant={pendingLoanPaymentsCount > 0 ? 'default' : 'secondary'} className={plannerTabBadgeClass} aria-hidden>
                    {pendingLoanPaymentsCount}
                  </Badge>
                </span>
              ),
            },
          ]}
          accessory={(
            <div className="flex shrink-0 items-center gap-0.5 sm:gap-1 sm:pl-0.5">
              <DropdownMenu>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 shrink-0 text-muted-foreground hover:bg-muted hover:text-foreground sm:h-8 sm:w-8"
                        aria-label={`Ordenar: ${plannerListSortDisplayLabel(listSortMode, listSortDir)}`}
                      >
                        <ArrowUpDown className="h-4 w-4" aria-hidden />
                      </Button>
                    </DropdownMenuTrigger>
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={4}>
                    Ordenar ·{' '}
                    {plannerListSortDisplayLabel(listSortMode, listSortDir)}
                  </TooltipContent>
                </Tooltip>
                <DropdownMenuContent align="end" className="min-w-44">
                  <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                    {columnTab === 'cards'
                      ? 'Ordenar tarjetas'
                      : columnTab === 'loans'
                        ? 'Ordenar préstamos'
                        : 'Ordenar gastos'}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {(
                    Object.keys(
                      PLANNER_LIST_SORT_FIELD_LABELS,
                    ) as PlannerListSortMode[]
                  ).map((mode) => {
                    const isActive = listSortMode === mode;
                    return (
                      <DropdownMenuItem
                        key={mode}
                        className="gap-2"
                        onSelect={() => handleListSortClick(mode)}
                      >
                        {isActive ? (
                          listSortDir === 'desc' ? (
                            <ArrowDown
                              className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                              aria-hidden
                            />
                          ) : (
                            <ArrowUp
                              className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                              aria-hidden
                            />
                          )
                        ) : (
                          <span className="inline-block h-3.5 w-3.5 shrink-0" aria-hidden />
                        )}
                        {PLANNER_LIST_SORT_FIELD_LABELS[mode]}
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        >

          <TabsContent value="expenses" className="mt-0 outline-none">
            {sortedTransactions.length > 0 ? (
              <ExpenseTable
                expenses={sortedTransactions}
                cashFlowRows={expenseTab.cashFlowRows}
                onExpenseUpdate={handleExpenseUpdate}
                totalIncome={tenemos}
                year={year}
                month={month}
                period={period}
                density={tableDensity}
                wallets={wallets}
                pinTotalsToBottom
                sortMode={listSortMode}
                sortDir={listSortDir}
              />
            ) : null}
          </TabsContent>

          <TabsContent value="cards" className="mt-0 outline-none">
            <FortnightCardPaymentsPanel
              items={cardDueItems}
              ownerQueryString={ownerQueryString}
              fortnightLabel={label}
              fortnightId={fortnightId}
              plannerYear={year}
              plannerMonth={month}
              plannerPeriod={period}
              isCompact={tableDensity === 'compact'}
              sortMode={listSortMode}
              sortDir={listSortDir}
              onPayCard={
                context.id !== 0 ? handlePlannerOpenPayCard : undefined
              }
              payingWalletId={plannerPayCardLoadingId}
              onPlanUpdated={refreshData}
            />
          </TabsContent>

          <TabsContent value="loans" className="mt-0 outline-none">
            <FortnightLoanPaymentsPanel
              items={loanDueItems}
              fortnightLabel={label}
              isCompact={tableDensity === 'compact'}
              sortMode={listSortMode}
              sortDir={listSortDir}
              onUpdated={refreshData}
            />
          </TabsContent>
        </SegmentedControl>
      </div>

      {/* Receive Payroll Dialog */}
      <ReceivePayrollButton
        open={payrollDialogOpen}
        onOpenChange={setPayrollDialogOpen}
        fortnightId={fortnightId}
        period={period}
        year={year}
        month={month}
        onSuccess={refreshData}
      />

      {/* Override Amount Dialog */}
      <EditFortnightAmountDialog
        open={overrideDialogOpen}
        onOpenChange={(open) => {
          setOverrideDialogOpen(open);
          if (!open) {
            setEditingIncome(null);
          }
          setOverrideError(null);
        }}
        onSave={handleOverrideAmount}
        defaultAmount={editingIncome?.amount ?? tenemos}
        fortnightLabel={label}
        sourceName={editingIncome?.label}
        error={overrideError && overrideDialogOpen ? overrideError : null}
      />

      {/* Add Expense Dialog */}
      <AddTransactionDialog
        open={addExpenseDialogOpen}
        onOpenChange={(open) => {
          setAddExpenseDialogOpen(open);
          setAddExpenseError(null);
          setAddIncomeError(null);
        }}
        onSaveExpense={handleAddExpense}
        onSaveIncome={handleAddIncome}
        defaultDate={getDefaultDateForFortnight(year, month, period)}
        expenseError={addExpenseError && addExpenseDialogOpen ? addExpenseError : null}
        incomeError={addIncomeError && addExpenseDialogOpen ? addIncomeError : null}
      />

      <CreditCardPaymentDialog
        open={plannerPaymentDialogOpen && plannerPaymentCard !== null}
        onOpenChange={(open) => {
          setPlannerPaymentDialogOpen(open);
          if (!open) {
            setPlannerPaymentError(null);
            setPlannerPaymentCard(null);
          }
        }}
        fundingWalletOptions={plannerFundingWalletOptions}
        prefillAmount={periodObligationPrefillAmount(
          plannerPaymentCard?.periodObligation,
        )}
        submitting={plannerPaymentSubmitting}
        error={plannerPaymentError}
        fortnightId={fortnightId}
        onConfirm={handlePlannerCardPaymentSubmit}
      />
    </>
  );
}
