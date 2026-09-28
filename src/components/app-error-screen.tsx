'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ErrorBanner } from '@/components/error-banner';

type AppErrorScreenProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

/** Orion error for route boundaries. One banner, one retry. */
export const AppErrorScreen = ({ error, reset }: AppErrorScreenProps) => {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col items-stretch gap-4 py-10">
      <ErrorBanner>
        Algo salió mal. Los datos de esta pantalla no se mostraron para evitar una lectura incorrecta.
      </ErrorBanner>
      <Button type="button" onClick={reset} className="h-11 rounded-xl">
        Reintentar
      </Button>
    </div>
  );
};
