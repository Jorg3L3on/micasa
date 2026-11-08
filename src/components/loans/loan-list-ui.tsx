'use client';

import type { CSSProperties } from 'react';
import { formatDayMonth } from '@/lib/calendar-dates';
import type { LoanHealth } from '@/lib/finance/loan-list-summary';
import { AURA_TONE_HEX, getAuraBarStyle, type AuraTone } from '@/lib/ui/aura-palette';
import { STATUS_BADGE_CLASS, STATUS_NEUTRAL_BADGE_CLASS } from '@/lib/status-tone';
import { cn } from '@/lib/utils';

/** Shared bits for the Préstamos list: bars, dots, tones and health badges. */

export const LOAN_BAR_FILL_STYLE: CSSProperties = {
  backgroundImage: `linear-gradient(90deg, ${AURA_TONE_HEX.primary}, ${AURA_TONE_HEX.violet})`,
  boxShadow: getAuraBarStyle(AURA_TONE_HEX.primary).boxShadow,
};

export const LOAN_PAID_BAR_FILL_STYLE: CSSProperties = getAuraBarStyle(
  AURA_TONE_HEX.emerald,
);

/** Track without overflow-hidden so the glow and the late marker show. */
export const LoanProgressBar = ({
  pct,
  expectedPct,
  size = 'md',
  paid = false,
  className,
  label,
}: {
  pct: number;
  expectedPct?: number | null;
  size?: 'sm' | 'md';
  paid?: boolean;
  className?: string;
  label: string;
}) => {
  const showMarker = expectedPct != null && expectedPct > pct + 0.5;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      className={cn(
        'relative rounded-full bg-muted/70 dark:bg-white/[0.08]',
        size === 'md' ? 'h-2' : 'h-1.5',
        className,
      )}
    >
      <span
        className="absolute inset-y-0 left-0 rounded-full"
        style={{
          width: `${Math.max(pct, pct > 0 ? 2 : 0)}%`,
          ...(paid ? LOAN_PAID_BAR_FILL_STYLE : LOAN_BAR_FILL_STYLE),
        }}
      />
      {showMarker ? (
        <span
          aria-hidden
          title="Donde iría el avance sin atraso"
          className="absolute -inset-y-0.5 w-0.5 rounded-full bg-destructive"
          style={{ left: `calc(${expectedPct}% - 1px)` }}
        />
      ) : null}
    </div>
  );
};

export const ToneDot = ({ tone }: { tone: AuraTone | 'muted' }) => (
  <span
    aria-hidden
    className="inline-block size-1.5 shrink-0 rounded-full"
    style={{
      backgroundColor:
        tone === 'muted' ? 'var(--color-muted-foreground)' : AURA_TONE_HEX[tone],
    }}
  />
);

export const TONE_TEXT_CLASS: Record<AuraTone, string> = {
  destructive: 'text-destructive',
  amber: 'text-status-pending',
  blue: 'text-status-info',
  emerald: 'text-status-income',
  violet: 'text-status-info',
  primary: 'text-status-info',
};

export const formatYmdRange = (from: string, to: string): string =>
  from === to ? formatDayMonth(from) : `${formatDayMonth(from)} – ${formatDayMonth(to)}`;

const HEALTH_BADGE: Record<LoanHealth, { className: string; label: string }> = {
  overdue: { className: STATUS_BADGE_CLASS.overdue, label: 'Vencido' },
  soon: { className: STATUS_BADGE_CLASS.pending, label: 'Vence pronto' },
  ok: { className: STATUS_BADGE_CLASS.info, label: 'Al día' },
  paused: { className: STATUS_NEUTRAL_BADGE_CLASS, label: 'Pausado' },
  paid: { className: STATUS_BADGE_CLASS.income, label: 'Liquidado' },
  cancelled: { className: STATUS_NEUTRAL_BADGE_CLASS, label: 'Cancelado' },
};

/** One badge per card; the worst state wins. Always one line. */
export const LoanHealthBadge = ({
  health,
  label,
  className,
}: {
  health: LoanHealth;
  label?: string;
  className?: string;
}) => (
  <span
    className={cn(
      'inline-flex h-6 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2 text-xs font-semibold',
      HEALTH_BADGE[health].className,
      className,
    )}
  >
    {health === 'overdue' ? (
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
    ) : null}
    {label ?? HEALTH_BADGE[health].label}
  </span>
);
