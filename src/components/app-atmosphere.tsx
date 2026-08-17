/** Soft navy/magenta mesh behind the logged-in app chrome. */
export const AppAtmosphere = () => (
  <div
    aria-hidden
    className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
  >
    <div className="absolute -left-24 -top-28 hidden h-[28rem] w-[28rem] rounded-full bg-[#3a37fc]/18 blur-3xl dark:block" />
    <div className="absolute -right-16 top-0 hidden h-[22rem] w-[22rem] rounded-full bg-[#ee477a]/12 blur-3xl dark:block" />
    <div className="absolute bottom-0 left-1/3 hidden h-64 w-[28rem] -translate-x-1/2 rounded-full bg-[#911efe]/10 blur-3xl dark:block" />
  </div>
);
