import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { DB_URL, auditRowsSince, closeTestPool, testPool, type AuditRow } from './db-test-utils'
import type { ActionInstance, Obligation } from '@/lib/finance/cash-plan/types'
import type { LiquidityProjectionResponse } from '@/types/catalog'

/**
 * "Activar este plan" (MIC-I14-5): each step lands on an existing model, once,
 * and every write leaves an AuditLog row. Synthetic data on a local database.
 */
describe.skipIf(!DB_URL)('applyCashPlan (DB)', () => {
  let prisma: typeof import('@/lib/prisma').default
  let audit: typeof import('@/lib/server/audit/audit-context')
  let apply: typeof import('@/lib/finance/cash-plan/apply-plan.service')
  let userId = 0
  let cardId = 0
  let firstFortnightId = 0
  let secondFortnightId = 0
  let unpaidId = 0
  let paidId = 0
  let debitId = 0
  let loanId = 0

  const ownerFilter = () => ({ user_id: userId, house_id: null })
  const webActor = () => ({ source: 'WEB' as const, userId, actorName: 'Plan', sessionId: randomUUID() })

  const maxId = async () => {
    const { rows } = await testPool().query<{ id: string }>(`SELECT coalesce(max(id), 0)::text AS id FROM "AuditLog"`)
    return rows[0]!.id
  }
  const rowsSince = async (since: string): Promise<AuditRow[]> => {
    const client = await testPool().connect()
    try {
      return await auditRowsSince(client, since)
    } finally {
      client.release()
    }
  }

  const step = (overrides: Partial<ActionInstance> & Pick<ActionInstance, 'type'>): ActionInstance => ({
    label: overrides.type,
    riskTags: [],
    warnings: [],
    ...overrides,
  })

  const obligations = (): Obligation[] => [
    {
      id: `card-${cardId}`,
      kind: 'card_revolving',
      labelSynthetic: 'Tarjeta A',
      balanceTotal: 5000,
      statementDue: 1900,
      minimumDue: 620,
      aprAnnual: 0.6,
      dueInHorizon: true,
      dueDate: '2026-11-09',
      consequenceTier: 3,
    },
  ]

  const projection = (): Pick<LiquidityProjectionResponse, 'milestones'> => ({
    milestones: [
      {
        due_date: '2026-11-10',
        is_past_due: false,
        total_due: 500,
        cumulative_due_through_date: 500,
        funding_total: 1000,
        liquidity_headroom: 500,
        obligations: [unpaidId, paidId].map((id) => ({
          source: 'unpaid_expense' as const,
          wallet_id: 0,
          wallet_name: 'Efectivo',
          wallet_type: 'CASH',
          statement_start: '',
          statement_end: '',
          statement_due_date: '2026-11-10',
          last_statement_balance: 0,
          payments_applied_to_statement: 0,
          next_due_payment: 250,
          expense_id: id,
          expense_description: `Gasto ${id}`,
        })),
      },
    ],
  })

  beforeAll(async () => {
    prisma = (await import('@/lib/prisma')).default
    audit = await import('@/lib/server/audit/audit-context')
    apply = await import('@/lib/finance/cash-plan/apply-plan.service')
    const { resolveOrCreateFortnight } = await import('@/lib/fortnights')
    await audit.runWithAuditActor({ source: 'SYSTEM', label: 'test setup' }, async () => {
      const user = await prisma.user.create({
        data: { name: 'Plan', email: `plan-${randomUUID()}@example.test`, password: 'x' },
      })
      userId = user.id
      const card = await prisma.wallet.create({
        data: { name: 'Tarjeta A', type: 'CREDIT_CARD', amount: 5000, credit_limit: 20000, cutoff_day: 20, due_day: 5, user_id: user.id },
      })
      cardId = card.id
      const debit = await prisma.wallet.create({
        data: { name: 'Débito', type: 'DEBIT_CARD', amount: 9000, user_id: user.id },
      })
      debitId = debit.id
      const loan = await prisma.loan.create({
        data: {
          name: 'Préstamo A',
          lender: 'Prestamista A',
          type: 'PERSONAL',
          principal_amount: 12000,
          payment_amount: 1000,
          payment_count: 12,
          frequency: 'MONTHLY',
          start_date: new Date('2026-06-01T18:00:00Z'),
          payment_source: 'WALLET',
          source_wallet_id: debit.id,
          user_id: user.id,
        },
      })
      loanId = loan.id
      const first = await resolveOrCreateFortnight({ ownerType: 'user', ownerId: user.id, year: 2026, month: 11, period: 'FIRST' })
      firstFortnightId = first.id
      const unpaid = await prisma.expense.create({
        data: { description: 'Cine', amount: 300, is_paid: false, payment_date: new Date('2026-11-10T18:00:00Z'), fortnight_id: first.id, user_id: user.id },
      })
      unpaidId = unpaid.id
      const paid = await prisma.expense.create({
        data: { description: 'Cena', amount: 200, is_paid: true, payment_date: new Date('2026-11-03T18:00:00Z'), fortnight_id: first.id, user_id: user.id },
      })
      paidId = paid.id
    })
  })

  afterAll(async () => {
    await closeTestPool()
  })

  it('card steps upsert one CreditCardPaymentPlan per card and quincena; a second call writes nothing', async () => {
    const actions = [step({ type: 'pay_minimum', obligationId: `card-${cardId}`, amount: 620, dueDate: '2026-11-09' })]
    const run = () =>
      audit.runWithAuditActor(webActor(), () =>
        apply.applyCashPlan({ ownerFilter: ownerFilter(), actions, obligations: obligations(), projection: projection() }),
      )

    const before = await maxId()
    const first = await run()
    expect(first.writes).toEqual([
      expect.objectContaining({ kind: 'card_payment_plan', walletId: cardId, fortnightId: firstFortnightId, amount: 620, status: 'created' }),
    ])
    const created = await rowsSince(before)
    expect(created.filter((row) => row.entity_type === 'CreditCardPaymentPlan' && row.action === 'CREATE')).toHaveLength(1)
    expect(created.every((row) => row.source === 'WEB' && row.actor_user_id === userId)).toBe(true)

    const beforeSecond = await maxId()
    const second = await run()
    expect(second.writes).toEqual([expect.objectContaining({ status: 'unchanged', amount: 620 })])
    expect(await rowsSince(beforeSecond)).toHaveLength(0)
    expect(await prisma.creditCardPaymentPlan.count({ where: { credit_card_wallet_id: cardId } })).toBe(1)

    // An extra abono plans what is due on the card plus the extra, on the same row.
    const extra = await audit.runWithAuditActor(webActor(), () =>
      apply.applyCashPlan({
        ownerFilter: ownerFilter(),
        actions: [step({ type: 'extra_to_debt_avalanche', obligationId: `card-${cardId}`, amount: 1000, dueDate: '2026-11-09' })],
        obligations: obligations(),
        projection: projection(),
      }),
    )
    expect(extra.writes).toEqual([expect.objectContaining({ amount: 2900, status: 'updated' })])
    expect(await prisma.creditCardPaymentPlan.count({ where: { credit_card_wallet_id: cardId } })).toBe(1)
    const row = await prisma.creditCardPaymentPlan.findFirstOrThrow({ where: { credit_card_wallet_id: cardId } })
    expect(Number(row.planned_amount)).toBe(2900)
  })

  it('a deferral moves the unpaid expense to the next quincena and keeps it unpaid; a paid one is refused', async () => {
    const before = await maxId()
    const result = await audit.runWithAuditActor(webActor(), () =>
      apply.applyCashPlan({
        ownerFilter: ownerFilter(),
        actions: [
          step({ type: 'defer_nonessential', obligationId: `bill-${unpaidId}`, amount: 300 }),
          step({ type: 'defer_nonessential', obligationId: `bill-${paidId}`, amount: 200 }),
        ],
        obligations: [],
        projection: projection(),
      }),
    )
    const moved = await prisma.expense.findUniqueOrThrow({
      where: { id: unpaidId },
      include: { fortnight: true },
    })
    secondFortnightId = moved.fortnight_id
    expect(moved.fortnight.period).toBe('SECOND')
    expect(moved.fortnight.month).toBe(11)
    expect(moved.is_paid).toBe(false)
    expect(result.writes).toEqual([
      expect.objectContaining({ kind: 'expense_moved', expenseId: unpaidId, fromFortnightId: firstFortnightId, toFortnightId: secondFortnightId }),
    ])

    const paid = await prisma.expense.findUniqueOrThrow({ where: { id: paidId } })
    expect(paid.fortnight_id).toBe(firstFortnightId)
    expect(result.skipped).toEqual([expect.objectContaining({ type: 'defer_nonessential', reason: expect.stringMatching(/pagado/) })])

    const rows = await rowsSince(before)
    expect(rows.some((row) => row.entity_type === 'Expense' && row.action === 'UPDATE' && row.entity_id === String(unpaidId))).toBe(true)
    expect(rows.some((row) => row.entity_type === 'Expense' && row.entity_id === String(paidId))).toBe(false)
  })

  it('buffer, MSI, bridge and consolidate write nothing', async () => {
    const before = await maxId()
    const countBefore = await prisma.creditCardPaymentPlan.count({ where: { user_id: userId } })
    const result = await audit.runWithAuditActor(webActor(), () =>
      apply.applyCashPlan({
        ownerFilter: ownerFilter(),
        actions: [
          step({ type: 'buffer_reserve', amount: 1300 }),
          step({ type: 'pay_msi_installment', obligationId: 'msi-1', amount: 400, dueDate: '2026-11-09' }),
          step({ type: 'bridge_loan', amount: 3000 }),
          step({ type: 'consolidate', amount: 8000 }),
        ],
        obligations: obligations(),
        projection: projection(),
      }),
    )
    expect(result.writes).toEqual([])
    expect(result.skipped.map((item) => item.type)).toEqual(['buffer_reserve', 'pay_msi_installment', 'bridge_loan', 'consolidate'])
    expect(await rowsSince(before)).toHaveLength(0)
    expect(await prisma.creditCardPaymentPlan.count({ where: { user_id: userId } })).toBe(countBefore)
  })

  it('an extra abono to a loan is one unpaid planned expense on the source wallet; a second call writes nothing', async () => {
    const actions = [
      step({ type: 'extra_to_debt_avalanche', obligationId: `loan-${loanId}`, amount: 1500, dueDate: '2026-11-12', fromWalletId: debitId }),
    ]
    const loanObligation: Obligation = {
      id: `loan-${loanId}`, kind: 'loan', labelSynthetic: 'Préstamo A', balanceTotal: 9000, statementDue: 1000,
      aprAnnual: 0.4, dueInHorizon: true, dueDate: '2026-11-12', consequenceTier: 3,
    }
    const run = () =>
      audit.runWithAuditActor(webActor(), () =>
        apply.applyCashPlan({ ownerFilter: ownerFilter(), actions, obligations: [loanObligation], projection: projection() }),
      )
    const before = await maxId()
    const first = await run()
    expect(first.skipped).toEqual([])
    expect(first.writes).toEqual([
      expect.objectContaining({ kind: 'loan_abono_planned', loanId, amount: 1500, status: 'created', fortnightId: firstFortnightId }),
    ])
    const write = first.writes[0] as Extract<(typeof first.writes)[number], { kind: 'loan_abono_planned' }>
    const expense = await prisma.expense.findUniqueOrThrow({ where: { id: write.expenseId } })
    expect(expense.description).toBe('Abono extra · Préstamo A')
    expect(expense.is_paid).toBe(false)
    expect(expense.wallet_id).toBe(debitId)
    expect(Number(expense.amount)).toBe(1500)
    // Unpaid: the debit wallet does not move.
    expect(Number((await prisma.wallet.findUniqueOrThrow({ where: { id: debitId } })).amount)).toBe(9000)
    const rows = await rowsSince(before)
    expect(rows.some((row) => row.entity_type === 'Expense' && row.action === 'CREATE' && row.entity_id === String(expense.id))).toBe(true)

    const beforeSecond = await maxId()
    const second = await run()
    expect(second.writes).toEqual([expect.objectContaining({ status: 'unchanged', expenseId: expense.id })])
    expect(await rowsSince(beforeSecond)).toHaveLength(0)
    expect(await prisma.expense.count({ where: { user_id: userId, description: 'Abono extra · Préstamo A' } })).toBe(1)
  })

  it('a card plan stops at what the card owes and creates a quincena the Panel has not opened yet', async () => {
    const before = await prisma.fortnight.count({ where: { user_id: userId, year: 2027, month: 1 } })
    expect(before).toBe(0)
    const result = await audit.runWithAuditActor(webActor(), () =>
      apply.applyCashPlan({
        ownerFilter: ownerFilter(),
        actions: [step({ type: 'pay_off', obligationId: `card-${cardId}`, amount: 6200, dueDate: '2027-01-05' })],
        obligations: obligations(),
        projection: projection(),
      }),
    )
    const fortnight = await prisma.fortnight.findFirstOrThrow({ where: { user_id: userId, year: 2027, month: 1, period: 'FIRST' } })
    expect(result.writes).toEqual([
      expect.objectContaining({ kind: 'card_payment_plan', amount: 5000, fortnightId: fortnight.id, status: 'created' }),
    ])
    expect(result.skipped).toEqual([expect.objectContaining({ reason: expect.stringMatching(/queda en \$0/) })])
  })

  it('the projection lists expected incomes by civil day', async () => {
    const { getLiquidityProjection } = await import('@/lib/finance/liquidity-projection.service')
    await audit.runWithAuditActor({ source: 'SYSTEM', label: 'test setup' }, async () => {
      await prisma.incomeTemplate.create({
        data: { name: 'Nómina', suggested_amount: 12000, applies_first_fortnight: true, applies_second_fortnight: true, user_id: userId },
      })
      await prisma.income.create({
        data: { source: 'Bono', amount: 800, received_at: new Date('2026-11-20T18:00:00Z'), fortnight_id: secondFortnightId, user_id: userId },
      })
    })
    const projectionResult = await audit.runWithAuditActor(webActor(), () =>
      getLiquidityProjection({
        ownerFilter: ownerFilter(),
        asOf: new Date('2026-11-07T18:00:00Z'),
        until: new Date('2026-11-30T18:00:00Z'),
      }),
    )
    const dates = projectionResult.income_dates ?? []
    expect(dates).toEqual(expect.arrayContaining([
      { date: '2026-11-14', amount: 12000, title: 'Nómina' },
      { date: '2026-11-29', amount: 12000, title: 'Nómina' },
      { date: '2026-11-20', amount: 800, title: 'Ingreso registrado' },
    ]))
    expect(dates.map((item) => item.date)).toEqual([...dates.map((item) => item.date)].sort())
  })
})
