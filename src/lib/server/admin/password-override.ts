import type { Prisma } from '@/generated/prisma/client';
import prisma from '@/lib/prisma';
import type { AdminContext } from '@/lib/server/require-admin';

export const ADMIN_AUDIT_PASSWORD_OVERRIDE = 'admin.password_override';

export const writeAdminAuditLog = async (input: {
  actorUserId: number;
  targetUserId?: number | null;
  action: string;
  metadata?: Prisma.InputJsonValue;
}) => {
  const row = await prisma.adminAuditLog.create({
    data: {
      actor_user_id: input.actorUserId,
      target_user_id: input.targetUserId ?? null,
      action: input.action,
      metadata: input.metadata ?? undefined,
    },
  });

  console.info(
    JSON.stringify({
      severity: 'info',
      event: 'admin.audit',
      action: input.action,
      actor_user_id: input.actorUserId,
      target_user_id: input.targetUserId ?? null,
      audit_id: row.id,
      at: new Date().toISOString(),
    }),
  );

  return row;
};

export const setTemporaryPasswordForUser = async (input: {
  admin: AdminContext;
  targetUserId: number;
  temporaryPassword: string;
}) => {
  const target = await prisma.user.findUnique({
    where: { id: input.targetUserId },
    select: { id: true, email: true },
  });
  if (!target) {
    return { ok: false as const, reason: 'not_found' as const };
  }

  const { hash } = await import('bcryptjs');
  const passwordHash = await hash(input.temporaryPassword.trim(), 10);

  await prisma.user.update({
    where: { id: target.id },
    data: { password: passwordHash },
  });

  await writeAdminAuditLog({
    actorUserId: input.admin.userId,
    targetUserId: target.id,
    action: ADMIN_AUDIT_PASSWORD_OVERRIDE,
    metadata: {
      target_email: target.email,
      // Never store plaintext password
      password_length: input.temporaryPassword.trim().length,
    },
  });

  return { ok: true as const, targetEmail: target.email };
};
