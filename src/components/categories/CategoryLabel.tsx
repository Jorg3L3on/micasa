import { cn } from '@/lib/utils';

type CategoryLabelProps = {
  name: string | null | undefined;
  icon?: string | null;
  className?: string;
  iconClassName?: string;
  empty?: string | null;
};

export function formatCategoryLabel(
  name: string | null | undefined,
  icon?: string | null,
  empty = '',
) {
  if (!name) return empty;
  return icon ? `${icon} ${name}` : name;
}

export function CategoryLabel({
  name,
  icon,
  className,
  iconClassName,
  empty = null,
}: CategoryLabelProps) {
  if (!name) return empty;

  return (
    <span className={cn('inline-flex min-w-0 items-center gap-1.5', className)}>
      {icon ? (
        <span className={cn('shrink-0 leading-none', iconClassName)} aria-hidden>
          {icon}
        </span>
      ) : null}
      <span className="truncate">{name}</span>
    </span>
  );
}
