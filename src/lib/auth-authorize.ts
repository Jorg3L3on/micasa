import { compare } from 'bcryptjs';
import type { User } from 'next-auth';

/**
 * Credentials check for NextAuth, with the auth trail: LOGIN with the new
 * session id on success, LOGIN_FAILED with a reason otherwise. The typed
 * password never reaches the event, and an unknown email is not stored.
 *
 * Prisma and the recorder are imported lazily: `auth.ts` is also loaded by the
 * proxy, which must not pull in the database client.
 */
export async function authorizeCredentials(
  credentials: Partial<Record<'email' | 'password', unknown>> | undefined,
  request?: Request,
): Promise<User | null> {
  if (!credentials?.email || !credentials?.password) {
    return null;
  }

  const prisma = (await import('./prisma')).default;
  const { recordAuthEvent } = await import('./server/audit/auth-events');

  const user = await prisma.user.findUnique({
    where: {
      email: credentials.email as string,
    },
    include: {
      memberships: { include: { house: true } },
    },
  });

  if (!user) {
    await recordAuthEvent('LOGIN_FAILED', {
      request,
      metadata: { reason: 'unknown_email', unknown_email: true },
    });
    return null;
  }

  if (!user.active) {
    await recordAuthEvent('LOGIN_FAILED', {
      userId: user.id,
      email: user.email,
      request,
      metadata: { reason: 'inactive' },
    });
    return null;
  }

  const isPasswordValid = await compare(
    credentials.password as string,
    user.password,
  );

  if (!isPasswordValid) {
    await recordAuthEvent('LOGIN_FAILED', {
      userId: user.id,
      email: user.email,
      request,
      metadata: { reason: 'wrong_password' },
    });
    return null;
  }

  const houses = user.memberships.map((m) => ({
    id: m.house.id,
    name: m.house.name,
  }));

  // The session id travels to the jwt callback, so LOGIN and the token share it.
  const sid = globalThis.crypto.randomUUID();
  await recordAuthEvent('LOGIN', {
    userId: user.id,
    email: user.email,
    sessionId: sid,
    request,
  });

  return {
    id: String(user.id),
    email: user.email,
    name: user.name,
    houses,
    sid,
  };
}
