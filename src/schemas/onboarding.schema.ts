import { z } from 'zod';
import { dateStringSchema } from '@/schemas/common.schema';

const MAX_AMOUNT = 99_999_999.99;

const draftIdSchema = z.string().trim().min(1);

const nameSchema = (message: string) =>
  z.string().trim().min(1, message).max(255, 'El nombre es muy largo');

const positiveAmountSchema = (message: string) =>
  z.number().finite().positive(message).max(MAX_AMOUNT, 'El monto es muy alto');

export const onboardingWalletSchema = z.object({
  id: draftIdSchema,
  name: nameSchema('Cada billetera necesita un nombre'),
  type: z.enum(['CASH', 'BANK', 'CREDIT']),
  providerIconKey: z.string().nullable().optional(),
  /** Current balance for CASH / BANK; ignored for CREDIT. */
  initialBalance: z.number().finite().min(0).max(MAX_AMOUNT).optional().default(0),
  /** CREDIT only. */
  creditLimit: z.number().finite().min(0).max(MAX_AMOUNT).optional().default(0),
  cutoffDay: z.number().int().min(1).max(31).nullable().optional().default(null),
  dueDay: z.number().int().min(1).max(31).nullable().optional().default(null),
});

export const onboardingIncomeTemplateSchema = z.object({
  id: draftIdSchema,
  name: nameSchema('Cada ingreso necesita un nombre'),
  amount: positiveAmountSchema('El monto del ingreso debe ser mayor a 0'),
  walletId: draftIdSchema,
  source: z.string().trim().max(255).optional().default(''),
  appliesFirstFortnight: z.boolean(),
  appliesSecondFortnight: z.boolean(),
});

export const onboardingExpenseTemplateSchema = z.object({
  id: draftIdSchema,
  name: nameSchema('Cada gasto necesita un nombre'),
  amount: positiveAmountSchema('El monto del gasto debe ser mayor a 0'),
  categoryId: z.string().trim().regex(/^\d+$/, 'Elige una categoría'),
  walletId: draftIdSchema,
  isRecurring: z.boolean(),
  appliesFirstFortnight: z.boolean(),
  appliesSecondFortnight: z.boolean(),
});

/** Body of POST /api/onboarding/complete. */
export const onboardingCompleteSchema = z
  .object({
    wallets: z.array(onboardingWalletSchema).min(1, 'Agrega al menos una billetera'),
    incomeTemplates: z.array(onboardingIncomeTemplateSchema),
    expenseTemplates: z.array(onboardingExpenseTemplateSchema),
    startDate: dateStringSchema.nullable().optional(),
  })
  .superRefine((payload, ctx) => {
    const walletIds = new Set(payload.wallets.map((wallet) => wallet.id));

    payload.wallets.forEach((wallet, index) => {
      if (wallet.type !== 'CREDIT') return;
      if (!(wallet.creditLimit > 0)) {
        ctx.addIssue({
          code: 'custom',
          path: ['wallets', index, 'creditLimit'],
          message: `Escribe la línea de crédito de ${wallet.name}`,
        });
      }
      if (wallet.cutoffDay == null || wallet.dueDay == null) {
        ctx.addIssue({
          code: 'custom',
          path: ['wallets', index, wallet.cutoffDay == null ? 'cutoffDay' : 'dueDay'],
          message: `Escribe los días de corte y de pago de ${wallet.name}`,
        });
      }
    });

    payload.incomeTemplates.forEach((income, index) => {
      if (!walletIds.has(income.walletId)) {
        ctx.addIssue({
          code: 'custom',
          path: ['incomeTemplates', index, 'walletId'],
          message: 'El ingreso apunta a una billetera que no existe',
        });
      }
      if (!income.appliesFirstFortnight && !income.appliesSecondFortnight) {
        ctx.addIssue({
          code: 'custom',
          path: ['incomeTemplates', index, 'appliesFirstFortnight'],
          message: 'Elige en qué quincena recibes el ingreso',
        });
      }
    });

    payload.expenseTemplates.forEach((expense, index) => {
      if (!walletIds.has(expense.walletId)) {
        ctx.addIssue({
          code: 'custom',
          path: ['expenseTemplates', index, 'walletId'],
          message: 'El gasto apunta a una billetera que no existe',
        });
      }
      if (
        expense.isRecurring &&
        !expense.appliesFirstFortnight &&
        !expense.appliesSecondFortnight
      ) {
        ctx.addIssue({
          code: 'custom',
          path: ['expenseTemplates', index, 'appliesFirstFortnight'],
          message: 'Elige en qué quincena se paga el gasto',
        });
      }
    });
  });

export type OnboardingCompletePayload = z.infer<typeof onboardingCompleteSchema>;
