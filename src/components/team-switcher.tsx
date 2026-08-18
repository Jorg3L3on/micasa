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
        className="peer/menu-button flex h-12 w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left outline-none ring-sidebar-ring transition-[width,height,padding] focus-visible:ring-2"
        aria-hidden
      >
        <div className="size-8 shrink-0 animate-pulse rounded-lg bg-sidebar-primary/25" />
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
    'gap-2 p-2',
    active && 'bg-sidebar-accent font-medium text-sidebar-accent-foreground',
  );

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
                className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                aria-label={`Contexto: ${displayLabel}`}
              >
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-linear-to-br from-[#3a37fc] to-[#ee477a] text-white shadow-[0_8px_20px_-10px_rgba(58,55,252,0.8)]">
                  <DisplayIcon className="size-4" data-icon="inline-start" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{displayLabel}</span>
                  <span className="truncate text-xs">
                    {context.type === 'user' ? 'Finanzas personales' : 'Casa'}
                  </span>
                </div>
                <ChevronsUpDown className="ml-auto" />
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
              align="start"
              side={isMobile ? 'bottom' : 'right'}
              sideOffset={4}
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
                <div className="flex size-6 items-center justify-center rounded-md border">
                  <User className="size-3.5 shrink-0" data-icon="inline-start" />
                </div>
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
                    <div className="flex size-6 items-center justify-center rounded-md border">
                      <Home className="size-3.5 shrink-0" data-icon="inline-start" />
                    </div>
                    {house.name}
                  </DropdownMenuItem>
                );
              })}
              <DropdownMenuItem
                className="gap-2 p-2"
                onClick={handleCreateHouse}
              >
                <div className="flex size-6 items-center justify-center rounded-md border bg-transparent">
                  <Plus className="size-4" data-icon="inline-start" />
                </div>
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
