'use client';

import * as React from 'react';
import { Suspense } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

import { AlertsChrome } from '@/components/AlertsBell';
import { FloatingNavRail } from '@/components/floating-nav-rail';
import { MobileOverflowNav } from '@/components/mobile-overflow-nav';
import { Sidebar, useSidebar } from '@/components/ui/sidebar';

/** Cierra el drawer en móvil al cambiar ruta o query (p. ej. contexto de casa). */
function MobileSidebarCloseOnRouteInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchKey = searchParams.toString();
  const { isMobile, setOpenMobile } = useSidebar();

  React.useEffect(() => {
    if (!isMobile) return;
    setOpenMobile(false);
  }, [pathname, searchKey, isMobile, setOpenMobile]);

  return null;
}

function MobileSidebarCloseOnRoute() {
  return (
    <Suspense
      fallback={
        <span className="sr-only" role="status">
          Cargando navegación…
        </span>
      }
    >
      <MobileSidebarCloseOnRouteInner />
    </Suspense>
  );
}

export function AppSidebar() {
  return (
    <AlertsChrome>
      <MobileSidebarCloseOnRoute />
      <FloatingNavRail />
      <Sidebar
        mobileOnly
        mobileTitle="Más"
        mobileDescription="Análisis, operaciones, contexto y cuenta."
        collapsible="offcanvas"
      >
        <MobileOverflowNav />
      </Sidebar>
    </AlertsChrome>
  );
}
