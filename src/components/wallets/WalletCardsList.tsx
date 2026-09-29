'use client';

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
  type ReactNode,
} from 'react';
import { motion } from 'framer-motion';
import { SPRING_LAYOUT } from '@/components/motion/ease';
import { cn } from '@/lib/utils';
import {
  buildWalletDeckSlots,
  INITIAL_WALLET_DECK_STATE,
  reduceWalletDeck,
  WALLET_DECK_CLEAR_CLASS,
  WALLET_DECK_OVERLAP_CLASS,
} from '@/lib/ui/wallet-deck';
import type { WalletListItem } from '@/types/catalog';

type WalletDeckContextValue = {
  isExpanded: (walletId: number) => boolean;
  isCollapsible: (walletId: number) => boolean;
  pointerDown: (walletId: number) => void;
  pointerToggle: (walletId: number) => void;
  keyboardToggle: (walletId: number) => void;
  focus: (walletId: number) => void;
  blur: (walletId: number) => void;
};

const WalletDeckContext = createContext<WalletDeckContextValue | null>(null);

const inertDeckCard = {
  expanded: false,
  collapsible: false,
  onPointerDown: () => {},
  onPointerToggle: () => {},
  onKeyboardToggle: () => {},
  onFocus: () => {},
  onBlur: () => {},
};

export const useWalletDeckCard = (walletId: number) => {
  const deck = useContext(WalletDeckContext);
  if (!deck) return inertDeckCard;
  return {
    expanded: deck.isExpanded(walletId),
    collapsible: deck.isCollapsible(walletId),
    onPointerDown: () => deck.pointerDown(walletId),
    onPointerToggle: () => deck.pointerToggle(walletId),
    onKeyboardToggle: () => deck.keyboardToggle(walletId),
    onFocus: () => deck.focus(walletId),
    onBlur: () => deck.blur(walletId),
  };
};

type WalletCardsListProps = {
  wallets: WalletListItem[];
  renderCard: (wallet: WalletListItem) => ReactNode;
  className?: string;
};

/**
 * Billeteras collection. Below `md` the items are a stacked plastic deck:
 * a collapsed card shows its top strip, touch or focus reveals the full face,
 * and the last card is always complete. From `md` up the same items are a grid.
 */
export const WalletCardsList = ({
  wallets,
  renderCard,
  className,
}: WalletCardsListProps) => {
  const [state, dispatch] = useReducer(
    reduceWalletDeck,
    INITIAL_WALLET_DECK_STATE,
  );
  const [isNarrow, setIsNarrow] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const widthQuery = window.matchMedia('(max-width: 767px)');
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => {
      setIsNarrow(widthQuery.matches);
      setReduceMotion(motionQuery.matches);
    };
    sync();
    widthQuery.addEventListener('change', sync);
    motionQuery.addEventListener('change', sync);
    return () => {
      widthQuery.removeEventListener('change', sync);
      motionQuery.removeEventListener('change', sync);
    };
  }, []);

  useEffect(() => {
    if (state.activeId == null) return;
    if (wallets.some((wallet) => wallet.id === state.activeId)) return;
    dispatch({ type: 'blur', id: state.activeId });
  }, [state.activeId, wallets]);

  const slots = useMemo(
    () =>
      buildWalletDeckSlots(
        wallets.map((wallet) => wallet.id),
        state.activeId,
      ),
    [state.activeId, wallets],
  );

  const deck = useMemo<WalletDeckContextValue>(
    () => ({
      isExpanded: (walletId) => {
        const index = wallets.findIndex((wallet) => wallet.id === walletId);
        if (index < 0) return false;
        return slots[index]?.expanded ?? false;
      },
      isCollapsible: (walletId) => {
        const index = wallets.findIndex((wallet) => wallet.id === walletId);
        return index >= 0 && index < wallets.length - 1;
      },
      pointerDown: (walletId) =>
        dispatch({ type: 'pointer-down', id: walletId }),
      pointerToggle: (walletId) =>
        dispatch({ type: 'pointer-toggle', id: walletId }),
      keyboardToggle: (walletId) =>
        dispatch({ type: 'keyboard-toggle', id: walletId }),
      focus: (walletId) => dispatch({ type: 'focus', id: walletId }),
      blur: (walletId) => dispatch({ type: 'blur', id: walletId }),
    }),
    [slots, wallets],
  );

  const animateDeck = isNarrow && !reduceMotion;

  return (
    <WalletDeckContext.Provider value={deck}>
      <ul
        className={cn(
          'isolate flex w-full list-none flex-col p-0',
          'md:grid md:grid-cols-2 md:gap-5 md:py-1',
          '@min-[1045px]:!grid-cols-3',
          className,
        )}
        role="list"
        aria-label="Billeteras"
      >
        {wallets.map((wallet, index) => {
          const slot = slots[index];
          const isActive = state.activeId === wallet.id;
          const itemClassName = cn(
            'relative min-w-0 origin-center md:mt-0',
            slot?.overlapPrevious && WALLET_DECK_OVERLAP_CLASS,
            slot?.clearPrevious && WALLET_DECK_CLEAR_CLASS,
          );
          const itemStyle = { zIndex: slot?.zIndex ?? index + 1 };
          const card = renderCard(wallet);

          if (!animateDeck) {
            return (
              <li
                key={wallet.id}
                data-wallet-card-id={wallet.id}
                data-expanded={slot?.expanded ? 'true' : 'false'}
                className={itemClassName}
                style={itemStyle}
              >
                {card}
              </li>
            );
          }

          return (
            <motion.li
              key={wallet.id}
              layout
              data-wallet-card-id={wallet.id}
              data-expanded={slot?.expanded ? 'true' : 'false'}
              className={itemClassName}
              style={itemStyle}
              transition={SPRING_LAYOUT}
              initial={false}
              animate={isActive ? { scale: 1.035 } : { scale: 1 }}
            >
              {card}
            </motion.li>
          );
        })}
      </ul>
    </WalletDeckContext.Provider>
  );
};
