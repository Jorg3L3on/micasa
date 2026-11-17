import { hash } from 'bcryptjs';
import type { JWT } from 'next-auth/jwt';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const { findUniqueUser, createAuthEvent } = vi.hoisted(() => ({
  findUniqueUser: vi.fn(),
  createAuthEvent: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    user: { findUnique: findUniqueUser },
    authEvent: { create: createAuthEvent },
  },
}));

import { authorizeCredentials } from './auth-authorize';
import { jwtCallback, signOutEvent } from './auth-callbacks';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36';
const request = () =>
  new Request('http://localhost/api/auth/callback/credentials', {
    method: 'POST',
    headers: { 'user-agent': UA, 'x-vercel-forwarded-for': '198.51.100.4' },
  });

let passwordHash = '';
const dbUser = (over: Record<string, unknown> = {}) => ({
  id: 7,
  name: 'Luis Demo',
  email: 'luis@example.test',
  password: passwordHash,
  active: true,
  memberships: [{ house: { id: 3, name: 'Casa' } }],
  ...over,
});

/** Every auth event payload written in the test, as stored. */
const writtenEvents = () =>
  createAuthEvent.mock.calls.map(([arg]) => (arg as { data: Record<string, unknown> }).data);

beforeAll(async () => {
  passwordHash = await hash('correct-horse', 4);
});

beforeEach(() => {
  findUniqueUser.mockReset();
  createAuthEvent.mockReset().mockResolvedValue({});
});

afterEach(() => vi.restoreAllMocks());

describe('authorizeCredentials auth trail', () => {
  it('wrong password: LOGIN_FAILED wrong_password, still null', async () => {
    findUniqueUser.mockResolvedValue(dbUser());
    const user = await authorizeCredentials({ email: 'luis@example.test', password: 'typed-wrong-secret' }, request());
    expect(user).toBeNull();
    expect(writtenEvents()).toEqual([
      expect.objectContaining({
        kind: 'LOGIN_FAILED',
        user: { connect: { id: 7 } },
        email: 'luis@example.test',
        metadata: { reason: 'wrong_password' },
        ip: '198.51.100.4',
        user_agent: 'Chrome · macOS',
      }),
    ]);
  });

  it('unknown email: LOGIN_FAILED without the email', async () => {
    findUniqueUser.mockResolvedValue(null);
    const user = await authorizeCredentials({ email: 'nobody@example.test', password: 'whatever-secret' }, request());
    expect(user).toBeNull();
    const [event] = writtenEvents();
    expect(event).toMatchObject({ kind: 'LOGIN_FAILED', email: null, metadata: { reason: 'unknown_email', unknown_email: true } });
    expect(event!.user).toBeUndefined();
    expect(JSON.stringify(event)).not.toContain('nobody@example.test');
  });

  it('inactive user: LOGIN_FAILED inactive', async () => {
    findUniqueUser.mockResolvedValue(dbUser({ active: false }));
    expect(await authorizeCredentials({ email: 'luis@example.test', password: 'correct-horse' }, request())).toBeNull();
    expect(writtenEvents()[0]).toMatchObject({ kind: 'LOGIN_FAILED', metadata: { reason: 'inactive' } });
  });

  it('success: LOGIN with the sid that ends up in the JWT; signOut writes LOGOUT with the same sid', async () => {
    findUniqueUser.mockResolvedValue(dbUser());
    const user = await authorizeCredentials({ email: 'luis@example.test', password: 'correct-horse' }, request());
    expect(user).toMatchObject({ id: '7', name: 'Luis Demo', houses: [{ id: 3, name: 'Casa' }] });

    const token = await jwtCallback({ token: {} as JWT, user: user! });
    const [login] = writtenEvents();
    expect(login).toMatchObject({ kind: 'LOGIN', session_id: token.sid, user: { connect: { id: 7 } } });
    expect(token.sid).toBe(user!.sid);

    await signOutEvent({ token });
    expect(writtenEvents()[1]).toMatchObject({ kind: 'LOGOUT', session_id: token.sid, user: { connect: { id: 7 } } });
  });

  it('never stores the typed password, the hash or the raw user agent', async () => {
    findUniqueUser.mockResolvedValueOnce(dbUser()).mockResolvedValueOnce(dbUser());
    await authorizeCredentials({ email: 'luis@example.test', password: 'typed-wrong-secret' }, request());
    await authorizeCredentials({ email: 'luis@example.test', password: 'correct-horse' }, request());
    const blob = JSON.stringify(writtenEvents());
    for (const secret of ['typed-wrong-secret', 'correct-horse', passwordHash, UA]) expect(blob).not.toContain(secret);
  });

  it('a failing auth-event write never blocks the login and is logged', async () => {
    findUniqueUser.mockResolvedValue(dbUser());
    createAuthEvent.mockRejectedValue(new Error('db down'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const user = await authorizeCredentials({ email: 'luis@example.test', password: 'correct-horse' }, request());
    expect(user).toMatchObject({ id: '7' });
    expect(JSON.parse(warn.mock.calls[0]![0] as string)).toMatchObject({
      event: 'auth_event.write_failed',
      kind: 'LOGIN',
      user_id: 7,
    });
  });
});
