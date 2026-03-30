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
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

const SOURCE_COLOR: Record<LiquidityProjectionObligationItem['source'], string> = {
  credit_card_statement: 'bg-violet-500/10 text-violet-700 dark:text-violet-300',
  unpaid_expense: 'bg-destructive/10 text-destructive',
  expense_template: 'bg-muted text-muted-foreground',
};

/* ─── Skeleton ──────────────────────────────────────────────────────────── */
function LoadingSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-16 rounded-xl bg-muted/50" />
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-xl bg-muted/40" />
        ))}
      </div>
      <div className="h-28 rounded-xl bg-muted/40" />
      <div className="space-y-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className={cn('rounded-xl bg-muted/40', i === 0 ? 'h-14' : 'h-12')} />
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
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-destructive/15">
        <div
          className="h-full rounded-full bg-emerald-500/70 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-1 flex items-center justify-between">
        <span className="font-mono tabular-nums text-[9px] text-emerald-700 dark:text-emerald-400">
          {formatCurrency(funding)} disponible
        </span>
        <span className="font-mono tabular-nums text-[9px] text-destructive">
          {formatCurrency(obligations - funding)} faltante
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
    <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-muted/50">
      <div
        className={cn(
          'h-full rounded-full transition-all duration-500',
          isPositive ? 'bg-emerald-500/50' : 'bg-destructive/60',
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
    <div className="space-y-5">

      {/* ── Page header ──────────────────────────────────────── */}
      <div className="flex items-start gap-3">
        <span
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors',
            hasShortfall
              ? 'bg-destructive/10'
              : 'bg-emerald-500/10 dark:bg-emerald-500/15',
          )}
        >
          <LineChart
            className={cn(
              'h-4 w-4',
              hasShortfall
                ? 'text-destructive'
                : 'text-emerald-600 dark:text-emerald-400',
            )}
          />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-sm font-semibold leading-none">
              Proyección de liquidez
            </h1>
            {data && (
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider leading-none',
                  hasShortfall
                    ? 'bg-destructive/10 text-destructive'
                    : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
                )}
              >
                {hasShortfall ? '⚠ Déficit' : '✓ Saludable'}
              </span>
            )}
          </div>
          <p className="mt-1 text-[10px] text-muted-foreground">
            Efectivo y débito disponible vs. obligaciones futuras por fecha de vencimiento.
          </p>
        </div>
      </div>

      {/* ── Parameters ───────────────────────────────────────── */}
      <div className="rounded-xl border border-border/60 bg-card px-4 py-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label
              htmlFor="liquidity-until"
              className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
            >
              Horizonte
            </Label>
            <Input
              id="liquidity-until"
              type="date"
              value={untilInput}
              onChange={(e) => setUntilInput(e.target.value)}
              className="h-8 w-[160px] font-mono tabular-nums text-sm"
              aria-label="Fecha límite de la proyección"
            />
          </div>

          <div className="space-y-1.5">
            <Label
              htmlFor="liquidity-stress"
              className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
            >
              Estrés ciclo (%)
            </Label>
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
              className="h-8 w-[90px] font-mono tabular-nums text-sm"
              aria-label="Porcentaje de estrés sobre gasto del ciclo"
            />
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-2 pb-0.5">
            <label className="flex cursor-pointer select-none items-center gap-1.5">
              <Checkbox
                id="liquidity-unpaid"
                checked={includeUnpaid}
                onCheckedChange={(v) => setIncludeUnpaid(v === true)}
              />
              <span className="text-xs text-muted-foreground">Gastos impagos</span>
            </label>
            <label className="flex cursor-pointer select-none items-center gap-1.5">
              <Checkbox
                id="liquidity-templates"
                checked={includeTemplates}
                onCheckedChange={(v) => setIncludeTemplates(v === true)}
              />
              <span className="text-xs text-muted-foreground">Plantillas sin gasto</span>
            </label>
            <label className="flex cursor-pointer select-none items-center gap-1.5">
              <Checkbox
                id="liquidity-show-zero"
                checked={showZeroLines}
                onCheckedChange={(v) => setShowZeroLines(v === true)}
              />
              <span className="text-xs text-muted-foreground">Partidas en $0</span>
            </label>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => void load()}
              disabled={loading}
              aria-label="Recalcular proyección"
            >
              {loading ? (
                <RefreshCw className="h-3.5 w-3.5 mr-1 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5 mr-1" />
              )}
              Actualizar
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void handleDownloadCsv()}
              disabled={loading}
              aria-label="Descargar proyección en CSV"
            >
              <FileDown className="h-3.5 w-3.5 mr-1" />
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
              className="overflow-hidden rounded-xl border border-destructive/30 bg-destructive/5 dark:bg-destructive/8"
              role="alert"
              aria-live="polite"
            >
              <div className="flex items-start gap-3 px-4 pt-3.5 pb-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-destructive/10">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-destructive">
                    {shortfallDays !== null && shortfallDays >= 0
                      ? `Déficit activo — colchón negativo desde hace ${shortfallDays} día${shortfallDays !== 1 ? 's' : ''}`
                      : `Colchón se agota en ${Math.abs(shortfallDays ?? 0)} día${Math.abs(shortfallDays ?? 0) !== 1 ? 's' : ''}`}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    Desde el{' '}
                    <span className="font-mono">
                      {formatDueLabelShort(data.summary.first_cumulative_shortfall_date!)}
                    </span>
                    . El acumulado de pagos supera tu liquidez disponible.
                  </p>
                </div>
                <div className="shrink-0 ml-2 text-right">
                  <p className="font-mono tabular-nums text-base font-bold text-destructive leading-none">
                    {formatCurrency(data.summary.shortfall_versus_funding)}
                  </p>
                  <p className="mt-0.5 text-[9px] text-muted-foreground">déficit total</p>
                </div>
              </div>
              <div className="px-4 pb-3">
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
            <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 dark:bg-emerald-500/8 px-3 py-3">
              <div className="flex items-center gap-1.5 mb-2">
                <Landmark className="h-3 w-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Liquidez hoy
                </span>
              </div>
              <p className="text-2xl font-bold font-mono tabular-nums text-emerald-700 dark:text-emerald-300 leading-none">
                {formatCurrency(data.summary.funding_total)}
              </p>
              <p className="text-[9px] text-muted-foreground mt-1">
                Efectivo + débito
              </p>
            </div>

            {/* Obligaciones */}
            <div className="rounded-xl border border-violet-500/25 bg-violet-500/5 dark:bg-violet-500/8 px-3 py-3">
              <div className="flex items-center gap-1.5 mb-2">
                <CreditCard className="h-3 w-3 text-violet-600 dark:text-violet-400 shrink-0" />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Obligaciones
                </span>
              </div>
              <p className="text-2xl font-bold font-mono tabular-nums leading-none">
                {formatCurrency(data.summary.total_obligations_due_on_or_before_until)}
              </p>
              <p className="text-[9px] text-muted-foreground mt-1">
                Al {data.until}
              </p>
            </div>

            {/* Neto */}
            <div
              className={cn(
                'rounded-xl border px-3 py-3',
                data.summary.net_liquidity_versus_obligations >= 0
                  ? 'border-blue-500/25 bg-blue-500/5 dark:bg-blue-500/8'
                  : 'border-destructive/25 bg-destructive/5 dark:bg-destructive/8',
              )}
            >
              <div className="flex items-center gap-1.5 mb-2">
                <LineChart
                  className={cn(
                    'h-3 w-3 shrink-0',
                    data.summary.net_liquidity_versus_obligations >= 0
                      ? 'text-blue-600 dark:text-blue-400'
                      : 'text-destructive',
                  )}
                />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Neto
                </span>
              </div>
              <p
                className={cn(
                  'text-2xl font-bold font-mono tabular-nums leading-none',
                  data.summary.net_liquidity_versus_obligations < 0 && 'text-destructive',
                )}
              >
                {formatCurrency(data.summary.net_liquidity_versus_obligations)}
              </p>
              <p className="text-[9px] text-muted-foreground mt-1">
                Liquidez menos obligaciones
              </p>
            </div>

            {/* Primera caída / Sin caídas */}
            {hasShortfall ? (
              <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 dark:bg-amber-500/8 px-3 py-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <CalendarClock className="h-3 w-3 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Primera caída
                  </span>
                </div>
                <p className="text-sm font-bold font-mono tabular-nums text-amber-700 dark:text-amber-300 leading-tight">
                  {formatDueLabelShort(data.summary.first_cumulative_shortfall_date!)}
                </p>
                <p className="text-[9px] text-muted-foreground mt-1">
                  {shortfallDays !== null && shortfallDays >= 0
                    ? `hace ${shortfallDays} día${shortfallDays !== 1 ? 's' : ''}`
                    : `en ${Math.abs(shortfallDays ?? 0)} día${Math.abs(shortfallDays ?? 0) !== 1 ? 's' : ''}`}
                </p>
              </div>
            ) : (
              <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 dark:bg-emerald-500/8 px-3 py-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <CalendarClock className="h-3 w-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Estado
                  </span>
                </div>
                <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300">
                  Sin caídas
                </p>
                <p className="text-[9px] text-muted-foreground mt-1">
                  Liquidez suficiente en el horizonte
                </p>
              </div>
            )}
          </div>

          {/* ── Funding wallets ──────────────────────────────── */}
          <div
            className="overflow-hidden rounded-xl border border-border/60"
            role="region"
            aria-label="Billeteras de liquidez"
          >
            <div className="flex items-center gap-2 border-b border-border/60 bg-muted/20 px-3 py-2">
              <Landmark className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="flex-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Efectivo y débito
              </span>
              <span className="font-mono tabular-nums text-xs font-semibold text-muted-foreground">
                {formatCurrency(data.summary.funding_total)}
              </span>
            </div>
            {data.funding_wallets.length === 0 ? (
              <p className="px-3 py-4 text-sm text-muted-foreground">
                No hay billeteras activas en este contexto.
              </p>
            ) : (
              <ul>
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
                        'border-b border-border/40 last:border-0 transition-opacity',
                        isZero && 'opacity-40',
                      )}
                    >
                      <div className="flex items-center gap-3 px-3 py-2">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-muted/60">
                          <Icon className="h-3 w-3 text-muted-foreground" />
                        </span>
                        <span className="flex-1 truncate text-sm">{w.name}</span>
                        <span className="hidden shrink-0 text-[10px] text-muted-foreground sm:block">
                          {PAYMENT_METHOD_LABELS[
                            w.type as keyof typeof PAYMENT_METHOD_LABELS
                          ] ?? w.type}
                        </span>
                        {!isZero && (
                          <span className="shrink-0 text-[10px] font-mono tabular-nums text-emerald-600 dark:text-emerald-400 bg-emerald-500/8 rounded px-1">
                            {pct.toFixed(0)}%
                          </span>
                        )}
                        <span
                          className={cn(
                            'shrink-0 font-mono tabular-nums text-sm font-semibold',
                            isZero && 'text-muted-foreground',
                          )}
                        >
                          {formatCurrency(w.balance)}
                        </span>
                      </div>
                      {!isZero && (
                        <div className="mx-3 mb-2 h-0.5 overflow-hidden rounded-full bg-muted/40">
                          <div
                            className="h-full rounded-full bg-emerald-500/40 transition-all duration-500"
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
            <div className="mb-3 flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-500/10 dark:bg-violet-500/15">
                <CalendarClock className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold leading-none">Hitos de pago</h2>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[9px] font-semibold tabular-nums text-muted-foreground">
                    {data.milestones.length}
                  </span>
                </div>
                <p className="mt-1 text-[10px] text-muted-foreground">
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
                            'flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring',
                            isPastDue
                              ? 'border-destructive/40 bg-destructive/5 hover:bg-destructive/8 dark:bg-destructive/8'
                              : isAtRisk
                                ? 'border-amber-400/40 bg-amber-500/5 hover:bg-amber-500/8 dark:bg-amber-500/8'
                                : 'border-border/60 bg-card hover:bg-muted/40',
                          )}
                          aria-label={`Vencimiento ${m.due_date}, total ${formatCurrency(m.total_due)}`}
                        >
                          {/* Index badge */}
                          <span
                            className={cn(
                              'flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold',
                              isPastDue
                                ? 'bg-destructive/20 text-destructive'
                                : isAtRisk
                                  ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300'
                                  : 'bg-muted text-muted-foreground',
                            )}
                          >
                            {idx + 1}
                          </span>

                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={cn(
                                  'text-sm font-semibold',
                                  isPastDue && 'text-destructive',
                                  isAtRisk && 'text-amber-700 dark:text-amber-300',
                                )}
                              >
                                {formatDueLabel(m.due_date)}
                              </span>
                              {isPastDue && (
                                <span className="rounded-sm bg-destructive px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white">
                                  Vencido
                                </span>
                              )}
                              {isAtRisk && (
                                <span className="rounded-sm bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">
                                  En riesgo
                                </span>
                              )}
                            </div>
                            <div className="mt-0.5 flex flex-wrap items-center gap-2">
                              <p className="font-mono tabular-nums text-[9px] text-muted-foreground">
                                Acum. {formatCurrency(m.cumulative_due_through_date)}
                              </p>
                              <span
                                className={cn(
                                  'font-mono tabular-nums text-[9px] font-semibold',
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

                          <div className="flex flex-col items-end gap-1 shrink-0">
                            <span
                              className={cn(
                                'font-mono tabular-nums text-sm font-bold',
                                isPastDue && 'text-destructive',
                                isAtRisk && 'text-amber-700 dark:text-amber-300',
                              )}
                            >
                              {formatCurrency(m.total_due)}
                            </span>
                            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground transition-transform group-data-[state=open]/milestone:rotate-180" />
                          </div>
                        </CollapsibleTrigger>

                        <CollapsibleContent>
                          <ul className="mt-1 overflow-hidden rounded-xl border border-border/40 divide-y divide-border/40 bg-muted/10">
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

                              const rowBody = (
                                <>
                                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted/60">
                                    <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                                  </span>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex flex-wrap items-center gap-1.5">
                                      <p className="text-sm font-medium truncate">
                                        {o.wallet_name}
                                      </p>
                                      <span
                                        className={cn(
                                          'rounded-sm px-1.5 py-0.5 text-[9px] font-semibold',
                                          SOURCE_COLOR[o.source],
                                        )}
                                      >
                                        {SOURCE_LABEL[o.source]}
                                      </span>
                                      {o.is_estimate && (
                                        <span className="rounded-sm bg-muted px-1.5 py-0.5 text-[9px] text-muted-foreground">
                                          Estimado
                                        </span>
                                      )}
                                    </div>
                                    <p className="font-mono tabular-nums text-[9px] text-muted-foreground truncate mt-0.5">
                                      {secondary}
                                      {o.stress_adjustment != null && o.stress_adjustment > 0 && (
                                        <span className="ml-1 text-amber-600 dark:text-amber-400">
                                          +estrés {formatCurrency(o.stress_adjustment)}
                                        </span>
                                      )}
                                    </p>
                                  </div>
                                  <span className="shrink-0 font-mono tabular-nums text-sm font-semibold">
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
          <Collapsible className="group/assume rounded-xl border border-border/40 border-dashed">
            <CollapsibleTrigger
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hover:bg-muted/30 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Ver supuestos del modelo"
            >
              <ChevronDown className="h-3.5 w-3.5 shrink-0 transition-transform group-data-[state=open]/assume:rotate-180" />
              Supuestos del modelo
            </CollapsibleTrigger>
            <CollapsibleContent>
              <ul className="px-3 pb-3 space-y-1.5 text-[11px] text-muted-foreground list-disc pl-6">
                {data.assumptions.map((a) => (
                  <li key={a}>{a}</li>
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
