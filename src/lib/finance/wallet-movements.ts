import {
  endOfCalendarDay,
  formatCalendarDate,
  startOfCalendarDay,
} from '@/lib/calendar-dates';
import { formatCardPaymentDescription } from '@/lib/finance/planning-credit-card-payments';
import prisma from '@/lib/prisma';
import type { OwnerFilter } from '@/lib/server/get-owner-context';
import type { WalletMovement } from '@/types/wallet-movements';

function toNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
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

function toISODate(value: Date | string | null | undefined): string {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  return formatCalendarDate(d);
}

type DateRange = { fromDate: Date; toDate: Date };

function buildRange(from: string, to: string): DateRange {
  return { fromDate: startOfCalendarDay(from), toDate: endOfCalendarDay(to) };
}

type CardPaymentMovementSource = {
  id: number;
  amount: unknown;
  paid_at: Date;
  note: string | null;
  expense_id: number | null;
  source_wallet_id: number | null;
  credit_card_wallet_id: number;
  credit_card_wallet: { name: string };
  source_wallet: { name: string } | null;
};

export const linkedSourceWalletCardPaymentExpenseIds = (
  payments: ReadonlyArray<CardPaymentMovementSource>,
  walletId: number,
): Set<number> => {
  const ids = new Set<number>();
  for (const payment of payments) {
    if (
      payment.source_wallet_id === walletId &&
      payment.expense_id != null
    ) {
      ids.add(payment.expense_id);
    }
  }
  return ids;
};

export const mapCardPaymentToWalletMovement = (
  payment: CardPaymentMovementSource,
  walletId: number,
): WalletMovement | null => {
  const amount = toNumber(payment.amount);
  const date = toISODate(payment.paid_at);

  if (payment.source_wallet_id === walletId) {
    return {
      id: payment.id,
      kind: 'card_payment',
      date,
      description: formatCardPaymentDescription(
        payment.credit_card_wallet.name,
        payment.note,
      ),
      amount,
      direction: 'out',
      category: 'Pago a tarjeta',
      categoryIcon: 'CREDIT_CARD',
      fortnightYear: null,
      fortnightMonth: null,
      fortnightPeriod: null,
    };
  }

  if (payment.credit_card_wallet_id === walletId) {
    const sourceLabel = payment.source_wallet?.name ?? 'Pago externo';
    return {
      id: payment.id,
      kind: 'card_payment',
      date,
      description: payment.note?.trim()
        ? `Abono desde ${sourceLabel}: ${payment.note.trim()}`
        : `Abono desde ${sourceLabel}`,
      amount,
      direction: 'in',
      category: 'Pago a tarjeta',
      categoryIcon: 'CREDIT_CARD',
      fortnightYear: null,
      fortnightMonth: null,
      fortnightPeriod: null,
    };
  }

  return null;
};

type WalletTransferMovementSource = {
  id: number;
  amount: unknown;
  fee_amount: unknown;
  transferred_at: Date;
  note: string | null;
  from_wallet_id: number;
  to_wallet_id: number;
  from_wallet: { name: string };
  to_wallet: { name: string };
};

const emptyFortnightFields = {
  fortnightYear: null,
  fortnightMonth: null,
  fortnightPeriod: null,
} as const;

export const mapWalletTransferToMovements = (
  transfer: WalletTransferMovementSource,
  walletId: number,
): WalletMovement[] => {
  const amount = toNumber(transfer.amount);
  const feeAmount = toNumber(transfer.fee_amount);
  const date = toISODate(transfer.transferred_at);
  const noteSuffix = transfer.note?.trim()
    ? `: ${transfer.note.trim()}`
    : '';
  const items: WalletMovement[] = [];

  if (transfer.from_wallet_id === walletId) {
    items.push({
      id: transfer.id,
      kind: 'wallet_transfer',
      date,
      description: `Transferencia a ${transfer.to_wallet.name}${noteSuffix}`,
      amount,
      direction: 'out',
      category: 'Transferencia',
      categoryIcon: null,
      ...emptyFortnightFields,
    });
    if (feeAmount > 0) {
      items.push({
        id: transfer.id,
        kind: 'wallet_transfer_fee',
        date,
        description: `Comisión de transferencia${noteSuffix}`,
        amount: feeAmount,
        direction: 'out',
        category: 'Comisión',
        categoryIcon: null,
        ...emptyFortnightFields,
      });
    }
  }

  if (transfer.to_wallet_id === walletId) {
    items.push({
      id: transfer.id,
      kind: 'wallet_transfer',
      date,
      description: `Transferencia desde ${transfer.from_wallet.name}${noteSuffix}`,
      amount,
      direction: 'in',
      category: 'Transferencia',
      categoryIcon: null,
      ...emptyFortnightFields,
    });
  }

  return items;
};

export async function listWalletMovements(
  walletId: number,
  ownerFilter: OwnerFilter,
  from: string,
  to: string,
): Promise<WalletMovement[]> {
  const { fromDate, toDate } = buildRange(from, to);

  const [expenses, incomes, cardPayments, walletTransfers] = await Promise.all([
    prisma.expense.findMany({
      where: {
        ...ownerFilter,
        wallet_id: walletId,
        OR: [
          { payment_date: { gte: fromDate, lte: toDate } },
          {
            AND: [
              { payment_date: null },
              { created_at: { gte: fromDate, lte: toDate } },
            ],
          },
        ],
      },
      include: {
        category: { select: { name: true, icon: true } },
        fortnight: { select: { year: true, month: true, period: true } },
      },
    }),
    prisma.income.findMany({
      where: {
        ...ownerFilter,
        wallet_id: walletId,
        received_at: { gte: fromDate, lte: toDate },
      },
      include: {
        fortnight: { select: { year: true, month: true, period: true } },
      },
    }),
    prisma.creditCardPayment.findMany({
      where: {
        ...ownerFilter,
        OR: [
          { source_wallet_id: walletId },
          { credit_card_wallet_id: walletId },
        ],
        paid_at: { gte: fromDate, lte: toDate },
      },
      include: {
        credit_card_wallet: { select: { name: true } },
        source_wallet: { select: { name: true } },
      },
    }),
    prisma.walletTransfer.findMany({
      where: {
        ...ownerFilter,
        OR: [{ from_wallet_id: walletId }, { to_wallet_id: walletId }],
        transferred_at: { gte: fromDate, lte: toDate },
      },
      include: {
        from_wallet: { select: { name: true } },
        to_wallet: { select: { name: true } },
      },
    }),
  ]);

  const skipLinkedExpenseIds = linkedSourceWalletCardPaymentExpenseIds(
    cardPayments,
    walletId,
  );

  const items: WalletMovement[] = [];

  for (const e of expenses) {
    if (skipLinkedExpenseIds.has(e.id)) {
      continue;
    }
    items.push({
      id: e.id,
      kind: 'expense',
      date: toISODate(e.payment_date ?? e.created_at),
      description: e.description,
      amount: toNumber(e.amount),
      direction: 'out',
      category: e.category?.name ?? null,
      categoryIcon: e.category?.icon ?? null,
      fortnightYear: e.fortnight?.year ?? null,
      fortnightMonth: e.fortnight?.month ?? null,
      fortnightPeriod: (e.fortnight?.period as 'FIRST' | 'SECOND') ?? null,
    });
  }

  for (const i of incomes) {
    items.push({
      id: i.id,
      kind: 'income',
      date: toISODate(i.received_at),
      description: i.source ?? 'Ingreso',
      amount: toNumber(i.amount),
      direction: 'in',
      category: null,
      categoryIcon: null,
      fortnightYear: i.fortnight?.year ?? null,
      fortnightMonth: i.fortnight?.month ?? null,
      fortnightPeriod: (i.fortnight?.period as 'FIRST' | 'SECOND') ?? null,
    });
  }

  for (const payment of cardPayments) {
    const movement = mapCardPaymentToWalletMovement(payment, walletId);
    if (movement != null) {
      items.push(movement);
    }
  }

  for (const transfer of walletTransfers) {
    items.push(...mapWalletTransferToMovements(transfer, walletId));
  }

  items.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    if (a.id !== b.id) return b.id - a.id;
    return a.kind.localeCompare(b.kind);
  });

  return items;
}

export function computeMovementTotals(movements: WalletMovement[]): {
  inflow: number;
  outflow: number;
  net: number;
} {
  let inflow = 0;
  let outflow = 0;
  for (const m of movements) {
    if (m.direction === 'in') inflow += m.amount;
    else outflow += m.amount;
  }
  return { inflow, outflow, net: inflow - outflow };
}
