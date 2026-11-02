import { randomUUID } from 'node:crypto'
import { PrismaPg } from '@prisma/adapter-pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PrismaClient } from '@/generated/prisma/client'
import { runWithAuditActor, setAuditLabel, type AuditActorInput } from '@/lib/server/audit/audit-context'
import { withAuditLayer } from '@/lib/server/audit/prisma-audit-layer'
import { DB_URL, auditRowsSince, closeTestPool, testPool, type AuditRow } from './db-test-utils'

/**
 * The layer from src/lib/prisma.ts over a real client: every write path leaves
 * audit rows with the actor of its scope.
 */
describe.skipIf(!DB_URL)('prisma audit layer (DB)', () => {
  const base = DB_URL ? new PrismaClient({ adapter: new PrismaPg({ connectionString: DB_URL }) }) : null
  const prisma = base ? withAuditLayer(base) : null
  let userId = 0
  let fortnightId = 0

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
  const actor = (over: Partial<AuditActorInput> = {}): AuditActorInput => ({
    source: 'WEB',
    userId,
    actorName: 'Luis Demo',
    sessionId: randomUUID(),
    requestId: randomUUID(),
    metadata: { route: '/api/expenses' },
    ...over,
  })

  beforeAll(async () => {
    await runWithAuditActor({ source: 'SYSTEM', label: 'test setup' }, async () => {
      const user = await prisma!.user.create({
        data: { name: 'Layer', email: `layer-${randomUUID()}@example.test`, password: 'x' },
      })
      userId = user.id
      const fortnight = await prisma!.fortnight.create({
        data: {
          user_id: user.id,
          start_date: new Date('2002-01-14T18:00:00Z'),
          end_date: new Date('2002-01-29T18:00:00Z'),
          label: 'Ene 2002 Q2',
          month: 1,
          year: 2002,
          period: 'SECOND',
        },
      })
      fortnightId = fortnight.id
    })
  })

  afterAll(async () => {
    await runWithAuditActor({ source: 'SYSTEM', label: 'test teardown' }, async () => {
      await prisma!.expense.deleteMany({ where: { user_id: userId } })
      await prisma!.wallet.deleteMany({ where: { user_id: userId } })
      await prisma!.fortnight.deleteMany({ where: { user_id: userId } })
      await prisma!.user.delete({ where: { id: userId } })
    })
    await base?.$disconnect()
    await closeTestPool()
  })

  const expectActor = (rows: AuditRow[], a: AuditActorInput, batchId?: string) => {
    expect(rows.length).toBeGreaterThan(0)
    for (const r of rows) {
      expect(r).toMatchObject({
        source: a.source,
        actor_user_id: userId,
        actor_name: 'Luis Demo',
        session_id: a.sessionId,
        request_id: a.requestId,
      })
      expect(r.batch_id).toEqual(batchId ?? expect.any(String))
      expect(r.metadata).toEqual({ route: '/api/expenses' })
    }
    expect(new Set(rows.map((r) => r.batch_id)).size).toBe(1)
  }

  it('a standalone write runs in its own transaction with the actor', async () => {
    const since = await maxId()
    const a = actor({ batchId: randomUUID() })
    await runWithAuditActor(a, () =>
      prisma!.wallet.create({ data: { name: 'Efectivo', type: 'CASH', user_id: userId } }),
    )
    const rows = await rowsSince(since)
    expect(rows.map((r) => [r.entity_type, r.action])).toEqual([['Wallet', 'CREATE']])
    expectActor(rows, a, a.batchId)
  })

  it('an interactive transaction stamps every write; a label set mid-batch applies from then on', async () => {
    const since = await maxId()
    const a = actor()
    await runWithAuditActor(a, async () => {
      const w = await prisma!.wallet.create({ data: { name: 'Débito', type: 'DEBIT_CARD', user_id: userId } })
      setAuditLabel('Importación de prueba')
      await prisma!.$transaction(async (tx) => {
        await tx.wallet.update({ where: { id: w.id }, data: { amount: { increment: 10 } } })
        await tx.expense.create({
          data: { description: 'Luz', amount: 10, fortnight_id: fortnightId, user_id: userId, wallet_id: w.id },
        })
      })
    })
    const rows = await rowsSince(since)
    expect(rows.map((r) => [r.entity_type, r.action])).toEqual([
      ['Wallet', 'CREATE'],
      ['Wallet', 'UPDATE'],
      ['Expense', 'CREATE'],
    ])
    expectActor(rows, a)
    expect(rows.map((r) => r.label)).toEqual([null, 'Importación de prueba', 'Importación de prueba'])
    expect(rows[1]!.txid).toBe(rows[2]!.txid)
  })

  it('the array form stamps the batch and returns only the caller results', async () => {
    const since = await maxId()
    const a = actor()
    const results = await runWithAuditActor(a, async () => {
      const w = await prisma!.wallet.create({ data: { name: 'Ahorro', type: 'CASH', user_id: userId } })
      return prisma!.$transaction([
        prisma!.wallet.update({ where: { id: w.id }, data: { name: 'Ahorro casa' } }),
        prisma!.wallet.findUnique({ where: { id: w.id } }),
      ])
    })
    expect(results).toHaveLength(2)
    expect(results[1]).toMatchObject({ name: 'Ahorro casa' })
    const rows = await rowsSince(since)
    expect(rows.map((r) => r.action)).toEqual(['CREATE', 'UPDATE'])
    expectActor(rows, a)
  })

  it('a root-client write inside a callback still carries the actor', async () => {
    const since = await maxId()
    const a = actor()
    await runWithAuditActor(a, () =>
      prisma!.$transaction(async () => {
        await prisma!.wallet.create({ data: { name: 'Sobre', type: 'CASH', user_id: userId } })
      }),
    )
    expectActor(await rowsSince(since), a)
  })

  it('a transaction that throws leaves no audit row', async () => {
    const since = await maxId()
    await runWithAuditActor(actor(), () =>
      prisma!
        .$transaction(async (tx) => {
          await tx.wallet.create({ data: { name: 'Nunca', type: 'CASH', user_id: userId } })
          throw new Error('boom')
        })
        .catch(() => undefined),
    )
    expect(await rowsSince(since)).toEqual([])
  })

  it('agent and admin sources reach the row', async () => {
    const since = await maxId()
    await runWithAuditActor(actor({ source: 'AGENT', apiKeyId: 41, metadata: { route: '/api/expenses' } }), () =>
      prisma!.wallet.create({ data: { name: 'Agente', type: 'CASH', user_id: userId } }),
    )
    const [row] = await rowsSince(since)
    expect(row).toMatchObject({ source: 'AGENT', api_key_id: 41 })
  })
})
