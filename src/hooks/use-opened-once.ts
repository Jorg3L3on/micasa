'use client';

import { useState } from 'react';

/**
 * True from the first time `open` is true. Gate a lazily loaded overlay on it so its
 * chunk loads on first open, and it stays mounted afterwards for the close animation.
 */
export function useOpenedOnce(open: boolean): boolean {
  const [opened, setOpened] = useState(open);
  if (open && !opened) setOpened(true);
  return opened || open;
}
