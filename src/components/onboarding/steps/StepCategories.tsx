'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { motion } from 'framer-motion';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useOnboarding } from '@/components/onboarding/OnboardingContext';
import { cn } from '@/lib/utils';

export default function StepCategories() {
  const { setCanProceed, categories, setCategories } = useOnboarding();
  const [editingId, setEditingId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setCanProceed(categories.length >= 2);
  }, [categories.length, setCanProceed]);

  useEffect(() => {
    if (editingId) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editingId]);

  const handleNameChange = useCallback((id: string, name: string) => {
    setCategories((prev) =>
      prev.map((c) => (c.id === id ? { ...c, name: name.trim() || c.name } : c)),
    );
  }, []);

  const handleStartEdit = useCallback((id: string) => {
    setEditingId(id);
  }, []);

  const handleCommitEdit = useCallback(
    (id: string, value: string) => {
      const trimmed = value.trim();
      if (trimmed) {
        handleNameChange(id, trimmed);
      }
      setEditingId(null);
    },
    [handleNameChange],
  );

  const handleKeyDown = useCallback(
    (id: string, e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        handleCommitEdit(id, e.currentTarget.value);
      }
    },
    [handleCommitEdit],
  );

  const handleCategoryNameFocus = useCallback(
    (id: string, currentName: string) => {
      if (currentName === 'Nueva categoría') {
        setCategories((prev) =>
          prev.map((c) => (c.id === id ? { ...c, name: '' } : c)),
        );
      }
    },
    [],
  );

  const handleAdd = useCallback(() => {
    const newCategory = {
      id: crypto.randomUUID(),
      name: 'Nueva categoría',
    };
    setCategories((prev) => [...prev, newCategory]);
    setEditingId(newCategory.id);
  }, []);

  const handleRemove = useCallback((id: string) => {
    if (categories.length <= 1) return;
    setCategories((prev) => prev.filter((c) => c.id !== id));
    if (editingId === id) setEditingId(null);
  }, [categories.length, editingId]);

  const canDelete = categories.length > 1;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h3 className="text-foreground text-lg font-semibold">
          ¿En qué gastas dinero?
        </h3>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Las categorías te ayudan a organizar tus gastos y entender en qué se
          va tu dinero. Por ejemplo: comida, transporte, vivienda, entretenimiento.
        </p>
      </div>

      <ul
        className="flex flex-wrap gap-2"
        role="list"
        aria-label="Categorías de gastos"
      >
        {categories.map((category) => (
          <motion.li
            key={category.id}
            className={cn(
              'flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors',
              'hover:bg-muted/40',
            )}
            role="listitem"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            {editingId === category.id ? (
              <Input
                ref={inputRef}
                type="text"
                value={category.name}
                onChange={(e) =>
                  setCategories((prev) =>
                    prev.map((c) =>
                      c.id === category.id ? { ...c, name: e.target.value } : c,
                    ),
                  )}
                onFocus={() => handleCategoryNameFocus(category.id, category.name)}
                onBlur={() => handleCommitEdit(category.id, category.name)}
                onKeyDown={(e) => handleKeyDown(category.id, e)}
                className="h-7 min-w-[7rem] max-w-[12rem] border-0 bg-transparent px-0 py-0 text-sm shadow-none focus-visible:ring-0"
                aria-label="Editar nombre de categoría"
              />
            ) : (
              <button
                type="button"
                onClick={() => handleStartEdit(category.id)}
                className="min-w-0 truncate text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded"
                aria-label={`Editar categoría: ${category.name}`}
              >
                {category.name}
              </button>
            )}
            <button
              type="button"
              onClick={() => handleRemove(category.id)}
              disabled={!canDelete}
              className="text-muted-foreground hover:text-foreground rounded p-0.5 outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
              aria-label={`Eliminar categoría ${category.name}`}
            >
              <X className="size-3.5" strokeWidth={2} />
            </button>
          </motion.li>
        ))}
      </ul>

      <Button
        type="button"
        variant="outline"
        onClick={handleAdd}
        className="w-full"
        aria-label="Agregar categoría"
      >
        + Agregar categoría
      </Button>
    </div>
  );
}
