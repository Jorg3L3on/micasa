'use client';

import { AppErrorScreen } from '@/components/app-error-screen';

export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <AppErrorScreen error={error} reset={reset} />;
}
