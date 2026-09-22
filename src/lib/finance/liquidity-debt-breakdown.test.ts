import { describe, expect, it } from 'vitest';
import {
  accountHasDebtWhy,
  capWhyLines,
  composeCardDebtAccount,
  composeLoanDebtAccount,
  debtCompositionParts,
  DEBT_LOAN_UPCOMING_CAP,
  DEBT_WHY_LINE_CAP,
  formatCardDebtPreview,
  formatLoanDebtPreview,
  formatPlazosFootnote,
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
  remainingAmount: amount,
});

describe('remainingInstallments', () => {
  it('counts cuotas after the current one (4 de 12 → 8)', () => {
    expect(remainingInstallments(4, 12)).toBe(8);
    expect(remainingInstallmentAmount(4, 12, 850)).toBe(6800);
    expect(remainingInstallmentAmount(1, 3, 333.33, 1000)).toBe(1000);
    expect(remainingInstallmentAmount(1, 3, 333.33)).toBe(666.66);
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

  it('hides overflow lines and sums remaining principal', () => {
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

    expect(account.plazosTotal).toBe(2200);
    expect(account.restoTotal).toBe(3644);
    expect(account.debt).toBe(5844);
    expect(account.plazosTotal + account.restoTotal).toBe(account.debt);
    expect(account.preview).toBe(formatCardDebtPreview(2, 3644));
    expect(account.blocks.map((block) => block.key)).toEqual(['plazos', 'resto']);
    expect(account.blocks[0]?.lines.map((line) => line.id)).toEqual([
      'msi-11',
      'plan-3',
    ]);
    expect(account.blocks[0]?.lines[0]).toMatchObject({
      amountKind: 'balance',
      amount: 1600,
    });
    expect(account.blocks[1]?.lines.map((line) => line.title)).toEqual([
      'Uber',
      'Saldo anterior',
    ]);
    expect(account.blocks[1]?.lines[1]?.amount).toBe(3300);
  });

  it('does not treat remaining plazos as today debt when they exceed the saldo', () => {
    const account = composeCardDebtAccount({
      walletId: 7,
      name: 'DIDI Card',
      outstanding: 1179.43,
      msi: [
        { id: 1, title: 'Laptop a 12 meses', current: 2, total: 12, monthlyAmount: 850 },
        {
          id: 2,
          title: 'Televisor Liverpool 6 meses',
          current: 3,
          total: 6,
          monthlyAmount: 1200,
        },
      ],
      plans: [],
      cycle: [],
    });

    expect(account.debt).toBe(1179.43);
    expect(account.plazosTotal).toBe(1179.43);
    expect(account.restoTotal).toBe(0);
    expect(account.plazosTotal + account.restoTotal).toBe(account.debt);
    const plazos = account.blocks[0];
    expect(plazos?.total).toBe(1179.43);
    expect(plazos?.beyondBalance).toBe(8500 + 3600 - 1179.43);
    expect(plazos?.lines.every((line) => line.amountKind === 'monthly')).toBe(true);
    expect(plazos?.lines.map((line) => line.amount)).toEqual([850, 1200]);
    expect(plazos?.lines.map((line) => line.subtitle)).toEqual(['2 de 12', '3 de 6']);
    expect(formatPlazosFootnote(plazos!.total, plazos!.beyondBalance)).toContain(
      'saldo de hoy',
    );
  });

  it('does not shrink resto for a plan that is not in the card balance', () => {
    const account = composeCardDebtAccount({
      walletId: 3,
      name: 'Nu',
      outstanding: 1000,
      msi: [],
      plans: [
        {
          id: 9,
          title: 'Vacaciones',
          current: 1,
          total: 10,
          remainingAmount: 9000,
          monthlyAmount: 900,
          alreadyInCardBalance: false,
        },
      ],
      cycle: [],
    });

    expect(account.plazosTotal).toBe(0);
    expect(account.restoTotal).toBe(1000);
    expect(account.blocks[0]?.key).toBe('plazos');
    expect(account.blocks[0]?.lines[0]).toMatchObject({
      amountKind: 'monthly',
      amount: 900,
    });
    expect(account.blocks[1]).toMatchObject({ key: 'resto', total: 1000 });
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
    expect(plazos?.moreAmount).toBe(600);
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
    const payments = [
      { id: 1, dueDate: '2026-02-01', amount: 1000, status: 'SCHEDULED' },
      { id: 2, dueDate: '2026-03-01', amount: 1001, status: 'SKIPPED' },
      { id: 3, dueDate: '2026-04-01', amount: 1002, status: 'SCHEDULED' },
      { id: 4, dueDate: '2026-05-01', amount: 1003, status: 'SCHEDULED' },
      { id: 5, dueDate: '2026-06-01', amount: 1004, status: 'SCHEDULED' },
      { id: 6, dueDate: '2026-07-01', amount: 1005, status: 'SCHEDULED' },
      { id: 7, dueDate: '2026-08-01', amount: 1006, status: 'SCHEDULED' },
      { id: 8, dueDate: '2026-09-01', amount: 1007, status: 'SCHEDULED' },
    ];

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
      formatLoanDebtPreview({
        remainingPayments: 18,
        overdueCount: 2,
        nextDueDate: '2026-04-01',
        nextAmount: 1002,
        nextIsOverdue: false,
      }),
    );
    expect(account.preview).toContain('2 vencidas');
    expect(account.preview).toContain(`siguiente ${formatDate('2026-04-01')}`);
    expect(account.preview).not.toContain('próxima');
    expect(account.blocks[0]?.title).toBe('Vencidas y próximas');
    expect(account.blocks[0]?.lines).toHaveLength(DEBT_LOAN_UPCOMING_CAP);
    expect(account.blocks[0]?.moreCount).toBe(2);
    expect(account.blocks[0]?.lines[0]).toMatchObject({
      title: 'Cuota vencida',
      status: 'overdue',
    });
    expect(accountHasDebtWhy(account)).toBe(true);
  });

  it('says vencidas instead of próxima when every cuota is past due', () => {
    const account = composeLoanDebtAccount({
      loanId: 4,
      name: 'Fonacot Jorge',
      remainingAmount: 50000,
      remainingPayments: 18,
      nextDueDate: '2026-03-01',
      nextAmount: 2793,
      payments: [
        { id: 1, dueDate: '2026-03-01', amount: 2793, status: 'SCHEDULED' },
        { id: 2, dueDate: '2026-03-16', amount: 2793, status: 'SCHEDULED' },
      ],
      todayYmd: '2026-09-21',
    });

    expect(account.preview).toContain('2 vencidas');
    expect(account.preview).not.toContain('siguiente');
    expect(account.preview).not.toContain('próxima');
    expect(account.blocks[0]?.title).toBe('Cuotas vencidas');
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

    expect(didi.plazosTotal + didi.restoTotal).toBe(didi.debt);
    expect(summary.plazosTotal).toBe(didi.plazosTotal);
    expect(summary.restoTotal).toBe(didi.restoTotal + liverpool.restoTotal);
    expect(summary.loansTotal).toBe(50269);
    expect(summary.debtTotal).toBe(
      summary.plazosTotal + summary.restoTotal + summary.loansTotal,
    );
    expect(summary.cardCount).toBe(2);
    expect(summary.loanCount).toBe(1);
    expect(debtCompositionParts(summary).map((part) => part.key)).toEqual([
      'plazos',
      'resto',
      'loans',
    ]);
    expect(debtCompositionParts({ plazosTotal: 0, restoTotal: 0, loansTotal: 10 })).toEqual([
      { key: 'loans', label: 'Préstamos', amount: 10 },
    ]);
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
