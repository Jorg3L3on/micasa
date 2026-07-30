'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import {
  BookmarkIcon,
  MoreVertical,
  Pencil,
  Trash2,
} from 'lucide-react';
import {
  type PaymentMethodType,
  PAYMENT_METHOD_LABELS,
  isCreditOrStoreCardWalletType,
} from '@/domain/payment-method';
import type { WalletBalanceMetrics } from '@/lib/finance/wallet-balance-evolution';
import {
  getProviderBrandColor,
  getProviderCardStyle,
  getWalletBrandCssVars,
  WALLET_BRAND_HIT_BUTTON_CLASS,
} from '@/lib/provider-card-style';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn, formatCurrency } from '@/lib/utils';
import type { WalletListItem } from '@/types/catalog';
import { WalletProviderIcon } from '@/components/wallets/WalletProviderIcon';
import { WalletAmountTrendIndicator } from '@/components/wallets/WalletAmountTrendIndicator';
import { WalletPaymentMethodTypeIcon } from '@/components/wallets/WalletPaymentMethodTypeIcon';
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
} from 'recharts';

const getEffectiveCreditLimit = ({
  credit_limit,
  temporary_credit_limit,
}: {
  credit_limit: number | null | undefined;
  temporary_credit_limit: number | null | undefined;
}): number | null => {
  if (credit_limit == null && temporary_credit_limit == null) return null;
  if (credit_limit == null) return temporary_credit_limit ?? null;
  if (temporary_credit_limit == null) return credit_limit ?? null;
  return Math.max(credit_limit, temporary_credit_limit);
};

type WalletListCardProps = {
  wallet: WalletListItem;
  ownerQueryString: string;
  metrics?: WalletBalanceMetrics | null;
  metricsLoading?: boolean;
  onEdit: (wallet: WalletListItem) => void;
  onDelete: (wallet: WalletListItem) => void;
  onOpenBalance: (wallet: WalletListItem) => void;
};

export const WalletListCard = ({
  wallet,
  ownerQueryString,
  metrics,
  metricsLoading = false,
  onEdit,
  onDelete,
  onOpenBalance,
}: WalletListCardProps) => {
  const isCard = isCreditOrStoreCardWalletType(wallet.type);
  const isFunding = wallet.type === 'CASH' || wallet.type === 'DEBIT_CARD';
  const typeLabel = PAYMENT_METHOD_LABELS[wallet.type as PaymentMethodType];

  const providerCardStyle = useMemo(
    () => getProviderCardStyle(wallet.provider_icon_key, wallet.type, 'list'),
    [wallet.provider_icon_key, wallet.type],
  );
  const hasBrandTint = Boolean(providerCardStyle);
  const brandColor = useMemo(
    () =>
      getProviderBrandColor(wallet.provider_icon_key, wallet.type) ?? '#6366f1',
    [wallet.provider_icon_key, wallet.type],
  );
  const brandCssVars = useMemo(
    () => getWalletBrandCssVars(brandColor),
    [brandColor],
  );
  const cardStyle = useMemo(
    () => ({ ...providerCardStyle, ...brandCssVars }),
    [providerCardStyle, brandCssVars],
  );

  const fallbackAccent = isCard
    ? 'neutral'
    : wallet.type === 'DEBIT_CARD'
      ? 'blue'
      : wallet.type === 'CASH'
        ? 'emerald'
        : 'neutral';

  const fallbackShellClass = cn(
    'border bg-card',
    fallbackAccent === 'blue' &&
      'border-blue-500/35 dark:border-blue-500/40',
    fallbackAccent === 'emerald' &&
      'border-emerald-500/35 dark:border-emerald-500/40',
    fallbackAccent === 'neutral' && 'border-border/60',
  );

  const detailHref = useMemo(
    () =>
      isCard
        ? `/credit-cards/${wallet.id}${ownerQueryString}`
        : `/wallets/${wallet.id}${ownerQueryString}`,
    [isCard, wallet.id, ownerQueryString],
  );

  const effectiveLimit =
    getEffectiveCreditLimit({
      credit_limit: wallet.credit_limit,
      temporary_credit_limit: wallet.temporary_credit_limit,
    }) ?? 0;
  const amountNumber = Number(wallet.amount);
  const usagePercent =
    isCard && effectiveLimit > 0
      ? Math.min((Math.max(0, amountNumber) / effectiveLimit) * 100, 100)
      : 0;

  const isNegativeBalance = isFunding && amountNumber < 0;
  const isOverLimit = isCard && effectiveLimit > 0 && amountNumber > effectiveLimit;
  const hasAlert = isNegativeBalance || isOverLimit;

  const displayBalance = metrics?.current_balance ?? amountNumber;
  const previousBalance = metrics?.previous_balance ?? displayBalance;
  const diff = metrics?.diff ?? 0;
  const trendIsPositive = isCard ? diff <= 0 : diff >= 0;

  const sparklineData = metrics?.history ?? [];

  const subtitleParts = useMemo(() => {
    const parts: string[] = [typeLabel];
    if (isCard) {
      if (effectiveLimit > 0) {
        parts.push(`Línea ${formatCurrency(effectiveLimit)}`);
        parts.push(
          isOverLimit ? 'Excedido' : `${usagePercent.toFixed(0)}% usado`,
        );
      } else {
        parts.push('Sin línea');
      }
      if (wallet.due_day != null) {
        parts.push(`Paga ${wallet.due_day}`);
      }
    } else {
      parts.push(wallet.assignee?.name ?? 'Sin titular');
    }
    return parts;
  }, [
    typeLabel,
    isCard,
    effectiveLimit,
    usagePercent,
    isOverLimit,
    wallet.due_day,
    wallet.assignee?.name,
  ]);

  const articleLabel = hasAlert
    ? `${wallet.name}, ${isOverLimit ? 'límite excedido' : 'saldo negativo'}`
    : !wallet.active
      ? `${wallet.name}, inactiva`
      : wallet.name;

  return (
    <article
      className={cn('h-full w-full', !wallet.active && 'opacity-80')}
      aria-label={articleLabel}
    >
      <Card
        className={cn(
          'h-full w-full overflow-hidden border bg-card py-0 shadow-sm transition-shadow duration-200 hover:shadow-md motion-reduce:transition-none',
          !hasBrandTint && fallbackShellClass,
          hasAlert && 'border-rose-500/50 ring-1 ring-inset ring-rose-500/25',
        )}
        style={cardStyle}
      >
        <CardContent className="flex h-full flex-col gap-4 p-4">
          <div className="flex max-w-full flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex items-start gap-2">
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <WalletProviderIcon
                      providerIconKey={wallet.provider_icon_key}
                      className="h-8 w-8 shrink-0 rounded-lg border border-border/60 bg-card shadow-sm ring-1 ring-border/60"
                      iconClassName="h-4 w-4"
                      showTooltipLabel={false}
                    />
                    <div className="min-w-0">
                      <h3
                        className={cn(
                          'truncate text-sm font-semibold leading-tight text-foreground',
                          !wallet.active && 'text-muted-foreground',
                        )}
                      >
                        {wallet.name}
                      </h3>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {subtitleParts.join(' · ')}
                      </p>
                    </div>
                  </div>
                  {!wallet.active ? (
                    <Badge
                      variant="outline"
                      className="h-6 shrink-0 gap-0.5 px-1.5 text-[10px]"
                    >
                      <BookmarkIcon className="h-2.5 w-2.5" aria-hidden />
                      Inactivo
                    </Badge>
                  ) : null}
                </div>
              </div>

              <div className="flex shrink-0 flex-col items-start sm:items-end">
                <div className="-ml-2 rounded-md px-2 py-1 text-left sm:-mr-2 sm:ml-0">
                  <p
                    className={cn(
                      'font-mono text-2xl font-semibold tabular-nums tracking-tight',
                      hasAlert ? 'text-destructive' : 'text-foreground',
                    )}
                  >
                    {formatCurrency(displayBalance)}
                  </p>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {isCard ? 'Deuda' : 'Saldo'}
                  </p>
                </div>
                {metricsLoading ? (
                  <div className="mt-1 h-5 w-36 animate-pulse rounded bg-muted/70" />
                ) : metrics ? (
                  <WalletAmountTrendIndicator
                    diff={diff}
                    isPositive={trendIsPositive}
                    previousAmount={previousBalance}
                    currentAmount={displayBalance}
                    className="mt-1"
                  />
                ) : null}
              </div>
            </div>

            <div
              className="h-[100px] w-full md:h-16"
              aria-hidden={sparklineData.length === 0 && !metricsLoading}
            >
              {metricsLoading ? (
                <div className="h-full w-full animate-pulse rounded-lg bg-muted/50" />
              ) : sparklineData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={sparklineData}>
                    <RechartsTooltip
                      cursor={{ stroke: 'hsl(var(--border))', strokeWidth: 1 }}
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const point = payload[0].payload as {
                          date: string;
                          value: number;
                        };
                        return (
                          <div className="rounded-lg border border-border/50 bg-background px-3 py-2 text-sm shadow-xl">
                            <p className="mb-1 text-muted-foreground">{point.date}</p>
                            <p className="font-mono font-medium tabular-nums text-foreground">
                              {formatCurrency(point.value)}
                            </p>
                          </div>
                        );
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke={brandColor}
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-border/60 bg-muted/20 text-xs text-muted-foreground">
                  Sin historial de movimientos
                </div>
              )}
            </div>

            <div className="mt-auto flex items-center gap-2">
              <WalletPaymentMethodTypeIcon type={wallet.type} />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className={cn('h-8', WALLET_BRAND_HIT_BUTTON_CLASS)}
                onClick={() => onOpenBalance(wallet)}
              >
                Editar saldo
              </Button>
              <Link href={detailHref} className="ml-auto">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className={cn('h-8', WALLET_BRAND_HIT_BUTTON_CLASS)}
                >
                  Detalles →
                </Button>
              </Link>
              <DropdownMenu>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className={cn('shrink-0', WALLET_BRAND_HIT_BUTTON_CLASS)}
                        aria-label={`Más opciones para ${wallet.name}`}
                      >
                        <MoreVertical className="h-3.5 w-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={4}>
                    Más opciones
                  </TooltipContent>
                </Tooltip>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuItem
                    onClick={() => onEdit(wallet)}
                    className="cursor-pointer"
                  >
                    <Pencil className="mr-2 h-4 w-4" />
                    Editar
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => onDelete(wallet)}
                    className="cursor-pointer text-destructive focus:text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Eliminar
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
        </CardContent>
      </Card>
    </article>
  );
};
