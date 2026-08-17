import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import {
  AppSidebarDynamic,
  AppHeaderToolbarDynamic,
} from '@/components/app-shell-dynamic';
import { AppTooltipProvider } from '@/components/AppTooltipProvider';
import { AppAtmosphere } from '@/components/app-atmosphere';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
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
      <SidebarProvider>
        <AppSidebarDynamic
          navUser={{
            name: session.user.name ?? 'Usuario',
            email: session.user.email ?? '',
            avatar: session.user.image ?? '',
          }}
        />
        <SidebarInset className="relative min-w-0">
          <AppAtmosphere />
          <header className="sticky top-0 z-50 h-16 min-w-0 shrink-0 border-b border-border/80 bg-background/85 shadow-sm backdrop-blur-xl transition-[height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12 dark:border-white/[0.06] dark:bg-[#060914]/75 dark:shadow-[0_12px_40px_-28px_rgba(58,55,252,0.55)]">
            <AppHeaderToolbarDynamic />
          </header>
          <div className="relative z-10 flex min-h-screen min-w-0 flex-1 flex-col gap-4 bg-background p-6">
            <div className="container mx-auto">
              <Suspense fallback={<AppLoading />}>{children}</Suspense>
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </AppTooltipProvider>
  );
}
