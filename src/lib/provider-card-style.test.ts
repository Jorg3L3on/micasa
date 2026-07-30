import { describe, expect, it } from 'vitest';
import { WALLET_PROVIDER_ICON_KEYS } from '@/lib/wallet-provider-icons';
import {
  getProviderCardStyle,
  getWalletBrandCssVars,
} from '@/lib/provider-card-style';

describe('getProviderCardStyle', () => {
  it('returns a gradient for every catalog provider key', () => {
    for (const key of WALLET_PROVIDER_ICON_KEYS) {
      expect(getProviderCardStyle(key, undefined, 'list')).toBeDefined();
    }
  });

  it('returns a gradient for wallet types without a provider key', () => {
    expect(getProviderCardStyle(null, 'DEBIT_CARD', 'list')).toBeDefined();
    expect(getProviderCardStyle(null, 'CASH', 'list')).toBeDefined();
    expect(getProviderCardStyle(null, 'CREDIT_CARD', 'list')).toBeDefined();
  });

  it('list tone uses a light wash without dark base colors', () => {
    const style = getProviderCardStyle('AMEX', undefined, 'list');
    expect(style?.background).not.toContain('#121720');
    expect(style?.borderLeftWidth).toBe('3px');
  });
});

describe('getWalletBrandCssVars', () => {
  it('exposes Amex brand wash tokens matching the soft blue hover', () => {
    const vars = getWalletBrandCssVars('#016fd0');
    expect(vars['--wallet-brand']).toBe('#016fd0');
    expect(vars['--wallet-brand-ink']).toBe('#016fd0');
    expect(vars['--wallet-brand-hover-bg']).toBe('rgba(1, 111, 208, 0.1)');
    expect(vars['--wallet-brand-hover-bg-dark']).toBe(
      'rgba(1, 111, 208, 0.16)',
    );
    expect(vars['--wallet-brand-ink-dark']).not.toBe('#016fd0');
  });

  it('lightens dark-mode ink toward white for contrast', () => {
    const vars = getWalletBrandCssVars('#820ad1');
    expect(vars['--wallet-brand-ink-dark'].startsWith('#')).toBe(true);
    expect(vars['--wallet-brand-ink-dark'].toLowerCase()).not.toBe('#820ad1');
  });
});
