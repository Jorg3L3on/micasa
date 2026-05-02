'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { buildOwnerQuery } from '@/lib/api/client-fetch';
import { useFinanceContext } from '@/context/finance-context';
import { TasksModuleProvider } from '@/components/tasks/tasks-module-context';
import TasksModuleScopeBar from '@/components/tasks/TasksModuleScopeBar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const TAB_ITEMS: Array<{
  href: string;
  label: string;
  match: (pathname: string) => boolean;
}> = [
  {
    href: '/tasks',
    label: 'Hoy',
    match: (p) => p === '/tasks' || p === '/tasks/',
  },
  { href: '/tasks/habits', label: 'Hábitos', match: (p) => p.startsWith('/tasks/habits') },
  {
    href: '/tasks/todo-lists',
    label: 'Listas',
    match: (p) =>
      p.startsWith('/tasks/todo-lists') ||
      (p.startsWith('/tasks/lists/') && !p.includes('/tasks/lists/new')),
  },
  {
    href: '/tasks/scheduled',
    label: 'Agenda',
    match: (p) => p.startsWith('/tasks/scheduled'),
  },
  {
    href: '/tasks/routines',
    label: 'Rutinas',
    match: (p) => p.startsWith('/tasks/routines'),
  },
];

function buildTasksHref(path: string, ownerQs: string): string {
  return `${path}${ownerQs ? `?${ownerQs}` : ''}`;
}

export default function TasksModuleShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { context } = useFinanceContext();
  const ownerQs = buildOwnerQuery(context).toString();

  return (
    <TasksModuleProvider>
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold leading-tight">Tareas</h2>
            <p className="text-xs text-muted-foreground">
              Hábitos, listas y rutinas—empieza por Hoy.
            </p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="gap-2 shrink-0" aria-label="Añadir hábito, tarea o rutina">
                <Plus className="h-4 w-4" />
                Añadir
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem
                onClick={() => router.push(buildTasksHref('/tasks/habits', ownerQs))}
              >
                Nuevo hábito
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() =>
                  router.push(`${buildTasksHref('/tasks', ownerQs)}#quick-task`)
                }
              >
                Nueva tarea rápida (Hoy)
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => router.push(buildTasksHref('/tasks/routines', ownerQs))}
              >
                Nueva rutina
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => router.push(buildTasksHref('/tasks/todo-lists', ownerQs))}
              >
                Nueva lista
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <TasksModuleScopeBar />

        <div className="relative -mx-1">
          <div
            className="pointer-events-none absolute inset-y-0 left-0 z-10 w-8 bg-linear-to-r from-background to-transparent"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-y-0 right-0 z-10 w-8 bg-linear-to-l from-background to-transparent"
            aria-hidden
          />
          <nav
            className="scrollbar-hide flex gap-1 overflow-x-auto px-1 pb-1"
            aria-label="Secciones del módulo Tareas"
          >
            {TAB_ITEMS.map((tab) => {
              const active = tab.match(pathname);
              return (
                <Link
                  key={tab.href}
                  href={buildTasksHref(tab.href, ownerQs)}
                  className={cn(
                    'shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
                    active
                      ? 'border-border bg-muted/50 text-foreground'
                      : 'border-transparent text-muted-foreground hover:bg-muted/40 hover:text-foreground',
                  )}
                >
                  {tab.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="min-h-[240px]">{children}</div>
      </div>
    </TasksModuleProvider>
  );
}
