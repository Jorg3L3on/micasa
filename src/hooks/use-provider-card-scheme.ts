'use client';

import { useTheme } from 'next-themes';
import { useClientMounted } from '@/hooks/use-client-mounted';
import type { ProviderCardScheme } from '@/lib/provider-card-style';

/**
 * Theme-aware provider card scheme that stays stable across SSR → hydrate.
 * next-themes leaves `resolvedTheme` unset on the server; treating that as
 * "dark" causes hydration mismatches when the client preference is light.
 * Until mount, always return "light"; after mount, follow resolvedTheme.
 */
export function useProviderCardScheme(): ProviderCardScheme {
  const { resolvedTheme } = useTheme();
  const mounted = useClientMounted();
  if (!mounted) return 'light';
  return resolvedTheme === 'dark' ? 'dark' : 'light';
}
