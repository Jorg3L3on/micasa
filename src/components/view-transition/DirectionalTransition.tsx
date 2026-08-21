import { ViewTransition, type ReactNode } from 'react';

/**
 * Hierarchical page enter/exit (list ↔ detail).
 *
 * ## Invoke on a new route
 *
 * 1. Wrap the **page** (not the layout) root:
 *    ```tsx
 *    export default function DetailPage() {
 *      return (
 *        <DirectionalTransition>
 *          <div>…</div>
 *        </DirectionalTransition>
 *      );
 *    }
 *    ```
 *
 * 2. Tag the navigation with the matching type (Next 16.1 — no `transitionTypes` on Link yet):
 *    ```tsx
 *    import { addTransitionType, startTransition } from 'react';
 *    import { useRouter } from 'next/navigation';
 *
 *    startTransition(() => {
 *      addTransitionType('nav-forward'); // or 'nav-back'
 *      router.push(href);
 *    });
 *    ```
 *    Or use `navigateWithTransitionType` from `@/lib/ui/wallet-card-view-transition`
 *    (same helper works for any hierarchical push).
 *
 * 3. Optional shared element on the same navigation:
 *    ```tsx
 *    <ViewTransition name={`thing-${id}`} share="morph" default="none">
 *      <Hero />
 *    </ViewTransition>
 *    ```
 *    Same `name` on source + destination. Prefer a placeholder on the destination
 *    if real content loads async so the pair exists on first paint.
 *
 * Do **not** put this in a layout — layouts persist and never fire enter/exit on route change.
 */
export function DirectionalTransition({ children }: { children: ReactNode }) {
  return (
    <ViewTransition
      enter={{
        'nav-forward': 'nav-forward',
        'nav-back': 'nav-back',
        default: 'none',
      }}
      exit={{
        'nav-forward': 'nav-forward',
        'nav-back': 'nav-back',
        default: 'none',
      }}
      default="none"
    >
      {children}
    </ViewTransition>
  );
}
