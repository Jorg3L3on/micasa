import { randomUUID } from 'node:crypto'
import type { PoolClient } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { afterAll, describe, expect, it } from 'vitest'
import { PrismaClient } from '@/generated/prisma/client'
import { AUDIT_TRIGGER_NAME } from '@/lib/server/audit/audit-sql'
import {
  AUDITED_MODELS,
  OUTSIDE_APP_LABEL,
  SECRET_COLUMN_PATTERN,
  triggerArgs,
} from '@/lib/server/audit/audited-models'
import {
  DB_URL,
  auditRowsSince,
  closeTestPool,
  inRollback,
  insertReturningId,
  maxAuditId,
  setActor,
  testPool,
  type Actor,
  type AuditRow,
} from './db-test-utils'

const SECRET_RE = new RegExp(SECRET_COLUMN_PATTERN, 'i')

type Base = {
  userId: number
  houseId: number
  fortnightUser: number
  fortnightHouse: number
  walletUser: number
  walletUser2: number
  cardHouse: number
  categoryHouse: number
  budgetHouse: number
  loanHouse: number
  lenderHouse: number
  installmentPlanHouse: number
}

/** Rows every fixture can point at. Created with no actor (as "Fuera de la app"). */
const createBase = async (c: PoolClient): Promise<Base> => {
  const tag = randomUUID().slice(0, 8)
  const userId = await insertReturningId(
    c,
    `INSERT INTO "User"(name, email, password) VALUES ($1, $2, 'not-a-hash')`,
    [`Audit ${tag}`, `audit-${tag}@example.test`],
  )
  const houseId = await insertReturningId(c, `INSERT INTO "House"(name, owner_id) VALUES ($1, $2)`, [
    `Casa ${tag}`,
    userId,
  ])
  const fortnight = (owner: 'user_id' | 'house_id', id: number) =>
    insertReturningId(
      c,
      `INSERT INTO "Fortnight"(start_date, end_date, label, month, year, period, ${owner})
       VALUES ('1999-12-31 12:00', '2000-01-14 12:00', 'Ene 2000 Q1', 1, 2000, 'FIRST', $1)`,
      [id],
    )
  const wallet = (owner: 'user_id' | 'house_id', id: number, name: string) =>
    insertReturningId(c, `INSERT INTO "Wallet"(name, type, ${owner}) VALUES ($1, 'CASH', $2)`, [name, id])
  const cardHouse = await insertReturningId(
    c,
    `INSERT INTO "Wallet"(name, type, credit_limit, cutoff_day, due_day, house_id)
     VALUES ('Tarjeta', 'CREDIT_CARD', 10000, 5, 25, $1)`,
    [houseId],
  )
  return {
    userId,
    houseId,
    fortnightUser: await fortnight('user_id', userId),
    fortnightHouse: await fortnight('house_id', houseId),
    walletUser: await wallet('user_id', userId, 'Efectivo'),
    walletUser2: await wallet('user_id', userId, 'Ahorro'),
    cardHouse,
    categoryHouse: await insertReturningId(c, `INSERT INTO "Category"(name, house_id) VALUES ('Hogar', $1)`, [
      houseId,
    ]),
    budgetHouse: await insertReturningId(
      c,
      `INSERT INTO "Budget"(name, total_amount, frequency, house_id) VALUES ('Súper', 3000, 'WEEKLY', $1)`,
      [houseId],
    ),
    loanHouse: await insertReturningId(
      c,
      `INSERT INTO "Loan"(name, lender, type, principal_amount, payment_amount, payment_count, frequency,
                          start_date, payment_source, house_id)
       VALUES ('Auto', 'Banco', 'PERSONAL', 50000, 5000, 10, 'MONTHLY', '2026-01-15 12:00', 'WALLET', $1)`,
      [houseId],
    ),
    lenderHouse: await insertReturningId(c, `INSERT INTO "Lender"(name, house_id) VALUES ('Tío Beto', $1)`, [
      houseId,
    ]),
    installmentPlanHouse: await insertReturningId(
      c,
      `INSERT INTO "CreditCardInstallmentPlan"(credit_card_wallet_id, name, installment_amount, total_installments, house_id)
       VALUES ($1, 'Refri', 1000, 12, $2)`,
      [cardHouse, houseId],
    ),
  }
}

type Fixture = {
  insert: (c: PoolClient, b: Base) => Promise<number>
  /** Column and value the UPDATE step sets. */
  update: [string, unknown]
  owner: (b: Base, id: number) => ['USER' | 'HOUSE', number]
  label: string | null
}

const house = (b: Base): ['HOUSE', number] => ['HOUSE', b.houseId]
const user = (b: Base): ['USER', number] => ['USER', b.userId]

const FIXTURES: Record<string, Fixture> = {
  Expense: {
    insert: (c, b) =>
      insertReturningId(
        c,
        `INSERT INTO "Expense"(description, amount, fortnight_id, house_id) VALUES ('Luz CFE', 450.5, $1, $2)`,
        [b.fortnightHouse, b.houseId],
      ),
    update: ['amount', 480],
    owner: house,
    label: 'Luz CFE',
  },
  Income: {
    insert: (c, b) =>
      insertReturningId(
        c,
        `INSERT INTO "Income"(amount, source, received_at, fortnight_id, user_id) VALUES (12000, 'Nómina', '2000-01-10 12:00', $1, $2)`,
        [b.fortnightUser, b.userId],
      ),
    update: ['amount', 12500],
    owner: user,
    label: 'Nómina',
  },
  ExpenseTemplate: {
    insert: (c, b) => insertReturningId(c, `INSERT INTO "ExpenseTemplate"(name, house_id) VALUES ('Renta', $1)`, [b.houseId]),
    update: ['name', 'Renta depa'],
    owner: house,
    label: 'Renta',
  },
  IncomeTemplate: {
    insert: (c, b) => insertReturningId(c, `INSERT INTO "IncomeTemplate"(name, user_id) VALUES ('Sueldo', $1)`, [b.userId]),
    update: ['active', false],
    owner: user,
    label: 'Sueldo',
  },
  Category: {
    insert: (c, b) => insertReturningId(c, `INSERT INTO "Category"(name, house_id) VALUES ('Comida', $1)`, [b.houseId]),
    update: ['name', 'Comida y súper'],
    owner: house,
    label: 'Comida',
  },
  Wallet: {
    insert: (c, b) => insertReturningId(c, `INSERT INTO "Wallet"(name, type, user_id) VALUES ('Débito', 'DEBIT_CARD', $1)`, [b.userId]),
    update: ['amount', 250.75],
    owner: user,
    label: 'Débito',
  },
  WalletTransfer: {
    insert: (c, b) =>
      insertReturningId(
        c,
        `INSERT INTO "WalletTransfer"(amount, from_wallet_id, to_wallet_id, transferred_at, note, user_id)
         VALUES (500, $1, $2, '2000-01-05 12:00', 'Ahorro quincena', $3)`,
        [b.walletUser, b.walletUser2, b.userId],
      ),
    update: ['amount', 600],
    owner: user,
    label: 'Ahorro quincena',
  },
  Transfer: {
    insert: (c, b) =>
      insertReturningId(
        c,
        `INSERT INTO "Transfer"(amount, type, user_id, house_id, note) VALUES (1000, 'USER_TO_HOUSE', $1, $2, 'Aporte')`,
        [b.userId, b.houseId],
      ),
    update: ['amount', 1100],
    owner: house,
    label: 'Aporte',
  },
  Budget: {
    insert: (c, b) =>
      insertReturningId(c, `INSERT INTO "Budget"(name, total_amount, frequency, house_id) VALUES ('Gasolina', 800, 'WEEKLY', $1)`, [
        b.houseId,
      ]),
    update: ['total_amount', 900],
    owner: house,
    label: 'Gasolina',
  },
  BudgetPeriod: {
    insert: (c, b) =>
      insertReturningId(c, `INSERT INTO "BudgetPeriod"(budget_id, start_date, end_date) VALUES ($1, '2000-01-01 12:00', '2000-01-07 12:00')`, [
        b.budgetHouse,
      ]),
    update: ['end_date', '2000-01-08 12:00'],
    owner: house,
    label: null,
  },
  BudgetAllocation: {
    insert: (c, b) =>
      insertReturningId(c, `INSERT INTO "BudgetAllocation"(budget_id, category_id, amount) VALUES ($1, $2, 1500)`, [
        b.budgetHouse,
        b.categoryHouse,
      ]),
    update: ['amount', 1600],
    owner: house,
    label: null,
  },
  CreditCardPayment: {
    insert: (c, b) =>
      insertReturningId(
        c,
        `INSERT INTO "CreditCardPayment"(amount, paid_at, note, credit_card_wallet_id, house_id) VALUES (2000, '2000-01-10 12:00', 'Pago tarjeta', $1, $2)`,
        [b.cardHouse, b.houseId],
      ),
    update: ['amount', 2100],
    owner: house,
    label: 'Pago tarjeta',
  },
  CreditCardPaymentPlan: {
    insert: (c, b) =>
      insertReturningId(
        c,
        `INSERT INTO "CreditCardPaymentPlan"(credit_card_wallet_id, fortnight_id, planned_amount, house_id) VALUES ($1, $2, 1500, $3)`,
        [b.cardHouse, b.fortnightHouse, b.houseId],
      ),
    update: ['planned_amount', 1700],
    owner: house,
    label: null,
  },
  CreditCardScheduledPayment: {
    insert: (c, b) =>
      insertReturningId(
        c,
        `INSERT INTO "CreditCardScheduledPayment"(credit_card_wallet_id, due_date, amount, label, house_id) VALUES ($1, '2000-01-25 12:00', 3000, 'Pago fijo', $2)`,
        [b.cardHouse, b.houseId],
      ),
    update: ['amount', 3100],
    owner: house,
    label: 'Pago fijo',
  },
  CreditCardInstallmentPlan: {
    insert: (c, b) =>
      insertReturningId(
        c,
        `INSERT INTO "CreditCardInstallmentPlan"(credit_card_wallet_id, name, installment_amount, total_installments, house_id) VALUES ($1, 'MSI tele', 900, 6, $2)`,
        [b.cardHouse, b.houseId],
      ),
    update: ['paid_installments', 1],
    owner: house,
    label: 'MSI tele',
  },
  CreditCardInstallmentPlanPayment: {
    insert: (c, b) =>
      insertReturningId(
        c,
        `INSERT INTO "CreditCardInstallmentPlanPayment"(plan_id, sequence, due_date, amount) VALUES ($1, 1, '2000-01-25 12:00', 1000)`,
        [b.installmentPlanHouse],
      ),
    update: ['status', 'PAID'],
    owner: house,
    label: null,
  },
  CreditCardStatementImport: {
    insert: (c, b) =>
      insertReturningId(
        c,
        `INSERT INTO "CreditCardStatementImport"(provider, wallet_id, house_id, created_by_user_id, file_name, file_data)
         VALUES ('MERCADO_PAGO', $1, $2, $3, 'estado.pdf', '\\xdeadbeef'::bytea)`,
        [b.cardHouse, b.houseId, b.userId],
      ),
    update: ['total_due', 5400],
    owner: house,
    label: 'estado.pdf',
  },
  Loan: {
    insert: (c, b) =>
      insertReturningId(
        c,
        `INSERT INTO "Loan"(name, lender, type, principal_amount, payment_amount, payment_count, frequency, start_date, payment_source, house_id)
         VALUES ('Préstamo moto', 'Caja', 'PERSONAL', 20000, 2000, 10, 'MONTHLY', '2026-01-15 12:00', 'WALLET', $1)`,
        [b.houseId],
      ),
    update: ['payment_amount', 2100],
    owner: house,
    label: 'Préstamo moto',
  },
  LoanPayment: {
    insert: (c, b) =>
      insertReturningId(c, `INSERT INTO "LoanPayment"(loan_id, sequence, due_date, amount) VALUES ($1, 1, '2026-02-15', 5000)`, [
        b.loanHouse,
      ]),
    update: ['status', 'PAID'],
    owner: house,
    label: null,
  },
  Lender: {
    insert: (c, b) => insertReturningId(c, `INSERT INTO "Lender"(name, house_id) VALUES ('Prima Ana', $1)`, [b.houseId]),
    update: ['notes', 'sin intereses'],
    owner: house,
    label: 'Prima Ana',
  },
  LenderPayment: {
    insert: (c, b) =>
      insertReturningId(
        c,
        `INSERT INTO "LenderPayment"(lender_id, amount, paid_at, mode, note, house_id) VALUES ($1, 700, '2000-01-11 12:00', 'EXTERNAL', 'Abono', $2)`,
        [b.lenderHouse, b.houseId],
      ),
    update: ['amount', 750],
    owner: house,
    label: 'Abono',
  },
  House: {
    insert: (c, b) => insertReturningId(c, `INSERT INTO "House"(name, owner_id) VALUES ('Casa playa', $1)`, [b.userId]),
    update: ['name', 'Casa de playa'],
    owner: (_b, id) => ['HOUSE', id],
    label: 'Casa playa',
  },
  HouseMember: {
    insert: (c, b) => insertReturningId(c, `INSERT INTO "HouseMember"(house_id, user_id, role) VALUES ($1, $2, 'MEMBER')`, [b.houseId, b.userId]),
    update: ['role', 'ADMIN'],
    owner: house,
    label: null,
  },
  Fortnight: {
    insert: (c, b) =>
      insertReturningId(
        c,
        `INSERT INTO "Fortnight"(start_date, end_date, label, month, year, period, user_id)
         VALUES ('2001-01-15 12:00', '2001-01-30 12:00', 'Ene 2001 Q2', 1, 2001, 'SECOND', $1)`,
        [b.userId],
      ),
    update: ['closed', true],
    owner: user,
    label: 'Ene 2001 Q2',
  },
  User: {
    insert: (c) =>
      insertReturningId(c, `INSERT INTO "User"(name, email, password) VALUES ('Ana', $1, 'secret-hash')`, [
        `ana-${randomUUID().slice(0, 8)}@example.test`,
      ]),
    update: ['name', 'Ana María'],
    owner: (_b, id) => ['USER', id],
    label: 'Ana',
  },
}

const actor = (over: Partial<Actor> = {}): Actor => ({
  v: 1,
  source: 'WEB',
  actor_name: 'Luis Demo',
  session_id: randomUUID(),
  batch_id: randomUUID(),
  request_id: randomUUID(),
  metadata: { route: '/api/test' },
  ...over,
})

const noSecrets = (rows: AuditRow[]) => {
  for (const r of rows) {
    for (const blob of [r.before, r.after]) {
      for (const key of Object.keys(blob ?? {})) expect(key).not.toMatch(SECRET_RE)
    }
  }
}

describe.skipIf(!DB_URL)('audit triggers (DB)', () => {
  afterAll(closeTestPool)

  it('has a fixture for every audited model', () => {
    expect(Object.keys(FIXTURES).sort()).toEqual(AUDITED_MODELS.map((m) => m.model).sort())
  })

  it('installed triggers equal the list generated from audited-models.ts', async () => {
    const { rows } = await testPool().query<{ table: string; args: Buffer }>(
      `SELECT c.relname AS table, t.tgargs AS args
         FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
        WHERE t.tgname = $1 AND NOT t.tgisinternal`,
      [AUDIT_TRIGGER_NAME],
    )
    const installed = rows
      .map((r) => ({ table: r.table, args: r.args.toString('utf8').split('\0').slice(0, -1) }))
      .sort((a, b) => a.table.localeCompare(b.table))
    const expected = AUDITED_MODELS.map((m) => ({ table: m.model, args: triggerArgs(m) })).sort((a, b) =>
      a.table.localeCompare(b.table),
    )
    expect(installed).toEqual(expected)
  })

  for (const model of AUDITED_MODELS.map((m) => m.model)) {
    it(`${model}: CREATE / UPDATE / DELETE rows with owner, label, changed_fields and no secrets`, async () => {
      const fx = FIXTURES[model]!
      await inRollback(async (c) => {
        const base = await createBase(c)
        const a = actor({ user_id: base.userId })
        await setActor(c, a)
        const since = await maxAuditId(c)

        const id = await fx.insert(c, base)
        const [col, value] = fx.update
        await c.query(`UPDATE "${model}" SET "${col}" = $1 WHERE id = $2`, [value, id])
        await c.query(`UPDATE "${model}" SET "${col}" = "${col}" WHERE id = $1`, [id]) // no-op
        await c.query(`DELETE FROM "${model}" WHERE id = $1`, [id])

        const rows = (await auditRowsSince(c, since)).filter((r) => r.entity_type === model && r.entity_id === String(id))
        expect(rows.map((r) => r.action)).toEqual(['CREATE', 'UPDATE', 'DELETE'])
        const [owner, ownerId] = fx.owner(base, id)
        for (const r of rows) {
          expect(r).toMatchObject({
            source: 'WEB',
            actor_user_id: base.userId,
            actor_name: 'Luis Demo',
            session_id: a.session_id,
            batch_id: a.batch_id,
            request_id: a.request_id,
            owner_type: owner,
            owner_id: ownerId,
          })
          expect(r.metadata).toEqual({ route: '/api/test' })
        }
        const [created, updated, deleted] = rows as [AuditRow, AuditRow, AuditRow]
        expect(created.entity_label).toBe(fx.label)
        expect(created.before).toBeNull()
        expect(created.after).not.toBeNull()
        expect(updated.changed_fields).toEqual([col])
        expect(Object.keys(updated.before!)).toEqual([col])
        expect(Object.keys(updated.after!)).toEqual([col])
        expect(deleted.after).toBeNull()
        expect(deleted.before).not.toBeNull()
        noSecrets(rows)
      })
    })
  }

  it('CreditCardStatementImport never stores the PDF bytes', async () => {
    await inRollback(async (c) => {
      const base = await createBase(c)
      await setActor(c, actor())
      const since = await maxAuditId(c)
      await FIXTURES.CreditCardStatementImport!.insert(c, base)
      const [row] = (await auditRowsSince(c, since)).filter((r) => r.entity_type === 'CreditCardStatementImport')
      expect(row!.after).not.toHaveProperty('file_data')
      expect(row!.after).toHaveProperty('file_name', 'estado.pdf')
    })
  })

  it('User only records name, email, active and is_admin; a password change writes nothing', async () => {
    await inRollback(async (c) => {
      await setActor(c, actor())
      const since = await maxAuditId(c)
      const id = await FIXTURES.User!.insert(c, {} as Base)
      await c.query(`UPDATE "User" SET password = 'new-hash', onboarding_completed = true WHERE id = $1`, [id])
      await c.query(`UPDATE "User" SET active = false WHERE id = $1`, [id])
      const rows = (await auditRowsSince(c, since)).filter((r) => r.entity_type === 'User')
      expect(rows.map((r) => r.action)).toEqual(['CREATE', 'UPDATE'])
      expect(Object.keys(rows[0]!.after!).sort()).toEqual(['active', 'email', 'is_admin', 'name'])
      expect(rows[1]!.changed_fields).toEqual(['active'])
    })
  })

  it('cascade delete: children keep the parent owner', async () => {
    await inRollback(async (c) => {
      const base = await createBase(c)
      await FIXTURES.BudgetAllocation!.insert(c, base)
      await setActor(c, actor())
      const since = await maxAuditId(c)
      await c.query(`DELETE FROM "Budget" WHERE id = $1`, [base.budgetHouse])
      const rows = await auditRowsSince(c, since)
      const allocation = rows.find((r) => r.entity_type === 'BudgetAllocation')
      expect(rows.find((r) => r.entity_type === 'Budget')?.action).toBe('DELETE')
      expect(allocation).toMatchObject({ action: 'DELETE', owner_type: 'HOUSE', owner_id: base.houseId })
    })
  })

  it('no actor (NULL, empty, "null", invalid JSON) is recorded as SYSTEM + missing_actor, never rejected', async () => {
    for (const setting of [null, '', 'null', '{not json']) {
      await inRollback(async (c) => {
        const base = await createBase(c)
        if (setting !== null) await setActor(c, setting)
        const since = await maxAuditId(c)
        await c.query(`UPDATE "Wallet" SET name = 'Cartera' WHERE id = $1`, [base.walletUser])
        const [row] = await auditRowsSince(c, since)
        expect(row).toMatchObject({
          source: 'SYSTEM',
          label: OUTSIDE_APP_LABEL,
          actor_user_id: null,
          batch_id: null,
          owner_type: 'USER',
          owner_id: base.userId,
        })
        expect(row!.metadata).toMatchObject({ missing_actor: true })
        if (setting === '{not json') expect(row!.metadata).toMatchObject({ invalid_actor: true })
      })
    }
  })

  it('a deleted actor never breaks the write and the FK is nulled without tripping append-only', async () => {
    await inRollback(async (c) => {
      const base = await createBase(c)
      const ghost = await FIXTURES.User!.insert(c, base)
      await setActor(c, actor({ user_id: ghost }))
      const since = await maxAuditId(c)
      await c.query(`UPDATE "Wallet" SET name = 'Cartera' WHERE id = $1`, [base.walletUser])
      await c.query(`DELETE FROM "User" WHERE id = $1`, [ghost])
      await c.query(`UPDATE "Wallet" SET name = 'Cartera 2' WHERE id = $1`, [base.walletUser])
      const rows = (await auditRowsSince(c, since)).filter((r) => r.entity_type === 'Wallet')
      expect(rows.map((r) => r.actor_user_id)).toEqual([null, null])
      expect(rows.map((r) => r.actor_name)).toEqual(['Luis Demo', 'Luis Demo'])
    })
  })

  it('a transaction that throws leaves no audit row', async () => {
    const before = await testPool().query<{ n: string }>(`SELECT count(*)::text AS n FROM "AuditLog"`)
    await inRollback(async (c) => {
      await setActor(c, actor())
      await createBase(c)
      await c.query('SELECT 1/0').catch(() => undefined)
    })
    const after = await testPool().query<{ n: string }>(`SELECT count(*)::text AS n FROM "AuditLog"`)
    expect(after.rows[0]!.n).toBe(before.rows[0]!.n)
  })

  for (const table of ['AuditLog', 'AuthEvent']) {
    it(`${table} is append-only: UPDATE, DELETE and TRUNCATE raise`, async () => {
      await inRollback(async (c) => {
        if (table === 'AuditLog') {
          await createBase(c)
        } else {
          await c.query(`INSERT INTO "AuthEvent"(kind, source) VALUES ('LOGIN_FAILED', 'WEB')`)
        }
        for (const sql of [
          `UPDATE "${table}" SET metadata = '{"x":1}'`,
          `DELETE FROM "${table}"`,
          `TRUNCATE "${table}"`,
        ]) {
          await c.query('SAVEPOINT s')
          await expect(c.query(sql)).rejects.toThrow(/append-only/)
          await c.query('ROLLBACK TO SAVEPOINT s')
        }
      })
    })
  }

  describe('through Prisma', () => {
    const prisma = DB_URL ? new PrismaClient({ adapter: new PrismaPg({ connectionString: DB_URL }) }) : null
    afterAll(() => prisma?.$disconnect())

    /** Runs fn in an interactive transaction with the actor set, then rolls back. */
    const rolledBack = async (fn: (tx: PrismaClient) => Promise<void>) => {
      const rollback = new Error('rollback')
      await prisma!
        .$transaction(async (tx) => {
          await tx.$executeRaw`SELECT set_config('micasa.audit_actor', ${JSON.stringify(actor())}, true)`
          await fn(tx as unknown as PrismaClient)
          throw rollback
        })
        .catch((e) => {
          if (e !== rollback) throw e
        })
    }

    it('Wallet increment records exact before/after; deleteMany writes one row per deleted row; no-op update writes nothing', async () => {
      await rolledBack(async (tx) => {
        const u = await tx.user.create({ data: { name: 'Inc', email: `inc-${randomUUID()}@example.test`, password: 'x' } })
        const w = await tx.wallet.create({ data: { name: 'Caja', type: 'CASH', amount: 100.1, user_id: u.id } })
        const others = await Promise.all(
          ['A', 'B', 'C'].map((n) => tx.wallet.create({ data: { name: n, type: 'CASH', user_id: u.id } })),
        )
        const [{ id: since }] = await tx.$queryRaw<{ id: string }[]>`SELECT coalesce(max(id), 0)::text AS id FROM "AuditLog"`
        await tx.wallet.update({ where: { id: w.id }, data: { amount: { increment: 12.34 } } })
        await tx.wallet.update({ where: { id: w.id }, data: { name: 'Caja' } })
        const deleted = await tx.wallet.deleteMany({ where: { id: { in: others.map((o) => o.id) } } })
        const rows = await tx.$queryRaw<AuditRow[]>`
          SELECT action::text, entity_id, changed_fields, before, after
            FROM "AuditLog" WHERE id > ${since}::bigint AND entity_type = 'Wallet' ORDER BY id`
        expect(deleted.count).toBe(3)
        expect(rows.map((r) => r.action)).toEqual(['UPDATE', 'DELETE', 'DELETE', 'DELETE'])
        expect(rows[0]).toMatchObject({ changed_fields: ['amount'], before: { amount: 100.1 }, after: { amount: 112.44 } })
        expect(rows.slice(1).map((r) => r.entity_id).sort()).toEqual(others.map((o) => String(o.id)).sort())
      })
    })
  })
})
