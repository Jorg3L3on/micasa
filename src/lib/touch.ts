/**
 * Shared touch primitives. iOS/iPadOS long-press callout and selection win
 * unless the gesture surface opts out.
 */

/** Gesture surface that *is* the control (thumb, handle). */
export const TOUCH_GESTURE_CLASS = 'select-none [-webkit-touch-callout:none]';

/**
 * Gesture surface that wraps consumer content (list row, sheet). Selection is
 * suppressed only on coarse pointers so a mouse can still copy text.
 */
export const TOUCH_GESTURE_CONTENT_CLASS =
  '[-webkit-touch-callout:none] pointer-coarse:select-none';

/**
 * Whether this event came from a hovering pointer (not touch, not pressed).
 * Prefer `useHoverGesture` for enter/leave pairs instead of calling this twice.
 */
export const isHoveringPointer = (event: {
  pointerType: string;
  buttons: number;
}) => event.pointerType !== 'touch' && event.buttons === 0;
