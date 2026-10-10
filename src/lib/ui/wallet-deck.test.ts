import { describe, expect, it } from 'vitest';
import {
  WALLET_DECK_COLLAPSED_PADDING_CLASS,
  WALLET_DECK_LIP_PX,
  WALLET_DECK_OVERLAP_CLASS,
  WALLET_DECK_STRIP_CONTENT_PX,
  buildWalletDeckSlots,
  walletDeckLipClearsPrimaryAmount,
  walletDeckToneClass,
} from './wallet-deck';

describe('wallet deck strip', () => {
  it('keeps the overlap inside the collapsed bottom padding so the amount stays visible', () => {
    expect(walletDeckLipClearsPrimaryAmount()).toBe(true);
    expect(WALLET_DECK_LIP_PX).toBeLessThan(24);
    expect(WALLET_DECK_OVERLAP_CLASS).toBe('max-md:-mt-3');
    expect(WALLET_DECK_COLLAPSED_PADDING_CLASS).toContain('pb-6');
    expect(WALLET_DECK_STRIP_CONTENT_PX).toBeGreaterThanOrEqual(100);
  });
});

describe('wallet deck tone', () => {
  it('keeps Deuda, Saldo, and Disponible on the face color', () => {
    expect(walletDeckToneClass('amount')).toBe('text-white');
    expect(walletDeckToneClass('amount')).not.toContain('text-status-expense');
  });

  it('uses expense pink only on the alert ring and the Excedido label', () => {
    expect(walletDeckToneClass('alert-ring')).toContain('ring-status-expense');
    expect(walletDeckToneClass('alert-ring')).not.toContain(
      'text-status-expense',
    );
    expect(walletDeckToneClass('exceeded')).toBe('text-status-expense');
  });
});

describe('buildWalletDeckSlots', () => {
  it('shows a strip on every card except the last', () => {
    const slots = buildWalletDeckSlots(3);
    expect(slots.map((slot) => slot.expanded)).toEqual([false, false, true]);
    expect(slots.map((slot) => slot.overlapPrevious)).toEqual([
      false,
      true,
      true,
    ]);
    expect(slots.map((slot) => slot.zIndex)).toEqual([1, 2, 3]);
  });

  it('keeps a single card fully visible', () => {
    const [only] = buildWalletDeckSlots(1);
    expect(only).toMatchObject({ expanded: true, overlapPrevious: false });
  });

  it('returns no slots for an empty deck', () => {
    expect(buildWalletDeckSlots(0)).toEqual([]);
  });
});
