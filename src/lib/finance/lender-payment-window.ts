import { lenderNameKey } from '@/lib/finance/lender-name';

export type LenderWindowPaymentSource = 'WALLET' | 'PAYROLL_DEDUCTION';
export type LenderWindowLoanStatus =
  | 'ACTIVE'
  | 'PAID_OFF'
  | 'PAUSED'
  | 'CANCELLED';
export type LenderWindowPaymentStatus =
  | 'SCHEDULED'
  | 'PAID'
  | 'SKIPPED'
  | 'CANCELLED';

export type LenderWindowPayment = {
  id: number;
  loanId: number;
  loanName: string;
  sequence: number;
  dueDate: string;
  amount: number;
  paymentSource: LenderWindowPaymentSource;
  loanStatus: LenderWindowLoanStatus;
  status: LenderWindowPaymentStatus;
};

export type LenderPayWindow = {
  included: LenderWindowPayment[];
  amount: number;
  commitmentDate: string | null;
  commitmentDateEnd: string | null;
  isRange: boolean;
};

const monthKey = (ymd: string): string => ymd.slice(0, 7);

const roundMoney = (value: number): number => Math.round(value * 100) / 100;

/** Wallet-source scheduled dues that a Prestamista Pagar applies. */
export const selectLenderPayWindow = (
  payments: readonly LenderWindowPayment[],
  todayYmd: string,
): LenderPayWindow => {
  const empty: LenderPayWindow = {
    included: [],
    amount: 0,
    commitmentDate: null,
    commitmentDateEnd: null,
    isRange: false,
  };

  const eligible = payments.filter(
    (payment) =>
      payment.loanStatus === 'ACTIVE' &&
      payment.paymentSource === 'WALLET' &&
      payment.status === 'SCHEDULED',
  );
  if (eligible.length === 0) return empty;

  const byLoan = new Map<number, LenderWindowPayment[]>();
  for (const payment of eligible) {
    const rows = byLoan.get(payment.loanId) ?? [];
    rows.push(payment);
    byLoan.set(payment.loanId, rows);
  }

  const candidates: LenderWindowPayment[] = [];
  for (const rows of byLoan.values()) {
    const sorted = [...rows].sort(
      (a, b) => a.dueDate.localeCompare(b.dueDate) || a.sequence - b.sequence,
    );
    const overdue = sorted.filter((row) => row.dueDate < todayYmd);
    const upcoming = sorted.filter((row) => row.dueDate >= todayYmd);
    candidates.push(...overdue);
    if (upcoming[0]) candidates.push(upcoming[0]);
  }

  if (candidates.length === 0) return empty;

  const anchor = candidates.reduce(
    (min, row) => (row.dueDate < min ? row.dueDate : min),
    candidates[0]!.dueDate,
  );
  const anchorMonth = monthKey(anchor);
  const included = candidates
    .filter(
      (row) => row.dueDate < todayYmd || monthKey(row.dueDate) === anchorMonth,
    )
    .sort(
      (a, b) =>
        a.dueDate.localeCompare(b.dueDate) ||
        a.loanId - b.loanId ||
        a.sequence - b.sequence,
    );

  if (included.length === 0) return empty;

  const commitmentDate = included[0]!.dueDate;
  const commitmentDateEnd = included[included.length - 1]!.dueDate;

  return {
    included,
    amount: roundMoney(included.reduce((sum, row) => sum + row.amount, 0)),
    commitmentDate,
    commitmentDateEnd,
    isRange: commitmentDate !== commitmentDateEnd,
  };
};

export type LenderDueGroupItem = {
  id: number;
  lenderId: number | null;
  lender: string;
  amount: number;
  dueDate: string;
  status: string;
  paymentSource?: LenderWindowPaymentSource;
};

export type LenderDueGroup = {
  key: string;
  lenderId: number | null;
  lenderName: string;
  amount: number;
  dueDate: string;
  dueDateEnd: string;
  isRange: boolean;
  paymentSource: LenderWindowPaymentSource | 'MIXED';
  itemIds: number[];
  items: LenderDueGroupItem[];
};

/** Group scheduled dues already in a period by prestamista (no extra window filter). */
export const groupDuePaymentsByLender = <T extends LenderDueGroupItem>(
  items: readonly T[],
): Array<LenderDueGroup & { items: T[] }> => {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const sourceKey = item.paymentSource ?? 'WALLET';
    const key =
      item.lenderId != null
        ? `id:${item.lenderId}:${sourceKey}`
        : `name:${lenderNameKey(item.lender)}:${sourceKey}`;
    const rows = groups.get(key) ?? [];
    rows.push(item);
    groups.set(key, rows);
  }

  return [...groups.entries()]
    .map(([key, rows]) => {
      const sorted = [...rows].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
      const sources = new Set(
        sorted
          .map((row) => row.paymentSource)
          .filter((source): source is LenderWindowPaymentSource => source != null),
      );
      const paymentSource: LenderWindowPaymentSource | 'MIXED' =
        sources.size === 1
          ? ([...sources][0] as LenderWindowPaymentSource)
          : sources.size > 1
            ? 'MIXED'
            : 'WALLET';
      const dueDate = sorted[0]!.dueDate;
      const dueDateEnd = sorted[sorted.length - 1]!.dueDate;
      return {
        key,
        lenderId: sorted[0]!.lenderId,
        lenderName: sorted[0]!.lender,
        amount: roundMoney(sorted.reduce((sum, row) => sum + row.amount, 0)),
        dueDate,
        dueDateEnd,
        isRange: dueDate !== dueDateEnd,
        paymentSource,
        itemIds: sorted.map((row) => row.id),
        items: sorted,
      };
    })
    .sort(
      (a, b) =>
        a.dueDate.localeCompare(b.dueDate) ||
        a.lenderName.localeCompare(b.lenderName, 'es'),
    );
};
