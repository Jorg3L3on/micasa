'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { EASE_OUT_CSS } from '@/components/motion/ease';

export type ThemeVariant = 'rectangle' | 'circle' | 'circle-blur' | 'blinds';

export type ThemeTransitionStart =
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right'
  | 'center'
  | 'bottom-up';

const VT_STYLE_ID = 'beui-theme-toggle-vt';

const VT_CSS = `
html[data-beui-vt="rect"]::view-transition-old(root) {
  animation: none;
  mix-blend-mode: normal;
}
html[data-beui-vt="rect"]::view-transition-new(root) {
  mix-blend-mode: normal;
  animation: beui-rect-reveal 400ms ease-out;
}
html[data-beui-vt="circle"]::view-transition-old(root),
html[data-beui-vt="circle-blur"]::view-transition-old(root) {
  animation: none;
  mix-blend-mode: normal;
}
html[data-beui-vt="circle"]::view-transition-new(root) {
  mix-blend-mode: normal;
  animation: beui-circle-reveal 700ms cubic-bezier(0.4, 0, 0.2, 1);
}
html[data-beui-vt="circle-blur"]::view-transition-new(root) {
  mix-blend-mode: normal;
  animation: beui-circle-blur-reveal 700ms cubic-bezier(0.4, 0, 0.2, 1);
}
html[data-beui-vt="blinds"]::view-transition-old(root) {
  animation: none;
  mix-blend-mode: normal;
}
@property --beui-vt-slat {
  syntax: "<length>";
  inherits: false;
  initial-value: 72px;
}
html[data-beui-vt="blinds"]::view-transition-new(root) {
  mix-blend-mode: normal;
  mask-image: linear-gradient(
    90deg,
    #000 0 var(--beui-vt-slat),
    transparent calc(var(--beui-vt-slat) + 20px)
  );
  mask-size: 72px 100%;
  mask-repeat: repeat;
  animation: beui-blinds-reveal 700ms ${EASE_OUT_CSS};
}
@keyframes beui-rect-reveal {
  from { clip-path: var(--beui-vt-from, inset(100% 0 0 0)); }
  to   { clip-path: inset(0 0 0 0); }
}
@keyframes beui-circle-reveal {
  from { clip-path: circle(0% at var(--beui-vt-origin, 50% 100%)); }
  to   { clip-path: circle(150% at var(--beui-vt-origin, 50% 100%)); }
}
@keyframes beui-circle-blur-reveal {
  from { clip-path: circle(0% at var(--beui-vt-origin, 50% 100%)); filter: blur(8px); }
  to   { clip-path: circle(150% at var(--beui-vt-origin, 50% 100%)); filter: blur(0px); }
}
@keyframes beui-blinds-reveal {
  from { --beui-vt-slat: -20px; }
  to   { --beui-vt-slat: 72px; }
}
`;

const RECT_FROM: Record<ThemeTransitionStart, string> = {
  'top-left': 'inset(0 100% 100% 0)',
  'top-right': 'inset(0 0 100% 100%)',
  'bottom-left': 'inset(100% 100% 0 0)',
  'bottom-right': 'inset(100% 0 0 100%)',
  center: 'inset(50% 50% 50% 50%)',
  'bottom-up': 'inset(100% 0 0 0)',
};

const CIRCLE_ORIGIN: Record<ThemeTransitionStart, string> = {
  'top-left': '0% 0%',
  'top-right': '100% 0%',
  'bottom-left': '0% 100%',
  'bottom-right': '100% 100%',
  center: '50% 50%',
  'bottom-up': '50% 100%',
};

const ensureThemeTransitionStyles = () => {
  if (typeof document === 'undefined') return;
  if (document.getElementById(VT_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = VT_STYLE_ID;
  style.textContent = VT_CSS;
  document.head.appendChild(style);
};

type ViewTransitionDocument = Document & {
  startViewTransition?: (callback: () => void) => { finished: Promise<void> };
};

export const startThemeViewTransition = (
  apply: () => void,
  options: {
    variant?: ThemeVariant;
    start?: ThemeTransitionStart;
    reduceMotion?: boolean;
  } = {},
) => {
  const variant = options.variant ?? 'rectangle';
  const start = options.start ?? 'bottom-up';
  ensureThemeTransitionStyles();

  const viewDocument = document as ViewTransitionDocument;
  if (
    options.reduceMotion ||
    typeof viewDocument.startViewTransition !== 'function'
  ) {
    apply();
    return;
  }

  const root = document.documentElement;
  if (variant === 'rectangle') {
    root.style.setProperty('--beui-vt-from', RECT_FROM[start]);
    root.dataset.beuiVt = 'rect';
  } else if (variant === 'blinds') {
    root.dataset.beuiVt = 'blinds';
  } else {
    root.style.setProperty('--beui-vt-origin', CIRCLE_ORIGIN[start]);
    root.dataset.beuiVt = variant;
  }

  let applied = false;
  const run = () => {
    if (applied) return;
    applied = true;
    apply();
  };

  try {
    const transition = viewDocument.startViewTransition(run);
    transition.finished.finally(() => {
      delete root.dataset.beuiVt;
    });
  } catch {
    run();
    delete root.dataset.beuiVt;
  }
};

export const useThemeToggle = ({
  variant = 'rectangle',
  start = 'bottom-up',
}: {
  variant?: ThemeVariant;
  start?: ThemeTransitionStart;
} = {}) => {
  const { setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Theme UI must wait until client mount.
    setMounted(true);
  }, []);

  useEffect(() => {
    ensureThemeTransitionStyles();
  }, []);

  const isDark = mounted && resolvedTheme === 'dark';

  const toggle = () => {
    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    startThemeViewTransition(
      () => {
        setTheme(isDark ? 'light' : 'dark');
      },
      { variant, start, reduceMotion: reduce },
    );
  };

  return { isDark, mounted, toggle };
};
