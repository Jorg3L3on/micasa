import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';

const createMonthSchema = z.object({
  year: z.number().int().min(2010).max(2030),
  month: z.number().int().min(1).max(12),
});

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

const DEFAULT_AMOUNT = 0.01;
const INCOME_TEMPLATE_DEFAULT_AMOUNT = 0.01;

async function createIncomeFromTemplatesForFortnight(
  fortnightId: number,
  period: 'FIRST' | 'SECOND',
): Promise<{ count: number; names: string[] }> {
  const fortnight = await prisma.fortnight.findUnique({
    where: { id: fortnightId },
    select: { start_date: true },
  });
  if (!fortnight) return { count: 0, names: [] };

  const templates = await prisma.incomeTemplate.findMany({
    where:
      period === 'FIRST'
        ? { active: true, applies_first_fortnight: true }
        : { active: true, applies_second_fortnight: true },
    select: {
      id: true,
      name: true,
      suggested_amount: true,
      source: true,
      user_id: true,
    },
  });

  const defaultUser = await prisma.user.findFirst({
    where: { active: true },
    select: { id: true },
  });
  const defaultHouse = await prisma.house.findFirst({
    select: { id: true },
  });

  const created: string[] = [];

  for (const template of templates) {
    const existing = await prisma.income.findFirst({
      where: {
        fortnight_id: fortnightId,
        income_template_id: template.id,
      },
    });

    if (existing) continue;

    const userId = template.user_id ?? defaultUser?.id;
    const houseId = defaultHouse?.id;
    if (userId == null) continue;

    const amount =
      template.suggested_amount != null && Number(template.suggested_amount) > 0
        ? Number(template.suggested_amount)
        : INCOME_TEMPLATE_DEFAULT_AMOUNT;

    await prisma.income.create({
      data: {
        fortnight_id: fortnightId,
        user_id: userId,
        house_id: houseId ?? undefined,
        amount: String(amount),
        source: template.source ?? undefined,
        received_at: fortnight.start_date,
        income_template_id: template.id,
      },
    });

    created.push(template.name);
  }

  return { count: created.length, names: created };
}

async function createExpensesFromTemplatesForFortnight(
  fortnightId: number,
  period: 'FIRST' | 'SECOND',
): Promise<{ count: number; names: string[] }> {
  const appliesField =
    period === 'FIRST' ? 'applies_first_fortnight' : 'applies_second_fortnight';

  const templates = await prisma.expenseTemplate.findMany({
    where: {
      active: true,
      [appliesField]: true,
      category_id: { not: null },
    },
    select: {
      id: true,
      name: true,
      suggested_amount: true,
      category_id: true,
      wallet_id: true,
      due_day: true,
    },
  });

  const created: string[] = [];

  for (const template of templates) {
    const categoryId = template.category_id;
    if (categoryId === null) continue;

    const existing = await prisma.expense.findFirst({
      where: {
        fortnight_id: fortnightId,
        expense_template_id: template.id,
      },
    });

    if (existing) continue;

    const amount =
      template.suggested_amount != null && Number(template.suggested_amount) > 0
        ? Number(template.suggested_amount)
        : DEFAULT_AMOUNT;

    await prisma.expense.create({
      data: {
        fortnight_id: fortnightId,
        category_id: categoryId,
        description: template.name,
        amount: String(amount),
        wallet_id: template.wallet_id ?? undefined,
        expense_template_id: template.id,
        due_day: template.due_day ?? undefined,
        is_paid: false,
      },
    });

    created.push(template.name);
  }

  return { count: created.length, names: created };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { year, month } = createMonthSchema.parse(body);

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    if (year !== currentYear) {
      return NextResponse.json(
        { error: 'Solo se pueden crear meses del año en curso' },
        { status: 400 },
      );
    }

    if (month < currentMonth) {
      return NextResponse.json(
        {
          error:
            'No se pueden crear meses ya pasados. Solo el mes actual o futuros.',
        },
        { status: 400 },
      );
    }

    const monthName = MONTH_NAMES[month - 1] ?? '';
    const lastDayOfMonth = new Date(year, month, 0).getDate();

    const existingFirst = await prisma.fortnight.findFirst({
      where: { year, month, period: 'FIRST' },
    });
    const existingSecond = await prisma.fortnight.findFirst({
      where: { year, month, period: 'SECOND' },
    });

    if (existingFirst && existingSecond) {
      return NextResponse.json(
        { error: 'Este mes ya tiene las dos quincenas creadas' },
        { status: 409 },
      );
    }

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
      const first = await prisma.fortnight.create({
        data: {
          label: `Primera quincena - ${monthName} ${year}`,
          start_date: new Date(year, month - 1, 1),
          end_date: new Date(year, month - 1, 15),
          month,
          year,
          period: 'FIRST',
          closed: false,
        },
      });
      created.push({
        id: first.id,
        label: first.label,
        period: 'FIRST',
      });
      expensesByPeriod.FIRST = await createExpensesFromTemplatesForFortnight(
        first.id,
        'FIRST',
      );
      incomeTemplatesByPeriod.FIRST =
        await createIncomeFromTemplatesForFortnight(first.id, 'FIRST');
    }

    if (!existingSecond) {
      const second = await prisma.fortnight.create({
        data: {
          label: `Segunda quincena - ${monthName} ${year}`,
          start_date: new Date(year, month - 1, 16),
          end_date: new Date(year, month - 1, lastDayOfMonth),
          month,
          year,
          period: 'SECOND',
          closed: false,
        },
      });
      created.push({
        id: second.id,
        label: second.label,
        period: 'SECOND',
      });
      expensesByPeriod.SECOND = await createExpensesFromTemplatesForFortnight(
        second.id,
        'SECOND',
      );
      incomeTemplatesByPeriod.SECOND =
        await createIncomeFromTemplatesForFortnight(second.id, 'SECOND');
    }

    // When one fortnight already existed, we didn't run template income for it.
    // Run it now so templates with "applies to both" get income in both fortnights.
    if (existingFirst) {
      incomeTemplatesByPeriod.FIRST =
        await createIncomeFromTemplatesForFortnight(existingFirst.id, 'FIRST');
    }
    if (existingSecond) {
      incomeTemplatesByPeriod.SECOND =
        await createIncomeFromTemplatesForFortnight(
          existingSecond.id,
          'SECOND',
        );
    }

    const totalExpenses =
      expensesByPeriod.FIRST.count + expensesByPeriod.SECOND.count;
    const totalIncomeFromTemplates =
      incomeTemplatesByPeriod.FIRST.count +
      incomeTemplatesByPeriod.SECOND.count;

    return NextResponse.json(
      {
        message:
          created.length === 2
            ? 'Mes creado: ambas quincenas creadas'
            : `Quincena(s) creada(s): ${created
                .map((c) => c.label)
                .join(', ')}`,
        created,
        year,
        month,
        expensesCreated: {
          firstFortnight: expensesByPeriod.FIRST,
          secondFortnight: expensesByPeriod.SECOND,
          total: totalExpenses,
        },
        incomeCreated: {
          firstFortnight: incomeTemplatesByPeriod.FIRST.count,
          secondFortnight: incomeTemplatesByPeriod.SECOND.count,
          total: totalIncomeFromTemplates,
        },
        incomeTemplatesCreated: {
          firstFortnight: incomeTemplatesByPeriod.FIRST,
          secondFortnight: incomeTemplatesByPeriod.SECOND,
          total: totalIncomeFromTemplates,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Año y mes son requeridos (año 2010-2030, mes 1-12)',
          details: error.issues,
        },
        { status: 400 },
      );
    }

    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'P2002'
    ) {
      return NextResponse.json(
        { error: 'Una quincena con esta configuración ya existe' },
        { status: 409 },
      );
    }

    console.error('Error al crear el mes:', error);
    return NextResponse.json(
      { error: 'Error al crear las quincenas del mes' },
      { status: 500 },
    );
  }
}
