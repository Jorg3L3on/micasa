'use client';

import { useMemo, type ReactNode } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  Landmark,
  Scale,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { MetricCard } from '@/components/arc/metric-card/metric-card';
import { SegmentedControl, type SegmentedOption } from '@/components/segmented-control';
import { DETAIL_TAB_BAR_PROPS } from '@/components/credit-cards/credit-card-segmented-tabs';
import { MONTHLY_PANEL_SHELL_CLASS } from '@/components/monthly/monthly-panel-shell';
import { PAYMENT_METHOD_LABELS } from '@/domain/payment-method';
import type { PaymentMethodType } from '@/domain/payment-method';
import { getProviderCardStyle } from '@/lib/provider-card-style';
import { STATUS_SOFT_CLASS, type StatusTone } from '@/lib/status-tone';
import { cn, formatCurrency } from '@/lib/utils';
import { DetailPeriodNav } from '@/components/wallets/DetailPeriodNav';
import { WalletFaceArt } from '@/components/wallets/WalletFaceArt';
import { WalletProviderIcon } from '@/components/wallets/WalletProviderIcon';
import type { WalletDetail } from '@/types/wallet-movements';

export const WalletHeroZone = ({ children }: { children: ReactNode }) => (
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

export const WalletDetailTabsList = ({
  options,
}: {
  options: readonly SegmentedOption[];
}) => (
  <SegmentedControl
    {...DETAIL_TAB_BAR_PROPS}
    ariaLabel="Secciones de la billetera"
    options={options}
  />
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

  // Match credit/store detail hero footprint. Content stays spread (header top,
  // saldo bottom); list→detail morph widens into this shell. The face is a flex
  // column because Safari ignores padding for h-full inside an aspect-ratio box.
  return (
    <div
      className="relative mx-auto w-full max-w-md lg:max-w-lg"
      role="region"
      aria-label={`Billetera ${wallet.name}`}
    >
      <div
        className={cn(
          'relative flex w-full flex-col overflow-hidden rounded-face border aspect-[1.586] [container-type:inline-size] p-4 text-white shadow-xl ring-1 ring-inset ring-white/10 sm:p-5',
          !cardStyle &&
            (isCash
              ? 'border-status-income-border bg-linear-to-br from-status-income to-background'
              : 'border-status-info-border bg-linear-to-br from-status-info to-background'),
          isNegative && 'ring-status-expense/55',
        )}
        style={cardStyle}
      >
        <WalletFaceArt />
        {isNegative ? (
          <span className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-linear-to-r from-transparent via-status-expense/80 to-transparent" />
        ) : null}

        <div className="relative flex min-h-0 flex-1 flex-col justify-between gap-2">
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
                <p
                  className="truncate text-sm font-semibold leading-tight opacity-95"
                  title={wallet.name}
                >
                  {wallet.name}
                </p>
                <p className="eyebrow opacity-60">
                  {typeLabel}
                </p>
              </div>
            </div>
            {!wallet.active ? (
              <span className="rounded-full border border-white/20 bg-white/10 px-2 py-0.5 eyebrow opacity-80">
                Inactiva
              </span>
            ) : null}
          </div>

          <div className="min-w-0 space-y-1">
            <p className="eyebrow opacity-70">
              Saldo disponible
            </p>
            <p className="break-words text-[clamp(1.5rem,9cqw,2.25rem)] font-bold font-sans tabular-nums leading-snug tracking-tight">
              {formatCurrency(wallet.amount)}
            </p>
            {isNegative ? (
              <p className="text-xs font-medium text-white/85">
                Saldo en rojo — revisa movimientos del periodo
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};

/** Below this, the balance icon warns. */
const LOW_RUNWAY_DAYS = 7;

type PeriodMetric = {
  key: string;
  label: string;
  amount: number;
  context: string;
  icon: LucideIcon;
  tone: StatusTone;
};

const WalletPeriodMetrics = ({ metrics }: { metrics: PeriodMetric[] }) => (
  <div
    className="grid grid-cols-2 gap-2 lg:grid-cols-4"
    role="group"
    aria-label="Totales del periodo"
  >
    {metrics.map(({ key, label, amount, context, icon: Icon, tone }) => (
      <MetricCard
        key={key}
        label={label}
        value={Math.abs(amount)}
        prefix={amount < 0 ? '-$' : '$'}
        decimals={2}
        context={context}
        icon={
          <div
            className={cn(
              'flex size-7 items-center justify-center rounded-lg',
              STATUS_SOFT_CLASS[tone],
            )}
          >
            <Icon className="size-4" />
          </div>
        }
      />
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
  const runwayLabel =
    runwayDays == null
      ? null
      : runwayDays === 1
        ? 'Cubre 1 día'
        : `Cubre ${runwayDays} días`;

  const metrics: PeriodMetric[] = [
    {
      key: 'balance',
      label: 'Saldo actual',
      amount: currentBalance,
      context: runwayLabel ?? 'Al día de hoy',
      icon: Wallet,
      tone:
        currentBalance < 0
          ? 'expense'
          : runwayDays != null && runwayDays < LOW_RUNWAY_DAYS
            ? 'pending'
            : 'info',
    },
    {
      key: 'inflow',
      label: 'Ingresos',
      amount: inflow,
      context: rangeLabel,
      icon: ArrowDownLeft,
      tone: 'income',
    },
    {
      key: 'outflow',
      label: 'Egresos',
      amount: outflow,
      context:
        averageDailyOutflow > 0
          ? `${formatCurrency(averageDailyOutflow)} al día`
          : rangeLabel,
      icon: ArrowUpRight,
      tone: 'expense',
    },
    {
      key: 'net',
      label: 'Neto',
      amount: net,
      context:
        movementCount === 0
          ? 'Sin movimientos'
          : movementCount === 1
            ? '1 movimiento'
            : `${movementCount} movimientos`,
      icon: Scale,
      tone: net < 0 ? 'expense' : 'info',
    },
  ];

  return (
    <div className="space-y-4" role="region" aria-label="Periodo y totales">
      <DetailPeriodNav
        eyebrow={isCurrentMonth ? 'Mes actual' : 'Periodo'}
        label={rangeLabel}
        previousLabel="Mes anterior"
        nextLabel="Mes siguiente"
        resetLabel="Volver al mes actual"
        canGoNext={!isCurrentMonth}
        showReset={!isCurrentMonth}
        onPrevious={onPrevious}
        onNext={onNext}
        onReset={onResetToToday}
      />
      <WalletPeriodMetrics metrics={metrics} />
    </div>
  );
};
