import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authMock, resolveOAuthClientMock, assertRedirectUriAllowedMock, contextsMock } =
  vi.hoisted(() => ({
    authMock: vi.fn(),
    resolveOAuthClientMock: vi.fn(),
    assertRedirectUriAllowedMock: vi.fn(),
    contextsMock: vi.fn(),
  }));

vi.mock('@/lib/auth', () => ({ auth: authMock }));

vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));

vi.mock('@/lib/server/mcp-oauth/clients', () => ({
  resolveOAuthClient: resolveOAuthClientMock,
  assertRedirectUriAllowed: assertRedirectUriAllowedMock,
}));

vi.mock('@/lib/server/agent-allowed-contexts', () => ({
  buildSelectableContextsForUser: contextsMock,
}));

import OAuthConsentPage from '@/app/(app)/oauth/consent/page';

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

const challenge = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';

const renderPage = async (params: Record<string, string>) => {
  const element = await OAuthConsentPage({
    searchParams: Promise.resolve(params),
  });
  return renderToStaticMarkup(element).replace(/&#x27;/g, "'");
};

beforeEach(() => {
  vi.clearAllMocks();
  authMock.mockResolvedValue({ user: { id: '7' } });
  resolveOAuthClientMock.mockResolvedValue(client);
  assertRedirectUriAllowedMock.mockImplementation(() => undefined);
  contextsMock.mockResolvedValue([]);
});

describe('OAuth consent page CSP', () => {
  const base = {
    client_id: client.client_id,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    state: 'fixture-state',
  };

  it('sets form-action to the validated https origin only', async () => {
    const html = await renderPage({
      ...base,
      redirect_uri: 'https://client.example.test/cb',
    });
    expect(html).toContain('http-equiv="Content-Security-Policy"');
    expect(html).toContain("form-action 'self' https://client.example.test");
    expect(html).not.toContain('chat.openai.com');
    expect(html).not.toContain('https://chatgpt.com');
  });

  it('sets form-action to a loopback origin', async () => {
    const html = await renderPage({
      ...base,
      redirect_uri: 'http://127.0.0.1:4567/cb',
    });
    expect(html).toContain("form-action 'self' http://127.0.0.1:4567");
    expect(html).not.toContain('chatgpt.com');
  });

  it('keeps a ChatGPT callback without the hard-coded host list', async () => {
    const html = await renderPage({
      ...base,
      client_id: 'https://chatgpt.com/oauth/client.json',
      redirect_uri: 'https://chatgpt.com/connector/oauth/chatgpt',
    });
    expect(html).toContain("form-action 'self' https://chatgpt.com");
    expect(html).not.toContain('chat.openai.com');
  });

  it('does not allow an origin when the client is unknown', async () => {
    resolveOAuthClientMock.mockResolvedValue(null);
    const html = await renderPage({
      ...base,
      redirect_uri: 'https://client.example.test/cb',
    });
    expect(html).toContain('Cliente inválido.');
    expect(html).not.toContain('form-action');
  });

  it('does not allow an origin when redirect_uri is rejected', async () => {
    assertRedirectUriAllowedMock.mockImplementation(() => {
      throw new Error('redirect_uri no autorizado para este cliente');
    });
    const html = await renderPage({
      ...base,
      redirect_uri: 'https://client.example.test/cb',
    });
    expect(html).toContain('La dirección de retorno no está permitida.');
    expect(html).not.toContain('form-action');
  });

  it('sends an expired session back to the same authorize URL', async () => {
    authMock.mockResolvedValue(null);
    await expect(
      renderPage({
        ...base,
        redirect_uri: 'https://client.example.test/cb',
      }),
    ).rejects.toThrow(/\/login\?callbackUrl=/);
    await expect(
      renderPage({
        ...base,
        redirect_uri: 'https://client.example.test/cb',
      }),
    ).rejects.toThrow(/client\.example\.test/);
  });

  it('shows invalid_target inline when consent_error is set', async () => {
    const html = await renderPage({
      ...base,
      redirect_uri: 'https://client.example.test/cb',
      consent_error: 'invalid_target',
    });
    expect(html).toContain('El recurso solicitado no es el servidor MCP de MiCasa.');
    expect(html).toContain('Reintentar');
  });
});
