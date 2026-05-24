import prisma from '@/lib/prisma';
import type { OwnerFilter } from '@/lib/server/get-owner-context';
import { isCreditWalletType } from '@/lib/finance/wallet-accounting';
import type { DuePaymentItem } from '@/types/catalog';

export { getEffectiveCardPaymentAmount } from '@/lib/finance/credit-card-payment-plan.utils';

export async function attachPlannedPaymentsToDueItems(
  items: DuePaymentItem[],
  fortnightId: number | null | undefined,
  ownerFilter: OwnerFilter,
): Promise<void> {
  if (items.length === 0 || fortnightId == null) {
    for (const item of items) {
      item.plannedPayment = null;
    }
    return;
  }

  const walletIds = items.map((item) => item.walletId);
  const plans = await prisma.creditCardPaymentPlan.findMany({
    where: {
      fortnight_id: fortnightId,
      credit_card_wallet_id: { in: walletIds },
      ...ownerFilter,
    },
    select: {
      credit_card_wallet_id: true,
      planned_amount: true,
    },
  });

  const planByWallet = new Map(
    plans.map((plan) => [plan.credit_card_wallet_id, Number(plan.planned_amount)]),
  );

  for (const item of items) {
    item.plannedPayment = planByWallet.get(item.walletId) ?? null;
  }
}

export async function resolveFortnightIdForDate(
  ownerFilter: OwnerFilter,
  asOf: Date,
): Promise<number | null> {
  const year = asOf.getFullYear();
  const month = asOf.getMonth() + 1;
  const period = asOf.getDate() <= 15 ? 'FIRST' : 'SECOND';

  const fortnight = await prisma.fortnight.findFirst({
    where: {
      ...ownerFilter,
      year,
      month,
      period,
    },
    select: { id: true },
  });

  return fortnight?.id ?? null;
}

export async function upsertCreditCardPaymentPlan(
  ownerFilter: OwnerFilter,
  fortnightId: number,
  walletId: number,
  plannedAmount: number,
) {
  const [fortnight, wallet] = await Promise.all([
    prisma.fortnight.findFirst({
      where: { id: fortnightId, ...ownerFilter },
      select: { id: true },
    }),
    prisma.wallet.findFirst({
      where: { id: walletId, ...ownerFilter, active: true },
      select: { id: true, type: true, amount: true },
    }),
  ]);

  if (!fortnight) {
    const error = new Error('Quincena no encontrada');
    (error as { code?: string }).code = 'FORTNIGHT_NOT_FOUND';
    throw error;
  }

  if (!wallet || !isCreditWalletType(wallet.type)) {
    const error = new Error('Tarjeta no encontrada');
    (error as { code?: string }).code = 'WALLET_NOT_FOUND';
    throw error;
  }

  const outstandingBalance = Number(wallet.amount);
  if (plannedAmount > outstandingBalance) {
    const error = new Error(
      'El monto planeado no puede superar la deuda actual de la tarjeta',
    );
    (error as { code?: string }).code = 'AMOUNT_EXCEEDS_BALANCE';
    throw error;
  }

  const isUserContext = ownerFilter.user_id !== null;

  return prisma.creditCardPaymentPlan.upsert({
    where: {
      credit_card_wallet_id_fortnight_id: {
        credit_card_wallet_id: walletId,
        fortnight_id: fortnightId,
      },
    },
    create: {
      credit_card_wallet_id: walletId,
      fortnight_id: fortnightId,
      planned_amount: plannedAmount,
      user_id: isUserContext ? ownerFilter.user_id : null,
      house_id: !isUserContext ? ownerFilter.house_id : null,
    },
    update: {
      planned_amount: plannedAmount,
    },
    select: {
      credit_card_wallet_id: true,
      fortnight_id: true,
      planned_amount: true,
    },
  });
}

export async function clearCreditCardPaymentPlan(
  ownerFilter: OwnerFilter,
  fortnightId: number,
  walletId: number,
) {
  const fortnight = await prisma.fortnight.findFirst({
    where: { id: fortnightId, ...ownerFilter },
    select: { id: true },
  });

  if (!fortnight) {
    const error = new Error('Quincena no encontrada');
    (error as { code?: string }).code = 'FORTNIGHT_NOT_FOUND';
    throw error;
  }

  await prisma.creditCardPaymentPlan.deleteMany({
    where: {
      fortnight_id: fortnightId,
      credit_card_wallet_id: walletId,
      ...ownerFilter,
    },
  });
}
