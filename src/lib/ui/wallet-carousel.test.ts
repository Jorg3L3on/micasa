import { describe, expect, it } from 'vitest';
import {
  clampCarouselIndex,
  firstCarouselTypeWithWallets,
  getWalletCarouselActionPlan,
  getWalletCreditSummary,
  groupWalletsByCarouselType,
  parseWalletCarouselTab,
  resolveCarouselSwipe,
} from './wallet-carousel';

describe('getWalletCarouselActionPlan', () => {
  it('maps cash and debit to balance / expense / income dialogs', () => {
    for (const type of ['CASH', 'DEBIT_CARD']) {
      expect(getWalletCarouselActionPlan(type)).toMatchObject({
        topUp: 'balance',
        addExpense: 'expense',
        request: 'income',
        balanceVariant: 'funding',
      });
    }
  });

  it('maps credit and store to balance / purchase / payment dialogs', () => {
    for (const type of ['CREDIT_CARD', 'DEPARTMENT_STORE_CARD']) {
      expect(getWalletCarouselActionPlan(type)).toMatchObject({
        topUp: 'balance',
        addExpense: 'purchase',
        request: 'payment',
        balanceVariant: 'credit',
      });
    }
  });
});

describe('groupWalletsByCarouselType', () => {
  it('groups by type and drops goal wallets', () => {
    const groups = groupWalletsByCarouselType([
      { id: 1, type: 'DEBIT_CARD' },
      { id: 2, type: 'GOAL' },
      { id: 3, type: 'CASH' },
      { id: 4, type: 'DEBIT_CARD' },
    ]);
    expect(groups.DEBIT_CARD.map((w) => w.id)).toEqual([1, 4]);
    expect(groups.CASH.map((w) => w.id)).toEqual([3]);
    expect(groups.CREDIT_CARD).toEqual([]);
  });

  it('picks the first non-empty tab, falling back to the first tab', () => {
    expect(
      firstCarouselTypeWithWallets(
        groupWalletsByCarouselType([{ type: 'CASH' }]),
      ),
    ).toBe('CASH');
    expect(firstCarouselTypeWithWallets(groupWalletsByCarouselType([]))).toBe(
      'DEBIT_CARD',
    );
  });
});

describe('carousel helpers', () => {
  it('parses only known stored tabs', () => {
    expect(parseWalletCarouselTab('CASH')).toBe('CASH');
    expect(parseWalletCarouselTab('GOAL')).toBeNull();
    expect(parseWalletCarouselTab(null)).toBeNull();
  });

  it('clamps the index', () => {
    expect(clampCarouselIndex(5, 3)).toBe(2);
    expect(clampCarouselIndex(-1, 3)).toBe(0);
    expect(clampCarouselIndex(2, 0)).toBe(0);
  });

  it('resolves swipes by distance or velocity', () => {
    expect(resolveCarouselSwipe({ offsetX: -80, velocityX: 0 })).toBe(1);
    expect(resolveCarouselSwipe({ offsetX: 80, velocityX: 0 })).toBe(-1);
    expect(resolveCarouselSwipe({ offsetX: 10, velocityX: -900 })).toBe(1);
    expect(resolveCarouselSwipe({ offsetX: 10, velocityX: 10 })).toBe(0);
  });

  it('summarises credit using the larger of contract and temporary limit', () => {
    expect(
      getWalletCreditSummary({
        amount: 1000,
        credit_limit: 5000,
        temporary_credit_limit: 8000,
      }),
    ).toEqual({ used: 1000, limit: 8000, available: 7000 });
    expect(getWalletCreditSummary({ amount: 9000, credit_limit: 5000 })).toEqual(
      { used: 9000, limit: 5000, available: 0 },
    );
    expect(getWalletCreditSummary({ amount: 10 })).toEqual({
      used: 10,
      limit: null,
      available: null,
    });
  });
});
