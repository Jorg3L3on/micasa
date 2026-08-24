import { describe, expect, it } from 'vitest';
import { GET as getProtectedResource } from '@/app/.well-known/oauth-protected-resource/route';
import { GET as getAuthServer } from '@/app/.well-known/oauth-authorization-server/route';

describe('well-known OAuth routes', () => {
  it('GET /.well-known/oauth-protected-resource', async () => {
    const response = getProtectedResource(
      new Request('http://localhost:3000/.well-known/oauth-protected-resource'),
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.resource).toBe('http://localhost:3000/api/mcp');
    expect(body.authorization_servers).toContain('http://localhost:3000');
  });

  it('GET /.well-known/oauth-authorization-server', async () => {
    const response = getAuthServer(
      new Request('http://localhost:3000/.well-known/oauth-authorization-server'),
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.registration_endpoint).toContain('/api/oauth/register');
    expect(body.client_id_metadata_document_supported).toBe(true);
  });
});
