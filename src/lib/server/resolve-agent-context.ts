import {
  AGENT_TOKEN_LOOKUP_LENGTH,
  AGENT_TOKEN_PREFIX,
  hashAgentToken,
  isLegacyAgentTokenHash,
  verifyAgentToken,
} from '@/lib/server/agent-token';
import {
  OAUTH_ACCESS_TOKEN_PREFIX,
} from '@/lib/server/mcp-oauth/config';
import { resolveOAuthGrantUser } from '@/lib/server/mcp-oauth/grants';
import {
  assertOwnerOnAllowList,
  loadAllowedContextsForApiKey,
  loadAllowedContextsForOAuthGrant,
} from '@/lib/server/agent-allowed-contexts';
import { AgentAuthError } from '@/lib/server/agent-auth-error';
import type { AgentContextEntry } from '@/schemas/agent-context.schema';
import prisma from '@/lib/prisma';
import type {
  OwnerContextRole,
  OwnerContextSuccess,
  OwnerFilter,
} from '@/lib/server/get-owner-context';

export { AGENT_TOKEN_LOOKUP_LENGTH, AGENT_TOKEN_PREFIX };
export { AgentAuthError } from '@/lib/server/agent-auth-error';

export type AgentScope = 'read' | 'write';

export type AgentAuthSource = 'api_key' | 'oauth_grant';

export type AgentContext = OwnerContextSuccess & {
  scopes: AgentScope[];
  authSource: AgentAuthSource;
  apiKeyId?: number;
  oauthGrantId?: number;
  /** Negative grant id for rate-limit identity (distinct from api keys). */
  rateLimitIdentity: number;
  allowedContexts: AgentContextEntry[];
};

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
  if (!token) {
    throw unauthorized();
  }
  return token;
}

const isApiKeyToken = (token: string): boolean =>
  token.startsWith(AGENT_TOKEN_PREFIX) && !token.startsWith(OAUTH_ACCESS_TOKEN_PREFIX);

const isOAuthAccessToken = (token: string): boolean =>
  token.startsWith(OAUTH_ACCESS_TOKEN_PREFIX);

/**
 * Resolves the user behind a bearer credential: legacy `micasa_…` API keys
 * (Ajustes → Conexiones) or OAuth access tokens (`micasa_oauth_…`).
 */
export async function resolveAgentUser(token: string): Promise<{
  userId: number;
  scopes: AgentScope[];
  authSource: AgentAuthSource;
  apiKeyId?: number;
  oauthGrantId?: number;
  rateLimitIdentity: number;
  allowedContexts: AgentContextEntry[];
}> {
  if (isOAuthAccessToken(token)) {
    const oauthUser = await resolveOAuthGrantUser(token);
    if (!oauthUser) throw unauthorized('Token OAuth inválido o expirado');
    const allowedContexts = await loadAllowedContextsForOAuthGrant(
      oauthUser.oauthGrantId,
    );
    return {
      userId: oauthUser.userId,
      scopes: oauthUser.scopes,
      authSource: 'oauth_grant',
      oauthGrantId: oauthUser.oauthGrantId,
      rateLimitIdentity: -oauthUser.oauthGrantId,
      allowedContexts,
    };
  }

  if (!isApiKeyToken(token)) {
    throw unauthorized();
  }

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

  const allowedContexts = await loadAllowedContextsForApiKey(apiKey.id);

  return {
    userId: apiKey.user.id,
    scopes,
    authSource: 'api_key',
    apiKeyId: apiKey.id,
    rateLimitIdentity: apiKey.id,
    allowedContexts,
  };
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
  allowedContexts: AgentContextEntry[],
): Promise<{
  ownerType: 'user' | 'house';
  ownerId: number;
  ownerFilter: OwnerFilter;
  role: OwnerContextRole;
}> {
  if (!Number.isInteger(ownerId) || ownerId <= 0) {
    throw new AgentAuthError('ownerId inválido', 400);
  }

  assertOwnerOnAllowList(allowedContexts, ownerType, ownerId);

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
  const agentUser = await resolveAgentUser(token);
  const owner = await resolveOwnerForAgent(
    agentUser.userId,
    ownerType,
    ownerId,
    agentUser.allowedContexts,
  );
  return { ...agentUser, ...owner };
}

export function assertScope(
  context: Pick<AgentContext, 'scopes'>,
  scope: AgentScope,
): void {
  if (!context.scopes.includes(scope)) {
    throw forbidden(`El token no tiene el scope "${scope}"`);
  }
}
