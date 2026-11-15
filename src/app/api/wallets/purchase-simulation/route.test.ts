import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getOwnerContext, getLiquidityProjection, getReportSummary, listPlanningTransactions, prismaMock, writes } = vi.hoisted(() => {
  const writes = { create: vi.fn(), update: vi.fn(), delete: vi.fn(), upsert: vi.fn() };
  const model = () => ({ findMany: vi.fn().mockResolvedValue([]), ...writes });
  return {
    getOwnerContext: vi.fn(),
    getLiquidityProjection: vi.fn(),
    getReportSummary: vi.fn(),
    listPlanningTransactions: vi.fn(),
    writes,
    prismaMock: {
      wallet: model(),
      fortnight: model(),
      expenseTemplate: model(),
      incomeTemplate: model(),
      budget: model(),
      income: model(),
    },
  };
});

vi.mock('@/lib/server/get-owner-context', () => ({ getOwnerContext }));
vi.mock('@/lib/finance/liquidity-projection.service', () => ({ getLiquidityProjection }));
vi.mock('@/lib/finance/report-summary.service', () => ({ getReportSummary }));
vi.mock('@/lib/finance/planning-transactions.service', () => ({ listPlanningTransactions }));
vi.mock('@/lib/prisma', () => ({ default: prismaMock }));

import { GET } from './route';
import { preparePurchase, simulatePurchase } from '@/lib/finance/purchase-simulation/simulate';

const ownerFilter = { user_id: 1, house_id: null };
const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' });

const wallets = [
  { id: 3, name: 'Débito prueba', type: 'DEBIT_CARD', provider_icon_key: null, amount: 45000, credit_limit: null, temporary_credit_limit: null, cutoff_day: null, due_day: null, apr_annual: null, include_in_liquidity: true },
  { id: 7, name: 'Tarjeta prueba', type: 'CREDIT_CARD', provider_icon_key: null, amount: 8900, credit_limit: 25000, temporary_credit_limit: null, cutoff_day: 5, due_day: 25, apr_annual: 0.48, include_in_liquidity: true },
];

const get = (until?: string) => {
  const url = new URL(`http://test/api/wallets/purchase-simulation${until ? `?until=${until}` : ''}`);
  return GET(Object.assign(new Request(url), { nextUrl: url }) as never);
};

/** GET, then the purchase computed like the browser does. */
const post = async (body: unknown) => {
  const first = await (await get()).json();
  const prepared = preparePurchase(body, first.wallets, first.baseline.as_of);
  const loaded = prepared.until > first.baseline.until ? await (await get(prepared.until)).json() : first;
  return simulatePurchase(prepared, loaded.wallets, loaded.baseline);
};

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
  getLiquidityProjection.mockResolvedValue({
    funding_wallets: [{ id: 3, name: 'Débito prueba', type: 'DEBIT_CARD', balance: 45000 }],
    milestones: [],
    income_dates: [],
  });
});

describe('GET /api/wallets/purchase-simulation', () => {
  it('400 on an invalid until', async () => {
    const res = await get('mañana');
    expect(res.status).toBe(400);
    expect((await res.json()).field).toBe('until');
  });

  it('a bad price or a wallet of another space is a field error, computed without the server', async () => {
    const { wallets, baseline } = await (await get()).json();
    expect(() => preparePurchase({ total: 0, date: today, mode: 'msi', wallet_id: 7, months: 12 }, wallets, baseline.as_of)).toThrow(expect.objectContaining({ field: 'total' }));
    expect(() => preparePurchase({ total: 6000, date: today, mode: 'msi', wallet_id: 99, months: 12 }, wallets, baseline.as_of)).toThrow(expect.objectContaining({ field: 'wallet_id' }));
  });

  it('scopes every read by the owner filter and never writes', async () => {
    const res = await get();
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
    const body = await post({ total: 6000, date: today, mode: 'msi', wallet_id: 7, months: 12 });
    expect(body.series.length).toBeGreaterThan(24);
    const later = body.series[4];
    expect(later.estimated).toBe(true);
    expect(later.entra).toBe(16500);
    expect(later.outflows.map((o: { name: string }) => o.name)).toContain('Súper');
    expect(body.plan.count).toBe(12);
    expect(['green', 'amber', 'red']).toContain(body.verdict.level);
  });

  it('handles short, 4-year and 30-year payoffs (24, 96 and about 720 quincenas)', async () => {
    for (const [body, min] of [
      [{ total: 6000, date: today, mode: 'msi', wallet_id: 7, months: 12 }, 24],
      [{ total: 320000, date: today, mode: 'credito', lender: 'new', pay_wallet_id: 3, down_wallet_id: 3, down_payment: 40000, months: 48, annual_rate: 13.9 }, 96],
      [{ total: 1800000, date: today, mode: 'credito', lender: 'new', pay_wallet_id: 3, months: 360, annual_rate: 10 }, 717],
    ] as const) {
      const started = Date.now();
      const json = await post(body);
      expect(json.series.length).toBeGreaterThanOrEqual(min);
      expect(Date.now() - started).toBeLessThan(5000);
    }
  });

  it('red verdict when the card limit is exceeded', async () => {
    const body = await post({ total: 20000, date: today, mode: 'contado', wallet_id: 7 });
    expect(body.verdict.overLimitBy).toBe(3900);
    expect(body.verdict.level).toBe('red');
  });

  it('a created quincena uses Panel\'s own figures', async () => {
    const ref = new Date(`${today}T12:00:00Z`);
    const day = ref.getUTCDate();
    const lastDay = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth() + 1, 0)).getUTCDate();
    // Today's quincena (the last day of a month belongs to the next month's 1ª).
    const nextMonth = day === lastDay;
    const y = nextMonth && ref.getUTCMonth() === 11 ? ref.getUTCFullYear() + 1 : ref.getUTCFullYear();
    const m = nextMonth ? ((ref.getUTCMonth() + 1) % 12) + 1 : ref.getUTCMonth() + 1;
    const period = nextMonth || day <= 14 ? 'FIRST' : 'SECOND';
    prismaMock.fortnight.findMany.mockResolvedValue([{ id: 101, year: y, month: m, period }]);
    prismaMock.income.findMany.mockResolvedValue([{ id: 2 }]); // already credited: in today's balance
    getReportSummary.mockResolvedValue({
      incomeItems: [
        { id: 1, amount: 15000, templateName: 'Salario A', source: null },
        { id: 2, amount: 6000, templateName: 'Salario B', source: null },
      ],
      planningPayrollLoanDeduction: { total: 500, count: 1 },
    });
    listPlanningTransactions.mockResolvedValue([
      { description: 'Luz', amount: 300, is_paid: false, wallet_type: 'DEBIT_CARD', paymentMethod: 'Débito prueba', date: today },
      { description: 'Ya pagado', amount: 900, is_paid: true, wallet_type: 'DEBIT_CARD', paymentMethod: 'Débito prueba', date: today },
      { description: 'Cargo a tarjeta', amount: 450, is_paid: false, wallet_type: 'CREDIT_CARD', paymentMethod: 'Tarjeta prueba', date: today },
      { description: 'Préstamo nómina', amount: 500, is_paid: false, planning_row_kind: 'loan_payment', loan_payment_source: 'PAYROLL_DEDUCTION', paymentMethod: 'Nómina', date: today },
      { description: 'Pago tarjeta: Tarjeta prueba', amount: 1200, is_paid: false, planning_row_kind: 'card_payment', wallet_type: 'CREDIT_CARD', paymentMethod: 'Tarjeta prueba', date: today },
    ]);
    getLiquidityProjection.mockResolvedValueOnce({
      funding_wallets: [{ id: 3, name: 'Débito prueba', type: 'DEBIT_CARD', balance: 45000 }],
      milestones: [{ due_date: today, obligations: [{ source: 'credit_card_statement', wallet_id: 7, wallet_name: 'Tarjeta prueba', next_due_payment: 1200 }] }],
      income_dates: [{ date: today, amount: 99999, title: 'No se usa' }],
    });
    const body = await post({ total: 6000, date: today, mode: 'msi', wallet_id: 7, months: 12 });
    const row = body.series[0];
    expect(row.estimated).toBe(false);
    expect(row.incomes.map((i: { name: string }) => i.name)).toEqual(['Salario A']);
    const names = row.outflows.map((o: { name: string }) => o.name);
    expect(names).toEqual(expect.arrayContaining(['Luz', 'Deducciones de nómina', 'Pago tarjeta: Tarjeta prueba']));
    expect(names).not.toContain('Ya pagado');
    expect(names).not.toContain('Cargo a tarjeta');
    expect(names).not.toContain('Préstamo nómina');
    // The projection's own card line and incomes are not added on top of Panel's.
    expect(names.filter((n: string) => n.startsWith('Pago Tarjeta prueba'))).toHaveLength(0);
    expect(getReportSummary).toHaveBeenCalledWith(expect.objectContaining({ excludeCreditInstallment: true, resolvedFortnightIds: [101] }));
  });
});
