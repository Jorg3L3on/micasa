import type { ComponentProps } from 'react';
import Link from 'next/link';
import { Inbox, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type EmptyStateProps = {
  message: string;
  description?: string;
  icon?: LucideIcon;
  className?: string;
  /**
   * From `lg`, leave the action out of the centering, so this state lines up
   * with a sibling tab's empty state that has no action.
   */
  hangAction?: boolean;
  action?: {
    label: string;
    onClick?: () => void;
    href?: string;
    variant?: ComponentProps<typeof Button>['variant'];
  };
};

const EmptyState = ({
  message,
  description,
  icon: Icon = Inbox,
  className,
  hangAction = false,
  action,
}: EmptyStateProps) => {
  const body = (
    <>
      <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted/60">
        <Icon className="h-6 w-6 text-muted-foreground/60" data-icon="inline-start" />
      </span>
      <p className="text-center text-sm font-medium text-foreground">{message}</p>
      {description ? (
        <p className="max-w-sm text-center text-body text-muted-foreground">{description}</p>
      ) : null}
    </>
  );

  const actionButton = action?.href ? (
    <Button
      type="button"
      variant={action.variant ?? 'default'}
      size="sm"
      className="mt-1"
      asChild
    >
      <Link href={action.href}>{action.label}</Link>
    </Button>
  ) : action ? (
    <Button
      type="button"
      variant={action.variant ?? 'default'}
      size="sm"
      className="mt-1"
      onClick={action.onClick}
    >
      {action.label}
    </Button>
  ) : null;

  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 px-4 py-12', className)}>
      {hangAction ? (
        <div className="relative flex flex-col items-center gap-3">
          {body}
          {actionButton ? (
            <div className="lg:absolute lg:left-1/2 lg:top-full lg:mt-3 lg:-translate-x-1/2">
              {actionButton}
            </div>
          ) : null}
        </div>
      ) : (
        <>
          {body}
          {actionButton}
        </>
      )}
    </div>
  );
};

export default EmptyState;
