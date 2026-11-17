/**
 * Scroll-driven story: maps how far the pinned hero has been scrolled to the
 * engine's scene progress (0 to 5). Each scene has a resting band, so a
 * visitor who stops scrolling lands on a finished scene, not mid-transition.
 *
 * The pin is measured in units of one transition:
 * a short rest on scene 1, then five times (transition + rest).
 */

import { SCENE_COUNT } from '@/components/landing/landing-data';

/** Rest on the first scene: short, so the first scroll answers at once. */
export const FIRST_REST = 0.12;
/** Rest on every later scene. */
export const REST = 0.45;

const STEP = 1 + REST;
const TRANSITIONS = SCENE_COUNT - 1;
export const SCROLL_UNITS = FIRST_REST + TRANSITIONS * STEP;

const clamp = (value: number, min: number, max: number) =>
  value < min ? min : value > max ? max : value;

/** `fraction` is 0 at the start of the pin and 1 at its end. */
export const progressFromFraction = (fraction: number): number => {
  const units = clamp(fraction, 0, 1) * SCROLL_UNITS - FIRST_REST;
  if (units <= 0) return 0;
  const transition = Math.min(TRANSITIONS - 1, Math.floor(units / STEP));
  return transition + clamp(units - transition * STEP, 0, 1);
};

/** Scene whose headline shows at a given progress. */
export const sceneFromProgress = (progress: number): number =>
  clamp(Math.floor(progress + 0.5), 0, SCENE_COUNT - 1);

/** Fraction of the pin at the middle of a scene's resting band. */
export const fractionForScene = (scene: number): number => {
  if (scene <= 0) return 0;
  const index = Math.min(scene, SCENE_COUNT - 1);
  return clamp((FIRST_REST + (index - 1) * STEP + 1 + REST / 2) / SCROLL_UNITS, 0, 1);
};

/**
 * How far the sticky hero has travelled inside its tall wrapper, 0 to 1.
 * `stickyTop` is the hero's `top` offset in px.
 */
export const pinFraction = (
  wrapTop: number,
  wrapHeight: number,
  heroHeight: number,
  stickyTop: number,
): number => {
  const distance = wrapHeight - heroHeight;
  if (distance <= 0) return 0;
  return clamp((stickyTop - wrapTop) / distance, 0, 1);
};
