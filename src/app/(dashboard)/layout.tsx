import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import {
  DashboardAppSidebarDynamic,
  DashboardHeaderToolbarDynamic,
} from '@/components/dashboard-shell-dynamic';
import { DashboardTooltipProvider } from '@/components/dashboard/DashboardTooltipProvider';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';

export default async function DashboardLayout({
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
    <SidebarProvider>
      <DashboardTooltipProvider>
        <DashboardAppSidebarDynamic
          navUser={{
            name: session.user.name ?? 'Usuario',
            email: session.user.email ?? '',
            avatar: session.user.image ?? '',
          }}
        />
        <SidebarInset className="min-w-0 bg-gradient-to-br from-zinc-50 to-zinc-100 dark:from-zinc-900 dark:to-zinc-950">
          <header className="sticky top-0 z-50 h-16 min-w-0 shrink-0 border-b border-border/80 bg-zinc-50 shadow-sm transition-[height] ease-linear dark:border-[#3E3E3A]/30 dark:bg-zinc-900 group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
            <DashboardHeaderToolbarDynamic />
          </header>
          <div className="mt-4 flex min-h-screen min-w-0 flex-1 flex-col gap-4 bg-transparent p-4 pt-0">
            <div className="container-fluid mx-8">
              <Suspense>{children}</Suspense>
            </div>
          </div>
        </SidebarInset>
      </DashboardTooltipProvider>
    </SidebarProvider>
  );
}
