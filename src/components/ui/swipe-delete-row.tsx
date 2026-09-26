'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from 'react';
import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type PanInfo,
} from 'framer-motion';
import {
  SwipeDeleteAction,
  SWIPE_DELETE_ACTION_WIDTH,
} from '@/components/ui/swipe-delete-action';
import { TOUCH_GESTURE_CONTENT_CLASS } from '@/lib/touch';
import {
  isSwipeDeleteDrag,
  shouldOpenSwipeDelete,
  SWIPE_DELETE_CLICK_SUPPRESS_MS,
  SWIPE_DELETE_SPRING,
} from '@/lib/ui/swipe-delete';
import { cn } from '@/lib/utils';

type SwipeDeleteRowProps = {
  /** Pass `useIsMobile()` — swipe is off from `md` up (Viewport Delete Rule). */
  enabled: boolean;
  onRequestDelete: () => void;
  /** Spanish accessible name for the revealed delete control. */
  deleteAriaLabel: string;
  /** Controlled open state; omit to let the row manage it. */
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
  contentClassName?: string;
  railClassName?: string;
  actionClassName?: string;
  children: ReactNode;
};

/**
 * Swipe-left row that reveals `SwipeDeleteAction`. A drag never counts as a
 * tap on the content, and tapping an open row closes it instead of acting.
 */
export const SwipeDeleteRow = ({
  enabled,
  onRequestDelete,
  deleteAriaLabel,
  isOpen: controlledOpen,
  onOpenChange,
  className,
  contentClassName,
  railClassName,
  actionClassName,
  children,
}: SwipeDeleteRowProps) => {
  const reduceMotion = useReducedMotion();
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isOpen = enabled && (controlledOpen ?? uncontrolledOpen);
  const x = useMotionValue(0);
  const railWidth = useTransform(x, (value) => Math.max(0, -value));
  const suppressClickRef = useRef(false);

  const settle = useCallback(
    (open: boolean) => {
      const target = open ? -SWIPE_DELETE_ACTION_WIDTH : 0;
      if (reduceMotion) {
        x.set(target);
        return;
      }
      void animate(x, target, SWIPE_DELETE_SPRING);
    },
    [reduceMotion, x],
  );

  useEffect(() => {
    settle(isOpen);
  }, [isOpen, settle]);

  const setOpen = (open: boolean) => {
    settle(open);
    if (controlledOpen === undefined) setUncontrolledOpen(open);
    onOpenChange?.(open);
  };

  const suppressNextClick = () => {
    suppressClickRef.current = true;
    window.setTimeout(() => {
      suppressClickRef.current = false;
    }, SWIPE_DELETE_CLICK_SUPPRESS_MS);
  };

  const handleDragEnd = (_event: unknown, info: PanInfo) => {
    const gesture = { offsetX: info.offset.x, velocityX: info.velocity.x };
    if (isSwipeDeleteDrag(gesture)) suppressNextClick();
    setOpen(shouldOpenSwipeDelete(gesture));
  };

  const handleClickCapture = (event: MouseEvent<HTMLDivElement>) => {
    if (!suppressClickRef.current && !isOpen) return;
    event.preventDefault();
    event.stopPropagation();
    if (!suppressClickRef.current) setOpen(false);
  };

  const handleDeleteClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    setOpen(false);
    onRequestDelete();
  };

  if (!enabled) return <>{children}</>;

  return (
    <div className={cn('relative isolate overflow-hidden', className)}>
      <motion.div
        className={cn(
          'absolute inset-y-0 right-0 z-0 flex justify-end overflow-hidden',
          railClassName,
        )}
        style={{ width: railWidth }}
        aria-hidden={!isOpen}
        inert={!isOpen}
      >
        <SwipeDeleteAction
          onClick={handleDeleteClick}
          ariaLabel={deleteAriaLabel}
          className={actionClassName}
        />
      </motion.div>
      <motion.div
        className={cn(
          'relative z-[1] touch-pan-y',
          TOUCH_GESTURE_CONTENT_CLASS,
          contentClassName,
        )}
        drag="x"
        dragConstraints={{ left: -SWIPE_DELETE_ACTION_WIDTH, right: 0 }}
        dragElastic={0.05}
        dragMomentum={false}
        onDragEnd={handleDragEnd}
        onClickCapture={handleClickCapture}
        style={{ x }}
      >
        {children}
      </motion.div>
    </div>
  );
};
