'use client';

import { Pencil, Power, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { SwipeDeleteRow } from '@/components/ui/swipe-delete-row';
import { CategoryLabel } from '@/components/categories/CategoryLabel';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { CategoryOption } from '@/types/catalog';

type CategoryTreeRowProps = {
  category: CategoryOption;
  isChild: boolean;
  swipeEnabled: boolean;
  isSwipeOpen: boolean;
  onSwipeOpenChange: (open: boolean) => void;
  onEdit: () => void;
  onToggleActive: () => void;
  onRequestDelete: () => void;
};

export function CategoryTreeRow({
  category,
  isChild,
  swipeEnabled,
  isSwipeOpen,
  onSwipeOpenChange,
  onEdit,
  onToggleActive,
  onRequestDelete,
}: CategoryTreeRowProps) {
  const active = category.active ?? true;

  const row = (
    <div
      className={cn(
        'flex items-center justify-between gap-2 rounded-lg bg-card px-2.5 py-2 transition-colors',
        'hover:bg-accent/60',
        !active && 'text-muted-foreground',
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <CategoryLabel
            name={category.name}
            icon={category.icon}
            className={cn(
              'min-w-0 font-medium',
              isChild && 'text-muted-foreground',
            )}
            iconClassName={isChild ? 'h-3 w-3' : undefined}
          />
          {!active ? (
            <Badge
              variant="outline"
              className="shrink-0 px-1.5 py-0 text-caption font-semibold uppercase tracking-wider"
            >
              Inactiva
            </Badge>
          ) : null}
        </div>
        {category.description ? (
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {category.description}
          </p>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-0.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onToggleActive}
              aria-label={
                active
                  ? `Desactivar ${category.name}`
                  : `Activar ${category.name}`
              }
            >
              <Power
                className={cn(
                  'h-4 w-4',
                  active ? 'text-muted-foreground' : 'text-emerald-600',
                )}
                data-icon="inline-start"
              />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">
            {active ? 'Desactivar' : 'Activar'}
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onEdit}
              aria-label={`Editar ${category.name}`}
            >
              <Pencil className="h-4 w-4" data-icon="inline-start" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">Editar</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="hidden h-8 w-8 md:inline-flex"
              onClick={onRequestDelete}
              aria-label={`Eliminar ${category.name}`}
            >
              <Trash2
                className="h-4 w-4 text-destructive"
                data-icon="inline-start"
              />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">Eliminar</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );

  return (
    <SwipeDeleteRow
      enabled={swipeEnabled}
      isOpen={isSwipeOpen}
      onOpenChange={onSwipeOpenChange}
      onRequestDelete={onRequestDelete}
      deleteAriaLabel={`Eliminar ${category.name}`}
      className="rounded-lg"
    >
      {row}
    </SwipeDeleteRow>
  );
}
