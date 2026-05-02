'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TasksModuleProvider } from '@/components/tasks/tasks-module-context';
import TasksModuleScopeBar from '@/components/tasks/TasksModuleScopeBar';
import TasksTodayView from '@/components/tasks/TasksTodayView';
import { useFinanceContext } from '@/context/finance-context';
import { buildOwnerQuery } from '@/lib/api/client-fetch';

/**
 * Embeds the “Hoy” tasks experience on the dashboard (no TasksModuleShell—avoids nested module tabs).
 */
export default function DashboardTasksTab() {
  const { context } = useFinanceContext();
  const ownerQs = buildOwnerQuery(context).toString();
  const tasksHref = `/tasks${ownerQs ? `?${ownerQs}` : ''}`;

  return (
    <TasksModuleProvider>
      <div className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Tu día en un vistazo</p>
          </div>
          <Button variant="ghost" size="sm" className="h-8 w-fit gap-1 shrink-0" asChild>
            <Link href={tasksHref} aria-label="Abrir módulo Tareas completo">
              Abrir módulo Tareas
              <ChevronRight className="size-3.5" aria-hidden />
            </Link>
          </Button>
        </div>
        <TasksModuleScopeBar />
        <TasksTodayView />
      </div>
    </TasksModuleProvider>
  );
}
