import { describe, expect, it } from 'vitest';
import {
  accountHasDebtWhy,
  capWhyLines,
  composeCardDebtAccount,
  composeLoanDebtAccount,
  DEBT_LOAN_UPCOMING_CAP,
  DEBT_WHY_LINE_CAP,
  formatCardDebtPreview,
  formatLoanDebtPreview,
  remainingInstallmentAmount,
  remainingInstallments,
  summarizeDebtBreakdown,
  type DebtWhyLine,
} from '@/lib/finance/liquidity-debt-breakdown';
import { formatCurrency, formatDate } from '@/lib/utils';

const whyLine = (id: string, amount: number): DebtWhyLine => ({
  id,
  kind: 'msi',
  title: id,
  subtitle: 'test',
  amount,
});

describe('remainingInstallments', () => {
  it('counts the current unpaid cuota (4 de 12 → 9)', () => {
    expect(remainingInstallments(4, 12)).toBe(9);
    expect(remainingInstallmentAmount(4, 12, 850)).toBe(7650);
  });

  it('returns 0 when the plazo is finished', () => {
    expect(remainingInstallments(12, 12)).toBe(0);
    expect(remainingInstallments(13, 12)).toBe(0);
  });
});

describe('capWhyLines', () => {
  it('keeps every line when the list is within the cap', () => {
    const lines = [whyLine('a', 10), whyLine('b', 20)];
    expect(capWhyLines(lines, 8)).toEqual({
      lines,
      moreCount: 0,
      moreAmount: 0,
    });
  });

  it('hides overflow lines and sums their amount', () => {
    const lines = Array.from({ length: 10 }, (_, index) =>
      whyLine(`item-${index}`, index + 1),
    );
    const capped = capWhyLines(lines, DEBT_WHY_LINE_CAP);
    expect(capped.lines).toHaveLength(8);
    expect(capped.moreCount).toBe(2);
    expect(capped.moreAmount).toBe(9 + 10);
  });
});

describe('composeCardDebtAccount', () => {
  it('splits MSI and plans into plazos and cycle plus prior into resto', () => {
    const account = composeCardDebtAccount({
      walletId: 7,
      name: 'DIDI Card',
      outstanding: 5844,
      msi: [
        {
          id: 11,
          title: 'Laptop',
          current: 4,
          total: 12,
          monthlyAmount: 200,
        },
      ],
      plans: [
        {
          id: 3,
          title: 'Pantalla',
          current: 2,
          total: 6,
          remainingAmount: 600,
          monthlyAmount: 200,
        },
      ],
      cycle: [
        {
          id: 21,
          title: 'Uber',
          amount: 344,
          date: '2026-03-18',
        },
      ],
    });

    expect(account.plazosTotal).toBe(2400);
    expect(account.restoTotal).toBe(3444);
    expect(account.debt).toBe(5844);
    expect(account.preview).toBe(formatCardDebtPreview(2, 3444));
    expect(account.blocks.map((block) => block.key)).toEqual(['plazos', 'resto']);
    expect(account.blocks[0]?.lines.map((line) => line.id)).toEqual([
      'msi-11',
      'plan-3',
    ]);
    expect(account.blocks[1]?.lines.map((line) => line.title)).toEqual([
      'Uber',
      'Saldo anterior',
    ]);
    expect(account.blocks[1]?.lines[1]?.amount).toBe(3100);
  });

  it('keeps cycle charges and a saldo anterior line in resto', () => {
    const account = composeCardDebtAccount({
      walletId: 2,
      name: 'Liverpool',
      outstanding: 5705,
      msi: [],
      plans: [],
      cycle: [
        { id: 1, title: 'Zara', amount: 1200, date: '2026-03-10' },
        { id: 2, title: 'Comida', amount: 500, date: '2026-03-12' },
      ],
    });

    expect(account.plazosTotal).toBe(0);
    expect(account.restoTotal).toBe(5705);
    expect(account.preview).toBe(`resto ${formatCurrency(5705)}`);
    expect(account.blocks).toHaveLength(1);
    expect(account.blocks[0]).toMatchObject({ key: 'resto', total: 5705 });
    expect(account.blocks[0]?.lines.map((line) => line.title)).toEqual([
      'Zara',
      'Comida',
      'Saldo anterior',
    ]);
    expect(account.blocks[0]?.lines[2]?.amount).toBe(4005);
  });

  it('caps plazo lines and reports the hidden remainder', () => {
    const account = composeCardDebtAccount({
      walletId: 9,
      name: 'Nu',
      outstanding: 20000,
      msi: Array.from({ length: 10 }, (_, index) => ({
        id: index + 1,
        title: `Compra ${index + 1}`,
        current: 1,
        total: 4,
        monthlyAmount: 100,
      })),
      plans: [],
      cycle: [],
    });

    const plazos = account.blocks.find((block) => block.key === 'plazos');
    expect(plazos?.lines).toHaveLength(DEBT_WHY_LINE_CAP);
    expect(plazos?.moreCount).toBe(2);
    expect(plazos?.moreAmount).toBe(800);
  });

  it('returns no preview or blocks when the card has no debt', () => {
    const account = composeCardDebtAccount({
      walletId: 4,
      name: 'BBVA',
      outstanding: 0,
      msi: [
        {
          id: 1,
          title: 'Ghost',
          current: 1,
          total: 6,
          monthlyAmount: 200,
        },
      ],
      plans: [],
      cycle: [{ id: 2, title: 'Cargo', amount: 80, date: '2026-03-01' }],
    });

    expect(account).toMatchObject({
      debt: 0,
      plazosTotal: 0,
      restoTotal: 0,
      preview: '',
      blocks: [],
    });
    expect(accountHasDebtWhy(account)).toBe(false);
  });
});

describe('composeLoanDebtAccount', () => {
  it('lists upcoming scheduled and skipped cuotas with a 6-line cap', () => {
    const payments = Array.from({ length: 8 }, (_, index) => ({
      id: index + 1,
      dueDate: `2026-0${index + 1 > 9 ? 9 : index + 1}-01`.replace(
        '2026-010',
        '2026-10',
      ),
      amount: 1000 + index,
      status: index === 1 ? 'SKIPPED' : 'SCHEDULED',
    }));
    payments[0] = { ...payments[0]!, dueDate: '2026-02-01' };
    payments[1] = { ...payments[1]!, dueDate: '2026-03-01' };
    payments[2] = { ...payments[2]!, dueDate: '2026-04-01' };
    payments[3] = { ...payments[3]!, dueDate: '2026-05-01' };
    payments[4] = { ...payments[4]!, dueDate: '2026-06-01' };
    payments[5] = { ...payments[5]!, dueDate: '2026-07-01' };
    payments[6] = { ...payments[6]!, dueDate: '2026-08-01' };
    payments[7] = { ...payments[7]!, dueDate: '2026-09-01' };

    const account = composeLoanDebtAccount({
      loanId: 15,
      name: 'Fonacot Jorge',
      remainingAmount: 50269,
      remainingPayments: 18,
      nextDueDate: '2026-03-01',
      nextAmount: 2793,
      payments,
      todayYmd: '2026-03-15',
    });

    expect(account.preview).toBe(
      formatLoanDebtPreview(18, '2026-03-01', 2793),
    );
    expect(account.preview).toContain(formatDate('2026-03-01'));
    expect(account.blocks).toHaveLength(1);
    expect(account.blocks[0]?.lines).toHaveLength(DEBT_LOAN_UPCOMING_CAP);
    expect(account.blocks[0]?.moreCount).toBe(2);
    expect(account.blocks[0]?.lines[0]).toMatchObject({
      title: 'Cuota vencida',
      status: 'overdue',
    });
    expect(accountHasDebtWhy(account)).toBe(true);
  });

  it('returns no why control when the loan has no remaining debt', () => {
    const account = composeLoanDebtAccount({
      loanId: 1,
      name: 'Viejo',
      remainingAmount: 0,
      remainingPayments: 0,
      nextDueDate: null,
      nextAmount: null,
      payments: [],
      todayYmd: '2026-03-15',
    });
    expect(account.debt).toBe(0);
    expect(account.blocks).toEqual([]);
    expect(accountHasDebtWhy(account)).toBe(false);
  });
});

describe('summarizeDebtBreakdown', () => {
  it('builds Debes from plazos, resto and loans and keeps the top 3 concepts', () => {
    const didi = composeCardDebtAccount({
      walletId: 1,
      name: 'DIDI Card',
      outstanding: 5844,
      msi: [
        { id: 1, title: 'Auriculares', current: 1, total: 3, monthlyAmount: 800 },
      ],
      plans: [],
      cycle: [{ id: 9, title: 'Restaurante', amount: 3444, date: '2026-03-08' }],
    });
    const liverpool = composeCardDebtAccount({
      walletId: 2,
      name: 'Liverpool',
      outstanding: 5705,
      msi: [],
      plans: [],
      cycle: [],
    });
    const fonacot = composeLoanDebtAccount({
      loanId: 3,
      name: 'Fonacot Jorge',
      remainingAmount: 50269,
      remainingPayments: 18,
      nextDueDate: '2026-03-01',
      nextAmount: 2793,
      payments: [
        { id: 1, dueDate: '2026-03-01', amount: 2793, status: 'SCHEDULED' },
      ],
      todayYmd: '2026-03-15',
    });
    const paidCard = composeCardDebtAccount({
      walletId: 8,
      name: 'Sin deuda',
      outstanding: 0,
      msi: [],
      plans: [],
      cycle: [],
    });

    const summary = summarizeDebtBreakdown([didi, liverpool, fonacot, paidCard]);

    expect(summary.plazosTotal).toBe(didi.plazosTotal);
    expect(summary.restoTotal).toBe(didi.restoTotal + liverpool.restoTotal);
    expect(summary.loansTotal).toBe(50269);
    expect(summary.debtTotal).toBe(
      summary.plazosTotal + summary.restoTotal + summary.loansTotal,
    );
    expect(summary.cardCount).toBe(2);
    expect(summary.loanCount).toBe(1);
    expect(summary.topConcepts).toEqual([
      { title: 'Fonacot Jorge', amount: 50269 },
      { title: 'Liverpool', amount: 5705 },
      {
        title: didi.plazosTotal >= didi.restoTotal ? 'DIDI Card plazos' : 'DIDI Card',
        amount: Math.max(didi.plazosTotal, didi.restoTotal),
      },
    ]);
    expect(accountHasDebtWhy(paidCard)).toBe(false);
  });
});
