import { hexWithAlpha, getProviderBrandColor } from '@/lib/provider-card-style';

/** Semantic hues for aura surfaces on Panel financiero (match Tailwind 500 steps). */
export const AURA_TONE_HEX = {
  emerald: '#10b981',
  destructive: '#ef4444',
  amber: '#f59e0b',
  violet: '#8b5cf6',
  primary: '#3a37fc',
  blue: '#3b82f6',
} as const;

export type AuraTone = keyof typeof AURA_TONE_HEX;

export type DueRowStatus = 'paid' | 'overdue' | 'pending' | 'missing' | 'muted';

/** Days at or below this count read as "vence pronto" (amber) instead of blue. */
const DUE_SOON_DAYS = 7;

/**
 * Shared status hue for Gastos, Tarjetas and Préstamos rows: pagado emerald,
 * vencido destructive, vence pronto / falta dato amber, más adelante blue.
 * `muted` (sin cargo, cancelado) returns null so the row stays neutral.
 */
export const getDueRowTone = (
  status: DueRowStatus,
  daysLeft: number | null,
): AuraTone | null => {
  if (status === 'muted') return null;
  if (status === 'paid') return 'emerald';
  if (status === 'overdue') return 'destructive';
  if (status === 'missing') return 'amber';
  if (daysLeft != null && daysLeft < 0) return 'destructive';
  if (daysLeft != null && daysLeft <= DUE_SOON_DAYS) return 'amber';
  return 'blue';
};

/** Brand hex for a wallet, or a semantic fallback when the wallet has no provider color. */
export const getAuraWalletColor = (
  providerIconKey: string | null | undefined,
  walletType: string | undefined,
  fallback: AuraTone,
): string =>
  getProviderBrandColor(providerIconKey, walletType) ?? AURA_TONE_HEX[fallback];

/** Soft corner bloom layered on top of a surface's own background color. */
export const getAuraBloomImage = (hex: string, strength = 1): string => `
  radial-gradient(85% 120% at 0% 0%, ${hexWithAlpha(hex, 0.2 * strength)} 0%, transparent 60%),
  radial-gradient(70% 100% at 100% 100%, ${hexWithAlpha(hex, 0.08 * strength)} 0%, transparent 65%)`;

/** Horizontal bar fill: brand hue fading lighter, with a matching glow. */
export const getAuraBarStyle = (hex: string) => ({
  backgroundImage: `linear-gradient(90deg, ${hexWithAlpha(hex, 0.85)}, ${hex})`,
  boxShadow: `0 0 10px -1px ${hexWithAlpha(hex, 0.7)}`,
});

export { hexWithAlpha };
