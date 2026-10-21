import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import { todayCalendarDate } from '@/lib/calendar-dates';
import {
  createIncomeForOwner,
  listIncomesForFortnight,
  updateIncomeForOwner,
} from '@/lib/finance/income.service';
import { isCreditWalletType } from '@/lib/finance/wallet-accounting';
import type { PaymentMethodType } from '@/generated/prisma/client';
import { defineOwnerTool } from '@/lib/mcp/define-tool';
import { McpToolError } from '@/lib/mcp/errors';
import { categoryRef, dateYmd, fortnightRef, walletRef } from '@/lib/mcp/schemas';
import {
  resolveCategoryRef,
  resolveFortnightIdForDate,
  resolveFortnightRef,
  resolveWalletRef,
} from '@/lib/mcp/resolvers';

export function registerIncomeTools(server: McpServer) {
  defineOwnerTool(server, {
    name: 'list_incomes',
    title: 'Listar ingresos de quincena',
    description:
      'Lista los ingresos registrados en una quincena (por fortnight_id o year + month + period).',
    scope: 'read',
    input: { ...fortnightRef },
    run: async (agent, args) => {
      const fortnightId = await resolveFortnightRef(agent, args);
      const incomes = await listIncomesForFortnight(agent.ownerFilter, fortnightId);
      return { fortnight_id: fortnightId, incomes };
    },
  });

  defineOwnerTool(server, {
    name: 'add_income',
    title: 'Agregar ingreso',
    description:
      'Registra un ingreso en una billetera de activo (efectivo/débito/meta) y sube su saldo. La quincena sale de fortnight_id, de year + month + period o de la fecha. No aplica a tarjetas (usa add_card_payment).',
    scope: 'write',
    annotations: { destructiveHint: false, idempotentHint: false },
    input: {
      ...walletRef,
      amount: z.number().positive(),
      description: z.string().trim().max(200).optional(),
      income_date: dateYmd
        .optional()
        .describe('Fecha de recepción (YYYY-MM-DD). Default: hoy CDMX.'),
      ...categoryRef,
      ...fortnightRef,
    },
    run: async (agent, args) => {
      const incomeDate = args.income_date ?? todayCalendarDate();
      const wallet = await resolveWalletRef(
        agent.ownerFilter,
        args.wallet_id,
        args.wallet_name,
      );

      if (isCreditWalletType(wallet.type as PaymentMethodType)) {
        throw new McpToolError(
          'VALIDATION',
          'No se puede registrar ingreso en una tarjeta.',
          { hint: 'Para pagar la tarjeta usa add_card_payment.' },
        );
      }

      await resolveCategoryRef(
        agent.ownerFilter,
        args.category_id,
        args.category_name,
      );

      const hasFortnightRef =
        args.fortnight_id != null ||
        (args.year != null && args.month != null && args.period != null);
      const fortnightId = hasFortnightRef
        ? await resolveFortnightRef(agent, args)
        : await resolveFortnightIdForDate(agent, incomeDate);

      return createIncomeForOwner(agent.ownerFilter, {
        fortnightId,
        walletId: wallet.id,
        amount: args.amount,
        description: args.description,
        receivedAt: incomeDate,
      });
    },
  });

  defineOwnerTool(server, {
    name: 'update_income',
    title: 'Actualizar ingreso',
    description:
      'Corrige el monto y/o la billetera de un ingreso; el saldo de las billeteras se recalcula.',
    scope: 'write',
    annotations: { destructiveHint: false, idempotentHint: true },
    input: {
      income_id: z.number().int().positive(),
      amount: z.number().min(0),
      ...walletRef,
      force_wallet_credit: z
        .boolean()
        .optional()
        .describe('Recuperación: vuelve a acreditar la billetera.'),
    },
    run: async (agent, args) => {
      let walletId = args.wallet_id;
      if (args.wallet_name && walletId == null) {
        walletId = (
          await resolveWalletRef(agent.ownerFilter, undefined, args.wallet_name)
        ).id;
      }

      return updateIncomeForOwner({
        id: args.income_id,
        ownerFilter: agent.ownerFilter,
        amount: args.amount,
        walletId,
        forceWalletCredit: args.force_wallet_credit,
      });
    },
  });
}
