'use client';

import Link from 'next/link';
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  ChevronUp,
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
      wash: 'from-emerald-500/12 via-teal-500/5 dark:from-emerald-950/80 dark:via-teal-950/40',
      orbA: 'bg-emerald-500/15 dark:bg-emerald-600/25',
      orbB: 'bg-teal-500/10 dark:bg-blue-600/20',
    };
  }
  if (wallet.amount < 0) {
    return {
      wash: 'from-rose-500/14 via-red-500/6 dark:from-rose-950/80 dark:via-red-950/40',
      orbA: 'bg-rose-500/18 dark:bg-rose-600/28',
      orbB: 'bg-red-500/10 dark:bg-orange-600/18',
    };
  }
  if (wallet.type === 'CASH') {
    return {
      wash: 'from-emerald-500/12 via-teal-500/5 dark:from-emerald-950/80 dark:via-teal-950/40',
      orbA: 'bg-emerald-500/15 dark:bg-emerald-600/25',
      orbB: 'bg-teal-500/10 dark:bg-cyan-600/20',
    };
  }
  return {
    wash: 'from-blue-500/12 via-indigo-500/6 dark:from-blue-950/80 dark:via-indigo-950/40',
    orbA: 'bg-blue-500/15 dark:bg-blue-600/25',
    orbB: 'bg-indigo-500/10 dark:bg-violet-600/20',
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
    <div className="relative -mx-4 overflow-hidden px-4 pb-2 sm:-mx-0 sm:rounded-b-[1.75rem]">
      <div
        className={cn(
          'pointer-events-none absolute inset-0 bg-linear-to-b to-transparent dark:to-background',
          tint.wash,
        )}
        aria-hidden
      />
      <div
        className={cn(
          'pointer-events-none absolute -left-24 -top-24 h-64 w-64 rounded-full blur-3xl',
          tint.orbA,
        )}
        aria-hidden
      />
      <div
        className={cn(
          'pointer-events-none absolute -right-20 top-8 h-48 w-48 rounded-full blur-3xl',
          tint.orbB,
        )}
        aria-hidden
      />
      <div className="relative space-y-4">{children}</div>
    </div>
  );
};

type WalletWorkspaceSnap = 'peek' | 'half' | 'full';

const WALLET_SNAP_MAX_HEIGHT: Record<WalletWorkspaceSnap, string> = {
  peek: 'max-h-0',
  half: 'max-h-[54vh]',
  full: 'max-h-[calc(100vh-12rem)]',
};

type WalletPeriodWorkspaceShellProps = {
  chrome: ReactNode;
  children: ReactNode;
};

export const WalletPeriodWorkspaceShell = ({
  chrome,
  children,
}: WalletPeriodWorkspaceShellProps) => {
  const [snap, setSnap] = useState<WalletWorkspaceSnap>('peek');

  const handleCycleSnap = useCallback(() => {
    setSnap((current) => {
      if (current === 'peek') return 'half';
      if (current === 'half') return 'full';
      return 'peek';
    });
  }, []);

  return (
    <>
      <div className="lg:hidden">
        <div className="relative z-10 -mt-3 shadow-[0_-10px_40px_-16px_rgba(0,0,0,0.12)] dark:shadow-[0_-10px_40px_-16px_rgba(0,0,0,0.45)]">
          <div className="flex flex-col overflow-hidden rounded-t-[1.75rem] border border-border/60 bg-card">
            <button
              type="button"
              className="flex w-full shrink-0 flex-col items-center px-4 pt-3 pb-2"
              onClick={handleCycleSnap}
              aria-expanded={snap !== 'peek'}
              aria-label={
                snap === 'full'
                  ? 'Contraer workspace de billetera'
                  : 'Expandir workspace de billetera'
              }
            >
              <span
                className="mb-2 h-1 w-10 rounded-full bg-muted-foreground/25"
                aria-hidden
              />
              <span className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
                <ChevronUp
                  className={cn(
                    'h-3 w-3 transition-transform',
                    snap === 'peek' && 'rotate-180',
                  )}
                  aria-hidden
                />
                {snap === 'peek' ? 'Vista compacta' : snap === 'half' ? 'Medio' : 'Completo'}
              </span>
            </button>

            <div className="sticky top-0 z-10 shrink-0 border-b border-border/50 bg-card px-4 pb-3">
              {chrome}
            </div>

            <div
              className={cn(
                'overflow-y-auto px-4 pb-4 transition-[max-height] duration-300 ease-out',
                WALLET_SNAP_MAX_HEIGHT[snap],
              )}
            >
              {children}
            </div>
          </div>
        </div>
      </div>

      <div className="relative z-10 -mt-3 hidden lg:block">
        <div className="rounded-t-[1.75rem] border border-border/60 bg-card px-4 pt-4 pb-4 shadow-sm">
          <div className="sticky top-16 z-10 -mx-4 border-b border-border/50 bg-card px-4 pb-3 group-has-data-[collapsible=icon]/sidebar-wrapper:top-12">
            {chrome}
          </div>
          <div className="pt-4">{children}</div>
        </div>
      </div>
    </>
  );
};

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
  onAdjustBalance: () => void;
  onImport: () => void;
  onExportCsv: () => void;
};

export const WalletDetailHeaderActions = ({
  walletName,
  backHref,
  canImport,
  onRegisterExpense,
  onRegisterIncome,
  onAdjustBalance,
  onImport,
  onExportCsv,
}: HeaderActionsProps) => (
  <div className="flex items-center justify-between gap-2">
    <Link
      href={backHref}
      className="inline-flex h-9 min-w-0 items-center gap-1 rounded-lg px-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      aria-label="Volver a billeteras"
    >
      <ChevronLeft className="h-5 w-5 shrink-0" aria-hidden />
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
          <MoreHorizontal className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        {canImport ? (
          <>
            <DropdownMenuItem onClick={onRegisterExpense} className="cursor-pointer">
              <Plus className="mr-2 h-4 w-4 shrink-0" />
              Registrar gasto
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onRegisterIncome} className="cursor-pointer">
              <Coins className="mr-2 h-4 w-4 shrink-0" />
              Registrar ingreso
            </DropdownMenuItem>
          </>
        ) : null}
        <DropdownMenuItem onClick={onAdjustBalance} className="cursor-pointer">
          <Pencil className="mr-2 h-4 w-4 shrink-0" />
          Ajustar saldo
        </DropdownMenuItem>
        {canImport ? (
          <DropdownMenuItem onClick={onImport} className="cursor-pointer">
            <Upload className="mr-2 h-4 w-4 shrink-0" />
            Importar CSV
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem onClick={onExportCsv} className="cursor-pointer">
          <Download className="mr-2 h-4 w-4 shrink-0" />
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
      className="relative mx-auto w-full max-w-md lg:max-w-lg"
      role="region"
      aria-label={`Billetera ${wallet.name}`}
    >
      <div
        className={cn(
          'relative aspect-[1.586/1] w-full overflow-hidden rounded-2xl border p-4 text-white shadow-xl ring-1 ring-inset ring-white/10 sm:p-5',
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
                  iconClassName="h-4 w-4"
                />
              ) : (
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/25 bg-white/15">
                  <FallbackIcon className="h-4 w-4" aria-hidden />
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

          <div className="space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-wider opacity-70">
              Saldo disponible
            </p>
            <p
              className={cn(
                'text-3xl font-bold font-mono tabular-nums tracking-tight sm:text-4xl',
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
      className="flex justify-around gap-2 overflow-x-auto px-1 pb-0.5 scrollbar-hide sm:justify-center sm:gap-6"
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
            <Icon className="h-5 w-5 text-foreground dark:text-white" aria-hidden />
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
          <ChevronLeft className="h-4 w-4" />
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
          <ChevronRight className="h-4 w-4" />
        </Button>
        {!isCurrentMonth ? (
          <Button
            variant="outline"
            size="sm"
            className="h-9 shrink-0 rounded-full px-2.5 text-[10px]"
            onClick={onResetToToday}
            aria-label="Volver al mes actual"
          >
            <RotateCcw className="mr-1 h-3 w-3" aria-hidden />
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
