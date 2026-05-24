import { describe, expect, it } from 'vitest';
import { computeDialogVisualViewportLayout } from './use-dialog-visual-viewport';

describe('computeDialogVisualViewportLayout', () => {
  it('returns null when the viewport is not shortened', () => {
    expect(computeDialogVisualViewportLayout(800, 800, 0, 1024, 1024, 0)).toBeNull();
    expect(computeDialogVisualViewportLayout(800, 700, 0, 1024, 1024, 0)).toBeNull();
  });

  it('insets to the visible viewport and centers with margin when the keyboard is open', () => {
    expect(computeDialogVisualViewportLayout(800, 320, 40, 1024, 900, 62)).toEqual({
      top: '52px',
      bottom: '452px',
      left: '74px',
      right: '74px',
      maxHeight: '296px',
      margin: 'auto',
      transform: 'none',
    });
  });

  it('enforces a minimum dialog height', () => {
    expect(computeDialogVisualViewportLayout(800, 100, 0, 1024, 1024, 0)).toEqual({
      top: '12px',
      bottom: '712px',
      left: '12px',
      right: '12px',
      maxHeight: '120px',
      margin: 'auto',
      transform: 'none',
    });
  });
});
