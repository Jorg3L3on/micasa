export type UpcomingPaymentsChartInput = {
  paymentHistory: Array<{ paid_at: string; amount: number }>;
  installmentActivePurchases: Array<{
    id?: number;
    description?: string;
    amount: number;
    credit_installment_current: number | null;
    credit_installment_total: number | null;
    fortnight_year?: number;
    fortnight_month?: number;
    fortnight_period?: 'FIRST' | 'SECOND';
  }>;
  statementEnd: string;
  scheduledPayments: Array<{
    id?: number;
    dueDate: string;
    amount: number;
    label?: string | null;
    status: 'SCHEDULED' | 'PAID';
  }>;
  installmentPlans: Array<{
    id?: number;
    name?: string;
    payments: Array<{
      id?: number;
      dueDate: string;
      amount: number;
      status: 'SCHEDULED' | 'PAID';
    }>;
  }>;
  /** YYYY-MM in America/Mexico_City — first month on the axis. */
  fromMonthKey: string;
};

export type UpcomingPaymentsChartPoint = {
  monthKey: string;
  label: string;
  paid: number;
  pending: number;
  msi: number;
  plans: number;
  scheduled: number;
};

export type UpcomingPaymentSourceKind = 'scheduled' | 'msi' | 'plan';

export type UpcomingPaymentSourceRow = {
  id: string;
  kind: UpcomingPaymentSourceKind;
  monthKey: string;
  amount: number;
  title: string;
  subtitle: string;
  dueDate?: string;
  scheduledPaymentId?: number;
  fortnightHref?: string;
};

export const monthKeyFromYmd = (ymd: string) => ymd.slice(0, 7);

export const addMonthsToMonthKey = (key: string, delta: number): string => {
  const [year, month] = key.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
};

export const labelFromMonthKey = (key: string): string => {
  const [year, month] = key.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, 15));
  return date
    .toLocaleDateString('es-MX', {
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    })
    .replace('.', '');
};

const monthKeysInclusive = (from: string, to: string): string[] => {
  if (to < from) return [from];
  const keys: string[] = [];
  let cursor = from;
  while (cursor <= to && keys.length < 60) {
    keys.push(cursor);
    cursor = addMonthsToMonthKey(cursor, 1);
  }
  return keys;
};

type Bucket = {
  paid: number;
  msi: number;
  plans: number;
  scheduled: number;
};

const emptyBucket = (): Bucket => ({
  paid: 0,
  msi: 0,
  plans: 0,
  scheduled: 0,
});

/**
 * Forward-looking month series: current month through the last month with
 * something still to pay (MSI remaining, plan cuotas, scheduled payments).
 * Historical paid months before `fromMonthKey` are omitted.
 */
export const buildUpcomingCreditCardPaymentsChart = (
  input: UpcomingPaymentsChartInput,
): UpcomingPaymentsChartPoint[] => {
  const buckets = new Map<string, Bucket>();
  const ensure = (key: string) => {
    if (!buckets.has(key)) buckets.set(key, emptyBucket());
    return buckets.get(key)!;
  };

  for (const payment of input.paymentHistory) {
    const key = monthKeyFromYmd(payment.paid_at);
    if (key < input.fromMonthKey) continue;
    ensure(key).paid += Number(payment.amount) || 0;
  }

  const [statementYear, statementMonth] = input.statementEnd.split('-').map(Number);
  for (const purchase of input.installmentActivePurchases) {
    if (
      purchase.credit_installment_current == null ||
      purchase.credit_installment_total == null
    ) {
      continue;
    }
    const remaining =
      purchase.credit_installment_total - purchase.credit_installment_current;
    for (let i = 1; i <= remaining; i += 1) {
      const future = new Date(
        Date.UTC(statementYear, statementMonth - 1 + i, 1),
      );
      const key = `${future.getUTCFullYear()}-${String(future.getUTCMonth() + 1).padStart(2, '0')}`;
      if (key < input.fromMonthKey) continue;
      ensure(key).msi += Number(purchase.amount) || 0;
    }
  }

  for (const plan of input.installmentPlans) {
    for (const payment of plan.payments) {
      if (payment.status !== 'SCHEDULED') continue;
      const key = monthKeyFromYmd(payment.dueDate);
      if (key < input.fromMonthKey) continue;
      ensure(key).plans += Number(payment.amount) || 0;
    }
  }

  for (const payment of input.scheduledPayments) {
    if (payment.status !== 'SCHEDULED') continue;
    const key = monthKeyFromYmd(payment.dueDate);
    if (key < input.fromMonthKey) continue;
    ensure(key).scheduled += Number(payment.amount) || 0;
  }

  let lastPendingKey = input.fromMonthKey;
  for (const [key, bucket] of buckets.entries()) {
    const pending = bucket.msi + bucket.plans + bucket.scheduled;
    if (pending > 0 && key > lastPendingKey) lastPendingKey = key;
  }

  const hasAnyPending = Array.from(buckets.values()).some(
    (bucket) => bucket.msi + bucket.plans + bucket.scheduled > 0,
  );
  const hasPaidInWindow = Array.from(buckets.entries()).some(
    ([key, bucket]) => key >= input.fromMonthKey && bucket.paid > 0,
  );

  if (!hasAnyPending && !hasPaidInWindow) {
    return [];
  }

  const endKey = hasAnyPending ? lastPendingKey : input.fromMonthKey;

  return monthKeysInclusive(input.fromMonthKey, endKey).map((key) => {
    const bucket = buckets.get(key) ?? emptyBucket();
    const pending = bucket.msi + bucket.plans + bucket.scheduled;
    return {
      monthKey: key,
      label: labelFromMonthKey(key),
      paid: bucket.paid,
      pending,
      msi: bucket.msi,
      plans: bucket.plans,
      scheduled: bucket.scheduled,
    };
  });
};

const msiMonthKey = (
  statementYear: number,
  statementMonth: number,
  offset: number,
) => {
  const future = new Date(Date.UTC(statementYear, statementMonth - 1 + offset, 1));
  return `${future.getUTCFullYear()}-${String(future.getUTCMonth() + 1).padStart(2, '0')}`;
};

/**
 * Line items that explain each yellow bar: scheduled payments, MSI cuotas,
 * and remaining plan installments from `fromMonthKey` onward.
 */
export const buildUpcomingCreditCardPaymentSources = (
  input: UpcomingPaymentsChartInput,
  ownerQueryString = '',
): UpcomingPaymentSourceRow[] => {
  const rows: UpcomingPaymentSourceRow[] = [];
  const [statementYear, statementMonth] = input.statementEnd.split('-').map(Number);

  for (const payment of input.scheduledPayments) {
    if (payment.status !== 'SCHEDULED') continue;
    const monthKey = monthKeyFromYmd(payment.dueDate);
    if (monthKey < input.fromMonthKey) continue;
    rows.push({
      id: `scheduled-${payment.id ?? payment.dueDate}-${payment.amount}`,
      kind: 'scheduled',
      monthKey,
      amount: Number(payment.amount) || 0,
      title: payment.label?.trim() || 'Pago programado',
      subtitle: 'Programado',
      dueDate: payment.dueDate,
      scheduledPaymentId: payment.id,
    });
  }

  for (const purchase of input.installmentActivePurchases) {
    if (
      purchase.credit_installment_current == null ||
      purchase.credit_installment_total == null
    ) {
      continue;
    }
    const remaining =
      purchase.credit_installment_total - purchase.credit_installment_current;
    const fortnightHref =
      purchase.fortnight_year != null &&
      purchase.fortnight_month != null &&
      purchase.fortnight_period
        ? `/fortnight/${purchase.fortnight_year}/${String(purchase.fortnight_month).padStart(2, '0')}/${purchase.fortnight_period}${ownerQueryString}`
        : undefined;
    for (let i = 1; i <= remaining; i += 1) {
      const monthKey = msiMonthKey(statementYear, statementMonth, i);
      if (monthKey < input.fromMonthKey) continue;
      const installmentNumber = purchase.credit_installment_current + i;
      rows.push({
        id: `msi-${purchase.id ?? purchase.description}-${monthKey}`,
        kind: 'msi',
        monthKey,
        amount: Number(purchase.amount) || 0,
        title: purchase.description?.trim() || 'Compra a meses',
        subtitle: `MSI · cuota ${installmentNumber} de ${purchase.credit_installment_total}`,
        fortnightHref,
      });
    }
  }

  for (const plan of input.installmentPlans) {
    for (const payment of plan.payments) {
      if (payment.status !== 'SCHEDULED') continue;
      const monthKey = monthKeyFromYmd(payment.dueDate);
      if (monthKey < input.fromMonthKey) continue;
      rows.push({
        id: `plan-${plan.id ?? plan.name}-${payment.id ?? payment.dueDate}`,
        kind: 'plan',
        monthKey,
        amount: Number(payment.amount) || 0,
        title: plan.name?.trim() || 'Plan a meses',
        subtitle: 'Plan a meses',
        dueDate: payment.dueDate,
      });
    }
  }

  return rows.sort((a, b) => {
    const month = a.monthKey.localeCompare(b.monthKey);
    if (month !== 0) return month;
    return a.title.localeCompare(b.title, 'es');
  });
};
