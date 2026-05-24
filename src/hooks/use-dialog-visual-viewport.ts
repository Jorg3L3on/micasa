import * as React from 'react';

/** Viewport height below this fraction of layout height → treat as software keyboard open. */
export const KEYBOARD_OPEN_HEIGHT_RATIO = 0.85;

export const VIEWPORT_PADDING_PX = 12;

export type DialogVisualViewportLayout = {
  top: string;
  right: string;
  bottom: string;
  left: string;
  maxHeight: string;
  margin: string;
  transform: string;
};

/**
 * Pins the dialog to the visual viewport rectangle and centers with margin:auto
 * (no transform — avoids fighting zoom-in animations on iOS).
 */
export function computeDialogVisualViewportLayout(
  layoutHeight: number,
  visibleHeight: number,
  offsetTop: number,
  layoutWidth: number,
  visibleWidth: number,
  offsetLeft: number,
): DialogVisualViewportLayout | null {
  const keyboardLikelyOpen =
    visibleHeight < layoutHeight * KEYBOARD_OPEN_HEIGHT_RATIO;

  if (!keyboardLikelyOpen) return null;

  const paddedHeight = Math.max(visibleHeight - VIEWPORT_PADDING_PX * 2, 120);

  return {
    top: `${offsetTop + VIEWPORT_PADDING_PX}px`,
    bottom: `${layoutHeight - offsetTop - visibleHeight + VIEWPORT_PADDING_PX}px`,
    left: `${offsetLeft + VIEWPORT_PADDING_PX}px`,
    right: `${layoutWidth - offsetLeft - visibleWidth + VIEWPORT_PADDING_PX}px`,
    maxHeight: `${paddedHeight}px`,
    margin: 'auto',
    transform: 'none',
  };
}

/**
 * Repositions fixed dialogs inside the visual viewport when the on-screen keyboard
 * shrinks it (common on iOS / iPadOS). Returns null when the keyboard is not open.
 */
export function useDialogVisualViewport(enabled = true) {
  const [layout, setLayout] = React.useState<DialogVisualViewportLayout | null>(
    null,
  );

  React.useEffect(() => {
    if (!enabled) {
      setLayout(null);
      return;
    }

    const visualViewport = window.visualViewport;
    if (!visualViewport) return;

    const update = () => {
      setLayout(
        computeDialogVisualViewportLayout(
          window.innerHeight,
          visualViewport.height,
          visualViewport.offsetTop,
          window.innerWidth,
          visualViewport.width,
          visualViewport.offsetLeft,
        ),
      );
    };

    update();
    visualViewport.addEventListener('resize', update);
    visualViewport.addEventListener('scroll', update);
    window.addEventListener('orientationchange', update);

    return () => {
      visualViewport.removeEventListener('resize', update);
      visualViewport.removeEventListener('scroll', update);
      window.removeEventListener('orientationchange', update);
    };
  }, [enabled]);

  return layout;
}

const FOCUSABLE_FIELD_SELECTOR =
  'input:not([type="hidden"]), textarea, select, [contenteditable="true"]';

/** Scroll focused fields into view inside a scrollable dialog shell. */
export function scrollDialogFieldIntoView(
  container: HTMLElement,
  target: EventTarget | null,
) {
  if (!(target instanceof HTMLElement)) return;
  if (!target.matches(FOCUSABLE_FIELD_SELECTOR)) return;

  requestAnimationFrame(() => {
    const containerRect = container.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const overflowBottom = targetRect.bottom - containerRect.bottom + 8;
    const overflowTop = containerRect.top - targetRect.top + 8;

    if (overflowBottom > 0) {
      container.scrollTop += overflowBottom;
    } else if (overflowTop > 0) {
      container.scrollTop -= overflowTop;
    }
  });
}
