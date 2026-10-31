/**
 * URI rules for RFC 7591 dynamic client registration (MIC-I5-3).
 *
 * redirect_uris (RFC 8252 / OAuth 2.1 §2.3.1):
 * - `https:` on any host
 * - `http:` only on loopback (`localhost`, `127.0.0.1`, `[::1]`)
 * - private-use schemes in reverse-DNS form (`com.ejemplo.app:/cb`)
 * - never a fragment, never credentials in the URI
 *
 * client_uri / logo_uri are shown on the consent screen, so `https:` only.
 */

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

/** Reverse-DNS private-use scheme: at least two dot-separated labels. */
const PRIVATE_USE_SCHEME = /^[a-z][a-z0-9-]*(\.[a-z0-9-]+)+$/;

const parse = (value: string): URL | null => {
  try {
    return new URL(value);
  } catch {
    return null;
  }
};

/**
 * Why a redirect URI cannot be registered or accepted. Null means the URI is
 * https, loopback http, or a reverse-DNS private-use scheme, with no fragment
 * and no credentials. The reason is safe to log; the URI itself is not.
 */
export type RedirectUriRejectionReason =
  | 'unparseable'
  | 'fragment'
  | 'credentials'
  | 'non_loopback_http'
  | 'disallowed_scheme';

export const registrationRedirectRejectionReason = (
  value: string,
): RedirectUriRejectionReason | null => {
  const url = parse(value);
  if (!url) return 'unparseable';
  if (url.hash || value.includes('#')) return 'fragment';
  if (url.username || url.password) return 'credentials';

  if (url.protocol === 'https:') {
    return url.hostname ? null : 'disallowed_scheme';
  }
  if (url.protocol === 'http:') {
    return LOOPBACK_HOSTS.has(url.hostname) ? null : 'non_loopback_http';
  }

  const scheme = url.protocol.slice(0, -1).toLowerCase();
  return PRIVATE_USE_SCHEME.test(scheme) ? null : 'disallowed_scheme';
};

export const isAllowedRegistrationRedirectUri = (value: string): boolean =>
  registrationRedirectRejectionReason(value) === null;

export const isHttpsUri = (value: string): boolean => {
  const url = parse(value);
  return url?.protocol === 'https:' && Boolean(url.hostname);
};
