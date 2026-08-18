'use client';

import { useMemo } from 'react';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { CategoryOption } from '@/types/catalog';
import { isSelectableInPicker } from '@/lib/finance/category-hierarchy';
import { CategoryLabel } from '@/components/categories/CategoryLabel';
import { cn } from '@/lib/utils';

type CategoryGroupedSelectProps = {
  categories: CategoryOption[];
  value: number | undefined;
  onValueChange: (categoryId: number) => void;
  disabled?: boolean;
  placeholder?: string;
  ariaLabel?: string;
  /** Include the currently selected category even if inactive (edit forms). */
  includeCategoryId?: number | null;
  triggerClassName?: string;
  triggerId?: string;
  onOpenChange?: (open: boolean) => void;
};

function useGroupedCategories(
  categories: CategoryOption[],
  includeCategoryId?: number | null,
) {
  const rows = useMemo(
    () =>
      categories.map((c) => ({
        id: c.id,
        parent_id: c.parentId ?? null,
        active: c.active ?? true,
      })),
    [categories],
  );

  const selectable = useMemo(() => {
    const activeOnes = categories.filter((c) =>
      isSelectableInPicker(
        {
          id: c.id,
          parent_id: c.parentId ?? null,
          active: c.active ?? true,
        },
        rows,
      ),
    );
    if (
      includeCategoryId != null &&
      !activeOnes.some((c) => c.id === includeCategoryId)
    ) {
      const current = categories.find((c) => c.id === includeCategoryId);
      if (current) return [...activeOnes, current];
    }
    return activeOnes;
  }, [categories, rows, includeCategoryId]);

  return useMemo(() => {
    const roots = selectable.filter((c) => c.parentId == null);
    const orphanChildren = selectable.filter(
      (c) =>
        c.parentId != null && !selectable.some((r) => r.id === c.parentId),
    );
    return {
      selectable,
      roots: roots.map((root) => ({
        root,
        children: selectable.filter((c) => c.parentId === root.id),
      })),
      orphanChildren,
    };
  }, [selectable]);
}

/** Hierarchical SelectItems: parent rows are selectable; children indented. */
export function CategorySelectGroups({
  categories,
  includeCategoryId,
  inactiveSelected,
}: {
  categories: CategoryOption[];
  includeCategoryId?: number | null;
  /** When editing an inactive category, show it under a section label. */
  inactiveSelected?: CategoryOption | null;
}) {
  const groups = useGroupedCategories(categories, includeCategoryId);
  const hideInactiveInTree =
    inactiveSelected != null && !(inactiveSelected.active ?? true);
  const inactiveId = hideInactiveInTree ? inactiveSelected.id : null;

  const roots = groups.roots.filter(({ root }) => root.id !== inactiveId);
  const orphanChildren = groups.orphanChildren.filter(
    (c) => c.id !== inactiveId,
  );

  return (
    <>
      {hideInactiveInTree ? (
        <SelectGroup>
          <SelectLabel>Inactiva (actual)</SelectLabel>
          <SelectItem value={String(inactiveSelected.id)}>
            <CategoryLabel
              name={inactiveSelected.name}
              icon={inactiveSelected.icon}
            />
          </SelectItem>
        </SelectGroup>
      ) : null}
      {roots.map(({ root, children }) => (
        <SelectGroup key={root.id}>
          <SelectItem value={String(root.id)} className="font-medium">
            <CategoryLabel name={root.name} icon={root.icon} />
          </SelectItem>
          {children
            .filter((child) => child.id !== inactiveId)
            .map((child) => (
              <SelectItem
                key={child.id}
                value={String(child.id)}
                className={cn(
                  'pl-7 text-muted-foreground data-[highlighted]:text-accent-foreground',
                )}
              >
                <CategoryLabel name={child.name} icon={child.icon} />
              </SelectItem>
            ))}
        </SelectGroup>
      ))}
      {orphanChildren.length > 0 ? (
        <SelectGroup>
          <SelectLabel>Otras</SelectLabel>
          {orphanChildren.map((child) => (
            <SelectItem key={child.id} value={String(child.id)}>
              <CategoryLabel name={child.name} icon={child.icon} />
            </SelectItem>
          ))}
        </SelectGroup>
      ) : null}
    </>
  );
}

export function CategoryGroupedSelect({
  categories,
  value,
  onValueChange,
  disabled,
  placeholder = 'Selecciona una categoría',
  ariaLabel = 'Categoría',
  includeCategoryId,
  triggerClassName,
  triggerId,
  onOpenChange,
}: CategoryGroupedSelectProps) {
  const selected = categories.find((c) => c.id === value);

  return (
    <Select
      value={value && value > 0 ? String(value) : undefined}
      onValueChange={(v) => onValueChange(parseInt(v, 10))}
      onOpenChange={onOpenChange}
      disabled={disabled}
    >
      <SelectTrigger
        id={triggerId}
        className={triggerClassName}
        aria-label={ariaLabel}
      >
        <SelectValue placeholder={placeholder}>
          {selected ? (
            <CategoryLabel name={selected.name} icon={selected.icon} />
          ) : null}
        </SelectValue>
      </SelectTrigger>
      <SelectContent
        position="popper"
        align="start"
        side="bottom"
        avoidCollisions={false}
      >
        <CategorySelectGroups
          categories={categories}
          includeCategoryId={includeCategoryId}
          inactiveSelected={
            includeCategoryId != null && selected && !(selected.active ?? true)
              ? selected
              : null
          }
        />
      </SelectContent>
    </Select>
  );
}
