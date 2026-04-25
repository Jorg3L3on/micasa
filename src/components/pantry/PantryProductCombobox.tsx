'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Loader2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { PantryProductDto } from '@/types/pantry-product';

export type ProductPickValue = {
  product: PantryProductDto | null;
  /** The raw text when no product is picked (for ad-hoc items). */
  text: string;
};

type Props = {
  products: PantryProductDto[];
  loading?: boolean;
  value: ProductPickValue;
  onChange: (value: ProductPickValue) => void;
  placeholder?: string;
  onCreateProduct?: (name: string) => void;
};

/** Mobile-first combobox over PantryProduct with free-text fallback. */
export function PantryProductCombobox({
  products,
  loading,
  value,
  onChange,
  placeholder = 'Buscar o escribir…',
  onCreateProduct,
}: Props) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const query = value.text.trim().toLowerCase();

  const filtered = useMemo(() => {
    const active = products.filter((p) => p.active);
    if (!query) return active.slice(0, 20);
    return active
      .filter((p) => {
        const haystack = `${p.name} ${p.brand ?? ''} ${p.barcode ?? ''}`.toLowerCase();
        return haystack.includes(query);
      })
      .slice(0, 20);
  }, [products, query]);

  const exactMatch = useMemo(
    () =>
      query.length > 0 &&
      products.some((p) => p.name.trim().toLowerCase() === query),
    [products, query],
  );

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="flex items-center gap-2">
        <Input
          value={value.text}
          onChange={(e) =>
            onChange({ product: null, text: e.target.value })
          }
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className="h-11 text-base"
          autoComplete="off"
          aria-expanded={open}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-11 w-11 shrink-0"
          onClick={() => setOpen((o) => !o)}
          aria-label="Abrir lista de productos"
        >
          <ChevronDown
            className={cn(
              'h-4 w-4 transition-transform',
              open ? 'rotate-180' : '',
            )}
          />
        </Button>
      </div>

      {open ? (
        <div
          role="listbox"
          className="absolute left-0 right-0 z-40 mt-1 max-h-64 overflow-y-auto rounded-lg border border-border/60 bg-popover shadow-lg"
        >
          {loading ? (
            <div className="flex items-center justify-center py-4 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="px-3 py-3 text-sm text-muted-foreground">
              {query.length === 0
                ? 'Sin productos en el catálogo.'
                : 'Sin coincidencias.'}
            </div>
          ) : (
            <ul className="py-1">
              {filtered.map((p) => {
                const selected = value.product?.id === p.id;
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      className={cn(
                        'flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left hover:bg-accent',
                        selected && 'bg-accent/60',
                      )}
                      onClick={() => {
                        onChange({ product: p, text: p.name });
                        setOpen(false);
                      }}
                    >
                      <div className="flex min-w-0 flex-col">
                        <span className="text-sm font-medium leading-tight">
                          {p.name}
                        </span>
                        {(p.brand || p.unit_label) && (
                          <span className="text-xs text-muted-foreground">
                            {[p.brand, p.unit_label].filter(Boolean).join(' · ')}
                          </span>
                        )}
                      </div>
                      {selected ? (
                        <Check className="h-4 w-4 text-primary" />
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {onCreateProduct && query.length > 1 && !exactMatch ? (
            <div className="border-t border-border/60">
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-accent"
                onClick={() => {
                  onCreateProduct(value.text.trim());
                  setOpen(false);
                }}
              >
                <Plus className="h-4 w-4" />
                Crear &ldquo;{value.text.trim()}&rdquo; en el catálogo
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
