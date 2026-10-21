import type { Prisma } from '@/generated/prisma/client';
import prisma from '@/lib/prisma';
import { DomainError } from '@/lib/finance/domain-error';
import { assertOwnedCategoryOfKind } from '@/lib/finance/category.service';
import { assertIncomeFundingWallet } from '@/lib/finance/income.service';
import type { OwnerContextSuccess, OwnerFilter } from '@/lib/server/get-owner-context';
import type {
  CreateIncomeTemplateInput,
  UpdateIncomeTemplateInput,
} from '@/schemas/income-template.schema';

/**
 * Income template CRUD shared by /api/income-templates and the MCP template
 * tools. Expansion into fortnights lives in `template.service.ts`.
 */

type TemplateOwner = Pick<OwnerContextSuccess, 'ownerType' | 'ownerId' | 'ownerFilter'>;

const TEMPLATE_INCLUDE = {
  user: { select: { id: true, name: true } },
  category: { select: { id: true, name: true, icon: true } },
} satisfies Prisma.IncomeTemplateInclude;

const NOT_FOUND_MESSAGE = 'Plantilla de ingresos no encontrada';

const assertFundingWalletOfOwner = async (walletId: number, ownerFilter: OwnerFilter) => {
  const wallet = await prisma.wallet.findFirst({
    where: { id: walletId, ...ownerFilter },
    select: { id: true, type: true },
  });
  assertIncomeFundingWallet(wallet);
};

const findTemplate = async (id: number, ownerFilter: OwnerFilter) => {
  const template = await prisma.incomeTemplate.findFirst({
    where: { id, ...ownerFilter },
  });
  if (!template) throw new DomainError('P2025', NOT_FOUND_MESSAGE);
  return template;
};

export function listIncomeTemplatesForOwner(ownerFilter: OwnerFilter) {
  return prisma.incomeTemplate.findMany({
    where: ownerFilter,
    include: TEMPLATE_INCLUDE,
    orderBy: { name: 'asc' },
  });
}

export async function createIncomeTemplateForOwner(
  owner: TemplateOwner,
  validated: CreateIncomeTemplateInput,
) {
  await assertOwnedCategoryOfKind(
    prisma,
    owner.ownerType,
    owner.ownerId,
    validated.categoryId,
    'INCOME',
  );
  if (validated.walletId != null) {
    await assertFundingWalletOfOwner(validated.walletId, owner.ownerFilter);
  }

  return prisma.incomeTemplate.create({
    data: {
      name: validated.name,
      suggested_amount: validated.suggestedAmount
        ? validated.suggestedAmount.toString()
        : null,
      source: validated.source ?? null,
      category_id: validated.categoryId,
      wallet_id: validated.walletId ?? null,
      applies_first_fortnight: validated.appliesFirstFortnight,
      applies_second_fortnight: validated.appliesSecondFortnight,
      active: validated.active ?? true,
      // Single-owner rule: exactly one of user_id / house_id.
      user_id: owner.ownerType === 'user' ? owner.ownerId : null,
      house_id: owner.ownerType === 'house' ? owner.ownerId : null,
    },
    include: TEMPLATE_INCLUDE,
  });
}

/** Partial update: only the fields present in `validated` change. */
export async function updateIncomeTemplateForOwner(
  id: number,
  owner: TemplateOwner,
  validated: UpdateIncomeTemplateInput,
) {
  const existing = await findTemplate(id, owner.ownerFilter);

  if (validated.categoryId !== undefined) {
    await assertOwnedCategoryOfKind(
      prisma,
      owner.ownerType,
      owner.ownerId,
      validated.categoryId,
      'INCOME',
    );
  } else if (existing.category_id == null) {
    throw new DomainError(
      'CATEGORY_REQUIRED',
      'La categoría es requerida. Asigna una categoría de ingreso a esta plantilla.',
    );
  }

  const updateData: Prisma.IncomeTemplateUncheckedUpdateInput = {};
  if (validated.name !== undefined) updateData.name = validated.name;
  if (validated.suggestedAmount !== undefined) {
    updateData.suggested_amount =
      validated.suggestedAmount === null ? null : validated.suggestedAmount.toString();
  }
  if (validated.source !== undefined) updateData.source = validated.source;
  if (validated.categoryId !== undefined) updateData.category_id = validated.categoryId;
  if (validated.walletId !== undefined) {
    if (validated.walletId != null) {
      await assertFundingWalletOfOwner(validated.walletId, owner.ownerFilter);
    }
    updateData.wallet_id = validated.walletId;
  }
  if (validated.appliesFirstFortnight !== undefined) {
    updateData.applies_first_fortnight = validated.appliesFirstFortnight;
  }
  if (validated.appliesSecondFortnight !== undefined) {
    updateData.applies_second_fortnight = validated.appliesSecondFortnight;
  }
  if (validated.active !== undefined) updateData.active = validated.active;
  // House templates keep house_id and a null user_id. Writing a member id
  // here violates income_template_single_owner_check. Ownership stays as created.

  return prisma.incomeTemplate.update({
    where: { id },
    data: updateData,
    include: TEMPLATE_INCLUDE,
  });
}

/** Deletes a template that no income references yet. */
export async function deleteIncomeTemplateForOwner(
  id: number,
  ownerFilter: OwnerFilter,
): Promise<void> {
  await findTemplate(id, ownerFilter);

  const relatedIncome = await prisma.income.findFirst({
    where: { income_template_id: id },
  });
  if (relatedIncome) {
    throw new DomainError(
      'TEMPLATE_IN_USE',
      'La plantilla de ingresos está en uso y no puede eliminarse',
      409,
    );
  }

  await prisma.incomeTemplate.delete({ where: { id } });
}
