'use client';

import { formatCalendarDate, parseCalendarDate } from '@/lib/calendar-dates';
import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import ExpenseTable from '@/components/ExpenseTable';
import SummaryBlock from '@/components/SummaryBlock';
import EmptyState from '@/components/EmptyState';
import EditFortnightAmountDialog from '@/components/EditFortnightAmountDialog';
import AddExpenseDialog from '@/components/AddExpenseDialog';
import { OverrideAmountFormValues } from '@/schemas/fortnight.schema';
import { AddExpenseFormValues } from '@/schemas/transaction.schema';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import CreditCardPaymentDialog from '@/components/credit-cards/CreditCardPaymentDialog';
import type { CreditCardPaymentSubmitPayload } from '@/components/credit-cards/CreditCardPaymentDialog';
import FortnightCardPaymentsPanel, {
  getPlannerCardPaymentStatus,
} from '@/components/planner/FortnightCardPaymentsPanel';
import { getEffectiveCardPaymentAmount } from '@/lib/finance/credit-card-payment-plan.utils';
import FortnightLoanPaymentsPanel from '@/components/planner/FortnightLoanPaymentsPanel';
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
import { Banknote, BarChart3, Loader2, MoreVertical, Plus, RefreshCw } from 'lucide-react';
import { useFinanceContext } from '@/context/finance-context';
import {
  buildOwnerQuery,
  clientFetchFromApi,
  type ClientApiError,
} from '@/lib/api/client-fetch';
import { createCreditCardPayment } from '@/lib/api/credit-cards';
import { createExpenseTemplate } from '@/lib/api/expense-templates';
import { updateIncomeAmount } from '@/lib/api/incomes';
import {
  createExpenseTransaction,
  updateFortnightOverrideAmount,
} from '@/lib/api/transactions';
import { getPaymentMethodOptions } from '@/lib/api/wallets';
import { ReceivePayrollButton } from '@/components/ReceivePayrollButton';
import type {
  CategoryOption,
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
import { useHydrationSafeTodayYmd } from '@/hooks/use-hydration-safe-today-ymd';
import { cn } from '@/lib/utils';

/** Altura del panel con scroll (gastos / tarjeta / préstamos). Móvil usa dvh por la barra del navegador. */
const FORTNIGHT_TAB_PANEL_HEIGHT_CLASS =
  'h-[min(72dvh,40rem)] min-h-[12rem] sm:h-[min(58vh,36rem)] lg:h-[min(72vh,56rem)]';
const FORTNIGHT_TAB_PANEL_MAX_HEIGHT_CLASS =
  'max-h-[min(72dvh,40rem)] sm:max-h-[min(58vh,36rem)] lg:max-h-[min(72vh,56rem)]';

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
  showSummaryCard?: boolean;
  onShowSummaryCard?: () => void;
  tableDensity?: ExpenseTableDensity;
  cardDueItems?: DuePaymentItem[];
  loanDueItems?: LoanDuePaymentItem[];
  wallets?: WalletListItem[];
  /** Bump from parent after external saldo changes so resumen refreshes funding vs pendiente. */
  summaryFundingRefreshNonce?: number;
  preferenceScope?: string;
  /** Narrow column when both fortnights are shown side by side. */
  dualColumnLayout?: boolean;
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
  loanDueItems = [],
  wallets = [],
  summaryFundingRefreshNonce,
  preferenceScope = 'default',
  dualColumnLayout = false,
}: FortnightColumnProps) {
  const { context } = useFinanceContext();
  const ownerQueryString = useMemo(() => {
    const q = buildOwnerQuery(context);
    const s = q.toString();
    return s ? `?${s}` : '';
  }, [context]);
  const router = useRouter();
  const lastAppliedFundingNonceRef = useRef(0);
  const [transactions, setTransactions] =
    useState<TransactionRow[]>(initialTransactions);
  const [summary, setSummary] = useState<Summary>(initialSummary);
  const [overrideDialogOpen, setOverrideDialogOpen] = useState(false);
  const [overrideError, setOverrideError] = useState<string | null>(null);
  const [editingIncomeId, setEditingIncomeId] = useState<number | null>(null);
  const [editingIncomeAmount, setEditingIncomeAmount] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [addExpenseDialogOpen, setAddExpenseDialogOpen] = useState(false);
  const [addExpenseError, setAddExpenseError] = useState<string | null>(null);
  const [columnTab, setColumnTab] = useState<'expenses' | 'cards' | 'loans'>(
    'expenses',
  );

  const [plannerPaymentDialogOpen, setPlannerPaymentDialogOpen] =
    useState(false);
  const [plannerPaymentCard, setPlannerPaymentCard] =
    useState<DuePaymentItem | null>(null);
  const [plannerPaymentFunding, setPlannerPaymentFunding] = useState<
    PaymentMethodOption[]
  >([]);
  const [plannerPaymentCategories, setPlannerPaymentCategories] = useState<
    CategoryOption[]
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
        const [methods, categoriesData] = await Promise.all([
          getPaymentMethodOptions(context),
          clientFetchFromApi<CategoryOption[]>(
            '/api/categories',
            undefined,
            context,
          ),
        ]);
        setPlannerPaymentFunding(methods);
        setPlannerPaymentCategories(categoriesData);
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

  const handleColumnTabChange = useCallback((value: string) => {
    if (value !== 'expenses' && value !== 'cards' && value !== 'loans') return;
    setColumnTab(value);
    try {
      localStorage.setItem(scopedFortnightTabStorageKey(preferenceScope, period), value);
    } catch {
      /* ignore */
    }
  }, [period, preferenceScope]);

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
      const ym = String(month).padStart(2, '0');
      const planningQs = '&exclude_credit_installment=true';
      const [transactionsData, summaryData] = await Promise.all([
        clientFetchFromApi<TransactionRow[]>(
          `/api/transactions?year=${year}&month=${ym}&period=${period}&type=expense${planningQs}`,
          undefined,
          context,
        ),
        clientFetchFromApi<Summary>(
          `/api/reports?type=summary&year=${year}&month=${ym}&period=${period}${planningQs}`,
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
          data,
          context,
        );
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
    [plannerPaymentCard, context, refreshData],
  );

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
        return formatCalendarDate(
          parseCalendarDate(
            `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
          ),
        );
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
            payment_date: data.date ?? null,
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
            payment_date: data.date ?? null,
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
            payment_date: data.date ?? null,
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
            payment_date: data.date ?? null,
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
            payment_date: otherDate ?? null,
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

  const handleRegenerateFromTemplates = async () => {
    const loadingToastId = 'fortnight-regenerating';
    try {
      setIsRegenerating(true);
      setAddExpenseError(null);
      toast.loading('Regenerando quincena desde plantillas...', {
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
      router.refresh();
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

  const unpaidExpenseCount = useMemo(
    () => transactions.filter((t) => !t.is_paid).length,
    [transactions],
  );

  const summaryExpenseCount =
    summary.planningExpenseCount ?? transactions.length;
  const summaryPaidExpenseCount =
    summary.planningPaidExpenseCount ??
    transactions.filter((t) => t.is_paid).length;
  const summaryUnpaidExpenseCount =
    summary.planningUnpaidExpenseCount ?? unpaidExpenseCount;

  const plannerTodayYmd = useHydrationSafeTodayYmd();

  const pendingCardPaymentsCount = useMemo(
    () =>
      cardDueItems.filter(
        (item) =>
          getPlannerCardPaymentStatus(item, plannerTodayYmd) !== 'pagado',
      ).length,
    [cardDueItems, plannerTodayYmd],
  );
  const pendingLoanPaymentsCount = useMemo(
    () => loanDueItems.filter((item) => item.status === 'SCHEDULED').length,
    [loanDueItems],
  );

  const compactTabs = dualColumnLayout;

  return (
    <>
      <div className="flex flex-col space-y-3 sm:space-y-4">
        {/* Summary card (toggle desde la barra de planificación) */}
        {showSummaryCard ? (
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
            expenseCount={summaryExpenseCount}
            paidExpenseCount={summaryPaidExpenseCount}
            unpaidExpenseCount={summaryUnpaidExpenseCount}
            cardCharges={summary.cardCharges ?? null}
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
            fundingWalletBalanceTotal={
              summary.fundingWalletBalanceTotal ?? 0
            }
            fundingNetVsPendingExpense={
              summary.fundingNetVsPendingExpense ?? 0
            }
            fundingWalletBreakdown={summary.fundingWalletBreakdown ?? []}
            onEditIncome={handleOpenOverrideDialog}
            onEditIncomeSource={handleOpenEditIncomeSource}
          />
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5 border-dashed border-primary/30 text-primary/70 hover:border-primary/50 hover:bg-primary/5 hover:text-primary"
            onClick={onShowSummaryCard}
            aria-label={`Mostrar resumen de la quincena: ${label}`}
          >
            <BarChart3 className="h-3.5 w-3.5 shrink-0" />
            Mostrar resumen
          </Button>
        )}

        <Tabs
          value={columnTab}
          onValueChange={handleColumnTabChange}
          className="w-full min-w-0"
        >
          <div className="mb-1.5 flex min-w-0 items-center gap-1 rounded-2xl border border-border/40 bg-gradient-to-br from-muted/30 via-background to-muted/10 p-1 shadow-inner backdrop-blur-sm dark:from-muted/20 dark:via-card dark:to-muted/5 sm:mb-3.5 sm:gap-2 sm:p-1.5">
            <TabsList
              variant="line"
              className={cn(
                'h-auto min-w-0 flex-1 justify-start gap-0.5 rounded-none bg-transparent p-0 sm:gap-1',
                compactTabs &&
                  'w-full overflow-x-auto scrollbar-hide [&_[data-slot=tabs-trigger]]:flex-none [&_[data-slot=tabs-trigger]]:shrink-0',
                '[&_[data-slot=tabs-trigger]]:rounded-full',
                '[&_[data-slot=tabs-trigger]]:transition-all',
                '[&_[data-slot=tabs-trigger][data-state=active]]:bg-gradient-to-br',
                '[&_[data-slot=tabs-trigger][data-state=active]]:from-primary/90',
                '[&_[data-slot=tabs-trigger][data-state=active]]:to-primary/75',
                '[&_[data-slot=tabs-trigger][data-state=active]]:text-primary-foreground',
                '[&_[data-slot=tabs-trigger][data-state=active]]:shadow-sm',
                '[&_[data-slot=tabs-trigger][data-state=active]]:ring-1',
                '[&_[data-slot=tabs-trigger][data-state=active]]:ring-primary/30',
                '[&_[data-slot=tabs-trigger][data-state=active]]:border-transparent',
                '[&_[data-slot=tabs-trigger][data-state=inactive]]:text-foreground/70',
                '[&_[data-slot=tabs-trigger][data-state=inactive]]:hover:text-foreground/90',
                '[&_[data-slot=tabs-trigger]]:after:hidden',
              )}
            >
              <TabsTrigger
                value="expenses"
                className={cn(
                  'min-h-9 px-2.5 py-1.5 text-xs font-semibold sm:min-h-0 sm:px-3.5 sm:py-2 sm:text-sm',
                  compactTabs && 'min-h-8 px-2 py-1 text-[11px] sm:min-h-8 sm:px-2 sm:py-1 sm:text-xs',
                )}
                aria-label={`Gastos, ${unpaidExpenseCount} sin pagar`}
              >
                <span className={cn('inline-flex items-center gap-1.5 sm:gap-2', compactTabs && 'gap-1')}>
                  Gastos
                  <Badge
                    variant={unpaidExpenseCount > 0 ? 'default' : 'secondary'}
                    className={cn(
                      'pointer-events-none h-4 min-w-4 shrink-0 justify-center rounded-full border-0 px-1 text-[10px] font-mono font-semibold tabular-nums shadow-none sm:h-5 sm:min-w-5.5 sm:px-1.5 sm:text-[11px]',
                      compactTabs && 'h-4 min-w-4 px-1 text-[10px] sm:h-4 sm:min-w-4 sm:px-1 sm:text-[10px]',
                      columnTab === 'expenses' && unpaidExpenseCount > 0 &&
                        'bg-primary-foreground/20 text-primary-foreground',
                    )}
                    aria-hidden
                  >
                    {unpaidExpenseCount}
                  </Badge>
                </span>
              </TabsTrigger>
              <TabsTrigger
                value="cards"
                className={cn(
                  'min-h-9 px-2.5 py-1.5 text-xs font-semibold sm:min-h-0 sm:px-3.5 sm:py-2 sm:text-sm',
                  compactTabs && 'min-h-8 px-2 py-1 text-[11px] sm:min-h-8 sm:px-2 sm:py-1 sm:text-xs',
                )}
                aria-label={`Pagos tarjeta, ${pendingCardPaymentsCount} pendientes`}
              >
                <span className={cn('inline-flex items-center gap-1.5 sm:gap-2', compactTabs && 'gap-1')}>
                  <span className={compactTabs ? 'inline' : 'sm:hidden'}>Tarjeta</span>
                  <span className={compactTabs ? 'hidden' : 'hidden sm:inline'}>Pagos tarjeta</span>
                  <Badge
                    variant={
                      pendingCardPaymentsCount > 0 ? 'default' : 'secondary'
                    }
                    className={cn(
                      'pointer-events-none h-4 min-w-4 shrink-0 justify-center rounded-full border-0 px-1 text-[10px] font-mono font-semibold tabular-nums shadow-none sm:h-5 sm:min-w-5.5 sm:px-1.5 sm:text-[11px]',
                      compactTabs && 'h-4 min-w-4 px-1 text-[10px] sm:h-4 sm:min-w-4 sm:px-1 sm:text-[10px]',
                      columnTab === 'cards' && pendingCardPaymentsCount > 0 &&
                        'bg-primary-foreground/20 text-primary-foreground',
                    )}
                    aria-hidden
                  >
                    {pendingCardPaymentsCount}
                  </Badge>
                </span>
              </TabsTrigger>
              <TabsTrigger
                value="loans"
                className={cn(
                  'min-h-9 px-2.5 py-1.5 text-xs font-semibold sm:min-h-0 sm:px-3.5 sm:py-2 sm:text-sm',
                  compactTabs && 'min-h-8 px-2 py-1 text-[11px] sm:min-h-8 sm:px-2 sm:py-1 sm:text-xs',
                )}
                aria-label={`Préstamos, ${pendingLoanPaymentsCount} pendientes`}
              >
                <span className={cn('inline-flex items-center gap-1.5 sm:gap-2', compactTabs && 'gap-1')}>
                  {compactTabs ? 'Prest.' : 'Préstamos'}
                  <Badge
                    variant={
                      pendingLoanPaymentsCount > 0 ? 'default' : 'secondary'
                    }
                    className={cn(
                      'pointer-events-none h-4 min-w-4 shrink-0 justify-center rounded-full border-0 px-1 text-[10px] font-mono font-semibold tabular-nums shadow-none sm:h-5 sm:min-w-5.5 sm:px-1.5 sm:text-[11px]',
                      compactTabs && 'h-4 min-w-4 px-1 text-[10px] sm:h-4 sm:min-w-4 sm:px-1 sm:text-[10px]',
                      columnTab === 'loans' && pendingLoanPaymentsCount > 0 &&
                        'bg-primary-foreground/20 text-primary-foreground',
                    )}
                    aria-hidden
                  >
                    {pendingLoanPaymentsCount}
                  </Badge>
                </span>
              </TabsTrigger>
            </TabsList>
            <div className="flex shrink-0 items-center gap-1 sm:gap-1.5 sm:pl-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setAddExpenseDialogOpen(true)}
                    disabled={!fortnightId || fortnightId <= 0}
                    className={cn(
                      'h-9 w-9 gap-1.5 border-primary/35 bg-background/80 p-0 text-primary shadow-sm hover:bg-primary/8 sm:h-8 sm:w-auto sm:px-3',
                      compactTabs && 'sm:w-9 sm:px-0',
                    )}
                    aria-label="Agregar gasto a esta quincena"
                    title={
                      !fortnightId || fortnightId <= 0
                        ? 'La quincena no está disponible. Recarga la página.'
                        : undefined
                    }
                  >
                    <Plus className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
                    <span className={cn('hidden sm:inline', compactTabs && 'sm:hidden')}>
                      Agregar gasto
                    </span>
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
                        className="h-9 w-9 shrink-0 border-border/70 bg-background/70 text-foreground/85 hover:bg-muted sm:h-8 sm:w-8"
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
                    disabled={!fortnightId || fortnightId <= 0}
                    onSelect={() => setPayrollDialogOpen(true)}
                  >
                    <Banknote className="h-4 w-4 shrink-0" aria-hidden />
                    Recibir quincena
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={
                      !fortnightId ||
                      fortnightId <= 0 ||
                      isRefreshing ||
                      isRegenerating
                    }
                    onSelect={() => {
                      void handleRegenerateFromTemplates();
                    }}
                  >
                    {isRefreshing || isRegenerating ? (
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
          </div>

          <TabsContent value="expenses" className="mt-0 outline-none">
            <div
              className={cn(
                'flex flex-col overflow-hidden',
                FORTNIGHT_TAB_PANEL_HEIGHT_CLASS,
              )}
            >
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
                  wallets={wallets}
                  pinTotalsToBottom
                />
              )}
            </div>
          </TabsContent>

          <TabsContent value="cards" className="mt-0 outline-none">
            <div
              className={cn(
                'overflow-y-auto scrollbar-hide',
                FORTNIGHT_TAB_PANEL_MAX_HEIGHT_CLASS,
              )}
            >
              <FortnightCardPaymentsPanel
                items={cardDueItems}
                ownerQueryString={ownerQueryString}
                fortnightLabel={label}
                fortnightId={fortnightId}
                plannerYear={year}
                plannerMonth={month}
                plannerPeriod={period}
                isCompact={tableDensity === 'compact'}
                onPayCard={
                  context.id !== 0 ? handlePlannerOpenPayCard : undefined
                }
                payingWalletId={plannerPayCardLoadingId}
                onPlanUpdated={refreshData}
              />
            </div>
          </TabsContent>

          <TabsContent value="loans" className="mt-0 outline-none">
            <div
              className={cn(
                'overflow-y-auto scrollbar-hide',
                FORTNIGHT_TAB_PANEL_MAX_HEIGHT_CLASS,
              )}
            >
              <FortnightLoanPaymentsPanel
                items={loanDueItems}
                ownerQueryString={ownerQueryString}
                fortnightLabel={label}
                isCompact={tableDensity === 'compact'}
              />
            </div>
          </TabsContent>
        </Tabs>
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
        categoryOptions={plannerPaymentCategories}
        nextDuePayment={
          plannerPaymentCard != null
            ? getEffectiveCardPaymentAmount(plannerPaymentCard)
            : 0
        }
        outstandingBalance={plannerPaymentCard?.outstandingBalance ?? 0}
        submitting={plannerPaymentSubmitting}
        error={plannerPaymentError}
        onSubmit={handlePlannerCardPaymentSubmit}
      />
    </>
  );
}
