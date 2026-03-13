'use client';

import { useEffect, useState } from 'react';
import type { DashboardData } from '@/types/dashboard';
import DashboardTabs from './DashboardTabs';
import DashboardTabsSkeleton from './DashboardTabsSkeleton';

type DashboardTabsWrapperProps = {
  data: DashboardData;
};

/**
 * Renders DashboardTabs only after client mount to avoid Radix UI hydration
 * mismatch (server vs client useId() differences for aria-controls/id).
 */
export default function DashboardTabsWrapper({ data }: DashboardTabsWrapperProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <DashboardTabsSkeleton />;
  }

  return <DashboardTabs data={data} />;
}
