'use client';

import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
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
    <div className="mb-6 flex items-center gap-3">
      <Tooltip>
        <TooltipTrigger asChild>
          {hasPrevMonth ? (
            <Button variant="ghost" size="icon" asChild>
              <Link
                href={prevHref}
                aria-label={`Mes anterior: ${prevMonthLabel}`}
              >
                <ChevronLeft className="h-4 w-4" />
              </Link>
            </Button>
          ) : (
            <span className="inline-flex">
              <Button
                variant="ghost"
                size="icon"
                disabled
                aria-label={`Mes anterior: ${prevMonthLabel} (no disponible)`}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </span>
          )}
        </TooltipTrigger>
        <TooltipContent side="bottom" sideOffset={4}>
          {hasPrevMonth
            ? `Mes anterior: ${prevMonthLabel}`
            : `${prevMonthLabel} (no disponible)`}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
