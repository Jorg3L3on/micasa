import { beforeEach, describe, expect, it, vi } from 'vitest';

const { findManyExpenseTemplate, getOwnerContext } = vi.hoisted(() => ({
  findManyExpenseTemplate: vi.fn(),
  getOwnerContext: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    expenseTemplate: { findMany: findManyExpenseTemplate },
  },
}));

vi.mock('@/lib/server/get-owner-context', () => ({
  getOwnerContext,
}));

import { GET } from './route';

const ownerContext = {
  userId: 1,
  ownerType: 'house' as const,
  ownerId: 7,
  ownerFilter: { user_id: null, house_id: 7 },
  role: 'owner' as const,
};

// Fixture rows shaped like the Prisma result with TEMPLATE_WITH_EXPENSES_INCLUDE.
const cardTemplate = {
  id: 11,
  name: 'Suscripción demo',
  suggested_amount: '199',
  is_recurring: true,
  applies_first_fortnight: true,
  applies_second_fortnight: false,
  is_subscription: true,
  due_day: 5,
  due_day_first_fortnight: 5,
  due_day_second_fortnight: null,
  cutoff_day: 3,
  active: true,
  category_id: 42,
  house_id: 7,
  user_id: null,
  wallet_id: 9,
  category: { name: 'Servicios', icon: 'tv' },
  wallet: {
    id: 9,
    name: 'Tarjeta demo',
    provider_icon_key: 'demo',
    type: 'CREDIT_CARD',
    cutoff_day: 22,
  },
  expenses: [],
};

const noWalletTemplate = {
  ...cardTemplate,
  id: 12,
  name: 'Variable demo',
  suggested_amount: null,
  is_subscription: false,
  due_day: null,
  due_day_first_fortnight: null,
  cutoff_day: null,
  category_id: null,
  wallet_id: null,
  category: null,
  wallet: null,
  expenses: [{ id: 1, amount: '80' }],
};

describe('GET /api/expense-templates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getOwnerContext.mockResolvedValue(ownerContext);
    findManyExpenseTemplate.mockResolvedValue([cardTemplate, noWalletTemplate]);
  });

  it('selects the wallet type and cutoff day, scoped to the owner', async () => {
    const response = await GET(
      new Request('http://localhost/api/expense-templates') as Parameters<typeof GET>[0],
    );

    expect(response.status).toBe(200);
    expect(findManyExpenseTemplate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { user_id: null, house_id: 7 },
        include: expect.objectContaining({
          wallet: {
            select: expect.objectContaining({ type: true, cutoff_day: true }),
          },
        }),
      }),
    );
  });

  it('adds categoryId, paymentMethodType and paymentMethodCutoffDay and keeps every existing field', async () => {
    const response = await GET(
      new Request('http://localhost/api/expense-templates') as Parameters<typeof GET>[0],
    );
    const body = await response.json();

    expect(body[0]).toEqual({
      id: 11,
      name: 'Suscripción demo',
      category: 'Servicios',
      categoryIcon: 'tv',
      categoryId: 42,
      suggestedAmount: 199,
      paymentMethod: 'Tarjeta demo',
      paymentMethodId: 9,
      paymentMethodProviderIconKey: 'demo',
      paymentMethodType: 'CREDIT_CARD',
      paymentMethodCutoffDay: 22,
      active: true,
      totalEstimatedAmount: 199,
      expenseIds: [],
      dueDayFirst: 5,
      dueDaySecond: null,
      dueDay: 5,
      cutoffDay: 3,
      isRecurring: true,
      appliesFirstFortnight: true,
      appliesSecondFortnight: false,
      isSubscription: true,
    });
  });

  it('returns null for the new fields with no category or wallet', async () => {
    const response = await GET(
      new Request('http://localhost/api/expense-templates') as Parameters<typeof GET>[0],
    );
    const body = await response.json();

    expect(body[1]).toMatchObject({
      categoryId: null,
      paymentMethod: null,
      paymentMethodId: null,
      paymentMethodType: null,
      paymentMethodCutoffDay: null,
      suggestedAmount: null,
      totalEstimatedAmount: 80,
    });
  });
});
