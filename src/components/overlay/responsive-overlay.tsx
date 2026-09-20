'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';
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

type OverlaySelectApi = {
  handleSelectOpenChange: (nextOpen: boolean) => void;
};

const OverlaySelectContext = createContext<OverlaySelectApi>({
  handleSelectOpenChange: () => {},
});

/** Call from overlay fields that open a portaled Select/popover. */
export const useOverlaySelectOpenChange = (): OverlaySelectApi['handleSelectOpenChange'] =>
  useContext(OverlaySelectContext).handleSelectOpenChange;

type ResponsiveOverlayProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  children: ReactNode | ((api: OverlaySelectApi) => ReactNode);
  /** Blocks dismiss while a mutation is in flight. */
  busy?: boolean;
};

/**
 * Dialog on desktop, bottom Sheet on mobile. Header Cancelar + centered title.
 * Description is sr-only. Body is the caller’s form — no footer chrome here.
 */
export const ResponsiveOverlay = ({
  open,
  onOpenChange,
  title,
  description,
  children,
  busy = false,
}: ResponsiveOverlayProps) => {
  const isMobile = useIsMobile();
  const nestedSelectOpenRef = useRef(false);
  const blockDismissUntilRef = useRef(0);

  const handleSelectOpenChange = useCallback((nextOpen: boolean) => {
    nestedSelectOpenRef.current = nextOpen;
    if (!nextOpen) {
      // Swallow the same touch that dismissed the list (iOS ghost click).
      blockDismissUntilRef.current = Date.now() + 500;
    }
  }, []);

  const shouldBlockDismiss = () =>
    busy ||
    nestedSelectOpenRef.current ||
    Date.now() < blockDismissUntilRef.current;

  const handleRootOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && shouldBlockDismiss()) return;
    onOpenChange(nextOpen);
  };

  const preventDismissWhileSelectOpen = (event: {
    preventDefault: () => void;
  }) => {
    if (shouldBlockDismiss()) event.preventDefault();
  };

  const handleCancel = () => handleRootOpenChange(false);

  const selectApi = useMemo(
    () => ({ handleSelectOpenChange }),
    [handleSelectOpenChange],
  );

  const cancelButton = (
    <Button
      type="button"
      variant="ghost"
      className="absolute left-0 h-9 px-2 text-primary-text"
      onClick={handleCancel}
      disabled={busy}
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

  const rendered =
    typeof children === 'function'
      ? children({ handleSelectOpenChange })
      : children;

  const body = (
    <OverlaySelectContext.Provider value={selectApi}>
      {open ? rendered : null}
    </OverlaySelectContext.Provider>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={handleRootOpenChange}>
        <SheetContent
          side="bottom"
          showCloseButton={false}
          className="flex max-h-[92vh] flex-col gap-0 rounded-t-xl p-0"
          onPointerDownOutside={preventDismissWhileSelectOpen}
          onFocusOutside={preventDismissWhileSelectOpen}
          onInteractOutside={preventDismissWhileSelectOpen}
        >
          <div className="border-b border-border/50 px-4 py-3">{sheetHeader}</div>
          <div className="flex-1 overflow-y-auto p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {body}
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
        onPointerDownOutside={preventDismissWhileSelectOpen}
        onFocusOutside={preventDismissWhileSelectOpen}
        onInteractOutside={preventDismissWhileSelectOpen}
      >
        {dialogHeader}
        {body}
      </DialogContent>
    </Dialog>
  );
};
