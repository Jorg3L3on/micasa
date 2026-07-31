'use client';

import * as React from 'react';
import { ThemeProvider as NextThemesProvider, useTheme } from 'next-themes';

const isEditableTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (target.isContentEditable) return true;
  return Boolean(target.closest('[contenteditable="true"]'));
};

const ThemeHotkey = () => {
  const { setTheme, resolvedTheme } = useTheme();

  React.useEffect(() => {
    const handleHotkey = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return;

      const isPlainD =
        event.key.toLowerCase() === 'd' &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        !event.shiftKey;

      const isCmdShiftD =
        event.key.toLowerCase() === 'd' &&
        event.shiftKey &&
        (event.metaKey || event.ctrlKey);

      if (!isPlainD && !isCmdShiftD) return;

      event.preventDefault();
      setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
    };

    window.addEventListener('keydown', handleHotkey);
    return () => window.removeEventListener('keydown', handleHotkey);
  }, [resolvedTheme, setTheme]);

  return null;
};

export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider {...props}>
      <ThemeHotkey />
      {children}
    </NextThemesProvider>
  );
}
