'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  CheckCircle2,
  CalendarDays,
  ChevronRight,
  ListChecks,
  Loader2,
  Repeat2,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import EmptyState from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useFinanceContext } from '@/context/finance-context';
import TasksDayDialog from '@/components/tasks/TasksDayDialog';
import {
  completeHabit,
  completeRoutine,
  completeTaskItem,
  createTaskItem,
  listHabits,
  listRoutines,
  listTaskItems,
  listTaskLists,
} from '@/lib/api';
import { compareTasksByUrgency, getTaskTemporalBucket, getTaskUrgencyLabel } from '@/components/tasks/task-time-groups';
import { getStartOfDay } from '@/components/tasks/task-time-groups';
import type { HabitDto } from '@/types/habit';
import type { RoutineDto } from '@/types/routine';
import type { TaskItemDto } from '@/types/task-item';
import type { TaskListDto } from '@/types/task-list';

export default function TasksOverview() {
  const { context } = useFinanceContext();
  const [loading, setLoading] = useState(true);
  const [lists, setLists] = useState<TaskListDto[]>([]);
  const [tasks, setTasks] = useState<TaskItemDto[]>([]);
  const [habits, setHabits] = useState<HabitDto[]>([]);
  const [routines, setRoutines] = useState<RoutineDto[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [dayDialogOpen, setDayDialogOpen] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [listsResult, tasksResult, habitsResult, routinesResult] = await Promise.all([
        listTaskLists(context),
        listTaskItems(context),
        listHabits(context),
        listRoutines(context),
      ]);
      setLists(listsResult);
      setTasks(tasksResult);
      setHabits(habitsResult);
      setRoutines(routinesResult);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo cargar tareas');
    } finally {
      setLoading(false);
    }
  }, [context]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const pendingTasks = useMemo(
    () => tasks.filter((task) => task.status !== 'DONE').sort(compareTasksByUrgency),
    [tasks],
  );
  const topThreeToday = useMemo(
    () =>
      pendingTasks
        .filter((task) => {
          const bucket = getTaskTemporalBucket(task);
          return bucket === 'hoy' || bucket === 'atrasada';
        })
        .slice(0, 3),
    [pendingTasks],
  );
  const riskyTasks = useMemo(
    () => pendingTasks.filter((task) => ['atrasada', 'hoy'].includes(getTaskTemporalBucket(task))).slice(0, 6),
    [pendingTasks],
  );
  const firstHabit = habits[0] ?? null;
  const firstRoutine = routines[0] ?? null;
  const firstList = lists[0] ?? null;
  const calendarTaskDates = useMemo(() => {
    const dayMap = new Map<number, Date>();
    for (const task of tasks) {
      if (!task.due_at) continue;
      const day = getStartOfDay(new Date(task.due_at));
      dayMap.set(day.getTime(), day);
    }
    return Array.from(dayMap.values());
  }, [tasks]);

  const handleCreateTaskForDay = async ({
    title,
    dueAt,
  }: {
    title: string;
    dueAt: Date;
  }) => {
    if (!firstList) {
      toast.error('Primero crea una lista de tareas');
      return;
    }
    await createTaskItem({
      list_id: firstList.id,
      title,
      due_at: dueAt.toISOString(),
    }, context);
    toast.success('Tarea creada para el día seleccionado');
    await loadData();
  };

  const handleCompleteTaskForDay = async (taskId: number) => {
    await completeTaskItem(taskId, context);
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
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard icon={ListChecks} label="Listas de tareas" value={String(lists.length)} />
        <MetricCard
          icon={CheckCircle2}
          label="Tareas pendientes"
          value={String(pendingTasks.length)}
        />
        <MetricCard
          icon={Repeat2}
          label="Hábitos activos"
          value={String(habits.filter((h) => h.active).length)}
        />
        <MetricCard
          icon={Sparkles}
          label="Rutinas activas"
          value={String(routines.filter((r) => r.active).length)}
        />
      </div>

      <Card className="rounded-xl border-border/60">
        <CardHeader>
          <CardTitle className="text-sm">Centro de hoy</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
            <Button
              className="w-full"
              onClick={() =>
                void (async () => {
                  if (!firstList) {
                    toast.error('Primero crea una lista de tareas');
                    return;
                  }
                  await createTaskItem({ list_id: firstList.id, title: 'Nueva tarea rápida' }, context);
                  toast.success('Tarea rápida creada');
                  await loadData();
                })()
              }
            >
              Crear tarea rápida
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-full sm:w-auto">
                  Más acciones
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() =>
                    void (async () => {
                      if (!firstHabit) {
                        toast.error('No hay hábitos disponibles');
                        return;
                      }
                      await completeHabit(firstHabit.id, {}, context);
                      toast.success('Hábito marcado');
                      await loadData();
                    })()
                  }
                >
                  Marcar hábito
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() =>
                    void (async () => {
                      if (!firstRoutine) {
                        toast.error('No hay rutinas disponibles');
                        return;
                      }
                      await completeRoutine(firstRoutine.id, {}, context);
                      toast.success('Rutina ejecutada');
                      await loadData();
                    })()
                  }
                >
                  Ejecutar rutina
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-2 rounded-md border p-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Top 3 de hoy
              </p>
              {topThreeToday.length === 0 ? (
                <EmptyState message="No hay tareas críticas para hoy" />
              ) : (
                topThreeToday.map((task) => {
                  const bucket = getTaskTemporalBucket(task);
                  return (
                    <div
                      key={task.id}
                      className="rounded-md border p-2"
                    >
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{task.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {getTaskUrgencyLabel(bucket, task.due_at)}
                          </p>
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
                  );
                })
              )}
            </div>

            <div className="space-y-2 rounded-md border p-3">
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                En riesgo
              </p>
              {riskyTasks.length === 0 ? (
                <EmptyState message="No hay tareas en riesgo" />
              ) : (
                riskyTasks.map((task) => {
                  const bucket = getTaskTemporalBucket(task);
                  return (
                    <div key={task.id} className="rounded-md border p-2">
                      <p className="text-sm font-medium">{task.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {getTaskUrgencyLabel(bucket, task.due_at)}
                      </p>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Navega por módulos para planificar y mantener consistencia diaria.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
          <SectionLink
            href="/tasks/todo-lists"
            title="Listas de tareas"
            subtitle="Organiza tus listas y ve su progreso."
          />
          <SectionLink
            href="/tasks/scheduled"
            title="Tareas programadas"
            subtitle="Controla tareas pendientes y con fecha."
          />
          <SectionLink
            href="/tasks/habits"
            title="Hábitos"
            subtitle="Da seguimiento a rachas y cumplimiento."
          />
          <SectionLink
            href="/tasks/routines"
            title="Rutinas diarias"
            subtitle="Ejecuta y mide tus rutinas por día."
          />
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-xl border-border/60 border-l-[3px] border-l-blue-500/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/10 dark:bg-blue-500/15">
              <CalendarDays className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
            </span>
            Calendario de tareas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={(date) => {
              if (!date) return;
              setSelectedDate(date);
              setDayDialogOpen(true);
            }}
            modifiers={{ hasTasks: calendarTaskDates }}
            modifiersClassNames={{
              hasTasks:
                'relative after:absolute after:bottom-1 after:left-1/2 after:h-1.5 after:w-1.5 after:-translate-x-1/2 after:rounded-full after:bg-blue-500',
            }}
            className="rounded-md border"
          />
        </CardContent>
      </Card>

      <TasksDayDialog
        open={dayDialogOpen}
        onOpenChange={setDayDialogOpen}
        selectedDate={selectedDate}
        tasks={tasks}
        routines={routines}
        onCreateTask={handleCreateTaskForDay}
        onCompleteTask={handleCompleteTaskForDay}
      />
    </div>
  );
}

const SectionLink = ({
  href,
  title,
  subtitle,
}: {
  href: string;
  title: string;
  subtitle: string;
}) => (
  <Link
    href={href}
    className="flex items-center justify-between rounded-md border p-3 transition-colors hover:bg-muted/40"
  >
    <div className="min-w-0">
      <p className="truncate text-sm font-medium">{title}</p>
      <p className="text-xs text-muted-foreground">{subtitle}</p>
    </div>
    <ChevronRight className="h-4 w-4 text-muted-foreground" />
  </Link>
);

const MetricCard = ({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof ListChecks;
  label: string;
  value: string;
}) => (
  <div className="rounded-lg border border-border/60 border-l-[3px] border-l-sky-500/50 bg-transparent px-2.5 py-2">
    <div className="flex items-center gap-2">
      <span className="flex h-5 w-5 items-center justify-center rounded-md bg-sky-500/10 dark:bg-sky-500/15 shrink-0">
        <Icon className="h-3 w-3 text-sky-600 dark:text-sky-400" />
      </span>
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
    </div>
    <p className="mt-1 font-mono tabular-nums text-sm font-bold">{value}</p>
  </div>
);
