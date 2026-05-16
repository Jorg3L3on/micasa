'use client';

import { TooltipProvider } from '@/components/ui/tooltip';

/**
 * Radix tooltips in dashboard pages (including RSC pages that embed client
 * tooltips) need a provider in this subtree — see shadcn sidebar setup.
 */
export function DashboardTooltipProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return <TooltipProvider delayDuration={0}>{children}</TooltipProvider>;
}
