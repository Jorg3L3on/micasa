import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import type { AuditBatchDto, AuditPage, AuditRowDto, AuthEventDto } from '@/types/audit'
import { DB_URL, closeTestPool } from './db-test-utils'

const { auth } = vi.hoisted(() => ({ auth: vi.fn() }))
vi.mock('@/lib/auth', () => ({ auth }))

/**
 * /api/audit, /api/audit/sessions and /api/audit/export against real rows:
 * owner scoping, batch grouping, session visibility, cursors and CSV.
 */
describe.skipIf(!DB_URL)('audit read API (DB)', () => {
  let prisma: typeof import('@/lib/prisma').default
  let run: typeof import('@/lib/server/audit/audit-context').runWithAuditActor
  let routes: {
    list: typeof import('@/app/api/audit/route').GET
    sessions: typeof import('@/app/api/audit/sessions/route').GET
    exportCsv: typeof import('@/app/api/audit/export/route').GET
  }
  const tag = randomUUID().slice(0, 8)
  const ids = { ana: 0, beto: 0, caro: 0, house: 0, anaWallet: 0, betoWallet: 0, houseWallet: 0 }
  const anaSid = randomUUID()
  let importBatch = ''

  const as = (userId: number, name: string) =>
    auth.mockResolvedValue({ user: { id: String(userId), name, email: `${name}@example.test` }, sid: randomUUID() })
  const get = async <T>(handler: (r: Request) => Promise<Response>, query: string): Promise<{ status: number; body: T }> => {
    const res = await handler(new Request(`http://localhost/api/audit${query}`))
    return { status: res.status, body: (res.headers.get('content-type')?.includes('json') ? await res.json() : await res.text()) as T }
  }
  const house = () => `ownerType=house&ownerId=${ids.house}`

  beforeAll(async () => {
    prisma = (await import('@/lib/prisma')).default
    run = (await import('@/lib/server/audit/audit-context')).runWithAuditActor
    routes = {
      list: (await import('@/app/api/audit/route')).GET,
      sessions: (await import('@/app/api/audit/sessions/route')).GET,
      exportCsv: (await import('@/app/api/audit/export/route')).GET,
    }
    await run({ source: 'SYSTEM', label: 'test setup' }, async () => {
      const mk = (name: string) =>
        prisma.user.create({ data: { name, email: `${name.toLowerCase()}-${tag}@example.test`, password: 'x' } })
      ids.ana = (await mk('Ana')).id
      ids.beto = (await mk('Beto')).id
      ids.caro = (await mk('Caro')).id
      const h = await prisma.house.create({ data: { name: `Casa ${tag}`, owner_id: ids.ana } })
      ids.house = h.id
      await prisma.houseMember.createMany({
        data: [
          { house_id: h.id, user_id: ids.ana, role: 'OWNER' },
          { house_id: h.id, user_id: ids.caro, role: 'MEMBER' },
        ],
      })
    })
    // Personal and house writes, each as its own actor.
    await run({ source: 'WEB', userId: ids.ana, actorName: 'Ana', sessionId: anaSid }, async () => {
      ids.anaWallet = (await prisma.wallet.create({ data: { name: 'Ana efectivo', type: 'CASH', user_id: ids.ana } })).id
      ids.houseWallet = (await prisma.wallet.create({ data: { name: 'Caja casa', type: 'CASH', house_id: ids.house } })).id
      await prisma.wallet.update({ where: { id: ids.houseWallet }, data: { amount: 500 } })
    })
    await run({ source: 'WEB', userId: ids.beto, actorName: 'Beto' }, async () => {
      ids.betoWallet = (await prisma.wallet.create({ data: { name: 'Beto ahorro', type: 'CASH', user_id: ids.beto } })).id
    })
    importBatch = randomUUID()
    await run({ source: 'WEB', userId: ids.caro, actorName: 'Caro', batchId: importBatch, label: 'Importación de prueba' }, async () => {
      for (const n of ['Uno', 'Dos', 'Tres']) {
        await prisma.wallet.create({ data: { name: `Sobre ${n}`, type: 'CASH', house_id: ids.house } })
      }
    })
    await prisma.authEvent.createMany({
      data: [
        { kind: 'LOGIN', user_id: ids.ana, session_id: anaSid, source: 'WEB', ip: '203.0.113.1', user_agent: 'Safari · iOS' },
        { kind: 'PASSWORD_CHANGED', user_id: ids.ana, source: 'WEB' },
        { kind: 'API_KEY_CREATED', user_id: ids.ana, source: 'WEB', api_key_id: 1 },
        { kind: 'LOGIN', user_id: ids.caro, session_id: randomUUID(), source: 'WEB' },
        { kind: 'LOGIN_FAILED', user_id: ids.caro, source: 'WEB', metadata: { reason: 'wrong_password' } },
        { kind: 'LOGIN', user_id: ids.beto, session_id: randomUUID(), source: 'WEB' },
        { kind: 'LOGIN_FAILED', source: 'WEB', metadata: { reason: 'unknown_email', unknown_email: true } },
      ],
    })
  })

  afterAll(closeTestPool)

  it('scopes rows: a user sees only their own; a member sees the house; a non-member gets 403', async () => {
    as(ids.ana, 'Ana')
    const personal = await get<AuditPage<AuditRowDto>>(routes.list, '?limit=200')
    expect(personal.status).toBe(200)
    const personalIds = personal.body.items.map((r) => r.entityId)
    expect(personalIds).toContain(String(ids.anaWallet))
    expect(personalIds).not.toContain(String(ids.betoWallet))
    expect(personalIds).not.toContain(String(ids.houseWallet))

    const houseRows = await get<AuditPage<AuditRowDto>>(routes.list, `?${house()}&limit=200`)
    expect(houseRows.body.items.map((r) => r.entityId)).toContain(String(ids.houseWallet))
    expect(houseRows.body.items.every((r) => r.entityId !== String(ids.anaWallet))).toBe(true)

    as(ids.beto, 'Beto')
    expect((await get(routes.list, `?${house()}`)).status).toBe(403)
    expect((await get(routes.sessions, `?${house()}`)).status).toBe(403)
    expect((await get(routes.exportCsv, `?${house()}`)).status).toBe(403)
  })

  it('formats a row for people: summary, Spanish labels, money', async () => {
    as(ids.ana, 'Ana')
    const { body } = await get<AuditPage<AuditRowDto>>(routes.list, `?${house()}&entityType=Wallet&entityId=${ids.houseWallet}`)
    const update = body.items.find((r) => r.action === 'UPDATE')!
    expect(update.summary).toBe('editó Billetera: Caja casa')
    expect(update.changes).toEqual([{ field: 'amount', label: 'Saldo', before: '$0.00', after: '$500.00' }])
    expect(update.actor).toMatchObject({ name: 'Ana', source: 'WEB', missingActor: false })
    expect(update.sessionId).toBe(anaSid)
  })

  it('groupBy=batch summaries match the rows of each expanded batch', async () => {
    as(ids.caro, 'Caro')
    const { body } = await get<AuditPage<AuditBatchDto>>(routes.list, `?${house()}&groupBy=batch&limit=200`)
    const imported = body.items.find((b) => b.batchKey === importBatch)!
    expect(imported).toMatchObject({
      label: 'Importación de prueba',
      summary: 'Importación de prueba · 3 cambios',
      counts: { total: 3, create: 3, update: 0, delete: 0 },
      actor: { name: 'Caro' },
    })
    for (const batch of body.items) {
      const rows = await get<AuditPage<AuditRowDto>>(routes.list, `?${house()}&batchId=${encodeURIComponent(batch.batchKey)}&limit=200`)
      const items = rows.body.items
      expect(items).toHaveLength(batch.counts.total)
      expect(items.filter((r) => r.action === 'CREATE')).toHaveLength(batch.counts.create)
      expect(items.filter((r) => r.action === 'UPDATE')).toHaveLength(batch.counts.update)
      expect(items.filter((r) => r.action === 'DELETE')).toHaveLength(batch.counts.delete)
    }
  })

  it('sessions: own events in account context; members-only login kinds in house context', async () => {
    as(ids.ana, 'Ana')
    const mine = await get<AuditPage<AuthEventDto>>(routes.sessions, '?limit=200')
    expect(new Set(mine.body.items.map((e) => e.userId))).toEqual(new Set([ids.ana]))
    expect(mine.body.items.map((e) => e.kind).sort()).toEqual(['API_KEY_CREATED', 'LOGIN', 'PASSWORD_CHANGED'])

    const inHouse = await get<AuditPage<AuthEventDto>>(routes.sessions, `?${house()}&limit=200`)
    const events = inHouse.body.items
    expect(events.every((e) => e.userId === ids.ana || e.userId === ids.caro)).toBe(true)
    expect(events.every((e) => ['LOGIN', 'LOGOUT', 'LOGIN_FAILED'].includes(e.kind))).toBe(true)
    expect(events.some((e) => e.userId === null)).toBe(false)
    expect(events.map((e) => e.kind).sort()).toEqual(['LOGIN', 'LOGIN', 'LOGIN_FAILED'])

    const anaLogin = events.find((e) => e.kind === 'LOGIN' && e.userId === ids.ana)!
    expect(anaLogin).toMatchObject({ sessionId: anaSid, changeCount: 2, device: 'Safari · iOS', userName: 'Ana' })
    expect(events.find((e) => e.kind === 'LOGIN_FAILED')?.reason).toBe('wrong_password')

    const tokenKinds = await get<AuditPage<AuthEventDto>>(routes.sessions, `?${house()}&kind=API_KEY_CREATED`)
    expect(tokenKinds.body.items).toEqual([])
  })

  it('cursor pagination is stable while new rows arrive', async () => {
    as(ids.caro, 'Caro')
    const q = `?${house()}&limit=2`
    const first = await get<AuditPage<AuditRowDto>>(routes.list, q)
    expect(first.body.items).toHaveLength(2)
    expect(first.body.nextCursor).toBeTruthy()

    await run({ source: 'WEB', userId: ids.caro, actorName: 'Caro' }, () =>
      prisma.wallet.create({ data: { name: 'Nueva', type: 'CASH', house_id: ids.house } }),
    )
    const second = await get<AuditPage<AuditRowDto>>(routes.list, `${q}&cursor=${first.body.nextCursor}`)
    const all = await get<AuditPage<AuditRowDto>>(routes.list, `?${house()}&limit=200`)
    const expected = all.body.items.slice(3, 5).map((r) => r.id) // index 0 is the new row
    expect(second.body.items.map((r) => r.id)).toEqual(expected)
    expect(second.body.items.some((r) => first.body.items.some((f) => f.id === r.id))).toBe(false)
  })

  it('export CSV has the same rows as the list for a date range', async () => {
    as(ids.caro, 'Caro')
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(new Date())
    const range = `${house()}&from=${today}&to=${today}`
    const list = await get<AuditPage<AuditRowDto>>(routes.list, `?${range}&limit=200`)
    const csv = await get<string>(routes.exportCsv, `?${range}`)
    expect(csv.status).toBe(200)
    const lines = csv.body.trim().split('\n').slice(1)
    const fromCsv = new Set(lines.map((l) => { const c = l.split(','); return `${c[0]}|${c[5]}` }))
    const fromList = new Set(list.body.items.map((r) => `${r.occurredAt}|${r.entityId}`))
    expect(fromCsv).toEqual(fromList)
    expect(list.body.items.length).toBeGreaterThan(0)
  })
})
