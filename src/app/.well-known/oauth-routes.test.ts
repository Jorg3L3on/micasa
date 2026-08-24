import { describe, expect, it } from 'vitest';
import { GET as getProtectedResource } from '@/app/.well-known/oauth-protected-resource/route';
import { GET as getProtectedResourceMcp } from '@/app/.well-known/oauth-protected-resource/mcp/route';
import { OPTIONS as optionsProtectedResourceMcp } from '@/app/.well-known/oauth-protected-resource/mcp/route';
import { GET as getAuthServer } from '@/app/.well-known/oauth-authorization-server/route';
import { GET as getAuthServerMcp } from '@/app/.well-known/oauth-authorization-server/mcp/route';
import { GET as getAuthServerApiMcp } from '@/app/.well-known/oauth-authorization-server/api/mcp/route';
import { OPTIONS as optionsAuthServerMcp } from '@/app/.well-known/oauth-authorization-server/mcp/route';

const expectJsonCors = (response: Response) => {
  expect(response.status).toBe(200);
  expect(response.headers.get('Content-Type')).toContain('application/json');
  expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
};

describe('well-known OAuth routes', () => {
  it('GET /.well-known/oauth-protected-resource', async () => {
    const response = getProtectedResource(
      new Request('http://localhost:3000/.well-known/oauth-protected-resource'),
    );
    expectJsonCors(response);
    const body = await response.json();
    expect(body.resource).toBe('http://localhost:3000/api/mcp');
    expect(body.authorization_servers).toContain('http://localhost:3000');
  });

  it('GET /.well-known/oauth-protected-resource/mcp (ChatGPT alias)', async () => {
    const response = getProtectedResourceMcp(
      new Request('http://localhost:3000/.well-known/oauth-protected-resource/mcp'),
    );
    expectJsonCors(response);
    const body = await response.json();
    expect(body.resource).toBe('http://localhost:3000/api/mcp');
    expect(body.authorization_servers).toContain('http://localhost:3000');
  });

  it('OPTIONS /.well-known/oauth-protected-resource/mcp includes CORS', () => {
    const response = optionsProtectedResourceMcp();
    expect(response.status).toBe(204);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(response.headers.get('Access-Control-Allow-Methods')).toContain('GET');
  });

  it('GET /.well-known/oauth-authorization-server', async () => {
    const response = getAuthServer(
      new Request('http://localhost:3000/.well-known/oauth-authorization-server'),
    );
    expectJsonCors(response);
    const body = await response.json();
    expect(body.registration_endpoint).toContain('/api/oauth/register');
    expect(body.client_id_metadata_document_supported).toBe(true);
    expect(body.token_endpoint_auth_methods_supported).toContain('private_key_jwt');
  });

  it('GET /.well-known/oauth-authorization-server/mcp (ChatGPT alias)', async () => {
    const response = getAuthServerMcp(
      new Request('http://localhost:3000/.well-known/oauth-authorization-server/mcp'),
    );
    expectJsonCors(response);
    const body = await response.json();
    expect(body.token_endpoint).toContain('/api/oauth/token');
    expect(body.registration_endpoint).toContain('/api/oauth/register');
    expect(body.token_endpoint_auth_methods_supported).toContain('private_key_jwt');
  });

  it('GET /.well-known/oauth-authorization-server/api/mcp (ChatGPT alias)', async () => {
    const response = getAuthServerApiMcp(
      new Request('http://localhost:3000/.well-known/oauth-authorization-server/api/mcp'),
    );
    expectJsonCors(response);
    const body = await response.json();
    expect(body.authorization_endpoint).toContain('/api/oauth/authorize');
    expect(body.token_endpoint_auth_methods_supported).toContain('private_key_jwt');
  });

  it('OPTIONS /.well-known/oauth-authorization-server/mcp includes CORS', () => {
    const response = optionsAuthServerMcp();
    expect(response.status).toBe(204);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });
});
