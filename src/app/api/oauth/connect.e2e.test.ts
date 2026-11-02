/**
 * Route-level OAuth connect: DCR and CIMD, fake URLs only.
 * register → authorize → consent → token (PKCE S256) → POST /api/mcp tools/list.
 */
import { createHash } from 'node:crypto';
import { renderToStaticMarkup } from 'react-dom/server';
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Row = Record<string, unknown> & { id?: number };

const memory = vi.hoisted(() => {
  const clients: Row[] = [];
  const codes: Row[] = [];
  const grants: Row[] = [];
  const codeContexts: Row[] = [];
  const grantContexts: Row[] = [];
  let nextId = 1;

  const id = () => nextId++;

  const reset = () => {
    clients.length = 0;
    codes.length = 0;
    grants.length = 0;
    codeContexts.length = 0;
    grantContexts.length = 0;
    nextId = 1;
  };

  const prisma = {
    mcpOAuthClient: {
      findUnique: async ({ where }: { where: { client_id: string } }) =>
        clients.find((row) => row.client_id === where.client_id) ?? null,
      create: async ({ data }: { data: Row }) => {
        const row = { client_secret_hash: null, client_uri: null, logo_uri: null, ...data };
        clients.push(row);
        return row;
      },
    },
    mcpOAuthAuthorizationCode: {
      create: async ({ data }: { data: Row }) => {
        const row = { id: id(), used_at: null, ...data };
        codes.push(row);
        return row;
      },
      findUnique: async ({ where }: { where: { code_hash: string } }) =>
        codes.find((row) => row.code_hash === where.code_hash) ?? null,
      updateMany: async ({
        where,
        data,
      }: {
        where: { id: number; used_at: null };
        data: Row;
      }) => {
        const row = codes.find((item) => item.id === where.id && item.used_at == null);
        if (!row) return { count: 0 };
        Object.assign(row, data);
        return { count: 1 };
      },
    },
    mcpOAuthAuthorizationCodeContext: {
      createMany: async ({ data }: { data: Row[] }) => {
        codeContexts.push(...data);
        return { count: data.length };
      },
      findMany: async ({ where }: { where: { authorization_code_id: number } }) =>
        codeContexts.filter(
          (row) => row.authorization_code_id === where.authorization_code_id,
        ),
    },
    mcpOAuthGrant: {
      create: async ({ data }: { data: Row }) => {
        const row = { id: id(), revoked_at: null, last_used_at: null, ...data };
        grants.push(row);
        return row;
      },
      findUnique: async ({ where }: { where: { token_prefix?: string; id?: number } }) => {
        const row = grants.find((item) =>
          where.token_prefix
            ? item.token_prefix === where.token_prefix
            : item.id === where.id,
        );
        if (!row) return null;
        const client = clients.find((item) => item.client_id === row.client_id);
        return {
          ...row,
          user: { id: row.user_id, active: true },
          client: { client_name: client?.client_name ?? 'Cliente' },
        };
      },
      update: async ({ where, data }: { where: { id: number }; data: Row }) => {
        const row = grants.find((item) => item.id === where.id);
        if (!row) throw new Error('grant missing');
        Object.assign(row, data);
        return row;
      },
      updateMany: async () => ({ count: 0 }),
      findFirst: async () => null,
    },
    agentConnectionAllowedContext: {
      deleteMany: async ({ where }: { where: { oauth_grant_id?: number } }) => {
        const before = grantContexts.length;
        for (let index = grantContexts.length - 1; index >= 0; index -= 1) {
          if (grantContexts[index]?.oauth_grant_id === where.oauth_grant_id) {
            grantContexts.splice(index, 1);
          }
        }
        return { count: before - grantContexts.length };
      },
      createMany: async ({ data }: { data: Row[] }) => {
        grantContexts.push(...data);
        return { count: data.length };
      },
    },
    authEvent: { create: async () => ({ id: id() }) },
    mcpOAuthTokenAttempt: { create: async () => ({ id: id() }) },
    $transaction: async (ops: Promise<unknown>[]) => Promise.all(ops),
    reset,
  };

  return { prisma };
});

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));

vi.mock('@/lib/prisma', () => ({ default: memory.prisma }));
vi.mock('@/lib/auth', () => ({ auth: authMock }));

import { POST as registerClient } from '@/app/api/oauth/register/route';
import { GET as authorize } from '@/app/api/oauth/authorize/route';
import { POST as consent } from '@/app/api/oauth/consent/route';
import { POST as token } from '@/app/api/oauth/token/route';
import { POST as mcp } from '@/app/api/mcp/route';
import OAuthConsentPage from '@/app/(app)/oauth/consent/page';
import { resetRateLimitStoreForTests } from '@/lib/server/rate-limit';

const ISSUER = 'http://localhost:3000';
const RESOURCE = `${ISSUER}/api/mcp`;
const VERIFIER = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
const CHALLENGE = createHash('sha256').update(VERIFIER).digest('base64url');
const STATE = 'fixture-state';
const USER_ID = '42';

const CIMD_CLIENT_ID = 'https://cimd.example.test/oauth/client.json';
const CIMD_REDIRECT = 'http://127.0.0.1:4567/cb';
const DCR_REDIRECT = 'com.ejemplo.app:/cb';

const asNext = (request: Request) => request as NextRequest;

beforeEach(() => {
  memory.prisma.reset();
  resetRateLimitStoreForTests();
  authMock.mockResolvedValue({ user: { id: USER_ID } });
  vi.stubEnv('NEXTAUTH_URL', ISSUER);
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      if (url === CIMD_CLIENT_ID) {
        return Response.json({
          client_id: CIMD_CLIENT_ID,
          client_name: 'Cliente CIMD de prueba',
          redirect_uris: [CIMD_REDIRECT],
          token_endpoint_auth_method: 'none',
        });
      }
      return new Response('not found', { status: 404 });
    }),
  );
});

const connect = async (input: { clientId?: string; redirectUri: string; register?: boolean }) => {
  let clientId = input.clientId ?? '';
  if (input.register) {
    const response = await registerClient(
      asNext(
        new Request(`${ISSUER}/api/oauth/register`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-forwarded-for': '203.0.113.40',
          },
          body: JSON.stringify({
            client_name: 'Cliente DCR de prueba',
            redirect_uris: [input.redirectUri],
            token_endpoint_auth_method: 'none',
          }),
        }),
      ),
    );
    expect(response.status).toBe(201);
    const registered = await response.json();
    expect(registered.redirect_uris).toEqual([input.redirectUri]);
    expect(registered).not.toHaveProperty('client_secret');
    clientId = registered.client_id as string;
  }

  const authorizeUrl = new URL(`${ISSUER}/api/oauth/authorize`);
  authorizeUrl.searchParams.set('response_type', 'code');
  authorizeUrl.searchParams.set('client_id', clientId);
  authorizeUrl.searchParams.set('redirect_uri', input.redirectUri);
  authorizeUrl.searchParams.set('code_challenge', CHALLENGE);
  authorizeUrl.searchParams.set('code_challenge_method', 'S256');
  authorizeUrl.searchParams.set('state', STATE);
  authorizeUrl.searchParams.set('resource', RESOURCE);

  const authorizeResponse = await authorize(new NextRequest(authorizeUrl));
  expect(authorizeResponse.status).toBe(302);
  const consentLocation = new URL(authorizeResponse.headers.get('Location')!);
  expect(consentLocation.pathname).toBe('/oauth/consent');
  expect(consentLocation.searchParams.get('redirect_uri')).toBe(input.redirectUri);

  const consentResponse = await consent(
    new NextRequest(`${ISSUER}/api/oauth/consent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: ISSUER,
      },
      body: JSON.stringify({
        client_id: clientId,
        redirect_uri: input.redirectUri,
        state: STATE,
        code_challenge: CHALLENGE,
        code_challenge_method: 'S256',
        resource: RESOURCE,
        allow_write: 'true',
        context_owner_type: 'user',
        context_owner_id: USER_ID,
      }),
    }),
  );
  expect(consentResponse.status).toBe(200);
  const consentBody = await consentResponse.json();
  const redirectTo = consentBody.redirect_to as string;
  expect(redirectTo.startsWith(input.redirectUri)).toBe(true);
  const callback = new URL(redirectTo);
  expect(callback.searchParams.get('state')).toBe(STATE);
  const code = callback.searchParams.get('code');
  expect(code).toBeTruthy();

  const tokenResponse = await token(
    asNext(
      new Request(`${ISSUER}/api/oauth/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'x-forwarded-for': '203.0.113.41',
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code: code!,
          redirect_uri: input.redirectUri,
          client_id: clientId,
          code_verifier: VERIFIER,
          resource: RESOURCE,
        }),
      }),
    ),
  );
  expect(tokenResponse.status).toBe(200);
  const tokenBody = await tokenResponse.json();
  expect(tokenBody.token_type).toBe('bearer');
  expect(tokenBody.access_token).toMatch(/^micasa_oauth_/);
  expect(JSON.stringify(tokenBody)).not.toContain(VERIFIER);

  const toolsResponse = await mcp(
    asNext(
      new Request(RESOURCE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json, text/event-stream',
          Authorization: `Bearer ${tokenBody.access_token}`,
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/list',
          params: {},
        }),
      }),
    ),
  );
  expect(toolsResponse.status).toBe(200);
  const toolsBody = await toolsResponse.text();
  expect(toolsBody).toContain('list_houses');
  expect(toolsResponse.headers.get('WWW-Authenticate')).toBeNull();
};

describe('OAuth connect e2e', () => {
  it('registers a DCR client with a custom-scheme redirect and lists MCP tools', async () => {
    await connect({ register: true, redirectUri: DCR_REDIRECT });
  });

  it('resolves a CIMD client_id URL with a loopback redirect and lists MCP tools', async () => {
    await connect({ clientId: CIMD_CLIENT_ID, redirectUri: CIMD_REDIRECT });
  });

  it('logs a rejected redirect_uri without secrets and shows the on-screen error', async () => {
    const registered = await registerClient(
      asNext(
        new Request(`${ISSUER}/api/oauth/register`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-forwarded-for': '203.0.113.42',
          },
          body: JSON.stringify({
            client_name: 'Cliente DCR de prueba',
            redirect_uris: ['https://dcr-client.example.test/cb'],
            token_endpoint_auth_method: 'none',
          }),
        }),
      ),
    );
    expect(registered.status).toBe(201);
    const clientId = (await registered.json()).client_id as string;
    const rejected = 'https://rejected.example.test/cb?token=super-secret';

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const element = await OAuthConsentPage({
      searchParams: Promise.resolve({
        client_id: clientId,
        redirect_uri: rejected,
        code_challenge: CHALLENGE,
        code_challenge_method: 'S256',
        state: STATE,
      }),
    });
    const html = renderToStaticMarkup(element).replace(/&#x27;/g, "'");
    expect(html).toContain('La dirección de retorno no está permitida.');
    expect(html).toContain("form-action 'self'");
    expect(html).not.toContain('rejected.example.test');
    expect(html).not.toContain('super-secret');

    const logged = warn.mock.calls.map((call) => String(call[0])).join('\n');
    expect(logged).toContain('"event":"oauth.redirect_uri.rejected"');
    expect(logged).toContain('"reason":"not_registered"');
    expect(logged).not.toContain(rejected);
    expect(logged).not.toContain('rejected.example.test');
    expect(logged).not.toContain('super-secret');
    expect(logged).not.toContain(VERIFIER);
    expect(logged).not.toContain('client_secret');
    warn.mockRestore();
  });
});
