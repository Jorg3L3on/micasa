'use client';

import { WalletProviderIcon } from '@/components/wallets/WalletProviderIcon';
import {
  inferLenderProviderIconKey,
  isFonacotLenderName,
} from '@/lib/finance/lender-identity';
import { cn } from '@/lib/utils';

type LenderIdentityProps = {
  name: string;
  providerIconKey?: string | null;
  subtitle?: string | null;
  className?: string;
  nameClassName?: string;
  subtitleClassName?: string;
  iconClassName?: string;
  iconInnerClassName?: string;
};

export const LenderIdentity = ({
  name,
  providerIconKey,
  subtitle,
  className,
  nameClassName,
  subtitleClassName,
  iconClassName,
  iconInnerClassName,
}: LenderIdentityProps) => {
  const inferredKey = inferLenderProviderIconKey(name, providerIconKey);
  const showFonacotPill = isFonacotLenderName(name) && !inferredKey;

  return (
    <span className={cn('inline-flex min-w-0 items-center gap-2.5', className)}>
      {showFonacotPill ? (
        <span
          className={cn(
            'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-500/15 text-[11px] font-bold tracking-wide text-teal-800 ring-1 ring-teal-500/30 dark:text-teal-200',
            iconClassName,
          )}
          aria-label="Fonacot"
          title="Fonacot"
        >
          FC
        </span>
      ) : (
        <WalletProviderIcon
          providerIconKey={inferredKey}
          className={cn('h-10 w-10 rounded-xl', iconClassName)}
          iconClassName={cn('h-5 w-5', iconInnerClassName)}
        />
      )}
      <span className="min-w-0">
        <span
          className={cn(
            'block font-semibold leading-tight text-foreground',
            nameClassName,
          )}
        >
          {name}
        </span>
        {subtitle ? (
          <span
            className={cn(
              'mt-0.5 block text-xs text-muted-foreground',
              subtitleClassName,
            )}
          >
            {subtitle}
          </span>
        ) : null}
      </span>
    </span>
  );
};
