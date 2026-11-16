import { PaymentMethodType } from '@/generated/prisma/client';
import prisma from '@/lib/prisma';
import {
  firstNameOf,
  isAccountWithinFirstStepsWindow,
  type FirstStepsFacts,
} from '@/components/monthly/first-steps';

const CARD_TYPES = [
  PaymentMethodType.CREDIT_CARD,
  PaymentMethodType.DEPARTMENT_STORE_CARD,
];

/**
 * Facts for Primeros pasos, read with existing models only (no endpoint, no
 * schema change). Returns null for accounts past the 30-day window without
 * running the item queries. Items cover the user's own rows and every house
 * they belong to, so the card reads the same in either owner context.
 */
export const loadFirstStepsFacts = async (
  userId: number,
  now: Date = new Date(),
): Promise<FirstStepsFacts | null> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      name: true,
      created_at: true,
      onboarding_completed: true,
      memberships: { select: { house_id: true } },
    },
  });
  if (!user || !user.onboarding_completed) return null;
  if (!isAccountWithinFirstStepsWindow(user.created_at, now)) return null;

  const houseIds = user.memberships.map((m) => m.house_id);
  const ownedBy = houseIds.length
    ? { OR: [{ user_id: userId }, { house_id: { in: houseIds } }] }
    : { user_id: userId };

  const [paidExpense, template, card, guests] = await Promise.all([
    prisma.expense.findFirst({ where: { ...ownedBy, is_paid: true }, select: { id: true } }),
    prisma.expenseTemplate.findFirst({ where: ownedBy, select: { id: true } }),
    prisma.wallet.findFirst({
      where: { ...ownedBy, active: true, type: { in: CARD_TYPES } },
      select: { id: true },
    }),
    houseIds.length
      ? prisma.houseMember.count({
          where: { house_id: { in: houseIds }, user_id: { not: userId } },
        })
      : Promise.resolve(0),
  ]);

  return {
    userId,
    firstName: firstNameOf(user.name),
    onboardingCompleted: user.onboarding_completed,
    accountCreatedAt: user.created_at,
    hasPaidExpense: paidExpense !== null,
    hasExpenseTemplates: template !== null,
    hasCreditCard: card !== null,
    hasHouseGuest: guests > 0,
  };
};
