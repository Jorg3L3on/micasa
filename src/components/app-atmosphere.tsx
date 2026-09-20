/** Quiet navy wash behind the logged-in app — a hint of color, not a glow. */
export const AppAtmosphere = () => (
  <div
    aria-hidden
    className="pointer-events-none absolute inset-0 z-0 overflow-hidden [contain:paint]"
  >
    <div className="absolute -left-40 -top-48 hidden h-[34rem] w-[34rem] rounded-full bg-[#3a37fc]/7 blur-3xl dark:block" />
    <div className="absolute -right-28 top-[30%] hidden h-[20rem] w-[20rem] rounded-full bg-[#3a37fc]/4 blur-3xl dark:block" />
    <div className="absolute -bottom-16 left-1/2 hidden h-56 w-[24rem] -translate-x-1/2 rounded-full bg-[#3a37fc]/5 blur-3xl dark:block" />
  </div>
);
