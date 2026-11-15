import { describe, expect, it } from 'vitest';
import {
  addMonthsYmd,
  buildPurchasePlan,
  pendingPrincipalAt,
  PurchasePlanError,
  type PlanWallet,
} from '@/lib/finance/purchase-simulation/plan';
import { purchaseSimulationSchema } from '@/schemas/purchase-simulation.schema';

const card = (cutoff: number | null, due: number | null): PlanWallet => ({
  id: 7,
  name: 'Tarjeta prueba',
  isCard: true,
  cutoff_day: cutoff,
  due_day: due,
});
const debit: PlanWallet = { id: 3, name: 'Débito prueba', isCard: false, cutoff_day: null, due_day: null };
const savings = { id: 4, name: 'Ahorro prueba' };

describe('buildPurchasePlan · contado', () => {
  it('debit: one payment on the purchase day, no debt', () => {
    const plan = buildPurchasePlan({ total: 6000, date: '2026-11-14', mode: 'contado', wallet: debit });
    expect(plan.payments).toHaveLength(1);
    expect(plan.payments[0]).toMatchObject({ date: '2026-11-14', amount: 6000, principal: 0, onCard: false });
    expect(plan.debtWalletId).toBeNull();
    expect(plan.principal).toBe(0);
  });

  it('card: one payment on the first due date of the statement that bills it', () => {
    const plan = buildPurchasePlan({ total: 6000, date: '2026-11-14', mode: 'contado', wallet: card(5, 25) });
    expect(plan.cutoffDate).toBe('2026-12-05');
    expect(plan.payments).toEqual([expect.objectContaining({ date: '2026-12-25', amount: 6000, onCard: true })]);
    expect(plan.debtWalletId).toBe(7);
  });
});

describe('buildPurchasePlan · meses sin intereses', () => {
  it('purchase after the cutoff waits for the next statement; 12 cuotas on each due day', () => {
    const plan = buildPurchasePlan({ total: 6000, date: '2026-11-14', mode: 'msi', wallet: card(5, 25), months: 12 });
    expect(plan.count).toBe(12);
    expect(plan.regularPayment).toBe(500);
    expect(plan.payments[0].date).toBe('2026-12-25');
    expect(plan.payments[11].date).toBe('2027-11-25');
    expect(plan.payments.reduce((s, p) => s + p.amount, 0)).toBe(6000);
    expect(plan.interest).toBe(0);
  });

  it('purchase before the cutoff lands on that statement', () => {
    const plan = buildPurchasePlan({ total: 3000, date: '2026-11-14', mode: 'msi', wallet: card(20, 10), months: 3 });
    expect(plan.cutoffDate).toBe('2026-11-20');
    expect(plan.payments.map((p) => p.date)).toEqual(['2026-12-10', '2027-01-10', '2027-02-10']);
  });

  it('purchase on the cutoff day closes with that statement', () => {
    const plan = buildPurchasePlan({ total: 3000, date: '2026-11-20', mode: 'msi', wallet: card(20, 10), months: 3 });
    expect(plan.cutoffDate).toBe('2026-11-20');
    expect(plan.firstDueDate).toBe('2026-12-10');
  });

  it('cents that do not divide land on the last cuota', () => {
    const plan = buildPurchasePlan({ total: 1000, date: '2026-11-14', mode: 'msi', wallet: card(5, 25), months: 3 });
    expect(plan.payments.map((p) => p.amount)).toEqual([333.33, 333.33, 333.34]);
  });

  it('due day 31 clamps to the end of short months', () => {
    const plan = buildPurchasePlan({ total: 1200, date: '2026-12-02', mode: 'msi', wallet: card(1, 31), months: 3 });
    expect(plan.payments.map((p) => p.date)).toEqual(['2027-01-31', '2027-02-28', '2027-03-31']);
  });

  it('rejects MSI on a debit wallet and months outside the options', () => {
    expect(() =>
      buildPurchasePlan({ total: 6000, date: '2026-11-14', mode: 'msi', wallet: debit, months: 12 }),
    ).toThrow(PurchasePlanError);
    expect(() =>
      buildPurchasePlan({ total: 6000, date: '2026-11-14', mode: 'msi', wallet: card(5, 25), months: 7 }),
    ).toThrow(/3, 6, 9, 12, 18 o 24/);
  });
});

describe('buildPurchasePlan · con intereses', () => {
  it('card with interest: amortized payments on the card due dates', () => {
    const plan = buildPurchasePlan({
      total: 12000,
      date: '2026-11-14',
      mode: 'credito',
      lender: 'card',
      wallet: card(5, 25),
      months: 12,
      annualRatePct: 42,
    });
    expect(plan.firstDueDate).toBe('2026-12-25');
    expect(plan.regularPayment).toBeCloseTo(1241.81, 2);
    expect(plan.interest).toBeCloseTo(2901.72, 0);
    expect(plan.payments.reduce((s, p) => s + p.principal, 0)).toBeCloseTo(12000, 2);
    expect(plan.debtWalletId).toBe(7);
  });

  it('new credit with enganche: enganche on the day, mensualidades from next month on day 5', () => {
    const plan = buildPurchasePlan({
      total: 320000,
      date: '2026-11-14',
      mode: 'credito',
      lender: 'new',
      wallet: debit,
      months: 48,
      annualRatePct: 13.9,
      downPayment: 40000,
      downWallet: savings,
      payWallet: { id: debit.id, name: debit.name },
      extraMonthly: 2500,
    });
    expect(plan.payments[0]).toMatchObject({ kind: 'enganche', date: '2026-11-14', amount: 40000, walletId: 4 });
    expect(plan.payments[1]).toMatchObject({ kind: 'mensualidad', date: '2026-12-05' });
    expect(plan.count).toBe(48);
    expect(plan.lastDueDate).toBe('2030-11-05');
    expect(plan.regularPayment).toBeCloseTo(7637, -1);
    expect(plan.principal).toBe(280000);
    expect(plan.debtWalletId).toBe('new');
    expect(plan.extraMonthly).toEqual({ amount: 2500, fromDate: '2026-12-05', day: 5 });
  });

  it('known monthly payment: uses it and derives the interest', () => {
    const plan = buildPurchasePlan({
      total: 100000,
      date: '2026-11-14',
      mode: 'credito',
      lender: 'new',
      wallet: debit,
      months: 24,
      monthlyPayment: 5000,
      payWallet: { id: 3, name: 'Débito prueba' },
    });
    expect(plan.regularPayment).toBe(5000);
    expect(plan.interest).toBeCloseTo(20000, 0);
    expect(plan.payments.reduce((s, p) => s + p.principal, 0)).toBeCloseTo(100000, 2);
  });

  it('zero rate divides evenly and 360 months crosses 30 years', () => {
    const plan = buildPurchasePlan({
      total: 1800000,
      date: '2026-11-14',
      mode: 'credito',
      lender: 'new',
      wallet: debit,
      months: 360,
      annualRatePct: 0,
      downPayment: 360000,
      downWallet: savings,
      payWallet: { id: 3, name: 'Débito prueba' },
    });
    expect(plan.count).toBe(360);
    expect(plan.regularPayment).toBe(4000);
    expect(plan.lastDueDate).toBe('2056-11-05');
    expect(plan.interest).toBe(0);
  });

  it('rejects a down payment above the price and a mensualidad that never pays it off', () => {
    expect(() =>
      buildPurchasePlan({ total: 1000, date: '2026-11-14', mode: 'credito', lender: 'new', wallet: debit, months: 12, annualRatePct: 10, downPayment: 2000 }),
    ).toThrow(/enganche/);
    expect(() =>
      buildPurchasePlan({ total: 100000, date: '2026-11-14', mode: 'credito', lender: 'new', wallet: debit, months: 12, monthlyPayment: 10 }),
    ).toThrow(/mensualidad/);
  });
});

describe('data gaps and helpers', () => {
  it('a card without cutoff or due day returns a gap with assumed days instead of throwing', () => {
    const plan = buildPurchasePlan({ total: 6000, date: '2026-11-14', mode: 'msi', wallet: card(null, null), months: 6 });
    expect(plan.dataGaps).toEqual([
      expect.objectContaining({ code: 'CARD_MISSING_DAYS', walletId: 7, assumedCutoffDay: 1, assumedDueDay: 20 }),
    ]);
    expect(plan.firstDueDate).toBe('2026-12-20');
  });

  it('addMonthsYmd rolls months and years', () => {
    expect(addMonthsYmd('2026-12-25', 1)).toBe('2027-01-25');
    expect(addMonthsYmd('2027-01-31', 1)).toBe('2027-02-28');
    expect(addMonthsYmd('2026-11-14', 13, 5)).toBe('2027-12-05');
  });

  it('pendingPrincipalAt goes down with each payment', () => {
    const plan = buildPurchasePlan({ total: 6000, date: '2026-11-14', mode: 'msi', wallet: card(5, 25), months: 12 });
    expect(pendingPrincipalAt(plan, '2026-11-13')).toBe(0);
    expect(pendingPrincipalAt(plan, '2026-11-30')).toBe(6000);
    expect(pendingPrincipalAt(plan, '2026-12-31')).toBe(5500);
    expect(pendingPrincipalAt(plan, '2027-11-30')).toBe(0);
  });
});

describe('purchaseSimulationSchema', () => {
  const base = { total: 6000, date: '2026-11-14', mode: 'msi', wallet_id: 7, months: 12 };
  it('accepts a valid MSI purchase', () => {
    expect(purchaseSimulationSchema.safeParse(base).success).toBe(true);
  });
  it('rejects total <= 0', () => {
    expect(purchaseSimulationSchema.safeParse({ ...base, total: 0 }).success).toBe(false);
  });
  it('rejects months outside the mode set', () => {
    expect(purchaseSimulationSchema.safeParse({ ...base, months: 7 }).success).toBe(false);
    expect(
      purchaseSimulationSchema.safeParse({ total: 1000, date: '2026-11-14', mode: 'credito', pay_wallet_id: 3, months: 361, annual_rate: 10 }).success,
    ).toBe(false);
  });
  it('rejects a down payment greater than the total', () => {
    const res = purchaseSimulationSchema.safeParse({
      total: 1000, date: '2026-11-14', mode: 'credito', pay_wallet_id: 3, down_wallet_id: 4, months: 12, annual_rate: 10, down_payment: 1500,
    });
    expect(res.success).toBe(false);
    expect(res.error?.issues.map((i) => i.path[0])).toContain('down_payment');
  });
});
