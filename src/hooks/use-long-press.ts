import { useCallback, useEffect, useRef, type PointerEvent } from 'react';

export const LONG_PRESS_MS = 450;
/** Finger travel (px) that turns a press into a scroll or swipe. */
export const LONG_PRESS_MOVE_TOLERANCE_PX = 8;

type Options = {
  onLongPress: () => void;
  delayMs?: number;
  enabled?: boolean;
};

/**
 * Touch/pen long press. After `onLongPress` fires, the click that follows the
 * release is swallowed via `onClickCapture`, so the press does not also
 * navigate. Mouse is ignored (desktop uses the regular click/menu).
 */
export const useLongPress = ({
  onLongPress,
  delayMs = LONG_PRESS_MS,
  enabled = true,
}: Options) => {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const origin = useRef<{ x: number; y: number } | null>(null);
  const fired = useRef(false);
  const callback = useRef(onLongPress);

  useEffect(() => {
    callback.current = onLongPress;
  }, [onLongPress]);

  const cancel = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    origin.current = null;
  }, []);

  useEffect(() => cancel, [cancel]);

  const onPointerDown = useCallback(
    (event: PointerEvent) => {
      if (!enabled || event.pointerType === 'mouse') return;
      fired.current = false;
      origin.current = { x: event.clientX, y: event.clientY };
      timer.current = setTimeout(() => {
        timer.current = null;
        fired.current = true;
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          navigator.vibrate?.(10);
        }
        callback.current();
      }, delayMs);
    },
    [delayMs, enabled],
  );

  const onPointerMove = useCallback(
    (event: PointerEvent) => {
      const start = origin.current;
      if (!start) return;
      if (
        Math.hypot(event.clientX - start.x, event.clientY - start.y) >
        LONG_PRESS_MOVE_TOLERANCE_PX
      ) {
        cancel();
      }
    },
    [cancel],
  );

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp: cancel,
    onPointerCancel: cancel,
    onPointerLeave: cancel,
    onContextMenu: (event: { preventDefault: () => void }) => {
      if (enabled) event.preventDefault();
    },
    onClickCapture: (event: {
      preventDefault: () => void;
      stopPropagation: () => void;
    }) => {
      if (!fired.current) return;
      fired.current = false;
      event.preventDefault();
      event.stopPropagation();
    },
  };
};
