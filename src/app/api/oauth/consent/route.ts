import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import {
  buildAuthorizePath,
  buildOAuthClientErrorUrl,
  buildOAuthFormActionCsp,
  buildOAuthLoginPath,
  OAUTH_CONSENT_COPY,
  type OAuthConsentErrorCode,
} from '@/lib/oauth-consent';
import {
  assertRedirectUriAllowed,
  resolveOAuthClient,
  type ResolvedOAuthClient,
} from '@/lib/server/mcp-oauth/clients';
import {
  getMcpResourceUrl,
  getOAuthIssuer,
  mcpResourcesMatch,
  normalizeMcpResourceUrl,
  parseScopeParam,
} from '@/lib/server/mcp-oauth/config';
import { createAuthorizationCode } from '@/lib/server/mcp-oauth/grants';
import {
  parseConsentFormData,
  parseContextFieldsFromForm,
  scalarConsentField,
  validateSelectableContexts,
} from '@/lib/server/agent-allowed-contexts';
import { AgentAuthError } from '@/lib/server/agent-auth-error';

const consentFieldsSchema = z.object({
  client_id: z.string().min(1),
  redirect_uri: z.string().url(),
  state: z.string().optional(),
  scope: z.string().optional(),
  code_challenge: z.string().min(43).max(128),
  code_challenge_method: z.literal('S256'),
  resource: z.string().url().optional(),
  allow_write: z.enum(['true', 'false']).optional(),
});

const CONSENT_PAGE_KEYS = [
  'client_id',
  'redirect_uri',
  'state',
  'scope',
  'code_challenge',
  'code_challenge_method',
  'resource',
] as const;

const parseConsentBody = async (
  request: NextRequest,
): Promise<{
  fields: Record<string, string | string[]>;
  formPost: boolean;
}> => {
  const contentType = request.headers.get('content-type') ?? '';
  if (
    contentType.includes('application/x-www-form-urlencoded') ||
    contentType.includes('multipart/form-data')
  ) {
    const form = await request.formData();
    return { fields: parseConsentFormData(form), formPost: true };
  }
  const json = (await request.json()) as Record<string, string | string[]>;
  return { fields: json, formPost: false };
};

const buildOAuthCallbackUrl = (input: {
  redirectUri: string;
  code: string;
  state?: string;
}): URL => {
  const redirect = new URL(input.redirectUri);
  redirect.searchParams.set('code', input.code);
  if (input.state) redirect.searchParams.set('state', input.state);
  return redirect;
};

const originOf = (value: string): string | null => {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
};

/**
 * Consent POST mints an authorization code, so it must come from our own
 * consent page: Origin equal to the issuer (or this request's origin), or,
 * without Origin, Sec-Fetch-Site same-origin. Anything else is a cross-site
 * form post (CSRF) and gets 403.
 */
const isSameOriginRequest = (request: NextRequest): boolean => {
  const allowed = new Set(
    [originOf(getOAuthIssuer(request)), originOf(request.url)].filter(
      (value): value is string => value != null,
    ),
  );
  const origin = request.headers.get('origin');
  if (origin) return allowed.has(origin);
  return request.headers.get('sec-fetch-site') === 'same-origin';
};

const withValidatedFormAction = (
  response: NextResponse,
  validatedRedirectUri: string,
): NextResponse => {
  const csp = buildOAuthFormActionCsp(validatedRedirectUri);
  if (csp) response.headers.set('Content-Security-Policy', csp);
  return response;
};

const jsonInline = (
  status: number,
  error: string,
  description: string,
  extra?: Record<string, unknown>,
): NextResponse =>
  NextResponse.json(
    { error, error_description: description, ...extra },
    { status },
  );

const consentPageRedirect = (
  request: NextRequest,
  fields: Record<string, string | string[]>,
  consentError: OAuthConsentErrorCode,
): NextResponse => {
  const url = new URL('/oauth/consent', request.url);
  for (const key of CONSENT_PAGE_KEYS) {
    const value = scalarConsentField(fields, key);
    if (value && value.length <= 2048) url.searchParams.set(key, value);
  }
  url.searchParams.set('consent_error', consentError);
  return NextResponse.redirect(url, { status: 302 });
};

const loginRedirect = (
  request: NextRequest,
  fields: Record<string, string | string[]>,
  formPost: boolean,
): NextResponse => {
  const authorizePath = buildAuthorizePath({
    client_id: scalarConsentField(fields, 'client_id'),
    redirect_uri: scalarConsentField(fields, 'redirect_uri'),
    state: scalarConsentField(fields, 'state'),
    scope: scalarConsentField(fields, 'scope'),
    code_challenge: scalarConsentField(fields, 'code_challenge'),
    code_challenge_method: scalarConsentField(fields, 'code_challenge_method'),
    resource: scalarConsentField(fields, 'resource'),
  });
  const loginPath = authorizePath ? buildOAuthLoginPath(authorizePath) : '/login';
  if (!formPost) {
    return jsonInline(401, 'unauthorized', OAUTH_CONSENT_COPY.signInAgain, {
      login_url: loginPath,
    });
  }
  return NextResponse.redirect(new URL(loginPath, request.url), { status: 302 });
};

/**
 * No-JS form posts redirect the browser. JSON (the consent page fetch) returns
 * `{ redirect_to }` so the page can assign location without a form navigation,
 * which CSP form-action would block for non-ChatGPT clients.
 */
const clientNavigation = (
  validatedRedirectUri: string,
  formPost: boolean,
  params: { error?: 'access_denied' | 'invalid_request'; error_description?: string; state?: string; code?: string },
): NextResponse => {
  if (params.code) {
    const redirect = buildOAuthCallbackUrl({
      redirectUri: validatedRedirectUri,
      code: params.code,
      state: params.state,
    });
    if (!formPost) {
      return withValidatedFormAction(
        NextResponse.json({ redirect_to: redirect.toString() }),
        validatedRedirectUri,
      );
    }
    return withValidatedFormAction(
      NextResponse.redirect(redirect, { status: 302 }),
      validatedRedirectUri,
    );
  }

  const error = params.error ?? 'invalid_request';
  const redirectTo = buildOAuthClientErrorUrl(
    validatedRedirectUri,
    error,
    params.state,
    params.error_description,
  );
  if (!formPost) {
    return withValidatedFormAction(
      NextResponse.json({ redirect_to: redirectTo }),
      validatedRedirectUri,
    );
  }
  return withValidatedFormAction(
    NextResponse.redirect(redirectTo, { status: 302 }),
    validatedRedirectUri,
  );
};

const safeOAuthDescription = (error: unknown): string => {
  if (error instanceof AgentAuthError) return error.message;
  if (error instanceof z.ZodError) return OAUTH_CONSENT_COPY.invalidRequest;
  return OAUTH_CONSENT_COPY.generic;
};

type ClientRedirectResolution =
  | { status: 'ready'; client: ResolvedOAuthClient; redirectUri: string }
  | { status: 'unchecked' }
  | { status: 'response'; response: NextResponse };

const readClientAndRedirect = async (
  request: NextRequest,
  fields: Record<string, string | string[]>,
  formPost: boolean,
): Promise<ClientRedirectResolution> => {
  const clientId = scalarConsentField(fields, 'client_id');
  const redirectUri = scalarConsentField(fields, 'redirect_uri');
  if (!clientId || !redirectUri || !z.string().url().safeParse(redirectUri).success) {
    return { status: 'unchecked' };
  }

  const client = await resolveOAuthClient(clientId, request);
  if (!client) {
    return {
      status: 'response',
      response: formPost
        ? consentPageRedirect(request, fields, 'invalid_client')
        : jsonInline(400, 'invalid_client', OAUTH_CONSENT_COPY.invalidClient),
    };
  }

  try {
    assertRedirectUriAllowed(client, redirectUri);
  } catch {
    return {
      status: 'response',
      response: formPost
        ? consentPageRedirect(request, fields, 'redirect_uri')
        : jsonInline(400, 'invalid_request', OAUTH_CONSENT_COPY.redirectUri),
    };
  }

  return { status: 'ready', client, redirectUri };
};

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: 'Origen no permitido' }, { status: 403 });
  }

  let formPost = false;
  let fields: Record<string, string | string[]> = {};
  try {
    const parsed = await parseConsentBody(request);
    formPost = parsed.formPost;
    fields = parsed.fields;
  } catch {
    return jsonInline(400, 'invalid_request', OAUTH_CONSENT_COPY.invalidRequest);
  }

  const session = await auth();
  if (!session?.user?.id) {
    return loginRedirect(request, fields, formPost);
  }

  const userId = Number(session.user.id);
  if (Number.isNaN(userId)) {
    if (formPost) return consentPageRedirect(request, fields, 'invalid_request');
    return jsonInline(400, 'invalid_request', OAUTH_CONSENT_COPY.invalidRequest);
  }

  const resolved = await readClientAndRedirect(request, fields, formPost);
  if (resolved.status === 'response') return resolved.response;

  const validatedRedirect = resolved.status === 'ready' ? resolved.redirectUri : null;
  const state = scalarConsentField(fields, 'state');

  if (scalarConsentField(fields, 'decision') === 'deny') {
    if (!validatedRedirect) {
      return formPost
        ? consentPageRedirect(request, fields, 'invalid_request')
        : jsonInline(400, 'invalid_request', OAUTH_CONSENT_COPY.invalidRequest);
    }
    return clientNavigation(validatedRedirect, formPost, {
      error: 'access_denied',
      error_description: OAUTH_CONSENT_COPY.accessDenied,
      state,
    });
  }

  try {
    const input = consentFieldsSchema.parse({
      client_id: scalarConsentField(fields, 'client_id'),
      redirect_uri: scalarConsentField(fields, 'redirect_uri'),
      state,
      scope: scalarConsentField(fields, 'scope'),
      code_challenge: scalarConsentField(fields, 'code_challenge'),
      code_challenge_method: scalarConsentField(fields, 'code_challenge_method'),
      resource: scalarConsentField(fields, 'resource'),
      allow_write: scalarConsentField(fields, 'allow_write'),
    });

    if (!validatedRedirect || resolved.status !== 'ready') {
      return formPost
        ? consentPageRedirect(request, fields, 'invalid_request')
        : jsonInline(400, 'invalid_request', OAUTH_CONSENT_COPY.invalidRequest);
    }

    let scopes = parseScopeParam(input.scope);
    if (input.allow_write === 'false') {
      scopes = scopes.filter((scope) => scope !== 'write');
    }
    if (!scopes.includes('read')) scopes = ['read', ...scopes];

    // RFC 8707: absent resource means this MCP server; any other is rejected.
    const mcpResource = getMcpResourceUrl(request);
    if (input.resource && !mcpResourcesMatch(input.resource, mcpResource, request)) {
      if (formPost) {
        return clientNavigation(validatedRedirect, true, {
          error: 'invalid_request',
          error_description: OAUTH_CONSENT_COPY.invalidTarget,
          state: input.state,
        });
      }
      return withValidatedFormAction(
        jsonInline(400, 'invalid_target', OAUTH_CONSENT_COPY.invalidTarget),
        validatedRedirect,
      );
    }
    const resource = normalizeMcpResourceUrl(input.resource ?? mcpResource, request);

    const parsedContexts = parseContextFieldsFromForm(fields);
    const allowedContexts = await validateSelectableContexts(userId, parsedContexts);

    const code = await createAuthorizationCode({
      clientId: input.client_id,
      userId,
      redirectUri: input.redirect_uri,
      scopes,
      codeChallenge: input.code_challenge,
      codeChallengeMethod: input.code_challenge_method,
      resource,
      allowedContexts,
    });

    return clientNavigation(validatedRedirect, formPost, {
      code,
      state: input.state,
    });
  } catch (error) {
    // RFC 6749 §4.1.2.1: once redirect_uri is valid, a no-JS form post tells
    // the client with access_denied or invalid_request. JSON stays on the page.
    if (validatedRedirect && formPost) {
      if (!(error instanceof AgentAuthError) && !(error instanceof z.ZodError)) {
        console.error('OAuth consent error:', error);
      }
      return clientNavigation(validatedRedirect, true, {
        error: 'invalid_request',
        error_description: safeOAuthDescription(error),
        state,
      });
    }
    if (formPost) {
      return consentPageRedirect(request, fields, 'invalid_request');
    }
    if (error instanceof AgentAuthError) {
      const response = jsonInline(error.status, error.message, error.message);
      return validatedRedirect
        ? withValidatedFormAction(response, validatedRedirect)
        : response;
    }
    if (error instanceof z.ZodError) {
      const response = NextResponse.json(
        {
          error: 'invalid_request',
          error_description: OAUTH_CONSENT_COPY.invalidRequest,
          details: error.issues,
        },
        { status: 400 },
      );
      return validatedRedirect
        ? withValidatedFormAction(response, validatedRedirect)
        : response;
    }
    // Never echo internal messages (Prisma, etc.) to the browser.
    console.error('OAuth consent error:', error);
    const response = jsonInline(400, OAUTH_CONSENT_COPY.generic, OAUTH_CONSENT_COPY.generic);
    return validatedRedirect
      ? withValidatedFormAction(response, validatedRedirect)
      : response;
  }
};
