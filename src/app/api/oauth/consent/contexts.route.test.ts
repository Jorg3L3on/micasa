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
import { AgentAuthError } from '@/lib/server/agent-auth-error';

const CONSENT_FIELDS = {
  client_id: 'https://chatgpt.com/oauth/client.json',
  redirect_uri: 'https://chatgpt.com/connector/oauth/chatgpt',
  code_challenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
  code_challenge_method: 'S256',
  resource: 'https://micasa.example/mcp',
  state: 'fixture-state',
  allow_write: 'true',
  context_owner_type: 'user',
  context_owner_id: '42',
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('NEXTAUTH_URL', 'https://micasa.example');
  authMock.mockResolvedValue({ user: { id: '42' } });
  createAuthorizationCodeMock.mockResolvedValue('micasa_code_fixture-code-value');
  validateSelectableContextsMock.mockResolvedValue([
    { ownerType: 'user', ownerId: 42 },
  ]);
});

describe('POST /api/oauth/consent contexts', () => {
  it('rejects consent with zero contexts', async () => {
    validateSelectableContextsMock.mockRejectedValue(
      new AgentAuthError('Selecciona al menos un contexto', 400),
    );

    const response = await POST(
      new Request('https://micasa.example/api/oauth/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...CONSENT_FIELDS,
          context_owner_type: undefined,
          context_owner_id: undefined,
        }),
      }),
    );

    expect(response.status).toBe(400);
    expect(createAuthorizationCodeMock).not.toHaveBeenCalled();
  });

  it('passes allowed contexts to createAuthorizationCode', async () => {
    const response = await POST(
      new Request('https://micasa.example/api/oauth/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(CONSENT_FIELDS),
      }),
    );

    expect(response.status).toBe(200);
    expect(validateSelectableContextsMock).toHaveBeenCalledWith(
      42,
      [{ ownerType: 'user', ownerId: 42 }],
    );
    expect(createAuthorizationCodeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        allowedContexts: [{ ownerType: 'user', ownerId: 42 }],
      }),
    );
  });
});
