'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

/** The worker serves this page in place of the requested URL; retry that URL. */
const retryRequestedPage = () => {
  if (window.location.pathname === '/offline') {
    window.location.replace('/');
    return;
  }
  window.location.reload();
};

export function RetryButton() {
  useEffect(() => {
    window.addEventListener('online', retryRequestedPage);
    return () => window.removeEventListener('online', retryRequestedPage);
  }, []);

  return (
    <Button
      type="button"
      onClick={retryRequestedPage}
      className="h-11 w-full max-w-xs rounded-xl text-base"
    >
      Reintentar
    </Button>
  );
}
