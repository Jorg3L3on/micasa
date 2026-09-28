import type { Metadata } from 'next';
import { WifiOff } from 'lucide-react';
import { RetryButton } from './RetryButton';

export const dynamic = 'force-static';

export const metadata: Metadata = {
  title: 'Sin conexión',
  robots: { index: false },
};

/**
 * Served by public/sw.js when a navigation fails offline; the worker
 * precaches this page and the static assets it references.
 */
export default function OfflinePage() {
  return (
    <main data-offline-page className="dark flex min-h-svh flex-col items-center justify-center gap-6 bg-background px-6 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] text-center text-foreground">
      <span className="relative flex size-20 items-center justify-center rounded-3xl border border-white/[0.08] bg-white/[0.04] shadow-card">
        {/* eslint-disable-next-line @next/next/no-img-element -- precached asset, must render offline */}
        <img src="/brand/mark-160.png" alt="" width={44} height={44} className="size-11" />
        <span className="absolute -right-1.5 -bottom-1.5 flex size-7 items-center justify-center rounded-full border border-white/10 bg-card">
          <WifiOff className="size-3.5 text-status-pending" aria-hidden />
        </span>
      </span>
      <div className="max-w-xs space-y-2">
        <h1 className="text-xl font-bold tracking-tight">Sin conexión</h1>
        <p className="text-sm text-muted-foreground">
          Para mostrarte saldos exactos, MiCasa necesita internet. Revisa tu
          conexión e inténtalo de nuevo.
        </p>
      </div>
      <RetryButton />
    </main>
  );
}
