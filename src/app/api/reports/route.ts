import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@/generated/prisma/client';
import prisma from '@/lib/prisma';
import { getOwnerContext } from '@/lib/server/get-owner-context';
import { wherePlanningCashFlowExpenses } from '@/lib/finance/expense-planning-scope';
import {
  buildExpenseWhereForFortnightScope,
  fortnightIdsForRollingCalendarMonths,
} from '@/lib/finance/report-helpers';
import { getReportSummary } from '@/lib/finance/report-summary.service';

export async function GET(request: NextRequest) {
  try {
    const context = await getOwnerContext(request);
    if ('error' in context) return context.error;
    const { ownerFilter } = context;

    const { searchParams } = new URL(request.url);
    const reportType = searchParams.get('type');
    const month = searchParams.get('month');
    const year = searchParams.get('year');
    const period = searchParams.get('period');
    const windowMonthsRaw = searchParams.get('windowMonths');
    const planningCashFlow = searchParams.get('planningCashFlow') === 'true';
    const excludeCreditInstallment =
      searchParams.get('exclude_credit_installment') === 'true' ||
      searchParams.get('exclude_credit_msi') === 'true';

    if (reportType === 'summary') {
      const summary = await getReportSummary({
        ownerFilter,
        month,
        year,
        period,
        excludeCreditInstallment,
      });
      return NextResponse.json(summary, { status: 200 });
    }

    if (reportType === 'by-category') {
      let where: Prisma.ExpenseWhereInput;
      if (month || year || period) {
        where = await buildExpenseWhereForFortnightScope(
          ownerFilter,
          month,
          year,
          period,
        );
      } else if (windowMonthsRaw != null && windowMonthsRaw !== '') {
        const n = parseInt(windowMonthsRaw, 10);
        if (!Number.isFinite(n) || n < 1 || n > 120) {
          return NextResponse.json(
            { error: 'windowMonths must be between 1 and 120' },
            { status: 400 },
          );
        }
        const fortnightIds = await fortnightIdsForRollingCalendarMonths(
          ownerFilter,
          n,
        );
        where = {
          ...ownerFilter,
          fortnight_id: { in: fortnightIds.length > 0 ? fortnightIds : [] },
        };
      } else {
        where = await buildExpenseWhereForFortnightScope(
          ownerFilter,
          month,
          year,
          period,
        );
      }

      const categoryWhere: Prisma.ExpenseWhereInput = planningCashFlow
        ? { AND: [where, wherePlanningCashFlowExpenses()] }
        : where;

      const expenses = await prisma.expense.findMany({
        where: categoryWhere,
        include: {
          category: {
            select: {
              name: true,
              icon: true,
            },
          },
        },
      });

      const categoryTotals = expenses.reduce(
        (acc: Record<string, { total: number; icon: string | null }>, expense) => {
          const categoryName = expense.category?.name ?? 'Sin categoría';
          if (!acc[categoryName]) {
            acc[categoryName] = {
              total: 0,
              icon: expense.category?.icon ?? null,
            };
          }
          acc[categoryName].total += Number(expense.amount);
          return acc;
        },
        {},
      );

      const result = Object.entries(categoryTotals).map(
        ([category, data]) => ({
          category,
          categoryIcon: data.icon,
          total: data.total,
        }),
      );

      return NextResponse.json(result, { status: 200 });
    }

    if (reportType === 'by-payment-method') {
      let where: Prisma.ExpenseWhereInput;
      if (month || year || period) {
        where = await buildExpenseWhereForFortnightScope(
          ownerFilter,
          month,
          year,
          period,
        );
      } else if (windowMonthsRaw != null && windowMonthsRaw !== '') {
        const n = parseInt(windowMonthsRaw, 10);
        if (!Number.isFinite(n) || n < 1 || n > 120) {
          return NextResponse.json(
            { error: 'windowMonths must be between 1 and 120' },
            { status: 400 },
          );
        }
        const fortnightIds = await fortnightIdsForRollingCalendarMonths(
          ownerFilter,
          n,
        );
        where = {
          ...ownerFilter,
          fortnight_id: { in: fortnightIds.length > 0 ? fortnightIds : [] },
        };
      } else {
        where = await buildExpenseWhereForFortnightScope(
          ownerFilter,
          month,
          year,
          period,
        );
      }

      const expenses = await prisma.expense.findMany({
        where,
        include: {
          wallet: {
            select: {
              name: true,
            },
          },
        },
      });

      const methodTotals: Record<string, number> = {};

      expenses.forEach((expense) => {
        const methodName = expense.wallet?.name || 'Efectivo';
        if (!methodTotals[methodName]) {
          methodTotals[methodName] = 0;
        }
        methodTotals[methodName] += Number(expense.amount);
      });

      const result = Object.entries(methodTotals).map(([method, total]) => ({
        method,
        total,
      }));

      return NextResponse.json(result, { status: 200 });
    }

    return NextResponse.json(
      {
        error:
          'Invalid report type. Use ?type=summary, ?type=by-category, or ?type=by-payment-method. For by-category / by-payment-method, optional ?windowMonths=1-120 (rolling calendar months) when month/year/period are omitted. For by-category, optional ?planningCashFlow=true (same expense scope as dashboard planning KPIs).',
      },
      { status: 400 },
    );
  } catch (error) {
    console.error('Error generating report:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'Failed to generate report';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
