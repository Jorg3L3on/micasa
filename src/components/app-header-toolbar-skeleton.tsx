import { cn } from "@/lib/utils";
import {
  TOOLBAR_GLASS_GROUP,
  TOOLBAR_GLASS_GROUP_DIVIDER,
} from "@/components/toolbar-glass";

const BONE = "animate-pulse bg-muted";

/**
 * Loading placeholder for `AppHeaderToolbar`. It mirrors the idle bar's
 * structure and sizes exactly (same wrapper, padding, glass action group,
 * search pill and optically centered title) so nothing jumps when the real
 * toolbar replaces it. The header (`<header data-app-chrome>`) already owns
 * height, border and background, so none are drawn here.
 */
export const AppHeaderToolbarSkeleton = () => (
  <div
    className="relative h-full w-full min-w-0 overflow-hidden"
    aria-hidden
    data-toolbar-skeleton
  >
    <div className="absolute inset-0 flex items-center gap-2 px-3 sm:px-5">
      <div className="z-10 flex min-w-0 shrink-0 items-center gap-0.5" />

      <div
        className="pointer-events-none absolute top-1/2 z-0 -translate-x-1/2 -translate-y-1/2"
        style={{ left: "50%", maxWidth: "40%" }}
      >
        <div className={cn(BONE, "h-5 w-32 max-w-full rounded")} />
      </div>

      <div className="z-10 ml-auto flex min-w-0 shrink-0 items-center justify-end gap-1.5 sm:gap-2">
        <div className={TOOLBAR_GLASS_GROUP}>
          <div className={cn(BONE, "size-9 shrink-0 rounded-full")} />
          <span className={TOOLBAR_GLASS_GROUP_DIVIDER} />
          <div className={cn(BONE, "size-9 shrink-0 rounded-full")} />
        </div>
        <div className={cn(BONE, "size-10 shrink-0 rounded-full md:hidden")} />
        <div
          className={cn(
            BONE,
            "hidden h-10 w-[350px] max-w-[350px] shrink-0 rounded-full md:block",
          )}
        />
      </div>
    </div>
  </div>
);
