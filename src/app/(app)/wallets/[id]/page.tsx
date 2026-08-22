'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  startTransition,
  ViewTransition,
} from 'react';
import { useParams, usePathname, useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import {
  ArrowLeftRight,
  Diff,
  Download,
  Pencil,
  SlidersHorizontal,
  Upload,
} from 'lucide-react';
import WalletImportDialog from '@/components/wallets/WalletImportDialog';
import WalletBalanceDialog from '@/components/wallets/WalletBalanceDialog';
import WalletTransferDialog from '@/components/wallets/WalletTransferDialog';
import WalletForm from '@/components/WalletForm';
import LinkedLoansCard from '@/components/loans/LinkedLoansCard';
import { CreditCardPlannedPaymentSection } from '@/components/credit-cards/CreditCardPlannedPaymentSection';
import AddTransactionDialog from '@/components/transactions/AddTransactionDialog';
import type {
  AddExpenseFormValues,
  AddIncomeFormValues,
} from '@/schemas/transaction.schema';
import type { WalletFormValues } from '@/schemas/wallet.schema';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { DirectionalTransition } from '@/components/view-transition/DirectionalTransition';
import { WalletCardVtPlaceholder } from '@/components/wallets/WalletCardVtPlaceholder';
import { walletCardViewTransitionName } from '@/lib/ui/wallet-card-view-transition';
import { useFinanceContext } from '@/context/finance-context';
import {
  useRegisterToolbarActions,
  type ToolbarOverflowItem,
} from '@/context/toolbar-actions-context';
import { buildOwnerQuery, clientFetchFromApi } from '@/lib/api/client-fetch';
import { getCreditCardPaymentPlan, createCreditCardPayment, updateCreditCard } from '@/lib/api/credit-cards';
import { getPaymentMethodOptions, updateWallet } from '@/lib/api/wallets';
import { createWalletIncome } from '@/lib/api/incomes';
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
  WalletDetailTabsList,
  WalletDetailTabTrigger,
  WalletHeroZone,
  WalletPeriodWorkspaceShell,
  WalletPeriodSummary,
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

const WalletDetailSkeleton = ({ walletId }: { walletId: number }) => (
  <DirectionalTransition>
    <div className="space-y-0">
      <div className="relative -mx-4 space-y-5 px-4 pb-2 sm:-mx-0 sm:pb-3">
        <ViewTransition
          name={walletCardViewTransitionName(walletId)}
          share="morph"
          default="none"
        >
          <WalletCardVtPlaceholder walletId={walletId} variant="funding" />
        </ViewTransition>
      </div>
      <div className="space-y-3 px-1 py-7 sm:py-9">
        <Skeleton className="h-12 w-full rounded-full" />
        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-[4.5rem] rounded-2xl" />
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
  </DirectionalTransition>
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
  const [heroLoading, setHeroLoading] = useState(true);
  const [bodyLoading, setBodyLoading] = useState(true);
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
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferWallets, setTransferWallets] = useState<
    { id: number; name: string; type: string; amount: number; active: boolean }[]
  >([]);
  const [editOpen, setEditOpen] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [transactionOpen, setTransactionOpen] = useState(false);
  const [expenseError, setExpenseError] = useState<string | null>(null);
  const [incomeError, setIncomeError] = useState<string | null>(null);
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

  const canImport = wallet?.type === 'CASH' || wallet?.type === 'DEBIT_CARD';
  const isCreditWallet =
    wallet?.type === 'CREDIT_CARD' || wallet?.type === 'DEPARTMENT_STORE_CARD';

  const loadWallet = useCallback(async (): Promise<WalletDetail | null> => {
    if (context.id === 0) return null;
    if (!Number.isFinite(walletId)) {
      setError('Billetera inválida');
      setHeroLoading(false);
      return null;
    }
    try {
      setHeroLoading(true);
      setError(null);
      const detail = await clientFetchFromApi<WalletDetail>(
        `/api/wallets/${walletId}`,
        undefined,
        context,
      );
      if (detail.type === 'GOAL') {
        setWallet(detail);
        setHeroLoading(false);
        const qs = searchParams.toString();
        router.replace(`/metas/${walletId}${qs ? `?${qs}` : ''}`);
        return null;
      }
      // Activate share morph for placeholder → real hero (same VT name).
      startTransition(() => {
        setWallet(detail);
        setHeroLoading(false);
      });
      return detail;
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Error al cargar la billetera',
      );
      setHeroLoading(false);
      return null;
    }
  }, [context, walletId, router, searchParams]);

  const loadMovements = useCallback(async () => {
    if (context.id === 0 || !Number.isFinite(walletId)) return;
    try {
      setBodyLoading(true);
      const movements = await clientFetchFromApi<WalletMovementsResponse>(
        `/api/wallets/${walletId}/movements?from=${range.from}&to=${range.to}`,
        undefined,
        context,
      );
      setData(movements);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Error al cargar movimientos',
      );
    } finally {
      setBodyLoading(false);
    }
  }, [context, walletId, range.from, range.to]);

  const loadSecondary = useCallback(
    async (detail: WalletDetail) => {
      if (context.id === 0) return;
      try {
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
          setTransferWallets([]);
        } else {
          setPaymentPlanItems([]);
          setPaymentSources([]);
          setCategoryOptions([]);
          const list = await clientFetchFromApi<
            {
              id: number;
              name: string;
              type: string;
              amount: number | string;
              active: boolean;
            }[]
          >('/api/wallets', undefined, context);
          setTransferWallets(
            list.map((w) => ({
              id: w.id,
              name: w.name,
              type: w.type,
              amount: Number(w.amount) || 0,
              active: w.active,
            })),
          );
        }
      } catch {
        /* secondary chrome — keep hero visible */
      }
    },
    [context, walletId],
  );

  /** Full refresh after mutations (hero + body + secondary). */
  const loadData = useCallback(async () => {
    const detail = await loadWallet();
    if (!detail) return;
    await Promise.all([loadMovements(), loadSecondary(detail)]);
  }, [loadWallet, loadMovements, loadSecondary]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const detail = await loadWallet();
      if (cancelled || !detail) return;
      void loadSecondary(detail);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hero once per wallet/context
  }, [context.id, walletId]);

  useEffect(() => {
    if (!wallet) return;
    void loadMovements();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- range-driven body refresh
  }, [wallet?.id, range.from, range.to, context.id]);

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
        setTransactionOpen(false);
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

  const handleCreateIncome = useCallback(
    async (values: AddIncomeFormValues) => {
      setIncomeError(null);
      try {
        await createWalletIncome(
          values.walletId,
          {
            date: values.date,
            amount: values.amount,
            source: values.name,
          },
          context,
        );
        toast.success('Ingreso registrado');
        setTransactionOpen(false);
        await loadData();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'No se pudo registrar el ingreso';
        setIncomeError(message);
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
    setIncomeError(null);
    setTransactionOpen(true);
  }, []);

  const handleOpenTransfer = useCallback(() => {
    setTransferOpen(true);
  }, []);

  const handleOpenBalance = useCallback(() => {
    setBalanceOpen(true);
  }, []);

  const handleOpenEdit = useCallback(() => {
    setEditError(null);
    setEditOpen(true);
  }, []);

  const handleOpenImport = useCallback(() => {
    setImportOpen(true);
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

  const registrarIcon = useMemo(
    () => <Diff className="size-5" data-icon="inline-start" />,
    [],
  );

  const overflowItems = useMemo((): ToolbarOverflowItem[] => {
    if (!wallet) return [];
    const items: ToolbarOverflowItem[] = [];
    if (canImport) {
      items.push({
        key: 'transfer',
        label: 'Transferir',
        onClick: handleOpenTransfer,
        icon: <ArrowLeftRight data-icon="inline-start" />,
      });
    }
    items.push(
      {
        key: 'adjust',
        label: 'Ajustar',
        onClick: handleOpenBalance,
        icon: <SlidersHorizontal data-icon="inline-start" />,
      },
      {
        key: 'edit',
        label: 'Editar',
        onClick: handleOpenEdit,
        icon: <Pencil data-icon="inline-start" />,
      },
    );
    if (canImport) {
      items.push({
        key: 'import',
        label: 'Importar CSV',
        onClick: handleOpenImport,
        icon: <Upload data-icon="inline-start" />,
      });
    }
    items.push({
      key: 'export',
      label: 'Exportar CSV',
      onClick: handleExportCsv,
      icon: <Download data-icon="inline-start" />,
    });
    return items;
  }, [
    wallet,
    canImport,
    handleExportCsv,
    handleOpenTransfer,
    handleOpenBalance,
    handleOpenEdit,
    handleOpenImport,
  ]);

  useRegisterToolbarActions({
    primaryAction:
      wallet && canImport
        ? {
            label: 'Registrar',
            onClick: handleOpenExpense,
            icon: registrarIcon,
          }
        : null,
    overflow: overflowItems.length > 0 ? { items: overflowItems } : null,
  });

  if (context.id === 0 || (heroLoading && !wallet)) {
    return <WalletDetailSkeleton walletId={walletId} />;
  }

  if ((error && !wallet) || !wallet) {
    return (
      <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
        {error ?? 'No se pudo cargar la billetera'}
      </div>
    );
  }

  const bodyPending = bodyLoading || !data;

  return (
    <DirectionalTransition>
    <div className="relative">
      <WalletHeroZone wallet={wallet}>
        <ViewTransition
          name={walletCardViewTransitionName(wallet.id)}
          share="morph"
          default="none"
        >
          <WalletVisualHero wallet={wallet} />
        </ViewTransition>
      </WalletHeroZone>

      <div className="relative">
      {bodyPending ? (
        <div
          className="rounded-xl border border-border/60 bg-card px-4 py-4 shadow-sm"
          role="status"
          aria-label="Cargando movimientos"
        >
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-[4.5rem] rounded-lg" />
            ))}
          </div>
          <Skeleton className="mt-4 h-48 w-full rounded-xl" />
        </div>
      ) : (
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
              onAddTransaction={handleOpenExpense}
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
      )}
      </div>

      {canImport ? (
        <AddTransactionDialog
          open={transactionOpen}
          onOpenChange={(open) => {
            setTransactionOpen(open);
            if (!open) {
              setExpenseError(null);
              setIncomeError(null);
            }
          }}
          defaultTab="expense"
          expenseDefaults={{ paymentMethodId: walletId, isPaid: true }}
          incomeDefaults={{ walletId }}
          onSaveExpense={handleCreateExpense}
          onSaveIncome={handleCreateIncome}
          expenseError={expenseError}
          incomeError={incomeError}
        />
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

      {!isCreditWallet ? (
        <WalletTransferDialog
          open={transferOpen}
          onOpenChange={setTransferOpen}
          wallets={transferWallets}
          defaultFromWalletId={wallet.id}
          context={context}
          onSuccess={loadData}
        />
      ) : null}

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
          goal_amount: wallet.goal_amount ?? null,
          goal_due_date: wallet.goal_due_date ?? null,
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
    </DirectionalTransition>
  );
}
