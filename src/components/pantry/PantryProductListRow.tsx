'use client';

import type { KeyboardEvent } from 'react';
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn, formatCurrency } from '@/lib/utils';
import type { PantryProductDto } from '@/types/pantry-product';

export type PantryProductListRowProps = {
  product: PantryProductDto;
  onOpenEdit: () => void;
  onOpenDelete: () => void;
};

export const PantryProductListRow = ({
  product,
  onOpenEdit,
  onOpenDelete,
}: PantryProductListRowProps) => {
  const handleMainKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onOpenEdit();
    }
  };

  const metaParts = [
    product.brand?.trim() ? product.brand : null,
    product.unit_label?.trim() ? product.unit_label : null,
    product.default_unit_price != null
      ? formatCurrency(product.default_unit_price)
      : null,
  ].filter(Boolean);

  return (
    <li className="list-none">
      <div
        className={cn(
          'flex gap-2 rounded-xl border border-border/60 bg-card p-3 shadow-sm transition-colors',
          'hover:bg-muted/40',
        )}
      >
        <button
          type="button"
          className="min-w-0 flex-1 rounded-lg px-1 py-0.5 text-left outline-none transition-colors hover:bg-muted/30 focus-visible:ring-2 focus-visible:ring-ring"
          onClick={onOpenEdit}
          onKeyDown={handleMainKeyDown}
          aria-label={`Editar producto ${product.name}`}
        >
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium leading-tight">
                {product.name}
              </span>
              {product.active ? (
                <Badge variant="secondary" className="text-[10px] font-medium">
                  Activo
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="text-[10px] text-muted-foreground"
                >
                  Inactivo
                </Badge>
              )}
            </div>
            {product.description ? (
              <span className="line-clamp-2 text-[10px] text-muted-foreground">
                {product.description}
              </span>
            ) : null}
            {metaParts.length > 0 ? (
              <span className="text-[11px] text-muted-foreground">
                {metaParts.join(' · ')}
              </span>
            ) : (
              <span className="text-[11px] text-muted-foreground">—</span>
            )}
          </div>
        </button>

        <div
          className="flex shrink-0 items-start pt-0.5"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0"
                aria-label={`Más opciones para ${product.name}`}
              >
                <MoreHorizontal className="h-4 w-4" aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onOpenEdit}>
                <Pencil className="h-4 w-4" />
                Editar
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={onOpenDelete}
              >
                <Trash2 className="h-4 w-4" />
                Eliminar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </li>
  );
};
