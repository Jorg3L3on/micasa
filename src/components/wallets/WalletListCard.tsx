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
import { useTheme } from 'next-themes';
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
  const { resolvedTheme } = useTheme();
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheme: ProviderCardScheme =
    resolvedTheme === 'light' ? 'light' : 'dark';

  const isCard = isCreditType(wallet.type);
  const isFunding = wallet.type === 'CASH' || wallet.type === 'DEBIT_CARD';
  const typeLabel = PAYMENT_METHOD_LABELS[wallet.type as PaymentMethodType];

  const providerCardStyle = useMemo(
  );
  const useProviderGradient = Boolean(providerCardStyle);
  const onDarkSurface =
    useProviderGradient && isProviderCardDarkSurface('calm', scheme);

  const fallbackAccent = isCard
    ? 'neutral'
    : wallet.type === 'DEBIT_CARD'
      ? 'blue'
      : wallet.type === 'CASH'
        ? 'emerald'
        : 'neutral';

  const fallbackShellClass = cn(
    fallbackAccent === 'blue' &&
      'border-blue-500/30 bg-linear-to-br from-blue-500/14 via-background to-blue-500/4 dark:from-blue-500/25 dark:via-card dark:to-blue-500/8',
    fallbackAccent === 'emerald' &&
      'border-emerald-500/30 bg-linear-to-br from-emerald-500/14 via-background to-emerald-500/4 dark:from-emerald-500/25 dark:via-card dark:to-emerald-500/8',
    'cursor-pointer hover:-translate-y-0.5 hover:scale-[1.01] hover:shadow-lg',
    fallbackAccent === 'blue' && 'hover:border-blue-500/60 hover:shadow-blue-500/15',
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
                ? 'text-white ring-1 ring-inset ring-white/10 hover:shadow-[0_22px_44px_-18px_rgba(8,12,22,0.95)]'
                : useProviderGradient
                  ? 'text-foreground ring-1 ring-inset ring-black/5 hover:shadow-[0_18px_36px_-18px_rgba(15,23,42,0.28)]'
                  : fallbackShellClass,
              hasAlert && 'ring-1 ring-inset ring-rose-400/55',
            )}
            style={providerCardStyle}
            aria-label={`Abrir ${wallet.name} (doble toque para editar saldo)`}
          >
              <>
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
                    ? 'border border-white/25 bg-white/15 ring-white/10'
                )}
                iconClassName="h-5 w-5"
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    'truncate text-sm font-semibold leading-tight',
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
                        ? 'text-rose-300'
                        : 'text-destructive'
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
                        )}
                      >
                        {formatCurrency(effectiveLimit)}
                      </p>
                      <p
                        className={cn(
                          'mt-0.5 text-[10px] font-medium tabular-nums',
                          isOverLimit
                            ? onDarkSurface
                              ? 'text-rose-300'
                              : 'text-destructive'
                            : isNearLimit
                              ? onDarkSurface
                                ? 'text-amber-300'
                                : 'text-amber-600'
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
                        ? 'bg-white/12 text-white/85 ring-1 ring-inset ring-white/10'
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
                          ? 'bg-white/80'
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

        {!wallet.active ? (
            <span className="inline-flex h-5 shrink-0 items-center gap-0.5 rounded-full border border-white/20 bg-black/25 px-1.5 text-[9px] font-medium text-white/80 backdrop-blur-sm">
              Inactivo
            </span>
          ) : (
            <Badge variant="outline" className="h-5 shrink-0 gap-0.5 px-1.5 text-[9px]">
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
                  ? 'text-white/75 hover:bg-white/15 hover:text-white'
                  : useProviderGradient
                    ? 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
                    : '',
              )}
              aria-label={`Más opciones para ${wallet.name}`}
              onPointerDown={handleStopOverlayPointer}
              onClick={handleStopOverlayPointer}
            >
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
              Editar
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onDelete(wallet)}
              className="cursor-pointer text-destructive focus:text-destructive"
            >
              Eliminar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </article>
  );
};
