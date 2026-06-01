'use client';

import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  listCategoryIconOptions,
  type CategoryIconKey,
} from '@/lib/category-icons';
import { CategoryIcon } from '@/components/categories/CategoryIcon';

type CategoryIconPickerProps = {
  value?: string;
  onChange: (value: string) => void;
  className?: string;
};

export const CategoryIconPicker = ({
  value = '',
  onChange,
  className,
}: CategoryIconPickerProps) => {
  const [query, setQuery] = useState('');
  const options = listCategoryIconOptions();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (option) =>
        option.label.toLowerCase().includes(q) ||
        option.key.toLowerCase().includes(q) ||
        option.keywords.some((keyword) => keyword.includes(q)),
    );
  }, [options, query]);

  const handleSelect = (key: CategoryIconKey) => {
    onChange(key);
  };

  return (
    <div className={cn('space-y-2', className)}>
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar ícono…"
          className="h-8 pl-8 text-sm"
          aria-label="Buscar ícono de categoría"
        />
      </div>
      <div
        role="listbox"
        aria-label="Íconos de categoría"
        className="grid max-h-40 grid-cols-6 gap-1.5 overflow-y-auto rounded-md border border-border/60 p-2 sm:grid-cols-8"
      >
        <button
          type="button"
          role="option"
          aria-selected={!value}
          aria-label="Sin ícono"
          onClick={() => onChange('')}
          className={cn(
            'flex h-9 w-full items-center justify-center rounded-md border text-xs text-muted-foreground transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            !value && 'border-primary bg-primary/5 text-foreground',
          )}
        >
          —
        </button>
        {filtered.map((option) => {
          const selected = value === option.key;
          return (
            <button
              key={option.key}
              type="button"
              role="option"
              aria-selected={selected}
              aria-label={option.label}
              title={option.label}
              onClick={() => handleSelect(option.key)}
              className={cn(
                'flex h-9 w-full items-center justify-center rounded-md border border-transparent transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                selected && 'border-primary bg-primary/5',
              )}
            >
              <CategoryIcon icon={option.key} iconClassName="h-4 w-4" />
            </button>
          );
        })}
      </div>
      {filtered.length === 0 ? (
        <p className="text-xs text-muted-foreground">No hay íconos para esa búsqueda.</p>
      ) : null}
    </div>
  );
};
