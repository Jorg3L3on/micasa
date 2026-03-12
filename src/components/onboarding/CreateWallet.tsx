'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function CreateWallet() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryString = searchParams.toString();

  const handleCreateWallet = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/onboarding', { method: 'POST' });
      if (res.ok) {
        router.push(`/dashboard${queryString ? `?${queryString}` : ''}`);
        return;
      }
      alert('No se pudo crear la billetera');
    } catch {
      alert('No se pudo crear la billetera');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6 rounded-lg border bg-card p-8 shadow-sm">
        <h1 className="text-center text-2xl font-semibold">
          Bienvenido a MiCasa
        </h1>
        <p className="text-center text-muted-foreground">
          Antes de empezar a registrar gastos, necesitamos crear tu primera
          billetera.
        </p>
        <button
          type="button"
          onClick={handleCreateWallet}
          disabled={loading}
          className="w-full rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          aria-label="Crear mi primera billetera"
        >
          {loading ? 'Creando…' : 'Crear mi primera billetera'}
        </button>
      </div>
    </div>
  );
}
