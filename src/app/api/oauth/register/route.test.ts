import { beforeEach, describe, expect, it, vi } from 'vitest';

const { registerDynamicOAuthClientMock } = vi.hoisted(() => ({
  registerDynamicOAuthClientMock: vi.fn(),
}));

vi.mock('@/lib/server/mcp-oauth/clients', () => ({
  registerDynamicOAuthClient: registerDynamicOAuthClientMock,
}));

import { OPTIONS, POST } from '@/app/api/oauth/register/route';

beforeEach(() => {
  vi.clearAllMocks();
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
        client_id: '22222222-3333-4444-5555-666666666666',
        client_name: 'ChatGPT',
        redirect_uris: ['https://chatgpt.com/connector_platform_oauth_redirect'],
        grant_types: ['authorization_code', 'refresh_token'],
        response_types: ['code'],
        token_endpoint_auth_method: 'private_key_jwt',
        client_uri: 'https://chatgpt.com/',
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
          jwks_uri: 'https://chatgpt.com/oauth/jwks.json',
        }),
      }) as Parameters<typeof POST>[0],
    );

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.token_endpoint_auth_method).toBe('private_key_jwt');
    expect(body).not.toHaveProperty('client_secret');
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
});
