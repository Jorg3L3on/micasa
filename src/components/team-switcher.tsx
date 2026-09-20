'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ChevronsUpDown, Home, LogOut, Plus, Settings, User } from 'lucide-react';
import { signOut, useSession } from 'next-auth/react';
import { useFinanceContext } from '@/context/finance-context';
import {
  CreateHouseDialog,
  type CreatedHouse,
} from '@/components/create-house-dialog';
import { SidebarGlyph } from '@/components/sidebar-glyph';
import { clientFetchFromApi } from '@/lib/api/client-fetch';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';

/**
 * Placeholder con la misma envoltura que el botón real pero sin DropdownMenu ni useId de Radix.
 * Evita mismatch de hidratación cuando la sesión no existe en el SSR pero sí en el primer paint del cliente.
 */
const TeamSwitcherShell = () => (
  <SidebarMenu>
    <SidebarMenuItem>
      <div
        className="peer/menu-button flex h-12 w-full items-center gap-2.5 overflow-hidden rounded-xl border border-transparent p-2 text-left outline-none ring-sidebar-ring transition-[width,height,padding] focus-visible:ring-2"
        aria-hidden
      >
        <div className="size-7 shrink-0 animate-pulse rounded-lg bg-black/[0.06] dark:bg-white/[0.08]" />
        <div className="grid min-w-0 flex-1 gap-1 group-data-[collapsible=icon]:hidden">
          <div className="h-3.5 w-30 max-w-full animate-pulse rounded bg-muted" />
          <div className="h-3 w-24 max-w-full animate-pulse rounded bg-muted" />
        </div>
      </div>
    </SidebarMenuItem>
  </SidebarMenu>
);

const contextItemClass = (active: boolean) =>
  cn(
    'gap-2 rounded-lg p-2',
    active &&
      'bg-primary/10 font-medium text-foreground dark:bg-white/[0.07] dark:text-white',
  );

const TEAM_SWITCHER_TRIGGER_CLASS = [
  'border border-transparent bg-transparent shadow-none',
  'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
  'dark:hover:bg-white/[0.05] dark:hover:text-white',
  'data-[state=open]:border-black/[0.08] data-[state=open]:bg-white/80',
  'data-[state=open]:shadow-[0_1px_2px_rgba(15,23,42,0.06),inset_0_1px_0_rgba(255,255,255,0.9)]',
  'dark:data-[state=open]:border-white/20 dark:data-[state=open]:bg-white/[0.10]',
  'dark:data-[state=open]:text-white',
  'dark:data-[state=open]:shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_1px_2px_rgba(0,0,0,0.35)]',
  'ring-0 outline-none focus:outline-none focus-visible:outline-none focus-visible:ring-0',
  'group-data-[collapsible=icon]:size-9! group-data-[collapsible=icon]:p-1!',
].join(' ');

export function TeamSwitcher() {
  const [clientReady, setClientReady] = useState(false);
  const { isMobile } = useSidebar();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const { context, setUserContext, setHouseContext } = useFinanceContext();

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Avoid rendering context-dependent controls before hydration.
    setClientReady(true);
  }, []);

  const pushUrlWithOwnerContext = useCallback(
    (ownerType: 'user' | 'house', ownerId: number) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set('ownerType', ownerType);
      params.set('ownerId', String(ownerId));
      router.push(`${pathname}?${params.toString()}`);
      router.refresh();
    },
    [pathname, router, searchParams],
  );

  const [createOpen, setCreateOpen] = useState(false);
  const [houses, setHouses] = useState<CreatedHouse[]>(
    session?.user?.houses ?? [],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Keep local house list in sync with session changes.
    setHouses(session?.user?.houses ?? []);
  }, [session?.user?.houses]);

  useEffect(() => {
    if (!session?.user?.id) return;
    const loadHouses = async () => {
      try {
        const list = await clientFetchFromApi<CreatedHouse[]>('/api/houses');
        setHouses(list);
      } catch {
        // Keep current state on error (e.g. session houses)
      }
    };
    loadHouses();
  }, [session?.user?.id]);

  const currentHouse =
    context.type === 'house' ? houses.find((h) => h.id === context.id) : null;

  const displayLabel =
    context.type === 'user'
      ? (session?.user?.name ?? 'Personal')
      : (currentHouse?.name ?? 'Casa');
  const DisplayIcon = context.type === 'user' ? User : Home;
  const isPersonalActive = context.type === 'user';

  const ownerQuery = (() => {
    const params = new URLSearchParams();
    const ownerType = searchParams.get('ownerType');
    const ownerId = searchParams.get('ownerId');
    if (ownerType) params.set('ownerType', ownerType);
    if (ownerId) params.set('ownerId', ownerId);
    const qs = params.toString();
    return qs ? `?${qs}` : '';
  })();
  const settingsHref = `/settings${ownerQuery}`;

  const handleCreateHouse = useCallback(() => {
    setCreateOpen(true);
  }, []);

  const handleHouseCreated = useCallback(
    (house: CreatedHouse) => {
      setHouses((prev) => [...prev, house]);
      setHouseContext(house.id);
      pushUrlWithOwnerContext('house', house.id);
    },
    [setHouseContext, pushUrlWithOwnerContext],
  );

  if (!clientReady || !session?.user) {
    return <TeamSwitcherShell />;
  }

  const userId = Number(session.user.id);

  return (
    <>
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton
                size="lg"
                className={TEAM_SWITCHER_TRIGGER_CLASS}
                aria-label={`Contexto: ${displayLabel}`}
              >
                <SidebarGlyph icon={DisplayIcon} />
                <div className="grid min-w-0 flex-1 text-left leading-tight group-data-[collapsible=icon]:hidden">
                  <span className="truncate font-[family-name:var(--font-display)] text-sm font-semibold tracking-tight">
                    {displayLabel}
                  </span>
                  <span className="truncate text-[11px] text-muted-foreground">
                    {context.type === 'user' ? 'Finanzas personales' : 'Casa'}
                  </span>
                </div>
                <ChevronsUpDown className="ml-auto size-4 text-muted-foreground group-data-[collapsible=icon]:hidden" />
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-xl border-border/60 dark:border-white/[0.08] dark:bg-[#0d1327]/95 dark:backdrop-blur-xl"
              align="start"
              side={isMobile ? 'bottom' : 'right'}
              sideOffset={4}
              onCloseAutoFocus={(event) => {
                event.preventDefault();
              }}
            >
              <DropdownMenuLabel className="text-muted-foreground text-xs">
                Personal
              </DropdownMenuLabel>
              <DropdownMenuItem
                className={contextItemClass(isPersonalActive)}
                aria-current={isPersonalActive ? 'true' : undefined}
                onClick={() => {
                  setUserContext(userId);
                  pushUrlWithOwnerContext('user', userId);
                }}
              >
                <SidebarGlyph icon={User} active={isPersonalActive} size="sm" />
                {session.user.name}
              </DropdownMenuItem>

              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-muted-foreground text-xs">
                Casas
              </DropdownMenuLabel>
              {houses.map((house) => {
                const isHouseActive =
                  context.type === 'house' && house.id === context.id;
                return (
                  <DropdownMenuItem
                    key={house.id}
                    className={contextItemClass(isHouseActive)}
                    aria-current={isHouseActive ? 'true' : undefined}
                    onClick={() => {
                      setHouseContext(house.id);
                      pushUrlWithOwnerContext('house', house.id);
                    }}
                  >
                    <SidebarGlyph
                      icon={Home}
                      active={isHouseActive}
                      size="sm"
                    />
                    {house.name}
                  </DropdownMenuItem>
                );
              })}
              <DropdownMenuItem
                className="gap-2 p-2"
                onClick={handleCreateHouse}
              >
                <SidebarGlyph icon={Plus} size="sm" />
                <div className="text-muted-foreground font-medium">
                  Crear casa
                </div>
              </DropdownMenuItem>

              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href={settingsHref}>
                  <Settings data-icon="inline-start" />
                  Configuración
                </Link>
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
        </SidebarMenuItem>
      </SidebarMenu>

      <CreateHouseDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={handleHouseCreated}
      />
    </>
  );
}
