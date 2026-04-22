'use client';

import { useMemo, useRef } from 'react';
import { cn, formatCurrency } from '@/lib/utils';
import type { ExpenseFeedItem } from '@/types/expenses-feed';

const MAX_CHIPS = 6;
const LONG_PRESS_MS = 450;
const MOVE_CANCEL_PX = 10;

type RepeatChipsProps = {
  items: ExpenseFeedItem[];
  onRepeat: (item: ExpenseFeedItem) => void;
  onCustomize: (item: ExpenseFeedItem) => void;
  now?: Date;
};

function todayISO(now: Date): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function pickCandidates(
  items: ExpenseFeedItem[],
  today: string,
): ExpenseFeedItem[] {
  let mostRecent: string | null = null;
  for (const it of items) {
    if (it.id < 0) continue;
    if (it.date >= today) continue;
    if (it.creditInstallmentCurrent != null) continue;
    if (it.categoryId == null || it.walletId == null) continue;
    if (mostRecent === null || it.date > mostRecent) mostRecent = it.date;
  }
  if (!mostRecent) return [];

  const seen = new Set<string>();
  const out: ExpenseFeedItem[] = [];
  for (const it of items) {
    if (it.date !== mostRecent) continue;
    if (it.id < 0) continue;
    if (it.creditInstallmentCurrent != null) continue;
    if (it.categoryId == null || it.walletId == null) continue;
    const key = `${it.description}|${it.amount}|${it.walletId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(it);
    if (out.length >= MAX_CHIPS) break;
  }
  return out;
}

export default function RepeatChips({
  items,
  onRepeat,
  onCustomize,
  now,
}: RepeatChipsProps) {
  const today = useMemo(() => todayISO(now ?? new Date()), [now]);
  const candidates = useMemo(
    () => pickCandidates(items, today),
    [items, today],
  );
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressedRef = useRef(false);
  const startRef = useRef<{ x: number; y: number } | null>(null);

  if (candidates.length === 0) return null;

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  return (
    <div className="-mx-4 px-4 pb-2 pt-1">
      <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Repetir
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {candidates.map((item) => (
          <button
            key={item.id}
            type="button"
            onPointerDown={(e) => {
              longPressedRef.current = false;
              startRef.current = { x: e.clientX, y: e.clientY };
              clearTimer();
              timerRef.current = setTimeout(() => {
                longPressedRef.current = true;
                timerRef.current = null;
                onCustomize(item);
              }, LONG_PRESS_MS);
            }}
            onPointerMove={(e) => {
              if (!startRef.current || !timerRef.current) return;
              const dx = e.clientX - startRef.current.x;
              const dy = e.clientY - startRef.current.y;
              if (Math.hypot(dx, dy) > MOVE_CANCEL_PX) clearTimer();
            }}
            onPointerUp={clearTimer}
            onPointerLeave={clearTimer}
            onPointerCancel={clearTimer}
            onContextMenu={(e) => e.preventDefault()}
            onClick={() => {
              if (longPressedRef.current) {
                longPressedRef.current = false;
                return;
              }
              onRepeat(item);
            }}
            className={cn(
              'flex shrink-0 snap-start select-none items-center gap-2 rounded-full border border-border/60 bg-card px-3.5 text-left transition',
              'min-h-[44px] active:scale-[0.98] active:bg-muted/60',
            )}
          >
            <span className="max-w-[14ch] truncate text-sm font-medium">
              {item.description}
            </span>
            <span className="font-mono text-sm font-semibold tabular-nums text-foreground">
              {formatCurrency(item.amount)}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
