import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import {
  AppSidebarDynamic,
  AppHeaderToolbarDynamic,
  MobileBottomDockDynamic,
} from '@/components/app-shell-dynamic';
import { AppToolbarShell } from '@/components/app-toolbar-shell';
import { AppTooltipProvider } from '@/components/AppTooltipProvider';
import { AppAtmosphere } from '@/components/app-atmosphere';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { ContentEnter } from '@/components/view-transition/SuspenseReveal';
import { QuickCaptureHost } from '@/components/quick-capture/QuickCaptureHost';
import AppLoading from './loading';

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login');
  }

  const userId = Number(session.user.id);
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { onboarding_completed: true },
  });

  if (!user?.onboarding_completed) {
    redirect('/onboarding');
  }

  return (
    <AppTooltipProvider>
      <AppToolbarShell>
        <SidebarProvider>
          <AppSidebarDynamic />
          <SidebarInset className="relative min-w-0 dark:bg-transparent">
            <QuickCaptureHost>
              <AppAtmosphere />
              <header
                className="sticky top-0 z-50 h-16 min-w-0 shrink-0 border-b border-border/80 bg-background/85 shadow-sm backdrop-blur-xl transition-[height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12 dark:border-white/[0.1] dark:bg-[#060914]/55 dark:shadow-[0_16px_48px_-24px_rgba(0,0,0,0.55)] dark:backdrop-saturate-120"
                style={{ viewTransitionName: 'app-header' }}
              >
                <AppHeaderToolbarDynamic />
              </header>
              <div className="relative z-10 flex min-w-0 flex-1 flex-col gap-4 bg-background p-6 pb-[calc(5rem+env(safe-area-inset-bottom))] dark:bg-transparent md:pb-6">
                <div className="container mx-auto min-w-0 overflow-x-clip">
                  <Suspense fallback={<AppLoading />}>
                    <ContentEnter>{children}</ContentEnter>
                  </Suspense>
                </div>
              </div>
              <MobileBottomDockDynamic />
            </QuickCaptureHost>
          </SidebarInset>
        </SidebarProvider>
      </AppToolbarShell>
    </AppTooltipProvider>
  );
}
