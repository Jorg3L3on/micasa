import { describe, expect, it } from 'vitest';
import nextConfig from '../../next.config';
import {
  buildOAuthFormActionCsp,
  interpretConsentResponse,
  OAUTH_CONSENT_COPY,
} from '@/lib/oauth-consent';

describe('buildOAuthFormActionCsp', () => {
  it('allows only the validated https origin', () => {
    const csp = buildOAuthFormActionCsp('https://client.example.test/cb');
    expect(csp).toBe("form-action 'self' https://client.example.test");
    expect(csp).not.toContain('chatgpt.com');
    expect(csp).not.toContain('chat.openai.com');
  });

  it('allows only the validated loopback origin', () => {
    expect(buildOAuthFormActionCsp('http://127.0.0.1:4567/cb')).toBe(
      "form-action 'self' http://127.0.0.1:4567",
    );
  });

  it('keeps a ChatGPT callback to that origin alone', () => {
    const csp = buildOAuthFormActionCsp(
      'https://chatgpt.com/connector/oauth/chatgpt',
    );
    expect(csp).toBe("form-action 'self' https://chatgpt.com");
    expect(csp).not.toContain('chat.openai.com');
  });

  it('drops non-http redirect URIs', () => {
    expect(buildOAuthFormActionCsp('javascript:alert(1)')).toBeNull();
  });
});

describe('oauth consent CSP is not a static ChatGPT allowlist', () => {
  it('next.config does not hard-code form-action hosts', async () => {
    const headers = await nextConfig.headers?.();
    const blob = JSON.stringify(headers ?? []);
    expect(blob).not.toContain('form-action');
    expect(blob).not.toContain('chat.openai.com');
    expect(blob).not.toContain('chatgpt.com');
  });
});

describe('interpretConsentResponse', () => {
  const login = '/login?callbackUrl=%2Fapi%2Foauth%2Fauthorize';

  it('follows redirect_to on success', () => {
    expect(
      interpretConsentResponse(
        200,
        { redirect_to: 'https://client.example.test/cb?code=abc&state=s' },
        login,
      ),
    ).toEqual({
      type: 'redirect',
      url: 'https://client.example.test/cb?code=abc&state=s',
    });
  });

  it.each([
    [400, { error: 'invalid_client' }, OAUTH_CONSENT_COPY.invalidClient],
    [
      400,
      { error: 'invalid_request', error_description: OAUTH_CONSENT_COPY.redirectUri },
      OAUTH_CONSENT_COPY.redirectUri,
    ],
    [400, { error: 'invalid_target' }, OAUTH_CONSENT_COPY.invalidTarget],
    [400, { error: 'invalid_request' }, OAUTH_CONSENT_COPY.invalidRequest],
  ])('maps %j to an inline message', (status, body, message) => {
    const result = interpretConsentResponse(status as number, body, login);
    expect(result).toEqual({ type: 'inline', error: { message } });
  });

  it('maps 401 to the login link', () => {
    expect(
      interpretConsentResponse(
        401,
        {
          error: 'unauthorized',
          error_description: OAUTH_CONSENT_COPY.signInAgain,
          login_url: login,
        },
        '/login',
      ),
    ).toEqual({
      type: 'inline',
      error: { message: OAUTH_CONSENT_COPY.signInAgain, loginUrl: login },
    });
  });
});
