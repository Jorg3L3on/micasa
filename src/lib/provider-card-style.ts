import type { CSSProperties } from 'react';

const PROVIDER_ICON_BASE_COLORS: Record<string, string> = {
  AMEX: '#016fd0',
  BANAMEX: '#dc2626',
  BBVA: '#2563eb',
  SANTANDER: '#e11d48',
  CA: '#64748b',
  DIDI: '#ea580c',
  LIVERPOOL: '#a855f7',
  MERCADO_PAGO: '#0ea5e9',
  MERCADO_LIBRE: '#eab308',
  NU_BANK: '#820ad1',
  PAYPAL: '#6366f1',
  SEARS: '#4f46e5',
  GENERIC_BANK: '#3b82f6',
  CASH_GENERIC: '#14b8a6',
};

const TYPE_FALLBACK_COLORS: Record<string, string> = {
  CASH: '#14b8a6',
  DEBIT_CARD: '#3b82f6',
  CREDIT_CARD: '#475569',
  DEPARTMENT_STORE_CARD: '#64748b',
  GOAL: '#2563eb',
};

const hexToRgb = (hex: string) => {
  const normalized = hex.replace('#', '');
  const value =
    normalized.length === 3
      ? normalized
          .split('')
          .map((char) => `${char}${char}`)
          .join('')
      : normalized;

  if (value.length !== 6) return null;

  const parsed = Number.parseInt(value, 16);
  if (Number.isNaN(parsed)) return null;

  return {
    r: (parsed >> 16) & 255,
    g: (parsed >> 8) & 255,
    b: parsed & 255,
  };
};

const rgba = (hex: string, alpha: number) => {
  const rgb = hexToRgb(hex);
  if (!rgb) return `rgba(255, 255, 255, ${alpha})`;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
};

const getCardColor = (providerIconKey?: string | null, fallbackType?: string) => {
  if (providerIconKey && PROVIDER_ICON_BASE_COLORS[providerIconKey]) {
    return PROVIDER_ICON_BASE_COLORS[providerIconKey];
  }

  if (fallbackType && TYPE_FALLBACK_COLORS[fallbackType]) {
    return TYPE_FALLBACK_COLORS[fallbackType];
  }

  return null;
};

/** Brand hex for charts, accents, etc. */
export const getProviderBrandColor = (
  providerIconKey?: string | null,
  fallbackType?: string,
): string | null => getCardColor(providerIconKey, fallbackType);

/** Mix brand hex toward white for readable ink on dark surfaces. */
const mixWithWhite = (hex: string, amount: number): string => {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const mix = (channel: number) =>
    Math.round(channel + (255 - channel) * amount);
  const toHex = (channel: number) =>
    mix(channel).toString(16).padStart(2, '0');
  return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`;
};

export type WalletBrandCssVars = CSSProperties & {
  '--wallet-brand': string;
  '--wallet-brand-ink': string;
  '--wallet-brand-ink-dark': string;
  '--wallet-brand-hover-bg': string;
  '--wallet-brand-hover-bg-dark': string;
};

/** CSS vars for brand-tinted hover/focus on wallet list card controls. */
export const getWalletBrandCssVars = (
  brandHex: string,
): WalletBrandCssVars => ({
  '--wallet-brand': brandHex,
  '--wallet-brand-ink': brandHex,
  '--wallet-brand-ink-dark': mixWithWhite(brandHex, 0.28),
  // ~10% brand wash (light) / ~16% (dark) — matches Amex mock.
  '--wallet-brand-hover-bg': rgba(brandHex, 0.1),
  '--wallet-brand-hover-bg-dark': rgba(brandHex, 0.16),
});

/** Wash + brand ink (name link, text buttons, menu trigger). */
export const WALLET_BRAND_HIT_CLASS =
  'transition-colors duration-150 hover:bg-[var(--wallet-brand-hover-bg)] hover:text-[var(--wallet-brand-ink)] dark:hover:bg-[var(--wallet-brand-hover-bg-dark)] dark:hover:text-[var(--wallet-brand-ink-dark)] focus-visible:bg-[var(--wallet-brand-hover-bg)] focus-visible:text-[var(--wallet-brand-ink)] dark:focus-visible:bg-[var(--wallet-brand-hover-bg-dark)] dark:focus-visible:text-[var(--wallet-brand-ink-dark)] motion-reduce:transition-none';

/**
 * Same as WALLET_BRAND_HIT_CLASS but beats Button ghost `hover:bg-accent`
 * (Tailwind conflict resolution is stylesheet order, not className order).
 */
export const WALLET_BRAND_HIT_BUTTON_CLASS =
  'transition-colors duration-150 hover:!bg-[var(--wallet-brand-hover-bg)] hover:!text-[var(--wallet-brand-ink)] dark:hover:!bg-[var(--wallet-brand-hover-bg-dark)] dark:hover:!text-[var(--wallet-brand-ink-dark)] focus-visible:!bg-[var(--wallet-brand-hover-bg)] focus-visible:!text-[var(--wallet-brand-ink)] dark:focus-visible:!bg-[var(--wallet-brand-hover-bg-dark)] dark:focus-visible:!text-[var(--wallet-brand-ink-dark)] motion-reduce:transition-none';

/** Wash only — keep child text colors (e.g. balance amount stays ink). */
export const WALLET_BRAND_HIT_WASH_CLASS =
  'transition-colors duration-150 hover:bg-[var(--wallet-brand-hover-bg)] dark:hover:bg-[var(--wallet-brand-hover-bg-dark)] focus-visible:bg-[var(--wallet-brand-hover-bg)] dark:focus-visible:bg-[var(--wallet-brand-hover-bg-dark)] motion-reduce:transition-none';

/** Brand ink for a child label when its group parent is hovered/focused. */
export const WALLET_BRAND_HIT_LABEL_CLASS =
  'group-hover:text-[var(--wallet-brand-ink)] group-focus-visible:text-[var(--wallet-brand-ink)] dark:group-hover:text-[var(--wallet-brand-ink-dark)] dark:group-focus-visible:text-[var(--wallet-brand-ink-dark)]';

export type ProviderCardTone = 'subtle' | 'wow' | 'calm' | 'list';
export type ProviderCardScheme = 'light' | 'dark';

/** Calm cards adapt to theme; wow/subtle stay dark plastic surfaces. */
export const isProviderCardDarkSurface = (
  tone: ProviderCardTone,
  scheme: ProviderCardScheme,
): boolean => tone !== 'calm' || scheme === 'dark';

/** List tone: airy brand wash on bg-card — readable with default foreground text. */
export const getListToneCardStyle = (baseColor: string): CSSProperties => ({
  background: `linear-gradient(112deg, ${rgba(baseColor, 0.18)} 0%, ${rgba(baseColor, 0.06)} 40%, transparent 72%)`,
  borderColor: rgba(baseColor, 0.28),
  borderLeftWidth: '3px',
  borderLeftColor: rgba(baseColor, 0.5),
});

export const getProviderCardStyle = (
  providerIconKey?: string | null,
  fallbackType?: string,
  tone: ProviderCardTone = 'subtle',
  scheme: ProviderCardScheme = 'dark',
): CSSProperties | undefined => {
  const baseColor = getCardColor(providerIconKey, fallbackType);
  if (!baseColor) return undefined;

  if (tone === 'list') {
    return getListToneCardStyle(baseColor);
  }

  // Calm tone: even brand wash (no left accent stripe / corner bloom).
  if (tone === 'calm') {
    if (scheme === 'light') {
      return {
        background: `
          radial-gradient(120% 100% at 50% 0%, ${rgba(baseColor, 0.1)} 0%, transparent 58%),
          linear-gradient(155deg, #ffffff 0%, #f3f5f8 100%)
        `,
        borderColor: rgba(baseColor, 0.28),
        boxShadow: `
          inset 0 1px 0 rgba(255, 255, 255, 0.95),
          0 1px 2px rgba(15, 23, 42, 0.04),
          0 10px 22px -14px rgba(15, 23, 42, 0.16)
        `,
      };
    }

    return {
      background: `
        radial-gradient(120% 100% at 50% 0%, ${rgba(baseColor, 0.14)} 0%, transparent 58%),
        linear-gradient(155deg, #10141d 0%, #141a25 100%)
      `,
      borderColor: rgba(baseColor, 0.24),
      boxShadow: `
        inset 0 1px 0 rgba(255, 255, 255, 0.06),
        0 10px 24px -16px rgba(0, 0, 0, 0.85)
      `,
    };
  }

  const isWow = tone === 'wow';
  const topBloomAlpha = isWow ? 0.52 : 0.42;
  const bottomBloomAlpha = isWow ? 0.34 : 0.24;
  const glossAlpha = isWow ? 0.2 : 0.14;
  const coreAlpha = isWow ? 0.9 : 0.82;
  const borderAlpha = isWow ? 0.5 : 0.36;
  const glowAlpha = isWow ? 0.82 : 0.78;
  const innerHighlightAlpha = isWow ? 0.28 : 0.2;
  const innerShadeAlpha = isWow ? 0.28 : 0.18;
  const depthShadowAlpha = isWow ? 0.86 : 0.8;

  return {
    background: `
      radial-gradient(132% 96% at 8% 8%, ${rgba(baseColor, topBloomAlpha)} 0%, transparent 58%),
      radial-gradient(96% 82% at 88% 85%, ${rgba(baseColor, bottomBloomAlpha)} 0%, transparent 64%),
      linear-gradient(160deg, ${rgba('#ffffff', glossAlpha)} 0%, transparent 40%),
      linear-gradient(128deg, #0f131c 0%, #141a26 55%, ${rgba(baseColor, coreAlpha)} 100%)
    `,
    borderColor: rgba(baseColor, borderAlpha),
    boxShadow: `
      inset 0 1px 0 ${rgba('#ffffff', innerHighlightAlpha)},
      inset 0 -10px 24px ${rgba('#000000', innerShadeAlpha)},
      0 10px 24px -14px ${rgba('#000000', depthShadowAlpha)},
      0 18px 36px -20px ${rgba(baseColor, glowAlpha)}
    `,
  };
};
