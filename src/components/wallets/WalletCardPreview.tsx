'use client';

import type { ReactNode } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowLeftRight, ExternalLink, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

type WalletCardPreviewProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  walletName: string;
  /** Shared-layout id of the pressed card, so the face morphs into place. */
  layoutId: string;
  /** The enlarged card face. */
  children: ReactNode;
  onOpenDetail: () => void;
  onTransfer?: () => void;
  onEdit: () => void;
  onDelete: () => void;
};

const DISMISS_DRAG_PX = 90;

/**
 * Long-press view of a wallet card: the same face, enlarged and centered,
 * with Abrir detalle / Transferir / Editar / Eliminar. Stays open until the
 * user taps outside, swipes down or taps Cerrar.
 */
export const WalletCardPreview = ({
  open,
  onOpenChange,
  walletName,
  layoutId,
  children,
  onOpenDetail,
  onTransfer,
  onEdit,
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
          <DialogPrimitive.Title className="sr-only">
            {walletName}
          </DialogPrimitive.Title>
          <motion.div
            className="flex w-full max-w-sm touch-pan-x flex-col gap-4"
            drag="y"
            dragSnapToOrigin
            dragElastic={0.35}
            dragConstraints={{ top: 0, bottom: 0 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > DISMISS_DRAG_PX || info.velocity.y > 600) {
                close();
              }
            }}
            initial={reduceMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
            onClick={(event) => {
              // Taps in the gaps around the card dismiss like a backdrop tap.
              if (event.target === event.currentTarget) close();
            }}
          >
            <motion.div
              layoutId={reduceMotion ? undefined : layoutId}
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}
              className="origin-center scale-[1.04] rounded-face"
            >
              {children}
            </motion.div>

            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                className="col-span-2 h-11 rounded-xl"
                onClick={run(onOpenDetail)}
              >
                <ExternalLink data-icon="inline-start" />
                Abrir detalle
              </Button>
              {onTransfer ? (
                <Button
                  type="button"
                  variant="secondary"
                  className="h-11 rounded-xl"
                  onClick={run(onTransfer)}
                >
                  <ArrowLeftRight data-icon="inline-start" />
                  Transferir
                </Button>
              ) : null}
              <Button
                type="button"
                variant="secondary"
                className={
                  onTransfer ? 'h-11 rounded-xl' : 'col-span-2 h-11 rounded-xl'
                }
                onClick={run(onEdit)}
              >
                <Pencil data-icon="inline-start" />
                Editar
              </Button>
              <Button
                type="button"
                variant="outline"
                className="col-span-2 h-11 rounded-xl text-status-expense hover:text-status-expense"
                onClick={run(onDelete)}
              >
                <Trash2 data-icon="inline-start" />
                Eliminar
              </Button>
              <DialogPrimitive.Close asChild>
                <Button
                  type="button"
                  variant="ghost"
                  className="col-span-2 h-10 rounded-xl text-muted-foreground"
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
