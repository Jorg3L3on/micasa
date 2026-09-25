'use client';

import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ActionSwapIcon } from '@/components/motion/action-swap-icon';
import { useThemeToggle } from '@/components/motion/theme-toggle';

export function ThemeToggle() {
  const { isDark, mounted, toggle } = useThemeToggle({
    variant: 'circle',
    start: 'bottom-left',
  });

  const label = !mounted
    ? 'Cambiar tema'
    : isDark
      ? 'Cambiar a modo claro'
      : 'Cambiar a modo oscuro';

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="size-9"
      aria-label={label}
      onClick={toggle}
      disabled={!mounted}
      tabIndex={0}
    >
      {mounted ? (
        <ActionSwapIcon
          value={isDark ? 'dark' : 'light'}
          animation="blur"
          className="size-5"
        >
          {isDark ? (
            <Sun className="size-5" aria-hidden data-icon="inline-start" />
          ) : (
            <Moon className="size-5" aria-hidden data-icon="inline-start" />
          )}
        </ActionSwapIcon>
      ) : (
        <Sun className="size-5" aria-hidden data-icon="inline-start" />
      )}
    </Button>
  );
}
