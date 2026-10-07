'use client';

import { CircleHelp } from 'lucide-react';

import { NavPillLink } from '@/components/nav-pill';

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
