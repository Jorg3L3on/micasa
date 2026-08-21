'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from 'react';
import {
  ArrowLeftRight,
  Banknote,
  ChevronLeft,
  ChevronRight,
  Diff,
  Download,
  Landmark,
  MoreHorizontal,
  Pencil,
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
import { navigateWithTransitionType } from '@/lib/ui/wallet-card-view-transition';
import { cn, formatCurrency } from '@/lib/utils';
import { WalletProviderIcon } from '@/components/wallets/WalletProviderIcon';
import { useIsMobile } from '@/hooks/use-mobile';
import type { WalletDetail } from '@/types/wallet-movements';

/** Panel motion — matches DESIGN.md `--motion-panel` / `--ease-out-soft`. */
const DOCK_MOTION =
  'duration-[320ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none';

const DOCK_GLASS_CLASS = cn(
  'border border-border/60 bg-card/75 shadow-[var(--shadow-card)] backdrop-blur-xl',
  'dark:border-white/[0.12] dark:bg-[#0d1327]/55',
  'dark:shadow-[0_16px_48px_-24px_rgba(58,55,252,0.45)]',
);

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

type HeaderActionsProps = {
  backHref: string;
};

export const WalletDetailHeaderActions = ({ backHref }: HeaderActionsProps) => {
  const router = useRouter();

  const handleBack = (event: MouseEvent<HTMLAnchorElement>) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }
    event.preventDefault();
    navigateWithTransitionType(backHref, 'nav-back', (href) =>
      router.push(href),
    );
  };

  return (
    <div className="flex items-center gap-2">
      <Link
        href={backHref}
        onClick={handleBack}
        className="inline-flex h-9 min-w-0 items-center gap-1 rounded-lg px-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        aria-label="Volver a billeteras"
      >
        <ChevronLeft
          className="h-5 w-5 shrink-0"
          aria-hidden
          data-icon="inline-start"
        />
        <span className="truncate sm:inline">Billeteras</span>
      </Link>
    </div>
  );
};

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

  // Funding wallets only (CASH / DEBIT_CARD) land here — credit types open
  // /credit-cards/[id], whose hero keeps the amount above límite + utilization
  // chrome so it never sits flush against overflow-hidden.
  return (
    <div
      className="relative mx-auto w-full max-w-sm"
      role="region"
      aria-label={`Billetera ${wallet.name}`}
    >
      <div
        className={cn(
          // Grow with content (no fixed aspect-ratio): iOS Safari clips large
          // mono balances when the amount is the last row inside overflow-hidden.
          'relative w-full overflow-hidden rounded-2xl border p-4 pb-5 text-white shadow-xl ring-1 ring-inset ring-white/10 sm:p-5 sm:pb-6',
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

        <div className="relative flex min-h-[10.75rem] flex-col justify-between gap-6 sm:min-h-[12rem]">
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

type QuickActionsProps = {
  canImport: boolean;
  canTransfer?: boolean;
  onAddTransaction: () => void;
  onEditWallet: () => void;
  onImport: () => void;
  onAdjustBalance: () => void;
  onExportCsv: () => void;
  onTransfer?: () => void;
};

type DockAction = {
  key: string;
  label: string;
  ariaLabel: string;
  icon: typeof ArrowLeftRight;
  onClick: () => void;
};

type MasMenuItem = {
  key: string;
  label: string;
  icon: typeof Pencil;
  onClick: () => void;
};

export const WalletQuickActions = ({
  canImport,
  canTransfer = false,
  onAddTransaction,
  onEditWallet,
  onImport,
  onAdjustBalance,
  onExportCsv,
  onTransfer,
}: QuickActionsProps) => {
  const isMobile = useIsMobile();
  const [compact, setCompact] = useState(false);
  const lastScrollYRef = useRef(0);
  const compactRef = useRef(false);

  useEffect(() => {
    if (!isMobile) {
      compactRef.current = false;
      return;
    }

    lastScrollYRef.current = window.scrollY;

    const onScroll = () => {
      const y = Math.max(0, window.scrollY);
      const prev = lastScrollYRef.current;
      const delta = y - prev;
      lastScrollYRef.current = y;

      if (delta > 8 && y > 56 && !compactRef.current) {
        compactRef.current = true;
        setCompact(true);
      } else if ((delta < -8 || y < 24) && compactRef.current) {
        compactRef.current = false;
        setCompact(false);
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [isMobile]);

  const showTransfer = Boolean(canTransfer && onTransfer);
  const showRegistrar = canImport;

  const masItems: MasMenuItem[] = [
    ...(canImport
      ? [
          {
            key: 'import',
            label: 'Importar CSV',
            icon: Upload,
            onClick: onImport,
          } satisfies MasMenuItem,
        ]
      : []),
    {
      key: 'export',
      label: 'Exportar CSV',
      icon: Download,
      onClick: onExportCsv,
    },
  ];

  const actions: DockAction[] = [
    ...(showRegistrar
      ? [
          {
            key: 'registrar',
            label: 'Registrar',
            ariaLabel: 'Registrar transacción',
            icon: Diff,
            onClick: onAddTransaction,
          } satisfies DockAction,
        ]
      : []),
    ...(showTransfer
      ? [
          {
            key: 'transfer',
            label: 'Transferir',
            ariaLabel: 'Transferir saldo',
            icon: ArrowLeftRight,
            onClick: onTransfer!,
          } satisfies DockAction,
        ]
      : []),
    {
      key: 'adjust',
      label: 'Ajustar',
      ariaLabel: 'Ajustar saldo',
      icon: SlidersHorizontal,
      onClick: onAdjustBalance,
    },
    {
      key: 'edit',
      label: 'Editar',
      ariaLabel: 'Editar billetera',
      icon: Pencil,
      onClick: onEditWallet,
    },
    {
      key: 'more',
      label: 'Más',
      ariaLabel: 'Más acciones',
      icon: MoreHorizontal,
      onClick: () => {},
    },
  ];

  const itemCount = actions.length;
  const hideLabel = isMobile && compact;

  const renderActionContent = (action: DockAction) => {
    const Icon = action.icon;
    return (
      <>
        <Icon
          className={cn(
            'shrink-0 transition-transform',
            DOCK_MOTION,
            hideLabel ? 'h-5 w-5 scale-95' : 'h-5 w-5 scale-100 sm:h-6 sm:w-6',
          )}
          aria-hidden
          data-icon="inline-start"
        />
        <span
          className={cn(
            'max-w-full overflow-hidden whitespace-nowrap px-0.5 text-[10px] font-medium leading-tight sm:text-[11px]',
            'transition-[opacity,max-height,margin,transform]',
            DOCK_MOTION,
            hideLabel
              ? 'pointer-events-none mt-0 max-h-0 translate-y-1 opacity-0'
              : 'mt-0.5 max-h-4 translate-y-0 opacity-100',
          )}
          aria-hidden={hideLabel}
        >
          {action.label}
        </span>
      </>
    );
  };

  const dockItemClass = cn(
    'flex min-w-0 flex-1 flex-col items-center justify-center rounded-full text-foreground/90',
    'transition-[height,min-height,padding,gap,background-color,transform]',
    DOCK_MOTION,
    'hover:bg-foreground/5 active:scale-[0.97] active:bg-foreground/10',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
    'dark:hover:bg-white/10 dark:active:bg-white/15',
    'motion-reduce:active:scale-100',
    hideLabel
      ? 'h-11 min-h-11 min-w-11 gap-0 px-1.5 py-0'
      : 'min-h-14 gap-0 px-1.5 pb-1 pt-1.5 sm:min-h-16 sm:px-2',
  );

  const dock = (
    <div
      role="toolbar"
      aria-label="Acciones rápidas"
      data-compact={hideLabel ? 'true' : 'false'}
      className={cn(
        DOCK_GLASS_CLASS,
        'flex origin-bottom items-stretch justify-evenly rounded-full',
        'transition-[transform,padding,gap,box-shadow]',
        DOCK_MOTION,
        isMobile
          ? cn(
              'w-[85vw] max-w-[calc(100vw-1.5rem)]',
              hideLabel
                ? 'scale-[0.88] gap-0 px-1.5 py-1 shadow-[0_6px_24px_-14px_rgba(0,0,0,0.4)]'
                : 'scale-100 gap-0.5 px-2 pb-1 pt-1',
              itemCount <= 3 && 'w-[min(85vw,20rem)]',
            )
          : 'w-full max-w-none scale-100 gap-0.5 px-2 pb-1 pt-1',
      )}
    >
      {actions.map((action) => {
        if (action.key === 'more') {
          return (
            <DropdownMenu key={action.key}>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className={dockItemClass}
                  aria-label={action.ariaLabel}
                >
                  {renderActionContent(action)}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="center"
                side="top"
                className="min-w-[12rem]"
              >
                {masItems.map((item) => {
                  const ItemIcon = item.icon;
                  return (
                    <DropdownMenuItem
                      key={item.key}
                      onSelect={item.onClick}
                      className="cursor-pointer"
                    >
                      <ItemIcon
                        className="mr-2 h-4 w-4 shrink-0"
                        data-icon="inline-start"
                      />
                      {item.label}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          );
        }

        return (
          <button
            key={action.key}
            type="button"
            onClick={action.onClick}
            className={dockItemClass}
            aria-label={action.ariaLabel}
          >
            {renderActionContent(action)}
          </button>
        );
      })}
    </div>
  );

  if (isMobile) {
    return (
      <div
        className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
        role="presentation"
      >
        <div className="pointer-events-auto">{dock}</div>
      </div>
    );
  }

  return dock;
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
