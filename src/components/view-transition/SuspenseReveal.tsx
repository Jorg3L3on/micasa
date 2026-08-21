import { Suspense, ViewTransition, type ReactNode } from 'react';

/**
 * Skeleton → content reveal via View Transitions.
 * Use string enter/exit (not type maps) — Suspense resolves have no transition type.
 */
export function SuspenseReveal({
  fallback,
  children,
}: {
  fallback: ReactNode;
  children: ReactNode;
}) {
  return (
    <Suspense fallback={<SkeletonExit>{fallback}</SkeletonExit>}>
      <ContentEnter>{children}</ContentEnter>
    </Suspense>
  );
}

/** Wrap `loading.tsx` skeletons so they slide out when content arrives. */
export function SkeletonExit({ children }: { children: ReactNode }) {
  return <ViewTransition exit="slide-down">{children}</ViewTransition>;
}

/** Wrap page / async content that pairs with a skeleton fallback. */
export function ContentEnter({ children }: { children: ReactNode }) {
  return (
    <ViewTransition enter="slide-up" default="none">
      {children}
    </ViewTransition>
  );
}
