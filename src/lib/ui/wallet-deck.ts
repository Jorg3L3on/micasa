/**
 * Mobile Billeteras deck (<md).
 *
 * A collapsed card is only the top strip (icon, name, type or cycle, primary
 * amount) plus bottom padding. The next card covers that padding (`-mt-3`,
 * 12px), which is less than the collapsed bottom padding (`pb-6`, 24px), so
 * the amount stays visible. The last card is always fully revealed. The card
 * after an expanded one uses a positive margin so it does not cover the face.
 */

export const WALLET_DECK_LIP_PX = 12;
export const WALLET_DECK_COLLAPSED_BOTTOM_PADDING_PX = 24;
/** Border + top padding + icon row + amount label + 3xl line. */
export const WALLET_DECK_STRIP_CONTENT_PX = 120;

export const WALLET_DECK_OVERLAP_CLASS = 'max-md:-mt-3';
export const WALLET_DECK_CLEAR_CLASS = 'max-md:mt-4';
export const WALLET_DECK_COLLAPSED_PADDING_CLASS = 'p-4 pb-6';

/** Deuda, Saldo, and Disponible stay on the plastic face. */
export const WALLET_DECK_AMOUNT_TEXT_CLASS = 'text-white';
/** Alert pink on the mobile deck is the inset ring. */
export const WALLET_DECK_ALERT_RING_CLASS =
  'ring-2 ring-inset ring-status-expense/70';
/** Alert pink on the mobile deck is also the "Excedido" label. */
export const WALLET_DECK_EXCEEDED_TEXT_CLASS = 'text-status-expense';

export type WalletDeckToneSlot = 'amount' | 'alert-ring' | 'exceeded';

export const walletDeckToneClass = (slot: WalletDeckToneSlot): string => {
  if (slot === 'alert-ring') return WALLET_DECK_ALERT_RING_CLASS;
  if (slot === 'exceeded') return WALLET_DECK_EXCEEDED_TEXT_CLASS;
  return WALLET_DECK_AMOUNT_TEXT_CLASS;
};

export const walletDeckLipClearsPrimaryAmount = (): boolean =>
  WALLET_DECK_LIP_PX < WALLET_DECK_COLLAPSED_BOTTOM_PADDING_PX &&
  WALLET_DECK_STRIP_CONTENT_PX > 0;

export type WalletDeckSlot = {
  /** Full face: active card, or the last card in the deck. */
  expanded: boolean;
  /** Pull this card up over the previous card's bottom padding. */
  overlapPrevious: boolean;
  /** Sit below an expanded card instead of covering it. */
  clearPrevious: boolean;
  zIndex: number;
};

export const resolveWalletDeckSlot = ({
  index,
  count,
  isActive,
  previousIsActive,
}: {
  index: number;
  count: number;
  isActive: boolean;
  previousIsActive: boolean;
}): WalletDeckSlot => {
  const isLast = count > 0 && index === count - 1;
  return {
    expanded: isActive || isLast,
    overlapPrevious: index > 0 && !previousIsActive,
    clearPrevious: index > 0 && previousIsActive,
    zIndex: isActive ? count + 2 : index + 1,
  };
};

export const buildWalletDeckSlots = (
  ids: readonly number[],
  activeId: number | null,
): WalletDeckSlot[] =>
  ids.map((id, index) =>
    resolveWalletDeckSlot({
      index,
      count: ids.length,
      isActive: id === activeId,
      previousIsActive: index > 0 && ids[index - 1] === activeId,
    }),
  );

export type WalletDeckState = {
  activeId: number | null;
  pointerId: number | null;
  pointerStartedExpanded: boolean;
};

export const INITIAL_WALLET_DECK_STATE: WalletDeckState = {
  activeId: null,
  pointerId: null,
  pointerStartedExpanded: false,
};

export type WalletDeckAction =
  | { type: 'pointer-down'; id: number }
  | { type: 'pointer-toggle'; id: number }
  | { type: 'keyboard-toggle'; id: number }
  | { type: 'focus'; id: number }
  | { type: 'blur'; id: number };

export const reduceWalletDeck = (
  state: WalletDeckState,
  action: WalletDeckAction,
): WalletDeckState => {
  switch (action.type) {
    case 'pointer-down':
      return {
        ...state,
        pointerId: action.id,
        pointerStartedExpanded: state.activeId === action.id,
      };
    case 'pointer-toggle':
      if (state.pointerId !== action.id) return state;
      return {
        ...state,
        pointerId: null,
        activeId: state.pointerStartedExpanded ? null : action.id,
      };
    case 'keyboard-toggle':
      return {
        ...state,
        activeId: state.activeId === action.id ? null : action.id,
      };
    case 'focus':
      return { ...state, activeId: action.id };
    case 'blur':
      if (state.activeId !== action.id) return state;
      return { ...state, activeId: null };
    default:
      return state;
  }
};
