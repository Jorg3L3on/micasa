import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import { todayCalendarDate } from '@/lib/calendar-dates';
import { computeGoalMetrics } from '@/lib/finance/goal-metrics';
import { listWalletsByOwner } from '@/lib/finance/wallet.service';
import { createWalletTransferForOwner } from '@/lib/finance/wallet-transfer.service';
import { PaymentMethodType } from '@/generated/prisma/client';
import {
  ownerIdSchema,
  ownerTypeSchema,
  runAgentTool,
  type McpToolContext,
} from '@/lib/mcp/tool-helpers';
import { resolveWalletRef } from '@/lib/mcp/resolvers';

const ownerArgs = {
  ownerType: ownerTypeSchema,
  ownerId: ownerIdSchema,
};

const dateYmdSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato requerido: YYYY-MM-DD');

export function registerGoalTools(server: McpServer) {
  server.registerTool(
    'list_goals',
    {
      title: 'Listar metas',
      description:
        'Metas de ahorro del contexto: saldo, objetivo y progreso.',
      inputSchema: z.object({
        ownerType: ownerTypeSchema,
        ownerId: ownerIdSchema,
      }),
      annotations: { readOnlyHint: true },
    },
    async (args, ctx) =>
      runAgentTool('list_goals', ctx as McpToolContext, args, 'read', async (agent) => {
        const wallets = await listWalletsByOwner(agent.ownerFilter);
        const goals = wallets.filter((w) => w.type === PaymentMethodType.GOAL);
        const today = todayCalendarDate();

        return goals.map((goal) => {
          const metrics = computeGoalMetrics({
            amount: goal.amount,
            goal_amount: goal.goal_amount,
            goal_due_date: goal.goal_due_date,
            created_at: goal.created_at,
            active: goal.active,
            today,
          });
          return {
            id: goal.id,
            name: goal.name,
            balance: goal.amount,
            goal_amount: metrics.goalAmount,
            remaining: metrics.remaining,
            saved_progress_pct: Math.round(metrics.savedProgress * 100),
            status: metrics.status,
            goal_due_date: goal.goal_due_date,
          };
        });
      }),
  );

  server.registerTool(
    'contribute_goal',
    {
      title: 'Aportar a meta',
      description: 'Transfiere de una billetera de activo hacia una meta.',
      inputSchema: z.object({
        ...ownerArgs,
        goal_id: z.number().int().positive().optional(),
        goal_name: z.string().trim().min(1).optional(),
        from_wallet_id: z.number().int().positive().optional(),
        from_wallet_name: z.string().trim().min(1).optional(),
        amount: z.number().positive(),
        transfer_date: dateYmdSchema.optional(),
        note: z.string().trim().max(200).optional(),
      }),
      annotations: { destructiveHint: false, idempotentHint: false },
    },
    async (args, ctx) =>
      runAgentTool('contribute_goal', ctx as McpToolContext, args, 'write', async (agent) => {
        const goal = await resolveWalletRef(
          agent.ownerFilter,
          args.goal_id,
          args.goal_name,
        );
        if (goal.type !== PaymentMethodType.GOAL) {
          throw new Error('La billetera destino debe ser una meta (GOAL)');
        }
        const fromWallet = await resolveWalletRef(
          agent.ownerFilter,
          args.from_wallet_id,
          args.from_wallet_name,
        );

        const result = await createWalletTransferForOwner(agent.ownerFilter, {
          from_wallet_id: fromWallet.id,
          to_wallet_id: goal.id,
          amount: args.amount,
          fee_amount: 0,
          transferred_at: args.transfer_date ?? todayCalendarDate(),
          note: args.note ?? 'Aporte a meta',
          exclude_from_report: true,
        });

        return result;
      }),
  );

  server.registerTool(
    'withdraw_goal',
    {
      title: 'Retirar de meta',
      description: 'Transfiere de una meta hacia una billetera de activo.',
      inputSchema: z.object({
        ...ownerArgs,
        goal_id: z.number().int().positive().optional(),
        goal_name: z.string().trim().min(1).optional(),
        to_wallet_id: z.number().int().positive().optional(),
        to_wallet_name: z.string().trim().min(1).optional(),
        amount: z.number().positive(),
        transfer_date: dateYmdSchema.optional(),
        note: z.string().trim().max(200).optional(),
      }),
      annotations: { destructiveHint: false, idempotentHint: false },
    },
    async (args, ctx) =>
      runAgentTool('withdraw_goal', ctx as McpToolContext, args, 'write', async (agent) => {
        const goal = await resolveWalletRef(
          agent.ownerFilter,
          args.goal_id,
          args.goal_name,
        );
        if (goal.type !== PaymentMethodType.GOAL) {
          throw new Error('La billetera origen debe ser una meta (GOAL)');
        }
        const toWallet = await resolveWalletRef(
          agent.ownerFilter,
          args.to_wallet_id,
          args.to_wallet_name,
        );

        const result = await createWalletTransferForOwner(agent.ownerFilter, {
          from_wallet_id: goal.id,
          to_wallet_id: toWallet.id,
          amount: args.amount,
          fee_amount: 0,
          transferred_at: args.transfer_date ?? todayCalendarDate(),
          note: args.note ?? 'Retiro de meta',
          exclude_from_report: true,
        });

        return result;
      }),
  );
}
