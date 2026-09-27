import { describe, expect, it } from 'vitest';
import { isSwipeDeleteDrag, shouldOpenSwipeDelete } from './swipe-delete';

describe('shouldOpenSwipeDelete', () => {
  it('opens past the leftward distance threshold', () => {
    expect(shouldOpenSwipeDelete({ offsetX: -41, velocityX: 0 })).toBe(true);
    expect(shouldOpenSwipeDelete({ offsetX: -40, velocityX: 0 })).toBe(false);
  });

  it('opens on a fast leftward fling', () => {
    expect(shouldOpenSwipeDelete({ offsetX: -5, velocityX: -600 })).toBe(true);
  });

  it('stays closed for rightward drags', () => {
    expect(shouldOpenSwipeDelete({ offsetX: 60, velocityX: 700 })).toBe(false);
  });
});

describe('isSwipeDeleteDrag', () => {
  it('treats small, slow movement as a tap', () => {
    expect(isSwipeDeleteDrag({ offsetX: 4, velocityX: 20 })).toBe(false);
  });

  it('treats horizontal movement or velocity as a drag', () => {
    expect(isSwipeDeleteDrag({ offsetX: -12, velocityX: 0 })).toBe(true);
    expect(isSwipeDeleteDrag({ offsetX: 0, velocityX: -120 })).toBe(true);
  });
});
