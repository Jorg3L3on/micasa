export const OAUTH_CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'Authorization, Content-Type, Accept, mcp-protocol-version',
  'Access-Control-Max-Age': '86400',
};

export const withOAuthCors = (response: Response): Response => {
  for (const [key, value] of Object.entries(OAUTH_CORS_HEADERS)) {
    response.headers.set(key, value);
  }
  return response;
};

export const oauthOptionsResponse = (): Response =>
  withOAuthCors(new Response(null, { status: 204 }));

export const oauthJsonResponse = (
  body: unknown,
  init?: ResponseInit,
): Response => {
  const headers = new Headers(init?.headers);
  headers.set('Content-Type', 'application/json; charset=utf-8');
  headers.set('Cache-Control', 'no-store');
  return withOAuthCors(
    new Response(JSON.stringify(body), { ...init, headers }),
  );
};

export const oauthErrorResponse = (
  error: string,
  description?: string,
  status = 400,
): Response =>
  oauthJsonResponse(
    {
      error,
      ...(description ? { error_description: description } : {}),
    },
    { status },
  );
