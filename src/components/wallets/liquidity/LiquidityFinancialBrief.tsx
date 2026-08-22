'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from 'recharts';
import { ChevronDown, Sparkles, TrendingDown, AlertTriangle, ArrowRight } from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import { MONTHLY_PANEL_SHELL_CLASS } from '@/components/monthly/monthly-panel-shell';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  buildLiquidityFinancialBrief,
  type LiquidityBriefTone,
  type LiquidityFinancialBrief as LiquidityFinancialBriefData,
} from '@/lib/finance/liquidity-financial-brief';
import type { LiquidityYtdContext } from '@/lib/finance/liquidity-ytd-context';
import { compareMonthKeys } from '@/lib/finance/liquidity-chart-range';
import { monthDebtPaymentsTotal } from '@/lib/finance/liquidity-month-debt-items';
import type { LiquidityProjectionResponse } from '@/types/catalog';
import {
  formatMonthYearLabel,
  formatShortMonthLabel,
} from '@/components/wallets/liquidity/liquidity-personalization';

type LiquidityFinancialBriefProps = {
  data: LiquidityProjectionResponse;
  ytdContext: LiquidityYtdContext | null;
  isRefreshing?: boolean;
};

const TONE_BORDER: Record<LiquidityBriefTone, string> = {
  positive: 'border-l-emerald-500/50',
  neutral: 'border-l-primary/50',
  caution: 'border-l-amber-500/50',
  critical: 'border-l-destructive/50',
};

const TONE_GLOW: Record<LiquidityBriefTone, string> = {
  positive: 'from-emerald-500/20 via-transparent to-transparent',
  neutral: 'from-primary/20 via-transparent to-transparent',
  caution: 'from-amber-500/20 via-transparent to-transparent',
  critical: 'from-destructive/20 via-transparent to-transparent',
};

const TONE_ICON: Record<LiquidityBriefTone, typeof Sparkles> = {
  positive: TrendingDown,
  neutral: Sparkles,
  caution: AlertTriangle,
  critical: AlertTriangle,
};

const TONE_ICON_RING: Record<LiquidityBriefTone, string> = {
  positive: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/25',
  neutral: 'bg-primary/15 text-primary ring-primary/25',
  caution: 'bg-amber-500/15 text-amber-300 ring-amber-500/25',
  critical: 'bg-destructive/15 text-destructive ring-destructive/25',
};

const formatAxisCompact = (value: number): string => {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}k`;
  return String(Math.round(value));
};

type BriefBodyProps = {
  brief: LiquidityFinancialBriefData;
  data: LiquidityProjectionResponse;
};

const DebtTrajectoryChart = ({
  rows,
}: {
  rows: Array<{ label: string; outstanding: number; payments: number }>;
}) => {
  if (rows.length === 0) return null;

  return (
    <div className="flex min-h-[180px] flex-1 flex-col">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Trayectoria del adeudo
        </p>
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <span className="h-0.5 w-3 rounded-full bg-amber-400" />
            Adeudo
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-0.5 w-3 rounded-full bg-violet-400" />
            Pagos
          </span>
        </div>
      </div>
      <div className="min-h-[140px] flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={rows} margin={{ top: 4, right: 4, left: -8, bottom: 0 }}>
            <defs>
              <linearGradient id="briefOutstandingFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#fbbf24" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#fbbf24" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: '#9ca3af' }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              yAxisId="outstanding"
              tickFormatter={formatAxisCompact}
              tick={{ fontSize: 10, fill: '#fbbf24' }}
              tickLine={false}
              axisLine={false}
              width={36}
            />
            <YAxis
              yAxisId="payments"
              orientation="right"
              tickFormatter={formatAxisCompact}
              tick={{ fontSize: 10, fill: '#a78bfa' }}
              tickLine={false}
              axisLine={false}
              width={32}
            />
            <Area
              yAxisId="outstanding"
              type="monotone"
              dataKey="outstanding"
              stroke="#fbbf24"
              strokeWidth={2}
              fill="url(#briefOutstandingFill)"
              isAnimationActive
            />
            <Area
              yAxisId="payments"
              type="monotone"
              dataKey="payments"
              stroke="#a78bfa"
              strokeWidth={1.5}
              strokeDasharray="4 3"
              fill="none"
              isAnimationActive
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

const HorizontalBarRow = ({
  label,
  value,
  max,
  colorClass,
  valueClass,
}: {
  label: string;
  value: number;
  max: number;
  colorClass: string;
  valueClass?: string;
}) => {
  const width = max > 0 ? Math.max(4, (value / max) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
        <span className={cn('font-mono text-xs font-bold tabular-nums', valueClass)}>
          {formatCurrency(value)}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted/40">
        <div
          className={cn('h-full rounded-full transition-all', colorClass)}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
};

const YtdSplitBar = ({ ytd }: { ytd: LiquidityYtdContext }) => {
  const debtShare = ytd.spentYtd > 0 ? (ytd.debtPaidYtd / ytd.spentYtd) * 100 : 0;
  const otherShare = Math.max(0, 100 - debtShare);

  return (
    <div className="rounded-xl border border-border/50 bg-black/10 p-3 dark:bg-white/[0.03]">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Gasto {ytd.currentYear}
        </p>
        {ytd.ratioLabel ? (
          <p className="text-[10px] text-muted-foreground">{ytd.ratioLabel}</p>
        ) : null}
      </div>
      <div className="flex h-3 overflow-hidden rounded-full">
        <div
          className="h-full bg-gradient-to-r from-violet-600 to-violet-400"
          style={{ width: `${debtShare}%` }}
          title="Pagos de deuda"
        />
        <div
          className="h-full bg-muted/60"
          style={{ width: `${otherShare}%` }}
          title="Resto del gasto"
        />
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-[11px]">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-violet-400" />
          Deudas {formatCurrency(ytd.debtPaidYtd)}
        </span>
        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
          <span className="size-2 rounded-full bg-muted-foreground/40" />
          Resto {formatCurrency(Math.max(0, ytd.spentYtd - ytd.debtPaidYtd))}
        </span>
        <span className="font-mono font-semibold tabular-nums">
          {formatCurrency(ytd.spentYtd)} total
        </span>
      </div>
    </div>
  );
};

const BriefHeader = ({
  brief,
  Icon,
}: {
  brief: LiquidityFinancialBriefData;
  Icon: typeof Sparkles;
}) => (
  <div className="relative flex items-start gap-3">
    <span
      className={cn(
        'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1',
        TONE_ICON_RING[brief.tone],
      )}
    >
      <Icon className="size-4" aria-hidden />
    </span>
    <div className="min-w-0 flex-1 space-y-1">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        Panorama financiero · {formatMonthYearLabel(brief.asOfMonthKey)}
      </p>
      <h2 id="liquidity-brief-heading" className="text-base font-semibold leading-snug sm:text-lg">
        {brief.headline}
      </h2>
      <p className="hidden text-sm text-muted-foreground sm:block">{brief.subline}</p>
    </div>
  </div>
);

const BriefBody = ({ brief, data }: BriefBodyProps) => {
  const paymentMetrics = brief.metrics.filter((m) => m.label.startsWith('Pagos ·'));
  const maxPayment = Math.max(...paymentMetrics.map((m) => m.value), 1);

  const trajectoryRows = useMemo(() => {
    const asOfKey = brief.asOfMonthKey;
    return data.monthly_series
      .filter((month) => compareMonthKeys(month.month_key, asOfKey) >= 0)
      .slice(0, 8)
      .map((month) => ({
        label: formatShortMonthLabel(month.month_key),
        outstanding: month.outstanding_debt_total ?? 0,
        payments: monthDebtPaymentsTotal(month.debt_items ?? []),
      }));
  }, [brief.asOfMonthKey, data.monthly_series]);

  return (
    <>
      <p className="mt-3 text-sm text-muted-foreground sm:hidden">{brief.subline}</p>

      {brief.actionNow ? (
        <div className="relative mt-4 overflow-hidden rounded-xl border border-white/[0.08] bg-gradient-to-br from-[#3a37fc]/10 via-transparent to-[#ee477a]/5 px-4 py-3.5">
          <div className="flex items-start gap-2.5">
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/20 text-primary">
              <ArrowRight className="size-3.5" aria-hidden />
            </span>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-primary">
                Qué hacer ahora
              </p>
              <p className="mt-1 text-sm font-medium leading-snug text-foreground">
                {brief.actionNow}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      <div className="mt-4">
        <DebtTrajectoryChart rows={trajectoryRows} />
      </div>

      {paymentMetrics.length > 0 ? (
        <div className="mt-4 space-y-2.5 rounded-xl border border-border/50 bg-black/10 p-3 dark:bg-white/[0.03]">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Compromisos de pago
          </p>
          {paymentMetrics.map((metric) => (
            <HorizontalBarRow
              key={metric.label}
              label={metric.label.replace('Pagos · ', '')}
              value={metric.value}
              max={maxPayment}
              colorClass="bg-gradient-to-r from-[#3a37fc] to-[#ee477a]"
              valueClass="text-violet-300"
            />
          ))}
        </div>
      ) : null}

      {brief.ytd && (brief.ytd.spentYtd > 0 || brief.ytd.debtPaidYtd > 0) ? (
        <div className="mt-4">
          <YtdSplitBar ytd={brief.ytd} />
        </div>
      ) : null}

      {brief.insights.length > 0 ? (
        <ul className="mt-4 flex flex-wrap gap-2">
          {brief.insights.map((insight) => (
            <li
              key={insight}
              className="max-w-full rounded-full border border-border/50 bg-muted/20 px-3 py-1.5 text-[11px] leading-snug text-muted-foreground"
            >
              {insight}
            </li>
          ))}
        </ul>
      ) : null}

      {brief.compareLine ? (
        <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
          <span className="font-medium text-foreground/80">Comparativa · </span>
          {brief.compareLine}
        </p>
      ) : null}
    </>
  );
};

export const LiquidityFinancialBrief = ({
  data,
  ytdContext,
  isRefreshing = false,
}: LiquidityFinancialBriefProps) => {
  const brief = useMemo(
    () => buildLiquidityFinancialBrief(data, ytdContext),
    [data, ytdContext],
  );
  const Icon = TONE_ICON[brief.tone];
  const [isMobile, setIsMobile] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 767px)');
    const sync = () => setIsMobile(media.matches);
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);

  const shellClass = cn(
    MONTHLY_PANEL_SHELL_CLASS,
    'relative overflow-hidden border-l-[3px]',
    TONE_BORDER[brief.tone],
    isRefreshing && 'pointer-events-none opacity-60 transition-opacity',
  );

  const headerBlock = <BriefHeader brief={brief} Icon={Icon} />;
  const bodyBlock = <BriefBody brief={brief} data={data} />;
  const glow = (
    <div
      className={cn(
        'pointer-events-none absolute inset-0 bg-gradient-to-br opacity-60',
        TONE_GLOW[brief.tone],
      )}
      aria-hidden
    />
  );

  if (!isMobile) {
    return (
      <section
        className={cn(shellClass, 'px-4 py-4 sm:px-5')}
        aria-labelledby="liquidity-brief-heading"
        aria-busy={isRefreshing}
      >
        {glow}
        <div className="relative">
          {headerBlock}
          {bodyBlock}
        </div>
      </section>
    );
  }

  return (
    <Collapsible
      open={mobileOpen}
      onOpenChange={setMobileOpen}
      className={cn(shellClass, 'px-4 py-3 sm:px-5')}
    >
      {glow}
      <CollapsibleTrigger className="relative flex w-full items-start gap-2 text-left">
        <div className="min-w-0 flex-1">
          {headerBlock}
          {!mobileOpen ? (
            <p className="mt-2 text-xs text-muted-foreground">Toca para ver análisis completo</p>
          ) : null}
        </div>
        <ChevronDown
          className={cn(
            'relative mt-1 size-4 shrink-0 text-muted-foreground transition-transform',
            mobileOpen && 'rotate-180',
          )}
          aria-hidden
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="relative">{bodyBlock}</CollapsibleContent>
    </Collapsible>
  );
};
