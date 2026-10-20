import { beforeEach, describe, expect, it, vi } from 'vitest';

const { registerDynamicOAuthClientMock } = vi.hoisted(() => ({
  registerDynamicOAuthClientMock: vi.fn(),
}));

vi.mock('@/lib/server/mcp-oauth/clients', () => ({
  registerDynamicOAuthClient: registerDynamicOAuthClientMock,
}));

import { OPTIONS, POST } from '@/app/api/oauth/register/route';
import { resetRateLimitStoreForTests } from '@/lib/server/rate-limit';

const registeredClient = (redirectUris: string[]) => ({
  client: {
    client_id: '11111111-2222-3333-4444-555555555555',
    client_name: 'Cliente',
    redirect_uris: redirectUris,
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'],
    token_endpoint_auth_method: 'none',
    client_uri: null,
    logo_uri: null,
    client_secret_hash: null,
  },
  clientSecret: null,
});

const register = (body: Record<string, unknown>, ip = '203.0.113.20') =>
  POST(
    new Request('http://localhost:3000/api/oauth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': ip },
      body: JSON.stringify(body),
    }) as Parameters<typeof POST>[0],
  );

beforeEach(() => {
  vi.clearAllMocks();
  resetRateLimitStoreForTests();
  registerDynamicOAuthClientMock.mockImplementation(
    async (input: { redirect_uris: string[] }) => registeredClient(input.redirect_uris),
  );
});

describe('POST /api/oauth/register (DCR)', () => {
  it('OPTIONS responde 204 con CORS', () => {
    const response = OPTIONS();
    expect(response.status).toBe(204);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });

  it('registra un cliente público y devuelve client_id', async () => {
    registerDynamicOAuthClientMock.mockResolvedValue({
      client: {
        client_id: '11111111-2222-3333-4444-555555555555',
        client_name: 'ChatGPT Test Client',
        redirect_uris: ['https://chatgpt.com/connector_platform/oauth/callback'],
        grant_types: ['authorization_code', 'refresh_token'],
        response_types: ['code'],
        token_endpoint_auth_method: 'none',
        client_uri: null,
        logo_uri: null,
        client_secret_hash: null,
      },
      clientSecret: null,
    });

    const response = await POST(
      new Request('http://localhost:3000/api/oauth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_name: 'ChatGPT Test Client',
          redirect_uris: ['https://chatgpt.com/connector_platform/oauth/callback'],
          token_endpoint_auth_method: 'none',
        }),
      }) as Parameters<typeof POST>[0],
    );

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.client_id).toBe('11111111-2222-3333-4444-555555555555');
    expect(body.client_name).toBe('ChatGPT Test Client');
    expect(body.token_endpoint_auth_method).toBe('none');
    expect(body).not.toHaveProperty('client_secret');
  });

  it('registra un cliente con private_key_jwt (ChatGPT DCR)', async () => {
    registerDynamicOAuthClientMock.mockResolvedValue({
      client: {
        client_id: '11111111-2222-3333-4444-555555555555',
        client_name: 'MCP OAuth client',
        redirect_uris: ['https://chatgpt.com/connector_platform_oauth_redirect'],
        grant_types: ['authorization_code', 'refresh_token'],
        response_types: ['code'],
        token_endpoint_auth_method: 'private_key_jwt',
        client_uri: null,
        logo_uri: null,
        client_secret_hash: null,
      },
      clientSecret: null,
    });

    const response = await POST(
      new Request('http://localhost:3000/api/oauth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          redirect_uris: ['https://chatgpt.com/connector_platform_oauth_redirect'],
          token_endpoint_auth_method: 'private_key_jwt',
        }),
      }) as Parameters<typeof POST>[0],
    );

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.token_endpoint_auth_method).toBe('private_key_jwt');
    expect(body).not.toHaveProperty('client_secret');
    expect(registerDynamicOAuthClientMock).toHaveBeenCalledWith(
      expect.objectContaining({
        token_endpoint_auth_method: 'private_key_jwt',
      }),
    );
  });

  it('rechaza metadata inválida', async () => {
    const response = await POST(
      new Request('http://localhost:3000/api/oauth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_name: '', redirect_uris: [] }),
      }) as Parameters<typeof POST>[0],
    );

    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe('invalid_client_metadata');
  });

  it.each([
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'http://evil.example/cb',
    'https://chatgpt.com/cb#frag',
    'https://user:pass@chatgpt.com/cb',
    'file:///etc/passwd',
  ])('rechaza redirect_uri %s con invalid_redirect_uri', async (redirectUri) => {
    const response = await register({ redirect_uris: [redirectUri] });

    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe('invalid_redirect_uri');
    expect(registerDynamicOAuthClientMock).not.toHaveBeenCalled();
  });

  it.each([
    'http://localhost:3000/cb',
    'http://127.0.0.1:8080/callback',
    'http://[::1]:5000/cb',
    'https://chatgpt.com/connector_platform_oauth_redirect',
    'com.ejemplo.app:/cb',
  ])('acepta redirect_uri %s', async (redirectUri) => {
    const response = await register({ redirect_uris: [redirectUri] });

    expect(response.status).toBe(201);
    expect((await response.json()).redirect_uris).toEqual([redirectUri]);
  });

  it.each(['client_uri', 'logo_uri'])(
    'rechaza %s http:// con invalid_client_metadata',
    async (field) => {
      const response = await register({
        redirect_uris: ['https://chatgpt.com/connector_platform_oauth_redirect'],
        [field]: 'http://evil.example',
      });

      expect(response.status).toBe(400);
      expect((await response.json()).error).toBe('invalid_client_metadata');
    },
  );

  it('responde 429 con Retry-After en el registro 11 desde la misma IP en una hora', async () => {
    const body = { redirect_uris: ['https://chatgpt.com/connector_platform_oauth_redirect'] };
    for (let i = 0; i < 10; i += 1) {
      expect((await register(body, '203.0.113.30')).status).toBe(201);
    }

    const limited = await register(body, '203.0.113.30');
    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get('Retry-After'))).toBeGreaterThan(0);
    expect((await limited.json()).error).toBe('temporarily_unavailable');
    expect(registerDynamicOAuthClientMock).toHaveBeenCalledTimes(10);
  });
});
