import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import { listWalletsByOwner } from '@/lib/finance/wallet.service';
import {
  getWalletAvailableCredit,
  isCreditWalletType,
} from '@/lib/finance/wallet-accounting';
import type { PaymentMethodType } from '@/generated/prisma/client';
import {
  ownerIdSchema,
  ownerTypeSchema,
  runAgentTool,
  type McpToolContext,
} from '@/lib/mcp/tool-helpers';

export function registerWalletTools(server: McpServer) {
  server.registerTool(
    'list_wallets',
    {
      title: 'Listar billeteras',
      description:
        'Billeteras del contexto (efectivo, débito, tarjetas, metas) con saldo, límite y crédito disponible.',
      inputSchema: z.object({
        ownerType: ownerTypeSchema,
        ownerId: ownerIdSchema,
      }),
      annotations: { readOnlyHint: true },
    },
    async (args, ctx) =>
      runAgentTool('list_wallets', ctx as McpToolContext, args, 'read', async (agent) => {
        const wallets = await listWalletsByOwner(agent.ownerFilter);
        return wallets.map((wallet) => ({
          id: wallet.id,
          name: wallet.name,
          type: wallet.type,
          amount: wallet.amount,
          credit_limit: wallet.credit_limit,
          temporary_credit_limit: wallet.temporary_credit_limit,
          available_credit: isCreditWalletType(wallet.type as PaymentMethodType)
            ? getWalletAvailableCredit({
                amount: wallet.amount,
                credit_limit: wallet.credit_limit,
                temporary_credit_limit: wallet.temporary_credit_limit,
              })
            : null,
          active: wallet.active,
          include_in_liquidity: wallet.include_in_liquidity,
          cutoff_day: wallet.cutoff_day,
          due_day: wallet.due_day,
        }));
      }),
  );
}
