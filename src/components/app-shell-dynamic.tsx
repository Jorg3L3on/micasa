"use client";

import dynamic from "next/dynamic";

import { AppSidebar } from "@/components/app-sidebar";
import { AppHeaderToolbarSkeleton } from "@/components/app-header-toolbar-skeleton";

const HeaderToolbarClient = dynamic(
  () => import("@/components/app-header-toolbar"),
  {
    ssr: false,
    loading: () => <AppHeaderToolbarSkeleton />,
  },
);

const MobileBottomDockClient = dynamic(
  () =>
    import("@/components/mobile-bottom-dock").then((mod) => ({
      default: mod.MobileBottomDock,
    })),
  { ssr: false },
);

export function AppSidebarDynamic() {
  return <AppSidebar />;
}

export function AppHeaderToolbarDynamic() {
  return <HeaderToolbarClient />;
}

export function MobileBottomDockDynamic() {
  return <MobileBottomDockClient />;
}
