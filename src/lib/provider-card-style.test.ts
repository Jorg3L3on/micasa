import { describe, expect, it } from 'vitest';
import {
  getProviderCardStyle,
  getWalletAuraColors,
  isProviderCardDarkSurface,
} from '@/lib/provider-card-style';

describe('provider-card-style', () => {
  it('keeps calm dark surfaces for dark scheme', () => {
    const style = getProviderCardStyle('BANAMEX', 'CREDIT_CARD', 'calm', 'dark');
    expect(style?.background).toEqual(expect.stringContaining('#10141d'));
    expect(isProviderCardDarkSurface('calm', 'dark')).toBe(true);
  });

  it('uses a light calm surface for light scheme', () => {
    const style = getProviderCardStyle('BANAMEX', 'CREDIT_CARD', 'calm', 'light');
    expect(style?.background).toEqual(expect.stringContaining('#ffffff'));
    expect(style?.background).not.toEqual(expect.stringContaining('#10141d'));
    expect(isProviderCardDarkSurface('calm', 'light')).toBe(false);
  });

  it('keeps wow tone as a dark plastic surface regardless of scheme', () => {
    const style = getProviderCardStyle('BBVA', 'CREDIT_CARD', 'wow', 'light');
    expect(style?.background).toEqual(expect.stringContaining('#0f131c'));
    expect(isProviderCardDarkSurface('wow', 'light')).toBe(true);
  });

  it('adapts the aura tone to the active scheme', () => {
    const dark = getProviderCardStyle('NU_BANK', 'CREDIT_CARD', 'aura', 'dark');
    const light = getProviderCardStyle('NU_BANK', 'CREDIT_CARD', 'aura', 'light');
    expect(dark?.background).toEqual(expect.stringContaining('#0b1020'));
    expect(light?.background).toEqual(expect.stringContaining('#ffffff'));
    expect(isProviderCardDarkSurface('aura', 'dark')).toBe(true);
    expect(isProviderCardDarkSurface('aura', 'light')).toBe(false);
  });

  it('derives aura colors from the provider brand, falling back to wallet type', () => {
    const nu = getWalletAuraColors('NU_BANK', 'CREDIT_CARD');
    expect(nu?.shine[0]).toBe('#820ad1');
    expect(nu?.glow).toBe('rgba(130, 10, 209, 0.35)');

    const cash = getWalletAuraColors(null, 'CASH');
    expect(cash?.shine[0]).toBe('#14b8a6');

    expect(getWalletAuraColors(null, 'UNKNOWN')).toBeNull();
  });
});
