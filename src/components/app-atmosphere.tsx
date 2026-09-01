/** Soft navy/magenta mesh behind the logged-in app chrome. */
export const AppAtmosphere = () => (
  <div
    aria-hidden
    className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
  >
    <div className="absolute -left-24 -top-28 hidden h-[32rem] w-[32rem] rounded-full bg-[#3a37fc]/22 blur-3xl dark:block" />
    <div className="absolute -right-16 top-0 hidden h-[26rem] w-[26rem] rounded-full bg-[#ee477a]/16 blur-3xl dark:block" />
    <div className="absolute bottom-0 left-1/3 hidden h-72 w-[32rem] -translate-x-1/2 rounded-full bg-[#911efe]/14 blur-3xl dark:block" />
    <div className="absolute inset-0 hidden opacity-[0.22] [background-image:linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] [background-size:64px_64px] [mask-image:radial-gradient(ellipse_at_center,black_18%,transparent_72%)] dark:block" />
  </div>
);
