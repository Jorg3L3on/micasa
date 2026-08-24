import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  resolveOAuthClientMock,
  verifyClientSecretMock,
  exchangeAuthorizationCodeMock,
} = vi.hoisted(() => ({
  resolveOAuthClientMock: vi.fn(),
  verifyClientSecretMock: vi.fn(),
  exchangeAuthorizationCodeMock: vi.fn(),
}));

vi.mock('@/lib/server/mcp-oauth/clients', () => ({
  resolveOAuthClient: resolveOAuthClientMock,
  verifyClientSecret: verifyClientSecretMock,
  assertRedirectUriAllowed: vi.fn(),
}));

vi.mock('@/lib/server/mcp-oauth/grants', () => ({
  exchangeAuthorizationCode: exchangeAuthorizationCodeMock,
  refreshOAuthGrant: vi.fn(),
}));

import { POST } from '@/app/api/oauth/token/route';

const CLIENT_ID = '11111111-2222-3333-4444-555555555555';
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

  it('intercambia code sin client_secret para private_key_jwt (ChatGPT CIMD)', async () => {
    resolveOAuthClientMock.mockResolvedValue({
      ...clientRow,
      client_id: 'https://chatgpt.com/oauth/client.json',
      token_endpoint_auth_method: 'private_key_jwt',
    });
    verifyClientSecretMock.mockReturnValue(true);
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
      redirect_uri: 'https://chatgpt.com/connector_platform_oauth_redirect',
      client_id: 'https://chatgpt.com/oauth/client.json',
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
    expect(verifyClientSecretMock).toHaveBeenCalledWith(
      expect.objectContaining({ token_endpoint_auth_method: 'private_key_jwt' }),
      undefined,
    );
  });

  it('invalid_request when code_verifier is missing', async () => {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code: 'micasa_code_uno-solo-uso',
      redirect_uri: 'https://chatgpt.com/connector/oauth/chatgpt',
      client_id: 'https://chatgpt.com/oauth/client.json',
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
    expect(json.error_description).toContain('code_verifier');
    expect(exchangeAuthorizationCodeMock).not.toHaveBeenCalled();
  });

  it('ignores private_key_jwt client_assertion fields on form POST', async () => {
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
      redirect_uri: 'https://chatgpt.com/connector/oauth/chatgpt',
      client_id: 'https://chatgpt.com/oauth/client.json',
      code_verifier: VERIFIER,
      resource: 'http://localhost:3000/mcp',
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
        clientId: 'https://chatgpt.com/oauth/client.json',
        redirectUri: 'https://chatgpt.com/connector/oauth/chatgpt',
        resource: 'http://localhost:3000/mcp',
      }),
    );
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
