'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  CalendarClock,
  ChevronDown,
  SlidersHorizontal,
  Wallet,
} from 'lucide-react';
import { toast } from 'sonner';
import ConfirmDeleteDialog from '@/components/ConfirmDeleteDialog';
import WalletForm from '@/components/WalletForm';
import { WalletFormValues } from '@/schemas/wallet.schema';
import {
  CreditCardActivitySectionCard,
  CreditCardActivitySheet,
  CreditCardCycleSpendingBar,
  CreditCardCycleSummary,
  CreditCardDetailHeaderActions,
  CreditCardDetailTabTrigger,
  CreditCardDetailTabsList,
  CreditCardDuePaymentStrip,
  CreditCardHeroZone,
  CreditCardQuickActions,
  CreditCardStatementSummaryCard,
  CreditCardVisualHero,
} from '@/components/credit-cards/CreditCardDetailSections';
import {
  PaymentTableBlock,
  PurchaseTableBlock,
} from '@/components/credit-cards/CreditCardDetailTables';
import {
  CreditCardFeedEmpty,
  CreditCardRecentMovements,
  GroupedPurchaseFeed,
} from '@/components/credit-cards/CreditCardTransactionFeed';
import { CreditCardPlannedPaymentSection } from '@/components/credit-cards/CreditCardPlannedPaymentSection';
import CreditCardStatementImportDialog from '@/components/credit-cards/CreditCardStatementImportDialog';
import { CreditCardPaymentsChart } from '@/components/credit-cards/CreditCardPaymentsChart';
import CreditCardPaymentDialog from '@/components/credit-cards/CreditCardPaymentDialog';
import CreditCardQuickPurchaseDialog from '@/components/credit-cards/CreditCardQuickPurchaseDialog';
import WalletBalanceDialog from '@/components/wallets/WalletBalanceDialog';
import LinkedLoansCard from '@/components/loans/LinkedLoansCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { useFinanceContext } from '@/context/finance-context';
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
import type { CreditCardPaymentSubmitPayload } from '@/components/credit-cards/CreditCardPaymentDialog';
import { downloadCreditCardStatementCsv } from '@/lib/finance/credit-card-statement-csv';
import { downloadCreditCardStatementPdf } from '@/lib/finance/credit-card-statement-pdf';
import {
  type PaymentMethodType,
  isCreditOrStoreCardWalletType,
} from '@/domain/payment-method';
import { formatDate } from '@/lib/utils';
import type {
  CategoryOption,
  CreditCardListItem,
  CreditCardPaymentPlanView,
  CreditCardStatementImportListItem,
  CreditCardStatementResponse,
  PaymentMethodOption,
} from '@/types/catalog';
import { getEffectiveCardPaymentAmount } from '@/lib/finance/credit-card-payment-plan.utils';

const getTodayDateString = () => new Date().toISOString().split('T')[0];

const shiftDateByDays = (dateStr: string, days: number): string => {
  const date = new Date(dateStr + 'T12:00:00Z');
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().split('T')[0];
};

const formatCycleRange = (start: string, end: string) =>
  `${formatDate(start)} – ${formatDate(end)}`;

const CreditCardDetailSkeleton = () => (
  <div className="space-y-0 pb-24 lg:pb-0">
    <div className="relative -mx-4 space-y-4 px-4 pb-4 sm:-mx-0">
      <div className="flex items-center justify-between">
        <Skeleton className="h-9 w-28" />
        <Skeleton className="h-9 w-9 rounded-lg" />
      </div>
      <Skeleton className="mx-auto aspect-[1.586/1] w-full max-w-md rounded-2xl" />
      <Skeleton className="h-14 w-full rounded-2xl" />
      <div className="flex justify-center gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-14 rounded-full" />
        ))}
      </div>
      <Skeleton className="h-20 w-full rounded-2xl" />
    </div>
    <div className="rounded-t-[1.75rem] border border-border/60 bg-card px-4 pt-3 pb-4">
      <Skeleton className="mx-auto mb-3 h-1 w-10 rounded-full" />
      <div className="grid grid-cols-3 gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-[4.5rem] rounded-2xl" />
        ))}
      </div>
      <Skeleton className="mt-4 h-10 w-full rounded-xl" />
      <Skeleton className="mt-4 h-48 w-full rounded-2xl" />
    </div>
  </div>
);

export default function CreditCardDetailPage() {
  const params = useParams<{ id: string }>();
  const { context } = useFinanceContext();
  const creditCardId = Number(params.id);

  const [card, setCard] = useState<CreditCardListItem | null>(null);
  const [statement, setStatement] =
    useState<CreditCardStatementResponse | null>(null);
  const [paymentSources, setPaymentSources] = useState<PaymentMethodOption[]>(
    [],
  );
  const [categoryOptions, setCategoryOptions] = useState<CategoryOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [purchaseDialogOpen, setPurchaseDialogOpen] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);
  const [asOfDate, setAsOfDate] = useState(getTodayDateString());
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

  const ownerQueryString = useMemo(() => {
    const q = buildOwnerQuery(context);
    const s = q.toString();
    return s ? `?${s}` : '';
  }, [context]);

  const backHref = useMemo(
    () => `/wallets${ownerQueryString}`,
    [ownerQueryString],
  );

  const fundingWalletOptions = useMemo(
    () =>
      paymentSources.filter(
        (wallet) => wallet.type === 'CASH' || wallet.type === 'DEBIT_CARD',
      ),
    [paymentSources],
  );

  const loadData = useCallback(async () => {
    if (context.id === 0) {
      return;
    }

    if (!Number.isFinite(creditCardId)) {
      setError('Tarjeta inválida');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const [cardData, statementData, paymentMethodsData, categoriesData, planData] =
        await Promise.all([
          clientFetchFromApi<CreditCardListItem>(
            `/api/credit-cards/${creditCardId}`,
            undefined,
            context,
          ),
          getCreditCardStatement(creditCardId, context, asOfDate),
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

      setCard(cardData);
      setStatement(statementData);
      setPaymentSources(paymentMethodsData);
      setCategoryOptions(categoriesData);
      setStatementImports(importsData);
      setPaymentPlanItems(planData.items);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Error al cargar el estado de cuenta',
      );
    } finally {
      setLoading(false);
    }
  }, [asOfDate, context, creditCardId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handlePaymentSubmit = async (data: CreditCardPaymentSubmitPayload) => {
    try {
      setPaymentSubmitting(true);
      setPaymentError(null);

      await createCreditCardPayment(creditCardId, data, context);

      toast.success('Pago registrado');
      setPaymentDialogOpen(false);
      await loadData();
    } catch (err) {
      setPaymentError(
        err instanceof Error ? err.message : 'Error al registrar el pago',
      );
    } finally {
      setPaymentSubmitting(false);
    }
  };

  const isCurrentCycle = useMemo(() => {
    if (!statement) return true;
    const today = getTodayDateString();
    return (
      today >= statement.current_cycle_start &&
      today <= statement.current_cycle_end
    );
  }, [statement]);

  const handlePreviousCycle = useCallback(() => {
    if (!statement) return;
    setAsOfDate(shiftDateByDays(statement.statement_start, -1));
  }, [statement]);

  const handleNextCycle = useCallback(() => {
    if (!statement) return;
    setAsOfDate(shiftDateByDays(statement.current_cycle_end, 1));
  }, [statement]);

  const handleResetToToday = useCallback(() => {
    setAsOfDate(getTodayDateString());
  }, []);

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

  const daysUntilDue = useMemo(() => {
    if (!statement) return 0;
    const today = new Date(getTodayDateString() + 'T12:00:00Z');
    const due = new Date(statement.statement_due_date + 'T12:00:00Z');
    return Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  }, [statement]);

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
    return getEffectiveCardPaymentAmount({
      nextDuePayment: currentPlan.suggestedAmount,
      plannedPayment: currentPlan.plannedPayment,
    });
  }, [paymentPlanItems, statement?.next_due_payment]);

  if (context.id === 0 || (loading && !statement)) {
    return <CreditCardDetailSkeleton />;
  }

  if (error || !card || !statement) {
    return (
      <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
        {error ?? 'No se pudo cargar la tarjeta'}
      </div>
    );
  }

  return (
    <div className="relative pb-24 lg:pb-0">
      <CreditCardHeroZone>
        <CreditCardDetailHeaderActions
          card={card}
          backHref={backHref}
          onOpenImportDialog={() => setMpImportDialogOpen(true)}
          onExportCsv={handleExportCsv}
          onExportPdf={handleExportPdf}
          onEditCard={handleOpenEditCardDialog}
          onAdjustBalance={() => setBalanceDialogOpen(true)}
        />

        <CreditCardVisualHero
          card={card}
          statement={statement}
          utilizationPct={utilizationPct}
        />

        <CreditCardDuePaymentStrip
          statement={statement}
          daysUntilDue={daysUntilDue}
        />

        <CreditCardQuickActions
          onOpenPaymentDialog={() => setPaymentDialogOpen(true)}
          onOpenPurchaseDialog={() => setPurchaseDialogOpen(true)}
          onOpenImportDialog={() => setMpImportDialogOpen(true)}
          onAdjustBalance={() => setBalanceDialogOpen(true)}
        />

        <CreditCardCycleSpendingBar
          items={statement.current_cycle_purchase_items}
          total={statement.current_cycle_purchases}
        />
      </CreditCardHeroZone>

      <CreditCardActivitySheet>
        <CreditCardCycleSummary
          statement={statement}
          isCurrentCycle={isCurrentCycle}
          onPreviousCycle={handlePreviousCycle}
          onNextCycle={handleNextCycle}
          onResetToToday={handleResetToToday}
          formatCycleRange={formatCycleRange}
          onAdjustDebt={() => setBalanceDialogOpen(true)}
        />

        <Tabs defaultValue="actividad" className="mt-5 gap-4">
          <CreditCardDetailTabsList>
            <CreditCardDetailTabTrigger value="actividad">
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

          <TabsContent value="actividad" className="mt-0 space-y-4">
            <CreditCardRecentMovements
              purchases={statement.current_cycle_purchase_items}
              payments={statement.payment_history}
              ownerQueryString={ownerQueryString}
              onRegisterPurchase={() => setPurchaseDialogOpen(true)}
              onRegisterPayment={() => setPaymentDialogOpen(true)}
            />

            <Collapsible>
              <CollapsibleTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className="h-auto w-full justify-between rounded-2xl border-border/60 bg-card px-4 py-3 text-left shadow-sm hover:bg-muted/20"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                      <SlidersHorizontal className="h-4 w-4" aria-hidden />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-foreground">
                        Historial completo y filtros avanzados
                      </span>
                      <span className="block text-xs font-normal text-muted-foreground">
                        Revisa compras del último corte y pagos anteriores.
                      </span>
                    </span>
                  </span>
                  <ChevronDown
                    className="h-4 w-4 shrink-0 text-muted-foreground"
                    aria-hidden
                  />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-3 space-y-4">
                <CreditCardActivitySectionCard
                  title="Compras del último corte"
                  subtitle="Estado de cuenta importado o calculado"
                  accentClass="border-l-blue-500/50"
                  icon={
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-blue-500/10 dark:bg-blue-500/15">
                      <CalendarClock className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                    </span>
                  }
                >
                  {statement.statement_purchases.length === 0 ? (
                    <CreditCardFeedEmpty message="No hubo compras en el último corte." />
                  ) : (
                    <PurchaseTableBlock
                      items={statement.statement_purchases}
                      emptyText="No hay compras que coincidan con el filtro."
                      ownerQueryString={ownerQueryString}
                      regionLabel="Compras del último corte"
                    />
                  )}
                </CreditCardActivitySectionCard>

                <CreditCardActivitySectionCard
                  title="Historial completo de pagos"
                  accentClass="border-l-emerald-500/50"
                  icon={
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-emerald-500/10 dark:bg-emerald-500/15">
                      <Wallet className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                    </span>
                  }
                >
                  <PaymentTableBlock
                    items={statement.payment_history}
                    regionLabel="Historial de pagos"
                  />
                </CreditCardActivitySectionCard>
              </CollapsibleContent>
            </Collapsible>
          </TabsContent>

          <TabsContent value="resumen" className="mt-0 space-y-4">
          <CreditCardPlannedPaymentSection
            walletId={creditCardId}
            items={paymentPlanItems}
            onPlanUpdated={loadData}
          />

          <div className="grid gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <CreditCardPaymentsChart
                paymentHistory={statement.payment_history}
                installmentActivePurchases={statement.installment_active_purchases}
                statementEnd={statement.statement_end}
              />
            </div>
            <CreditCardStatementSummaryCard
              statement={statement}
              daysUntilDue={daysUntilDue}
            />
          </div>

          <LinkedLoansCard walletId={creditCardId} />
        </TabsContent>

          <TabsContent value="cuotas" className="mt-0 space-y-4">
            {statement.installment_active_purchases.length === 0 ? (
              <CreditCardFeedEmpty
                message="Sin cuotas vigentes"
                description="Las compras a meses con pagos pendientes aparecerán aquí."
              />
            ) : (
              <GroupedPurchaseFeed
                items={statement.installment_active_purchases}
                ownerQueryString={ownerQueryString}
                regionLabel="Cuotas vigentes"
                emptyText="Ningún resultado con el filtro aplicado."
              />
            )}
          </TabsContent>
        </Tabs>
      </CreditCardActivitySheet>

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
            onClick={() => setPaymentDialogOpen(true)}
          >
            <Wallet className="mr-2 h-4 w-4" />
            Registrar pago
          </Button>
        </div>
      </div>

      <CreditCardPaymentDialog
        open={paymentDialogOpen}
        onOpenChange={(open) => {
          setPaymentDialogOpen(open);
          if (!open) setPaymentError(null);
        }}
        fundingWalletOptions={fundingWalletOptions}
        categoryOptions={categoryOptions}
        nextDuePayment={paymentDialogSuggestedAmount}
        outstandingBalance={statement.outstanding_balance}
        submitting={paymentSubmitting}
        error={paymentError}
        onSubmit={handlePaymentSubmit}
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
        onSuccess={loadData}
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
        onSubmit={handleEditCard}
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
          cutoff_day: card.cutoff_day,
          due_day: card.due_day,
          assignee_user_id: card.assignee_user_id ?? null,
        }}
        error={
          editCardFormError && editCardDialogOpen ? editCardFormError : null
        }
      />
    </div>
  );
}
