'use client';

// beui.dev/components/blocks/swipeable-list

import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type PanInfo,
} from 'framer-motion';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { TOUCH_GESTURE_CONTENT_CLASS } from '@/lib/touch';
import { cn } from '@/lib/utils';

export type SwipeSide = 'left' | 'right';

export type SwipeableListValue = {
  id: string;
  side: SwipeSide;
};

export type SwipeActionTone =
  | 'neutral'
  | 'primary'
  | 'success'
  | 'warning'
  | 'danger';

export type SwipeAction = {
  id: string;
  label: ReactNode;
  icon: ReactNode;
  tone?: SwipeActionTone;
  disabled?: boolean;
  onClick?: () => void;
};

export type SwipeableListItem = {
  id: string;
  title?: ReactNode;
  description?: ReactNode;
  meta?: ReactNode;
  leading?: ReactNode;
  content?: ReactNode;
  leftActions?: SwipeAction[];
  rightActions?: SwipeAction[];
  disabled?: boolean;
};

export type SwipeableListClassNames = {
  root?: string;
  item?: string;
  rail?: string;
  action?: string;
  surface?: string;
  leading?: string;
  content?: string;
  title?: string;
  description?: string;
  meta?: string;
};

export type SwipeableListProps = {
  items: SwipeableListItem[];
  value?: SwipeableListValue | null;
  defaultValue?: SwipeableListValue | null;
  onValueChange?: (value: SwipeableListValue | null) => void;
  onAction?: (payload: {
    item: SwipeableListItem;
    action: SwipeAction;
    side: SwipeSide;
  }) => void;
  actionWidth?: number;
  revealThreshold?: number;
  closeOnAction?: boolean;
  className?: string;
  classNames?: SwipeableListClassNames;
  renderItem?: (item: SwipeableListItem) => ReactNode;
};

export type SwipeableRowProps = {
  id: string;
  children: ReactNode;
  enabled?: boolean;
  leftActions?: SwipeAction[];
  rightActions?: SwipeAction[];
  openValue?: SwipeableListValue | null;
  onOpenChange?: (value: SwipeableListValue | null) => void;
  actionWidth?: number;
  revealThreshold?: number;
  closeOnAction?: boolean;
  className?: string;
  surfaceClassName?: string;
  railClassName?: string;
};

const ROW_SETTLE = {
  type: 'spring',
  stiffness: 560,
  damping: 48,
  mass: 0.82,
  restDelta: 0.5,
  restSpeed: 8,
} as const;

const OPEN_DISTANCE_RATIO = 0.46;
const CLOSE_DISTANCE_RATIO = 0.72;
const OPEN_VELOCITY = 720;
const CLOSE_VELOCITY = 320;
const FLING_DISTANCE = 14;
const RELEASE_VELOCITY_LIMIT = 1500;

const ACTION_TONE_CLASS: Record<SwipeActionTone, string> = {
  neutral: 'text-muted-foreground group-hover:text-foreground',
  primary: 'text-foreground',
  success: 'text-emerald-600 dark:text-emerald-400',
  warning: 'text-amber-600 dark:text-amber-400',
  danger: 'text-destructive',
};

const useControllableSwipeValue = ({
  value,
  defaultValue,
  onValueChange,
}: {
  value?: SwipeableListValue | null;
  defaultValue?: SwipeableListValue | null;
  onValueChange?: (value: SwipeableListValue | null) => void;
}) => {
  const [internalValue, setInternalValue] = useState(defaultValue ?? null);
  const isControlled = value !== undefined;
  const currentValue = value ?? internalValue;

  const setValue = useCallback(
    (next: SwipeableListValue | null) => {
      if (!isControlled) {
        setInternalValue(next);
      }
      onValueChange?.(next);
    },
    [isControlled, onValueChange],
  );

  return [currentValue, setValue] as const;
};

const isActionableSide = (value: number, sideWidth: number) =>
  sideWidth > 0 && Math.abs(value) > 0;

const clampReleaseVelocity = (velocity: number) =>
  Math.max(-RELEASE_VELOCITY_LIMIT, Math.min(RELEASE_VELOCITY_LIMIT, velocity));

const SwipeActionButton = ({
  action,
  actionWidth,
  side,
  focusable,
  onAction,
  className,
}: {
  action: SwipeAction;
  actionWidth: number;
  side: SwipeSide;
  focusable: boolean;
  onAction: (action: SwipeAction, side: SwipeSide) => void;
  className?: string;
}) => (
  <button
    type="button"
    disabled={action.disabled}
    tabIndex={focusable ? 0 : -1}
    aria-label={typeof action.label === 'string' ? action.label : undefined}
    onClick={() => onAction(action, side)}
    className={cn(
      'group flex h-full shrink-0 items-center justify-center outline-none',
      'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
      'disabled:pointer-events-none disabled:opacity-50',
      className,
    )}
    style={{ width: actionWidth }}
  >
    <span
      className={cn(
        'grid h-9 w-9 place-items-center rounded-full transition-[background-color,color,transform] duration-150 group-hover:bg-background group-active:scale-95',
        ACTION_TONE_CLASS[action.tone ?? 'neutral'],
      )}
    >
      {action.icon}
    </span>
    <span className="sr-only">{action.label}</span>
  </button>
);

const SwipeableListRow = ({
  item,
  actionWidth,
  revealThreshold,
  openValue,
  setOpenValue,
  closeOnAction,
  onAction,
  classNames,
  renderItem,
}: {
  item: SwipeableListItem;
  actionWidth: number;
  revealThreshold: number;
  openValue: SwipeableListValue | null;
  setOpenValue: (value: SwipeableListValue | null) => void;
  closeOnAction: boolean;
  onAction?: SwipeableListProps['onAction'];
  classNames?: SwipeableListClassNames;
  renderItem?: (item: SwipeableListItem) => ReactNode;
}) => {
  const defaultContent = (
    <div className="flex min-w-0 items-center gap-3">
      {item.leading ? (
        <div className={cn('shrink-0', classNames?.leading)}>{item.leading}</div>
      ) : null}
      <div className={cn('min-w-0 flex-1', classNames?.content)}>
        {item.title ? (
          <div
            className={cn(
              'truncate text-sm font-medium text-foreground',
              classNames?.title,
            )}
          >
            {item.title}
          </div>
        ) : null}
        {item.description ? (
          <div
            className={cn(
              'mt-0.5 truncate text-xs text-muted-foreground',
              classNames?.description,
            )}
          >
            {item.description}
          </div>
        ) : null}
      </div>
      {item.meta ? (
        <div
          className={cn(
            'shrink-0 text-xs font-medium text-muted-foreground',
            classNames?.meta,
          )}
        >
          {item.meta}
        </div>
      ) : null}
    </div>
  );

  return (
    <SwipeableRow
      id={item.id}
      enabled={!item.disabled}
      leftActions={item.leftActions}
      rightActions={item.rightActions}
      openValue={openValue}
      onOpenChange={setOpenValue}
      actionWidth={actionWidth}
      revealThreshold={revealThreshold}
      closeOnAction={closeOnAction}
      className={classNames?.item}
      railClassName={classNames?.rail}
      surfaceClassName={cn(
        'min-h-[72px] cursor-grab rounded-2xl border border-border bg-card px-4 py-3 shadow-sm active:cursor-grabbing',
        classNames?.surface,
      )}
      onAction={(action, side) => {
        onAction?.({ item, action, side });
      }}
    >
      {renderItem ? renderItem(item) : (item.content ?? defaultContent)}
    </SwipeableRow>
  );
};

export const SwipeableRow = ({
  id,
  children,
  enabled = true,
  leftActions = [],
  rightActions = [],
  openValue,
  onOpenChange,
  actionWidth = 56,
  revealThreshold = 34,
  closeOnAction = true,
  className,
  surfaceClassName,
  railClassName,
  onAction,
}: SwipeableRowProps & {
  onAction?: (action: SwipeAction, side: SwipeSide) => void;
}) => {
  const reduce = useReducedMotion();
  const x = useMotionValue(0);
  const animationRef = useRef<{ stop: () => void } | null>(null);
  const commandedTargetRef = useRef(0);
  const leftWidth = leftActions.length * actionWidth;
  const rightWidth = rightActions.length * actionWidth;
  const openSide = openValue?.id === id ? openValue.side : null;
  const railOpacity = useTransform(x, [-8, -2, 2, 8], [1, 0, 0, 1]);
  const targetX =
    openSide === 'left' ? leftWidth : openSide === 'right' ? -rightWidth : 0;

  const settleX = useCallback(
    (nextX: number, velocity = 0) => {
      commandedTargetRef.current = nextX;
      animationRef.current?.stop();

      if (reduce) {
        x.set(nextX);
        return;
      }

      animationRef.current = animate(x, nextX, {
        ...ROW_SETTLE,
        velocity: clampReleaseVelocity(velocity),
        onComplete: () => x.set(nextX),
      });
    },
    [reduce, x],
  );

  useEffect(() => {
    return () => animationRef.current?.stop();
  }, []);

  useEffect(() => {
    if (commandedTargetRef.current === targetX) {
      return;
    }
    settleX(targetX);
  }, [settleX, targetX]);

  const getTargetX = useCallback(
    (side: SwipeSide | null) =>
      side === 'left' ? leftWidth : side === 'right' ? -rightWidth : 0,
    [leftWidth, rightWidth],
  );

  const snapTo = useCallback(
    (side: SwipeSide | null, velocity = 0) => {
      onOpenChange?.(side ? { id, side } : null);
      settleX(getTargetX(side), velocity);
    },
    [getTargetX, id, onOpenChange, settleX],
  );

  const handleDragStart = useCallback(() => {
    animationRef.current?.stop();
    if (openValue && openValue.id !== id) {
      onOpenChange?.(null);
    }
  }, [id, onOpenChange, openValue]);

  const handleDragEnd = useCallback(
    (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      const velocity = info.velocity.x;
      const latest = x.get();
      const leftOpenThreshold = Math.max(
        revealThreshold,
        leftWidth * OPEN_DISTANCE_RATIO,
      );
      const rightOpenThreshold = Math.max(
        revealThreshold,
        rightWidth * OPEN_DISTANCE_RATIO,
      );

      if (openSide === 'left') {
        if (
          latest < leftWidth * CLOSE_DISTANCE_RATIO ||
          velocity < -CLOSE_VELOCITY
        ) {
          snapTo(null, velocity);
          return;
        }
        snapTo('left', velocity);
        return;
      }

      if (openSide === 'right') {
        if (
          Math.abs(latest) < rightWidth * CLOSE_DISTANCE_RATIO ||
          velocity > CLOSE_VELOCITY
        ) {
          snapTo(null, velocity);
          return;
        }
        snapTo('right', velocity);
        return;
      }

      if (
        isActionableSide(latest, leftWidth) &&
        (latest > leftOpenThreshold ||
          (velocity > OPEN_VELOCITY && latest > FLING_DISTANCE))
      ) {
        snapTo('left', velocity);
        return;
      }

      if (
        isActionableSide(latest, rightWidth) &&
        (latest < -rightOpenThreshold ||
          (velocity < -OPEN_VELOCITY && latest < -FLING_DISTANCE))
      ) {
        snapTo('right', velocity);
        return;
      }

      snapTo(null, velocity);
    },
    [leftWidth, openSide, revealThreshold, rightWidth, snapTo, x],
  );

  const handleAction = useCallback(
    (action: SwipeAction, side: SwipeSide) => {
      action.onClick?.();
      onAction?.(action, side);
      if (closeOnAction) {
        snapTo(null);
      }
    },
    [closeOnAction, onAction, snapTo],
  );

  if (!enabled) {
    return <div className={cn(className, surfaceClassName)}>{children}</div>;
  }

  return (
    <div
      className={cn(
        'relative isolate overflow-hidden rounded-xl bg-muted/50',
        className,
      )}
    >
      <motion.div
        aria-hidden={!openSide}
        inert={!openSide}
        style={{ opacity: railOpacity }}
        className={cn(
          'absolute inset-0 z-0 flex overflow-hidden rounded-xl',
          railClassName,
        )}
      >
        <div className="flex h-full overflow-hidden rounded-l-xl">
          {leftActions.map((action) => (
            <SwipeActionButton
              key={action.id}
              action={action}
              actionWidth={actionWidth}
              focusable={openSide === 'left'}
              onAction={handleAction}
              side="left"
            />
          ))}
        </div>
        <div className="ml-auto flex h-full overflow-hidden rounded-r-xl">
          {rightActions.map((action) => (
            <SwipeActionButton
              key={action.id}
              action={action}
              actionWidth={actionWidth}
              focusable={openSide === 'right'}
              onAction={handleAction}
              side="right"
            />
          ))}
        </div>
      </motion.div>

      <motion.div
        drag="x"
        dragConstraints={{ left: -rightWidth, right: leftWidth }}
        dragElastic={0.04}
        dragMomentum={false}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        style={{ x }}
        className={cn(
          'relative z-10 touch-pan-y',
          TOUCH_GESTURE_CONTENT_CLASS,
          surfaceClassName,
        )}
      >
        {children}
      </motion.div>
    </div>
  );
};

export const SwipeableList = ({
  items,
  value,
  defaultValue = null,
  onValueChange,
  onAction,
  actionWidth = 56,
  revealThreshold = 34,
  closeOnAction = true,
  className,
  classNames,
  renderItem,
}: SwipeableListProps) => {
  const [openValue, setOpenValue] = useControllableSwipeValue({
    value,
    defaultValue,
    onValueChange,
  });

  return (
    <div className={cn('flex w-full flex-col gap-2', className, classNames?.root)}>
      {items.map((item) => (
        <SwipeableListRow
          key={item.id}
          item={item}
          actionWidth={actionWidth}
          revealThreshold={revealThreshold}
          openValue={openValue}
          setOpenValue={setOpenValue}
          closeOnAction={closeOnAction}
          onAction={onAction}
          classNames={classNames}
          renderItem={renderItem}
        />
      ))}
    </div>
  );
};
