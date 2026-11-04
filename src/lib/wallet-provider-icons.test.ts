import { describe, expect, it } from 'vitest';
import { getWalletProviderLogoOption } from '@/lib/wallet-provider-icons';

describe('getWalletProviderLogoOption', () => {
  it('returns the catalog entry when the provider ships a logo', () => {
    expect(getWalletProviderLogoOption('LIVERPOOL')).toMatchObject({
      key: 'LIVERPOOL',
      logoPath: '/wallet-providers/liverpool.png',
    });
  });

  it('returns null for text-only badges, unknown keys and no key', () => {
    expect(getWalletProviderLogoOption('GENERIC_BANK')).toBeNull();
    expect(getWalletProviderLogoOption('CASH_GENERIC')).toBeNull();
    expect(getWalletProviderLogoOption('NOT_A_PROVIDER')).toBeNull();
    expect(getWalletProviderLogoOption(null)).toBeNull();
    expect(getWalletProviderLogoOption(undefined)).toBeNull();
  });
});
