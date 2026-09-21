import { formatDate, formatCurrency } from '@/lib/utils';

export const DEBT_WHY_LINE_CAP = 8;
export const DEBT_LOAN_UPCOMING_CAP = 6;
export const DEBT_TOP_CONCEPT_CAP = 3;

export type DebtWhyKind = 'msi' | 'plan' | 'cycle' | 'prior' | 'loan_payment';

export type DebtWhyLine = {
  id: string;
  kind: DebtWhyKind;
  title: string;
  subtitle: string;
  amount: number;
  monthlyAmount?: number;
  current?: number;
  total?: number;
  dueDate?: string;
  status?: 'overdue' | 'scheduled';
};

export type DebtWhyBlockKey = 'plazos' | 'resto' | 'cuotas';

export type DebtWhyBlock = {
  key: DebtWhyBlockKey;
  title: string;
  total: number;
  lines: DebtWhyLine[];
  moreCount: number;
  moreAmount: number;
};

export type DebtAccountKind = 'card' | 'loan';

export type DebtAccountBreakdown = {
  id: string;
  kind: DebtAccountKind;
  accountId: number;
  name: string;
  debt: number;
  plazosTotal: number;
  restoTotal: number;
  preview: string;
  blocks: DebtWhyBlock[];
};

export type DebtBreakdownConcept = {
  title: string;
  amount: number;
};

export type LiquidityDebtBreakdown = {
  debtTotal: number;
  plazosTotal: number;
  restoTotal: number;
  loansTotal: number;
  cardCount: number;
  loanCount: number;
  topConcepts: DebtBreakdownConcept[];
  accounts: DebtAccountBreakdown[];
};

export const roundMoney = (value: number): number =>
  Math.round((Number(value) || 0) * 100) / 100;

/** Cuotas que faltan, incluyendo la cuota en curso (4 de 12 → 9). */
export const remainingInstallments = (current: number, total: number): number => {
  if (!Number.isFinite(current) || !Number.isFinite(total) || total <= 0) return 0;
  if (current >= total) return 0;
  return total - Math.max(0, current) + (current > 0 ? 1 : 0);
};

export const remainingInstallmentAmount = (
  current: number,
  total: number,
  monthlyAmount: number,
): number =>
  roundMoney(remainingInstallments(current, total) * (Number(monthlyAmount) || 0));

export const capWhyLines = (
  lines: readonly DebtWhyLine[],
  cap: number = DEBT_WHY_LINE_CAP,
): Pick<DebtWhyBlock, 'lines' | 'moreCount' | 'moreAmount'> => {
  if (lines.length <= cap) {
    return { lines: [...lines], moreCount: 0, moreAmount: 0 };
  }
  const hidden = lines.slice(cap);
  return {
    lines: lines.slice(0, cap),
    moreCount: hidden.length,
    moreAmount: roundMoney(hidden.reduce((sum, line) => sum + line.amount, 0)),
  };
};

export const formatCardDebtPreview = (
  plazosCount: number,
  restoTotal: number,
): string => {
  const parts: string[] = [];
  if (plazosCount > 0) {
    parts.push(plazosCount === 1 ? '1 plazo' : `${plazosCount} plazos`);
  }
  if (restoTotal > 0) {
    parts.push(`resto ${formatCurrency(restoTotal)}`);
  }
  return parts.join(' · ');
};

export const formatLoanDebtPreview = (
  remainingPayments: number,
  nextDueDate: string | null,
  nextAmount: number | null,
): string => {
  const parts: string[] = [];
  if (remainingPayments > 0) {
    parts.push(remainingPayments === 1 ? '1 cuota' : `${remainingPayments} cuotas`);
  }
  if (nextDueDate) {
    parts.push(`próxima ${formatDate(nextDueDate)}`);
  }
  if (nextAmount != null && nextAmount > 0) {
    parts.push(formatCurrency(nextAmount));
  }
  return parts.join(' · ');
};

const sortLinesByAmount = (lines: DebtWhyLine[]): DebtWhyLine[] =>
  [...lines].sort((a, b) => b.amount - a.amount || a.title.localeCompare(b.title, 'es'));

export type CardMsiInput = {
  id: number;
  title: string;
  current: number;
  total: number;
  monthlyAmount: number;
};

export type CardPlanInput = {
  id: number;
  title: string;
  current: number;
  total: number;
  remainingAmount: number;
  monthlyAmount: number;
};

export type CardCycleInput = {
  id: number;
  title: string;
  amount: number;
  date: string;
};

export const composeCardDebtAccount = (input: {
  walletId: number;
  name: string;
  outstanding: number;
  msi: readonly CardMsiInput[];
  plans: readonly CardPlanInput[];
  cycle: readonly CardCycleInput[];
}): DebtAccountBreakdown => {
  const outstanding = roundMoney(Math.max(0, input.outstanding));
  if (outstanding <= 0) {
    return {
      id: `wallet-${input.walletId}`,
      kind: 'card',
      accountId: input.walletId,
      name: input.name,
      debt: 0,
      plazosTotal: 0,
      restoTotal: 0,
      preview: '',
      blocks: [],
    };
  }

  const plazosLines: DebtWhyLine[] = [];

  for (const item of input.msi) {
    if (item.current >= item.total) continue;
    const remaining = remainingInstallmentAmount(
      item.current,
      item.total,
      item.monthlyAmount,
    );
    if (remaining <= 0) continue;
    plazosLines.push({
      id: `msi-${item.id}`,
      kind: 'msi',
      title: item.title.trim() || 'Compra a meses',
      subtitle: `${item.current} de ${item.total} · ${formatCurrency(item.monthlyAmount)}/mes`,
      amount: remaining,
      monthlyAmount: roundMoney(item.monthlyAmount),
      current: item.current,
      total: item.total,
    });
  }

  for (const plan of input.plans) {
    const remaining = roundMoney(plan.remainingAmount);
    if (remaining <= 0) continue;
    const leftLabel =
      plan.total > 0 && plan.current > 0
        ? `${plan.current} de ${plan.total}`
        : `${Math.max(1, Math.round(remaining / (plan.monthlyAmount || remaining)))} mensualidades`;
    plazosLines.push({
      id: `plan-${plan.id}`,
      kind: 'plan',
      title: plan.title.trim() || 'Plan a meses',
      subtitle: `${leftLabel} · ${formatCurrency(plan.monthlyAmount)}/mes`,
      amount: remaining,
      monthlyAmount: roundMoney(plan.monthlyAmount),
      current: plan.current,
      total: plan.total,
    });
  }

  const plazosAmount = roundMoney(plazosLines.reduce((sum, line) => sum + line.amount, 0));
  const restoTotal = roundMoney(Math.max(0, outstanding - plazosAmount));

  const cycleLines: DebtWhyLine[] = input.cycle
    .filter((item) => item.amount > 0)
    .map((item) => ({
      id: `cycle-${item.id}`,
      kind: 'cycle' as const,
      title: item.title.trim() || 'Cargo',
      subtitle: item.date ? formatDate(item.date) : 'Ciclo actual',
      amount: roundMoney(item.amount),
      dueDate: item.date || undefined,
    }));

  const cycleSum = roundMoney(cycleLines.reduce((sum, line) => sum + line.amount, 0));
  const restoLines = sortLinesByAmount(cycleLines);
  if (restoTotal > 0 && cycleSum < restoTotal - 0.009) {
    restoLines.push({
      id: `prior-${input.walletId}`,
      kind: 'prior',
      title: 'Saldo anterior',
      subtitle: 'Adeudo que no está en el ciclo abierto',
      amount: roundMoney(restoTotal - cycleSum),
    });
  }

  const blocks: DebtWhyBlock[] = [];
  if (plazosLines.length > 0) {
    blocks.push({
      key: 'plazos',
      title: 'En plazos',
      total: Math.min(plazosAmount, outstanding) || plazosAmount,
      ...capWhyLines(sortLinesByAmount(plazosLines)),
    });
  }
  if (restoTotal > 0 && restoLines.length > 0) {
    blocks.push({
      key: 'resto',
      title: 'El resto',
      total: restoTotal,
      ...capWhyLines(restoLines),
    });
  } else if (restoTotal > 0) {
    blocks.push({
      key: 'resto',
      title: 'El resto',
      total: restoTotal,
      lines: [
        {
          id: `prior-${input.walletId}`,
          kind: 'prior',
          title: 'Saldo anterior',
          subtitle: 'Adeudo revolvente de la tarjeta',
          amount: restoTotal,
        },
      ],
      moreCount: 0,
      moreAmount: 0,
    });
  }

  return {
    id: `wallet-${input.walletId}`,
    kind: 'card',
    accountId: input.walletId,
    name: input.name,
    debt: outstanding,
    plazosTotal: Math.min(plazosAmount, outstanding),
    restoTotal,
    preview: formatCardDebtPreview(plazosLines.length, restoTotal),
    blocks,
  };
};

export type LoanPaymentInput = {
  id: number;
  dueDate: string;
  amount: number;
  status: string;
};

export const composeLoanDebtAccount = (input: {
  loanId: number;
  name: string;
  remainingAmount: number;
  remainingPayments: number;
  nextDueDate: string | null;
  nextAmount: number | null;
  payments: readonly LoanPaymentInput[];
  todayYmd: string;
}): DebtAccountBreakdown => {
  const debt = roundMoney(Math.max(0, input.remainingAmount));
  const upcoming = [...input.payments]
    .filter((payment) => payment.status === 'SCHEDULED' || payment.status === 'SKIPPED')
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  const lines: DebtWhyLine[] = upcoming.map((payment) => {
    const overdue = payment.dueDate < input.todayYmd;
    return {
      id: `loan-pay-${payment.id}`,
      kind: 'loan_payment' as const,
      title: overdue ? 'Cuota vencida' : 'Por pagar',
      subtitle: formatDate(payment.dueDate),
      amount: roundMoney(payment.amount),
      dueDate: payment.dueDate,
      status: overdue ? 'overdue' : 'scheduled',
    };
  });

  const visible = lines.slice(0, DEBT_LOAN_UPCOMING_CAP);
  const hidden = lines.slice(DEBT_LOAN_UPCOMING_CAP);
  const blocks: DebtWhyBlock[] =
    lines.length > 0
      ? [
          {
            key: 'cuotas',
            title: 'Próximas cuotas',
            total: debt,
            lines: visible,
            moreCount: hidden.length,
            moreAmount: roundMoney(hidden.reduce((sum, line) => sum + line.amount, 0)),
          },
        ]
      : [];

  return {
    id: `loan-${input.loanId}`,
    kind: 'loan',
    accountId: input.loanId,
    name: input.name,
    debt,
    plazosTotal: 0,
    restoTotal: 0,
    preview: formatLoanDebtPreview(
      input.remainingPayments,
      input.nextDueDate,
      input.nextAmount,
    ),
    blocks,
  };
};

export const summarizeDebtBreakdown = (
  accounts: readonly DebtAccountBreakdown[],
): LiquidityDebtBreakdown => {
  const cards = accounts.filter((account) => account.kind === 'card');
  const loans = accounts.filter((account) => account.kind === 'loan');
  const plazosTotal = roundMoney(cards.reduce((sum, card) => sum + card.plazosTotal, 0));
  const restoTotal = roundMoney(cards.reduce((sum, card) => sum + card.restoTotal, 0));
  const loansTotal = roundMoney(loans.reduce((sum, loan) => sum + loan.debt, 0));
  const concepts: DebtBreakdownConcept[] = [];

  for (const card of cards) {
    if (card.plazosTotal > 0) {
      concepts.push({ title: `${card.name} plazos`, amount: card.plazosTotal });
    }
    if (card.restoTotal > 0) {
      concepts.push({ title: card.name, amount: card.restoTotal });
    }
  }
  for (const loan of loans) {
    if (loan.debt > 0) {
      concepts.push({ title: loan.name, amount: loan.debt });
    }
  }

  concepts.sort((a, b) => b.amount - a.amount || a.title.localeCompare(b.title, 'es'));

  return {
    debtTotal: roundMoney(plazosTotal + restoTotal + loansTotal),
    plazosTotal,
    restoTotal,
    loansTotal,
    cardCount: cards.filter((card) => card.debt > 0).length,
    loanCount: loans.filter((loan) => loan.debt > 0).length,
    topConcepts: concepts.slice(0, DEBT_TOP_CONCEPT_CAP),
    accounts: [...accounts],
  };
};

export const accountHasDebtWhy = (account: DebtAccountBreakdown | undefined): boolean =>
  Boolean(account && account.debt > 0 && (account.preview || account.blocks.length > 0));
