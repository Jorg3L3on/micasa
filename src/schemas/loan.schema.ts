import { z } from 'zod';

const nullablePositiveIntFromForm = z.preprocess(
  (value) => {
    if (value === undefined || value === null || value === '') return null;
    return Number(value);
  },
  z.number().int().positive().nullable(),
);

const positiveAmountFromForm = z.preprocess(
  (value) => Number(value),
  z.number().positive('El monto debe ser mayor a 0'),
);

const positiveIntFromForm = z.preprocess(
  (value) => Number(value),
  z.number().int().positive('Debe ser mayor a 0'),
);

export const loanTypeSchema = z.enum(['PERSONAL', 'PAYROLL']);
export const loanPaymentFrequencySchema = z.enum([
  'WEEKLY',
  'FORTNIGHTLY',
  'MONTHLY',
]);
export const loanPaymentSourceSchema = z.enum([
  'WALLET',
  'PAYROLL_DEDUCTION',
]);
export const loanPaymentActionSchema = z.enum([
  'MARK_PAID',
  'MARK_SCHEDULED',
  'SKIP',
  'CANCEL',
]);
export const loanPaymentStatusSchema = z.enum([
  'SCHEDULED',
  'PAID',
  'SKIPPED',
  'CANCELLED',
]);

export const createLoanSchema = z
  .object({
    name: z.string().trim().min(1, 'El nombre es obligatorio'),
    lender: z.string().trim().min(1, 'La entidad es obligatoria'),
    type: loanTypeSchema,
    principalAmount: positiveAmountFromForm,
    paymentAmount: positiveAmountFromForm,
    paymentCount: positiveIntFromForm,
    frequency: loanPaymentFrequencySchema,
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida'),
    paymentSource: loanPaymentSourceSchema,
    sourceWalletId: nullablePositiveIntFromForm.optional(),
    linkedWalletId: nullablePositiveIntFromForm.optional(),
    incomeTemplateId: nullablePositiveIntFromForm.optional(),
    notes: z.string().trim().max(500).optional().nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.paymentSource === 'WALLET' && !data.sourceWalletId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['sourceWalletId'],
        message: 'Selecciona la billetera que pagará el préstamo',
      });
    }

    if (data.paymentSource === 'PAYROLL_DEDUCTION' && data.type !== 'PAYROLL') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['paymentSource'],
        message: 'La deducción de nómina solo aplica a préstamos de nómina',
      });
    }
  });

export const updateLoanPaymentSchema = z
  .object({
    action: loanPaymentActionSchema.optional(),
    // Backward-compatible shape for existing callers; normalized in the service.
    status: loanPaymentStatusSchema.optional(),
    paidAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
    sourceWalletId: nullablePositiveIntFromForm.optional(),
    note: z.string().trim().max(500).optional().nullable(),
  })
  .superRefine((data, ctx) => {
    if (!data.action && !data.status) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['action'],
        message: 'Selecciona una acción para el pago del préstamo',
      });
    }
  });

export type CreateLoanInput = z.infer<typeof createLoanSchema>;
export type UpdateLoanPaymentInput = z.infer<typeof updateLoanPaymentSchema>;
