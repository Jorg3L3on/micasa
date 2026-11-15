import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getOwnerContext, getLiquidityProjection, prismaMock, writes } = vi.hoisted(() => {
  const writes = { create: vi.fn(), update: vi.fn(), delete: vi.fn(), upsert: vi.fn() };
  const model = () => ({ findMany: vi.fn().mockResolvedValue([]), ...writes });
  return {
    getOwnerContext: vi.fn(),
    getLiquidityProjection: vi.fn(),
    writes,
    prismaMock: {
      wallet: model(),
      fortnight: model(),
      expenseTemplate: model(),
      incomeTemplate: model(),
      budget: model(),
      loanPayment: model(),
    },
  };
});

vi.mock('@/lib/server/get-owner-context', () => ({ getOwnerContext }));
vi.mock('@/lib/finance/liquidity-projection.service', () => ({ getLiquidityProjection }));
vi.mock('@/lib/prisma', () => ({ default: prismaMock }));

import { POST } from './route';

const ownerFilter = { user_id: 1, house_id: null };
const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' });

const wallets = [
  { id: 3, name: 'Débito prueba', type: 'DEBIT_CARD', provider_icon_key: null, amount: 45000, credit_limit: null, temporary_credit_limit: null, cutoff_day: null, due_day: null, apr_annual: null, include_in_liquidity: true },
  { id: 7, name: 'Tarjeta prueba', type: 'CREDIT_CARD', provider_icon_key: null, amount: 8900, credit_limit: 25000, temporary_credit_limit: null, cutoff_day: 5, due_day: 25, apr_annual: 0.48, include_in_liquidity: true },
];

const post = (body: unknown) =>
  POST(new Request('http://test/api/wallets/purchase-simulation', { method: 'POST', body: JSON.stringify(body) }) as never);

beforeEach(() => {
  vi.clearAllMocks();
  getOwnerContext.mockResolvedValue({ userId: 1, ownerType: 'user', ownerId: 1, ownerFilter, role: 'owner' });
  prismaMock.wallet.findMany.mockResolvedValue(wallets);
  prismaMock.fortnight.findMany.mockResolvedValue([]);
  prismaMock.expenseTemplate.findMany.mockResolvedValue([
    { name: 'Renta', suggested_amount: 6500, wallet_id: 3, applies_first_fortnight: true, applies_second_fortnight: false },
  ]);
  prismaMock.incomeTemplate.findMany.mockResolvedValue([
    { name: 'Sueldo', suggested_amount: 16500, applies_first_fortnight: true, applies_second_fortnight: true },
  ]);
  prismaMock.budget.findMany.mockResolvedValue([
    { name: 'Súper', total_amount: 2900, frequency: 'BIWEEKLY', start_date: null, end_date: null, recurrent: true },
  ]);
  prismaMock.loanPayment.findMany.mockResolvedValue([]);
  getLiquidityProjection.mockResolvedValue({
    funding_wallets: [{ id: 3, name: 'Débito prueba', type: 'DEBIT_CARD', balance: 45000 }],
    milestones: [],
    income_dates: [],
  });
});

describe('POST /api/wallets/purchase-simulation', () => {
  it('400 on an invalid body', async () => {
    const res = await post({ total: 0, date: today, mode: 'msi', wallet_id: 7, months: 12 });
    expect(res.status).toBe(400);
    expect((await res.json()).field).toBe('total');
  });

  it('404 for a wallet that is not in this owner context', async () => {
    const res = await post({ total: 6000, date: today, mode: 'msi', wallet_id: 99, months: 12 });
    expect(res.status).toBe(404);
  });

  it('scopes every read by the owner filter and never writes', async () => {
    const res = await post({ total: 6000, date: today, mode: 'msi', wallet_id: 7, months: 12, name: 'Carrito' });
    expect(res.status).toBe(200);
    for (const m of Object.values(prismaMock)) {
      for (const call of m.findMany.mock.calls) {
        const where = call[0]?.where ?? {};
        expect(JSON.stringify(where)).toContain('"user_id":1');
      }
    }
    for (const fn of Object.values(writes)) expect(fn).not.toHaveBeenCalled();
    expect(getLiquidityProjection).toHaveBeenCalledWith(expect.objectContaining({ ownerFilter }));
  });

  it('estimates quincenas without a Fortnight row from templates and budgets', async () => {
    const res = await post({ total: 6000, date: today, mode: 'msi', wallet_id: 7, months: 12 });
    const body = await res.json();
    expect(body.series.length).toBeGreaterThan(24);
    const later = body.series[4];
    expect(later.estimated).toBe(true);
    expect(later.entra).toBe(16500);
    expect(later.outflows.map((o: { name: string }) => o.name)).toContain('Súper');
    expect(body.plan.count).toBe(12);
    expect(body.debt.wallets.find((w: { id: string }) => w.id === 'card-7').includesPurchase).toBe(true);
    expect(body.alternatives.length).toBeGreaterThan(3);
    expect(['green', 'amber', 'red']).toContain(body.verdict.level);
  });

  it('handles 24, 99 and 720 quincenas', async () => {
    for (const [body, min] of [
      [{ total: 6000, date: today, mode: 'msi', wallet_id: 7, months: 12, horizon_months: 12 }, 24],
      [{ total: 320000, date: today, mode: 'credito', lender: 'new', pay_wallet_id: 3, down_wallet_id: 3, down_payment: 40000, months: 48, annual_rate: 13.9 }, 99],
      [{ total: 1800000, date: today, mode: 'credito', lender: 'new', pay_wallet_id: 3, months: 360, annual_rate: 10, horizon_months: 360 }, 720],
    ] as const) {
      const started = Date.now();
      const res = await post(body);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.series.length).toBeGreaterThanOrEqual(min);
      expect(Date.now() - started).toBeLessThan(5000);
    }
  });

  it('red verdict when the card limit is exceeded', async () => {
    const res = await post({ total: 20000, date: today, mode: 'contado', wallet_id: 7 });
    const body = await res.json();
    expect(body.verdict.overLimitBy).toBe(3900);
    expect(body.verdict.level).toBe('red');
  });

  it('leaves out unpaid expenses from past quincenas, like Panel, and reports them', async () => {
    const old = '2026-04-30';
    getLiquidityProjection.mockResolvedValueOnce({
      funding_wallets: [{ id: 3, name: 'Débito prueba', type: 'DEBIT_CARD', balance: 45000 }],
      milestones: [
        { due_date: old, obligations: [{ source: 'unpaid_expense', wallet_id: 3, wallet_name: 'Débito prueba', next_due_payment: 8950, expense_description: 'Gasto viejo' }] },
        { due_date: today, obligations: [{ source: 'unpaid_expense', wallet_id: 3, wallet_name: 'Débito prueba', next_due_payment: 300, expense_description: 'Luz' }] },
      ],
      income_dates: [],
    });
    const res = await post({ total: 6000, date: today, mode: 'msi', wallet_id: 7, months: 12 });
    const body = await res.json();
    expect(body.old_unpaid).toEqual({ count: 1, total: 8950 });
    const names = body.series[0].outflows.map((o: { name: string }) => o.name);
    expect(names).toContain('Luz');
    expect(names).not.toContain('Gasto viejo');
  });
});
