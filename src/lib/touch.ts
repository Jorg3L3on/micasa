/**
 * Shared touch primitives (beUI). iOS/iPadOS run their own gestures on top of
 * the page — long-press callout and selection — and they win unless the
 * surface opts out.
 */

/** Gesture surface that *is* the control (thumb, handle). */
export const TOUCH_GESTURE_CLASS = 'select-none [-webkit-touch-callout:none]';

/**
 * Gesture surface that wraps consumer content (list row, sheet). Selection is
 * suppressed only on coarse pointers so a mouse can still copy text.
 */
export const TOUCH_GESTURE_CONTENT_CLASS =
  '[-webkit-touch-callout:none] pointer-coarse:select-none';
