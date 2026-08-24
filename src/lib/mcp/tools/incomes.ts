import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import { todayCalendarDate } from '@/lib/calendar-dates';
import { createIncomeForOwner } from '@/lib/finance/income.service';
import {
  isCreditWalletType,
  isFundingWalletType,
} from '@/lib/finance/wallet-accounting';
import { updateWalletMetadataForOwner } from '@/lib/finance/wallet.service';
import type { PaymentMethodType } from '@/generated/prisma/client';
import {
  confirmSchema,
  ownerIdSchema,
  ownerTypeSchema,
  runAgentTool,
  type McpToolContext,
} from '@/lib/mcp/tool-helpers';
import {
  resolveCategoryRef,
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

export function registerIncomeTools(server: McpServer) {
  server.registerTool(
    'add_income',
    {
      title: 'Registrar ingreso',
      description:
        'Registra un ingreso en una billetera de activo (efectivo/débito/meta). Sube el saldo. No aplica a tarjetas.',
      inputSchema: z.object({
        ...ownerArgs,
        wallet_id: z.number().int().positive().optional(),
        wallet_name: z.string().trim().min(1).optional(),
        amount: z.number().positive(),
        description: z.string().trim().max(200).optional(),
        income_date: dateYmdSchema
          .optional()
          .describe('Fecha de recepción (YYYY-MM-DD). Default: hoy CDMX.'),
        category_id: z.number().int().positive().optional(),
        category_name: z.string().trim().min(1).optional(),
      }),
      annotations: { destructiveHint: false, idempotentHint: false },
    },
    async (args, ctx) =>
      runAgentTool('add_income', ctx as McpToolContext, args, 'write', async (agent) => {
        const incomeDate = args.income_date ?? todayCalendarDate();
        const wallet = await resolveWalletRef(
          agent.ownerFilter,
          args.wallet_id,
          args.wallet_name,
        );

        if (isCreditWalletType(wallet.type as PaymentMethodType)) {
          throw new Error(
            'No se puede registrar ingreso en una tarjeta; usa add_card_payment para pagos externos.',
          );
        }

        await resolveCategoryRef(
          agent.ownerFilter,
          args.category_id,
          args.category_name,
        );

        const fortnightId = await resolveFortnightIdForDate(agent, incomeDate);

        return createIncomeForOwner(agent.ownerFilter, {
          fortnightId,
          walletId: wallet.id,
          amount: args.amount,
          description: args.description,
          receivedAt: incomeDate,
        });
      }),
  );

  server.registerTool(
    'adjust_wallet_balance',
    {
      title: 'Ajustar saldo de billetera',
      description:
        'Fija el saldo de efectivo/débito/meta al número del banco. No crea gasto ni ingreso. Requiere confirm: true.',
      inputSchema: z.object({
        ...ownerArgs,
        wallet_id: z.number().int().positive().optional(),
        wallet_name: z.string().trim().min(1).optional(),
        new_balance: z.number().min(0),
        confirm: confirmSchema,
      }),
      annotations: { destructiveHint: true, idempotentHint: true },
    },
    async (args, ctx) =>
      runAgentTool(
        'adjust_wallet_balance',
        ctx as McpToolContext,
        args,
        'write',
        async (agent) => {
          const wallet = await resolveWalletRef(
            agent.ownerFilter,
            args.wallet_id,
            args.wallet_name,
          );

          if (
            !isFundingWalletType(wallet.type as PaymentMethodType) &&
            wallet.type !== 'GOAL'
          ) {
            throw new Error(
              'Solo se puede ajustar saldo en efectivo, débito o metas. Para tarjetas usa adjust_card_debt.',
            );
          }

          const updated = await updateWalletMetadataForOwner(
            wallet.id,
            { amount: args.new_balance },
            agent.ownerFilter,
          );

          return {
            wallet_id: wallet.id,
            wallet_name: wallet.name,
            new_balance: Number(updated.amount),
          };
        },
      ),
  );
}
