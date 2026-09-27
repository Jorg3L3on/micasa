'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ResponsiveOverlay } from '@/components/overlay/responsive-overlay';
import { OVERLAY_PRIMARY_BUTTON_CLASS } from '@/components/overlay/overlay-form';
import { clientFetchFromApi } from '@/lib/api/client-fetch';

export type CreatedHouse = { id: number; name: string };

type CreateHouseDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (house: CreatedHouse) => void;
};

export function CreateHouseDialog({
  open,
  onOpenChange,
  onCreated,
}: CreateHouseDialogProps) {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName('');
      setError(null);
    }
  }, [open]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = name.trim();
      if (!trimmed) {
        setError('El nombre es requerido');
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const house = await clientFetchFromApi<CreatedHouse>('/api/houses', {
          method: 'POST',
          body: JSON.stringify({ name: trimmed }),
        });
        onOpenChange(false);
        onCreated?.(house);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al crear la casa');
      } finally {
        setLoading(false);
      }
    },
    [name, onOpenChange, onCreated]
  );

  return (
    <ResponsiveOverlay
      open={open}
      onOpenChange={onOpenChange}
      title="Crear casa"
      description="Crea un hogar compartido para planear gastos con otras personas."
      busy={loading}
    >
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <div className="grid gap-2">
          <Label htmlFor="create-house-name">Nombre</Label>
          <Input
            id="create-house-name"
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nombre de la casa"
            disabled={loading}
            required
            minLength={1}
            maxLength={100}
            aria-invalid={!!error}
            aria-describedby={error ? 'create-house-name-error' : undefined}
          />
        </div>
        {error && (
          <p
            id="create-house-name-error"
            className="text-destructive text-sm"
            role="alert"
          >
            {error}
          </p>
        )}
        <Button
          type="submit"
          disabled={loading}
          aria-busy={loading}
          className={OVERLAY_PRIMARY_BUTTON_CLASS}
        >
          {loading ? 'Creando…' : 'Crear'}
        </Button>
      </form>
    </ResponsiveOverlay>
  );
}
