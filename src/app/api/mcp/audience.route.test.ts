/**
 * /api/mcp with the real OAuth grant lookup (only Prisma mocked): the token's
 * audience (grant.resource) must be this MCP server, and the 401 challenge
 * must point at the configured issuer whatever the Host header says.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  mcpOAuthGrant: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock('@/lib/prisma', () => ({ default: prismaMock }));

vi.mock('@/lib/server/agent-allowed-contexts', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/lib/server/agent-allowed-contexts')>();
  return { ...actual, loadAllowedContextsForOAuthGrant: vi.fn(async () => []) };
});

import { POST } from '@/app/api/mcp/route';
import { hashOAuthSecret } from '@/lib/server/mcp-oauth/tokens';

const ISSUER = 'https://micasa.example';
const ACCESS = 'micasa_oauth_fixture-access-token-audience-check';

const initialize = (url: string, headers: Record<string, string> = {}) =>
  POST(
    new Request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        ...headers,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-03-26',
          capabilities: {},
          clientInfo: { name: 'test-client', version: '0.0.0' },
        },
      }),
    }) as Parameters<typeof POST>[0],
  );

const grantFor = (resource: string) => ({
  id: 9,
  user_id: 2,
  client_id: 'https://chatgpt.com/oauth/client.json',
  token_hash: hashOAuthSecret(ACCESS),
  token_prefix: ACCESS.slice(0, 20),
  scopes: ['read'],
  resource,
  expires_at: new Date(Date.now() + 60_000),
  revoked_at: null,
  user: { id: 2, active: true },
  client: { client_name: 'ChatGPT' },
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('NEXTAUTH_URL', ISSUER);
  prismaMock.mcpOAuthGrant.update.mockResolvedValue({});
});

describe('/api/mcp OAuth audience', () => {
  it('accepts a token whose grant.resource is this MCP URL', async () => {
    prismaMock.mcpOAuthGrant.findUnique.mockResolvedValue(grantFor(`${ISSUER}/api/mcp`));

    const response = await initialize(`${ISSUER}/api/mcp`, {
      Authorization: `Bearer ${ACCESS}`,
    });
    expect(response.status).toBe(200);
  });

  it('accepts the token when NEXTAUTH_URL is unset and the request is the public URL', async () => {
    vi.stubEnv('NEXTAUTH_URL', '');
    const publicOrigin = 'https://micasa-three.vercel.app';
    prismaMock.mcpOAuthGrant.findUnique.mockResolvedValue(
      grantFor(`${publicOrigin}/api/mcp`),
    );

    const response = await initialize(`${publicOrigin}/api/mcp`, {
      Authorization: `Bearer ${ACCESS}`,
    });
    expect(response.status).toBe(200);
  });

  it('401 for a token whose grant.resource is another URL', async () => {
    prismaMock.mcpOAuthGrant.findUnique.mockResolvedValue(
      grantFor('https://other.example/api/mcp'),
    );

    const response = await initialize(`${ISSUER}/api/mcp`, {
      Authorization: `Bearer ${ACCESS}`,
    });
    expect(response.status).toBe(401);
  });
});

describe('/api/mcp 401 challenge', () => {
  it('points resource_metadata at the configured issuer even with a spoofed Host', async () => {
    const response = await initialize('https://attacker.example/api/mcp', {
      Host: 'attacker.example',
      'X-Forwarded-Host': 'attacker.example',
      'X-Forwarded-Proto': 'https',
    });

    expect(response.status).toBe(401);
    const challenge = response.headers.get('WWW-Authenticate') ?? '';
    expect(challenge).toContain(
      `resource_metadata="${ISSUER}/.well-known/oauth-protected-resource"`,
    );
    expect(challenge).not.toContain('attacker.example');
  });
});
