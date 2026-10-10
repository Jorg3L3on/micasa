import { describe, expect, it } from 'vitest';
import { LONG_PRESS_MOVE_TOLERANCE_PX, LONG_PRESS_MS } from './use-long-press';

describe('long press constants', () => {
  it('keeps a deliberate hold and a small movement tolerance', () => {
    expect(LONG_PRESS_MS).toBeGreaterThanOrEqual(350);
    expect(LONG_PRESS_MS).toBeLessThanOrEqual(600);
    expect(LONG_PRESS_MOVE_TOLERANCE_PX).toBeLessThanOrEqual(12);
  });
});
