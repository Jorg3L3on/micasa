import { describe, expect, it } from 'vitest';
import {
  buildWalletAttentionCards,
  pickHighestUsageWallet,
  pickNextDuePayment,
} from './wallet-attention';

describe('pickHighestUsageWallet', () => {
  it('picks highest usage percent', () => {
    const winner = pickHighestUsageWallet([
      {
        id: 1,
        name: 'Amex',
        type: 'CREDIT_CARD',
        amount: 1000,
        credit_limit: 10000,
      },
      {
        id: 2,
        name: 'LikeU',
        type: 'CREDIT_CARD',
        amount: 8000,
        credit_limit: 10000,
      },
    ]);
    expect(winner?.id).toBe(2);
  });

  it('skips when all usage is 0%', () => {
    expect(
      pickHighestUsageWallet([
        {
          id: 1,
          name: 'Amex',
          type: 'CREDIT_CARD',
          amount: 0,
          credit_limit: 10000,
        },
      ]),
    ).toBeNull();
  });

  it('excludes limit=0 and used=0', () => {
    expect(
      pickHighestUsageWallet([
        {
          id: 1,
          name: 'Empty',
          type: 'CREDIT_CARD',
          amount: 0,
          credit_limit: 0,
        },
        {
          id: 2,
          name: 'LikeU',
          type: 'CREDIT_CARD',
          amount: 4000,
          credit_limit: 10000,
        },
      ])?.id,
    ).toBe(2);
  });

  it('tie-breaks by higher debt', () => {
    const winner = pickHighestUsageWallet([
      {
        id: 1,
        name: 'A',
        type: 'CREDIT_CARD',
        amount: 4000,
        credit_limit: 10000,
      },
      {
        id: 2,
        name: 'B',
        type: 'CREDIT_CARD',
        amount: 5000,
        credit_limit: 12500,
      },
    ]);
    expect(winner?.id).toBe(2);
  });
});

describe('pickNextDuePayment', () => {
  it('picks soonest statement due date', () => {
    const winner = pickNextDuePayment([
      {
        walletId: 1,
        walletName: 'Amex',
        nextDuePayment: 100,
        statementDueDate: '2026-07-28',
      },
      {
        walletId: 2,
        walletName: 'LikeU',
        nextDuePayment: 500,
        statementDueDate: '2026-07-15',
      },
    ]);
    expect(winner?.walletId).toBe(2);
  });

  it('ignores zero nextDuePayment', () => {
    expect(
      pickNextDuePayment([
        {
          walletId: 1,
          walletName: 'Amex',
          nextDuePayment: 0,
          statementDueDate: '2026-07-10',
        },
      ]),
    ).toBeNull();
  });

  it('tie-breaks same date by higher amount', () => {
    const winner = pickNextDuePayment([
      {
        walletId: 1,
        walletName: 'A',
        nextDuePayment: 200,
        statementDueDate: '2026-07-20',
      },
      {
        walletId: 2,
        walletName: 'B',
        nextDuePayment: 900,
        statementDueDate: '2026-07-20',
      },
    ]);
    expect(winner?.walletId).toBe(2);
  });
});

describe('buildWalletAttentionCards', () => {
  it('dedupes when same wallet wins both slots', () => {
    const cards = buildWalletAttentionCards({
      wallets: [
        {
          id: 7,
          name: 'LikeU',
          type: 'CREDIT_CARD',
          amount: 8330,
          credit_limit: 19300,
          provider_icon_key: null,
        },
      ],
      duePayments: [
        {
          walletId: 7,
          walletName: 'LikeU',
          nextDuePayment: 4200,
          statementDueDate: '2026-07-28',
        },
      ],
    });
    expect(cards).toHaveLength(1);
    expect(cards[0]?.roles).toEqual(['usage', 'payment']);
    expect(cards[0]?.usagePercent).toBeCloseTo(43.16, 1);
    expect(cards[0]?.nextDuePayment).toBe(4200);
  });

  it('returns two cards when winners differ', () => {
    const cards = buildWalletAttentionCards({
      wallets: [
        {
          id: 1,
          name: 'LikeU',
          type: 'CREDIT_CARD',
          amount: 8000,
          credit_limit: 10000,
        },
        {
          id: 2,
          name: 'Amex',
          type: 'CREDIT_CARD',
          amount: 1000,
          credit_limit: 10000,
        },
      ],
      duePayments: [
        {
          walletId: 2,
          walletName: 'Amex',
          nextDuePayment: 500,
          statementDueDate: '2026-07-20',
        },
      ],
    });
    expect(cards).toHaveLength(2);
    expect(cards[0]?.roles).toEqual(['usage']);
    expect(cards[0]?.walletId).toBe(1);
    expect(cards[1]?.roles).toEqual(['payment']);
    expect(cards[1]?.walletId).toBe(2);
  });

  it('returns empty when nothing qualifies', () => {
    expect(
      buildWalletAttentionCards({
        wallets: [
          {
            id: 1,
            name: 'Amex',
            type: 'CREDIT_CARD',
            amount: 0,
            credit_limit: 10000,
          },
        ],
        duePayments: [
          {
            walletId: 1,
            walletName: 'Amex',
            nextDuePayment: 0,
            statementDueDate: '2026-07-20',
          },
        ],
      }),
    ).toEqual([]);
  });
});
