import {
  WALLET_PROVIDER_ICON_OPTIONS,
  type WalletProviderIconOption,
} from '@/lib/wallet-provider-icons';
import type { FortnightFrequency } from '@/components/onboarding/fortnight-frequency';

/** Banks most people in Mexico use, shown first as chips (in this order). */
export const COMMON_BANK_KEYS = [
  'BBVA',
  'NU_BANK',
  'BANAMEX',
  'SANTANDER',
  'MERCADO_PAGO',
] as const;

/** Never offered as a bank chip: cash is a wallet type, "Banco" is the "Otro" chip. */
const NOT_A_BANK_CHIP = new Set<string>(['CASH_GENERIC', 'GENERIC_BANK']);

const COMMON_BANK_SET = new Set<string>(COMMON_BANK_KEYS);

const optionByKey = new Map(
  WALLET_PROVIDER_ICON_OPTIONS.map((option) => [option.key as string, option]),
);

/** Common banks first; the rest sit behind "Más bancos". */
export const BANK_CHIP_GROUPS: {
  common: WalletProviderIconOption[];
  more: WalletProviderIconOption[];
} = {
  common: COMMON_BANK_KEYS.map((key) => optionByKey.get(key)).filter(
    (option): option is WalletProviderIconOption => option != null,
  ),
  more: WALLET_PROVIDER_ICON_OPTIONS.filter(
    (option) => !COMMON_BANK_SET.has(option.key) && !NOT_A_BANK_CHIP.has(option.key),
  ),
};

/** The extra banks start open when the saved draft already picked one of them. */
export const isMoreBankKey = (key: string | null): boolean =>
  key != null && BANK_CHIP_GROUPS.more.some((option) => option.key === key);

/** Short chip labels for "¿Cuándo lo recibes?". */
export const INCOME_WHEN_CHIPS: { value: FortnightFrequency; label: string }[] = [
  { value: 'BOTH', label: 'Las dos quincenas' },
  { value: 'FIRST', label: 'Solo la 1ª' },
  { value: 'SECOND', label: 'Solo la 2ª' },
];

/** Monthly equivalent of a per-fortnight amount: twice when it arrives both fortnights. */
export const monthlyIncomeEquivalent = (
  amountPerFortnight: number,
  frequency: FortnightFrequency,
): number => {
  if (!Number.isFinite(amountPerFortnight) || amountPerFortnight <= 0) return 0;
  return frequency === 'BOTH' ? amountPerFortnight * 2 : amountPerFortnight;
};
