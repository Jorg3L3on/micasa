'use client';

import { useEffect, useRef, type MouseEvent } from 'react';
import { motion, useAnimation, type PanInfo } from 'framer-motion';
import { Pencil, Power, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  SwipeDeleteAction,
  SWIPE_DELETE_ACTION_WIDTH,
} from '@/components/ui/swipe-delete-action';
import { CategoryLabel } from '@/components/categories/CategoryLabel';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { CategoryOption } from '@/types/catalog';

const ACTION_WIDTH = SWIPE_DELETE_ACTION_WIDTH;
const OPEN_THRESHOLD = 40;
const DRAG_CLICK_SUPPRESS_MS = 450;
const DRAG_MOVE_THRESHOLD_PX = 10;

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
  const controls = useAnimation();
  const prevIsOpen = useRef(isSwipeOpen);
  const suppressNextClickRef = useRef(false);

  useEffect(() => {
    if (!swipeEnabled) {
      void controls.set({ x: 0 });
      return;
    }
    if (prevIsOpen.current === isSwipeOpen) return;
    prevIsOpen.current = isSwipeOpen;
    void controls.start({
      x: isSwipeOpen ? -ACTION_WIDTH : 0,
      transition: { type: 'spring', stiffness: 400, damping: 35 },
    });
  }, [isSwipeOpen, swipeEnabled, controls]);

  const handleDragEnd = (_event: unknown, info: PanInfo) => {
    if (!swipeEnabled) return;
    const offsetX = info.offset.x;
    const vx = info.velocity.x;
    const draggedHorizontally =
      Math.abs(offsetX) > DRAG_MOVE_THRESHOLD_PX || Math.abs(vx) > 80;
    if (draggedHorizontally) {
      suppressNextClickRef.current = true;
      window.setTimeout(() => {
        suppressNextClickRef.current = false;
      }, DRAG_CLICK_SUPPRESS_MS);
    }
    const shouldOpen = offsetX < -OPEN_THRESHOLD || vx < -500;
    if (shouldOpen) {
      void controls.start({
        x: -ACTION_WIDTH,
        transition: { type: 'spring', stiffness: 400, damping: 35 },
      });
      onSwipeOpenChange(true);
    } else {
      void controls.start({
        x: 0,
        transition: { type: 'spring', stiffness: 400, damping: 35 },
      });
      onSwipeOpenChange(false);
    }
  };

  const handleDeleteClick = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    onRequestDelete();
  };

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
              className="shrink-0 px-1.5 py-0 text-[10px] font-semibold uppercase tracking-wider"
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

  if (!swipeEnabled) {
    return row;
  }

  return (
    <div className="relative overflow-hidden rounded-lg">
      <div
        className="absolute inset-0 z-0 flex justify-end"
        aria-hidden={!isSwipeOpen}
      >
        <SwipeDeleteAction
          onClick={handleDeleteClick}
          ariaLabel={`Eliminar ${category.name}`}
        />
      </div>
      <motion.div
        className="relative z-[1]"
        drag="x"
        dragConstraints={{ left: -ACTION_WIDTH, right: 0 }}
        dragElastic={0.05}
        dragMomentum={false}
        onDragEnd={handleDragEnd}
        animate={controls}
        initial={{ x: 0 }}
        style={{ touchAction: 'pan-y' }}
      >
        {row}
      </motion.div>
    </div>
  );
}
