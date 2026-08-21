export type MonthDebtItemKind = 'card' | 'msi' | 'loan';

export type MonthDebtItem = {
  id: string;
  kind: MonthDebtItemKind;
  title: string;
  subtitle: string;
  amount: number;
};

type ObligationLike = {
  source: string;
  next_due_payment: number;
  wallet_id: number;
  wallet_name: string;
  loan_id?: number;
  loan_payment_id?: number;
  loan_name?: string;
  lender?: string;
};

type MilestoneLike = {
  due_date: string;
  obligations: ObligationLike[];
};

type MsiTrackLike = {
  id: string;
  kind: string;
  title: string;
  subtitle: string;
  start_month_key: string;
  end_month_key: string;
  monthly_amount: number;
  wallet_name?: string;
};

export type PayrollDebtLineItem = {
  month_key: string;
  loan_id: number;
  title: string;
  subtitle: string;
  amount: number;
};

const monthKeyFromYmd = (ymd: string): string => ymd.slice(0, 7);

export const buildMonthDebtItems = (
  monthKeys: string[],
  milestones: MilestoneLike[],
  msiTracks: MsiTrackLike[],
  payrollItems: PayrollDebtLineItem[],
): Map<string, MonthDebtItem[]> => {
  const map = new Map<string, MonthDebtItem[]>();
  for (const key of monthKeys) {
    map.set(key, []);
  }

  const push = (key: string, item: MonthDebtItem) => {
    const list = map.get(key);
    if (!list || item.amount <= 0) return;
    list.push(item);
  };

  for (const milestone of milestones) {
    const key = monthKeyFromYmd(milestone.due_date);
    for (const obligation of milestone.obligations) {
      if (obligation.source === 'credit_card_statement') {
        push(key, {
          id: `card-${obligation.wallet_id}-${milestone.due_date}`,
          kind: 'card',
          title: obligation.wallet_name,
          subtitle: 'Pago de tarjeta',
          amount: obligation.next_due_payment,
        });
        continue;
      }
      if (obligation.source === 'loan_payment') {
        push(key, {
          id: `loan-${obligation.loan_id ?? obligation.loan_payment_id}-${milestone.due_date}`,
          kind: 'loan',
          title: obligation.loan_name ?? 'Préstamo',
          subtitle: obligation.lender ?? 'Préstamo',
          amount: obligation.next_due_payment,
        });
      }
    }
  }

  for (const track of msiTracks) {
    if (track.kind !== 'msi') continue;
    for (const key of monthKeys) {
      if (key < track.start_month_key || key > track.end_month_key) continue;
      push(key, {
        id: `${track.id}-${key}`,
        kind: 'msi',
        title: track.title,
        subtitle: track.wallet_name ?? track.subtitle,
        amount: track.monthly_amount,
      });
    }
  }

  const payrollMerged = new Map<string, PayrollDebtLineItem>();
  for (const item of payrollItems) {
    if (item.amount <= 0) continue;
    const mergeKey = `${item.month_key}-${item.loan_id}`;
    const previous = payrollMerged.get(mergeKey);
    if (previous) {
      previous.amount += item.amount;
      continue;
    }
    payrollMerged.set(mergeKey, { ...item });
  }
  for (const item of payrollMerged.values()) {
    push(item.month_key, {
      id: `payroll-${item.loan_id}-${item.month_key}`,
      kind: 'loan',
      title: item.title,
      subtitle: item.subtitle,
      amount: item.amount,
    });
  }

  for (const list of map.values()) {
    sortMonthDebtItems(list);
  }

  return map;
};

export type MonthDebtItemInput = {
  month_key: string;
  kind: MonthDebtItemKind;
  group_id: string;
  title: string;
  subtitle: string;
  amount: number;
};

const roundMoney = (value: number): number => Math.round(value * 100) / 100;

const sortMonthDebtItems = (list: MonthDebtItem[]): void => {
  list.sort((a, b) => {
    const amountDiff = b.amount - a.amount;
    if (amountDiff !== 0) return amountDiff;
    return a.title.localeCompare(b.title, 'es');
  });
};

/** Merge same-concept rows (one wallet / one loan) into a month list. */
export const groupDebtItemsByMonth = (
  inputs: readonly MonthDebtItemInput[],
): Map<string, MonthDebtItem[]> => {
  const merged = new Map<string, { month_key: string; item: MonthDebtItem }>();
  for (const input of inputs) {
    if (input.amount <= 0) continue;
    const mergeKey = `${input.month_key}::${input.kind}::${input.group_id}`;
    const previous = merged.get(mergeKey);
    if (previous) {
      previous.item.amount = roundMoney(previous.item.amount + input.amount);
      continue;
    }
    merged.set(mergeKey, {
      month_key: input.month_key,
      item: {
        id: `${input.kind}-${input.group_id}-${input.month_key}`,
        kind: input.kind,
        title: input.title,
        subtitle: input.subtitle,
        amount: roundMoney(input.amount),
      },
    });
  }

  const map = new Map<string, MonthDebtItem[]>();
  for (const { month_key, item } of merged.values()) {
    const list = map.get(month_key) ?? [];
    list.push(item);
    map.set(month_key, list);
  }
  for (const list of map.values()) {
    sortMonthDebtItems(list);
  }
  return map;
};

export const pastLoanDebtSubtitle = (paymentSource: string, lender: string): string =>
  paymentSource === 'PAYROLL_DEDUCTION' ? `Nómina · ${lender}` : lender;

export const monthDebtItemsTotal = (items: readonly MonthDebtItem[]): number =>
  items.reduce((sum, item) => sum + item.amount, 0);
