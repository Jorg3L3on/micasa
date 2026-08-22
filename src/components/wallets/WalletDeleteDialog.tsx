'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/use-mobile';

type WalletDeleteDialogProps = {
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
};

/**
 * Delete confirm for billeteras / tarjetas on `/wallets`.
 * Dialog on desktop, bottom Sheet on mobile (Add Transaction chrome).
 * Distinct from shared {@link ConfirmDeleteDialog} (AlertDialog everywhere).
 */
export default function WalletDeleteDialog({
  open,
  onOpenChange,
  onConfirm,
  title,
  description,
  itemName,
  error,
  confirmLabel = 'Eliminar',
  loadingLabel = 'Eliminando…',
}: WalletDeleteDialogProps) {
  const isMobile = useIsMobile();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleRootOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && isDeleting) return;
    onOpenChange(nextOpen);
  };

  const handleCancel = () => handleRootOpenChange(false);

  async function handleConfirm() {
    setIsDeleting(true);
    try {
      await onConfirm();
    } finally {
      setIsDeleting(false);
    }
  }

  const cancelButton = (
    <Button
      type="button"
      variant="ghost"
      className="absolute left-0 h-9 px-2 text-primary"
      onClick={handleCancel}
      disabled={isDeleting}
    >
      Cancelar
    </Button>
  );

  const dialogHeader = (
    <div className="relative flex min-h-10 items-center justify-center">
      {cancelButton}
      <DialogTitle className="text-base font-semibold">{title}</DialogTitle>
      <DialogDescription className="sr-only">{description}</DialogDescription>
    </div>
  );

  const sheetHeader = (
    <div className="relative flex min-h-10 items-center justify-center">
      {cancelButton}
      <SheetTitle className="text-base font-semibold">{title}</SheetTitle>
      <SheetDescription className="sr-only">{description}</SheetDescription>
    </div>
  );

  const formBody = (
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
        className="h-11 w-full rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
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
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={handleRootOpenChange}>
        <SheetContent
          side="bottom"
          showCloseButton={false}
          className="flex max-h-[92vh] flex-col gap-0 rounded-t-xl p-0"
        >
          <div className="border-b border-border/50 px-4 py-3">{sheetHeader}</div>
          <div className="flex-1 overflow-y-auto p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {open ? formBody : null}
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleRootOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="max-w-md w-full gap-4 p-5"
      >
        {dialogHeader}
        {open ? formBody : null}
      </DialogContent>
    </Dialog>
  );
}
