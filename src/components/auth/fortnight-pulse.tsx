'use client';

import { useId, useMemo } from 'react';

import { formatZonedParts } from '@/lib/calendar-dates';
import { cn } from '@/lib/utils';
import {
  dayToPulseX,
  daysInCalendarMonth,
} from '@/components/auth/fortnight-pulse-geometry';

const MONTH_SHORT_ES = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
] as const;

type FortnightPulseProps = {
  className?: string;
  now?: Date;
};

/** Visual fortnight cycle marker — amber node = today within the month. */
export const FortnightPulse = ({
  className,
  now = new Date(),
}: FortnightPulseProps) => {
  const reactId = useId();
  const gradientId = `pulseGrad-${reactId.replace(/:/g, '')}`;

  const { day, daysInMonth, todayLabel, ticks, nodeDays } = useMemo(() => {
    const parts = formatZonedParts(now);
    const days = daysInCalendarMonth(parts.year, parts.month);
    const tickDays: number[] = [];
    for (let d = 1; d <= days; d += 1) {
      if (d === 1 || d === 16 || d === parts.day) continue;
      tickDays.push(d);
    }
    return {
      day: parts.day,
      daysInMonth: days,
      todayLabel: `${parts.day} ${MONTH_SHORT_ES[parts.month - 1]}`,
      ticks: tickDays,
      nodeDays: [1, 16] as const,
    };
  }, [now]);

  const todayX = dayToPulseX(day, daysInMonth);

  return (
    <div className={cn(className)} role="img" aria-label={`Hoy: ${todayLabel}`}>
      <div className="mb-3.5 flex items-baseline justify-between">
        <span className="text-xs text-[#8b899a]">Este mes</span>
        <span className="font-[family-name:var(--font-geist-mono)] text-xs font-medium text-[#f4f3f8]">
          {todayLabel}
        </span>
      </div>
      <svg
        className="block h-16 w-full overflow-visible"
        viewBox="0 0 300 40"
        preserveAspectRatio="none"
        aria-hidden
      >
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#3a37fc" />
            <stop offset="100%" stopColor="#ee477a" />
          </linearGradient>
        </defs>
        <line
          x1="4"
          y1="20"
          x2="296"
          y2="20"
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth="1.5"
          opacity="0.55"
        />
        {ticks.map((d) => {
          const cx = dayToPulseX(d, daysInMonth);
          const major = d % 5 === 0;
          return (
            <rect
              key={d}
              x={cx - 0.5}
              y={major ? 17 : 18.5}
              width={1}
              height={major ? 6 : 3}
              fill="rgba(255,255,255,0.16)"
            />
          );
        })}
        {nodeDays.map((d) => (
          <circle
            key={d}
            cx={dayToPulseX(d, daysInMonth)}
            cy={20}
            r={3.2}
            fill={`url(#${gradientId})`}
          />
        ))}
        <circle
          cx={todayX}
          cy={20}
          r={5}
          fill="none"
          stroke="#ffb454"
          strokeWidth={1}
          className="origin-center animate-[login-pulse-ring_2.6s_ease-in-out_infinite] motion-reduce:animate-none"
          style={{ transformBox: 'fill-box' }}
          opacity={0.5}
        />
        <circle
          cx={todayX}
          cy={20}
          r={3.6}
          fill="#ffb454"
          className="origin-center animate-[login-pulse-breathe_2.6s_ease-in-out_infinite] motion-reduce:animate-none"
          style={{ transformBox: 'fill-box' }}
        />
      </svg>
      <div className="mt-1.5 flex justify-between">
        <span className="text-[10px] text-[#55535f]">1</span>
        <span className="text-[10px] text-[#55535f]">16</span>
        <span className="text-[10px] text-[#55535f]">{daysInMonth}</span>
      </div>
    </div>
  );
};
