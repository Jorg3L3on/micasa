import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import type { AuditBatchDto, AuditPage, AuditRowDto, AuthEventDto } from '@/types/audit'
import { DB_URL, closeTestPool, testPool } from './db-test-utils'

const { auth } = vi.hoisted(() => ({ auth: vi.fn() }))
vi.mock('@/lib/auth', () => ({ auth }))

/** /api/admin/audit and /api/admin/audit/sessions: admins only, every tenant. */
describe.skipIf(!DB_URL)('admin audit API (DB)', () => {
  let prisma: typeof import('@/lib/prisma').default
  let run: typeof import('@/lib/server/audit/audit-context').runWithAuditActor
  let routes: {
    changes: typeof import('@/app/api/admin/audit/route').GET
    sessions: typeof import('@/app/api/admin/audit/sessions/route').GET
    userChanges: typeof import('@/app/api/audit/route').GET
    userSessions: typeof import('@/app/api/audit/sessions/route').GET
  }
  const tag = randomUUID().slice(0, 8)
  const ids = { admin: 0, ana: 0, beto: 0, houseA: 0, houseB: 0, walletA: 0, walletB: 0, legacy: 0 }

  const as = (userId: number, email: string) =>
    auth.mockResolvedValue({ user: { id: String(userId), name: email, email }, sid: randomUUID() })
  const get = async <T>(handler: (r: Request) => Promise<Response>, path: string) => {
    const res = await handler(new Request(`http://localhost${path}`))
    return { status: res.status, body: (await res.json()) as T }
  }

  beforeAll(async () => {
    prisma = (await import('@/lib/prisma')).default
    run = (await import('@/lib/server/audit/audit-context')).runWithAuditActor
    routes = {
      changes: (await import('@/app/api/admin/audit/route')).GET,
      sessions: (await import('@/app/api/admin/audit/sessions/route')).GET,
      userChanges: (await import('@/app/api/audit/route')).GET,
      userSessions: (await import('@/app/api/audit/sessions/route')).GET,
    }
    await run({ source: 'SYSTEM', label: 'test setup' }, async () => {
      const mk = (name: string, isAdmin = false) =>
        prisma.user.create({
          data: { name, email: `${name.toLowerCase()}-${tag}@example.test`, password: 'x', is_admin: isAdmin },
        })
      ids.admin = (await mk('Soporte', true)).id
      ids.ana = (await mk('Ana')).id
      ids.beto = (await mk('Beto')).id
      for (const [key, owner] of [['houseA', ids.ana], ['houseB', ids.beto]] as const) {
        const h = await prisma.house.create({ data: { name: `Casa ${key} ${tag}`, owner_id: owner } })
        ids[key] = h.id
        await prisma.houseMember.create({ data: { house_id: h.id, user_id: owner, role: 'OWNER' } })
      }
    })
    await run({ source: 'WEB', userId: ids.ana, actorName: 'Ana' }, async () => {
      ids.walletA = (await prisma.wallet.create({ data: { name: 'Caja A', type: 'CASH', house_id: ids.houseA } })).id
    })
    await run({ source: 'WEB', userId: ids.beto, actorName: 'Beto' }, async () => {
      ids.walletB = (await prisma.wallet.create({ data: { name: 'Caja B', type: 'CASH', house_id: ids.houseB } })).id
    })
    // A write from the console: no actor.
    await testPool().query(`UPDATE "Wallet" SET name = 'Caja B (consola)' WHERE id = $1`, [ids.walletB])
    // Older admin trail row and auth events, including an unknown-email failure.
    const legacy = await prisma.adminAuditLog.create({
      data: { actor_user_id: ids.admin, target_user_id: ids.ana, action: 'admin.password_override', metadata: { password_length: 12 } },
    })
    ids.legacy = legacy.id
    await prisma.authEvent.createMany({
      data: [
        // Unique per run: the local test database keeps earlier runs' rows.
        { kind: 'LOGIN', user_id: ids.ana, session_id: randomUUID(), source: 'WEB', ip: `ip-${tag}` },
        { kind: 'LOGIN_FAILED', source: 'WEB', ip: `unknown-${tag}`, metadata: { reason: 'unknown_email', unknown_email: true } },
      ],
    })
  })

  afterAll(closeTestPool)

  it('answers 403 to a non-admin and 200 to an admin', async () => {
    as(ids.ana, `ana-${tag}@example.test`)
    expect((await get(routes.changes, '/api/admin/audit')).status).toBe(403)
    expect((await get(routes.sessions, '/api/admin/audit/sessions')).status).toBe(403)
    as(ids.admin, `soporte-${tag}@example.test`)
    expect((await get(routes.changes, '/api/admin/audit')).status).toBe(200)
    expect((await get(routes.sessions, '/api/admin/audit/sessions')).status).toBe(200)
  })

  it('an admin sees rows of several houses and can narrow to one owner or to "Fuera de la app"', async () => {
    as(ids.admin, `soporte-${tag}@example.test`)
    const all = await get<AuditPage<AuditRowDto>>(routes.changes, '/api/admin/audit?limit=200')
    const walletIds = all.body.items.filter((r) => r.entityType === 'Wallet').map((r) => r.entityId)
    expect(walletIds).toEqual(expect.arrayContaining([String(ids.walletA), String(ids.walletB)]))

    const houseB = await get<AuditPage<AuditRowDto>>(routes.changes, `/api/admin/audit?ownerType=house&ownerId=${ids.houseB}&limit=200`)
    expect(houseB.body.items.every((r) => r.entityId !== String(ids.walletA))).toBe(true)

    const outside = await get<AuditPage<AuditRowDto>>(routes.changes, '/api/admin/audit?missingActor=true&limit=200')
    expect(outside.body.items.length).toBeGreaterThan(0)
    expect(outside.body.items.every((r) => r.actor.missingActor)).toBe(true)
    expect(outside.body.items.some((r) => r.entityId === String(ids.walletB) && r.action === 'UPDATE')).toBe(true)

    const batches = await get<AuditPage<AuditBatchDto>>(routes.changes, '/api/admin/audit?groupBy=batch&missingActor=true')
    expect(batches.body.items.every((b) => b.actor.missingActor)).toBe(true)
  })

  it('merges the older AdminAuditLog rows as ADMIN changes', async () => {
    as(ids.admin, `soporte-${tag}@example.test`)
    const { body } = await get<AuditPage<AuditRowDto>>(routes.changes, `/api/admin/audit?ownerType=user&ownerId=${ids.ana}&limit=200`)
    const legacy = body.items.find((r) => r.id === String(-ids.legacy))
    expect(legacy).toMatchObject({
      label: 'Soporte asignó una contraseña temporal',
      entityType: 'User',
      entityId: String(ids.ana),
      actor: { source: 'ADMIN', name: 'Soporte' },
    })
    const batch = await get<AuditPage<AuditRowDto>>(routes.changes, `/api/admin/audit?batchId=admin:${ids.legacy}`)
    expect(batch.body.items.map((r) => r.id)).toEqual([String(-ids.legacy)])
  })

  it('shows failed logins on unknown emails only to admins', async () => {
    as(ids.admin, `soporte-${tag}@example.test`)
    const unknown = await get<AuditPage<AuthEventDto>>(routes.sessions, '/api/admin/audit/sessions?unknownOnly=true&limit=200')
    expect(unknown.body.items.every((e) => e.userId === null)).toBe(true)
    expect(unknown.body.items.some((e) => e.kind === 'LOGIN_FAILED' && e.ip === `unknown-${tag}`)).toBe(true)
    const byIp = await get<AuditPage<AuthEventDto>>(routes.sessions, `/api/admin/audit/sessions?ip=ip-${tag}`)
    expect(byIp.body.items.map((e) => e.userId)).toEqual([ids.ana])

    as(ids.ana, `ana-${tag}@example.test`)
    const own = await get<AuditPage<AuthEventDto>>(routes.userSessions, '/api/audit/sessions?limit=200')
    expect(own.body.items.every((e) => e.userId === ids.ana)).toBe(true)
    const house = await get<AuditPage<AuditRowDto>>(routes.userChanges, `/api/audit?ownerType=house&ownerId=${ids.houseA}&limit=200`)
    expect(house.body.items.some((r) => r.entityId === String(ids.walletB))).toBe(false)
    expect((await get(routes.userChanges, `/api/audit?ownerType=house&ownerId=${ids.houseB}`)).status).toBe(403)
  })
})
