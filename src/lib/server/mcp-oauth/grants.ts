import prisma from '@/lib/prisma';
import type { AgentScope } from '@/lib/server/resolve-agent-context';
import {
  OAUTH_ACCESS_TOKEN_TTL_MS,
  OAUTH_CODE_TTL_MS,
  OAUTH_TOKEN_LOOKUP_LENGTH,
  mcpResourcesMatch,
  normalizeMcpResourceUrl,
} from '@/lib/server/mcp-oauth/config';
import {
  generateAuthorizationCode,
  generateOAuthAccessToken,
  generateOAuthRefreshToken,
  hashOAuthSecret,
  verifyOAuthSecret,
  verifyPkceS256,
} from '@/lib/server/mcp-oauth/tokens';
import { isValidPkceVerifier } from '@/lib/server/mcp-oauth/token-auth';

export const createAuthorizationCode = async (input: {
  clientId: string;
  userId: number;
  redirectUri: string;
  scopes: AgentScope[];
  codeChallenge: string;
  codeChallengeMethod: string;
  resource: string;
}) => {
  const { token: code, tokenHash } = generateAuthorizationCode();
  await prisma.mcpOAuthAuthorizationCode.create({
    data: {
      code_hash: tokenHash,
      client_id: input.clientId,
      user_id: input.userId,
      redirect_uri: input.redirectUri,
      scopes: input.scopes,
      code_challenge: input.codeChallenge,
      code_challenge_method: input.codeChallengeMethod,
      resource: normalizeMcpResourceUrl(input.resource),
      expires_at: new Date(Date.now() + OAUTH_CODE_TTL_MS),
    },
  });
  return code;
};

export const exchangeAuthorizationCode = async (input: {
  code: string;
  clientId: string;
  redirectUri: string;
  codeVerifier?: string | null;
  clientAuthenticatedViaPrivateKeyJwt?: boolean;
  resource?: string | null;
}) => {
  const codeHash = hashOAuthSecret(input.code);
  const row = await prisma.mcpOAuthAuthorizationCode.findUnique({
    where: { code_hash: codeHash },
  });

  if (!row || row.used_at != null) {
    throw new Error('invalid_grant');
  }
  if (row.expires_at.getTime() <= Date.now()) {
    throw new Error('invalid_grant');
  }
  if (row.client_id !== input.clientId) {
    throw new Error('invalid_grant');
  }
  if (row.redirect_uri !== input.redirectUri) {
    throw new Error('invalid_grant');
  }
  if (row.code_challenge_method !== 'S256') {
    throw new Error('invalid_grant');
  }

  const pkceValid =
    isValidPkceVerifier(input.codeVerifier ?? undefined) &&
    verifyPkceS256(input.codeVerifier!, row.code_challenge);
  const jwtValid = input.clientAuthenticatedViaPrivateKeyJwt === true;

  if (!pkceValid && !jwtValid) {
    throw new Error('invalid_grant');
  }

  if (input.resource && !mcpResourcesMatch(input.resource, row.resource)) {
    throw new Error('invalid_grant');
  }

  await prisma.mcpOAuthAuthorizationCode.update({
    where: { id: row.id },
    data: { used_at: new Date() },
  });

  return issueGrant({
    userId: row.user_id,
    clientId: row.client_id,
    scopes: row.scopes.filter(
      (scope): scope is AgentScope => scope === 'read' || scope === 'write',
    ),
    resource: normalizeMcpResourceUrl(row.resource),
  });
};

export const issueGrant = async (input: {
  userId: number;
  clientId: string;
  scopes: AgentScope[];
  resource: string;
}) => {
  const access = generateOAuthAccessToken();
  const refresh = generateOAuthRefreshToken();

  await prisma.mcpOAuthGrant.create({
    data: {
      user_id: input.userId,
      client_id: input.clientId,
      token_hash: access.tokenHash,
      token_prefix: access.tokenPrefix,
      refresh_token_hash: refresh.tokenHash,
      refresh_token_prefix: refresh.tokenPrefix,
      scopes: input.scopes,
      resource: input.resource,
      expires_at: new Date(Date.now() + OAUTH_ACCESS_TOKEN_TTL_MS),
    },
  });

  return {
    access_token: access.token,
    token_type: 'bearer' as const,
    expires_in: Math.floor(OAUTH_ACCESS_TOKEN_TTL_MS / 1000),
    refresh_token: refresh.token,
    scope: input.scopes.join(' '),
  };
};

export const refreshOAuthGrant = async (input: {
  refreshToken: string;
  clientId: string;
  resource?: string | null;
}) => {
  const refreshHash = hashOAuthSecret(input.refreshToken);
  const row = await prisma.mcpOAuthGrant.findUnique({
    where: { refresh_token_hash: refreshHash },
  });

  if (!row || row.revoked_at != null) {
    throw new Error('invalid_grant');
  }
  if (row.client_id !== input.clientId) {
    throw new Error('invalid_grant');
  }
  if (input.resource && !mcpResourcesMatch(input.resource, row.resource)) {
    throw new Error('invalid_grant');
  }

  const access = generateOAuthAccessToken();
  const refresh = generateOAuthRefreshToken();

  await prisma.mcpOAuthGrant.update({
    where: { id: row.id },
    data: {
      token_hash: access.tokenHash,
      token_prefix: access.tokenPrefix,
      refresh_token_hash: refresh.tokenHash,
      refresh_token_prefix: refresh.tokenPrefix,
      revoked_at: null,
      expires_at: new Date(Date.now() + OAUTH_ACCESS_TOKEN_TTL_MS),
    },
  });

  return {
    access_token: access.token,
    token_type: 'bearer' as const,
    expires_in: Math.floor(OAUTH_ACCESS_TOKEN_TTL_MS / 1000),
    refresh_token: refresh.token,
    scope: row.scopes.join(' '),
  };
};

export const revokeOAuthToken = async (token: string): Promise<void> => {
  const tokenHash = hashOAuthSecret(token);
  const byAccess = await prisma.mcpOAuthGrant.findFirst({
    where: { token_hash: tokenHash },
  });
  if (byAccess) {
    await prisma.mcpOAuthGrant.update({
      where: { id: byAccess.id },
      data: { revoked_at: new Date() },
    });
    return;
  }

  const byRefresh = await prisma.mcpOAuthGrant.findFirst({
    where: { refresh_token_hash: tokenHash },
  });
  if (byRefresh) {
    await prisma.mcpOAuthGrant.update({
      where: { id: byRefresh.id },
      data: { revoked_at: new Date() },
    });
  }
};

export const resolveOAuthGrantUser = async (accessToken: string) => {
  if (accessToken.length <= OAUTH_TOKEN_LOOKUP_LENGTH) return null;
  const prefix = accessToken.slice(0, OAUTH_TOKEN_LOOKUP_LENGTH);
  const grant = await prisma.mcpOAuthGrant.findUnique({
    where: { token_prefix: prefix },
    include: {
      user: { select: { id: true, active: true } },
      client: { select: { client_name: true } },
    },
  });
  if (!grant || grant.revoked_at != null) return null;
  if (grant.expires_at != null && grant.expires_at.getTime() <= Date.now()) {
    return null;
  }
  if (!verifyOAuthSecret(accessToken, grant.token_hash)) return null;
  if (!grant.user.active) return null;

  prisma.mcpOAuthGrant
    .update({
      where: { id: grant.id },
      data: { last_used_at: new Date() },
    })
    .catch(() => undefined);

  const scopes = grant.scopes.filter(
    (scope): scope is AgentScope => scope === 'read' || scope === 'write',
  );

  return {
    userId: grant.user.id,
    scopes,
    oauthGrantId: grant.id,
    clientName: grant.client.client_name,
  };
};
