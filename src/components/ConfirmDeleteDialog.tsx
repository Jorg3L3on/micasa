'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ResponsiveOverlay } from '@/components/overlay/responsive-overlay';
import { OVERLAY_PRIMARY_BUTTON_CLASS } from '@/components/overlay/overlay-form';

export type ConfirmDeleteDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description: string;
  itemName?: string;
  error?: string | null;
  /** Defaults to "Eliminar" */
  confirmLabel?: string;
  /** Defaults to "Eliminando…" */
  loadingLabel?: string;
  /** Destructive (default) or primary confirm. */
  tone?: 'destructive' | 'default';
};

export default function ConfirmDeleteDialog({
  open,
  onOpenChange,
  onConfirm,
  title,
  description,
  itemName,
  error,
  confirmLabel = 'Eliminar',
  loadingLabel = 'Eliminando…',
  tone = 'destructive',
}: ConfirmDeleteDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleRootOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && isDeleting) return;
    onOpenChange(nextOpen);
  };

  async function handleConfirm() {
    setIsDeleting(true);
    try {
      await onConfirm();
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <ResponsiveOverlay
      open={open}
      onOpenChange={handleRootOpenChange}
      title={title}
      description={description}
      busy={isDeleting}
    >
      <div className="flex flex-col gap-4">
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">{description}</p>
          {itemName ? (
            <p className="text-sm font-semibold text-foreground">{itemName}</p>
          ) : null}
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <Button
          type="button"
          onClick={() => void handleConfirm()}
          disabled={isDeleting}
          variant={tone === 'destructive' ? 'destructive' : 'default'}
          className={OVERLAY_PRIMARY_BUTTON_CLASS}
        >
          {isDeleting ? (
            <>
              <Loader2
                className="mr-2 h-4 w-4 animate-spin"
                data-icon="inline-start"
              />
              {loadingLabel}
            </>
          ) : (
            confirmLabel
          )}
        </Button>
      </div>
    </ResponsiveOverlay>
  );
}
