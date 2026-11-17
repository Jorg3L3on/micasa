import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthInfo } from '@modelcontextprotocol/server';

const m = vi.hoisted(() => ({
  houseMemberFindFirst: vi.fn(),
  allowedContextsFindMany: vi.fn(),
  walletFindFirst: vi.fn(),
  regenerateFortnightFromTemplatesForOwner: vi.fn(),
  deleteExpense: vi.fn(),
  updateWalletMetadataForOwner: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    houseMember: { findFirst: m.houseMemberFindFirst },
    agentConnectionAllowedContext: { findMany: m.allowedContextsFindMany },
    wallet: { findFirst: m.walletFindFirst },
  },
}));
vi.mock('@/lib/finance/fortnight.service', () => ({
  createMonthFortnightsForOwner: vi.fn(),
  regenerateFortnightFromTemplatesForOwner: m.regenerateFortnightFromTemplatesForOwner,
}));
vi.mock('@/lib/finance/expense.service', () => ({ deleteExpense: m.deleteExpense }));
vi.mock('@/lib/finance/wallet.service', () => ({
  updateWalletMetadataForOwner: m.updateWalletMetadataForOwner,
}));

import { registerFortnightTools } from '@/lib/mcp/tools/fortnights';
import { registerDeleteTools } from '@/lib/mcp/tools/delete';
import { registerWalletTools } from '@/lib/mcp/tools/wallets';
import { connectInMemoryMcp } from '@/lib/mcp/testing/in-memory-client';

const HOUSE = { owner_type: 'house' as const, owner_id: 42 };

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

const call = async (name: string, args: Record<string, unknown>) => {
  const client = await connectInMemoryMcp(
    (server) => {
      registerFortnightTools(server);
      registerDeleteTools(server);
      registerWalletTools(server);
    },
    { authInfo },
  );
  const result = await client.callTool(name, args);
  await client.close();
  return { isError: result.isError, body: JSON.parse(result.content[0]!.text) };
};

const CONFIRM_REQUIRED = {
  error: 'Esta operación requiere confirm: true.',
  code: 'CONFIRM_REQUIRED',
  hint: 'Confirma con el usuario y repite la llamada con confirm: true.',
};

beforeEach(() => {
  vi.clearAllMocks();
  m.houseMemberFindFirst.mockResolvedValue({ role: 'OWNER' });
  m.allowedContextsFindMany.mockResolvedValue([{ owner_type: 'HOUSE', owner_id: 42 }]);
  m.walletFindFirst.mockResolvedValue({ id: 4, name: 'Efectivo', type: 'CASH' });
  m.regenerateFortnightFromTemplatesForOwner.mockResolvedValue({ removed: 3, created: 3 });
  m.updateWalletMetadataForOwner.mockResolvedValue({ amount: 100 });
});

describe('confirm on destructive tools', () => {
  it('regenerate_from_templates without confirm → CONFIRM_REQUIRED and nothing runs', async () => {
    const result = await call('regenerate_from_templates', { ...HOUSE, fortnight_id: 55 });

    expect(result.isError).toBe(true);
    expect(result.body).toEqual(CONFIRM_REQUIRED);
    expect(m.regenerateFortnightFromTemplatesForOwner).not.toHaveBeenCalled();
  });

  it('regenerate_from_templates with confirm: false is still refused', async () => {
    const result = await call('regenerate_from_templates', {
      ...HOUSE,
      fortnight_id: 55,
      confirm: false,
    });

    expect(result.body.code).toBe('CONFIRM_REQUIRED');
    expect(m.regenerateFortnightFromTemplatesForOwner).not.toHaveBeenCalled();
  });

  it('regenerate_from_templates with confirm: true runs', async () => {
    const result = await call('regenerate_from_templates', {
      ...HOUSE,
      fortnight_id: 55,
      confirm: true,
    });

    expect(result.isError).toBeUndefined();
    expect(m.regenerateFortnightFromTemplatesForOwner).toHaveBeenCalledWith(55, {
      user_id: null,
      house_id: 42,
    });
  });

  it("delete {kind: 'expense'} without confirm → CONFIRM_REQUIRED", async () => {
    const result = await call('delete', { ...HOUSE, kind: 'expense', id: 7 });

    expect(result.body).toEqual(CONFIRM_REQUIRED);
    expect(m.deleteExpense).not.toHaveBeenCalled();
  });

  it("delete {kind: 'expense', confirm: true} deletes", async () => {
    const result = await call('delete', { ...HOUSE, kind: 'expense', id: 7, confirm: true });

    expect(result.body).toEqual({ deleted: true, kind: 'expense', id: 7 });
    expect(m.deleteExpense).toHaveBeenCalledWith({
      id: 7,
      ownerFilter: { user_id: null, house_id: 42 },
    });
  });

  it('adjust_balance without confirm → CONFIRM_REQUIRED', async () => {
    const result = await call('adjust_balance', { ...HOUSE, wallet_id: 4, new_balance: 100 });

    expect(result.body.code).toBe('CONFIRM_REQUIRED');
    expect(m.updateWalletMetadataForOwner).not.toHaveBeenCalled();
  });
});
