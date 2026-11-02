import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import OAuthConsentForm from '@/components/oauth/OAuthConsentForm';
import {
  buildAuthorizePath,
  buildOAuthLoginPath,
  interpretConsentResponse,
  OAUTH_CONSENT_COPY,
  type OAuthConsentInlineError,
} from '@/lib/oauth-consent';

const consentParams = {
  client_id: 'https://client.example.test/oauth/client.json',
  redirect_uri: 'https://client.example.test/cb',
  state: 'fixture-state',
  code_challenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
  code_challenge_method: 'S256' as const,
  resource: 'https://micasa.example/api/mcp',
};

const loginUrl = buildOAuthLoginPath(buildAuthorizePath(consentParams)!);

const renderError = (error: OAuthConsentInlineError) =>
  renderToStaticMarkup(
    createElement(OAuthConsentForm, {
      clientName: 'Example',
      clientOrigin: 'client.example.test',
      clientUri: null,
      requestedScope: 'read',
      selectableContexts: [],
      consentParams,
      initialError: error,
    }),
  );

describe('OAuthConsentForm errors', () => {
  it('keeps a no-JS post to the consent route', () => {
    const html = renderError({ message: OAUTH_CONSENT_COPY.invalidRequest });
    expect(html).toContain('action="/api/oauth/consent"');
    expect(html).toMatch(/method="post"/i);
  });

  it('shows invalid client with retry', () => {
    const result = interpretConsentResponse(400, { error: 'invalid_client' }, loginUrl);
    expect(result.type).toBe('inline');
    if (result.type !== 'inline') return;
    const html = renderError(result.error);
    expect(html).toContain(OAUTH_CONSENT_COPY.invalidClient);
    expect(html).toContain(OAUTH_CONSENT_COPY.retry);
    expect(html).not.toContain(OAUTH_CONSENT_COPY.signInAgain);
  });

  it('shows redirect_uri not allowed with retry', () => {
    const result = interpretConsentResponse(
      400,
      { error: 'invalid_request', error_description: OAUTH_CONSENT_COPY.redirectUri },
      loginUrl,
    );
    expect(result.type).toBe('inline');
    if (result.type !== 'inline') return;
    const html = renderError(result.error);
    expect(html).toContain('La dirección de retorno no está permitida.');
    expect(html).toContain(OAUTH_CONSENT_COPY.retry);
  });

  it('shows invalid_target with retry', () => {
    const result = interpretConsentResponse(400, { error: 'invalid_target' }, loginUrl);
    expect(result.type).toBe('inline');
    if (result.type !== 'inline') return;
    const html = renderError(result.error);
    expect(html).toContain('El recurso solicitado no es el servidor MCP de MiCasa.');
    expect(html).toContain(OAUTH_CONSENT_COPY.retry);
  });

  it('shows Zod validation with retry', () => {
    const result = interpretConsentResponse(400, { error: 'invalid_request' }, loginUrl);
    expect(result.type).toBe('inline');
    if (result.type !== 'inline') return;
    const html = renderError(result.error);
    expect(html).toContain('Solicitud inválida.');
    expect(html).toContain(OAUTH_CONSENT_COPY.retry);
  });

  it('shows an expired session with a link back to the authorize URL', () => {
    const result = interpretConsentResponse(
      401,
      { error: 'unauthorized', login_url: loginUrl },
      '/login',
    );
    expect(result.type).toBe('inline');
    if (result.type !== 'inline') return;
    const html = renderError(result.error);
    expect(html).toContain('Inicia sesión de nuevo');
    const href = html.match(/href="([^"]+)"/)?.[1]?.replace(/&amp;/g, '&') ?? '';
    const authorize = new URL(
      new URL(href, 'https://micasa.example').searchParams.get('callbackUrl') ?? '',
      'https://micasa.example',
    );
    expect(authorize.pathname).toBe('/api/oauth/authorize');
    expect(authorize.searchParams.get('redirect_uri')).toBe('https://client.example.test/cb');
    expect(authorize.searchParams.get('state')).toBe('fixture-state');
    expect(html).not.toContain(OAUTH_CONSENT_COPY.retry);
  });

  it('disables Autorizar until a context is selected', () => {
    const html = renderError({ message: OAUTH_CONSENT_COPY.invalidRequest });
    expect(html).toContain('disabled');
    expect(html).toContain('Autorizar');
  });
});
