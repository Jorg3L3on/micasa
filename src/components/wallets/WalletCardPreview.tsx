'use client';

import type { ReactNode } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { motion, useReducedMotion } from 'framer-motion';
import { ExternalLink, Trash2, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

export type WalletPreviewAction = {
  key: string;
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  busy?: boolean;
};

type WalletCardPreviewProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  walletName: string;
  /** The enlarged card face. */
  children: ReactNode;
  onOpenDetail: () => void;
  /** The same quick actions shown under the card. */
  actions: WalletPreviewAction[];
  onDelete: () => void;
};

const DISMISS_DRAG_PX = 90;

/**
 * Long-press view of the front wallet in the mobile cover flow: the face,
 * enlarged and centered, with Abrir detalle, the card's quick actions and
 * Eliminar. Closes on a tap outside, a swipe down or Cerrar.
 */
export const WalletCardPreview = ({
  open,
  onOpenChange,
  walletName,
  children,
  onOpenDetail,
  actions,
  onDelete,
}: WalletCardPreviewProps) => {
  const reduceMotion = useReducedMotion();
  const close = () => onOpenChange(false);
  const run = (action: () => void) => () => {
    close();
    action();
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0 motion-reduce:animate-none" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="fixed inset-0 z-50 flex items-center justify-center p-5 outline-none"
          onClick={(event) => {
            if (event.target === event.currentTarget) close();
          }}
        >
          <DialogPrimitive.Title className="sr-only">{walletName}</DialogPrimitive.Title>
          <motion.div
            className="flex w-full max-w-sm flex-col gap-4"
            drag="y"
            dragSnapToOrigin
            dragElastic={0.35}
            dragConstraints={{ top: 0, bottom: 0 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > DISMISS_DRAG_PX || info.velocity.y > 600) close();
            }}
            initial={reduceMotion ? false : { opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
            onClick={(event) => {
              // Taps in the gaps around the card dismiss like a backdrop tap.
              if (event.target === event.currentTarget) close();
            }}
          >
            {children}

            <div className="grid grid-cols-3 gap-2">
              <Button
                type="button"
                className="col-span-3 h-11 rounded-xl"
                onClick={run(onOpenDetail)}
              >
                <ExternalLink data-icon="inline-start" />
                Abrir detalle
              </Button>
              {actions.map(({ key, label, icon: Icon, onClick, busy }) => (
                <Button
                  key={key}
                  type="button"
                  variant="secondary"
                  className="h-auto min-w-0 flex-col gap-1 rounded-xl px-1 py-2.5 text-xs leading-tight"
                  disabled={busy}
                  aria-busy={busy || undefined}
                  onClick={run(onClick)}
                >
                  <Icon className="h-5 w-5" aria-hidden />
                  {label}
                </Button>
              ))}
              <Button
                type="button"
                variant="outline"
                className="col-span-3 h-11 rounded-xl text-status-expense hover:text-status-expense"
                onClick={run(onDelete)}
              >
                <Trash2 data-icon="inline-start" />
                Eliminar
              </Button>
              <DialogPrimitive.Close asChild>
                <Button
                  type="button"
                  variant="ghost"
                  className="col-span-3 h-10 rounded-xl text-muted-foreground"
                >
                  Cerrar
                </Button>
              </DialogPrimitive.Close>
            </div>
          </motion.div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};
