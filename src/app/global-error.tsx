'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

type GlobalErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="es-MX">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif',
          background: '#0d0d0d',
          color: '#f5f5f5',
          padding: 24,
        }}
      >
        <div style={{ maxWidth: 420, textAlign: 'center' }}>
          <h1 style={{ fontSize: 22, marginBottom: 8 }}>Algo salió mal</h1>
          <p style={{ opacity: 0.7, fontSize: 14, lineHeight: 1.5 }}>
            Ocurrió un error inesperado. Puedes intentar de nuevo; si continúa,
            reporta el problema.
          </p>
          {error.digest ? (
            <p
              style={{
                marginTop: 12,
                fontSize: 12,
                opacity: 0.45,
                fontFamily: 'ui-monospace, monospace',
              }}
            >
              Ref: {error.digest}
            </p>
          ) : null}
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: 20,
              border: 0,
              borderRadius: 8,
              padding: '10px 16px',
              background: 'linear-gradient(90deg, #2563eb, #9333ea)',
              color: '#fff',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Reintentar
          </button>
        </div>
      </body>
    </html>
  );
}
