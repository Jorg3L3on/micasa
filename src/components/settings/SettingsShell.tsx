'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useFinanceContext } from '@/context/finance-context';
import { buttonVariants } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import {
  SETTINGS_NAV_ITEMS,
  SETTINGS_NAV_SECTIONS,
  filterSettingsNavItems,
  isSettingsNavItemActive,
} from '@/components/settings/settings-nav';

export function SettingsShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { context } = useFinanceContext();
  const isHouseContext = context.type === 'house';
  const items = filterSettingsNavItems(SETTINGS_NAV_ITEMS, isHouseContext);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold leading-tight">Configuración</h2>
        <p className="text-xs text-muted-foreground">
          Catálogos, automatizaciones y cuenta.
        </p>
      </div>

      {/* Mobile: horizontal chips */}
      <div className="relative lg:hidden">
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-6 bg-linear-to-r from-background to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-6 bg-linear-to-l from-background to-transparent" />
        <div
          className="flex gap-2 overflow-x-auto scrollbar-hide px-1 py-0.5"
          role="navigation"
          aria-label="Secciones de configuración"
        >
          {items.map((item) => {
            const active = isSettingsNavItemActive(pathname, item);
            const className = cn(
              buttonVariants({
                variant: active ? 'default' : 'outline',
                size: 'sm',
              }),
              'shrink-0 rounded-full',
              item.disabled && 'opacity-60 pointer-events-none',
            );

            if (item.disabled) {
              return (
                <Tooltip key={item.label}>
                  <TooltipTrigger asChild>
                    <span className={className} aria-disabled>
                      {item.label}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Próximamente</p>
                  </TooltipContent>
                </Tooltip>
              );
            }

            return (
              <Link
                key={item.href}
                href={item.href!}
                className={className}
                aria-current={active ? 'page' : undefined}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row lg:gap-8">
        {/* Desktop: sectioned side nav */}
        <nav
          className="hidden w-56 shrink-0 lg:block"
          aria-label="Secciones de configuración"
        >
          <div className="space-y-5">
            {SETTINGS_NAV_SECTIONS.map((section) => {
              const sectionItems = items.filter(
                (item) => item.section === section.id,
              );
              if (sectionItems.length === 0) return null;

              return (
                <div key={section.id} className="space-y-1">
                  <p className="px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {section.label}
                  </p>
                  <ul className="space-y-0.5">
                    {sectionItems.map((item) => {
                      const Icon = item.icon;
                      const active = isSettingsNavItemActive(pathname, item);
                      const itemClass = cn(
                        'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors',
                        active
                          ? 'bg-muted font-medium text-foreground'
                          : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                        item.disabled && 'opacity-60 pointer-events-none',
                      );

                      if (item.disabled) {
                        return (
                          <li key={item.label}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className={itemClass} aria-disabled>
                                  <Icon className="size-4 shrink-0" />
                                  {item.label}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent side="right">
                                <p>Próximamente</p>
                              </TooltipContent>
                            </Tooltip>
                          </li>
                        );
                      }

                      return (
                        <li key={item.href}>
                          <Link
                            href={item.href!}
                            className={itemClass}
                            aria-current={active ? 'page' : undefined}
                          >
                            <Icon className="size-4 shrink-0" />
                            {item.label}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>
        </nav>

        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
