import prisma from '@/lib/prisma';

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

