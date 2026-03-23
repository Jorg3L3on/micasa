'use client';

import { useEffect, useState } from 'react';

/** True only after the first client effect — use to defer Radix subtrees until after hydration. */
export function useClientMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  return mounted;
}
