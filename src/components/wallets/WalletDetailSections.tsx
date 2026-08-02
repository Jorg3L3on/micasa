'use client';

import Link from 'next/link';
import { useMemo, type ReactNode } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  ChevronLeft,
  ChevronRight,
  Coins,
  Download,
  Landmark,
  MoreHorizontal,
  Pencil,
  Plus,
  RotateCcw,
  SlidersHorizontal,
  Upload,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { PAYMENT_METHOD_LABELS } from '@/domain/payment-method';
import type { PaymentMethodType } from '@/domain/payment-method';
import { getProviderCardStyle } from '@/lib/provider-card-style';
import { cn, formatCurrency } from '@/lib/utils';
import { WalletProviderIcon } from '@/components/wallets/WalletProviderIcon';
import type { WalletDetail } from '@/types/wallet-movements';

const heroTintClass = (wallet?: WalletDetail) => {
  if (!wallet) {
    return {
      wash: 'from-emerald-500/8 via-emerald-500/3 to-transparent dark:from-emerald-500/10 dark:via-emerald-500/4 dark:to-transparent',
      orbA: 'bg-emerald-500/10 dark:bg-emerald-500/12',
      orbB: 'bg-teal-500/6 dark:bg-teal-500/10',
    };
  }
  if (wallet.amount < 0) {
    return {
      wash: 'from-rose-500/8 via-rose-500/3 to-transparent dark:from-rose-500/12 dark:via-rose-500/4 dark:to-transparent',
      orbA: 'bg-rose-500/10 dark:bg-rose-500/14',
      orbB: 'bg-orange-500/6 dark:bg-orange-500/10',
    };
  }
  if (wallet.type === 'CASH') {
    return {
      wash: 'from-emerald-500/8 via-emerald-500/3 to-transparent dark:from-emerald-500/10 dark:via-emerald-500/4 dark:to-transparent',
      orbA: 'bg-emerald-500/10 dark:bg-emerald-500/12',
      orbB: 'bg-teal-500/6 dark:bg-teal-500/10',
    };
  }
  return {
    wash: 'from-blue-500/8 via-blue-500/3 to-transparent dark:from-blue-500/10 dark:via-indigo-500/4 dark:to-transparent',
    orbA: 'bg-blue-500/10 dark:bg-blue-500/12',
    orbB: 'bg-indigo-500/6 dark:bg-indigo-500/10',
  };
};

export const WalletHeroZone = ({
  wallet,
  children,
}: {
  wallet?: WalletDetail;
  children: ReactNode;
}) => {
  const tint = heroTintClass(wallet);
  return (
    <div className="relative -mx-4 overflow-hidden px-4 pb-5 sm:-mx-0 sm:pb-6">
      <div
        className={cn(
          'pointer-events-none absolute inset-0 bg-linear-to-b',
          tint.wash,
        )}
        aria-hidden
      />
      <div
        className={cn(
          'pointer-events-none absolute -left-28 -top-28 h-72 w-72 rounded-full blur-3xl',
          tint.orbA,
        )}
        aria-hidden
      />
      <div
        className={cn(
          'pointer-events-none absolute -right-24 top-12 h-56 w-56 rounded-full blur-3xl',
          tint.orbB,
        )}
        aria-hidden
      />
      <div className="relative flex flex-col gap-5 sm:gap-6">{children}</div>
    </div>
  );
};

type WalletPeriodWorkspaceShellProps = {
  chrome: ReactNode;
  children: ReactNode;
};

/** Period summary + tabs — calm card like Panel financiero (no mobile drawer). */
export const WalletPeriodWorkspaceShell = ({
  chrome,
  children,
}: WalletPeriodWorkspaceShellProps) => (
  <div className="mt-8 sm:mt-10">
    <div
      className={cn(
        'relative overflow-hidden rounded-xl border border-border/60 bg-card px-3 py-3 shadow-sm sm:px-4 sm:py-4',
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

type HeaderActionsProps = {
  walletName: string;
  backHref: string;
  canImport: boolean;
  onRegisterExpense: () => void;
  onRegisterIncome: () => void;
  onEditWallet: () => void;
  onImport: () => void;
  onExportCsv: () => void;
};

export const WalletDetailHeaderActions = ({
  walletName,
  backHref,
  canImport,
  onRegisterExpense,
  onRegisterIncome,
  onEditWallet,
  onImport,
  onExportCsv,
}: HeaderActionsProps) => (
  <div className="flex items-center justify-between gap-2">
    <Link
      href={backHref}
      className="inline-flex h-9 min-w-0 items-center gap-1 rounded-lg px-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      aria-label="Volver a billeteras"
    >
      <ChevronLeft className="h-5 w-5 shrink-0" aria-hidden data-icon="inline-start" />
      <span className="truncate sm:inline">Billeteras</span>
    </Link>
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0"
          aria-label={`Más acciones para ${walletName}`}
        >
          <MoreHorizontal className="h-5 w-5" data-icon="inline-start" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        {canImport ? (
          <>
            <DropdownMenuItem onClick={onRegisterExpense} className="cursor-pointer">
              <Plus className="mr-2 h-4 w-4 shrink-0" data-icon="inline-start" />
              Registrar gasto
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onRegisterIncome} className="cursor-pointer">
              <Coins className="mr-2 h-4 w-4 shrink-0" data-icon="inline-start" />
              Registrar ingreso
            </DropdownMenuItem>
          </>
        ) : null}
        <DropdownMenuItem onClick={onEditWallet} className="cursor-pointer">
          <Pencil className="mr-2 h-4 w-4 shrink-0" data-icon="inline-start" />
          Editar billetera
        </DropdownMenuItem>
        {canImport ? (
          <DropdownMenuItem onClick={onImport} className="cursor-pointer">
            <Upload className="mr-2 h-4 w-4 shrink-0" data-icon="inline-start" />
            Importar CSV
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem onClick={onExportCsv} className="cursor-pointer">
          <Download className="mr-2 h-4 w-4 shrink-0" data-icon="inline-start" />
          Exportar CSV
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
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

  return (
    <div
      className="relative mx-auto w-full max-w-xs sm:max-w-sm"
      role="region"
      aria-label={`Billetera ${wallet.name}`}
    >
      <div
        className={cn(
          'relative aspect-[1.586/1] w-full overflow-hidden rounded-2xl border p-3.5 text-white shadow-xl ring-1 ring-inset ring-white/10 sm:p-4',
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

        <div className="relative flex h-full flex-col justify-between">
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              {wallet.provider_icon_key ? (
                <WalletProviderIcon
                  providerIconKey={wallet.provider_icon_key}
                  className="h-8 w-8 shrink-0 rounded-lg border border-white/25 bg-white/15 shadow-sm ring-1 ring-white/10"
                  iconClassName="h-4 w-4" data-icon="inline-start" />
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
              <span className="rounded-full border border-white/20 bg-white/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider opacity-80">
                Inactiva
              </span>
            ) : null}
          </div>

          <div className="space-y-1 pb-0.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider opacity-70">
              Saldo disponible
            </p>
            <p
              className={cn(
                'text-2xl font-bold font-mono tabular-nums leading-none tracking-tight sm:text-3xl',
                isNegative && 'text-rose-200',
              )}
            >
              {formatCurrency(wallet.amount)}
            </p>
            {isNegative ? (
              <p className="text-[11px] font-medium text-rose-200/90">
                Saldo en rojo — revisa movimientos del periodo
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};

type QuickActionsProps = {
  canImport: boolean;
  onRegisterExpense: () => void;
  onRegisterIncome: () => void;
  onImport: () => void;
  onAdjustBalance: () => void;
};

export const WalletQuickActions = ({
  canImport,
  onRegisterExpense,
  onRegisterIncome,
  onImport,
  onAdjustBalance,
}: QuickActionsProps) => {
  const actions = [
    ...(canImport
      ? [
          {
            key: 'expense',
            label: 'Gasto',
            icon: ArrowUpRight,
            onClick: onRegisterExpense,
          },
          {
            key: 'income',
            label: 'Ingreso',
            icon: ArrowDownLeft,
            onClick: onRegisterIncome,
          },
          {
            key: 'import',
            label: 'Importar',
            ariaLabel: 'Importar movimientos CSV',
            icon: Upload,
            onClick: onImport,
          },
        ]
      : []),
    {
      key: 'adjust',
      label: 'Ajustar',
      icon: SlidersHorizontal,
      onClick: onAdjustBalance,
    },
  ];

  return (
    <div
      className="mt-1 flex justify-around gap-2 overflow-x-auto px-1 pb-0.5 scrollbar-hide sm:mt-2 sm:justify-center sm:gap-6"
      role="group"
      aria-label="Acciones rápidas"
    >
      {actions.map(({ key, label, ariaLabel, icon: Icon, onClick }) => (
        <button
          key={key}
          type="button"
          onClick={onClick}
          className="flex min-w-[4.25rem] shrink-0 flex-col items-center gap-2 transition-opacity hover:opacity-90 active:opacity-75"
          aria-label={ariaLabel ?? label}
        >
          <span className="flex h-14 w-14 items-center justify-center rounded-full border border-white/20 bg-white/15 shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-white/8">
            <Icon className="h-5 w-5 text-foreground dark:text-white" aria-hidden data-icon="inline-start" />
          </span>
          <span className="max-w-[4.5rem] text-center text-[11px] font-medium leading-tight text-muted-foreground">
            {label}
          </span>
        </button>
      ))}
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
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0 rounded-full"
          onClick={onPrevious}
          aria-label="Mes anterior"
        >
          <ChevronLeft className="h-4 w-4" data-icon="inline-start" />
        </Button>
        <div className="min-w-0 flex-1 rounded-2xl border border-border/50 bg-muted/20 px-3 py-2 text-center dark:bg-muted/10">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
            {isCurrentMonth ? 'Mes actual' : 'Periodo'}
          </p>
          <p className="truncate text-xs font-semibold tabular-nums sm:text-sm">{rangeLabel}</p>
        </div>
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
        {!isCurrentMonth ? (
          <Button
            variant="outline"
            size="sm"
            className="h-9 shrink-0 rounded-full px-2.5 text-[10px]"
            onClick={onResetToToday}
            aria-label="Volver al mes actual"
          >
            <RotateCcw className="mr-1 h-3 w-3" aria-hidden data-icon="inline-start" />
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
