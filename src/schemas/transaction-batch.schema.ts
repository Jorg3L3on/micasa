import { z } from 'zod';
import { dateStringSchema } from './common.schema';

/** Server-side cap. The UI hints at 10; the expected use is 3 to 5. */
export const MAX_BATCH_ITEMS = 25;

const clientIdSchema = z.string().min(1).max(64);

const batchExpenseItemSchema = z.object({
  kind: z.literal('expense'),
  clientId: clientIdSchema,
  name: z.string().trim().min(1, 'El nombre es requerido'),
  categoryId: z.number().int().positive('La categoría es requerida'),
  amount: z.number().positive('El monto debe ser mayor a 0'),
  walletId: z.number().int().positive('Selecciona la billetera'),
  date: dateStringSchema,
  isPaid: z.boolean().default(false),
  isRecurring: z.boolean().default(false),
  applyToBothFortnights: z.boolean().default(false),
  applyWalletDelta: z.boolean().optional(),
});

const batchIncomeItemSchema = z.object({
  kind: z.literal('income'),
  clientId: clientIdSchema,
  name: z.string().trim().min(1, 'El nombre es requerido'),
  categoryId: z.number().int().positive('La categoría es requerida'),
  amount: z.number().positive('El monto debe ser mayor a 0'),
  walletId: z.number().int().positive('Selecciona la billetera'),
  date: dateStringSchema,
});

export const batchItemSchema = z.discriminatedUnion('kind', [
  batchExpenseItemSchema,
  batchIncomeItemSchema,
]);

/**
 * Items are validated one by one by the service, so a single bad row does not
 * reject the whole request. Here we only check the envelope.
 */
export const transactionBatchEnvelopeSchema = z.object({
  items: z
    .array(z.unknown())
    .min(1, 'Agrega al menos un movimiento')
    .max(MAX_BATCH_ITEMS, `Máximo ${MAX_BATCH_ITEMS} movimientos por lote`),
});

export type BatchItemInput = z.infer<typeof batchItemSchema>;
export type BatchExpenseItem = z.infer<typeof batchExpenseItemSchema>;
export type BatchIncomeItem = z.infer<typeof batchIncomeItemSchema>;
