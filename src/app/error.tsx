'use client';

import { AppErrorScreen } from '@/components/app-error-screen';

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="dark min-h-screen bg-background px-4 text-foreground">
      <AppErrorScreen error={error} reset={reset} />
    </div>
  );
}
