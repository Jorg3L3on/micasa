import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getOwnerContext } from '@/lib/server/get-owner-context';
import {
  expandExpenseTemplatesForFortnight,
  expandIncomeTemplatesForFortnight,
} from '@/lib/finance/template.service';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const context = await getOwnerContext(request);
    if ('error' in context) return context.error;
    const { ownerFilter } = context;

    const { id } = await params;

    if (!id || Number.isNaN(Number(id))) {
      return NextResponse.json(
        { error: 'Valid id parameter is required' },
        { status: 400 },
      );
    }

    const fortnightId = Number(id);

    const fortnight = await prisma.fortnight.findFirst({
      where: { id: fortnightId, ...ownerFilter },
      select: {
        id: true,
        period: true,
      },
    });

    if (!fortnight) {
      return NextResponse.json(
        { error: 'Fortnight not found' },
        { status: 404 },
      );
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
      fortnight.period as 'FIRST' | 'SECOND',
    );

    const incomeResult = await expandIncomeTemplatesForFortnight(
      fortnightId,
      fortnight.period as 'FIRST' | 'SECOND',
    );

    return NextResponse.json(
      {
        message: 'Quincena regenerada desde plantillas',
        fortnightId,
        expensesCreated: expenseResult,
        incomeCreated: incomeResult,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error('Error regenerating fortnight from templates:', error);
    return NextResponse.json(
      { error: 'Failed to regenerate fortnight from templates' },
      { status: 500 },
    );
  }
}

