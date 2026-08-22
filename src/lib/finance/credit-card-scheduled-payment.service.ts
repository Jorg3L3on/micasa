import prisma from '@/lib/prisma';
import { PaymentMethodType } from '@/generated/prisma/client';
import {
  formatCalendarDate,
  parseCalendarDate,
  todayCalendarDate,
} from '@/lib/calendar-dates';
import type { OwnerFilter } from '@/lib/server/get-owner-context';
import type {
  CreateCreditCardScheduledPaymentInput,
  UpdateCreditCardScheduledPaymentInput,
} from '@/schemas/credit-card-scheduled-payment.schema';
import { ensureCreditWalletType } from '@/lib/finance/wallet-accounting';

export type CreditCardScheduledPaymentItem = {
  id: number;
  creditCardWalletId: number;
  dueDate: string;
  amount: number;
  label: string | null;
  status: 'SCHEDULED' | 'PAID';
  paidAt: string | null;
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

const mapRow = (row: {
  id: number;
  credit_card_wallet_id: number;
  due_date: Date;
  amount: unknown;
  label: string | null;
  status: 'SCHEDULED' | 'PAID';
  paid_at: Date | null;
}): CreditCardScheduledPaymentItem => ({
  id: row.id,
  creditCardWalletId: row.credit_card_wallet_id,
  dueDate: formatCalendarDate(row.due_date),
  amount: decimalToNumber(row.amount),
  label: row.label,
  status: row.status,
  paidAt: row.paid_at ? formatCalendarDate(row.paid_at) : null,
});

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

export async function listScheduledPaymentsForCard(
  walletId: number,
  ownerFilter: OwnerFilter,
): Promise<CreditCardScheduledPaymentItem[]> {
  await assertCreditCardWallet(walletId, ownerFilter);

  const rows = await prisma.creditCardScheduledPayment.findMany({
    where: {
      credit_card_wallet_id: walletId,
      ...ownerFilter,
    },
    orderBy: [{ due_date: 'asc' }, { id: 'asc' }],
  });

  return rows.map(mapRow);
}

export async function getNextUncoveredScheduledPayment(
  walletId: number,
  ownerFilter: OwnerFilter,
  asOfYmd: string = todayCalendarDate(),
): Promise<CreditCardScheduledPaymentItem | null> {
  const asOf = parseCalendarDate(asOfYmd);
  const row = await prisma.creditCardScheduledPayment.findFirst({
    where: {
      credit_card_wallet_id: walletId,
      ...ownerFilter,
      status: 'SCHEDULED',
      due_date: { gte: asOf },
    },
    orderBy: [{ due_date: 'asc' }, { id: 'asc' }],
  });

  return row ? mapRow(row) : null;
}

export async function createScheduledPayment(
  walletId: number,
  ownerFilter: OwnerFilter,
  input: CreateCreditCardScheduledPaymentInput,
): Promise<CreditCardScheduledPaymentItem> {
  const wallet = await assertCreditCardWallet(walletId, ownerFilter);

  const row = await prisma.creditCardScheduledPayment.create({
    data: {
      credit_card_wallet_id: walletId,
      due_date: parseCalendarDate(input.due_date),
      amount: input.amount,
      label: input.label ?? null,
      user_id: wallet.user_id,
      house_id: wallet.house_id,
    },
  });

  return mapRow(row);
}

export async function updateScheduledPayment(
  paymentId: number,
  walletId: number,
  ownerFilter: OwnerFilter,
  input: UpdateCreditCardScheduledPaymentInput,
): Promise<CreditCardScheduledPaymentItem> {
  const existing = await prisma.creditCardScheduledPayment.findFirst({
    where: {
      id: paymentId,
      credit_card_wallet_id: walletId,
      ...ownerFilter,
    },
  });

  if (!existing) {
    const error = new Error('Cuota programada no encontrada');
    (error as { code?: string }).code = 'NOT_FOUND';
    throw error;
  }

  if (existing.status === 'PAID') {
    const error = new Error('No se puede editar una cuota ya cubierta');
    (error as { code?: string }).code = 'ALREADY_PAID';
    throw error;
  }

  const row = await prisma.creditCardScheduledPayment.update({
    where: { id: paymentId },
    data: {
      ...(input.due_date != null
        ? { due_date: parseCalendarDate(input.due_date) }
        : {}),
      ...(input.amount != null ? { amount: input.amount } : {}),
      ...(input.label !== undefined ? { label: input.label } : {}),
    },
  });

  return mapRow(row);
}

export async function deleteScheduledPayment(
  paymentId: number,
  walletId: number,
  ownerFilter: OwnerFilter,
): Promise<void> {
  const existing = await prisma.creditCardScheduledPayment.findFirst({
    where: {
      id: paymentId,
      credit_card_wallet_id: walletId,
      ...ownerFilter,
    },
  });

  if (!existing) {
    const error = new Error('Cuota programada no encontrada');
    (error as { code?: string }).code = 'NOT_FOUND';
    throw error;
  }

  if (existing.status === 'PAID') {
    const error = new Error('No se puede eliminar una cuota ya cubierta');
    (error as { code?: string }).code = 'ALREADY_PAID';
    throw error;
  }

  await prisma.creditCardScheduledPayment.delete({ where: { id: paymentId } });
}

export async function markScheduledPaymentPaid(
  scheduledPaymentId: number,
  creditCardPaymentId?: number,
): Promise<CreditCardScheduledPaymentItem | null> {
  const existing = await prisma.creditCardScheduledPayment.findUnique({
    where: { id: scheduledPaymentId },
  });

  if (!existing || existing.status === 'PAID') {
    return null;
  }

  const row = await prisma.creditCardScheduledPayment.update({
    where: { id: scheduledPaymentId },
    data: {
      status: 'PAID',
      paid_at: new Date(),
      ...(creditCardPaymentId != null
        ? { credit_card_payment_id: creditCardPaymentId }
        : {}),
    },
  });

  return mapRow(row);
}

/** Match a card payment to the nearest scheduled row (±7 days or exact amount). */
export async function coverScheduledPaymentForCardPayment(
  walletId: number,
  ownerFilter: OwnerFilter,
  paidAtYmd: string,
  amount: number,
  creditCardPaymentId?: number,
): Promise<CreditCardScheduledPaymentItem | null> {
  const paidAt = parseCalendarDate(paidAtYmd);
  const windowStart = new Date(paidAt);
  windowStart.setUTCDate(windowStart.getUTCDate() - 7);
  const windowEnd = new Date(paidAt);
  windowEnd.setUTCDate(windowEnd.getUTCDate() + 7);

  const candidates = await prisma.creditCardScheduledPayment.findMany({
    where: {
      credit_card_wallet_id: walletId,
      ...ownerFilter,
      status: 'SCHEDULED',
      due_date: { gte: windowStart, lte: windowEnd },
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

  return markScheduledPaymentPaid(target.id, creditCardPaymentId);
}

export type PlannerScheduledCardPaymentItem = CreditCardScheduledPaymentItem & {
  walletName: string;
  walletType: string;
};

export async function listScheduledPaymentsForPlannerMonth(
  ownerFilter: OwnerFilter,
  year: number,
  month: number,
): Promise<{
  first: PlannerScheduledCardPaymentItem[];
  second: PlannerScheduledCardPaymentItem[];
}> {
  const from = new Date(Date.UTC(year, month - 1, 1));
  const to = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

  const rows = await prisma.creditCardScheduledPayment.findMany({
    where: {
      ...ownerFilter,
      status: 'SCHEDULED',
      due_date: { gte: from, lte: to },
      credit_card_wallet: {
        active: true,
        type: { in: creditCardWalletTypes },
      },
    },
    include: {
      credit_card_wallet: {
        select: { name: true, type: true, cutoff_day: true, due_day: true },
      },
    },
    orderBy: [{ due_date: 'asc' }, { id: 'asc' }],
  });

  const mapped: PlannerScheduledCardPaymentItem[] = rows.map((row) => ({
    ...mapRow(row),
    walletName: row.credit_card_wallet.name,
    walletType: row.credit_card_wallet.type,
  }));

  return {
    first: mapped.filter((item) => {
      const day = Number(item.dueDate.slice(8, 10));
      return day <= 15;
    }),
    second: mapped.filter((item) => {
      const day = Number(item.dueDate.slice(8, 10));
      return day >= 16;
    }),
  };
}
