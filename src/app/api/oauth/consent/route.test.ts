import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authMock, createAuthorizationCodeMock, validateSelectableContextsMock } =
  vi.hoisted(() => ({
    authMock: vi.fn(),
    createAuthorizationCodeMock: vi.fn(),
    validateSelectableContextsMock: vi.fn(),
  }));

vi.mock('@/lib/auth', () => ({
  auth: authMock,
}));

vi.mock('@/lib/server/mcp-oauth/clients', () => ({
  resolveOAuthClient: vi.fn().mockResolvedValue({
    client_id: 'https://chatgpt.com/oauth/client.json',
    client_name: 'ChatGPT',
    redirect_uris: ['https://chatgpt.com/connector_platform_oauth_redirect'],
    grant_types: ['authorization_code'],
    response_types: ['code'],
    token_endpoint_auth_method: 'private_key_jwt',
    client_uri: null,
    logo_uri: null,
    client_secret_hash: null,
  }),
  assertRedirectUriAllowed: vi.fn(),
}));

vi.mock('@/lib/server/mcp-oauth/grants', () => ({
  createAuthorizationCode: createAuthorizationCodeMock,
}));

vi.mock('@/lib/server/agent-allowed-contexts', async (importOriginal) => {
  const actual = await importOriginal<
    typeof import('@/lib/server/agent-allowed-contexts')
  >();
  return {
    ...actual,
    validateSelectableContexts: validateSelectableContextsMock,
  };
});

import { POST } from '@/app/api/oauth/consent/route';
import {
  assertRedirectUriAllowed,
  resolveOAuthClient,
} from '@/lib/server/mcp-oauth/clients';

const CONSENT_FIELDS = {
  client_id: 'https://chatgpt.com/oauth/client.json',
  redirect_uri: 'https://chatgpt.com/connector/oauth/chatgpt',
  code_challenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
  code_challenge_method: 'S256',
  resource: 'https://micasa.example/mcp',
  state: 'fixture-state',
  allow_write: 'true',
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('NEXTAUTH_URL', 'https://micasa.example');
  authMock.mockResolvedValue({ user: { id: '42' } });
  createAuthorizationCodeMock.mockResolvedValue('micasa_code_fixture-code-value');
  validateSelectableContextsMock.mockImplementation(
    async (_userId, contexts) => contexts,
  );
});

describe('POST /api/oauth/consent', () => {
  it('form POST returns HTTP 302 Found without iss in callback query', async () => {
    const body = new URLSearchParams({
      ...CONSENT_FIELDS,
      context_owner_type: 'user',
      context_owner_id: '42',
    });

    const response = await POST(
      new NextRequest('https://micasa.example/api/oauth/consent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Origin: 'https://micasa.example',
        },
        body,
      }),
    );

    expect(response.status).toBe(302);
    const location = response.headers.get('Location');
    expect(location).toBeTruthy();
    const callback = new URL(location!);
    expect(callback.origin).toBe('https://chatgpt.com');
    expect(callback.searchParams.get('code')).toBe('micasa_code_fixture-code-value');
    expect(callback.searchParams.get('state')).toBe('fixture-state');
    expect(callback.searchParams.has('iss')).toBe(false);
    expect(response.headers.get('Content-Security-Policy')).toBe(
      "form-action 'self' https://chatgpt.com",
    );
    expect(response.headers.get('Content-Security-Policy')).not.toContain(
      'chat.openai.com',
    );
  });

  it('JSON POST still returns redirect_to for SPA clients', async () => {
    const response = await POST(
      new NextRequest('https://micasa.example/api/oauth/consent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'https://micasa.example',
        },
        body: JSON.stringify({
          ...CONSENT_FIELDS,
          context_owner_type: 'user',
          context_owner_id: '42',
        }),
      }),
    );

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.redirect_to).toContain('micasa_code_fixture-code-value');
    expect(json.redirect_to).not.toContain('iss=');
    expect(response.headers.get('Content-Security-Policy')).toBe(
      "form-action 'self' https://chatgpt.com",
    );
    expect(response.headers.get('Content-Security-Policy')).not.toContain(
      'chat.openai.com',
    );
  });

  it.each([
    ['https://client.example.test/cb', 'https://client.example.test'],
    ['http://127.0.0.1:4567/cb', 'http://127.0.0.1:4567'],
  ])(
    'form POST to %s returns code and state with only that origin in form-action',
    async (redirectUri, origin) => {
      const body = new URLSearchParams({
        ...CONSENT_FIELDS,
        redirect_uri: redirectUri,
        context_owner_type: 'user',
        context_owner_id: '42',
      });
      const response = await POST(
        new NextRequest('https://micasa.example/api/oauth/consent', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Origin: 'https://micasa.example',
          },
          body,
        }),
      );

      expect(response.status).toBe(302);
      const callback = new URL(response.headers.get('Location')!);
      expect(callback.origin).toBe(origin);
      expect(callback.searchParams.get('code')).toBe('micasa_code_fixture-code-value');
      expect(callback.searchParams.get('state')).toBe('fixture-state');
      expect(callback.searchParams.has('iss')).toBe(false);
      const csp = response.headers.get('Content-Security-Policy');
      expect(csp).toBe(`form-action 'self' ${origin}`);
      expect(csp).not.toContain('chat.openai.com');
      expect(csp).not.toContain('https://chatgpt.com https://chat.openai.com');
    },
  );

  it.each([
    ['https://client.example.test/cb', 'https://client.example.test'],
    ['http://127.0.0.1:4567/cb', 'http://127.0.0.1:4567'],
  ])('JSON POST to %s returns redirect_to with code and state', async (redirectUri, origin) => {
    const response = await jsonConsent(
      { Origin: 'https://micasa.example' },
      { ...CONSENT_FIELDS, redirect_uri: redirectUri },
    );

    expect(response.status).toBe(200);
    const json = await response.json();
    const callback = new URL(json.redirect_to);
    expect(callback.origin).toBe(origin);
    expect(callback.searchParams.get('code')).toBe('micasa_code_fixture-code-value');
    expect(callback.searchParams.get('state')).toBe('fixture-state');
    expect(response.headers.get('Content-Security-Policy')).toBe(
      `form-action 'self' ${origin}`,
    );
  });

  const jsonConsent = (
    headers: Record<string, string>,
    fields: Record<string, string> = CONSENT_FIELDS,
  ) =>
    POST(
      new NextRequest('https://micasa.example/api/oauth/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({
          ...fields,
          context_owner_type: 'user',
          context_owner_id: '42',
        }),
      }),
    );

  it('403 when Origin is another host (CSRF)', async () => {
    const response = await jsonConsent({ Origin: 'https://evil.example' });

    expect(response.status).toBe(403);
    expect(createAuthorizationCodeMock).not.toHaveBeenCalled();
    expect(authMock).not.toHaveBeenCalled();
  });

  it('403 without Origin unless Sec-Fetch-Site is same-origin', async () => {
    expect((await jsonConsent({})).status).toBe(403);
    expect((await jsonConsent({ 'Sec-Fetch-Site': 'cross-site' })).status).toBe(403);
    expect((await jsonConsent({ 'Sec-Fetch-Site': 'same-origin' })).status).toBe(200);
  });

  it('200 for a same-origin POST', async () => {
    const response = await jsonConsent({ Origin: 'https://micasa.example' });
    expect(response.status).toBe(200);
  });

  it('invalid_target when resource is another server', async () => {
    const response = await jsonConsent(
      { Origin: 'https://micasa.example' },
      { ...CONSENT_FIELDS, resource: 'https://evil.example/api/mcp' },
    );

    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe('invalid_target');
    expect(createAuthorizationCodeMock).not.toHaveBeenCalled();
  });

  it('stores the MCP URL when resource is absent', async () => {
    const fields: Record<string, string> = { ...CONSENT_FIELDS };
    delete fields.resource;
    const response = await jsonConsent({ Origin: 'https://micasa.example' }, fields);

    expect(response.status).toBe(200);
    expect(createAuthorizationCodeMock).toHaveBeenCalledWith(
      expect.objectContaining({ resource: 'https://micasa.example/api/mcp' }),
    );
  });

  it('does not echo internal error messages', async () => {
    createAuthorizationCodeMock.mockRejectedValue(
      new Error('Invalid `prisma.mcpOAuthAuthorizationCode.create()` invocation'),
    );
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const response = await jsonConsent({ Origin: 'https://micasa.example' });
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(JSON.stringify(json)).not.toContain('prisma');
    spy.mockRestore();
  });

  it('JSON 401 points back at the same authorize URL', async () => {
    authMock.mockResolvedValue(null);
    const response = await jsonConsent(
      { Origin: 'https://micasa.example' },
      { ...CONSENT_FIELDS, redirect_uri: 'https://client.example.test/cb' },
    );
    expect(response.status).toBe(401);
    const json = await response.json();
    expect(json.error).toBe('unauthorized');
    expect(json.error_description).toBe('Inicia sesión de nuevo');
    expect(json.login_url).toContain('/login?callbackUrl=');
    const login = new URL(json.login_url, 'https://micasa.example');
    const authorize = new URL(login.searchParams.get('callbackUrl') ?? '', 'https://micasa.example');
    expect(authorize.pathname).toBe('/api/oauth/authorize');
    expect(authorize.searchParams.get('redirect_uri')).toBe('https://client.example.test/cb');
    expect(authorize.searchParams.get('state')).toBe('fixture-state');
    expect(response.headers.get('Location')).toBeNull();
    expect(createAuthorizationCodeMock).not.toHaveBeenCalled();
  });

  it('form POST 401 redirects to login with the authorize callback', async () => {
    authMock.mockResolvedValue(null);
    const body = new URLSearchParams({
      ...CONSENT_FIELDS,
      redirect_uri: 'http://127.0.0.1:4567/cb',
    });
    const response = await POST(
      new NextRequest('https://micasa.example/api/oauth/consent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Origin: 'https://micasa.example',
        },
        body,
      }),
    );
    expect(response.status).toBe(302);
    const location = new URL(response.headers.get('Location')!);
    expect(location.pathname).toBe('/login');
    const authorize = new URL(location.searchParams.get('callbackUrl') ?? '', 'https://micasa.example');
    expect(authorize.pathname).toBe('/api/oauth/authorize');
    expect(authorize.searchParams.get('redirect_uri')).toBe('http://127.0.0.1:4567/cb');
    expect(authorize.searchParams.get('state')).toBe('fixture-state');
    expect(createAuthorizationCodeMock).not.toHaveBeenCalled();
  });

  it('JSON invalid client stays on the consent host', async () => {
    vi.mocked(resolveOAuthClient).mockResolvedValueOnce(null);
    const response = await jsonConsent(
      { Origin: 'https://micasa.example' },
      { ...CONSENT_FIELDS, redirect_uri: 'https://client.example.test/cb' },
    );
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBe('invalid_client');
    expect(json.error_description).toBe('Cliente inválido.');
    expect(response.headers.get('Location')).toBeNull();
    expect(response.headers.get('Content-Security-Policy')).toBeNull();
    expect(createAuthorizationCodeMock).not.toHaveBeenCalled();
  });

  it('does not put an unvalidated redirect origin in form-action', async () => {
    vi.mocked(assertRedirectUriAllowed).mockImplementationOnce(() => {
      throw new Error('redirect_uri no autorizado para este cliente');
    });
    const response = await jsonConsent(
      { Origin: 'https://micasa.example' },
      { ...CONSENT_FIELDS, redirect_uri: 'https://client.example.test/cb' },
    );
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error_description).toBe('La dirección de retorno no está permitida.');
    expect(response.headers.get('Content-Security-Policy') ?? '').not.toContain(
      'client.example.test',
    );
    expect(createAuthorizationCodeMock).not.toHaveBeenCalled();
  });

  it('form POST after a validated redirect reports invalid_request to the client', async () => {
    const response = await jsonConsent(
      { Origin: 'https://micasa.example' },
      {
        ...CONSENT_FIELDS,
        redirect_uri: 'https://client.example.test/cb',
        code_challenge: 'too-short',
      },
    );
    expect(response.status).toBe(400);
    expect((await response.json()).error_description).toBe('Solicitud inválida.');

    const body = new URLSearchParams({
      ...CONSENT_FIELDS,
      redirect_uri: 'https://client.example.test/cb',
      code_challenge: 'too-short',
    });
    const formResponse = await POST(
      new NextRequest('https://micasa.example/api/oauth/consent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Origin: 'https://micasa.example',
        },
        body,
      }),
    );
    expect(formResponse.status).toBe(302);
    const location = new URL(formResponse.headers.get('Location')!);
    expect(location.origin).toBe('https://client.example.test');
    expect(location.searchParams.get('error')).toBe('invalid_request');
    expect(location.searchParams.get('state')).toBe('fixture-state');
    expect(location.searchParams.has('code')).toBe(false);
    expect(formResponse.headers.get('Content-Security-Policy')).toBe(
      "form-action 'self' https://client.example.test",
    );
    expect(createAuthorizationCodeMock).not.toHaveBeenCalled();
  });

  it('form POST invalid_target redirects with invalid_request and state', async () => {
    const body = new URLSearchParams({
      ...CONSENT_FIELDS,
      redirect_uri: 'http://127.0.0.1:4567/cb',
      resource: 'https://evil.example/api/mcp',
      context_owner_type: 'user',
      context_owner_id: '42',
    });
    const response = await POST(
      new NextRequest('https://micasa.example/api/oauth/consent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Origin: 'https://micasa.example',
        },
        body,
      }),
    );
    expect(response.status).toBe(302);
    const location = new URL(response.headers.get('Location')!);
    expect(location.origin).toBe('http://127.0.0.1:4567');
    expect(location.searchParams.get('error')).toBe('invalid_request');
    expect(location.searchParams.get('state')).toBe('fixture-state');
    expect(createAuthorizationCodeMock).not.toHaveBeenCalled();
  });

  it('form POST deny redirects with access_denied and state', async () => {
    const body = new URLSearchParams({
      ...CONSENT_FIELDS,
      redirect_uri: 'https://client.example.test/cb',
      decision: 'deny',
    });
    const response = await POST(
      new NextRequest('https://micasa.example/api/oauth/consent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Origin: 'https://micasa.example',
        },
        body,
      }),
    );
    expect(response.status).toBe(302);
    const location = new URL(response.headers.get('Location')!);
    expect(location.origin).toBe('https://client.example.test');
    expect(location.searchParams.get('error')).toBe('access_denied');
    expect(location.searchParams.get('state')).toBe('fixture-state');
    expect(createAuthorizationCodeMock).not.toHaveBeenCalled();
  });

  it('form POST does not send the browser to a rejected redirect_uri', async () => {
    vi.mocked(assertRedirectUriAllowed).mockImplementationOnce(() => {
      throw new Error('redirect_uri no autorizado para este cliente');
    });
    const body = new URLSearchParams({
      ...CONSENT_FIELDS,
      redirect_uri: 'https://client.example.test/cb',
    });
    const response = await POST(
      new NextRequest('https://micasa.example/api/oauth/consent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Origin: 'https://micasa.example',
        },
        body,
      }),
    );
    expect(response.status).toBe(302);
    const location = new URL(response.headers.get('Location')!);
    expect(location.origin).toBe('https://micasa.example');
    expect(location.pathname).toBe('/oauth/consent');
    expect(location.searchParams.get('consent_error')).toBe('redirect_uri');
    expect(location.searchParams.get('error')).toBeNull();
  });

  it('form POST hides internal failures behind invalid_request', async () => {
    createAuthorizationCodeMock.mockRejectedValueOnce(
      new Error('Invalid `prisma.mcpOAuthAuthorizationCode.create()` invocation'),
    );
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const body = new URLSearchParams({
      ...CONSENT_FIELDS,
      redirect_uri: 'https://client.example.test/cb',
      context_owner_type: 'user',
      context_owner_id: '42',
    });
    const response = await POST(
      new NextRequest('https://micasa.example/api/oauth/consent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Origin: 'https://micasa.example',
        },
        body,
      }),
    );
    const location = response.headers.get('Location') ?? '';
    expect(response.status).toBe(302);
    expect(location).not.toContain('prisma');
    const callback = new URL(location);
    expect(callback.origin).toBe('https://client.example.test');
    expect(callback.searchParams.get('error')).toBe('invalid_request');
    expect(callback.searchParams.get('state')).toBe('fixture-state');
    spy.mockRestore();
  });
});
