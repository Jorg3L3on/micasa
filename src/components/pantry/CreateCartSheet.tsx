'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  SHOPPING_STORE_OPTIONS,
  type ShoppingStore,
} from '@/types/shopping-store';

const NO_STORE_VALUE = '__NONE__';

export type CartFormSubmit = {
  title: string;
  notes: string | null;
  store: ShoppingStore | null;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: CartFormSubmit) => Promise<void>;
  initialTitle?: string;
  initialNotes?: string | null;
  initialStore?: ShoppingStore | null;
};

export function CreateCartSheet({
  open,
  onOpenChange,
  onSubmit,
  initialTitle,
  initialNotes,
  initialStore,
}: Props) {
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [store, setStore] = useState<ShoppingStore | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle(initialTitle ?? '');
      setNotes(initialNotes ?? '');
      setStore(initialStore ?? null);
      setError(null);
    }
  }, [open, initialTitle, initialNotes, initialStore]);

  const handleSubmit = async () => {
    const trimmed = title.trim();
    if (!trimmed) {
      setError('El título es obligatorio');
      return;
    }
    try {
      setSaving(true);
      setError(null);
      await onSubmit({
        title: trimmed,
        notes: notes.trim() || null,
        store,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear');
    } finally {
      setSaving(false);
    }
  };

  const handleStoreChange = (value: string) => {
    setStore(value === NO_STORE_VALUE ? null : (value as ShoppingStore));
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-auto max-h-[90vh] rounded-t-2xl">
        <SheetHeader>
          <SheetTitle>Nuevo carrito</SheetTitle>
          <SheetDescription>
            Crea una lista de compras para planear tus pendientes.
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-4 px-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cart-title">Título</Label>
            <Input
              id="cart-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej. Despensa quincenal"
              className="h-11 text-base"
              autoFocus
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cart-notes">Notas (opcional)</Label>
            <Input
              id="cart-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej. Súper del sábado"
              className="h-11 text-base"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cart-store">Tienda (opcional)</Label>
            <Select
              value={store ?? NO_STORE_VALUE}
              onValueChange={handleStoreChange}
            >
              <SelectTrigger
                id="cart-store"
                className="h-11 w-full text-base"
                aria-label="Seleccionar tienda"
              >
                <SelectValue placeholder="Selecciona una tienda" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_STORE_VALUE}>Sin tienda</SelectItem>
                {SHOPPING_STORE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
        </div>
        <SheetFooter>
          <Button
            type="button"
            className="h-11 w-full rounded-xl"
            onClick={handleSubmit}
            disabled={saving}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Guardar'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
