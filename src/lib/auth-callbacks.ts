import type { JWT } from 'next-auth/jwt';
import type { Session, User } from 'next-auth';

/**
 * NextAuth `jwt` / `session` callbacks.
 *
 * `sid` identifies one login (one JWT): minted when the user signs in and copied
 * onto every audit row and auth event of that session. Tokens issued before it
 * existed get one on their next refresh.
 */
export const jwtCallback = async ({ token, user }: { token: JWT; user?: User | null }): Promise<JWT> => {
  if (user) {
    token.id = user.id;
    token.name = user.name;
    token.email = user.email;
    token.houses = user.houses?.map((h) => ({ id: h.id, name: h.name })) ?? [];
    token.sid = globalThis.crypto.randomUUID();
  }
  if (!token.sid) token.sid = globalThis.crypto.randomUUID();
  return token;
};

export const sessionCallback = async ({ session, token }: { session: Session; token: JWT }): Promise<Session> => {
  if (token) {
    session.user.id = token.id as string;
    session.user.name = token.name as string;
    session.user.email = token.email as string;
    session.user.houses = (token.houses ?? []) as { id: number; name: string }[];
    session.sid = token.sid;
  }
  return session;
};
