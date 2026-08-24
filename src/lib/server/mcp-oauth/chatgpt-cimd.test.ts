import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  cimdClientIdsMatch,
  isAllowedChatGptRedirectUri,
  isPublicTokenAuthMethod,
  validateRedirectUri,
} from '@/lib/server/mcp-oauth/cimd';
import { parseClientIdMetadataDocument } from '@/lib/server/mcp-oauth/client-id-metadata';
import { verifyClientSecret } from '@/lib/server/mcp-oauth/clients';

const fixtureDir = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');
const chatgptPrimary = JSON.parse(
  readFileSync(join(fixtureDir, 'chatgpt-client.json'), 'utf8'),
);
const chatgptNamed = JSON.parse(
  readFileSync(join(fixtureDir, 'chatgpt-chatgpt-client.json'), 'utf8'),
);

describe('ChatGPT CIMD fixtures', () => {
  it('parses the public chatgpt.com/oauth/client.json document', () => {
    const fetchUrl = 'https://chatgpt.com/oauth/client.json';
    const doc = parseClientIdMetadataDocument(fetchUrl, chatgptPrimary);
    expect(doc).not.toBeNull();
    expect(doc?.client_name).toBe('ChatGPT');
    expect(doc?.token_endpoint_auth_method).toBe('private_key_jwt');
    expect(doc?.redirect_uris).toContain(
      'https://chatgpt.com/connector_platform_oauth_redirect',
    );
  });

  it('parses the chatgpt/oauth/chatgpt/client.json document', () => {
    const fetchUrl = 'https://chatgpt.com/oauth/chatgpt/client.json';
    const doc = parseClientIdMetadataDocument(fetchUrl, chatgptNamed);
    expect(doc?.redirect_uris).toContain('https://chatgpt.com/connector/oauth/chatgpt');
  });

  it('accepts trusted CIMD alias when fetch URL differs from document client_id', () => {
    const fetchUrl = 'https://chat.openai.com/oauth/client.json';
    const doc = parseClientIdMetadataDocument(fetchUrl, chatgptPrimary);
    expect(doc).not.toBeNull();
    expect(cimdClientIdsMatch(fetchUrl, chatgptPrimary.client_id)).toBe(true);
  });

  it('rejects client_id mismatch on untrusted hosts', () => {
    expect(
      cimdClientIdsMatch(
        'https://evil.example/oauth/client.json',
        'https://other.example/oauth/client.json',
      ),
    ).toBe(false);
    expect(
      parseClientIdMetadataDocument(
        'https://evil.example/oauth/client.json',
        chatgptPrimary,
      ),
    ).toBeNull();
  });
});

describe('ChatGPT redirect URI allowlist', () => {
  it('allows connector_platform_oauth_redirect', () => {
    expect(
      isAllowedChatGptRedirectUri('https://chatgpt.com/connector_platform_oauth_redirect'),
    ).toBe(true);
  });

  it('allows connector/oauth/* paths', () => {
    expect(
      isAllowedChatGptRedirectUri('https://chatgpt.com/connector/oauth/chatgpt'),
    ).toBe(true);
  });

  it('allows known redirects even when not listed in a stale DB row', () => {
    expect(
      validateRedirectUri(
        'https://chatgpt.com/connector/oauth/chatgpt',
        ['https://chatgpt.com/connector_platform_oauth_redirect'],
        'https://chatgpt.com/oauth/client.json',
      ),
    ).toBe(true);
  });

  it('rejects unrelated redirect hosts', () => {
    expect(
      validateRedirectUri(
        'https://evil.example/callback',
        chatgptPrimary.redirect_uris,
        chatgptPrimary.client_id,
      ),
    ).toBe(false);
  });
});

describe('verifyClientSecret for ChatGPT-style clients', () => {
  const chatgptClient = {
    client_id: 'https://chatgpt.com/oauth/client.json',
    client_name: 'ChatGPT',
    redirect_uris: chatgptPrimary.redirect_uris,
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'],
    token_endpoint_auth_method: 'private_key_jwt',
    client_uri: 'https://chatgpt.com/',
    logo_uri: null,
    client_secret_hash: null,
  };

  it('treats private_key_jwt as a public PKCE client (no client_secret)', () => {
    expect(isPublicTokenAuthMethod('private_key_jwt')).toBe(true);
    expect(verifyClientSecret(chatgptClient, undefined)).toBe(true);
    expect(verifyClientSecret(chatgptClient, null)).toBe(true);
  });

  it('still requires client_secret for client_secret_post', () => {
    const confidential = {
      ...chatgptClient,
      token_endpoint_auth_method: 'client_secret_post',
      client_secret_hash: 'sha256:deadbeef',
    };
    expect(verifyClientSecret(confidential, undefined)).toBe(false);
  });
});
