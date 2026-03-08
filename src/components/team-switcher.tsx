'use client';

import * as React from 'react';
import { useCallback, useEffect, useState } from 'react';
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
import { CreateHouseDialog } from '@/components/create-house-dialog';
import type { CreatedHouse } from '@/components/create-house-dialog';

type TeamSwitcherProps = {
  /** @deprecated No longer used; context comes from session and useFinanceContext */
  teams?: { name: string; logo: React.ElementType; plan: string }[];
};

export function TeamSwitcher(_props: TeamSwitcherProps = {}) {
  const { isMobile } = useSidebar();
  const { data: session } = useSession();
  const { context, setUserContext, setHouseContext } = useFinanceContext();

  const [createOpen, setCreateOpen] = useState(false);
  const [houses, setHouses] = useState<CreatedHouse[]>(
    session?.user?.houses ?? []
  );

  useEffect(() => {
    setHouses(session?.user?.houses ?? []);
  }, [session?.user?.houses]);

  const currentHouse =
    context.type === 'house'
      ? houses.find((h) => h.id === context.id)
      : null;

  const displayLabel =
    context.type === 'user'
      ? session?.user?.name ?? 'Personal'
      : currentHouse?.name ?? 'Casa';
  const DisplayIcon = context.type === 'user' ? User : Home;

  const handleCreateHouse = useCallback(() => {
    setCreateOpen(true);
  }, []);

  const handleHouseCreated = useCallback(
    (house: CreatedHouse) => {
      setHouses((prev) => [...prev, house]);
      setHouseContext(house.id);
    },
    [setHouseContext]
  );

  if (!session?.user) {
    return null;
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
                PERSONAL
              </DropdownMenuLabel>
              <DropdownMenuItem
                className="gap-2 p-2"
                onClick={() => setUserContext(userId)}
              >
                <div className="flex size-6 items-center justify-center rounded-md border">
                  <User className="size-3.5 shrink-0" />
                </div>
                {session.user.name}
              </DropdownMenuItem>

              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-muted-foreground text-xs">
                HOUSES
              </DropdownMenuLabel>
              {houses.map((house) => (
                <DropdownMenuItem
                  key={house.id}
                  className="gap-2 p-2"
                  onClick={() => setHouseContext(house.id)}
                >
                  <div className="flex size-6 items-center justify-center rounded-md border">
                    <Home className="size-3.5 shrink-0" />
                  </div>
                  {house.name}
                </DropdownMenuItem>
              ))}

              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-muted-foreground text-xs">
                ACTION
              </DropdownMenuLabel>
              <DropdownMenuItem
                className="gap-2 p-2"
                onClick={handleCreateHouse}
              >
                <div className="flex size-6 items-center justify-center rounded-md border bg-transparent">
                  <Plus className="size-4" />
                </div>
                <div className="text-muted-foreground font-medium">
                  Create House
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
