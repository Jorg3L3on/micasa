import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import prisma from '@/lib/prisma';
import {
  computeMovementTotals,
  listWalletMovements,
} from '@/lib/finance/wallet-movements';
import {
  createWalletForOwner,
  listWalletsByOwner,
} from '@/lib/finance/wallet.service';
import {
  getWalletAvailableCredit,
  isCreditWalletType,
} from '@/lib/finance/wallet-accounting';
import type { PaymentMethodType } from '@/generated/prisma/client';
import { createWalletSchema } from '@/schemas/wallet.schema';
import { defineOwnerTool } from '@/lib/mcp/define-tool';
import { McpToolError } from '@/lib/mcp/errors';
import { dateYmd, walletRef } from '@/lib/mcp/schemas';
import { resolveDateRange, resolveWalletRef } from '@/lib/mcp/resolvers';

const fundingWalletTypeSchema = z.enum(['CASH', 'DEBIT_CARD']);

export function registerWalletTools(server: McpServer) {
  defineOwnerTool(server, {
    name: 'list_wallets',
    title: 'Listar billeteras',
    description:
      'Billeteras del contexto (efectivo, débito, tarjetas, metas) con saldo, límite y crédito disponible.',
    scope: 'read',
    input: {},
    run: async (agent) => {
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
    },
  });

  defineOwnerTool(server, {
    name: 'create_wallet',
    title: 'Crear billetera de efectivo o débito',
    description:
      'Alta de billetera CASH o DEBIT_CARD (mismo POST /api/wallets que la app).',
    scope: 'write',
    annotations: { destructiveHint: false, idempotentHint: false },
    input: {
      name: z.string().trim().min(1),
      type: fundingWalletTypeSchema.default('CASH'),
      amount: z.number().min(0).default(0),
      include_in_liquidity: z.boolean().default(true),
      active: z.boolean().default(true),
    },
    run: async (agent, args) => {
      const parsed = createWalletSchema.parse({
        name: args.name,
        type: args.type,
        amount: args.amount,
        include_in_liquidity: args.include_in_liquidity,
        active: args.active,
        cutoff_day: null,
        due_day: null,
        credit_limit: null,
        temporary_credit_limit: null,
        goal_amount: null,
        goal_due_date: null,
      });

      const wallet = await createWalletForOwner(
        agent.ownerType,
        agent.ownerId,
        parsed,
      );

      return {
        id: wallet.id,
        name: wallet.name,
        type: wallet.type,
        amount: Number(wallet.amount),
      };
    },
  });

  defineOwnerTool(server, {
    name: 'list_wallet_movements',
    title: 'Movimientos de billetera',
    description:
      'Gastos, ingresos, transferencias y pagos a tarjeta de una billetera de efectivo/débito/meta en un rango (misma vista que /wallets/[id]).',
    scope: 'read',
    input: {
      ...walletRef,
      from: dateYmd.optional(),
      to: dateYmd.optional(),
      last_n_days: z.number().int().min(1).max(366).optional(),
    },
    run: async (agent, args) => {
      const wallet = await resolveWalletRef(
        agent.ownerFilter,
        args.wallet_id,
        args.wallet_name,
      );

      if (isCreditWalletType(wallet.type as PaymentMethodType)) {
        throw new McpToolError(
          'VALIDATION',
          'list_wallet_movements es para efectivo, débito y metas.',
          { hint: 'Para tarjetas usa list_card_movements.' },
        );
      }

      const range = resolveDateRange({
        from: args.from,
        to: args.to,
        last_n_days: args.last_n_days,
      });

      const movements = await listWalletMovements(
        wallet.id,
        agent.ownerFilter,
        range.from,
        range.to,
      );
      const totals = computeMovementTotals(movements);

      const row = await prisma.wallet.findUnique({
        where: { id: wallet.id },
        select: { amount: true, type: true },
      });

      return {
        wallet_id: wallet.id,
        wallet_name: wallet.name,
        wallet_type: wallet.type,
        balance: row ? Number(row.amount) : null,
        from: range.from,
        to: range.to,
        movements,
        totals,
      };
    },
  });
}
