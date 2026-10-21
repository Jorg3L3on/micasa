import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import { todayCalendarDate } from '@/lib/calendar-dates';
import { createWalletTransferForOwner } from '@/lib/finance/wallet-transfer.service';
import { createWalletTransferSchema } from '@/schemas/wallet-transfer.schema';
import { defineOwnerTool } from '@/lib/mcp/define-tool';
import { dateYmd } from '@/lib/mcp/schemas';
import { resolveWalletRef } from '@/lib/mcp/resolvers';

/** Default note when a transfer feeds or drains a savings goal. */
const defaultTransferNote = (fromType: string, toType: string): string | null => {
  if (toType === 'GOAL') return 'Aporte a meta';
  if (fromType === 'GOAL') return 'Retiro de meta';
  return null;
};

export function registerTransferTools(server: McpServer) {
  defineOwnerTool(server, {
    name: 'transfer',
    title: 'Transferir entre billeteras',
    description:
      'Mueve dinero entre billeteras de activo del contexto: efectivo, débito y metas (aportar a una meta o retirar de ella). No es pago de tarjeta (usa add_card_payment) ni aporte a la casa (usa transfer_to_house). El origen puede quedar en negativo salvo metas.',
    scope: 'write',
    annotations: { destructiveHint: false, idempotentHint: false },
    input: {
      from_wallet_id: z.number().int().positive().optional().describe('Billetera origen, de list_wallets.'),
      from_wallet_name: z.string().trim().min(1).optional().describe('Nombre de la billetera origen.'),
      to_wallet_id: z.number().int().positive().optional().describe('Billetera destino.'),
      to_wallet_name: z.string().trim().min(1).optional().describe('Nombre de la billetera destino.'),
      amount: z.number().positive().describe('Monto en MXN.'),
      transfer_date: dateYmd.optional().describe('Default: hoy CDMX.'),
      note: z.string().trim().max(200).optional().describe('Nota opcional.'),
    },
    run: async (agent, args) => {
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

      // Same schema as the REST route (rejects origin = destination).
      const input = createWalletTransferSchema.parse({
        from_wallet_id: fromWallet.id,
        to_wallet_id: toWallet.id,
        amount: args.amount,
        fee_amount: 0,
        transferred_at: args.transfer_date ?? todayCalendarDate(),
        note: args.note ?? defaultTransferNote(fromWallet.type, toWallet.type),
        exclude_from_report: true,
      });
      const result = await createWalletTransferForOwner(agent.ownerFilter, input);

      return {
        transfer_id: result.id,
        amount: result.amount,
        from_wallet_id: result.from_wallet_id,
        to_wallet_id: result.to_wallet_id,
        from_balance: result.from_wallet_amount,
        to_balance: result.to_wallet_amount,
        transferred_at: result.transferred_at,
      };
    },
  });
}
