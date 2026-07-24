'use client';

import * as Sentry from '@sentry/nextjs';
import NextError from 'next/error';
import { useEffect } from 'react';

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="es">
      <body>
        {/*
          App Router doesn't expose HTTP status codes for errors,
          so pass 0 to render a generic error message.
        */}
        <NextError statusCode={0} />
      </body>
    </html>
  );
}
