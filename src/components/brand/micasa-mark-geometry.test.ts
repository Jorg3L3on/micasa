import { describe, expect, it } from 'vitest';

import {
  MICASA_MARK_BAR_PALETTE,
  MICASA_MARK_BARS,
  MICASA_MARK_NODES,
  MICASA_MARK_RADIUS,
  getMicasaMarkBarTransform,
  getMicasaMarkBars,
  getMicasaMarkCapsuleRect,
} from './micasa-mark-geometry';

describe('MiCasa mark geometry', () => {
  it('uses six overlapping capsules for a three-peak rooftop zigzag', () => {
    expect(MICASA_MARK_NODES).toHaveLength(7);
    expect(MICASA_MARK_BARS).toHaveLength(6);
    expect(MICASA_MARK_BAR_PALETTE).toHaveLength(6);
  });

  it('peaks sit above the valleys', () => {
    const peaks = [1, 3, 5].map((index) => MICASA_MARK_NODES[index]);
    const valleys = [0, 2, 4, 6].map((index) => MICASA_MARK_NODES[index]);
    for (const peak of peaks) {
      for (const valley of valleys) {
        expect(peak?.y).toBeLessThan(valley?.y ?? Number.POSITIVE_INFINITY);
      }
    }
  });

  it('alternates up-right and down-right', () => {
    const signs = MICASA_MARK_BARS.map((bar) => Math.sign(bar.end.y - bar.start.y));
    expect(signs).toEqual([-1, 1, -1, 1, -1, 1]);
  });

  it('keeps a fat rounded-bar thickness', () => {
    const spanY =
      Math.max(...MICASA_MARK_NODES.map((node) => node.y)) -
      Math.min(...MICASA_MARK_NODES.map((node) => node.y));
    expect(MICASA_MARK_RADIUS).toBeGreaterThanOrEqual(10);
    expect(MICASA_MARK_RADIUS * 2).toBeLessThan(spanY);
  });

  it('builds bars from the node polyline', () => {
    const bars = getMicasaMarkBars();
    expect(bars[0]?.start).toEqual(MICASA_MARK_NODES[0]);
    expect(bars[5]?.end).toEqual(MICASA_MARK_NODES[6]);
    for (const bar of bars) {
      expect(bar.length).toBeGreaterThan(40);
    }
  });

  it('orients each capsule along its segment, not perpendicular to it', () => {
    const bar = MICASA_MARK_BARS[0];
    if (!bar) throw new Error('expected first bar');
    const rect = getMicasaMarkCapsuleRect(bar.length);
    expect(rect.height).toBe(MICASA_MARK_RADIUS * 2);
    expect(rect.width).toBeCloseTo(bar.length + MICASA_MARK_RADIUS * 2);
    expect(getMicasaMarkBarTransform(bar)).toContain(`rotate(${bar.angleDeg})`);
  });
});
