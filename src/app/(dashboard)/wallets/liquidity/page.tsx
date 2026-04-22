'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  AlertTriangle,
  Banknote,
  CalendarClock,
  ChevronDown,
  CreditCard,
  FileDown,
  Landmark,
  LineChart,
  Receipt,
  RefreshCw,
  Store,
} from 'lucide-react';
import { useFinanceContext } from '@/context/finance-context';
import {
  buildOwnerQuery,
  downloadLiquidityProjectionCsv,
  fetchLiquidityProjection,
} from '@/lib/api';
import { formatCurrency, cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import type {
  LiquidityProjectionObligationItem,
  LiquidityProjectionResponse,
} from '@/types/catalog';
import { PAYMENT_METHOD_LABELS } from '@/domain/payment-method';
import { CreditCardInstallmentProjectionBlock } from '@/components/credit-cards/CreditCardInstallmentProjectionBlock';

const defaultUntilYmdUtc = (): string => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 180);
  return d.toISOString().split('T')[0];
};

const formatDueLabel = (ymd: string) => {
  const [y, m, day] = ymd.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1, day));
  return d.toLocaleDateString('es-MX', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
};

const formatDueLabelShort = (ymd: string) => {
  const [y, m, day] = ymd.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1, day));
  return d.toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
};

const daysDiffFromToday = (ymd: string): number => {
  const target = new Date(ymd + 'T00:00:00Z').getTime();
  const today = new Date();
  const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((todayUtc - target) / 86400000);
};

const WALLET_TYPE_ICON: Record<string, typeof CreditCard> = {
  CREDIT_CARD: CreditCard,
  DEPARTMENT_STORE_CARD: Store,
};

const FUNDING_WALLET_ICON: Record<string, typeof Landmark> = {
  CASH: Banknote,
  DEBIT_CARD: Landmark,
};

const SOURCE_LABEL: Record<LiquidityProjectionObligationItem['source'], string> = {
  credit_card_statement: 'Estado TC',
  unpaid_expense: 'Gasto impago',
  expense_template: 'Plantilla',
};

/* ─── Skeleton ──────────────────────────────────────────────────────────── */
function LoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-[90px] rounded-xl bg-muted/40 border border-border/30" />
        ))}
      </div>
      <div className="h-28 rounded-xl bg-muted/40 border border-border/30" />
      <div className="space-y-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={cn('rounded-xl bg-muted/35 border border-border/25', i === 0 ? 'h-16' : 'h-14')} />
        ))}
      </div>
    </div>
  );
}

/* ─── Coverage bar ──────────────────────────────────────────────────────── */
function CoverageBar({
  funding,
  obligations,
}: {
  funding: number;
  obligations: number;
}) {
  const pct = obligations > 0 ? Math.min(100, (funding / obligations) * 100) : 100;
  return (
    <div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-destructive/20">
        <div
          className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-500 dark:from-emerald-400 dark:to-emerald-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-1.5 flex items-center justify-between">
        <span className="flex items-center gap-1 font-mono tabular-nums text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
          {formatCurrency(funding)} disponible
        </span>
        <span className="flex items-center gap-1 font-mono tabular-nums text-[10px] font-semibold text-destructive">
          {formatCurrency(obligations - funding)} faltante
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-destructive" />
        </span>
      </div>
    </div>
  );
}

/* ─── Headroom bar ──────────────────────────────────────────────────────── */
function HeadroomBar({
  headroom,
  fundingTotal,
}: {
  headroom: number;
  fundingTotal: number;
}) {
  const base = fundingTotal || 1;
  const pct = Math.min(100, (Math.abs(headroom) / base) * 100);
  const isPositive = headroom >= 0;
  return (
    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted/50">
      <div
        className={cn(
          'h-full rounded-full transition-all duration-500',
          isPositive
            ? 'bg-gradient-to-r from-emerald-500/60 to-emerald-400/40'
            : 'bg-gradient-to-r from-destructive/70 to-destructive/40',
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

/* ─── Main component ─────────────────────────────────────────────────────── */
export default function LiquidityProjectionPage() {
  const { context } = useFinanceContext();
  const ownerQueryString = useMemo(() => {
    const q = buildOwnerQuery(context);
    const s = q.toString();
    return s ? `?${s}` : '';
  }, [context]);

  const [untilInput, setUntilInput] = useState(defaultUntilYmdUtc);
  const [showZeroLines, setShowZeroLines] = useState(false);
  const [stressPercent, setStressPercent] = useState(0);
  const [includeUnpaid, setIncludeUnpaid] = useState(true);
  const [includeTemplates, setIncludeTemplates] = useState(false);
  const [data, setData] = useState<LiquidityProjectionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!context || (context.type === 'user' && context.id === 0)) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const res = await fetchLiquidityProjection(
        {
          until: untilInput,
          omitZero: !showZeroLines,
          stressCyclePercent: stressPercent > 0 ? stressPercent : undefined,
          includeUnpaid,
          includeTemplates,
        },
        context,
      );
      setData(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar la proyección');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [context, untilInput, showZeroLines, stressPercent, includeUnpaid, includeTemplates]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleDownloadCsv = async () => {
    if (!context || (context.type === 'user' && context.id === 0)) return;
    try {
      await downloadLiquidityProjectionCsv(
        {
          until: untilInput,
          omitZero: !showZeroLines,
          stressCyclePercent: stressPercent > 0 ? stressPercent : undefined,
          includeUnpaid,
          includeTemplates,
        },
        context,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo descargar el CSV');
    }
  };

  const hasShortfall = data?.summary.first_cumulative_shortfall_date != null;
  const shortfallDays = hasShortfall
    ? daysDiffFromToday(data!.summary.first_cumulative_shortfall_date!)
    : null;

  return (
    <div className="space-y-6">

      {/* ── Page header ──────────────────────────────────────── */}
      <div
        className={cn(
          'flex items-center gap-4 rounded-2xl border px-4 py-3 shadow-sm',
          hasShortfall
            ? 'border-destructive/25 bg-gradient-to-r from-destructive/5 via-transparent to-transparent dark:from-destructive/8'
            : 'border-border/30 bg-gradient-to-r from-primary/5 via-transparent to-transparent dark:from-primary/8',
        )}
      >
        <span
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 transition-colors',
            hasShortfall
              ? 'bg-destructive/10 ring-destructive/20 dark:bg-destructive/15'
              : 'bg-emerald-500/10 ring-emerald-500/20 dark:bg-emerald-500/15 dark:ring-emerald-500/25',
          )}
        >
          <LineChart
            className={cn(
              'h-5 w-5',
              hasShortfall
                ? 'text-destructive'
                : 'text-emerald-600 dark:text-emerald-400',
            )}
          />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-black tracking-tight">
              Proyección de liquidez
            </h1>
            {data && (
              <span
                className={cn(
                  'rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider leading-none',
                  hasShortfall
                    ? 'bg-destructive/10 text-destructive ring-1 ring-destructive/20'
                    : 'bg-emerald-500/10 text-emerald-700 ring-1 ring-emerald-500/20 dark:text-emerald-400',
                )}
              >
                {hasShortfall ? '⚠ Déficit' : '✓ Saludable'}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Efectivo y débito disponible vs. obligaciones futuras por fecha de vencimiento.
          </p>
        </div>
      </div>

      {/* ── Parameters ───────────────────────────────────────── */}
      <div className="rounded-xl border border-border/40 bg-muted/20 dark:bg-muted/10">
        <div className="flex flex-wrap items-center gap-3 px-4 py-3">
          {/* Horizon date */}
          <div className="space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Horizonte
            </p>
            <Input
              id="liquidity-until"
              type="date"
              value={untilInput}
              onChange={(e) => setUntilInput(e.target.value)}
              className="h-8 w-[150px] rounded-lg border-border/50 bg-background/80 font-mono tabular-nums text-sm shadow-none"
              aria-label="Fecha límite de la proyección"
            />
          </div>

          {/* Stress % */}
          <div className="space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Estrés (%)
            </p>
            <Input
              id="liquidity-stress"
              type="number"
              min={0}
              max={100}
              step={1}
              value={stressPercent}
              onChange={(e) => {
                const n = Number(e.target.value);
                setStressPercent(
                  e.target.value === '' || Number.isNaN(n)
                    ? 0
                    : Math.min(100, Math.max(0, Math.round(n))),
                );
              }}
              className="h-8 w-[80px] rounded-lg border-border/50 bg-background/80 font-mono tabular-nums text-sm shadow-none"
              aria-label="Porcentaje de estrés sobre gasto del ciclo"
            />
          </div>

          {/* Separator */}
          <div className="hidden h-8 w-px bg-border/40 sm:block" aria-hidden />

          {/* Filter pill chips */}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setIncludeUnpaid((v) => !v)}
              className={cn(
                'flex h-8 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition-all',
                includeUnpaid
                  ? 'border-primary/30 bg-primary/10 text-primary shadow-sm dark:bg-primary/15'
                  : 'border-border/40 bg-background/60 text-muted-foreground hover:border-border hover:text-foreground',
              )}
              aria-pressed={includeUnpaid}
            >
              <span className={cn('h-1.5 w-1.5 rounded-full', includeUnpaid ? 'bg-primary' : 'bg-muted-foreground/40')} />
              Gastos impagos
            </button>
            <button
              type="button"
              onClick={() => setIncludeTemplates((v) => !v)}
              className={cn(
                'flex h-8 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition-all',
                includeTemplates
                  ? 'border-primary/30 bg-primary/10 text-primary shadow-sm dark:bg-primary/15'
                  : 'border-border/40 bg-background/60 text-muted-foreground hover:border-border hover:text-foreground',
              )}
              aria-pressed={includeTemplates}
            >
              <span className={cn('h-1.5 w-1.5 rounded-full', includeTemplates ? 'bg-primary' : 'bg-muted-foreground/40')} />
              Plantillas sin gasto
            </button>
            <button
              type="button"
              onClick={() => setShowZeroLines((v) => !v)}
              className={cn(
                'flex h-8 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition-all',
                showZeroLines
                  ? 'border-primary/30 bg-primary/10 text-primary shadow-sm dark:bg-primary/15'
                  : 'border-border/40 bg-background/60 text-muted-foreground hover:border-border hover:text-foreground',
              )}
              aria-pressed={showZeroLines}
            >
              <span className={cn('h-1.5 w-1.5 rounded-full', showZeroLines ? 'bg-primary' : 'bg-muted-foreground/40')} />
              Partidas en $0
            </button>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={() => void load()}
              disabled={loading}
              className="gap-1.5 shadow-sm"
              aria-label="Recalcular proyección"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
              Actualizar
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void handleDownloadCsv()}
              disabled={loading}
              className="gap-1.5"
              aria-label="Descargar proyección en CSV"
            >
              <FileDown className="h-3.5 w-3.5" />
              CSV
            </Button>
          </div>
        </div>
      </div>

      {/* ── Error ────────────────────────────────────────────── */}
      {error && (
        <div
          className="rounded-xl border border-l-[3px] border-l-destructive/50 bg-destructive/5 px-4 py-3 text-sm text-destructive"
          role="alert"
        >
          {error}
        </div>
      )}

      {/* ── Loading ──────────────────────────────────────────── */}
      {loading && !data && <LoadingSkeleton />}

      {/* ── Results ──────────────────────────────────────────── */}
      {data && (
        <>
          {/* Shortfall alert */}
          {hasShortfall && (
            <div
              className="overflow-hidden rounded-xl border border-destructive/30 border-l-[4px] border-l-destructive bg-gradient-to-r from-destructive/8 via-destructive/4 to-transparent shadow-sm dark:from-destructive/12 dark:via-destructive/6"
              role="alert"
              aria-live="polite"
            >
              <div className="flex items-center gap-4 px-4 pt-4 pb-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-destructive/15 ring-1 ring-destructive/25">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-destructive leading-tight">
                    {shortfallDays !== null && shortfallDays >= 0
                      ? `Déficit activo — colchón negativo desde hace ${shortfallDays} día${shortfallDays !== 1 ? 's' : ''}`
                      : `Colchón se agota en ${Math.abs(shortfallDays ?? 0)} día${Math.abs(shortfallDays ?? 0) !== 1 ? 's' : ''}`}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Desde el{' '}
                    <span className="font-mono font-semibold text-foreground/70">
                      {formatDueLabelShort(data.summary.first_cumulative_shortfall_date!)}
                    </span>
                    . El acumulado de pagos supera tu liquidez disponible.
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-mono tabular-nums text-xl font-black text-destructive leading-none">
                    {formatCurrency(data.summary.shortfall_versus_funding)}
                  </p>
                  <p className="mt-0.5 text-[10px] font-medium text-muted-foreground">déficit total</p>
                </div>
              </div>
              <div className="px-4 pb-4">
                <CoverageBar
                  funding={data.summary.funding_total}
                  obligations={data.summary.total_obligations_due_on_or_before_until}
                />
              </div>
            </div>
          )}

          {/* ── KPI cards ──────────────────────────────────── */}
          <div
            className="grid grid-cols-2 gap-3 xl:grid-cols-4"
            role="region"
            aria-label="Resumen de liquidez"
          >
            {/* Liquidez hoy */}
            <div className="relative rounded-xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/8 to-emerald-500/3 px-3 py-3 dark:from-emerald-500/12 dark:to-emerald-500/5">
              <div className="mb-2 flex items-center gap-1.5">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 ring-1 ring-emerald-500/25 dark:bg-emerald-500/20">
                  <Landmark className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600/80 dark:text-emerald-400/80">
                  Liquidez hoy
                </span>
              </div>
              <p className="font-mono text-2xl font-black tabular-nums text-emerald-700 dark:text-emerald-300 leading-tight">
                {formatCurrency(data.summary.funding_total)}
              </p>
              <p className="mt-0.5 text-[9px] text-muted-foreground">
                Efectivo + débito
              </p>
            </div>

            {/* Obligaciones */}
            <div className="relative rounded-xl border border-violet-500/20 bg-gradient-to-br from-violet-500/8 to-violet-500/3 px-3 py-3 dark:from-violet-500/12 dark:to-violet-500/5">
              <div className="mb-2 flex items-center gap-1.5">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-violet-500/15 ring-1 ring-violet-500/25 dark:bg-violet-500/20">
                  <CreditCard className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-violet-600/80 dark:text-violet-400/80">
                  Obligaciones
                </span>
              </div>
              <p className="font-mono text-2xl font-black tabular-nums leading-tight">
                {formatCurrency(data.summary.total_obligations_due_on_or_before_until)}
              </p>
              <p className="mt-0.5 text-[9px] text-muted-foreground">
                Al {data.until}
              </p>
            </div>

            {/* Neto */}
            <div
              className={cn(
                'relative rounded-xl border px-3 py-3',
                data.summary.net_liquidity_versus_obligations >= 0
                  ? 'border-blue-500/20 bg-gradient-to-br from-blue-500/8 to-blue-500/3 dark:from-blue-500/12 dark:to-blue-500/5'
                  : 'border-destructive/20 bg-gradient-to-br from-destructive/8 to-destructive/3 dark:from-destructive/12 dark:to-destructive/5',
              )}
            >
              <div className="mb-2 flex items-center gap-1.5">
                <span className={cn(
                  'flex h-6 w-6 shrink-0 items-center justify-center rounded-lg ring-1',
                  data.summary.net_liquidity_versus_obligations >= 0
                    ? 'bg-blue-500/15 ring-blue-500/25 dark:bg-blue-500/20'
                    : 'bg-destructive/15 ring-destructive/25 dark:bg-destructive/20',
                )}>
                  <LineChart
                    className={cn(
                      'h-3.5 w-3.5',
                      data.summary.net_liquidity_versus_obligations >= 0
                        ? 'text-blue-600 dark:text-blue-400'
                        : 'text-destructive',
                    )}
                  />
                </span>
                <span className={cn(
                  'text-[10px] font-bold uppercase tracking-wider',
                  data.summary.net_liquidity_versus_obligations >= 0
                    ? 'text-blue-600/80 dark:text-blue-400/80'
                    : 'text-destructive/80',
                )}>
                  Neto
                </span>
              </div>
              <p
                className={cn(
                  'font-mono text-2xl font-black tabular-nums leading-tight',
                  data.summary.net_liquidity_versus_obligations < 0
                    ? 'text-destructive'
                    : 'text-foreground',
                )}
              >
                {formatCurrency(data.summary.net_liquidity_versus_obligations)}
              </p>
              <p className="mt-0.5 text-[9px] text-muted-foreground">
                Liquidez menos obligaciones
              </p>
            </div>

            {/* Primera caída / Sin caídas */}
            {hasShortfall ? (
              <div className="relative rounded-xl border border-amber-500/20 bg-gradient-to-br from-amber-500/8 to-amber-500/3 px-3 py-3 dark:from-amber-500/12 dark:to-amber-500/5">
                <div className="mb-2 flex items-center gap-1.5">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 ring-1 ring-amber-500/25 dark:bg-amber-500/20">
                    <CalendarClock className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600/80 dark:text-amber-400/80">
                    Primera caída
                  </span>
                </div>
                <p className="font-mono text-sm font-black tabular-nums text-amber-700 dark:text-amber-300 leading-tight">
                  {formatDueLabelShort(data.summary.first_cumulative_shortfall_date!)}
                </p>
                <p className="mt-0.5 text-[9px] text-muted-foreground">
                  {shortfallDays !== null && shortfallDays >= 0
                    ? `hace ${shortfallDays} día${shortfallDays !== 1 ? 's' : ''}`
                    : `en ${Math.abs(shortfallDays ?? 0)} día${Math.abs(shortfallDays ?? 0) !== 1 ? 's' : ''}`}
                </p>
              </div>
            ) : (
              <div className="relative rounded-xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/8 to-emerald-500/3 px-3 py-3 dark:from-emerald-500/12 dark:to-emerald-500/5">
                <div className="mb-2 flex items-center gap-1.5">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 ring-1 ring-emerald-500/25 dark:bg-emerald-500/20">
                    <CalendarClock className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600/80 dark:text-emerald-400/80">
                    Estado
                  </span>
                </div>
                <p className="font-mono text-sm font-black text-emerald-700 dark:text-emerald-300 leading-tight">
                  Sin caídas
                </p>
                <p className="mt-0.5 text-[9px] text-muted-foreground">
                  Liquidez suficiente en el horizonte
                </p>
              </div>
            )}
          </div>

          {/* ── Funding wallets ──────────────────────────────── */}
          <div
            className="overflow-hidden rounded-xl border border-border/40 shadow-sm"
            role="region"
            aria-label="Billeteras de liquidez"
          >
            <div className="flex items-center gap-2.5 border-b border-border/40 bg-gradient-to-r from-emerald-500/8 to-emerald-500/3 px-3 py-2.5 dark:from-emerald-500/12">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 ring-1 ring-emerald-500/25 dark:bg-emerald-500/20">
                <Landmark className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              </span>
              <span className="flex-1 text-[10px] font-bold uppercase tracking-wider text-emerald-600/80 dark:text-emerald-400/80">
                Efectivo y débito
              </span>
              <span className="font-mono tabular-nums text-sm font-black text-emerald-700 dark:text-emerald-300">
                {formatCurrency(data.summary.funding_total)}
              </span>
            </div>
            {data.funding_wallets.length === 0 ? (
              <p className="px-3 py-4 text-sm text-muted-foreground">
                No hay billeteras activas en este contexto.
              </p>
            ) : (
              <ul className="divide-y divide-border/30">
                {data.funding_wallets.map((w) => {
                  const isZero = w.balance === 0;
                  const fundingTotal = data.summary.funding_total || 1;
                  const pct = (w.balance / fundingTotal) * 100;
                  const Icon =
                    FUNDING_WALLET_ICON[w.type as keyof typeof FUNDING_WALLET_ICON] ??
                    Landmark;
                  return (
                    <li
                      key={w.id}
                      className={cn(
                        'transition-opacity',
                        isZero ? 'opacity-40' : 'border-l-[3px] border-l-emerald-500/30',
                      )}
                    >
                      <div className="flex items-center gap-3 px-3 py-2.5">
                        <span className={cn(
                          'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ring-1',
                          isZero
                            ? 'bg-muted/50 ring-border/40'
                            : 'bg-emerald-500/10 ring-emerald-500/20 dark:bg-emerald-500/15',
                        )}>
                          <Icon className={cn(
                            'h-3.5 w-3.5',
                            isZero ? 'text-muted-foreground' : 'text-emerald-600 dark:text-emerald-400',
                          )} />
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="truncate text-sm font-medium">{w.name}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {PAYMENT_METHOD_LABELS[
                              w.type as keyof typeof PAYMENT_METHOD_LABELS
                            ] ?? w.type}
                          </p>
                        </div>
                        {!isZero && (
                          <span className="shrink-0 rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-mono tabular-nums font-semibold text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500/20">
                            {pct.toFixed(0)}%
                          </span>
                        )}
                        <span
                          className={cn(
                            'shrink-0 font-mono tabular-nums text-sm font-bold',
                            isZero ? 'text-muted-foreground' : 'text-foreground',
                          )}
                        >
                          {formatCurrency(w.balance)}
                        </span>
                      </div>
                      {!isZero && (
                        <div className="mx-3 mb-2.5 h-1 overflow-hidden rounded-full bg-muted/40">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-500 dark:from-emerald-400 dark:to-emerald-300"
                            style={{ width: `${Math.min(100, pct)}%` }}
                          />
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* ── Milestones ───────────────────────────────────── */}
          <div role="region" aria-label="Hitos por fecha de vencimiento">
            <div className="mb-3 flex items-center gap-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-violet-500/10 ring-1 ring-violet-500/20 dark:bg-violet-500/15 dark:ring-violet-500/25">
                <CalendarClock className="h-4 w-4 text-violet-600 dark:text-violet-400" />
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold leading-none">Hitos de pago</h2>
                  <span className="rounded-full bg-violet-500/10 px-2 py-0.5 text-[9px] font-bold tabular-nums text-violet-700 ring-1 ring-violet-500/20 dark:text-violet-300">
                    {data.milestones.length}
                  </span>
                </div>
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  Ref. {data.as_of} · Hasta {data.until}
                </p>
              </div>
            </div>

            {data.milestones.length === 0 ? (
              <Card className="border-border/60">
                <CardContent className="py-8 text-center text-sm text-muted-foreground">
                  No hay vencimientos con monto en este horizonte
                  {showZeroLines ? '' : ' (activa "Partidas en $0" para ver más)'}.
                </CardContent>
              </Card>
            ) : (
              <ul className="space-y-2">
                {data.milestones.map((m, idx) => {
                  const isPastDue = m.is_past_due;
                  const isAtRisk = !isPastDue && m.liquidity_headroom < 0;

                  return (
                    <li key={m.due_date}>
                      <Collapsible className="group/milestone">
                        <CollapsibleTrigger
                          className={cn(
                            'flex w-full items-center gap-3 rounded-xl border border-l-[4px] px-4 py-3 text-left transition-all outline-none focus-visible:ring-2 focus-visible:ring-ring shadow-sm hover:shadow-md',
                            isPastDue
                              ? 'border-destructive/30 border-l-destructive bg-gradient-to-r from-destructive/6 to-destructive/2 hover:from-destructive/10 dark:from-destructive/10'
                              : isAtRisk
                                ? 'border-amber-400/30 border-l-amber-500 bg-gradient-to-r from-amber-500/6 to-amber-500/2 hover:from-amber-500/10 dark:from-amber-500/10'
                                : 'border-border/50 border-l-primary/40 bg-card hover:bg-muted/30 hover:border-l-primary/60',
                          )}
                          aria-label={`Vencimiento ${m.due_date}, total ${formatCurrency(m.total_due)}`}
                        >
                          {/* Index badge */}
                          <span
                            className={cn(
                              'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-black ring-1',
                              isPastDue
                                ? 'bg-destructive/15 text-destructive ring-destructive/25'
                                : isAtRisk
                                  ? 'bg-amber-500/15 text-amber-700 ring-amber-500/25 dark:text-amber-300'
                                  : 'bg-muted/80 text-muted-foreground ring-border/50',
                            )}
                          >
                            {idx + 1}
                          </span>

                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={cn(
                                  'text-base font-bold leading-tight',
                                  isPastDue
                                    ? 'text-destructive'
                                    : isAtRisk
                                      ? 'text-amber-700 dark:text-amber-300'
                                      : 'text-foreground',
                                )}
                              >
                                {formatDueLabel(m.due_date)}
                              </span>
                              {isPastDue && (
                                <span className="rounded-md bg-destructive/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-destructive ring-1 ring-destructive/25">
                                  Vencido
                                </span>
                              )}
                              {isAtRisk && (
                                <span className="rounded-md bg-amber-500/12 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-700 ring-1 ring-amber-500/25 dark:text-amber-300">
                                  En riesgo
                                </span>
                              )}
                              {m.obligations.length > 0 && (
                                <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-semibold tabular-nums text-muted-foreground">
                                  {m.obligations.length} {m.obligations.length === 1 ? 'obligación' : 'obligaciones'}
                                </span>
                              )}
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-2.5">
                              <p className="font-mono tabular-nums text-[10px] text-muted-foreground">
                                Acumulado {formatCurrency(m.cumulative_due_through_date)}
                              </p>
                              <span
                                className={cn(
                                  'font-mono tabular-nums text-[10px] font-bold',
                                  m.liquidity_headroom < 0
                                    ? 'text-destructive'
                                    : 'text-emerald-600 dark:text-emerald-400',
                                )}
                              >
                                Colchón {formatCurrency(m.liquidity_headroom)}
                              </span>
                            </div>
                            <HeadroomBar
                              headroom={m.liquidity_headroom}
                              fundingTotal={data.summary.funding_total}
                            />
                          </div>

                          <div className="flex shrink-0 flex-col items-end gap-1.5">
                            <span
                              className={cn(
                                'font-mono tabular-nums text-base font-black leading-none',
                                isPastDue
                                  ? 'text-destructive'
                                  : isAtRisk
                                    ? 'text-amber-700 dark:text-amber-300'
                                    : 'text-foreground',
                              )}
                            >
                              {formatCurrency(m.total_due)}
                            </span>
                            <ChevronDown className="h-4 w-4 text-muted-foreground/60 transition-transform group-data-[state=open]/milestone:rotate-180" />
                          </div>
                        </CollapsibleTrigger>

                        <CollapsibleContent>
                          <ul className="mt-1.5 overflow-hidden rounded-xl border border-border/40 divide-y divide-border/30 bg-muted/10 shadow-sm">
                            {m.obligations.map((o) => {
                              const Icon =
                                o.source === 'unpaid_expense'
                                  ? Receipt
                                  : (WALLET_TYPE_ICON[o.wallet_type] ?? CreditCard);
                              const rowKey = `${o.source}-${o.wallet_id}-${o.statement_end}-${o.expense_id ?? ''}-${o.expense_template_id ?? ''}`;
                              const secondary =
                                o.source === 'credit_card_statement'
                                  ? `Estado ${o.statement_start} → ${o.statement_end}`
                                  : o.source === 'unpaid_expense'
                                    ? (o.expense_description ?? 'Gasto impago')
                                    : (o.template_name ?? 'Plantilla');

                              const rowClass =
                                'flex w-full items-center gap-3 px-3 py-2.5 hover:bg-muted/50 transition-colors';

                              const iconColor =
                                o.source === 'credit_card_statement'
                                  ? 'bg-violet-500/10 ring-violet-500/20 dark:bg-violet-500/15'
                                  : o.source === 'unpaid_expense'
                                    ? 'bg-destructive/10 ring-destructive/20'
                                    : 'bg-muted/60 ring-border/40';
                              const iconTextColor =
                                o.source === 'credit_card_statement'
                                  ? 'text-violet-600 dark:text-violet-400'
                                  : o.source === 'unpaid_expense'
                                    ? 'text-destructive'
                                    : 'text-muted-foreground';

                              const rowBody = (
                                <>
                                  <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ring-1', iconColor)}>
                                    <Icon className={cn('h-3.5 w-3.5', iconTextColor)} />
                                  </span>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex flex-wrap items-center gap-1.5">
                                      <p className="text-sm font-semibold truncate">
                                        {o.wallet_name}
                                      </p>
                                      <span
                                        className={cn(
                                          'rounded-md px-1.5 py-0.5 text-[9px] font-bold ring-1',
                                          o.source === 'credit_card_statement'
                                            ? 'bg-violet-500/10 text-violet-700 ring-violet-500/20 dark:text-violet-300'
                                            : o.source === 'unpaid_expense'
                                              ? 'bg-destructive/10 text-destructive ring-destructive/20'
                                              : 'bg-muted text-muted-foreground ring-border/40',
                                        )}
                                      >
                                        {SOURCE_LABEL[o.source]}
                                      </span>
                                      {o.is_estimate && (
                                        <span className="rounded-md bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-medium text-amber-700 ring-1 ring-amber-500/20 dark:text-amber-300">
                                          Estimado
                                        </span>
                                      )}
                                    </div>
                                    <p className="font-mono tabular-nums text-[10px] text-muted-foreground truncate mt-0.5">
                                      {secondary}
                                      {o.stress_adjustment != null && o.stress_adjustment > 0 && (
                                        <span className="ml-1 font-semibold text-amber-600 dark:text-amber-400">
                                          +estrés {formatCurrency(o.stress_adjustment)}
                                        </span>
                                      )}
                                    </p>
                                  </div>
                                  <span className="shrink-0 font-mono tabular-nums text-sm font-bold">
                                    {formatCurrency(o.next_due_payment)}
                                  </span>
                                </>
                              );

                              if (o.source === 'credit_card_statement') {
                                return (
                                  <li key={rowKey}>
                                    <Link
                                      href={`/credit-cards/${o.wallet_id}${ownerQueryString}`}
                                      className={rowClass}
                                      aria-label={`${o.wallet_name}, ${SOURCE_LABEL[o.source]} ${formatCurrency(o.next_due_payment)}`}
                                    >
                                      {rowBody}
                                    </Link>
                                  </li>
                                );
                              }
                              if (o.source === 'unpaid_expense') {
                                return (
                                  <li key={rowKey}>
                                    <Link
                                      href="/transactions"
                                      className={rowClass}
                                      aria-label={`Gasto impago ${formatCurrency(o.next_due_payment)}`}
                                    >
                                      {rowBody}
                                    </Link>
                                  </li>
                                );
                              }
                              return (
                                <li key={rowKey} className={rowClass}>
                                  {rowBody}
                                </li>
                              );
                            })}
                          </ul>
                        </CollapsibleContent>
                      </Collapsible>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* ── Assumptions ─────────────────────────────────── */}
          <Collapsible className="group/assume rounded-xl border border-dashed border-border/50 bg-muted/10">
            <CollapsibleTrigger
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground hover:bg-muted/30 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Ver supuestos del modelo"
            >
              <ChevronDown className="h-3.5 w-3.5 shrink-0 transition-transform group-data-[state=open]/assume:rotate-180" />
              Supuestos del modelo
            </CollapsibleTrigger>
            <CollapsibleContent>
              <ul className="px-4 pb-4 space-y-2 text-[11px] text-muted-foreground">
                {data.assumptions.map((a) => (
                  <li key={a} className="flex items-start gap-2">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted-foreground/40" />
                    {a}
                  </li>
                ))}
              </ul>
            </CollapsibleContent>
          </Collapsible>
        </>
      )}

      {/* ── Installment projection — secondary context, loads independently ── */}
      <CreditCardInstallmentProjectionBlock />
    </div>
  );
}
