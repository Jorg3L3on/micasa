'use client';

import { SidebarTrigger } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import PageTitle from '@/components/PageTitle';
import { AlertsBell } from '@/components/AlertsBell';
import { ThemeToggle } from '@/components/theme-toggle';

/** Header chrome loaded only on the client to avoid Radix hydration mismatches. */
export default function DashboardHeaderToolbar() {
  return (
    <div className="flex h-full w-full min-w-0 items-center justify-between gap-2">
      <div className="flex min-w-0 flex-1 items-center gap-2 px-4">
        <SidebarTrigger className="-ml-1 shrink-0" />
        <Separator
          orientation="vertical"
          className="mr-2 shrink-0 data-[orientation=vertical]:h-4"
        />
        <PageTitle />
      </div>
      <div className="flex shrink-0 items-center gap-1 px-4">
        <AlertsBell />
        <ThemeToggle />
      </div>
    </div>
  );
}
