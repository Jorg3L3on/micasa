import { z } from 'zod';
import {
  buildOAuthFormActionCsp,
  OAUTH_FORM_ACTION_SELF_CSP,
} from '@/lib/oauth-consent';
import {
  assertRedirectUriAllowed,
  resolveOAuthClient,
  type ResolvedOAuthClient,
} from '@/lib/server/mcp-oauth/clients';

export type ConsentDocumentResult =
  | { ok: true; csp: string; client: ResolvedOAuthClient }
  | {
      ok: false;
      reason: 'invalid_client' | 'redirect_uri' | 'invalid_request';
      /** Set only after redirect_uri was rejected: `form-action 'self'`. */
      csp?: string;
    };

/**
 * Resolves the consent document's form-action policy. The client origin is
 * included only after redirect_uri is allowed for that client.
 */
export const resolveConsentDocument = async (
  clientId: string | undefined,
  redirectUri: string | undefined,
): Promise<ConsentDocumentResult> => {
  if (!clientId || !redirectUri || !z.string().url().safeParse(redirectUri).success) {
    return { ok: false, reason: 'invalid_request' };
  }

  const client = await resolveOAuthClient(clientId);
  if (!client) return { ok: false, reason: 'invalid_client' };

  try {
    assertRedirectUriAllowed(client, redirectUri);
  } catch {
    return { ok: false, reason: 'redirect_uri', csp: OAUTH_FORM_ACTION_SELF_CSP };
  }

  const csp = buildOAuthFormActionCsp(redirectUri) ?? OAUTH_FORM_ACTION_SELF_CSP;
  return { ok: true, csp, client };
};
