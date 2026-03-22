import type { ComponentProps } from 'react';
import { Inbox } from 'lucide-react';
import { Button } from '@/components/ui/button';

type EmptyStateProps = {
  message: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
    variant?: ComponentProps<typeof Button>['variant'];
  };
};

const EmptyState = ({ message, description, action }: EmptyStateProps) => {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 px-4">
      <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted/60">
        <Inbox className="h-6 w-6 text-muted-foreground/60" />
      </span>
      <p className="text-center text-sm font-medium text-foreground">{message}</p>
      {description ? (
        <p className="text-center text-xs text-muted-foreground max-w-sm">
          {description}
        </p>
      ) : null}
      {action ? (
        <Button
          type="button"
          variant={action.variant ?? 'default'}
          size="sm"
          className="mt-1"
          onClick={action.onClick}
        >
          {action.label}
        </Button>
      ) : null}
    </div>
  );
};

export default EmptyState;
