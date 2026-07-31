import type { Prisma } from '@/generated/prisma/client';
import prisma from '@/lib/prisma';

export type AdminUserListItem = {
  id: number;
  name: string;
  email: string;
  active: boolean;
  onboarding_completed: boolean;
  is_admin: boolean;
  created_at: string;
};

export type AdminRecentEvent = {
  id: string;
  at: string;
  type: string;
  label: string;
  amount: number | null;
  summary: string | null;
};

const decimalToNumber = (value: { toNumber?: () => number } | number | string | null | undefined): number | null => {
  if (value == null) return null;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  if (typeof value.toNumber === 'function') return value.toNumber();
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

export const searchAdminUsers = async (options: {
  q?: string;
  take?: number;
}): Promise<AdminUserListItem[]> => {
  const take = Math.min(Math.max(options.take ?? 50, 1), 100);
  const q = options.q?.trim();

  const where: Prisma.UserWhereInput = q
    ? {
        OR: [
          { email: { contains: q, mode: 'insensitive' } },
          { name: { contains: q, mode: 'insensitive' } },
        ],
      }
    : {};

  const rows = await prisma.user.findMany({
    where,
    orderBy: { created_at: 'desc' },
    take,
    select: {
      id: true,
      name: true,
      email: true,
      active: true,
      onboarding_completed: true,
      is_admin: true,
      created_at: true,
    },
  });

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    active: row.active,
    onboarding_completed: row.onboarding_completed,
    is_admin: row.is_admin,
    created_at: row.created_at.toISOString(),
  }));
};

export const getAdminUserDetail = async (userId: number) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      active: true,
      onboarding_completed: true,
      is_admin: true,
      created_at: true,
      memberships: {
        select: {
          role: true,
          house: { select: { id: true, name: true } },
        },
        orderBy: { house_id: 'asc' },
      },
      wallets: {
        orderBy: { created_at: 'desc' },
        select: {
          id: true,
          name: true,
          type: true,
          amount: true,
          active: true,
          credit_limit: true,
        },
      },
      fortnights: {
        orderBy: [{ year: 'desc' }, { month: 'desc' }, { period: 'desc' }],
        take: 24,
        select: {
          id: true,
          label: true,
          year: true,
          month: true,
          period: true,
          closed: true,
          start_date: true,
          end_date: true,
        },
      },
      loans: {
        orderBy: { created_at: 'desc' },
        select: {
          id: true,
          name: true,
          lender: true,
          status: true,
          type: true,
          principal_amount: true,
          payment_amount: true,
          payment_count: true,
        },
      },
    },
  });

  if (!user) return null;

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    active: user.active,
    onboarding_completed: user.onboarding_completed,
    is_admin: user.is_admin,
    created_at: user.created_at.toISOString(),
    memberships: user.memberships.map((m) => ({
      house_id: m.house.id,
      house_name: m.house.name,
      role: m.role,
    })),
    wallets: user.wallets.map((w) => ({
      id: w.id,
      name: w.name,
      type: w.type,
      amount: decimalToNumber(w.amount) ?? 0,
      active: w.active,
      credit_limit: decimalToNumber(w.credit_limit),
    })),
    fortnights: user.fortnights.map((f) => ({
      id: f.id,
      label: f.label,
      year: f.year,
      month: f.month,
      period: f.period,
      closed: f.closed,
      start_date: f.start_date.toISOString(),
      end_date: f.end_date.toISOString(),
    })),
    loans: user.loans.map((l) => ({
      id: l.id,
      name: l.name,
      lender: l.lender,
      status: l.status,
      type: l.type,
      principal_amount: decimalToNumber(l.principal_amount) ?? 0,
      payment_amount: decimalToNumber(l.payment_amount) ?? 0,
      payment_count: l.payment_count,
    })),
  };
};

type ActivityCandidate = {
  sortAt: Date;
  event: AdminRecentEvent;
};

/**
 * Best-effort recent activity: finance-log is stdout-only, so reconstruct from
 * persisted domain rows owned by (or linked to) the user.
 */
export const buildAdminRecentActivity = async (
  userId: number,
  limit = 50,
): Promise<AdminRecentEvent[]> => {
  const take = Math.min(Math.max(limit, 1), 50);

  const [expenses, incomes, cardPayments, transfers, loanPayments] =
    await Promise.all([
      prisma.expense.findMany({
        where: { user_id: userId },
        orderBy: { created_at: 'desc' },
        take,
        select: {
          id: true,
          description: true,
          amount: true,
          is_paid: true,
          created_at: true,
        },
      }),
      prisma.income.findMany({
        where: { user_id: userId },
        orderBy: { created_at: 'desc' },
        take,
        select: {
          id: true,
          source: true,
          amount: true,
          created_at: true,
          received_at: true,
        },
      }),
      prisma.creditCardPayment.findMany({
        where: { user_id: userId },
        orderBy: { created_at: 'desc' },
        take,
        select: {
          id: true,
          amount: true,
          note: true,
          paid_at: true,
          created_at: true,
        },
      }),
      prisma.transfer.findMany({
        where: { user_id: userId },
        orderBy: { created_at: 'desc' },
        take,
        select: {
          id: true,
          amount: true,
          note: true,
          type: true,
          created_at: true,
          house: { select: { name: true } },
        },
      }),
      prisma.loanPayment.findMany({
        where: { loan: { user_id: userId } },
        orderBy: { updated_at: 'desc' },
        take,
        select: {
          id: true,
          amount: true,
          status: true,
          sequence: true,
          due_date: true,
          paid_at: true,
          updated_at: true,
          created_at: true,
          loan: { select: { name: true } },
        },
      }),
    ]);

  const candidates: ActivityCandidate[] = [];

  for (const row of expenses) {
    candidates.push({
      sortAt: row.created_at,
      event: {
        id: `expense:${row.id}`,
        at: row.created_at.toISOString(),
        type: 'expense',
        label: row.is_paid ? 'Gasto pagado' : 'Gasto',
        amount: decimalToNumber(row.amount),
        summary: row.description,
      },
    });
  }

  for (const row of incomes) {
    candidates.push({
      sortAt: row.created_at,
      event: {
        id: `income:${row.id}`,
        at: row.created_at.toISOString(),
        type: 'income',
        label: 'Ingreso',
        amount: decimalToNumber(row.amount),
        summary: row.source ?? null,
      },
    });
  }

  for (const row of cardPayments) {
    candidates.push({
      sortAt: row.created_at,
      event: {
        id: `credit_card_payment:${row.id}`,
        at: row.created_at.toISOString(),
        type: 'credit_card_payment',
        label: 'Pago de tarjeta',
        amount: decimalToNumber(row.amount),
        summary: row.note ?? null,
      },
    });
  }

  for (const row of transfers) {
    candidates.push({
      sortAt: row.created_at,
      event: {
        id: `transfer:${row.id}`,
        at: row.created_at.toISOString(),
        type: 'transfer',
        label: 'Transferencia',
        amount: decimalToNumber(row.amount),
        summary: row.note ?? row.house.name,
      },
    });
  }

  for (const row of loanPayments) {
    const sortAt = row.paid_at ?? row.updated_at ?? row.created_at;
    candidates.push({
      sortAt,
      event: {
        id: `loan_payment:${row.id}`,
        at: sortAt.toISOString(),
        type: 'loan_payment',
        label: `Préstamo · cuota ${row.sequence}`,
        amount: decimalToNumber(row.amount),
        summary: `${row.loan.name} · ${row.status}`,
      },
    });
  }

  return candidates
    .sort((a, b) => b.sortAt.getTime() - a.sortAt.getTime())
    .slice(0, take)
    .map((c) => c.event);
};
