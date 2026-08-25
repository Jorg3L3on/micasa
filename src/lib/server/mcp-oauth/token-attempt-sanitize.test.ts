import { describe, expect, it } from 'vitest';
import { CHATGPT_STABLE_CIMD_CLIENT_ID } from '@/lib/server/mcp-oauth/cimd';
import {
  classifyClientIdKind,
  classifyRedirectKind,
  classifyResourceKind,
  sanitizeTokenAttemptBody,
} from '@/lib/server/mcp-oauth/token-attempt-sanitize';

const VERIFIER =
  'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';

describe('token attempt sanitizer', () => {
  it('classifies stable and instance ChatGPT CIMD client ids', () => {
    expect(classifyClientIdKind(CHATGPT_STABLE_CIMD_CLIENT_ID)).toBe('cimd_stable');
    expect(
      classifyClientIdKind('https://chatgpt.com/oauth/example-instance/client.json'),
    ).toBe('cimd_instance');
  });

  it('classifies DCR UUID client ids', () => {
    expect(classifyClientIdKind('11111111-2222-3333-4444-555555555555')).toBe(
      'dcr_uuid',
    );
  });

  it('classifies redirect kinds without storing raw URIs', () => {
    expect(
      classifyRedirectKind('https://chatgpt.com/connector_platform_oauth_redirect'),
    ).toBe('platform_redirect');
    expect(
      classifyRedirectKind('https://chatgpt.com/connector/oauth/example-instance'),
    ).toBe('connector_instance');
    expect(classifyRedirectKind('https://example.com/oauth/cb')).toBe('other');
  });

  it('classifies MCP resource paths', () => {
    expect(
      classifyResourceKind('https://example.com/api/mcp'),
    ).toBe('api_mcp');
    expect(classifyResourceKind('https://example.com/mcp')).toBe('mcp_alias');
    expect(classifyResourceKind('https://example.com/other')).toBe('other');
  });

  it('sanitizes token body flags without secrets', () => {
    const sanitized = sanitizeTokenAttemptBody({
      grant_type: 'authorization_code',
      client_id: 'https://chatgpt.com/oauth/example-instance/client.json',
      redirect_uri: 'https://chatgpt.com/connector/oauth/example-instance',
      resource: 'https://example.com/api/mcp',
      code: 'must-not-be-stored',
      code_verifier: VERIFIER,
      client_assertion: 'must-not-be-stored',
    });

    expect(sanitized).toEqual({
      grant_type: 'authorization_code',
      has_code: true,
      has_verifier: true,
      has_assertion: true,
      client_id_kind: 'cimd_instance',
      redirect_kind: 'connector_instance',
      resource_kind: 'api_mcp',
    });
  });
});
