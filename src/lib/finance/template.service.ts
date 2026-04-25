import prisma from '@/lib/prisma';
import type { Prisma } from '@/generated/prisma/client';
import { TransferType } from '@/generated/prisma/client';
import { createUserToHouseTransferInTx } from '@/lib/finance/transfer.service';
import { resolveTemplateDueDay } from '@/lib/finance/expense-template-due';

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

    const ownerWhere =
      fortnight.user_id != null
        ? { user_id: fortnight.user_id, house_id: null }
        : { user_id: null, house_id: fortnight.house_id! };

    const templates = await tx.incomeTemplate.findMany({
      where: {
        ...ownerWhere,
        ...(period === 'FIRST'
          ? { active: true, applies_first_fortnight: true }
          : { active: true, applies_second_fortnight: true }),
      },
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
    const templateIds = templates.map((template) => template.id);
    const existingIncomes = templateIds.length
      ? await tx.income.findMany({
          where: {
            fortnight_id: fortnightId,
            income_template_id: { in: templateIds },
          },
          select: { income_template_id: true },
        })
      : [];
    const existingIncomeTemplateIds = new Set(
      existingIncomes
        .map((income) => income.income_template_id)
        .filter((value): value is number => value !== null),
    );

    const created: string[] = [];

    for (const template of templates) {
      const amount =
        template.suggested_amount != null &&
        Number(template.suggested_amount) > 0
          ? Number(template.suggested_amount)
          : INCOME_TEMPLATE_DEFAULT_AMOUNT;

      if (template.house_id == null) {
        // User income template: need a user (template's or default in user context)
        const userId =
          template.user_id ??
          (fortnight.user_id != null ? defaultUser?.id : null);
        if (userId == null) continue;

        if (existingIncomeTemplateIds.has(template.id)) continue;

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
        existingIncomeTemplateIds.add(template.id);
      } else {
        // House income template
        const houseId = template.house_id;

        if (template.user_id == null) {
          // House-only income (no specific user): create Income directly for the house
          if (existingIncomeTemplateIds.has(template.id)) continue;

          await tx.income.create({
            data: {
              fortnight_id: fortnightId,
              user_id: null,
              house_id: houseId,
              amount: String(amount),
              source: template.source ?? undefined,
              received_at: fortnight.start_date,
              income_template_id: template.id,
            },
          });
          existingIncomeTemplateIds.add(template.id);
        } else {
          // House template with user (transfer: user → house)
          const userId = template.user_id;

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
      }

      created.push(template.name);
    }

    return { count: created.length, names: created };
  }, { timeout: 30000, maxWait: 10000 });
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

    const ownerWhere =
      fortnight.user_id != null
        ? { user_id: fortnight.user_id, house_id: null }
        : { user_id: null, house_id: fortnight.house_id! };

    const appliesField =
      period === 'FIRST'
        ? 'applies_first_fortnight'
        : 'applies_second_fortnight';

    const templates = await tx.expenseTemplate.findMany({
      where: {
        ...ownerWhere,
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
        due_day_first_fortnight: true,
        due_day_second_fortnight: true,
      },
    });

    const created: string[] = [];
    const templateIds = templates.map((template) => template.id);
    const existingExpenses = templateIds.length
      ? await tx.expense.findMany({
          where: {
            fortnight_id: fortnightId,
            expense_template_id: { in: templateIds },
          },
          select: { expense_template_id: true },
        })
      : [];
    const existingTemplateIds = new Set(
      existingExpenses
        .map((expense) => expense.expense_template_id)
        .filter((value): value is number => value !== null),
    );

    const walletIds = Array.from(
      new Set(
        templates
          .map((template) => template.wallet_id)
          .filter((value): value is number => value !== null),
      ),
    );
    const wallets = walletIds.length
      ? await tx.wallet.findMany({
          where: { id: { in: walletIds } },
          select: { id: true, user_id: true, house_id: true },
        })
      : [];
    const walletById = new Map(wallets.map((wallet) => [wallet.id, wallet]));

    for (const template of templates) {
      const categoryId = template.category_id;
      if (categoryId === null) continue;

      if (existingTemplateIds.has(template.id)) continue;

      const amount =
        template.suggested_amount != null &&
        Number(template.suggested_amount) > 0
          ? Number(template.suggested_amount)
          : DEFAULT_EXPENSE_AMOUNT;

      let walletIdForExpense: number | null = template.wallet_id;
      if (template.wallet_id != null) {
        const wallet = walletById.get(template.wallet_id);

        if (!wallet) {
          walletIdForExpense = null;
        }

        if (wallet) {
          const walletOwnerUserId = wallet.user_id;
          const walletOwnerHouseId = wallet.house_id;

          if (fortnight.user_id != null) {
            if (
              walletOwnerUserId !== fortnight.user_id ||
              walletOwnerHouseId !== null
            ) {
              walletIdForExpense = null;
            }
          } else if (fortnight.house_id != null) {
            if (
              walletOwnerHouseId !== fortnight.house_id ||
              walletOwnerUserId !== null
            ) {
              walletIdForExpense = null;
            }
          }
        }
      }

      const resolvedDue = resolveTemplateDueDay(period, template);

      await tx.expense.create({
        data: {
          fortnight_id: fortnightId,
          category_id: categoryId,
          description: template.name,
          amount: String(amount),
          wallet_id: walletIdForExpense ?? undefined,
          expense_template_id: template.id,
          due_day: resolvedDue,
          is_paid: false,
          user_id: fortnight.user_id,
          house_id: fortnight.house_id,
        },
      });

      created.push(template.name);
      existingTemplateIds.add(template.id);
    }

    return { count: created.length, names: created };
  }, { timeout: 30000, maxWait: 10000 });
}

