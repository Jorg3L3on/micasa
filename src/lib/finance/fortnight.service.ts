import prisma from '@/lib/prisma';
import {
  expandExpenseTemplatesForFortnight,
  expandIncomeTemplatesForFortnight,
} from '@/lib/finance/template.service';
import { generatePeriodsForMonth } from '@/lib/finance/budget-period.service';
import { resolveOrCreateFortnight } from '@/lib/fortnights';
import type { OwnerFilter } from '@/lib/server/get-owner-context';
import type { FortnightPeriod } from '@/generated/prisma/client';

/** List fortnights for the given owner (user_id or house_id). Required for owner-scoped catalog. */
export async function listFortnightsForCatalog(ownerFilter: OwnerFilter) {
  const fortnights = await prisma.fortnight.findMany({
    where: ownerFilter,
    orderBy: [{ year: 'desc' }, { month: 'desc' }, { period: 'desc' }],
    select: {
      id: true,
      label: true,
      start_date: true,
      end_date: true,
      closed: true,
      year: true,
      month: true,
      period: true,
    },
  });

  return fortnights.map((f) => ({
    id: f.id,
    name: f.label,
    startDay: new Date(f.start_date).getDate(),
    endDay: new Date(f.end_date).getDate(),
    active: !f.closed,
    year: f.year,
    month: f.month,
    period: f.period,
  }));
}

const MONTH_NAMES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

export type CreateMonthFortnightsInput = {
  ownerType: 'user' | 'house';
  ownerId: number;
  ownerFilter: OwnerFilter;
  year: number;
  month: number;
};

/** Same logic as POST /api/fortnights/create-month. */
export async function createMonthFortnightsForOwner(
  input: CreateMonthFortnightsInput,
) {
  const { ownerType, ownerId, ownerFilter, year, month } = input;

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  if (year !== currentYear) {
    throw new Error('Solo se pueden crear meses del año en curso');
  }

  if (month < currentMonth) {
    throw new Error(
      'No se pueden crear meses ya pasados. Solo el mes actual o futuros.',
    );
  }

  const monthName = MONTH_NAMES[month - 1] ?? '';

  const existingFirst = await prisma.fortnight.findFirst({
    where: { ...ownerFilter, year, month, period: 'FIRST' },
  });
  const existingSecond = await prisma.fortnight.findFirst({
    where: { ...ownerFilter, year, month, period: 'SECOND' },
  });

  const created: { id: number; label: string; period: string }[] = [];
  const expensesByPeriod: {
    FIRST: { count: number; names: string[] };
    SECOND: { count: number; names: string[] };
  } = { FIRST: { count: 0, names: [] }, SECOND: { count: 0, names: [] } };
  const incomeTemplatesByPeriod: {
    FIRST: { count: number; names: string[] };
    SECOND: { count: number; names: string[] };
  } = {
    FIRST: { count: 0, names: [] },
    SECOND: { count: 0, names: [] },
  };

  if (!existingFirst) {
    const first = await resolveOrCreateFortnight({
      ownerType,
      ownerId,
      year,
      month,
      period: 'FIRST',
      label: `Primera quincena - ${monthName} ${year}`,
    });
    created.push({ id: first.id, label: first.label, period: 'FIRST' });
    expensesByPeriod.FIRST = await expandExpenseTemplatesForFortnight(
      first.id,
      'FIRST',
    );
    incomeTemplatesByPeriod.FIRST = await expandIncomeTemplatesForFortnight(
      first.id,
      'FIRST',
    );
  }

  if (!existingSecond) {
    const second = await resolveOrCreateFortnight({
      ownerType,
      ownerId,
      year,
      month,
      period: 'SECOND',
      label: `Segunda quincena - ${monthName} ${year}`,
    });
    created.push({ id: second.id, label: second.label, period: 'SECOND' });
    expensesByPeriod.SECOND = await expandExpenseTemplatesForFortnight(
      second.id,
      'SECOND',
    );
    incomeTemplatesByPeriod.SECOND = await expandIncomeTemplatesForFortnight(
      second.id,
      'SECOND',
    );
  }

  if (existingFirst) {
    expensesByPeriod.FIRST = await expandExpenseTemplatesForFortnight(
      existingFirst.id,
      'FIRST',
    );
    incomeTemplatesByPeriod.FIRST = await expandIncomeTemplatesForFortnight(
      existingFirst.id,
      'FIRST',
    );
  }
  if (existingSecond) {
    expensesByPeriod.SECOND = await expandExpenseTemplatesForFortnight(
      existingSecond.id,
      'SECOND',
    );
    incomeTemplatesByPeriod.SECOND = await expandIncomeTemplatesForFortnight(
      existingSecond.id,
      'SECOND',
    );
  }

  const { total: budgetPeriodsCreated } = await generatePeriodsForMonth(
    year,
    month,
    ownerFilter,
  );

  const totalExpenses =
    expensesByPeriod.FIRST.count + expensesByPeriod.SECOND.count;
  const totalIncomeFromTemplates =
    incomeTemplatesByPeriod.FIRST.count +
    incomeTemplatesByPeriod.SECOND.count;

  return {
    message:
      created.length === 2
        ? 'Mes creado: ambas quincenas creadas'
        : created.length === 1
          ? `Quincena(s) creada(s): ${created.map((c) => c.label).join(', ')}`
          : 'Quincenas existentes: se sincronizaron plantillas de gastos e ingresos',
    created,
    year,
    month,
    expenses_created: {
      first_fortnight: expensesByPeriod.FIRST,
      second_fortnight: expensesByPeriod.SECOND,
      total: totalExpenses,
    },
    income_created: {
      first_fortnight: incomeTemplatesByPeriod.FIRST.count,
      second_fortnight: incomeTemplatesByPeriod.SECOND.count,
      total: totalIncomeFromTemplates,
    },
    budget_periods_created: budgetPeriodsCreated,
  };
}

/** Same logic as POST /api/fortnights/[id]/regenerate-from-templates. */
export async function regenerateFortnightFromTemplatesForOwner(
  fortnightId: number,
  ownerFilter: OwnerFilter,
) {
  const fortnight = await prisma.fortnight.findFirst({
    where: { id: fortnightId, ...ownerFilter },
    select: { id: true, period: true },
  });

  if (!fortnight) {
    const error = new Error('Quincena no encontrada');
    (error as { code?: string }).code = 'FORTNIGHT_NOT_FOUND';
    throw error;
  }

  await prisma.$transaction(async (tx) => {
    await tx.expense.deleteMany({
      where: {
        fortnight_id: fortnightId,
        expense_template_id: { not: null },
      },
    });

    await tx.income.deleteMany({
      where: {
        fortnight_id: fortnightId,
        income_template_id: { not: null },
      },
    });
  });

  const expenseResult = await expandExpenseTemplatesForFortnight(
    fortnightId,
    fortnight.period as FortnightPeriod,
  );

  const incomeResult = await expandIncomeTemplatesForFortnight(
    fortnightId,
    fortnight.period as FortnightPeriod,
  );

  return {
    message: 'Quincena regenerada desde plantillas',
    fortnight_id: fortnightId,
    expenses_created: expenseResult,
    income_created: incomeResult,
  };
}
