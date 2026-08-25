import { beforeEach, describe, expect, it, vi } from 'vitest';
import { hashSync } from 'bcryptjs';

const { findUniqueApiKey, updateApiKey, findFirstMembership, findManyAllowedContexts } =
  vi.hoisted(() => ({
    findUniqueApiKey: vi.fn(),
    updateApiKey: vi.fn(),
    findFirstMembership: vi.fn(),
    findManyAllowedContexts: vi.fn(),
  }));

vi.mock('@/lib/prisma', () => ({
  default: {
    apiKey: { findUnique: findUniqueApiKey, update: updateApiKey },
    houseMember: { findFirst: findFirstMembership },
    agentConnectionAllowedContext: { findMany: findManyAllowedContexts },
  },
}));

import { runAgentTool, runAgentUserTool } from '@/lib/mcp/tool-helpers';

const VALID_TOKEN = 'micasa_secreto-de-prueba-suficientemente-largo';
const VALID_HASH = hashSync(VALID_TOKEN, 4);

const apiKeyRow = (scopes: string[]) => ({
  id: 10,
  key_hash: VALID_HASH,
  revoked_at: null,
  scopes,
  user: { id: 2, active: true },
});

const ctxWithToken = (token?: string) => ({
  http: {
    req: new Request('http://localhost/api/mcp', {
      headers: token ? { authorization: `Bearer ${token}` } : {},
    }),
  },
});

const houseArgs = { ownerType: 'house' as const, ownerId: 3 };

beforeEach(() => {
  vi.clearAllMocks();
  updateApiKey.mockResolvedValue({});
  findManyAllowedContexts.mockResolvedValue([{ owner_type: 'HOUSE', owner_id: 3 }]);
});

describe('runAgentTool', () => {
  it('ejecuta la herramienta con el contexto resuelto', async () => {
    findUniqueApiKey.mockResolvedValue(apiKeyRow(['read']));
    findFirstMembership.mockResolvedValue({ role: 'MEMBER' });

    const result = await runAgentTool(
      'list_cards',
      ctxWithToken(VALID_TOKEN),
      houseArgs,
      'read',
      async (agent) => ({ ownerFilter: agent.ownerFilter }),
    );

    expect(result.isError).toBeUndefined();
    expect(JSON.parse(result.content[0].text)).toEqual({
      ownerFilter: { user_id: null, house_id: 3 },
    });
  });

  it('devuelve isError sin ejecutar fn cuando falta el token', async () => {
    const fn = vi.fn();
    const result = await runAgentTool(
      'list_cards',
      ctxWithToken(),
      houseArgs,
      'read',
      fn,
    );
    expect(result.isError).toBe(true);
    expect(fn).not.toHaveBeenCalled();
  });

  it('devuelve isError cuando el usuario no es miembro de la casa', async () => {
    findUniqueApiKey.mockResolvedValue(apiKeyRow(['read', 'write']));
    findFirstMembership.mockResolvedValue(null);
    const fn = vi.fn();

    const result = await runAgentTool(
      'list_cards',
      ctxWithToken(VALID_TOKEN),
      houseArgs,
      'read',
      fn,
    );

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('No eres miembro');
    expect(fn).not.toHaveBeenCalled();
  });

  it('bloquea writes con token de solo lectura', async () => {
    findUniqueApiKey.mockResolvedValue(apiKeyRow(['read']));
    findFirstMembership.mockResolvedValue({ role: 'OWNER' });
    const fn = vi.fn();

    const result = await runAgentTool(
      'adjust_card_debt',
      ctxWithToken(VALID_TOKEN),
      houseArgs,
      'write',
      fn,
    );

    expect(result.isError).toBe(true);
    expect(JSON.parse(result.content[0].text).error).toContain(
      'scope "write"',
    );
    expect(fn).not.toHaveBeenCalled();
  });

  it('serializa errores de dominio como isError', async () => {
    findUniqueApiKey.mockResolvedValue(apiKeyRow(['read']));
    findFirstMembership.mockResolvedValue({ role: 'OWNER' });

    const result = await runAgentTool(
      'get_card',
      ctxWithToken(VALID_TOKEN),
      houseArgs,
      'read',
      async () => {
        throw new Error('Tarjeta no encontrada');
      },
    );

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Tarjeta no encontrada');
  });
});

describe('runAgentUserTool', () => {
  it('resuelve el usuario del token sin owner args', async () => {
    findUniqueApiKey.mockResolvedValue(apiKeyRow(['read']));

    const result = await runAgentUserTool(
      'list_houses',
      ctxWithToken(VALID_TOKEN),
      async (user) => ({ userId: user.userId }),
    );

    expect(result.isError).toBeUndefined();
    expect(JSON.parse(result.content[0].text)).toEqual({ userId: 2 });
  });

  it('devuelve isError con token inválido', async () => {
    findUniqueApiKey.mockResolvedValue(null);
    const result = await runAgentUserTool(
      'list_houses',
      ctxWithToken('micasa_token-que-no-existe-en-la-tabla'),
      async () => ({}),
    );
    expect(result.isError).toBe(true);
  });
});
