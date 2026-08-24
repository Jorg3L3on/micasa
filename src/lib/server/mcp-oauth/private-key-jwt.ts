/** RFC 7523 JWT bearer client assertion. */
export const CLIENT_ASSERTION_JWT_BEARER =
  'urn:ietf:params:oauth:client-assertion-type:jwt-bearer';

export type VerifyPrivateKeyJwtParams = {
  clientAssertion: string;
  clientAssertionType: string | undefined;
  requestClientId: string;
  codeClientId?: string;
  request?: Request;
  jwksUri: string;
  /** Test hook: supply JWKS JSON directly instead of fetching jwksUri. */
  jwksJson?: JsonWebKeySet;
  fetchImpl?: typeof fetch;
};

type JsonWebKeySet = {
  keys: JsonWebKey[];
};

const normalizeAudiences = (aud: unknown): string[] => {
  if (typeof aud === 'string') return [aud];
  if (Array.isArray(aud)) {
    return aud.filter((value): value is string => typeof value === 'string');
  }
  return [];
};

const audienceMatches = (aud: unknown, acceptedAudiences: string[]): boolean => {
  const normalizedAccepted = new Set(
    acceptedAudiences.map((value) => value.replace(/\/$/, '')),
  );
  return normalizeAudiences(aud).some((value) =>
    normalizedAccepted.has(value.replace(/\/$/, '')),
  );
};

const claimMatchesAllowedClient = (
  claim: unknown,
  allowedClientIds: string[],
): boolean => typeof claim === 'string' && allowedClientIds.includes(claim);

export const verifyPrivateKeyJwtAssertion = async (
  params: VerifyPrivateKeyJwtParams,
): Promise<boolean> => {
  if (params.clientAssertionType !== CLIENT_ASSERTION_JWT_BEARER) {
    return false;
  }

  const { buildAllowedJwtClientIds } = await import('@/lib/server/mcp-oauth/cimd');
  const { buildOAuthTokenAudiences } = await import('@/lib/server/mcp-oauth/config');
  const { logOAuthJwtAssertionRejected } = await import(
    '@/lib/server/mcp-oauth/oauth-token-log'
  );

  const allowedClientIds = buildAllowedJwtClientIds(
    params.requestClientId,
    params.codeClientId,
  );
  const acceptedAudiences = buildOAuthTokenAudiences(params.request);

  try {
    const { createLocalJWKSet, jwtVerify } = await import('jose');

    let jwks: JsonWebKeySet;
    if (params.jwksJson) {
      jwks = params.jwksJson;
    } else {
      const fetchFn = params.fetchImpl ?? fetch;
      const response = await fetchFn(params.jwksUri, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) return false;
      jwks = (await response.json()) as JsonWebKeySet;
    }

    if (!Array.isArray(jwks.keys) || jwks.keys.length === 0) {
      return false;
    }

    const keySet = createLocalJWKSet(jwks);
    const { payload, protectedHeader } = await jwtVerify(
      params.clientAssertion,
      keySet,
      {
        algorithms: ['RS256'],
        clockTolerance: 60,
      },
    );

    const audOk = audienceMatches(payload.aud, acceptedAudiences);
    const issOk = claimMatchesAllowedClient(payload.iss, allowedClientIds);
    const subOk = claimMatchesAllowedClient(payload.sub, allowedClientIds);

    if (!audOk || !issOk || !subOk) {
      logOAuthJwtAssertionRejected({
        iss: typeof payload.iss === 'string' ? payload.iss : undefined,
        aud: payload.aud,
        sub: typeof payload.sub === 'string' ? payload.sub : undefined,
        typ:
          typeof payload.typ === 'string'
            ? payload.typ
            : typeof protectedHeader.typ === 'string'
              ? protectedHeader.typ
              : undefined,
      });
      return false;
    }

    return true;
  } catch (error) {
    try {
      const { decodeJwt } = await import('jose');
      const payload = decodeJwt(params.clientAssertion);
      logOAuthJwtAssertionRejected({
        iss: typeof payload.iss === 'string' ? payload.iss : undefined,
        aud: payload.aud,
        sub: typeof payload.sub === 'string' ? payload.sub : undefined,
        typ: typeof payload.typ === 'string' ? payload.typ : undefined,
        verify_error: error instanceof Error ? error.name : 'jwt_verify_failed',
      });
    } catch {
      logOAuthJwtAssertionRejected({ verify_error: 'jwt_decode_failed' });
    }
    return false;
  }
};
