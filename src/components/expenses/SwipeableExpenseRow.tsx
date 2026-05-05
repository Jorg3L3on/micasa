'use client';

import { useEffect, useRef, type MouseEvent } from 'react';
import { motion, useAnimation, type PanInfo } from 'framer-motion';
import { Trash2 } from 'lucide-react';
import ExpenseCard from '@/components/expenses/ExpenseCard';
import type { ExpenseFeedItem } from '@/types/expenses-feed';

const ACTION_WIDTH = 80;
const OPEN_THRESHOLD = 40;

type SwipeableExpenseRowProps = {
  expense: ExpenseFeedItem;
  pending?: boolean;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onCardClick?: () => void;
  onRequestDelete: (expense: ExpenseFeedItem) => void;
};

const DRAG_CLICK_SUPPRESS_MS = 450;
const DRAG_MOVE_THRESHOLD_PX = 10;

export default function SwipeableExpenseRow({
  expense,
  pending,
  isOpen,
  onOpenChange,
  onCardClick,
  onRequestDelete,
}: SwipeableExpenseRowProps) {
  const controls = useAnimation();
  const prevIsOpen = useRef(isOpen);
  const suppressNextClickRef = useRef(false);

  useEffect(() => {
    if (pending) return;
    if (prevIsOpen.current === isOpen) return;
    prevIsOpen.current = isOpen;
    void controls.start({
      x: isOpen ? -ACTION_WIDTH : 0,
      transition: { type: 'spring', stiffness: 400, damping: 35 },
    });
  }, [isOpen, pending, controls]);

  useEffect(() => {
    if (pending) {
      void controls.set({ x: 0 });
    }
  }, [pending, controls]);

  const handleDragEnd = (_event: unknown, info: PanInfo) => {
    if (pending) return;
    const offsetX = info.offset.x;
    const vx = info.velocity.x;
    const draggedHorizontally =
      Math.abs(offsetX) > DRAG_MOVE_THRESHOLD_PX || Math.abs(vx) > 80;
    if (draggedHorizontally) {
      suppressNextClickRef.current = true;
      window.setTimeout(() => {
        suppressNextClickRef.current = false;
      }, DRAG_CLICK_SUPPRESS_MS);
    }
    const shouldOpen = offsetX < -OPEN_THRESHOLD || vx < -500;
    if (shouldOpen) {
      void controls.start({
        x: -ACTION_WIDTH,
        transition: { type: 'spring', stiffness: 400, damping: 35 },
      });
      onOpenChange(true);
    } else {
      void controls.start({
        x: 0,
        transition: { type: 'spring', stiffness: 400, damping: 35 },
      });
      onOpenChange(false);
    }
  };

  const handleSingleActivate = () => {
    if (pending || suppressNextClickRef.current) return;
    if (!isOpen) return;
    void controls.start({
      x: 0,
      transition: { type: 'spring', stiffness: 400, damping: 35 },
    });
    onOpenChange(false);
  };

  const handleDoubleActivate = () => {
    if (pending || suppressNextClickRef.current) return;
    if (isOpen) {
      void controls.start({
        x: 0,
        transition: { type: 'spring', stiffness: 400, damping: 35 },
      });
      onOpenChange(false);
    }
    onCardClick?.();
  };

  const handleDeleteClick = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    onRequestDelete(expense);
  };

  return (
    <div className="relative overflow-hidden rounded-lg">
      <div
        className="absolute inset-0 z-0 flex justify-end"
        aria-hidden={!isOpen}
      >
        <div className="relative flex h-full w-20 shrink-0 items-center justify-center bg-muted/40 dark:bg-muted/25">
          <button
            type="button"
            onClick={handleDeleteClick}
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-md transition hover:bg-destructive/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            aria-label="Eliminar gasto"
          >
            <Trash2 className="size-5 shrink-0" aria-hidden />
          </button>
        </div>
      </div>
      <motion.div
        className="relative z-[1]"
        drag={pending ? false : 'x'}
        dragConstraints={{ left: -ACTION_WIDTH, right: 0 }}
        dragElastic={0.05}
        dragMomentum={false}
        onDragEnd={handleDragEnd}
        animate={controls}
        initial={{ x: 0 }}
        style={{ touchAction: 'pan-y' }}
      >
        <ExpenseCard
          expense={expense}
          pending={pending}
          onSingleActivate={onCardClick ? handleSingleActivate : undefined}
          onDoubleActivate={onCardClick ? handleDoubleActivate : undefined}
        />
      </motion.div>
    </div>
  );
}
