import type { CSSProperties } from 'react';

const PROVIDER_ICON_BASE_COLORS: Record<string, string> = {
  BANAMEX: '#dc2626',
  BBVA: '#2563eb',
  SANTANDER: '#e11d48',
  CA: '#64748b',
  DIDI: '#ea580c',
  LIVERPOOL: '#a855f7',
  MERCADO_PAGO: '#0ea5e9',
  MERCADO_LIBRE: '#eab308',
  PAYPAL: '#6366f1',
  SEARS: '#4f46e5',
  GENERIC_BANK: '#3b82f6',
  CASH_GENERIC: '#14b8a6',
};

const TYPE_FALLBACK_COLORS: Record<string, string> = {
  CREDIT_CARD: '#475569',
  DEPARTMENT_STORE_CARD: '#64748b',
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

export type ProviderCardTone = 'subtle' | 'wow' | 'calm';

export const getProviderCardStyle = (
  providerIconKey?: string | null,
  fallbackType?: string,
  tone: ProviderCardTone = 'subtle',
): CSSProperties | undefined => {
  const baseColor = getCardColor(providerIconKey, fallbackType);
  if (!baseColor) return undefined;

  // Calm tone: a shared dark surface with only a subtle brand tint, and the
  // brand color expressed as a left accent stripe instead of flooding the card.
  if (tone === 'calm') {
    return {
      background: `
        radial-gradient(125% 95% at 0% 0%, ${rgba(baseColor, 0.24)} 0%, transparent 52%),
        radial-gradient(90% 80% at 100% 100%, ${rgba(baseColor, 0.1)} 0%, transparent 60%),
        linear-gradient(155deg, #10141d 0%, #141a25 100%)
      `,
      borderColor: rgba(baseColor, 0.26),
      boxShadow: `
        inset 3px 0 0 ${rgba(baseColor, 0.8)},
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
