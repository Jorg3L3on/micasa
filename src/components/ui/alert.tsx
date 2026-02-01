import * as React from 'react';

import { cn } from '@/lib/utils';

const alertVariants = {
  default: 'border-border bg-card text-card-foreground',
  destructive:
    'border-destructive/50 bg-destructive/10 text-destructive dark:bg-destructive/20 dark:border-destructive [&>svg]:text-destructive',
  success:
    'border-chart-4/50 bg-chart-4/10 text-chart-4 dark:bg-chart-4/20 [&>svg]:text-chart-4',
  warning:
    'border-amber-500/50 bg-amber-500/10 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400 [&>svg]:text-amber-600',
};

const Alert = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    variant?: keyof typeof alertVariants;
  }
>(({ className, variant = 'default', ...props }, ref) => (
  <div
    ref={ref}
    role="alert"
    className={cn(
      'relative flex w-full gap-3 rounded-lg border p-4 [&>svg]:shrink-0',
      alertVariants[variant],
      className
    )}
    {...props}
  />
));
Alert.displayName = 'Alert';

const AlertTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h5
    ref={ref}
    className={cn('mb-1 font-medium leading-none tracking-tight', className)}
    {...props}
  />
));
AlertTitle.displayName = 'AlertTitle';

const AlertDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('text-sm [&_p]:leading-relaxed', className)}
    {...props}
  />
));
AlertDescription.displayName = 'AlertDescription';

export { Alert, AlertTitle, AlertDescription, alertVariants };
