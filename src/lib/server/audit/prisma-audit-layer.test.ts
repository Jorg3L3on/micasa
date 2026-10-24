import { afterEach, describe, expect, it, vi } from 'vitest'
import { runWithAuditActor } from './audit-context'
import { AuditActorMissingError, withAuditLayer } from './prisma-audit-layer'

type Call = { client: 'root' | 'tx'; what: string; args?: unknown }

/** A lazy PrismaPromise look-alike: runs only when awaited or batched. */
const lazyPromise = (calls: Call[], client: 'root' | 'tx', what: string, args?: unknown) => {
  const run = () => {
    calls.push({ client, what, args })
    return Promise.resolve({ ok: what })
  }
  return {
    then: (a?: (v: unknown) => unknown, b?: (e: unknown) => unknown) => run().then(a, b),
    requestTransaction: vi.fn(() => run()),
    [Symbol.toStringTag]: 'PrismaPromise',
  }
}

const fakeClient = () => {
  const calls: Call[] = []
  const delegates = (client: 'root' | 'tx') => ({
    expense: {
      update: (args: unknown) => lazyPromise(calls, client, 'expense.update', args),
      findMany: (args: unknown) => lazyPromise(calls, client, 'expense.findMany', args),
    },
    apiKey: { update: (args: unknown) => lazyPromise(calls, client, 'apiKey.update', args) },
    $executeRaw: (strings: TemplateStringsArray, ...values: unknown[]) =>
      lazyPromise(calls, client, strings.join('?'), values),
  })
  const tx = delegates('tx')
  const transactions: unknown[] = []
  const root = {
    ...delegates('root'),
    $transaction: vi.fn(async (arg: ((client: typeof tx) => unknown) | unknown[]) => {
      transactions.push(arg)
      if (typeof arg === 'function') return arg(tx)
      // Like Prisma: batch items run through requestTransaction, never then().
      return Promise.all((arg as { requestTransaction: () => unknown }[]).map((p) => p.requestTransaction()))
    }),
  }
  return { root, calls, transactions }
}

const actor = { source: 'WEB' as const, userId: 7, actorName: 'Luis', sessionId: 'sid-1' }

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('withAuditLayer', () => {
  it('re-issues an audited root write through $transaction, setting the actor first', async () => {
    const { root, calls, transactions } = fakeClient()
    const prisma = withAuditLayer(root)
    const result = await runWithAuditActor(actor, () => prisma.expense.update({ where: { id: 1 } }))
    expect(result).toEqual({ ok: 'expense.update' })
    expect(transactions).toHaveLength(1)
    expect(calls.map((c) => [c.client, c.what])).toEqual([
      ['tx', "SELECT set_config('micasa.audit_actor', ?, true)"],
      ['tx', 'expense.update'],
    ])
    const json = JSON.parse((calls[0]!.args as string[])[0]!)
    expect(json).toMatchObject({ v: 1, source: 'WEB', user_id: 7, actor_name: 'Luis', session_id: 'sid-1' })
    expect(json.batch_id).toEqual(expect.any(String))
  })

  it('passes writes on the tx client through untouched (no second transaction)', async () => {
    const { root, calls, transactions } = fakeClient()
    const prisma = withAuditLayer(root)
    await runWithAuditActor(actor, () =>
      prisma.$transaction(async (tx) => {
        await tx.expense.update({ where: { id: 1 } })
        await tx.expense.update({ where: { id: 2 } })
      }),
    )
    expect(transactions).toHaveLength(1)
    expect(calls.filter((c) => c.what === 'expense.update').map((c) => c.client)).toEqual(['tx', 'tx'])
  })

  it('gives a root-client write made inside a callback its own audited transaction', async () => {
    const { root, transactions } = fakeClient()
    const prisma = withAuditLayer(root)
    await runWithAuditActor(actor, () =>
      prisma.$transaction(async () => {
        await prisma.expense.update({ where: { id: 1 } })
      }),
    )
    expect(transactions).toHaveLength(2)
  })

  it('leaves reads and non-audited models alone', async () => {
    const { root, transactions } = fakeClient()
    const prisma = withAuditLayer(root)
    await prisma.expense.findMany({})
    await prisma.apiKey.update({ where: { id: 1 } })
    expect(transactions).toHaveLength(0)
  })

  it('prepends set_config to the array form and drops its result', async () => {
    const { root, calls } = fakeClient()
    const prisma = withAuditLayer(root)
    const results = await runWithAuditActor(actor, () =>
      prisma.$transaction([prisma.expense.update({ where: { id: 1 } }), prisma.expense.findMany({})]),
    )
    expect(results).toEqual([{ ok: 'expense.update' }, { ok: 'expense.findMany' }])
    expect(calls[0]!.what).toContain('set_config')
    expect(calls.map((c) => c.client)).toEqual(['root', 'root', 'root'])
  })

  it('throws outside production when an audited write has no actor', async () => {
    const { root } = fakeClient()
    const prisma = withAuditLayer(root)
    await expect(prisma.expense.update({ where: { id: 1 } })).rejects.toBeInstanceOf(AuditActorMissingError)
    await expect(
      prisma.$transaction(async (tx) => {
        await tx.expense.update({ where: { id: 1 } })
      }),
    ).rejects.toBeInstanceOf(AuditActorMissingError)
  })

  it('allows read-only transactions without an actor', async () => {
    const { root } = fakeClient()
    const prisma = withAuditLayer(root)
    await expect(prisma.$transaction(async (tx) => tx.expense.findMany({}))).resolves.toEqual({
      ok: 'expense.findMany',
    })
    await expect(prisma.$transaction([prisma.expense.findMany({})])).resolves.toEqual([{ ok: 'expense.findMany' }])
  })

  it('in production, writes without an actor go through and log audit.actor_missing', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const { root, calls, transactions } = fakeClient()
    const prisma = withAuditLayer(root)
    await expect(prisma.expense.update({ where: { id: 1 } })).resolves.toEqual({ ok: 'expense.update' })
    expect(transactions).toHaveLength(0)
    expect(calls.map((c) => c.what)).toEqual(['expense.update'])
    expect(warn).toHaveBeenCalledTimes(1)
    expect(JSON.parse(warn.mock.calls[0]![0] as string)).toMatchObject({
      severity: 'warn',
      event: 'audit.actor_missing',
      model: 'Expense',
      operation: 'update',
    })
  })
})
