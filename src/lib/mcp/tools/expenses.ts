import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import prisma from '@/lib/prisma';
import { todayCalendarDate, formatCalendarDate } from '@/lib/calendar-dates';
import { createCreditCardPurchase } from '@/lib/finance/credit-card.service';
import {
  createExpense,
  deleteExpense,
  updateExpense,
} from '@/lib/finance/expense.service';
import { isCreditWalletType } from '@/lib/finance/wallet-accounting';
import type { PaymentMethodType } from '@/generated/prisma/client';
import { createCreditCardPurchaseSchema } from '@/schemas/credit-card.schema';
import {
  confirmSchema,
  ownerIdSchema,
  ownerTypeSchema,
  runAgentTool,
  type McpToolContext,
} from '@/lib/mcp/tool-helpers';
import {
  calendarRangeBounds,
  resolveCategoryRef,
  resolveDateRange,
  resolveFortnightIdForDate,
  resolveWalletRef,
} from '@/lib/mcp/resolvers';

const ownerArgs = {
  ownerType: ownerTypeSchema,
  ownerId: ownerIdSchema,
};

const dateYmdSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato requerido: YYYY-MM-DD');

const walletRefSchema = {
  wallet_id: z.number().int().positive().optional(),
  wallet_name: z.string().trim().min(1).optional(),
};

const categoryRefSchema = {
  category_id: z.number().int().positive().optional(),
  category_name: z.string().trim().min(1).optional(),
};

export function registerExpenseTools(server: McpServer) {
  server.registerTool(
    'add_expense',
    {
      title: 'Registrar gasto',
      description:
        'Registra un gasto en cualquier billetera del contexto. Débito/efectivo bajan saldo; tarjeta sube deuda. already_in_balance: true solo bitácora.',
      inputSchema: z.object({
        ...ownerArgs,
        ...walletRefSchema,
        amount: z.number().positive(),
        description: z.string().trim().min(1).max(200),
        expense_date: dateYmdSchema
          .optional()
          .describe('Fecha del gasto (YYYY-MM-DD). Default: hoy CDMX.'),
        ...categoryRefSchema,
        already_in_balance: z.boolean().default(false),
      }),
      annotations: { destructiveHint: false, idempotentHint: false },
    },
    async (args, ctx) =>
      runAgentTool('add_expense', ctx as McpToolContext, args, 'write', async (agent) => {
        const expenseDate = args.expense_date ?? todayCalendarDate();
        const wallet = await resolveWalletRef(
          agent.ownerFilter,
          args.wallet_id,
          args.wallet_name,
        );
        const categoryId = await resolveCategoryRef(
          agent.ownerFilter,
          args.category_id,
          args.category_name,
        );
        const fortnightId = await resolveFortnightIdForDate(agent, expenseDate);

        if (isCreditWalletType(wallet.type as PaymentMethodType)) {
          const purchaseInput = createCreditCardPurchaseSchema.parse({
            fortnight_id: fortnightId,
            category_id: categoryId ?? undefined,
            description: args.description,
            amount: args.amount,
            payment_date: expenseDate,
            already_in_card_balance: args.already_in_balance,
          });
          const purchase = await createCreditCardPurchase(
            wallet.id,
            agent.ownerFilter,
            purchaseInput,
          );
          const card = await prisma.wallet.findUnique({
            where: { id: wallet.id },
            select: { amount: true },
          });
          return {
            expense_id: purchase.id,
            wallet_id: wallet.id,
            wallet_name: wallet.name,
            amount: args.amount,
            date: expenseDate,
            effect: 'debt_increase',
            new_balance_or_debt: card ? Number(card.amount) : null,
            already_in_balance: args.already_in_balance,
          };
        }

        const created = await createExpense({
          fortnightId,
          categoryId,
          description: args.description,
          amount: args.amount,
          isPaid: true,
          paymentDate: expenseDate,
          walletId: wallet.id,
          applyWalletDelta: !args.already_in_balance,
        });

        const updatedWallet = await prisma.wallet.findUnique({
          where: { id: wallet.id },
          select: { amount: true },
        });

        return {
          expense_id: created.id,
          wallet_id: wallet.id,
          wallet_name: wallet.name,
          amount: args.amount,
          date: expenseDate,
          effect: 'balance_decrease',
          new_balance_or_debt: updatedWallet ? Number(updatedWallet.amount) : null,
          already_in_balance: args.already_in_balance,
        };
      }),
  );

  server.registerTool(
    'list_expenses',
    {
      title: 'Listar gastos por rango',
      description:
        'Lista gastos del contexto en un rango de fechas con totales por billetera y categoría.',
      inputSchema: z.object({
        ...ownerArgs,
        from: dateYmdSchema.optional(),
        to: dateYmdSchema.optional(),
        last_n_days: z.number().int().min(1).max(366).optional(),
        last_n_months: z.number().int().min(1).max(24).optional(),
        wallet_id: z.number().int().positive().optional(),
        wallet_name: z.string().trim().min(1).optional(),
        category_id: z.number().int().positive().optional(),
        category_name: z.string().trim().min(1).optional(),
        limit: z.number().int().min(1).max(500).default(100),
        offset: z.number().int().min(0).default(0),
      }),
      annotations: { readOnlyHint: true },
    },
    async (args, ctx) =>
      runAgentTool('list_expenses', ctx as McpToolContext, args, 'read', async (agent) => {
        const range = resolveDateRange(args);
        const { fromDate, toDate } = calendarRangeBounds(range);

        let walletId = args.wallet_id;
        if (args.wallet_name && walletId == null) {
          walletId = (
            await resolveWalletRef(agent.ownerFilter, undefined, args.wallet_name)
          ).id;
        }

        let categoryId = args.category_id;
        if (args.category_name && categoryId == null) {
          categoryId =
            (await resolveCategoryRef(
              agent.ownerFilter,
              undefined,
              args.category_name,
            )) ?? undefined;
        }

        const where = {
          ...agent.ownerFilter,
          OR: [
            { payment_date: { gte: fromDate, lte: toDate } },
            {
              AND: [
                { payment_date: null },
                { created_at: { gte: fromDate, lte: toDate } },
              ],
            },
          ],
          ...(walletId != null ? { wallet_id: walletId } : {}),
          ...(categoryId != null ? { category_id: categoryId } : {}),
        };

        const [total, expenses] = await Promise.all([
          prisma.expense.count({ where }),
          prisma.expense.findMany({
            where,
            include: {
              wallet: { select: { id: true, name: true, type: true } },
              category: { select: { id: true, name: true } },
            },
            orderBy: [{ payment_date: 'desc' }, { created_at: 'desc' }],
            skip: args.offset,
            take: args.limit,
          }),
        ]);

        const totalsByWallet = new Map<string, number>();
        const totalsByCategory = new Map<string, number>();

        for (const expense of expenses) {
          const walletKey = expense.wallet?.name ?? 'Sin billetera';
          totalsByWallet.set(
            walletKey,
            (totalsByWallet.get(walletKey) ?? 0) + Number(expense.amount),
          );
          const categoryKey = expense.category?.name ?? 'Sin categoría';
          totalsByCategory.set(
            categoryKey,
            (totalsByCategory.get(categoryKey) ?? 0) + Number(expense.amount),
          );
        }

        return {
          from: range.from,
          to: range.to,
          total_count: total,
          offset: args.offset,
          limit: args.limit,
          expenses: expenses.map((expense) => ({
            id: expense.id,
            date: formatCalendarDate(expense.payment_date ?? expense.created_at),
            description: expense.description,
            amount: Number(expense.amount),
            wallet_id: expense.wallet_id,
            wallet_name: expense.wallet?.name ?? null,
            wallet_type: expense.wallet?.type ?? null,
            category_id: expense.category_id,
            category_name: expense.category?.name ?? null,
            is_paid: expense.is_paid,
            effect:
              expense.wallet?.type &&
              isCreditWalletType(expense.wallet.type as PaymentMethodType)
                ? 'debt_increase'
                : 'balance_decrease',
          })),
          totals_in_page: {
            by_wallet: Object.fromEntries(totalsByWallet),
            by_category: Object.fromEntries(totalsByCategory),
          },
        };
      }),
  );

  server.registerTool(
    'update_expense',
    {
      title: 'Editar gasto',
      description:
        'Corrige monto, billetera, categoría, fecha o descripción. Recalcula saldo/deuda sin tocar otras billeteras.',
      inputSchema: z.object({
        ...ownerArgs,
        expense_id: z.number().int().positive(),
        amount: z.number().positive().optional(),
        description: z.string().trim().min(1).max(200).optional(),
        expense_date: dateYmdSchema.optional(),
        wallet_id: z.number().int().positive().optional(),
        wallet_name: z.string().trim().min(1).optional(),
        category_id: z.number().int().positive().optional(),
        category_name: z.string().trim().min(1).optional(),
      }),
      annotations: { destructiveHint: false, idempotentHint: true },
    },
    async (args, ctx) =>
      runAgentTool('update_expense', ctx as McpToolContext, args, 'write', async (agent) => {
        let walletId: number | null | undefined;
        if (args.wallet_id != null || args.wallet_name) {
          const wallet = await resolveWalletRef(
            agent.ownerFilter,
            args.wallet_id,
            args.wallet_name,
          );
          walletId = wallet.id;
        }

        let categoryId: number | undefined;
        if (args.category_id != null || args.category_name) {
          categoryId =
            (await resolveCategoryRef(
              agent.ownerFilter,
              args.category_id,
              args.category_name,
            )) ?? undefined;
        }

        let fortnightId: number | undefined;
        if (args.expense_date) {
          fortnightId = await resolveFortnightIdForDate(agent, args.expense_date);
        }

        const updated = await updateExpense({
          id: args.expense_id,
          ownerFilter: agent.ownerFilter,
          ...(args.amount != null ? { amount: args.amount } : {}),
          ...(args.description != null ? { description: args.description } : {}),
          ...(args.expense_date != null ? { paymentDate: args.expense_date } : {}),
          ...(fortnightId != null ? { fortnightId } : {}),
          ...(walletId !== undefined ? { walletId } : {}),
          ...(categoryId != null ? { categoryId } : {}),
        });

        return { expense: updated };
      }),
  );

  server.registerTool(
    'delete_expense',
    {
      title: 'Eliminar gasto',
      description:
        'Elimina un gasto y revierte su efecto en saldo o deuda. Requiere confirm: true.',
      inputSchema: z.object({
        ...ownerArgs,
        expense_id: z.number().int().positive(),
        confirm: confirmSchema,
      }),
      annotations: { destructiveHint: true, idempotentHint: true },
    },
    async (args, ctx) =>
      runAgentTool('delete_expense', ctx as McpToolContext, args, 'write', async (agent) => {
        await deleteExpense({
          id: args.expense_id,
          ownerFilter: agent.ownerFilter,
        });
        return { deleted: true, expense_id: args.expense_id };
      }),
  );
}
