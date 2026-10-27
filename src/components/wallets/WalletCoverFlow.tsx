'use client';

import {
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from 'react';
import {
  clampFlowIndex,
  coverFlowSlot,
} from '@/lib/ui/wallet-cover-flow';
import { cn } from '@/lib/utils';
import type { WalletListItem } from '@/types/catalog';
import { WalletFlowFace } from '@/components/wallets/WalletFlowFace';

const SWIPE_THRESHOLD_PX = 40;
const TAP_SLOP_PX = 8;

type WalletCoverFlowProps = {
  wallets: WalletListItem[];
  activeIndex: number;
  onActiveIndexChange: (index: number) => void;
  /** Tap or Enter on the centered card. */
  onOpen: (wallet: WalletListItem) => void;
  ariaLabel: string;
};

/**
 * Cover flow: the active face is flat and centered, neighbors tilt away.
 * Swipe or drag, arrow keys, a tap on a side card or the dots change the
 * selection; activating the centered card opens the wallet.
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
  const dragStart = useRef<{ x: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  const [dragging, setDragging] = useState(false);

  const go = (index: number) => onActiveIndexChange(clampFlowIndex(index, count));

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    dragStart.current = { x: event.clientX, moved: false };
    setDragging(true);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const start = dragStart.current;
    if (!start) return;
    if (Math.abs(event.clientX - start.x) > TAP_SLOP_PX) start.moved = true;
  };

  const handlePointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    const start = dragStart.current;
    dragStart.current = null;
    setDragging(false);
    if (!start) return;
    const delta = event.clientX - start.x;
    suppressClick.current = start.moved;
    if (Math.abs(delta) >= SWIPE_THRESHOLD_PX) go(active + (delta < 0 ? 1 : -1));
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      go(active + 1);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      go(active - 1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      go(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      go(count - 1);
    } else if (event.key === 'Enter' && wallets[active]) {
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
    else go(index);
  };

  return (
    <div className="w-full">
      <div
        role="group"
        aria-roledescription="carrusel"
        aria-label={ariaLabel}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        className={cn(
          'relative mx-auto h-[calc(var(--flow-w)/1.586+2rem)] w-full touch-pan-y select-none overflow-hidden rounded-face py-4 outline-none [--flow-w:min(72%,20rem)] [perspective:1200px] focus-visible:ring-2 focus-visible:ring-ring md:[--flow-w:18rem]',
          dragging ? 'cursor-grabbing' : 'cursor-grab',
        )}
      >
        {wallets.map((wallet, index) => {
          const slot = coverFlowSlot(index - active);
          const isActive = index === active;
          return (
            <div
              key={wallet.id}
              role="button"
              aria-roledescription="diapositiva"
              aria-label={`${wallet.name}, ${index + 1} de ${count}${isActive ? '' : '. Seleccionar'}`}
              aria-current={isActive ? 'true' : undefined}
              tabIndex={-1}
              onClick={() => handleCardClick(index)}
              className={cn(
                'absolute left-1/2 top-4 w-[var(--flow-w)] transition-[transform,opacity] duration-300 ease-out will-change-transform motion-reduce:transition-opacity motion-reduce:duration-150',
                slot.opacity === 0 && 'pointer-events-none',
              )}
              style={{
                zIndex: slot.zIndex,
                opacity: slot.opacity,
                transform: `translateX(calc(-50% + var(--flow-w) * ${slot.shift})) scale(${slot.scale}) rotateY(${slot.rotateY}deg)`,
              }}
            >
              <WalletFlowFace wallet={wallet} />
            </div>
          );
        })}
      </div>

      {count > 1 ? (
        <div
          className="mt-3 flex items-center justify-center gap-2"
          role="tablist"
          aria-label="Billeteras"
        >
          {wallets.map((wallet, index) => (
            <button
              key={wallet.id}
              type="button"
              role="tab"
              aria-selected={index === active}
              aria-label={`Ir a ${wallet.name}`}
              onClick={() => go(index)}
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
