import { ViewTransition } from 'react';

import { BrandLoader } from '@/components/brand/BrandLoader';

/**
 * Root boundary: streams while the (app) layout resolves auth + DB, so a cold
 * PWA launch shows the brand instead of a blank screen. Layout is mirrored by
 * scripts/generate-ios-splash.mjs (centered on the full screen, no insets) so
 * the iOS startup image hands off without a jump. Fades out instead of
 * cutting to the app shell.
 */
export default function RootLoading() {
  return (
    <ViewTransition exit="fade-out">
      <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-6 bg-[#060914] px-6 text-[#f7f8ff]">
        <BrandLoader />
        <div className="flex flex-col items-center gap-1.5 text-center">
          <span className="font-[family-name:var(--font-display)] text-xl font-bold tracking-tight">
            MiCasa
          </span>
          <span className="brand-loader-breathe text-xs text-white/55">
            Cargando tu panel…
          </span>
        </div>
      </div>
    </ViewTransition>
  );
}
