import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import type { AuthInfo } from '@modelcontextprotocol/server';

const {
  findUniqueApiKey,
  findFirstMembership,
  findManyAllowedContexts,
  resolveOAuthGrantUser,
  checkRateLimit,
  logFinanceEvent,
} = vi.hoisted(() => ({
  findUniqueApiKey: vi.fn(),
  findFirstMembership: vi.fn(),
  findManyAllowedContexts: vi.fn(),
  resolveOAuthGrantUser: vi.fn(),
  checkRateLimit: vi.fn(),
  logFinanceEvent: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    apiKey: { findUnique: findUniqueApiKey, update: vi.fn() },
    houseMember: { findFirst: findFirstMembership },
    agentConnectionAllowedContext: { findMany: findManyAllowedContexts },
  },
}));

vi.mock('@/lib/server/mcp-oauth/grants', () => ({ resolveOAuthGrantUser }));
vi.mock('@/lib/server/rate-limit', () => ({ checkRateLimit }));
vi.mock('@/lib/observability/finance-log', () => ({ logFinanceEvent }));

import { Prisma } from '@/generated/prisma/client';
import { defineOwnerTool, defineUserTool } from '@/lib/mcp/define-tool';
import { McpToolError } from '@/lib/mcp/errors';
import { DomainError } from '@/lib/finance/domain-error';
import { runAgentTool } from '@/lib/mcp/tool-helpers';
import { connectInMemoryMcp } from '@/lib/mcp/testing/in-memory-client';

const stampedAuthInfo = (scopes: Array<'read' | 'write'> = ['read', 'write']): AuthInfo => ({
  token: 'micasa_oauth_token-ya-verificado-por-el-transporte',
  clientId: 'oauth-grant:9',
  scopes,
  extra: {
    micasa_agent: {
      userId: 2,
      scopes,
      authSource: 'oauth_grant',
      oauthGrantId: 9,
      rateLimitIdentity: -9,
    },
  },
});

const parseText = (result: { content: Array<{ text: string }> }) =>
  JSON.parse(result.content[0]!.text);

const probeRun = vi.fn();

const connectProbe = (authInfo: AuthInfo = stampedAuthInfo()) =>
  connectInMemoryMcp(
    (server) => {
      defineOwnerTool(server, {
        name: 'probe',
        title: 'Probe',
        description: 'Herramienta de prueba.',
        scope: 'read',
        input: { name: z.string().describe('Un nombre.') },
        run: probeRun,
      });
      defineUserTool(server, {
        name: 'probe_user',
        title: 'Probe user',
        description: 'Herramienta de prueba sin owner.',
        input: {},
        run: async (user) => ({ user_id: user.userId, contexts: user.allowedContexts }),
      });
    },
    { authInfo },
  );

beforeEach(() => {
  vi.clearAllMocks();
  findManyAllowedContexts.mockResolvedValue([{ owner_type: 'HOUSE', owner_id: 42 }]);
  findFirstMembership.mockResolvedValue({ role: 'MEMBER' });
  checkRateLimit.mockResolvedValue({ limited: false, retryAfterSeconds: 0, remaining: 119 });
  probeRun.mockImplementation(async (agent, args) => ({
    owner_filter: agent.ownerFilter,
    name: args.name,
  }));
});

describe('defineOwnerTool registration', () => {
  it('publica owner_type/owner_id, strict y las anotaciones derivadas', async () => {
    const client = await connectProbe();
    const tool = (await client.listTools()).find((t) => t.name === 'probe')!;

    expect(tool.annotations).toEqual({ readOnlyHint: true, openWorldHint: false });
    expect(tool.inputSchema.additionalProperties).toBe(false);
    expect(tool.inputSchema.required).toEqual(['owner_type', 'owner_id', 'name']);
    expect(Object.keys(tool.inputSchema.properties ?? {})).not.toContain('ownerType');
    await client.close();
  });
});

describe('owner args', () => {
  it('acepta owner_type / owner_id', async () => {
    const client = await connectProbe();
    const result = await client.callTool('probe', {
      owner_type: 'house',
      owner_id: 42,
      name: 'snake',
    });

    expect(result.isError).toBeUndefined();
    expect(parseText(result)).toEqual({
      owner_filter: { user_id: null, house_id: 42 },
      name: 'snake',
    });
    await client.close();
  });

  it('acepta los alias v2 ownerType / ownerId', async () => {
    const client = await connectProbe();
    const result = await client.callTool('probe', {
      ownerType: 'house',
      ownerId: 42,
      name: 'camel',
    });

    expect(result.isError).toBeUndefined();
    expect(parseText(result).name).toBe('camel');
    await client.close();
  });

  it('rechaza una clave desconocida sin ejecutar la tool', async () => {
    const client = await connectProbe();
    const result = await client.callTool('probe', {
      owner_type: 'house',
      owner_id: 42,
      name: 'x',
      wallet_nmae: 'typo',
    });

    expect(result.isError).toBe(true);
    expect(parseText(result)).toMatchObject({ code: 'VALIDATION' });
    expect(parseText(result).error).toContain('wallet_nmae');
    expect(probeRun).not.toHaveBeenCalled();
    await client.close();
  });
});

describe('errores', () => {
  it('un error de Prisma llega como INTERNAL y su texto solo queda en el log', async () => {
    probeRun.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError(
        'Invalid `prisma.wallet.findMany()` invocation: column "secret_internal" does not exist',
        { code: 'P2022', clientVersion: 'test' },
      ),
    );
    const client = await connectProbe();
    const result = await client.callTool('probe', {
      owner_type: 'house',
      owner_id: 42,
      name: 'x',
    });

    expect(result.isError).toBe(true);
    expect(parseText(result)).toEqual({
      error: 'Error interno en la herramienta',
      code: 'INTERNAL',
    });
    expect(result.content[0]!.text).not.toContain('secret_internal');
    expect(logFinanceEvent).toHaveBeenCalledWith(
      'warn',
      'mcp.tool.failed',
      expect.objectContaining({
        tool: 'probe',
        error_name: 'PrismaClientKnownRequestError',
        error: expect.stringContaining('secret_internal'),
      }),
    );
    await client.close();
  });

  it('un TypeError también es INTERNAL', async () => {
    probeRun.mockRejectedValue(new TypeError("Cannot read properties of undefined (reading 'id')"));
    const client = await connectProbe();
    const result = await client.callTool('probe', { owner_type: 'house', owner_id: 42, name: 'x' });

    expect(parseText(result)).toEqual({ error: 'Error interno en la herramienta', code: 'INTERNAL' });
    await client.close();
  });

  it('McpToolError conserva code, hint y candidates', async () => {
    probeRun.mockRejectedValue(
      new McpToolError('AMBIGUOUS_REF', 'Nombre ambiguo', {
        hint: 'Usa wallet_id.',
        candidates: [
          { id: 1, name: 'Nu' },
          { id: 2, name: 'NU' },
        ],
      }),
    );
    const client = await connectProbe();
    const result = await client.callTool('probe', { owner_type: 'house', owner_id: 42, name: 'x' });

    expect(parseText(result)).toEqual({
      error: 'Nombre ambiguo',
      code: 'AMBIGUOUS_REF',
      hint: 'Usa wallet_id.',
      candidates: [
        { id: 1, name: 'Nu' },
        { id: 2, name: 'NU' },
      ],
    });
    await client.close();
  });

  it('un DomainError conserva su mensaje y se clasifica por status', async () => {
    probeRun
      .mockRejectedValueOnce(
        new DomainError('VALIDATION', 'El préstamo debe pagarse desde efectivo o débito'),
      )
      .mockRejectedValueOnce(new DomainError('P2025', 'Préstamo no encontrado'))
      .mockRejectedValueOnce(new DomainError('NOT_HOUSE_MEMBER', 'No eres miembro de esta casa', 403));
    const client = await connectProbe();
    const call = () => client.callTool('probe', { owner_type: 'house', owner_id: 42, name: 'x' });

    expect(parseText(await call())).toEqual({
      error: 'El préstamo debe pagarse desde efectivo o débito',
      code: 'VALIDATION',
    });
    expect(parseText(await call())).toEqual({ error: 'Préstamo no encontrado', code: 'NOT_FOUND' });
    expect(parseText(await call())).toEqual({
      error: 'No eres miembro de esta casa',
      code: 'FORBIDDEN',
    });
    await client.close();
  });

  it('un Error simple ya no expone su mensaje (INTERNAL)', async () => {
    probeRun.mockRejectedValue(new Error('Category seed: root "Hogar" was not created'));
    const client = await connectProbe();
    const result = await client.callTool('probe', { owner_type: 'house', owner_id: 42, name: 'x' });

    expect(parseText(result)).toEqual({ error: 'Error interno en la herramienta', code: 'INTERNAL' });
    await client.close();
  });

  it('casa fuera de la allow-list → FORBIDDEN', async () => {
    const client = await connectProbe();
    const result = await client.callTool('probe', { owner_type: 'house', owner_id: 7, name: 'x' });

    expect(parseText(result).code).toBe('FORBIDDEN');
    expect(probeRun).not.toHaveBeenCalled();
    await client.close();
  });
});

describe('identidad del transporte', () => {
  it('con ctx.authInfo no vuelve a resolver el token', async () => {
    const client = await connectProbe();
    await client.callTool('probe', { owner_type: 'house', owner_id: 42, name: 'x' });

    expect(findUniqueApiKey).not.toHaveBeenCalled();
    expect(resolveOAuthGrantUser).not.toHaveBeenCalled();
    expect(findManyAllowedContexts).toHaveBeenCalledWith({
      where: { oauth_grant_id: 9 },
      select: { owner_type: true, owner_id: true },
    });
    await client.close();
  });

  it('evalúa el rate limit antes de la primera query de allow-list', async () => {
    const order: string[] = [];
    checkRateLimit.mockImplementation(async () => {
      order.push('rate_limit');
      return { limited: false, retryAfterSeconds: 0, remaining: 119 };
    });
    findManyAllowedContexts.mockImplementation(async () => {
      order.push('allow_list');
      return [{ owner_type: 'HOUSE', owner_id: 42 }];
    });

    const result = await runAgentTool(
      'probe',
      {
        http: {
          req: new Request('http://localhost/api/mcp', { method: 'POST' }),
          authInfo: stampedAuthInfo(),
        },
      },
      { owner_type: 'house', owner_id: 42 },
      'read',
      async () => ({ ok: true }),
    );

    expect(result.isError).toBeUndefined();
    expect(order).toEqual(['rate_limit', 'allow_list']);
    expect(checkRateLimit).toHaveBeenCalledWith(expect.any(Request), 'mcp:tool', -9);
  });

  it('con el límite alcanzado devuelve RATE_LIMITED sin tocar la base', async () => {
    checkRateLimit.mockResolvedValue({ limited: true, retryAfterSeconds: 12, remaining: 0 });
    const fn = vi.fn();

    const result = await runAgentTool(
      'probe',
      {
        http: {
          req: new Request('http://localhost/api/mcp', { method: 'POST' }),
          authInfo: stampedAuthInfo(),
        },
      },
      { owner_type: 'house', owner_id: 42 },
      'read',
      fn,
    );

    expect(parseText(result)).toEqual({
      error: 'Límite de solicitudes alcanzado para esta conexión.',
      code: 'RATE_LIMITED',
      hint: 'Reintenta en 12s.',
    });
    expect(findManyAllowedContexts).not.toHaveBeenCalled();
    expect(fn).not.toHaveBeenCalled();
  });

  it('una tool de escritura con token de solo lectura → FORBIDDEN', async () => {
    const fn = vi.fn();
    const result = await runAgentTool(
      'probe_write',
      { http: { authInfo: stampedAuthInfo(['read']) } },
      { owner_type: 'house', owner_id: 42 },
      'write',
      fn,
    );

    expect(parseText(result).code).toBe('FORBIDDEN');
    expect(fn).not.toHaveBeenCalled();
  });
});

describe('defineUserTool', () => {
  it('es de solo lectura, strict y recibe la allow-list', async () => {
    const client = await connectProbe();
    const tool = (await client.listTools()).find((t) => t.name === 'probe_user')!;
    expect(tool.annotations).toEqual({ readOnlyHint: true, openWorldHint: false });
    expect(tool.inputSchema.additionalProperties).toBe(false);

    const result = await client.callTool('probe_user', {});
    expect(parseText(result)).toEqual({
      user_id: 2,
      contexts: [{ owner_type: 'house', owner_id: 42 }],
    });

    const rejected = await client.callTool('probe_user', { ownerType: 'user' });
    expect(rejected.isError).toBe(true);
    await client.close();
  });
});
