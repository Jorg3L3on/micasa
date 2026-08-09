'use client';

import {
  useEffect,
  useId,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { animate, motion, useMotionValue, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';

/** Visual track (Tailwind `h-8 w-14`). */
const TRACK_W = 56;
const TRACK_H = 32;
/** Knob (`size-7`). */
const KNOB = 28;
const PAD = 2;
const BORDER = 1;
/** Horizontal travel of the knob inside the track. */
const TRAVEL = TRACK_W - BORDER * 2 - PAD * 2 - KNOB; // 22
const DRAG_THRESHOLD_PX = 4;
const FLICK_VX = 480; // px/s

type ToggleProps = {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
  'aria-label': string;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
};

/**
 * Apple-inspired liquid-glass boolean switch.
 * Mobile-first: tap or drag/swipe the thumb; ≥44px hit slop around the track.
 * Prefer for binary preferences. Use Checkbox only for multi-select.
 */
export function Toggle({
  checked,
  onCheckedChange,
  disabled = false,
  className,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  'aria-describedby': ariaDescribedBy,
}: ToggleProps) {
  const x = useMotionValue(checked ? TRAVEL : 0);
  const reduceMotion = useReducedMotion();
  const draggingRef = useRef(false);
  const movedRef = useRef(false);
  const startXRef = useRef(0);
  const originXRef = useRef(checked ? TRAVEL : 0);
  const lastXRef = useRef(0);
  const lastTRef = useRef(0);
  const velocityRef = useRef(0);
  const suppressClickRef = useRef(false);
  /** Visual ON while dragging past midpoint (before commit). */
  const [lit, setLit] = useState(checked);

  useEffect(() => {
    if (draggingRef.current) return;
    setLit(checked);
    void animate(x, checked ? TRAVEL : 0, {
      type: reduceMotion ? 'tween' : 'spring',
      stiffness: 520,
      damping: 36,
      duration: reduceMotion ? 0.01 : undefined,
    });
  }, [checked, reduceMotion, x]);

  const snapTo = (next: boolean) => {
    setLit(next);
    void animate(x, next ? TRAVEL : 0, {
      type: reduceMotion ? 'tween' : 'spring',
      stiffness: 520,
      damping: 36,
      duration: reduceMotion ? 0.01 : undefined,
    });
    if (next !== checked) onCheckedChange(next);
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (disabled || e.button !== 0) return;
    draggingRef.current = true;
    movedRef.current = false;
    startXRef.current = e.clientX;
    lastXRef.current = e.clientX;
    lastTRef.current = e.timeStamp;
    velocityRef.current = 0;
    originXRef.current = checked ? TRAVEL : 0;
    x.set(originXRef.current);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (!draggingRef.current || disabled) return;
    const dx = e.clientX - startXRef.current;
    if (Math.abs(dx) >= DRAG_THRESHOLD_PX) movedRef.current = true;

    const dt = e.timeStamp - lastTRef.current;
    if (dt > 0) {
      velocityRef.current = ((e.clientX - lastXRef.current) / dt) * 1000;
    }
    lastXRef.current = e.clientX;
    lastTRef.current = e.timeStamp;

    const next = Math.min(TRAVEL, Math.max(0, originXRef.current + dx));
    x.set(next);
    setLit(next >= TRAVEL / 2);
  };

  const finishPointer = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }

    if (!movedRef.current) {
      suppressClickRef.current = true;
      snapTo(!checked);
      return;
    }

    suppressClickRef.current = true;
    const value = x.get();
    const vx = velocityRef.current;
    let next = value >= TRAVEL / 2;
    if (vx > FLICK_VX) next = true;
    else if (vx < -FLICK_VX) next = false;
    snapTo(next);
  };

  const onClick = () => {
    if (disabled) return;
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    snapTo(!checked);
  };

  const on = lit;

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      aria-describedby={ariaDescribedBy}
      disabled={disabled}
      onClick={onClick}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={finishPointer}
      onPointerCancel={finishPointer}
      className={cn(
        'relative inline-flex shrink-0 items-center rounded-full border p-0.5',
        'h-8 w-14 touch-manipulation select-none',
        // ≥44×44px hit target without growing the visual control
        "before:absolute before:-inset-y-2 before:-inset-x-1.5 before:content-['']",
        'transition-[background-color,box-shadow,border-color] duration-200 ease-out',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'motion-reduce:transition-none',
        on
          ? 'border-transparent bg-primary shadow-[inset_0_1px_1px_rgba(255,255,255,0.35),0_1px_2px_color-mix(in_oklch,var(--primary)_35%,transparent)] dark:bg-primary'
          : cn(
              'border-black/5 bg-black/10 backdrop-blur-md',
              'shadow-[inset_0_1px_2px_rgba(255,255,255,0.55),inset_0_-1px_2px_rgba(0,0,0,0.06)]',
              'dark:border-white/10 dark:bg-white/15',
              'dark:shadow-[inset_0_1px_2px_rgba(255,255,255,0.12),inset_0_-1px_2px_rgba(0,0,0,0.35)]',
            ),
        className,
      )}
      style={{
        touchAction: 'none',
        width: TRACK_W,
        height: TRACK_H,
      }}
    >
      <motion.span
        aria-hidden
        style={{ x }}
        className={cn(
          'pointer-events-none block size-7 shrink-0 rounded-full',
          'bg-gradient-to-b from-white to-neutral-100',
          'shadow-[0_2px_6px_rgba(0,0,0,0.22),0_1px_0_rgba(255,255,255,0.95)_inset]',
          'ring-1 ring-black/5 dark:ring-white/10',
        )}
      />
    </button>
  );
}

export type ToggleFieldLayout = 'row' | 'stack';

type ToggleFieldProps = {
  label: string;
  helper?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  /** `row` when space allows; `stack` when the field is in a narrow column. */
  layout?: ToggleFieldLayout;
  disabled?: boolean;
  className?: string;
  'aria-label'?: string;
};

/**
 * Label + Toggle + optional helper.
 * Only the toggle is interactive — label and helper are not press targets.
 */
export function ToggleField({
  label,
  helper,
  checked,
  onCheckedChange,
  layout = 'row',
  disabled = false,
  className,
  'aria-label': ariaLabel,
}: ToggleFieldProps) {
  const labelId = useId();
  const helperId = useId();

  const toggle = (
    <Toggle
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      aria-label={ariaLabel ?? label}
      aria-labelledby={labelId}
      aria-describedby={helper ? helperId : undefined}
    />
  );

  const labelEl = (
    <span
      id={labelId}
      className="text-sm font-medium leading-snug text-foreground"
    >
      {label}
    </span>
  );

  const helperEl = helper ? (
    <p id={helperId} className="text-[10px] leading-snug text-muted-foreground">
      {helper}
    </p>
  ) : null;

  if (layout === 'stack') {
    return (
      <div className={cn('flex flex-col items-start gap-1.5', className)}>
        {labelEl}
        {toggle}
        {helperEl}
      </div>
    );
  }

  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex items-center justify-between gap-3">
        {labelEl}
        {toggle}
      </div>
      {helperEl}
    </div>
  );
}
