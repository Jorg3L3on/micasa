'use client';

import Image from 'next/image';
import type { WalletProviderLogoOption } from '@/lib/wallet-provider-icons';
import { cn } from '@/lib/utils';

type DueRowProviderLogoProps = {
  /** From `getWalletProviderLogoOption`; rows without one keep their generic icon. */
  provider: WalletProviderLogoOption;
  className?: string;
};

/**
 * Provider logo for the 9x9 status tile in Tarjetas / Préstamos rows.
 * The white backing keeps issuer marks legible on the tinted tile in both
 * themes; the tile around it still carries the paid / overdue / due tint.
 */
export const DueRowProviderLogo = ({
  provider,
  className,
}: DueRowProviderLogoProps) => (
  <span
    className={cn(
      'flex size-6 items-center justify-center overflow-hidden rounded-lg bg-white ring-1 ring-black/5',
      className,
    )}
    title={provider.label}
    data-provider-key={provider.key}
  >
    <Image
      src={provider.logoPath}
      alt=""
      width={20}
      height={20}
      className="size-5 object-contain"
      unoptimized
    />
  </span>
);
