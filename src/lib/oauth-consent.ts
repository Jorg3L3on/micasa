/**
 * Browser-safe OAuth consent copy, callback URLs, and the per-response
 * `form-action` CSP. The origin is only appended after redirect_uri has
 * already been validated for the client.
 */

export const OAUTH_CONSENT_COPY = {
  invalidClient: 'Cliente inválido.',
  redirectUri: 'La dirección de retorno no está permitida.',
  invalidTarget: 'El recurso solicitado no es el servidor MCP de MiCasa.',
  invalidRequest: 'Solicitud inválida.',
  signInAgain: 'Inicia sesión de nuevo',
  retry: 'Reintentar',
  generic: 'No se pudo autorizar la conexión.',
  accessDenied: 'El usuario rechazó la autorización',
} as const;

export const OAUTH_CONSENT_ERROR_CODES = [
  'invalid_client',
  'redirect_uri',
  'invalid_target',
  'invalid_request',
  'unauthorized',
] as const;

export type OAuthConsentErrorCode = (typeof OAUTH_CONSENT_ERROR_CODES)[number];

export type OAuthConsentInlineError = {
  message: string;
  /** Same-origin path. Present only for an expired session. */
  loginUrl?: string;
};

export type OAuthConsentParams = {
  client_id?: string;
  redirect_uri?: string;
  state?: string;
  scope?: string;
  code_challenge?: string;
  code_challenge_method?: string;
  resource?: string;
};

const isConsentErrorCode = (value: string): value is OAuthConsentErrorCode =>
  (OAUTH_CONSENT_ERROR_CODES as readonly string[]).includes(value);

export const messageForConsentErrorCode = (
  code: OAuthConsentErrorCode,
): string => {
  switch (code) {
    case 'invalid_client':
      return OAUTH_CONSENT_COPY.invalidClient;
    case 'redirect_uri':
      return OAUTH_CONSENT_COPY.redirectUri;
    case 'invalid_target':
      return OAUTH_CONSENT_COPY.invalidTarget;
    case 'invalid_request':
      return OAUTH_CONSENT_COPY.invalidRequest;
    case 'unauthorized':
      return OAUTH_CONSENT_COPY.signInAgain;
  }
};

export const inlineErrorFromConsentCode = (
  code: string | undefined,
  loginUrl: string,
): OAuthConsentInlineError | null => {
  if (!code || !isConsentErrorCode(code)) return null;
  if (code === 'unauthorized') {
    return { message: OAUTH_CONSENT_COPY.signInAgain, loginUrl };
  }
  return { message: messageForConsentErrorCode(code) };
};

/** Authorization request the user should resume after signing in again. */
export const buildAuthorizePath = (
  params: OAuthConsentParams,
): string | null => {
  if (!params.client_id || !params.redirect_uri || !params.code_challenge) {
    return null;
  }
  const search = new URLSearchParams();
  search.set('response_type', 'code');
  search.set('client_id', params.client_id);
  search.set('redirect_uri', params.redirect_uri);
  search.set('code_challenge', params.code_challenge);
  search.set('code_challenge_method', 'S256');
  if (params.state) search.set('state', params.state);
  if (params.scope) search.set('scope', params.scope);
  if (params.resource) search.set('resource', params.resource);
  return `/api/oauth/authorize?${search.toString()}`;
};

export const buildOAuthLoginPath = (authorizePath: string): string =>
  `/login?callbackUrl=${encodeURIComponent(authorizePath)}`;

const isHttpProtocol = (protocol: string): boolean =>
  protocol === 'https:' || protocol === 'http:';

/**
 * `form-action 'self' <origin>` for one already-validated redirect_uri.
 * Returns null when the URI has no http(s) origin to allow.
 */
export const buildOAuthFormActionCsp = (
  validatedRedirectUri: string,
): string | null => {
  try {
    const url = new URL(validatedRedirectUri);
    if (!isHttpProtocol(url.protocol)) return null;
    const origin = url.origin;
    if (!origin || origin === 'null' || /[\s;,]/.test(origin)) return null;
    return `form-action 'self' ${origin}`;
  } catch {
    return null;
  }
};

export const buildOAuthClientErrorUrl = (
  redirectUri: string,
  error: 'access_denied' | 'invalid_request',
  state?: string,
  description?: string,
): string => {
  const redirect = new URL(redirectUri);
  redirect.searchParams.set('error', error);
  if (description) redirect.searchParams.set('error_description', description);
  if (state) redirect.searchParams.set('state', state);
  return redirect.toString();
};

const isHttpUrl = (value: string): boolean => {
  try {
    return isHttpProtocol(new URL(value).protocol);
  } catch {
    return false;
  }
};

const readString = (body: Record<string, unknown>, key: string): string =>
  typeof body[key] === 'string' ? body[key] : '';

export type ConsentSubmitResult =
  | { type: 'redirect'; url: string }
  | { type: 'inline'; error: OAuthConsentInlineError };

/**
 * Maps a JSON consent response to either a client redirect (success or an
 * explicit callback) or an inline Spanish error. Does not follow redirects
 * for invalid_client, redirect_uri, invalid_target, Zod, or an expired session.
 */
export const interpretConsentResponse = (
  status: number,
  body: unknown,
  fallbackLoginUrl: string,
): ConsentSubmitResult => {
  const record =
    body != null && typeof body === 'object'
      ? (body as Record<string, unknown>)
      : {};
  const error = readString(record, 'error');
  const description = readString(record, 'error_description');
  const redirectTo = readString(record, 'redirect_to');

  if (
    status >= 200 &&
    status < 300 &&
    redirectTo &&
    isHttpUrl(redirectTo)
  ) {
    return { type: 'redirect', url: redirectTo };
  }

  if (status === 401 || error === 'unauthorized' || error === 'No autorizado') {
    const loginUrl = readString(record, 'login_url');
    const safeLogin =
      loginUrl.startsWith('/') && !loginUrl.startsWith('//') && !loginUrl.includes('\\')
        ? loginUrl
        : fallbackLoginUrl;
    return {
      type: 'inline',
      error: { message: OAUTH_CONSENT_COPY.signInAgain, loginUrl: safeLogin },
    };
  }

  if (error === 'invalid_client') {
    return { type: 'inline', error: { message: OAUTH_CONSENT_COPY.invalidClient } };
  }
  if (error === 'invalid_target') {
    return { type: 'inline', error: { message: OAUTH_CONSENT_COPY.invalidTarget } };
  }
  if (error === 'redirect_uri' || description === OAUTH_CONSENT_COPY.redirectUri) {
    return { type: 'inline', error: { message: OAUTH_CONSENT_COPY.redirectUri } };
  }
  if (error === 'invalid_request' || error === 'Solicitud inválida') {
    return { type: 'inline', error: { message: OAUTH_CONSENT_COPY.invalidRequest } };
  }

  const safeText = description || error;
  if (
    safeText &&
    safeText.length <= 200 &&
    !/prisma|stack|invocation|secret|token/i.test(safeText)
  ) {
    return { type: 'inline', error: { message: safeText } };
  }

  return { type: 'inline', error: { message: OAUTH_CONSENT_COPY.generic } };
};
