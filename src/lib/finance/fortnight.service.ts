import prisma from '@/lib/prisma';
import { getFortnightPeriodForDay } from '@/lib/fortnights';
import type { CreateFortnightInput, UpdateFortnightInput } from '@/schemas/fortnight.schema';

export async function listFortnightsForCatalog() {
  const fortnights = await prisma.fortnight.findMany({
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

export async function createOwnedFortnight(input: CreateFortnightInput) {
  const { name, startDay, endDay, active, year, month, period } = input;

  const defaultUser = await prisma.user.findFirst({
    where: { active: true },
    select: { id: true },
  });

  if (!defaultUser) {
    const error = new Error('No active user found to own fortnight');
    (error as any).code = 'NO_DEFAULT_USER';
    throw error;
  }

  const startDate = new Date(year, month - 1, startDay);
  const endDate = new Date(year, month - 1, endDay);

  const fortnight = await prisma.fortnight.create({
    data: {
      label: name,
      start_date: startDate,
      end_date: endDate,
      month,
      year,
      period: period as 'FIRST' | 'SECOND',
      closed: !active,
      user_id: defaultUser.id,
      house_id: null,
    },
  });

  return {
    id: fortnight.id,
    name: fortnight.label,
    startDay: new Date(fortnight.start_date).getDate(),
    endDay: new Date(fortnight.end_date).getDate(),
    active: !fortnight.closed,
  };
}

export async function updateFortnightCatalogEntry(
  id: number,
  input: UpdateFortnightInput,
) {
  const updateData: any = {};
  if (input.name !== undefined) {
    updateData.label = input.name;
  }
  if (input.active !== undefined) {
    updateData.closed = !input.active;
  }
  if (input.startDay !== undefined || input.endDay !== undefined) {
    const existing = await prisma.fortnight.findUnique({ where: { id } });
    if (existing) {
      const startDay =
        input.startDay ?? new Date(existing.start_date).getDate();
      const endDay = input.endDay ?? new Date(existing.end_date).getDate();
      updateData.start_date = new Date(
        existing.year,
        existing.month - 1,
        startDay,
      );
      updateData.end_date = new Date(
        existing.year,
        existing.month - 1,
        endDay,
      );
    }
  }

  const fortnight = await prisma.fortnight.update({
    where: { id },
    data: updateData,
  });

  return {
    id: fortnight.id,
    name: fortnight.label,
    startDay: new Date(fortnight.start_date).getDate(),
    endDay: new Date(fortnight.end_date).getDate(),
    active: !fortnight.closed,
  };
}

export async function deleteFortnightIfUnused(id: number) {
  const relatedExpenses = await prisma.expense.findFirst({
    where: { fortnight_id: id },
  });

  if (relatedExpenses) {
    const error = new Error(
      'La quincena está en uso y no puede ser eliminada',
    );
    (error as any).code = 'FORTNIGHT_IN_USE';
    throw error;
  }

  await prisma.fortnight.delete({ where: { id } });
}

