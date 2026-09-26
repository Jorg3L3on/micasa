'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import {
  LayoutGroup,
  motion,
  useReducedMotion,
  type Transition,
} from 'framer-motion';
import { SPRING_LAYOUT } from '@/components/motion/ease';
import { WALLET_LIST_STACK_OVERLAP_CLASS } from '@/lib/ui/wallet-card-view-transition';
import { cn } from '@/lib/utils';
import type { WalletListItem } from '@/types/catalog';

/** Breathing room when a stacked card is fully revealed. */
const STACK_ACTIVE_CLASS = 'max-md:mt-2 max-md:mb-4';
/** Clear overlap under an active card without promoting the next one. */
const STACK_CLEAR_OVERLAP_CLASS = 'max-md:mt-2';

const CLEAR_DELAY_MS = 120;

type WalletCardsListProps = {
  wallets: WalletListItem[];
  renderCard: (wallet: WalletListItem) => ReactNode;
  className?: string;
};

/**
 * Resolves which stacked card owns the pointer by paint order (topmost wins),
 * so the seam between two overlapped cards cannot activate both.
 */
const cardIdFromPoint = (clientX: number, clientY: number): number | null => {
  if (typeof document === 'undefined') return null;
  const stack = document.elementsFromPoint(clientX, clientY);
  for (const node of stack) {
    if (!(node instanceof Element)) continue;
    const host = node.closest('[data-wallet-card-id]');
    if (!(host instanceof HTMLElement)) continue;
    const id = Number(host.dataset.walletCardId);
    if (Number.isFinite(id)) return id;
  }
  return null;
};

/**
 * Wallet deck: mobile stacked peek with hover/focus expand that springs
 * neighbors apart. Pointer ownership uses elementsFromPoint so only one card
 * is active at the overlap seam.
 */
export const WalletCardsList = ({
  wallets,
  renderCard,
  className,
}: WalletCardsListProps) => {
  const reduceMotion = useReducedMotion();
  const [activeId, setActiveId] = useState<number | null>(null);
  const clearTimerRef = useRef<number | null>(null);
  const activeIdRef = useRef<number | null>(null);

  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  useEffect(() => {
    return () => {
      if (clearTimerRef.current != null) {
        window.clearTimeout(clearTimerRef.current);
      }
    };
  }, []);

  const cancelClear = useCallback(() => {
    if (clearTimerRef.current == null) return;
    window.clearTimeout(clearTimerRef.current);
    clearTimerRef.current = null;
  }, []);

  const scheduleClear = useCallback(() => {
    cancelClear();
    clearTimerRef.current = window.setTimeout(() => {
      setActiveId(null);
      clearTimerRef.current = null;
    }, CLEAR_DELAY_MS);
  }, [cancelClear]);

  const setActiveFromPoint = useCallback(
    (clientX: number, clientY: number) => {
      const id = cardIdFromPoint(clientX, clientY);
      if (id == null) {
        scheduleClear();
        return;
      }
      cancelClear();
      if (activeIdRef.current === id) return;
      setActiveId(id);
    },
    [cancelClear, scheduleClear],
  );

  const handleListPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLUListElement>) => {
      if (event.pointerType === 'touch') return;
      setActiveFromPoint(event.clientX, event.clientY);
    },
    [setActiveFromPoint],
  );

  const handleListPointerLeave = useCallback(
    (event: ReactPointerEvent<HTMLUListElement>) => {
      if (event.pointerType === 'touch') return;
      const next = event.relatedTarget;
      if (next instanceof Node && event.currentTarget.contains(next)) return;
      scheduleClear();
    },
    [scheduleClear],
  );

  const transition: Transition = reduceMotion
    ? { duration: 0 }
    : SPRING_LAYOUT;

  return (
    <LayoutGroup id="wallet-cards-list">
      <ul
        className={cn(
          'isolate flex w-full list-none flex-col p-0',
          'md:grid md:grid-cols-2 md:gap-5 md:py-1',
          '@min-[1045px]:!grid-cols-3',
          className,
        )}
        role="list"
        aria-label="Billeteras"
        onPointerMove={handleListPointerMove}
        onPointerLeave={handleListPointerLeave}
      >
        {wallets.map((wallet, index) => {
          const isActive = activeId === wallet.id;
          const isNextAfterActive =
            index > 0 && activeId === wallets[index - 1]?.id;
          const usePeekOverlap =
            index > 0 && !isActive && !isNextAfterActive;

          return (
            <motion.li
              key={wallet.id}
              layout={!reduceMotion}
              transition={transition}
              data-wallet-card-id={wallet.id}
              onFocusCapture={() => {
                cancelClear();
                setActiveId(wallet.id);
              }}
              onBlurCapture={(event) => {
                const next = event.relatedTarget;
                if (
                  next instanceof Node &&
                  event.currentTarget.contains(next)
                ) {
                  return;
                }
                scheduleClear();
              }}
              className={cn(
                'relative min-w-0 origin-center md:mt-0',
                usePeekOverlap && WALLET_LIST_STACK_OVERLAP_CLASS,
                isActive && STACK_ACTIVE_CLASS,
                isNextAfterActive && !isActive && STACK_CLEAR_OVERLAP_CLASS,
              )}
              style={{
                // Paint order stays stable by index; only the active card
                // jumps above so the seam always has a single topmost target.
                zIndex: isActive ? wallets.length + 2 : index + 1,
              }}
              animate={
                reduceMotion
                  ? undefined
                  : isActive
                    ? { scale: 1.035 }
                    : { scale: 1 }
              }
            >
              <div
                className={cn(
                  'h-full transition-[filter] duration-300 ease-out motion-reduce:transition-none',
                  isActive
                    ? 'drop-shadow-[0_22px_36px_rgba(0,0,0,0.5)] drop-shadow-[0_10px_20px_rgba(58,55,252,0.2)]'
                    : 'drop-shadow-none',
                )}
              >
                {renderCard(wallet)}
              </div>
            </motion.li>
          );
        })}
      </ul>
    </LayoutGroup>
  );
};
