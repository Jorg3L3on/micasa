'use client';

import { Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { cn, formatCurrency } from '@/lib/utils';
import type { PantryShoppingCartItemDto } from '@/types/pantry-shopping-cart';

type Props = {
  item: PantryShoppingCartItemDto;
  onToggleChecked: (checked: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
  disabled?: boolean;
};

const formatQty = (n: number): string => {
  if (Number.isInteger(n)) return String(n);
  return n.toLocaleString('es-MX', { maximumFractionDigits: 3 });
};

export function PantryShoppingItemRow({
  item,
  onToggleChecked,
  onEdit,
  onDelete,
  disabled,
}: Props) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-xl border border-border/60 bg-card px-3 py-3 transition-opacity',
        item.checked && 'opacity-60',
      )}
    >
      <Checkbox
        checked={item.checked}
        onCheckedChange={(v) => onToggleChecked(Boolean(v))}
        disabled={disabled}
        aria-label={item.checked ? 'Desmarcar' : 'Marcar como comprado'}
        className="h-5 w-5"
      />
      <button
        type="button"
        className="min-w-0 flex-1 text-left"
        onClick={onEdit}
      >
        <div
          className={cn(
            'truncate text-sm font-medium leading-tight',
            item.checked && 'line-through',
          )}
        >
          {item.name}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
          <span className="font-mono tabular-nums">
            {formatQty(item.quantity)}
            {item.unit_label ? ` ${item.unit_label}` : ''}
            {item.unit_price != null
              ? ` · ${formatCurrency(item.unit_price)}`
              : ''}
          </span>
          {item.notes ? (
            <span className="line-clamp-1">· {item.notes}</span>
          ) : null}
        </div>
      </button>
      <div className="flex flex-col items-end gap-1">
        <span className="font-mono text-sm font-semibold tabular-nums">
          {item.line_total > 0 ? formatCurrency(item.line_total) : '—'}
        </span>
        <div className="flex gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onEdit}
            disabled={disabled}
            aria-label="Editar ítem"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive"
            onClick={onDelete}
            disabled={disabled}
            aria-label="Eliminar ítem"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
