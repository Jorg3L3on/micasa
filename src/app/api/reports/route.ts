import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

async function buildWhereClause(
  month?: string | null,
  year?: string | null,
  period?: string | null
) {
  const where: any = {}
  if (month || year || period) {
    const fortnightWhere: any = {}
    if (month) {
      fortnightWhere.month = parseInt(month, 10)
    }
    if (year) {
      fortnightWhere.year = parseInt(year, 10)
    }
    if (period) {
      fortnightWhere.period = period
    }
    
    // Find fortnights that match the month/year/period criteria
    const fortnights = await prisma.fortnight.findMany({
      where: fortnightWhere,
      select: { id: true },
    })
    
    const fortnightIds = fortnights.map((f) => f.id)
    if (fortnightIds.length > 0) {
      where.fortnight_id = { in: fortnightIds }
    } else {
      // No matching fortnights, return empty result
      where.fortnight_id = { in: [] }
    }
  }
  return where
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const reportType = searchParams.get('type')
    const month = searchParams.get('month')
    const year = searchParams.get('year')
    const period = searchParams.get('period')

    if (reportType === 'summary') {
      const where = await buildWhereClause(month, year, period)

      const expenses = await prisma.expense.findMany({
        where,
        select: {
          amount: true,
          is_paid: true,
        },
      })

      let incomeWhere: any = {}
      if (month || year || period) {
        const fortnightWhere: any = {}
        if (month) {
          fortnightWhere.month = parseInt(month, 10)
        }
        if (year) {
          fortnightWhere.year = parseInt(year, 10)
        }
        if (period) {
          fortnightWhere.period = period
        }
        
        const fortnights = await prisma.fortnight.findMany({
          where: fortnightWhere,
          select: { id: true },
        })
        
        const fortnightIds = fortnights.map((f) => f.id)
        if (fortnightIds.length > 0) {
          incomeWhere.fortnight_id = { in: fortnightIds }
        } else {
          incomeWhere.fortnight_id = { in: [] }
        }
      }

      const income = await prisma.fortnightIncome.findMany({
        where: incomeWhere,
        include: {
          user: {
            select: {
              name: true,
            },
          },
        },
      })

      const totalExpense = expenses.reduce((sum, expense) => {
        return sum + Number(expense.amount)
      }, 0)

      const totalPaid = expenses
        .filter((e) => e.is_paid)
        .reduce((sum, expense) => {
          return sum + Number(expense.amount)
        }, 0)

      const totalUnpaid = totalExpense - totalPaid

      const totalIncome = income.reduce((sum, inc) => {
        return sum + Number(inc.amount)
      }, 0)

      // Group income by user
      const incomeByUser = income.reduce((acc: Record<string, number>, inc) => {
        const userName = inc.user.name
        if (!acc[userName]) {
          acc[userName] = 0
        }
        acc[userName] += Number(inc.amount)
        return acc
      }, {})

      const userIncome = Object.entries(incomeByUser).map(([user, amount]) => ({
        user,
        amount,
      }))

      const balance = totalIncome - totalExpense

      return NextResponse.json(
        {
          totalIncome,
          totalExpense,
          totalPaid,
          totalUnpaid,
          balance,
          userIncome,
        },
        { status: 200 }
      )
    }

    if (reportType === 'by-category') {
      const where = await buildWhereClause(month, year, period)

      const expenses = await prisma.expense.findMany({
        where,
        include: {
          category: {
            select: {
              name: true,
            },
          },
        },
      })

      const categoryTotals = expenses.reduce((acc: Record<string, number>, expense) => {
        const categoryName = expense.category.name
        if (!acc[categoryName]) {
          acc[categoryName] = 0
        }
        acc[categoryName] += Number(expense.amount)
        return acc
      }, {})

      const result = Object.entries(categoryTotals).map(([category, total]) => ({
        category,
        total,
      }))

      return NextResponse.json(result, { status: 200 })
    }

    if (reportType === 'by-payment-method') {
      const where = await buildWhereClause(month, year, period)

      const expenses = await prisma.expense.findMany({
        where,
        include: {
          card: {
            select: {
              payment_method: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      })

      const methodTotals: Record<string, number> = {}

      expenses.forEach((expense) => {
        const methodName = expense.card?.payment_method?.name || 'Efectivo'
        if (!methodTotals[methodName]) {
          methodTotals[methodName] = 0
        }
        methodTotals[methodName] += Number(expense.amount)
      })

      const result = Object.entries(methodTotals).map(([method, total]) => ({
        method,
        total,
      }))

      return NextResponse.json(result, { status: 200 })
    }

    if (reportType === 'by-person') {
      const where = await buildWhereClause(month, year, period)

      const expenses = await prisma.expense.findMany({
        where,
        include: {
          user: {
            select: {
              name: true,
            },
          },
          card: {
            select: {
              payment_method: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      })

      const personTotals: Record<string, number> = {}

      expenses.forEach((expense) => {
        const personName = expense.user.name
        if (!personTotals[personName]) {
          personTotals[personName] = 0
        }
        personTotals[personName] += Number(expense.amount)
      })

      // Add cash as a separate entry
      const cashExpenses = expenses.filter(
        (e) => !e.card || e.card.payment_method.name === 'Efectivo'
      )
      const cashTotal = cashExpenses.reduce((sum, e) => sum + Number(e.amount), 0)
      if (cashTotal > 0) {
        personTotals['Efectivo'] = (personTotals['Efectivo'] || 0) + cashTotal
      }

      const result = Object.entries(personTotals).map(([person, total]) => ({
        person,
        total,
      }))

      return NextResponse.json(result, { status: 200 })
    }

    return NextResponse.json(
      {
        error:
          'Invalid report type. Use ?type=summary, ?type=by-category, ?type=by-payment-method, or ?type=by-person',
      },
      { status: 400 }
    )
  } catch (error) {
    console.error('Error generating report:', error)
    return NextResponse.json(
      { error: 'Failed to generate report' },
      { status: 500 }
    )
  }
}
