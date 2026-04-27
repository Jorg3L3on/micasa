'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarClock, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import EmptyState from '@/components/EmptyState';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useFinanceContext } from '@/context/finance-context';
import { completeTaskItem, createTaskItem, listTaskItems, listTaskLists } from '@/lib/api';
import {
  compareTasksByUrgency,
  getTaskTemporalBucket,
  getTaskUrgencyLabel,
  type TaskTemporalBucket,
} from '@/components/tasks/task-time-groups';
import type { TaskItemDto } from '@/types/task-item';

type TemporalFilter = 'TODAS' | 'HOY' | 'PROXIMAS' | 'ATRASADAS' | 'SIN_FECHA';

export default function ScheduledTasksPageView() {
  const { context } = useFinanceContext();
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<TaskItemDto[]>([]);
  const [activeListId, setActiveListId] = useState<number | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [activeFilter, setActiveFilter] = useState<TemporalFilter>('TODAS');

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [taskRows, lists] = await Promise.all([
        listTaskItems(context),
        listTaskLists(context),
      ]);
      setTasks(taskRows);
      setActiveListId(lists[0]?.id ?? null);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'No se pudieron cargar las tareas',
      );
    } finally {
      setLoading(false);
    }
  }, [context]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const pendingTasks = useMemo(() => {
    const filtered = tasks.filter((task) => task.status !== 'DONE');
    const byFilter = filtered.filter((task) => {
      const bucket = getTaskTemporalBucket(task);
      if (activeFilter === 'TODAS') return true;
      if (activeFilter === 'HOY') return bucket === 'hoy';
      if (activeFilter === 'PROXIMAS') return bucket === 'proxima' || bucket === 'manana';
      if (activeFilter === 'ATRASADAS') return bucket === 'atrasada';
      if (activeFilter === 'SIN_FECHA') return bucket === 'sin_fecha';
      return true;
    });
    return byFilter.sort(compareTasksByUrgency);
  }, [tasks, activeFilter]);

  const handleCreateTask = async () => {
    if (!newTaskTitle.trim() || !activeListId) return;
    await createTaskItem({ list_id: activeListId, title: newTaskTitle.trim() }, context);
    setNewTaskTitle('');
    await loadData();
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <Card className="rounded-xl border-border/60 border-l-[3px] border-l-amber-500/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/10 dark:bg-amber-500/15">
            <CalendarClock className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
          </span>
          Tareas programadas
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={newTaskTitle}
            placeholder={
              activeListId
                ? 'Nueva tarea programada'
                : 'Primero crea una lista de tareas'
            }
            onChange={(event) => setNewTaskTitle(event.target.value)}
            aria-label="Título de tarea programada"
            disabled={!activeListId}
          />
          <Button
            className="w-full sm:w-auto"
            onClick={() => void handleCreateTask()}
            disabled={!activeListId}
          >
            Crear
          </Button>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {([
            ['TODAS', 'Todas'],
            ['HOY', 'Hoy'],
            ['PROXIMAS', 'Próximas'],
            ['ATRASADAS', 'Atrasadas'],
            ['SIN_FECHA', 'Sin fecha'],
          ] as const).map(([value, label]) => (
            <Button
              key={value}
              size="sm"
              variant={activeFilter === value ? 'default' : 'outline'}
              onClick={() => setActiveFilter(value)}
            >
              {label}
            </Button>
          ))}
        </div>
        {pendingTasks.length === 0 ? (
          <EmptyState message="No hay tareas pendientes" />
        ) : (
          <div className="space-y-2">
            {pendingTasks.map((task) => (
              <div
                key={task.id}
                className="rounded-md border p-2"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{task.title}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <TemporalBadge bucket={getTaskTemporalBucket(task)} />
                    <p className="text-xs text-muted-foreground">
                      {getTaskUrgencyLabel(getTaskTemporalBucket(task), task.due_at)}
                    </p>
                  </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full sm:w-auto"
                    onClick={() => void completeTaskItem(task.id, context).then(loadData)}
                  >
                    Completar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const TemporalBadge = ({ bucket }: { bucket: TaskTemporalBucket }) => {
  if (bucket === 'atrasada') return <Badge variant="destructive">Atrasada</Badge>;
  if (bucket === 'hoy') return <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300">Hoy</Badge>;
  if (bucket === 'manana' || bucket === 'proxima')
    return <Badge variant="secondary">Próxima</Badge>;
  return <Badge variant="outline">Sin fecha</Badge>;
};
