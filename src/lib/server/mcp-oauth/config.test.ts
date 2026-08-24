import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  MCP_RESOURCE_ALIAS_PATH,
  MCP_RESOURCE_PATH,
  mcpResourcesMatch,
  normalizeMcpResourceUrl,
} from '@/lib/server/mcp-oauth/config';

describe('MCP resource URL normalization (RFC 8707)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('canonicalizes same-origin /mcp to /api/mcp', () => {
    vi.stubEnv('NEXTAUTH_URL', 'https://micasa.example');
    expect(
      normalizeMcpResourceUrl('https://micasa.example/mcp'),
    ).toBe('https://micasa.example/api/mcp');
    expect(
      normalizeMcpResourceUrl('https://micasa.example/api/mcp'),
    ).toBe('https://micasa.example/api/mcp');
  });

  it('treats /mcp and /api/mcp as equivalent for comparison', () => {
    vi.stubEnv('NEXTAUTH_URL', 'https://micasa.example');
    expect(
      mcpResourcesMatch(
        'https://micasa.example/mcp',
        'https://micasa.example/api/mcp',
      ),
    ).toBe(true);
  });

  it('does not alias unrelated paths on the same origin', () => {
    vi.stubEnv('NEXTAUTH_URL', 'https://micasa.example');
    expect(
      mcpResourcesMatch(
        'https://micasa.example/other',
        'https://micasa.example/api/mcp',
      ),
    ).toBe(false);
  });

  it('exports alias path constants', () => {
    expect(MCP_RESOURCE_PATH).toBe('/api/mcp');
    expect(MCP_RESOURCE_ALIAS_PATH).toBe('/mcp');
  });
});
