import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import { FortnightPeriod } from '@/generated/prisma/client';
import { listHouseMembersByHouse, listUserHouses } from '@/lib/house/house.service';
import { transferUserToHouse } from '@/lib/finance/house-transfer.service';
import { findFortnightByCalendarPeriod } from '@/features/monthly/server/monthly.queries';
import {
  filterAllowedHouses,
  isPersonalContextAllowed,
  assertOwnerOnAllowList,
} from '@/lib/server/agent-allowed-contexts';
import { AgentAuthError } from '@/lib/server/resolve-agent-context';
import { defineOwnerTool, defineUserTool } from '@/lib/mcp/define-tool';
import { McpToolError } from '@/lib/mcp/errors';
import { month, pagination, period, year } from '@/lib/mcp/schemas';
import { out, paginate } from '@/lib/mcp/shapes';
import { resolveWalletRef } from '@/lib/mcp/resolvers';

export function registerHouseTools(server: McpServer) {
  defineUserTool(server, {
    name: 'list_houses',
    title: 'Listar casas del usuario',
    description:
      'Punto de entrada: devuelve el user_id del token, su contexto personal y las casas donde es miembro. Llama esto primero: cada contexto trae el owner_type/owner_id que piden las demás herramientas. include_members agrega los miembros de cada casa.',
    input: {
      include_members: z
        .boolean()
        .default(false)
        .describe('true = incluye los miembros (user_id, name) de cada casa.'),
      ...pagination,
    },
    output: {
      user_id: z.number(),
      scopes: z.array(z.string()),
      personal_context: out.row({ owner_type: z.literal('user'), owner_id: z.number() }).nullable(),
      houses: out.list({
        owner_type: z.literal('house'),
        owner_id: z.number(),
        name: z.string(),
        role: z.string(),
      }),
      ...out.page,
    },
    run: async (user, args) => {
      const allHouses = await listUserHouses(user.userId);
      const houses = filterAllowedHouses(allHouses, user.allowedContexts);
      const personalAllowed = isPersonalContextAllowed(
        user.userId,
        user.allowedContexts,
      );
      const membersByHouse = args.include_members
        ? await listHouseMembersByHouse(houses.map((house) => house.id))
        : null;
      const rows = houses.map((house) => ({
        owner_type: 'house' as const,
        owner_id: house.id,
        name: house.name,
        role: house.role,
        ...(membersByHouse ? { members: membersByHouse.get(house.id) ?? [] } : {}),
      }));
      return {
        user_id: user.userId,
        scopes: user.scopes,
        personal_context: personalAllowed
          ? { owner_type: 'user' as const, owner_id: user.userId }
          : null,
        ...paginate('houses', rows, args),
      };
    },
  });

  defineOwnerTool(server, {
    name: 'transfer_to_house',
    title: 'Aportar a la casa (USER_TO_HOUSE)',
    description:
      'Transfiere dinero de tu cuenta personal a una casa compartida: crea un gasto personal y un ingreso en la casa. owner_type/owner_id puede ser tu contexto personal o la casa destino. No es transfer entre billeteras (usa transfer).',
    scope: 'write',
    annotations: { destructiveHint: false, idempotentHint: false },
    input: {
      house_id: z.number().int().positive().describe('Casa destino (debe estar en tu allow-list).'),
      amount: z.number().positive().describe('Monto en MXN.'),
      user_wallet_id: z.number().int().positive().optional().describe('Billetera personal que paga, de list_wallets.'),
      user_wallet_name: z.string().trim().min(1).optional().describe('Nombre de la billetera personal (alternativa a user_wallet_id).'),
      house_wallet_id: z.number().int().positive().optional().describe('Billetera de la casa que recibe.'),
      house_wallet_name: z.string().trim().min(1).optional().describe('Nombre de la billetera de la casa (alternativa a house_wallet_id).'),
      user_fortnight_id: z.number().int().positive().optional().describe('Quincena personal; alternativa a year + month + period.'),
      house_fortnight_id: z.number().int().positive().optional().describe('Quincena de la casa; alternativa a year + month + period.'),
      year: year.optional(),
      month: month.optional(),
      period: period.optional(),
      note: z.string().trim().max(200).optional().describe('Nota opcional.'),
    },
    run: async (agent, args) => {
      const houseId = args.house_id;
      const userId = agent.userId;

      // The connection's allow-list must cover both sides: USER_TO_HOUSE
      // always posts a personal expense and a house income.
      if (!isPersonalContextAllowed(userId, agent.allowedContexts)) {
        throw new AgentAuthError(
          'Esta conexión no tiene autorizada tu cuenta personal; no puede aportar a la casa',
          403,
        );
      }
      assertOwnerOnAllowList(agent.allowedContexts, 'user', userId);
      assertOwnerOnAllowList(agent.allowedContexts, 'house', houseId);

      let userFortnightId = args.user_fortnight_id;
      let houseFortnightId = args.house_fortnight_id;
      if (
        (userFortnightId == null || houseFortnightId == null) &&
        args.year != null &&
        args.month != null &&
        args.period != null
      ) {
        const parsedPeriod =
          args.period === 'SECOND' ? FortnightPeriod.SECOND : FortnightPeriod.FIRST;
        const [userFortnight, houseFortnight] = await Promise.all([
          findFortnightByCalendarPeriod(
            { user_id: userId, house_id: null },
            args.year,
            args.month,
            parsedPeriod,
          ),
          findFortnightByCalendarPeriod(
            { user_id: null, house_id: houseId },
            args.year,
            args.month,
            parsedPeriod,
          ),
        ]);
        if (!userFortnight) {
          throw new McpToolError(
            'NOT_FOUND',
            'Quincena personal no encontrada para el periodo indicado',
            { hint: 'Usa create_month en tu contexto personal.' },
          );
        }
        if (!houseFortnight) {
          throw new McpToolError(
            'NOT_FOUND',
            'Quincena de la casa no encontrada para el periodo indicado',
            { hint: 'Usa create_month en el contexto de la casa.' },
          );
        }
        userFortnightId = userFortnight.id;
        houseFortnightId = houseFortnight.id;
      }
      if (userFortnightId == null || houseFortnightId == null) {
        throw new McpToolError(
          'VALIDATION',
          'Indica user_fortnight_id y house_fortnight_id, o year + month + period',
        );
      }

      const userWalletId =
        args.user_wallet_id != null || args.user_wallet_name
          ? (
              await resolveWalletRef(
                { user_id: userId, house_id: null },
                args.user_wallet_id,
                args.user_wallet_name,
              )
            ).id
          : null;
      const houseWalletId =
        args.house_wallet_id != null || args.house_wallet_name
          ? (
              await resolveWalletRef(
                { user_id: null, house_id: houseId },
                args.house_wallet_id,
                args.house_wallet_name,
              )
            ).id
          : null;

      const transfer = await transferUserToHouse(agent, {
        userId,
        houseId,
        amount: args.amount,
        userWalletId,
        houseWalletId,
        userFortnightId,
        houseFortnightId,
        note: args.note ?? null,
      });

      return {
        transfer_id: transfer.id,
        amount: Number(transfer.amount),
        user_id: transfer.user_id,
        house_id: transfer.house_id,
        user_expense_id: transfer.user_expense_id,
        house_income_id: transfer.house_income_id,
        created_at: transfer.created_at,
      };
    },
  });
}
