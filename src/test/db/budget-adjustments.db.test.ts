import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { DB_URL, closeTestPool, testPool } from './db-test-utils'

/**
 * One-quincena budget adjustments (MIC-I19) against a real Postgres, through
 * the app's own services: the adjustment survives template edits and the
 * calendar reconcile that delete and rebuild budget periods.
 */
describe.skipIf(!DB_URL)('budget quincena adjustments (DB)', () => {
  type Services = {
    prisma: typeof import('@/lib/prisma').default
    runWithAuditActor: typeof import('@/lib/server/audit/audit-context').runWithAuditActor
    budget: typeof import('@/lib/finance/budget.service')
    adjustments: typeof import('@/lib/finance/budget-adjustment.service')
    periods: typeof import('@/lib/finance/budget-period.service')
    panel: typeof import('@/lib/finance/monthly-budget-panel.service')
    calendar: typeof import('@/lib/fortnight-calendar')
    windows: typeof import('@/lib/finance/budget-period-windows')
  }
  let s: Services
  let userId = 0
  let categoryId = 0
  let budgetId = 0
  const owner = () => ({ user_id: userId, house_id: null })
  const asActor = <T>(fn: () => Promise<T>) =>
    s.runWithAuditActor({ source: 'SYSTEM', label: 'budget-adjustments.db.test' }, fn)

  const remainingFor = async (ref: { year: number; month: number; period: 'FIRST' | 'SECOND' }) => {
    const result = await asActor(() => s.panel.getMonthlyBudgetPanel(owner(), ref.year, ref.month))
    return ref.period === 'FIRST' ? result.first : result.second
  }

  beforeAll(async () => {
    process.env.DATABASE_URL = DB_URL!
    s = {
      prisma: (await import('@/lib/prisma')).default,
      runWithAuditActor: (await import('@/lib/server/audit/audit-context')).runWithAuditActor,
      budget: await import('@/lib/finance/budget.service'),
      adjustments: await import('@/lib/finance/budget-adjustment.service'),
      periods: await import('@/lib/finance/budget-period.service'),
      panel: await import('@/lib/finance/monthly-budget-panel.service'),
      calendar: await import('@/lib/fortnight-calendar'),
      windows: await import('@/lib/finance/budget-period-windows'),
    }
    await asActor(async () => {
      const user = await s.prisma.user.create({
        data: { name: 'Prueba Ajustes', email: `ajustes-${randomUUID()}@example.test`, password: 'x' },
      })
      userId = user.id
      const [current, next] = s.adjustments.adjustableQuincenas()
      const months = new Map<string, { year: number; month: number }>()
      for (const ref of [current, next]) months.set(`${ref.year}-${ref.month}`, ref)
      for (const { year, month } of months.values()) {
        for (const period of ['FIRST', 'SECOND'] as const) {
          const bounds = s.windows.getCanonicalFortnightBounds(year, month, period)
          await s.prisma.fortnight.create({
            data: { ...bounds, label: `${year}-${month}-${period}`, year, month, period, user_id: userId },
          })
        }
      }
      const category = await s.prisma.category.create({ data: { name: 'Despensa', user_id: userId } })
      categoryId = category.id
      const created = await s.budget.createBudget('user', userId, {
        name: 'Despensa',
        allocated_amount: 2600,
        frequency: 'BIWEEKLY',
        recurrent: true,
        allocations: [{ wallet_id: null, category_id: categoryId, amount: 2600 }],
      })
      budgetId = created.id
    })
  })

  afterAll(async () => {
    const pool = testPool()
    await pool.query(`DELETE FROM "BudgetFortnightAdjustment" WHERE user_id = $1`, [userId])
    await pool.query(`DELETE FROM "Budget" WHERE user_id = $1`, [userId])
    await pool.query(`DELETE FROM "Category" WHERE user_id = $1`, [userId])
    await pool.query(`DELETE FROM "Fortnight" WHERE user_id = $1`, [userId])
    await pool.query(`DELETE FROM "User" WHERE id = $1`, [userId])
    await closeTestPool()
  })

  it('pauses the current quincena only, and survives a template edit and the reconcile', async () => {
    const [current, next] = s.adjustments.adjustableQuincenas()
    expect((await remainingFor(current)).available).toBe(2600)

    await asActor(() =>
      s.adjustments.setBudgetFortnightAdjustment(budgetId, owner(), { ...current, kind: 'PAUSE' }),
    )
    expect((await remainingFor(current)).available).toBe(0)
    expect((await remainingFor(next)).available).toBe(2600)

    // Template edit: deletes and rebuilds the current and future periods.
    await asActor(() =>
      s.budget.updateBudget(budgetId, owner(), {
        name: 'Despensa',
        allocated_amount: 3000,
        frequency: 'BIWEEKLY',
        recurrent: true,
        allocations: [{ wallet_id: null, category_id: categoryId, amount: 3000 }],
      }),
    )
    await asActor(() => s.periods.ensureBudgetPeriodsForMonth(owner(), current.year, current.month))

    const afterEdit = await remainingFor(current)
    expect(afterEdit.available).toBe(0)
    expect(afterEdit.budgets[0]).toMatchObject({ templateTotal: 3000, total: 0, adjustment: { kind: 'PAUSE' } })
    expect((await remainingFor(next)).available).toBe(3000)

    await asActor(() => s.adjustments.clearBudgetFortnightAdjustment(budgetId, owner(), current))
    expect((await remainingFor(current)).available).toBe(3000)
  })

  it('splits an amount across categories and is visible on the Presupuestos card', async () => {
    const [current] = s.adjustments.adjustableQuincenas()
    await asActor(() =>
      s.adjustments.setBudgetFortnightAdjustment(budgetId, owner(), { ...current, kind: 'AMOUNTS', total: 1250.5 }),
    )
    const scope = await remainingFor(current)
    expect(scope.totalBudget).toBe(1250.5)
    const rows = await asActor(() => s.periods.listActivePeriods(owner(), new Date()))
    expect(rows[0]).toMatchObject({
      allocated_amount: 1250.5,
      template_amount: 3000,
      adjustment: { kind: 'AMOUNTS' },
    })
    await asActor(() => s.adjustments.clearBudgetFortnightAdjustment(budgetId, owner(), current))
  })

  it('refuses a closed quincena and one beyond the next', async () => {
    const [current] = s.adjustments.adjustableQuincenas()
    const previous = s.calendar.getCurrentCalendarFortnightRef(
      new Date(Date.now() - 16 * 24 * 60 * 60 * 1000),
    )
    const later = s.calendar.getNextCalendarFortnight(new Date(Date.now() + 16 * 24 * 60 * 60 * 1000))
    await expect(
      s.adjustments.setBudgetFortnightAdjustment(budgetId, owner(), { ...previous, kind: 'PAUSE' }),
    ).rejects.toMatchObject({ code: 'ADJUSTMENT_CLOSED_QUINCENA', status: 422 })
    await expect(
      s.adjustments.setBudgetFortnightAdjustment(budgetId, owner(), { ...later, kind: 'PAUSE' }),
    ).rejects.toMatchObject({ code: 'ADJUSTMENT_QUINCENA_TOO_FAR', status: 422 })
    expect(current).toBeDefined()
  })

  it('another owner cannot touch the budget', async () => {
    const [current] = s.adjustments.adjustableQuincenas()
    await expect(
      s.adjustments.setBudgetFortnightAdjustment(budgetId, { user_id: userId + 100000, house_id: null }, { ...current, kind: 'PAUSE' }),
    ).rejects.toMatchObject({ code: 'P2025' })
  })

  it('deactivating the budget drops the next quincena adjustment and keeps the current one', async () => {
    const [current, next] = s.adjustments.adjustableQuincenas()
    await asActor(async () => {
      await s.adjustments.setBudgetFortnightAdjustment(budgetId, owner(), { ...current, kind: 'PAUSE' })
      await s.adjustments.setBudgetFortnightAdjustment(budgetId, owner(), { ...next, kind: 'PAUSE' })
      await s.budget.deleteBudget(budgetId, owner())
    })
    const rows = await s.prisma.budgetFortnightAdjustment.findMany({ where: { budget_id: budgetId } })
    expect(rows.map((r) => `${r.year}-${r.month}-${r.period}`)).toEqual([
      `${current.year}-${current.month}-${current.period}`,
    ])
    await expect(
      s.adjustments.setBudgetFortnightAdjustment(budgetId, owner(), { ...next, kind: 'PAUSE' }),
    ).rejects.toMatchObject({ code: 'BUDGET_INACTIVE' })
  })
})
