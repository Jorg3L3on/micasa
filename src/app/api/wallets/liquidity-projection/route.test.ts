import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { getOwnerContext, getLiquidityProjection } = vi.hoisted(() => ({
  getOwnerContext: vi.fn(),
  getLiquidityProjection: vi.fn(),
}));

vi.mock('@/lib/server/get-owner-context', () => ({ getOwnerContext }));

vi.mock('@/lib/observability/finance-log', () => ({ logFinanceEvent: vi.fn() }));

vi.mock('@/lib/finance/liquidity-projection.service', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/lib/finance/liquidity-projection.service')>();
  return { ...actual, getLiquidityProjection };
});

import { GET } from '@/app/api/wallets/liquidity-projection/route';
import { LiquidityScenarioWalletError } from '@/lib/finance/liquidity-projection.service';

const ownerContext = {
  userId: 1,
  ownerType: 'user' as const,
  ownerId: 1,
  ownerFilter: { user_id: 1, house_id: null },
  role: 'owner' as const,
};

const projection = {
  as_of: '2026-03-10',
  until: '2026-06-30',
  milestones: [],
};

const get = (scenario?: unknown) => {
  const url = new URL('http://localhost/api/wallets/liquidity-projection');
  url.searchParams.set('until', '2026-06-30');
  if (scenario !== undefined) {
    url.searchParams.set(
      'scenario',
      typeof scenario === 'string' ? scenario : JSON.stringify(scenario),
    );
  }
  return GET(new NextRequest(url));
};

describe('GET /api/wallets/liquidity-projection scenario', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.UTC(2026, 2, 10, 18, 0, 0)));
    getOwnerContext.mockReset();
    getOwnerContext.mockResolvedValue(ownerContext);
    getLiquidityProjection.mockReset();
    getLiquidityProjection.mockResolvedValue(projection);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('passes a valid scenario to the service', async () => {
    const scenario = [
      { kind: 'purchase', amount: 800, date: '2026-03-20', wallet_id: 10 },
      { kind: 'instalment', amount: 300, firstDate: '2026-04-01', months: 3, wallet_id: 7 },
    ];
    const res = await get(scenario);
    expect(res.status).toBe(200);
    expect(getLiquidityProjection).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerFilter: ownerContext.ownerFilter,
        scenario,
      }),
    );
  });

  it('calls the service without a scenario when the parameter is absent', async () => {
    await get();
    expect(getLiquidityProjection.mock.calls[0]?.[0].scenario).toBeUndefined();
  });

  it.each([
    [
      'amount 0',
      [{ kind: 'purchase', amount: 0, date: '2026-03-20', wallet_id: 10 }],
      { field: 'amount', index: 0, error: 'El monto debe ser mayor a $0.' },
    ],
    [
      'negative amount',
      [{ kind: 'instalment', amount: -5, firstDate: '2026-03-20', months: 2, wallet_id: 10 }],
      { field: 'amount', index: 0, error: 'El monto debe ser mayor a $0.' },
    ],
    [
      'past date',
      [{ kind: 'purchase', amount: 100, date: '2026-03-09', wallet_id: 10 }],
      { field: 'date', index: 0, error: 'La fecha no puede ser anterior a hoy.' },
    ],
    [
      'date after until',
      [
        { kind: 'purchase', amount: 100, date: '2026-03-20', wallet_id: 10 },
        { kind: 'instalment', amount: 100, firstDate: '2026-07-01', months: 2, wallet_id: 10 },
      ],
      { field: 'firstDate', index: 1, error: 'La fecha queda fuera del horizonte de la proyección.' },
    ],
    [
      'not a calendar date',
      [{ kind: 'purchase', amount: 100, date: '2026-02-30', wallet_id: 10 }],
      { field: 'date', index: 0, error: 'Selecciona una fecha válida' },
    ],
    [
      'missing wallet',
      [{ kind: 'purchase', amount: 100, date: '2026-03-20' }],
      { field: 'wallet_id', index: 0, error: 'Elige una billetera.' },
    ],
    [
      'more than three items',
      Array.from({ length: 4 }, () => ({ kind: 'purchase', amount: 1, date: '2026-03-20', wallet_id: 10 })),
      { field: 'scenario', index: null },
    ],
    ['not JSON', '[{', { field: 'scenario', index: null }],
  ])('returns 400 with a reason for %s', async (_label, scenario, expected) => {
    const res = await get(scenario);
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject(expected);
    expect(getLiquidityProjection).not.toHaveBeenCalled();
  });

  it('accepts today as the date (Mexico City day, not UTC)', async () => {
    // 2026-03-10 18:00 UTC is still 2026-03-10 in Mexico City.
    const res = await get([{ kind: 'purchase', amount: 100, date: '2026-03-10', wallet_id: 10 }]);
    expect(res.status).toBe(200);
  });

  it('returns 400 on wallet_id when the wallet belongs to another owner', async () => {
    getLiquidityProjection.mockRejectedValue(
      new LiquidityScenarioWalletError(0, 'Elige una billetera de este espacio.'),
    );
    const res = await get([{ kind: 'purchase', amount: 100, date: '2026-03-20', wallet_id: 999 }]);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: 'Elige una billetera de este espacio.',
      field: 'wallet_id',
      index: 0,
    });
  });
});
