import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import OAuthConsentForm from '@/components/oauth/OAuthConsentForm';
import { buildOAuthClientDisplay } from '@/lib/oauth-client-display';

describe('buildOAuthClientDisplay', () => {
  it('uses the CIMD host as the origin', () => {
    expect(
      buildOAuthClientDisplay({
        clientId: 'https://chatgpt.com/oauth/client.json',
        clientUri: 'https://openai.com',
        redirectUri: 'https://chatgpt.com/connector_platform_oauth_redirect',
      }),
    ).toEqual({ originLabel: 'chatgpt.com', safeClientUri: 'https://openai.com/' });
  });

  it('labels DCR clients with the redirect host', () => {
    expect(
      buildOAuthClientDisplay({
        clientId: '11111111-2222-3333-4444-555555555555',
        clientUri: null,
        redirectUri: 'http://localhost:3000/cb',
      }).originLabel,
    ).toBe('Registro dinámico · localhost:3000');
  });

  it.each(['http://evil.example', 'javascript:alert(1)', 'data:text/html,x'])(
    'drops non-https client_uri %s',
    (clientUri) => {
      expect(
        buildOAuthClientDisplay({
          clientId: 'https://evil.example/client.json',
          clientUri,
          redirectUri: 'https://evil.example/cb',
        }).safeClientUri,
      ).toBeNull();
    },
  );
});

describe('OAuthConsentForm', () => {
  const render = (clientUri: string | null) =>
    renderToStaticMarkup(
      createElement(OAuthConsentForm, {
        clientName: 'ChatGPT',
        clientOrigin: 'Registro dinámico · evil.example',
        clientUri,
        requestedScope: 'read',
        selectableContexts: [],
        consentParams: {
          client_id: '11111111-2222-3333-4444-555555555555',
          redirect_uri: 'https://evil.example/cb',
          code_challenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
          code_challenge_method: 'S256',
        },
      }),
    );

  it('shows the client origin next to a self-declared name', () => {
    const html = render(null);
    expect(html).toContain('ChatGPT');
    expect(html).toContain('Registro dinámico · evil.example');
    expect(html).not.toContain('<a ');
  });

  it('links an https client_uri', () => {
    expect(render('https://openai.com/')).toContain('href="https://openai.com/"');
  });
});
