export type PayoffStrategy = 'avalanche' | 'snowball' | 'minimums';

export type PayoffDebt = {
  id: string;
  balanceCents: number;
  aprAnnual: number;
  minimumCents: number;
  /** When false, avalanche leaves this debt until known-APR balances are gone. */
  aprKnown: boolean;
};

export type PayoffResult = {
  months: number;
  interestCents: number;
  debtsClearedFirstMonth: number;
};

const MAX_MONTHS = 360;

type WorkingDebt = PayoffDebt & { balance: number };

const accrue = (debt: WorkingDebt): number => {
  if (debt.balance <= 0 || debt.aprAnnual <= 0) return 0;
  const interest = Math.round((debt.balance * debt.aprAnnual) / 12);
  debt.balance += interest;
  return interest;
};

const payToward = (debt: WorkingDebt, amount: number): number => {
  if (amount <= 0 || debt.balance <= 0) return 0;
  const paid = Math.min(debt.balance, amount);
  debt.balance -= paid;
  return amount - paid;
};

const avalancheTarget = (debts: readonly WorkingDebt[]): WorkingDebt | null => {
  const open = debts.filter((debt) => debt.balance > 0);
  if (open.length === 0) return null;
  const known = open.filter((debt) => debt.aprKnown);
  const pool = known.length > 0 ? known : open;
  return [...pool].sort((a, b) => {
    if (b.aprAnnual !== a.aprAnnual) return b.aprAnnual - a.aprAnnual;
    if (b.balance !== a.balance) return b.balance - a.balance;
    return a.id.localeCompare(b.id);
  })[0] ?? null;
};

const snowballTarget = (debts: readonly WorkingDebt[]): WorkingDebt | null => {
  const open = debts.filter((debt) => debt.balance > 0);
  if (open.length === 0) return null;
  return [...open].sort((a, b) => {
    if (a.balance !== b.balance) return a.balance - b.balance;
    return a.id.localeCompare(b.id);
  })[0] ?? null;
};

/**
 * One-time extra on month 1, then minimums only.
 * Same debts and extra always return the same months and interest.
 */
export const simulatePayoff = (
  debts: readonly PayoffDebt[],
  extraCents: number,
  strategy: PayoffStrategy,
): PayoffResult => {
  const working: WorkingDebt[] = debts
    .filter((debt) => debt.balanceCents > 0)
    .map((debt) => ({
      ...debt,
      minimumCents: Math.max(0, debt.minimumCents),
      balance: debt.balanceCents,
    }))
    .sort((a, b) => a.id.localeCompare(b.id));

  if (working.length === 0) {
    return { months: 0, interestCents: 0, debtsClearedFirstMonth: 0 };
  }

  let interestCents = 0;
  let debtsClearedFirstMonth = 0;
  const started = working.length;

  for (let month = 1; month <= MAX_MONTHS; month += 1) {
    for (const debt of working) {
      interestCents += accrue(debt);
    }

    for (const debt of working) {
      const minimum = Math.min(debt.balance, debt.minimumCents || debt.balance);
      payToward(debt, minimum);
    }

    if (month === 1 && strategy !== 'minimums' && extraCents > 0) {
      let leftover = extraCents;
      while (leftover > 0) {
        const target = strategy === 'avalanche' ? avalancheTarget(working) : snowballTarget(working);
        if (!target) break;
        const before = leftover;
        leftover = payToward(target, leftover);
        if (leftover === before) break;
      }
    }

    if (month === 1) {
      debtsClearedFirstMonth = started - working.filter((debt) => debt.balance > 0).length;
    }

    if (working.every((debt) => debt.balance <= 0)) {
      return { months: month, interestCents, debtsClearedFirstMonth };
    }
  }

  return { months: MAX_MONTHS, interestCents, debtsClearedFirstMonth };
};
