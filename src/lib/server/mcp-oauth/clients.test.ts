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
  clampOAuthClientName,
  registerDynamicOAuthClient,
  resolveOAuthClient,
  tokenClientIdMatchesCode,
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
