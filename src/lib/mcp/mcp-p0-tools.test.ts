import { beforeEach, describe, expect, it, vi } from 'vitest';
import { hashSync } from 'bcryptjs';

const {
  findUniqueApiKey,
  updateApiKey,
  findFirstMembership,
  findManyAllowedContexts,
  deleteIncomeForOwner,
} = vi.hoisted(() => ({
  findUniqueApiKey: vi.fn(),
  updateApiKey: vi.fn(),
  findFirstMembership: vi.fn(),
  findManyAllowedContexts: vi.fn(),
  deleteIncomeForOwner: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    apiKey: { findUnique: findUniqueApiKey, update: updateApiKey },
    houseMember: { findFirst: findFirstMembership },
    agentConnectionAllowedContext: { findMany: findManyAllowedContexts },
  },
}));

vi.mock('@/lib/finance/income.service', () => ({
  deleteIncomeForOwner,
}));

vi.mock('@/lib/server/rate-limit', () => ({
  checkRateLimit: vi.fn().mockResolvedValue({
    limited: false,
    retryAfterSeconds: 0,
    remaining: 120,
  }),
}));

import { runAgentTool } from '@/lib/mcp/tool-helpers';
import {
  createCreditCardPaymentSchema,
  normalizeCreditCardPaymentInput,
} from '@/schemas/credit-card.schema';

const VALID_TOKEN = 'micasa_secreto-de-prueba-suficientemente-largo';
const VALID_HASH = hashSync(VALID_TOKEN, 4);

const writeApiKey = {
  id: 10,
  key_hash: VALID_HASH,
  revoked_at: null,
  scopes: ['read', 'write'],
  user: { id: 2, active: true },
};

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
  findUniqueApiKey.mockResolvedValue(writeApiKey);
  findFirstMembership.mockResolvedValue({ role: 'OWNER' });
  findManyAllowedContexts.mockResolvedValue([{ owner_type: 'HOUSE', owner_id: 3 }]);
});

describe('MCP P0 write tools auth', () => {
  it('pay_card returns 403 when house context is not on allow-list', async () => {
    findManyAllowedContexts.mockResolvedValue([{ owner_type: 'USER', owner_id: 2 }]);

    const result = await runAgentTool(
      'pay_card',
      ctxWithToken(VALID_TOKEN),
      houseArgs,
      'write',
      async () => ({ ok: true }),
    );

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Contexto no autorizado');
  });

  it('delete_income requires write scope', async () => {
    findUniqueApiKey.mockResolvedValue({
      ...writeApiKey,
      scopes: ['read'],
    });

    const result = await runAgentTool(
      'delete_income',
      ctxWithToken(VALID_TOKEN),
      houseArgs,
      'write',
      async () => deleteIncomeForOwner(1, { user_id: null, house_id: 3 }),
    );

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('scope \\"write\\"');
    expect(deleteIncomeForOwner).not.toHaveBeenCalled();
  });

  it('create_month write blocked without write scope', async () => {
    findUniqueApiKey.mockResolvedValue({
      ...writeApiKey,
      scopes: ['read'],
    });

    const result = await runAgentTool(
      'create_month',
      ctxWithToken(VALID_TOKEN),
      houseArgs,
      'write',
      async () => ({ created: true }),
    );

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('scope \\"write\\"');
  });
});

describe('pay_card wallet payload', () => {
  it('normalizes wallet mode like POST /api/credit-cards/[id]/payment', () => {
    const normalized = normalizeCreditCardPaymentInput(
      createCreditCardPaymentSchema.parse({
        mode: 'wallet',
        amount: 250,
        paid_at: '2026-08-01',
        source_wallet_id: 8,
        note: 'Pago tarjeta',
      }),
    );

    expect(normalized).toEqual({
      mode: 'wallet',
      amount: 250,
      paid_at: '2026-08-01',
      note: 'Pago tarjeta',
      source_wallet_id: 8,
      create_fortnight_expense: undefined,
      fortnight_id: undefined,
      category_id: undefined,
      expense_description: null,
    });
  });
});
