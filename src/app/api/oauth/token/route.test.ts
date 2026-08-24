import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  resolveOAuthClientMock,
  verifyClientSecretMock,
  exchangeAuthorizationCodeMock,
  resolveAuthorizationCodeAuthMock,
  peekAuthorizationCodeMock,
} = vi.hoisted(() => ({
  resolveOAuthClientMock: vi.fn(),
  verifyClientSecretMock: vi.fn(),
  exchangeAuthorizationCodeMock: vi.fn(),
  resolveAuthorizationCodeAuthMock: vi.fn(),
  peekAuthorizationCodeMock: vi.fn(),
}));

vi.mock('@/lib/server/mcp-oauth/clients', () => ({
  resolveOAuthClient: resolveOAuthClientMock,
  verifyClientSecret: verifyClientSecretMock,
  assertRedirectUriAllowed: vi.fn(),
}));

vi.mock('@/lib/server/mcp-oauth/grants', () => ({
  exchangeAuthorizationCode: exchangeAuthorizationCodeMock,
  peekAuthorizationCode: peekAuthorizationCodeMock,
  refreshOAuthGrant: vi.fn(),
}));

vi.mock('@/lib/server/mcp-oauth/token-auth', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/lib/server/mcp-oauth/token-auth')>();
  return {
    ...actual,
    resolveAuthorizationCodeAuth: resolveAuthorizationCodeAuthMock,
  };
});

import { POST } from '@/app/api/oauth/token/route';

const CLIENT_ID = '11111111-2222-3333-4444-555555555555';
const CIMD_CLIENT_ID = 'https://chatgpt.com/oauth/fixture-client/client.json';
const VERIFIER =
  'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';

const clientRow = {
  client_id: CLIENT_ID,
  client_name: 'ChatGPT Test Client',
  redirect_uris: ['https://chatgpt.com/connector_platform/oauth/callback'],
  grant_types: ['authorization_code'],
  response_types: ['code'],
  token_endpoint_auth_method: 'none',
  client_uri: null,
  logo_uri: null,
  client_secret_hash: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  resolveOAuthClientMock.mockResolvedValue(clientRow);
  verifyClientSecretMock.mockReturnValue(true);
  resolveAuthorizationCodeAuthMock.mockResolvedValue({
    ok: true,
    codeVerifier: VERIFIER,
    clientAuthenticatedViaPrivateKeyJwt: false,
  });
  peekAuthorizationCodeMock.mockResolvedValue({
    client_id: CIMD_CLIENT_ID,
    redirect_uri: 'https://chatgpt.com/connector/oauth/fixture-client',
  });
});

describe('POST /api/oauth/token (PKCE)', () => {
  it('intercambia authorization code por access token', async () => {
    exchangeAuthorizationCodeMock.mockResolvedValue({
      access_token: 'micasa_oauth_access-token-de-prueba',
      token_type: 'bearer',
      expires_in: 7776000,
      refresh_token: 'micasa_refresh_refresh-token-de-prueba',
      scope: 'read write',
    });

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code: 'micasa_code_uno-solo-uso',
      redirect_uri: 'https://chatgpt.com/connector_platform/oauth/callback',
      client_id: CLIENT_ID,
      code_verifier: VERIFIER,
      resource: 'http://localhost:3000/api/mcp',
    });

    const response = await POST(
      new Request('http://localhost:3000/api/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      }) as Parameters<typeof POST>[0],
    );

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.access_token).toBe('micasa_oauth_access-token-de-prueba');
    expect(json.token_type).toBe('bearer');
    expect(exchangeAuthorizationCodeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId: CLIENT_ID,
        codeVerifier: VERIFIER,
      }),
    );
  });

  it('intercambia code con client_assertion sin code_verifier (ChatGPT private_key_jwt)', async () => {
    resolveOAuthClientMock.mockResolvedValue({
      ...clientRow,
      client_id: CIMD_CLIENT_ID,
      token_endpoint_auth_method: 'private_key_jwt',
    });
    resolveAuthorizationCodeAuthMock.mockResolvedValue({
      ok: true,
      clientAuthenticatedViaPrivateKeyJwt: true,
    });
    exchangeAuthorizationCodeMock.mockResolvedValue({
      access_token: 'micasa_oauth_access-token-de-prueba',
      token_type: 'bearer',
      expires_in: 7776000,
      refresh_token: 'micasa_refresh_refresh-token-de-prueba',
      scope: 'read write',
    });

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code: 'micasa_code_uno-solo-uso',
      redirect_uri: 'https://chatgpt.com/connector/oauth/fixture-client',
      client_id: CIMD_CLIENT_ID,
      resource: 'http://localhost:3000/api/mcp',
      client_assertion: 'eyJ.fixture.jwt',
      client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
    });

    const response = await POST(
      new Request('http://localhost:3000/api/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      }) as Parameters<typeof POST>[0],
    );

    expect(response.status).toBe(200);
    expect(exchangeAuthorizationCodeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId: CIMD_CLIENT_ID,
        clientAuthenticatedViaPrivateKeyJwt: true,
        codeVerifier: undefined,
      }),
    );
  });

  it('invalid_request when neither code_verifier nor client_assertion is present', async () => {
    resolveAuthorizationCodeAuthMock.mockResolvedValue({
      ok: false,
      error: 'invalid_request',
      description:
        'Se requiere code_verifier (PKCE) o client_assertion (private_key_jwt)',
    });

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code: 'micasa_code_uno-solo-uso',
      redirect_uri: 'https://chatgpt.com/connector/oauth/fixture-client',
      client_id: CIMD_CLIENT_ID,
      resource: 'http://localhost:3000/mcp',
    });

    const response = await POST(
      new Request('http://localhost:3000/api/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      }) as Parameters<typeof POST>[0],
    );

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBe('invalid_request');
    expect(exchangeAuthorizationCodeMock).not.toHaveBeenCalled();
  });

  it('401 cuando el cliente es desconocido', async () => {
    resolveOAuthClientMock.mockResolvedValue(null);

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code: 'micasa_code_x',
      redirect_uri: 'https://chatgpt.com/connector_platform/oauth/callback',
      client_id: CLIENT_ID,
      code_verifier: VERIFIER,
    });

    const response = await POST(
      new Request('http://localhost:3000/api/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      }) as Parameters<typeof POST>[0],
    );

    expect(response.status).toBe(401);
    expect((await response.json()).error).toBe('invalid_client');
  });
});
