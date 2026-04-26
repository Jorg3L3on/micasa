'use client';

import { WalletProviderIcon } from '@/components/wallets/WalletProviderIcon';
import { cn } from '@/lib/utils';

type WalletIdentityProps = {
  name: string;
  providerIconKey?: string | null;
  subtitle?: string | null;
  className?: string;
  nameClassName?: string;
  subtitleClassName?: string;
  iconClassName?: string;
};

export const WalletIdentity = ({
  name,
  providerIconKey,
  subtitle,
  className,
  nameClassName,
  subtitleClassName,
  iconClassName,
}: WalletIdentityProps) => (
  <span className={cn('inline-flex min-w-0 items-center gap-2', className)}>
    <WalletProviderIcon providerIconKey={providerIconKey} className={iconClassName} />
    <span className="min-w-0">
      <span className={cn('block truncate font-medium', nameClassName)}>{name}</span>
      {subtitle ? (
        <span className={cn('block truncate text-xs text-muted-foreground', subtitleClassName)}>
          {subtitle}
        </span>
      ) : null}
    </span>
  </span>
);
