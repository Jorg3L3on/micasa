'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { History, Wallet } from 'lucide-react';
import { useFinanceContext } from '@/context/finance-context';
import { buildOwnerQuery, clientFetchFromApi } from '@/lib/api/client-fetch';
import { formatCurrency, cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import MonthlyOverviewChart from '@/components/wallets/liquidity/MonthlyOverviewChart';
import { LiquidityPastMonthFocus } from '@/components/wallets/liquidity/LiquidityPastMonthFocus';
import type { WalletListItem } from '@/types/catalog';
import type { MonthlySummaryItem } from '@/app/api/wallets/liquidity/monthly-summary/route';
import { PAYMENT_METHOD_LABELS } from '@/domain/payment-method';
import { WalletBalanceEditDialog } from '@/components/wallets/WalletBalanceEditDialog';
import { WalletProviderIcon } from '@/components/wallets/WalletProviderIcon';
import { formatCategoryLabel } from '@/components/categories/CategoryLabel';
import {
  getCardRiskLabel,
  monthKeyFromParts,
  shiftSelectedMonthKey,
} from '@/components/wallets/liquidity/liquidity-personalization';

const CARD_TYPES = ['CASH', 'DEBIT_CARD', 'CREDIT_CARD', 'DEPARTMENT_STORE_CARD'] as const;
const ROLLING_MONTHS = 12;

type CategoryReportRow = {
  category: string;
  categoryIcon?: string | null;
  total: number;
};

const sortWalletsByType = (wallets: WalletListItem[]): WalletListItem[] => {
  return [...wallets]
    .filter(
      (wallet) =>
        CARD_TYPES.includes(wallet.type as (typeof CARD_TYPES)[number]) && wallet.active,
    )
    .sort((a, b) => {
      const getTypeRank = (type: string) => {
        if (type === 'CASH') return 0;
        if (type === 'DEBIT_CARD') return 1;
        if (type === 'CREDIT_CARD' || type === 'DEPARTMENT_STORE_CARD') return 2;
        return 3;
      };
      const rankDiff = getTypeRank(a.type) - getTypeRank(b.type);
      if (rankDiff !== 0) return rankDiff;
      return a.name.localeCompare(b.name, 'es');
    });
};

export function LiquidityInsightsTab() {
  const { data: session } = useSession();
  const { context } = useFinanceContext();
  const firstName = session?.user?.name?.trim().split(/\s+/)[0];
  const [wallets, setWallets] = useState<WalletListItem[]>([]);
  const [categories, setCategories] = useState<CategoryReportRow[]>([]);
  const [monthlySummary, setMonthlySummary] = useState<MonthlySummaryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [selectedCard, setSelectedCard] = useState<WalletListItem | null>(null);
  const [selectedMonthKey, setSelectedMonthKey] = useState('');

  const ownerQueryString = useMemo(() => {
    const q = buildOwnerQuery(context);
    const s = q.toString();
    return s ? `?${s}` : '';
  }, [context]);

  const load = useCallback(async () => {
    if (!context || (context.type === 'user' && context.id === 0)) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setCategoryError(null);
      const [walletList, catRows, monthlyRows] = await Promise.all([
        clientFetchFromApi<WalletListItem[]>('/api/wallets', undefined, context),
        clientFetchFromApi<CategoryReportRow[]>(
          `/api/reports?type=by-category&windowMonths=${ROLLING_MONTHS}`,
          undefined,
          context,
        ),
        clientFetchFromApi<MonthlySummaryItem[]>(
          '/api/wallets/liquidity/monthly-summary',
          undefined,
          context,
        ),
      ]);
      setWallets(walletList);
      setCategories(Array.isArray(catRows) ? catRows : []);
      setMonthlySummary(Array.isArray(monthlyRows) ? monthlyRows : []);
    } catch (e) {
      setCategoryError(e instanceof Error ? e.message : 'No se pudieron cargar tus datos');
      setWallets([]);
      setCategories([]);
      setMonthlySummary([]);
    } finally {
      setLoading(false);
    }
  }, [context]);

  useEffect(() => {
    void load();
  }, [load]);

  const monthKeys = useMemo(
    () => monthlySummary.map((month) => monthKeyFromParts(month.year, month.month)),
    [monthlySummary],
  );

  useEffect(() => {
    if (monthKeys.length === 0) return;
    if (monthKeys.includes(selectedMonthKey)) return;
    setSelectedMonthKey(monthKeys[monthKeys.length - 1] ?? '');
  }, [monthKeys, selectedMonthKey]);

  const sortedCards = useMemo(() => sortWalletsByType(wallets), [wallets]);

  const totalCategorySpend = useMemo(
    () => categories.reduce((sum, row) => sum + Number(row.total), 0),
    [categories],
  );

  const annualTotals = useMemo(() => {
    const income = monthlySummary.reduce((sum, month) => sum + month.income, 0);
    const expenses = monthlySummary.reduce((sum, month) => sum + month.expense, 0);
    return { income, expenses, net: income - expenses };
  }, [monthlySummary]);

  const averageExpense = useMemo(
    () => (monthlySummary.length > 0 ? annualTotals.expenses / monthlySummary.length : 0),
    [annualTotals.expenses, monthlySummary.length],
  );

  const resolvedMonthKey =
    selectedMonthKey && monthKeys.includes(selectedMonthKey)
      ? selectedMonthKey
      : (monthKeys[monthKeys.length - 1] ?? '');
  const selectedIndex = monthKeys.indexOf(resolvedMonthKey);
  const selectedMonth =
    monthlySummary.find(
      (month) => monthKeyFromParts(month.year, month.month) === resolvedMonthKey,
    ) ?? null;

  const topCategories = useMemo(
    () => [...categories].sort((a, b) => b.total - a.total).slice(0, 5),
    [categories],
  );

  const maxCategoryAmount = useMemo(
    () => Math.max(...topCategories.map((c) => c.total), 1),
    [topCategories],
  );

  const heroPrefix = firstName ? `${firstName}, ` : '';
  const heroMessage =
    totalCategorySpend > 0
      ? `${heroPrefix}así se movió tu dinero el último año. Toca un mes en la gráfica para ver si te alcanzó.`
      : `${heroPrefix}aún no hay gastos registrados. Cuando empieces a anotarlos, aquí verás en qué se va tu dinero.`;

  const handleShiftMonth = (delta: number) => {
    setSelectedMonthKey(shiftSelectedMonthKey(monthKeys, resolvedMonthKey, delta));
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-28 rounded-2xl bg-muted/40 border border-border/30" />
        <div className="h-72 rounded-2xl bg-muted/40 border border-border/30" />
        <div className="h-40 rounded-2xl bg-muted/40 border border-border/30" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div
        className={cn(
          'flex flex-col gap-3 rounded-2xl border px-4 py-4 shadow-sm sm:flex-row sm:items-start',
          annualTotals.net >= 0
            ? 'border-emerald-500/25 bg-emerald-500/5 dark:bg-emerald-500/10'
            : 'border-amber-500/25 bg-amber-500/5 dark:bg-amber-500/10',
        )}
        role="region"
        aria-label="Lo que ya pasó"
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-500/15 ring-1 ring-violet-500/25 text-violet-600 dark:text-violet-400">
          <History className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1 space-y-2">
          <h2 className="text-lg font-semibold leading-tight">Lo que ya pasó</h2>
          <p className="text-sm text-muted-foreground">{heroMessage}</p>
        </div>
      </div>

      {categoryError ? (
        <div
          className="rounded-xl border border-l-[3px] border-l-destructive/50 bg-destructive/5 px-4 py-3 text-sm text-destructive"
          role="alert"
        >
          {categoryError}
        </div>
      ) : null}

      {monthlySummary.length > 0 ? (
        <p className="text-sm text-muted-foreground">
          En 12 meses entró{' '}
          <span className="font-mono font-semibold tabular-nums text-emerald-300">
            {formatCurrency(annualTotals.income)}
          </span>{' '}
          y salió{' '}
          <span className="font-mono font-semibold tabular-nums text-violet-300">
            {formatCurrency(annualTotals.expenses)}
          </span>
          . Toca la gráfica para ver cada mes.
        </p>
      ) : null}

      <MonthlyOverviewChart
        months={monthlySummary}
        selectedMonthKey={resolvedMonthKey}
        onSelectMonth={setSelectedMonthKey}
      />

      <LiquidityPastMonthFocus
        month={selectedMonth}
        averageExpense={averageExpense}
        canPrev={selectedIndex > 0}
        canNext={selectedIndex >= 0 && selectedIndex < monthKeys.length - 1}
        onPrevMonth={() => handleShiftMonth(-1)}
        onNextMonth={() => handleShiftMonth(1)}
      />

      <section className="space-y-3" aria-labelledby="categories-heading">
        <div>
          <h2 id="categories-heading" className="text-base font-semibold leading-tight">
            En qué se va tu dinero
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Las 5 categorías donde más gastaste en los últimos {ROLLING_MONTHS} meses.
          </p>
        </div>
        <Card className="border border-border/60 bg-card shadow-sm">
          <CardContent className="space-y-3 pt-6">
            {topCategories.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aún no hay categorías con gasto en este periodo.
              </p>
            ) : (
              topCategories.map((row) => {
                const widthPercent = (row.total / maxCategoryAmount) * 100;
                const label = formatCategoryLabel(row.category, row.categoryIcon);
                return (
                  <div key={row.category} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="font-medium">{label}</span>
                      <span className="money-negative shrink-0 font-semibold tabular-nums">
                        {formatCurrency(row.total)}
                      </span>
                    </div>
                    <div
                      className="h-2.5 overflow-hidden rounded-full bg-muted/60"
                      role="presentation"
                    >
                      <div
                        className="h-full rounded-full bg-primary/70 transition-all"
                        style={{ width: `${Math.max(widthPercent, 4)}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </section>

      <section
        className="rounded-xl border border-border/60 bg-transparent shadow-sm overflow-hidden"
        aria-labelledby="insights-cards-heading"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 px-4 py-3">
          <div>
            <h2 id="insights-cards-heading" className="text-base font-semibold leading-tight">
              Tus cuentas hoy
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Efectivo, débito y tarjetas. Toca una cuenta para corregir su saldo.
            </p>
          </div>
          <span className="text-xs text-muted-foreground tabular-nums">
            {sortedCards.length} cuenta{sortedCards.length !== 1 ? 's' : ''}
          </span>
        </div>
        {sortedCards.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            No hay cuentas activas de efectivo o tarjeta.
          </p>
        ) : (
          <ul className="divide-y divide-border/40">
            {sortedCards.map((card) => {
              const limit = Number(card.credit_limit ?? 0);
              const used = Number(card.amount);
              const isCredit =
                card.type === 'CREDIT_CARD' || card.type === 'DEPARTMENT_STORE_CARD';
              const utilizationPct =
                isCredit && limit > 0 ? Math.min(100, (Math.max(0, used) / limit) * 100) : null;
              const risk = getCardRiskLabel(utilizationPct, limit <= 0 && isCredit);

              return (
                <li key={card.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedCard(card)}
                    className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label={`Ver o editar ${card.name}`}
                  >
                    <WalletProviderIcon
                      providerIconKey={card.provider_icon_key}
                      className="mt-0.5 h-9 w-9 shrink-0 rounded-lg border border-border/60 bg-card"
                      iconClassName="h-5 w-5"
                      data-icon="inline-start"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-medium">{card.name}</p>
                        {isCredit ? (
                          <span
                            className={cn(
                              'rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1',
                              risk.tone === 'destructive' &&
                                'bg-destructive/10 text-destructive ring-destructive/20',
                              risk.tone === 'amber' &&
                                'bg-amber-500/10 text-amber-800 ring-amber-500/20 dark:text-amber-300',
                              risk.tone === 'emerald' &&
                                'bg-emerald-500/10 text-emerald-700 ring-emerald-500/20 dark:text-emerald-300',
                              risk.tone === 'muted' &&
                                'bg-muted text-muted-foreground ring-border/40',
                            )}
                          >
                            {risk.label}
                          </span>
                        ) : null}
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        {PAYMENT_METHOD_LABELS[card.type as keyof typeof PAYMENT_METHOD_LABELS] ??
                          card.type}
                      </p>
                      <p className="mt-1 font-mono text-sm font-bold tabular-nums">
                        {isCredit ? 'Debes: ' : 'Tienes: '}
                        {formatCurrency(used)}
                      </p>
                      {utilizationPct != null ? (
                        <div className="mt-2 h-1.5 w-full max-w-md overflow-hidden rounded-full bg-muted/50">
                          <div
                            className={cn(
                              'h-full rounded-full transition-all',
                              utilizationPct > 80
                                ? 'bg-destructive/80'
                                : utilizationPct > 50
                                  ? 'bg-amber-500/80'
                                  : 'bg-emerald-500/80',
                            )}
                            style={{ width: `${utilizationPct}%` }}
                          />
                        </div>
                      ) : null}
                    </div>
                    <Wallet className="mt-1 size-4 shrink-0 text-muted-foreground" aria-hidden />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <WalletBalanceEditDialog
        wallet={selectedCard}
        ownerQueryString={ownerQueryString}
        onOpenChange={(open) => {
          if (!open) setSelectedCard(null);
        }}
        onSaved={(walletId, newAmount) => {
          setSelectedCard((prev) =>
            prev && prev.id === walletId ? { ...prev, amount: newAmount } : prev,
          );
          void load();
        }}
      />
    </div>
  );
}
