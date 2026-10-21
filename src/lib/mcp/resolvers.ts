import prisma from '@/lib/prisma';
import { addCalendarDays, todayCalendarDate } from '@/lib/calendar-dates';
import { getCalendarFortnightRefForYmd } from '@/lib/fortnight-calendar';
import { resolveOrCreateFortnight } from '@/lib/fortnights';
import { FortnightPeriod } from '@/generated/prisma/client';
import { findFortnightByCalendarPeriod } from '@/features/monthly/server/monthly.queries';
import type { AgentContext } from '@/lib/server/resolve-agent-context';
import type { OwnerFilter } from '@/lib/server/get-owner-context';
import { McpToolError } from '@/lib/mcp/errors';

export type ResolvedDateRange = {
  from: string;
  to: string;
};

export async function resolveWalletRef(
  ownerFilter: OwnerFilter,
  walletId: number | undefined,
  walletName: string | undefined,
): Promise<{ id: number; name: string; type: string }> {
  if (walletId != null) {
    const wallet = await prisma.wallet.findFirst({
      where: { id: walletId, ...ownerFilter },
      select: { id: true, name: true, type: true },
    });
    if (!wallet) {
      throw new McpToolError('NOT_FOUND', 'Billetera no encontrada en este contexto', {
        hint: 'Usa list_wallets para ver los ids válidos.',
      });
    }
    return wallet;
  }

  if (!walletName?.trim()) {
    throw new McpToolError('VALIDATION', 'Indica wallet_id o wallet_name');
  }

  const matches = await prisma.wallet.findMany({
    where: {
      ...ownerFilter,
      name: { equals: walletName.trim(), mode: 'insensitive' },
    },
    select: { id: true, name: true, type: true },
    orderBy: { id: 'asc' },
  });

  if (matches.length === 0) {
    throw new McpToolError(
      'NOT_FOUND',
      `Billetera "${walletName}" no encontrada en este contexto`,
      { hint: 'Usa list_wallets para ver los nombres válidos.' },
    );
  }
  if (matches.length > 1) {
    throw new McpToolError(
      'AMBIGUOUS_REF',
      `Nombre de billetera ambiguo ("${walletName}"). Especifica wallet_id.`,
      { candidates: matches.map((w) => ({ id: w.id, name: w.name })) },
    );
  }

  return matches[0]!;
}

export async function resolveCategoryRef(
  ownerFilter: OwnerFilter,
  categoryId: number | undefined,
  categoryName: string | undefined,
  options?: { required?: boolean },
): Promise<number | null> {
  const required = options?.required ?? false;

  if (categoryId != null) {
    const category = await prisma.category.findFirst({
      where: { id: categoryId, ...ownerFilter },
      select: { id: true },
    });
    if (!category) {
      throw new McpToolError('NOT_FOUND', 'Categoría no encontrada en este contexto', {
        hint: 'Usa list_categories para ver los ids válidos.',
      });
    }
    return category.id;
  }

  if (!categoryName?.trim()) {
    if (required) {
      throw new McpToolError('VALIDATION', 'Indica category_id o category_name');
    }
    return null;
  }

  const category = await prisma.category.findFirst({
    where: {
      ...ownerFilter,
      name: { equals: categoryName.trim(), mode: 'insensitive' },
    },
    select: { id: true },
  });
  if (category) return category.id;

  const available = await prisma.category.findMany({
    where: { ...ownerFilter, active: true },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
    take: 20,
  });
  throw new McpToolError('NOT_FOUND', `Categoría "${categoryName}" no encontrada.`, {
    hint:
      available.length >= 20
        ? 'Candidatas: las primeras 20 activas; usa list_categories para el resto.'
        : 'Candidatas: categorías activas del contexto.',
    candidates: available,
  });
}

export function resolveDateRange(input: {
  from?: string;
  to?: string;
  last_n_days?: number;
  last_n_months?: number;
}): ResolvedDateRange {
  const today = todayCalendarDate();

  if (input.from && input.to) {
    return { from: input.from, to: input.to };
  }

  if (input.last_n_days != null) {
    const days = Math.max(1, Math.min(input.last_n_days, 366));
    return {
      from: addCalendarDays(today, -(days - 1)),
      to: today,
    };
  }

  if (input.last_n_months != null) {
    const months = Math.max(1, Math.min(input.last_n_months, 24));
    const [year, month] = today.split('-').map(Number);
    const fromMonth = month - months;
    const fromYear = year + Math.floor(fromMonth / 12);
    const normalizedMonth = ((fromMonth % 12) + 12) % 12 + 1;
    const from = `${fromYear}-${String(normalizedMonth).padStart(2, '0')}-01`;
    return { from, to: today };
  }

  if (input.from && !input.to) {
    return { from: input.from, to: today };
  }

  if (!input.from && input.to) {
    return { from: addCalendarDays(input.to, -29), to: input.to };
  }

  return { from: addCalendarDays(today, -29), to: today };
}

export async function resolveFortnightIdForDate(
  agent: AgentContext,
  ymd: string,
): Promise<number> {
  const { year, month, period } = getCalendarFortnightRefForYmd(ymd);
  const fortnight = await resolveOrCreateFortnight({
    ownerType: agent.ownerType,
    ownerId: agent.ownerId,
    year,
    month,
    period,
  });
  return fortnight.id;
}

/**
 * Fortnight from `fortnight_id` or `year` + `month` + `period` (it must
 * exist; `create_month` creates them).
 */
export async function resolveFortnightRef(
  agent: Pick<AgentContext, 'ownerFilter'>,
  input: {
    fortnight_id?: number;
    year?: number;
    month?: number;
    period?: 'FIRST' | 'SECOND';
  },
): Promise<number> {
  if (input.fortnight_id != null) return input.fortnight_id;
  if (input.year == null || input.month == null || input.period == null) {
    throw new McpToolError('VALIDATION', 'Indica fortnight_id o year + month + period');
  }
  const fortnight = await findFortnightByCalendarPeriod(
    agent.ownerFilter,
    input.year,
    input.month,
    input.period === 'SECOND' ? FortnightPeriod.SECOND : FortnightPeriod.FIRST,
  );
  if (!fortnight) {
    throw new McpToolError('NOT_FOUND', 'Quincena no encontrada', {
      hint: 'Usa create_month para crear las quincenas del mes.',
    });
  }
  return fortnight.id;
}
