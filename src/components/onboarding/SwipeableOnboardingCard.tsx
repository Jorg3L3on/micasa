'use client';

import { useEffect, useRef, type MouseEvent, type ReactNode } from 'react';
import { motion, useAnimation, type PanInfo } from 'framer-motion';
import {
  SwipeDeleteAction,
  SWIPE_DELETE_ACTION_WIDTH,
} from '@/components/ui/swipe-delete-action';

const ACTION_WIDTH = SWIPE_DELETE_ACTION_WIDTH;
const OPEN_THRESHOLD = 40;

type SwipeableOnboardingCardProps = {
  swipeEnabled: boolean;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onDelete: () => void;
  deleteAriaLabel: string;
  children: ReactNode;
};

/** Viewport-aware swipe shell for onboarding template cards (mobile only). */
export function SwipeableOnboardingCard({
  swipeEnabled,
  isOpen,
  onOpenChange,
  onDelete,
  deleteAriaLabel,
  children,
}: SwipeableOnboardingCardProps) {
  const controls = useAnimation();
  const prevIsOpen = useRef(isOpen);

  useEffect(() => {
    if (!swipeEnabled) {
      void controls.set({ x: 0 });
      prevIsOpen.current = false;
      if (isOpen) onOpenChange(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when swipe mode / open flag changes
  }, [swipeEnabled, isOpen, controls]);

  useEffect(() => {
    if (!swipeEnabled) return;
    if (prevIsOpen.current === isOpen) return;
    prevIsOpen.current = isOpen;
    void controls.start({
      x: isOpen ? -ACTION_WIDTH : 0,
      transition: { type: 'spring', stiffness: 400, damping: 35 },
    });
  }, [isOpen, swipeEnabled, controls]);

  const handleDragEnd = (_event: unknown, info: PanInfo) => {
    if (!swipeEnabled) return;
    const offsetX = info.offset.x;
    const vx = info.velocity.x;
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

  const handleSwipeDeleteClick = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    onDelete();
  };

  return (
    <div className="relative overflow-hidden rounded-lg">
      {swipeEnabled ? (
        <div
          className="absolute inset-0 z-0 flex justify-end md:hidden"
          aria-hidden={!isOpen}
        >
          <SwipeDeleteAction
            onClick={handleSwipeDeleteClick}
            ariaLabel={deleteAriaLabel}
          />
        </div>
      ) : null}
      <motion.div
        className="relative z-[1]"
        drag={swipeEnabled ? 'x' : false}
        dragConstraints={{ left: -ACTION_WIDTH, right: 0 }}
        dragElastic={0.05}
        dragMomentum={false}
        onDragEnd={handleDragEnd}
        animate={controls}
        initial={{ x: 0 }}
        style={{ touchAction: swipeEnabled ? 'pan-y' : undefined }}
      >
        {children}
      </motion.div>
    </div>
  );
}
