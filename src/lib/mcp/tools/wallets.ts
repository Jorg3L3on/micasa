import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import { formatCalendarDate, todayCalendarDate } from '@/lib/calendar-dates';
import { computeGoalMetrics } from '@/lib/finance/goal-metrics';
import {
  computeMovementTotals,
  listWalletMovements,
} from '@/lib/finance/wallet-movements';
import {
  createWalletForOwner,
  getWalletAmountForOwner,
  listWalletsByOwner,
  updateWalletMetadataForOwner,
} from '@/lib/finance/wallet.service';
import type { WalletListItem } from '@/types/catalog';
import {
  createCreditCardForOwner,
  updateCreditCardForOwner,
} from '@/lib/finance/credit-card.service';
import {
  getWalletAvailableCredit,
  isCreditWalletType,
  isFundingWalletType,
} from '@/lib/finance/wallet-accounting';
import type { PaymentMethodType } from '@/generated/prisma/client';
import { listCardMovementsForRange } from '@/lib/finance/credit-card-movements.service';
import { createWalletSchema, updateWalletSchema } from '@/schemas/wallet.schema';
import {
  createCreditCardSchema,
  updateCreditCardSchema,
} from '@/schemas/credit-card.schema';
import { defineOwnerTool } from '@/lib/mcp/define-tool';
import { McpToolError } from '@/lib/mcp/errors';
import { confirm, dateYmd, walletRef } from '@/lib/mcp/schemas';
import { resolveDateRange, resolveWalletRef } from '@/lib/mcp/resolvers';

const walletTypeSchema = z
  .enum(['CASH', 'DEBIT_CARD', 'CREDIT_CARD', 'DEPARTMENT_STORE_CARD', 'GOAL'])
  .describe(
    'CASH / DEBIT_CARD = fondo, CREDIT_CARD / DEPARTMENT_STORE_CARD = tarjeta, GOAL = meta.',
  );

type WalletKind = 'funding' | 'credit' | 'goal';

const walletKind = (type: string): WalletKind => {
  if (type === 'GOAL') return 'goal';
  return isCreditWalletType(type as PaymentMethodType) ? 'credit' : 'funding';
};

const CARD_ONLY_FIELDS = [
  'credit_limit',
  'temporary_credit_limit',
  'cutoff_day',
  'due_day',
] as const;
const GOAL_ONLY_FIELDS = ['goal_amount', 'goal_due_date'] as const;

/** Rejects fields that do not apply to the wallet kind (strict per type). */
const assertFieldsForKind = (kind: WalletKind, args: Record<string, unknown>) => {
  const misplaced = [
    ...(kind === 'credit' ? [] : CARD_ONLY_FIELDS),
    ...(kind === 'goal' ? [] : GOAL_ONLY_FIELDS),
  ].filter((field) => args[field] !== undefined);
  if (misplaced.length > 0) {
    throw new McpToolError(
      'VALIDATION',
      `${misplaced.join(', ')} no aplica a billeteras de tipo ${kind}`,
      {
        hint: 'credit_limit, temporary_credit_limit, cutoff_day y due_day son de tarjetas; goal_amount y goal_due_date de metas.',
      },
    );
  }
};

const goalFields = (wallet: WalletListItem) => {
  const metrics = computeGoalMetrics({
    amount: wallet.amount,
    goal_amount: wallet.goal_amount,
    goal_due_date: wallet.goal_due_date,
    created_at: wallet.created_at,
    active: wallet.active,
    today: todayCalendarDate(),
  });
  return {
    goal_amount: metrics.goalAmount,
    goal_due_date: wallet.goal_due_date,
    remaining: metrics.remaining,
    saved_progress_pct: Math.round(metrics.savedProgress * 100),
    status: metrics.status,
  };
};

const formatGoalWallet = (wallet: {
  id: number;
  name: string;
  type: string;
  amount: unknown;
  goal_amount: unknown;
  goal_due_date: Date | null;
  active: boolean;
}) => ({
  id: wallet.id,
  name: wallet.name,
  type: wallet.type,
  amount: Number(wallet.amount),
  goal_amount: wallet.goal_amount == null ? null : Number(wallet.goal_amount),
  goal_due_date:
    wallet.goal_due_date == null ? null : formatCalendarDate(wallet.goal_due_date),
  active: wallet.active,
});

const formatCard = (card: {
  id: number;
  name: string;
  type: string;
  amount: number;
  credit_limit: number | null;
  temporary_credit_limit: number | null;
  available_credit: number | null;
  cutoff_day: number | null;
  due_day: number | null;
  active: boolean;
}) => ({
  id: card.id,
  name: card.name,
  type: card.type,
  amount: card.amount,
  credit_limit: card.credit_limit,
  temporary_credit_limit: card.temporary_credit_limit,
  available_credit: card.available_credit,
  cutoff_day: card.cutoff_day,
  due_day: card.due_day,
  active: card.active,
});

export function registerWalletTools(server: McpServer) {
  defineOwnerTool(server, {
    name: 'list_wallets',
    title: 'Listar billeteras',
    description:
      'Billeteras del contexto: efectivo y débito (saldo), tarjetas (deuda en amount, límite, crédito disponible, corte y pago) y metas (objetivo, restante y progreso). Filtra con type.',
    scope: 'read',
    input: {
      type: z
        .enum(['all', 'funding', 'credit', 'goal'])
        .default('all')
        .describe('funding = efectivo/débito; credit = tarjetas; goal = metas; all (default).'),
    },
    run: async (agent, args) => {
      const wallets = await listWalletsByOwner(agent.ownerFilter);
      return wallets
        .filter((wallet) => args.type === 'all' || walletKind(wallet.type) === args.type)
        .map((wallet) => {
          const kind = walletKind(wallet.type);
          return {
            id: wallet.id,
            name: wallet.name,
            type: wallet.type,
            amount: wallet.amount,
            active: wallet.active,
            include_in_liquidity: wallet.include_in_liquidity,
            ...(kind === 'credit'
              ? {
                  credit_limit: wallet.credit_limit,
                  temporary_credit_limit: wallet.temporary_credit_limit,
                  available_credit: getWalletAvailableCredit({
                    amount: wallet.amount,
                    credit_limit: wallet.credit_limit,
                    temporary_credit_limit: wallet.temporary_credit_limit,
                  }),
                  cutoff_day: wallet.cutoff_day,
                  due_day: wallet.due_day,
                }
              : {}),
            ...(kind === 'goal' ? goalFields(wallet) : {}),
          };
        });
    },
  });

  defineOwnerTool(server, {
    name: 'create_wallet',
    title: 'Crear billetera, tarjeta o meta',
    description:
      'Alta de billetera. CASH / DEBIT_CARD: amount es el saldo inicial. CREDIT_CARD / DEPARTMENT_STORE_CARD: amount es la deuda inicial y requiere credit_limit, cutoff_day y due_day. GOAL: amount es lo ya ahorrado y requiere goal_amount y goal_due_date.',
    scope: 'write',
    annotations: { destructiveHint: false, idempotentHint: false },
    input: {
      name: z.string().trim().min(1),
      type: walletTypeSchema.default('CASH'),
      amount: z.number().min(0).default(0),
      include_in_liquidity: z
        .boolean()
        .optional()
        .describe('Cuenta en la proyección de liquidez. Default true; las metas nunca cuentan.'),
      active: z.boolean().default(true),
      credit_limit: z.number().positive().optional(),
      cutoff_day: z.number().int().min(1).max(31).optional(),
      due_day: z.number().int().min(1).max(31).optional(),
      goal_amount: z.number().positive().optional(),
      goal_due_date: dateYmd.optional(),
    },
    run: async (agent, args) => {
      const kind = walletKind(args.type);
      assertFieldsForKind(kind, args);

      if (kind === 'credit') {
        const parsed = createCreditCardSchema.parse({
          name: args.name,
          type: args.type,
          amount: args.amount,
          credit_limit: args.credit_limit ?? null,
          cutoff_day: args.cutoff_day ?? null,
          due_day: args.due_day ?? null,
          active: args.active,
          include_in_liquidity: args.include_in_liquidity ?? true,
          temporary_credit_limit: null,
          goal_amount: null,
          goal_due_date: null,
        });
        const card = await createCreditCardForOwner(agent.ownerType, agent.ownerId, parsed);
        return formatCard(card);
      }

      const parsed = createWalletSchema.parse({
        name: args.name,
        type: args.type,
        amount: args.amount,
        include_in_liquidity: kind === 'goal' ? false : (args.include_in_liquidity ?? true),
        active: args.active,
        cutoff_day: null,
        due_day: null,
        credit_limit: null,
        temporary_credit_limit: null,
        goal_amount: args.goal_amount ?? null,
        goal_due_date: args.goal_due_date ?? null,
      });
      const wallet = await createWalletForOwner(agent.ownerType, agent.ownerId, parsed);
      if (kind === 'goal') return formatGoalWallet(wallet);
      return {
        id: wallet.id,
        name: wallet.name,
        type: wallet.type,
        amount: Number(wallet.amount),
        active: wallet.active,
        include_in_liquidity: wallet.include_in_liquidity,
      };
    },
  });

  defineOwnerTool(server, {
    name: 'update_wallet',
    title: 'Actualizar billetera, tarjeta o meta',
    description:
      'Edita una billetera: name y active (todas), include_in_liquidity (efectivo/débito), límites, corte y pago (tarjetas), goal_amount y goal_due_date (metas). Saldo o deuda: adjust_balance.',
    scope: 'write',
    annotations: { destructiveHint: false, idempotentHint: true },
    input: {
      ...walletRef,
      name: z.string().trim().min(1).optional(),
      active: z.boolean().optional(),
      include_in_liquidity: z.boolean().optional(),
      credit_limit: z.number().positive().optional(),
      temporary_credit_limit: z
        .number()
        .positive()
        .nullable()
        .optional()
        .describe('Límite temporal del emisor; null para quitarlo.'),
      cutoff_day: z.number().int().min(1).max(31).optional(),
      due_day: z.number().int().min(1).max(31).optional(),
      goal_amount: z.number().positive().optional(),
      goal_due_date: dateYmd.nullable().optional(),
    },
    run: async (agent, args) => {
      const wallet = await resolveWalletRef(agent.ownerFilter, args.wallet_id, args.wallet_name);
      const kind = walletKind(wallet.type);
      assertFieldsForKind(kind, args);
      if (kind === 'goal' && args.include_in_liquidity !== undefined) {
        throw new McpToolError('VALIDATION', 'Las metas no cuentan en la liquidez');
      }

      const patch = Object.fromEntries(
        (
          [
            'name',
            'active',
            'include_in_liquidity',
            ...CARD_ONLY_FIELDS,
            ...GOAL_ONLY_FIELDS,
          ] as const
        )
          .filter((field) => args[field] !== undefined)
          .map((field) => [field, args[field]]),
      );

      if (kind === 'credit') {
        const card = await updateCreditCardForOwner(
          wallet.id,
          updateCreditCardSchema.parse(patch),
          agent.ownerFilter,
        );
        return formatCard(card);
      }

      const updated = await updateWalletMetadataForOwner(
        wallet.id,
        updateWalletSchema.parse(patch),
        agent.ownerFilter,
      );
      if (kind === 'goal') return formatGoalWallet(updated);
      return {
        id: updated.id,
        name: updated.name,
        type: updated.type,
        amount: Number(updated.amount),
        active: updated.active,
        include_in_liquidity: updated.include_in_liquidity,
      };
    },
  });

  defineOwnerTool(server, {
    name: 'adjust_balance',
    title: 'Ajustar saldo o deuda',
    description:
      'Fija el número de una billetera al del banco sin crear gasto, ingreso ni pago: en efectivo, débito y metas fija el saldo; en tarjetas fija la deuda (saldo utilizado). Requiere confirm: true.',
    scope: 'write',
    annotations: { destructiveHint: true, idempotentHint: true },
    input: {
      ...walletRef,
      new_balance: z
        .number()
        .min(0)
        .describe('Nuevo saldo (efectivo/débito/meta) o nueva deuda total (tarjeta).'),
      confirm,
    },
    run: async (agent, args) => {
      const wallet = await resolveWalletRef(agent.ownerFilter, args.wallet_id, args.wallet_name);

      if (isCreditWalletType(wallet.type as PaymentMethodType)) {
        const card = await updateCreditCardForOwner(
          wallet.id,
          updateCreditCardSchema.parse({ amount: args.new_balance }),
          agent.ownerFilter,
        );
        return {
          wallet_id: wallet.id,
          wallet_name: wallet.name,
          wallet_type: wallet.type,
          new_balance: card.amount,
          available_credit: card.available_credit,
        };
      }

      if (!isFundingWalletType(wallet.type as PaymentMethodType) && wallet.type !== 'GOAL') {
        throw new McpToolError('VALIDATION', `Tipo de billetera no ajustable: ${wallet.type}`);
      }

      const updated = await updateWalletMetadataForOwner(
        wallet.id,
        { amount: args.new_balance },
        agent.ownerFilter,
      );
      return {
        wallet_id: wallet.id,
        wallet_name: wallet.name,
        wallet_type: wallet.type,
        new_balance: Number(updated.amount),
      };
    },
  });

  defineOwnerTool(server, {
    name: 'list_movements',
    title: 'Movimientos de una billetera',
    description:
      'Movimientos de una billetera en un rango. Efectivo, débito y metas: gastos, ingresos, transferencias y pagos a tarjeta, con totales (default últimos 30 días). Tarjetas: compras, pagos, cuotas programadas y MSI (default el ciclo de corte vigente).',
    scope: 'read',
    input: {
      ...walletRef,
      from: dateYmd.optional(),
      to: dateYmd.optional(),
      last_n_days: z.number().int().min(1).max(366).optional(),
      use_current_cycle: z
        .boolean()
        .default(false)
        .describe('Solo tarjetas: true = ciclo de corte vigente en lugar de from/to.'),
    },
    run: async (agent, args) => {
      const wallet = await resolveWalletRef(agent.ownerFilter, args.wallet_id, args.wallet_name);
      const header = {
        wallet_id: wallet.id,
        wallet_name: wallet.name,
        wallet_type: wallet.type,
      };

      if (isCreditWalletType(wallet.type as PaymentMethodType)) {
        const range =
          args.last_n_days != null
            ? resolveDateRange({ last_n_days: args.last_n_days })
            : { from: args.from, to: args.to };
        return {
          ...header,
          ...(await listCardMovementsForRange(wallet.id, agent.ownerFilter, {
            ...range,
            useCurrentCycle: args.use_current_cycle,
          })),
        };
      }

      if (args.use_current_cycle) {
        throw new McpToolError('VALIDATION', 'use_current_cycle solo aplica a tarjetas');
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

      return {
        ...header,
        balance: await getWalletAmountForOwner(wallet.id, agent.ownerFilter),
        from: range.from,
        to: range.to,
        movements,
        totals,
      };
    },
  });
}
