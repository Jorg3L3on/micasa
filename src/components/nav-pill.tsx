'use client';

import type { LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

/** Floating glass capsule. Direction comes from the caller (column rail or row dock). */
export const NAV_PILL_SHELL_CLASS = cn(
  'flex items-center gap-1 rounded-full p-1.5',
  'border border-border/70 bg-card/85 shadow-panel',
  'backdrop-blur-xl backdrop-saturate-150',
  'dark:border-white/15 dark:bg-secondary/75',
);

/** Inactive line icon, or a solid primary circle when the destination is current. */
export const navPillIconClass = (active = false) =>
  cn(
    'relative inline-flex size-10 shrink-0 items-center justify-center rounded-full',
    'transition-colors duration-200',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
    'disabled:pointer-events-none disabled:opacity-50',
    active
      ? 'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground'
      : 'text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground',
  );

export const hrefWithOwnerQuery = (href: string, queryString: string): string => {
  if (!queryString) return href;
  const join = href.includes('?') ? '&' : '?';
  return `${href}${join}${queryString}`;
};

/** Owner context carried on nav links (`ownerType` / `ownerId` only). */
export const useNavOwnerQuery = (): string => {
  const searchParams = useSearchParams();
  const params = new URLSearchParams();
  const ownerType = searchParams.get('ownerType');
  const ownerId = searchParams.get('ownerId');
  if (ownerType) params.set('ownerType', ownerType);
  if (ownerId) params.set('ownerId', ownerId);
  return params.toString();
};

type NavPillLinkProps = {
  href: string;
  label: string;
  icon: LucideIcon;
  active?: boolean;
  tooltipSide?: 'right' | 'top';
  /** `slot` stretches the hit target in the mobile dock; the highlight stays a circle. */
  layout?: 'icon' | 'slot';
};

export const NavPillLink = ({
  href,
  label,
  icon: Icon,
  active = false,
  tooltipSide = 'right',
  layout = 'icon',
}: NavPillLinkProps) => {
  const icon = (
    <span
      className={cn(
        'flex size-10 items-center justify-center rounded-full',
        active
          ? 'bg-primary text-primary-foreground'
          : 'text-muted-foreground group-hover/pill:bg-foreground/[0.06] group-hover/pill:text-foreground',
      )}
    >
      <Icon className="size-5" strokeWidth={1.75} aria-hidden />
    </span>
  );

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          href={href}
          aria-label={label}
          aria-current={active ? 'page' : undefined}
          className={cn(
            'group/pill focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
            layout === 'slot'
              ? 'flex h-full min-w-0 flex-1 items-center justify-center rounded-full'
              : navPillIconClass(active),
          )}
        >
          {layout === 'slot' ? icon : (
            <Icon className="size-5" strokeWidth={1.75} aria-hidden />
          )}
        </Link>
      </TooltipTrigger>
      <TooltipContent side={tooltipSide}>{label}</TooltipContent>
    </Tooltip>
  );
};

type NavPillButtonProps = {
  label: string;
  icon: LucideIcon;
  active?: boolean;
  tooltipSide?: 'right' | 'top';
  layout?: 'icon' | 'slot';
  expanded?: boolean;
  onClick: () => void;
};

export const NavPillButton = ({
  label,
  icon: Icon,
  active = false,
  tooltipSide = 'right',
  layout = 'icon',
  expanded,
  onClick,
}: NavPillButtonProps) => {
  const glyph = (
    <Icon className="size-5" strokeWidth={1.75} aria-hidden />
  );

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          aria-expanded={expanded}
          aria-haspopup={expanded === undefined ? undefined : 'dialog'}
          onClick={onClick}
          className={cn(
            'group/pill',
            layout === 'slot'
              ? 'flex h-full min-w-0 flex-1 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60'
              : navPillIconClass(active),
          )}
        >
          {layout === 'slot' ? (
            <span
              className={cn(
                'flex size-10 items-center justify-center rounded-full',
                active
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground group-hover/pill:bg-foreground/[0.06] group-hover/pill:text-foreground',
              )}
            >
              {glyph}
            </span>
          ) : (
            glyph
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent side={tooltipSide}>{label}</TooltipContent>
    </Tooltip>
  );
};
