'use client';

import { useCallback, type ReactNode } from 'react';
import { toast } from 'sonner';
import { PullToRefresh } from '@/components/motion/pull-to-refresh';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

const DEFAULT_ERROR_MESSAGE =
  'No se pudo actualizar. Revisa tu conexión e intenta de nuevo.';

/** Runs a refresh; on failure reports it and resolves `false` so previous data stays on screen. */
export const runPullRefresh = async (
  refresh: () => Promise<void>,
  onError: (error: unknown) => void,
): Promise<boolean> => {
  try {
    await refresh();
    return true;
  } catch (error) {
    onError(error);
    return false;
  }
};

export type MobilePullToRefreshProps = {
  /** Reloads the screen's data in place. Throw to show the error toast. */
  onRefresh: () => Promise<void>;
  ariaLabel: string;
  errorMessage?: string;
  className?: string;
  children: ReactNode;
};

/** Collection pull to refresh: phones only, same gesture and labels as Panel financiero. */
export const MobilePullToRefresh = ({
  onRefresh,
  ariaLabel,
  errorMessage = DEFAULT_ERROR_MESSAGE,
  className,
  children,
}: MobilePullToRefreshProps) => {
  const isMobile = useIsMobile();

  const handleRefresh = useCallback(async () => {
    await runPullRefresh(onRefresh, (error) => {
      console.error(`Error refreshing ${ariaLabel}:`, error);
      toast.error(errorMessage);
    });
  }, [ariaLabel, errorMessage, onRefresh]);

  return (
    <PullToRefresh
      onRefresh={handleRefresh}
      disabled={!isMobile}
      ariaLabel={ariaLabel}
      className={cn('bg-transparent', !isMobile && 'cursor-auto', className)}
      contentClassName="bg-transparent"
    >
      {children}
    </PullToRefresh>
  );
};
