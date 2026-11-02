import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  mcpOAuthClient: {
    findUnique: vi.fn(),
    create: vi.fn(),
  },
}));

const fetchClientIdMetadataDocumentMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/prisma', () => ({ default: prismaMock }));

vi.mock('@/lib/server/mcp-oauth/client-id-metadata', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/lib/server/mcp-oauth/client-id-metadata')>();
  return {
    ...actual,
    fetchClientIdMetadataDocument: fetchClientIdMetadataDocumentMock,
  };
});

import {
  assertRedirectUriAllowed,
  clampOAuthClientName,
  registerDynamicOAuthClient,
  resolveOAuthClient,
  tokenClientIdMatchesCode,
  type ResolvedOAuthClient,
} from '@/lib/server/mcp-oauth/clients';
import { resetRateLimitStoreForTests } from '@/lib/server/rate-limit';

const requestFrom = (ip: string) =>
  new Request('https://micasa.example/api/oauth/token', {
    headers: { 'x-forwarded-for': ip },
  });

beforeEach(() => {
  vi.clearAllMocks();
  resetRateLimitStoreForTests();
  prismaMock.mcpOAuthClient.findUnique.mockResolvedValue(null);
  prismaMock.mcpOAuthClient.create.mockImplementation(
    async ({ data }: { data: Record<string, unknown> }) => ({
      client_secret_hash: null,
      client_uri: null,
      logo_uri: null,
      ...data,
    }),
  );
  fetchClientIdMetadataDocumentMock.mockImplementation(async (clientId: string) => ({
    client_id: clientId,
    client_name: 'Cliente CIMD',
    redirect_uris: ['https://example.com/cb'],
  }));
});

describe('tokenClientIdMatchesCode', () => {
  it('accepts the exact client_id', () => {
    expect(tokenClientIdMatchesCode('abc', 'abc')).toBe(true);
  });

  it('accepts two CIMD client_ids on trusted OpenAI hosts', () => {
    expect(
      tokenClientIdMatchesCode(
        'https://chatgpt.com/oauth/client.json',
        'https://chatgpt.com/oauth/instance/client.json',
      ),
    ).toBe(true);
  });

  it('rejects a foreign CIMD against a ChatGPT code', () => {
    expect(
      tokenClientIdMatchesCode(
        'https://evil.example/oauth/client.json',
        'https://chatgpt.com/oauth/instance/client.json',
      ),
    ).toBe(false);
  });
});

describe('resolveOAuthClient — CIMD auto-registration limit', () => {
  it('stops creating CIMD clients after 20 new URLs per IP per hour', async () => {
    for (let i = 0; i < 20; i += 1) {
      const client = await resolveOAuthClient(
        `https://spam${i}.example/client.json`,
        requestFrom('203.0.113.50'),
      );
      expect(client).not.toBeNull();
    }

    const limited = await resolveOAuthClient(
      'https://spam-final.example/client.json',
      requestFrom('203.0.113.50'),
    );
    expect(limited).toBeNull();
    expect(prismaMock.mcpOAuthClient.create).toHaveBeenCalledTimes(20);
    expect(fetchClientIdMetadataDocumentMock).toHaveBeenCalledTimes(20);
  });

  it('does not count already-registered clients', async () => {
    prismaMock.mcpOAuthClient.findUnique.mockResolvedValue({
      client_id: 'https://chatgpt.com/oauth/client.json',
      client_name: 'ChatGPT',
      redirect_uris: [],
      grant_types: [],
      response_types: [],
      token_endpoint_auth_method: 'none',
      client_uri: null,
      logo_uri: null,
      client_secret_hash: null,
    });

    for (let i = 0; i < 25; i += 1) {
      await resolveOAuthClient(
        'https://chatgpt.com/oauth/client.json',
        requestFrom('203.0.113.51'),
      );
    }
    expect(fetchClientIdMetadataDocumentMock).not.toHaveBeenCalled();
  });
});

describe('client_name clamp', () => {
  it('trims to 60 visible characters', () => {
    const name = clampOAuthClientName(`${'ñ'.repeat(70)}`, 'x');
    expect(Array.from(name)).toHaveLength(60);
  });

  it('falls back when blank and collapses whitespace', () => {
    expect(clampOAuthClientName('   ', 'MCP OAuth client')).toBe('MCP OAuth client');
    expect(clampOAuthClientName('  Chat\n\nGPT  ', 'x')).toBe('Chat GPT');
  });

  it('applies to dynamic registration', async () => {
    const { client } = await registerDynamicOAuthClient({
      client_name: 'A'.repeat(120),
      redirect_uris: ['https://example.com/cb'],
    });
    expect(client.client_name).toHaveLength(60);
  });
});

const registeredClient = (
  redirectUris: string[],
  clientId = '11111111-2222-3333-4444-555555555555',
): ResolvedOAuthClient => ({
  client_id: clientId,
  client_name: 'Cliente',
  redirect_uris: redirectUris,
  grant_types: ['authorization_code'],
  response_types: ['code'],
  token_endpoint_auth_method: 'none',
  client_uri: null,
  logo_uri: null,
  client_secret_hash: null,
});

describe('assertRedirectUriAllowed', () => {
  it.each([
    'https://dcr-client.example.test/cb',
    'http://127.0.0.1:4567/cb',
    'http://localhost:3000/cb',
    'http://[::1]:5000/cb',
    'com.ejemplo.app:/cb',
  ])('accepts %s exactly as registered', (redirectUri) => {
    expect(() =>
      assertRedirectUriAllowed(registeredClient([redirectUri]), redirectUri),
    ).not.toThrow();
  });

  it('rejects a different string and logs a reason without the URI', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const redirectUri = 'https://dcr-client.example.test/cb/';
    expect(() =>
      assertRedirectUriAllowed(
        registeredClient(['https://dcr-client.example.test/cb']),
        redirectUri,
      ),
    ).toThrow(/no autorizado/);
    const logged = warn.mock.calls.map((call) => String(call[0])).join('\n');
    expect(logged).toContain('"event":"oauth.redirect_uri.rejected"');
    expect(logged).toContain('"reason":"not_registered"');
    expect(logged).not.toContain(redirectUri);
    expect(logged).not.toContain('client_secret');
    warn.mockRestore();
  });
});

describe('resolveOAuthClient — CIMD redirect URIs', () => {
  it('stores https, loopback and custom-scheme URIs exactly and drops the rest', async () => {
    const clientId = 'https://cimd.example.test/oauth/client.json';
    fetchClientIdMetadataDocumentMock.mockResolvedValueOnce({
      client_id: clientId,
      client_name: 'Cliente CIMD',
      redirect_uris: [
        'com.ejemplo.app:/cb',
        'javascript:alert(1)',
        'http://127.0.0.1:4567/cb',
        'https://cimd.example.test/cb',
      ],
    });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const client = await resolveOAuthClient(clientId);
    expect(client?.redirect_uris).toEqual([
      'com.ejemplo.app:/cb',
      'http://127.0.0.1:4567/cb',
      'https://cimd.example.test/cb',
    ]);
    const logged = warn.mock.calls.map((call) => String(call[0])).join('\n');
    expect(logged).toContain('"reason":"disallowed_scheme"');
    expect(logged).not.toContain('javascript:');
    expect(logged).not.toContain('alert(1)');
    warn.mockRestore();
  });

  it('does not create a CIMD client whose redirect URIs are all disallowed', async () => {
    const clientId = 'https://cimd.example.test/oauth/client.json';
    fetchClientIdMetadataDocumentMock.mockResolvedValueOnce({
      client_id: clientId,
      client_name: 'Cliente CIMD',
      redirect_uris: ['javascript:alert(1)'],
    });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    await expect(resolveOAuthClient(clientId)).resolves.toBeNull();
    expect(prismaMock.mcpOAuthClient.create).not.toHaveBeenCalled();
    const logged = warn.mock.calls.map((call) => String(call[0])).join('\n');
    expect(logged).toContain('"reason":"no_allowed_redirect_uri"');
    expect(logged).not.toContain('javascript:');
    warn.mockRestore();
  });
});
