import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthInfo } from '@modelcontextprotocol/server';

const {
  findManyAllowedContexts,
  findFirstMembership,
  listWalletsByOwner,
  createWalletForOwner,
} = vi.hoisted(() => ({
  findManyAllowedContexts: vi.fn(),
  findFirstMembership: vi.fn(),
  listWalletsByOwner: vi.fn(),
  createWalletForOwner: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    houseMember: { findFirst: findFirstMembership },
    agentConnectionAllowedContext: { findMany: findManyAllowedContexts },
  },
}));

vi.mock('@/lib/finance/wallet.service', () => ({
  listWalletsByOwner,
  createWalletForOwner,
}));

import { registerWalletTools } from '@/lib/mcp/tools/wallets';
import { connectInMemoryMcp } from '@/lib/mcp/testing/in-memory-client';

const authInfo: AuthInfo = {
  token: 'micasa_token-verificado',
  clientId: 'api-key:10',
  scopes: ['read', 'write'],
  extra: {
    micasa_agent: {
      userId: 2,
      scopes: ['read', 'write'],
      authSource: 'api_key',
      apiKeyId: 10,
      rateLimitIdentity: 10,
    },
  },
};

const connect = () => connectInMemoryMcp(registerWalletTools, { authInfo });

const parseText = (result: { content: Array<{ text: string }> }) =>
  JSON.parse(result.content[0]!.text);

beforeEach(() => {
  vi.clearAllMocks();
  findManyAllowedContexts.mockResolvedValue([{ owner_type: 'HOUSE', owner_id: 42 }]);
  findFirstMembership.mockResolvedValue({ role: 'OWNER' });
});

describe('wallet tools on defineOwnerTool', () => {
  it('list_wallets devuelve la misma forma que v2 (alias ownerType aceptado)', async () => {
    listWalletsByOwner.mockResolvedValue([
      {
        id: 1,
        name: 'Nu',
        type: 'CREDIT_CARD',
        amount: 2500,
        credit_limit: 10000,
        temporary_credit_limit: null,
        active: true,
        include_in_liquidity: false,
        cutoff_day: 5,
        due_day: 25,
      },
    ]);
    const client = await connect();

    const result = await client.callTool('list_wallets', { ownerType: 'house', ownerId: 42 });

    expect(listWalletsByOwner).toHaveBeenCalledWith({ user_id: null, house_id: 42 });
    expect(parseText(result)).toEqual([
      {
        id: 1,
        name: 'Nu',
        type: 'CREDIT_CARD',
        amount: 2500,
        credit_limit: 10000,
        temporary_credit_limit: null,
        available_credit: 7500,
        active: true,
        include_in_liquidity: false,
        cutoff_day: 5,
        due_day: 25,
      },
    ]);
    await client.close();
  });

  it('create_wallet aplica los defaults y crea en el owner indicado', async () => {
    createWalletForOwner.mockResolvedValue({
      id: 7,
      name: 'Efectivo',
      type: 'CASH',
      amount: '0',
    });
    const client = await connect();

    const result = await client.callTool('create_wallet', {
      owner_type: 'house',
      owner_id: 42,
      name: 'Efectivo',
    });

    expect(createWalletForOwner).toHaveBeenCalledWith(
      'house',
      42,
      expect.objectContaining({
        name: 'Efectivo',
        type: 'CASH',
        amount: 0,
        include_in_liquidity: true,
        active: true,
      }),
    );
    expect(parseText(result)).toEqual({ id: 7, name: 'Efectivo', type: 'CASH', amount: 0 });
    await client.close();
  });

  it('create_wallet rechaza tipos de crédito (siguen en create_card)', async () => {
    const client = await connect();

    const result = await client.callTool('create_wallet', {
      owner_type: 'house',
      owner_id: 42,
      name: 'Visa',
      type: 'CREDIT_CARD',
    });

    expect(result.isError).toBe(true);
    expect(createWalletForOwner).not.toHaveBeenCalled();
    await client.close();
  });
});
