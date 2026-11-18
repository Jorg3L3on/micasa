import type { ReactNode } from 'react';
import Link from 'next/link';

import { FortnightPulse } from '@/components/auth/fortnight-pulse';
import { MicasaMark } from '@/components/brand/micasa-mark';
import { MONTHLY_PANEL_SHELL_CLASS } from '@/components/monthly/monthly-panel-shell';
import { cn } from '@/lib/utils';

type AuthStageProps = {
  children: ReactNode;
  /** Small uppercase line above the headline in the brand aside. */
  eyebrow: string;
  /** Brand headline; defaults to the quincena tagline. */
  headline?: ReactNode;
  /** Short line under the headline (from 781px). */
  description?: ReactNode;
  /** Aside body under the headline (from 781px); defaults to the fortnight pulse. */
  aside?: ReactNode;
  /**
   * Below 781px: hide the aside and show the brand above the panel with this
   * action on the right (e.g. a login link).
   */
  mobileHeader?: ReactNode;
  className?: string;
};

const AuthBrandLink = ({ compact = false }: { compact?: boolean }) => (
  <Link
    href="/"
    className="inline-flex min-h-11 items-center gap-2.5 self-start font-semibold tracking-tight text-foreground"
    aria-label="MiCasa inicio"
  >
    <MicasaMark className={compact ? 'size-7' : 'size-8'} />
    <span className={compact ? 'text-[15px]' : 'text-base'}>MiCasa</span>
  </Link>
);

const DefaultHeadline = () => (
  <>
    Tu dinero,{' '}
    <em className="bg-linear-to-br from-[#3a37fc] to-[#ee477a] bg-clip-text not-italic text-transparent">
      quincena
    </em>{' '}
    tras quincena.
  </>
);

/**
 * Dark aurora stage + two-column planner glass panel (`MONTHLY_PANEL_SHELL_CLASS`)
 * shared by login and signup.
 * Always dark (`.dark` on the root) so tokens resolve to the Orion palette in
 * either app theme.
 */
export const AuthStage = ({
  children,
  eyebrow,
  headline = <DefaultHeadline />,
  description,
  aside,
  mobileHeader,
  className,
}: AuthStageProps) => {
  return (
    <div
      className={cn(
        'dark relative flex min-h-svh items-center justify-center overflow-x-hidden bg-background px-4 pt-[max(2rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))] text-foreground',
        className,
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0 opacity-[0.045] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-[-20%] z-0 animate-[login-aurora-drift_26s_ease-in-out_infinite_alternate] opacity-55 blur-[90px] motion-reduce:animate-none"
      >
        <div className="absolute top-[12%] left-[8%] h-[42vw] w-[42vw] rounded-full bg-[radial-gradient(circle,#3a37fc_0%,transparent_70%)] opacity-40" />
        <div className="absolute right-[6%] bottom-[8%] h-[46vw] w-[46vw] rounded-full bg-[radial-gradient(circle,#ee477a_0%,transparent_70%)] opacity-30" />
      </div>

      <div className="relative z-[1] flex w-full max-w-[920px] flex-col gap-4 max-[780px]:mx-auto max-[780px]:max-w-[420px]">
        {mobileHeader ? (
          <header className="flex min-h-11 items-center justify-between min-[781px]:hidden">
            <AuthBrandLink compact />
            {mobileHeader}
          </header>
        ) : null}

        <div
          className={cn(
            MONTHLY_PANEL_SHELL_CLASS,
            'grid overflow-hidden max-[780px]:grid-cols-1 min-[781px]:grid-cols-2',
          )}
        >
          <aside
            className={cn(
              'relative flex flex-col border-b border-white/[0.08] bg-primary/[0.05] px-6 pt-6 pb-5 max-[780px]:gap-3 min-[781px]:border-r min-[781px]:border-b-0 min-[781px]:px-9 min-[781px]:pt-9 min-[781px]:pb-8',
              mobileHeader && 'max-[780px]:hidden',
            )}
          >
            <AuthBrandLink />

            <div className="min-[781px]:mt-7">
              <p className="eyebrow mb-2.5 tracking-[0.14em] text-muted-foreground/70 max-[780px]:hidden">
                {eyebrow}
              </p>
              <p className="max-w-[280px] text-xl leading-[1.2] font-semibold tracking-tight text-foreground max-[780px]:max-w-none min-[781px]:text-[26px]">
                {headline}
              </p>
              {description ? (
                <p className="mt-2.5 max-w-[280px] text-sm leading-[1.45] text-muted-foreground max-[780px]:hidden">
                  {description}
                </p>
              ) : null}
            </div>

            {/* Phones: brand line only, so the form fits in the first screen. */}
            <div className="flex flex-1 flex-col max-[780px]:hidden min-[781px]:mt-7">
              {aside ?? <FortnightPulse className="mt-auto" />}
            </div>
          </aside>

          <div className="relative flex min-w-0 flex-col px-[18px] py-5 sm:px-11 sm:pt-10 sm:pb-8">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};
