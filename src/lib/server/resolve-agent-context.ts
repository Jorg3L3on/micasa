import prisma from '@/lib/prisma';
import {
  AGENT_TOKEN_LOOKUP_LENGTH,
  AGENT_TOKEN_PREFIX,
  hashAgentToken,
  isLegacyAgentTokenHash,
  verifyAgentToken,
} from '@/lib/server/agent-token';
import type {
  OwnerContextRole,
  OwnerContextSuccess,
  OwnerFilter,
} from '@/lib/server/get-owner-context';

export { AGENT_TOKEN_LOOKUP_LENGTH, AGENT_TOKEN_PREFIX };

export type AgentScope = 'read' | 'write';

export type AgentContext = OwnerContextSuccess & {
  scopes: AgentScope[];
  apiKeyId: number;
};

export class AgentAuthError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'AgentAuthError';
    this.status = status;
  }
}

const unauthorized = (message = 'Token de agente inválido') =>
  new AgentAuthError(message, 401);

const forbidden = (message = 'Forbidden') => new AgentAuthError(message, 403);

export function parseBearerToken(
  authorizationHeader: string | null | undefined,
): string {
  const header = authorizationHeader?.trim();
  if (!header?.toLowerCase().startsWith('bearer ')) {
    throw unauthorized('Falta el encabezado Authorization: Bearer');
  }
  const token = header.slice('bearer '.length).trim();
  if (!token.startsWith(AGENT_TOKEN_PREFIX)) {
    throw unauthorized();
  }
  return token;
}

/**
 * Resolves the user behind an agent bearer token (`micasa_...`).
 * Mirrors the session lookup half of `getOwnerContext`, but for connectors
 * (Grok Bot, Cursor MCP) that cannot hold a NextAuth cookie.
 */
export async function resolveAgentUser(token: string): Promise<{
  userId: number;
  scopes: AgentScope[];
  apiKeyId: number;
}> {
  if (token.length <= AGENT_TOKEN_LOOKUP_LENGTH) {
    throw unauthorized();
  }
  const keyPrefix = token.slice(0, AGENT_TOKEN_LOOKUP_LENGTH);

  const apiKey = await prisma.apiKey.findUnique({
    where: { key_prefix: keyPrefix },
    include: { user: { select: { id: true, active: true } } },
  });

  if (!apiKey || apiKey.revoked_at != null) {
    throw unauthorized();
  }

  if (apiKey.expires_at != null && apiKey.expires_at.getTime() <= Date.now()) {
    throw unauthorized('Token de agente expirado');
  }

  const matches = await verifyAgentToken(token, apiKey.key_hash);
  if (!matches) {
    throw unauthorized();
  }

  if (!apiKey.user.active) {
    throw forbidden('Usuario inactivo');
  }

  // Best-effort usage timestamp (plus opportunistic re-hash of legacy bcrypt
  // keys to the fast SHA-256 format); never block the tool call on it.
  prisma.apiKey
    .update({
      where: { id: apiKey.id },
      data: {
        last_used_at: new Date(),
        ...(isLegacyAgentTokenHash(apiKey.key_hash)
          ? { key_hash: hashAgentToken(token) }
          : {}),
      },
    })
    .catch(() => undefined);

  const scopes = apiKey.scopes.filter(
    (scope): scope is AgentScope => scope === 'read' || scope === 'write',
  );

  return { userId: apiKey.user.id, scopes, apiKeyId: apiKey.id };
}

/**
 * Same owner resolution rules as `getOwnerContext` (house membership check,
 * user can only act as themselves) applied to tool args instead of the query
 * string.
 */
export async function resolveOwnerForAgent(
  userId: number,
  ownerType: 'user' | 'house',
  ownerId: number,
): Promise<{
  ownerType: 'user' | 'house';
  ownerId: number;
  ownerFilter: OwnerFilter;
  role: OwnerContextRole;
}> {
  if (!Number.isInteger(ownerId) || ownerId <= 0) {
    throw new AgentAuthError('ownerId inválido', 400);
  }

  if (ownerType === 'house') {
    const membership = await prisma.houseMember.findFirst({
      where: { house_id: ownerId, user_id: userId },
    });
    if (!membership) {
      throw forbidden('No eres miembro de esta casa');
    }
    return {
      ownerType: 'house',
      ownerId,
      ownerFilter: { user_id: null, house_id: ownerId },
      role: membership.role.toLowerCase() as OwnerContextRole,
    };
  }

  if (ownerId !== userId) {
    throw forbidden('Solo puedes actuar como tu propio usuario');
  }
  return {
    ownerType: 'user',
    ownerId,
    ownerFilter: { user_id: ownerId, house_id: null },
    role: 'owner',
  };
}

export async function resolveAgentContext(
  authorizationHeader: string | null | undefined,
  ownerType: 'user' | 'house',
  ownerId: number,
): Promise<AgentContext> {
  const token = parseBearerToken(authorizationHeader);
  const { userId, scopes, apiKeyId } = await resolveAgentUser(token);
  const owner = await resolveOwnerForAgent(userId, ownerType, ownerId);
  return { userId, scopes, apiKeyId, ...owner };
}

export function assertScope(
  context: Pick<AgentContext, 'scopes'>,
  scope: AgentScope,
): void {
  if (!context.scopes.includes(scope)) {
    throw forbidden(`El token no tiene el scope "${scope}"`);
  }
}
