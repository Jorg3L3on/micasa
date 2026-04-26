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
};

export function ShoppingStoreIcon({
  store,
  className,
  iconClassName,
  showLabel = true,
}: Props) {
  const option = getShoppingStoreOption(store);
  if (!option) return null;

  return (
    <span
      className={cn(
        'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border/60 bg-muted/70 text-[9px] font-semibold uppercase tracking-wide',
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
          width={14}
          height={14}
          className={cn('h-3.5 w-3.5 rounded-sm object-contain', iconClassName)}
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
