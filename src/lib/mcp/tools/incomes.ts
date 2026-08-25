import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import { FortnightPeriod } from '@/generated/prisma/client';
import { todayCalendarDate } from '@/lib/calendar-dates';
import { findFortnightByCalendarPeriod } from '@/features/monthly/server/monthly.queries';
import {
  createIncomeForOwner,
  deleteIncomeForOwner,
  listIncomesForFortnight,
  updateIncomeForOwner,
} from '@/lib/finance/income.service';
import {
  isCreditWalletType,
  isFundingWalletType,
} from '@/lib/finance/wallet-accounting';
import { updateWalletMetadataForOwner } from '@/lib/finance/wallet.service';
import type { PaymentMethodType } from '@/generated/prisma/client';
import type { AgentContext } from '@/lib/server/resolve-agent-context';
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

const periodSchema = z.enum(['FIRST', 'SECOND']);

const resolveFortnightIdFromArgs = async (
  agent: AgentContext,
  input: {
    fortnight_id?: number;
    year?: number;
    month?: number;
    period?: 'FIRST' | 'SECOND';
    income_date?: string;
  },
): Promise<number> => {
  if (input.fortnight_id != null) {
    return input.fortnight_id;
  }
  if (input.year != null && input.month != null && input.period != null) {
    const parsedPeriod =
      input.period === 'SECOND'
        ? FortnightPeriod.SECOND
        : FortnightPeriod.FIRST;
    const fortnight = await findFortnightByCalendarPeriod(
      agent.ownerFilter,
      input.year,
      input.month,
      parsedPeriod,
    );
    if (!fortnight) {
      throw new Error('Quincena no encontrada');
    }
    return fortnight.id;
  }
  if (input.income_date) {
    return resolveFortnightIdForDate(agent, input.income_date);
  }
  throw new Error('Indica fortnight_id o year + month + period');
};

export function registerIncomeTools(server: McpServer) {
  server.registerTool(
    'list_incomes',
    {
      title: 'Listar ingresos de quincena',
      description:
        'Lista ingresos registrados en una quincena. Misma consulta que GET /api/incomes?fortnightId=…',
      inputSchema: z
        .object({
          ...ownerArgs,
          fortnight_id: z.number().int().positive().optional(),
          year: z.number().int().min(2000).max(2100).optional(),
          month: z.number().int().min(1).max(12).optional(),
          period: periodSchema.optional(),
        })
        .superRefine((data, ctxRef) => {
          if (data.fortnight_id != null) return;
          if (data.year == null || data.month == null || data.period == null) {
            ctxRef.addIssue({
              code: 'custom',
              message: 'Indica fortnight_id o year + month + period',
              path: ['fortnight_id'],
            });
          }
        }),
      annotations: { readOnlyHint: true },
    },
    async (args, ctx) =>
      runAgentTool('list_incomes', ctx as McpToolContext, args, 'read', async (agent) => {
        const fortnightId = await resolveFortnightIdFromArgs(agent, args);
        const incomes = await listIncomesForFortnight(agent.ownerFilter, fortnightId);
        return { fortnight_id: fortnightId, incomes };
      }),
  );

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
        fortnight_id: z.number().int().positive().optional(),
        year: z.number().int().min(2000).max(2100).optional(),
        month: z.number().int().min(1).max(12).optional(),
        period: periodSchema.optional(),
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
            'No se puede registrar ingreso en una tarjeta; usa pay_card o add_card_payment.',
          );
        }

        await resolveCategoryRef(
          agent.ownerFilter,
          args.category_id,
          args.category_name,
        );

        const fortnightId = await resolveFortnightIdFromArgs(agent, {
          ...args,
          income_date: incomeDate,
        });

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
    'update_income',
    {
      title: 'Actualizar ingreso',
      description:
        'Corrige monto y/o billetera de un ingreso. Misma lógica que PUT /api/incomes?id=…',
      inputSchema: z.object({
        ...ownerArgs,
        income_id: z.number().int().positive(),
        amount: z.number().min(0),
        wallet_id: z.number().int().positive().optional(),
        wallet_name: z.string().trim().min(1).optional(),
        force_wallet_credit: z
          .boolean()
          .optional()
          .describe('Recuperación: vuelve a acreditar la billetera.'),
      }),
      annotations: { destructiveHint: false, idempotentHint: true },
    },
    async (args, ctx) =>
      runAgentTool('update_income', ctx as McpToolContext, args, 'write', async (agent) => {
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
      }),
  );

  server.registerTool(
    'delete_income',
    {
      title: 'Eliminar ingreso',
      description:
        'Elimina un ingreso y revierte su efecto en la billetera. Requiere confirm: true.',
      inputSchema: z.object({
        ...ownerArgs,
        income_id: z.number().int().positive(),
        confirm: confirmSchema,
      }),
      annotations: { destructiveHint: true, idempotentHint: true },
    },
    async (args, ctx) =>
      runAgentTool('delete_income', ctx as McpToolContext, args, 'write', async (agent) =>
        deleteIncomeForOwner(args.income_id, agent.ownerFilter),
      ),
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
