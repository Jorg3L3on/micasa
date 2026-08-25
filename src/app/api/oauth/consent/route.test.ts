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
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
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
        headers: { 'Content-Type': 'application/json' },
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
});
