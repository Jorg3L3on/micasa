'use client';

import { useState, type ReactNode } from 'react';
import { Trash2 } from 'lucide-react';
import ConfirmDeleteDialog from '@/components/ConfirmDeleteDialog';
import { OVERLAY_GROUPED_CARD_CLASS } from '@/components/overlay/overlay-form';
import { Button } from '@/components/ui/button';
import { SwipeDeleteRow } from '@/components/ui/swipe-delete-row';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

type OnboardingItemCardProps = {
  /** Leading badge in the header (provider icon, category glyph…). */
  leading?: ReactNode;
  title: string;
  subtitle?: string;
  canDelete: boolean;
  /** Noun for the confirm copy, e.g. "billetera". */
  itemNoun: string;
  onDelete: () => void;
  children: ReactNode;
};

/**
 * One draft (wallet, income, expense) in the onboarding wizard: a grouped-row
 * card with a header. Delete follows the viewport rule (swipe below `md`,
 * trash from `md`) and always confirms.
 */
export function OnboardingItemCard({
  leading,
  title,
  subtitle,
  canDelete,
  itemNoun,
  onDelete,
  children,
}: OnboardingItemCardProps) {
  const isMobile = useIsMobile();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const trimmedTitle = title.trim();
  const displayTitle =
    trimmedTitle || `${itemNoun[0].toUpperCase()}${itemNoun.slice(1)} sin nombre`;
  const deleteLabel = `Eliminar ${itemNoun} ${trimmedTitle || 'sin nombre'}`;

  return (
    <>
      <SwipeDeleteRow
        enabled={isMobile && canDelete}
        onRequestDelete={() => setConfirmOpen(true)}
        deleteAriaLabel={deleteLabel}
        className="rounded-xl"
      >
        <div className={OVERLAY_GROUPED_CARD_CLASS}>
          <div className="flex min-h-11 items-center gap-3 bg-muted/30 px-3 py-2">
            {leading}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground" title={displayTitle}>
                {displayTitle}
              </p>
              {subtitle ? (
                <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
              ) : null}
            </div>
            {canDelete ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setConfirmOpen(true)}
                    aria-label={deleteLabel}
                    className={cn(
                      'hidden shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive md:inline-flex',
                    )}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={4}>
                  Eliminar {itemNoun}
                </TooltipContent>
              </Tooltip>
            ) : null}
          </div>
          {children}
        </div>
      </SwipeDeleteRow>

      <ConfirmDeleteDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`¿Eliminar ${itemNoun}?`}
        description={
          trimmedTitle
            ? `Quitaremos “${trimmedTitle}” de tu configuración inicial.`
            : `Quitaremos este ${itemNoun} de tu configuración inicial.`
        }
        onConfirm={() => {
          onDelete();
          setConfirmOpen(false);
        }}
      />
    </>
  );
}
