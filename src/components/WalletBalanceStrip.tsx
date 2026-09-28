'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react';
import type { WalletListItem } from '@/types/catalog';
import { useFinanceContext } from '@/context/finance-context';
import {
  applyWalletStripOrder,
  defaultWalletStripOrder,
  isPointerNearWalletStrip,
  isWalletStripTouchPointer,
  moveWalletStripId,
  readWalletStripOrder,
  WALLET_STRIP_LONG_PRESS_MS,
  walletStripAutoScrollDelta,
  walletStripHoldShouldCancel,
  walletStripInsertIndexAtPointerX,
  walletStripMouseShouldActivate,
  walletStripPointerDistance,
  writeWalletStripOrder,
} from '@/lib/ui/wallet-strip-order';
import { useReducedMotion } from 'framer-motion';
import {
  getProviderCardStyle,
  getWalletAuraColors,
  isProviderCardDarkSurface,
} from '@/lib/provider-card-style';
import { useProviderCardScheme } from '@/hooks/use-provider-card-scheme';
import { CurrencyTicker } from '@/components/motion/number-ticker';
import { AnimatedGridPattern } from '@/components/ui/animated-grid-pattern';
import { ShineBorder } from '@/components/ui/shine-border';
import { cn } from '@/lib/utils';
import { CreditCard, GripVertical, Landmark, Wallet } from 'lucide-react';
import WalletBalanceDialog from '@/components/wallets/WalletBalanceDialog';
import { WalletProviderIcon } from '@/components/wallets/WalletProviderIcon';
import { todayCalendarDate } from '@/lib/calendar-dates';
import {
  calendarDayCountInclusive,
  dueDayFallsInFortnight,
  dueYmdInFortnight,
  getCurrentCalendarFortnightRef,
} from '@/lib/fortnight-calendar';

type WalletBalanceStripProps = {
  wallets: WalletListItem[];
  paidWalletIds?: number[];
  /** Past/future monthly views must not use “today” due reminders */
  isCurrentMonth?: boolean;
  /** After saldo persists to the API (e.g. refetch resumen / billeteras vs pendiente). */
  onBalancesPersisted?: () => void;
};

const WalletBalanceStrip = ({
  wallets,
  paidWalletIds = [],
  isCurrentMonth = true,
  onBalancesPersisted,
}: WalletBalanceStripProps) => {
  const { context } = useFinanceContext();
  const scheme = useProviderCardScheme();
  const shouldReduceMotion = useReducedMotion();
  const [selectedWallet, setSelectedWallet] = useState<WalletListItem | null>(null);
  const [balanceOverrides, setBalanceOverrides] = useState<Record<number, number>>({});

  const getEffectiveAmount = useCallback(
    (wallet: WalletListItem) => balanceOverrides[wallet.id] ?? wallet.amount,
    [balanceOverrides],
  );

  const isCreditType = (type: string) =>
    type === 'CREDIT_CARD' || type === 'DEPARTMENT_STORE_CARD';

  const handleOpenWalletModal = useCallback((wallet: WalletListItem) => {
    const effectiveAmount = balanceOverrides[wallet.id] ?? wallet.amount;
    setSelectedWallet({ ...wallet, amount: effectiveAmount });
  }, [balanceOverrides]);

  const defaultSortedWallets = useMemo(
    () => defaultWalletStripOrder(wallets, getEffectiveAmount),
    [wallets, getEffectiveAmount],
  );

  const [savedOrderIds, setSavedOrderIds] = useState<number[] | null>(null);
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [holdingId, setHoldingId] = useState<number | null>(null);
  const draggingIdRef = useRef<number | null>(null);
  const orderedIdsRef = useRef<number[]>([]);
  const listRef = useRef<HTMLDivElement>(null);
  const dragPointerRef = useRef<{ x: number; y: number } | null>(null);
  const autoScrollIntervalRef = useRef<number | null>(null);
  const lastAutoScrollAtRef = useRef(0);
  const longPressTimerRef = useRef<number | null>(null);
  const suppressOpenRef = useRef(false);
  const pointerSessionRef = useRef<{
    id: number;
    pointerId: number;
    pointerType: string;
    startX: number;
    startY: number;
    activated: boolean;
    moved: boolean;
    target: HTMLElement;
  } | null>(null);

  const clearLongPressTimer = useCallback(() => {
    if (longPressTimerRef.current != null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const stopAutoScroll = useCallback(() => {
    if (autoScrollIntervalRef.current != null) {
      window.clearInterval(autoScrollIntervalRef.current);
      autoScrollIntervalRef.current = null;
    }
    dragPointerRef.current = null;
    lastAutoScrollAtRef.current = 0;
  }, []);

  const handleReorder = useCallback(
    (nextIds: number[]) => {
      setSavedOrderIds(nextIds);
      writeWalletStripOrder(context.type, context.id, nextIds);
    },
    [context.type, context.id],
  );

  const reorderTowardPointer = useCallback(
    (clientX: number, clientY: number) => {
      const list = listRef.current;
      const activeId = draggingIdRef.current;
      if (list == null || activeId == null) return;

      dragPointerRef.current = { x: clientX, y: clientY };

      const rect = list.getBoundingClientRect();
      if (isPointerNearWalletStrip(clientY, rect.top, rect.bottom)) {
        const delta = walletStripAutoScrollDelta(clientX, rect.left, rect.right);
        if (delta !== 0) {
          list.scrollLeft += delta;
        }
      }

      const cards = [
        ...list.querySelectorAll<HTMLElement>('[data-wallet-strip-id]'),
      ];
      const centers = cards.map((card) => {
        const cardRect = card.getBoundingClientRect();
        return cardRect.left + cardRect.width / 2;
      });
      const toIndex = walletStripInsertIndexAtPointerX(clientX, centers);

      const nextIds = moveWalletStripId(
        orderedIdsRef.current,
        activeId,
        toIndex,
      );
      if (nextIds.every((id, index) => id === orderedIdsRef.current[index])) {
        return;
      }
      orderedIdsRef.current = nextIds;
      handleReorder(nextIds);
    },
    [handleReorder],
  );

  const scrollStripTowardPointer = useCallback(() => {
    const pointer = dragPointerRef.current;
    if (pointer == null || draggingIdRef.current == null) return;

    const now = performance.now();
    if (now - lastAutoScrollAtRef.current < 16) return;
    lastAutoScrollAtRef.current = now;

    reorderTowardPointer(pointer.x, pointer.y);
  }, [reorderTowardPointer]);

  const startAutoScroll = useCallback(() => {
    if (autoScrollIntervalRef.current != null) return;
    autoScrollIntervalRef.current = window.setInterval(
      scrollStripTowardPointer,
      16,
    );
  }, [scrollStripTowardPointer]);

  const endPointerDrag = useCallback(() => {
    const session = pointerSessionRef.current;
    if (session?.target.hasPointerCapture(session.pointerId)) {
      session.target.releasePointerCapture(session.pointerId);
    }
    pointerSessionRef.current = null;
    draggingIdRef.current = null;
    clearLongPressTimer();
    setHoldingId(null);
    setDraggingId(null);
    stopAutoScroll();
  }, [clearLongPressTimer, stopAutoScroll]);

  const activatePointerDrag = useCallback(
    (walletId: number) => {
      const session = pointerSessionRef.current;
      if (session == null || session.id !== walletId) return;
      session.activated = true;
      suppressOpenRef.current = true;
      draggingIdRef.current = walletId;
      setDraggingId(walletId);
      setHoldingId(null);
      startAutoScroll();
      try {
        session.target.setPointerCapture(session.pointerId);
      } catch {
        /* capture can fail if the node unmounted */
      }
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(12);
      }
    },
    [startAutoScroll],
  );

  const beginPointerSession = useCallback(
    (
      walletId: number,
      event: ReactPointerEvent<HTMLElement>,
      immediate: boolean,
    ) => {
      if (event.button !== 0) return;
      if (pointerSessionRef.current?.activated) return;

      clearLongPressTimer();
      pointerSessionRef.current = {
        id: walletId,
        pointerId: event.pointerId,
        pointerType: event.pointerType,
        startX: event.clientX,
        startY: event.clientY,
        activated: false,
        moved: false,
        target: event.currentTarget,
      };

      if (immediate) {
        event.preventDefault();
        activatePointerDrag(walletId);
        return;
      }

      suppressOpenRef.current = false;
      if (isWalletStripTouchPointer(event.pointerType)) {
        setHoldingId(walletId);
      }

      if (!isWalletStripTouchPointer(event.pointerType)) return;

      longPressTimerRef.current = window.setTimeout(() => {
        const session = pointerSessionRef.current;
        if (session == null || session.moved || session.id !== walletId) return;
        activatePointerDrag(walletId);
      }, WALLET_STRIP_LONG_PRESS_MS);
    },
    [activatePointerDrag, clearLongPressTimer],
  );

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const session = pointerSessionRef.current;
      if (!session || event.pointerId !== session.pointerId) return;

      const distance = walletStripPointerDistance(
        event.clientX - session.startX,
        event.clientY - session.startY,
      );

      if (!session.activated) {
        if (isWalletStripTouchPointer(session.pointerType)) {
          if (walletStripHoldShouldCancel(distance)) {
            session.moved = true;
            suppressOpenRef.current = true;
            clearLongPressTimer();
            setHoldingId(null);
            pointerSessionRef.current = null;
          }
          return;
        }

        if (walletStripMouseShouldActivate(distance)) {
          session.moved = true;
          activatePointerDrag(session.id);
        } else {
          return;
        }
      }

      event.preventDefault();
      reorderTowardPointer(event.clientX, event.clientY);
    };

    const handlePointerUp = (event: PointerEvent) => {
      const session = pointerSessionRef.current;
      if (!session || event.pointerId !== session.pointerId) return;
      endPointerDrag();
    };

    const handleTouchMove = (event: TouchEvent) => {
      if (draggingIdRef.current == null) return;
      event.preventDefault();
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
    window.addEventListener('touchmove', handleTouchMove, {
      passive: false,
      capture: true,
    });

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
      window.removeEventListener('touchmove', handleTouchMove, true);
      endPointerDrag();
    };
  }, [
    activatePointerDrag,
    clearLongPressTimer,
    endPointerDrag,
    reorderTowardPointer,
  ]);

  useLayoutEffect(() => {
    setSavedOrderIds(readWalletStripOrder(context.type, context.id));
  }, [context.type, context.id]);

  const orderedWallets = applyWalletStripOrder(
    defaultSortedWallets,
    savedOrderIds,
  );
  const orderedIds = orderedWallets.map((wallet) => wallet.id);
  orderedIdsRef.current = orderedIds;

  const handleCardPointerDown =
    (walletId: number) => (event: ReactPointerEvent<HTMLElement>) => {
      beginPointerSession(walletId, event, false);
    };

  const handleGripPointerDown =
    (walletId: number) => (event: ReactPointerEvent<HTMLElement>) => {
      event.stopPropagation();
      beginPointerSession(walletId, event, true);
    };

  const handleCardClick =
    (wallet: WalletListItem) => (event: ReactMouseEvent<HTMLButtonElement>) => {
      if (suppressOpenRef.current) {
        event.preventDefault();
        suppressOpenRef.current = false;
        return;
      }
      handleOpenWalletModal(wallet);
    };

  const handleCardContextMenu = (event: ReactMouseEvent) => {
    event.preventDefault();
  };

  if (wallets.length === 0) return null;

  return (
    <>
      <div
        className="relative min-w-0 flex-1"
        role="region"
        aria-label="Saldos de billeteras"
      >
          <p className="sr-only" aria-live="polite">
            {draggingId != null
              ? `Reordenando ${orderedWallets.find((wallet) => wallet.id === draggingId)?.name ?? 'billetera'}`
              : ''}
          </p>
          <div
            ref={listRef}
            className={cn(
              '-mx-1 -my-4 flex items-stretch gap-3 overflow-x-auto overflow-y-hidden overscroll-x-contain scrollbar-hide py-4 pl-3 pr-3 snap-x snap-mandatory scroll-ps-3 [-webkit-overflow-scrolling:touch]',
              draggingId != null && 'touch-none snap-none',
            )}
          >
              {orderedWallets.map((wallet) => {
                const isCreditType =
                  wallet.type === 'CREDIT_CARD' ||
                  wallet.type === 'DEPARTMENT_STORE_CARD';
                const effectiveAmount = getEffectiveAmount(wallet);

                const creditLimit = wallet.credit_limit ?? 0;
                const percentUsed = (() => {
                  if (isCreditType) {
                    if (!creditLimit || creditLimit <= 0) return 0;
                    return Math.max(
                      0,
                      Math.min(100, (Math.max(0, effectiveAmount) / creditLimit) * 100),
                    );
                  }
                  return effectiveAmount > 0 ? 100 : 0;
                })();

                const current = getCurrentCalendarFortnightRef();
                const todayYmd = todayCalendarDate();
                const dueYmd =
                  wallet.due_day != null
                    ? dueYmdInFortnight(
                        wallet.due_day,
                        current.year,
                        current.month,
                        current.period,
                      )
                    : null;

                const walletAlreadyPaid = paidWalletIds.includes(wallet.id);
                const dueInCurrentFortnight =
                  isCreditType &&
                  !walletAlreadyPaid &&
                  wallet.due_day != null &&
                  dueDayFallsInFortnight(
                    wallet.due_day,
                    current.year,
                    current.month,
                    current.period,
                  );

                const isDueNear = (() => {
                  if (!dueInCurrentFortnight || dueYmd == null) return false;
                  const daysUntilDue = calendarDayCountInclusive(todayYmd, dueYmd) - 1;
                  return daysUntilDue >= 0 && daysUntilDue <= 5;
                })();

                const isDuePast = (() => {
                  if (!dueInCurrentFortnight || dueYmd == null) return false;
                  return dueYmd < todayYmd;
                })();

                const showDueReminder =
                  isCurrentMonth &&
                  (isDueNear || isDuePast) &&
                  !walletAlreadyPaid;

                const WalletIcon =
                  wallet.type === 'CREDIT_CARD' || wallet.type === 'DEPARTMENT_STORE_CARD'
                    ? CreditCard
                    : wallet.type === 'DEBIT_CARD'
                      ? Landmark
                      : Wallet;

                const isFunding =
                  wallet.type === 'CASH' || wallet.type === 'DEBIT_CARD';
                const fallbackAccent =
                  isCreditType
                    ? 'violet'
                    : wallet.type === 'DEBIT_CARD'
                      ? 'blue'
                      : wallet.type === 'CASH'
                        ? 'emerald'
                        : 'neutral';

                const hasBankIcon = Boolean(wallet.provider_icon_key);
                const providerCardStyle = getProviderCardStyle(
                  wallet.provider_icon_key,
                  wallet.type,
                  'aura',
                  scheme,
                );
                const auraColors = getWalletAuraColors(
                  wallet.provider_icon_key,
                  wallet.type,
                );
                const useProviderGradient = Boolean(providerCardStyle);
                const onDarkSurface =
                  useProviderGradient &&
                  isProviderCardDarkSurface('aura', scheme);
                const isActiveCard =
                  draggingId === wallet.id || holdingId === wallet.id;
                const accent = hasBankIcon ? 'neutral' : fallbackAccent;

                const cardContent = (
                  <div className="flex items-start gap-1.5">
                    {hasBankIcon ? (
                      <span className="relative mt-0.5 shrink-0">
                        <span
                          className={cn(
                            'absolute inset-0 rounded-md',
                            onDarkSurface
                              ? 'bg-white/88 dark:bg-white/92'
                              : 'bg-card/95',
                          )}
                          aria-hidden
                        />
                        <WalletProviderIcon
                          providerIconKey={wallet.provider_icon_key}
                          className={cn(
                            'relative h-7 w-7 rounded-md shadow-sm ring-1',
                            onDarkSurface
                              ? 'ring-white/45'
                              : 'ring-border/60',
                          )}
                          iconClassName="h-3.5 w-3.5"
                          showTooltipLabel={false} data-icon="inline-start" />
                        {showDueReminder && (
                          <span
                            className={cn(
                              'absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-background',
                              isDuePast
                                ? 'bg-destructive animate-pulse'
                                : 'bg-status-pending',
                            )}
                            aria-hidden
                          />
                        )}
                      </span>
                    ) : (
                      <span
                        className={cn(
                          'relative mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md ring-1 shadow-sm',
                          accent === 'violet' &&
                            'bg-gradient-to-br from-status-info/25 to-status-info/10 ring-status-info/30 dark:from-status-info/25 dark:to-status-info/10',
                          accent === 'blue' &&
                            'bg-gradient-to-br from-status-info/25 to-status-info/10 ring-status-info/30 dark:from-status-info/25 dark:to-status-info/10',
                          accent === 'emerald' &&
                            'bg-gradient-to-br from-status-income/25 to-status-income/10 ring-status-income/30 dark:from-status-income/25 dark:to-status-income/10',
                          accent === 'neutral' &&
                            'bg-muted/60 ring-border/60',
                        )}
                      >
                        <WalletIcon
                          className={cn(
                            'h-3 w-3',
                            accent === 'violet' &&
                              'text-status-info',
                            accent === 'blue' &&
                              'text-status-info',
                            accent === 'emerald' &&
                              'text-status-income',
                            accent === 'neutral' && 'text-muted-foreground',
                          )}
                          aria-hidden data-icon="inline-start" />
                        {showDueReminder && (
                          <span
                            className={cn(
                              'absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-background',
                              isDuePast
                                ? 'bg-destructive animate-pulse'
                                : 'bg-status-pending',
                            )}
                            aria-hidden
                          />
                        )}
                      </span>
                    )}
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <p
                        className={cn(
                          'truncate text-caption font-semibold leading-tight',
                          onDarkSurface
                            ? 'text-white/85'
                            : 'text-muted-foreground/90',
                        )}
                        title={wallet.name}
                      >
                        {wallet.name}
                      </p>
                      <p className="leading-none">
                        <CurrencyTicker
                          value={effectiveAmount}
                          className={cn(
                            'text-body font-black sm:text-sm',
                            effectiveAmount < 0
                              ? 'text-status-expense'
                              : onDarkSurface
                                ? 'text-white'
                                : 'text-foreground',
                          )}
                        />
                      </p>
                      <div
                        className={cn(
                          'mt-1 flex h-3.5 items-center gap-1.5',
                          !isCreditType && 'invisible',
                        )}
                        aria-hidden={!isCreditType}
                      >
                        <div
                          className={cn(
                            'relative h-1 w-10 overflow-hidden rounded-full sm:w-12',
                            onDarkSurface ? 'bg-white/25' : 'bg-muted/50',
                          )}
                        >
                          <div
                            className={cn(
                              'h-full rounded-full transition-all',
                              onDarkSurface
                                ? 'bg-white/85'
                                : 'bg-status-info',
                            )}
                            style={{
                              width: `${isCreditType ? percentUsed : 0}%`,
                            }}
                            aria-hidden
                          />
                        </div>
                        {isCreditType && wallet.due_day != null ? (
                          <span
                            className={cn(
                              'whitespace-nowrap rounded-full px-1.5 py-0.5 text-caption font-semibold leading-none tabular-nums',
                              walletAlreadyPaid
                                ? 'bg-status-success-soft text-status-success'
                                : !isCurrentMonth
                                  ? onDarkSurface
                                    ? 'text-white/75'
                                    : 'text-muted-foreground/70'
                                  : isDuePast
                                    ? 'text-status-overdue'
                                    : isDueNear
                                      ? 'text-status-pending'
                                      : onDarkSurface
                                        ? 'text-white/75'
                                        : 'text-muted-foreground/70',
                            )}
                          >
                            {walletAlreadyPaid ? 'Pagada' : `Paga ${wallet.due_day}`}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );

                const cardClasses = cn(
                  'group relative isolate flex h-full min-w-[136px] shrink-0 snap-start flex-col justify-center overflow-hidden rounded-xl border px-2 py-1.5 pr-6 text-left sm:min-w-[164px] sm:px-2.5 sm:py-2 sm:pr-7',
                  orderedWallets.length > 1 &&
                    'max-md:w-[min(17rem,calc(100%-2.75rem))]',
                  'backdrop-blur-sm ring-1 ring-inset transition-all duration-300 [-webkit-touch-callout:none]',
                  onDarkSurface ? 'ring-white/5' : 'ring-black/5',
                  'before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:to-transparent',
                  onDarkSurface
                    ? 'before:via-white/20 dark:before:via-white/10'
                    : 'before:via-black/10',
                  'after:pointer-events-none after:absolute after:inset-0 after:bg-[linear-gradient(120deg,transparent_25%,rgba(255,255,255,0.12)_48%,transparent_72%)] after:opacity-45 after:transition-opacity after:duration-300',
                  accent === 'violet' &&
                    'border-status-info/30 bg-gradient-to-br from-status-info/12 via-background to-status-info/4 dark:from-status-info/20 dark:via-card dark:to-status-info/5',
                  accent === 'blue' &&
                    'border-status-info/30 bg-gradient-to-br from-status-info/12 via-background to-status-info/4 dark:from-status-info/20 dark:via-card dark:to-status-info/5',
                  accent === 'emerald' &&
                    'border-status-income/30 bg-gradient-to-br from-status-income/12 via-background to-status-income/4 dark:from-status-income/20 dark:via-card dark:to-status-income/5',
                  accent === 'neutral' &&
                    'border-border/80 bg-card dark:border-border/60 dark:bg-card/80',
                  (isCreditType || isFunding) &&
                    cn(
                      'cursor-grab select-none active:cursor-grabbing',
                      draggingId !== wallet.id &&
                        holdingId !== wallet.id &&
                        'hover:-translate-y-0.5 hover:scale-[1.01] hover:shadow-lg',
                      holdingId === wallet.id &&
                        draggingId !== wallet.id &&
                        'scale-[1.03]',
                      draggingId === wallet.id &&
                        'cursor-grabbing scale-[1.04] shadow-xl',
                      useProviderGradient &&
                        (onDarkSurface
                          ? 'border-white/25 shadow-face hover:border-white/40 hover:shadow-face hover:after:opacity-70'
                          : 'border-border/70 shadow-face hover:border-border hover:shadow-face hover:after:opacity-70'),
                      !useProviderGradient &&
                        accent === 'violet' &&
                        'hover:border-status-info/60 hover:shadow-status-info/15',
                      !useProviderGradient &&
                        accent === 'blue' &&
                        'hover:border-status-info/60 hover:shadow-status-info/15',
                      !useProviderGradient &&
                        accent === 'emerald' &&
                        'hover:border-status-income/60 hover:shadow-status-income/15',
                      !useProviderGradient &&
                        accent === 'neutral' &&
                        'hover:border-border',
                    ),
                );

                return (
                  <div
                    key={wallet.id}
                    data-wallet-strip-id={wallet.id}
                    onPointerDown={handleCardPointerDown(wallet.id)}
                    onContextMenu={handleCardContextMenu}
                    className={cn(
                      'group/wallet relative flex shrink-0 touch-manipulation',
                      draggingId === wallet.id && 'z-20',
                      draggingId != null &&
                        draggingId !== wallet.id &&
                        'opacity-70',
                    )}
                    aria-grabbed={draggingId === wallet.id}
                  >
                    {auraColors ? (
                      <span
                        aria-hidden
                        className={cn(
                          'pointer-events-none absolute inset-x-5 inset-y-2 rounded-xl blur-md transition-opacity duration-300 motion-reduce:transition-none',
                          isActiveCard
                            ? 'opacity-100'
                            : 'opacity-40 group-hover/wallet:opacity-90 dark:opacity-55',
                        )}
                        style={{
                          background: `linear-gradient(120deg, ${auraColors.glowStrong}, ${auraColors.glow})`,
                        }}
                      />
                    ) : null}
                    <button
                      type="button"
                      onClick={handleCardClick(wallet)}
                      className={cardClasses}
                      style={providerCardStyle}
                      aria-label={`Abrir detalles de ${wallet.name}. Usa el asa o mantén presionado para reordenar.`}
                    >
                      {useProviderGradient ? (
                        <>
                          <span
                            className={cn(
                              'pointer-events-none absolute -left-8 -top-10 h-20 w-20 rounded-full blur-2xl',
                              onDarkSurface ? 'bg-white/8' : 'bg-white/70',
                            )}
                          />
                          <span
                            className={cn(
                              'pointer-events-none absolute -right-8 -bottom-10 h-20 w-20 rounded-full blur-2xl',
                              onDarkSurface ? 'bg-black/20' : 'bg-black/5',
                            )}
                          />
                        </>
                      ) : null}
                      <AnimatedGridPattern
                        width={14}
                        height={14}
                        numSquares={shouldReduceMotion ? 0 : 6}
                        maxOpacity={0.5}
                        duration={2.5}
                        repeatDelay={1.5}
                        className={cn(
                          '-z-10 fill-transparent [mask-image:linear-gradient(115deg,white_10%,transparent_85%)]',
                          onDarkSurface
                            ? 'stroke-white/[0.06]'
                            : 'stroke-foreground/[0.06]',
                        )}
                        style={{ color: auraColors?.glow }}
                      />
                      {auraColors ? (
                        <ShineBorder
                          shineColor={auraColors.shine}
                          borderWidth={1.5}
                          duration={11}
                          style={{
                            animationDelay: `-${(wallet.id % 7) * 1.6}s`,
                          }}
                        />
                      ) : null}
                      {cardContent}
                    </button>
                    <span
                      role="button"
                      tabIndex={-1}
                      aria-label={`Reordenar ${wallet.name}`}
                      className={cn(
                        'absolute inset-y-0 right-0 z-10 flex w-8 touch-none items-center justify-center',
                        draggingId === wallet.id
                          ? 'cursor-grabbing'
                          : 'cursor-grab',
                      )}
                      onPointerDown={handleGripPointerDown(wallet.id)}
                      onContextMenu={handleCardContextMenu}
                    >
                      <GripVertical
                        className={cn(
                          'h-4 w-4',
                          onDarkSurface
                            ? 'text-white/45'
                            : 'text-muted-foreground/55',
                        )}
                        aria-hidden
                      />
                    </span>
                  </div>
                );
              })}
          </div>
          {orderedWallets.length > 1 ? (
            <>
              <div
                className="pointer-events-none absolute inset-y-3 left-0 z-10 w-6 bg-gradient-to-r from-background to-transparent"
                aria-hidden
              />
              <div
                className="pointer-events-none absolute inset-y-3 right-0 z-10 w-10 bg-gradient-to-l from-background to-transparent"
                aria-hidden
              />
            </>
          ) : null}
      </div>

      {selectedWallet && context ? (
        <WalletBalanceDialog
          open
          onOpenChange={(open) => {
            if (!open) setSelectedWallet(null);
          }}
          walletId={selectedWallet.id}
          walletName={selectedWallet.name}
          currentAmount={Number(selectedWallet.amount) || 0}
          context={context}
          variant={isCreditType(selectedWallet.type) ? 'credit' : 'funding'}
          creditLimit={selectedWallet.credit_limit}
          onSuccess={(newAmount) => {
            setBalanceOverrides((prev) => ({
              ...prev,
              [selectedWallet.id]: newAmount,
            }));
            setSelectedWallet((prev) =>
              prev && prev.id === selectedWallet.id
                ? { ...prev, amount: newAmount }
                : prev,
            );
            onBalancesPersisted?.();
          }}
        />
      ) : null}
    </>
  );
};

export default WalletBalanceStrip;
