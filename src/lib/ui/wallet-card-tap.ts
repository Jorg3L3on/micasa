/**
 * Tap vs swipe on the active Billeteras carousel card: the card opens Ajustar
 * saldo only on a real tap, never at the end of a horizontal drag.
 */

/** Pointer travel (px, either axis) above which a press counts as a drag. */
export const WALLET_CARD_TAP_SLOP_PX = 8;

/** Track scroll (px) since pointerdown above which the press was a swipe. */
export const WALLET_CARD_TAP_SCROLL_SLOP_PX = 1;

/** Where a press started: pointer position plus the track's scrollLeft. */
export type WalletCardPress = {
  x: number;
  y: number;
  scrollLeft: number;
};

/**
 * True when the click that ended `press` was a tap. A click with no recorded
 * press (assistive tech, synthetic clicks) counts as a tap.
 */
export const isWalletCardTap = (
  press: WalletCardPress | null,
  release: WalletCardPress,
  slopPx: number = WALLET_CARD_TAP_SLOP_PX,
): boolean => {
  if (!press) return true;
  const moved = Math.max(
    Math.abs(release.x - press.x),
    Math.abs(release.y - press.y),
  );
  if (moved > slopPx) return false;
  return (
    Math.abs(release.scrollLeft - press.scrollLeft) <=
    WALLET_CARD_TAP_SCROLL_SLOP_PX
  );
};
