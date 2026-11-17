/**
 * What the OAuth consent screen shows about a client. client_name is
 * self-declared (anyone can register "ChatGPT"), so the screen always pairs it
 * with something the client cannot fake: the CIMD host of its client_id, or
 * the redirect host for dynamically registered clients.
 */

export type OAuthClientDisplay = {
  /** Host that vouches for the client, e.g. "chatgpt.com". */
  originLabel: string;
  /** client_uri, only when it is https; never rendered as a link otherwise. */
  safeClientUri: string | null;
};

const httpsUrl = (value: string | null | undefined): URL | null => {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname ? url : null;
  } catch {
    return null;
  }
};

const hostOf = (value: string): string | null => {
  try {
    return new URL(value).host || null;
  } catch {
    return null;
  }
};

export const buildOAuthClientDisplay = (input: {
  clientId: string;
  clientUri: string | null;
  redirectUri: string;
}): OAuthClientDisplay => {
  const cimd = httpsUrl(input.clientId);
  const redirectHost = hostOf(input.redirectUri);
  const originLabel = cimd
    ? cimd.host
    : `Registro dinámico · ${redirectHost ?? 'redirección desconocida'}`;

  return {
    originLabel,
    safeClientUri: httpsUrl(input.clientUri)?.toString() ?? null,
  };
};
