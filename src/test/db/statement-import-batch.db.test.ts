import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { DB_URL, auditRowsSince, closeTestPool, testPool, type AuditRow } from './db-test-utils'

// The PDF layer is out of scope here: the parser returns two purchases.
vi.mock('@/lib/server/credit-card-statement/parse-mercado-pago-statement', async (importOriginal) => {
  const original = await importOriginal<object>()
  return {
    ...original,
    extractMercadoPagoStatementText: vi.fn(async () => 'Estado de cuenta Mercado Pago '.repeat(4)),
    parseMercadoPagoStatementText: vi.fn(() => ({
      accountNumber: '1234',
      statementIssueDate: new Date('2026-09-20T18:00:00Z'),
      statementYear: 2026,
      periodStart: new Date('2026-08-21T18:00:00Z'),
      periodEnd: new Date('2026-09-20T18:00:00Z'),
      totalDue: 350,
      movements: [
        { rawLine: 'a', day: 2, month: 9, description: 'Compra en OXXO', amount: 150, paymentDate: new Date('2026-09-02T18:00:00Z') },
        { rawLine: 'b', day: 5, month: 9, description: 'Compra en Farmacia', amount: 200, paymentDate: new Date('2026-09-05T18:00:00Z') },
      ],
      warnings: [],
    })),
  }
})

/**
 * Statement import and its rollback are each one labelled batch: every audit
 * row they produce shares the request's batch_id and the label.
 */
describe.skipIf(!DB_URL)('statement import batches (DB)', () => {
  let prisma: typeof import('@/lib/prisma').default
  let audit: typeof import('@/lib/server/audit/audit-context')
  let userId = 0
  let cardId = 0

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

  beforeAll(async () => {
    prisma = (await import('@/lib/prisma')).default
    audit = await import('@/lib/server/audit/audit-context')
    await audit.runWithAuditActor({ source: 'SYSTEM', label: 'test setup' }, async () => {
      const user = await prisma.user.create({
        data: { name: 'Importa', email: `import-${randomUUID()}@example.test`, password: 'x' },
      })
      userId = user.id
      const card = await prisma.wallet.create({
        data: { name: 'Mercado Pago', type: 'CREDIT_CARD', credit_limit: 10000, cutoff_day: 20, due_day: 5, user_id: user.id },
      })
      cardId = card.id
    })
  })

  afterAll(async () => {
    await closeTestPool()
  })

  const expectOneBatch = (rows: AuditRow[], label: string) => {
    expect(rows.length).toBeGreaterThan(0)
    expect(new Set(rows.map((r) => r.batch_id)).size).toBe(1)
    expect(rows.every((r) => r.label === label)).toBe(true)
    expect(rows.every((r) => r.source === 'WEB' && r.actor_user_id === userId)).toBe(true)
    expect(rows.some((r) => r.metadata?.missing_actor)).toBe(false)
  }

  it('an import and its rollback are each one labelled batch', async () => {
    const { importStatementPdf } = await import('@/lib/server/credit-card-statement/statement-import.service')
    const { rollbackCreditCardStatementImport } = await import(
      '@/lib/server/credit-card-statement/rollback-statement-import.service'
    )
    const webActor = () => ({ source: 'WEB' as const, userId, actorName: 'Importa', sessionId: randomUUID() })
    const ownerFilter = { user_id: userId, house_id: null }

    const beforeImport = await maxId()
    const result = await audit.runWithAuditActor(webActor(), () =>
      importStatementPdf('MERCADO_PAGO', {
        buffer: Buffer.from('%PDF-fake'),
        fileName: 'estado.pdf',
        mimeType: 'application/pdf',
        storeFile: false,
        creditCardWalletId: cardId,
        ownerType: 'user',
        ownerId: userId,
        ownerFilter,
        categoryId: null,
        skipDuplicates: true,
        createdByUserId: userId,
      }),
    )
    expect(result.expensesCreated).toBe(2)
    const imported = await rowsSince(beforeImport)
    expectOneBatch(imported, 'Importación de estado de cuenta: Mercado Pago')
    expect(imported.filter((r) => r.entity_type === 'Expense' && r.action === 'CREATE')).toHaveLength(2)
    expect(imported.some((r) => r.entity_type === 'CreditCardStatementImport')).toBe(true)

    const beforeRollback = await maxId()
    await audit.runWithAuditActor(webActor(), () =>
      rollbackCreditCardStatementImport({ creditCardWalletId: cardId, importId: result.importId, ownerFilter }),
    )
    const rolledBack = await rowsSince(beforeRollback)
    expectOneBatch(rolledBack, 'Reversión de importación de estado de cuenta: Mercado Pago')
    expect(rolledBack.filter((r) => r.entity_type === 'Expense' && r.action === 'DELETE')).toHaveLength(2)
    expect(imported[0]!.batch_id).not.toBe(rolledBack[0]!.batch_id)
  })
})
