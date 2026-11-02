import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authMock, resolveOAuthClientMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  resolveOAuthClientMock: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  auth: authMock,
}));

vi.mock('@/lib/server/mcp-oauth/clients', () => ({
  resolveOAuthClient: resolveOAuthClientMock,
  assertRedirectUriAllowed: vi.fn(),
}));

import { GET, OPTIONS } from '@/app/api/oauth/authorize/route';

const BASE_AUTHORIZE =
  'http://localhost:3000/api/oauth/authorize?response_type=code&client_id=https%3A%2F%2Fchatgpt.com%2Foauth%2Fclient.json&redirect_uri=https%3A%2F%2Fchatgpt.com%2Fconnector_platform_oauth_redirect&code_challenge=E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM&code_challenge_method=S256';

beforeEach(() => {
  vi.clearAllMocks();
  resolveOAuthClientMock.mockResolvedValue({
    client_id: 'https://chatgpt.com/oauth/client.json',
    client_name: 'ChatGPT',
    redirect_uris: ['https://chatgpt.com/connector_platform_oauth_redirect'],
    grant_types: ['authorization_code'],
    response_types: ['code'],
    token_endpoint_auth_method: 'private_key_jwt',
    client_uri: null,
    logo_uri: null,
    client_secret_hash: null,
  });
});

describe('GET /api/oauth/authorize CORS', () => {
  it('OPTIONS responds with CORS headers', () => {
    const response = OPTIONS();
    expect(response.status).toBe(204);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(response.headers.get('Access-Control-Allow-Methods')).toContain('GET');
  });

  it('302 redirect to login includes Access-Control-Allow-Origin', async () => {
    authMock.mockResolvedValue(null);

    const response = await GET(new NextRequest(BASE_AUTHORIZE));

    expect(response.status).toBe(302);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    const location = new URL(response.headers.get('Location')!);
    expect(location.pathname).toBe('/login');
    const callback = location.searchParams.get('callbackUrl') ?? '';
    expect(callback.startsWith('/api/oauth/authorize?')).toBe(true);
    expect(callback).toContain('redirect_uri=');
  });

  it('302 redirect to consent includes Access-Control-Allow-Origin', async () => {
    authMock.mockResolvedValue({ user: { id: '1' } });

    const response = await GET(new NextRequest(BASE_AUTHORIZE));

    expect(response.status).toBe(302);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(response.headers.get('Location')).toContain('/oauth/consent');
  });

  it('redirects with invalid_target when resource is another server', async () => {
    authMock.mockResolvedValue({ user: { id: '42' } });

    const response = await GET(
      new NextRequest(
        `${BASE_AUTHORIZE}&state=xyz&resource=${encodeURIComponent('https://evil.example/api/mcp')}`,
      ),
    );

    expect(response.status).toBe(302);
    const location = new URL(response.headers.get('Location')!);
    expect(location.origin).toBe('https://chatgpt.com');
    expect(location.searchParams.get('error')).toBe('invalid_target');
    expect(location.searchParams.get('state')).toBe('xyz');
  });

  it('defaults resource to the MCP URL when absent', async () => {
    authMock.mockResolvedValue({ user: { id: '42' } });

    const response = await GET(new NextRequest(BASE_AUTHORIZE));

    const location = new URL(response.headers.get('Location')!);
    expect(location.pathname).toBe('/oauth/consent');
    expect(location.searchParams.get('resource')).toBe('http://localhost:3000/api/mcp');
  });

  it('accepts the /mcp alias of this server', async () => {
    authMock.mockResolvedValue({ user: { id: '42' } });

    const response = await GET(
      new NextRequest(
        `${BASE_AUTHORIZE}&resource=${encodeURIComponent('http://localhost:3000/mcp')}`,
      ),
    );

    const location = new URL(response.headers.get('Location')!);
    expect(location.pathname).toBe('/oauth/consent');
    expect(location.searchParams.get('resource')).toBe('http://localhost:3000/api/mcp');
  });
});
