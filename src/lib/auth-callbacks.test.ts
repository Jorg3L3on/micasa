import type { Session, User } from 'next-auth'
import type { JWT } from 'next-auth/jwt'
import { describe, expect, it } from 'vitest'
import { jwtCallback, sessionCallback } from './auth-callbacks'

const UUID = /^[0-9a-f-]{36}$/

const login = (): User => ({ id: '7', name: 'Luis', email: 'luis@example.test', houses: [{ id: 3, name: 'Casa' }] })
const emptySession = (): Session =>
  ({ user: {} as Session['user'], expires: '2099-01-01T00:00:00.000Z' }) as Session

describe('auth callbacks', () => {
  it('a login mints a new sid in the JWT and the session exposes it', async () => {
    const token = await jwtCallback({ token: {} as JWT, user: login() })
    expect(token.sid).toMatch(UUID)
    const session = await sessionCallback({ session: emptySession(), token })
    expect(session.sid).toBe(token.sid)
    expect(session.user).toMatchObject({ id: '7', name: 'Luis', houses: [{ id: 3, name: 'Casa' }] })
  })

  it('each login gets its own sid; refreshes keep it', async () => {
    const first = await jwtCallback({ token: {} as JWT, user: login() })
    const second = await jwtCallback({ token: {} as JWT, user: login() })
    expect(first.sid).not.toBe(second.sid)
    const refreshed = await jwtCallback({ token: { ...first } })
    expect(refreshed.sid).toBe(first.sid)
  })

  it('a token issued before sid existed gets one on refresh', async () => {
    const token = await jwtCallback({ token: { id: '7' } as JWT })
    expect(token.sid).toMatch(UUID)
  })
})
