export type MonthDebtItemKind = 'card' | 'msi' | 'loan';

export type MonthDebtItem = {
  id: string;
  kind: MonthDebtItemKind;
  title: string;
  subtitle: string;
  /** Remaining balance owed as of this month (projection), or paid amount (past). */
  amount: number;
  /** Payment due this month for cash-flow chart/metrics. */
  payment_amount?: number;
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

type TrackScheduleEntry = {
  month_key: string;
  amount: number;
};

type DebtTrackLike = {
  id: string;
  kind: string;
  title: string;
  subtitle: string;
  start_month_key: string;
  end_month_key: string;
  monthly_amount: number;
  schedule?: TrackScheduleEntry[];
  wallet_name?: string;
};

/** @deprecated Payroll rows are folded into loan tracks with schedules. */
export type PayrollDebtLineItem = {
  month_key: string;
  loan_id: number;
  title: string;
  subtitle: string;
  amount: number;
};

const monthKeyFromYmd = (ymd: string): string => ymd.slice(0, 7);

const roundMoney = (value: number): number => Math.round(value * 100) / 100;

const remainingBalanceFromSchedule = (
  schedule: readonly TrackScheduleEntry[],
  monthKey: string,
): number =>
  roundMoney(
    schedule
      .filter((entry) => entry.month_key >= monthKey)
      .reduce((sum, entry) => sum + entry.amount, 0),
  );

const paymentDueInMonth = (
  schedule: readonly TrackScheduleEntry[],
  monthKey: string,
): number =>
  roundMoney(
    schedule
      .filter((entry) => entry.month_key === monthKey)
      .reduce((sum, entry) => sum + entry.amount, 0),
  );

const scheduleForTrack = (track: DebtTrackLike): TrackScheduleEntry[] => {
  if (track.schedule && track.schedule.length > 0) {
    return track.schedule;
  }
  // Fallback for tracks without an explicit schedule (monthly annuity).
  const entries: TrackScheduleEntry[] = [];
  let [year, month] = track.start_month_key.split('-').map(Number);
  const end = track.end_month_key;
  while (true) {
    const key = `${year}-${String(month).padStart(2, '0')}`;
    if (key > end) break;
    entries.push({ month_key: key, amount: track.monthly_amount });
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return entries;
};

/**
 * Builds per-month debt concepts.
 * `amount` is remaining balance as of that month (declines after each cuota).
 * `payment_amount` is what is due that month (for cash-flow chart/metrics).
 */
export const buildMonthDebtItems = (
  monthKeys: string[],
  milestones: MilestoneLike[],
  debtTracks: DebtTrackLike[],
  _payrollItems: PayrollDebtLineItem[] = [],
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

  // Revolving card statement dues (current cycle estimate / ledger).
  for (const milestone of milestones) {
    const key = monthKeyFromYmd(milestone.due_date);
    for (const obligation of milestone.obligations) {
      if (obligation.source !== 'credit_card_statement') continue;
      push(key, {
        id: `card-${obligation.wallet_id}-${milestone.due_date}`,
        kind: 'card',
        title: obligation.wallet_name,
        subtitle: 'Adeudo de tarjeta',
        amount: obligation.next_due_payment,
        payment_amount: obligation.next_due_payment,
      });
    }
  }

  for (const track of debtTracks) {
    if (track.kind !== 'loan' && track.kind !== 'msi') continue;
    const schedule = scheduleForTrack(track);
    if (schedule.length === 0) continue;

    const firstMonth = schedule[0]!.month_key;
    const lastMonth = schedule[schedule.length - 1]!.month_key;

    for (const key of monthKeys) {
      if (key < firstMonth || key > lastMonth) continue;
      // Only show while the track is still active in the visible horizon window.
      if (key < track.start_month_key || key > track.end_month_key) continue;

      const remaining = remainingBalanceFromSchedule(schedule, key);
      if (remaining <= 0) continue;

      const payment = paymentDueInMonth(schedule, key);
      const kind: MonthDebtItemKind = track.kind === 'msi' ? 'msi' : 'loan';
      push(key, {
        id: `${track.id}-${key}`,
        kind,
        title: track.title,
        subtitle:
          kind === 'msi'
            ? (track.wallet_name ?? track.subtitle)
            : track.subtitle,
        amount: remaining,
        payment_amount: payment,
      });
    }
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

/** Sum of remaining balances (projection table total). */
export const monthDebtItemsTotal = (items: readonly MonthDebtItem[]): number =>
  items.reduce((sum, item) => sum + item.amount, 0);

/** Sum of payments due this month (chart / “Deudas de este mes”). */
export const monthDebtPaymentsTotal = (items: readonly MonthDebtItem[]): number =>
  items.reduce((sum, item) => sum + (item.payment_amount ?? 0), 0);
