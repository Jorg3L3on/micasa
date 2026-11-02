import { formatCurrency } from '@/lib/utils';
import type { CardBankChargeReasonValue } from '@/schemas/credit-card-payment-plan.schema';

export type { CardBankChargeReasonValue };

export const CARD_BANK_CHARGE_REASON_OPTIONS: {
  value: CardBankChargeReasonValue;
  label: string;
}[] = [
  { value: 'INTEREST', label: 'Intereses' },
  { value: 'LATE_FEE', label: 'Comisión por pago tardío' },
  { value: 'OTHER', label: 'IVA u otros' },
];

/** Cents above the recorded debt. Zero when the amount is missing or not above it. */
export const cardDebtExcess = (
  amount: number | null | undefined,
  recordedDebt: number | null | undefined,
): number => {
  if (amount == null || recordedDebt == null) return 0;
  if (!Number.isFinite(amount) || !Number.isFinite(recordedDebt)) return 0;
  const excess = Math.round((amount - recordedDebt) * 100) / 100;
  return excess > 0 ? excess : 0;
};

export const overDebtNoticeMessage = (excess: number): string =>
  `Es más que la deuda registrada (+${formatCurrency(excess)}). ¿Por qué?`;

export const OVER_DEBT_REASON_REQUIRED_MESSAGE =
  'Es más que la deuda registrada. Elige el motivo para guardar.';

export const BANK_CHARGE_REQUIRED_MESSAGE =
  'Es más que la deuda registrada. Elige el cargo del banco para guardar.';

export const isCardBankChargeReason = (
  value: string | null | undefined,
): value is CardBankChargeReasonValue =>
  value === 'INTEREST' || value === 'LATE_FEE' || value === 'OTHER';

/** Maps the two over-debt API codes to Spanish. Other errors keep their message. */
export const cardChargeErrorMessage = (error: unknown, fallback: string): string => {
  const code =
    error !== null &&
    typeof error === 'object' &&
    'code' in error &&
    typeof error.code === 'string'
      ? error.code
      : null;
  if (code === 'OVER_DEBT_REASON_REQUIRED') return OVER_DEBT_REASON_REQUIRED_MESSAGE;
  if (code === 'BANK_CHARGE_REQUIRED') return BANK_CHARGE_REQUIRED_MESSAGE;
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  return fallback;
};
