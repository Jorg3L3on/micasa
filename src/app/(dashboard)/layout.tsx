import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import {
  DashboardAppSidebarDynamic,
  DashboardHeaderToolbarDynamic,
} from '@/components/dashboard-shell-dynamic';
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
      <DashboardAppSidebarDynamic
        navUser={{
          name: session.user.name ?? 'Usuario',
          email: session.user.email ?? '',
          avatar: session.user.image ?? '',
        }}
      />
      <SidebarInset className="min-w-0">
        <header className="sticky top-0 z-10 h-16 min-w-0 shrink-0 border-b border-border/80 bg-background shadow-sm transition-[height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
          <DashboardHeaderToolbarDynamic />
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0 mt-4 min-h-screen min-w-0 bg-muted/30">
          <div className="container mx-auto">
            <Suspense>{children}</Suspense>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
