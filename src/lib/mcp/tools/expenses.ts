import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import { todayCalendarDate, formatCalendarDate } from '@/lib/calendar-dates';
import { createCreditCardPurchase } from '@/lib/finance/credit-card.service';
import {
  createExpense,
  toggleExpensePaid,
  updateExpense,
} from '@/lib/finance/expense.service';
import { isCreditWalletType } from '@/lib/finance/wallet-accounting';
import { listExpensesWithTotals } from '@/lib/finance/expense-list.service';
import { getWalletAmountForOwner } from '@/lib/finance/wallet.service';
import type { PaymentMethodType } from '@/generated/prisma/client';
import { createCreditCardPurchaseSchema } from '@/schemas/credit-card.schema';
import { defineOwnerTool } from '@/lib/mcp/define-tool';
import { McpToolError } from '@/lib/mcp/errors';
import { categoryRef, dateYmd, walletRef } from '@/lib/mcp/schemas';
import {
  resolveCategoryRef,
  resolveDateRange,
  resolveFortnightIdForDate,
  resolveWalletRef,
} from '@/lib/mcp/resolvers';

export function registerExpenseTools(server: McpServer) {
  defineOwnerTool(server, {
    name: 'add_expense',
    title: 'Registrar gasto',
    description:
      'Registra un gasto en cualquier billetera del contexto. Efectivo/débito bajan saldo; en una tarjeta es una compra que sube la deuda (con installment_current/installment_total para MSI). already_in_balance: true solo deja bitácora sin mover saldo ni deuda.',
    scope: 'write',
    annotations: { destructiveHint: false, idempotentHint: false },
    input: {
      ...walletRef,
      amount: z.number().positive(),
      description: z.string().trim().min(1).max(200),
      expense_date: dateYmd
        .optional()
        .describe('Fecha del gasto (YYYY-MM-DD). Default: hoy CDMX.'),
      ...categoryRef,
      already_in_balance: z
        .boolean()
        .default(false)
        .describe('true si el gasto ya está reflejado en el saldo o la deuda actual.'),
      is_paid: z
        .boolean()
        .default(true)
        .describe(
          'true = gasto pagado (mueve saldo); false = pendiente de pago en la quincena. Las compras con tarjeta siempre suben la deuda.',
        ),
      installment_current: z
        .number()
        .int()
        .positive()
        .optional()
        .describe('Solo tarjetas: mensualidad actual de una compra a MSI.'),
      installment_total: z
        .number()
        .int()
        .positive()
        .optional()
        .describe('Solo tarjetas: total de mensualidades (MSI); requiere installment_current.'),
    },
    run: async (agent, args) => {
      const expenseDate = args.expense_date ?? todayCalendarDate();
      const wallet = await resolveWalletRef(
        agent.ownerFilter,
        args.wallet_id,
        args.wallet_name,
      );
      const isCard = isCreditWalletType(wallet.type as PaymentMethodType);
      const hasInstallments =
        args.installment_current != null || args.installment_total != null;
      if (hasInstallments && !isCard) {
        throw new McpToolError(
          'VALIDATION',
          'installment_current / installment_total solo aplican a compras con tarjeta',
        );
      }

      const categoryId = await resolveCategoryRef(
        agent.ownerFilter,
        args.category_id,
        args.category_name,
      );
      const fortnightId = await resolveFortnightIdForDate(agent, expenseDate);

      if (isCard) {
        const purchaseInput = createCreditCardPurchaseSchema.parse({
          fortnight_id: fortnightId,
          category_id: categoryId ?? undefined,
          description: args.description,
          amount: args.amount,
          payment_date: expenseDate,
          already_in_card_balance: args.already_in_balance,
          credit_installment_current: args.installment_current ?? null,
          credit_installment_total: args.installment_total ?? null,
        });
        const purchase = await createCreditCardPurchase(
          wallet.id,
          agent.ownerFilter,
          purchaseInput,
        );
        return {
          expense_id: purchase.id,
          wallet_id: wallet.id,
          wallet_name: wallet.name,
          amount: args.amount,
          date: expenseDate,
          effect: 'debt_increase',
          new_balance_or_debt: await getWalletAmountForOwner(wallet.id, agent.ownerFilter),
          already_in_balance: args.already_in_balance,
          installment:
            args.installment_current != null && args.installment_total != null
              ? `${args.installment_current}/${args.installment_total}`
              : null,
        };
      }

      const created = await createExpense({
        fortnightId,
        categoryId,
        description: args.description,
        amount: args.amount,
        isPaid: args.is_paid,
        paymentDate: expenseDate,
        walletId: wallet.id,
        applyWalletDelta: args.is_paid && !args.already_in_balance,
      });

      return {
        expense_id: created.id,
        wallet_id: wallet.id,
        wallet_name: wallet.name,
        amount: args.amount,
        date: expenseDate,
        effect: args.is_paid ? 'balance_decrease' : 'pending_expense',
        new_balance_or_debt: await getWalletAmountForOwner(wallet.id, agent.ownerFilter),
        is_paid: args.is_paid,
        already_in_balance: args.already_in_balance,
      };
    },
  });

  defineOwnerTool(server, {
    name: 'list_expenses',
    title: 'Listar gastos por rango',
    description:
      'Lista gastos del contexto en un rango de fechas (default últimos 30 días), paginados, con totales del rango completo por billetera y categoría.',
    scope: 'read',
    input: {
      from: dateYmd.optional(),
      to: dateYmd.optional(),
      last_n_days: z.number().int().min(1).max(366).optional(),
      last_n_months: z.number().int().min(1).max(24).optional(),
      ...walletRef,
      ...categoryRef,
      limit: z.number().int().min(1).max(500).default(100),
      offset: z.number().int().min(0).default(0),
    },
    run: async (agent, args) => {
      const range = resolveDateRange(args);

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

      const { totalCount, expenses, totals, totalsInPage } = await listExpensesWithTotals(
        agent.ownerFilter,
        { from: range.from, to: range.to, walletId, categoryId },
        { limit: args.limit, offset: args.offset },
      );

      return {
        from: range.from,
        to: range.to,
        total_count: totalCount,
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
        totals,
        totals_in_page: totalsInPage,
      };
    },
  });

  defineOwnerTool(server, {
    name: 'update_expense',
    title: 'Editar gasto o marcarlo pagado',
    description:
      'Corrige monto, billetera, categoría, fecha o descripción y recalcula saldo/deuda sin tocar otras billeteras. Con solo is_paid marca el gasto pagado (mueve saldo/deuda) o pendiente (lo revierte).',
    scope: 'write',
    annotations: { destructiveHint: false, idempotentHint: true },
    input: {
      expense_id: z.number().int().positive(),
      amount: z.number().positive().optional(),
      description: z.string().trim().min(1).max(200).optional(),
      expense_date: dateYmd.optional(),
      ...walletRef,
      ...categoryRef,
      is_paid: z
        .boolean()
        .optional()
        .describe('true = pagado (mueve saldo/deuda); false = pendiente en la quincena.'),
    },
    run: async (agent, args) => {
      const editsFields =
        args.amount != null ||
        args.description != null ||
        args.expense_date != null ||
        args.wallet_id != null ||
        args.wallet_name != null ||
        args.category_id != null ||
        args.category_name != null;

      if (!editsFields) {
        if (args.is_paid === undefined) {
          throw new McpToolError('VALIDATION', 'Indica al menos un campo a cambiar');
        }
        // Same path as the app's "pagado" toggle (keeps its transfer / loan guards).
        const expense = await toggleExpensePaid({
          id: args.expense_id,
          paid: args.is_paid,
          ownerFilter: agent.ownerFilter,
        });
        return {
          expense_id: expense.id,
          is_paid: expense.is_paid,
          amount: Number(expense.amount),
          description: expense.description,
          wallet_name: expense.wallet?.name ?? 'Efectivo',
        };
      }

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
        ...(args.is_paid !== undefined ? { isPaid: args.is_paid } : {}),
      });

      return { expense: updated };
    },
  });
}
