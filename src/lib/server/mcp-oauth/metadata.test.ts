import { describe, expect, it } from 'vitest';
import {
  buildAuthorizationServerMetadata,
  buildProtectedResourceMetadata,
} from '@/lib/server/mcp-oauth/metadata';

describe('MCP OAuth metadata', () => {
  const request = new Request('http://localhost:3000/api/mcp');

  it('expone protected resource metadata con authorization_servers', () => {
    const metadata = buildProtectedResourceMetadata(request);
    expect(metadata.resource).toBe('http://localhost:3000/api/mcp');
    expect(metadata.authorization_servers).toEqual(['http://localhost:3000']);
    expect(metadata.scopes_supported).toEqual(['read', 'write']);
    expect(metadata.bearer_methods_supported).toContain('header');
  });

  it('expone authorization server metadata con DCR y CIMD', () => {
    const metadata = buildAuthorizationServerMetadata(request);
    expect(metadata.issuer).toBe('http://localhost:3000');
    expect(metadata.registration_endpoint).toBe(
      'http://localhost:3000/api/oauth/register',
    );
    expect(metadata.token_endpoint).toBe('http://localhost:3000/api/oauth/token');
    expect(metadata.client_id_metadata_document_supported).toBe(true);
    expect(metadata.code_challenge_methods_supported).toEqual(['S256']);
    expect(metadata.grant_types_supported).toContain('authorization_code');
  });

  it('apunta service_documentation a la doc pública del conector (no a una ruta 404 de la app)', () => {
    const metadata = buildAuthorizationServerMetadata(request);
    expect(metadata.service_documentation).toBe(
      'https://github.com/Jorg3L3on/micasa/blob/main/docs/mcp-connector.md',
    );
  });

  it('anuncia exactamente los métodos de autenticación que acepta el token endpoint', () => {
    const metadata = buildAuthorizationServerMetadata(request);
    expect(metadata.token_endpoint_auth_methods_supported).toEqual([
      'none',
      'client_secret_post',
    ]);
    expect(metadata).not.toHaveProperty(
      'token_endpoint_auth_signing_alg_values_supported',
    );
  });
});
