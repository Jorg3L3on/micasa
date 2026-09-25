import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchMonthlyPanelSnapshot } from '@/lib/api/monthly-panel';
import { clientFetchFromApi } from '@/lib/api/client-fetch';

vi.mock('@/lib/api/client-fetch', () => ({
  clientFetchFromApi: vi.fn(),
}));

const context = { type: 'user' as const, id: 1 };

const wallet = (id: number, active: boolean) => ({
  id,
  name: `Wallet ${id}`,
  active,
});

describe('fetchMonthlyPanelSnapshot', () => {
  beforeEach(() => {
    vi.mocked(clientFetchFromApi).mockReset();
  });

  it('loads both fortnights, budget, active wallets, cards, and loans', async () => {
    vi.mocked(clientFetchFromApi).mockImplementation(async (url: string) => {
      if (url.includes('/api/transactions') && url.includes('period=FIRST')) {
        return [{ id: 1 }];
      }
      if (url.includes('/api/transactions') && url.includes('period=SECOND')) {
        return [{ id: 2 }];
      }
      if (url.includes('/api/reports') && url.includes('period=FIRST')) {
        return { totalIncome: 10 };
      }
      if (url.includes('/api/reports') && url.includes('period=SECOND')) {
        return { totalIncome: 20 };
      }
      if (url.includes('/budget-panel')) {
        return { first: { available: 1 }, second: { available: 2 } };
      }
      if (url === '/api/wallets') {
        return [wallet(1, true), wallet(2, false)];
      }
      if (url.includes('/api/wallets/due-payments')) {
        return { first: [{ walletId: 1 }], second: [] };
      }
      if (url.includes('/api/loans/planner')) {
        return { first: [], second: [{ id: 9 }] };
      }
      throw new Error(`Unexpected url ${url}`);
    });

    const snapshot = await fetchMonthlyPanelSnapshot<{ totalIncome: number }>(
      2026,
      9,
      context,
    );

    expect(snapshot.first.transactions).toEqual([{ id: 1 }]);
    expect(snapshot.second.summary).toEqual({ totalIncome: 20 });
    expect(snapshot.wallets).toEqual([wallet(1, true)]);
    expect(snapshot.cardDues.first).toEqual([{ walletId: 1 }]);
    expect(snapshot.loanDues.second).toEqual([{ id: 9 }]);
    expect(snapshot.budgetPanel).toEqual({
      first: { available: 1 },
      second: { available: 2 },
    });
    expect(
      vi.mocked(clientFetchFromApi).mock.calls.some(([url]) =>
        String(url).includes('month=09'),
      ),
    ).toBe(true);
  });
});
