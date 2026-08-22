'use client';

import { useCallback } from 'react';
import { ListFilter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import {
  useToolbarActions,
  type ToolbarFiltersConfig,
} from '@/context/toolbar-actions-context';
import { TOOLBAR_GLASS_GROUP_ITEM, TOOLBAR_GLASS_ICON } from '@/components/toolbar-glass';

type ToolbarFiltersControlProps = {
  filters: ToolbarFiltersConfig;
  /**
   * `toolbar` — standalone glass icon (≥44pt).
   * `grouped` — slot inside TOOLBAR_GLASS_GROUP (no outer disc).
   * `lg` — bottom / large tap.
   * `default` — compact.
   */
  size?: 'default' | 'lg' | 'toolbar' | 'grouped';
  className?: string;
};

function FiltersMount({
  setFiltersMountNode,
}: {
  setFiltersMountNode: (node: HTMLElement | null) => void;
}) {
  const refCb = useCallback(
    (node: HTMLDivElement | null) => {
      setFiltersMountNode(node);
    },
    [setFiltersMountNode],
  );
  return <div ref={refCb} className="min-w-0" />;
}

export function ToolbarFiltersControl({
  filters,
  size = 'default',
  className,
}: ToolbarFiltersControlProps) {
  const isMobile = useIsMobile();
  const { setFiltersMountNode } = useToolbarActions();
  const buttonClass =
    size === 'grouped'
      ? cn(
          TOOLBAR_GLASS_GROUP_ITEM,
          filters.open &&
            'bg-primary/15 text-foreground dark:bg-primary/25',
        )
      : size === 'toolbar' || size === 'lg'
        ? cn(
            TOOLBAR_GLASS_ICON,
            filters.open &&
              'border-primary/35 bg-primary/15 text-foreground dark:border-primary/45 dark:bg-primary/25',
          )
        : 'relative size-9 shrink-0 rounded-full';

  const badge =
    (filters.activeCount ?? 0) > 0 ? (
      <span className="absolute top-1.5 right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium text-primary-foreground tabular-nums">
        {filters.activeCount}
      </span>
    ) : null;

  const trigger = (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn(buttonClass, className)}
      aria-label="Filtros y orden"
      aria-expanded={filters.open}
      onClick={() => filters.onOpenChange(true)}
    >
      <ListFilter
        className={size === 'default' ? 'h-4 w-4' : undefined}
        data-icon="inline-start"
      />
      {badge}
    </Button>
  );

  if (isMobile) {
    return (
      <>
        <Tooltip>
          <TooltipTrigger asChild>{trigger}</TooltipTrigger>
          <TooltipContent side="top">Filtros y orden</TooltipContent>
        </Tooltip>
        <Sheet
          open={filters.open}
          onOpenChange={(open) => {
            filters.onOpenChange(open);
            if (!open) setFiltersMountNode(null);
          }}
        >
          <SheetContent
            side="bottom"
            showCloseButton={false}
            className="max-h-[92vh] gap-0 rounded-t-2xl p-0 pb-[max(1rem,env(safe-area-inset-bottom))]"
          >
            <SheetHeader className="relative flex flex-row items-center justify-between border-b border-border/60 px-4 py-3 text-left">
              <Button
                type="button"
                variant="ghost"
                className="h-9 px-2 text-primary"
                onClick={() => filters.onOpenChange(false)}
              >
                Cancelar
              </Button>
              <SheetTitle className="absolute left-1/2 -translate-x-1/2 text-base font-semibold">
                Filtros
              </SheetTitle>
              <SheetDescription className="sr-only">
                Filtrar y ordenar la lista actual
              </SheetDescription>
              <span className="w-16" aria-hidden />
            </SheetHeader>
            <div className="overflow-y-auto px-4 py-4">
              <FiltersMount setFiltersMountNode={setFiltersMountNode} />
            </div>
          </SheetContent>
        </Sheet>
      </>
    );
  }

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>{trigger}</TooltipTrigger>
        <TooltipContent side="bottom">Filtros y orden</TooltipContent>
      </Tooltip>
      <Dialog
        open={filters.open}
        onOpenChange={(open) => {
          filters.onOpenChange(open);
          if (!open) setFiltersMountNode(null);
        }}
      >
        <DialogContent
          showCloseButton={false}
          className="max-h-[85vh] gap-0 overflow-hidden p-0 sm:max-w-lg"
        >
          <DialogHeader className="relative flex flex-row items-center justify-between border-b border-border/60 px-4 py-3 text-left">
            <Button
              type="button"
              variant="ghost"
              className="h-9 px-2 text-primary"
              onClick={() => filters.onOpenChange(false)}
            >
              Cancelar
            </Button>
            <DialogTitle className="absolute left-1/2 -translate-x-1/2 text-base font-semibold">
              Filtros
            </DialogTitle>
            <DialogDescription className="sr-only">
              Filtrar y ordenar la lista actual
            </DialogDescription>
            <span className="w-16" aria-hidden />
          </DialogHeader>
          <div className="max-h-[min(70vh,32rem)] overflow-y-auto px-4 py-4">
            <FiltersMount setFiltersMountNode={setFiltersMountNode} />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
