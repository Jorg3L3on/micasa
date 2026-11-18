'use client';

import { useState, type ReactNode } from 'react';
import { Trash2 } from 'lucide-react';
import ConfirmDeleteDialog from '@/components/ConfirmDeleteDialog';
import { Button } from '@/components/ui/button';
import { SwipeDeleteRow } from '@/components/ui/swipe-delete-row';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useIsMobile } from '@/hooks/use-mobile';

type OnboardingDeletableRowProps = {
  /** Current name of the draft; empty means "sin nombre". */
  name: string;
  canDelete: boolean;
  /** Noun for the confirm copy, e.g. "billetera". */
  itemNoun: string;
  onDelete: () => void;
  className?: string;
  /** Renders the draft; place `deleteButton` where the trash belongs (it is null when hidden). */
  children: (deleteButton: ReactNode) => ReactNode;
};

/**
 * Delete rule for onboarding drafts: swipe below `md`, trash button from `md`,
 * and always a confirm dialog.
 */
export function OnboardingDeletableRow({
  name,
  canDelete,
  itemNoun,
  onDelete,
  className = 'rounded-xl',
  children,
}: OnboardingDeletableRowProps) {
  const isMobile = useIsMobile();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const trimmedName = name.trim();
  const deleteLabel = `Eliminar ${itemNoun} ${trimmedName || 'sin nombre'}`;

  const deleteButton = canDelete ? (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => setConfirmOpen(true)}
          aria-label={deleteLabel}
          className="hidden shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive md:inline-flex"
        >
          <Trash2 className="size-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={4}>
        Eliminar {itemNoun}
      </TooltipContent>
    </Tooltip>
  ) : null;

  return (
    <>
      <SwipeDeleteRow
        enabled={isMobile && canDelete}
        onRequestDelete={() => setConfirmOpen(true)}
        deleteAriaLabel={deleteLabel}
        className={className}
      >
        {children(deleteButton)}
      </SwipeDeleteRow>

      <ConfirmDeleteDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`¿Eliminar ${itemNoun}?`}
        description={
          trimmedName
            ? `Quitaremos “${trimmedName}” de tu configuración inicial.`
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
