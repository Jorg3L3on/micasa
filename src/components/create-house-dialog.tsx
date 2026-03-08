'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { clientFetchFromApi } from '@/lib/api';

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

  const handleCancel = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Crear casa</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="create-house-name">Nombre</Label>
              <Input
                id="create-house-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nombre de la casa"
                disabled={loading}
                aria-label="Nombre de la casa"
                aria-invalid={!!error}
              />
            </div>
            {error && (
              <p className="text-destructive text-sm" role="alert">
                {error}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Creando…' : 'Crear'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
