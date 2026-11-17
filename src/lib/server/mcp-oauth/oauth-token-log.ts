import { classifyClientIdKind } from '@/lib/server/mcp-oauth/token-attempt-sanitize';

type OAuthTokenFailureFields = {
  grant_type: string;
  has_code: boolean;
  has_verifier: boolean;
  has_assertion: boolean;
  client_id_host?: string;
  error: string;
};

const SAFE_SCHEME = /^[a-z][a-z0-9+.-]{0,64}$/;

const redirectSchemeOnly = (redirectUri: string | null | undefined): string | undefined => {
  if (!redirectUri) return undefined;
  try {
    const scheme = new URL(redirectUri).protocol.replace(/:$/, '').toLowerCase();
    return SAFE_SCHEME.test(scheme) ? scheme : 'other';
  } catch {
    return 'unparseable';
  }
};

/**
 * A redirect_uri was refused. Logs a reason and the scheme only — never the
 * URI (it can carry query secrets), the client_secret, or a token.
 */
export const logOAuthRedirectRejection = (input: {
  reason: string;
  clientId?: string | null;
  redirectUri?: string | null;
}): void => {
  const clientId = input.clientId ?? undefined;
  console.warn(
    JSON.stringify({
      severity: 'warn',
      event: 'oauth.redirect_uri.rejected',
      reason: input.reason,
      ...(clientId
        ? {
            client_id_kind: classifyClientIdKind(clientId),
            client_id_host: clientIdHostOnly(clientId),
          }
        : {}),
      redirect_scheme: redirectSchemeOnly(input.redirectUri),
      at: new Date().toISOString(),
    }),
  );
};

export const clientIdHostOnly = (clientId: string): string | undefined => {
  try {
    if (clientId.includes('://')) {
      return new URL(clientId).hostname;
    }
    return undefined;
  } catch {
    return undefined;
  }
};

export const logOAuthTokenFailure = (fields: OAuthTokenFailureFields): void => {
  console.warn(
    JSON.stringify({
      severity: 'warn',
      event: 'oauth.token.failure',
      ...fields,
      at: new Date().toISOString(),
    }),
  );
};
