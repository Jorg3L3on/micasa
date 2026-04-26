'use client';

import { Landmark } from 'lucide-react';
import Image from 'next/image';
import {
  getWalletProviderOption,
  type WalletProviderIconKey,
} from '@/lib/wallet-provider-icons';
import { cn } from '@/lib/utils';

type WalletProviderIconProps = {
  providerIconKey?: string | null;
  className?: string;
  iconClassName?: string;
  showTooltipLabel?: boolean;
};

export const WalletProviderIcon = ({
  providerIconKey,
  className,
  iconClassName,
  showTooltipLabel = true,
}: WalletProviderIconProps) => {
  const provider = getWalletProviderOption(providerIconKey);
  const providerLabel = provider?.label ?? 'Proveedor no definido';

  return (
    <span
      className={cn(
        'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border/60 bg-muted/70 text-[10px] font-semibold uppercase tracking-wide',
        provider?.brandClassName,
        className,
      )}
      title={showTooltipLabel ? providerLabel : undefined}
      aria-label={providerLabel}
      data-provider-key={(provider?.key ?? 'UNKNOWN') as WalletProviderIconKey | 'UNKNOWN'}
    >
      {provider?.logoPath ? (
        <Image
          src={provider.logoPath}
          alt={providerLabel}
          width={16}
          height={16}
          className={cn('h-4 w-4 rounded-sm object-contain', iconClassName)}
          unoptimized
        />
      ) : provider ? (
        <span className={cn('leading-none', iconClassName)}>{provider.shortLabel}</span>
      ) : (
        <Landmark className={cn('h-3.5 w-3.5', iconClassName)} aria-hidden="true" />
      )}
    </span>
  );
};
