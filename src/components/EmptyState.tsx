import { Inbox } from 'lucide-react';

type EmptyStateProps = {
  message: string;
};

const EmptyState = ({ message }: EmptyStateProps) => {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12">
      <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted/60">
        <Inbox className="h-6 w-6 text-muted-foreground/60" />
      </span>
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
};

export default EmptyState;
