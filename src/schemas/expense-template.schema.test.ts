import { describe, expect, it } from 'vitest';
import {
  createExpenseTemplateSchema,
  expenseTemplateSchema,
  updateExpenseTemplateSchema,
} from './expense-template.schema';
import { incomeTemplateSchema, INCOME_NO_FORTNIGHT_MESSAGE } from './income-template.schema';

const base = {
  name: 'Internet',
  categoryId: 10,
  suggestedAmount: 600,
  paymentMethodId: 4,
  active: true,
  isRecurring: true,
  isSubscription: false,
};

const withDays = (dueDayFirst: number | null, dueDaySecond: number | null) => ({
  ...base,
  appliesFirstFortnight: dueDayFirst !== null,
  appliesSecondFortnight: dueDaySecond !== null,
  dueDayFirst,
  dueDaySecond,
});

const issuePaths = (result: { success: boolean; error?: { issues: { path: PropertyKey[] }[] } }) =>
  result.error?.issues.map((issue) => issue.path.join('.')) ?? [];

describe.each([
  ['create (API)', createExpenseTemplateSchema],
  ['update (API)', updateExpenseTemplateSchema],
  ['form', expenseTemplateSchema],
] as const)('expense template due days, %s schema', (_name, schema) => {
  it('accepts 1 and 14 in the 1ª quincena', () => {
    expect(schema.safeParse(withDays(1, null)).success).toBe(true);
    expect(schema.safeParse(withDays(14, null)).success).toBe(true);
  });

  it('rejects 15 in the 1ª quincena', () => {
    const result = schema.safeParse(withDays(15, null));
    expect(result.success).toBe(false);
    expect(issuePaths(result)).toContain('dueDayFirst');
  });

  it('accepts 15 and 30 in the 2ª quincena', () => {
    expect(schema.safeParse(withDays(null, 15)).success).toBe(true);
    expect(schema.safeParse(withDays(null, 30)).success).toBe(true);
  });

  it('rejects 31 in the 2ª quincena', () => {
    const result = schema.safeParse(withDays(null, 31));
    expect(result.success).toBe(false);
    expect(issuePaths(result)).toContain('dueDaySecond');
  });

  it('rejects 14 in the 2ª quincena and 0 in the 1ª', () => {
    expect(schema.safeParse(withDays(null, 14)).success).toBe(false);
    expect(schema.safeParse(withDays(0, null)).success).toBe(false);
  });

  it('accepts no quincena at all (the item goes to Sin programar)', () => {
    expect(schema.safeParse({ ...withDays(null, null), isRecurring: false }).success).toBe(true);
  });
});

describe('expense template API schema', () => {
  it('accepts a null amount and a null wallet (variable, no wallet)', () => {
    const parsed = createExpenseTemplateSchema.parse({
      ...withDays(5, null),
      suggestedAmount: null,
      paymentMethodId: null,
    });
    expect(parsed.suggestedAmount).toBeNull();
    expect(parsed.paymentMethodId).toBeNull();
  });

  it('leaves cutoffDay undefined when the form does not send it', () => {
    const parsed = updateExpenseTemplateSchema.parse(withDays(5, 20));
    expect(parsed.cutoffDay).toBeUndefined();
  });
});

describe('income template form schema', () => {
  const income = {
    name: 'Sueldo',
    categoryId: 30,
    suggestedAmount: 15000,
    source: null,
    walletId: 4,
    active: true,
    userId: null,
  };

  it('accepts one or both quincenas', () => {
    for (const [first, second] of [
      [true, false],
      [false, true],
      [true, true],
    ]) {
      expect(
        incomeTemplateSchema.safeParse({
          ...income,
          appliesFirstFortnight: first,
          appliesSecondFortnight: second,
        }).success,
      ).toBe(true);
    }
  });

  it('rejects no quincena with the form message', () => {
    const result = incomeTemplateSchema.safeParse({
      ...income,
      appliesFirstFortnight: false,
      appliesSecondFortnight: false,
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(INCOME_NO_FORTNIGHT_MESSAGE);
  });
});
