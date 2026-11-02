import type { Prisma } from '@/generated/prisma/client';
import prisma from '@/lib/prisma';
import { DomainError } from '@/lib/finance/domain-error';
import type { OwnerContextSuccess, OwnerFilter } from '@/lib/server/get-owner-context';
import type {
  CreateExpenseTemplateInput,
  UpdateExpenseTemplateInput,
} from '@/schemas/expense-template.schema';

/**
 * Expense template CRUD shared by /api/expense-templates and the MCP template
 * tools. Expansion into fortnights lives in `template.service.ts`.
 */

type TemplateOwner = Pick<OwnerContextSuccess, 'ownerType' | 'ownerId'>;

const TEMPLATE_INCLUDE = {
  category: { select: { name: true, icon: true } },
  wallet: { select: { id: true, name: true, provider_icon_key: true } },
} satisfies Prisma.ExpenseTemplateInclude;

const TEMPLATE_WITH_EXPENSES_INCLUDE = {
  ...TEMPLATE_INCLUDE,
  expenses: { select: { id: true, amount: true } },
} satisfies Prisma.ExpenseTemplateInclude;

const NOT_FOUND_MESSAGE = 'Plantilla de gasto no encontrada';

/** Legacy `due_day` mirrors the first configured fortnight day. */
const dueFieldsFromPayload = (validated: {
  dueDayFirst?: number | null | undefined;
  dueDaySecond?: number | null | undefined;
}) => {
  const first = validated.dueDayFirst ?? null;
  const second = validated.dueDaySecond ?? null;
  return {
    due_day_first_fortnight: first,
    due_day_second_fortnight: second,
    due_day: first ?? second ?? null,
  };
};

export function listExpenseTemplatesForOwner(ownerFilter: OwnerFilter) {
  return prisma.expenseTemplate.findMany({
    where: ownerFilter,
    include: TEMPLATE_WITH_EXPENSES_INCLUDE,
    orderBy: [{ active: 'desc' }, { name: 'asc' }],
  });
}

export async function findExpenseTemplateForOwner(id: number, ownerFilter: OwnerFilter) {
  const template = await prisma.expenseTemplate.findFirst({
    where: { id, ...ownerFilter },
  });
  if (!template) throw new DomainError('P2025', NOT_FOUND_MESSAGE);
  return template;
}

export function createExpenseTemplateForOwner(
  owner: TemplateOwner,
  validated: CreateExpenseTemplateInput,
) {
  return prisma.expenseTemplate.create({
    data: {
      name: validated.name,
      category_id: validated.categoryId,
      suggested_amount: validated.suggestedAmount
        ? validated.suggestedAmount.toString()
        : null,
      wallet_id: validated.paymentMethodId ?? undefined,
      active: validated.active ?? true,
      ...dueFieldsFromPayload(validated),
      cutoff_day: validated.cutoffDay ?? null,
      is_recurring: validated.isRecurring,
      applies_first_fortnight: validated.appliesFirstFortnight,
      applies_second_fortnight: validated.appliesSecondFortnight,
      is_subscription: validated.isSubscription,
      user_id: owner.ownerType === 'user' ? owner.ownerId : null,
      house_id: owner.ownerType === 'house' ? owner.ownerId : null,
    },
    include: TEMPLATE_INCLUDE,
  });
}

/**
 * Applies a full template payload (the update schema is the create schema):
 * due days and cutoff are always rewritten, optional flags only when sent.
 */
export async function updateExpenseTemplateForOwner(
  id: number,
  ownerFilter: OwnerFilter,
  validated: UpdateExpenseTemplateInput,
) {
  await findExpenseTemplateForOwner(id, ownerFilter);

  const updateData: Prisma.ExpenseTemplateUncheckedUpdateInput = {
    ...dueFieldsFromPayload(validated),
    cutoff_day: validated.cutoffDay ?? null,
  };
  if (validated.name !== undefined) updateData.name = validated.name;
  if (validated.categoryId !== undefined) updateData.category_id = validated.categoryId;
  if (validated.suggestedAmount !== undefined) {
    updateData.suggested_amount = validated.suggestedAmount.toString();
  }
  if (validated.active !== undefined) updateData.active = validated.active;
  if (validated.paymentMethodId !== undefined) {
    updateData.wallet_id = validated.paymentMethodId ?? null;
  }
  if (validated.isRecurring !== undefined) updateData.is_recurring = validated.isRecurring;
  if (validated.appliesFirstFortnight !== undefined) {
    updateData.applies_first_fortnight = validated.appliesFirstFortnight;
  }
  if (validated.appliesSecondFortnight !== undefined) {
    updateData.applies_second_fortnight = validated.appliesSecondFortnight;
  }
  if (validated.isSubscription !== undefined) {
    updateData.is_subscription = validated.isSubscription;
  }

  return prisma.expenseTemplate.update({
    where: { id },
    data: updateData,
    include: TEMPLATE_WITH_EXPENSES_INCLUDE,
  });
}

/** Deletes the template and detaches the expenses it generated. */
export async function deleteExpenseTemplateForOwner(
  id: number,
  ownerFilter: OwnerFilter,
): Promise<{ detachedExpenseCount: number }> {
  await findExpenseTemplateForOwner(id, ownerFilter);

  const detachedExpenseCount = await prisma.$transaction(async (tx) => {
    const detached = await tx.expense.updateMany({
      where: { expense_template_id: id },
      data: { expense_template_id: null },
    });
    await tx.expenseTemplate.delete({ where: { id } });
    return detached.count;
  });

  return { detachedExpenseCount };
}
