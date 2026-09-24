const roundMoney = (value: number): number => Math.round(value * 100) / 100;

export type LenderPaySlice = {
  id: number;
  loanId: number;
  dueDate: string;
  sequence: number;
  amount: number;
};

export type LenderPaySplit = {
  paymentId: number;
  loanId: number;
  previousAmount: number;
  paidAmount: number;
  remainderAmount: number;
};

export type LenderPayReduction = {
  paymentId: number;
  loanId: number;
  previousAmount: number;
  nextAmount: number;
};

export type LenderPaymentAllocationPlan = {
  amount: number;
  fullPaymentIds: number[];
  splits: LenderPaySplit[];
  reductions: LenderPayReduction[];
};

export type StoredLenderPaymentSplit = {
  sourcePaymentId: number;
  paidPaymentId: number;
  loanId: number;
  previousAmount: number;
};

export type StoredLenderPaymentReduction = {
  paymentId: number;
  loanId: number;
  previousAmount: number;
  cancelled: boolean;
};

export type StoredLenderPaymentAllocation = {
  fullPaymentIds: number[];
  splits: StoredLenderPaymentSplit[];
  reductions: StoredLenderPaymentReduction[];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value != null;

const readNumber = (value: unknown): number | null => {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
};

export const parseStoredLenderAllocation = (
  value: unknown,
): StoredLenderPaymentAllocation | null => {
  if (!isRecord(value) || !Array.isArray(value.fullPaymentIds)) return null;
  const fullPaymentIds = value.fullPaymentIds
    .map((id) => readNumber(id))
    .filter((id): id is number => id != null && Number.isInteger(id));
  const splits = Array.isArray(value.splits)
    ? value.splits.flatMap((row) => {
        if (!isRecord(row)) return [];
        const sourcePaymentId = readNumber(row.sourcePaymentId);
        const paidPaymentId = readNumber(row.paidPaymentId);
        const loanId = readNumber(row.loanId);
        const previousAmount = readNumber(row.previousAmount);
        if (
          sourcePaymentId == null ||
          paidPaymentId == null ||
          loanId == null ||
          previousAmount == null
        ) {
          return [];
        }
        return [{ sourcePaymentId, paidPaymentId, loanId, previousAmount }];
      })
    : [];
  const reductions = Array.isArray(value.reductions)
    ? value.reductions.flatMap((row) => {
        if (!isRecord(row)) return [];
        const paymentId = readNumber(row.paymentId);
        const loanId = readNumber(row.loanId);
        const previousAmount = readNumber(row.previousAmount);
        if (paymentId == null || loanId == null || previousAmount == null) {
          return [];
        }
        return [
          {
            paymentId,
            loanId,
            previousAmount,
            cancelled: row.cancelled === true,
          },
        ];
      })
    : [];
  return { fullPaymentIds, splits, reductions };
};

/**
 * Wallet installments already chosen for this pay (payroll stays out).
 * `requestedAmount` null pays that window exactly.
 * Less is a partial applied in due order. More prepays principal from the tail.
 */
export const allocateLenderPayment = (
  included: readonly LenderPaySlice[],
  future: readonly LenderPaySlice[],
  requestedAmount: number | null,
): LenderPaymentAllocationPlan => {
  if (included.length === 0) {
    throw new Error('No hay cuotas de billetera para pagar en este periodo');
  }

  const windowAmount = roundMoney(
    included.reduce((sum, row) => sum + row.amount, 0),
  );
  const amount =
    requestedAmount == null ? windowAmount : roundMoney(requestedAmount);
  if (!(amount > 0)) {
    throw new Error('El monto del pago debe ser mayor a 0');
  }

  if (amount <= windowAmount + 0.001) {
    let remaining = amount;
    const fullPaymentIds: number[] = [];
    const splits: LenderPaySplit[] = [];
    for (const row of included) {
      if (remaining <= 0.001) break;
      if (remaining + 0.001 >= row.amount) {
        fullPaymentIds.push(row.id);
        remaining = roundMoney(remaining - row.amount);
        continue;
      }
      splits.push({
        paymentId: row.id,
        loanId: row.loanId,
        previousAmount: row.amount,
        paidAmount: remaining,
        remainderAmount: roundMoney(row.amount - remaining),
      });
      remaining = 0;
      break;
    }
    return { amount, fullPaymentIds, splits, reductions: [] };
  }

  let extra = roundMoney(amount - windowAmount);
  const tail = [...future].sort(
    (a, b) =>
      b.dueDate.localeCompare(a.dueDate) ||
      b.sequence - a.sequence ||
      b.id - a.id,
  );
  const reductions: LenderPayReduction[] = [];
  for (const row of tail) {
    if (extra <= 0.001) break;
    if (extra + 0.001 >= row.amount) {
      reductions.push({
        paymentId: row.id,
        loanId: row.loanId,
        previousAmount: row.amount,
        nextAmount: 0,
      });
      extra = roundMoney(extra - row.amount);
      continue;
    }
    reductions.push({
      paymentId: row.id,
      loanId: row.loanId,
      previousAmount: row.amount,
      nextAmount: roundMoney(row.amount - extra),
    });
    extra = 0;
    break;
  }

  if (extra > 0.009) {
    throw new Error('El extra supera el capital pendiente de estos contratos');
  }

  return {
    amount,
    fullPaymentIds: included.map((row) => row.id),
    splits: [],
    reductions,
  };
};
