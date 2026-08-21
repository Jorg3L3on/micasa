import type { ReactNode } from 'react';

type ViewTransitionClass = 'none' | 'auto' | (string & {});

type ViewTransitionClassPerType = {
  default: ViewTransitionClass;
} & Record<string, ViewTransitionClass>;

type ViewTransitionClassProp = ViewTransitionClass | ViewTransitionClassPerType;

declare module 'react' {
  export interface ViewTransitionProps {
    children?: ReactNode;
    name?: 'auto' | 'none' | (string & {});
    default?: ViewTransitionClassProp;
    enter?: ViewTransitionClassProp;
    exit?: ViewTransitionClassProp;
    share?: ViewTransitionClassProp;
    update?: ViewTransitionClassProp;
  }

  /**
   * React View Transition boundary (Next.js App Router / React canary).
   * @see https://react.dev/reference/react/ViewTransition
   */
  export const ViewTransition: (props: ViewTransitionProps) => ReactNode;

  /** Tag the current Transition so type-keyed ViewTransition props can match. */
  export function addTransitionType(type: string): void;

  interface CSSProperties {
    viewTransitionName?: string;
  }
}

export {};
