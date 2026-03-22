'use client';

import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

type MonthlyHeaderProps = {
  year: number;
  month: number;
  monthName: string;
  hasPrevMonth: boolean;
  prevHref: string;
  prevMonthLabel: string;
};

export default function MonthlyHeader({
  year,
  month,
  monthName,
  hasPrevMonth,
  prevHref,
  prevMonthLabel,
}: MonthlyHeaderProps) {
  return (
    <div className="flex shrink-0 items-center gap-2">
      <Tooltip>
        <TooltipTrigger asChild>
          {hasPrevMonth ? (
            <Button variant="ghost" size="icon-lg" asChild>
              <Link
                href={prevHref}
                aria-label={`Ir al mes anterior: ${prevMonthLabel}`}
              >
                <ChevronLeft
                  className="size-5 shrink-0"
                  strokeWidth={2.25}
                  aria-hidden
                />
              </Link>
            </Button>
          ) : (
            <span className="inline-flex">
              <Button
                variant="ghost"
                size="icon-lg"
                disabled
                aria-label={`Mes anterior: ${prevMonthLabel} (no disponible)`}
              >
                <ChevronLeft
                  className="size-5 shrink-0"
                  strokeWidth={2.25}
                  aria-hidden
                />
              </Button>
            </span>
          )}
        </TooltipTrigger>
        <TooltipContent side="bottom" sideOffset={4}>
          {hasPrevMonth
            ? `Ir al mes anterior (${prevMonthLabel})`
            : `${prevMonthLabel} (no disponible)`}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
