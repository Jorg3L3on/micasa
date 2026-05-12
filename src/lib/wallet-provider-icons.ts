export const WALLET_PROVIDER_ICON_KEYS = [
  'AMEX',
  'BANAMEX',
  'BBVA',
  'SANTANDER',
  'CA',
  'DIDI',
  'LIVERPOOL',
  'MERCADO_PAGO',
  'MERCADO_LIBRE',
  'NU_BANK',
  'PAYPAL',
  'SEARS',
  'GENERIC_BANK',
  'CASH_GENERIC',
] as const;

export type WalletProviderIconKey = (typeof WALLET_PROVIDER_ICON_KEYS)[number];

const WALLET_PROVIDER_ICON_KEY_SET = new Set<string>(WALLET_PROVIDER_ICON_KEYS);

/** Coerce DB/string values to the catalog union; unknown values become null. */
export const parseWalletProviderIconKey = (
  key: string | null | undefined,
): WalletProviderIconKey | null => {
  if (key == null) return null;
  return WALLET_PROVIDER_ICON_KEY_SET.has(key) ? (key as WalletProviderIconKey) : null;
};

export type WalletProviderIconOption = {
  key: WalletProviderIconKey;
  label: string;
  shortLabel: string;
  logoPath?: string;
  brandClassName: string;
};

export const WALLET_PROVIDER_ICON_OPTIONS: readonly WalletProviderIconOption[] = [
  {
    key: 'AMEX',
    label: 'Amex',
    shortLabel: 'AX',
    logoPath: '/wallet-providers/amex.png',
    brandClassName: '',
  },
  {
    key: 'BANAMEX',
    label: 'Banamex',
    shortLabel: 'BX',
    logoPath: '/wallet-providers/banamex.png',
    brandClassName: 'bg-red-500/15 text-red-700 dark:text-red-300',
  },
  {
    key: 'BBVA',
    label: 'BBVA',
    shortLabel: 'BB',
    logoPath: '/wallet-providers/bbva.png',
    brandClassName: 'bg-blue-500/15 text-blue-700 dark:text-blue-300',
  },
  {
    key: 'SANTANDER',
    label: 'Santander',
    shortLabel: 'ST',
    logoPath: '/wallet-providers/santander.png',
    brandClassName: 'bg-red-500/15 text-red-700 dark:text-red-300',
  },
  {
    key: 'CA',
    label: 'C&A',
    shortLabel: 'CA',
    logoPath: '/wallet-providers/ca.png',
    brandClassName: 'bg-slate-500/15 text-slate-700 dark:text-slate-300',
  },
  {
    key: 'DIDI',
    label: 'DiDi',
    shortLabel: 'DD',
    logoPath: '/wallet-providers/didi.png',
    brandClassName: 'bg-orange-500/15 text-orange-700 dark:text-orange-300',
  },
  {
    key: 'LIVERPOOL',
    label: 'Liverpool',
    shortLabel: 'LP',
    logoPath: '/wallet-providers/liverpool.png',
    brandClassName: 'bg-purple-500/15 text-purple-700 dark:text-purple-300',
  },
  {
    key: 'MERCADO_PAGO',
    label: 'Mercado Pago',
    shortLabel: 'MP',
    logoPath: '/wallet-providers/mercadopago.png',
    brandClassName: 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
  },
  {
    key: 'MERCADO_LIBRE',
    label: 'Mercado Libre',
    shortLabel: 'ML',
    logoPath: '/wallet-providers/mercadolibre.png',
    brandClassName: 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-300',
  },
  {
    key: 'NU_BANK',
    label: 'NU',
    shortLabel: 'NU',
    logoPath: '/wallet-providers/nubank.png',
    brandClassName: 'bg-blue-500/15 text-blue-700 dark:text-blue-300',
  },
  {
    key: 'PAYPAL',
    label: 'PayPal',
    shortLabel: 'PP',
    logoPath: '/wallet-providers/paypal.png',
    brandClassName: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300',
  },
  {
    key: 'SEARS',
    label: 'Sears',
    shortLabel: 'SR',
    logoPath: '/wallet-providers/sears.png',
    brandClassName: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300',
  },
  {
    key: 'GENERIC_BANK',
    label: 'Banco',
    shortLabel: 'BK',
    brandClassName: 'bg-blue-500/15 text-blue-700 dark:text-blue-300',
  },
  {
    key: 'CASH_GENERIC',
    label: 'Efectivo',
    shortLabel: '$',
    brandClassName: 'bg-slate-500/15 text-slate-700 dark:text-slate-300',
  },
];

export const WALLET_PROVIDER_ICON_MAP = new Map(
  WALLET_PROVIDER_ICON_OPTIONS.map((item) => [item.key, item]),
);

export const getWalletProviderOption = (key?: string | null) => {
  if (!key) return null;
  return WALLET_PROVIDER_ICON_MAP.get(key as WalletProviderIconKey) ?? null;
};
