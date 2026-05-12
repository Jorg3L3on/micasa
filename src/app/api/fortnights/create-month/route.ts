import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { getOwnerContext } from '@/lib/server/get-owner-context';
import {
  expandExpenseTemplatesForFortnight,
  expandIncomeTemplatesForFortnight,
} from '@/lib/finance/template.service';
import { resolveOrCreateFortnight } from '@/lib/fortnights';
import { generatePeriodsForMonth } from '@/lib/finance/budget-period.service';

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

export async function POST(request: NextRequest) {
  try {
    const context = await getOwnerContext(request);
    if ('error' in context) return context.error;
    const { ownerType, ownerId, ownerFilter } = context;

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

    const existingFirst = await prisma.fortnight.findFirst({
      where: {
        ...ownerFilter,
        year,
        month,
        period: 'FIRST',
      },
    });
    const existingSecond = await prisma.fortnight.findFirst({
      where: {
        ...ownerFilter,
        year,
        month,
        period: 'SECOND',
      },
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
      created.push({
        id: first.id,
        label: first.label,
        period: 'FIRST',
      });
      expensesByPeriod.FIRST = await expandExpenseTemplatesForFortnight(
        first.id,
        'FIRST',
      );
      incomeTemplatesByPeriod.FIRST =
        await expandIncomeTemplatesForFortnight(first.id, 'FIRST');
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
      created.push({
        id: second.id,
        label: second.label,
        period: 'SECOND',
      });
      expensesByPeriod.SECOND = await expandExpenseTemplatesForFortnight(
        second.id,
        'SECOND',
      );
      incomeTemplatesByPeriod.SECOND =
        await expandIncomeTemplatesForFortnight(second.id, 'SECOND');
    }

    // When one fortnight already existed, run both template expansions now.
    // This keeps month creation idempotent after partial failures.
    if (existingFirst) {
      expensesByPeriod.FIRST = await expandExpenseTemplatesForFortnight(
        existingFirst.id,
        'FIRST',
      );
      incomeTemplatesByPeriod.FIRST =
        await expandIncomeTemplatesForFortnight(existingFirst.id, 'FIRST');
    }
    if (existingSecond) {
      expensesByPeriod.SECOND = await expandExpenseTemplatesForFortnight(
        existingSecond.id,
        'SECOND',
      );
      incomeTemplatesByPeriod.SECOND =
        await expandIncomeTemplatesForFortnight(existingSecond.id, 'SECOND');
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

    return NextResponse.json(
      {
        message:
          created.length === 2
            ? 'Mes creado: ambas quincenas creadas'
            : created.length === 1
              ? `Quincena(s) creada(s): ${created
                  .map((c) => c.label)
                  .join(', ')}`
              : 'Quincenas existentes: se sincronizaron plantillas de gastos e ingresos',
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
        budgetPeriodsCreated,
      },
      { status: created.length > 0 ? 201 : 200 },
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
