'use client';

import { CircleHelp, LogOut, UserRound } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';

import { NavPillLink, navPillIconClass } from '@/components/nav-pill';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

type TooltipSide = 'right' | 'top';

/** In-app help. There is no docs route; Configuración is the settings hub. */
export const NavHelpLink = ({
  href,
  tooltipSide = 'right',
}: {
  href: string;
  tooltipSide?: TooltipSide;
}) => (
  <NavPillLink
    href={href}
    label="Ayuda"
    icon={CircleHelp}
    tooltipSide={tooltipSide}
  />
);

export const NavAccountMenu = ({
  accountHref,
  tooltipSide = 'right',
}: {
  accountHref: string;
  tooltipSide?: TooltipSide;
}) => {
  const router = useRouter();

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger
            className={navPillIconClass(false)}
            aria-label="Cuenta"
          >
            <UserRound className="size-5" strokeWidth={1.75} aria-hidden />
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side={tooltipSide}>Cuenta</TooltipContent>
      </Tooltip>
      <DropdownMenuContent
        side={tooltipSide === 'top' ? 'top' : 'right'}
        align="end"
        sideOffset={8}
        className="z-50 min-w-48 rounded-xl border-border/60 dark:border-white/[0.08] dark:bg-popover/95 dark:backdrop-blur-xl"
      >
        <DropdownMenuItem onClick={() => router.push(accountHref)}>
          <UserRound data-icon="inline-start" />
          Cuenta
        </DropdownMenuItem>
        <DropdownMenuItem
          variant="destructive"
          onClick={() => signOut({ callbackUrl: '/login' })}
        >
          <LogOut data-icon="inline-start" />
          Cerrar sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
