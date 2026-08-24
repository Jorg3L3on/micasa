import prisma from '@/lib/prisma';
import { PaymentMethodType } from '@/generated/prisma/client';
import {
  formatCalendarDate,
  todayCalendarDate,
} from '@/lib/calendar-dates';
import type { OwnerFilter } from '@/lib/server/get-owner-context';
import type {
  CreateCreditCardInstallmentPlanInput,
  UpdateCreditCardInstallmentPlanInput,
} from '@/schemas/credit-card-installment-plan.schema';
import { ensureCreditWalletType } from '@/lib/finance/wallet-accounting';
import { applyWalletAmountDelta } from '@/lib/finance/wallet-accounting';
import {
  defaultNextDueDateForCard,
  formatPlanEndMonthLabel,
  generateInstallmentPlanPayments,
} from '@/lib/finance/credit-card-installment-plan-schedule';

export type CreditCardInstallmentPlanPaymentItem = {
  id: number;
  sequence: number;
  dueDate: string;
  amount: number;
  status: 'SCHEDULED' | 'PAID';
  paidAt: string | null;
};

export type CreditCardInstallmentPlanItem = {
  id: number;
  creditCardWalletId: number;
  name: string;
  installmentAmount: number;
  totalInstallments: number;
  paidInstallments: number;
  currentInstallment: number;
  remainingInstallments: number;
  progressPct: number;
  alreadyInCardBalance: boolean;
  status: 'ACTIVE' | 'COMPLETED';
  endMonthLabel: string;
  nextDueDate: string | null;
  payments: CreditCardInstallmentPlanPaymentItem[];
};

const creditCardWalletTypes: PaymentMethodType[] = [
  PaymentMethodType.CREDIT_CARD,
  PaymentMethodType.DEPARTMENT_STORE_CARD,
];

function decimalToNumber(value: unknown): number {
  if (
    typeof value === 'object' &&
    value != null &&
    'toNumber' in value &&
    typeof (value as { toNumber: () => number }).toNumber === 'function'
  ) {
    return (value as { toNumber: () => number }).toNumber();
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

const mapPayment = (row: {
  id: number;
  sequence: number;
  due_date: Date;
  amount: unknown;
  status: 'SCHEDULED' | 'PAID';
  paid_at: Date | null;
}): CreditCardInstallmentPlanPaymentItem => ({
  id: row.id,
  sequence: row.sequence,
  dueDate: formatCalendarDate(row.due_date),
  amount: decimalToNumber(row.amount),
  status: row.status,
  paidAt: row.paid_at ? formatCalendarDate(row.paid_at) : null,
});

const mapPlan = (row: {
  id: number;
  credit_card_wallet_id: number;
  name: string;
  installment_amount: unknown;
  total_installments: number;
  paid_installments: number;
  already_in_card_balance: boolean;
  status: 'ACTIVE' | 'COMPLETED';
  payments: Array<Parameters<typeof mapPayment>[0]>;
}): CreditCardInstallmentPlanItem => {
  const payments = row.payments
    .map(mapPayment)
    .sort((a, b) => a.sequence - b.sequence);
  const scheduled = payments.filter((p) => p.status === 'SCHEDULED');
  const nextDueDate = scheduled[0]?.dueDate ?? null;
  const lastPayment = payments[payments.length - 1];
  const endMonthLabel = lastPayment
    ? formatPlanEndMonthLabel(lastPayment.dueDate)
    : '';
  const currentInstallment =
    row.status === 'COMPLETED'
      ? row.total_installments
      : row.paid_installments + 1;
  const remainingInstallments = scheduled.length;
  const progressPct = Math.round(
    (row.paid_installments / row.total_installments) * 100,
  );

  return {
    id: row.id,
    creditCardWalletId: row.credit_card_wallet_id,
    name: row.name,
    installmentAmount: decimalToNumber(row.installment_amount),
    totalInstallments: row.total_installments,
    paidInstallments: row.paid_installments,
    currentInstallment,
    remainingInstallments,
    progressPct,
    alreadyInCardBalance: row.already_in_card_balance,
    status: row.status,
    endMonthLabel,
    nextDueDate,
    payments,
  };
};

async function assertCreditCardWallet(
  walletId: number,
  ownerFilter: OwnerFilter,
) {
  const wallet = await prisma.wallet.findFirst({
    where: {
      id: walletId,
      ...ownerFilter,
      type: { in: creditCardWalletTypes },
    },
    select: {
      id: true,
      type: true,
      user_id: true,
      house_id: true,
      due_day: true,
      amount: true,
      credit_limit: true,
    },
  });

  if (!wallet) {
    const error = new Error('Tarjeta no encontrada');
    (error as { code?: string }).code = 'WALLET_NOT_FOUND';
    throw error;
  }

  ensureCreditWalletType(wallet);
  return wallet;
}

const planInclude = {
  payments: {
    orderBy: { sequence: 'asc' as const },
  },
};

export async function listInstallmentPlansForCard(
  walletId: number,
  ownerFilter: OwnerFilter,
  options?: { activeOnly?: boolean },
): Promise<CreditCardInstallmentPlanItem[]> {
  await assertCreditCardWallet(walletId, ownerFilter);

  const rows = await prisma.creditCardInstallmentPlan.findMany({
    where: {
      credit_card_wallet_id: walletId,
      ...ownerFilter,
      ...(options?.activeOnly ? { status: 'ACTIVE' } : {}),
    },
    include: planInclude,
    orderBy: [{ status: 'asc' }, { created_at: 'desc' }],
  });

  return rows.map(mapPlan);
}

export async function createInstallmentPlan(
  walletId: number,
  ownerFilter: OwnerFilter,
  input: CreateCreditCardInstallmentPlanInput,
): Promise<CreditCardInstallmentPlanItem> {
  const wallet = await assertCreditCardWallet(walletId, ownerFilter);

  const nextDueDate =
    input.next_due_date ??
    (wallet.due_day != null
      ? defaultNextDueDateForCard(wallet.due_day)
      : todayCalendarDate());

  const generated = generateInstallmentPlanPayments({
    installmentAmount: input.installment_amount,
    totalInstallments: input.total_installments,
    paidInstallments: input.paid_installments,
    nextDueDate,
  });

  const remainingCount = input.total_installments - input.paid_installments;
  const debtDelta = input.already_in_card_balance
    ? 0
    : remainingCount * input.installment_amount;

  if (
    !input.already_in_card_balance &&
    wallet.credit_limit != null &&
    decimalToNumber(wallet.amount) + debtDelta >
      decimalToNumber(wallet.credit_limit)
  ) {
    const error = new Error(
      'El saldo restante del plan supera el crédito disponible',
    );
    (error as { code?: string }).code = 'INSUFFICIENT_CREDIT';
    throw error;
  }

  const plan = await prisma.$transaction(async (tx) => {
    const created = await tx.creditCardInstallmentPlan.create({
      data: {
        credit_card_wallet_id: walletId,
        name: input.name.trim(),
        installment_amount: input.installment_amount,
        total_installments: input.total_installments,
        paid_installments: input.paid_installments,
        already_in_card_balance: input.already_in_card_balance,
        status:
          input.paid_installments >= input.total_installments
            ? 'COMPLETED'
            : 'ACTIVE',
        user_id: wallet.user_id,
        house_id: wallet.house_id,
        payments: {
          create: generated.map((payment) => ({
            sequence: payment.sequence,
            due_date: payment.dueDate,
            amount: payment.amount,
            status: payment.status,
            ...(payment.status === 'PAID' ? { paid_at: new Date() } : {}),
          })),
        },
      },
      include: planInclude,
    });

    if (debtDelta > 0) {
      await applyWalletAmountDelta(tx, walletId, debtDelta);
    }

    return created;
  });

  return mapPlan(plan);
}

function firstScheduledDueDateYmd(
  payments: Array<{ status: 'SCHEDULED' | 'PAID'; due_date: Date }>,
): string | null {
  const scheduled = payments
    .filter((payment) => payment.status === 'SCHEDULED')
    .sort((a, b) => a.due_date.getTime() - b.due_date.getTime());
  return scheduled[0] ? formatCalendarDate(scheduled[0].due_date) : null;
}

function hasStructuralPlanChanges(
  existing: {
    installment_amount: unknown;
    total_installments: number;
    paid_installments: number;
    already_in_card_balance: boolean;
    payments: Array<{ status: 'SCHEDULED' | 'PAID'; due_date: Date }>;
  },
  input: UpdateCreditCardInstallmentPlanInput,
  nextDueDate: string,
): boolean {
  if (decimalToNumber(existing.installment_amount) !== input.installment_amount) {
    return true;
  }
  if (existing.total_installments !== input.total_installments) {
    return true;
  }
  if (existing.paid_installments !== input.paid_installments) {
    return true;
  }
  if (existing.already_in_card_balance !== input.already_in_card_balance) {
    return true;
  }

  const existingNextDue = firstScheduledDueDateYmd(existing.payments);
  return existingNextDue !== nextDueDate;
}

export async function updateInstallmentPlan(
  planId: number,
  walletId: number,
  ownerFilter: OwnerFilter,
  input: UpdateCreditCardInstallmentPlanInput,
): Promise<CreditCardInstallmentPlanItem> {
  const wallet = await assertCreditCardWallet(walletId, ownerFilter);

  const existing = await prisma.creditCardInstallmentPlan.findFirst({
    where: {
      id: planId,
      credit_card_wallet_id: walletId,
      ...ownerFilter,
    },
    include: planInclude,
  });

  if (!existing) {
    const error = new Error('Plan de cuotas no encontrado');
    (error as { code?: string }).code = 'NOT_FOUND';
    throw error;
  }

  const nextDueDate =
    input.next_due_date ??
    firstScheduledDueDateYmd(existing.payments) ??
    (wallet.due_day != null
      ? defaultNextDueDateForCard(wallet.due_day)
      : todayCalendarDate());

  const structuralChanges = hasStructuralPlanChanges(
    existing,
    input,
    nextDueDate,
  );

  if (!structuralChanges) {
    if (existing.name.trim() === input.name.trim()) {
      return mapPlan(existing);
    }

    const updated = await prisma.creditCardInstallmentPlan.update({
      where: { id: planId },
      data: { name: input.name.trim() },
      include: planInclude,
    });
    return mapPlan(updated);
  }

  const generated = generateInstallmentPlanPayments({
    installmentAmount: input.installment_amount,
    totalInstallments: input.total_installments,
    paidInstallments: input.paid_installments,
    nextDueDate,
  });

  const existingBySequence = new Map(
    existing.payments.map((payment) => [payment.sequence, payment]),
  );

  const oldScheduledTotal = existing.payments
    .filter((payment) => payment.status === 'SCHEDULED')
    .reduce((sum, payment) => sum + decimalToNumber(payment.amount), 0);

  const newScheduledTotal =
    (input.total_installments - input.paid_installments) *
    input.installment_amount;

  const oldDebtContribution = existing.already_in_card_balance
    ? 0
    : oldScheduledTotal;
  const newDebtContribution = input.already_in_card_balance
    ? 0
    : newScheduledTotal;
  const debtDelta = newDebtContribution - oldDebtContribution;

  if (
    debtDelta > 0 &&
    wallet.credit_limit != null &&
    decimalToNumber(wallet.amount) + debtDelta >
      decimalToNumber(wallet.credit_limit)
  ) {
    const error = new Error(
      'El saldo restante del plan supera el crédito disponible',
    );
    (error as { code?: string }).code = 'INSUFFICIENT_CREDIT';
    throw error;
  }

  const plan = await prisma.$transaction(async (tx) => {
    await tx.creditCardInstallmentPlanPayment.deleteMany({
      where: { plan_id: planId },
    });

    const updated = await tx.creditCardInstallmentPlan.update({
      where: { id: planId },
      data: {
        name: input.name.trim(),
        installment_amount: input.installment_amount,
        total_installments: input.total_installments,
        paid_installments: input.paid_installments,
        already_in_card_balance: input.already_in_card_balance,
        status:
          input.paid_installments >= input.total_installments
            ? 'COMPLETED'
            : 'ACTIVE',
        payments: {
          create: generated.map((payment) => {
            const previous = existingBySequence.get(payment.sequence);
            return {
              sequence: payment.sequence,
              due_date: payment.dueDate,
              amount: payment.amount,
              status: payment.status,
              ...(payment.status === 'PAID'
                ? {
                    paid_at: previous?.paid_at ?? new Date(),
                    ...(previous?.credit_card_payment_id != null
                      ? {
                          credit_card_payment_id:
                            previous.credit_card_payment_id,
                        }
                      : {}),
                  }
                : {}),
            };
          }),
        },
      },
      include: planInclude,
    });

    if (debtDelta !== 0) {
      await applyWalletAmountDelta(tx, walletId, debtDelta);
    }

    return updated;
  });

  return mapPlan(plan);
}

export async function deleteInstallmentPlan(
  planId: number,
  walletId: number,
  ownerFilter: OwnerFilter,
): Promise<void> {
  const existing = await prisma.creditCardInstallmentPlan.findFirst({
    where: {
      id: planId,
      credit_card_wallet_id: walletId,
      ...ownerFilter,
    },
    include: {
      payments: { where: { status: 'SCHEDULED' }, select: { amount: true } },
    },
  });

  if (!existing) {
    const error = new Error('Plan de cuotas no encontrado');
    (error as { code?: string }).code = 'NOT_FOUND';
    throw error;
  }

  const scheduledTotal = existing.payments.reduce(
    (sum, p) => sum + decimalToNumber(p.amount),
    0,
  );

  await prisma.$transaction(async (tx) => {
    await tx.creditCardInstallmentPlan.delete({ where: { id: planId } });

    if (!existing.already_in_card_balance && scheduledTotal > 0) {
      await applyWalletAmountDelta(tx, walletId, -scheduledTotal);
    }
  });
}

export async function markInstallmentPlanPaymentPaid(
  paymentId: number,
  creditCardPaymentId?: number,
): Promise<CreditCardInstallmentPlanPaymentItem | null> {
  const existing = await prisma.creditCardInstallmentPlanPayment.findUnique({
    where: { id: paymentId },
    include: { plan: { select: { id: true, total_installments: true } } },
  });

  if (!existing || existing.status === 'PAID') {
    return null;
  }

  const row = await prisma.$transaction(async (tx) => {
    const updated = await tx.creditCardInstallmentPlanPayment.update({
      where: { id: paymentId },
      data: {
        status: 'PAID',
        paid_at: new Date(),
        ...(creditCardPaymentId != null
          ? { credit_card_payment_id: creditCardPaymentId }
          : {}),
      },
    });

    const remaining = await tx.creditCardInstallmentPlanPayment.count({
      where: { plan_id: existing.plan_id, status: 'SCHEDULED' },
    });

    if (remaining === 0) {
      await tx.creditCardInstallmentPlan.update({
        where: { id: existing.plan_id },
        data: {
          status: 'COMPLETED',
          paid_installments: existing.plan.total_installments,
        },
      });
    } else {
      const paidCount = await tx.creditCardInstallmentPlanPayment.count({
        where: { plan_id: existing.plan_id, status: 'PAID' },
      });
      await tx.creditCardInstallmentPlan.update({
        where: { id: existing.plan_id },
        data: { paid_installments: paidCount },
      });
    }

    return updated;
  });

  return mapPayment(row);
}

/** Match a card payment to the nearest plan installment (±7 days or exact amount). */
export async function coverInstallmentPlanPaymentForCardPayment(
  walletId: number,
  ownerFilter: OwnerFilter,
  paidAtYmd: string,
  amount: number,
  creditCardPaymentId?: number,
): Promise<CreditCardInstallmentPlanPaymentItem | null> {
  const paidAt = new Date(paidAtYmd.slice(0, 10) + 'T12:00:00.000Z');
  const windowStart = new Date(paidAt);
  windowStart.setUTCDate(windowStart.getUTCDate() - 7);
  const windowEnd = new Date(paidAt);
  windowEnd.setUTCDate(windowEnd.getUTCDate() + 7);

  const candidates = await prisma.creditCardInstallmentPlanPayment.findMany({
    where: {
      status: 'SCHEDULED',
      due_date: { gte: windowStart, lte: windowEnd },
      plan: {
        credit_card_wallet_id: walletId,
        ...ownerFilter,
        status: 'ACTIVE',
      },
    },
    orderBy: [{ due_date: 'asc' }, { id: 'asc' }],
  });

  if (candidates.length === 0) {
    return null;
  }

  const exactAmount = candidates.find(
    (row) => decimalToNumber(row.amount) === amount,
  );
  const target = exactAmount ?? candidates[0];

  return markInstallmentPlanPaymentPaid(target.id, creditCardPaymentId);
}

export type PlannerInstallmentPlanPaymentItem = {
  id: number;
  planId: number;
  planName: string;
  walletId: number;
  walletName: string;
  dueDate: string;
  amount: number;
  sequence: number;
  status: 'SCHEDULED' | 'PAID';
};

/** Scheduled MSI plan rows with dueDate in the planner month (all cuotas, not only next). */
export async function listInstallmentPlanPaymentsForPlannerMonth(
  ownerFilter: OwnerFilter,
  year: number,
  month: number,
): Promise<PlannerInstallmentPlanPaymentItem[]> {
  const from = new Date(Date.UTC(year, month - 1, 1));
  const to = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

  const rows = await prisma.creditCardInstallmentPlanPayment.findMany({
    where: {
      status: 'SCHEDULED',
      due_date: { gte: from, lte: to },
      plan: {
        ...ownerFilter,
        status: 'ACTIVE',
        credit_card_wallet: {
          active: true,
          type: { in: creditCardWalletTypes },
        },
      },
    },
    include: {
      plan: {
        select: {
          id: true,
          name: true,
          credit_card_wallet: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: [{ due_date: 'asc' }, { sequence: 'asc' }],
  });

  return rows.map((row) => ({
    id: row.id,
    planId: row.plan.id,
    planName: row.plan.name,
    walletId: row.plan.credit_card_wallet.id,
    walletName: row.plan.credit_card_wallet.name,
    dueDate: formatCalendarDate(row.due_date),
    amount: decimalToNumber(row.amount),
    sequence: row.sequence,
    status: row.status,
  }));
}

export async function listActiveInstallmentPlansForOwner(
  ownerFilter: OwnerFilter,
): Promise<
  Array<{
    plan: CreditCardInstallmentPlanItem;
    walletName: string;
    walletId: number;
  }>
> {
  const rows = await prisma.creditCardInstallmentPlan.findMany({
    where: {
      ...ownerFilter,
      status: 'ACTIVE',
      credit_card_wallet: {
        active: true,
        type: { in: creditCardWalletTypes },
      },
    },
    include: {
      ...planInclude,
      credit_card_wallet: { select: { id: true, name: true } },
    },
    orderBy: [{ created_at: 'asc' }],
  });

  return rows.map((row) => ({
    plan: mapPlan(row),
    walletName: row.credit_card_wallet.name,
    walletId: row.credit_card_wallet.id,
  }));
}
