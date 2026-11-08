import { z } from 'zod';

const loanSimSchema = z.object({
  aprAnnual: z.number().positive().max(10),
  termMonths: z.number().int().min(1).max(360),
  feePct: z.number().min(0).max(1),
  amount: z.number().positive().optional(),
});

const actionTypeSchema = z.enum([
  'pay_minimum',
  'pay_statement',
  'pay_msi_installment',
  'pay_off',
  'defer_nonessential',
  'split_hybrid',
  'bridge_loan',
  'consolidate',
  'extra_to_debt_avalanche',
  'extra_to_debt_snowball',
  'buffer_reserve',
]);

/** "Activar este plan": the route the user chose, as the client computed it. */
export const cashPlanApplySchema = z.object({
  horizon: z.enum(['quincena', 'mes']),
  monthKey: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Mes inválido (YYYY-MM)'),
  routeId: z.string().trim().min(1).max(120),
  actions: z
    .array(
      z.object({
        type: actionTypeSchema,
        obligationId: z.string().trim().max(160).nullish(),
        amount: z.number().finite().nullish(),
      }),
    )
    .min(1)
    .max(40),
  bridgeSim: loanSimSchema.nullish(),
  consolidateSim: loanSimSchema.omit({ amount: true }).nullish(),
});

export type CashPlanApplyInput = z.infer<typeof cashPlanApplySchema>;
