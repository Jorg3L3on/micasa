import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthInfo } from '@modelcontextprotocol/server';

const {
  findManyAllowedContexts,
  findFirstMembership,
  findFirstWallet,
  listWalletsByOwner,
  createWalletForOwner,
  updateWalletMetadataForOwner,
  createCreditCardForOwner,
  updateCreditCardForOwner,
} = vi.hoisted(() => ({
  findManyAllowedContexts: vi.fn(),
  findFirstMembership: vi.fn(),
  findFirstWallet: vi.fn(),
  listWalletsByOwner: vi.fn(),
  createWalletForOwner: vi.fn(),
  updateWalletMetadataForOwner: vi.fn(),
  createCreditCardForOwner: vi.fn(),
  updateCreditCardForOwner: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    houseMember: { findFirst: findFirstMembership },
    agentConnectionAllowedContext: { findMany: findManyAllowedContexts },
    wallet: { findFirst: findFirstWallet },
  },
}));

vi.mock('@/lib/finance/wallet.service', () => ({
  listWalletsByOwner,
  createWalletForOwner,
  updateWalletMetadataForOwner,
}));

vi.mock('@/lib/finance/credit-card.service', () => ({
  createCreditCardForOwner,
  updateCreditCardForOwner,
  createCreditCardPayment: vi.fn(),
  getCreditCardByOwner: vi.fn(),
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
  it('list_wallets con type credit devuelve los campos de tarjeta (alias ownerType aceptado)', async () => {
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
      {
        id: 2,
        name: 'Efectivo',
        type: 'CASH',
        amount: 300,
        credit_limit: null,
        temporary_credit_limit: null,
        active: true,
        include_in_liquidity: true,
        cutoff_day: null,
        due_day: null,
      },
    ]);
    const client = await connect();

    const result = await client.callTool('list_wallets', {
      ownerType: 'house',
      ownerId: 42,
      type: 'credit',
    });

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

  it('create_wallet crea tarjetas por el camino de create_card', async () => {
    createCreditCardForOwner.mockResolvedValue({
      id: 9,
      name: 'Visa',
      type: 'CREDIT_CARD',
      amount: 0,
      credit_limit: 20000,
      temporary_credit_limit: null,
      available_credit: 20000,
      cutoff_day: 5,
      due_day: 25,
      active: true,
    });
    const client = await connect();

    const result = await client.callTool('create_wallet', {
      owner_type: 'house',
      owner_id: 42,
      name: 'Visa',
      type: 'CREDIT_CARD',
      credit_limit: 20000,
      cutoff_day: 5,
      due_day: 25,
    });

    expect(createWalletForOwner).not.toHaveBeenCalled();
    expect(createCreditCardForOwner).toHaveBeenCalledWith(
      'house',
      42,
      expect.objectContaining({ type: 'CREDIT_CARD', credit_limit: 20000, cutoff_day: 5 }),
    );
    expect(parseText(result)).toMatchObject({ id: 9, type: 'CREDIT_CARD', available_credit: 20000 });
    await client.close();
  });

  it('create_wallet exige límite, corte y pago en tarjetas', async () => {
    const client = await connect();

    const result = await client.callTool('create_wallet', {
      owner_type: 'house',
      owner_id: 42,
      name: 'Visa',
      type: 'CREDIT_CARD',
    });

    expect(result.isError).toBe(true);
    expect(parseText(result)).toMatchObject({ code: 'VALIDATION' });
    expect(createCreditCardForOwner).not.toHaveBeenCalled();
    await client.close();
  });

  it('create_wallet rechaza campos de tarjeta en una billetera de efectivo', async () => {
    const client = await connect();

    const result = await client.callTool('create_wallet', {
      owner_type: 'house',
      owner_id: 42,
      name: 'Efectivo',
      credit_limit: 5000,
    });

    expect(parseText(result)).toMatchObject({ code: 'VALIDATION' });
    expect(parseText(result).error).toContain('credit_limit');
    expect(createWalletForOwner).not.toHaveBeenCalled();
    await client.close();
  });

  it('create_wallet crea metas sin contar en liquidez', async () => {
    createWalletForOwner.mockResolvedValue({
      id: 11,
      name: 'Viaje',
      type: 'GOAL',
      amount: '0',
      goal_amount: '30000',
      goal_due_date: new Date('2027-06-30T12:00:00.000Z'),
      active: true,
    });
    const client = await connect();

    const result = await client.callTool('create_wallet', {
      owner_type: 'house',
      owner_id: 42,
      name: 'Viaje',
      type: 'GOAL',
      goal_amount: 30000,
      goal_due_date: '2027-06-30',
    });

    expect(createWalletForOwner).toHaveBeenCalledWith(
      'house',
      42,
      expect.objectContaining({ type: 'GOAL', include_in_liquidity: false, goal_amount: 30000 }),
    );
    expect(parseText(result)).toMatchObject({
      id: 11,
      type: 'GOAL',
      goal_amount: 30000,
      goal_due_date: '2027-06-30',
    });
    await client.close();
  });

  it('update_wallet en una tarjeta usa updateCreditCardForOwner solo con los campos enviados', async () => {
    findFirstWallet.mockResolvedValue({ id: 9, name: 'Visa', type: 'CREDIT_CARD' });
    updateCreditCardForOwner.mockResolvedValue({
      id: 9,
      name: 'Visa',
      type: 'CREDIT_CARD',
      amount: 1200,
      credit_limit: 25000,
      temporary_credit_limit: null,
      available_credit: 23800,
      cutoff_day: 5,
      due_day: 25,
      active: true,
    });
    const client = await connect();

    const result = await client.callTool('update_wallet', {
      owner_type: 'house',
      owner_id: 42,
      wallet_id: 9,
      credit_limit: 25000,
    });

    expect(updateCreditCardForOwner).toHaveBeenCalledWith(
      9,
      { credit_limit: 25000 },
      { user_id: null, house_id: 42 },
    );
    expect(parseText(result)).toMatchObject({ id: 9, credit_limit: 25000 });
    await client.close();
  });

  it('update_wallet rechaza campos de meta en una tarjeta', async () => {
    findFirstWallet.mockResolvedValue({ id: 9, name: 'Visa', type: 'CREDIT_CARD' });
    const client = await connect();

    const result = await client.callTool('update_wallet', {
      owner_type: 'house',
      owner_id: 42,
      wallet_id: 9,
      goal_amount: 1000,
    });

    expect(parseText(result)).toMatchObject({ code: 'VALIDATION' });
    expect(updateCreditCardForOwner).not.toHaveBeenCalled();
    await client.close();
  });

  it('adjust_balance fija la deuda en tarjetas y el saldo en efectivo', async () => {
    updateCreditCardForOwner.mockResolvedValue({ id: 9, amount: 800, available_credit: 19200 });
    updateWalletMetadataForOwner.mockResolvedValue({ id: 2, amount: '450' });
    const client = await connect();

    findFirstWallet.mockResolvedValueOnce({ id: 9, name: 'Visa', type: 'CREDIT_CARD' });
    const card = await client.callTool('adjust_balance', {
      owner_type: 'house',
      owner_id: 42,
      wallet_id: 9,
      new_balance: 800,
      confirm: true,
    });

    findFirstWallet.mockResolvedValueOnce({ id: 2, name: 'Efectivo', type: 'CASH' });
    const cash = await client.callTool('adjust_balance', {
      owner_type: 'house',
      owner_id: 42,
      wallet_id: 2,
      new_balance: 450,
      confirm: true,
    });

    expect(updateCreditCardForOwner).toHaveBeenCalledWith(
      9,
      expect.objectContaining({ amount: 800 }),
      { user_id: null, house_id: 42 },
    );
    expect(updateWalletMetadataForOwner).toHaveBeenCalledWith(
      2,
      { amount: 450 },
      { user_id: null, house_id: 42 },
    );
    expect(parseText(card)).toMatchObject({ wallet_type: 'CREDIT_CARD', new_balance: 800 });
    expect(parseText(cash)).toMatchObject({ wallet_type: 'CASH', new_balance: 450 });
    await client.close();
  });

  it('adjust_balance sin confirm no toca la billetera', async () => {
    const client = await connect();

    const result = await client.callTool('adjust_balance', {
      owner_type: 'house',
      owner_id: 42,
      wallet_id: 2,
      new_balance: 450,
    });

    expect(result.isError).toBe(true);
    expect(findFirstWallet).not.toHaveBeenCalled();
    expect(updateWalletMetadataForOwner).not.toHaveBeenCalled();
    await client.close();
  });
});
