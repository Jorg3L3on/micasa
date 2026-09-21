import { describe, expect, it } from 'vitest';
import {
  buildUpcomingCreditCardPaymentSources,
  buildUpcomingCreditCardPaymentsChart,
} from './credit-card-upcoming-payments-chart';

describe('buildUpcomingCreditCardPaymentsChart', () => {
  it('drops paid months before the current month', () => {
    const points = buildUpcomingCreditCardPaymentsChart({
      paymentHistory: [
        { paid_at: '2026-05-10', amount: 4_500 },
        { paid_at: '2026-09-16', amount: 2_665.92 },
      ],
      installmentActivePurchases: [],
      statementEnd: '2026-10-07',
      scheduledPayments: [],
      installmentPlans: [],
      fromMonthKey: '2026-09',
    });

    expect(points.map((p) => p.monthKey)).toEqual(['2026-09']);
    expect(points[0]?.paid).toBeCloseTo(2_665.92);
    expect(points[0]?.pending).toBe(0);
  });

  it('spans current month through the last pending month and fills gaps', () => {
    const points = buildUpcomingCreditCardPaymentsChart({
      paymentHistory: [],
      installmentActivePurchases: [
        {
          amount: 1_000,
          credit_installment_current: 1,
          credit_installment_total: 3,
        },
      ],
      statementEnd: '2026-10-07',
      scheduledPayments: [
        { dueDate: '2026-12-15', amount: 500, status: 'SCHEDULED' },
      ],
      installmentPlans: [],
      fromMonthKey: '2026-09',
    });

    // Remaining MSI: Nov + Dec. Scheduled: Dec. Range Sep → Dec.
    expect(points.map((p) => p.monthKey)).toEqual([
      '2026-09',
      '2026-10',
      '2026-11',
      '2026-12',
    ]);
    expect(points[2]?.msi).toBe(1_000);
    expect(points[3]?.msi).toBe(1_000);
    expect(points[3]?.scheduled).toBe(500);
    expect(points[3]?.pending).toBe(1_500);
  });

  it('includes scheduled plan cuotas and ignores paid ones', () => {
    const points = buildUpcomingCreditCardPaymentsChart({
      paymentHistory: [],
      installmentActivePurchases: [],
      statementEnd: '2026-10-07',
      scheduledPayments: [
        { dueDate: '2026-08-01', amount: 200, status: 'SCHEDULED' },
        { dueDate: '2026-10-05', amount: 800, status: 'PAID' },
      ],
      installmentPlans: [
        {
          payments: [
            { dueDate: '2026-09-20', amount: 300, status: 'PAID' },
            { dueDate: '2026-10-20', amount: 300, status: 'SCHEDULED' },
            { dueDate: '2026-11-20', amount: 300, status: 'SCHEDULED' },
          ],
        },
      ],
      fromMonthKey: '2026-09',
    });

    expect(points.map((p) => p.monthKey)).toEqual([
      '2026-09',
      '2026-10',
      '2026-11',
    ]);
    expect(points[0]?.plans).toBe(0);
    expect(points[1]?.plans).toBe(300);
    expect(points[2]?.plans).toBe(300);
    expect(points.every((p) => p.scheduled === 0)).toBe(true);
  });

  it('returns an empty series when nothing is due from this month on', () => {
    const points = buildUpcomingCreditCardPaymentsChart({
      paymentHistory: [{ paid_at: '2026-05-10', amount: 4_500 }],
      installmentActivePurchases: [],
      statementEnd: '2026-10-07',
      scheduledPayments: [
        { dueDate: '2026-06-01', amount: 100, status: 'SCHEDULED' },
      ],
      installmentPlans: [],
      fromMonthKey: '2026-09',
    });

    expect(points).toEqual([]);
  });

  it('lists scheduled, MSI, and plan rows as the source of each pending bar', () => {
    const rows = buildUpcomingCreditCardPaymentSources({
      paymentHistory: [],
      installmentActivePurchases: [
        {
          id: 9,
          description: 'Laptop',
          amount: 1_000,
          credit_installment_current: 1,
          credit_installment_total: 3,
          fortnight_year: 2026,
          fortnight_month: 9,
          fortnight_period: 'FIRST',
        },
      ],
      statementEnd: '2026-10-07',
      scheduledPayments: [
        {
          id: 4,
          dueDate: '2026-12-15',
          amount: 500,
          label: 'Mínimo',
          status: 'SCHEDULED',
        },
      ],
      installmentPlans: [
        {
          id: 2,
          name: 'Sillón',
          payments: [
            { id: 8, dueDate: '2026-11-20', amount: 300, status: 'SCHEDULED' },
          ],
        },
      ],
      fromMonthKey: '2026-09',
    }, '?ownerType=house&ownerId=3');

    expect(rows.map((row) => `${row.monthKey}:${row.kind}`)).toEqual([
      '2026-11:msi',
      '2026-11:plan',
      '2026-12:msi',
      '2026-12:scheduled',
    ]);
    expect(rows[0]).toMatchObject({
      kind: 'msi',
      title: 'Laptop',
      subtitle: 'MSI · cuota 2 de 3',
      fortnightHref:
        '/fortnight/2026/09/FIRST?ownerType=house&ownerId=3',
    });
    expect(rows[1]).toMatchObject({
      kind: 'plan',
      title: 'Sillón',
      amount: 300,
    });
    expect(rows[3]).toMatchObject({
      kind: 'scheduled',
      scheduledPaymentId: 4,
      title: 'Mínimo',
    });
  });
});
