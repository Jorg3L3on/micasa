import { describe, expect, it } from 'vitest';
import {
  getProviderCardStyle,
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
});
