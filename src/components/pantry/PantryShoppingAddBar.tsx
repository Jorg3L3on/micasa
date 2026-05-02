'use client';

import { useState } from 'react';
import { Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  PantryProductCombobox,
  type ProductPickValue,
} from '@/components/pantry/PantryProductCombobox';
import { useFinanceContext } from '@/context/finance-context';
import { addShoppingCartItem, createPantryProduct } from '@/lib/api/pantry';
import type { PantryProductDto } from '@/types/pantry-product';
import type { PantryShoppingCartItemDto } from '@/types/pantry-shopping-cart';

type Props = {
  cartId: number;
  products: PantryProductDto[];
  productsLoading?: boolean;
  onItemAdded: (item: PantryShoppingCartItemDto) => void;
  onProductCreated: (product: PantryProductDto) => void;
  disabled?: boolean;
};

export function PantryShoppingAddBar({
  cartId,
  products,
  productsLoading,
  onItemAdded,
  onProductCreated,
  disabled,
}: Props) {
  const { context } = useFinanceContext();
  const [pick, setPick] = useState<ProductPickValue>({ product: null, text: '' });
  const [quantity, setQuantity] = useState('1');
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setPick({ product: null, text: '' });
    setQuantity('1');
  };

  const handleAdd = async () => {
    const trimmed = pick.text.trim();
    if (!pick.product && trimmed.length === 0) {
      toast.error('Escribe un nombre o elige un producto');
      return;
    }
    const qty = Number(quantity.replace(',', '.'));
    if (!Number.isFinite(qty) || qty <= 0) {
      toast.error('Cantidad inválida');
      return;
    }

    try {
      setSaving(true);
      const item = await addShoppingCartItem(
        cartId,
        {
          product_id: pick.product?.id ?? null,
          name: pick.product ? pick.product.name : trimmed,
          quantity: qty,
        },
        context,
      );
      onItemAdded(item);
      reset();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo agregar');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateProduct = async (name: string) => {
    try {
      const created = await createPantryProduct(
        { name, active: true },
        context,
      );
      onProductCreated(created);
      setPick({ product: created, text: created.name });
      toast.success('Producto creado');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo crear');
    }
  };

  return (
    <div className="sticky top-0 z-20 -mx-4 border-b border-border/60 bg-background/95 px-4 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="flex gap-2">
        <div className="min-w-0 flex-1">
          <PantryProductCombobox
            products={products}
            loading={productsLoading}
            value={pick}
            onChange={setPick}
            onCreateProduct={handleCreateProduct}
            placeholder="Agregar producto…"
          />
        </div>
        <Input
          type="text"
          inputMode="decimal"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          aria-label="Cantidad"
          className="h-11 w-16 text-center text-base"
        />
        <Button
          type="button"
          size="icon"
          className="h-11 w-11 shrink-0 rounded-xl"
          onClick={handleAdd}
          disabled={disabled || saving}
          aria-label="Agregar al carrito"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-5 w-5" />
          )}
        </Button>
      </div>
    </div>
  );
}
