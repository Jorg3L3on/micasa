import { formatDate, formatCurrency } from '@/lib/utils';

export const DEBT_WHY_LINE_CAP = 8;
export const DEBT_LOAN_UPCOMING_CAP = 6;
export const DEBT_TOP_CONCEPT_CAP = 3;

export type DebtWhyKind = 'msi' | 'plan' | 'cycle' | 'prior' | 'loan_payment';

export type DebtWhyAmountKind = 'balance' | 'monthly';

export type DebtWhyLine = {
  id: string;
  kind: DebtWhyKind;
  title: string;
  subtitle: string;
  amount: number;
  amountKind?: DebtWhyAmountKind;
  monthlyAmount?: number;
  remainingAmount?: number;
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
  /** Remaining plazos not sitting in today's card saldo. */
  beyondBalance: number;
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

export type DebtCompositionPart = {
  key: 'plazos' | 'resto' | 'loans';
  label: string;
  amount: number;
};

export const roundMoney = (value: number): number =>
  Math.round((Number(value) || 0) * 100) / 100;

/** Remaining cuotas after the current one, matching statement projection (`total - current`). */
export const remainingInstallments = (current: number, total: number): number => {
  if (!Number.isFinite(current) || !Number.isFinite(total) || total <= 0) return 0;
  if (current >= total) return 0;
  return Math.max(0, total - current);
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
    moreAmount: roundMoney(
      hidden.reduce((sum, line) => sum + (line.remainingAmount ?? line.amount), 0),
    ),
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

export const formatLoanDebtPreview = (input: {
  remainingPayments: number;
  overdueCount: number;
  nextDueDate: string | null;
  nextAmount: number | null;
  nextIsOverdue: boolean;
}): string => {
  const parts: string[] = [];
  if (input.remainingPayments > 0) {
    parts.push(
      input.remainingPayments === 1 ? '1 cuota' : `${input.remainingPayments} cuotas`,
    );
  }
  if (input.overdueCount > 0) {
    parts.push(
      input.overdueCount === 1 ? '1 vencida' : `${input.overdueCount} vencidas`,
    );
  }
  if (input.nextDueDate && !input.nextIsOverdue) {
    parts.push(`siguiente ${formatDate(input.nextDueDate)}`);
  }
  if (input.nextAmount != null && input.nextAmount > 0) {
    parts.push(formatCurrency(input.nextAmount));
  }
  return parts.join(' · ');
};

export const formatPlazosFootnote = (
  inSaldo: number,
  beyondBalance: number,
): string | null => {
  if (beyondBalance <= 0) return null;
  return `En el saldo de hoy ${formatCurrency(inSaldo)}. A meses quedan ${formatCurrency(roundMoney(inSaldo + beyondBalance))}.`;
};

export const debtCompositionParts = (
  breakdown: Pick<LiquidityDebtBreakdown, 'plazosTotal' | 'restoTotal' | 'loansTotal'>,
): DebtCompositionPart[] =>
  (
    [
      { key: 'plazos', label: 'Plazos', amount: breakdown.plazosTotal },
      { key: 'resto', label: 'Resto de tarjetas', amount: breakdown.restoTotal },
      { key: 'loans', label: 'Préstamos', amount: breakdown.loansTotal },
    ] as const
  ).filter((part) => part.amount > 0);

const sortLinesByAmount = (lines: DebtWhyLine[]): DebtWhyLine[] =>
  [...lines].sort(
    (a, b) =>
      (b.remainingAmount ?? b.amount) - (a.remainingAmount ?? a.amount) ||
      a.title.localeCompare(b.title, 'es'),
  );

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
  /** False when the plan was added without raising wallet.amount. */
  alreadyInCardBalance?: boolean;
};

export type CardCycleInput = {
  id: number;
  title: string;
  amount: number;
  date: string;
};

const emptyCardAccount = (
  walletId: number,
  name: string,
): DebtAccountBreakdown => ({
  id: `wallet-${walletId}`,
  kind: 'card',
  accountId: walletId,
  name,
  debt: 0,
  plazosTotal: 0,
  restoTotal: 0,
  preview: '',
  blocks: [],
});

export const composeCardDebtAccount = (input: {
  walletId: number;
  name: string;
  outstanding: number;
  msi: readonly CardMsiInput[];
  plans: readonly CardPlanInput[];
  cycle: readonly CardCycleInput[];
}): DebtAccountBreakdown => {
  const outstanding = roundMoney(Math.max(0, input.outstanding));
  if (outstanding <= 0) return emptyCardAccount(input.walletId, input.name);

  const plazosLines: DebtWhyLine[] = [];
  let inBalanceRemaining = 0;

  for (const item of input.msi) {
    if (item.current >= item.total) continue;
    const remaining = remainingInstallmentAmount(
      item.current,
      item.total,
      item.monthlyAmount,
    );
    if (remaining <= 0) continue;
    inBalanceRemaining = roundMoney(inBalanceRemaining + remaining);
    plazosLines.push({
      id: `msi-${item.id}`,
      kind: 'msi',
      title: item.title.trim() || 'Compra a meses',
      subtitle: `${item.current} de ${item.total} · ${formatCurrency(item.monthlyAmount)}/mes`,
      amount: remaining,
      amountKind: 'balance',
      monthlyAmount: roundMoney(item.monthlyAmount),
      remainingAmount: remaining,
      current: item.current,
      total: item.total,
    });
  }

  for (const plan of input.plans) {
    const remaining = roundMoney(plan.remainingAmount);
    if (remaining <= 0) continue;
    const inBalance = plan.alreadyInCardBalance !== false;
    if (inBalance) {
      inBalanceRemaining = roundMoney(inBalanceRemaining + remaining);
    }
    const leftLabel =
      plan.total > 0 && plan.current > 0
        ? `${plan.current} de ${plan.total}`
        : `${Math.max(1, Math.round(remaining / (plan.monthlyAmount || remaining)))} mensualidades`;
    plazosLines.push({
      id: `plan-${plan.id}`,
      kind: 'plan',
      title: plan.title.trim() || 'Plan a meses',
      subtitle: inBalance
        ? `${leftLabel} · ${formatCurrency(plan.monthlyAmount)}/mes`
        : `${leftLabel} · ${formatCurrency(plan.monthlyAmount)}/mes · aún no está en el saldo`,
      amount: inBalance ? remaining : roundMoney(plan.monthlyAmount),
      amountKind: inBalance ? 'balance' : 'monthly',
      monthlyAmount: roundMoney(plan.monthlyAmount),
      remainingAmount: remaining,
      current: plan.current,
      total: plan.total,
    });
  }

  const plazosInSaldo = roundMoney(Math.min(inBalanceRemaining, outstanding));
  const beyondBalance = roundMoney(Math.max(0, inBalanceRemaining - outstanding));
  const restoTotal = roundMoney(Math.max(0, outstanding - plazosInSaldo));
  const overshoot = beyondBalance > 0;

  if (overshoot) {
    for (const line of plazosLines) {
      if (line.amountKind === 'monthly') continue;
      line.amountKind = 'monthly';
      line.amount = line.monthlyAmount ?? line.amount;
    }
  }

  const cycleLines: DebtWhyLine[] = input.cycle
    .filter((item) => item.amount > 0)
    .map((item) => ({
      id: `cycle-${item.id}`,
      kind: 'cycle' as const,
      title: item.title.trim() || 'Cargo',
      subtitle: item.date ? formatDate(item.date) : 'Ciclo actual',
      amount: roundMoney(item.amount),
      amountKind: 'balance' as const,
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
      amountKind: 'balance',
    });
  }

  const blocks: DebtWhyBlock[] = [];
  if (plazosLines.length > 0) {
    blocks.push({
      key: 'plazos',
      title: 'En plazos',
      total: plazosInSaldo,
      beyondBalance,
      ...capWhyLines(sortLinesByAmount(plazosLines)),
    });
  }
  if (restoTotal > 0 && restoLines.length > 0) {
    blocks.push({
      key: 'resto',
      title: 'El resto',
      total: restoTotal,
      beyondBalance: 0,
      ...capWhyLines(restoLines),
    });
  } else if (restoTotal > 0) {
    blocks.push({
      key: 'resto',
      title: 'El resto',
      total: restoTotal,
      beyondBalance: 0,
      lines: [
        {
          id: `prior-${input.walletId}`,
          kind: 'prior',
          title: 'Saldo anterior',
          subtitle: 'Adeudo revolvente de la tarjeta',
          amount: restoTotal,
          amountKind: 'balance',
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
    plazosTotal: plazosInSaldo,
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

  const overdueCount = upcoming.filter((payment) => payment.dueDate < input.todayYmd).length;
  const nextFuture = upcoming.find((payment) => payment.dueDate >= input.todayYmd);
  const next = nextFuture ?? upcoming[0];
  const nextIsOverdue = Boolean(next && next.dueDate < input.todayYmd);

  const lines: DebtWhyLine[] = upcoming.map((payment) => {
    const overdue = payment.dueDate < input.todayYmd;
    return {
      id: `loan-pay-${payment.id}`,
      kind: 'loan_payment' as const,
      title: overdue ? 'Cuota vencida' : 'Por pagar',
      subtitle: formatDate(payment.dueDate),
      amount: roundMoney(payment.amount),
      amountKind: 'balance' as const,
      dueDate: payment.dueDate,
      status: overdue ? 'overdue' : 'scheduled',
    };
  });

  const visible = lines.slice(0, DEBT_LOAN_UPCOMING_CAP);
  const hidden = lines.slice(DEBT_LOAN_UPCOMING_CAP);
  const title =
    overdueCount === 0
      ? 'Próximas cuotas'
      : nextFuture
        ? 'Vencidas y próximas'
        : 'Cuotas vencidas';
  const blocks: DebtWhyBlock[] =
    lines.length > 0
      ? [
          {
            key: 'cuotas',
            title,
            total: debt,
            beyondBalance: 0,
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
    preview: formatLoanDebtPreview({
      remainingPayments: input.remainingPayments,
      overdueCount,
      nextDueDate: next?.dueDate ?? input.nextDueDate,
      nextAmount: next ? roundMoney(next.amount) : input.nextAmount,
      nextIsOverdue,
    }),
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
