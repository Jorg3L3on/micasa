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
});
