import { beforeEach, describe, expect, it, vi } from 'vitest';
import { hashAgentToken } from '@/lib/server/agent-token';

const {
  findUniqueApiKey,
  updateApiKey,
  findFirstMembership,
  findManyHouseMember,
  findManyAllowedContexts,
  resolveOAuthGrantUserMock,
} = vi.hoisted(() => ({
  findUniqueApiKey: vi.fn(),
  updateApiKey: vi.fn(),
  findFirstMembership: vi.fn(),
  findManyHouseMember: vi.fn(),
  findManyAllowedContexts: vi.fn(),
  resolveOAuthGrantUserMock: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    apiKey: { findUnique: findUniqueApiKey, update: updateApiKey },
    houseMember: {
      findFirst: findFirstMembership,
      findMany: findManyHouseMember,
    },
    agentConnectionAllowedContext: {
      findMany: findManyAllowedContexts,
    },
  },
}));

vi.mock('@/lib/server/mcp-oauth/grants', () => ({
  resolveOAuthGrantUser: resolveOAuthGrantUserMock,
}));

vi.mock('@/lib/server/rate-limit', () => ({
  checkRateLimit: vi.fn().mockResolvedValue({
    limited: false,
    retryAfterSeconds: 0,
    remaining: 120,
  }),
}));

vi.mock('@/lib/house/house.service', () => ({
  listUserHouses: vi.fn().mockResolvedValue([
    { id: 10, name: 'Casa Alpha', role: 'OWNER' },
    { id: 20, name: 'Casa Beta', role: 'MEMBER' },
  ]),
}));

import { runAgentTool, runAgentUserTool } from '@/lib/mcp/tool-helpers';
import {
  resolveAgentContext,
  resolveOwnerForAgent,
} from '@/lib/server/resolve-agent-context';

const API_KEY_TOKEN = 'micasa_secreto-de-prueba-suficientemente-largo';
const OAUTH_TOKEN = 'micasa_oauth_acceso-de-prueba-suficientemente-largo';

const activeApiKey = {
  id: 10,
  key_hash: hashAgentToken(API_KEY_TOKEN),
  revoked_at: null,
  expires_at: null,
  scopes: ['read'],
  user: { id: 2, active: true },
};

const ctxWithToken = (token: string) => ({
  http: {
    req: new Request('http://localhost/api/mcp', {
      headers: { authorization: `Bearer ${token}` },
    }),
  },
});

const mockAllowedRows = (
  entries: Array<{ owner_type: 'USER' | 'HOUSE'; owner_id: number }>,
) => {
  findManyAllowedContexts.mockResolvedValue(entries);
};

beforeEach(() => {
  vi.clearAllMocks();
  updateApiKey.mockResolvedValue({});
  findUniqueApiKey.mockResolvedValue(activeApiKey);
  findFirstMembership.mockResolvedValue({ role: 'OWNER' });
});

describe('MCP context allow-list enforcer', () => {
  it('fail closed: empty allow-list blocks owner-scoped tools', async () => {
    mockAllowedRows([]);

    const result = await runAgentTool(
      'list_wallets',
      ctxWithToken(API_KEY_TOKEN),
      { ownerType: 'user', ownerId: 2 },
      'read',
      async () => ({ ok: true }),
    );

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('no tiene contextos autorizados');
  });

  it('personal-only: user context allowed, house denied with 403', async () => {
    mockAllowedRows([{ owner_type: 'USER', owner_id: 2 }]);

    const personal = await runAgentTool(
      'list_wallets',
      ctxWithToken(API_KEY_TOKEN),
      { ownerType: 'user', ownerId: 2 },
      'read',
      async (agent) => agent.ownerId,
    );
    expect(personal.isError).toBeUndefined();
    expect(JSON.parse(personal.content[0].text)).toBe(2);

    const house = await runAgentTool(
      'list_wallets',
      ctxWithToken(API_KEY_TOKEN),
      { ownerType: 'house', ownerId: 10 },
      'read',
      async () => ({ ok: true }),
    );
    expect(house.isError).toBe(true);
    expect(house.content[0].text).toContain('Contexto no autorizado');
  });

  it('house-only: house allowed, personal denied', async () => {
    mockAllowedRows([{ owner_type: 'HOUSE', owner_id: 10 }]);

    const house = await runAgentTool(
      'list_wallets',
      ctxWithToken(API_KEY_TOKEN),
      { ownerType: 'house', ownerId: 10 },
      'read',
      async (agent) => agent.ownerId,
    );
    expect(house.isError).toBeUndefined();
    expect(JSON.parse(house.content[0].text)).toBe(10);

    const personal = await runAgentTool(
      'list_wallets',
      ctxWithToken(API_KEY_TOKEN),
      { ownerType: 'user', ownerId: 2 },
      'read',
      async () => ({ ok: true }),
    );
    expect(personal.isError).toBe(true);
    expect(personal.content[0].text).toContain('Contexto no autorizado');
  });

  it('403 on unauthorized ownerId even when on allow-list shape mismatch', async () => {
    mockAllowedRows([{ owner_type: 'HOUSE', owner_id: 10 }]);

    const wrongHouse = await runAgentTool(
      'list_wallets',
      ctxWithToken(API_KEY_TOKEN),
      { ownerType: 'house', ownerId: 99 },
      'read',
      async () => ({ ok: true }),
    );
    expect(wrongHouse.isError).toBe(true);
    expect(wrongHouse.content[0].text).toContain('Contexto no autorizado');
  });

  it('membership revoked still blocked after allow-list passes', async () => {
    mockAllowedRows([{ owner_type: 'HOUSE', owner_id: 10 }]);
    findFirstMembership.mockResolvedValue(null);

    await expect(
      resolveOwnerForAgent(2, 'house', 10, [{ ownerType: 'house', ownerId: 10 }]),
    ).rejects.toMatchObject({ status: 403, message: 'No eres miembro de esta casa' });
  });

  it('list_houses filtered by allow-list (ApiKey)', async () => {
    mockAllowedRows([{ owner_type: 'HOUSE', owner_id: 20 }]);

    const result = await runAgentUserTool(
      'list_houses',
      ctxWithToken(API_KEY_TOKEN),
      async (user) => {
        const { listUserHouses } = await import('@/lib/house/house.service');
        const allHouses = await listUserHouses(user.userId);
        const {
          filterAllowedHouses,
          isPersonalContextAllowed,
        } = await import('@/lib/server/agent-allowed-contexts');
        const houses = filterAllowedHouses(allHouses, user.allowedContexts);
        return {
          personalContext: isPersonalContextAllowed(user.userId, user.allowedContexts)
            ? { ownerType: 'user', ownerId: user.userId }
            : null,
          houses: houses.map((house) => ({
            ownerType: 'house',
            ownerId: house.id,
            name: house.name,
          })),
        };
      },
    );

    expect(result.isError).toBeUndefined();
    const payload = JSON.parse(result.content[0].text);
    expect(payload.personalContext).toBeNull();
    expect(payload.houses).toEqual([
      { ownerType: 'house', ownerId: 20, name: 'Casa Beta' },
    ]);
  });

  it('list_houses empty when allow-list is empty (fail closed discovery)', async () => {
    mockAllowedRows([]);

    const result = await runAgentUserTool(
      'list_houses',
      ctxWithToken(API_KEY_TOKEN),
      async (user) => ({
        personalContext: null,
        houseCount: user.allowedContexts.length,
        houses: [],
      }),
    );

    expect(result.isError).toBeUndefined();
    const payload = JSON.parse(result.content[0].text);
    expect(payload.houseCount).toBe(0);
    expect(payload.houses).toEqual([]);
  });

  it('OAuth path uses the same enforcer', async () => {
    resolveOAuthGrantUserMock.mockResolvedValue({
      userId: 5,
      scopes: ['read'],
      oauthGrantId: 12,
      clientName: 'Test MCP Client',
    });
    mockAllowedRows([{ owner_type: 'USER', owner_id: 5 }]);

    const agent = await resolveAgentContext(
      `Bearer ${OAUTH_TOKEN}`,
      'user',
      5,
    );
    expect(agent.userId).toBe(5);
    expect(agent.allowedContexts).toEqual([{ ownerType: 'user', ownerId: 5 }]);
    expect(findUniqueApiKey).not.toHaveBeenCalled();
  });
});
