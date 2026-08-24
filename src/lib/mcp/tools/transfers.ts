import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import { todayCalendarDate } from '@/lib/calendar-dates';
import { createWalletTransferForOwner } from '@/lib/finance/wallet-transfer.service';
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

export function registerTransferTools(server: McpServer) {
  server.registerTool(
    'transfer',
    {
      title: 'Transferir entre billeteras',
      description:
        'Mueve dinero entre billeteras de activo (efectivo, débito, metas). No es pago de tarjeta. El origen puede quedar en negativo salvo metas.',
      inputSchema: z.object({
        ...ownerArgs,
        from_wallet_id: z.number().int().positive().optional(),
        from_wallet_name: z.string().trim().min(1).optional(),
        to_wallet_id: z.number().int().positive().optional(),
        to_wallet_name: z.string().trim().min(1).optional(),
        amount: z.number().positive(),
        transfer_date: dateYmdSchema.optional().describe('Default: hoy CDMX.'),
        note: z.string().trim().max(200).optional(),
      }),
      annotations: { destructiveHint: false, idempotentHint: false },
    },
    async (args, ctx) =>
      runAgentTool('transfer', ctx as McpToolContext, args, 'write', async (agent) => {
        const fromWallet = await resolveWalletRef(
          agent.ownerFilter,
          args.from_wallet_id,
          args.from_wallet_name,
        );
        const toWallet = await resolveWalletRef(
          agent.ownerFilter,
          args.to_wallet_id,
          args.to_wallet_name,
        );

        const result = await createWalletTransferForOwner(agent.ownerFilter, {
          from_wallet_id: fromWallet.id,
          to_wallet_id: toWallet.id,
          amount: args.amount,
          fee_amount: 0,
          transferred_at: args.transfer_date ?? todayCalendarDate(),
          note: args.note ?? null,
          exclude_from_report: true,
        });

        return {
          transfer_id: result.id,
          amount: result.amount,
          from_wallet_id: result.from_wallet_id,
          to_wallet_id: result.to_wallet_id,
          from_balance: result.from_wallet_amount,
          to_balance: result.to_wallet_amount,
          transferred_at: result.transferred_at,
        };
      }),
  );
}
