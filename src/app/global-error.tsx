'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

export default function GlobalError({
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
    <html lang="es">
      <body
        style={{
          margin: 0,
          fontFamily:
            'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif',
          background: '#0a0a0a',
          color: '#fafafa',
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1.5rem',
        }}
      >
        <div
          style={{
            maxWidth: '28rem',
            width: '100%',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: '0.75rem',
            padding: '2rem 1.5rem',
            textAlign: 'center',
            background: '#171717',
          }}
        >
          <p style={{ margin: '0 0 1.25rem', color: '#a3a3a3', lineHeight: 1.5 }}>
            Algo salió mal. Por favor, inténtalo de nuevo.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '2.25rem',
              padding: '0 1rem',
              borderRadius: '0.375rem',
              border: '1px solid rgba(255,255,255,0.2)',
              background: 'transparent',
              color: '#fafafa',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: 500,
            }}
          >
            Reintentar
          </button>
        </div>
      </body>
    </html>
  );
}
