'use client';

import { useMemo, type MouseEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ViewTransition } from 'react';
import {
  ArrowLeftRight,
  BookmarkIcon,
  MoreVertical,
  Pencil,
  SlidersHorizontal,
  Trash2,
} from 'lucide-react';
import {
  type PaymentMethodType,
  PAYMENT_METHOD_LABELS,
  isCreditOrStoreCardWalletType,
} from '@/domain/payment-method';
import {
  getProviderBrandColor,
  getProviderCardStyle,
  getWalletBrandCssVars,
} from '@/lib/provider-card-style';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn, formatCurrency } from '@/lib/utils';
import type { WalletListItem } from '@/types/catalog';
import { WalletProviderIcon } from '@/components/wallets/WalletProviderIcon';
import {
  navigateWithTransitionType,
  stashWalletCardVtSnapshot,
  walletCardViewTransitionName,
} from '@/lib/ui/wallet-card-view-transition';

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
  isHouseContext?: boolean;
  onEdit: (wallet: WalletListItem) => void;
  onTransfer?: (wallet: WalletListItem) => void;
  onDelete: (wallet: WalletListItem) => void;
  onOpenBalance: (wallet: WalletListItem) => void;
};

export const WalletListCard = ({
  wallet,
  ownerQueryString,
  isHouseContext = false,
  onEdit,
  onTransfer,
  onDelete,
  onOpenBalance,
}: WalletListCardProps) => {
  const router = useRouter();
  const isCard = isCreditOrStoreCardWalletType(wallet.type);
  const isFunding = wallet.type === 'CASH' || wallet.type === 'DEBIT_CARD';
  const canTransfer =
    wallet.type === 'CASH' ||
    wallet.type === 'DEBIT_CARD' ||
    wallet.type === 'GOAL';
  const typeLabel = PAYMENT_METHOD_LABELS[wallet.type as PaymentMethodType];

  const brandColor = useMemo(
    () =>
      getProviderBrandColor(wallet.provider_icon_key, wallet.type) ?? '#6366f1',
    [wallet.provider_icon_key, wallet.type],
  );
  const cardStyle = useMemo(
    () => ({
      ...getProviderCardStyle(wallet.provider_icon_key, wallet.type, 'wow'),
      ...getWalletBrandCssVars(brandColor),
    }),
    [wallet.provider_icon_key, wallet.type, brandColor],
  );

  const detailHref = useMemo(
    () =>
      isCard
        ? `/credit-cards/${wallet.id}${ownerQueryString}`
        : `/wallets/${wallet.id}${ownerQueryString}`,
    [isCard, wallet.id, ownerQueryString],
  );

  const viewTransitionName = walletCardViewTransitionName(wallet.id);

  const handleOpenDetail = (event: MouseEvent<HTMLAnchorElement>) => {
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
    stashWalletCardVtSnapshot({
      id: wallet.id,
      name: wallet.name,
      typeLabel,
      amount: Number(wallet.amount),
      isCredit: isCard,
      providerIconKey: wallet.provider_icon_key ?? null,
      style: cardStyle,
    });
    navigateWithTransitionType(detailHref, 'nav-forward', (href) =>
      router.push(href),
    );
  };

  const effectiveLimit = getEffectiveCreditLimit({
    credit_limit: wallet.credit_limit,
    temporary_credit_limit: wallet.temporary_credit_limit,
  });
  const hasCreditLimit = isCard && effectiveLimit != null && effectiveLimit > 0;
  const amountNumber = Number(wallet.amount);
  const usagePercent =
    hasCreditLimit && effectiveLimit != null
      ? Math.min((Math.max(0, amountNumber) / effectiveLimit) * 100, 100)
      : 0;

  const isNegativeBalance = isFunding && amountNumber < 0;
  const isOverLimit =
    hasCreditLimit && effectiveLimit != null && amountNumber > effectiveLimit;
  const hasAlert = isNegativeBalance || isOverLimit;

  const usageLabel = isOverLimit
    ? 'Excedido'
    : `${usagePercent.toFixed(0)}% usado`;

  const compactMetric = useMemo(() => {
    if (isCard) {
      return hasCreditLimit ? usageLabel : 'Sin límite';
    }
    if (isFunding && isHouseContext) {
      return wallet.assignee?.name ?? 'Compartida';
    }
    return null;
  }, [
    isCard,
    hasCreditLimit,
    usageLabel,
    isFunding,
    isHouseContext,
    wallet.assignee?.name,
  ]);

  const availableCredit =
    hasCreditLimit && effectiveLimit != null
      ? effectiveLimit - amountNumber
      : null;
  const underAmountLine = hasCreditLimit
    ? {
        kind: 'disponible' as const,
        amount: Math.max(0, availableCredit ?? 0),
      }
    : isFunding && !wallet.include_in_liquidity
      ? { kind: 'excluded' as const }
      : null;
  const showTemporaryTope =
    isCard &&
    wallet.credit_limit != null &&
    wallet.temporary_credit_limit != null &&
    wallet.temporary_credit_limit > wallet.credit_limit;

  const showBottomBar = hasCreditLimit;

  const articleLabel = hasAlert
    ? `${wallet.name}, ${isOverLimit ? 'límite excedido' : 'saldo negativo'}`
    : !wallet.active
      ? `${wallet.name}, inactiva`
      : wallet.name;

  return (
    <article
      className={cn(
        '@container w-full min-w-0 max-w-full',
        !wallet.active && 'opacity-80',
      )}
      aria-label={articleLabel}
    >
      <ViewTransition
        name={viewTransitionName}
        share="morph"
        default="none"
      >
      <div
        className={cn(
          'relative aspect-[1.586/1] w-full min-w-0 overflow-hidden rounded-[1.375rem] border border-white/15 text-white',
          'shadow-[0_12px_32px_-14px_rgba(0,0,0,0.62),0_4px_12px_-6px_rgba(0,0,0,0.4)]',
          'transition-transform duration-200 ease-out motion-reduce:transition-none',
          'active:scale-[0.985] md:hover:-translate-y-1',
          hasAlert && 'ring-2 ring-inset ring-rose-400/70',
        )}
        style={cardStyle}
        data-wallet-vt={viewTransitionName}
      >
        <Link
          href={detailHref}
          onClick={handleOpenDetail}
          className="absolute inset-0 z-0 rounded-[1.375rem] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
          aria-label={`Abrir ${wallet.name}`}
        />

        <div className="pointer-events-none relative z-10 flex h-full flex-col p-4 sm:p-5">
          <div className="flex min-w-0 items-start gap-3">
            <WalletProviderIcon
              providerIconKey={wallet.provider_icon_key}
              className="h-10 w-10 shrink-0 rounded-[0.7rem] border-white/25 bg-white/37 shadow-none ring-0"
              iconClassName="h-5 w-5"
              showTooltipLabel={false}
            />
            <div className="min-w-0 flex-1 pr-8">
              <h3 className="truncate text-[15px] font-semibold leading-tight tracking-tight text-white">
                {wallet.name}
              </h3>
              <p className="mt-0.5 truncate text-[12px] text-white/70">
                {typeLabel}
              </p>
            </div>
            {!wallet.active ? (
              <Badge
                variant="outline"
                className="pointer-events-none h-6 shrink-0 gap-0.5 border-white/30 bg-black/20 px-1.5 text-[10px] text-white"
              >
                <BookmarkIcon className="h-2.5 w-2.5" aria-hidden />
                Inactivo
              </Badge>
            ) : null}
          </div>

          <div className="mt-2.5 grid min-w-0 grid-cols-[minmax(0,1.1fr)_minmax(5.5rem,38%)] items-start gap-3">
            <div className="min-w-0">
              <p
                className={cn(
                  'truncate font-mono text-[1.65rem] font-semibold leading-none tabular-nums tracking-tight sm:text-3xl',
                  hasAlert ? 'text-rose-200' : 'text-white',
                )}
              >
                {formatCurrency(amountNumber)}
              </p>
              <p className="mt-1 text-[11px] text-white/55">
                {isCard ? 'Deuda' : 'Saldo'}
              </p>
              {underAmountLine?.kind === 'disponible' ? (
                <p className="mt-0.5 truncate text-[11px] text-white/55">
                  Disponible{' '}
                  <span
                    className={cn(
                      'font-mono font-medium tabular-nums',
                      isOverLimit ? 'text-rose-200' : 'text-white/80',
                    )}
                  >
                    {formatCurrency(underAmountLine.amount)}
                  </span>
                </p>
              ) : underAmountLine?.kind === 'excluded' ? (
                <p className="mt-0.5 truncate text-[11px] text-white/55">
                  Fuera de la liquidez
                </p>
              ) : null}
            </div>

            <div className="flex min-w-0 flex-col items-end pt-1 text-right">
              {compactMetric ? (
                <p
                  className={cn(
                    'max-w-full truncate text-[13px] font-medium leading-tight tabular-nums',
                    isOverLimit
                      ? 'text-rose-200'
                      : compactMetric === 'Sin límite'
                        ? 'text-white/55'
                        : 'text-white/80',
                  )}
                >
                  {compactMetric}
                </p>
              ) : null}
            </div>
          </div>

          <div className="mt-auto" />
        </div>

        {showTemporaryTope ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-3 z-10 flex justify-start px-4 sm:px-5">
            <span className="rounded-full border border-white/25 bg-black/25 px-2 py-0.5 text-[10px] font-medium tracking-wide text-white/90">
              Tope temporal
            </span>
          </div>
        ) : null}

        {showBottomBar ? (
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-1.5 w-full overflow-hidden bg-white/20"
            role="meter"
            aria-label="Porcentaje de línea usado"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(usagePercent)}
          >
            <div
              className={cn(
                'h-full',
                isOverLimit ? 'bg-rose-300' : 'bg-white/85',
              )}
              style={{ width: `${usagePercent}%` }}
            />
          </div>
        ) : null}

        <div className="absolute top-2.5 right-2.5 z-20">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="size-8 rounded-full text-white hover:bg-white/15 hover:text-white focus-visible:ring-white/70"
                aria-label={`Más opciones para ${wallet.name}`}
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem
                onClick={() => onOpenBalance(wallet)}
                className="cursor-pointer"
              >
                <SlidersHorizontal className="mr-2 h-4 w-4" />
                Editar saldo
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onEdit(wallet)}
                className="cursor-pointer"
              >
                <Pencil className="mr-2 h-4 w-4" />
                Editar
              </DropdownMenuItem>
              {canTransfer && onTransfer ? (
                <DropdownMenuItem
                  onClick={() => onTransfer(wallet)}
                  className="cursor-pointer"
                >
                  <ArrowLeftRight className="mr-2 h-4 w-4" />
                  Transferir saldo
                </DropdownMenuItem>
              ) : null}
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
      </div>
      </ViewTransition>
    </article>
  );
};
