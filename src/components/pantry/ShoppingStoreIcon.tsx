'use client';

import Image from 'next/image';
import { cn } from '@/lib/utils';
import {
  getShoppingStoreOption,
  type ShoppingStore,
} from '@/types/shopping-store';

type Props = {
  store: ShoppingStore;
  className?: string;
  iconClassName?: string;
  showLabel?: boolean;
  variant?: 'circle' | 'badge';
};

export function ShoppingStoreIcon({
  store,
  className,
  iconClassName,
  showLabel = true,
  variant = 'circle',
}: Props) {
  const option = getShoppingStoreOption(store);
  if (!option) return null;

  return (
    <span
      className={cn(
        variant === 'badge'
          ? 'inline-flex h-5 min-w-8 shrink-0 items-center justify-center rounded-md border border-border/60 bg-muted/70 px-1'
          : 'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border/60 bg-muted/70 text-[9px] font-semibold uppercase tracking-wide',
        option.brandClassName,
        className,
      )}
      title={showLabel ? option.label : undefined}
      aria-label={option.label}
    >
      {option.logoPath ? (
        <Image
          src={option.logoPath}
          alt={option.label}
          width={variant === 'badge' ? 40 : 16}
          height={variant === 'badge' ? 16 : 16}
          className={cn(
            variant === 'badge'
              ? 'h-3.5 w-auto max-w-10 object-contain'
              : 'h-4 w-4 rounded-sm object-contain',
            iconClassName,
          )}
          unoptimized
        />
      ) : (
        <span className={cn('leading-none', iconClassName)}>
          {option.shortLabel}
        </span>
      )}
    </span>
  );
}
