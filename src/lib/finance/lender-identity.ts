import { lenderNameKey } from '@/lib/finance/lender-name';
import {
  parseWalletProviderIconKey,
  type WalletProviderIconKey,
} from '@/lib/wallet-provider-icons';

const NAME_RULES: Array<{
  match: (key: string) => boolean;
  icon: WalletProviderIconKey;
}> = [
  { match: (key) => key.includes('mercado libre'), icon: 'MERCADO_LIBRE' },
  { match: (key) => key.includes('mercado pago'), icon: 'MERCADO_PAGO' },
  { match: (key) => key.includes('santander'), icon: 'SANTANDER' },
  { match: (key) => key.includes('bbva'), icon: 'BBVA' },
  { match: (key) => key.includes('banamex') || key.includes('citibanamex'), icon: 'BANAMEX' },
  { match: (key) => key.includes('didi'), icon: 'DIDI' },
  { match: (key) => key.includes('nubank') || key === 'nu', icon: 'NU_BANK' },
  { match: (key) => key.includes('paypal'), icon: 'PAYPAL' },
  { match: (key) => key.includes('liverpool'), icon: 'LIVERPOOL' },
  { match: (key) => key.includes('amex') || key.includes('american express'), icon: 'AMEX' },
  { match: (key) => key.includes('banco') || key.includes('bank'), icon: 'GENERIC_BANK' },
];

export const isFonacotLenderName = (name: string): boolean =>
  lenderNameKey(name).includes('fonacot');

/** Catalog icon for a prestamista. Fonacot stays null so it does not enter the wallet picker. */
export const inferLenderProviderIconKey = (
  name: string,
  stored?: string | null,
): WalletProviderIconKey | null => {
  const fromStored = parseWalletProviderIconKey(stored);
  if (fromStored) return fromStored;
  if (isFonacotLenderName(name)) return null;

  const key = lenderNameKey(name);
  for (const rule of NAME_RULES) {
    if (rule.match(key)) return rule.icon;
  }
  return null;
};
