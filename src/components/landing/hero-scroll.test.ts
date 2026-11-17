import { describe, expect, it } from 'vitest';

import {
  fractionForScene,
  pinFraction,
  progressFromFraction,
  sceneFromProgress,
} from '@/components/landing/hero-scroll';

describe('hero scroll mapping', () => {
  it('starts on scene 1 and ends on scene 6', () => {
    expect(progressFromFraction(0)).toBe(0);
    expect(progressFromFraction(1)).toBe(5);
    expect(progressFromFraction(-1)).toBe(0);
    expect(progressFromFraction(2)).toBe(5);
  });

  it('never goes backwards as the page scrolls down', () => {
    let last = -1;
    for (let step = 0; step <= 1000; step++) {
      const progress = progressFromFraction(step / 1000);
      expect(progress).toBeGreaterThanOrEqual(last);
      last = progress;
    }
  });

  it('rests on a finished scene in the middle of every band', () => {
    for (let scene = 0; scene < 6; scene++) {
      const fraction = fractionForScene(scene);
      expect(progressFromFraction(fraction)).toBe(scene);
      expect(sceneFromProgress(progressFromFraction(fraction))).toBe(scene);
    }
  });

  it('keeps resting a little before and after the middle of a band', () => {
    for (let scene = 1; scene < 6; scene++) {
      const fraction = fractionForScene(scene);
      expect(progressFromFraction(fraction - 0.01)).toBe(scene);
      expect(progressFromFraction(Math.min(1, fraction + 0.01))).toBe(scene);
    }
  });

  it('switches the headline halfway through a transition', () => {
    expect(sceneFromProgress(0.49)).toBe(0);
    expect(sceneFromProgress(0.5)).toBe(1);
    expect(sceneFromProgress(4.6)).toBe(5);
    expect(sceneFromProgress(9)).toBe(5);
  });

  it('measures the pin from the wrapper position', () => {
    // Wrapper 5000px tall, hero 1000px: 4000px of pinned scroll.
    expect(pinFraction(0, 5000, 1000, 0)).toBe(0);
    expect(pinFraction(-2000, 5000, 1000, 0)).toBe(0.5);
    expect(pinFraction(-4000, 5000, 1000, 0)).toBe(1);
    expect(pinFraction(-9000, 5000, 1000, 0)).toBe(1);
    expect(pinFraction(300, 5000, 1000, 0)).toBe(0);
    // No pin when the wrapper is as tall as the hero (phones).
    expect(pinFraction(-100, 812, 812, 0)).toBe(0);
  });
});
