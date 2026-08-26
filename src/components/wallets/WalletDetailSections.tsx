'use client';

import { useMemo, type ReactNode } from 'react';
import {
  Banknote,
  ChevronLeft,
  ChevronRight,
  Landmark,
  RotateCcw,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  kpiMetricCardShellClass,
  kpiMetricLabelClass,
  kpiMetricValueClass,
  type KpiMetricTone,
} from '@/components/finance/kpi-metric-card-styles';
import { TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  creditCardDetailTabTriggerClass,
  creditCardSegmentedTabChromeClass,
  creditCardSegmentedTabListClass,
} from '@/components/credit-cards/credit-card-segmented-tabs';
import { MONTHLY_PANEL_SHELL_CLASS } from '@/components/monthly/monthly-panel-shell';
import { PAYMENT_METHOD_LABELS } from '@/domain/payment-method';
import type { PaymentMethodType } from '@/domain/payment-method';
import { getProviderCardStyle } from '@/lib/provider-card-style';
import { cn, formatCurrency } from '@/lib/utils';
import { WalletProviderIcon } from '@/components/wallets/WalletProviderIcon';
import type { WalletDetail } from '@/types/wallet-movements';

export const WalletHeroZone = ({
  children,
}: {
  /** Kept for call-site compatibility; hero no longer tints the page background. */
  wallet?: WalletDetail;
  children: ReactNode;
}) => (
  <div className="relative -mx-4 px-4 pb-2 sm:-mx-0 sm:pb-3">
    <div className="relative flex flex-col gap-5 sm:gap-6">{children}</div>
  </div>
);

type WalletPeriodWorkspaceShellProps = {
  chrome: ReactNode;
  children: ReactNode;
};

/** Period summary + tabs — calm card like Panel financiero (no mobile drawer). */
export const WalletPeriodWorkspaceShell = ({
  chrome,
  children,
}: WalletPeriodWorkspaceShellProps) => (
  <div className="mt-0">
    <div
      className={cn(
        MONTHLY_PANEL_SHELL_CLASS,
        'px-3 py-3 sm:px-4 sm:py-4',
        'before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px',
        'before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent dark:before:via-white/5',
      )}
    >
      <div className="relative space-y-4">
        {chrome}
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  </div>
);

export const WalletDetailTabsList = ({ children }: { children: ReactNode }) => (
  <div className={creditCardSegmentedTabChromeClass}>
    <TabsList variant="line" className={creditCardSegmentedTabListClass}>
      {children}
    </TabsList>
  </div>
);

export const WalletDetailTabTrigger = ({
  value,
  children,
}: {
  value: string;
  children: ReactNode;
}) => (
  <TabsTrigger value={value} className={creditCardDetailTabTriggerClass}>
    {children}
  </TabsTrigger>
);

type VisualHeroProps = {
  wallet: WalletDetail;
};

export const WalletVisualHero = ({ wallet }: VisualHeroProps) => {
  const cardStyle = useMemo(
    () => getProviderCardStyle(wallet.provider_icon_key, wallet.type, 'wow'),
    [wallet.provider_icon_key, wallet.type],
  );

  const typeLabel =
    PAYMENT_METHOD_LABELS[wallet.type as PaymentMethodType] ?? wallet.type;
  const isCash = wallet.type === 'CASH';
  const isNegative = wallet.amount < 0;
  const FallbackIcon = isCash ? Banknote : Landmark;

  // Match credit/store detail hero footprint (width + min-height). Content stays
  // spread (header top / saldo bottom); list→detail morph widens into this shell.
  return (
    <div
      className="relative mx-auto w-full max-w-md lg:max-w-lg"
      role="region"
      aria-label={`Billetera ${wallet.name}`}
    >
      <div
        className={cn(
          'relative w-full overflow-hidden rounded-[1.375rem] border p-4 pb-5 text-white shadow-xl ring-1 ring-inset ring-white/10 sm:p-5 sm:pb-6',
          !cardStyle &&
            (isCash
              ? 'border-emerald-500/40 bg-linear-to-br from-emerald-700 via-emerald-900 to-slate-950'
              : 'border-blue-500/40 bg-linear-to-br from-blue-700 via-slate-900 to-slate-950'),
          isNegative && 'ring-rose-400/55',
        )}
        style={cardStyle}
      >
        <span
          className="pointer-events-none absolute -left-12 -top-12 h-32 w-32 rounded-full bg-white/10 blur-3xl"
          aria-hidden
        />
        <span
          className="pointer-events-none absolute -bottom-10 -right-8 h-28 w-28 rounded-full bg-white/8 blur-2xl"
          aria-hidden
        />
        <span
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/30 to-transparent"
          aria-hidden
        />
        {isNegative ? (
          <span className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-linear-to-r from-transparent via-rose-400/80 to-transparent" />
        ) : null}

        <div className="relative flex min-h-[12rem] flex-col justify-between gap-4 sm:min-h-[13.5rem]">
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              {wallet.provider_icon_key ? (
                <WalletProviderIcon
                  providerIconKey={wallet.provider_icon_key}
                  className="h-8 w-8 shrink-0 rounded-lg border border-white/25 bg-white/15 shadow-sm ring-1 ring-white/10"
                  iconClassName="h-4 w-4"
                  data-icon="inline-start"
                />
              ) : (
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/25 bg-white/15">
                  <FallbackIcon className="h-4 w-4" aria-hidden data-icon="inline-start" />
                </span>
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold leading-tight opacity-95">
                  {wallet.name}
                </p>
                <p className="text-[10px] uppercase tracking-widest opacity-60">
                  {typeLabel}
                </p>
              </div>
            </div>
            {!wallet.active ? (
              <span className="rounded-full border border-white/20 bg-white/10 px-2 py-0.5 text-xs font-semibold uppercase tracking-wider opacity-80">
                Inactiva
              </span>
            ) : null}
          </div>

          <div className="min-w-0 space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-wider opacity-70">
              Saldo disponible
            </p>
            <p
              className={cn(
                // leading-snug: WebKit clips glyph ink at line-height:1 inside overflow-hidden
                'break-words text-2xl font-bold font-mono tabular-nums leading-snug tracking-tight sm:text-3xl',
                isNegative && 'text-rose-200',
              )}
            >
              {formatCurrency(wallet.amount)}
            </p>
            {isNegative ? (
              <p className="text-xs font-medium text-rose-200/90">
                Saldo en rojo — revisa movimientos del periodo
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};

type PeriodMetric = {
  key: string;
  label: string;
  value: string;
  tone: KpiMetricTone;
};

const WalletPeriodMetrics = ({ metrics }: { metrics: PeriodMetric[] }) => (
  <div
    className="grid grid-cols-2 gap-1 sm:gap-1.5 lg:grid-cols-4"
    role="group"
    aria-label="Totales del periodo"
  >
    {metrics.map(({ key, label, value, tone }) => (
      <div key={key} className={cn('flex min-w-0 flex-col', kpiMetricCardShellClass(tone))}>
        <p className={kpiMetricLabelClass(tone)}>{label}</p>
        <p
          className={cn(
            'mt-1 truncate font-mono text-base font-bold tabular-nums leading-none sm:text-lg',
            kpiMetricValueClass(tone),
          )}
        >
          {value}
        </p>
      </div>
    ))}
  </div>
);

type PeriodSummaryProps = {
  rangeLabel: string;
  isCurrentMonth: boolean;
  currentBalance: number;
  inflow: number;
  outflow: number;
  net: number;
  movementCount: number;
  averageDailyOutflow: number;
  runwayDays: number | null;
  onPrevious: () => void;
  onNext: () => void;
  onResetToToday: () => void;
};

export const WalletPeriodSummary = ({
  rangeLabel,
  isCurrentMonth,
  currentBalance,
  inflow,
  outflow,
  net,
  movementCount,
  averageDailyOutflow,
  runwayDays,
  onPrevious,
  onNext,
  onResetToToday,
}: PeriodSummaryProps) => {
  const metrics: PeriodMetric[] = [
    {
      key: 'balance',
      label: 'Saldo actual',
      value: formatCurrency(currentBalance),
      tone: currentBalance < 0 ? 'destructive' : 'blue',
    },
    {
      key: 'inflow',
      label: 'Ingresos',
      value: formatCurrency(inflow),
      tone: 'emerald',
    },
    {
      key: 'outflow',
      label: 'Egresos',
      value: formatCurrency(outflow),
      tone: 'destructive',
    },
    {
      key: 'net',
      label: 'Neto',
      value: formatCurrency(net),
      tone: net < 0 ? 'destructive' : 'blue',
    },
  ];

  return (
    <div className="space-y-4" role="region" aria-label="Periodo y totales">
      <div className="flex items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0 rounded-full"
              onClick={onPrevious}
              aria-label="Mes anterior"
            >
              <ChevronLeft className="h-4 w-4" data-icon="inline-start" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Mes anterior</TooltipContent>
        </Tooltip>
        <div className="min-w-0 flex-1 rounded-2xl border border-border/50 bg-muted/20 px-3 py-2 text-center dark:bg-muted/10">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {isCurrentMonth ? 'Mes actual' : 'Periodo'}
          </p>
          <p className="truncate text-xs font-semibold tabular-nums sm:text-sm">
            {rangeLabel}
          </p>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0 rounded-full"
              onClick={onNext}
              disabled={isCurrentMonth}
              aria-label="Mes siguiente"
            >
              <ChevronRight className="h-4 w-4" data-icon="inline-end" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Mes siguiente</TooltipContent>
        </Tooltip>
        {!isCurrentMonth ? (
          <Button
            variant="outline"
            size="sm"
            className="h-9 shrink-0 rounded-full px-2.5 text-[10px]"
            onClick={onResetToToday}
            aria-label="Volver al mes actual"
          >
            <RotateCcw
              className="mr-1 h-3 w-3"
              aria-hidden
              data-icon="inline-start"
            />
            Hoy
          </Button>
        ) : null}
      </div>
      <WalletPeriodMetrics metrics={metrics} />
      <div className="flex flex-wrap gap-2 text-[10px] text-muted-foreground">
        <Badge variant="secondary" className="h-6 rounded-full px-2 font-mono tabular-nums">
          {movementCount} mov.
        </Badge>
        <Badge variant="outline" className="h-6 rounded-full px-2">
          Ritmo diario {formatCurrency(averageDailyOutflow)}
        </Badge>
        <Badge
          variant="outline"
          className={cn(
            'h-6 rounded-full px-2',
            runwayDays === 0 && 'border-destructive/40 text-destructive',
          )}
        >
          {runwayDays == null
            ? 'Cobertura estable'
            : runwayDays === 1
              ? '1 día de cobertura'
              : `${runwayDays} días de cobertura`}
        </Badge>
      </div>
    </div>
  );
};
