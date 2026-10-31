import { beforeEach, describe, expect, it, vi } from 'vitest';

const { resolveOAuthClientMock, assertRedirectUriAllowedMock } = vi.hoisted(() => ({
  resolveOAuthClientMock: vi.fn(),
  assertRedirectUriAllowedMock: vi.fn(),
}));

vi.mock('@/lib/server/mcp-oauth/clients', () => ({
  resolveOAuthClient: resolveOAuthClientMock,
  assertRedirectUriAllowed: assertRedirectUriAllowedMock,
}));

import { resolveConsentDocument } from '@/lib/server/mcp-oauth/consent-document-csp';

const client = {
  client_id: 'https://client.example.test/oauth/client.json',
  client_name: 'Example',
  redirect_uris: ['https://client.example.test/cb'],
  grant_types: ['authorization_code'],
  response_types: ['code'],
  token_endpoint_auth_method: 'none',
  client_uri: null,
  logo_uri: null,
  client_secret_hash: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  resolveOAuthClientMock.mockResolvedValue(client);
  assertRedirectUriAllowedMock.mockImplementation(() => undefined);
});

describe('resolveConsentDocument', () => {
  it('builds form-action from the validated https origin only', async () => {
    const result = await resolveConsentDocument(
      client.client_id,
      'https://client.example.test/cb',
    );
    expect(result).toEqual({
      ok: true,
      csp: "form-action 'self' https://client.example.test",
      client,
    });
    if (result.ok) {
      expect(result.csp).not.toContain('chat.openai.com');
      expect(result.csp).not.toContain('chatgpt.com');
    }
  });

  it('builds form-action from a loopback origin', async () => {
    const result = await resolveConsentDocument(
      client.client_id,
      'http://127.0.0.1:4567/cb',
    );
    expect(result).toMatchObject({
      ok: true,
      csp: "form-action 'self' http://127.0.0.1:4567",
    });
  });

  it('omits the hard-coded ChatGPT list when the callback is ChatGPT', async () => {
    const result = await resolveConsentDocument(
      'https://chatgpt.com/oauth/client.json',
      'https://chatgpt.com/connector/oauth/chatgpt',
    );
    expect(result).toMatchObject({
      ok: true,
      csp: "form-action 'self' https://chatgpt.com",
    });
    if (result.ok) expect(result.csp).not.toContain('chat.openai.com');
  });

  it('does not allow an origin when redirect_uri is rejected', async () => {
    assertRedirectUriAllowedMock.mockImplementation(() => {
      throw new Error('redirect_uri no autorizado para este cliente');
    });
    const result = await resolveConsentDocument(
      client.client_id,
      'https://client.example.test/cb',
    );
    expect(result).toEqual({ ok: false, reason: 'redirect_uri' });
  });

  it('does not allow an origin for an unknown client', async () => {
    resolveOAuthClientMock.mockResolvedValue(null);
    const result = await resolveConsentDocument(
      client.client_id,
      'https://client.example.test/cb',
    );
    expect(result).toEqual({ ok: false, reason: 'invalid_client' });
  });
});
