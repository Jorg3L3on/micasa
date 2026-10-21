import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import { FortnightPeriod } from '@/generated/prisma/client';
import prisma from '@/lib/prisma';
import { listUserHouses } from '@/lib/house/house.service';
import { createUserToHouseTransfer } from '@/lib/finance/transfer.service';
import { findFortnightByCalendarPeriod } from '@/features/monthly/server/monthly.queries';
import {
  filterAllowedHouses,
  isPersonalContextAllowed,
  assertOwnerOnAllowList,
} from '@/lib/server/agent-allowed-contexts';
import { AgentAuthError } from '@/lib/server/resolve-agent-context';
import { defineOwnerTool, defineUserTool } from '@/lib/mcp/define-tool';
import { month, period, year } from '@/lib/mcp/schemas';
import { resolveWalletRef } from '@/lib/mcp/resolvers';

export function registerHouseTools(server: McpServer) {
  defineUserTool(server, {
    name: 'list_houses',
    title: 'Listar casas del usuario',
    description:
      'Punto de entrada: devuelve el userId del token, su contexto personal y las casas donde es miembro. Llama esto primero: sus ownerType/ownerId son los owner_type/owner_id de las demás herramientas. include_members agrega los miembros de cada casa.',
    input: {
      include_members: z
        .boolean()
        .default(false)
        .describe('true = incluye los miembros (user_id, name) de cada casa.'),
    },
    run: async (user, args) => {
      const allHouses = await listUserHouses(user.userId);
      const houses = filterAllowedHouses(allHouses, user.allowedContexts);
      const personalAllowed = isPersonalContextAllowed(
        user.userId,
        user.allowedContexts,
      );
      const memberships = args.include_members
        ? await prisma.houseMember.findMany({
            where: { house_id: { in: houses.map((house) => house.id) } },
            include: { user: { select: { id: true, name: true } } },
            orderBy: { user: { name: 'asc' } },
          })
        : [];
      return {
        userId: user.userId,
        scopes: user.scopes,
        personalContext: personalAllowed
          ? { ownerType: 'user', ownerId: user.userId }
          : null,
        houses: houses.map((house) => ({
          ownerType: 'house',
          ownerId: house.id,
          name: house.name,
          role: house.role,
          ...(args.include_members
            ? {
                members: memberships
                  .filter((membership) => membership.house_id === house.id)
                  .map((membership) => ({
                    user_id: membership.user.id,
                    name: membership.user.name,
                  })),
              }
            : {}),
        })),
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
      amount: z.number().positive(),
      user_wallet_id: z.number().int().positive().optional(),
      user_wallet_name: z.string().trim().min(1).optional(),
      house_wallet_id: z.number().int().positive().optional(),
      house_wallet_name: z.string().trim().min(1).optional(),
      user_fortnight_id: z.number().int().positive().optional(),
      house_fortnight_id: z.number().int().positive().optional(),
      year: year.optional(),
      month: month.optional(),
      period: period.optional(),
      note: z.string().trim().max(200).optional(),
    },
    run: async (agent, args) => {
      const houseId = args.house_id;
      const userId = agent.userId;

      // Same rules as POST /api/transfers: only the token user may fund from personal.
      if (agent.ownerType === 'user' && agent.ownerId !== userId) {
        throw new AgentAuthError('Solo puedes transferir desde tu cuenta personal', 403);
      }
      if (agent.ownerType === 'house' && agent.ownerId !== houseId) {
        throw new Error('El contexto activo debe coincidir con house_id');
      }

      // USER_TO_HOUSE always posts a personal expense; require personal context on allow-list.
      if (!isPersonalContextAllowed(userId, agent.allowedContexts)) {
        throw new AgentAuthError(
          'Esta conexión no tiene autorizada tu cuenta personal; no puede aportar a la casa',
          403,
        );
      }
      assertOwnerOnAllowList(agent.allowedContexts, 'user', userId);
      assertOwnerOnAllowList(agent.allowedContexts, 'house', houseId);

      const membership = await prisma.houseMember.findFirst({
        where: { house_id: houseId, user_id: userId },
        select: { id: true },
      });
      if (!membership) {
        throw new AgentAuthError('No eres miembro de esta casa', 403);
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, active: true },
      });
      if (!user?.active) {
        throw new Error('Usuario no encontrado o inactivo');
      }

      const house = await prisma.house.findUnique({
        where: { id: houseId },
        select: { id: true },
      });
      if (!house) {
        throw new Error('Casa no encontrada');
      }

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
          throw new Error('Quincena personal no encontrada para el periodo indicado');
        }
        if (!houseFortnight) {
          throw new Error('Quincena de la casa no encontrada para el periodo indicado');
        }
        userFortnightId = userFortnight.id;
        houseFortnightId = houseFortnight.id;
      }

      if (userFortnightId == null || houseFortnightId == null) {
        throw new Error(
          'Indica user_fortnight_id y house_fortnight_id, o year + month + period',
        );
      }

      const userFortnight = await prisma.fortnight.findUnique({
        where: { id: userFortnightId },
        select: { id: true, user_id: true, house_id: true },
      });
      if (
        !userFortnight ||
        userFortnight.user_id !== userId ||
        userFortnight.house_id !== null
      ) {
        throw new Error('Quincena personal inválida para esta transferencia');
      }

      const houseFortnight = await prisma.fortnight.findUnique({
        where: { id: houseFortnightId },
        select: { id: true, user_id: true, house_id: true },
      });
      if (
        !houseFortnight ||
        houseFortnight.house_id !== houseId ||
        houseFortnight.user_id !== null
      ) {
        throw new Error('Quincena de la casa inválida para esta transferencia');
      }

      let userWalletId: number | null = null;
      if (args.user_wallet_id != null || args.user_wallet_name) {
        const wallet = await resolveWalletRef(
          { user_id: userId, house_id: null },
          args.user_wallet_id,
          args.user_wallet_name,
        );
        const ownedWallet = await prisma.wallet.findUnique({
          where: { id: wallet.id },
          select: { id: true, user_id: true, house_id: true },
        });
        if (
          !ownedWallet ||
          ownedWallet.user_id !== userId ||
          ownedWallet.house_id !== null
        ) {
          throw new Error('Billetera personal inválida para esta transferencia');
        }
        userWalletId = ownedWallet.id;
      }

      let houseWalletId: number | null = null;
      if (args.house_wallet_id != null || args.house_wallet_name) {
        const wallet = await resolveWalletRef(
          { user_id: null, house_id: houseId },
          args.house_wallet_id,
          args.house_wallet_name,
        );
        const ownedWallet = await prisma.wallet.findUnique({
          where: { id: wallet.id },
          select: { id: true, user_id: true, house_id: true },
        });
        if (
          !ownedWallet ||
          ownedWallet.house_id !== houseId ||
          ownedWallet.user_id !== null
        ) {
          throw new Error('Billetera de la casa inválida para esta transferencia');
        }
        houseWalletId = ownedWallet.id;
      }

      const transfer = await createUserToHouseTransfer({
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
        created_at: transfer.created_at.toISOString(),
      };
    },
  });
}
