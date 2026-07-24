import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Shield } from 'lucide-react';
import { auth } from '@/lib/auth';
import { requireAdmin } from '@/lib/server/require-admin';

export const metadata: Metadata = {
  title: 'Admin · MiCasa',
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login');
  }

  const admin = await requireAdmin();
  if (!admin) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border/80 bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-4">
          <Link
            href="/admin"
            className="flex items-center gap-2 text-sm font-semibold text-foreground"
            aria-label="Ir al panel de administración"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/10 dark:bg-amber-500/15">
              <Shield
                className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400"
                aria-hidden
              />
            </span>
            Admin
          </Link>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="hidden sm:inline truncate max-w-[200px]">
              {admin.email}
            </span>
            <Link
              href="/dashboard"
              className="rounded-md px-2 py-1.5 transition-colors hover:bg-muted/60 hover:text-foreground"
            >
              Volver a la app
            </Link>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}
