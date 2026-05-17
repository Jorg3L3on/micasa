import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@/generated/prisma/client';
import { FortnightPeriod, PaymentMethodType } from '@/generated/prisma/client';
import prisma from '@/lib/prisma';
import { getOwnerContext } from '@/lib/server/get-owner-context';
import type { OwnerFilter } from '@/lib/server/get-owner-context';
import {
  whereCreditOrStoreCardWalletOnly,
  wherePlanningCashFlowExpenses,
} from '@/lib/finance/expense-planning-scope';
import {
  aggregateOrphanCreditCardPaymentsForPlanning,
  buildFortnightWhereForReport,
  unionPaidAtRangeFromFortnights,
} from '@/lib/finance/planning-credit-card-payments';
import { sumPlannerCardDueForFortnight } from '@/lib/finance/credit-card-statement.service';

function parseFortnightPeriod(value: string | null | undefined): FortnightPeriod | undefined {
  if (value === FortnightPeriod.FIRST) return FortnightPeriod.FIRST;
  if (value === FortnightPeriod.SECOND) return FortnightPeriod.SECOND;
  return undefined;
}

async function buildWhereClause(
  ownerFilter: OwnerFilter,
  month?: string | null,
  year?: string | null,
  period?: string | null,
): Promise<Prisma.ExpenseWhereInput> {
  const where: Prisma.ExpenseWhereInput = { ...ownerFilter };
  if (month || year || period) {
    const fortnightWhere: Prisma.FortnightWhereInput = { ...ownerFilter };
    const parsedPeriod = parseFortnightPeriod(period);
    if (month) {
      fortnightWhere.month = parseInt(month, 10);
    }
    if (year) {
      fortnightWhere.year = parseInt(year, 10);
    }
    if (parsedPeriod) {
      fortnightWhere.period = parsedPeriod;
    }

    const fortnights = await prisma.fortnight.findMany({
      where: fortnightWhere,
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

/** Same rolling calendar window as `dashboard/monthly-summary` (oldest month first in implied iteration). */
async function fortnightIdsForRollingCalendarMonths(
  ownerFilter: OwnerFilter,
  windowMonths: number,
): Promise<number[]> {
  if (windowMonths < 1 || windowMonths > 120) {
    return [];
  }
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const months: { year: number; month: number }[] = [];
  for (let i = windowMonths - 1; i >= 0; i--) {
    let m = currentMonth - i;
    let y = currentYear;
    while (m <= 0) {
      m += 12;
      y -= 1;
    }
    months.push({ year: y, month: m });
  }
  const yearMonthConditions = months.map(({ year, month }) => ({ year, month }));
  const fortnights = await prisma.fortnight.findMany({
    where: {
      ...ownerFilter,
      OR: yearMonthConditions,
    },
    select: { id: true },
  });
  return fortnights.map((f) => f.id);
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
    const windowMonthsRaw = searchParams.get('windowMonths');
    const planningCashFlow = searchParams.get('planningCashFlow') === 'true';
    const excludeCreditInstallment =
      searchParams.get('exclude_credit_installment') === 'true' ||
      searchParams.get('exclude_credit_msi') === 'true';

    if (reportType === 'summary') {
      const baseWhere = await buildWhereClause(ownerFilter, month, year, period);
      const where = excludeCreditInstallment
        ? { AND: [baseWhere, wherePlanningCashFlowExpenses()] }
        : baseWhere;

      const [expenses, cardExpenses] = await Promise.all([
        prisma.expense.findMany({
          where,
          select: {
            amount: true,
            is_paid: true,
          },
        }),
        excludeCreditInstallment
          ? prisma.expense.findMany({
              where: {
                AND: [baseWhere, whereCreditOrStoreCardWalletOnly()],
              },
              select: {
                amount: true,
                is_paid: true,
              },
            })
          : Promise.resolve([] as { amount: unknown; is_paid: boolean }[]),
      ]);

      const incomeWhere: Prisma.IncomeWhereInput = { ...ownerFilter };
      if (month || year || period) {
        const fortnightWhere: Prisma.FortnightWhereInput = { ...ownerFilter };
        const parsedPeriod = parseFortnightPeriod(period);
        if (month) fortnightWhere.month = parseInt(month, 10);
        if (year) fortnightWhere.year = parseInt(year, 10);
        if (parsedPeriod) fortnightWhere.period = parsedPeriod;

        const fortnights = await prisma.fortnight.findMany({
          where: fortnightWhere,
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
        where: incomeWhere,
      });

      let totalExpense = expenses.reduce((sum, expense) => {
        return sum + Number(expense.amount);
      }, 0);

      let totalPaid = expenses
        .filter((e) => e.is_paid)
        .reduce((sum, expense) => {
          return sum + Number(expense.amount);
        }, 0);

      let totalUnpaid = totalExpense - totalPaid;

      let orphanCardPaymentTotal = 0;
      let orphanCardPaymentCount = 0;
      if (excludeCreditInstallment) {
        const fnWhere = buildFortnightWhereForReport(
          ownerFilter,
          month,
          year,
          period,
        );
        if (fnWhere != null) {
          const planningFortnights = await prisma.fortnight.findMany({
            where: fnWhere as Prisma.FortnightWhereInput,
            select: { start_date: true, end_date: true },
          });
          const paidAtRange = unionPaidAtRangeFromFortnights(planningFortnights);
          const orphan = await aggregateOrphanCreditCardPaymentsForPlanning(
            ownerFilter,
            paidAtRange,
          );
          orphanCardPaymentTotal = orphan.total;
          orphanCardPaymentCount = orphan.count;
        }
        if (orphanCardPaymentCount > 0) {
          totalExpense += orphanCardPaymentTotal;
          totalPaid += orphanCardPaymentTotal;
          totalUnpaid = totalExpense - totalPaid;
        }
      }

      let planningCardStatementDueTotal = 0;
      let planningCardStatementDueCardCount = 0;
      if (
        excludeCreditInstallment &&
        year &&
        month &&
        period &&
        (period === 'FIRST' || period === 'SECOND')
      ) {
        const due = await sumPlannerCardDueForFortnight(
          ownerFilter,
          parseInt(year, 10),
          parseInt(month, 10),
          period,
        );
        planningCardStatementDueTotal = due.total;
        planningCardStatementDueCardCount = due.cardCount;
        if (planningCardStatementDueTotal > 0) {
          totalExpense += planningCardStatementDueTotal;
          totalUnpaid += planningCardStatementDueTotal;
        }
      }

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

      const cardTotal = excludeCreditInstallment
        ? cardExpenses.reduce((sum, e) => sum + Number(e.amount), 0)
        : 0;
      const cardPaid = excludeCreditInstallment
        ? cardExpenses
            .filter((e) => e.is_paid)
            .reduce((sum, e) => sum + Number(e.amount), 0)
        : 0;
      const cardUnpaid = excludeCreditInstallment ? cardTotal - cardPaid : 0;
      const cardExpenseCount = excludeCreditInstallment ? cardExpenses.length : 0;

      let planningExpenseCount = excludeCreditInstallment ? expenses.length : undefined;
      let planningPaidExpenseCount = excludeCreditInstallment
        ? expenses.filter((e) => e.is_paid).length
        : undefined;
      const planningUnpaidExpenseCount = excludeCreditInstallment
        ? expenses.filter((e) => !e.is_paid).length
        : undefined;

      if (excludeCreditInstallment && orphanCardPaymentCount > 0) {
        planningExpenseCount =
          (planningExpenseCount ?? 0) + orphanCardPaymentCount;
        planningPaidExpenseCount =
          (planningPaidExpenseCount ?? 0) + orphanCardPaymentCount;
      }

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
        const fortnightWhere: Prisma.FortnightWhereInput = { ...ownerFilter };
        const parsedPeriod = parseFortnightPeriod(period);
        if (month) fortnightWhere.month = parseInt(month, 10);
        if (year) fortnightWhere.year = parseInt(year, 10);
        if (parsedPeriod) fortnightWhere.period = parsedPeriod;

        const fortnights = await prisma.fortnight.findMany({
          where: fortnightWhere,
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

      const fundingWallets = await prisma.wallet.findMany({
        where: {
          ...ownerFilter,
          active: true,
          type: {
            in: [PaymentMethodType.CASH, PaymentMethodType.DEBIT_CARD],
          },
        },
        select: {
          id: true,
          name: true,
          amount: true,
          type: true,
        },
        orderBy: [{ type: 'asc' }, { name: 'asc' }],
      });
      const fundingWalletBreakdown = fundingWallets.map((w) => ({
        id: w.id,
        name: w.name,
        amount: Number(w.amount),
        type: w.type,
      }));
      const fundingWalletBalanceTotal = fundingWalletBreakdown.reduce(
        (s, w) => s + w.amount,
        0,
      );
      const fundingNetVsPendingExpense =
        fundingWalletBalanceTotal - totalUnpaid;

      return NextResponse.json(
        {
          totalIncome,
          totalExpense,
          totalPaid,
          totalUnpaid,
          balance,
          fundingWalletBalanceTotal,
          fundingNetVsPendingExpense,
          fundingWalletBreakdown,
          userIncome: userIncomeData,
          incomeItems,
          ...(excludeCreditInstallment
            ? {
                planningExpenseCount,
                planningPaidExpenseCount,
                planningUnpaidExpenseCount,
                cardCharges:
                  cardTotal > 0 || cardExpenseCount > 0
                    ? {
                        total: cardTotal,
                        paid: cardPaid,
                        unpaid: cardUnpaid,
                        expenseCount: cardExpenseCount,
                      }
                    : null,
                planningOrphanCardPayments:
                  orphanCardPaymentCount > 0 || orphanCardPaymentTotal > 0
                    ? {
                        total: orphanCardPaymentTotal,
                        count: orphanCardPaymentCount,
                      }
                    : null,
                planningCardStatementDue:
                  planningCardStatementDueTotal > 0
                    ? {
                        total: planningCardStatementDueTotal,
                        cardCount: planningCardStatementDueCardCount,
                      }
                    : null,
              }
            : {}),
        },
        { status: 200 },
      );
    }

    if (reportType === 'by-category') {
      let where: Prisma.ExpenseWhereInput;
      if (month || year || period) {
        where = await buildWhereClause(ownerFilter, month, year, period);
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
        where = await buildWhereClause(ownerFilter, month, year, period);
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
        where = await buildWhereClause(ownerFilter, month, year, period);
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
        where = await buildWhereClause(ownerFilter, month, year, period);
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
