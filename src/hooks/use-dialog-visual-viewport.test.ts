import { describe, expect, it } from 'vitest';
import { computeDialogVisualViewportLayout } from './use-dialog-visual-viewport';

describe('computeDialogVisualViewportLayout', () => {
  it('returns null when the viewport is not shortened', () => {
    expect(computeDialogVisualViewportLayout(800, 800, 0)).toBeNull();
    expect(computeDialogVisualViewportLayout(800, 700, 0)).toBeNull();
  });

  it('returns top-aligned layout when the keyboard shrinks the viewport', () => {
    expect(computeDialogVisualViewportLayout(800, 320, 40)).toEqual({
      top: '52px',
      maxHeight: '296px',
      transform: 'translateX(-50%) translateY(0)',
    });
  });

  it('enforces a minimum dialog height', () => {
    expect(computeDialogVisualViewportLayout(800, 100, 0)).toEqual({
      top: '12px',
      maxHeight: '120px',
      transform: 'translateX(-50%) translateY(0)',
    });
  });
});
