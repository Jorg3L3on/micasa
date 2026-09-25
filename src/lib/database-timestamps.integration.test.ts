/**
 * Round-trip of `@db.Date` columns through the real Prisma client and its
 * timestamp shim.
 *
 * Loads `DATABASE_URL` from `.env` when the shell did not export it.
 *
 * Local run (Postgres must be up; see AGENTS.md):
 *   sudo pg_ctlcluster 16 main start
 *   npx prisma migrate deploy
 *   npm test -- src/lib/database-timestamps.integration.test.ts
 *
 * When the database is not reachable the test is skipped. The shim itself is
 * still covered by `database-timestamps.test.ts`.
 */
import 'dotenv/config'

import { afterAll, describe, expect, it } from 'vitest'
import { formatStoredDateOnly, parseDateOnly } from '@/lib/calendar-dates'
import { formatLoanDueYmd, loanDueDateForStorage } from '@/lib/finance/loan-schedule'
import prisma from '@/lib/prisma'

const CIVIL_DAY = '2026-09-12'

const databaseUrl = process.env.DATABASE_URL ?? ''
const databaseConfigured =
  databaseUrl.length > 0 && !databaseUrl.includes('prisma:prisma@127.0.0.1')

const canReachDatabase = async (): Promise<boolean> => {
  if (!databaseConfigured) return false
  try {
    await prisma.$queryRaw`SELECT 1`
    return true
  } catch {
    return false
  }
}

const roundTripDateColumns = async (timeZone: string) => {
  const previous = process.env.TZ
  process.env.TZ = timeZone
  const stamp = Date.now()
  const email = `date-shim-${timeZone.replace(/\//g, '-')}-${stamp}@example.test`
  let userId: number | null = null
  let walletId: number | null = null
  let fortnightId: number | null = null
  try {
    const user = await prisma.user.create({
      data: {
        name: 'Date Shim',
        email,
        password: 'synthetic',
      },
    })
    userId = user.id
    const wallet = await prisma.wallet.create({
      data: {
        name: 'Tarjeta sintetica',
        type: 'CREDIT_CARD',
        credit_limit: 1000,
        cutoff_day: 12,
        due_day: 20,
        user_id: user.id,
      },
    })
    walletId = wallet.id
    const fortnight = await prisma.fortnight.create({
      data: {
        start_date: parseDateOnly('2026-09-01'),
        end_date: parseDateOnly('2026-09-14'),
        label: 'Q1',
        month: 9,
        year: 2026,
        period: 'FIRST',
        user_id: user.id,
      },
    })
    fortnightId = fortnight.id
    const written = parseDateOnly(CIVIL_DAY)
    const created = await prisma.creditCardPaymentPlan.create({
      data: {
        credit_card_wallet_id: wallet.id,
        fortnight_id: fortnight.id,
        planned_amount: 10,
        scope: 'UNTIL_DATE',
        valid_until: written,
        anchor_statement_end: written,
        user_id: user.id,
      },
    })
    const read = await prisma.creditCardPaymentPlan.findUniqueOrThrow({
      where: { id: created.id },
    })
    expect(formatStoredDateOnly(read.anchor_statement_end!)).toBe(CIVIL_DAY)
    expect(formatStoredDateOnly(read.valid_until!)).toBe(CIVIL_DAY)
    expect(read.anchor_statement_end!.toISOString().slice(0, 10)).toBe(CIVIL_DAY)
    expect(read.valid_until!.toISOString().slice(0, 10)).toBe(CIVIL_DAY)
  } finally {
    if (walletId != null) {
      await prisma.creditCardPaymentPlan.deleteMany({
        where: { credit_card_wallet_id: walletId },
      })
    }
    if (fortnightId != null) {
      await prisma.fortnight.delete({ where: { id: fortnightId } })
    }
    if (walletId != null) {
      await prisma.wallet.delete({ where: { id: walletId } })
    }
    if (userId != null) {
      await prisma.user.delete({ where: { id: userId } })
    }
    if (previous == null) delete process.env.TZ
    else process.env.TZ = previous
  }
}

const loanDueBackfill = async (stamp: string) => {
  const rows = await prisma.$queryRaw<Array<{ civil_day: Date }>>`
    SELECT (
      CASE
        WHEN t::time = TIME '00:00:00' THEN t::date
        WHEN t::time = TIME '06:00:00' THEN t::date
        ELSE t::date
      END
    ) AS civil_day
    FROM (VALUES (${stamp}::timestamp)) AS sample(t)
  `
  return formatStoredDateOnly(rows[0]!.civil_day)
}

const roundTripLoanDueDate = async () => {
  const stamp = Date.now()
  const email = `loan-due-${stamp}@example.test`
  let userId: number | null = null
  let loanId: number | null = null
  try {
    const user = await prisma.user.create({
      data: { name: 'Prestamista A', email, password: 'synthetic' },
    })
    userId = user.id
    const loan = await prisma.loan.create({
      data: {
        name: 'Prestamo sintetico',
        lender: 'Prestamista A',
        type: 'PERSONAL',
        principal_amount: 1000,
        payment_amount: 500,
        payment_count: 2,
        frequency: 'MONTHLY',
        start_date: loanDueDateForStorage('2026-09-01'),
        payment_source: 'PAYROLL_DEDUCTION',
        user_id: user.id,
        payments: {
          create: [
            {
              sequence: 1,
              due_date: loanDueDateForStorage(new Date('2026-09-01T00:00:00.000Z')),
              amount: 500,
            },
            {
              sequence: 2,
              due_date: loanDueDateForStorage(new Date('2026-10-01T06:00:00.000Z')),
              amount: 500,
            },
          ],
        },
      },
      include: { payments: { orderBy: { sequence: 'asc' } } },
    })
    loanId = loan.id
    expect(formatLoanDueYmd(loan.payments[0]!.due_date)).toBe('2026-09-01')
    expect(formatLoanDueYmd(loan.payments[1]!.due_date)).toBe('2026-10-01')
    expect(await loanDueBackfill('2026-09-01 00:00:00')).toBe('2026-09-01')
    expect(await loanDueBackfill('2026-09-01 06:00:00')).toBe('2026-09-01')
    expect(await loanDueBackfill('2026-09-01 18:00:00')).toBe('2026-09-01')
  } finally {
    if (loanId != null) await prisma.loan.delete({ where: { id: loanId } })
    if (userId != null) await prisma.user.delete({ where: { id: userId } })
  }
}

describe('planned payment DATE columns through Prisma', () => {
  it.skipIf(!databaseConfigured)(
    'keeps the civil day under UTC and America/Mexico_City',
    async () => {
      expect(await canReachDatabase()).toBe(true)
      await roundTripDateColumns('UTC')
      await roundTripDateColumns('America/Mexico_City')
      await roundTripLoanDueDate()
    },
  )

  afterAll(async () => {
    if (!databaseConfigured) return
    await prisma.$disconnect()
  })
})
