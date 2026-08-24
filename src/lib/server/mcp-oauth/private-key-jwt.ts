/** RFC 7523 JWT bearer client assertion. */
export const CLIENT_ASSERTION_JWT_BEARER =
  'urn:ietf:params:oauth:client-assertion-type:jwt-bearer';

export type VerifyPrivateKeyJwtParams = {
  clientAssertion: string;
  clientAssertionType: string | undefined;
  clientId: string;
  tokenEndpoint: string;
  jwksUri: string;
  /** Test hook: supply JWKS JSON directly instead of fetching jwksUri. */
  jwksJson?: JsonWebKeySet;
  fetchImpl?: typeof fetch;
};

type JsonWebKeySet = {
  keys: JsonWebKey[];
};

export const verifyPrivateKeyJwtAssertion = async (
  params: VerifyPrivateKeyJwtParams,
): Promise<boolean> => {
  if (params.clientAssertionType !== CLIENT_ASSERTION_JWT_BEARER) {
    return false;
  }

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
    await jwtVerify(params.clientAssertion, keySet, {
      algorithms: ['RS256'],
      audience: params.tokenEndpoint,
      issuer: params.clientId,
      subject: params.clientId,
    });
    return true;
  } catch {
    return false;
  }
};
