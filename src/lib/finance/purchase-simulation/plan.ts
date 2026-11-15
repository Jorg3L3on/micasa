import { ymdForDayInMonth } from '@/lib/calendar-dates';
import { cardStatementForCharge } from '@/lib/finance/liquidity-scenario';

/**
 * Purchase simulation, step 1 (MIC-I17-1): turn a purchase described the way
 * people say it ("$6,000 con mi tarjeta a 12 meses sin intereses") into dated
 * payments. Pure: no Prisma, no clock. Amounts in pesos rounded to cents.
 */

export type PurchaseMode = 'contado' | 'msi' | 'credito';

import {
  ASSUMED_CUTOFF_DAY,
  ASSUMED_DUE_DAY,
  CREDIT_MAX_MONTHS,
  DEFAULT_CREDIT_PAYMENT_DAY,
  MSI_MONTH_OPTIONS,
} from '@/lib/finance/purchase-simulation/constants';

export { ASSUMED_CUTOFF_DAY, ASSUMED_DUE_DAY, CREDIT_MAX_MONTHS, DEFAULT_CREDIT_PAYMENT_DAY, MSI_MONTH_OPTIONS };

export type PlanWallet = {
  id: number;
  name: string;
  /** True for CREDIT_CARD and DEPARTMENT_STORE_CARD. */
  isCard: boolean;
  cutoff_day: number | null;
  due_day: number | null;
};

export type PurchasePlanInput = {
  total: number;
  /** Purchase day, YYYY-MM-DD. */
  date: string;
  mode: PurchaseMode;
  /** Wallet that pays (contado), the card (msi), or the card that finances (credito on a card). */
  wallet: PlanWallet;
  /** msi: one of MSI_MONTH_OPTIONS; credito: 1..CREDIT_MAX_MONTHS. */
  months?: number;
  /** credito only: a new loan (auto, casa, personal) or the card in `wallet`. */
  lender?: 'new' | 'card';
  /** credito: annual rate in percent (13.9 = 13.9%). Ignored when monthlyPayment is set. */
  annualRatePct?: number;
  /** credito: the mensualidad the person already knows. */
  monthlyPayment?: number;
  /** credito with a new loan: enganche paid on the purchase day. */
  downPayment?: number;
  downWallet?: { id: number; name: string } | null;
  /** credito with a new loan: wallet the mensualidades leave from. */
  payWallet?: { id: number; name: string } | null;
  /** credito with a new loan: day of month for mensualidades (default 5). */
  paymentDay?: number;
  /** credito with a new loan: running cost per month (seguro, gasolina…), from the first mensualidad. */
  extraMonthly?: number;
};

export type PlannedPaymentKind = 'single' | 'cuota' | 'enganche' | 'mensualidad';

export type PlannedPayment = {
  date: string;
  amount: number;
  /** Part of `amount` that lowers the debt (0 for enganche and debit contado). */
  principal: number;
  interest: number;
  kind: PlannedPaymentKind;
  label: string;
  number: number | null;
  of: number | null;
  /** Wallet the cash leaves from on `date` (null when it is the financing card's own payment). */
  walletId: number | null;
  walletName: string;
  /** True when the payment is part of a card's statement payment. */
  onCard: boolean;
};

export type PlanDataGap = {
  code: 'CARD_MISSING_DAYS';
  walletId: number;
  walletName: string;
  assumedCutoffDay: number;
  assumedDueDay: number;
};

export type PurchasePlan = {
  mode: PurchaseMode;
  purchaseDate: string;
  total: number;
  payments: PlannedPayment[];
  /** Statement cutoff that bills the purchase (cards only). */
  cutoffDate: string | null;
  firstDueDate: string;
  lastDueDate: string;
  /** Payments excluding the enganche. */
  count: number;
  /** Amount of each payment excluding the enganche (cuota / mensualidad / single). */
  regularPayment: number;
  interest: number;
  /** Debt the purchase creates (0 for debit contado). */
  principal: number;
  downPayment: number;
  /** Card id carrying the debt, 'new' for a new loan, null when nothing is owed. */
  debtWalletId: number | 'new' | null;
  extraMonthly: { amount: number; fromDate: string; day: number } | null;
  dataGaps: PlanDataGap[];
};

export class PurchasePlanError extends Error {
  constructor(
    message: string,
    readonly field: 'total' | 'months' | 'downPayment' | 'mode' | 'monthlyPayment',
  ) {
    super(message);
  }
}

const cents = (n: number) => Math.round(n * 100) / 100;

/** Same day of month `offset` months later, clamped to the month's last day. */
export const addMonthsYmd = (ymd: string, offset: number, day?: number): string => {
  const year = Number(ymd.slice(0, 4));
  const month = Number(ymd.slice(5, 7)) - 1 + offset;
  const y = year + Math.floor(month / 12);
  const m = ((month % 12) + 12) % 12;
  const key = `${y}-${String(m + 1).padStart(2, '0')}`;
  return ymdForDayInMonth(key, day ?? Number(ymd.slice(8, 10)))!;
};

/** Monthly payment for an amortized loan; `annualRatePct` 0 means no interest. */
export const amortizedPayment = (principal: number, annualRatePct: number, months: number): number => {
  if (principal <= 0) return 0;
  const r = annualRatePct / 1200;
  if (r <= 0) return principal / months;
  return (principal * r) / (1 - (1 + r) ** -months);
};

const cardDays = (wallet: PlanWallet, gaps: PlanDataGap[]) => {
  if (wallet.cutoff_day != null && wallet.due_day != null) {
    return { cutoff: wallet.cutoff_day, due: wallet.due_day };
  }
  gaps.push({
    code: 'CARD_MISSING_DAYS',
    walletId: wallet.id,
    walletName: wallet.name,
    assumedCutoffDay: wallet.cutoff_day ?? ASSUMED_CUTOFF_DAY,
    assumedDueDay: wallet.due_day ?? ASSUMED_DUE_DAY,
  });
  return {
    cutoff: wallet.cutoff_day ?? ASSUMED_CUTOFF_DAY,
    due: wallet.due_day ?? ASSUMED_DUE_DAY,
  };
};

/**
 * Splits `count` equal payments into principal and interest. The last payment
 * absorbs rounding so the principal adds up to exactly `principal`.
 */
const amortize = (principal: number, annualRatePct: number | null, payment: number, count: number) => {
  const rows: { principal: number; interest: number }[] = [];
  let balance = principal;
  const r = annualRatePct != null ? annualRatePct / 1200 : null;
  for (let i = 0; i < count; i++) {
    const last = i === count - 1;
    let interest: number;
    let pr: number;
    if (r == null) {
      // Known mensualidad without a rate: spread interest evenly.
      pr = last ? balance : cents(principal / count);
      interest = cents(payment - pr);
    } else {
      interest = cents(balance * r);
      pr = last ? balance : cents(Math.min(balance, payment - interest));
    }
    balance = cents(balance - pr);
    rows.push({ principal: cents(pr), interest: Math.max(0, interest) });
  }
  return rows;
};

export function buildPurchasePlan(input: PurchasePlanInput): PurchasePlan {
  const total = cents(input.total);
  if (!(total > 0)) throw new PurchasePlanError('El precio debe ser mayor a $0.', 'total');

  const gaps: PlanDataGap[] = [];
  const payments: PlannedPayment[] = [];
  const { wallet } = input;
  let cutoffDate: string | null = null;
  let principal = 0;
  let interest = 0;
  let downPayment = 0;
  let debtWalletId: PurchasePlan['debtWalletId'] = null;
  let extraMonthly: PurchasePlan['extraMonthly'] = null;

  if (input.mode === 'contado') {
    if (wallet.isCard) {
      const days = cardDays(wallet, gaps);
      const statement = cardStatementForCharge(input.date, days.cutoff, days.due);
      cutoffDate = statement.statementEnd;
      payments.push({
        date: statement.dueDate,
        amount: total,
        principal: total,
        interest: 0,
        kind: 'single',
        label: 'Pago completo',
        number: null,
        of: null,
        walletId: wallet.id,
        walletName: wallet.name,
        onCard: true,
      });
      principal = total;
      debtWalletId = wallet.id;
    } else {
      payments.push({
        date: input.date,
        amount: total,
        principal: 0,
        interest: 0,
        kind: 'single',
        label: 'Pago de contado',
        number: null,
        of: null,
        walletId: wallet.id,
        walletName: wallet.name,
        onCard: false,
      });
    }
  } else if (input.mode === 'msi') {
    if (!wallet.isCard) {
      throw new PurchasePlanError('Meses sin intereses solo con tarjeta.', 'mode');
    }
    const months = input.months ?? 0;
    if (!(MSI_MONTH_OPTIONS as readonly number[]).includes(months)) {
      throw new PurchasePlanError('Elige 3, 6, 9, 12, 18 o 24 meses.', 'months');
    }
    const days = cardDays(wallet, gaps);
    const statement = cardStatementForCharge(input.date, days.cutoff, days.due);
    cutoffDate = statement.statementEnd;
    const cuota = cents(total / months);
    for (let i = 0; i < months; i++) {
      const last = i === months - 1;
      const amount = last ? cents(total - cuota * (months - 1)) : cuota;
      payments.push({
        date: addMonthsYmd(statement.dueDate, i, days.due),
        amount,
        principal: amount,
        interest: 0,
        kind: 'cuota',
        label: `Cuota ${i + 1} de ${months}`,
        number: i + 1,
        of: months,
        walletId: wallet.id,
        walletName: wallet.name,
        onCard: true,
      });
    }
    principal = total;
    debtWalletId = wallet.id;
  } else {
    const months = input.months ?? 0;
    if (!Number.isInteger(months) || months < 1 || months > CREDIT_MAX_MONTHS) {
      throw new PurchasePlanError(`Indica de 1 a ${CREDIT_MAX_MONTHS} meses.`, 'months');
    }
    const onCard = input.lender === 'card';
    if (onCard && !wallet.isCard) {
      throw new PurchasePlanError('Elige una tarjeta para pagar con intereses.', 'mode');
    }
    downPayment = onCard ? 0 : cents(input.downPayment ?? 0);
    if (downPayment < 0 || downPayment > total) {
      throw new PurchasePlanError('El enganche no puede ser mayor al precio.', 'downPayment');
    }
    principal = cents(total - downPayment);
    const known = input.monthlyPayment != null && input.monthlyPayment > 0;
    if (known && input.monthlyPayment! * months < principal) {
      throw new PurchasePlanError(
        'Con esa mensualidad no se termina de pagar el crédito.',
        'monthlyPayment',
      );
    }
    const rate = known ? null : Math.max(0, input.annualRatePct ?? 0);
    const payment = cents(known ? input.monthlyPayment! : amortizedPayment(principal, rate!, months));
    const split = amortize(principal, rate, payment, months);

    let first: string;
    let day: number;
    if (onCard) {
      const days = cardDays(wallet, gaps);
      const statement = cardStatementForCharge(input.date, days.cutoff, days.due);
      cutoffDate = statement.statementEnd;
      first = statement.dueDate;
      day = days.due;
    } else {
      day = input.paymentDay ?? DEFAULT_CREDIT_PAYMENT_DAY;
      first = addMonthsYmd(input.date, 1, day);
    }

    if (downPayment > 0) {
      payments.push({
        date: input.date,
        amount: downPayment,
        principal: 0,
        interest: 0,
        kind: 'enganche',
        label: 'Enganche',
        number: null,
        of: null,
        walletId: input.downWallet?.id ?? null,
        walletName: input.downWallet?.name ?? 'Tu ahorro',
        onCard: false,
      });
    }
    for (let i = 0; i < months; i++) {
      const last = i === months - 1;
      const amount = last ? cents(split[i].principal + split[i].interest) : payment;
      payments.push({
        date: addMonthsYmd(first, i, day),
        amount: Math.max(amount, split[i].principal),
        principal: split[i].principal,
        interest: split[i].interest,
        kind: onCard ? 'cuota' : 'mensualidad',
        label: `${onCard ? 'Pago' : 'Mensualidad'} ${i + 1} de ${months}`,
        number: i + 1,
        of: months,
        walletId: onCard ? wallet.id : (input.payWallet?.id ?? null),
        walletName: onCard ? wallet.name : (input.payWallet?.name ?? 'Tu billetera'),
        onCard,
      });
    }
    interest = cents(split.reduce((sum, row) => sum + row.interest, 0));
    debtWalletId = onCard ? wallet.id : 'new';
    if (!onCard && (input.extraMonthly ?? 0) > 0) {
      extraMonthly = { amount: cents(input.extraMonthly!), fromDate: first, day };
    }
  }

  const dues = payments.filter((p) => p.kind !== 'enganche');
  return {
    mode: input.mode,
    purchaseDate: input.date,
    total,
    payments,
    cutoffDate,
    firstDueDate: dues[0].date,
    lastDueDate: dues[dues.length - 1].date,
    count: dues.length,
    regularPayment: dues[0].amount,
    interest,
    principal,
    downPayment,
    debtWalletId,
    extraMonthly,
    dataGaps: gaps,
  };
}
