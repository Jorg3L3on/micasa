'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  cancelFrame,
  frame,
  motion,
  MotionConfig,
  useReducedMotion,
  type Transition,
} from 'framer-motion';
import {
  createContext,
  useCallback,
  useContext,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { EASE_OUT } from '@/components/motion/ease';
import { cn } from '@/lib/utils';

type Variant = 'pill' | 'underline' | 'segment';

type Ctx = {
  value: string;
  setValue: (v: string) => void;
  layoutId: string;
  variant: Variant;
};

const TabsCtx = createContext<Ctx | null>(null);

const useTabs = () => {
  const ctx = useContext(TabsCtx);
  if (!ctx) throw new Error('Tabs.* must be used inside <Tabs>');
  return ctx;
};

const transition: Transition = {
  type: 'spring',
  stiffness: 245,
  damping: 36,
  mass: 1.2,
};

export const Tabs = ({
  defaultValue,
  value,
  onValueChange,
  variant = 'pill',
  children,
  className,
}: {
  defaultValue?: string;
  value?: string;
  onValueChange?: (v: string) => void;
  variant?: Variant;
  children: ReactNode;
  className?: string;
}) => {
  const [internal, setInternal] = useState(defaultValue ?? '');
  const layoutId = useId();
  const reduce = useReducedMotion();
  const controlled = value !== undefined;
  const current = controlled ? value : internal;
  const setValue = useCallback(
    (next: string) => {
      if (!controlled) setInternal(next);
      onValueChange?.(next);
    },
    [controlled, onValueChange],
  );
  const contextValue = useMemo(
    () => ({ value: current, setValue, layoutId, variant }),
    [current, layoutId, setValue, variant],
  );

  return (
    <MotionConfig transition={reduce ? { duration: 0 } : transition}>
      <TabsCtx.Provider value={contextValue}>
        <motion.div layoutRoot className={className}>
          {children}
        </motion.div>
      </TabsCtx.Provider>
    </MotionConfig>
  );
};

const listClasses: Record<Variant, string> = {
  pill: 'inline-flex items-center gap-1 rounded-full bg-card p-1',
  underline: 'inline-flex items-center gap-1 border-b border-border',
  segment: 'inline-flex items-center gap-0 rounded-lg bg-card p-0.5',
};

export const TabsList = ({
  children,
  className,
  wrapperClassName,
  'aria-label': ariaLabel,
}: {
  children: ReactNode;
  className?: string;
  wrapperClassName?: string;
  'aria-label'?: string;
}) => {
  const { variant, value, setValue } = useTabs();
  const reduce = useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const viewportId = useId();
  const [edges, setEdges] = useState({
    overflow: false,
    left: false,
    right: false,
  });

  const measure = useCallback(() => {
    const root = rootRef.current;
    const viewport = viewportRef.current;
    if (!root || !viewport) return;
    const overflow = viewport.scrollWidth > root.clientWidth + 1;
    const max = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
    const rtl = getComputedStyle(viewport).direction === 'rtl';
    const fromLeft = Math.max(
      0,
      Math.min(max, rtl ? max + viewport.scrollLeft : viewport.scrollLeft),
    );
    const next = {
      overflow,
      left: fromLeft > 1,
      right: fromLeft < max - 1,
    };
    setEdges((previous) =>
      previous.overflow === next.overflow &&
      previous.left === next.left &&
      previous.right === next.right
        ? previous
        : next,
    );
  }, []);

  const reveal = useCallback(
    (tab: HTMLElement | null) => {
      const viewport = viewportRef.current;
      if (!viewport || !tab) return;
      const frameBox = viewport.getBoundingClientRect();
      const item = tab.getBoundingClientRect();
      const max = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
      const rtl = getComputedStyle(viewport).direction === 'rtl';
      const fromLeft = Math.max(
        0,
        Math.min(max, rtl ? max + viewport.scrollLeft : viewport.scrollLeft),
      );
      const left = frameBox.left + (fromLeft > 1 ? 36 : 0);
      const right = frameBox.right - (fromLeft < max - 1 ? 36 : 0);
      const delta =
        item.left < left
          ? item.left - left
          : item.right > right
            ? item.right - right
            : 0;
      if (delta) {
        viewport.scrollBy({
          left: delta,
          behavior: reduce ? 'instant' : 'smooth',
        });
      }
    },
    [reduce],
  );

  useLayoutEffect(() => {
    const root = rootRef.current;
    const viewport = viewportRef.current;
    const list = listRef.current;
    if (!root || !viewport || !list) return;
    const update = () => {
      measure();
      reveal(
        list.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]'),
      );
    };
    const observer = new ResizeObserver(update);
    observer.observe(root);
    observer.observe(viewport);
    observer.observe(list);
    viewport.addEventListener('scroll', measure, { passive: true });
    update();
    return () => {
      observer.disconnect();
      viewport.removeEventListener('scroll', measure);
    };
  }, [measure, reveal]);

  useLayoutEffect(() => {
    void children;
    void value;
    void edges.overflow;
    measure();
    reveal(
      listRef.current?.querySelector<HTMLElement>(
        '[role="tab"][aria-selected="true"]',
      ) ?? null,
    );
  }, [children, value, edges.overflow, measure, reveal]);

  useLayoutEffect(() => {
    if (variant === 'underline') return;
    const list = listRef.current;
    if (!list) return;
    void children;
    const labels = Array.from(
      list.querySelectorAll<HTMLElement>('[data-tabs-label]'),
    );
    const indicator = list.querySelector<HTMLElement>('[data-tabs-indicator]');
    const target = list.querySelector<HTMLElement>(
      '[role="tab"][aria-selected="true"]',
    );
    if (!indicator || !target || target.dataset.tabsValue !== value) {
      for (const label of labels) label.style.clipPath = 'inset(0 100% 0 0)';
      return;
    }
    let frames = 0;
    let stillFrames = 0;
    let previous: { left: number; right: number } | undefined;
    const syncClips = () => {
      const pill = (reduce ? target : indicator).getBoundingClientRect();
      const clips = labels.map((label) => {
        const bounds = label.getBoundingClientRect();
        const left = Math.max(
          0,
          Math.min(bounds.width, pill.left - bounds.left),
        );
        const right = Math.max(
          0,
          Math.min(bounds.width, bounds.right - pill.right),
        );
        return left + right >= bounds.width
          ? 'inset(0 100% 0 0)'
          : `inset(0 ${right}px 0 ${left}px)`;
      });
      labels.forEach((label, index) => {
        if (label.style.clipPath !== clips[index]) {
          label.style.clipPath = clips[index];
        }
      });
      frames += 1;
      stillFrames =
        previous &&
        Math.abs(pill.left - previous.left) < 0.01 &&
        Math.abs(pill.right - previous.right) < 0.01
          ? stillFrames + 1
          : 0;
      previous = { left: pill.left, right: pill.right };
      if (reduce || (frames > 2 && stillFrames >= 2)) cancelFrame(syncClips);
    };
    frame.postRender(syncClips, true);
    return () => cancelFrame(syncClips);
  }, [value, children, variant, reduce]);

  const scroll = (direction: number) => {
    const viewport = viewportRef.current;
    if (viewport) {
      viewport.scrollBy({
        left: direction * viewport.clientWidth * 0.8,
        behavior: reduce ? 'instant' : 'smooth',
      });
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (
      event.key !== 'ArrowRight' &&
      event.key !== 'ArrowLeft' &&
      event.key !== 'Home' &&
      event.key !== 'End'
    ) {
      return;
    }
    const tabs = Array.from(
      listRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]') ??
        [],
    );
    if (tabs.length === 0) return;
    const currentIndex = Math.max(
      0,
      tabs.findIndex((tab) => tab.getAttribute('aria-selected') === 'true'),
    );
    let nextIndex = currentIndex;
    if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % tabs.length;
    if (event.key === 'ArrowLeft') {
      nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    }
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = tabs.length - 1;
    event.preventDefault();
    const next = tabs[nextIndex];
    const nextValue = next?.dataset.tabsValue;
    if (!next || !nextValue) return;
    setValue(nextValue);
    next.focus();
  };

  const controlClass =
    'absolute inset-y-0 z-20 inline-flex w-9 items-center justify-center text-foreground transition-opacity hover:opacity-70 focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-0';
  const surfaceClass =
    variant === 'pill'
      ? 'rounded-full bg-card'
      : variant === 'segment'
        ? 'rounded-lg bg-card'
        : '';

  return (
    <div
      ref={rootRef}
      className={cn(
        'relative isolate flex w-full max-w-full min-w-0 items-center',
        edges.overflow && surfaceClass,
        wrapperClassName,
      )}
    >
      {edges.overflow ? (
        <button
          type="button"
          aria-label="Desplazar pestañas a la izquierda"
          aria-controls={viewportId}
          disabled={!edges.left}
          onClick={() => scroll(-1)}
          className={cn(controlClass, 'left-0 rounded-l-full')}
        >
          <ChevronLeft size={20} aria-hidden="true" />
        </button>
      ) : null}
      <motion.div
        ref={viewportRef}
        id={viewportId}
        layoutScroll
        className={cn(
          'w-full min-w-0 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
          edges.overflow && '[border-radius:inherit]',
        )}
        style={
          edges.overflow
            ? {
                maskImage: `linear-gradient(to right, ${edges.left ? 'transparent, black 40px' : 'black, black 0px'}, ${edges.right ? 'black calc(100% - 40px), transparent' : 'black 100%'})`,
              }
            : undefined
        }
        onFocusCapture={(event) => {
          if (
            event.target instanceof HTMLElement &&
            event.target.getAttribute('role') === 'tab'
          ) {
            reveal(event.target);
          }
        }}
      >
        <div
          ref={listRef}
          role="tablist"
          aria-label={ariaLabel}
          onKeyDown={handleKeyDown}
          className={cn(listClasses[variant], 'w-max', className)}
        >
          {children}
        </div>
      </motion.div>
      {edges.overflow && edges.left ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 z-10 w-10 rounded-l-[inherit] backdrop-blur-[2px] [mask-image:linear-gradient(to_right,black,transparent)]"
        />
      ) : null}
      {edges.overflow && edges.right ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 rounded-r-[inherit] backdrop-blur-[2px] [mask-image:linear-gradient(to_left,black,transparent)]"
        />
      ) : null}
      {edges.overflow ? (
        <button
          type="button"
          aria-label="Desplazar pestañas a la derecha"
          aria-controls={viewportId}
          disabled={!edges.right}
          onClick={() => scroll(1)}
          className={cn(controlClass, 'right-0 rounded-r-full')}
        >
          <ChevronRight size={20} aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
};

export const TabsTrigger = ({
  value,
  children,
  className,
  indicatorClassName,
  stretch = false,
  'aria-label': ariaLabel,
  title,
}: {
  value: string;
  children: ReactNode;
  className?: string;
  indicatorClassName?: string;
  /** Share the row equally. Used by the fortnight switcher. */
  stretch?: boolean;
  'aria-label'?: string;
  title?: string;
}) => {
  const { value: current, setValue, layoutId, variant } = useTabs();
  const active = current === value;
  const [initialClip] = useState(() =>
    active ? 'inset(0)' : 'inset(0 100% 0 0)',
  );

  if (variant === 'underline') {
    return (
      <button
        type="button"
        role="tab"
        aria-selected={active}
        aria-label={ariaLabel}
        title={title}
        tabIndex={active ? 0 : -1}
        data-tabs-value={value}
        onClick={() => setValue(value)}
        className={cn(
          'relative isolate -mb-px inline-flex min-h-[44px] shrink-0 items-center whitespace-nowrap px-3 pb-2.5 pt-1 text-sm font-medium transition-colors',
          active
            ? 'text-foreground'
            : 'text-muted-foreground hover:text-foreground',
          className,
        )}
      >
        {children}
        {active ? (
          <motion.span
            layoutId={layoutId}
            layout
            className={cn(
              'absolute bottom-0 left-0 right-0 h-px bg-primary',
              indicatorClassName,
            )}
          />
        ) : null}
      </button>
    );
  }

  const radius = variant === 'pill' ? 'rounded-full' : 'rounded-md';

  return (
    <div className={cn('relative shrink-0', stretch && 'min-w-0 flex-1')}>
      {active ? (
        <motion.span
          data-tabs-indicator=""
          layoutId={layoutId}
          layout
          style={{ borderRadius: variant === 'pill' ? 9999 : 8 }}
          className={cn(
            'absolute inset-0 bg-primary',
            radius,
            indicatorClassName,
          )}
        />
      ) : null}
      <button
        type="button"
        role="tab"
        aria-selected={active}
        aria-label={ariaLabel}
        title={title}
        tabIndex={active ? 0 : -1}
        data-tabs-value={value}
        onClick={() => setValue(value)}
        className={cn(
          'relative z-10 inline-flex items-center justify-center whitespace-nowrap bg-transparent px-3.5 py-1.5 text-sm font-medium outline-none',
          'text-muted-foreground hover:text-foreground',
          'focus-visible:ring-2 focus-visible:ring-primary/45 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          radius,
          stretch && 'w-full',
          className,
        )}
      >
        {children}
        <span
          data-tabs-label=""
          aria-hidden="true"
          inert
          className="pointer-events-none absolute inset-0 inline-flex items-center justify-center text-primary-foreground [gap:inherit] [padding:inherit]"
          style={{ clipPath: initialClip }}
        >
          {children}
        </span>
      </button>
    </div>
  );
};

export const TabsContent = ({
  value,
  children,
  className,
}: {
  value: string;
  children: ReactNode;
  className?: string;
}) => {
  const { value: current } = useTabs();
  const reduce = useReducedMotion();
  if (current !== value) return null;

  return (
    <motion.div
      key={value}
      initial={{ opacity: 0, y: reduce ? 0 : 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: EASE_OUT }}
      className={cn('mt-4', className)}
    >
      {children}
    </motion.div>
  );
};
