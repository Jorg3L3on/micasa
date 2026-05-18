'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { CalendarClock } from 'lucide-react';
import { toast } from 'sonner';
import ConfirmDeleteDialog from '@/components/ConfirmDeleteDialog';
import WalletForm from '@/components/WalletForm';
import { WalletFormValues } from '@/schemas/wallet.schema';
import {
  CreditCardCycleSummary,
  CreditCardDetailHeaderActions,
  CreditCardNextPaymentHero,
  CreditCardStatementSummaryCard,
} from '@/components/credit-cards/CreditCardDetailSections';
import {
  PaymentTableBlock,
  PurchaseTableBlock,
} from '@/components/credit-cards/CreditCardDetailTables';
import CreditCardStatementImportDialog from '@/components/credit-cards/CreditCardStatementImportDialog';
import { CreditCardPaymentsChart } from '@/components/credit-cards/CreditCardPaymentsChart';
import CreditCardPaymentDialog from '@/components/credit-cards/CreditCardPaymentDialog';
import CreditCardQuickPurchaseDialog from '@/components/credit-cards/CreditCardQuickPurchaseDialog';
import WalletBalanceDialog from '@/components/wallets/WalletBalanceDialog';
import LinkedLoansCard from '@/components/loans/LinkedLoansCard';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useFinanceContext } from '@/context/finance-context';
import {
  buildOwnerQuery,
  clientFetchFromApi,
} from '@/lib/api/client-fetch';
import {
  createCreditCardPayment,
  downloadCreditCardStatementImportFile,
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
  CreditCardStatementImportListItem,
  CreditCardStatementResponse,
  PaymentMethodOption,
} from '@/types/catalog';

const getTodayDateString = () => new Date().toISOString().split('T')[0];

const shiftDateByDays = (dateStr: string, days: number): string => {
  const date = new Date(dateStr + 'T12:00:00Z');
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().split('T')[0];
};

const formatCycleRange = (start: string, end: string) =>
  `${formatDate(start)} – ${formatDate(end)}`;

const CreditCardDetailSkeleton = () => (
  <div className="space-y-6">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <Skeleton className="h-8 w-8 shrink-0 rounded-lg" />
        <div className="space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-3 w-40" />
        </div>
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        <Skeleton className="h-9 w-20" />
        <Skeleton className="h-9 w-28" />
        <Skeleton className="h-9 w-36" />
        <Skeleton className="h-9 w-32 rounded-xl" />
      </div>
    </div>
    <Skeleton className="mx-auto h-10 w-64 max-w-full" />
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-24 rounded-lg" />
      ))}
    </div>
    <div className="grid gap-4 lg:grid-cols-3">
      <Skeleton className="h-56 rounded-xl lg:col-span-1" />
      <Skeleton className="h-56 rounded-xl lg:col-span-2" />
    </div>
    <div className="grid gap-4 lg:grid-cols-2">
      <Skeleton className="h-64 rounded-xl" />
      <Skeleton className="h-64 rounded-xl" />
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

      const [cardData, statementData, paymentMethodsData, categoriesData] =
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
    <div className="space-y-5">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <CreditCardDetailHeaderActions
        card={card}
        onOpenImportDialog={() => setMpImportDialogOpen(true)}
        onExportCsv={handleExportCsv}
        onExportPdf={handleExportPdf}
        onEditCard={handleOpenEditCardDialog}
        onAdjustBalance={() => setBalanceDialogOpen(true)}
      />

      {/* ── Hero: pago próximo ─────────────────────────────────────── */}
      <CreditCardNextPaymentHero
        statement={statement}
        daysUntilDue={daysUntilDue}
        utilizationPct={utilizationPct}
        onOpenPaymentDialog={() => setPaymentDialogOpen(true)}
        onOpenPurchaseDialog={() => setPurchaseDialogOpen(true)}
      />

      {/* ── Cycle nav + compact stats ──────────────────────────────── */}
      <CreditCardCycleSummary
        statement={statement}
        isCurrentCycle={isCurrentCycle}
        onPreviousCycle={handlePreviousCycle}
        onNextCycle={handleNextCycle}
        onResetToToday={handleResetToToday}
        formatCycleRange={formatCycleRange}
        onAdjustDebt={() => setBalanceDialogOpen(true)}
      />

      {/* ── Chart + Statement summary ──────────────────────────────── */}
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

      {/* ── Compras ciclo actual + cuotas vigentes ───────────────── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="overflow-hidden border-border/60">
          <CardHeader>
            <CardTitle className="text-sm font-semibold">
              Compras del ciclo actual
            </CardTitle>
          </CardHeader>
          <CardContent>
            {statement.current_cycle_purchase_items.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No hay compras en el ciclo actual. Usa{' '}
                <span className="font-medium text-foreground">
                  Registrar compra
                </span>{' '}
                arriba o registra un gasto en la planificación mensual con esta
                tarjeta como método de pago.
              </p>
            ) : (
              <PurchaseTableBlock
                items={statement.current_cycle_purchase_items}
                emptyText="No hay compras que coincidan con el filtro."
                ownerQueryString={ownerQueryString}
                regionLabel="Compras del ciclo actual"
              />
            )}
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-border/60 border-l-[3px] border-l-violet-500/50">
          <CardHeader className="flex flex-row items-center gap-3 space-y-0">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-violet-500/10 dark:bg-violet-500/15">
              <CalendarClock className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
            </span>
            <CardTitle className="text-sm font-semibold">
              Cuotas vigentes
            </CardTitle>
            {statement.installment_active_purchases.length > 0 && (
              <Badge
                variant="secondary"
                className="ml-auto text-[10px] tabular-nums"
              >
                {statement.installment_active_purchases.length}
              </Badge>
            )}
          </CardHeader>
          <CardContent>
            {statement.installment_active_purchases.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No hay compras en cuotas con pagos pendientes en períodos futuros en
                esta tarjeta.
              </p>
            ) : (
              <PurchaseTableBlock
                items={statement.installment_active_purchases}
                emptyText="Ningún resultado con el filtro aplicado."
                ownerQueryString={ownerQueryString}
                regionLabel="Cuotas vigentes"
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Compras del último corte + Historial de pagos ─────────── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="overflow-hidden border-border/60">
          <CardHeader>
            <CardTitle className="text-sm font-semibold">
              Compras del último corte
            </CardTitle>
          </CardHeader>
          <CardContent>
            {statement.statement_purchases.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No hubo compras en el último corte.
              </p>
            ) : (
              <PurchaseTableBlock
                items={statement.statement_purchases}
                emptyText="No hay compras que coincidan con el filtro."
                ownerQueryString={ownerQueryString}
                regionLabel="Compras del último corte"
              />
            )}
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-border/60">
          <CardHeader>
            <CardTitle className="text-sm font-semibold">
              Historial de pagos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <PaymentTableBlock
              items={statement.payment_history}
              regionLabel="Historial de pagos"
            />
          </CardContent>
        </Card>
      </div>

      <CreditCardPaymentDialog
        open={paymentDialogOpen}
        onOpenChange={(open) => {
          setPaymentDialogOpen(open);
          if (!open) setPaymentError(null);
        }}
        fundingWalletOptions={fundingWalletOptions}
        categoryOptions={categoryOptions}
        nextDuePayment={statement.next_due_payment}
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
