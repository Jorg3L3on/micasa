'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { Plus, Wallet as WalletIcon } from 'lucide-react';
import { toast } from 'sonner';
import WalletImportDialog from '@/components/wallets/WalletImportDialog';
import WalletBalanceDialog from '@/components/wallets/WalletBalanceDialog';
import WalletQuickIncomeDialog from '@/components/wallets/WalletQuickIncomeDialog';
import LinkedLoansCard from '@/components/loans/LinkedLoansCard';
import { CreditCardPlannedPaymentSection } from '@/components/credit-cards/CreditCardPlannedPaymentSection';
import ExpenseFormSheet from '@/components/expenses/ExpenseFormSheet';
import type { AddExpenseFormValues } from '@/schemas/transaction.schema';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useFinanceContext } from '@/context/finance-context';
import { buildOwnerQuery, clientFetchFromApi } from '@/lib/api/client-fetch';
import { getCreditCardPaymentPlan } from '@/lib/api/credit-cards';
import { downloadWalletMovementsCsv } from '@/lib/finance/wallet-movements-csv';
import { formatCurrency } from '@/lib/utils';
import type {
  WalletDetail,
  WalletMovementsResponse,
} from '@/types/wallet-movements';
import type { CreditCardPaymentPlanView } from '@/types/catalog';
import {
  WalletActivitySheet,
  WalletDetailHeaderActions,
  WalletHeroZone,
  WalletPeriodSummary,
  WalletQuickActions,
  WalletVisualHero,
} from '@/components/wallets/WalletDetailSections';
import { WalletMovementsFeed } from '@/components/wallets/WalletMovementFeed';

const getTodayDateString = () => new Date().toISOString().split('T')[0];

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

const WalletDetailSkeleton = () => (
  <div className="space-y-0 pb-24 lg:pb-0">
    <div className="relative -mx-4 space-y-4 px-4 pb-4 sm:-mx-0">
      <div className="flex items-center justify-between">
        <Skeleton className="h-9 w-28" />
        <Skeleton className="h-9 w-9 rounded-lg" />
      </div>
      <Skeleton className="mx-auto aspect-[1.586/1] w-full max-w-md rounded-2xl" />
      <div className="flex justify-center gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-14 rounded-full" />
        ))}
      </div>
    </div>
    <div className="rounded-t-[1.75rem] border border-border/60 bg-card px-4 pt-3 pb-4">
      <Skeleton className="mx-auto mb-3 h-1 w-10 rounded-full" />
      <div className="grid grid-cols-3 gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-[4.5rem] rounded-lg" />
        ))}
      </div>
      <Skeleton className="mt-4 h-48 w-full rounded-2xl" />
    </div>
  </div>
);

export default function WalletDetailPage() {
  const params = useParams<{ id: string }>();
  const { context } = useFinanceContext();
  const walletId = Number(params.id);

  const [wallet, setWallet] = useState<WalletDetail | null>(null);
  const [data, setData] = useState<WalletMovementsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<{ from: string; to: string }>(() => {
    const now = new Date();
    const y = now.getUTCFullYear();
    const m = now.getUTCMonth();
    return { from: firstDayOfMonth(y, m), to: lastDayOfMonth(y, m) };
  });
  const [importOpen, setImportOpen] = useState(false);
  const [balanceOpen, setBalanceOpen] = useState(false);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [expenseError, setExpenseError] = useState<string | null>(null);
  const [incomeOpen, setIncomeOpen] = useState(false);
  const [paymentPlanItems, setPaymentPlanItems] = useState<
    CreditCardPaymentPlanView[]
  >([]);

  const ownerQueryString = useMemo(() => {
    const q = buildOwnerQuery(context);
    const s = q.toString();
    return s ? `?${s}` : '';
  }, [context]);

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
        const plan = await getCreditCardPaymentPlan(walletId, context).catch(
          () => ({ items: [] as CreditCardPaymentPlanView[] }),
        );
        setPaymentPlanItems(plan.items);
      } else {
        setPaymentPlanItems([]);
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
    const today = getTodayDateString();
    return today >= range.from && today <= range.to;
  }, [range.from, range.to]);

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

  const rangeLabel = useMemo(() => {
    const { year, monthIdx } = parseYearMonth(range.from);
    return `${MONTH_LABEL[monthIdx]} ${year}`;
  }, [range.from]);

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
          onAdjustBalance={() => setBalanceOpen(true)}
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

      <WalletActivitySheet>
        {isCreditWallet ? (
          <CreditCardPlannedPaymentSection
            walletId={walletId}
            items={paymentPlanItems}
            onPlanUpdated={loadData}
          />
        ) : null}

        <div className={isCreditWallet ? 'mt-5' : undefined}>
          <WalletPeriodSummary
            rangeLabel={rangeLabel}
            isCurrentMonth={isCurrentMonth}
            inflow={data.totals.inflow}
            outflow={data.totals.outflow}
            net={data.totals.net}
            onPrevious={handlePrevMonth}
            onNext={handleNextMonth}
            onResetToToday={handleResetToToday}
          />
        </div>

        <div className="mt-5">
          <LinkedLoansCard walletId={walletId} />
        </div>

        <div className="mt-5">
          <WalletMovementsFeed
            movements={data.movements}
            ownerQueryString={ownerQueryString}
            canRegister={canImport}
            onRegisterExpense={handleOpenExpense}
            onRegisterIncome={() => setIncomeOpen(true)}
          />
        </div>
      </WalletActivitySheet>

      {canImport ? (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border/60 bg-background/95 px-4 py-3 backdrop-blur-md lg:hidden">
          <div className="mx-auto flex max-w-lg gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-11 flex-1 gap-1.5 rounded-xl"
              onClick={handleOpenExpense}
            >
              <Plus className="h-4 w-4" />
              Gasto
            </Button>
            <Button
              type="button"
              className="h-11 flex-1 gap-1.5 rounded-xl"
              onClick={() => setIncomeOpen(true)}
            >
              <WalletIcon className="h-4 w-4" />
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
          onSubmit={handleCreateExpense}
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
    </div>
  );
}
