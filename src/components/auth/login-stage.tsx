import Link from 'next/link';

import { FortnightPulse } from '@/components/auth/fortnight-pulse';
import { MicasaMark } from '@/components/brand/micasa-mark';
import { cn } from '@/lib/utils';

type LoginStageProps = {
  children: React.ReactNode;
  className?: string;
};

/** Dark aurora shell + two-column glass panel for the login experience. */
export const LoginStage = ({ children, className }: LoginStageProps) => {
  return (
    <div
      className={cn(
        'dark relative flex min-h-svh items-center justify-center overflow-x-hidden bg-[#060914] px-5 py-8 text-[#f7f8ff]',
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

      <div className="relative z-[1] w-full max-w-[880px]">
        <div className="relative grid overflow-hidden rounded-3xl border border-white/[0.09] bg-[rgba(20,20,27,0.55)] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.6),0_0_0_1px_rgba(255,255,255,0.02)_inset] backdrop-blur-[28px] backdrop-saturate-150 max-[780px]:mx-auto max-[780px]:max-w-[420px] max-[780px]:grid-cols-1 min-[781px]:grid-cols-2">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-3xl p-px"
            style={{
              background:
                'linear-gradient(135deg, rgba(58,55,252,0.4), transparent 30%, transparent 70%, rgba(238,71,122,0.35))',
              WebkitMask:
                'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
              WebkitMaskComposite: 'xor',
              maskComposite: 'exclude',
            }}
          />

          <aside className="relative flex flex-col border-b border-white/[0.09] bg-linear-to-b from-[#3a37fc]/[0.08] to-[#ee477a]/[0.06] px-7 pt-8 pb-7 max-[780px]:gap-7 min-[781px]:justify-between min-[781px]:border-r min-[781px]:border-b-0 min-[781px]:px-10 min-[781px]:py-12">
            <Link
              href="/"
              className="inline-flex items-center gap-2.5 font-semibold tracking-tight text-[#f4f3f8]"
              aria-label="MiCasa inicio"
            >
              <MicasaMark className="h-8 w-auto" />
              <span className="text-base">MiCasa</span>
            </Link>

            <div className="min-[781px]:mt-10">
              <p className="mb-3.5 text-[11px] font-semibold tracking-[0.14em] text-[#55535f] uppercase">
                Bienvenido de vuelta
              </p>
              <p className="max-w-[260px] text-[26px] leading-[1.25] font-semibold tracking-tight text-[#f4f3f8]">
                Tu dinero,{' '}
                <em className="bg-linear-to-br from-[#3a37fc] to-[#ee477a] bg-clip-text not-italic text-transparent">
                  quincena
                </em>{' '}
                tras quincena.
              </p>
            </div>

            <FortnightPulse className="max-[780px]:mt-0 min-[781px]:mt-10" />
          </aside>

          <div className="relative flex flex-col px-7 py-8 sm:px-11 sm:py-12 max-[780px]:pt-8">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};
