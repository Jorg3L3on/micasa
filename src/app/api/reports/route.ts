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

      // Check for override amount (marked with source = '__OVERRIDE__')
      const overrideIncome = income.find((inc) => inc.source === '__OVERRIDE__')
      const regularIncome = income.filter((inc) => inc.source !== '__OVERRIDE__')

      // If override exists, use it; otherwise calculate from regular income
      const totalIncome = overrideIncome
        ? Number(overrideIncome.amount)
        : regularIncome.reduce((sum, inc) => {
            return sum + Number(inc.amount)
          }, 0)

      const balance = totalIncome - totalExpense

      // Fetch user income data from FortnightIncome using the user_id relationship
      let userIncomeData: Array<{
        fortnightId: number
        userIncome: Array<{ userId: number; userName: string; income: number }>
      }> = []

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
          try {
            // First, try to fetch with user relationship (if migration has been applied)
            // Use raw query to check if user_id column exists
            const tableInfo = await prisma.$queryRaw<Array<{ column_name: string }>>`
              SELECT column_name 
              FROM information_schema.columns 
              WHERE table_name = 'FortnightIncome' 
              AND column_name = 'user_id'
            `
            
            if (tableInfo && tableInfo.length > 0) {
              // user_id column exists, fetch with relationship
              const fortnightIncomes = await prisma.fortnightIncome.findMany({
                where: {
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
              })

              // Group income by fortnight_id and user_id
              const incomeByFortnight: Record<number, Record<number, number>> = {}
              
              fortnightIncomes.forEach((inc) => {
                const fortnightId = inc.fortnight_id
                const userId = (inc as any).user_id
                if (userId) {
                  const amount = Number(inc.amount)

                  if (!incomeByFortnight[fortnightId]) {
                    incomeByFortnight[fortnightId] = {}
                  }
                  if (!incomeByFortnight[fortnightId][userId]) {
                    incomeByFortnight[fortnightId][userId] = 0
                  }
                  incomeByFortnight[fortnightId][userId] += amount
                }
              })

              // Convert to the expected format
              userIncomeData = Object.entries(incomeByFortnight).map(([fortnightId, userAmounts]) => {
                const userIncome = Object.entries(userAmounts).map(([userId, amount]) => {
                  // Find the user from the first income entry that matches this userId
                  const incomeEntry = fortnightIncomes.find(
                    (inc) => inc.fortnight_id === parseInt(fortnightId, 10) && (inc as any).user_id === parseInt(userId, 10)
                  )
                  return {
                    userId: parseInt(userId, 10),
                    userName: (incomeEntry as any)?.user?.name || 'Unknown',
                    income: amount,
                  }
                })
                return {
                  fortnightId: parseInt(fortnightId, 10),
                  userIncome,
                }
              })
            } else {
              // user_id column doesn't exist yet, return empty array
              console.warn('user_id column does not exist in FortnightIncome table. Migration may not be applied yet.')
              userIncomeData = []
            }
          } catch (userIncomeError) {
            // If there's any error, just return empty array
            // This allows the API to work before the migration is run
            console.warn('Could not fetch user income (migration may not be applied yet):', userIncomeError)
            userIncomeData = []
          }
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

    return NextResponse.json(
      {
        error:
          'Invalid report type. Use ?type=summary, ?type=by-category, or ?type=by-payment-method',
      },
      { status: 400 }
    )
  } catch (error) {
    console.error('Error generating report:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to generate report'
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}
