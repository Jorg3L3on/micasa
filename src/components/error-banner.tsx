import { AlertCircle } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type ErrorBannerProps = {
  children: ReactNode;
  className?: string;
};

/** The only inline error. Overlays, pages, and banners all use this. */
export const ErrorBanner = ({ children, className }: ErrorBannerProps) => (
  <div
    role="alert"
    className={cn(
      'flex items-start gap-2 rounded-lg border border-status-overdue-border bg-status-overdue-soft px-3 py-2.5 text-sm text-status-overdue',
      className,
    )}
  >
    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
    <div className="min-w-0 flex-1">{children}</div>
  </div>
);
