'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center gap-4 py-12">
        <p className="text-muted-foreground text-center">
          Algo salió mal. Por favor, inténtalo de nuevo.
        </p>
        <Button onClick={reset} variant="outline">
          Reintentar
        </Button>
      </CardContent>
    </Card>
  );
}
