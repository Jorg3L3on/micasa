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
  BadgeCheck,
  BookmarkIcon,
  MoreVertical,
  Pencil,
  Trash2,
  Wallet as WalletLucide,
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
import { AssigneeWithName } from '@/components/tasks/AssigneeAvatar';

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
  const subtitle =
    isCard && wallet.cutoff_day != null && wallet.due_day != null
      ? `Corte ${wallet.cutoff_day} / Pago ${wallet.due_day}`
      : null;

  const providerCardStyle = useMemo(
    () => getProviderCardStyle(wallet.provider_icon_key, wallet.type, 'wow'),
    [wallet.provider_icon_key, wallet.type],
  );
  const useProviderGradient = Boolean(providerCardStyle);

  const fallbackAccent = isCard
    ? 'violet'
    : wallet.type === 'DEBIT_CARD'
      ? 'blue'
      : wallet.type === 'CASH'
        ? 'emerald'
        : 'neutral';

  const fallbackShellClass = cn(
    'border backdrop-blur-sm ring-1 ring-inset ring-white/5 transition-all duration-300',
    'before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-white/20 before:to-transparent dark:before:via-white/10',
    'after:pointer-events-none after:absolute after:inset-0 after:bg-[linear-gradient(120deg,transparent_25%,rgba(255,255,255,0.12)_48%,transparent_72%)] after:opacity-45 after:transition-opacity after:duration-300 group-hover:after:opacity-70',
    fallbackAccent === 'violet' &&
      'border-violet-500/30 bg-gradient-to-br from-violet-500/12 via-background to-violet-500/4 dark:from-violet-500/20 dark:via-card dark:to-violet-500/5',
    fallbackAccent === 'blue' &&
      'border-blue-500/30 bg-gradient-to-br from-blue-500/12 via-background to-blue-500/4 dark:from-blue-500/20 dark:via-card dark:to-blue-500/5',
    fallbackAccent === 'emerald' &&
      'border-emerald-500/30 bg-gradient-to-br from-emerald-500/12 via-background to-emerald-500/4 dark:from-emerald-500/20 dark:via-card dark:to-emerald-500/5',
    fallbackAccent === 'neutral' && 'border-border/60 bg-card dark:bg-card/80',
    'cursor-pointer hover:-translate-y-0.5 hover:scale-[1.01] hover:shadow-lg',
    fallbackAccent === 'violet' && 'hover:border-violet-500/60 hover:shadow-violet-500/15',
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
  const usagePercent =
    isCard && effectiveLimit > 0
      ? Math.min(
          (Math.max(0, Number(wallet.amount)) / effectiveLimit) * 100,
          100,
        )
      : 0;

  const labelMuted = useProviderGradient ? 'text-white/70' : 'text-muted-foreground';
  const nameClass = cn(
    'block truncate text-sm font-semibold leading-tight',
    useProviderGradient ? 'text-white/90' : 'text-foreground',
    !wallet.active && !useProviderGradient && 'text-muted-foreground',
    !wallet.active && useProviderGradient && 'text-white/60',
  );
  const subtitleClass = cn(
    'block truncate text-xs',
    useProviderGradient ? 'text-white/65' : 'text-muted-foreground',
  );

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
              'group relative block w-full overflow-hidden rounded-xl border p-4 text-left ring-1 ring-inset ring-white/5 transition-all duration-300 hover:-translate-y-0.5 hover:scale-[1.01]',
              useProviderGradient
                ? 'text-white ring-white/5 hover:shadow-[0_16px_34px_-14px_rgba(15,23,42,0.95)]'
                : fallbackShellClass,
            )}
            style={providerCardStyle}
            aria-label={`Abrir ${wallet.name} (doble toque para editar saldo)`}
          >
            {useProviderGradient ? (
              <>
                <span className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-white/18 blur-2xl" />
                <span className="pointer-events-none absolute -left-10 -bottom-12 h-28 w-28 rounded-full bg-black/30 blur-2xl" />
                <span className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,transparent_25%,rgba(255,255,255,0.14)_48%,transparent_72%)] opacity-45 transition-opacity duration-300 group-hover:opacity-70" />
              </>
            ) : null}

            <div className="relative z-0 pr-20 pt-0.5">
              <div className="mb-4 flex items-start gap-2.5">
                <WalletProviderIcon
                  providerIconKey={wallet.provider_icon_key}
                  className={cn(
                    'h-9 w-9 shrink-0 rounded-lg shadow-sm ring-1',
                    useProviderGradient
                      ? 'border border-white/35 bg-white/20 ring-white/10'
                      : 'border border-border/60 bg-card ring-border/60',
                  )}
                  iconClassName="h-5 w-5"
                  showTooltipLabel={false}
                />
                <span className="min-w-0 flex-1">
                  <span className={nameClass}>{wallet.name}</span>
                  {subtitle ? <span className={subtitleClass}>{subtitle}</span> : null}
                  {wallet.assignee ? (
                    <AssigneeWithName
                      name={wallet.assignee.name}
                      size="sm"
                      nameClassName={cn(
                        'text-[10px]',
                        useProviderGradient ? 'text-white/80' : 'text-muted-foreground',
                      )}
                      className="mt-0.5"
                    />
                  ) : null}
                </span>
              </div>

              <div className="space-y-2.5">
                <div
                  className={cn(
                    'grid grid-cols-2 gap-3 text-xs',
                    useProviderGradient ? 'opacity-80' : '',
                    labelMuted,
                  )}
                >
                  <span className="truncate">{isCard ? 'Deuda' : 'Saldo'}</span>
                  {isCard ? (
                    <span className="truncate text-right">Límite</span>
                  ) : (
                    <span className="truncate text-right">Tipo</span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <span
                    className={cn(
                      'min-w-0 truncate text-base font-bold font-mono tabular-nums',
                      useProviderGradient ? 'text-white' : 'text-foreground',
                    )}
                  >
                    {formatCurrency(wallet.amount)}
                  </span>
                  {isCard ? (
                    effectiveLimit > 0 ? (
                      <span
                        className={cn(
                          'min-w-0 truncate text-right text-base font-bold font-mono tabular-nums',
                          useProviderGradient ? 'text-white/90' : 'text-foreground',
                        )}
                        title={
                          wallet.temporary_credit_limit != null &&
                          wallet.credit_limit != null &&
                          wallet.temporary_credit_limit > wallet.credit_limit
                            ? `Tope efectivo: mayor entre línea ${formatCurrency(wallet.credit_limit)} y temporal ${formatCurrency(wallet.temporary_credit_limit)}`
                            : 'Tope de crédito usado para uso y disponible'
                        }
                      >
                        {formatCurrency(effectiveLimit)}
                      </span>
                    ) : (
                      <span
                        className={cn(
                          'min-w-0 truncate text-right text-sm font-medium',
                          useProviderGradient ? 'text-white/70' : 'text-muted-foreground',
                        )}
                      >
                        Sin línea
                      </span>
                    )
                  ) : (
                    <span
                      className={cn(
                        'min-w-0 truncate text-right text-sm font-semibold',
                        useProviderGradient ? 'text-white/85' : 'text-muted-foreground',
                      )}
                    >
                      {PAYMENT_METHOD_LABELS[wallet.type as PaymentMethodType]}
                    </span>
                  )}
                </div>

                {isCard && effectiveLimit > 0 ? (
                  <div className="mt-1.5 space-y-1.5">
                    <div
                      className={cn(
                        'h-1.5 w-full rounded-full',
                        useProviderGradient ? 'bg-white/20' : 'bg-muted/50',
                      )}
                    >
                      <div
                        className={cn(
                          'h-1.5 rounded-full transition-all',
                          useProviderGradient
                            ? 'bg-white/80'
                            : 'bg-gradient-to-r from-emerald-500 to-emerald-400 dark:from-emerald-400 dark:to-emerald-300',
                        )}
                        style={{ width: `${usagePercent}%` }}
                        aria-hidden
                      />
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-1">
                      <p
                        className={cn(
                          'text-center text-xs',
                          useProviderGradient ? 'text-white/70' : 'text-muted-foreground',
                        )}
                      >
                        {usagePercent.toFixed(0)}% utilizado
                      </p>
                      {wallet.due_day != null ? (
                        <span
                          className={cn(
                            'rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums',
                            useProviderGradient
                              ? 'bg-white/15 text-white/90'
                              : 'bg-muted/50 text-muted-foreground',
                          )}
                        >
                          Paga {wallet.due_day}
                        </span>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                <div className="flex items-center gap-1.5 pt-1">
                  <WalletLucide
                    className={cn(
                      'h-3 w-3 shrink-0',
                      useProviderGradient ? 'text-white/55' : 'text-muted-foreground',
                    )}
                    aria-hidden
                  />
                  <p
                    className={cn(
                      'text-[10px] leading-none',
                      useProviderGradient ? 'text-white/65' : 'text-muted-foreground',
                    )}
                  >
                    {PAYMENT_METHOD_LABELS[wallet.type as PaymentMethodType]}
                  </p>
                </div>
              </div>
            </div>
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
        {wallet.active ? (
          useProviderGradient ? (
            <span className="inline-flex h-6 shrink-0 items-center gap-0.5 rounded-full border border-white/30 bg-white/15 px-2 text-[10px] font-medium text-white">
              <BadgeCheck className="h-3 w-3" aria-hidden />
              Activo
            </span>
          ) : (
            <Badge variant="secondary" className="h-6 shrink-0 gap-0.5 px-1.5 text-[10px]">
              <BadgeCheck className="h-3 w-3" aria-hidden />
              Activo
            </Badge>
          )
        ) : useProviderGradient ? (
          <span className="inline-flex h-6 shrink-0 items-center gap-0.5 rounded-full border border-white/25 bg-black/20 px-2 text-[10px] font-medium text-white/85">
            <BookmarkIcon className="h-3 w-3" aria-hidden />
            Inactivo
          </span>
        ) : (
          <Badge variant="outline" className="h-6 shrink-0 gap-0.5 px-1.5 text-[10px]">
            <BookmarkIcon className="h-3 w-3" aria-hidden />
            Inactivo
          </Badge>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn(
                'h-8 w-8 shrink-0',
                useProviderGradient
                  ? 'text-white/80 hover:bg-white/15 hover:text-white'
                  : '',
              )}
              aria-label={`Más opciones para ${wallet.name}`}
            >
              <MoreVertical className="h-4 w-4" />
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
