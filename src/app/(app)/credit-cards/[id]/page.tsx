'use client';

import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useState,
  ViewTransition,
} from 'react';
import { useParams } from 'next/navigation';
import {
  CheckCircle2,
  Download,
  FileText,
  Pencil,
  ShoppingCart,
  SlidersHorizontal,
  Upload,
  Wallet,
} from 'lucide-react';
import { toast } from 'sonner';
import ConfirmDeleteDialog from '@/components/ConfirmDeleteDialog';
import WalletForm from '@/components/WalletForm';
import { WalletFormValues } from '@/schemas/wallet.schema';
import { DirectionalTransition } from '@/components/view-transition/DirectionalTransition';
import { WalletCardVtPlaceholder } from '@/components/wallets/WalletCardVtPlaceholder';
import { walletCardViewTransitionName } from '@/lib/ui/wallet-card-view-transition';
import {
  CreditCardCycleSummary,
  CreditCardDetailTabTrigger,
  CreditCardDetailTabsList,
  CreditCardDuePaymentStrip,
  CreditCardHeroZone,
  CreditCardStatementSummaryCard,
  CreditCardVisualHero,
  CreditCardCycleSpendingBar,
} from '@/components/credit-cards/CreditCardDetailSections';
import { CreditCardCycleLedger } from '@/components/credit-cards/CreditCardCycleLedger';
import { CreditCardCycleWorkspaceShell } from '@/components/credit-cards/CreditCardCycleWorkspaceShell';
import { CreditCardInstallmentPortfolio } from '@/components/credit-cards/CreditCardInstallmentPortfolio';
import { CreditCardInstallmentPlansSection } from '@/components/credit-cards/CreditCardInstallmentPlansSection';
import { CreditCardScheduledPaymentsSection } from '@/components/credit-cards/CreditCardScheduledPaymentsSection';
import { CreditCardReconciliationStrip } from '@/components/credit-cards/CreditCardReconciliationStrip';
import { CreditCardPlannedPaymentSection } from '@/components/credit-cards/CreditCardPlannedPaymentSection';
import CreditCardStatementImportDialog from '@/components/credit-cards/CreditCardStatementImportDialog';
import { CreditCardPaymentsChart } from '@/components/credit-cards/CreditCardPaymentsChart';
import CreditCardPaymentDialog, {
  type CreditCardPaymentSubmitPayload,
} from '@/components/credit-cards/CreditCardPaymentDialog';
import CreditCardQuickPurchaseDialog from '@/components/credit-cards/CreditCardQuickPurchaseDialog';
import WalletBalanceDialog from '@/components/wallets/WalletBalanceDialog';
import LinkedLoansCard from '@/components/loans/LinkedLoansCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { useFinanceContext } from '@/context/finance-context';
import {
  useRegisterToolbarActions,
  type ToolbarOverflowItem,
} from '@/context/toolbar-actions-context';
import { useCreditCardCycleUrlState } from '@/hooks/use-credit-card-cycle-url-state';
import {
  buildOwnerQuery,
  clientFetchFromApi,
} from '@/lib/api/client-fetch';
import {
  createCreditCardPayment,
  downloadCreditCardStatementImportFile,
  getCreditCardPaymentPlan,
  getCreditCardStatement,
  listCreditCardStatementImports,
  rollbackCreditCardStatementImport,
  updateCreditCard,
} from '@/lib/api/credit-cards';
import { getPaymentMethodOptions } from '@/lib/api/wallets';
import type { CreditCardExternalPaymentSubmitPayload } from '@/components/credit-cards/CreditCardExternalPaymentDialog';
import { CreditCardExternalPaymentDialog } from '@/components/credit-cards/CreditCardExternalPaymentDialog';
import { downloadCreditCardStatementCsv } from '@/lib/finance/credit-card-statement-csv';
import { downloadCreditCardStatementPdf } from '@/lib/finance/credit-card-statement-pdf';
import { computeCreditCardCycleReconciliation } from '@/lib/finance/credit-card-cycle-reconciliation';
import type { CreditCardCycleTab } from '@/lib/finance/credit-card-cycle-types';
import {
  type PaymentMethodType,
  isCreditOrStoreCardWalletType,
} from '@/domain/payment-method';
import {
  addCalendarDays,
  parseCalendarDate,
  todayCalendarDate,
} from '@/lib/calendar-dates';
import { formatDate } from '@/lib/utils';
import type {
  CategoryOption,
  CreditCardListItem,
  CreditCardPaymentPlanView,
  CreditCardStatementImportListItem,
  CreditCardStatementResponse,
  PaymentMethodOption,
} from '@/types/catalog';

const shiftDateByDays = (dateStr: string, days: number): string =>
  addCalendarDays(dateStr.slice(0, 10), days);

const formatCycleRange = (start: string, end: string) =>
  `${formatDate(start)} – ${formatDate(end)}`;

const CreditCardDetailSkeleton = ({ cardId }: { cardId: number }) => (
  <DirectionalTransition>
    <div className="space-y-0">
      <div className="relative -mx-4 space-y-4 px-4 pb-4 sm:-mx-0">
        <ViewTransition
          name={walletCardViewTransitionName(cardId)}
          share="morph"
          default="none"
        >
          <WalletCardVtPlaceholder walletId={cardId} variant="credit" />
        </ViewTransition>
        <Skeleton className="h-14 w-full rounded-2xl" />
        <Skeleton className="h-20 w-full rounded-2xl" />
      </div>
      <div className="rounded-t-[1.75rem] border border-border/60 bg-card px-4 pt-3 pb-4">
        <Skeleton className="mx-auto mb-3 h-1 w-10 rounded-full lg:hidden" />
        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-[4.5rem] rounded-2xl" />
          ))}
        </div>
        <Skeleton className="mt-4 h-10 w-full rounded-xl" />
        <Skeleton className="mt-4 h-48 w-full rounded-2xl" />
      </div>
    </div>
  </DirectionalTransition>
);

const TabContentSkeleton = () => (
  <div className="space-y-3 py-1">
    <Skeleton className="h-32 w-full rounded-2xl" />
    <Skeleton className="h-24 w-full rounded-2xl" />
  </div>
);

export default function CreditCardDetailPage() {
  const params = useParams<{ id: string }>();
  const { context } = useFinanceContext();
  const creditCardId = Number(params.id);
  const today = todayCalendarDate();
  const { asOf: asOfDate, tab, setAsOf: setAsOfDate, setTab } =
    useCreditCardCycleUrlState({ defaultAsOf: today });

  const [card, setCard] = useState<CreditCardListItem | null>(null);
  const [statement, setStatement] =
    useState<CreditCardStatementResponse | null>(null);
  const [paymentSources, setPaymentSources] = useState<PaymentMethodOption[]>(
    [],
  );
  const [categoryOptions, setCategoryOptions] = useState<CategoryOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [cycleLoading, setCycleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [externalPaymentDialogOpen, setExternalPaymentDialogOpen] =
    useState(false);
  const [purchaseDialogOpen, setPurchaseDialogOpen] = useState(false);
  const [installmentPlanDialogOpen, setInstallmentPlanDialogOpen] =
    useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);
  const [balanceDialogOpen, setBalanceDialogOpen] = useState(false);
  const [statementImports, setStatementImports] = useState<
    CreditCardStatementImportListItem[]
  >([]);
  const [mpImportDialogOpen, setMpImportDialogOpen] = useState(false);
  const [rollbackImportId, setRollbackImportId] = useState<number | null>(null);
  const [editCardDialogOpen, setEditCardDialogOpen] = useState(false);
  const [editCardFormError, setEditCardFormError] = useState<string | null>(null);
  const [paymentPlanItems, setPaymentPlanItems] = useState<
    CreditCardPaymentPlanView[]
  >([]);
  const [paymentFortnightId, setPaymentFortnightId] = useState<
    number | undefined
  >(undefined);
  const [paymentSuggestedOverride, setPaymentSuggestedOverride] = useState<
    number | undefined
  >(undefined);

  const ownerQueryString = useMemo(() => {
    const q = buildOwnerQuery(context);
    const s = q.toString();
    return s ? `?${s}` : '';
  }, [context]);

  const fundingWalletOptions = useMemo(
    () =>
      paymentSources.filter(
        (wallet) => wallet.type === 'CASH' || wallet.type === 'DEBIT_CARD',
      ),
    [paymentSources],
  );

  const loadData = useCallback(
    async (options?: { cycleOnly?: boolean }) => {
      if (context.id === 0) {
        return;
      }

      if (!Number.isFinite(creditCardId)) {
        setError('Tarjeta inválida');
        setLoading(false);
        return;
      }

      const cycleOnly = options?.cycleOnly ?? false;

      try {
        if (cycleOnly) {
          setCycleLoading(true);
        } else {
          setLoading(true);
        }
        setError(null);

        const statementPromise = getCreditCardStatement(
          creditCardId,
          context,
          asOfDate,
        );

        if (cycleOnly && card) {
          const statementData = await statementPromise;
          setStatement(statementData);
          return;
        }

        // Hero-first: card + statement unblock the morph; secondary loads after.
        const [cardData, statementData] = await Promise.all([
          clientFetchFromApi<CreditCardListItem>(
            `/api/credit-cards/${creditCardId}`,
            undefined,
            context,
          ),
          statementPromise,
        ]);

        // Activate share morph for placeholder → real hero (same VT name).
        startTransition(() => {
          setCard(cardData);
          setStatement(statementData);
          setLoading(false);
        });

        try {
          const [paymentMethodsData, categoriesData, planData] =
            await Promise.all([
              getPaymentMethodOptions(context),
              clientFetchFromApi<CategoryOption[]>(
                '/api/categories',
                undefined,
                context,
              ),
              getCreditCardPaymentPlan(creditCardId, context).catch(() => ({
                items: [],
              })),
            ]);

          let importsData: CreditCardStatementImportListItem[] = [];
          try {
            importsData = await listCreditCardStatementImports(
              creditCardId,
              context,
            );
          } catch {
            importsData = [];
          }

          setPaymentSources(paymentMethodsData);
          setCategoryOptions(categoriesData);
          setStatementImports(importsData);
          setPaymentPlanItems(planData.items);
        } catch {
          /* hero already visible — secondary chrome optional */
        }
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Error al cargar el estado de cuenta',
        );
        setLoading(false);
      } finally {
        setCycleLoading(false);
      }
    },
    [asOfDate, card, context, creditCardId],
  );

  useEffect(() => {
    if (card && statement) {
      void loadData({ cycleOnly: true });
      return;
    }
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial load vs cycle refetch
  }, [asOfDate, context.id, creditCardId]);

  const handlePaymentSubmit = async (data: CreditCardPaymentSubmitPayload) => {
    const activeFortnightId = paymentFortnightId ?? data.fortnight_id;
    try {
      setPaymentSubmitting(true);
      setPaymentError(null);

      await createCreditCardPayment(
        creditCardId,
        {
          mode: 'wallet',
          ...data,
          create_fortnight_expense: true,
          fortnight_id: activeFortnightId,
        },
        context,
      );

      // Keep the plan after paying so a covered custom plan stays "pagado".
      toast.success('Pago registrado');
      setPaymentDialogOpen(false);
      setPaymentFortnightId(undefined);
      setPaymentSuggestedOverride(undefined);
      await loadData();
    } catch (err) {
      setPaymentError(
        err instanceof Error ? err.message : 'Error al registrar el pago',
      );
    } finally {
      setPaymentSubmitting(false);
    }
  };

  const handleExternalPaymentSubmit = async (
    data: CreditCardExternalPaymentSubmitPayload,
  ) => {
    try {
      setPaymentSubmitting(true);
      setPaymentError(null);

      await createCreditCardPayment(creditCardId, data, context);

      toast.success('Pago histórico registrado');
      setExternalPaymentDialogOpen(false);
      await loadData();
    } catch (err) {
      setPaymentError(
        err instanceof Error
          ? err.message
          : 'Error al registrar el pago histórico',
      );
    } finally {
      setPaymentSubmitting(false);
    }
  };

  const handleOpenPlanPayment = useCallback(
    (item: CreditCardPaymentPlanView) => {
      setPaymentFortnightId(item.fortnightId);
      setPaymentSuggestedOverride(item.effectiveAmount);
      setPaymentDialogOpen(true);
    },
    [],
  );

  const isCurrentCycle = useMemo(() => {
    if (!statement) return true;
    return (
      today >= statement.current_cycle_start &&
      today <= statement.current_cycle_end
    );
  }, [statement, today]);

  const handlePreviousCycle = useCallback(() => {
    if (!statement) return;
    setAsOfDate(shiftDateByDays(statement.statement_start, -1));
  }, [setAsOfDate, statement]);

  const handleNextCycle = useCallback(() => {
    if (!statement) return;
    setAsOfDate(shiftDateByDays(statement.current_cycle_end, 1));
  }, [setAsOfDate, statement]);

  const handleResetToToday = useCallback(() => {
    setAsOfDate(today);
  }, [setAsOfDate, today]);

  const handleTabChange = useCallback(
    (value: string) => {
      setTab(value as CreditCardCycleTab);
    },
    [setTab],
  );

  const handleExportCsv = useCallback(() => {
    if (!card || !statement) return;
    try {
      downloadCreditCardStatementCsv(card.name, statement);
      toast.success('CSV descargado');
    } catch {
      toast.error('No se pudo exportar el CSV');
    }
  }, [card, statement]);

  const handleExportPdf = useCallback(() => {
    if (!card || !statement) return;
    try {
      downloadCreditCardStatementPdf(card.name, statement);
      toast.success('PDF descargado');
    } catch {
      toast.error('No se pudo exportar el PDF');
    }
  }, [card, statement]);

  const handleDownloadStatementImport = useCallback(
    async (importId: number) => {
      try {
        await downloadCreditCardStatementImportFile(
          creditCardId,
          importId,
          context,
        );
        toast.success('PDF descargado');
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : 'No se pudo descargar el archivo',
        );
      }
    },
    [context, creditCardId],
  );

  const rollbackImportSummary = useMemo(() => {
    if (rollbackImportId == null) return null;
    return statementImports.find((r) => r.id === rollbackImportId) ?? null;
  }, [rollbackImportId, statementImports]);

  const handleConfirmRollbackImport = useCallback(async () => {
    if (rollbackImportId == null) return;
    try {
      const res = await rollbackCreditCardStatementImport(
        creditCardId,
        rollbackImportId,
        context,
      );
      toast.success(
        res.expenses_removed > 0
          ? `Importación revertida: ${res.expenses_removed} gasto(s) eliminado(s).`
          : 'Importación eliminada.',
      );
      setRollbackImportId(null);
      await loadData();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'No se pudo revertir la importación',
      );
      throw err;
    }
  }, [context, creditCardId, loadData, rollbackImportId]);

  const handleEditCard = useCallback(
    async (data: WalletFormValues) => {
      try {
        setEditCardFormError(null);
        await updateCreditCard(creditCardId, data, context);
        toast.success('Tarjeta actualizada');
        await loadData();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Error al actualizar la tarjeta';
        setEditCardFormError(message);
        throw err;
      }
    },
    [context, creditCardId, loadData],
  );

  const handleOpenEditCardDialog = useCallback(() => {
    setEditCardFormError(null);
    setEditCardDialogOpen(true);
  }, []);

  const handleOpenPurchase = useCallback(() => {
    setPurchaseDialogOpen(true);
  }, []);

  const handleOpenPayment = useCallback(() => {
    setPaymentDialogOpen(true);
  }, []);

  const handleOpenImport = useCallback(() => {
    setMpImportDialogOpen(true);
  }, []);

  const handleOpenBalance = useCallback(() => {
    setBalanceDialogOpen(true);
  }, []);

  const handleOpenExternalPayment = useCallback(() => {
    setExternalPaymentDialogOpen(true);
  }, []);

  const daysUntilDue = useMemo(() => {
    if (!statement) return 0;
    const due = parseCalendarDate(statement.statement_due_date.slice(0, 10));
    const todayDate = parseCalendarDate(today);
    return Math.round((due.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));
  }, [statement, today]);

  const utilizationPct = useMemo((): number | null => {
    if (!statement?.credit_limit || statement.credit_limit === 0) return null;
    return Math.min(
      100,
      Math.round((statement.outstanding_balance / statement.credit_limit) * 100),
    );
  }, [statement]);

  const paymentDialogSuggestedAmount = useMemo(() => {
    const currentPlan =
      paymentPlanItems.find((item) => item.isCurrentFortnight) ??
      paymentPlanItems[0];
    if (!currentPlan) {
      return statement?.next_due_payment ?? 0;
    }
    return currentPlan.effectiveAmount;
  }, [paymentPlanItems, statement?.next_due_payment]);

  const reconciliation = useMemo(() => {
    if (!statement) return null;
    return computeCreditCardCycleReconciliation({
      lastStatementBalance: statement.last_statement_balance,
      paymentsAppliedToStatement: statement.payments_applied_to_statement,
      currentCyclePurchases: statement.current_cycle_purchases,
      currentCyclePayments: statement.current_cycle_payments,
      outstandingBalance: statement.outstanding_balance,
      importedStatementTotal: statement.imported_statement_total,
      importedMinimumPayment: statement.minimum_payment,
    });
  }, [statement]);

  const cycleImport = useMemo(() => {
    if (!statement) return null;
    return (
      statementImports.find(
        (importRecord) =>
          importRecord.period_end?.slice(0, 10) === statement.statement_end,
      ) ?? null
    );
  }, [statement, statementImports]);

  const cycleRangeLabel = statement
    ? formatCycleRange(statement.current_cycle_start, statement.current_cycle_end)
    : '';

  const compraIcon = useMemo(
    () => <ShoppingCart className="size-5" data-icon="inline-start" />,
    [],
  );

  const overflowItems = useMemo((): ToolbarOverflowItem[] => {
    if (!card) return [];
    return [
      {
        key: 'pay',
        label: 'Pagar',
        onClick: handleOpenPayment,
        icon: <Wallet data-icon="inline-start" />,
      },
      {
        key: 'external',
        label: 'Ya pagado',
        onClick: handleOpenExternalPayment,
        icon: <CheckCircle2 data-icon="inline-start" />,
      },
      {
        key: 'import',
        label: 'Estado de cuenta',
        onClick: handleOpenImport,
        icon: <Upload data-icon="inline-start" />,
      },
      {
        key: 'adjust',
        label: 'Ajustar',
        onClick: handleOpenBalance,
        icon: <SlidersHorizontal data-icon="inline-start" />,
      },
      {
        key: 'edit',
        label: 'Editar tarjeta',
        onClick: handleOpenEditCardDialog,
        icon: <Pencil data-icon="inline-start" />,
      },
      {
        key: 'export-csv',
        label: 'Exportar CSV',
        onClick: handleExportCsv,
        icon: <Download data-icon="inline-start" />,
      },
      {
        key: 'export-pdf',
        label: 'Exportar PDF',
        onClick: handleExportPdf,
        icon: <FileText data-icon="inline-start" />,
      },
    ];
  }, [
    card,
    handleExportCsv,
    handleExportPdf,
    handleOpenEditCardDialog,
    handleOpenPayment,
    handleOpenExternalPayment,
    handleOpenImport,
    handleOpenBalance,
  ]);

  useRegisterToolbarActions({
    primaryAction: card
      ? {
          label: 'Compra',
          onClick: handleOpenPurchase,
          icon: compraIcon,
        }
      : null,
    overflow: overflowItems.length > 0 ? { items: overflowItems } : null,
  });

  if (context.id === 0 || (loading && !card)) {
    return <CreditCardDetailSkeleton cardId={creditCardId} />;
  }

  if (error || !card || !statement) {
    return (
      <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
        {error ?? 'No se pudo cargar la tarjeta'}
      </div>
    );
  }

  return (
    <DirectionalTransition>
    <div className="relative">
      <CreditCardHeroZone>
        <ViewTransition
          name={walletCardViewTransitionName(card.id)}
          share="morph"
          default="none"
        >
          <CreditCardVisualHero
            card={card}
            statement={statement}
            utilizationPct={utilizationPct}
          />
        </ViewTransition>
        <CreditCardDuePaymentStrip
          statement={statement}
          daysUntilDue={daysUntilDue}
        />

        {isCurrentCycle ? (
          <CreditCardCycleSpendingBar
            items={statement.current_cycle_purchase_items}
            total={statement.current_cycle_purchases}
          />
        ) : (
          <p className="rounded-2xl border border-border/50 bg-muted/15 px-4 py-2 text-center text-xs text-muted-foreground">
            Viendo ciclo {cycleRangeLabel} — el desglose por categoría corresponde al ciclo seleccionado abajo.
          </p>
        )}
      </CreditCardHeroZone>

      <Tabs value={tab} onValueChange={handleTabChange} className="gap-4">
        <CreditCardCycleWorkspaceShell
          chrome={
            <>
              <CreditCardCycleSummary
                statement={statement}
                isCurrentCycle={isCurrentCycle}
                onPreviousCycle={handlePreviousCycle}
                onNextCycle={handleNextCycle}
                onResetToToday={handleResetToToday}
                formatCycleRange={formatCycleRange}
                onAdjustDebt={() => setBalanceDialogOpen(true)}
              />
              <div className="mt-4">
                <CreditCardDetailTabsList>
                <CreditCardDetailTabTrigger value="movimientos">
                  Movimientos
                </CreditCardDetailTabTrigger>
                <CreditCardDetailTabTrigger value="resumen">
                  Resumen
                </CreditCardDetailTabTrigger>
                <CreditCardDetailTabTrigger value="cuotas">
                  Cuotas
                  {statement.installment_active_purchases.length > 0 ? (
                    <Badge
                      variant="default"
                      className="pointer-events-none ml-1 hidden h-4 min-w-4 shrink-0 justify-center rounded-full border-0 px-1 text-[10px] font-mono font-semibold tabular-nums shadow-none group-data-[state=active]:bg-primary-foreground/20 group-data-[state=active]:text-primary-foreground sm:inline-flex sm:h-5 sm:min-w-5 sm:px-1.5 sm:text-[11px]"
                      aria-hidden
                    >
                      {statement.installment_active_purchases.length}
                    </Badge>
                  ) : null}
                </CreditCardDetailTabTrigger>
                </CreditCardDetailTabsList>
              </div>
            </>
          }
        >
          <TabsContent value="movimientos" className="mt-0 space-y-4">
            {cycleLoading ? (
              <TabContentSkeleton />
            ) : (
              <CreditCardCycleLedger
                cycleStart={statement.current_cycle_start}
                cycleEnd={statement.current_cycle_end}
                statementEnd={statement.statement_end}
                cyclePurchases={statement.current_cycle_purchase_items}
                payments={statement.payment_history}
                imports={statementImports}
                ownerQueryString={ownerQueryString}
                reconciliation={reconciliation}
                onRegisterPurchase={() => setPurchaseDialogOpen(true)}
                onRegisterPayment={() => setPaymentDialogOpen(true)}
                onGoToCuotas={() => setTab('cuotas')}
              />
            )}
          </TabsContent>

          <TabsContent value="resumen" className="mt-0 space-y-4">
            {cycleLoading ? (
              <TabContentSkeleton />
            ) : (
              <>
                {reconciliation ? (
                  <CreditCardReconciliationStrip
                    reconciliation={reconciliation}
                    cycleDueDate={statement.statement_due_date}
                    cycleImport={cycleImport}
                    onOpenImportDialog={() => setMpImportDialogOpen(true)}
                  />
                ) : null}

                <CreditCardPlannedPaymentSection
                  walletId={creditCardId}
                  items={paymentPlanItems}
                  onPlanUpdated={loadData}
                  onPayCard={handleOpenPlanPayment}
                />

                <div className="grid gap-4 lg:grid-cols-3">
                  <div className="lg:col-span-2">
                    <CreditCardPaymentsChart
                      paymentHistory={statement.payment_history}
                      installmentActivePurchases={
                        statement.installment_active_purchases
                      }
                      statementEnd={statement.statement_end}
                      cycleLabel={cycleRangeLabel}
                    />
                  </div>
                  <CreditCardStatementSummaryCard
                    statement={statement}
                    daysUntilDue={daysUntilDue}
                  />
                </div>

                <LinkedLoansCard walletId={creditCardId} />
              </>
            )}
          </TabsContent>

          <TabsContent value="cuotas" className="mt-0 space-y-4">
            {cycleLoading ? (
              <TabContentSkeleton />
            ) : (
              <>
                <CreditCardInstallmentPlansSection
                  creditCardId={creditCardId}
                  context={context}
                  defaultDueDay={card.due_day}
                  onChanged={() => loadData({ cycleOnly: true })}
                  createDialogOpen={installmentPlanDialogOpen}
                  onCreateDialogOpenChange={setInstallmentPlanDialogOpen}
                />
                <CreditCardScheduledPaymentsSection
                  creditCardId={creditCardId}
                  context={context}
                  onChanged={() => loadData({ cycleOnly: true })}
                />
                <CreditCardInstallmentPortfolio
                  purchases={statement.installment_active_purchases}
                  ownerQueryString={ownerQueryString}
                  onCreateInstallmentPlan={() =>
                    setInstallmentPlanDialogOpen(true)
                  }
                />
              </>
            )}
          </TabsContent>
        </CreditCardCycleWorkspaceShell>
      </Tabs>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border/60 bg-background/95 p-3 backdrop-blur-sm supports-[backdrop-filter]:bg-background/80 lg:hidden">
        <div className="mx-auto flex max-w-md gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-11 flex-1 rounded-xl"
            onClick={() => setPurchaseDialogOpen(true)}
          >
            Compra
          </Button>
          <Button
            type="button"
            className="h-11 flex-1 rounded-xl shadow-sm"
            onClick={() => {
              setPaymentFortnightId(undefined);
              setPaymentSuggestedOverride(undefined);
              setPaymentDialogOpen(true);
            }}
          >
            <Wallet data-icon="inline-start" className="h-4 w-4" aria-hidden />
            Registrar pago
          </Button>
        </div>
      </div>

      <CreditCardPaymentDialog
        open={paymentDialogOpen}
        onOpenChange={(open) => {
          setPaymentDialogOpen(open);
          if (!open) {
            setPaymentError(null);
            setPaymentFortnightId(undefined);
            setPaymentSuggestedOverride(undefined);
          }
        }}
        fundingWalletOptions={fundingWalletOptions}
        categoryOptions={categoryOptions}
        nextDuePayment={
          paymentSuggestedOverride ?? paymentDialogSuggestedAmount
        }
        outstandingBalance={statement.outstanding_balance}
        submitting={paymentSubmitting}
        error={paymentError}
        fortnightId={paymentFortnightId}
        onConfirm={handlePaymentSubmit}
      />

      <CreditCardExternalPaymentDialog
        open={externalPaymentDialogOpen}
        onOpenChange={(open) => {
          setExternalPaymentDialogOpen(open);
          if (!open) setPaymentError(null);
        }}
        nextDuePayment={
          paymentSuggestedOverride ?? paymentDialogSuggestedAmount
        }
        outstandingBalance={statement.outstanding_balance}
        submitting={paymentSubmitting}
        error={paymentError}
        onConfirm={handleExternalPaymentSubmit}
      />

      <CreditCardQuickPurchaseDialog
        open={purchaseDialogOpen}
        onOpenChange={setPurchaseDialogOpen}
        creditCardId={creditCardId}
        context={context}
        onSuccess={loadData}
        availableCredit={statement.available_credit}
        creditLimit={statement.credit_limit}
      />

      <WalletBalanceDialog
        open={balanceDialogOpen}
        onOpenChange={setBalanceDialogOpen}
        walletId={creditCardId}
        walletName={card.name}
        currentAmount={statement.outstanding_balance}
        context={context}
        onSuccess={() => {
          void loadData();
        }}
        variant="credit"
        creditLimit={statement.credit_limit}
      />

      <CreditCardStatementImportDialog
        open={mpImportDialogOpen}
        onOpenChange={setMpImportDialogOpen}
        creditCardId={creditCardId}
        context={context}
        categoryOptions={categoryOptions}
        statementImports={statementImports}
        walletProviderIconKey={card?.provider_icon_key ?? null}
        walletName={card?.name ?? ''}
        onSuccess={loadData}
        onDownloadImport={handleDownloadStatementImport}
        onRollbackClick={(id) => setRollbackImportId(id)}
      />

      <ConfirmDeleteDialog
        open={rollbackImportId !== null}
        onOpenChange={(open) => {
          if (!open) setRollbackImportId(null);
        }}
        onConfirm={handleConfirmRollbackImport}
        title="Revertir importación"
        confirmLabel="Revertir"
        loadingLabel="Revirtiendo…"
        description="Se eliminarán los gastos generados por este PDF, se corregirá la deuda de la tarjeta y se borrará el registro de importación (incluido el archivo guardado, si aplica). Esta acción no se puede deshacer."
        itemName={
          rollbackImportSummary
            ? rollbackImportSummary.period_start &&
              rollbackImportSummary.period_end
              ? `${formatDate(rollbackImportSummary.period_start.slice(0, 10))} – ${formatDate(rollbackImportSummary.period_end.slice(0, 10))}`
              : rollbackImportSummary.file_name ?? `Importación #${rollbackImportSummary.id}`
            : undefined
        }
      />

      <WalletForm
        open={editCardDialogOpen}
        onOpenChange={(open) => {
          setEditCardDialogOpen(open);
          if (!open) setEditCardFormError(null);
        }}
        onSave={handleEditCard}
        mode="edit"
        showAmountField={!isCreditOrStoreCardWalletType(card.type)}
        allowedTypes={['CREDIT_CARD', 'DEPARTMENT_STORE_CARD']}
        defaultValues={{
          name: card.name,
          amount: card.amount ?? 0,
          credit_limit: card.credit_limit ?? null,
          temporary_credit_limit: card.temporary_credit_limit ?? null,
          type: card.type as PaymentMethodType,
          provider_icon_key: card.provider_icon_key ?? null,
          active: card.active,
          include_in_liquidity: card.include_in_liquidity ?? true,
          cutoff_day: card.cutoff_day,
          due_day: card.due_day,
          goal_amount: null,
          goal_due_date: null,
          assignee_user_id: card.assignee_user_id ?? null,
        }}
        error={
          editCardFormError && editCardDialogOpen ? editCardFormError : null
        }
      />
    </div>
    </DirectionalTransition>
  );
};
