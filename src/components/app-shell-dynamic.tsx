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
      <div className="flex h-16 w-full min-w-0 shrink-0 items-center justify-between gap-2 border-b border-border/80 bg-background px-2 shadow-sm">
        <div className="flex flex-1 items-center gap-2 px-2">
          <div className="size-9 shrink-0 animate-pulse rounded-md bg-muted" />
          <div className="h-4 w-px bg-border" />
          <div className="h-5 w-48 max-w-[50%] animate-pulse rounded bg-muted" />
        </div>
        <div className="flex gap-1 px-2">
          <div className="size-9 shrink-0 animate-pulse rounded-md bg-muted" />
          <div className="size-9 shrink-0 animate-pulse rounded-md bg-muted" />
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
