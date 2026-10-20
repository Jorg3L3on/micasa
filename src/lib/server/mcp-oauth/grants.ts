import prisma from '@/lib/prisma';
import { logFinanceEvent } from '@/lib/observability/finance-log';
import type { AgentScope } from '@/lib/server/resolve-agent-context';
import {
  OAUTH_ACCESS_TOKEN_TTL_MS,
  OAUTH_CODE_TTL_MS,
  OAUTH_REFRESH_TOKEN_TTL_MS,
  OAUTH_TOKEN_LOOKUP_LENGTH,
  getMcpResourceUrl,
  mcpResourcesMatch,
  normalizeMcpResourceUrl,
} from '@/lib/server/mcp-oauth/config';
import { tokenClientIdMatchesCode } from '@/lib/server/mcp-oauth/clients';
import { OAuthInvalidGrantError } from '@/lib/server/mcp-oauth/invalid-grant';
import {
  isOAuthExpiryPast,
  oauthExpiresAtFromNow,
} from '@/lib/server/mcp-oauth/oauth-expiry';
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
  allowedContexts: import('@/schemas/agent-context.schema').AgentContextEntry[];
}) => {
  const { token: code, tokenHash } = generateAuthorizationCode();
  const row = await prisma.mcpOAuthAuthorizationCode.create({
    data: {
      code_hash: tokenHash,
      client_id: input.clientId,
      user_id: input.userId,
      redirect_uri: input.redirectUri,
      scopes: input.scopes,
      code_challenge: input.codeChallenge,
      code_challenge_method: input.codeChallengeMethod,
      resource: normalizeMcpResourceUrl(input.resource),
      expires_at: oauthExpiresAtFromNow(OAUTH_CODE_TTL_MS),
    },
  });

  if (input.allowedContexts.length > 0) {
    const { createAuthorizationCodeContexts } = await import(
      '@/lib/server/agent-allowed-contexts'
    );
    await createAuthorizationCodeContexts(row.id, input.allowedContexts);
  }

  return code;
};

export const exchangeAuthorizationCode = async (input: {
  code: string;
  clientId: string;
  redirectUri: string;
  codeVerifier?: string | null;
  resource?: string | null;
}) => {
  const codeHash = hashOAuthSecret(input.code);
  const row = await prisma.mcpOAuthAuthorizationCode.findUnique({
    where: { code_hash: codeHash },
  });

  if (!row) {
    throw new OAuthInvalidGrantError('not_found');
  }
  if (row.used_at != null) {
    await revokeGrantsForReusedCode(row);
    throw new OAuthInvalidGrantError('code_reuse');
  }
  if (isOAuthExpiryPast(row.expires_at)) {
    throw new OAuthInvalidGrantError('expired');
  }
  if (row.redirect_uri !== input.redirectUri) {
    throw new OAuthInvalidGrantError('redirect');
  }
  if (!tokenClientIdMatchesCode(input.clientId, row.client_id)) {
    throw new OAuthInvalidGrantError('client');
  }
  if (row.code_challenge_method !== 'S256') {
    throw new OAuthInvalidGrantError('pkce');
  }

  // PKCE is mandatory on every exchange; nothing replaces the code_verifier.
  const pkceValid =
    isValidPkceVerifier(input.codeVerifier ?? undefined) &&
    verifyPkceS256(input.codeVerifier!, row.code_challenge);
  if (!pkceValid) {
    throw new OAuthInvalidGrantError('pkce');
  }

  if (input.resource && !mcpResourcesMatch(input.resource, row.resource)) {
    throw new OAuthInvalidGrantError('resource');
  }

  // Validation runs first so a malformed request does not burn the code.
  // The conditional update is the single-use gate: of two concurrent
  // exchanges only one sees count === 1.
  const claimed = await prisma.mcpOAuthAuthorizationCode.updateMany({
    where: { id: row.id, used_at: null },
    data: { used_at: new Date() },
  });
  if (claimed.count === 0) {
    throw new OAuthInvalidGrantError('other');
  }

  const { loadAuthorizationCodeContexts } = await import(
    '@/lib/server/agent-allowed-contexts'
  );
  const allowedContexts = await loadAuthorizationCodeContexts(row.id);

  return issueGrant({
    userId: row.user_id,
    clientId: row.client_id,
    scopes: row.scopes.filter(
      (scope): scope is AgentScope => scope === 'read' || scope === 'write',
    ),
    resource: normalizeMcpResourceUrl(row.resource),
    allowedContexts,
    authorizationCodeId: row.id,
  });
};

/** OAuth 2.1 §4.1.2: a replayed code revokes every grant issued from it. */
const revokeGrantsForReusedCode = async (row: {
  id: number;
  client_id: string;
  user_id: number;
}) => {
  const revoked = await prisma.mcpOAuthGrant.updateMany({
    where: { authorization_code_id: row.id, revoked_at: null },
    data: { revoked_at: new Date() },
  });
  logFinanceEvent('warn', 'oauth.code_reuse', {
    client_id: row.client_id,
    user_id: row.user_id,
    revoked_grants: revoked.count,
  });
};

export const issueGrant = async (input: {
  userId: number;
  clientId: string;
  scopes: AgentScope[];
  resource: string;
  allowedContexts?: import('@/schemas/agent-context.schema').AgentContextEntry[];
  authorizationCodeId?: number;
}) => {
  const access = generateOAuthAccessToken();
  const refresh = generateOAuthRefreshToken();

  const grant = await prisma.mcpOAuthGrant.create({
    data: {
      user_id: input.userId,
      client_id: input.clientId,
      token_hash: access.tokenHash,
      token_prefix: access.tokenPrefix,
      refresh_token_hash: refresh.tokenHash,
      refresh_token_prefix: refresh.tokenPrefix,
      scopes: input.scopes,
      resource: input.resource,
      expires_at: oauthExpiresAtFromNow(OAUTH_ACCESS_TOKEN_TTL_MS),
      refresh_expires_at: oauthExpiresAtFromNow(OAUTH_REFRESH_TOKEN_TTL_MS),
      authorization_code_id: input.authorizationCodeId ?? null,
    },
  });

  if (input.allowedContexts && input.allowedContexts.length > 0) {
    const { replaceOAuthGrantAllowedContexts } = await import(
      '@/lib/server/agent-allowed-contexts'
    );
    await replaceOAuthGrantAllowedContexts(grant.id, input.allowedContexts);
  }

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

  if (!row) {
    const reused = await revokeGrantForReusedRefreshToken(refreshHash);
    throw new OAuthInvalidGrantError(reused ? 'refresh_reuse' : 'not_found');
  }
  if (row.revoked_at != null) {
    throw new OAuthInvalidGrantError('other');
  }
  if (row.client_id !== input.clientId) {
    throw new OAuthInvalidGrantError('client');
  }
  // Grants from before refresh_expires_at existed are backfilled by the
  // migration; a missing value is treated as expired.
  if (row.refresh_expires_at == null || isOAuthExpiryPast(row.refresh_expires_at)) {
    throw new OAuthInvalidGrantError('expired');
  }
  if (input.resource && !mcpResourcesMatch(input.resource, row.resource)) {
    throw new OAuthInvalidGrantError('resource');
  }

  const access = generateOAuthAccessToken();
  const refresh = generateOAuthRefreshToken();

  // Conditional on the presented hash so two concurrent refreshes cannot both
  // rotate. Rotation never un-revokes a grant.
  const rotated = await prisma.mcpOAuthGrant.updateMany({
    where: { id: row.id, refresh_token_hash: refreshHash, revoked_at: null },
    data: {
      token_hash: access.tokenHash,
      token_prefix: access.tokenPrefix,
      refresh_token_hash: refresh.tokenHash,
      refresh_token_prefix: refresh.tokenPrefix,
      previous_refresh_token_hash: refreshHash,
      expires_at: oauthExpiresAtFromNow(OAUTH_ACCESS_TOKEN_TTL_MS),
      refresh_expires_at: oauthExpiresAtFromNow(OAUTH_REFRESH_TOKEN_TTL_MS),
    },
  });
  if (rotated.count === 0) {
    throw new OAuthInvalidGrantError('other');
  }

  return {
    access_token: access.token,
    token_type: 'bearer' as const,
    expires_in: Math.floor(OAUTH_ACCESS_TOKEN_TTL_MS / 1000),
    refresh_token: refresh.token,
    scope: row.scopes.join(' '),
  };
};

/**
 * A refresh token that was already rotated out means two parties hold it
 * (OAuth 2.1 §4.3.1): revoke the whole grant. Only the last rotated token is
 * remembered; older ones are simply not found.
 */
const revokeGrantForReusedRefreshToken = async (
  refreshHash: string,
): Promise<boolean> => {
  const reused = await prisma.mcpOAuthGrant.findUnique({
    where: { previous_refresh_token_hash: refreshHash },
    select: { id: true, client_id: true, user_id: true, revoked_at: true },
  });
  if (!reused) return false;

  if (reused.revoked_at == null) {
    await prisma.mcpOAuthGrant.update({
      where: { id: reused.id },
      data: { revoked_at: new Date() },
    });
  }
  logFinanceEvent('warn', 'oauth.refresh_reuse', {
    client_id: reused.client_id,
    user_id: reused.user_id,
    grant_id: reused.id,
  });
  return true;
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
  if (grant.expires_at != null && isOAuthExpiryPast(grant.expires_at)) {
    return null;
  }
  if (!verifyOAuthSecret(accessToken, grant.token_hash)) return null;
  if (!grant.user.active) return null;
  // RFC 8707 audience: the token is only valid for this MCP resource.
  if (!mcpResourcesMatch(grant.resource, getMcpResourceUrl())) return null;

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
