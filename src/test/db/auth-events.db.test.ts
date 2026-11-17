import { randomUUID } from 'node:crypto'
import { hash } from 'bcryptjs'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { DB_URL, closeTestPool, testPool } from './db-test-utils'

/** Only the session is faked; routes and services write to the real database. */
const { auth } = vi.hoisted(() => ({ auth: vi.fn() }))
vi.mock('@/lib/auth', () => ({ auth }))

const BROWSER_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1'

type AuthEventRow = {
  id: string
  kind: string
  user_id: number | null
  email: string | null
  session_id: string | null
  source: string
  ip: string | null
  user_agent: string | null
  api_key_id: number | null
  oauth_grant_id: number | null
  actor_user_id: number | null
  metadata: Record<string, unknown> | null
}

const jsonRequest = (url: string, method: string, body?: unknown) =>
  new Request(`http://localhost${url}`, {
    method,
    headers: {
      'content-type': 'application/json',
      'user-agent': BROWSER_UA,
      'x-forwarded-for': '203.0.113.7, 10.0.0.1',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

describe.skipIf(!DB_URL)('auth events (DB)', () => {
  let prisma: typeof import('@/lib/prisma').default
  let runWithAuditActor: typeof import('@/lib/server/audit/audit-context').runWithAuditActor
  const tag = randomUUID().slice(0, 8)
  const password = `Pass-${tag}-1`
  let userId = 0
  let adminId = 0
  const sid = randomUUID()

  const eventsSince = async (since: string, where = ''): Promise<AuthEventRow[]> => {
    const { rows } = await testPool().query<AuthEventRow>(
      `SELECT id::text, kind::text, user_id, email, session_id, source::text, ip, user_agent,
              api_key_id, oauth_grant_id, actor_user_id, metadata
         FROM "AuthEvent" e WHERE e.id > $1::bigint ${where} ORDER BY e.id`,
      [since],
    )
    return rows
  }
  const maxId = async () => {
    const { rows } = await testPool().query<{ id: string }>(`SELECT coalesce(max(id), 0)::text AS id FROM "AuthEvent"`)
    return rows[0]!.id
  }
  /** No event may carry a typed password, a hash or the raw user agent. */
  const expectClean = (rows: AuthEventRow[], secrets: string[]) => {
    const blob = JSON.stringify(rows)
    for (const secret of [...secrets, BROWSER_UA, '$2a$', '$2b$']) expect(blob).not.toContain(secret)
    for (const row of rows) {
      for (const key of Object.keys(row.metadata ?? {})) expect(key).not.toMatch(/password|hash|secret|token/i)
    }
  }

  beforeAll(async () => {
    prisma = (await import('@/lib/prisma')).default
    runWithAuditActor = (await import('@/lib/server/audit/audit-context')).runWithAuditActor
    await runWithAuditActor({ source: 'SYSTEM', label: 'test setup' }, async () => {
      const user = await prisma.user.create({
        data: { name: 'Auth Events', email: `auth-${tag}@example.test`, password: await hash(password, 4) },
      })
      userId = user.id
      const admin = await prisma.user.create({
        data: { name: 'Soporte', email: `admin-${tag}@example.test`, password: 'x', is_admin: true },
      })
      adminId = admin.id
    })
  })

  beforeEach(() => {
    auth.mockResolvedValue({ user: { id: String(userId), name: 'Auth Events', email: `auth-${tag}@example.test` }, sid })
  })

  afterAll(closeTestPool)

  it('REGISTER: the new user, with IP and device family', async () => {
    auth.mockResolvedValue(null)
    const { POST } = await import('@/app/api/auth/register/route')
    const since = await maxId()
    const email = `new-${tag}@example.test`
    const res = await POST(jsonRequest('/api/auth/register', 'POST', { name: 'Nueva', email, password: `Reg-${tag}-9` }) as never)
    expect(res.status).toBe(201)
    const [event] = await eventsSince(since, `AND kind = 'REGISTER'`)
    const created = await prisma.user.findUniqueOrThrow({ where: { email } })
    expect(event).toMatchObject({ user_id: created.id, email, source: 'WEB', ip: '203.0.113.7', user_agent: 'Safari · iOS' })
    expectClean([event!], [`Reg-${tag}-9`])
  })

  it('PASSWORD_CHANGED: account password change, with the session id', async () => {
    const { PATCH } = await import('@/app/api/account/route')
    const since = await maxId()
    const newPassword = `New-${tag}-2`
    const res = await PATCH(
      jsonRequest('/api/account', 'PATCH', { currentPassword: password, newPassword, confirmPassword: newPassword }) as never,
    )
    expect(res.status).toBe(200)
    const events = await eventsSince(since)
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({ kind: 'PASSWORD_CHANGED', user_id: userId, session_id: sid })
    expectClean(events, [password, newPassword])
  })

  it('PASSWORD_OVERRIDDEN: target user, admin as actor, source ADMIN', async () => {
    const { setTemporaryPasswordForUser } = await import('@/lib/server/admin/password-override')
    const since = await maxId()
    await runWithAuditActor({ source: 'ADMIN', userId: adminId }, () =>
      setTemporaryPasswordForUser({
        admin: { userId: adminId, email: `admin-${tag}@example.test`, sessionId: 'admin-sid' },
        targetUserId: userId,
        temporaryPassword: `Temp-${tag}-3`,
        request: jsonRequest('/api/admin/users/x/password', 'POST'),
      }),
    )
    const events = await eventsSince(since)
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      kind: 'PASSWORD_OVERRIDDEN',
      user_id: userId,
      actor_user_id: adminId,
      source: 'ADMIN',
      session_id: 'admin-sid',
    })
    expectClean(events, [`Temp-${tag}-3`])
  })

  it('API_KEY_CREATED / API_KEY_REVOKED, then AGENT_AUTH_FAILED for the revoked token', async () => {
    const { POST } = await import('@/app/api/account/api-keys/route')
    const { DELETE } = await import('@/app/api/account/api-keys/[id]/route')
    const { verifyMcpBearerToken } = await import('@/lib/server/mcp-bearer-auth')
    const since = await maxId()

    const created = await POST(
      jsonRequest('/api/account/api-keys', 'POST', {
        name: 'Claude',
        scopes: ['read', 'write'],
        allowed_contexts: [{ ownerType: 'user', ownerId: userId }],
      }) as never,
    )
    expect(created.status).toBe(201)
    const { id: keyId, token } = (await created.json()) as { id: number; token: string }
    const revoked = await DELETE(jsonRequest(`/api/account/api-keys/${keyId}`, 'DELETE') as never, {
      params: Promise.resolve({ id: String(keyId) }),
    })
    expect(revoked.status).toBe(200)
    expect(await verifyMcpBearerToken(jsonRequest('/api/mcp', 'POST'), token)).toBeUndefined()

    const events = await eventsSince(since)
    expect(events.map((e) => [e.kind, e.user_id, e.api_key_id])).toEqual([
      ['API_KEY_CREATED', userId, keyId],
      ['API_KEY_REVOKED', userId, keyId],
      ['AGENT_AUTH_FAILED', userId, keyId],
    ])
    expect(events[2]).toMatchObject({ source: 'AGENT', metadata: { reason: 'Token de agente revocado', status: 401 } })
    expectClean(events, [token])
  })

  it('OAUTH_GRANT_ISSUED / OAUTH_GRANT_REVOKED (revocation endpoint and Conexiones)', async () => {
    const { issueGrant, revokeOAuthToken } = await import('@/lib/server/mcp-oauth/grants')
    const { DELETE } = await import('@/app/api/account/oauth-grants/[id]/route')
    const clientId = `client-${tag}`
    await prisma.mcpOAuthClient.create({ data: { client_id: clientId, client_name: 'ChatGPT', redirect_uris: ['https://example.test/cb'] } })
    const since = await maxId()

    const first = await issueGrant({ userId, clientId, scopes: ['read'], resource: 'http://localhost/api/mcp' })
    await revokeOAuthToken(first.access_token)
    await issueGrant({ userId, clientId, scopes: ['read'], resource: 'http://localhost/api/mcp' })
    const grants = await prisma.mcpOAuthGrant.findMany({ where: { client_id: clientId }, orderBy: { id: 'asc' } })
    const res = await DELETE(jsonRequest(`/api/account/oauth-grants/${grants[1]!.id}`, 'DELETE') as never, {
      params: Promise.resolve({ id: String(grants[1]!.id) }),
    })
    expect(res.status).toBe(200)

    const events = await eventsSince(since)
    expect(events.map((e) => [e.kind, e.oauth_grant_id, e.source])).toEqual([
      ['OAUTH_GRANT_ISSUED', grants[0]!.id, 'AGENT'],
      ['OAUTH_GRANT_REVOKED', grants[0]!.id, 'AGENT'],
      ['OAUTH_GRANT_ISSUED', grants[1]!.id, 'AGENT'],
      ['OAUTH_GRANT_REVOKED', grants[1]!.id, 'WEB'],
    ])
    expect(events.every((e) => e.user_id === userId)).toBe(true)
    expectClean(events, [first.access_token, first.refresh_token])
  })
})
