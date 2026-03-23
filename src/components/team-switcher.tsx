'use client';

import * as React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ChevronsUpDown, Home, Plus, User } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useFinanceContext } from '@/context/finance-context';
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
import { CreateHouseDialog } from '@/components/create-house-dialog';
import type { CreatedHouse } from '@/components/create-house-dialog';
import { clientFetchFromApi } from '@/lib/api';

type TeamSwitcherProps = {
  /** @deprecated No longer used; context comes from session and useFinanceContext */
  teams?: { name: string; logo: React.ElementType; plan: string }[];
};

export function TeamSwitcher(_props: TeamSwitcherProps = {}) {
  const [clientReady, setClientReady] = useState(false);
  const { isMobile } = useSidebar();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const { context, setUserContext, setHouseContext } = useFinanceContext();

  useEffect(() => {
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
              >
                <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                  <DisplayIcon className="size-4" />
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
                className="gap-2 p-2"
                onClick={() => {
                  setUserContext(userId);
                  pushUrlWithOwnerContext('user', userId);
                }}
              >
                <div className="flex size-6 items-center justify-center rounded-md border">
                  <User className="size-3.5 shrink-0" />
                </div>
                {session.user.name}
              </DropdownMenuItem>

              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-muted-foreground text-xs">
                Casas
              </DropdownMenuLabel>
              {houses.map((house) => (
                <DropdownMenuItem
                  key={house.id}
                  className="gap-2 p-2"
                  onClick={() => {
                    setHouseContext(house.id);
                    pushUrlWithOwnerContext('house', house.id);
                  }}
                >
                  <div className="flex size-6 items-center justify-center rounded-md border">
                    <Home className="size-3.5 shrink-0" />
                  </div>
                  {house.name}
                </DropdownMenuItem>
              ))}

              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-muted-foreground text-xs">
                Acciones
              </DropdownMenuLabel>
              <DropdownMenuItem
                className="gap-2 p-2"
                onClick={handleCreateHouse}
              >
                <div className="flex size-6 items-center justify-center rounded-md border bg-transparent">
                  <Plus className="size-4" />
                </div>
                <div className="text-muted-foreground font-medium">
                  Crear casa
                </div>
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
