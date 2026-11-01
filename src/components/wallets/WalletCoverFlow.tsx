'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from 'react';
import {
  animate,
  motion,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useTransform,
  type MotionValue,
} from 'framer-motion';
import {
  clampFlowIndex,
  coverFlowSlot,
  rubberBandPosition,
  settleFlowIndex,
} from '@/lib/ui/wallet-cover-flow';
import { cn } from '@/lib/utils';
import type { WalletListItem } from '@/types/catalog';
import { WalletFlowFace } from '@/components/wallets/WalletFlowFace';

const TAP_SLOP_PX = 8;
const WHEEL_STEP_COOLDOWN_MS = 280;
const WHEEL_SETTLE_MS = 110;
/** Cards farther than this from the front are hidden from paint and the a11y tree. */
const HIDDEN_DISTANCE = 3;

const SETTLE_SPRING = { type: 'spring', stiffness: 260, damping: 30, mass: 0.9 } as const;
const REDUCED_SETTLE = { type: 'tween', duration: 0.12, ease: 'easeOut' } as const;

type FlowCardProps = {
  wallet: WalletListItem;
  index: number;
  count: number;
  position: MotionValue<number>;
  reducedMotion: boolean;
  isFront: boolean;
  onClick: () => void;
};

const FlowCard = ({
  wallet,
  index,
  count,
  position,
  reducedMotion,
  isFront,
  onClick,
}: FlowCardProps) => {
  const offset = useTransform(position, (p) => index - p);
  const transform = useTransform(offset, (d) => {
    const slot = coverFlowSlot(d);
    const turn = reducedMotion ? 0 : slot.rotateY;
    const scale = reducedMotion ? 1 : slot.scale;
    return `translateX(calc(-50% + var(--flow-w) * ${slot.shift})) scale(${scale}) rotateY(${turn}deg)`;
  });
  const opacity = useTransform(offset, (d) => coverFlowSlot(d).opacity);
  const pointerEvents = useTransform(offset, (d) =>
    coverFlowSlot(d).opacity < 0.05 ? 'none' : 'auto',
  );
  const zIndex = useTransform(offset, (d) => coverFlowSlot(d).zIndex);
  const visibility = useTransform(offset, (d) =>
    Math.abs(d) > HIDDEN_DISTANCE ? 'hidden' : 'visible',
  );
  // The art inside the frame drifts against the rail's motion.
  const drift = useTransform(offset, (d) =>
    reducedMotion ? 0 : Math.max(-1.5, Math.min(1.5, d)) * -14,
  );
  // Shadow and reflection belong to the card nearest the front.
  const grounding = useTransform(offset, (d) => Math.max(0, 1 - Math.abs(d)));

  return (
    <motion.div
      role="group"
      aria-roledescription="diapositiva"
      aria-label={`${index + 1} de ${count}: ${wallet.name}`}
      aria-hidden={isFront ? undefined : true}
      onClick={onClick}
      className="absolute left-1/2 top-2 w-[var(--flow-w)] will-change-transform"
      style={{ transform, opacity, zIndex, visibility, pointerEvents }}
    >
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-x-[8%] -bottom-3 h-8 rounded-[50%] bg-black/45 blur-xl dark:bg-black/70"
        style={{ opacity: grounding }}
      />
      <WalletFlowFace wallet={wallet} drift={drift} />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-full mt-1 origin-top [mask-image:linear-gradient(to_bottom,rgba(0,0,0,0.22),transparent_50%)]"
        style={{ opacity: grounding, scaleY: -1 }}
      >
        <WalletFlowFace wallet={wallet} drift={drift} />
      </motion.div>
    </motion.div>
  );
};

type WalletCoverFlowProps = {
  wallets: WalletListItem[];
  activeIndex: number;
  onActiveIndexChange: (index: number) => void;
  /** Tap or Enter on the front card. */
  onOpen: (wallet: WalletListItem) => void;
  ariaLabel: string;
};

/**
 * Depth rail in the style of Arc's cover flow. The front face stands forward,
 * the rest turn and recede, and the art drifts inside each frame. Drag or
 * throw (momentum, at least one card per flick, rubber-banded ends), sideways
 * trackpad scroll, arrow keys, Home/End, a click on a side card or the ticks
 * move the rail; activating the front card opens the wallet.
 */
export const WalletCoverFlow = ({
  wallets,
  activeIndex,
  onActiveIndexChange,
  onOpen,
  ariaLabel,
}: WalletCoverFlowProps) => {
  const count = wallets.length;
  const active = clampFlowIndex(activeIndex, count);
  const reducedMotion = useReducedMotion() ?? false;
  const position = useMotionValue(active);
  const stageRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{
    startX: number;
    startPosition: number;
    lastX: number;
    lastT: number;
    velocity: number;
    moved: boolean;
  } | null>(null);
  const suppressClick = useRef(false);
  const settling = useRef<ReturnType<typeof animate> | null>(null);
  const programmatic = useRef(false);
  const reportedIndex = useRef(active);
  const wheelState = useRef({ lastStep: 0, timer: 0 });
  const [dragging, setDragging] = useState(false);

  const cardWidth = () =>
    stageRef.current?.querySelector<HTMLElement>('[role="group"]')?.offsetWidth ?? 240;

  const report = useCallback(
    (index: number) => {
      if (index === reportedIndex.current) return;
      reportedIndex.current = index;
      onActiveIndexChange(index);
    },
    [onActiveIndexChange],
  );

  const settleTo = useCallback(
    (index: number) => {
      settling.current?.stop();
      const target = clampFlowIndex(index, count);
      settling.current = animate(position, target, {
        ...(reducedMotion ? REDUCED_SETTLE : SETTLE_SPRING),
        onComplete: () => {
          programmatic.current = false;
        },
      });
      report(target);
    },
    [count, position, reducedMotion, report],
  );

  // Selection changed from outside (attention block, filters): bring it forward.
  // Our own reports echo back through `activeIndex`, so those are skipped.
  useEffect(() => {
    if (reportedIndex.current === active || drag.current) return;
    reportedIndex.current = active;
    programmatic.current = true;
    settling.current?.stop();
    settling.current = animate(position, active, {
      ...(reducedMotion ? REDUCED_SETTLE : SETTLE_SPRING),
      onComplete: () => {
        programmatic.current = false;
      },
    });
  }, [active, position, reducedMotion]);

  // A shorter list (filters) must not leave the rail past its last card.
  useEffect(() => {
    if (position.get() > count - 1) position.set(Math.max(0, count - 1));
  }, [count, position]);

  // While a drag passes over cards, keep the caption and actions in step.
  useMotionValueEvent(position, 'change', (p) => {
    if (programmatic.current || !drag.current) return;
    report(clampFlowIndex(Math.round(p), count));
  });

  // Sideways trackpad scroll moves the rail, then settles with its momentum.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const state = wheelState.current;
    const onWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return;
      event.preventDefault();
      if (reducedMotion) {
        const now = performance.now();
        if (Math.abs(event.deltaX) > 20 && now - state.lastStep > WHEEL_STEP_COOLDOWN_MS) {
          state.lastStep = now;
          settleTo(Math.round(position.get()) + Math.sign(event.deltaX));
        }
        return;
      }
      settling.current?.stop();
      programmatic.current = false;
      const next = rubberBandPosition(
        position.get() + event.deltaX / (cardWidth() * 0.9),
        count,
      );
      position.set(next);
      report(clampFlowIndex(Math.round(next), count));
      window.clearTimeout(state.timer);
      state.timer = window.setTimeout(() => {
        settleTo(Math.round(position.get()));
      }, WHEEL_SETTLE_MS);
    };
    stage.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      stage.removeEventListener('wheel', onWheel);
      window.clearTimeout(state.timer);
    };
  }, [count, position, reducedMotion, report, settleTo]);

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    settling.current?.stop();
    programmatic.current = false;
    drag.current = {
      startX: event.clientX,
      startPosition: position.get(),
      lastX: event.clientX,
      lastT: performance.now(),
      velocity: 0,
      moved: false,
    };
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    const dx = event.clientX - d.startX;
    if (!d.moved && Math.abs(dx) > TAP_SLOP_PX) {
      d.moved = true;
      // Capture only once it is a drag: capturing on press would retarget the
      // click to the stage and a tap on a background card would never land.
      event.currentTarget.setPointerCapture(event.pointerId);
      setDragging(true);
    }
    if (!d.moved) return;
    const width = cardWidth() * 0.62;
    const next = rubberBandPosition(d.startPosition - dx / width, count);
    const now = performance.now();
    const dt = Math.max(1, now - d.lastT);
    // Rail speed in cards per second, smoothed so one jittery frame doesn't throw it.
    const instant = (-(event.clientX - d.lastX) / width / dt) * 1000;
    d.velocity = d.velocity * 0.6 + instant * 0.4;
    d.lastX = event.clientX;
    d.lastT = now;
    position.set(next);
  };

  const handlePointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    drag.current = null;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (!d) return;
    suppressClick.current = d.moved;
    if (!d.moved) return;
    const dx = event.clientX - d.startX;
    const stale = performance.now() - d.lastT > 80;
    settleTo(
      reducedMotion
        ? Math.round(d.startPosition) + (Math.abs(dx) > 40 ? -Math.sign(dx) : 0)
        : settleFlowIndex(position.get(), stale ? 0 : d.velocity, count),
    );
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const current = Math.round(position.get());
    const go = (index: number) => {
      event.preventDefault();
      settleTo(index);
    };
    if (event.key === 'ArrowRight') go(current + 1);
    else if (event.key === 'ArrowLeft') go(current - 1);
    else if (event.key === 'Home') go(0);
    else if (event.key === 'End') go(count - 1);
    else if (event.key === 'Enter' && wallets[active]) {
      event.preventDefault();
      onOpen(wallets[active]);
    }
  };

  const handleCardClick = (index: number) => {
    // A drag that ended on a card must not count as a tap.
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    if (index === active) onOpen(wallets[index]);
    else settleTo(index);
  };

  return (
    <div className="w-full [container-type:inline-size]">
      <div
        ref={stageRef}
        aria-roledescription="carrusel"
        aria-label={ariaLabel}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        className={cn(
          'relative mx-auto h-[calc(var(--flow-w)/1.586+4.5rem)] w-full touch-pan-y select-none overflow-hidden rounded-face outline-none [--flow-w:clamp(280px,76cqw,544px)] [perspective:1100px] focus-visible:ring-2 focus-visible:ring-ring',
          dragging ? 'cursor-grabbing' : 'cursor-grab',
        )}
      >
        {wallets.map((wallet, index) => (
          <FlowCard
            key={wallet.id}
            wallet={wallet}
            index={index}
            count={count}
            position={position}
            reducedMotion={reducedMotion}
            isFront={index === active}
            onClick={() => handleCardClick(index)}
          />
        ))}
      </div>

      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {wallets[active]
          ? `${active + 1} de ${count}: ${wallets[active].name}`
          : null}
      </div>

      {count > 1 ? (
        <div className="mt-1 flex items-center justify-center gap-2">
          {wallets.map((wallet, index) => (
            <button
              key={wallet.id}
              type="button"
              tabIndex={-1}
              aria-label={`Mostrar ${wallet.name}`}
              aria-current={index === active ? 'true' : undefined}
              onClick={() => settleTo(index)}
              className="group flex h-6 items-center justify-center px-0.5"
            >
              <span
                className={cn(
                  'block h-1.5 rounded-full transition-all motion-reduce:transition-none',
                  index === active
                    ? 'w-6 bg-foreground'
                    : 'w-1.5 bg-muted-foreground/40 group-hover:bg-muted-foreground/70',
                )}
              />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
};
