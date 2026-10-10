/**
 * Mobile Billeteras deck (<md).
 *
 * A collapsed card is only the top strip (icon, name, type or cycle, primary
 * amount) plus bottom padding. The next card covers that padding (`-mt-3`,
 * 12px), which is less than the collapsed bottom padding (`pb-6`, 24px), so
 * the amount stays visible. The last card is always fully revealed.
 * Tapping a card opens its detail; long press shows the enlarged card.
 */

export const WALLET_DECK_LIP_PX = 12;
export const WALLET_DECK_COLLAPSED_BOTTOM_PADDING_PX = 24;
/** Border + top padding + icon row + amount label + 3xl line. */
export const WALLET_DECK_STRIP_CONTENT_PX = 120;

export const WALLET_DECK_OVERLAP_CLASS = 'max-md:-mt-3';
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
  /** Full face: only the last card in the deck. */
  expanded: boolean;
  /** Pull this card up over the previous card's bottom padding. */
  overlapPrevious: boolean;
  zIndex: number;
};

export const resolveWalletDeckSlot = ({
  index,
  count,
}: {
  index: number;
  count: number;
}): WalletDeckSlot => {
  const isLast = count > 0 && index === count - 1;
  return {
    expanded: isLast,
    overlapPrevious: index > 0,
    zIndex: index + 1,
  };
};

export const buildWalletDeckSlots = (count: number): WalletDeckSlot[] =>
  Array.from({ length: count }, (_, index) =>
    resolveWalletDeckSlot({ index, count }),
  );
