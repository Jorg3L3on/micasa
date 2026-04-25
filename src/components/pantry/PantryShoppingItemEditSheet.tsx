'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import type { PantryShoppingCartItemDto } from '@/types/pantry-shopping-cart';

export type EditItemInput = {
  name: string;
  quantity: number;
  unit_label: string | null;
  unit_price: number | null;
  notes: string | null;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: PantryShoppingCartItemDto | null;
  onSubmit: (input: EditItemInput) => Promise<void>;
};

const toMoneyInput = (n: number | null): string =>
  n == null ? '' : n.toString();

export function PantryShoppingItemEditSheet({
  open,
  onOpenChange,
  item,
  onSubmit,
}: Props) {
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unitLabel, setUnitLabel] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && item) {
      setName(item.name);
      setQuantity(String(item.quantity));
      setUnitLabel(item.unit_label ?? '');
      setUnitPrice(toMoneyInput(item.unit_price));
      setNotes(item.notes ?? '');
      setError(null);
    }
  }, [open, item]);

  const handleSubmit = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('El nombre es obligatorio');
      return;
    }
    const qty = Number(quantity.replace(',', '.'));
    if (!Number.isFinite(qty) || qty <= 0) {
      setError('Cantidad inválida');
      return;
    }
    let price: number | null = null;
    const priceRaw = unitPrice.trim().replace(',', '.');
    if (priceRaw.length > 0) {
      const parsed = Number(priceRaw);
      if (!Number.isFinite(parsed) || parsed < 0) {
        setError('Precio inválido');
        return;
      }
      price = Math.round(parsed * 100) / 100;
    }

    try {
      setSaving(true);
      setError(null);
      await onSubmit({
        name: trimmedName,
        quantity: qty,
        unit_label: unitLabel.trim() || null,
        unit_price: price,
        notes: notes.trim() || null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-auto max-h-[90vh] rounded-t-2xl">
        <SheetHeader>
          <SheetTitle>Editar ítem</SheetTitle>
        </SheetHeader>
        <div className="flex flex-col gap-3 px-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-item-name">Nombre</Label>
            <Input
              id="edit-item-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-11 text-base"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-item-qty">Cantidad</Label>
              <Input
                id="edit-item-qty"
                inputMode="decimal"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="h-11 text-base"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-item-unit">Unidad</Label>
              <Input
                id="edit-item-unit"
                value={unitLabel}
                onChange={(e) => setUnitLabel(e.target.value)}
                placeholder="pz, kg, L…"
                className="h-11 text-base"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-item-price">Precio unitario</Label>
            <Input
              id="edit-item-price"
              inputMode="decimal"
              value={unitPrice}
              onChange={(e) => setUnitPrice(e.target.value)}
              placeholder="0.00"
              className="h-11 text-base"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-item-notes">Notas</Label>
            <Input
              id="edit-item-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="h-11 text-base"
            />
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
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              'Guardar'
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
