import { z } from 'zod';
import { dateStringSchema } from '@/schemas/common.schema';
import { CREDIT_MAX_MONTHS, MSI_MONTH_OPTIONS } from '@/lib/finance/purchase-simulation/constants';

/** Horizon cap: 30 years of quincenas. */
export const PURCHASE_SIMULATION_MAX_HORIZON_MONTHS = 360;

const money = z
  .number({ message: 'Escribe un monto.' })
  .max(99999999.99, 'El monto es demasiado alto.');

const walletId = z
  .number({ message: 'Elige una billetera.' })
  .int('Elige una billetera.')
  .positive('Elige una billetera.');

/**
 * Body of POST /api/wallets/purchase-simulation (MIC-I17). One purchase,
 * described by how it is paid; nothing is stored.
 */
export const purchaseSimulationSchema = z
  .object({
    name: z.string().trim().max(120).optional(),
    total: money.positive('El precio debe ser mayor a $0.'),
    date: dateStringSchema,
    mode: z.enum(['contado', 'msi', 'credito']),
    /** contado: paying wallet; msi: the card; credito on a card: the card. */
    wallet_id: walletId.optional(),
    months: z.number().int().optional(),
    lender: z.enum(['new', 'card']).optional(),
    annual_rate: z.number().min(0).max(1000).optional(),
    monthly_payment: money.positive().optional(),
    down_payment: money.min(0).optional(),
    down_wallet_id: walletId.optional(),
    pay_wallet_id: walletId.optional(),
    payment_day: z.number().int().min(1).max(31).optional(),
    extra_monthly: money.min(0).optional(),
    /** Months to project; omitted = until the last payment (+3 quincenas). */
    horizon_months: z
      .number()
      .int()
      .min(1)
      .max(PURCHASE_SIMULATION_MAX_HORIZON_MONTHS)
      .optional(),
  })
  .superRefine((value, ctx) => {
    const issue = (path: string, message: string) =>
      ctx.addIssue({ code: 'custom', path: [path], message });
    if (value.mode === 'msi') {
      if (value.wallet_id == null) issue('wallet_id', 'Elige una tarjeta.');
      if (!(MSI_MONTH_OPTIONS as readonly number[]).includes(value.months ?? -1)) {
        issue('months', 'Elige 3, 6, 9, 12, 18 o 24 meses.');
      }
    }
    if (value.mode === 'contado' && value.wallet_id == null) issue('wallet_id', 'Elige una billetera.');
    if (value.mode === 'credito') {
      const months = value.months ?? 0;
      if (months < 1 || months > CREDIT_MAX_MONTHS) {
        issue('months', `Indica de 1 a ${CREDIT_MAX_MONTHS} meses.`);
      }
      const lender = value.lender ?? 'new';
      if (lender === 'card' && value.wallet_id == null) issue('wallet_id', 'Elige una tarjeta.');
      if (lender === 'new' && value.pay_wallet_id == null) {
        issue('pay_wallet_id', 'Elige de qué billetera salen las mensualidades.');
      }
      if ((value.down_payment ?? 0) > value.total) {
        issue('down_payment', 'El enganche no puede ser mayor al precio.');
      }
      if ((value.down_payment ?? 0) > 0 && value.down_wallet_id == null) {
        issue('down_wallet_id', 'Elige de qué billetera sale el enganche.');
      }
      if (value.monthly_payment == null && value.annual_rate == null) {
        issue('annual_rate', 'Escribe la tasa anual o la mensualidad.');
      }
    }
  });

export type PurchaseSimulationInput = z.infer<typeof purchaseSimulationSchema>;
