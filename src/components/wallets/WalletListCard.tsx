'use client';

import { useMemo, type KeyboardEvent, type MouseEvent } from 'react';
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
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SwipeDeleteRow } from '@/components/ui/swipe-delete-row';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useFinanceContext } from '@/context/finance-context';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn, formatCurrency } from '@/lib/utils';
import type { WalletListItem } from '@/types/catalog';
import { useWalletDeckCard } from '@/components/wallets/WalletCardsList';
import { WalletProviderIcon } from '@/components/wallets/WalletProviderIcon';
import {
  WALLET_DECK_ALERT_RING_CLASS,
  WALLET_DECK_AMOUNT_TEXT_CLASS,
  WALLET_DECK_COLLAPSED_PADDING_CLASS,
  WALLET_DECK_EXCEEDED_TEXT_CLASS,
} from '@/lib/ui/wallet-deck';
import {
  navigateWithTransitionType,
  stashWalletCardVtSnapshot,
  walletCardViewTransitionName,
  WALLET_LIST_CARD_SHELL_CLASS,
} from '@/lib/ui/wallet-card-view-transition';
import { prefetchWalletDetailApis } from '@/lib/ui/wallet-detail-prefetch';

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
  const isMobile = useIsMobile();
  const deck = useWalletDeckCard(wallet.id);
  const { context } = useFinanceContext();
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

  const effectiveLimit = getEffectiveCreditLimit({
    credit_limit: wallet.credit_limit,
    temporary_credit_limit: wallet.temporary_credit_limit,
  });
  const hasCreditLimit = isCard && effectiveLimit != null && effectiveLimit > 0;
  const amountNumber = Number(wallet.amount);
  const availableCredit =
    hasCreditLimit && effectiveLimit != null
      ? effectiveLimit - amountNumber
      : null;
  const usagePercent =
    hasCreditLimit && effectiveLimit != null
      ? Math.min(
          100,
          Math.max(
            0,
            Math.round((Math.max(0, amountNumber) / effectiveLimit) * 100),
          ),
        )
      : null;

  const cycleLabel =
    isCard && wallet.cutoff_day != null && wallet.due_day != null
      ? `Corte ${wallet.cutoff_day} · Pago ${wallet.due_day}`
      : null;

  const handlePrefetchDetail = () => {
    router.prefetch(detailHref);
    prefetchWalletDetailApis(wallet.id, isCard, context);
  };

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
      amount: amountNumber,
      isCredit: isCard,
      providerIconKey: wallet.provider_icon_key ?? null,
      cycleLabel,
      availableCredit,
      creditLimit: hasCreditLimit ? effectiveLimit : null,
      utilizationPct: usagePercent,
      style: cardStyle,
    });
    // Kick APIs immediately on tap (hover may not fire on mobile).
    prefetchWalletDetailApis(wallet.id, isCard, context);
    navigateWithTransitionType(detailHref, 'nav-forward', (href) =>
      router.push(href),
    );
  };

  const handleRequestDelete = () => onDelete(wallet);

  const isNegativeBalance = isFunding && amountNumber < 0;
  const isOverLimit =
    hasCreditLimit && effectiveLimit != null && amountNumber > effectiveLimit;
  const hasAlert = isNegativeBalance || isOverLimit;

  const assigneeMetric =
    isFunding && isHouseContext
      ? (wallet.assignee?.name ?? 'Compartida')
      : null;

  const showTemporaryTope =
    isCard &&
    wallet.credit_limit != null &&
    wallet.temporary_credit_limit != null &&
    wallet.temporary_credit_limit > wallet.credit_limit;

  const articleLabel = hasAlert
    ? `${wallet.name}, ${isOverLimit ? 'límite excedido' : 'saldo negativo'}`
    : !wallet.active
      ? `${wallet.name}, inactiva`
      : wallet.name;

  const actionMenuItems = (
    <>
      {canTransfer && onTransfer ? (
        <DropdownMenuItem
          onClick={() => onTransfer(wallet)}
          className="cursor-pointer"
        >
          <ArrowLeftRight className="mr-2 h-4 w-4" />
          Transferir saldo
        </DropdownMenuItem>
      ) : null}
      <DropdownMenuItem
        onClick={() => onOpenBalance(wallet)}
        className="cursor-pointer"
      >
        <SlidersHorizontal className="mr-2 h-4 w-4" />
        Ajustar saldo
      </DropdownMenuItem>
      <DropdownMenuItem
        onClick={() => onEdit(wallet)}
        className="cursor-pointer"
      >
        <Pencil className="mr-2 h-4 w-4" />
        Editar
      </DropdownMenuItem>
    </>
  );

  const handleDeckKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    deck.onKeyboardToggle();
  };

  const amountLabel = isCard ? 'Deuda total' : 'Saldo disponible';

  return (
    <article
      className={cn(
        '@container w-full min-w-0 max-w-full',
        !wallet.active && 'opacity-80',
      )}
      aria-label={articleLabel}
    >
      <div
        className="md:hidden"
        onFocusCapture={() => deck.onFocus()}
      >
        <SwipeDeleteRow
          enabled={isMobile}
          onRequestDelete={handleRequestDelete}
          deleteAriaLabel={`Eliminar ${wallet.name}`}
          className="rounded-face"
          railClassName="items-start"
          actionClassName="h-28"
        >
          <div
            className={cn(
              'relative w-full min-w-0 overflow-hidden rounded-face border border-white/15 text-white',
              'shadow-face',
              'transition-[box-shadow,filter] duration-200 ease-out motion-reduce:transition-none',
              deck.expanded ? 'p-4 pb-5' : WALLET_DECK_COLLAPSED_PADDING_CLASS,
              hasAlert && WALLET_DECK_ALERT_RING_CLASS,
            )}
            style={cardStyle}
          >
            {deck.collapsible ? (
              <button
                type="button"
                className="peer absolute inset-0 z-0 rounded-face focus-visible:outline-none"
                aria-expanded={deck.expanded}
              aria-label={
                deck.expanded
                  ? `Contraer ${wallet.name}`
                  : `Expandir ${wallet.name}. ${amountLabel} ${formatCurrency(amountNumber)}`
              }
                onPointerDown={() => deck.onPointerDown()}
                onClick={(event) => {
                  if (event.detail === 0) return;
                  deck.onPointerToggle();
                }}
                onKeyDown={handleDeckKeyDown}
              />
            ) : (
              <Link
                href={detailHref}
                onClick={handleOpenDetail}
                onPointerEnter={handlePrefetchDetail}
                onFocus={handlePrefetchDetail}
                className="peer absolute inset-0 z-0 rounded-face focus-visible:outline-none"
                aria-label={`Abrir ${wallet.name}`}
              />
            )}
            <div className="pointer-events-none relative z-10">
              <div data-wallet-deck-strip>
                <div className="flex items-start justify-between gap-2 pr-8">
                  <div className="flex min-w-0 items-center gap-2">
                    <WalletProviderIcon
                      providerIconKey={wallet.provider_icon_key}
                      className="h-8 w-8 shrink-0 rounded-lg border border-white/25 bg-white/15 shadow-sm ring-1 ring-white/10"
                      iconClassName="h-4 w-4"
                      showTooltipLabel={false}
                    />
                    <div className="min-w-0">
                      {deck.collapsible && deck.expanded ? (
                        <Link
                          href={detailHref}
                          onClick={handleOpenDetail}
                          onPointerEnter={handlePrefetchDetail}
                          onFocus={handlePrefetchDetail}
                          className="pointer-events-auto relative z-20 block truncate text-sm font-semibold leading-tight text-white/95 no-underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
                          title={wallet.name}
                        >
                          {wallet.name}
                        </Link>
                      ) : (
                        <p
                          className="truncate text-sm font-semibold leading-tight opacity-95"
                          title={wallet.name}
                        >
                          {wallet.name}
                        </p>
                      )}
                      <p className="eyebrow opacity-60">
                        {cycleLabel ?? typeLabel}
                      </p>
                    </div>
                  </div>
                  {!wallet.active ? (
                    <Badge
                      variant="outline"
                      className="pointer-events-none h-6 shrink-0 gap-0.5 border-white/30 bg-black/20 px-1.5 text-caption text-white"
                    >
                      <BookmarkIcon className="h-2.5 w-2.5" aria-hidden />
                      Inactivo
                    </Badge>
                  ) : isCard ? (
                    <span className="font-mono text-caption tracking-[0.2em] opacity-50">
                      •••• ••••
                    </span>
                  ) : null}
                </div>
                <div className="mt-2">
                  <p className="eyebrow opacity-70">{amountLabel}</p>
                  <p
                    className={cn(
                      'font-sans text-3xl font-bold tabular-nums leading-snug tracking-tight',
                      WALLET_DECK_AMOUNT_TEXT_CLASS,
                    )}
                  >
                    {formatCurrency(amountNumber)}
                  </p>
                </div>
              </div>
              {deck.expanded &&
              (isCard || assigneeMetric || !wallet.include_in_liquidity) ? (
                <div className="mt-3 space-y-3">
                  {isCard ? (
                    <>
                      <div className="grid grid-cols-2 gap-3 text-xs opacity-90">
                        <div>
                          <p className="eyebrow opacity-70">Disponible</p>
                          <p
                            className={cn(
                              'font-sans text-sm font-semibold tabular-nums leading-snug',
                              WALLET_DECK_AMOUNT_TEXT_CLASS,
                            )}
                          >
                            {availableCredit == null
                              ? 'Sin línea'
                              : formatCurrency(availableCredit)}
                          </p>
                        </div>
                        {hasCreditLimit && effectiveLimit != null ? (
                          <div className="text-right">
                            <p className="eyebrow opacity-70">Límite</p>
                            <p className="font-sans text-sm font-semibold tabular-nums leading-snug">
                              {formatCurrency(effectiveLimit)}
                            </p>
                          </div>
                        ) : null}
                      </div>
                      {usagePercent != null && hasCreditLimit ? (
                        <div className="space-y-1">
                          <div className="flex items-baseline justify-between gap-x-2 text-caption leading-snug opacity-70">
                            <span className="shrink-0 whitespace-normal">
                              Utilización
                            </span>
                            <span
                              className={cn(
                                'font-sans tabular-nums',
                                isOverLimit && WALLET_DECK_EXCEEDED_TEXT_CLASS,
                              )}
                            >
                              {isOverLimit ? 'Excedido' : `${usagePercent}%`}
                            </span>
                          </div>
                          <div
                            className="h-1.5 w-full overflow-hidden rounded-full bg-white/20"
                            role="meter"
                            aria-label="Porcentaje de línea usado"
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-valuenow={usagePercent}
                          >
                            <div
                              className="h-full rounded-full bg-white/85 transition-all motion-reduce:transition-none"
                              style={{ width: `${Math.min(usagePercent, 100)}%` }}
                            />
                          </div>
                        </div>
                      ) : null}
                      {showTemporaryTope ? (
                        <span className="inline-flex rounded-full border border-white/25 bg-black/25 px-2 py-0.5 text-caption font-medium tracking-wide text-white/90">
                          Tope temporal
                        </span>
                      ) : null}
                    </>
                  ) : (
                    <>
                      {assigneeMetric ? (
                        <p className="truncate text-body font-medium leading-tight text-white/80">
                          {assigneeMetric}
                        </p>
                      ) : null}
                      {!wallet.include_in_liquidity ? (
                        <p className="truncate text-caption text-white/55">
                          Fuera de la liquidez
                        </p>
                      ) : null}
                    </>
                  )}
                </div>
              ) : null}
            </div>
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 z-[15] rounded-face opacity-0 ring-2 ring-inset ring-white/90 peer-focus-visible:opacity-100"
            />
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
                  {actionMenuItems}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </SwipeDeleteRow>
      </div>

      <div className="hidden md:block">
      <SwipeDeleteRow
        enabled={false}
        onRequestDelete={handleRequestDelete}
        deleteAriaLabel={`Eliminar ${wallet.name}`}
        className="rounded-face"
        railClassName="items-start"
        actionClassName="h-28"
      >
        <ViewTransition
          name={viewTransitionName}
          share="morph"
          default="none"
        >
          <div
            className={cn(
              'relative w-full min-w-0 overflow-hidden rounded-face border border-white/15 text-white',
              'shadow-face',
              'transition-[box-shadow,filter] duration-200 ease-out motion-reduce:transition-none',
              'active:scale-[0.985]',
              WALLET_LIST_CARD_SHELL_CLASS,
              hasAlert && 'ring-2 ring-inset ring-status-expense/70',
            )}
            style={cardStyle}
            data-wallet-vt={viewTransitionName}
          >
            <Link
              href={detailHref}
              onClick={handleOpenDetail}
              onPointerEnter={handlePrefetchDetail}
              onFocus={handlePrefetchDetail}
              className="absolute inset-0 z-0 rounded-face focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
              aria-label={`Abrir ${wallet.name}`}
            />

            {isCard ? (
              <div className="pointer-events-none relative z-10 flex min-h-[12rem] flex-col justify-between gap-4 sm:min-h-[13.5rem]">
                <div className="flex items-start justify-between gap-2 pr-8 md:pr-16">
                  <div className="flex min-w-0 items-center gap-2">
                    <WalletProviderIcon
                      providerIconKey={wallet.provider_icon_key}
                      className="h-8 w-8 shrink-0 rounded-lg border border-white/25 bg-white/15 shadow-sm ring-1 ring-white/10"
                      iconClassName="h-4 w-4"
                      showTooltipLabel={false}
                    />
                    <div className="min-w-0">
                      <p
                        className="truncate text-sm font-semibold leading-tight opacity-95"
                        title={wallet.name}
                      >
                        {wallet.name}
                      </p>
                      <p className="eyebrow opacity-60">
                        {cycleLabel ?? typeLabel}
                      </p>
                    </div>
                  </div>
                  {!wallet.active ? (
                    <Badge
                      variant="outline"
                      className="pointer-events-none h-6 shrink-0 gap-0.5 border-white/30 bg-black/20 px-1.5 text-caption text-white"
                    >
                      <BookmarkIcon className="h-2.5 w-2.5" aria-hidden />
                      Inactivo
                    </Badge>
                  ) : (
                    <span className="font-mono text-caption tracking-[0.2em] opacity-50">
                      •••• ••••
                    </span>
                  )}
                </div>

                <div className="space-y-3">
                  <div>
                    <p className="eyebrow opacity-70">
                      Deuda total
                    </p>
                    <p
                      className={cn(
                        'font-sans text-3xl font-bold tabular-nums leading-snug tracking-tight sm:text-4xl',
                        hasAlert && 'text-status-expense',
                      )}
                    >
                      {formatCurrency(amountNumber)}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs opacity-90">
                    <div>
                      <p className="eyebrow opacity-70">
                        Disponible
                      </p>
                      <p
                        className={cn(
                          'font-sans text-sm font-semibold tabular-nums leading-snug',
                          (availableCredit ?? 0) < 0 && 'text-status-expense',
                        )}
                      >
                        {availableCredit == null
                          ? 'Sin línea'
                          : formatCurrency(availableCredit)}
                      </p>
                    </div>
                    {hasCreditLimit && effectiveLimit != null ? (
                      <div className="text-right">
                        <p className="eyebrow opacity-70">
                          Límite
                        </p>
                        <p className="font-sans text-sm font-semibold tabular-nums leading-snug">
                          {formatCurrency(effectiveLimit)}
                        </p>
                      </div>
                    ) : null}
                  </div>

                  {usagePercent != null && hasCreditLimit ? (
                    <div className="space-y-1">
                      <div className="flex items-baseline justify-between gap-x-2 text-caption leading-snug opacity-70">
                        <span className="shrink-0 whitespace-normal">Utilización</span>
                        <span
                          className={cn(
                            'font-sans tabular-nums',
                            isOverLimit && 'text-status-expense',
                          )}
                        >
                          {isOverLimit ? 'Excedido' : `${usagePercent}%`}
                        </span>
                      </div>
                      <div
                        className="h-1.5 w-full overflow-hidden rounded-full bg-white/20"
                        role="meter"
                        aria-label="Porcentaje de línea usado"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={usagePercent}
                      >
                        <div
                          className={cn(
                            'h-full rounded-full transition-all',
                            isOverLimit ? 'bg-status-expense' : 'bg-white/85',
                          )}
                          style={{ width: `${Math.min(usagePercent, 100)}%` }}
                        />
                      </div>
                    </div>
                  ) : null}

                  {showTemporaryTope ? (
                    <span className="inline-flex rounded-full border border-white/25 bg-black/25 px-2 py-0.5 text-caption font-medium tracking-wide text-white/90">
                      Tope temporal
                    </span>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="pointer-events-none relative z-10 flex min-h-[12rem] flex-col justify-between gap-4 sm:min-h-[13.5rem]">
                <div className="space-y-1.5 pr-8 md:pr-16">
                  <div className="flex min-w-0 items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <WalletProviderIcon
                        providerIconKey={wallet.provider_icon_key}
                        className="h-8 w-8 shrink-0 rounded-lg border border-white/25 bg-white/15 shadow-sm ring-1 ring-white/10"
                        iconClassName="h-4 w-4"
                        showTooltipLabel={false}
                      />
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
                      <Badge
                        variant="outline"
                        className="pointer-events-none h-6 shrink-0 gap-0.5 border-white/30 bg-black/20 px-1.5 text-caption text-white"
                      >
                        <BookmarkIcon className="h-2.5 w-2.5" aria-hidden />
                        Inactivo
                      </Badge>
                    ) : null}
                  </div>
                  {assigneeMetric ? (
                    <p className="truncate text-body font-medium leading-tight text-white/80">
                      {assigneeMetric}
                    </p>
                  ) : null}
                  {!wallet.include_in_liquidity ? (
                    <p className="truncate text-caption text-white/55">
                      Fuera de la liquidez
                    </p>
                  ) : null}
                </div>

                {/*
                  Same bottom stack as credit: primary money, then a reserved band
                  matching disponible/límite + utilización so SALDO aligns with DEUDA ACTUAL.
                */}
                <div className="space-y-3">
                  <div>
                    <p className="eyebrow opacity-70">
                      Saldo disponible
                    </p>
                    <p
                      className={cn(
                        'font-sans text-3xl font-bold tabular-nums leading-snug tracking-tight sm:text-4xl',
                        hasAlert && 'text-status-expense',
                      )}
                    >
                      {formatCurrency(amountNumber)}
                    </p>
                  </div>

                  <div
                    className="invisible grid grid-cols-2 gap-3 text-xs"
                    aria-hidden
                  >
                    <div>
                      <p className="eyebrow">
                        Disponible
                      </p>
                      <p className="font-sans text-sm font-semibold tabular-nums leading-snug">
                        $0.00
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="eyebrow">Límite</p>
                      <p className="font-sans text-sm font-semibold tabular-nums leading-snug">
                        $0.00
                      </p>
                    </div>
                  </div>

                  <div className="invisible space-y-1" aria-hidden>
                    <div className="flex items-baseline justify-between gap-x-2 text-caption leading-snug">
                      <span className="shrink-0 whitespace-normal">Utilización</span>
                      <span className="font-sans tabular-nums">0%</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full" />
                  </div>
                </div>
              </div>
            )}

            <div className="absolute top-2.5 right-2.5 z-20 flex items-center gap-0.5">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="hidden size-8 rounded-full text-white hover:bg-white/15 hover:text-white focus-visible:ring-white/70 md:inline-flex"
                    onClick={handleRequestDelete}
                    aria-label={`Eliminar ${wallet.name}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">Eliminar</TooltipContent>
              </Tooltip>
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
                  {actionMenuItems}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </ViewTransition>
      </SwipeDeleteRow>
      </div>
    </article>
  );
};
