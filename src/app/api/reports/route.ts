import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getOwnerContext } from '@/lib/server/get-owner-context';
import type { OwnerFilter } from '@/lib/server/get-owner-context';

async function buildWhereClause(
  ownerFilter: OwnerFilter,
  month?: string | null,
  year?: string | null,
  period?: string | null,
) {
  const where: Record<string, unknown> = { ...ownerFilter };
  if (month || year || period) {
    const fortnightWhere: Record<string, unknown> = { ...ownerFilter };
    if (month) {
      fortnightWhere.month = parseInt(month, 10);
    }
    if (year) {
      fortnightWhere.year = parseInt(year, 10);
    }
    if (period) {
      fortnightWhere.period = period;
    }

    const fortnights = await prisma.fortnight.findMany({
      where: fortnightWhere as any,
      select: { id: true },
    });

    const fortnightIds = fortnights.map((f) => f.id);
    if (fortnightIds.length > 0) {
      where.fortnight_id = { in: fortnightIds };
    } else {
      where.fortnight_id = { in: [] };
    }
  }
  return where;
}

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

    if (reportType === 'summary') {
      const where = await buildWhereClause(ownerFilter, month, year, period);

      const expenses = await prisma.expense.findMany({
        where: where as any,
        select: {
          amount: true,
          is_paid: true,
        },
      });

      let incomeWhere: Record<string, unknown> = { ...ownerFilter };
      if (month || year || period) {
        const fortnightWhere: Record<string, unknown> = { ...ownerFilter };
        if (month) fortnightWhere.month = parseInt(month, 10);
        if (year) fortnightWhere.year = parseInt(year, 10);
        if (period) fortnightWhere.period = period;

        const fortnights = await prisma.fortnight.findMany({
          where: fortnightWhere as any,
          select: { id: true },
        });

        const fortnightIds = fortnights.map((f) => f.id);
        if (fortnightIds.length > 0) {
          incomeWhere.fortnight_id = { in: fortnightIds };
        } else {
          incomeWhere.fortnight_id = { in: [] };
        }
      }

      const income = await prisma.income.findMany({
        where: incomeWhere as any,
      });

      const totalExpense = expenses.reduce((sum, expense) => {
        return sum + Number(expense.amount);
      }, 0);

      const totalPaid = expenses
        .filter((e) => e.is_paid)
        .reduce((sum, expense) => {
          return sum + Number(expense.amount);
        }, 0);

      const totalUnpaid = totalExpense - totalPaid;

      // Check for override amount (marked with source = '__OVERRIDE__')
      const overrideIncome = income.find(
        (inc) => inc.source === '__OVERRIDE__',
      );
      const regularIncome = income.filter(
        (inc) => inc.source !== '__OVERRIDE__',
      );

      // If override exists, use it; otherwise calculate from regular income
      const totalIncome = overrideIncome
        ? Number(overrideIncome.amount)
        : regularIncome.reduce((sum, inc) => {
            return sum + Number(inc.amount);
          }, 0);

      const balance = totalIncome - totalExpense;

      // Fetch user income data and income items (by source) for the period
      let userIncomeData: Array<{
        fortnightId: number;
        userIncome: Array<{ userId: number; userName: string; income: number }>;
      }> = [];
      const incomeItems: Array<{
        fortnightId: number;
        id: number;
        amount: number;
        source: string | null;
        userName: string | null;
        templateName: string | null;
      }> = [];

      if (month || year || period) {
        const fortnightWhere: Record<string, unknown> = { ...ownerFilter };
        if (month) fortnightWhere.month = parseInt(month, 10);
        if (year) fortnightWhere.year = parseInt(year, 10);
        if (period) fortnightWhere.period = period;

        const fortnights = await prisma.fortnight.findMany({
          where: fortnightWhere as any,
          select: { id: true },
        });

        const fortnightIds = fortnights.map((f) => f.id);

        if (fortnightIds.length > 0) {
          const incomes = await prisma.income.findMany({
            where: {
              ...ownerFilter,
              fortnight_id: { in: fortnightIds },
              source: { not: '__OVERRIDE__' },
            },
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          });

          // All income rows (including __OVERRIDE__) for edit-by-source UI
          const incomesForItems = await prisma.income.findMany({
            where: {
              ...ownerFilter,
              fortnight_id: { in: fortnightIds },
            },
            include: {
              user: { select: { name: true } },
              income_template: { select: { name: true } },
            },
          });
          incomesForItems.forEach((inc) => {
            incomeItems.push({
              fortnightId: inc.fortnight_id,
              id: inc.id,
              amount: Number(inc.amount),
              source: inc.source,
              userName: inc.user?.name ?? null,
              templateName: inc.income_template?.name ?? null,
            });
          });

          // Group income by fortnight_id and user_id
          const incomeByFortnight: Record<number, Record<number, number>> = {};

          incomes.forEach((inc) => {
            const fortnightId = inc.fortnight_id;
            const userId = inc.user_id;
            if (userId) {
              const amount = Number(inc.amount);

              if (!incomeByFortnight[fortnightId]) {
                incomeByFortnight[fortnightId] = {};
              }
              if (!incomeByFortnight[fortnightId][userId]) {
                incomeByFortnight[fortnightId][userId] = 0;
              }
              incomeByFortnight[fortnightId][userId] += amount;
            }
          });

          // Convert to the expected format
          userIncomeData = Object.entries(incomeByFortnight).map(
            ([fortnightId, userAmounts]) => {
              const userIncome = Object.entries(userAmounts).map(
                ([userId, amount]) => {
                  const incomeEntry = incomes.find(
                    (inc) =>
                      inc.fortnight_id === parseInt(fortnightId, 10) &&
                      inc.user_id === parseInt(userId, 10),
                  );
                  return {
                    userId: parseInt(userId, 10),
                    userName: incomeEntry?.user?.name || 'Unknown',
                    income: amount,
                  };
                },
              );
              return {
                fortnightId: parseInt(fortnightId, 10),
                userIncome,
              };
            },
          );
        }
      }

      return NextResponse.json(
        {
          totalIncome,
          totalExpense,
          totalPaid,
          totalUnpaid,
          balance,
          userIncome: userIncomeData,
          incomeItems,
        },
        { status: 200 },
      );
    }

    if (reportType === 'by-category') {
      const where = await buildWhereClause(ownerFilter, month, year, period);

      const expenses = await prisma.expense.findMany({
        where: where as any,
        include: {
          category: {
            select: {
              name: true,
            },
          },
        },
      });

      const categoryTotals = expenses.reduce(
        (acc: Record<string, number>, expense) => {
          const categoryName = expense.category?.name ?? 'Sin categoría';
          if (!acc[categoryName]) {
            acc[categoryName] = 0;
          }
          acc[categoryName] += Number(expense.amount);
          return acc;
        },
        {},
      );

      const result = Object.entries(categoryTotals).map(
        ([category, total]) => ({
          category,
          total,
        }),
      );

      return NextResponse.json(result, { status: 200 });
    }

    if (reportType === 'by-payment-method') {
      const where = await buildWhereClause(ownerFilter, month, year, period);

      const expenses = await prisma.expense.findMany({
        where: where as any,
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
          'Invalid report type. Use ?type=summary, ?type=by-category, or ?type=by-payment-method',
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
