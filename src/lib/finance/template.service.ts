import prisma from '@/lib/prisma';
import type { Prisma } from '@/generated/prisma/client';
import { TransferType } from '@/generated/prisma/client';
import { createUserToHouseTransferInTx } from '@/lib/finance/transfer.service';

const DEFAULT_EXPENSE_AMOUNT = 0.01;
const INCOME_TEMPLATE_DEFAULT_AMOUNT = 0.01;

export async function expandIncomeTemplatesForFortnight(
  fortnightId: number,
  period: 'FIRST' | 'SECOND',
) {
  return prisma.$transaction(async (tx) => {
    const fortnight = await tx.fortnight.findUnique({
      where: { id: fortnightId },
      select: {
        start_date: true,
        end_date: true,
        year: true,
        month: true,
        period: true,
        user_id: true,
        house_id: true,
        label: true,
      },
    });
    if (!fortnight) return { count: 0, names: [] as string[] };

    const templates = await tx.incomeTemplate.findMany({
      where:
        period === 'FIRST'
          ? { active: true, applies_first_fortnight: true }
          : { active: true, applies_second_fortnight: true },
      select: {
        id: true,
        name: true,
        suggested_amount: true,
        source: true,
        user_id: true,
        house_id: true,
      },
    });

    const defaultUser = await tx.user.findFirst({
      where: { active: true },
      select: { id: true },
    });

    const created: string[] = [];

    for (const template of templates) {
      const amount =
        template.suggested_amount != null &&
        Number(template.suggested_amount) > 0
          ? Number(template.suggested_amount)
          : INCOME_TEMPLATE_DEFAULT_AMOUNT;

      const userId = template.user_id ?? defaultUser?.id;
      if (userId == null) continue;

      if (template.house_id == null) {
        const existingIncome = await tx.income.findFirst({
          where: {
            fortnight_id: fortnightId,
            income_template_id: template.id,
          },
        });

        if (existingIncome) continue;

        await tx.income.create({
          data: {
            fortnight_id: fortnightId,
            user_id: userId,
            amount: String(amount),
            source: template.source ?? undefined,
            received_at: fortnight.start_date,
            income_template_id: template.id,
          },
        });
      } else {
        const houseId = template.house_id;

        const existingTransfer = await tx.transfer.findFirst({
          where: {
            type: TransferType.USER_TO_HOUSE,
            user_id: userId,
            house_id: houseId,
            amount: String(amount),
            created_at: {
              gte: fortnight.start_date,
              lte: fortnight.end_date,
            },
          },
        });

        if (existingTransfer) continue;

        let houseFortnight = await tx.fortnight.findFirst({
          where: {
            year: fortnight.year,
            month: fortnight.month,
            period: fortnight.period,
            house_id: houseId,
          },
        });

        if (!houseFortnight) {
          houseFortnight = await tx.fortnight.create({
            data: {
              label: fortnight.label,
              start_date: fortnight.start_date,
              end_date: fortnight.end_date,
              month: fortnight.month,
              year: fortnight.year,
              period: fortnight.period,
              closed: false,
              house_id: houseId,
            },
          });
        }

        await createUserToHouseTransferInTx(tx, {
          userId,
          houseId,
          amount,
          userWalletId: null,
          houseWalletId: null,
          userFortnightId: fortnightId,
          houseFortnightId: houseFortnight.id,
          note: template.name,
          date: fortnight.start_date,
        });
      }

      created.push(template.name);
    }

    return { count: created.length, names: created };
  });
}

export async function expandExpenseTemplatesForFortnight(
  fortnightId: number,
  period: 'FIRST' | 'SECOND',
) {
  return prisma.$transaction(async (tx) => {
    const fortnight = await tx.fortnight.findUnique({
      where: { id: fortnightId },
      select: { user_id: true, house_id: true },
    });
    if (!fortnight) return { count: 0, names: [] as string[] };

    const appliesField =
      period === 'FIRST'
        ? 'applies_first_fortnight'
        : 'applies_second_fortnight';

    const templates = await tx.expenseTemplate.findMany({
      where: {
        active: true,
        [appliesField]: true,
        category_id: { not: null },
      },
      select: {
        id: true,
        name: true,
        suggested_amount: true,
        category_id: true,
        wallet_id: true,
        due_day: true,
      },
    });

    const created: string[] = [];

    for (const template of templates) {
      const categoryId = template.category_id;
      if (categoryId === null) continue;

      const existing = await tx.expense.findFirst({
        where: {
          fortnight_id: fortnightId,
          expense_template_id: template.id,
        },
      });

      if (existing) continue;

      const amount =
        template.suggested_amount != null &&
        Number(template.suggested_amount) > 0
          ? Number(template.suggested_amount)
          : DEFAULT_EXPENSE_AMOUNT;

      if (template.wallet_id != null) {
        const wallet = await tx.wallet.findUnique({
          where: { id: template.wallet_id },
          select: { id: true, user_id: true, house_id: true },
        });

        if (!wallet) {
          continue;
        }

        const walletOwnerUserId = wallet.user_id;
        const walletOwnerHouseId = wallet.house_id;

        if (fortnight.user_id != null) {
          if (
            walletOwnerUserId !== fortnight.user_id ||
            walletOwnerHouseId !== null
          ) {
            continue;
          }
        } else if (fortnight.house_id != null) {
          if (
            walletOwnerHouseId !== fortnight.house_id ||
            walletOwnerUserId !== null
          ) {
            continue;
          }
        }
      }

      await tx.expense.create({
        data: {
          fortnight_id: fortnightId,
          category_id: categoryId,
          description: template.name,
          amount: String(amount),
          wallet_id: template.wallet_id ?? undefined,
          expense_template_id: template.id,
          due_day: template.due_day ?? undefined,
          is_paid: false,
          user_id: fortnight.user_id,
          house_id: fortnight.house_id,
        },
      });

      created.push(template.name);
    }

    return { count: created.length, names: created };
  });
}

