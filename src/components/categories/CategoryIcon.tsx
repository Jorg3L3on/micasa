'use client';

import { getCategoryIconOption } from '@/lib/category-icons';
import { cn } from '@/lib/utils';

type CategoryIconProps = {
  icon?: string | null;
  className?: string;
  iconClassName?: string;
};

export const CategoryIcon = ({
  icon,
  className,
  iconClassName,
}: CategoryIconProps) => {
  const option = getCategoryIconOption(icon);
  if (!option) {
    if (!icon?.trim()) return null;
    return (
      <span
        className={cn('shrink-0 leading-none', className, iconClassName)}
        aria-hidden
      >
        {icon}
      </span>
    );
  }

  const LucideIcon = option.Icon;
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center text-muted-foreground',
        className,
      )}
      aria-hidden
    >
      <LucideIcon className={cn('h-3.5 w-3.5', iconClassName)} strokeWidth={2} />
    </span>
  );
};
