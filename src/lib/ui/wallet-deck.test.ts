import { describe, expect, it } from 'vitest';
import {
  INITIAL_WALLET_DECK_STATE,
  WALLET_DECK_CLEAR_CLASS,
  WALLET_DECK_COLLAPSED_PADDING_CLASS,
  WALLET_DECK_LIP_PX,
  WALLET_DECK_OVERLAP_CLASS,
  WALLET_DECK_STRIP_CONTENT_PX,
  buildWalletDeckSlots,
  reduceWalletDeck,
  walletDeckLipClearsPrimaryAmount,
  walletDeckToneClass,
} from './wallet-deck';

describe('wallet deck strip', () => {
  it('keeps the overlap inside the collapsed bottom padding so the amount stays visible', () => {
    expect(walletDeckLipClearsPrimaryAmount()).toBe(true);
    expect(WALLET_DECK_LIP_PX).toBeLessThan(24);
    expect(WALLET_DECK_OVERLAP_CLASS).toBe('max-md:-mt-3');
    expect(WALLET_DECK_CLEAR_CLASS).toBe('max-md:mt-4');
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
  const ids = [10, 20, 30];

  it('shows a strip on every card except the last when nothing is expanded', () => {
    const slots = buildWalletDeckSlots(ids, null);
    expect(slots.map((slot) => slot.expanded)).toEqual([false, false, true]);
    expect(slots.map((slot) => slot.overlapPrevious)).toEqual([
      false,
      true,
      true,
    ]);
    expect(slots.every((slot) => !slot.clearPrevious)).toBe(true);
  });

  it('reveals the active card and moves the next card below it', () => {
    const slots = buildWalletDeckSlots(ids, 20);
    expect(slots[1]?.expanded).toBe(true);
    expect(slots[1]?.overlapPrevious).toBe(true);
    expect(slots[2]?.overlapPrevious).toBe(false);
    expect(slots[2]?.clearPrevious).toBe(true);
    expect(slots[1]?.zIndex).toBeGreaterThan(slots[2]?.zIndex ?? 0);
    expect(slots[1]?.zIndex).toBeGreaterThan(slots[0]?.zIndex ?? 0);
  });

  it('never overlaps and clears the same card', () => {
    for (const activeId of [null, 10, 20, 30]) {
      for (const slot of buildWalletDeckSlots(ids, activeId)) {
        expect(slot.overlapPrevious && slot.clearPrevious).toBe(false);
      }
    }
  });

  it('keeps a single card fully visible', () => {
    const [only] = buildWalletDeckSlots([7], null);
    expect(only).toMatchObject({
      expanded: true,
      overlapPrevious: false,
      clearPrevious: false,
    });
  });
});

describe('reduceWalletDeck', () => {
  it('expands on focus and stays open through the pointer click that follows pointerdown', () => {
    let state = reduceWalletDeck(INITIAL_WALLET_DECK_STATE, {
      type: 'pointer-down',
      id: 2,
    });
    state = reduceWalletDeck(state, { type: 'focus', id: 2 });
    state = reduceWalletDeck(state, { type: 'pointer-toggle', id: 2 });
    expect(state.activeId).toBe(2);
  });

  it('collapses an expanded card on the next tap', () => {
    let state = reduceWalletDeck(INITIAL_WALLET_DECK_STATE, {
      type: 'focus',
      id: 2,
    });
    state = reduceWalletDeck(state, { type: 'pointer-down', id: 2 });
    state = reduceWalletDeck(state, { type: 'pointer-toggle', id: 2 });
    expect(state.activeId).toBeNull();
  });

  it('toggles with Enter and Space without using the pointer snapshot', () => {
    let state = reduceWalletDeck(INITIAL_WALLET_DECK_STATE, {
      type: 'focus',
      id: 1,
    });
    state = reduceWalletDeck(state, { type: 'keyboard-toggle', id: 1 });
    expect(state.activeId).toBeNull();
    state = reduceWalletDeck(state, { type: 'keyboard-toggle', id: 1 });
    expect(state.activeId).toBe(1);
  });

  it('ignores a pointer toggle that does not match the pointerdown', () => {
    const state = reduceWalletDeck(INITIAL_WALLET_DECK_STATE, {
      type: 'pointer-toggle',
      id: 4,
    });
    expect(state.activeId).toBeNull();
  });

  it('collapses on blur only for the active card', () => {
    const expanded = reduceWalletDeck(INITIAL_WALLET_DECK_STATE, {
      type: 'focus',
      id: 2,
    });
    expect(
      reduceWalletDeck(expanded, { type: 'blur', id: 1 }).activeId,
    ).toBe(2);
    expect(
      reduceWalletDeck(expanded, { type: 'blur', id: 2 }).activeId,
    ).toBeNull();
  });
});
