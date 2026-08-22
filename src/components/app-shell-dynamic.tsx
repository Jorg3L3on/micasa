'use client';

import dynamic from 'next/dynamic';

const AppSidebarClient = dynamic(
  () =>
    import('@/components/app-sidebar').then((mod) => ({
      default: mod.AppSidebar,
    })),
  {
    ssr: false,
    loading: () => (
      <div
        className="flex h-svh w-12 shrink-0 flex-col border-r border-sidebar-border bg-sidebar"
        aria-hidden
      />
    ),
  },
);

const HeaderToolbarClient = dynamic(
  () => import('@/components/app-header-toolbar'),
  {
    ssr: false,
    loading: () => (
      <div className="grid h-16 w-full min-w-0 shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-2 border-b border-border/80 bg-background px-4 shadow-sm">
        <div className="flex items-center gap-2 justify-self-start">
          <div className="size-9 shrink-0 animate-pulse rounded-md bg-muted" />
          <div className="h-4 w-px bg-border" />
          <div className="size-9 shrink-0 animate-pulse rounded-md bg-muted" />
        </div>
        <div className="h-5 w-32 animate-pulse rounded bg-muted justify-self-center" />
        <div className="flex gap-1.5 justify-self-end">
          <div className="h-11 w-24 shrink-0 animate-pulse rounded-full bg-muted" />
          <div className="h-11 w-36 shrink-0 animate-pulse rounded-full bg-muted" />
        </div>
      </div>
    ),
  },
);

export function AppSidebarDynamic() {
  return <AppSidebarClient />;
}

export function AppHeaderToolbarDynamic() {
  return <HeaderToolbarClient />;
}
