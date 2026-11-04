import { describe, expect, it } from 'vitest';
import { isWalletCardTap, WALLET_CARD_TAP_SLOP_PX } from './wallet-card-tap';

const press = { x: 100, y: 50, scrollLeft: 240 };

describe('isWalletCardTap', () => {
  it('treats a press released in place as a tap', () => {
    expect(isWalletCardTap(press, { ...press })).toBe(true);
  });

  it('allows a little finger jitter within the slop', () => {
    expect(
      isWalletCardTap(press, {
        x: press.x + WALLET_CARD_TAP_SLOP_PX,
        y: press.y - 3,
        scrollLeft: press.scrollLeft,
      }),
    ).toBe(true);
  });

  it('rejects a horizontal drag past the slop', () => {
    expect(
      isWalletCardTap(press, { x: press.x - 30, y: press.y, scrollLeft: 240 }),
    ).toBe(false);
  });

  it('rejects a vertical drag past the slop', () => {
    expect(
      isWalletCardTap(press, { x: press.x, y: press.y + 12, scrollLeft: 240 }),
    ).toBe(false);
  });

  it('rejects a press during which the track scrolled', () => {
    expect(
      isWalletCardTap(press, { x: press.x, y: press.y, scrollLeft: 252 }),
    ).toBe(false);
  });

  it('ignores sub-pixel scroll rounding', () => {
    expect(
      isWalletCardTap(press, { x: press.x, y: press.y, scrollLeft: 240.5 }),
    ).toBe(true);
  });

  it('counts a click with no recorded press as a tap', () => {
    expect(isWalletCardTap(null, { x: 0, y: 0, scrollLeft: 0 })).toBe(true);
  });

  it('honors a custom slop', () => {
    const release = { x: press.x + 5, y: press.y, scrollLeft: 240 };
    expect(isWalletCardTap(press, release, 4)).toBe(false);
    expect(isWalletCardTap(press, release, 6)).toBe(true);
  });
});
