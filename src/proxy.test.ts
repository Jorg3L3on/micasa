import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { findUnique } = vi.hoisted(() => ({ findUnique: vi.fn() }));

vi.mock('@/lib/auth', () => ({
  auth: (handler: (request: NextRequest) => Promise<Response>) => handler,
}));

vi.mock('@/lib/prisma', () => ({
  default: { mcpOAuthClient: { findUnique } },
}));

import proxy from '@/proxy';

type ProxyRequest = NextRequest & { auth: { user: { id: string } } | null };

const runProxy = proxy as unknown as (
  request: ProxyRequest,
  event?: unknown,
) => Promise<Response>;

const invoke = (
  url: string,
  init?: { method?: string; auth?: { user: { id: string } } | null },
) => {
  const request = new NextRequest(url, { method: init?.method ?? 'GET' });
  return runProxy(Object.assign(request, { auth: init?.auth ?? null }));
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('proxy OAuth register rewrite', () => {
  it('rewrites POST /register to the DCR handler', async () => {
    const response = await invoke('http://localhost:3000/register', { method: 'POST' });
    expect(response.headers.get('x-middleware-rewrite')).toContain('/api/oauth/register');
  });

  it('rewrites OPTIONS /register to the DCR handler', async () => {
    const response = await invoke('http://localhost:3000/register', { method: 'OPTIONS' });
    expect(response.headers.get('x-middleware-rewrite')).toContain('/api/oauth/register');
  });

  it('leaves GET /register on the signup page', async () => {
    const response = await invoke('http://localhost:3000/register', { method: 'GET' });
    expect(response.headers.get('x-middleware-rewrite')).toBeNull();
  });
});

describe('proxy consent CSP', () => {
  it('defaults form-action to self when redirect_uri is rejected', async () => {
    findUnique.mockResolvedValue({
      client_id: '11111111-2222-3333-4444-555555555555',
      client_name: 'Cliente',
      redirect_uris: ['https://dcr-client.example.test/cb'],
      grant_types: ['authorization_code'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
      client_uri: null,
      logo_uri: null,
      client_secret_hash: null,
    });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const rejected = 'https://rejected.example.test/cb?token=super-secret';
    const url = new URL('http://localhost:3000/oauth/consent');
    url.searchParams.set('client_id', '11111111-2222-3333-4444-555555555555');
    url.searchParams.set('redirect_uri', rejected);

    const response = await invoke(url.toString(), {
      auth: { user: { id: '42' } },
    });

    expect(response.headers.get('Content-Security-Policy')).toBe("form-action 'self'");
    const logged = warn.mock.calls.map((call) => String(call[0])).join('\n');
    expect(logged).toContain('"reason":"not_registered"');
    expect(logged).not.toContain('rejected.example.test');
    expect(logged).not.toContain('super-secret');
    warn.mockRestore();
  });
});
