/** Drag distance (px, leftward) that opens the trailing delete action. */
export const SWIPE_DELETE_OPEN_THRESHOLD_PX = 40;
/** Leftward fling velocity (px/s) that opens the action regardless of distance. */
export const SWIPE_DELETE_OPEN_VELOCITY = 500;
/** Movement (px) or velocity (px/s) past which a gesture counts as a drag, not a tap. */
export const SWIPE_DELETE_DRAG_MOVE_THRESHOLD_PX = 10;
export const SWIPE_DELETE_DRAG_VELOCITY_THRESHOLD = 80;
/** Window after a drag in which the trailing click is swallowed. */
export const SWIPE_DELETE_CLICK_SUPPRESS_MS = 450;

export const SWIPE_DELETE_SPRING = {
  type: 'spring',
  stiffness: 400,
  damping: 35,
} as const;

type SwipeGesture = {
  offsetX: number;
  velocityX: number;
};

export const shouldOpenSwipeDelete = ({ offsetX, velocityX }: SwipeGesture) =>
  offsetX < -SWIPE_DELETE_OPEN_THRESHOLD_PX ||
  velocityX < -SWIPE_DELETE_OPEN_VELOCITY;

export const isSwipeDeleteDrag = ({ offsetX, velocityX }: SwipeGesture) =>
  Math.abs(offsetX) > SWIPE_DELETE_DRAG_MOVE_THRESHOLD_PX ||
  Math.abs(velocityX) > SWIPE_DELETE_DRAG_VELOCITY_THRESHOLD;
