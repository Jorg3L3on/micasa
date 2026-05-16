'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

type MonthlyNavNextLinkProps = {
  href: string;
  label: string;
};

export function MonthlyNavNextLink({ href, label }: MonthlyNavNextLinkProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon-lg" asChild>
          <Link href={href} aria-label={`Ir al mes siguiente: ${label}`}>
            <ChevronRight
              className="size-5 shrink-0"
              strokeWidth={2.25}
              aria-hidden
            />
          </Link>
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={4}>
        {`Ir al mes siguiente (${label})`}
      </TooltipContent>
    </Tooltip>
  );
}
