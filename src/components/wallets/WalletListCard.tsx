'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type MouseEvent,
  type PointerEvent,
} from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  BookmarkIcon,
  MoreVertical,
  Pencil,
  Trash2,
} from 'lucide-react';
import {
  type PaymentMethodType,
  PAYMENT_METHOD_LABELS,
} from '@/domain/payment-method';
import { getProviderCardStyle } from '@/lib/provider-card-style';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { AssigneeWithName } from '@/components/assignee/AssigneeAvatar';

const CREDIT_TYPES: PaymentMethodType[] = ['CREDIT_CARD', 'DEPARTMENT_STORE_CARD'];

const isCreditType = (type: string) =>
  CREDIT_TYPES.includes(type as PaymentMethodType);

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

const DOUBLE_CLICK_MS = 250;

type WalletListCardProps = {
  wallet: WalletListItem;
  ownerQueryString: string;
  onEdit: (wallet: WalletListItem) => void;
  onDelete: (wallet: WalletListItem) => void;
  onOpenBalance: (wallet: WalletListItem) => void;
};

export const WalletListCard = ({
  wallet,
  ownerQueryString,
  onEdit,
  onDelete,
  onOpenBalance,
}: WalletListCardProps) => {
  const router = useRouter();
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isCard = isCreditType(wallet.type);
  const isFunding = wallet.type === 'CASH' || wallet.type === 'DEBIT_CARD';
  const typeLabel = PAYMENT_METHOD_LABELS[wallet.type as PaymentMethodType];

  const providerCardStyle = useMemo(
    () => getProviderCardStyle(wallet.provider_icon_key, wallet.type, 'calm'),
    [wallet.provider_icon_key, wallet.type],
  );
  const useProviderGradient = Boolean(providerCardStyle);

  const fallbackAccent = isCard
    ? 'neutral'
    : wallet.type === 'DEBIT_CARD'
      ? 'blue'
      : wallet.type === 'CASH'
        ? 'emerald'
        : 'neutral';

  const fallbackShellClass = cn(
    'border backdrop-blur-sm ring-1 ring-inset ring-white/5 transition-all duration-300',
    'before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-linear-to-r before:from-transparent before:via-white/20 before:to-transparent dark:before:via-white/10',
    fallbackAccent === 'blue' &&
      'border-blue-500/30 bg-linear-to-br from-blue-500/14 via-background to-blue-500/4 dark:from-blue-500/25 dark:via-card dark:to-blue-500/8',
    fallbackAccent === 'emerald' &&
      'border-emerald-500/30 bg-linear-to-br from-emerald-500/14 via-background to-emerald-500/4 dark:from-emerald-500/25 dark:via-card dark:to-emerald-500/8',
    fallbackAccent === 'neutral' && 'border-border/60 bg-card dark:bg-card/80',
    'cursor-pointer hover:-translate-y-0.5 hover:scale-[1.01] hover:shadow-lg',
    fallbackAccent === 'blue' && 'hover:border-blue-500/60 hover:shadow-blue-500/15',
    fallbackAccent === 'emerald' && 'hover:border-emerald-500/60 hover:shadow-emerald-500/15',
    fallbackAccent === 'neutral' && 'hover:border-border',
  );

  const detailHref = useMemo(
    () =>
      isCard
        ? `/credit-cards/${wallet.id}${ownerQueryString}`
        : `/wallets/${wallet.id}${ownerQueryString}`,
    [isCard, wallet.id, ownerQueryString],
  );

  const handleStopOverlayPointer = useCallback((event: MouseEvent | PointerEvent) => {
    event.stopPropagation();
  }, []);

  const handleCardActivate = useCallback(() => {
    if (clickTimerRef.current !== null) {
      clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
      onOpenBalance(wallet);
      return;
    }
    clickTimerRef.current = setTimeout(() => {
      clickTimerRef.current = null;
      router.push(detailHref);
    }, DOUBLE_CLICK_MS);
  }, [detailHref, onOpenBalance, router, wallet]);

  useEffect(
    () => () => {
      if (clickTimerRef.current !== null) {
        clearTimeout(clickTimerRef.current);
      }
    },
    [],
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
  const isNearLimit =
    isCard && effectiveLimit > 0 && !isOverLimit && usagePercent >= 80;
  const hasAlert = isNegativeBalance || isOverLimit;

  const onGradient = useProviderGradient;
  const mutedText = onGradient ? 'text-white/55' : 'text-muted-foreground';
  const softText = onGradient ? 'text-white/80' : 'text-foreground/80';

  return (
    <article
      className={cn('relative', !wallet.active && 'opacity-70 saturate-75')}
      aria-label={wallet.name}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={handleCardActivate}
            className={cn(
              'group relative flex aspect-[1.585/1] w-full flex-col overflow-hidden rounded-2xl border p-5 text-left transition-all duration-300 hover:-translate-y-1 hover:scale-[1.015]',
              onGradient
                ? 'text-white ring-1 ring-inset ring-white/10 hover:shadow-[0_22px_44px_-18px_rgba(8,12,22,0.95)]'
                : fallbackShellClass,
              hasAlert && 'ring-1 ring-inset ring-rose-400/55',
            )}
            style={providerCardStyle}
            aria-label={`Abrir ${wallet.name} (doble toque para editar saldo)`}
          >
            {/* Surface depth + ornamentation */}
            {onGradient ? (
              <>
                <span className="pointer-events-none absolute -right-12 -bottom-16 h-44 w-44 rounded-full border border-white/8" />
                <span className="pointer-events-none absolute -right-4 -bottom-8 h-44 w-44 rounded-full border border-white/5" />
                <span className="pointer-events-none absolute -left-12 -top-12 h-32 w-32 rounded-full bg-white/8 blur-2xl" />
                <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/25 to-transparent" />
                {/* Hover light sweep */}
                <span className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/2 -skew-x-12 bg-linear-to-r from-transparent via-white/14 to-transparent opacity-0 transition-all duration-700 ease-out group-hover:left-full group-hover:opacity-100" />
              </>
            ) : null}

            {/* Strong state signal: overdraft / over-limit */}
            {hasAlert ? (
              <span
                className="pointer-events-none absolute inset-y-0 left-0 z-10 w-1 bg-rose-500"
                aria-hidden
              />
            ) : null}

            {/* Top zone: logo + name (left), type label (left) */}
            <div className="relative z-0 flex items-start gap-3 pr-9">
              <WalletProviderIcon
                providerIconKey={wallet.provider_icon_key}
                className={cn(
                  'h-9 w-9 shrink-0 rounded-xl shadow-sm ring-1',
                  onGradient
                    ? 'border border-white/25 bg-white/15 ring-white/10'
                    : 'border border-border/60 bg-card ring-border/60',
                )}
                iconClassName="h-5 w-5"
                showTooltipLabel={false}
              />
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    'truncate text-sm font-semibold leading-tight',
                    onGradient ? 'text-white' : 'text-foreground',
                    !wallet.active && !onGradient && 'text-muted-foreground',
                    !wallet.active && onGradient && 'text-white/60',
                  )}
                >
                  {wallet.name}
                </p>
                <p className={cn('mt-0.5 truncate text-[11px]', mutedText)}>
                  {typeLabel}
                </p>
              </div>
            </div>

            {/* Bottom zone: balance hero + cardholder (left), secondary (right) */}
            <div className="relative z-0 mt-auto flex items-end justify-between gap-3 pt-3">
              <div className="min-w-0">
                <p className={cn('text-[10px] font-medium uppercase tracking-wider', mutedText)}>
                  {isCard ? 'Deuda' : 'Saldo'}
                </p>
                <p
                  className={cn(
                    'mt-1 truncate font-mono text-2xl font-bold leading-none tabular-nums tracking-tight',
                    hasAlert
                      ? onGradient
                        ? 'text-rose-300'
                        : 'text-destructive'
                      : onGradient
                        ? 'text-white'
                        : 'text-foreground',
                  )}
                >
                  {formatCurrency(wallet.amount)}
                </p>
                <div className="mt-2.5 min-w-0">
                  {wallet.assignee ? (
                    <AssigneeWithName
                      name={wallet.assignee.name}
                      size="sm"
                      nameClassName={cn('truncate text-[11px] font-medium', softText)}
                    />
                  ) : (
                    <span className={cn('text-[11px] font-medium', softText)}>
                      Titular
                    </span>
                  )}
                </div>
              </div>

              <div className="shrink-0 text-right">
                {isCard ? (
                  effectiveLimit > 0 ? (
                    <>
                      <p className={cn('text-[10px] uppercase tracking-wider', mutedText)}>
                        Línea
                      </p>
                      <p
                        className={cn(
                          'mt-1 font-mono text-sm font-semibold tabular-nums',
                          onGradient ? 'text-white/90' : 'text-foreground',
                        )}
                      >
                        {formatCurrency(effectiveLimit)}
                      </p>
                      <p
                        className={cn(
                          'mt-0.5 text-[10px] font-medium tabular-nums',
                          isOverLimit
                            ? 'text-rose-300'
                            : isNearLimit
                              ? 'text-amber-300'
                              : mutedText,
                        )}
                      >
                        {isOverLimit ? 'Excedido' : `${usagePercent.toFixed(0)}% usado`}
                      </p>
                    </>
                  ) : (
                    <p className={cn('text-[11px] font-medium', softText)}>Sin línea</p>
                  )
                ) : null}
                {isCard && wallet.due_day != null ? (
                  <span
                    className={cn(
                      'mt-1.5 inline-block rounded-full px-2 py-0.5 text-[9px] font-semibold tabular-nums',
                      onGradient
                        ? 'bg-white/12 text-white/85 ring-1 ring-inset ring-white/10'
                        : 'bg-muted/50 text-muted-foreground',
                    )}
                  >
                    Paga {wallet.due_day}
                  </span>
                ) : null}
              </div>
            </div>

            {/* Credit usage strip pinned to the card's bottom edge */}
            {isCard && effectiveLimit > 0 ? (
              <div
                className={cn(
                  'pointer-events-none absolute inset-x-0 bottom-0 z-0 h-1',
                  onGradient ? 'bg-black/15' : 'bg-muted/40',
                )}
                aria-hidden
              >
                <div
                  className={cn(
                    'h-full transition-all duration-500',
                    isOverLimit
                      ? 'bg-rose-400'
                      : isNearLimit
                        ? 'bg-amber-400'
                        : onGradient
                          ? 'bg-white/80'
                          : 'bg-linear-to-r from-emerald-500 to-emerald-400 dark:from-emerald-400 dark:to-emerald-300',
                  )}
                  style={{ width: `${isOverLimit ? 100 : usagePercent}%` }}
                />
              </div>
            ) : null}
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={6}>
          Toca para abrir · doble toque para editar saldo
        </TooltipContent>
      </Tooltip>

      <div
        className="absolute right-2 top-2 z-20 flex items-center gap-1"
        onPointerDown={handleStopOverlayPointer}
        onClick={handleStopOverlayPointer}
      >
        {!wallet.active ? (
          onGradient ? (
            <span className="inline-flex h-5 shrink-0 items-center gap-0.5 rounded-full border border-white/20 bg-black/25 px-1.5 text-[9px] font-medium text-white/80 backdrop-blur-sm">
              <BookmarkIcon className="h-2.5 w-2.5" aria-hidden />
              Inactivo
            </span>
          ) : (
            <Badge variant="outline" className="h-5 shrink-0 gap-0.5 px-1.5 text-[9px]">
              <BookmarkIcon className="h-2.5 w-2.5" aria-hidden />
              Inactivo
            </Badge>
          )
        ) : null}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn(
                'h-7 w-7 shrink-0 rounded-full',
                onGradient
                  ? 'text-white/75 hover:bg-white/15 hover:text-white'
                  : '',
              )}
              aria-label={`Más opciones para ${wallet.name}`}
            >
              <MoreVertical className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            {isCard ? (
              <DropdownMenuItem asChild>
                <Link
                  href={`/credit-cards/${wallet.id}${ownerQueryString}`}
                  className="cursor-pointer"
                >
                  Ver estado de cuenta
                </Link>
              </DropdownMenuItem>
            ) : null}
            {isFunding ? (
              <DropdownMenuItem asChild>
                <Link
                  href={`/wallets/${wallet.id}${ownerQueryString}`}
                  className="cursor-pointer"
                >
                  Ver movimientos
                </Link>
              </DropdownMenuItem>
            ) : null}
            {isCard || isFunding ? <DropdownMenuSeparator /> : null}
            <DropdownMenuItem
              onClick={() => onOpenBalance(wallet)}
              className="cursor-pointer"
            >
              Editar saldo
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onEdit(wallet)}
              className="cursor-pointer"
            >
              <Pencil className="mr-2 h-4 w-4" />
              Editar
            </DropdownMenuItem>
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
    </article>
  );
};
