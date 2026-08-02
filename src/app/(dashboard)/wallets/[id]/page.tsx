'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Plus, Wallet as WalletIcon } from 'lucide-react';
import { toast } from 'sonner';
import WalletImportDialog from '@/components/wallets/WalletImportDialog';
import WalletBalanceDialog from '@/components/wallets/WalletBalanceDialog';
import WalletQuickIncomeDialog from '@/components/wallets/WalletQuickIncomeDialog';
import WalletForm from '@/components/WalletForm';
import LinkedLoansCard from '@/components/loans/LinkedLoansCard';
import { CreditCardPlannedPaymentSection } from '@/components/credit-cards/CreditCardPlannedPaymentSection';
import ExpenseFormSheet from '@/components/expenses/ExpenseFormSheet';
import type { AddExpenseFormValues } from '@/schemas/transaction.schema';
import type { WalletFormValues } from '@/schemas/wallet.schema';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { useFinanceContext } from '@/context/finance-context';
import { buildOwnerQuery, clientFetchFromApi } from '@/lib/api/client-fetch';
import { getCreditCardPaymentPlan, createCreditCardPayment, updateCreditCard } from '@/lib/api/credit-cards';
import { getPaymentMethodOptions, updateWallet } from '@/lib/api/wallets';
import CreditCardPaymentDialog from '@/components/credit-cards/CreditCardPaymentDialog';
import type { CreditCardPaymentSubmitPayload } from '@/components/credit-cards/CreditCardPaymentDialog';
import { downloadWalletMovementsCsv } from '@/lib/finance/wallet-movements-csv';
import {
  buildWalletPeriodAnalytics,
  estimateWalletRunwayDays,
} from '@/lib/finance/wallet-period-analytics';
import { todayCalendarDate } from '@/lib/calendar-dates';
import { parseWalletProviderIconKey } from '@/lib/wallet-provider-icons';
import type {
  WalletDetail,
  WalletMovementsResponse,
} from '@/types/wallet-movements';
import type { CreditCardPaymentPlanView, CategoryOption, PaymentMethodOption } from '@/types/catalog';
import type { PaymentMethodType } from '@/domain/payment-method';
import {
  WalletDetailHeaderActions,
  WalletDetailTabsList,
  WalletDetailTabTrigger,
  WalletHeroZone,
  WalletPeriodWorkspaceShell,
  WalletPeriodSummary,
  WalletQuickActions,
  WalletVisualHero,
} from '@/components/wallets/WalletDetailSections';
import { WalletMovementsFeed } from '@/components/wallets/WalletMovementFeed';
import { WalletPeriodAnalyticsPanels } from '@/components/wallets/WalletPeriodAnalyticsPanels';

const firstDayOfMonth = (year: number, monthIdx: number): string =>
  `${year}-${String(monthIdx + 1).padStart(2, '0')}-01`;

const lastDayOfMonth = (year: number, monthIdx: number): string => {
  const last = new Date(Date.UTC(year, monthIdx + 1, 0)).getUTCDate();
  return `${year}-${String(monthIdx + 1).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
};

const MONTH_LABEL: Record<number, string> = {
  0: 'Enero',
  1: 'Febrero',
  2: 'Marzo',
  3: 'Abril',
  4: 'Mayo',
  5: 'Junio',
  6: 'Julio',
  7: 'Agosto',
  8: 'Septiembre',
  9: 'Octubre',
  10: 'Noviembre',
  11: 'Diciembre',
};

const parseYearMonth = (fromDate: string): { year: number; monthIdx: number } => {
  const [y, m] = fromDate.split('-').map(Number);
  return { year: y, monthIdx: m - 1 };
};

type WalletDetailTab = 'resumen' | 'movimientos' | 'compromisos';

const WalletDetailSkeleton = () => (
  <div className="space-y-6 pb-24 lg:pb-0">
    <div className="relative -mx-4 space-y-4 px-4 pb-4 sm:-mx-0">
      <div className="flex items-center justify-between">
        <Skeleton className="h-9 w-28" />
        <Skeleton className="h-9 w-9 rounded-lg" />
      </div>
      <Skeleton className="mx-auto aspect-[1.586/1] w-full max-w-xs rounded-2xl sm:max-w-sm" />
      <div className="flex justify-center gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-14 rounded-full" />
        ))}
      </div>
    </div>
    <div className="rounded-xl border border-border/60 bg-card px-4 py-4 shadow-sm">
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[4.5rem] rounded-lg" />
        ))}
      </div>
      <Skeleton className="mt-4 h-48 w-full rounded-xl" />
    </div>
  </div>
);

export default function WalletDetailPage() {
  const params = useParams<{ id: string }>();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { context } = useFinanceContext();
  const walletId = Number(params.id);

  const [wallet, setWallet] = useState<WalletDetail | null>(null);
  const [data, setData] = useState<WalletMovementsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<{ from: string; to: string }>(() => {
    const qFrom = searchParams.get('from');
    const qTo = searchParams.get('to');
    if (qFrom && qTo) return { from: qFrom, to: qTo };
    const now = new Date();
    const y = now.getUTCFullYear();
    const m = now.getUTCMonth();
    return { from: firstDayOfMonth(y, m), to: lastDayOfMonth(y, m) };
  });
  const [importOpen, setImportOpen] = useState(false);
  const [balanceOpen, setBalanceOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [expenseError, setExpenseError] = useState<string | null>(null);
  const [incomeOpen, setIncomeOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<WalletDetailTab>(() => {
    const tab = searchParams.get('tab');
    return tab === 'movimientos' || tab === 'compromisos' ? tab : 'resumen';
  });
  const [paymentPlanItems, setPaymentPlanItems] = useState<
    CreditCardPaymentPlanView[]
  >([]);
  const [paymentSources, setPaymentSources] = useState<PaymentMethodOption[]>(
    [],
  );
  const [categoryOptions, setCategoryOptions] = useState<CategoryOption[]>([]);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentFortnightId, setPaymentFortnightId] = useState<
    number | undefined
  >(undefined);
  const [paymentSuggestedOverride, setPaymentSuggestedOverride] = useState<
    number | undefined
  >(undefined);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);

  const ownerQueryString = useMemo(() => {
    const q = buildOwnerQuery(context);
    const s = q.toString();
    return s ? `?${s}` : '';
  }, [context]);

  useEffect(() => {
    const next = new URLSearchParams(searchParams.toString());
    if (activeTab === 'resumen') next.delete('tab');
    else next.set('tab', activeTab);
    next.set('from', range.from);
    next.set('to', range.to);
    const currentQs = searchParams.toString();
    const nextQs = next.toString();
    if (nextQs === currentQs) return;
    router.replace(nextQs ? `${pathname}?${nextQs}` : pathname, { scroll: false });
  }, [activeTab, pathname, range.from, range.to, router, searchParams]);

  const backHref = `/wallets${ownerQueryString}`;

  const canImport = wallet?.type === 'CASH' || wallet?.type === 'DEBIT_CARD';
  const isCreditWallet =
    wallet?.type === 'CREDIT_CARD' || wallet?.type === 'DEPARTMENT_STORE_CARD';

  const loadData = useCallback(async () => {
    if (context.id === 0) return;
    if (!Number.isFinite(walletId)) {
      setError('Billetera inválida');
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const [detail, movements] = await Promise.all([
        clientFetchFromApi<WalletDetail>(
          `/api/wallets/${walletId}`,
          undefined,
          context,
        ),
        clientFetchFromApi<WalletMovementsResponse>(
          `/api/wallets/${walletId}/movements?from=${range.from}&to=${range.to}`,
          undefined,
          context,
        ),
      ]);
      setWallet(detail);
      setData(movements);
      if (
        detail.type === 'CREDIT_CARD' ||
        detail.type === 'DEPARTMENT_STORE_CARD'
      ) {
        const [plan, methods, categories] = await Promise.all([
          getCreditCardPaymentPlan(walletId, context).catch(() => ({
            items: [] as CreditCardPaymentPlanView[],
          })),
          getPaymentMethodOptions(context),
          clientFetchFromApi<CategoryOption[]>(
            '/api/categories',
            undefined,
            context,
          ),
        ]);
        setPaymentPlanItems(plan.items);
        setPaymentSources(methods);
        setCategoryOptions(categories);
      } else {
        setPaymentPlanItems([]);
        setPaymentSources([]);
        setCategoryOptions([]);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Error al cargar la billetera',
      );
    } finally {
      setLoading(false);
    }
  }, [context, walletId, range.from, range.to]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handlePrevMonth = useCallback(() => {
    const { year, monthIdx } = parseYearMonth(range.from);
    const prev = new Date(Date.UTC(year, monthIdx - 1, 1));
    const py = prev.getUTCFullYear();
    const pm = prev.getUTCMonth();
    setRange({ from: firstDayOfMonth(py, pm), to: lastDayOfMonth(py, pm) });
  }, [range.from]);

  const handleNextMonth = useCallback(() => {
    const { year, monthIdx } = parseYearMonth(range.from);
    const next = new Date(Date.UTC(year, monthIdx + 1, 1));
    const ny = next.getUTCFullYear();
    const nm = next.getUTCMonth();
    setRange({ from: firstDayOfMonth(ny, nm), to: lastDayOfMonth(ny, nm) });
  }, [range.from]);

  const handleResetToToday = useCallback(() => {
    const now = new Date();
    const y = now.getUTCFullYear();
    const m = now.getUTCMonth();
    setRange({ from: firstDayOfMonth(y, m), to: lastDayOfMonth(y, m) });
  }, []);

  const isCurrentMonth = useMemo(() => {
    const today = todayCalendarDate();
    return today >= range.from && today <= range.to;
  }, [range.from, range.to]);

  const fundingWalletOptions = useMemo(
    () =>
      paymentSources.filter(
        (w) => w.type === 'CASH' || w.type === 'DEBIT_CARD',
      ),
    [paymentSources],
  );

  const handleCreditPaymentSubmit = useCallback(
    async (data: CreditCardPaymentSubmitPayload) => {
      try {
        setPaymentSubmitting(true);
        setPaymentError(null);
        await createCreditCardPayment(
          walletId,
          {
            ...data,
            create_fortnight_expense: true,
            fortnight_id: paymentFortnightId,
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
    },
    [context, loadData, paymentFortnightId, walletId],
  );

  const handleOpenPlanPayment = useCallback(
    (item: CreditCardPaymentPlanView) => {
      setPaymentFortnightId(item.fortnightId);
      setPaymentSuggestedOverride(item.effectiveAmount);
      setPaymentDialogOpen(true);
    },
    [],
  );

  const handleCreateExpense = useCallback(
    async (values: AddExpenseFormValues) => {
      setExpenseError(null);
      try {
        await clientFetchFromApi(
          '/api/expenses',
          {
            method: 'POST',
            body: JSON.stringify(values),
          },
          context,
        );
        toast.success('Gasto registrado');
        setExpenseOpen(false);
        await loadData();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'No se pudo crear el gasto';
        setExpenseError(message);
        throw err;
      }
    },
    [context, loadData],
  );

  const handleExportCsv = useCallback(() => {
    if (!wallet || !data) return;
    try {
      downloadWalletMovementsCsv(wallet, range, data.movements);
      toast.success('CSV descargado');
    } catch {
      toast.error('No se pudo exportar el CSV');
    }
  }, [wallet, data, range]);

  const handleOpenExpense = useCallback(() => {
    setExpenseError(null);
    setExpenseOpen(true);
  }, []);

  const handleEditWallet = useCallback(
    async (formData: WalletFormValues) => {
      if (!wallet) return;
      try {
        setEditError(null);
        if (isCreditWallet) {
          await updateCreditCard(walletId, formData, context);
          toast.success('Tarjeta actualizada');
        } else {
          await updateWallet(walletId, formData, context);
          toast.success('Billetera actualizada');
        }
        setEditOpen(false);
        await loadData();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Error al actualizar';
        setEditError(message);
        throw err;
      }
    },
    [context, isCreditWallet, loadData, wallet, walletId],
  );

  const rangeLabel = useMemo(() => {
    const { year, monthIdx } = parseYearMonth(range.from);
    return `${MONTH_LABEL[monthIdx]} ${year}`;
  }, [range.from]);

  const analytics = useMemo(
    () =>
      buildWalletPeriodAnalytics(data?.movements ?? [], {
        from: range.from,
        to: range.to,
      }),
    [data?.movements, range.from, range.to],
  );

  const runwayDays = useMemo(
    () =>
      wallet
        ? estimateWalletRunwayDays(wallet.amount, analytics.averageDailyOutflow)
        : null,
    [analytics.averageDailyOutflow, wallet],
  );

  if (context.id === 0 || (loading && !data)) {
    return <WalletDetailSkeleton />;
  }

  if (error || !wallet || !data) {
    return (
      <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
        {error ?? 'No se pudo cargar la billetera'}
      </div>
    );
  }

  return (
    <div className="relative pb-24 lg:pb-0">
      <WalletHeroZone wallet={wallet}>
        <WalletDetailHeaderActions
          walletName={wallet.name}
          backHref={backHref}
          canImport={canImport}
          onRegisterExpense={handleOpenExpense}
          onRegisterIncome={() => setIncomeOpen(true)}
          onEditWallet={() => {
            setEditError(null);
            setEditOpen(true);
          }}
          onImport={() => setImportOpen(true)}
          onExportCsv={handleExportCsv}
        />

        <WalletVisualHero wallet={wallet} />

        <WalletQuickActions
          canImport={canImport}
          onRegisterExpense={handleOpenExpense}
          onRegisterIncome={() => setIncomeOpen(true)}
          onImport={() => setImportOpen(true)}
          onAdjustBalance={() => setBalanceOpen(true)}
        />
      </WalletHeroZone>

      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as WalletDetailTab)}
      >
        <WalletPeriodWorkspaceShell
          chrome={
            <>
              <WalletPeriodSummary
                rangeLabel={rangeLabel}
                isCurrentMonth={isCurrentMonth}
                currentBalance={wallet.amount}
                inflow={data.totals.inflow}
                outflow={data.totals.outflow}
                net={data.totals.net}
                movementCount={data.movements.length}
                averageDailyOutflow={analytics.averageDailyOutflow}
                runwayDays={runwayDays}
                onPrevious={handlePrevMonth}
                onNext={handleNextMonth}
                onResetToToday={handleResetToToday}
              />
              <div className="mt-4">
                <WalletDetailTabsList>
                  <WalletDetailTabTrigger value="resumen">
                    Resumen
                  </WalletDetailTabTrigger>
                  <WalletDetailTabTrigger value="movimientos">
                    Movimientos
                  </WalletDetailTabTrigger>
                  <WalletDetailTabTrigger value="compromisos">
                    Compromisos
                  </WalletDetailTabTrigger>
                </WalletDetailTabsList>
              </div>
            </>
          }
        >
          <TabsContent value="resumen" className="mt-0">
            <WalletPeriodAnalyticsPanels
              analytics={analytics}
              balance={wallet.amount}
              rangeLabel={rangeLabel}
              runwayDays={runwayDays}
            />
          </TabsContent>

          <TabsContent value="movimientos" className="mt-0">
            <WalletMovementsFeed
              movements={data.movements}
              ownerQueryString={ownerQueryString}
              canRegister={canImport}
              onRegisterExpense={handleOpenExpense}
              onRegisterIncome={() => setIncomeOpen(true)}
            />
          </TabsContent>

          <TabsContent value="compromisos" className="mt-0 space-y-4">
            {isCreditWallet ? (
              <CreditCardPlannedPaymentSection
                walletId={walletId}
                items={paymentPlanItems}
                onPlanUpdated={loadData}
                onPayCard={handleOpenPlanPayment}
              />
            ) : null}
            <LinkedLoansCard walletId={walletId} />
          </TabsContent>
        </WalletPeriodWorkspaceShell>
      </Tabs>

      {canImport ? (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border/60 bg-background/95 px-4 py-3 backdrop-blur-md lg:hidden">
          <div className="mx-auto flex max-w-lg gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-11 flex-1 gap-1.5 rounded-xl"
              onClick={handleOpenExpense}
            >
              <Plus className="h-4 w-4" aria-hidden data-icon="inline-start" />
              Gasto
            </Button>
            <Button
              type="button"
              className="h-11 flex-1 gap-1.5 rounded-xl"
              onClick={() => setIncomeOpen(true)}
            >
              <WalletIcon className="h-4 w-4" aria-hidden data-icon="inline-start" />
              Ingreso
            </Button>
          </div>
        </div>
      ) : null}

      {canImport && (
        <WalletImportDialog
          open={importOpen}
          onOpenChange={setImportOpen}
          walletId={walletId}
          context={context}
          onSuccess={loadData}
        />
      )}

      {canImport && (
        <ExpenseFormSheet
          open={expenseOpen}
          onOpenChange={(open) => {
            setExpenseOpen(open);
            if (!open) setExpenseError(null);
          }}
          mode="create"
          title={`Registrar gasto — ${wallet.name}`}
          description="Registra un gasto pagado con esta billetera; asignamos la quincena automáticamente."
          defaults={{ paymentMethodId: walletId, isPaid: true }}
          onSave={handleCreateExpense}
          error={expenseError}
        />
      )}

      {canImport && (
        <WalletQuickIncomeDialog
          open={incomeOpen}
          onOpenChange={setIncomeOpen}
          walletId={walletId}
          walletName={wallet.name}
          context={context}
          onSuccess={loadData}
        />
      )}

      <WalletBalanceDialog
        open={balanceOpen}
        onOpenChange={setBalanceOpen}
        walletId={walletId}
        walletName={wallet.name}
        currentAmount={wallet.amount}
        context={context}
        onSuccess={loadData}
        variant={isCreditWallet ? 'credit' : 'funding'}
        creditLimit={wallet.credit_limit}
      />

      <WalletForm
        open={editOpen}
        onOpenChange={(open) => {
          setEditOpen(open);
          if (!open) setEditError(null);
        }}
        onSave={handleEditWallet}
        mode="edit"
        showAmountField={!isCreditWallet}
        allowedTypes={
          isCreditWallet
            ? ['CREDIT_CARD', 'DEPARTMENT_STORE_CARD']
            : ['CASH', 'DEBIT_CARD']
        }
        defaultValues={{
          name: wallet.name,
          amount: wallet.amount ?? 0,
          credit_limit: wallet.credit_limit ?? null,
          temporary_credit_limit: wallet.temporary_credit_limit ?? null,
          type: wallet.type as PaymentMethodType,
          provider_icon_key: parseWalletProviderIconKey(wallet.provider_icon_key),
          active: wallet.active,
          include_in_liquidity: wallet.include_in_liquidity ?? true,
          cutoff_day: wallet.cutoff_day,
          due_day: wallet.due_day,
          assignee_user_id: wallet.assignee_user_id ?? null,
        }}
        error={editError && editOpen ? editError : null}
      />

      {isCreditWallet ? (
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
          nextDuePayment={paymentSuggestedOverride ?? 0}
          outstandingBalance={wallet.amount}
          submitting={paymentSubmitting}
          error={paymentError}
          fortnightId={paymentFortnightId}
          onConfirm={handleCreditPaymentSubmit}
        />
      ) : null}
    </div>
  );
}
