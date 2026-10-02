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
import { DOCK_CLEARANCE_PADDING_CLASS } from '@/lib/ui/dock-clearance';
import { cn } from '@/lib/utils';

type OverlaySelectApi = {
  handleSelectOpenChange: (nextOpen: boolean) => void;
};

const OverlaySelectContext = createContext<OverlaySelectApi>({
  handleSelectOpenChange: () => {},
});

/** Call from overlay fields that open a portaled Select/popover. */
export const useOverlaySelectOpenChange = (): OverlaySelectApi['handleSelectOpenChange'] =>
  useContext(OverlaySelectContext).handleSelectOpenChange;

/** Re-provides an overlay's select handler to content portaled from another React tree. */
export const OverlaySelectProvider = ({
  onSelectOpenChange,
  children,
}: {
  onSelectOpenChange: OverlaySelectApi['handleSelectOpenChange'];
  children: ReactNode;
}) => {
  const value = useMemo(
    () => ({ handleSelectOpenChange: onSelectOpenChange }),
    [onSelectOpenChange],
  );
  return (
    <OverlaySelectContext.Provider value={value}>{children}</OverlaySelectContext.Provider>
  );
};

type ResponsiveOverlayProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  children: ReactNode | ((api: OverlaySelectApi) => ReactNode);
  /** Blocks dismiss while a mutation is in flight. */
  busy?: boolean;
  contentClassName?: string;
  /** Header dismiss copy; read-only surfaces pass `Cerrar`. */
  dismissLabel?: string;
};

/**
 * The PWA draws under a translucent status bar (`viewport-fit: cover`), so a
 * tall sheet must stop below the safe area or Cancelar hides under the
 * Dynamic Island / notch. The body also needs `overscroll-y-contain`: without
 * it iOS chains the scroll to the page and pans the fixed sheet upward.
 */
const SHEET_MAX_HEIGHT_CLASS =
  'max-h-[min(92dvh,calc(100dvh_-_env(safe-area-inset-top)_-_0.75rem))]';

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
  contentClassName,
  dismissLabel = 'Cancelar',
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
      {dismissLabel}
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
      {rendered}
    </OverlaySelectContext.Provider>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={handleRootOpenChange}>
        <SheetContent
          side="bottom"
          showCloseButton={false}
          className={cn(
            'flex flex-col gap-0 rounded-t-xl p-0',
            SHEET_MAX_HEIGHT_CLASS,
            contentClassName,
          )}
          onPointerDownOutside={preventDismissWhileSelectOpen}
          onFocusOutside={preventDismissWhileSelectOpen}
          onInteractOutside={preventDismissWhileSelectOpen}
        >
          <div className="border-b border-border/50 px-4 py-3">{sheetHeader}</div>
          <div
            className={cn(
              'flex-1 overflow-y-auto overscroll-y-contain p-4',
              DOCK_CLEARANCE_PADDING_CLASS,
            )}
          >
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
        className={cn('max-w-md w-full gap-4 p-5', contentClassName)}
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
