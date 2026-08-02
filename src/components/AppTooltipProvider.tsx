'use client';

import { TooltipProvider } from '@/components/ui/tooltip';

/**
 * Radix tooltips in authenticated app pages (including RSC pages that embed
 * client tooltips) need a provider in this subtree — see shadcn sidebar setup.
 */
export function AppTooltipProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return <TooltipProvider delayDuration={0}>{children}</TooltipProvider>;
}
