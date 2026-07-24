import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';

export type AdminContext = {
  userId: number;
  email: string;
};

/** Parse `MICASA_ADMIN_EMAILS` (comma-separated) into a lowercase email set. */
export const parseAdminEmailAllowlist = (
  raw: string | undefined = process.env.MICASA_ADMIN_EMAILS,
): Set<string> => {
  if (!raw?.trim()) return new Set();
  return new Set(
    raw
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
};

export const isEmailInAdminAllowlist = (
  email: string,
  allowlist: Set<string> = parseAdminEmailAllowlist(),
): boolean => allowlist.has(email.trim().toLowerCase());

export const userHasAdminAccess = (user: {
  email: string;
  is_admin: boolean;
}): boolean =>
  user.is_admin === true || isEmailInAdminAllowlist(user.email);

/**
 * Live admin check (DB `is_admin` + env allowlist). Prefer this over JWT claims
 * so revocation takes effect immediately.
 */
export const requireAdmin = async (): Promise<AdminContext | null> => {
  const session = await auth();
  const sessionUserId = session?.user?.id;
  const sessionEmail = session?.user?.email;
  if (!sessionUserId || !sessionEmail) return null;

  const userId = Number(sessionUserId);
  if (!Number.isFinite(userId)) return null;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, is_admin: true, active: true },
  });

  if (!user || !user.active) return null;
  if (!userHasAdminAccess(user)) return null;

  return { userId: user.id, email: user.email };
};

/** API helper: 401 if anonymous, 403 if authenticated but not admin. */
export const requireAdminApi = async (): Promise<
  | { ok: true; admin: AdminContext }
  | { ok: false; response: NextResponse }
> => {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'No autorizado' }, { status: 401 }),
    };
  }

  const admin = await requireAdmin();
  if (!admin) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Prohibido' }, { status: 403 }),
    };
  }

  return { ok: true, admin };
};
