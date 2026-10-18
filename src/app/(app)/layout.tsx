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
import { PwaLifecycle } from '@/components/pwa/PwaLifecycle';
import { OnboardingWelcomeToast } from '@/components/onboarding/OnboardingWelcomeToast';
import AppLoading from './loading';
import { DOCK_CLEARANCE_PADDING_MOBILE_CLASS } from '@/lib/ui/dock-clearance';

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
              <PwaLifecycle />
              <Suspense fallback={null}>
                <OnboardingWelcomeToast />
              </Suspense>
              <AppAtmosphere />
              <header
                data-app-chrome
                className="sticky top-0 z-50 h-[calc(4rem+env(safe-area-inset-top))] min-w-0 shrink-0 border-b border-border/80 bg-background/85 pt-[env(safe-area-inset-top)] shadow-sm backdrop-blur-xl transition-[height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-[calc(3rem+env(safe-area-inset-top))] dark:border-white/[0.1] dark:bg-background/55 dark:shadow-panel dark:backdrop-saturate-120"
                style={{ viewTransitionName: 'app-header' }}
              >
                {/* Translucent iOS status bar text is white: keep it legible in light mode. */}
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-x-0 top-0 h-[env(safe-area-inset-top)] bg-chrome-ink dark:hidden"
                />
                <AppHeaderToolbarDynamic />
              </header>
              <div
                className={`relative z-10 flex min-w-0 flex-1 flex-col gap-4 bg-background p-6 md:pl-[4.75rem] dark:bg-transparent ${DOCK_CLEARANCE_PADDING_MOBILE_CLASS}`}
              >
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
