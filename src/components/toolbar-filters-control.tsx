'use client';

import { useCallback, useEffect } from 'react';
import { ListFilter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ResponsiveOverlay } from '@/components/overlay/responsive-overlay';
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

type FiltersMountProps = {
  setFiltersMountNode: (node: HTMLElement | null) => void;
  setFiltersSelectOpenChange: (handler: ((open: boolean) => void) | null) => void;
  onSelectOpenChange: (open: boolean) => void;
};

const FiltersMount = ({
  setFiltersMountNode,
  setFiltersSelectOpenChange,
  onSelectOpenChange,
}: FiltersMountProps) => {
  const refCb = useCallback(
    (node: HTMLDivElement | null) => {
      setFiltersMountNode(node);
    },
    [setFiltersMountNode],
  );

  useEffect(() => {
    setFiltersSelectOpenChange(onSelectOpenChange);
    return () => setFiltersSelectOpenChange(null);
  }, [onSelectOpenChange, setFiltersSelectOpenChange]);

  return <div ref={refCb} className="min-w-0" />;
};

export function ToolbarFiltersControl({
  filters,
  size = 'default',
  className,
}: ToolbarFiltersControlProps) {
  const isMobile = useIsMobile();
  const { setFiltersMountNode, setFiltersSelectOpenChange } = useToolbarActions();
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
      <span className="absolute top-1.5 right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-caption font-medium text-primary-foreground tabular-nums">
        {filters.activeCount}
      </span>
    ) : null;

  const handleOpenChange = (open: boolean) => {
    filters.onOpenChange(open);
    if (!open) setFiltersMountNode(null);
  };

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
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
        </TooltipTrigger>
        <TooltipContent side={isMobile ? 'top' : 'bottom'}>Filtros y orden</TooltipContent>
      </Tooltip>
      <ResponsiveOverlay
        open={filters.open}
        onOpenChange={handleOpenChange}
        title="Filtros"
        description="Filtrar y ordenar la lista actual"
        contentClassName="sm:max-w-lg"
      >
        {({ handleSelectOpenChange }) => (
          <div className="md:max-h-[min(70vh,32rem)] md:overflow-y-auto">
            <FiltersMount
              setFiltersMountNode={setFiltersMountNode}
              setFiltersSelectOpenChange={setFiltersSelectOpenChange}
              onSelectOpenChange={handleSelectOpenChange}
            />
          </div>
        )}
      </ResponsiveOverlay>
    </>
  );
}
