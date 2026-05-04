'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CreditCard, Landmark, PieChart } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useFinanceContext } from '@/context/finance-context';
import { buildOwnerQuery, clientFetchFromApi } from '@/lib/api/client-fetch';
import { formatCurrency, cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import MonthlyOverviewChart from '@/components/dashboard/MonthlyOverviewChart';
import { DASHBOARD_METRIC_STRIP_CLASS } from '@/components/dashboard/constants';
import type { WalletListItem } from '@/types/catalog';
import { PAYMENT_METHOD_LABELS } from '@/domain/payment-method';
import { WalletBalanceEditDialog } from '@/components/wallets/WalletBalanceEditDialog';
import { WalletProviderIcon } from '@/components/wallets/WalletProviderIcon';

const CARD_TYPES = ['CASH', 'DEBIT_CARD', 'CREDIT_CARD', 'DEPARTMENT_STORE_CARD'] as const;
const ROLLING_MONTHS = 12;

type CategoryReportRow = { category: string; total: number };

const sortWalletsLikeDashboard = (wallets: WalletListItem[]): WalletListItem[] => {
  return [...wallets]
    .filter((wallet) => CARD_TYPES.includes(wallet.type as (typeof CARD_TYPES)[number]) && wallet.active)
    .sort((a, b) => {
      const getTypeRank = (type: string) => {
        if (type === 'CASH') return 0;
        if (type === 'DEBIT_CARD') return 1;
        if (type === 'CREDIT_CARD' || type === 'DEPARTMENT_STORE_CARD') return 2;
        return 3;
      };
      const rankDiff = getTypeRank(a.type) - getTypeRank(b.type);
      if (rankDiff !== 0) return rankDiff;
      const bothCreditTypes =
        (a.type === 'CREDIT_CARD' || a.type === 'DEPARTMENT_STORE_CARD') &&
        (b.type === 'CREDIT_CARD' || b.type === 'DEPARTMENT_STORE_CARD');
      if (bothCreditTypes) {
        const usedPct = (w: WalletListItem) => {
          const limit = Number(w.credit_limit ?? 0);
          if (limit <= 0) return Number.POSITIVE_INFINITY;
          return Math.max(0, Number(w.amount)) / limit;
        };
        const d = usedPct(a) - usedPct(b);
        if (d !== 0) return d;
      }
      return a.name.localeCompare(b.name);
    });
};

export function LiquidityInsightsTab() {
  const { context } = useFinanceContext();
  const [wallets, setWallets] = useState<WalletListItem[]>([]);
  const [categories, setCategories] = useState<CategoryReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [selectedCard, setSelectedCard] = useState<WalletListItem | null>(null);

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
      const [walletList, catRows] = await Promise.all([
        clientFetchFromApi<WalletListItem[]>('/api/wallets', undefined, context),
        clientFetchFromApi<CategoryReportRow[]>(
          `/api/reports?type=by-category&windowMonths=${ROLLING_MONTHS}`,
          undefined,
          context,
        ),
      ]);
      setWallets(walletList);
      setCategories(Array.isArray(catRows) ? catRows : []);
    } catch (e) {
      setCategoryError(e instanceof Error ? e.message : 'No se pudieron cargar los datos');
      setWallets([]);
      setCategories([]);
    } finally {
      setLoading(false);
    }
  }, [context]);

  useEffect(() => {
    void load();
  }, [load]);

  const sortedCards = useMemo(() => sortWalletsLikeDashboard(wallets), [wallets]);

  const { fundingTotal, creditUsedTotal } = useMemo(() => {
    let funding = 0;
    let credit = 0;
    for (const w of wallets) {
      if (!w.active) continue;
      const amt = Number(w.amount);
      if (w.type === 'CASH' || w.type === 'DEBIT_CARD') funding += amt;
      if (w.type === 'CREDIT_CARD' || w.type === 'DEPARTMENT_STORE_CARD') credit += amt;
    }
    return { fundingTotal: funding, creditUsedTotal: credit };
  }, [wallets]);

  const categoryChartData = useMemo(() => {
    return [...categories]
      .sort((a, b) => b.total - a.total)
      .slice(0, 12)
      .map((row) => ({
        category:
          row.category.length > 28 ? `${row.category.slice(0, 26)}…` : row.category,
        total: row.total,
      }));
  }, [categories]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 rounded-2xl border border-border/30 bg-gradient-to-r from-violet-500/5 via-transparent to-transparent px-4 py-3 shadow-sm dark:from-violet-500/8">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/10 ring-1 ring-violet-500/20 dark:bg-violet-500/15">
          <PieChart className="h-5 w-5 text-violet-600 dark:text-violet-400" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-black tracking-tight">Análisis</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Tendencias de los últimos {ROLLING_MONTHS} meses, gasto por categoría y saldos por tarjeta.
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div
          className={cn(DASHBOARD_METRIC_STRIP_CLASS, 'border-l-emerald-500/50')}
          role="region"
          aria-label="Liquidez en efectivo y débito"
        >
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 dark:bg-emerald-500/15">
              <Landmark className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Liquidez (efectivo + débito)
            </span>
          </div>
          <p className="mt-1 font-mono text-lg font-bold tabular-nums text-emerald-700 dark:text-emerald-300">
            {formatCurrency(fundingTotal)}
          </p>
        </div>
        <div
          className={cn(DASHBOARD_METRIC_STRIP_CLASS, 'border-l-violet-500/50')}
          role="region"
          aria-label="Saldo usado en tarjetas de crédito"
        >
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 dark:bg-violet-500/15">
              <CreditCard className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Crédito usado (TC + tiendas)
            </span>
          </div>
          <p className="mt-1 font-mono text-lg font-bold tabular-nums">
            {formatCurrency(creditUsedTotal)}
          </p>
          <p className="text-[9px] text-muted-foreground">Saldo cargado en cada línea de crédito</p>
        </div>
      </div>

      <div className="rounded-xl border border-border/60 bg-transparent shadow-sm overflow-hidden">
        <div className="border-b border-border/60 px-4 py-3">
          <p className="text-sm font-semibold leading-none">Ingresos vs gastos</p>
          <p className="mt-1 text-[10px] text-muted-foreground">Últimos 12 meses calendario</p>
        </div>
        <div className="p-4 pt-2">
          <MonthlyOverviewChart />
        </div>
      </div>

      <Card className="overflow-hidden border-border/60 bg-transparent shadow-sm">
        <CardContent className="px-3 py-3">
          <div className="mb-2 flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-500/10 dark:bg-violet-500/15">
              <PieChart className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
            </span>
            <div>
              <p className="text-sm font-semibold leading-none">Gasto por categoría</p>
              <p className="text-[10px] text-muted-foreground">
                Ventana: últimos {ROLLING_MONTHS} meses (por quincenas)
              </p>
            </div>
          </div>
          {categoryError && (
            <p className="text-sm text-destructive" role="alert">
              {categoryError}
            </p>
          )}
          {!categoryError && loading && (
            <div className="h-64 animate-pulse rounded-lg bg-muted/30" aria-hidden />
          )}
          {!loading && !categoryError && categoryChartData.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No hay gastos registrados en este periodo.
            </p>
          )}
          {!loading && categoryChartData.length > 0 && (
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart layout="vertical" data={categoryChartData} margin={{ left: 8, right: 12 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(127,127,127,0.2)" />
                  <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => formatCurrency(Number(v))} />
                  <YAxis type="category" dataKey="category" width={100} tick={{ fontSize: 10 }} />
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value)}
                    labelFormatter={(label) => String(label)}
                  />
                  <Bar dataKey="total" name="Gasto" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <section className="rounded-xl border border-border/60 bg-transparent shadow-sm overflow-hidden" aria-labelledby="insights-cards-heading">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 px-4 py-3">
          <div>
            <h3 id="insights-cards-heading" className="text-sm font-semibold leading-none">
              Tus tarjetas y saldos
            </h3>
            <p className="mt-1 text-[10px] text-muted-foreground">
              En crédito: saldo utilizado y límite. En efectivo/débito: saldo disponible (no es deuda).
            </p>
          </div>
          <span className="text-xs text-muted-foreground tabular-nums">
            {sortedCards.length} cuenta{sortedCards.length !== 1 ? 's' : ''}
          </span>
        </div>
        {loading ? (
          <div className="space-y-2 p-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-lg bg-muted/30" />
            ))}
          </div>
        ) : sortedCards.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            No hay billeteras activas de efectivo o tarjeta.
          </p>
        ) : (
          <ul className="divide-y divide-border/40">
            {sortedCards.map((card) => {
              const limit = Number(card.credit_limit ?? 0);
              const used = Number(card.amount);
              const isCredit = card.type === 'CREDIT_CARD' || card.type === 'DEPARTMENT_STORE_CARD';
              const utilizationPct =
                isCredit && limit > 0 ? Math.min(100, (Math.max(0, used) / limit) * 100) : null;
              const available =
                isCredit && limit > 0 ? Math.max(0, limit - Math.max(0, used)) : null;

              return (
                <li key={card.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedCard(card)}
                    className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label={`Editar saldo de ${card.name}`}
                  >
                    <WalletProviderIcon
                      providerIconKey={card.provider_icon_key}
                      className="mt-0.5 h-9 w-9 shrink-0 rounded-lg border border-border/60 bg-card"
                      iconClassName="h-5 w-5"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{card.name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {PAYMENT_METHOD_LABELS[card.type as keyof typeof PAYMENT_METHOD_LABELS] ??
                          card.type}
                      </p>
                      <div className="mt-2 grid gap-1 sm:grid-cols-2">
                        <div>
                          <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                            {isCredit ? 'Saldo utilizado' : 'Saldo disponible'}
                          </p>
                          <p className="font-mono text-sm font-bold tabular-nums">{formatCurrency(used)}</p>
                        </div>
                        {isCredit && limit > 0 && (
                          <div>
                            <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                              Límite / disponible
                            </p>
                            <p className="font-mono text-xs tabular-nums text-muted-foreground">
                              {formatCurrency(limit)} · disp. {formatCurrency(available ?? 0)}
                            </p>
                          </div>
                        )}
                      </div>
                      {utilizationPct != null && (
                        <div className="mt-2 h-1.5 w-full max-w-md overflow-hidden rounded-full bg-muted/50">
                          <div
                            className="h-full rounded-full bg-violet-500/80"
                            style={{ width: `${utilizationPct}%` }}
                          />
                        </div>
                      )}
                    </div>
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
